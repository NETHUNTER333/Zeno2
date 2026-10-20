import React, { useMemo, useState } from 'react';
import { render as renderPele } from 'pele';
import { Copy, Check, Download, AlertCircle, Maximize2 } from 'lucide-react';

interface PeleDiagramProps {
  code: string;
  isDark?: boolean;
}

export const PeleDiagram: React.FC<PeleDiagramProps> = ({ code, isDark = true }) => {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Clean and render diagram SVG with pele
  const { svg, error } = useMemo(() => {
    try {
      const trimmed = code.trim();
      const result = renderPele(trimmed);
      return { svg: result.svg, error: null };
    } catch (err: any) {
      return { svg: null, error: err?.message || 'Failed to render diagram with Pele' };
    }
  }, [code]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (error || !svg) {
    return (
      <div
        className={`my-3 p-4 rounded-xl border text-xs font-mono overflow-x-auto ${
          isDark
            ? 'bg-red-950/20 border-red-500/30 text-red-400'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}
      >
        <div className="flex items-center gap-2 mb-2 font-semibold">
          <AlertCircle className="w-4 h-4" />
          <span>Diagram Render Error</span>
        </div>
        <p className="text-[11px] mb-2">{error}</p>
        <pre className="p-2 rounded bg-black/20 text-[10px] whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  return (
    <div
      className={`my-4 rounded-2xl border overflow-hidden transition-all ${
        isDark
          ? 'bg-[#0f0f12] border-white/10 shadow-lg'
          : 'bg-white border-black/10 shadow-sm'
      } ${isFullscreen ? 'fixed inset-4 z-50 flex flex-col p-4 bg-opacity-95 backdrop-blur-xl' : ''}`}
    >
      {/* Diagram Action Bar */}
      <div
        className={`flex items-center justify-between px-3.5 py-2 border-b text-xs select-none ${
          isDark
            ? 'border-white/10 bg-white/[0.02] text-neutral-400'
            : 'border-black/10 bg-neutral-50 text-neutral-600'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-[11px] tracking-wider uppercase">Mermaid Diagram</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded border border-neutral-500/20 opacity-70">
            Pele Engine
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyCode}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/10 text-neutral-400 hover:text-white' : 'hover:bg-black/10 text-neutral-600 hover:text-black'
            }`}
            title="Copy diagram source code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/10 text-neutral-400 hover:text-white' : 'hover:bg-black/10 text-neutral-600 hover:text-black'
            }`}
            title="Download SVG vector"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/10 text-neutral-400 hover:text-white' : 'hover:bg-black/10 text-neutral-600 hover:text-black'
            }`}
            title={isFullscreen ? 'Exit full view' : 'Expand full view'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas with Pele Theme Variables */}
      <div
        className={`p-4 sm:p-6 overflow-x-auto flex items-center justify-center ${
          isDark
            ? '[--pele-bg:transparent] [--pele-fg:#e4e4e7] [--pele-line:#71717a] [--pele-surface:#18181b] [--pele-surface-alt:#27272a] [--pele-border:#3f3f46] [--pele-accent:#3b82f6] text-white'
            : '[--pele-bg:transparent] [--pele-fg:#18181b] [--pele-line:#a1a1aa] [--pele-surface:#f4f4f5] [--pele-surface-alt:#e4e4e7] [--pele-border:#d4d4d8] [--pele-accent:#2563eb] text-black'
        }`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
};
