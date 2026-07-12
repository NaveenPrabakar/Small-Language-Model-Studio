from __future__ import annotations

import json
import re
from typing import AsyncIterator

from ..config import get_settings
from ..database import session_scope
from ..models import MessageRole
from ..ollama_client import OllamaClient, OllamaError
from . import conversation_service, mcp_service, preset_service

MAX_TOOL_ROUNDS = 3


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _format_tool_catalog(tools: list[mcp_service.DiscoveredTool]) -> str:
    lines: list[str] = []
    for tool in tools:
        schema = json.dumps(tool.input_schema, ensure_ascii=True) if tool.input_schema else "{}"
        description = tool.description or ""
        lines.append(
            f"- server_id: {tool.server_id}\n"
            f"  server_name: {tool.server_name}\n"
            f"  server_url: {tool.server_url}\n"
            f"  tool: {tool.name}\n"
            f"  description: {description}\n"
            f"  input_schema: {schema}"
        )
    return "\n".join(lines)


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _tool_request_from_text(text: str) -> list[dict] | None:
    candidate = _strip_code_fences(text)
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        return None

    tool_calls = data.get("tool_calls") if isinstance(data, dict) else None
    if not isinstance(tool_calls, list) or not tool_calls:
        return None

    normalized: list[dict] = []
    for call in tool_calls:
        if not isinstance(call, dict):
            continue
        server_id = call.get("server_id")
        tool_name = call.get("tool") or call.get("name")
        arguments = call.get("arguments") or {}
        if not isinstance(server_id, str) or not isinstance(tool_name, str) or not isinstance(arguments, dict):
            continue
        normalized.append({"server_id": server_id, "tool": tool_name, "arguments": arguments})
    return normalized or None


def _assistant_result_messages(tool_results: list[dict]) -> list[dict]:
    return [
        {
            "role": "system",
            "content": (
                "MCP tool result:\n"
                f"server: {item['server_name']}\n"
                f"tool: {item['tool_name']}\n"
                f"result:\n{item['result']}"
            ),
        }
        for item in tool_results
    ]


def _parse_prompt_directives(user_content: str) -> tuple[str | None, list[str], str]:
    agent_name: str | None = None
    skill_names: list[str] = []
    lines = user_content.splitlines()
    body_index = 0

    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            body_index = index + 1
            continue
        if not stripped.startswith("/"):
            body_index = index
            break

        parts = stripped.split(maxsplit=1)
        command = parts[0].lower()
        argument = parts[1].strip() if len(parts) > 1 else ""
        if command == "/agent" and argument:
            agent_name = argument
        elif command == "/skill" and argument:
            skill_names.append(argument)
        else:
            body_index = index
            break
        body_index = index + 1

    body = "\n".join(lines[body_index:]).strip()
    return agent_name, skill_names, body


async def _load_prompt_messages(
    db,
    *,
    agent_name: str | None,
    skill_names: list[str],
) -> list[dict]:
    messages: list[dict] = []

    if agent_name:
        agent = await preset_service.get_agent_by_name(db, agent_name)
        if agent is None:
            raise ValueError(f"Agent not found: {agent_name}")
        messages.append({"role": "system", "content": f"Agent instructions:\n{agent.system_prompt}"})

    for skill_name in skill_names:
        skill = await preset_service.get_skill_by_name(db, skill_name)
        if skill is None:
            raise ValueError(f"Skill not found: {skill_name}")
        messages.append({"role": "system", "content": f"Skill instructions ({skill.name}):\n{skill.instructions}"})

    return messages


async def _discover_tools(servers: list[mcp_service.McpServer]) -> list[mcp_service.DiscoveredTool]:
    discovered: list[mcp_service.DiscoveredTool] = []
    for server in servers:
        try:
            discovered.extend(await mcp_service.list_server_tools(server))
        except Exception:
            continue
    return discovered


