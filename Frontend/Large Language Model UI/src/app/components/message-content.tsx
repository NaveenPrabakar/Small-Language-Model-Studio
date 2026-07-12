import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
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

export function MessageContent({ content }: { content: string }) {
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
              <span className="text-violet-400 mt-[3px] shrink-0">-</span>
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

