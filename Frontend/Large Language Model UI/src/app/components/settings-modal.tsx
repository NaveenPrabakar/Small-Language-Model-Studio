import { X } from "lucide-react";

import type { ApiAgent, ApiMcpServer, ApiModel, ApiSkill } from "../lib/api";

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
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl shadow-black/60 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Settings</h2>
            <p className="text-[11px] text-muted-foreground mt-1">Manage models and MCP servers.</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Pull model
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter any Ollama model name, then pull it into the local library.
              </p>
            </div>
            <div className="space-y-2">
              <input
                value={pullModelName}
                onChange={(e) => setPullModelName(e.target.value)}
                placeholder="llama3.2:3b"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
              />
              <button
                onClick={onPullModel}
                disabled={pullingModel || !pullModelName.trim()}
                className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pullingModel ? "Pulling..." : "Pull model"}
              </button>
              {pullStatus && <p className="text-[11px] text-muted-foreground leading-relaxed">{pullStatus}</p>}
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Available models
              </p>
              <div className="space-y-2">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => onSelectModel(model.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      model.id === selectedModelId ? "bg-primary/10 border-primary/20" : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-foreground">{model.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{model.id}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                        {model.badge}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  MCP servers
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Register remote MCP servers by URL so tools can be discovered and called.
                </p>
              </div>

              <div className="grid gap-2">
                <input
                  value={mcpName}
                  onChange={(e) => setMcpName(e.target.value)}
                  placeholder="Filesystem"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                />
                <input
                  value={mcpUrl}
                  onChange={(e) => setMcpUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                />
                <button
                  onClick={onAddMcpServer}
                  disabled={savingMcp || !mcpName.trim() || !mcpUrl.trim()}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingMcp ? "Saving..." : "Add MCP server"}
                </button>
                {mcpStatus && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{mcpStatus}</p>
                )}
              </div>

              <div className="space-y-2 pt-2">
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
                        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{server.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 break-all">
                            {server.url}
                          </p>
                        </div>
                        <button
                          onClick={() => onDeleteMcpServer(server.id)}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-border bg-background/40 p-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Agents
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Create reusable system prompts and invoke them with /agent name.
                </p>
              </div>

              <div className="grid gap-2">
                <input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="researcher"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                />
                <textarea
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  placeholder="You are a careful research assistant..."
                  rows={4}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 resize-none"
                />
                <button
                  onClick={onAddAgent}
                  disabled={savingAgent || !agentName.trim() || !agentPrompt.trim()}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
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
                        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{agent.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 break-words">
                            {agent.system_prompt}
                          </p>
                        </div>
                        <button
                          onClick={() => onDeleteAgent(agent.id)}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-border bg-background/40 p-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Skills
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Save reusable instructions and invoke them with /skill name.
                </p>
              </div>

              <div className="grid gap-2">
                <input
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="concise"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                />
                <textarea
                  value={skillInstructions}
                  onChange={(e) => setSkillInstructions(e.target.value)}
                  placeholder="Answer in short bullets and keep examples minimal."
                  rows={4}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 resize-none"
                />
                <button
                  onClick={onAddSkill}
                  disabled={savingSkill || !skillName.trim() || !skillInstructions.trim()}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
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
                        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{skill.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 break-words">
                            {skill.instructions}
                          </p>
                        </div>
                        <button
                          onClick={() => onDeleteSkill(skill.id)}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
