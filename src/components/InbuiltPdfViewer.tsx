import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Download,
  Sparkles,
  BookOpen,
  Copy,
  Check,
  Globe,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  FileText,
  HelpCircle,
  ExternalLink,
  Layers
} from 'lucide-react';
import { speakTextWithSmallestAi, stopSmallestSpeech } from '../lib/smallestAi';

export interface InbuiltPdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl?: string;          // Direct PDF Online / Blob URL
  pdfName?: string;         // PDF / Paper Title
  extractedText?: string;   // Paper abstract or full text layer
  isDark?: boolean;
  onAskZeno?: (prompt: string) => void;
}

interface TextSelectionMenu {
  text: string;
  x: number;
  y: number;
}

export const InbuiltPdfViewer: React.FC<InbuiltPdfViewerProps> = ({
  isOpen,
  onClose,
  pdfUrl,
  pdfName = 'Document.pdf',
  extractedText = '',
  isDark = true,
  onAskZeno,
}) => {
  const [viewMode, setViewMode] = useState<'pdf' | 'reader'>('pdf');
  const [readerTheme, setReaderTheme] = useState<'dark' | 'light' | 'sepia'>('dark');
  const [isPlayingTts, setIsPlayingTts] = useState<boolean>(false);

  // Selection pop-up state
  const [selectionMenu, setSelectionMenu] = useState<TextSelectionMenu | null>(null);
  const [aiAnalysisModal, setAiAnalysisModal] = useState<{ title: string; content: string } | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Stop speech when closing
  useEffect(() => {
    if (!isOpen) {
      stopSmallestSpeech();
      setIsPlayingTts(false);
      setSelectionMenu(null);
    }
  }, [isOpen]);

  // Handle Text Selection inside document container
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionMenu(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) {
      setSelectionMenu(null);
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        setSelectionMenu({
          text: selectedText,
          x: Math.max(120, Math.min(rect.left - containerRect.left + rect.width / 2, containerRect.width - 120)),
          y: Math.max(60, rect.top - containerRect.top - 12),
        });
      }
    } catch {
      setSelectionMenu(null);
    }
  };

  // Actions
  const handleSummarizeSelection = () => {
    if (!selectionMenu) return;
    const textToSummarize = selectionMenu.text;
    setSelectionMenu(null);

    if (onAskZeno) {
      onAskZeno(`Summarize this passage from "${pdfName}":\n\n"${textToSummarize}"`);
      onClose();
    } else {
      setAiAnalysisModal({
        title: 'Selection Summary',
        content: `**Key Summary:**\n\n${textToSummarize}\n\n*Analyzed from ${pdfName}.*`,
      });
    }
  };

  const handleExplainMeaning = () => {
    if (!selectionMenu) return;
    const textToExplain = selectionMenu.text;
    setSelectionMenu(null);

    if (onAskZeno) {
      onAskZeno(`Explain the technical concepts and key takeaways of this passage from "${pdfName}":\n\n"${textToExplain}"`);
      onClose();
    }
  };

  const handleTranslateSelection = (targetLang = 'Telugu') => {
    if (!selectionMenu) return;
    const textToTranslate = selectionMenu.text;
    setSelectionMenu(null);

    if (onAskZeno) {
      onAskZeno(`Translate this passage from "${pdfName}" into ${targetLang}:\n\n"${textToTranslate}"`);
      onClose();
    }
  };

  const handleCopySelection = () => {
    if (!selectionMenu) return;
    navigator.clipboard.writeText(selectionMenu.text);
    setCopiedSuccess(true);
    setTimeout(() => {
      setCopiedSuccess(false);
      setSelectionMenu(null);
    }, 1200);
  };

  // Read Aloud Speech Synthesis
  const handleToggleReadAloud = () => {
    if (isPlayingTts) {
      stopSmallestSpeech();
      setIsPlayingTts(false);
      return;
    }

    const textToRead = extractedText.slice(0, 2000) || pdfName;
    speakTextWithSmallestAi(
      textToRead,
      'auto',
      () => setIsPlayingTts(true),
      () => setIsPlayingTts(false),
      () => setIsPlayingTts(false)
    );
  };

  if (!isOpen) return null;

  // Derive direct PDF embed URL
  const directPdfUrl = pdfUrl
    ? pdfUrl.startsWith('http') && !pdfUrl.includes('arxiv.org/pdf/')
      ? pdfUrl
      : pdfUrl.includes('arxiv.org')
      ? pdfUrl.replace('/abs/', '/pdf/').replace(/(\d+)$/, '$1.pdf')
      : pdfUrl
    : '';

  // Google Docs viewer online fallback for external PDFs
  const onlinePdfEmbedUrl = directPdfUrl
    ? directPdfUrl.startsWith('blob:') || directPdfUrl.startsWith('data:')
      ? directPdfUrl
      : `https://docs.google.com/viewer?url=${encodeURIComponent(directPdfUrl)}&embedded=true`
    : '';

  const getBgThemeClass = () => {
    if (readerTheme === 'sepia') return 'bg-[#fbf0d9] text-[#3d2f21] border-[#e2d5ba]';
    if (readerTheme === 'light') return 'bg-[#f8f9fa] text-[#0d0d0d] border-[#e0e0e0]';
    return 'bg-[#0f0f11] text-[#e5e5e5] border-[#222225]';
  };

  return (
    <div
      ref={containerRef}
      onMouseUp={handleTextSelection}
      className={`fixed inset-0 z-50 flex flex-col font-sans select-text backdrop-blur-2xl animate-in fade-in duration-200 ${
        isDark ? 'bg-black/92' : 'bg-neutral-900/85'
      }`}
    >
      {/* Top Glassmorphic Reader Control Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b backdrop-blur-2xl z-20 ${
          isDark ? 'bg-[#121214]/98 border-[#242428] text-white' : 'bg-white/98 border-[#e0e0e0] text-black'
        }`}
      >
        {/* Document Title & Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-[#007aff]/15 text-[#007aff] flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-xs truncate max-w-[240px] sm:max-w-xl" title={pdfName}>
              {pdfName}
            </h3>
          </div>
        </div>

        {/* View Mode Toggle: PDF Embed vs Readability Reader */}
        <div className="flex items-center p-0.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-medium">
          <button
            type="button"
            onClick={() => setViewMode('pdf')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === 'pdf'
                ? 'bg-[#007aff] text-white font-semibold shadow-xs'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            PDF Canvas
          </button>
          <button
            type="button"
            onClick={() => setViewMode('reader')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === 'reader'
                ? 'bg-[#007aff] text-white font-semibold shadow-xs'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            Readability
          </button>
        </div>

        {/* Reader Theme, Audio TTS, and Action Cluster */}
        <div className="flex items-center gap-2">
          {/* Reader Theme Switcher */}
          <div className="flex items-center p-0.5 rounded-lg border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setReaderTheme('dark')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                readerTheme === 'dark' ? 'bg-[#222225] text-white font-medium' : 'opacity-60 hover:opacity-100'
              }`}
              title="Dark Theme"
            >
              <Moon className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setReaderTheme('sepia')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                readerTheme === 'sepia' ? 'bg-[#fbf0d9] text-[#433422] font-medium' : 'opacity-60 hover:opacity-100'
              }`}
              title="Sepia Theme"
            >
              <BookOpen className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setReaderTheme('light')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                readerTheme === 'light' ? 'bg-[#e5e5e5] text-black font-medium' : 'opacity-60 hover:opacity-100'
              }`}
              title="Light Theme"
            >
              <Sun className="w-3 h-3" />
            </button>
          </div>

          {/* Audio Listen / TTS Button */}
          <button
            type="button"
            onClick={handleToggleReadAloud}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isPlayingTts
                ? 'bg-[#007aff] border-[#007aff] text-white animate-pulse'
                : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/10'
            }`}
            title="Read Aloud (Smallest.ai / Indic Voice)"
          >
            {isPlayingTts ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Download / Open External PDF Link */}
          {directPdfUrl && (
            <a
              href={directPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl border bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/10 transition-colors"
              title="Open Original PDF in New Tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Close Viewer */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border bg-black/10 dark:bg-white/10 border-black/15 dark:border-white/15 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 transition-colors cursor-pointer"
            title="Close Reader"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Document Reader Workspace Container with Smooth Custom Scrollbar */}
      <div
        className={`flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-8 flex flex-col items-center justify-start ${getBgThemeClass()}`}
      >
        {viewMode === 'pdf' && directPdfUrl ? (
          /* Online PDF Embed Container (No crash, instant render) */
          <div className="w-full h-full max-w-5xl my-auto rounded-2xl overflow-hidden border border-black/15 dark:border-white/15 shadow-2xl bg-black">
            <iframe
              src={onlinePdfEmbedUrl}
              title={pdfName}
              className="w-full h-full min-h-[75vh] border-0 block"
            />
          </div>
        ) : (
          /* Readability Clean Article Reader Container */
          <div className="max-w-3xl w-full mx-auto my-6 p-6 sm:p-10 rounded-2xl border shadow-xl leading-relaxed whitespace-pre-wrap text-sm font-serif">
            <div className="font-sans font-bold text-lg mb-4 pb-2 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <span>{pdfName}</span>
              <span className="text-xs font-mono font-normal opacity-60">Readability Layer</span>
            </div>
            {extractedText || 'Previewing parsed document text layer.'}
          </div>
        )}
      </div>

      {/* Interactive Floating Selection Action Menu */}
      {selectionMenu && (
        <div
          style={{
            left: `${selectionMenu.x}px`,
            top: `${selectionMenu.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className={`absolute z-50 flex items-center gap-1 p-1 rounded-2xl border shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? 'bg-[#18181b]/98 border-[#3f3f46] text-white shadow-black/90'
              : 'bg-white/98 border-[#cbd5e1] text-black shadow-black/20'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Summarize Selection Button */}
          <button
            type="button"
            onClick={handleSummarizeSelection}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-[#007aff] hover:text-white transition-colors cursor-pointer text-xs font-medium"
            title="Summarize highlighted passage"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Summarize</span>
          </button>

          {/* Explain Meaning Button */}
          <button
            type="button"
            onClick={handleExplainMeaning}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-[#007aff] hover:text-white transition-colors cursor-pointer text-xs font-medium"
            title="Explain technical context"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Explain</span>
          </button>

          {/* Translate Button */}
          <button
            type="button"
            onClick={() => handleTranslateSelection('Telugu')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-[#007aff] hover:text-white transition-colors cursor-pointer text-xs font-medium"
            title="Translate into Telugu / Target Language"
          >
            <Globe className="w-3.5 h-3.5 opacity-80" />
            <span>Translate</span>
          </button>

          {/* Copy Text Button */}
          <button
            type="button"
            onClick={handleCopySelection}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-xs"
            title="Copy selection"
          >
            {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* AI Analysis Modal Pop-up */}
      {aiAnalysisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl animate-in fade-in duration-150">
          <div
            className={`max-w-lg w-full p-6 rounded-3xl border shadow-2xl ${
              isDark ? 'bg-[#141416] border-[#2a2a2e] text-white' : 'bg-white border-[#d0d0d0] text-black'
            }`}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/10 dark:border-white/10">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#007aff]" />
                <span>{aiAnalysisModal.title}</span>
              </h4>
              <button
                type="button"
                onClick={() => setAiAnalysisModal(null)}
                className="p-1 hover:opacity-100 opacity-60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed whitespace-pre-wrap mb-4 opacity-90">
              {aiAnalysisModal.content}
            </p>
            <button
              type="button"
              onClick={() => setAiAnalysisModal(null)}
              className="w-full py-2 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white font-medium text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
