import React, { useMemo } from 'react';

export interface ChatHistoryItem {
  id: string;
  title: string;
  snippet?: string;
  timestamp?: number;
  messageCount?: number;
}

export interface ChatHistoryMessageItem {
  id: string;
  threadId: string;
  content: string;
  timestamp?: number;
}

interface ChatHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  recentPrompts?: string[];
  recentMessageItems?: ChatHistoryMessageItem[];
  historicalThreads?: ChatHistoryItem[];
  onSelectPrompt?: (prompt: string) => void;
  onSelectMessage?: (messageId: string, threadId: string, content: string) => void;
  onSelectThread?: (threadId: string) => void;
  isDark?: boolean;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  isOpen,
  onClose,
  recentPrompts = [],
  recentMessageItems = [],
  onSelectPrompt,
  onSelectMessage,
  isDark = true,
}) => {
  // Isolate strictly to the active session's message items
  const displayItems = useMemo(() => {
    if (recentMessageItems && recentMessageItems.length > 0) {
      return recentMessageItems.slice(0, 10);
    }
    if (recentPrompts && recentPrompts.length > 0) {
      return recentPrompts.slice(0, 10).map((p, idx) => ({
        id: `prompt-${idx}`,
        threadId: '',
        content: p,
      }));
    }
    return [];
  }, [recentMessageItems, recentPrompts]);

  if (!isOpen) return null;

  return (
    <>
      {/* Soft blurred background overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30 backdrop-blur-[2px] transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Floating Pill Bubbles Stack */}
      <div
        className="absolute bottom-full right-0 mb-4 z-50 flex flex-col items-end gap-2 max-w-xl w-full pointer-events-auto px-2 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {displayItems.length === 0 ? (
          <div
            className={`px-4 py-2.5 rounded-2xl border text-xs shadow-md backdrop-blur-xl ${
              isDark
                ? 'bg-[#1c1c1f]/95 border-white/10 text-neutral-400'
                : 'bg-white/95 border-neutral-200 text-neutral-600'
            }`}
          >
            No prompt history in this chat session yet.
          </div>
        ) : (
          <>
            {displayItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (onSelectMessage) {
                    onSelectMessage(item.id, item.threadId, item.content);
                  } else if (onSelectPrompt) {
                    onSelectPrompt(item.content);
                  }
                  onClose();
                }}
                style={{
                  animationDelay: `${idx * 30}ms`,
                }}
                className={`group text-right px-3.5 py-2 rounded-2xl border text-xs leading-snug transition-all duration-150 cursor-pointer active:scale-98 animate-in fade-in slide-in-from-bottom-2 ${
                  isDark
                    ? 'bg-[#1c1c1f]/95 hover:bg-[#252529] border-white/10 text-[#ededed] hover:text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
                    : 'bg-[#f4f4f5]/95 hover:bg-[#eaeaea] border-black/5 text-[#18181b] hover:text-black shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
                }`}
                title="Navigate to message"
              >
                <span>{item.content}</span>
              </button>
            ))}

            {/* Subtle dismiss / indicator hint */}
            <div className="flex items-center gap-1.5 pt-0.5 pr-1 text-[10px] opacity-40">
              <span>Session prompt history</span>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ChatHistory;
