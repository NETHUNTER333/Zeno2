import React, { useState } from 'react';
import { Layers, Plus, X, MessageSquare, CheckCircle2, Clock, ArrowUpRight, Sparkles } from 'lucide-react';

interface SideTaskTab {
  id: string;
  title: string;
  status: 'running' | 'completed';
  prompt: string;
  response: string;
  timestamp: string;
}

interface SideChatWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onAskKinich: (prompt: string) => void;
}

export const SideChatWorkspace: React.FC<SideChatWorkspaceProps> = ({
  isOpen,
  onClose,
  isDark,
  onAskKinich,
}) => {
  const [tasks, setTasks] = useState<SideTaskTab[]>([
    {
      id: 'task-1',
      title: 'Build CRM pipeline stages',
      status: 'completed',
      prompt: 'Please break down the sales pipeline stages for enterprise SaaS CRM.',
      response: '1. Lead Qualified\n2. Demo / Discovery\n3. Technical Evaluation\n4. Proposal & Pricing\n5. Closed Won',
      timestamp: '12m ago',
    },
    {
      id: 'task-2',
      title: 'Q4 Product Launch checklist',
      status: 'running',
      prompt: 'Propose a launch checklist for Q4 product roadmap rollout.',
      response: 'Synthesizing action items across marketing, engineering QA, and docs...',
      timestamp: 'Just now',
    },
  ]);
  const [activeTaskId, setActiveTaskId] = useState<string>('task-2');
  const [newSubTaskPrompt, setNewSubTaskPrompt] = useState('');

  if (!isOpen) return null;

  const activeTask = tasks.find((t) => t.id === activeTaskId) || tasks[0];

  const handleCreateSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubTaskPrompt.trim()) return;
    const newId = `task-${Date.now()}`;
    const newTask: SideTaskTab = {
      id: newId,
      title: newSubTaskPrompt.trim().slice(0, 28) + '…',
      status: 'running',
      prompt: newSubTaskPrompt.trim(),
      response: 'Analyzing and executing side task in parallel...',
      timestamp: 'Just now',
    };
    setTasks((prev) => [newTask, ...prev]);
    setActiveTaskId(newId);
    setNewSubTaskPrompt('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div
        className={`relative w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden border shadow-2xl flex flex-col ${
          isDark ? 'bg-[#0f0f11] border-white/[0.15] text-white' : 'bg-white border-black/10 text-[#0d0d0d]'
        }`}
      >
        {/* Top Header Bar */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b text-xs ${
            isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FC4C01] to-amber-500 flex items-center justify-center text-white shadow-md">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">Side Chat & Parallel Subtasks</div>
              <div className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Run several tasks at once without interrupting your main conversation.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/10 text-neutral-300' : 'hover:bg-black/5 text-neutral-700'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Bar (Manus AI Style Tabs) */}
        <div
          className={`flex items-center gap-1.5 px-4 py-2 border-b overflow-x-auto scrollbar-none ${
            isDark ? 'bg-neutral-900/40 border-white/[0.06]' : 'bg-neutral-50 border-black/[0.06]'
          }`}
        >
          {tasks.map((task) => {
            const isActive = task.id === activeTaskId;
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => setActiveTaskId(task.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? isDark
                      ? 'bg-white text-black border-white shadow-sm'
                      : 'bg-black text-white border-black shadow-sm'
                    : isDark
                    ? 'bg-white/[0.03] border-white/10 text-neutral-300 hover:border-white/20'
                    : 'bg-white border-black/10 text-neutral-700 hover:border-black/20'
                }`}
              >
                {task.status === 'completed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
                )}
                <span className="truncate max-w-[160px]">{task.title}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setTasks((prev) => prev.filter((t) => t.id !== task.id));
                    if (activeTaskId === task.id && tasks.length > 1) {
                      const rem = tasks.filter((t) => t.id !== task.id);
                      setActiveTaskId(rem[0].id);
                    }
                  }}
                  className="opacity-60 hover:opacity-100 ml-1"
                >
                  <X className="w-3 h-3" />
                </span>
              </button>
            );
          })}

          <form onSubmit={handleCreateSubtask} className="flex items-center gap-1 ml-auto">
            <input
              type="text"
              value={newSubTaskPrompt}
              onChange={(e) => setNewSubTaskPrompt(e.target.value)}
              placeholder="New side question..."
              className={`text-xs px-3 py-1.5 rounded-xl border outline-none w-44 sm:w-56 ${
                isDark
                  ? 'bg-neutral-900 border-white/15 text-white placeholder-neutral-500'
                  : 'bg-white border-black/15 text-black placeholder-neutral-400'
              }`}
            />
            <button
              type="submit"
              className={`p-1.5 rounded-xl border flex items-center justify-center cursor-pointer ${
                isDark
                  ? 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
                  : 'bg-black/5 hover:bg-black/10 border-black/15 text-black'
              }`}
              title="Spawn side task"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Active Task Canvas */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTask ? (
            <div className="max-w-2xl mx-auto space-y-4">
              <div
                className={`p-4 rounded-2xl border ${
                  isDark ? 'bg-white/[0.03] border-white/10' : 'bg-neutral-50 border-black/10'
                }`}
              >
                <div className="text-[11px] font-medium opacity-60 mb-1">Side Prompt</div>
                <div className="text-sm font-semibold">{activeTask.prompt}</div>
                <div className="text-[10px] opacity-50 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {activeTask.timestamp}
                </div>
              </div>

              <div
                className={`p-4 rounded-2xl border ${
                  isDark ? 'bg-[#141416] border-white/10 text-neutral-200' : 'bg-white border-black/10 text-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-[#FC4C01]" />
                    <span>AI Synthesis</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onAskKinich(activeTask.prompt);
                      onClose();
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1 cursor-pointer ${
                      isDark
                        ? 'bg-white/10 hover:bg-white/15 border-white/20 text-white'
                        : 'bg-black/5 hover:bg-black/10 border-black/20 text-black'
                    }`}
                  >
                    <span>Bring to Main Chat</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                  {activeTask.response}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-60 text-xs">
              <MessageSquare className="w-8 h-8 mb-2" />
              <div>No side tasks active. Type above to spin off a parallel question.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SideChatWorkspace;
