import React from 'react';
import { HelpCircle, ArrowRight } from 'lucide-react';

export interface QuestionOption {
  id: string;
  label: string;
  prompt?: string;
}

export interface QuestionCardProps {
  question: string;
  description?: string;
  options: (string | QuestionOption)[];
  onSelectOption?: (prompt: string) => void;
  isDark?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  description,
  options,
  onSelectOption,
  isDark = true,
}) => {
  return (
    <div
      className={`my-3.5 rounded-2xl border p-3.5 transition-all ${
        isDark
          ? 'bg-[#141414]/90 border-[#282828] text-white shadow-sm'
          : 'bg-[#fafafa] border-[#e2e2e2] text-black shadow-xs'
      }`}
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        <div
          className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${
            isDark ? 'bg-amber-400/10 text-amber-400' : 'bg-amber-500/10 text-amber-600'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="font-semibold text-xs sm:text-sm leading-snug">{question}</h4>
          {description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
        {options.map((opt, idx) => {
          const label = typeof opt === 'string' ? opt : opt.label;
          const prompt = typeof opt === 'string' ? opt : opt.prompt || opt.label;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectOption?.(prompt)}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer group border ${
                isDark
                  ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] hover:border-white/[0.2] text-[#e0e0e0] hover:text-white'
                  : 'bg-black/[0.02] hover:bg-black/[0.06] border-black/[0.08] hover:border-black/[0.15] text-[#222222] hover:text-black'
              }`}
            >
              <span className="truncate">{label}</span>
              <ArrowRight className="w-3 h-3 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
