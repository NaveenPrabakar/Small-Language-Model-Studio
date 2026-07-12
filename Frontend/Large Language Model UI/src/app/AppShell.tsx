import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { ChatComposer } from "./components/chat-composer";
import { ChatHeader } from "./components/chat-header";
import { ChatMessageList } from "./components/chat-message-list";
import { ChatSidebar } from "./components/chat-sidebar";
import { SettingsModal } from "./components/settings-modal";
import type { Message } from "./chat-types";
import {
  createAgent,
  createConversation,
  createMcpServer,
  createSkill,
  deleteAgent,
  deleteConversation,
  deleteMcpServer,
  deleteSkill,
  getMessages,
  listAgents,
  listConversations,
  listMcpServers,
  listModels,
  listSkills,
  pullModel,
  streamChat,
  updateConversation,
  type ApiAgent,
  type ApiConversation,
  type ApiMessage,
  type ApiMcpServer,
  type ApiModel,
  type ApiSkill,
} from "./lib/api";

const FALLBACK_MODELS: ApiModel[] = [
  { id: "claude-opus-4-8", name: "Claude Opus 4.8", provider: "Anthropic", badge: "Powerful", parameter_size: null, quantization: null, size_bytes: null },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "Anthropic", badge: "Balanced", parameter_size: null, quantization: null, size_bytes: null },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "Anthropic", badge: "Fast", parameter_size: null, quantization: null, size_bytes: null },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", badge: "Balanced", parameter_size: null, quantization: null, size_bytes: null },
  { id: "gemini-2-5-pro", name: "Gemini 2.5 Pro", provider: "Google", badge: "Powerful", parameter_size: null, quantization: null, size_bytes: null },
];

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toMessage(message: ApiMessage): Message {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: formatTime(message.created_at),
  };
}

function replaceLastMessage(
  prev: Message[],
  role: Message["role"],
  nextMessage: (message: Message) => Message,
): Message[] {
  const next = [...prev];
  for (let i = next.length - 1; i >= 0; i -= 1) {
    if (next[i].role === role) {
      next[i] = nextMessage(next[i]);
      break;
    }
  }
  return next;
}

