import { ChevronDown, Menu } from "lucide-react";

import type { ApiModel } from "../lib/api";

export function ChatHeader({
  title,
  sidebarOpen,
  onOpenSidebar,
  selectedModel,
  models,
  dropdownOpen,
  onToggleDropdown,
  onSelectModel,
}: {
  title: string;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  selectedModel: ApiModel;
  models: ApiModel[];
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
  onSelectModel: (model: ApiModel) => void;
}) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {!sidebarOpen && (
          <button
            onClick={onOpenSidebar}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <span className="text-sm font-medium text-foreground truncate">{title}</span>
      </div>

      <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onToggleDropdown}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium text-secondary-foreground hover:bg-accent/60 transition-colors"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          <span>{selectedModel.name}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

          {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-card shadow-2xl shadow-black/50 z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2">
              Select model
            </p>
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onSelectModel(model);
                  onToggleDropdown();
                }}
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
                  {selectedModel.id === model.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
