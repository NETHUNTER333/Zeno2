import React, { useState } from 'react';

export interface PlanTask {
  id: string;
  text: string;
  done?: boolean;
  votes?: number;
}

export interface PlanCardProps {
  title: string;
  description?: string;
  badge?: string;
  tasks: PlanTask[];
  isDark?: boolean;
  type?: 'plan' | 'poll';
  onVote?: (optionId: string) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  title,
  description,
  badge,
  tasks: initialTasks,
  isDark = true,
  type = 'plan',
  onVote,
}) => {
  const isPoll = type === 'poll';
  const defaultBadge = isPoll ? 'Poll' : 'Todo';
  const displayBadge = badge || defaultBadge;

  const [tasks, setTasks] = useState<PlanTask[]>(() => {
    return initialTasks.map((t, idx) => ({
      ...t,
      votes: t.votes !== undefined ? t.votes : isPoll ? Math.max(1, 24 - idx * 6) : 0,
    }));
  });

  const [selectedPollOption, setSelectedPollOption] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const handleVote = (id: string) => {
    if (selectedPollOption === id) return;
    setSelectedPollOption(id);
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return { ...t, votes: (t.votes || 0) + 1 };
        }
        if (t.id === selectedPollOption) {
          return { ...t, votes: Math.max(0, (t.votes || 0) - 1) };
        }
        return t;
      })
    );
    onVote?.(id);
  };

  const completedCount = tasks.filter((t) => t.done).length;
  const totalVotes = tasks.reduce((sum, t) => sum + (t.votes || 0), 0);

  const copyPlan = () => {
    const text = isPoll
      ? `# Poll: ${title}\n${description ? `${description}\n\n` : ''}${tasks
          .map((t) => {
            const pct = totalVotes > 0 ? Math.round(((t.votes || 0) / totalVotes) * 100) : 0;
            return `- ${t.text}: ${t.votes || 0} votes (${pct}%)`;
          })
          .join('\n')}`
      : `# ${title}\n${description ? `${description}\n\n` : ''}${tasks
          .map((t) => `- [${t.done ? 'x' : ' '}] ${t.text}`)
          .join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-slot="kobra-plan-card"
      className={`my-2.5 rounded-3xl border px-3.5 py-2.5 transition-all duration-200 text-[11px] font-normal ${
        isDark
          ? 'bg-[#141418] border-white/[0.1] text-white/90 shadow-xs'
          : 'bg-white border-black/[0.08] text-[#18181b] shadow-xs'
      }`}
    >
      {/* Compact Pill Header: No icons, no divider lines, no heavy bold text */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-normal truncate">{title}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-normal shrink-0 border ${
              isDark
                ? 'bg-white/[0.04] border-white/10 text-white/65'
                : 'bg-[#f4f4f5] border-black/[0.06] text-black/65'
            }`}
          >
            {isPoll
              ? `${displayBadge} · ${totalVotes} votes`
              : `${completedCount}/${tasks.length} done`}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={copyPlan}
            className={`px-2.5 py-0.5 rounded-full border text-[10px] font-normal transition-colors cursor-pointer ${
              isDark
                ? 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/10'
                : 'bg-[#f4f4f5] border-black/[0.06] text-black/70 hover:bg-neutral-200/70'
            }`}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-2.5 py-0.5 rounded-full border text-[10px] font-normal transition-colors cursor-pointer ${
              isDark
                ? 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/10'
                : 'bg-[#f4f4f5] border-black/[0.06] text-black/70 hover:bg-neutral-200/70'
            }`}
          >
            {isExpanded ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {description && isExpanded && (
        <p className="text-[10.5px] opacity-60 mt-1 line-clamp-1 px-0.5">
          {description}
        </p>
      )}

      {/* Pill-shaped internals: No divider lines, no icons, small font */}
      {isExpanded && (
        <div className="mt-2 space-y-1">
          {isPoll
            ? tasks.map((opt) => {
                const votes = opt.votes || 0;
                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                const isSelected = selectedPollOption === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleVote(opt.id)}
                    className={`relative w-full rounded-full px-3 py-1.5 text-left text-[11px] font-normal transition-all cursor-pointer overflow-hidden border ${
                      isSelected
                        ? isDark
                          ? 'border-white/30 bg-white/[0.08]'
                          : 'border-black/25 bg-black/[0.06]'
                        : isDark
                        ? 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]'
                        : 'border-black/[0.06] bg-[#fafafa] hover:bg-[#f4f4f5]'
                    }`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-full ${
                        isDark ? 'bg-white/[0.07]' : 'bg-black/[0.05]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />

                    <div className="relative flex items-center justify-between gap-2 z-10">
                      <span className="truncate">{opt.text}</span>
                      <span className="shrink-0 text-[10px] opacity-65">
                        {votes} · {pct}%
                      </span>
                    </div>
                  </button>
                );
              })
            : tasks.map((task, idx) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-full border text-left text-[11px] font-normal transition-colors cursor-pointer ${
                    task.done
                      ? isDark
                        ? 'bg-white/[0.015] border-white/[0.05] text-white/45'
                        : 'bg-[#fafafa] border-black/[0.04] text-black/45'
                      : isDark
                      ? 'bg-white/[0.03] border-white/[0.08] text-white/85 hover:bg-white/[0.06]'
                      : 'bg-[#fafafa] border-black/[0.07] text-[#18181b] hover:bg-[#f4f4f5]'
                  }`}
                >
                  <span className={`truncate ${task.done ? 'line-through' : ''}`}>
                    {idx + 1}. {task.text}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] shrink-0 ${
                      task.done
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-[#18181b] text-white'
                        : isDark
                        ? 'bg-white/[0.05] text-white/55'
                        : 'bg-black/[0.05] text-black/55'
                    }`}
                  >
                    {task.done ? 'Done' : 'Todo'}
                  </span>
                </button>
              ))}
        </div>
      )}
    </div>
  );
};

export default PlanCard;
