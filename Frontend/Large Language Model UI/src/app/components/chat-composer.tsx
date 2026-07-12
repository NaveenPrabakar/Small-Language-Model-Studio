import { Paperclip, Send } from "lucide-react";
import type { KeyboardEvent, RefObject } from "react";

export function ChatComposer({
  value,
  onChange,
  onSend,
  onKeyDown,
  textareaRef,
  selectedModelName,
  isTyping,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  selectedModelName: string;
  isTyping: boolean;
}) {
  return (
    <div className="px-4 py-4 border-t border-border shrink-0">
      <div className="max-w-2xl mx-auto">
        <div className="relative flex items-end gap-2 bg-card border border-border rounded-2xl px-4 py-3 focus-within:border-primary/40 transition-colors duration-200">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
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
              onClick={onSend}
              disabled={!value.trim() || isTyping}
              className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2 font-mono">
          {selectedModelName} - Enter to send - Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

