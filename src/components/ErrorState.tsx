import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  isDark?: boolean;
  testId?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Retry',
  isDark = true,
  testId,
  className = '',
}) => {
  return (
    <div
      role="alert"
      data-testid={testId}
      className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isDark
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          : 'bg-rose-50 border-rose-200 text-rose-800'
      } ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#FC4C01]" />
        <div className="min-w-0 space-y-0.5">
          {title && (
            <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              {title}
            </div>
          )}
          <p className="text-xs leading-relaxed break-words">{message}</p>
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          data-testid={testId ? `${testId}-retry` : undefined}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition cursor-pointer shrink-0 min-h-[36px]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {retryLabel}
        </button>
      )}
    </div>
  );
};

export default ErrorState;