export default function AppShell() {
  const [models, setModels] = useState<ApiModel[]>(FALLBACK_MODELS);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedModelId, setSelectedModelId] = useState(FALLBACK_MODELS[1].id);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pullModelName, setPullModelName] = useState("");
  const [pullingModel, setPullingModel] = useState(false);
  const [pullStatus, setPullStatus] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<ApiMcpServer[]>([]);
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [savingMcp, setSavingMcp] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<string | null>(null);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [agentName, setAgentName] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [savingAgent, setSavingAgent] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [skillName, setSkillName] = useState("");
  const [skillInstructions, setSkillInstructions] = useState("");
  const [savingSkill, setSavingSkill] = useState(false);
  const [skillStatus, setSkillStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? models[0] ?? FALLBACK_MODELS[0];
  const activeConversation = conversations.find((conversation) => conversation.id === currentConversationId) ?? null;
  const conversationTitle = activeConversation?.title ?? "New conversation";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loadedModels = await listModels().catch(() => []);
        const nextModels = loadedModels.length > 0 ? loadedModels : FALLBACK_MODELS;
        const loadedConversations = await listConversations().catch(() => []);
        const loadedMcpServers = await listMcpServers().catch(() => []);
        const loadedAgents = await listAgents().catch(() => []);
        const loadedSkills = await listSkills().catch(() => []);

        if (cancelled) return;

        setModels(nextModels);
        setSelectedModelId((current) =>
          nextModels.some((model) => model.id === current) ? current : nextModels[0].id,
        );
        setConversations(loadedConversations);
        setMcpServers(loadedMcpServers);
        setAgents(loadedAgents);
        setSkills(loadedSkills);

        if (loadedConversations.length > 0) {
          const active = loadedConversations[0];
          setCurrentConversationId(active.id);
          setSelectedModelId(active.model_id);
          const loadedMessages = await getMessages(active.id).catch(() => []);
          if (!cancelled) {
            setMessages(loadedMessages.map(toMessage));
          }
        }
      } finally {
        if (!cancelled) {
          setIsTyping(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshConversations = async () => {
    const loaded = await listConversations().catch(() => []);
    setConversations(loaded);
  };

  const refreshModels = async () => {
    const loaded = await listModels().catch(() => []);
    if (loaded.length > 0) {
      setModels(loaded);
      setSelectedModelId((current) => (loaded.some((model) => model.id === current) ? current : loaded[0].id));
    }
  };

  const refreshMcpServers = async () => {
    const loaded = await listMcpServers().catch(() => []);
    setMcpServers(loaded);
  };

  const refreshAgents = async () => {
    const loaded = await listAgents().catch(() => []);
    setAgents(loaded);
  };

  const refreshSkills = async () => {
    const loaded = await listSkills().catch(() => []);
    setSkills(loaded);
  };

  const handleNewConversation = async () => {
    try {
      const conversation = await createConversation(selectedModel.id);
      setConversations((prev) => [conversation, ...prev.filter((item) => item.id !== conversation.id)]);
      setCurrentConversationId(conversation.id);
      setMessages([]);
    } catch {
      setCurrentConversationId(null);
      setMessages([]);
    }
  };

  const handleSelectConversation = async (conversation: ApiConversation) => {
    setCurrentConversationId(conversation.id);
    setSelectedModelId(conversation.model_id);
    const loadedMessages = await getMessages(conversation.id).catch(() => []);
    setMessages(loadedMessages.map(toMessage));
  };

  const handleSelectModel = async (model: ApiModel) => {
    setSelectedModelId(model.id);
    if (!currentConversationId) return;
    try {
      const updated = await updateConversation(currentConversationId, { model_id: model.id });
      setConversations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      // Keep the UI usable even if the persistence update fails.
    }
  };

  const handlePullModel = async () => {
    const modelName = pullModelName.trim();
    if (!modelName || pullingModel) return;

    setPullingModel(true);
    setPullStatus(`Pulling ${modelName}...`);
    try {
      await pullModel(modelName);
      setPullStatus(`Pulled ${modelName}.`);
      setPullModelName("");
      await refreshModels();
    } catch (error) {
      setPullStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setPullingModel(false);
    }
  };

  const handleAddMcpServer = async () => {
    const name = mcpName.trim();
    const url = mcpUrl.trim();
    if (!name || !url || savingMcp) return;

    setSavingMcp(true);
    setMcpStatus(`Saving ${name}...`);
    try {
      await createMcpServer({ name, url });
      setMcpStatus(`Saved ${name}.`);
      setMcpName("");
      setMcpUrl("");
      await refreshMcpServers();
    } catch (error) {
      setMcpStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingMcp(false);
    }
  };

  const handleDeleteMcpServer = async (serverId: string) => {
    await deleteMcpServer(serverId);
    await refreshMcpServers();
  };

  const handleAddAgent = async () => {
    const name = agentName.trim();
    const systemPrompt = agentPrompt.trim();
    if (!name || !systemPrompt || savingAgent) return;

    setSavingAgent(true);
    setAgentStatus(`Saving ${name}...`);
    try {
      await createAgent({ name, system_prompt: systemPrompt });
      setAgentStatus(`Saved ${name}.`);
      setAgentName("");
      setAgentPrompt("");
      await refreshAgents();
    } catch (error) {
      setAgentStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingAgent(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    await deleteAgent(agentId);
    await refreshAgents();
  };

  const handleAddSkill = async () => {
    const name = skillName.trim();
    const instructions = skillInstructions.trim();
    if (!name || !instructions || savingSkill) return;

    setSavingSkill(true);
    setSkillStatus(`Saving ${name}...`);
    try {
      await createSkill({ name, instructions });
      setSkillStatus(`Saved ${name}.`);
      setSkillName("");
      setSkillInstructions("");
      await refreshSkills();
    } catch (error) {
      setSkillStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingSkill(false);
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    await deleteSkill(skillId);
    await refreshSkills();
  };

  const handleRenameConversation = async (conversation: ApiConversation) => {
    const nextTitle = window.prompt("Rename conversation", conversation.title)?.trim();
    if (!nextTitle || nextTitle === conversation.title.trim()) return;

    try {
      const updated = await updateConversation(conversation.id, { title: nextTitle });
      setConversations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      // Keep the current title if persistence fails.
    }
  };

  const handleDeleteConversation = async (conversation: ApiConversation) => {
    const confirmed = window.confirm(`Delete "${conversation.title}"?`);
    if (!confirmed) return;

    try {
      await deleteConversation(conversation.id);
      setConversations((prev) => {
        const next = prev.filter((item) => item.id !== conversation.id);
        if (currentConversationId !== conversation.id) {
          return next;
        }

        const nextConversation = next[0] ?? null;
        setCurrentConversationId(nextConversation?.id ?? null);
        setSelectedModelId(nextConversation?.model_id ?? selectedModelId);
        if (nextConversation) {
          void getMessages(nextConversation.id).then((loadedMessages) => {
            setMessages(loadedMessages.map(toMessage));
          });
        } else {
          setMessages([]);
        }
        return next;
      });
    } catch {
      // Leave the conversation visible if deletion fails.
    }
  };

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isTyping) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userDraftId = `${Date.now()}`;
    const assistantDraftId = `${Date.now() + 1}`;

    setInputValue("");
    adjustTextarea();
    setIsTyping(true);
    setMessages((prev) => [
      ...prev,
      { id: userDraftId, role: "user", content, timestamp },
      { id: assistantDraftId, role: "assistant", content: "", timestamp },
    ]);

    let conversationId = currentConversationId;

    try {
      if (!conversationId) {
        const conversation = await createConversation(selectedModel.id);
        conversationId = conversation.id;
        setCurrentConversationId(conversationId);
        setConversations((prev) => [conversation, ...prev.filter((item) => item.id !== conversation.id)]);
      }

      if (!conversationId) {
        throw new Error("No conversation available.");
      }

      streamChat(
        conversationId,
        content,
        {
          onUserMessage: ({ id }) => {
            setMessages((prev) => replaceLastMessage(prev, "user", (message) => ({ ...message, id })));
          },
          onToken: (delta) => {
            setMessages((prev) =>
              replaceLastMessage(prev, "assistant", (message) => ({
                ...message,
                content: message.content + delta,
              })),
            );
          },
          onDone: () => {
            setIsTyping(false);
            void refreshConversations();
          },
          onAssistantMessage: (message) => {
            setMessages((prev) =>
              replaceLastMessage(prev, "assistant", () => ({
                id: message.id,
                role: "assistant",
                content: message.content,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              })),
            );
            setIsTyping(false);
            void refreshConversations();
          },
          onError: (detail) => {
            setMessages((prev) =>
              replaceLastMessage(prev, "assistant", (message) => ({
                ...message,
                content: detail,
              })),
            );
            setIsTyping(false);
            void refreshConversations();
          },
        },
        selectedModel.id,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessages((prev) =>
        replaceLastMessage(prev, "assistant", (message) => ({
          ...message,
          content: detail,
        })),
      );
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{ fontFamily: "Figtree, sans-serif" }}>
      <ChatSidebar
        sidebarOpen={sidebarOpen}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onClose={() => setSidebarOpen(false)}
        onNewConversation={() => void handleNewConversation()}
        onSelectConversation={(conversation) => void handleSelectConversation(conversation)}
        onOpenSettings={() => setSettingsOpen(true)}
        onRenameConversation={(conversation) => void handleRenameConversation(conversation)}
        onDeleteConversation={(conversation) => void handleDeleteConversation(conversation)}
      />

      <div className="flex-1 flex flex-col min-w-0" onClick={() => setModelDropdownOpen(false)}>
        <ChatHeader
          title={conversationTitle}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
          selectedModel={selectedModel}
          models={models}
          dropdownOpen={modelDropdownOpen}
          onToggleDropdown={() => setModelDropdownOpen((open) => !open)}
          onSelectModel={(model) => void handleSelectModel(model)}
        />

        <ChatMessageList messages={messages} isTyping={isTyping} copiedId={copiedId} onCopy={handleCopy} />

        <ChatComposer
          value={inputValue}
          onChange={setInputValue}
          onSend={() => void handleSend()}
          onKeyDown={handleKeyDown}
          textareaRef={textareaRef}
          selectedModelName={selectedModel.name}
          isTyping={isTyping}
        />
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        models={models}
        selectedModelId={selectedModel.id}
        onSelectModel={(modelId) => {
          const model = models.find((item) => item.id === modelId);
          if (model) {
            void handleSelectModel(model);
            setSettingsOpen(false);
          }
        }}
        pullModelName={pullModelName}
        setPullModelName={setPullModelName}
        pullingModel={pullingModel}
        pullStatus={pullStatus}
        onPullModel={() => void handlePullModel()}
        mcpName={mcpName}
        setMcpName={setMcpName}
        mcpUrl={mcpUrl}
        setMcpUrl={setMcpUrl}
        savingMcp={savingMcp}
        mcpStatus={mcpStatus}
        onAddMcpServer={() => void handleAddMcpServer()}
        mcpServers={mcpServers}
        onDeleteMcpServer={(serverId) => void handleDeleteMcpServer(serverId)}
        agents={agents}
        agentName={agentName}
        setAgentName={setAgentName}
        agentPrompt={agentPrompt}
        setAgentPrompt={setAgentPrompt}
        savingAgent={savingAgent}
        agentStatus={agentStatus}
        onAddAgent={() => void handleAddAgent()}
        onDeleteAgent={(agentId) => void handleDeleteAgent(agentId)}
        skills={skills}
        skillName={skillName}
        setSkillName={setSkillName}
        skillInstructions={skillInstructions}
        setSkillInstructions={setSkillInstructions}
        savingSkill={savingSkill}
        skillStatus={skillStatus}
        onAddSkill={() => void handleAddSkill()}
        onDeleteSkill={(skillId) => void handleDeleteSkill(skillId)}
      />
    </div>
  );
}
