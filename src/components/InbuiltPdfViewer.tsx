import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  BookOpen,
  Copy,
  Check,
  Globe,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  HelpCircle,
  ExternalLink,
  Columns,
  Sigma,
  ListChecks,
  Cpu,
  Send,
  Loader2,
  Search,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { speakTextWithSmallestAi, stopSmallestSpeech } from '../lib/smallestAi';
import { getAuthHeaders } from '../lib/firebase';
import { ArxivPaper } from '../types';

export interface InbuiltPdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl?: string;          // Direct PDF Online / Blob URL
  pdfName?: string;         // PDF / Paper Title
  extractedText?: string;   // Paper abstract or full text layer
  isDark?: boolean;
  onAskZeno?: (prompt: string) => void;
  enableArxivSearch?: boolean;
}

interface TextSelectionMenu {
  text: string;
  x: number;
  y: number;
}

const INSTACLOUD_API_BASE = 'https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';

async function callZenoApi(path: string, init?: RequestInit): Promise<Response> {
  const isStaticHost =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('netlify.app'));
  if (isStaticHost) {
    return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
  }
  try {
    const localRes = await fetch(path, init);
    const ct = localRes.headers.get('content-type') || '';
    if (localRes.ok && ct.includes('application/json')) return localRes;
  } catch {}
  return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
}

