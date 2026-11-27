import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Download, ChevronDown, Film, Music, Layers } from 'lucide-react';
import { VideoExplainerStudio, type ExportFormat } from './video-explainer/VideoExplainerStudio';

export interface VideoGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  initialPrompt?: string;
}

export const VideoGenerateModal: React.FC<VideoGenerateModalProps> = ({
  isOpen,
  onClose,
  isDark = true,
  initialPrompt = '',
}) => {
  const [exportRequest, setExportRequest] = useState<{ seq: number; format: ExportFormat }>({
    seq: 0,
    format: 'both',
  });
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (exportMenuOpen) setExportMenuOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, exportMenuOpen, onClose]);

  if (!isOpen) return null;

  const bdr = isDark ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const subtleBtn = isDark
    ? 'border-white/14 bg-white/[0.05] text-neutral-200 hover:bg-white/[0.11]'
    : 'border-black/12 bg-black/[0.04] text-neutral-800 hover:bg-black/[0.08]';

  const triggerExport = (format: ExportFormat) => {
    setExportMenuOpen(false);
    setExportRequest((prev) => ({ seq: prev.seq + 1, format }));
  };

  return (
    <div
      className={`fixed inset-0 z-[120] w-screen h-[100dvh] flex flex-col overflow-hidden ${
        isDark ? 'bg-[#09090b] text-white' : 'bg-[#fafafa] text-neutral-950'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Video Studio"
    >
      <header className={`h-14 px-4 sm:px-5 border-b flex items-center justify-between gap-4 shrink-0 ${bdr}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to workspace"
            className={`size-9 rounded-full border inline-flex items-center justify-center transition-colors cursor-pointer ${subtleBtn}`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold tracking-tight whitespace-nowrap">Video Studio</span>
        </div>

        <div className="relative">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => setExportMenuOpen((v) => !v)}
            className={`h-9 px-4 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 transition-colors ${subtleBtn}`}
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isExporting ? 'Exporting…' : 'Export MP4 / MP3'}</span>
            {!isExporting && <ChevronDown className="w-3.5 h-3.5 opacity-70" />}
          </button>

          {exportMenuOpen && !isExporting && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
              <div
                className={`absolute right-0 top-11 z-50 w-60 p-1.5 rounded-2xl border shadow-2xl ${
                  isDark ? 'bg-[#121216] border-white/14 text-white' : 'bg-white border-black/12 text-neutral-950'
                }`}
              >
                <button
                  type="button"
                  onClick={() => triggerExport('both')}
                  className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
                  }`}
                >
                  <span className={`size-7 rounded-full inline-flex items-center justify-center shrink-0 ${isDark ? 'bg-white text-black' : 'bg-neutral-950 text-white'}`}>
                    <Layers className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">MP4 + MP3 (Both)</div>
                    <div className={`text-[10.5px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>Combined video + separate audio</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => triggerExport('mp4')}
                  className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
                  }`}
                >
                  <span className={`size-7 rounded-full inline-flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10 text-white' : 'bg-black/8 text-neutral-900'}`}>
                    <Film className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">MP4 Video + Audio</div>
                    <div className={`text-[10.5px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>HD video with voiceover &amp; score</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => triggerExport('mp3')}
                  className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.05]'
                  }`}
                >
                  <span className={`size-7 rounded-full inline-flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10 text-white' : 'bg-black/8 text-neutral-900'}`}>
                    <Music className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">MP3 Audio Track</div>
                    <div className={`text-[10.5px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>Voiceover + score soundtrack</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <VideoExplainerStudio
        isDark={isDark}
        initialPrompt={initialPrompt}
        exportRequest={exportRequest}
        onExportStateChange={setIsExporting}
      />
    </div>
  );
};
