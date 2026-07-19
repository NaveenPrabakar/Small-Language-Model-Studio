import { type DragEvent, useRef, useState } from "react";
import { Bot, Cpu, FileSearch, Network, Play, Plus, Save, Square, Trash2 } from "lucide-react";
import type {
  ApiAgentWorkflow,
  ApiEmbeddingCollection,
  ApiMcpServer,
  ApiModel,
  ApiSkill,
  ApiWorkflowEdge,
  ApiWorkflowNode,
} from "../lib/api";

type NodeType = ApiWorkflowNode["type"];

const NODE_META: Record<NodeType, { label: string; icon: typeof Bot; accent: string }> = {
  trigger: { label: "Trigger", icon: Play, accent: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  skill: { label: "Skill", icon: Cpu, accent: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  embedding: { label: "Embedding", icon: FileSearch, accent: "border-sky-400/40 bg-sky-400/10 text-sky-300" },
  mcp_tool: { label: "MCP Tool", icon: Network, accent: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  model: { label: "Model", icon: Bot, accent: "border-pink-400/40 bg-pink-400/10 text-pink-300" },
  output: { label: "Output", icon: Square, accent: "border-slate-400/40 bg-slate-400/10 text-slate-300" },
};

const PALETTE: NodeType[] = ["trigger", "skill", "embedding", "mcp_tool", "model", "output"];
const NODE_WIDTH = 168;
const NODE_HEIGHT = 56;

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function WorkflowBuilder({
  workflows,
  skills,
  embeddingCollections,
  mcpServers,
  models,
  onSave,
  onDelete,
}: {
  workflows: ApiAgentWorkflow[];
  skills: ApiSkill[];
  embeddingCollections: ApiEmbeddingCollection[];
  mcpServers: ApiMcpServer[];
  models: ApiModel[];
  onSave: (payload: {
    id: string | null;
    name: string;
    description: string | null;
    nodes: ApiWorkflowNode[];
    edges: ApiWorkflowEdge[];
  }) => Promise<void>;
  onDelete: (workflowId: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nodes, setNodes] = useState<ApiWorkflowNode[]>([]);
  const [edges, setEdges] = useState<ApiWorkflowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const loadWorkflow = (workflow: ApiAgentWorkflow | null) => {
    setActiveId(workflow?.id ?? null);
    setName(workflow?.name ?? "");
    setDescription(workflow?.description ?? "");
    setNodes(workflow?.nodes ?? []);
    setEdges(workflow?.edges ?? []);
    setSelectedNodeId(null);
    setConnectingFrom(null);
    setStatus(null);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const addNode = (type: NodeType, x: number, y: number) => {
    if (type === "trigger" && nodes.some((n) => n.type === "trigger")) {
      setStatus("A workflow can only have one trigger node.");
      return;
    }
    const node: ApiWorkflowNode = { id: uid(), type, x, y, config: {} };
    setNodes((prev) => [...prev, node]);
    setSelectedNodeId(node.id);
  };

  const updateNodeConfig = (nodeId: string, config: Record<string, string>) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n)));
  };

  const moveNode = (nodeId: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n)));
  };

  const removeNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const removeEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  };

  const handlePortClick = (nodeId: string, port: "in" | "out") => {
    if (port === "out") {
      setConnectingFrom(nodeId);
      return;
    }
    if (connectingFrom && connectingFrom !== nodeId) {
      const exists = edges.some((e) => e.source === connectingFrom && e.target === nodeId);
      if (!exists) {
        setEdges((prev) => [...prev, { id: uid(), source: connectingFrom, target: nodeId }]);
      }
    }
    setConnectingFrom(null);
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("text/node-type") as NodeType;
    const movingId = event.dataTransfer.getData("text/move-node");
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (movingId) {
      moveNode(movingId, Math.max(0, x - NODE_WIDTH / 2), Math.max(0, y - NODE_HEIGHT / 2));
      return;
    }
    if (type) {
      addNode(type, Math.max(0, x - NODE_WIDTH / 2), Math.max(0, y - NODE_HEIGHT / 2));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setStatus("Workflow name is required.");
      return;
    }
    if (!nodes.some((n) => n.type === "trigger")) {
      setStatus("Add a Trigger node so the workflow has a starting point.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await onSave({ id: activeId, name: name.trim(), description: description.trim() || null, nodes, edges });
      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const centerOf = (node: ApiWorkflowNode) => ({ x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 });
  const leftOf = (node: ApiWorkflowNode) => ({ x: node.x, y: node.y + NODE_HEIGHT / 2 });

  return (
    <div className="flex gap-4 h-[560px]">
      <div className="w-44 shrink-0 flex flex-col gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Workflows</p>
          <div className="space-y-1">
            <button
              onClick={() => loadWorkflow(null)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1.5 ${
                activeId === null ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Plus className="w-3 h-3" /> New workflow
            </button>
            {workflows.map((workflow) => (
              <div key={workflow.id} className="group flex items-center gap-1">
                <button
                  onClick={() => loadWorkflow(workflow)}
                  className={`flex-1 min-w-0 text-left px-2.5 py-1.5 rounded-md text-xs truncate ${
                    activeId === workflow.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {workflow.name}
                </button>
                <button
                  onClick={() => {
                    onDelete(workflow.id);
                    if (activeId === workflow.id) loadWorkflow(null);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Drag onto canvas
          </p>
          <div className="space-y-1.5">
            {PALETTE.map((type) => {
              const meta = NODE_META[type];
              const Icon = meta.icon;
              return (
                <div
                  key={type}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/node-type", type)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-grab active:cursor-grabbing ${meta.accent}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {meta.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        ref={canvasRef}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleCanvasDrop}
        onClick={() => setSelectedNodeId(null)}
        className="relative flex-1 rounded-xl border border-dashed border-border bg-background/40 overflow-auto"
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {edges.map((edge) => {
            const source = nodes.find((n) => n.id === edge.source);
            const target = nodes.find((n) => n.id === edge.target);
            if (!source || !target) return null;
            const from = centerOf(source);
            const to = leftOf(target);
            const midX = (from.x + to.x) / 2;
            return (
              <path
                key={edge.id}
                d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={1.5}
                opacity={0.6}
              />
            );
          })}
        </svg>

        {nodes.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Drag node types here to build the agent's flow.
          </p>
        )}

        {nodes.map((node) => {
          const meta = NODE_META[node.type];
          const Icon = meta.icon;
          const summary =
            node.config.skill_name ||
            node.config.collection_name ||
            node.config.tool_name ||
            node.config.model_id ||
            (node.type === "mcp_tool" && node.config.server_id ? "All tools" : "Not configured");
          return (
            <div
              key={node.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/move-node", node.id);
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedNodeId(node.id);
              }}
              style={{ left: node.x, top: node.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
              className={`absolute rounded-lg border px-3 py-2 shadow-sm cursor-grab active:cursor-grabbing bg-card ${meta.accent} ${
                selectedNodeId === node.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {meta.label}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{summary}</p>

              {node.type !== "output" && (
                <button
                  title="Connect to next node"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePortClick(node.id, "out");
                  }}
                  className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background ${
                    connectingFrom === node.id ? "bg-primary" : "bg-muted-foreground"
                  }`}
                />
              )}
              {node.type !== "trigger" && (
                <button
                  title="Connect from previous node"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePortClick(node.id, "in");
                  }}
                  className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background bg-muted-foreground"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div className="space-y-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Workflow name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does this agent do?"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40 resize-none"
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save workflow"}
          </button>
          {status && <p className="text-[11px] text-muted-foreground leading-relaxed">{status}</p>}
        </div>

        <div className="flex-1 rounded-lg border border-border bg-background/60 p-3 overflow-y-auto">
          {!selectedNode ? (
            <p className="text-[11px] text-muted-foreground">
              Select a node to configure it, or click a node's ports to connect it to the next step.
            </p>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">{NODE_META[selectedNode.type].label}</p>
                <button
                  onClick={() => removeNode(selectedNode.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {selectedNode.type === "skill" && (
                <select
                  value={selectedNode.config.skill_name ?? ""}
                  onChange={(event) => updateNodeConfig(selectedNode.id, { skill_name: event.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
                >
                  <option value="">Select a skill...</option>
                  {skills.map((skill) => (
                    <option key={skill.id} value={skill.name}>
                      {skill.name}
                    </option>
                  ))}
                </select>
              )}

              {selectedNode.type === "embedding" && (
                <select
                  value={selectedNode.config.collection_name ?? ""}
                  onChange={(event) => updateNodeConfig(selectedNode.id, { collection_name: event.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
                >
                  <option value="">Select a collection...</option>
                  {embeddingCollections.map((collection) => (
                    <option key={collection.id} value={collection.name}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              )}

              {selectedNode.type === "mcp_tool" && (
                <div className="space-y-2">
                  <select
                    value={selectedNode.config.server_id ?? ""}
                    onChange={(event) => updateNodeConfig(selectedNode.id, { server_id: event.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
                  >
                    <option value="">Select an MCP server...</option>
                    {mcpServers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={selectedNode.config.tool_name ?? ""}
                    onChange={(event) => updateNodeConfig(selectedNode.id, { tool_name: event.target.value })}
                    placeholder="Tool name (blank = all tools on server)"
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
                  />
                </div>
              )}

              {selectedNode.type === "model" && (
                <select
                  value={selectedNode.config.model_id ?? ""}
                  onChange={(event) => updateNodeConfig(selectedNode.id, { model_id: event.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
                >
                  <option value="">Select a model override...</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              )}

              {(selectedNode.type === "trigger" || selectedNode.type === "output") && (
                <p className="text-[11px] text-muted-foreground">No configuration needed.</p>
              )}
            </div>
          )}
        </div>

        {edges.length > 0 && (
          <div className="rounded-lg border border-border bg-background/60 p-2 max-h-24 overflow-y-auto">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Connections
            </p>
            {edges.map((edge) => {
              const source = nodes.find((n) => n.id === edge.source);
              const target = nodes.find((n) => n.id === edge.target);
              return (
                <div key={edge.id} className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="truncate">
                    {source ? NODE_META[source.type].label : "?"} to {target ? NODE_META[target.type].label : "?"}
                  </span>
                  <button onClick={() => removeEdge(edge.id)} className="hover:text-foreground transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}