export const InbuiltPdfViewer: React.FC<InbuiltPdfViewerProps> = ({
  isOpen,
  onClose,
  pdfUrl: initialPdfUrl,
  pdfName: initialPdfName = 'Academic Paper Reader',
  extractedText: initialExtractedText = '',
  isDark = true,
  onAskZeno,
  enableArxivSearch = false,
}) => {
  const [activePdfUrl, setActivePdfUrl] = useState<string>(initialPdfUrl || '');
  const [activePdfName, setActivePdfName] = useState<string>(initialPdfName);
  const [activeExtractedText, setActiveExtractedText] = useState<string>(initialExtractedText);

  const [viewMode, setViewMode] = useState<'pdf' | 'reader'>('pdf');
  const [isSplitCopilotOpen, setIsSplitCopilotOpen] = useState<boolean>(true);
  const [readerTheme, setReaderTheme] = useState<'dark' | 'light' | 'sepia'>('dark');
  const [isPlayingTts, setIsPlayingTts] = useState<boolean>(false);

  // ArXiv live search state (when opened from composer or searching another paper)
  const [arxivSearchQuery, setArxivSearchQuery] = useState<string>('');
  const [isSearchingArxiv, setIsSearchingArxiv] = useState<boolean>(false);
  const [arxivResults, setArxivResults] = useState<ArxivPaper[]>([]);
  const [showArxivSearchDrawer, setShowArxivSearchDrawer] = useState<boolean>(
    enableArxivSearch && !initialPdfUrl
  );

  // Split Reader AI Breakdown state
  const [activeActionTab, setActiveActionTab] = useState<string>('');
  const [copilotResponse, setCopilotResponse] = useState<string>('');
  const [isCopilotLoading, setIsCopilotLoading] = useState<boolean>(false);
  const [copilotQuestion, setCopilotQuestion] = useState<string>('');
  const [copiedAnalysis, setCopiedAnalysis] = useState<boolean>(false);

  // Selection pop-up state
  const [selectionMenu, setSelectionMenu] = useState<TextSelectionMenu | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActivePdfUrl(initialPdfUrl || '');
    setActivePdfName(initialPdfName);
    setActiveExtractedText(initialExtractedText);
    if (enableArxivSearch && !initialPdfUrl) {
      setShowArxivSearchDrawer(true);
    }
  }, [initialPdfUrl, initialPdfName, initialExtractedText, enableArxivSearch]);

  useEffect(() => {
    if (!isOpen) {
      stopSmallestSpeech();
      setIsPlayingTts(false);
      setSelectionMenu(null);
    }
  }, [isOpen]);

  const handleSearchArxiv = async (queryOverride?: string) => {
    const q = (queryOverride ?? arxivSearchQuery).trim();
    if (!q || isSearchingArxiv) return;
    setIsSearchingArxiv(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await callZenoApi(`/api/arxiv/search?q=${encodeURIComponent(q)}&max_results=6`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (Array.isArray(data?.papers)) {
        setArxivResults(data.papers);
      }
    } catch {} finally {
      setIsSearchingArxiv(false);
    }
  };

  const handleSelectArxivPaper = (paper: ArxivPaper) => {
    setActivePdfUrl(paper.pdfUrl);
    setActivePdfName(paper.title);
    setActiveExtractedText(
      `Paper Title: ${paper.title}\narXiv ID: arXiv:${paper.id}\nAuthors: ${paper.authors.join(
        ', '
      )}\nPublished: ${paper.published}\nCategories: ${paper.categories.join(', ')}\n\nABSTRACT:\n${
        paper.summary
      }`
    );
    setShowArxivSearchDrawer(false);
    setCopilotResponse('');
    setActiveActionTab('');
  };

  const runPaperDeepBreakdown = async (
    mode: 'math' | 'contributions' | 'methodology' | 'custom',
    customPromptText?: string
  ) => {
    if (isCopilotLoading) return;
    setIsSplitCopilotOpen(true);
    setIsCopilotLoading(true);
    setActiveActionTab(mode);

    const taskPrompt =
      mode === 'math'
        ? `Explain the core mathematical formulations, equations, objective functions, and theoretical foundations of "${activePdfName}". Write key equations in clean LaTeX ($...$ and $$...$$) and explain every variable intuitively.`
        : mode === 'contributions'
        ? `Provide a structured breakdown of the Key Contributions, novelty over prior state-of-the-art, empirical benchmark results, and main takeaways of "${activePdfName}".`
        : mode === 'methodology'
        ? `Provide a deep Methodology & Architecture Breakdown of "${activePdfName}"—covering model/system architecture, training or experimental setup, algorithmic pipeline, and limitations.`
        : customPromptText || copilotQuestion || `Analyze "${activePdfName}".`;

    try {
      const authHeaders = await getAuthHeaders();
      const res = await callZenoApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `You are an Academic Paper & ArXiv Deep Reader Co-Pilot.\n\nPaper Context:\n${
                activeExtractedText || activePdfName
              }\n\nRequest: ${taskPrompt}`,
            },
          ],
          webSearch: false,
          searchMode: 'off',
          model: 'deepseek-v4.1-flash:free',
        }),
      });
      const data = await res.json();
      if (data?.success && data?.text) {
        setCopilotResponse(data.text);
      } else {
        throw new Error(data?.error || 'Could not generate paper analysis');
      }
    } catch (err: any) {
      setCopilotResponse(`Error analyzing paper: ${err.message}`);
    } finally {
      setIsCopilotLoading(false);
    }
  };

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

  const handleSummarizeSelection = () => {
    if (!selectionMenu) return;
    const textToSummarize = selectionMenu.text;
    setSelectionMenu(null);
    runPaperDeepBreakdown('custom', `Summarize and explain this passage from the paper:\n\n"${textToSummarize}"`);
  };

  const handleExplainMeaning = () => {
    if (!selectionMenu) return;
    const textToExplain = selectionMenu.text;
    setSelectionMenu(null);
    runPaperDeepBreakdown(
      'custom',
      `Explain the mathematical and technical meaning of this passage from the paper from first principles:\n\n"${textToExplain}"`
    );
  };

  const handleTranslateSelection = (targetLang = 'Telugu') => {
    if (!selectionMenu) return;
    const textToTranslate = selectionMenu.text;
    setSelectionMenu(null);
    runPaperDeepBreakdown('custom', `Translate this passage into ${targetLang}:\n\n"${textToTranslate}"`);
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

  const handleToggleReadAloud = () => {
    if (isPlayingTts) {
      stopSmallestSpeech();
      setIsPlayingTts(false);
      return;
    }

    const textToRead = (copilotResponse || activeExtractedText || activePdfName).slice(0, 2000);
    speakTextWithSmallestAi(
      textToRead,
      'auto',
      () => setIsPlayingTts(true),
      () => setIsPlayingTts(false),
      () => setIsPlayingTts(false)
    );
  };

  if (!isOpen) return null;

  const directPdfUrl = activePdfUrl
    ? activePdfUrl.startsWith('http') && !activePdfUrl.includes('arxiv.org/pdf/')
      ? activePdfUrl
      : activePdfUrl.includes('arxiv.org')
      ? activePdfUrl.replace('/abs/', '/pdf/').replace(/(\d+)$/, '$1.pdf')
      : activePdfUrl
    : '';

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
        isDark ? 'bg-black/95' : 'bg-neutral-900/90'
      }`}
    >
      {/* Top Reader Control Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b z-20 ${
          isDark ? 'bg-[#101216] border-[#22252e] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Document Title & Search Toggle */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-xs truncate max-w-[200px] sm:max-w-md" title={activePdfName}>
              {activePdfName}
            </h3>
            <div className="text-[10px] text-neutral-500 font-mono">
              Academic Paper & ArXiv Deep Split Reader
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowArxivSearchDrawer(!showArxivSearchDrawer)}
            className={`ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showArxivSearchDrawer
                ? isDark
                  ? 'bg-white text-black border-white'
                  : 'bg-slate-900 text-white border-slate-900'
                : isDark
                ? 'border-[#282c37] hover:bg-white/5 text-neutral-300'
                : 'border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Search className="w-3 h-3" />
            <span>Search ArXiv</span>
          </button>
        </div>

        {/* 1-Click Academic Deep Reader Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => runPaperDeepBreakdown('math')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeActionTab === 'math'
                ? isDark
                  ? 'bg-white text-black border-white'
                  : 'bg-slate-900 text-white border-slate-900'
                : isDark
                ? 'border-[#282c37] hover:bg-white/5 text-neutral-300'
                : 'border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Sigma className="w-3.5 h-3.5" />
            <span>Explain Math/Formulas</span>
          </button>

          <button
            type="button"
            onClick={() => runPaperDeepBreakdown('contributions')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeActionTab === 'contributions'
                ? isDark
                  ? 'bg-white text-black border-white'
                  : 'bg-slate-900 text-white border-slate-900'
                : isDark
                ? 'border-[#282c37] hover:bg-white/5 text-neutral-300'
                : 'border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>Key Contributions</span>
          </button>

          <button
            type="button"
            onClick={() => runPaperDeepBreakdown('methodology')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeActionTab === 'methodology'
                ? isDark
                  ? 'bg-white text-black border-white'
                  : 'bg-slate-900 text-white border-slate-900'
                : isDark
                ? 'border-[#282c37] hover:bg-white/5 text-neutral-300'
                : 'border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Methodology Breakdown</span>
          </button>
        </div>

        {/* Right Controls: View Mode, Split Toggle, Theme, Audio, Close */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center p-0.5 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'pdf'
                  ? isDark
                    ? 'bg-white text-black font-semibold'
                    : 'bg-slate-900 text-white font-semibold'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => setViewMode('reader')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'reader'
                  ? isDark
                    ? 'bg-white text-black font-semibold'
                    : 'bg-slate-900 text-white font-semibold'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              Abstract/Text
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSplitCopilotOpen(!isSplitCopilotOpen)}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              isSplitCopilotOpen
                ? isDark
                  ? 'bg-white/15 border-white/30 text-white'
                  : 'bg-slate-200 border-slate-400 text-slate-900'
                : 'border-white/10 opacity-70 hover:opacity-100'
            }`}
            title="Toggle Split Co-Pilot Panel"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleToggleReadAloud}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              isPlayingTts
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'border-black/10 dark:border-white/10 hover:bg-white/5'
            }`}
            title="Read Aloud"
          >
            {isPlayingTts ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {directPdfUrl && (
            <a
              href={directPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-white/5 transition-colors"
              title="Open Original PDF in New Tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-black/15 dark:border-white/15 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
            title="Close Reader"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible ArXiv Search Drawer */}
      {showArxivSearchDrawer && (
        <div
          className={`p-4 border-b z-10 ${
            isDark ? 'bg-[#12141c] border-[#242834] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={arxivSearchQuery}
                onChange={(e) => setArxivSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchArxiv();
                }}
                placeholder="Search ArXiv preprints by title, author, topic, or ID (e.g. Attention Is All You Need, DeepSeek-R1, quantum error correction)..."
                className={`flex-1 px-3.5 py-2 rounded-xl border text-xs outline-none ${
                  isDark
                    ? 'bg-[#0b0c10] border-[#282d3a] text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={() => handleSearchArxiv()}
                disabled={isSearchingArxiv || !arxivSearchQuery.trim()}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                  isDark ? 'bg-white text-black hover:bg-neutral-200' : 'bg-slate-900 text-white'
                }`}
              >
                {isSearchingArxiv ? 'Searching...' : 'Search ArXiv'}
              </button>
            </div>

            {arxivResults.length === 0 && !isSearchingArxiv && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-neutral-500">Quick papers:</span>
                {[
                  'Attention Is All You Need',
                  'FlashAttention Fast and Memory-Efficient Exact Attention',
                  'Mamba Linear-Time Sequence Modeling with Selective State Spaces',
                  'LoRA Low-Rank Adaptation of Large Language Models',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setArxivSearchQuery(q);
                      handleSearchArxiv(q);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                      isDark
                        ? 'bg-[#181b24] border-[#282d3a] hover:border-white/30 text-neutral-300'
                        : 'bg-white border-slate-200 hover:border-slate-400 text-slate-700'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {arxivResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pt-1">
                {arxivResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectArxivPaper(p)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#0b0c10] border-[#242834] hover:border-white/40'
                        : 'bg-white border-slate-200 hover:border-slate-900'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-sky-400">
                      arXiv:{p.id} · {p.categories.slice(0, 2).join(', ')}
                    </div>
                    <div className="text-xs font-semibold line-clamp-1 mt-0.5">{p.title}</div>
                    <div className="text-[11px] text-neutral-500 line-clamp-2 mt-1">{p.summary}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Split Reader Workspace */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Pane: PDF Canvas or Clean Readability Layer */}
        <div
          className={`overflow-y-auto scrollbar-thin p-3 sm:p-6 flex flex-col items-center justify-start ${
            isSplitCopilotOpen ? 'lg:col-span-7' : 'lg:col-span-12'
          } ${getBgThemeClass()}`}
        >
          {viewMode === 'pdf' && directPdfUrl ? (
            <div className="w-full h-full rounded-xl overflow-hidden border border-black/15 dark:border-white/15 shadow-xl bg-black">
              <iframe
                src={onlinePdfEmbedUrl}
                title={activePdfName}
                className="w-full h-full min-h-[74vh] border-0 block"
              />
            </div>
          ) : (
            <div className="max-w-3xl w-full mx-auto my-2 p-6 sm:p-8 rounded-2xl border shadow-lg leading-relaxed whitespace-pre-wrap text-sm">
              <div className="font-sans font-bold text-base mb-4 pb-2 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <span>{activePdfName}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setReaderTheme('dark')}
                    className="p-1 rounded hover:bg-white/10"
                    title="Dark"
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaderTheme('sepia')}
                    className="p-1 rounded hover:bg-white/10"
                    title="Sepia"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaderTheme('light')}
                    className="p-1 rounded hover:bg-white/10"
                    title="Light"
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {activeExtractedText || 'Select an ArXiv paper or click one of the AI breakdown actions on the right.'}
            </div>
          )}
        </div>

        {/* Right Pane: Academic Paper AI Deep Reader Co-Pilot */}
        {isSplitCopilotOpen && (
          <div
            className={`lg:col-span-5 border-t lg:border-t-0 lg:border-l flex flex-col h-full overflow-hidden ${
              isDark ? 'bg-[#0c0e13] border-[#22252e] text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div
              className={`px-4 py-3 border-b flex items-center justify-between ${
                isDark ? 'border-[#1e212b]' : 'border-slate-200'
              }`}
            >
              <div className="text-xs font-semibold">
                Paper Deep Reader Co-Pilot
              </div>
              {copilotResponse && (
                <div className="flex items-center gap-2">
                  {onAskZeno && (
                    <button
                      type="button"
                      onClick={() => {
                        onAskZeno(
                          `Continue analyzing "${activePdfName}":\n\n${copilotResponse.slice(0, 1200)}`
                        );
                        onClose();
                      }}
                      className="text-[11px] font-medium underline opacity-80 hover:opacity-100 cursor-pointer"
                    >
                      Send to Main Chat
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(copilotResponse);
                      setCopiedAnalysis(true);
                      setTimeout(() => setCopiedAnalysis(false), 2000);
                    }}
                    className="p-1 rounded hover:bg-white/10 cursor-pointer"
                    title="Copy analysis"
                  >
                    {copiedAnalysis ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Co-Pilot Output Body */}
            <div className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed">
              {isCopilotLoading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-neutral-400">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                  <span>Analyzing paper equations, methodology & contributions...</span>
                </div>
              ) : copilotResponse ? (
                <div className="prose-custom max-w-none text-xs leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {copilotResponse}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="space-y-3 py-4">
                  <p className="text-neutral-500 text-xs">
                    Select a 1-click analysis lens or ask any question about <strong>{activePdfName}</strong>:
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => runPaperDeepBreakdown('math')}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-[#12151e] border-[#242936] hover:border-white/30'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-xs flex items-center gap-2">
                        <Sigma className="w-3.5 h-3.5 text-sky-400" />
                        <span>Explain Math & Formulas</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Step-by-step derivation of core equations, loss functions, and notation.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => runPaperDeepBreakdown('contributions')}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-[#12151e] border-[#242936] hover:border-white/30'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-xs flex items-center gap-2">
                        <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Key Contributions & Benchmarks</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        What is novel compared to prior work and how much it improves SOTA metrics.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => runPaperDeepBreakdown('methodology')}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-[#12151e] border-[#242936] hover:border-white/30'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-xs flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-amber-400" />
                        <span>Methodology & Architecture Breakdown</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        System pipeline, experimental setup, hyperparameters, and failure modes.
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Co-Pilot Question Input */}
            <div
              className={`p-3 border-t flex items-center gap-2 ${
                isDark ? 'bg-[#101218] border-[#1e212b]' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <input
                type="text"
                value={copilotQuestion}
                onChange={(e) => setCopilotQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && copilotQuestion.trim()) {
                    runPaperDeepBreakdown('custom', copilotQuestion);
                    setCopilotQuestion('');
                  }
                }}
                placeholder="Ask about an equation, theorem, or table in this paper..."
                className={`flex-1 px-3 py-2 rounded-lg border text-xs outline-none ${
                  isDark
                    ? 'bg-[#0b0c10] border-[#252934] text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  if (copilotQuestion.trim()) {
                    runPaperDeepBreakdown('custom', copilotQuestion);
                    setCopilotQuestion('');
                  }
                }}
                disabled={isCopilotLoading || !copilotQuestion.trim()}
                className={`p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40 ${
                  isDark ? 'bg-white text-black hover:bg-neutral-200' : 'bg-slate-900 text-white'
                }`}
                title="Ask Co-Pilot"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
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
          <button
            type="button"
            onClick={handleSummarizeSelection}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-[#007aff] hover:text-white transition-colors cursor-pointer text-xs font-medium"
          >
            <span>Summarize</span>
          </button>
          <button
            type="button"
            onClick={handleExplainMeaning}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-[#007aff] hover:text-white transition-colors cursor-pointer text-xs font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Explain Math</span>
          </button>
          <button
            type="button"
            onClick={() => handleTranslateSelection('Telugu')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-[#007aff] hover:text-white transition-colors cursor-pointer text-xs font-medium"
          >
            <Globe className="w-3.5 h-3.5 opacity-80" />
            <span>Translate</span>
          </button>
          <button
            type="button"
            onClick={handleCopySelection}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-xs"
          >
            {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
};
