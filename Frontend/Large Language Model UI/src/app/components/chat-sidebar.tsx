import { BookOpen, Pencil, Plus, Search, Settings, Sparkles, Trash2, X } from "lucide-react";

import type { ApiConversation } from "../lib/api";

export function ChatSidebar({
  sidebarOpen,
  conversations,
  currentConversationId,
  onClose,
  onNewConversation,
  onSelectConversation,
  onOpenSettings,
  onRenameConversation,
  onDeleteConversation,
  onOpenDocs
}: {
  sidebarOpen: boolean;
  conversations: Array<ApiConversation>;
  currentConversationId: string | null;
  onClose: () => void;
  onNewConversation: () => void;
  onSelectConversation: (conversation: ApiConversation) => void;
  onOpenSettings: () => void;
  onRenameConversation: (conversation: ApiConversation) => void;
  onDeleteConversation: (conversation: ApiConversation) => void;
  onOpenDocs: () => void;
}) {
  const groups = ["Today", "Yesterday", "Earlier"].map((label) => ({
    label,
    conversations: conversations.filter((conversation) => {
      const created = new Date(conversation.created_at);
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const startOfCreated = new Date(
        created.getFullYear(),
        created.getMonth(),
        created.getDate(),
      ).getTime();
      const diffDays = Math.round((startOfToday - startOfCreated) / 86400000);
      return label === "Today" ? diffDays <= 0 : label === "Yesterday" ? diffDays === 1 : diffDays > 1;
    }),
  }));

  return (
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
          <span className="text-sm font-semibold text-sidebar-foreground tracking-tight whitespace-nowrap">
            SLM Studio
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
        >
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
        {groups.map((group) =>
          group.conversations.length === 0 ? null : (
            <div key={group.label} className="mb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 py-2">
                {group.label}
              </p>
              {group.conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`flex items-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs transition-colors ${
                    conversation.id === currentConversationId
                      ? "bg-primary/15 text-primary font-medium border border-primary/20"
                      : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <button
                    onClick={() => onSelectConversation(conversation)}
                    className="flex-1 text-left truncate block"
                  >
                    {conversation.title}
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onRenameConversation(conversation);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
                    title="Rename conversation"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteConversation(conversation);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ),
        )}
      </div>

      <div className="p-3 border-t border-border shrink-0">
        <button
          onClick={onOpenDocs}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs transition-colors"
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">Documentation</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs transition-colors"
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">Settings</span>
        </button>
      </div>
    </aside>
  );
}
