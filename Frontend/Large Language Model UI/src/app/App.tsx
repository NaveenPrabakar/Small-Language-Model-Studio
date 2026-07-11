import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus, Search, Settings, ChevronDown, Send, Paperclip,
  Copy, RotateCcw, ThumbsUp, ThumbsDown, Menu, X,
  Check, Sparkles, Hash, Zap, Brain,
} from "lucide-react";

const MODELS = [
  { id: "claude-opus-4-8", name: "Claude Opus 4.8", provider: "Anthropic", badge: "Powerful" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "Anthropic", badge: "Balanced" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "Anthropic", badge: "Fast" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", badge: "Balanced" },
  { id: "gemini-2-5-pro", name: "Gemini 2.5 Pro", provider: "Google", badge: "Powerful" },
];

const CHATS = [
  { id: "1", title: "Explain transformers in ML", date: "Today", active: true },
  { id: "2", title: "Python async patterns", date: "Today", active: false },
  { id: "3", title: "Building a REST API with FastAPI", date: "Yesterday", active: false },
  { id: "4", title: "Quantum computing basics", date: "Yesterday", active: false },
  { id: "5", title: "Career advice for engineers", date: "Earlier", active: false },
  { id: "6", title: "React Server Components explained", date: "Earlier", active: false },
  { id: "7", title: "Optimizing PostgreSQL queries", date: "Earlier", active: false },
];

type MessageRole = "user" | "assistant";
interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="bg-white/10 text-violet-300 px-1.5 py-0.5 rounded text-[0.82em] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-foreground font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="text-sm font-semibold text-foreground mt-3 mb-1 first:mt-0">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-violet-400 mt-[3px] shrink-0">·</span>
              <span className="text-muted-foreground leading-relaxed">
                {renderInline(line.slice(2))}
              </span>
            </div>
          );
        }
        if (line === "") return <div key={i} className="h-0.5" />;
        return (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "user",
    content:
      "Can you explain how attention mechanisms work in transformer models? I'm trying to understand the math behind it.",
    timestamp: "2:14 PM",
  },
  {
    id: "2",
    role: "assistant",
    content: `Great question! Attention mechanisms are the core innovation in transformer architecture. Let me break it down.\n\n## The Core Idea\n\nAttention allows the model to **weigh the importance** of different tokens relative to each other, regardless of their position in the sequence. This is a departure from RNNs which process tokens sequentially.\n\n## The Math\n\nEach token is projected into three vectors:\n- **Query (Q)** — "What am I looking for?"\n- **Key (K)** — "What do I contain?"\n- **Value (V)** — "What information do I carry?"\n\nThe attention score between tokens is computed as:\n\n\`score = softmax(Q · Kᵀ / √d_k) · V\`\n\nThe \`√d_k\` scaling prevents dot products from exploding and causing vanishing gradients through softmax.\n\n## Multi-Head Attention\n\nRather than a single attention function, transformers run **multiple heads in parallel**, each learning to attend to different aspects — syntax, coreference, semantics. Outputs are concatenated and projected back to the model dimension.`,
    timestamp: "2:14 PM",
  },
  {
    id: "3",
    role: "user",
    content: "How does self-attention differ from cross-attention? When would you use each?",
    timestamp: "2:16 PM",
  },
  {
    id: "4",
    role: "assistant",
    content: `The distinction maps directly to **where Q, K, and V come from**.\n\n## Self-Attention\n\nAll three — Q, K, V — come from the **same sequence**. Every token attends to every other token in that sequence.\n\n- Used in the encoder to build rich contextualized representations\n- Used in the decoder for attending to previously generated tokens (with a causal mask to prevent peeking ahead)\n\n## Cross-Attention\n\nQueries come from **one sequence** (the decoder), while Keys and Values come from **another sequence** (the encoder output).\n\n- Used in encoder-decoder architectures like the original Transformer, T5, and BART\n- Allows the decoder to "read" the full encoded input when generating each output token\n\n## In Modern LLMs\n\nDecoder-only models like Claude and GPT use **only causal self-attention** — no separate encoder, no cross-attention. Encoder-decoder models like T5 use both, making cross-attention essential to the architecture.`,
    timestamp: "2:17 PM",
  },
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 150, 300].map((delay) => (
        <div
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${delay}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[1]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isTyping) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "That's a thoughtful follow-up. The relationship between **attention patterns** and emergent model behavior is an active area of mechanistic interpretability research. Each head learns to perform specific computational functions — some track syntactic dependencies, others track semantic similarity, and some appear to implement simple lookup operations. The fascinating part is that these structures emerge entirely from gradient descent on next-token prediction, without any architectural bias toward them.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 1800);
  }, [inputValue, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  const closeDropdown = () => setModelDropdownOpen(false);

  const chatGroups = [
    { label: "Today", chats: CHATS.filter((c) => c.date === "Today") },
    { label: "Yesterday", chats: CHATS.filter((c) => c.date === "Yesterday") },
    { label: "Earlier", chats: CHATS.filter((c) => c.date === "Earlier") },
  ];

  return (
    <div
      className="flex h-screen bg-background overflow-hidden"
      style={{ fontFamily: "Figtree, sans-serif" }}
    >
      {/* Sidebar */}
      <aside
        className={`flex flex-col shrink-0 border-r border-border bg-sidebar transition-[width] duration-300 ease-in-out overflow-hidden ${
          sidebarOpen ? "w-64" : "w-0"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <span
              className="text-sm font-semibold text-sidebar-foreground tracking-tight whitespace-nowrap"
            >
              LLM Studio
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2 shrink-0">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
            <Plus className="w-3.5 h-3.5" />
            New conversation
          </button>
        </div>

        <div className="px-3 pb-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/60">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              placeholder="Search..."
              className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {chatGroups.map((group) =>
            group.chats.length === 0 ? null : (
              <div key={group.label} className="mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 py-2">
                  {group.label}
                </p>
                {group.chats.map((chat) => (
                  <button
                    key={chat.id}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate block ${
                      chat.active
                        ? "bg-primary/15 text-primary font-medium border border-primary/20"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    {chat.title}
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        <div className="p-3 border-t border-border shrink-0">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs transition-colors">
            <Settings className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Settings</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0" onClick={closeDropdown}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {!sidebarOpen && (
              <button
                onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary shrink-0"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            <span className="text-sm font-medium text-foreground truncate">
              Explain transformers in ML
            </span>
          </div>

          {/* Model selector */}
          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setModelDropdownOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium text-secondary-foreground hover:bg-accent/60 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span>{selectedModel.name}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                  modelDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {modelDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-card shadow-2xl shadow-black/50 z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2">
                  Select model
                </p>
                {MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => { setSelectedModel(model); setModelDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left group"
                  >
                    <div>
                      <p className="text-xs font-medium text-foreground">{model.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{model.provider}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                        {model.badge}
                      </span>
                      {selectedModel.id === model.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
          <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`group flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === "assistant"
                      ? "bg-primary/20 border border-primary/25"
                      : "bg-secondary border border-border"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground">U</span>
                  )}
                </div>

                <div
                  className={`flex flex-col gap-1.5 max-w-[85%] ${
                    msg.role === "user" ? "items-end" : ""
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card border border-border rounded-tl-sm"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      <MessageContent content={msg.content} />
                    )}
                  </div>

                  {/* Hover actions */}
                  <div
                    className={`flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity px-1 ${
                      msg.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {msg.timestamp}
                    </span>
                    {msg.role === "assistant" && (
                      <>
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Good response"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Bad response"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Regenerate"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="px-4 py-4 border-t border-border shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-end gap-2 bg-card border border-border rounded-2xl px-4 py-3 focus-within:border-primary/40 transition-colors duration-200">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); adjustTextarea(); }}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed max-h-48"
                style={{ fontFamily: "Figtree, sans-serif" }}
              />
              <div className="flex items-center gap-2 shrink-0 pb-0.5">
                <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isTyping}
                  className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-2 font-mono">
              {selectedModel.name} · Enter to send · Shift+Enter for newline
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
