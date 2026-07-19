import { useState } from "react";
import { Blocks, Bot, Cpu, Layers, Network, X } from "lucide-react";
import { WorkflowBuilder } from "./workflow-builder";
import type {
  ApiAgent, ApiAgentWorkflow, ApiEmbeddingCollection, ApiEmbeddingModel,
  ApiMcpServer, ApiModel, ApiSkill, ApiWorkflowEdge, ApiWorkflowNode,
} from "../lib/api";

type SettingsTab = "models" | "mcp" | "agents" | "workflows" | "skills" | "embeddings";

interface TabDef {
  id: SettingsTab;
  label: string;
  icon: typeof Cpu;
  count: number;
}

export function SettingsModal({
  open,
  onClose,
  models,
  selectedModelId,
  onSelectModel,
  pullModelName,
  setPullModelName,
  pullingModel,
  pullStatus,
  onPullModel,
  mcpName,
  setMcpName,
  mcpUrl,
  setMcpUrl,
  savingMcp,
  mcpStatus,
  onAddMcpServer,
  mcpServers,
  onDeleteMcpServer,
  agents,
  agentName,
  setAgentName,
  agentPrompt,
  setAgentPrompt,
  savingAgent,
  agentStatus,
  onAddAgent,
  onDeleteAgent,
  skills,
  skillName,
  setSkillName,
  skillInstructions,
  setSkillInstructions,
  savingSkill,
  skillStatus,
  onAddSkill,
  onDeleteSkill,
  embeddingModels,
  embeddingCollections,
  pullEmbedModelName,
  setPullEmbedModelName,
  pullingEmbedModel,
  pullEmbedStatus,
  onPullEmbedModel,
  onDeleteEmbeddingCollection,
  agentWorkflows,
  onSaveAgentWorkflow,
  onDeleteAgentWorkflow,
}: {
  open: boolean;
  onClose: () => void;
  models: ApiModel[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  pullModelName: string;
  setPullModelName: (value: string) => void;
  pullingModel: boolean;
  pullStatus: string | null;
  onPullModel: () => void;
  mcpName: string;
  setMcpName: (value: string) => void;
  mcpUrl: string;
  setMcpUrl: (value: string) => void;
  savingMcp: boolean;
  mcpStatus: string | null;
  onAddMcpServer: () => void;
  mcpServers: ApiMcpServer[];
  onDeleteMcpServer: (serverId: string) => void;
  agents: ApiAgent[];
  agentName: string;
  setAgentName: (value: string) => void;
  agentPrompt: string;
  setAgentPrompt: (value: string) => void;
  savingAgent: boolean;
  agentStatus: string | null;
  onAddAgent: () => void;
  onDeleteAgent: (agentId: string) => void;
  skills: ApiSkill[];
  skillName: string;
  setSkillName: (value: string) => void;
  skillInstructions: string;
  setSkillInstructions: (value: string) => void;
  savingSkill: boolean;
  skillStatus: string | null;
  onAddSkill: () => void;
  onDeleteSkill: (skillId: string) => void;
  embeddingModels: ApiEmbeddingModel[];
  embeddingCollections: ApiEmbeddingCollection[];
  pullEmbedModelName: string;
  setPullEmbedModelName: (value: string) => void;
  pullingEmbedModel: boolean;
  pullEmbedStatus: string | null;
  onPullEmbedModel: () => void;
  onDeleteEmbeddingCollection: (collectionId: string) => void;
  agentWorkflows: ApiAgentWorkflow[];
  onSaveAgentWorkflow: (payload: {
    id: string | null;
    name: string;
    description: string | null;
    nodes: ApiWorkflowNode[];
    edges: ApiWorkflowEdge[];
  }) => Promise<void>;
  onDeleteAgentWorkflow: (workflowId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("models");

  if (!open) return null;

  const tabs: TabDef[] = [
    { id: "models", label: "Models", icon: Cpu, count: models.length },
    { id: "mcp", label: "MCP servers", icon: Network, count: mcpServers.length },
    { id: "agents", label: "Agents", icon: Bot, count: agents.length },
    { id: "workflows", label: "Workflows", icon: Network, count: agentWorkflows.length },
    { id: "skills", label: "Skills", icon: Blocks, count: skills.length },
    { id: "embeddings", label: "Embeddings", icon: Layers, count: embeddingCollections.length },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-4xl h-[min(85vh,44rem)] rounded-2xl border border-border bg-card shadow-2xl shadow-black/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left rail */}
        <div className="w-48 shrink-0 border-r border-border bg-background/40 flex flex-col">
          <div className="px-4 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 text-left">{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                {activeTab === "models" && "Pull new local models and choose which one is active."}
                {activeTab === "mcp" && "Register remote MCP servers so tools can be discovered and called."}
                {activeTab === "agents" && "Reusable system prompts, invoked with /agent name."}
                {activeTab === "workflows" &&
                  "Drag skills, embeddings, and MCP tools onto a canvas to build a multi-step agent, invoked with /workflow name."}
                {activeTab === "skills" && "Reusable instructions, invoked with /skill name."}
                {activeTab === "embeddings" && "Pull local embedding models and manage document embeddings."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === "models" && (
              <div className="space-y-5 max-w-xl">
                <div className="space-y-2">
                  <input
                    value={pullModelName}
                    onChange={(e) => setPullModelName(e.target.value)}
                    placeholder="llama3.2:3b"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  />
                  <button
                    onClick={onPullModel}
                    disabled={pullingModel || !pullModelName.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {pullingModel ? "Pulling..." : "Pull model"}
                  </button>
                  {pullStatus && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{pullStatus}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Available models
                  </p>
                  <div className="space-y-2">
                    {models.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No models found.</p>
                    ) : (
                      models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => onSelectModel(model.id)}
                          className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                            model.id === selectedModelId
                              ? "bg-primary/10 border-primary/20"
                              : "border-border bg-background hover:bg-secondary"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{model.name}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{model.id}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                              {model.badge}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "mcp" && (
              <div className="space-y-5 max-w-xl">
                <div className="grid gap-2">
                  <input
                    value={mcpName}
                    onChange={(e) => setMcpName(e.target.value)}
                    placeholder="Filesystem"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  />
                  <input
                    value={mcpUrl}
                    onChange={(e) => setMcpUrl(e.target.value)}
                    placeholder="https://example.com/mcp"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  />
                  <button
                    onClick={onAddMcpServer}
                    disabled={savingMcp || !mcpName.trim() || !mcpUrl.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed justify-self-start"
                  >
                    {savingMcp ? "Saving..." : "Add MCP server"}
                  </button>
                  {mcpStatus && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{mcpStatus}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Registered servers
                  </p>
                  <div className="space-y-2">
                    {mcpServers.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No MCP servers registered yet.</p>
                    ) : (
                      mcpServers.map((server) => (
                        <div
                          key={server.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">{server.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 break-all">{server.url}</p>
                          </div>
                          <button
                            onClick={() => onDeleteMcpServer(server.id)}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "agents" && (
              <div className="space-y-5 max-w-xl">
                <div className="grid gap-2">
                  <input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="researcher"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  />
                  <textarea
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    placeholder="You are a careful research assistant..."
                    rows={4}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 resize-none"
                  />
                  <button
                    onClick={onAddAgent}
                    disabled={savingAgent || !agentName.trim() || !agentPrompt.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed justify-self-start"
                  >
                    {savingAgent ? "Saving..." : "Add agent"}
                  </button>
                  {agentStatus && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{agentStatus}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Saved agents
                  </p>
                  <div className="space-y-2">
                    {agents.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No agents saved yet.</p>
                    ) : (
                      agents.map((agent) => (
                        <div
                          key={agent.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">{agent.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 break-words">
                              {agent.system_prompt}
                            </p>
                          </div>
                          <button
                            onClick={() => onDeleteAgent(agent.id)}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "workflows" && (
              <WorkflowBuilder
                workflows={agentWorkflows}
                skills={skills}
                embeddingCollections={embeddingCollections}
                mcpServers={mcpServers}
                models={models}
                onSave={onSaveAgentWorkflow}
                onDelete={onDeleteAgentWorkflow}
              />
            )}

            {activeTab === "skills" && (
              <div className="space-y-5 max-w-xl">
                <div className="grid gap-2">
                  <input
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="concise"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  />
                  <textarea
                    value={skillInstructions}
                    onChange={(e) => setSkillInstructions(e.target.value)}
                    placeholder="Answer in short bullets and keep examples minimal."
                    rows={4}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 resize-none"
                  />
                  <button
                    onClick={onAddSkill}
                    disabled={savingSkill || !skillName.trim() || !skillInstructions.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed justify-self-start"
                  >
                    {savingSkill ? "Saving..." : "Add skill"}
                  </button>
                  {skillStatus && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{skillStatus}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Saved skills
                  </p>
                  <div className="space-y-2">
                    {skills.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No skills saved yet.</p>
                    ) : (
                      skills.map((skill) => (
                        <div
                          key={skill.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">{skill.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 break-words">
                              {skill.instructions}
                            </p>
                          </div>
                          <button
                            onClick={() => onDeleteSkill(skill.id)}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === "embeddings" && (
              <div className="space-y-5 max-w-xl">
                <div className="space-y-2">
                  <input
                    value={pullEmbedModelName}
                    onChange={(e) => setPullEmbedModelName(e.target.value)}
                    placeholder="nomic-embed-text"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  />
                  <button
                    onClick={onPullEmbedModel}
                    disabled={pullingEmbedModel || !pullEmbedModelName.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {pullingEmbedModel ? "Pulling..." : "Pull embedding model"}
                  </button>
                  {pullEmbedStatus && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{pullEmbedStatus}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Local embedding models
                  </p>
                  <div className="space-y-2">
                    {embeddingModels.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        No embedding models detected yet. Pull one above (e.g. nomic-embed-text,
                        mxbai-embed-large, all-minilm).
                      </p>
                    ) : (
                      embeddingModels.map((model) => (
                        <div
                          key={model.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                        >
                          <p className="text-xs font-medium text-foreground truncate">{model.name}</p>
                          {model.parameter_size && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                              {model.parameter_size}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Embedding collections
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Create one from the chat composer: attach a file, then send{" "}
                    <code className="text-violet-300">/embed &lt;model&gt;</code>. Query it with{" "}
                    <code className="text-violet-300">/useembed &lt;name&gt; &lt;question&gt;</code>.
                  </p>
                  <div className="space-y-2">
                    {embeddingCollections.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No embeddings created yet.</p>
                    ) : (
                      embeddingCollections.map((collection) => (
                        <div
                          key={collection.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{collection.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {collection.source_filename} - {collection.chunk_count} chunks - {collection.model_id}
                            </p>
                          </div>
                          <button
                            onClick={() => onDeleteEmbeddingCollection(collection.id)}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}