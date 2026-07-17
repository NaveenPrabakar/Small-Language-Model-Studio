"""
CRUD + execution engine for drag-and-drop "agent workflows".

A workflow is a small DAG (Trigger -> Skill/Embedding/MCP Tool/Model -> Output).
`execute_workflow` walks it in topological order and folds each node into its
effect on a chat turn, decoupled from preset/embedding internals via injected
lookup callables so this module doesn't need to import chat_service.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AgentWorkflow
from ..schemas import AgentWorkflowSummary, WorkflowEdge, WorkflowNode
from . import mcp_service


class WorkflowValidationError(ValueError):
    """Raised when a workflow's node/edge graph (or a node's reference) is invalid."""


def _serialize_nodes(nodes: list[WorkflowNode]) -> str:
    return json.dumps([node.model_dump() for node in nodes])


def _serialize_edges(edges: list[WorkflowEdge]) -> str:
    return json.dumps([edge.model_dump() for edge in edges])


def _deserialize_nodes(raw: str) -> list[WorkflowNode]:
    return [WorkflowNode.model_validate(item) for item in json.loads(raw or "[]")]


def _deserialize_edges(raw: str) -> list[WorkflowEdge]:
    return [WorkflowEdge.model_validate(item) for item in json.loads(raw or "[]")]


def to_summary(workflow: AgentWorkflow) -> AgentWorkflowSummary:
    return AgentWorkflowSummary(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        nodes=_deserialize_nodes(workflow.nodes),
        edges=_deserialize_edges(workflow.edges),
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


def _validate_graph(nodes: list[WorkflowNode], edges: list[WorkflowEdge]) -> None:
    node_ids = {node.id for node in nodes}
    if len(node_ids) != len(nodes):
        raise WorkflowValidationError("Duplicate node ids in workflow.")

    if sum(1 for n in nodes if n.type == "trigger") > 1:
        raise WorkflowValidationError("A workflow can only have one trigger node.")

    for edge in edges:
        if edge.source not in node_ids or edge.target not in node_ids:
            raise WorkflowValidationError(f"Edge {edge.id} references a node that does not exist.")
        if edge.source == edge.target:
            raise WorkflowValidationError(f"Edge {edge.id} cannot connect a node to itself.")


async def list_workflows(db: AsyncSession) -> list[AgentWorkflow]:
    result = await db.execute(select(AgentWorkflow).order_by(AgentWorkflow.created_at.asc()))
    return list(result.scalars().all())


async def get_workflow(db: AsyncSession, workflow_id: str) -> AgentWorkflow | None:
    return await db.get(AgentWorkflow, workflow_id)


async def get_workflow_by_name(db: AsyncSession, name: str) -> AgentWorkflow | None:
    result = await db.execute(select(AgentWorkflow).where(AgentWorkflow.name == name))
    return result.scalar_one_or_none()


async def create_workflow(
    db: AsyncSession,
    *,
    name: str,
    description: str | None,
    nodes: list[WorkflowNode],
    edges: list[WorkflowEdge],
) -> AgentWorkflow:
    _validate_graph(nodes, edges)
    workflow = AgentWorkflow(
        name=name,
        description=description,
        nodes=_serialize_nodes(nodes),
        edges=_serialize_edges(edges),
    )
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return workflow


async def update_workflow(
    db: AsyncSession,
    workflow: AgentWorkflow,
    *,
    description: str | None = None,
    nodes: list[WorkflowNode] | None = None,
    edges: list[WorkflowEdge] | None = None,
) -> AgentWorkflow:
    next_nodes = nodes if nodes is not None else _deserialize_nodes(workflow.nodes)
    next_edges = edges if edges is not None else _deserialize_edges(workflow.edges)
    _validate_graph(next_nodes, next_edges)

    if description is not None:
        workflow.description = description
    if nodes is not None:
        workflow.nodes = _serialize_nodes(nodes)
    if edges is not None:
        workflow.edges = _serialize_edges(edges)

    await db.commit()
    await db.refresh(workflow)
    return workflow


async def delete_workflow(db: AsyncSession, workflow_id: str) -> None:
    await db.execute(delete(AgentWorkflow).where(AgentWorkflow.id == workflow_id))
    await db.commit()


def _topological_order(nodes: list[WorkflowNode], edges: list[WorkflowEdge]) -> list[WorkflowNode]:
    """Kahn's algorithm from the trigger node; unreachable nodes are appended in
    declaration order so a stray node left on the canvas still executes."""
    nodes_by_id = {node.id: node for node in nodes}
    incoming: dict[str, int] = {node.id: 0 for node in nodes}
    outgoing: dict[str, list[str]] = {node.id: [] for node in nodes}
    for edge in edges:
        if edge.source in nodes_by_id and edge.target in nodes_by_id:
            outgoing[edge.source].append(edge.target)
            incoming[edge.target] += 1

    trigger = next((n for n in nodes if n.type == "trigger"), None)
    queue: list[str] = [trigger.id] if trigger else [n.id for n in nodes if incoming[n.id] == 0]
    visited: set[str] = set()
    ordered: list[WorkflowNode] = []

    while queue:
        current_id = queue.pop(0)
        if current_id in visited:
            continue
        visited.add(current_id)
        ordered.append(nodes_by_id[current_id])
        for neighbor in outgoing[current_id]:
            incoming[neighbor] -= 1
            if incoming[neighbor] <= 0 and neighbor not in visited:
                queue.append(neighbor)

    for node in nodes:
        if node.id not in visited:
            ordered.append(node)
    return ordered


@dataclass
class WorkflowExecutionResult:
    system_messages: list[dict] = field(default_factory=list)
    embedding_collection_names: list[str] = field(default_factory=list)
    allowed_tool_keys: set[tuple[str, str]] | None = None
    model_override: str | None = None


async def execute_workflow(
    db: AsyncSession,
    workflow: AgentWorkflow,
    *,
    get_skill,
    get_embedding_collection,
) -> WorkflowExecutionResult:
    nodes = _deserialize_nodes(workflow.nodes)
    edges = _deserialize_edges(workflow.edges)
    result = WorkflowExecutionResult()

    if any(n.type == "mcp_tool" for n in nodes):
        result.allowed_tool_keys = set()

    for node in _topological_order(nodes, edges):
        config = node.config or {}

        if node.type == "skill":
            skill_name = config.get("skill_name")
            if not skill_name:
                continue
            skill = await get_skill(db, skill_name)
            if skill is None:
                raise WorkflowValidationError(f"Workflow references missing skill: {skill_name}")
            result.system_messages.append(
                {"role": "system", "content": f"Skill instructions ({skill.name}):\n{skill.instructions}"}
            )

        elif node.type == "embedding":
            collection_name = config.get("collection_name")
            if not collection_name:
                continue
            collection = await get_embedding_collection(db, collection_name)
            if collection is None:
                raise WorkflowValidationError(
                    f"Workflow references missing embedding collection: {collection_name}"
                )
            result.embedding_collection_names.append(collection_name)

        elif node.type == "mcp_tool":
            server_id = config.get("server_id")
            if not server_id:
                continue
            tool_name = config.get("tool_name") or "*"  # "*" = every tool on the server
            result.allowed_tool_keys.add((server_id, tool_name))

        elif node.type == "model":
            model_id = config.get("model_id")
            if model_id:
                result.model_override = model_id

        # trigger / output nodes carry no runtime effect.

    return result


def filter_tools_by_workflow(
    tools: list[mcp_service.DiscoveredTool], allowed: set[tuple[str, str]] | None
) -> list[mcp_service.DiscoveredTool]:
    if allowed is None:
        return tools
    if not allowed:
        return []
    return [
        tool
        for tool in tools
        if (tool.server_id, tool.name) in allowed or (tool.server_id, "*") in allowed
    ]