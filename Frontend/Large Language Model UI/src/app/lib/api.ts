const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export interface ApiModel {
  id: string;
  name: string;
  provider: string;
  badge: "Fast" | "Balanced" | "Powerful";
  parameter_size: string | null;
  quantization: string | null;
  size_bytes: number | null;
}

export interface ApiConversation {
  id: string;
  title: string;
  model_id: string;
  created_at: string;
  updated_at: string;
}

export interface ApiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model_id: string | null;
  created_at: string;
}

export interface ApiMcpServer {
  id: string;
  name: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface ApiAgent {
  id: string;
  name: string;
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface ApiSkill {
  id: string;
  name: string;
  instructions: string;
  created_at: string;
  updated_at: string;
}

export interface ApiEmbeddingModel {
  id: string;
  name: string;
  parameter_size: string | null;
  size_bytes: number | null;
}

export interface ApiEmbeddingCollection {
  id: string;
  name: string;
  model_id: string;
  source_filename: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApiWorkflowNode {
  id: string;
  type: "trigger" | "skill" | "embedding" | "mcp_tool" | "model" | "output";
  x: number;
  y: number;
  config: Record<string, string>;
}

export interface ApiWorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface ApiAgentWorkflow {
  id: string;
  name: string;
  description: string | null;
  nodes: ApiWorkflowNode[];
  edges: ApiWorkflowEdge[];
  created_at: string;
  updated_at: string;
}

export async function listAgentWorkflows(): Promise<ApiAgentWorkflow[]> {
  const res = await fetch(`${API_BASE}/api/agent-workflows`);
  const data = await jsonOrThrow<{ workflows: ApiAgentWorkflow[] }>(res);
  return data.workflows;
}

export async function createAgentWorkflow(payload: {
  name: string;
  description?: string | null;
  nodes: ApiWorkflowNode[];
  edges: ApiWorkflowEdge[];
}): Promise<ApiAgentWorkflow> {
  const res = await fetch(`${API_BASE}/api/agent-workflows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function updateAgentWorkflow(
  workflowId: string,
  payload: { description?: string | null; nodes?: ApiWorkflowNode[]; edges?: ApiWorkflowEdge[] },
): Promise<ApiAgentWorkflow> {
  const res = await fetch(`${API_BASE}/api/agent-workflows/${workflowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function deleteAgentWorkflow(workflowId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/agent-workflows/${workflowId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete workflow (${res.status})`);
  }
}

export async function listEmbeddingModels(): Promise<ApiEmbeddingModel[]> {
  const res = await fetch(`${API_BASE}/api/embeddings/models`);
  const data = await jsonOrThrow<{ models: ApiEmbeddingModel[] }>(res);
  return data.models;
}

export async function pullEmbeddingModel(name: string): Promise<{ status: string; model: string }> {
  const res = await fetch(`${API_BASE}/api/embeddings/models/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow(res);
}

export async function listEmbeddingCollections(): Promise<ApiEmbeddingCollection[]> {
  const res = await fetch(`${API_BASE}/api/embeddings/collections`);
  const data = await jsonOrThrow<{ collections: ApiEmbeddingCollection[] }>(res);
  return data.collections;
}

export async function createEmbeddingCollection(payload: {
  name: string;
  modelId: string;
  file: File;
}): Promise<ApiEmbeddingCollection> {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("model_id", payload.modelId);
  formData.append("file", payload.file);

  const res = await fetch(`${API_BASE}/api/embeddings/collections`, {
    method: "POST",
    body: formData,
  });
  return jsonOrThrow(res);
}

export async function deleteEmbeddingCollection(collectionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/embeddings/collections/${collectionId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete embedding collection (${res.status})`);
  }
}

async function jsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(body.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function listModels(): Promise<ApiModel[]> {
  const res = await fetch(`${API_BASE}/api/models`);
  const data = await jsonOrThrow<{ models: ApiModel[] }>(res);
  return data.models;
}

export async function pullModel(name: string): Promise<{ status: string; model: string }> {
  const res = await fetch(`${API_BASE}/api/models/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow(res);
}

export async function listConversations(): Promise<ApiConversation[]> {
  const res = await fetch(`${API_BASE}/api/conversations`);
  return jsonOrThrow(res);
}

export async function createConversation(modelId: string): Promise<ApiConversation> {
  const res = await fetch(`${API_BASE}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_id: modelId }),
  });
  return jsonOrThrow(res);
}

export async function updateConversation(
  conversationId: string,
  payload: { title?: string | null; model_id?: string | null },
): Promise<ApiConversation> {
  const res = await fetch(`${API_BASE}/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/conversations/${conversationId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete conversation (${res.status})`);
  }
}

export async function getMessages(conversationId: string): Promise<ApiMessage[]> {
  const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`);
  return jsonOrThrow(res);
}

export async function listMcpServers(): Promise<ApiMcpServer[]> {
  const res = await fetch(`${API_BASE}/api/mcp-servers`);
  const data = await jsonOrThrow<{ servers: ApiMcpServer[] }>(res);
  return data.servers;
}

export async function createMcpServer(payload: {
  name: string;
  url: string;
}): Promise<ApiMcpServer> {
  const res = await fetch(`${API_BASE}/api/mcp-servers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function deleteMcpServer(serverId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/mcp-servers/${serverId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete MCP server (${res.status})`);
  }
}

export async function listAgents(): Promise<ApiAgent[]> {
  const res = await fetch(`${API_BASE}/api/agents`);
  const data = await jsonOrThrow<{ agents: ApiAgent[] }>(res);
  return data.agents;
}

export async function createAgent(payload: {
  name: string;
  system_prompt: string;
}): Promise<ApiAgent> {
  const res = await fetch(`${API_BASE}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function deleteAgent(agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete agent (${res.status})`);
  }
}

export async function listSkills(): Promise<ApiSkill[]> {
  const res = await fetch(`${API_BASE}/api/skills`);
  const data = await jsonOrThrow<{ skills: ApiSkill[] }>(res);
  return data.skills;
}

export async function createSkill(payload: {
  name: string;
  instructions: string;
}): Promise<ApiSkill> {
  const res = await fetch(`${API_BASE}/api/skills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function deleteSkill(skillId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/skills/${skillId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete skill (${res.status})`);
  }
}

export interface ChatStreamHandlers {
  onUserMessage?: (message: { id: string; content: string }) => void;
  onToken: (delta: string) => void;
  onDone?: (stats: { eval_count?: number; total_duration_ns?: number }) => void;
  onAssistantMessage?: (message: { id: string; content: string }) => void;
  onError?: (detail: string) => void;
}

export function streamChat(
  conversationId: string,
  content: string,
  handlers: ChatStreamHandlers,
  modelId?: string,
): AbortController {
  const controller = new AbortController();

  (async () => {
    const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, model_id: modelId }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({ detail: response.statusText }));
      handlers.onError?.(body.detail ?? "Chat request failed");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const rawEvent of events) {
        const eventLine = rawEvent.split("\n").find((line) => line.startsWith("event: "));
        const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
        if (!eventLine || !dataLine) continue;

        const eventName = eventLine.slice("event: ".length).trim();
        const data = JSON.parse(dataLine.slice("data: ".length));

        switch (eventName) {
          case "user_message":
            handlers.onUserMessage?.(data);
            break;
          case "token":
            handlers.onToken(data.delta);
            break;
          case "done":
            handlers.onDone?.(data);
            break;
          case "assistant_message":
            handlers.onAssistantMessage?.(data);
            break;
          case "error":
            handlers.onError?.(data.detail);
            break;
        }
      }
    }
  })().catch((err) => {
    if (err.name !== "AbortError") {
      handlers.onError?.(err.message ?? String(err));
    }
  });

  return controller;
}
