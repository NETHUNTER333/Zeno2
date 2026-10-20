import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Terminal, Clock, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { ToolUsed } from '../types';

interface ToolExecutionBadgeProps {
  tools: ToolUsed[];
}

export const ToolExecutionBadge: React.FC<ToolExecutionBadgeProps> = ({ tools }) => {
  const [expanded, setExpanded] = useState(false);

  if (!tools || tools.length === 0) return null;

  const totalTime = tools.reduce((acc, t) => acc + (t.durationMs || 0), 0);

  return (
    <div className="mb-3 rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3.5 py-2 flex items-center justify-between text-slate-300 hover:text-white hover:bg-slate-900/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Treg Tools Executed</span>
          </div>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400 font-mono text-[11px]">
            {tools.length} call{tools.length > 1 ? 's' : ''} ({totalTime}ms)
          </span>
          <span className="text-slate-600">•</span>
          <div className="flex items-center gap-1 text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded text-[10px] font-mono border border-sky-800/40">
            <ShieldCheck className="w-3 h-3" />
            <span>org: syntrofoi</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
          <span>{expanded ? 'Hide details' : 'View execution'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3.5 py-2.5 border-t border-slate-800/80 bg-slate-900/40 space-y-2">
          {tools.map((t, idx) => (
            <div key={idx} className="p-2 rounded-lg bg-slate-950/80 border border-slate-850 flex flex-col gap-1 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
                  <Terminal className="w-3 h-3 text-sky-500" />
                  <span>{t.tool}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{t.durationMs}ms</span>
                </div>
              </div>

              {t.query && (
                <div className="text-slate-300 text-[11px] truncate">
                  <span className="text-slate-500">Query: </span>
                  <span className="text-amber-200">"{t.query}"</span>
                </div>
              )}

              {t.url && (
                <div className="text-slate-300 text-[11px] truncate">
                  <span className="text-slate-500">URL: </span>
                  <span className="text-sky-300">{t.url}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/50 mt-1">
                <span>Endpoint: {t.endpoint || `https://treg.to/call/${t.tool}`}</span>
                {t.resultsCount !== undefined && (
                  <span className="text-emerald-400">{t.resultsCount} items returned</span>
                )}
                {t.bytes !== undefined && (
                  <span className="text-emerald-400">{(t.bytes / 1024).toFixed(1)} KB extracted</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
