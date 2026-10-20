import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ListTodo,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  BarChart2,
  Vote
} from 'lucide-react';

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
  const defaultBadge = isPoll ? 'Live Poll' : 'Action Plan';
  const displayBadge = badge || defaultBadge;

  // Initialize tasks with votes if it's a poll
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
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

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
      className={`my-3.5 rounded-2xl border p-3.5 transition-all duration-200 ${
        isDark
          ? 'bg-[#121212]/80 border-[#262626] text-white shadow-sm'
          : 'bg-[#fafafa] border-[#e2e2e2] text-black shadow-xs'
      }`}
    >
      {/* Header bar */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-start gap-2 min-w-0">
          <div
            className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${
              isPoll
                ? isDark
                  ? 'bg-purple-500/15 text-purple-400'
                  : 'bg-purple-500/10 text-purple-600'
                : isDark
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-emerald-500/10 text-emerald-600'
            }`}
          >
            {isPoll ? <Vote className="w-4 h-4" /> : <ListTodo className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm truncate">{title}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase ${
                  isPoll
                    ? isDark
                      ? 'bg-purple-500/15 text-purple-400'
                      : 'bg-purple-500/10 text-purple-700'
                    : isDark
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-emerald-500/10 text-emerald-700'
                }`}
              >
                {displayBadge}
              </span>
            </div>
            {description && (
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={copyPlan}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-white/10 text-white/60 hover:text-white'
                : 'hover:bg-black/5 text-black/60 hover:text-black'
            }`}
            title={isPoll ? 'Copy poll results' : 'Copy plan'}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-white/10 text-white/60 hover:text-white'
                : 'hover:bg-black/5 text-black/60 hover:text-black'
            }`}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Progress / Summary row */}
      {!isPoll ? (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>
              {completedCount} of {tasks.length} completed
            </span>
            <span className="font-mono">{progressPercent}%</span>
          </div>
          <div
            className={`h-1.5 w-full rounded-full overflow-hidden ${
              isDark ? 'bg-white/10' : 'bg-black/10'
            }`}
          >
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mb-2 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>{totalVotes} total votes</span>
          <span>{selectedPollOption ? 'Vote submitted' : 'Click an option to vote'}</span>
        </div>
      )}

      {/* Items list */}
      {isExpanded && (
        <div className="space-y-1.5 pt-1 border-t border-inherit/40">
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
                    className={`relative w-full rounded-xl p-2.5 text-left text-xs transition-all cursor-pointer overflow-hidden border ${
                      isSelected
                        ? isDark
                          ? 'border-purple-500/50 bg-purple-500/10'
                          : 'border-purple-500/50 bg-purple-500/5'
                        : isDark
                        ? 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                        : 'border-black/[0.08] bg-black/[0.02] hover:bg-black/[0.04]'
                    }`}
                  >
                    {/* Background Progress Fill */}
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                        isSelected
                          ? isDark
                            ? 'bg-purple-500/20'
                            : 'bg-purple-500/15'
                          : isDark
                          ? 'bg-white/[0.06]'
                          : 'bg-black/[0.04]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />

                    <div className="relative flex items-center justify-between gap-3 z-10">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`size-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-purple-500 bg-purple-500 text-white'
                              : isDark
                              ? 'border-white/30'
                              : 'border-black/30'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <span className={`font-medium truncate ${isSelected ? 'text-purple-400 font-semibold' : ''}`}>
                          {opt.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] opacity-80">
                        <span>{votes} votes</span>
                        <span className="font-semibold">{pct}%</span>
                      </div>
                    </div>
                  </button>
                );
              })
            : tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  className={`w-full flex items-start gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer group ${
                    isDark
                      ? 'hover:bg-white/[0.05] text-[#d4d4d4]'
                      : 'hover:bg-black/[0.04] text-[#333333]'
                  }`}
                >
                  {task.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-foreground" />
                  )}
                  <span
                    className={`leading-snug transition-all ${
                      task.done ? 'line-through opacity-50' : 'opacity-90'
                    }`}
                  >
                    {task.text}
                  </span>
                </button>
              ))}
        </div>
      )}
    </div>
  );
};