async def stream_chat_turn(
    conversation_id: str,
    user_content: str,
    ollama: OllamaClient,
    model_override: str | None = None,
) -> AsyncIterator[str]:
    settings = get_settings()
    agent_name, skill_names, cleaned_content = _parse_prompt_directives(user_content)
    if not cleaned_content:
        yield _sse("error", {"detail": "Message content is required after /agent or /skill."})
        return

    async with session_scope() as db:
        conversation = await conversation_service.get_conversation(db, conversation_id)
        if conversation is None:
            yield _sse("error", {"detail": "Conversation not found"})
            return

        model = model_override or conversation.model_id

        existing_messages = await conversation_service.list_messages(db, conversation.id)
        if not existing_messages:
            await conversation_service.update_conversation(
                db, conversation, title=conversation_service.derive_title(cleaned_content)
            )

        user_message = await conversation_service.add_message(
            db, conversation.id, MessageRole.user, cleaned_content, model_id=model
        )
        yield _sse("user_message", {"id": user_message.id, "content": user_message.content})

        history = await conversation_service.list_messages(db, conversation.id)
        base_messages = conversation_service.to_ollama_messages(history, settings.max_context_messages)
        try:
            prompt_messages = await _load_prompt_messages(
                db, agent_name=agent_name, skill_names=skill_names
            )
        except ValueError as exc:
            yield _sse("error", {"detail": str(exc)})
            return
        base_messages = [*prompt_messages, *base_messages]

        servers = await mcp_service.list_servers(db)
        discovered_tools = await _discover_tools(servers)

        try:
            if not discovered_tools:
                assembled = ""
                async for chunk in ollama.stream_chat(model, base_messages):
                    delta = chunk.get("message", {}).get("content", "")
                    if delta:
                        assembled += delta
                        yield _sse("token", {"delta": delta})

                    if chunk.get("done"):
                        yield _sse(
                            "done",
                            {
                                "eval_count": chunk.get("eval_count"),
                                "eval_duration_ns": chunk.get("eval_duration"),
                                "total_duration_ns": chunk.get("total_duration"),
                            },
                        )
                assistant_message = await conversation_service.add_message(
                    db, conversation.id, MessageRole.assistant, assembled, model_id=model
                )
                yield _sse(
                    "assistant_message",
                    {"id": assistant_message.id, "content": assistant_message.content},
                )
                return

            tool_catalog = _format_tool_catalog(discovered_tools)
            tool_prompt = (
                "You can use MCP tools when they help answer the user.\n"
                "Available tools:\n"
                f"{tool_catalog}\n\n"
                "If a tool is needed, reply with JSON only in this exact shape:\n"
                '{"tool_calls":[{"server_id":"...","tool":"...","arguments":{}}]}\n'
                "If no tool is needed, answer normally."
            )
            selector_messages = [{"role": "system", "content": tool_prompt}, *base_messages]

            final_messages = selector_messages
            for _ in range(MAX_TOOL_ROUNDS):
                proposal = await ollama.chat_once(model, final_messages)
                tool_calls = _tool_request_from_text(proposal)
                if not tool_calls:
                    final_messages = base_messages
                    break

                results: list[dict] = []
                for call in tool_calls:
                    server = next((item for item in servers if item.id == call["server_id"]), None)
                    if server is None:
                        continue
                    try:
                        result = await mcp_service.call_server_tool(server, call["tool"], call["arguments"])
                    except Exception as exc:
                        result = f"Tool call failed: {exc}"
                    results.append(
                        {
                            "server_name": server.name,
                            "tool_name": call["tool"],
                            "result": result,
                        }
                    )

                if not results:
                    final_messages = base_messages
                    break

                final_messages = [
                    *selector_messages,
                    {"role": "assistant", "content": proposal},
                    *_assistant_result_messages(results),
                    {
                        "role": "system",
                        "content": "Use the MCP results above to answer the user's question. Do not call more tools.",
                    },
                ]

            assembled = ""
            async for chunk in ollama.stream_chat(model, final_messages):
                delta = chunk.get("message", {}).get("content", "")
                if delta:
                    assembled += delta
                    yield _sse("token", {"delta": delta})

                if chunk.get("done"):
                    yield _sse(
                        "done",
                        {
                            "eval_count": chunk.get("eval_count"),
                            "eval_duration_ns": chunk.get("eval_duration"),
                            "total_duration_ns": chunk.get("total_duration"),
                        },
                    )

            assistant_message = await conversation_service.add_message(
                db, conversation.id, MessageRole.assistant, assembled, model_id=model
            )
            yield _sse(
                "assistant_message",
                {"id": assistant_message.id, "content": assistant_message.content},
            )
        except OllamaError as exc:
            yield _sse("error", {"detail": str(exc)})
