import React, { useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';

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
      onClick={onCancel}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-xl border p-4 shadow-xl transition-all ${
          isDark
            ? 'bg-[#121215] border-white/10 text-white'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 id="delete-thread-dialog-title" className="text-sm font-semibold">
            Delete conversation?
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className={`text-xs leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
          Delete <span className="font-medium text-neutral-200 dark:text-neutral-100">“{thread.title || 'Untitled'}”</span>? This cannot be undone.
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              isDark
                ? 'border-white/10 text-neutral-300 hover:bg-white/5'
                : 'border-neutral-200 text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={() => onConfirm(thread.id)}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
