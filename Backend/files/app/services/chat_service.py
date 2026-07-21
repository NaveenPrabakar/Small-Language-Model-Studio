from __future__ import annotations

import json
import re
from typing import AsyncIterator
import logging

from ..config import get_settings
from ..database import session_scope
from ..models import MessageRole
from ..ollama_client import OllamaClient, OllamaError
from . import agent_workflow_service, conversation_service, embedding_service, mcp_service, preset_service

logger = logging.getLogger(__name__)

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
    start = candidate.find("{")
    end = candidate.rfind("}")

    if start == -1 or end == -1 or end < start:
        return None
    
    candidate = candidate[start : end + 1]
    
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


def _parse_prompt_directives(
    user_content: str,
) -> tuple[str | None, list[str], str | None, str | None, str]:
    """Returns (agent_name, skill_names, embed_collection_name, workflow_name, body)."""
    agent_name: str | None = None
    skill_names: list[str] = []
    embed_collection_name: str | None = None
    workflow_name: str | None = None
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
        elif command == "/useembed" and argument:
            embed_collection_name = argument
        elif command == "/workflow" and argument:
            workflow_name = argument
        else:
            body_index = index
            break
        body_index = index + 1

    body = "\n".join(lines[body_index:]).strip()
    return agent_name, skill_names, embed_collection_name, workflow_name, body


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


async def _load_workflow_result(
    db, *, workflow_name: str | None
) -> agent_workflow_service.WorkflowExecutionResult | None:
    if not workflow_name:
        return None
    workflow = await agent_workflow_service.get_workflow_by_name(db, workflow_name)
    if workflow is None:
        raise ValueError(f"Agent workflow not found: {workflow_name}")
    return await agent_workflow_service.execute_workflow(
        db,
        workflow,
        get_skill=preset_service.get_skill_by_name,
        get_embedding_collection=embedding_service.get_collection_by_name,
    )


async def _build_embedding_context_messages(
    db, ollama: OllamaClient, *, collection_names: list[str], query: str
) -> list[dict]:
    messages: list[dict] = []
    for collection_name in collection_names:
        collection = await embedding_service.get_collection_by_name(db, collection_name)
        if collection is None:
            raise ValueError(f"Embedding collection not found: {collection_name}")
        retrieved = await embedding_service.query_collection(db, ollama, collection=collection, query=query)
        if not retrieved:
            continue
        context_block = "\n\n".join(
            f"[chunk {item.chunk_index}, score {item.score:.3f}]\n{item.content}" for item in retrieved
        )
        messages.append(
            {
                "role": "system",
                "content": (
                    f"Relevant context retrieved from embedding collection '{collection.name}':\n\n"
                    f"{context_block}\n\n"
                    "Use this context to answer the user's question. If the context doesn't "
                    "contain the answer, say so rather than guessing."
                ),
            }
        )
    return messages


async def _discover_tools(servers: list[mcp_service.McpServer]) -> list[mcp_service.DiscoveredTool]:
    discovered: list[mcp_service.DiscoveredTool] = []
    for server in servers:
        try:
            server_tools = await mcp_service.list_server_tools(server)
            discovered.extend(server_tools)
            logger.info(
                "Discovered %d MCP tool(s) from '%s': %s",
                len(server_tools),
                server.name,
                [t.name for t in server_tools],
            )
            
        except Exception as exc:
            detail = str(exc)
            sub_exceptions = getattr(exc, "exceptions", None)
            if sub_exceptions:
                detail = "; ".join(f"{type(e).__name__}: {e}" for e in sub_exceptions)
            logger.warning(
                "MCP tool discovery failed for server '%s' (%s): %s",
                server.name,
                server.url,
                detail,
            )
            continue
    return discovered


