import { useState } from "react";
import { X } from "lucide-react";

import { MessageContent } from "../message-content";
import { DOC_SECTIONS } from "./docs-content";

export function DocsPage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeId, setActiveId] = useState(DOC_SECTIONS[0].id);

  if (!open) return null;

  const activeSection = DOC_SECTIONS.find((section) => section.id === activeId) ?? DOC_SECTIONS[0];

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
            <h2 className="text-sm font-semibold text-foreground">Documentation</h2>
          </div>
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {DOC_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeId;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveId(section.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 text-left">{section.title}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold text-foreground">{activeSection.title}</h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="max-w-2xl">
              <MessageContent content={activeSection.content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
