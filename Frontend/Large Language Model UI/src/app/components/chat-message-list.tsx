import { Check, Copy, RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";

import type { Message } from "../chat-types";
import { MessageContent } from "./message-content";
import { TypingDots } from "./typing-dots";

export function ChatMessageList({
  messages,
  copiedId,
  onCopy,
}: {
  messages: Message[];
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {messages.map((msg) => {
          const isPendingAssistant = msg.role === "assistant" && msg.content === "";

          return (
            <div
              key={msg.id}
              className={`group flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
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

              <div className={`flex flex-col gap-1.5 max-w-[85%] ${msg.role === "user" ? "items-end" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border rounded-tl-sm"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  ) : isPendingAssistant ? (
                    <TypingDots />
                  ) : (
                    <MessageContent content={msg.content} />
                  )}
                </div>

                {!isPendingAssistant && (
                  <div
                    className={`flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity px-1 ${
                      msg.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <span className="text-[10px] text-muted-foreground font-mono">{msg.timestamp}</span>
                    {msg.role === "assistant" && (
                      <>
                        <button
                          onClick={() => onCopy(msg.id, msg.content)}
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
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}