async def stream_chat_turn(
    conversation_id: str,
    user_content: str,
    ollama: OllamaClient,
    model_override: str | None = None,
) -> AsyncIterator[str]:
    settings = get_settings()
    agent_name, skill_names, embed_collection_name, workflow_name, cleaned_content = _parse_prompt_directives(
        user_content
    )
    if not cleaned_content:
        yield _sse(
            "error",
            {"detail": "Message content is required after /agent, /skill, /useembed, or /workflow."},
        )
        return

    async with session_scope() as db:
        conversation = await conversation_service.get_conversation(db, conversation_id)
        if conversation is None:
            yield _sse("error", {"detail": "Conversation not found"})
            return

        try:
            workflow_result = await _load_workflow_result(db, workflow_name=workflow_name)
        except ValueError as exc:
            yield _sse("error", {"detail": str(exc)})
            return

        # Request-level model override wins, then a workflow's Model node, then the
        # conversation's own model.
        model = model_override or (workflow_result.model_override if workflow_result else None) or conversation.model_id

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
            prompt_messages = await _load_prompt_messages(db, agent_name=agent_name, skill_names=skill_names)
        except ValueError as exc:
            yield _sse("error", {"detail": str(exc)})
            return

        workflow_system_messages = workflow_result.system_messages if workflow_result else []
        base_messages = [*prompt_messages, *workflow_system_messages, *base_messages]

        embedding_collection_names = list(embed_collection_name and [embed_collection_name] or [])
        if workflow_result:
            embedding_collection_names += workflow_result.embedding_collection_names

        if embedding_collection_names:
            try:
                embedding_messages = await _build_embedding_context_messages(
                    db, ollama, collection_names=embedding_collection_names, query=cleaned_content
                )
            except ValueError as exc:
                yield _sse("error", {"detail": str(exc)})
                return
            except OllamaError as exc:
                yield _sse("error", {"detail": str(exc)})
                return
            base_messages = [*embedding_messages, *base_messages]

        servers = await mcp_service.list_servers(db)
        discovered_tools = await _discover_tools(servers)
        if workflow_result:
            discovered_tools = agent_workflow_service.filter_tools_by_workflow(
                discovered_tools, workflow_result.allowed_tool_keys
            )

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
                "You have access to MCP tools that can perform real actions. When the user's "
                "request can be fulfilled by one of these tools, you MUST call it — do not "
                "describe what the tool would do, do not ask the user for confirmation, and "
                "do not simulate the result yourself.\n\n"
                "Available tools:\n"
                f"{tool_catalog}\n\n"
                "If a tool call is appropriate, reply with JSON only, in this exact shape, "
                "with no other text before or after it:\n"
                '{"tool_calls":[{"server_id":"...","tool":"...","arguments":{}}]}\n\n'
                "Only skip the tool call if none of the available tools are relevant to the "
                "user's request at all."
            )
            selector_messages = [{"role": "system", "content": tool_prompt}, *base_messages]

            executed_calls: set[tuple[str, str, str]] = set()
            final_messages = selector_messages

            for _ in range(MAX_TOOL_ROUNDS):
                proposal = await ollama.chat_once(model, final_messages)
                tool_calls = _tool_request_from_text(proposal)
                if not tool_calls:
                    final_messages = base_messages
                    break

                new_calls = [
                    call
                    for call in tool_calls
                    if (call["server_id"], call["tool"], json.dumps(call["arguments"], sort_keys=True))
                    not in executed_calls
                ]

                if not new_calls:
                    # Model just repeated a call it already made — force it to answer now.
                    final_messages = [
                        *final_messages,
                        {"role": "assistant", "content": proposal},
                        {
                            "role": "system",
                            "content": (
                                "You already called that tool and have its result above. "
                                "Respond to the user now in plain, natural language only. "
                                "Do NOT call any tools and do NOT output JSON."
                            ),
                        },
                    ]
                    break

                results: list[dict] = []
                for call in new_calls:
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
                    executed_calls.add(
                        (call["server_id"], call["tool"], json.dumps(call["arguments"], sort_keys=True))
                    )

                if not results:
                    final_messages = base_messages
                    break

                final_messages = [
                    *final_messages,
                    {"role": "assistant", "content": proposal},
                    *_assistant_result_messages(results),
                    {
                        "role": "system",
                        "content": (
                            "Tool results are above. If a DIFFERENT tool is genuinely still "
                            "needed, call it now in the same JSON format. Otherwise respond to "
                            "the user now in plain, natural language only — do not repeat a "
                            "tool call you already made."
                        ),
                    },
                ]
            else:
                # Ran out of rounds without the model settling on a final answer.
                final_messages = [
                    *final_messages,
                    {
                        "role": "system",
                        "content": "Respond to the user now in plain, natural language only. Do NOT call any more tools.",
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