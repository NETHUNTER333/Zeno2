import React, { useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, X, MessageSquare } from 'lucide-react';

export interface DeleteThreadTarget {
  id: string;
  title: string;
  messageCount?: number;
}

interface DeleteThreadConfirmDialogProps {
  thread: DeleteThreadTarget | null;
  isDark: boolean;
  onConfirm: (threadId: string) => void;
  onCancel: () => void;
}

export const DeleteThreadConfirmDialog: React.FC<DeleteThreadConfirmDialogProps> = ({
  thread,
  isDark,
  onConfirm,
  onCancel,
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!thread) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(thread.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 30);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [thread, onCancel, onConfirm]);

  if (!thread) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-thread-dialog-title"
      aria-describedby="delete-thread-dialog-desc"
      onClick={onCancel}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl transition-all ${
          isDark
            ? 'bg-[#121214] border-white/12 text-white shadow-[0_20px_60px_rgba(0,0,0,0.75)]'
            : 'bg-white border-black/10 text-[#0d0d0d] shadow-[0_20px_50px_rgba(0,0,0,0.18)]'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/12 border border-red-500/25 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h3
                id="delete-thread-dialog-title"
                className="text-sm font-bold tracking-tight"
              >
                Delete chat thread?
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                This action cannot be undone.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isDark
                ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                : 'text-neutral-400 hover:text-black hover:bg-black/5'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thread Preview Box */}
        <div
          id="delete-thread-dialog-desc"
          className={`mt-4 p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
            isDark
              ? 'bg-white/[0.03] border-white/10'
              : 'bg-neutral-50 border-black/10'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-3.5 h-3.5 text-[#FC4C01] shrink-0" />
            <span className="text-xs font-semibold truncate">
              {thread.title || 'Untitled conversation'}
            </span>
          </div>
          {typeof thread.messageCount === 'number' && thread.messageCount > 0 && (
            <span className="text-[10px] font-mono tabular-nums text-neutral-400 shrink-0">
              {thread.messageCount} {thread.messageCount === 1 ? 'msg' : 'msgs'}
            </span>
          )}
        </div>

        <p className="mt-3 text-xs text-neutral-400 leading-relaxed">
          Are you sure you want to permanently delete this entire conversation from your workspace and cloud history?
        </p>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              isDark
                ? 'border-white/12 bg-white/[0.04] hover:bg-white/10 text-neutral-200'
                : 'border-black/12 bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
            }`}
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={() => onConfirm(thread.id)}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Thread</span>
          </button>
        </div>
      </div>
    </div>
  );
};
