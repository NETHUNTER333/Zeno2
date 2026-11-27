import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft, BookOpen, List, Search, X, Highlighter, MessageSquare, Trash2,
  ExternalLink, Loader2, Check, Sparkles, FileText, ChevronRight, Type, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../lib/apiBase';

export interface ArxivReaderSection { id: string; title: string; level?: number; paragraphs: string[]; }
export interface ArxivReaderPaper {
  arxivId: string; title: string; subtitle?: string; authors: string[]; published: string;
  primaryCategory: string; pdfUrl: string; absUrl: string; htmlUrl?: string | null;
  sourceKind?: 'arxiv-html' | 'ar5iv-html' | 'arxiv-abstract'; sections: ArxivReaderSection[];
}
export type HighlightTone = 'amber' | 'jade' | 'cobalt' | 'rose';
export interface ReaderHighlight {
  id: string; paperId: string; sectionId: string; sectionTitle: string;
  paragraphIndex: number; quote: string; note: string; tone: HighlightTone; createdAt: number;
}
interface ArxivSearchHit {
  id: string; title: string; summary: string; authors: string[];
  published: string; primaryCategory?: string; pdfUrl: string; absUrl: string;
}
interface PendingSelection {
  sectionId: string; sectionTitle: string; paragraphIndex: number; quote: string;
  tone: HighlightTone; noteDraft: string; editingHighlightId?: string;
}
type PaperTheme = 'paper' | 'white' | 'night';
type ReaderStateMode = 'reading' | 'annotate' | 'toc';

const STORAGE_KEY_HIGHLIGHTS = 'kinich_arxiv_editorial_highlights_en_v1';
const STORAGE_KEY_PREFS = 'kinich_arxiv_editorial_prefs_en_v1';
const DEFAULT_PAPER_ID = '1706.03762';

const FALLBACK_PAPER_EN: ArxivReaderPaper = {
  arxivId: '1706.03762',
  title: 'Attention Is All You Need',
  subtitle: 'Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit et al.',
  authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit', 'Llion Jones', 'Aidan N. Gomez', 'Lukasz Kaiser', 'Illia Polosukhin'],
  published: '2017-06-12', primaryCategory: 'cs.CL',
  pdfUrl: 'https://arxiv.org/pdf/1706.03762.pdf', absUrl: 'https://arxiv.org/abs/1706.03762',
  htmlUrl: 'https://ar5iv.labs.arxiv.org/html/1706.03762', sourceKind: 'ar5iv-html',
  sections: [{
    id: 'sec-abstract', title: 'Abstract', level: 1,
    paragraphs: ['The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.'],
  }],
};

const FEATURED_PAPERS: Array<[string, string, string]> = [
  ['1706.03762', 'Attention Is All You Need', 'Vaswani et al. · cs.CL · 2017'],
  ['2501.12948', 'DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via RL', 'DeepSeek-AI · cs.CL · 2025'],
  ['2001.08361', 'Scaling Laws for Neural Language Models', 'Kaplan et al. · cs.LG · 2020'],
  ['2201.11903', 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models', 'Wei et al. · cs.CL · 2022'],
];

const TONE_STYLES: Record<HighlightTone, { label: string; swatch: string; markLight: string; markNight: string; borderLight: string; borderNight: string }> = {
  amber: { label: 'Amber', swatch: 'bg-[#EAB308]', markLight: 'bg-[#FEF08A]/75 text-[#292524]', markNight: 'bg-[#CA8A04]/35 text-[#FEF9C3]', borderLight: 'border-[#E5D399] bg-[#FBF6E3]', borderNight: 'border-[#713F12]/60 bg-[#272011]' },
  jade: { label: 'Jade', swatch: 'bg-[#10B981]', markLight: 'bg-[#A7F3D0]/65 text-[#1C1917]', markNight: 'bg-[#059669]/30 text-[#D1FAE5]', borderLight: 'border-[#A7DFC7] bg-[#ECF8F2]', borderNight: 'border-[#065F46]/60 bg-[#10241D]' },
  cobalt: { label: 'Cobalt', swatch: 'bg-[#3B82F6]', markLight: 'bg-[#BFDBFE]/70 text-[#1C1917]', markNight: 'bg-[#2563EB]/30 text-[#DBEAFE]', borderLight: 'border-[#B8D4F7] bg-[#EFF5FD]', borderNight: 'border-[#1E40AF]/60 bg-[#121D2E]' },
  rose: { label: 'Rose', swatch: 'bg-[#F43F5E]', markLight: 'bg-[#FECDD3]/70 text-[#1C1917]', markNight: 'bg-[#E11D48]/30 text-[#FFE4E6]', borderLight: 'border-[#F2BDC5] bg-[#FDF1F3]', borderNight: 'border-[#9F1239]/60 bg-[#2A1319]' },
};

const readSavedPrefs = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_PREFS) || '{}'); } catch { return {}; }
};

export const ArxivEditorialReader: React.FC<{
  initialPaperId?: string | null; isDark?: boolean; onBack: () => void;
  onAskTutor?: (prompt: string, topicOverride?: string) => void;
}> = ({ initialPaperId, isDark = false, onBack, onAskTutor }) => {
  const initPrefs = useMemo(readSavedPrefs, []);
  const [paper, setPaper] = useState<ArxivReaderPaper>(FALLBACK_PAPER_EN);
  const [loadingPaper, setLoadingPaper] = useState(true);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [paperTheme, setPaperTheme] = useState<PaperTheme>(() =>
    ['paper', 'white', 'night'].includes(initPrefs.paperTheme) ? initPrefs.paperTheme : isDark ? 'night' : 'paper'
  );
  const [fontSize, setFontSize] = useState<number>(() => (typeof initPrefs.fontSize === 'number' ? initPrefs.fontSize : 17));
  const [lineHeight, setLineHeight] = useState<number>(() => (typeof initPrefs.lineHeight === 'number' ? initPrefs.lineHeight : 1.78));
  const [paragraphGap, setParagraphGap] = useState<number>(() => (typeof initPrefs.paragraphGap === 'number' ? initPrefs.paragraphGap : 1.35));
  const [fontStyle, setFontStyle] = useState<'serif' | 'sans'>('serif');

  const [tocOpen, setTocOpen] = useState(false);
  const [tocTab, setTocTab] = useState<'contents' | 'notes'>('contents');
  const [typoOpen, setTypoOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<ArxivSearchHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [highlights, setHighlights] = useState<ReaderHighlight[]>(() => {
    try { const p = JSON.parse(localStorage.getItem(STORAGE_KEY_HIGHLIGHTS) || '[]'); return Array.isArray(p) ? p : []; } catch { return []; }
  });
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState('sec-abstract');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify({ paperTheme, fontSize, lineHeight, paragraphGap })); } catch {} }, [paperTheme, fontSize, lineHeight, paragraphGap]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY_HIGHLIGHTS, JSON.stringify(highlights)); } catch {} }, [highlights]);

  const loadArxivPaper = useCallback(async (arxivIdOrUrl: string) => {
    const cleanedId = arxivIdOrUrl.trim().replace(/^https?:\/\/(?:ar5iv\.labs\.)?arxiv\.org\/(?:abs|pdf|html)\//i, '').replace(/\.pdf$/i, '').replace(/v\d+$/i, '');
    if (!cleanedId) return;
    setLoadingPaper(true); setPaperError(null); setLibraryOpen(false); setPendingSelection(null);
    try {
      const resp = await apiFetch('/api/arxiv/article', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ arxivId: cleanedId, language: 'en' }) });
      const data = await resp.json();
      if (!resp.ok || !data?.ok || !data?.paper) throw new Error(data?.error || 'Could not load arXiv paper.');
      const r = data.paper;
      const norm: ArxivReaderPaper = {
        arxivId: String(r.arxivId || r.id || cleanedId),
        title: String(r.title || cleanedId),
        subtitle: r.subtitle || undefined,
        authors: Array.isArray(r.authors) ? r.authors : [],
        published: r.published ? String(r.published).slice(0, 10) : '',
        primaryCategory: r.primaryCategory || (Array.isArray(r.categories) && r.categories[0]) || 'arXiv',
        pdfUrl: r.pdfUrl || `https://arxiv.org/pdf/${cleanedId}.pdf`,
        absUrl: r.absUrl || `https://arxiv.org/abs/${cleanedId}`,
        htmlUrl: r.htmlUrl || null,
        sourceKind: r.sourceKind || 'arxiv-html',
        sections: Array.isArray(r.sections) ? r.sections : [],
      };
      setPaper(norm);
      setActiveSectionId(norm.sections[0]?.id || 'sec-abstract');
      setScrollProgress(0);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setPaperError(err?.message || 'Unable to fetch full arXiv paper right now.');
    } finally { setLoadingPaper(false); }
  }, []);

  useEffect(() => { loadArxivPaper(initialPaperId?.trim() || DEFAULT_PAPER_ID); }, [initialPaperId, loadArxivPaper]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
    setScrollProgress(Math.min(100, Math.max(0, Math.round((el.scrollTop / maxScroll) * 100))));
    const top = el.getBoundingClientRect().top;
    let currentId = paper.sections[0]?.id || '';
    for (const sec of paper.sections) {
      const node = sectionRefs.current[sec.id];
      if (node && node.getBoundingClientRect().top - top <= 150) currentId = sec.id;
    }
    if (currentId) setActiveSectionId(currentId);
  }, [paper.sections]);

  const readingStats = useMemo(() => {
    const wordCount = paper.sections.flatMap((s) => s.paragraphs).join(' ').split(/\s+/).filter(Boolean).length;
    const totalMinutes = Math.max(2, Math.round(wordCount / 210));
    return { totalMinutes, remainingMinutes: Math.max(1, Math.ceil(totalMinutes * (1 - scrollProgress / 100))), wordCount };
  }, [paper, scrollProgress]);

  const paperHighlights = useMemo(() => highlights.filter((h) => h.paperId === paper.arxivId), [highlights, paper.arxivId]);
  const activeSectionTitle = useMemo(() => paper.sections.find((s) => s.id === activeSectionId)?.title || paper.sections[0]?.title || '', [paper.sections, activeSectionId]);

  const startAnnotate = (sectionId: string, sectionTitle: string, paragraphIndex: number, quote: string) => {
    setTypoOpen(false); setTocOpen(false);
    setPendingSelection({ sectionId, sectionTitle, paragraphIndex, quote, tone: 'amber', noteDraft: '' });
    setTimeout(() => noteInputRef.current?.focus(), 60);
  };

  const handleParagraphSelection = (sectionId: string, sectionTitle: string, paragraphIndex: number, text: string) => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection()?.toString().trim() || '';
    if (sel.length >= 4 && text.includes(sel)) startAnnotate(sectionId, sectionTitle, paragraphIndex, sel.slice(0, 260));
  };

  const openQuickParagraphAnnotate = (sectionId: string, sectionTitle: string, paragraphIndex: number, text: string) => {
    const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 16);
    startAnnotate(sectionId, sectionTitle, paragraphIndex, (sentences[0] || text.slice(0, 140)).slice(0, 240));
  };

  const currentReaderState: ReaderStateMode = tocOpen ? 'toc' : pendingSelection ? 'annotate' : 'reading';
  const switchReaderState = (next: ReaderStateMode) => {
    setTypoOpen(false); setLibraryOpen(false);
    if (next === 'reading') { setTocOpen(false); setPendingSelection(null); return; }
    if (next === 'toc') { setPendingSelection(null); setTocTab('contents'); setTocOpen(true); return; }
    setTocOpen(false);
    const targetSec = paper.sections.find((s) => s.id === activeSectionId) || paper.sections[0];
    if (targetSec?.paragraphs[0]) openQuickParagraphAnnotate(targetSec.id, targetSec.title, 0, targetSec.paragraphs[0]);
  };

  const handleSaveHighlight = () => {
    if (!pendingSelection?.quote.trim()) return;
    if (pendingSelection.editingHighlightId) {
      setHighlights((prev) => prev.map((h) => h.id === pendingSelection.editingHighlightId ? { ...h, tone: pendingSelection.tone, note: pendingSelection.noteDraft.trim() } : h));
      setActiveNoteId(pendingSelection.editingHighlightId);
    } else {
      const created: ReaderHighlight = {
        id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        paperId: paper.arxivId, sectionId: pendingSelection.sectionId, sectionTitle: pendingSelection.sectionTitle,
        paragraphIndex: pendingSelection.paragraphIndex, quote: pendingSelection.quote.trim(),
        note: pendingSelection.noteDraft.trim(), tone: pendingSelection.tone, createdAt: Date.now(),
      };
      setHighlights((prev) => [created, ...prev]);
      setActiveNoteId(created.id);
    }
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleDeleteHighlight = (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    if (activeNoteId === id) setActiveNoteId(null);
  };

  const jumpToSection = (sectionId: string) => {
    setTocOpen(false);
    const node = sectionRefs.current[sectionId];
    if (node) { node.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActiveSectionId(sectionId); }
  };

  const handleArxivSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    if (/^(?:https?:\/\/(?:ar5iv\.labs\.)?arxiv\.org\/(?:abs|pdf|html)\/)?[0-9]{4}\.[0-9]{4,5}/i.test(q)) { loadArxivPaper(q); return; }
    setSearching(true); setSearchError(null);
    try {
      const resp = await apiFetch('/api/arxiv/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, maxResults: 10 }) });
      const data = await resp.json();
      if (!resp.ok || !Array.isArray(data?.papers)) throw new Error(data?.error || 'Search failed');
      setSearchHits(data.papers);
      if (!data.papers.length) setSearchError('No matching arXiv papers found. Try another keyword or paste an arXiv ID.');
    } catch (err: any) {
      setSearchError(err?.message || 'Unable to search arXiv right now.');
    } finally { setSearching(false); }
  };

  const renderHighlightedParagraph = (text: string, sectionId: string, paragraphIndex: number) => {
    const matching = paperHighlights.filter((h) => h.sectionId === sectionId && h.paragraphIndex === paragraphIndex);
    const activePending = pendingSelection?.sectionId === sectionId && pendingSelection.paragraphIndex === paragraphIndex ? pendingSelection : null;
    if (!matching.length && !activePending) return text;
    type Seg = { start: number; end: number; tone: HighlightTone; highlight?: ReaderHighlight; isPending?: boolean };
    const ranges: Seg[] = [];
    for (const hl of matching) { const idx = text.indexOf(hl.quote); if (idx !== -1) ranges.push({ start: idx, end: idx + hl.quote.length, tone: hl.tone, highlight: hl }); }
    if (activePending) { const idx = text.indexOf(activePending.quote); if (idx !== -1) ranges.push({ start: idx, end: idx + activePending.quote.length, tone: activePending.tone, isPending: true }); }
    if (!ranges.length) return text;
    ranges.sort((a, b) => a.start - b.start);
    const clean: Seg[] = [];
    let cursor = 0;
    for (const r of ranges) if (r.start >= cursor) { clean.push(r); cursor = r.end; }
    const nodes: React.ReactNode[] = [];
    let pos = 0;
    clean.forEach((seg, i) => {
      if (seg.start > pos) nodes.push(<React.Fragment key={`t-${i}`}>{text.slice(pos, seg.start)}</React.Fragment>);
      const tc = TONE_STYLES[seg.tone];
      nodes.push(
        <mark key={`m-${i}`} onClick={(e) => { if (!seg.highlight) return; e.stopPropagation(); setActiveNoteId((p) => (p === seg.highlight!.id ? null : seg.highlight!.id)); }} className={`rounded-[3px] px-0.5 py-[1px] transition-colors cursor-pointer ${paperTheme === 'night' ? tc.markNight : tc.markLight} ${seg.isPending ? 'ring-1 ring-current/40' : ''}`}>
          {text.slice(seg.start, seg.end)}
          {seg.highlight?.note && <sup className="ml-0.5 text-[9px] font-sans font-semibold opacity-75 select-none">*</sup>}
        </mark>
      );
      pos = seg.end;
    });
    if (pos < text.length) nodes.push(<React.Fragment key="t-end">{text.slice(pos)}</React.Fragment>);
    return nodes;
  };

  const isNight = paperTheme === 'night';
  const canvasBg = isNight ? 'bg-[#09090B]' : paperTheme === 'paper' ? 'bg-[#E9E6DF]' : 'bg-[#F0F0EE]';
  const sheetBg = isNight ? 'bg-[#121215] text-[#E6E3DC] border-white/[0.08]' : paperTheme === 'paper' ? 'bg-[#FBF9F5] text-[#221F1D] border-[#E4DDD1]' : 'bg-white text-[#1A1A1A] border-black/[0.08]';
  const subtleBorder = isNight ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const mutedText = isNight ? 'text-[#9A958C]' : 'text-[#6E675F]';
  const surfaceControl = isNight ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.1] text-[#E6E3DC]' : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.09] text-[#292524]';
  const pillActive = isNight ? 'bg-[#E6E3DC] text-[#121215]' : 'bg-[#1C1917] text-[#FBF9F5]';
  const drawerCls = isNight ? 'bg-[#151519] border-white/[0.1] text-[#E6E3DC]' : 'bg-[#FAF7F1] border-[#E3DCCE] text-[#1C1917]';
  const bodyFontFamily = fontStyle === 'serif' ? '"Source Serif 4", Georgia, "Times New Roman", serif' : '"Plus Jakarta Sans", "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  const sourceLabel = paper.sourceKind === 'arxiv-html' ? 'Full HTML (arXiv)' : paper.sourceKind === 'ar5iv-html' ? 'Full HTML (ar5iv)' : 'Abstract Only';

  const typoSliders: Array<[string, string, number, number, number, number, (v: number) => void]> = [
    ['Font Size', `${fontSize}px`, 15, 22, 1, fontSize, setFontSize],
    ['Line Height', lineHeight.toFixed(2), 1.55, 2.15, 0.05, lineHeight, setLineHeight],
    ['Paragraph Gap', `${paragraphGap.toFixed(2)}em`, 1.0, 1.9, 0.1, paragraphGap, setParagraphGap],
  ];

  return (
    <div className={`h-full w-full flex flex-col overflow-hidden transition-colors duration-200 ${canvasBg}`}>
      <div className={`shrink-0 h-12 px-3 sm:px-5 flex items-center justify-between gap-2 border-b backdrop-blur-md z-30 ${isNight ? 'bg-[#0E0E11]/90 border-white/[0.07] text-[#E6E3DC]' : 'bg-white/75 border-black/[0.07] text-[#1C1917]'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={onBack} className={`h-8 px-3 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap ${surfaceControl}`}>
            <ArrowLeft className="w-3 h-3" /><span>Study Space</span>
          </button>
          <span className={`hidden sm:inline text-[11px] font-mono tabular-nums truncate ${mutedText}`}>arXiv:{paper.arxivId}</span>
        </div>

        <div className={`flex items-center p-0.5 rounded-full border ${isNight ? 'bg-white/[0.04] border-white/[0.09]' : 'bg-black/[0.04] border-black/[0.08]'}`} role="tablist" aria-label="Reader View State">
          {([['reading', 'Read'], ['annotate', 'Annotate'], ['toc', 'Contents']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={currentReaderState === id} onClick={() => switchReaderState(id)} className={`h-7 px-3 rounded-full text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${currentReaderState === id ? pillActive : mutedText}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => { setTypoOpen(false); setLibraryOpen((v) => !v); }} className={`h-8 px-2.5 sm:px-3 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${surfaceControl}`} title="Search arXiv papers or paste an arXiv ID">
            <Search className="w-3 h-3" /><span className="hidden sm:inline">Search arXiv</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center md:p-5 lg:p-7 overflow-hidden">
        <div className={`relative w-full h-full md:max-w-[780px] lg:max-w-[820px] md:max-h-[1080px] flex flex-col md:rounded-[28px] md:border md:shadow-[0_24px_70px_-24px_rgba(0,0,0,0.22)] overflow-hidden transition-colors duration-200 ${sheetBg}`}>
          <div className={`h-[2px] w-full shrink-0 ${isNight ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`}>
            <div className={`h-full transition-[width] duration-150 ${isNight ? 'bg-[#D6B98C]' : 'bg-[#8C5A3C]'}`} style={{ width: `${scrollProgress}%` }} />
          </div>

          <div className={`shrink-0 h-12 px-4 sm:px-8 flex items-center justify-between gap-3 border-b ${subtleBorder} relative z-20`}>
            <div className="flex items-center gap-2 min-w-0">
              <button type="button" onClick={() => { setTypoOpen(false); setTocOpen((v) => !v); }} className={`size-8 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer shrink-0 ${tocOpen ? (isNight ? 'bg-white text-black' : 'bg-[#1C1917] text-white') : isNight ? 'hover:bg-white/[0.08] text-[#D6D1C7]' : 'hover:bg-black/[0.05] text-[#44403C]'}`} title="Table of Contents & Notes" aria-label="Open Table of Contents">
                <List className="w-4 h-4" />
              </button>
              <span className={`text-[11px] truncate ${mutedText}`}>{paper.title}</span>
            </div>

            <div className="flex items-center gap-1 shrink-0 relative">
              <button type="button" onClick={() => { setTypoOpen(false); setTocTab('notes'); setTocOpen(true); }} className={`h-8 px-2.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${isNight ? 'hover:bg-white/[0.08] text-[#C8C2B8]' : 'hover:bg-black/[0.05] text-[#57534E]'}`} title="View saved highlights & annotations">
                <Highlighter className="w-3.5 h-3.5" /><span className="font-mono tabular-nums">{paperHighlights.length}</span>
              </button>
              <button type="button" onClick={() => { setTocOpen(false); setTypoOpen((v) => !v); }} className={`h-8 px-2.5 rounded-full text-[12px] font-serif font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${typoOpen ? (isNight ? 'bg-white text-black' : 'bg-[#1C1917] text-white') : isNight ? 'hover:bg-white/[0.08] text-[#E6E3DC]' : 'hover:bg-black/[0.05] text-[#292524]'}`} title="Typography settings">
                <Type className="w-3.5 h-3.5" /><span>Aa</span>
              </button>
              <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer" className={`size-8 rounded-full inline-flex items-center justify-center transition-colors ${isNight ? 'hover:bg-white/[0.08] text-[#A8A29E]' : 'hover:bg-black/[0.05] text-[#57534E]'}`} title="Open original arXiv PDF">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {typoOpen && (
                <div className={`absolute right-0 top-full mt-2 w-72 rounded-3xl border p-4 shadow-2xl z-40 space-y-3.5 ${isNight ? 'bg-[#18181C] border-white/[0.12] text-[#E6E3DC]' : 'bg-[#FFFEFC] border-black/[0.1] text-[#1C1917]'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Reading Typography</span>
                    <button type="button" onClick={() => setTypoOpen(false)} className={`size-6 rounded-full inline-flex items-center justify-center cursor-pointer ${mutedText}`}><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([['paper', 'Paper', 'bg-[#FBF9F5] text-[#221F1D] border-[#DDD4C5]'], ['white', 'White', 'bg-white text-[#1A1A1A] border-black/15'], ['night', 'Night', 'bg-[#121215] text-[#E6E3DC] border-white/15']] as const).map(([id, label, bg]) => (
                      <button key={id} type="button" onClick={() => setPaperTheme(id)} className={`h-8 rounded-full border text-[11px] font-medium cursor-pointer transition-all ${bg} ${paperTheme === id ? 'ring-2 ring-[#8C5A3C] ring-offset-1 ring-offset-transparent' : ''}`}>{label}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([['serif', 'Book Serif', 'font-serif'], ['sans', 'Clean Sans', 'font-sans']] as const).map(([id, label, cls]) => (
                      <button key={id} type="button" onClick={() => setFontStyle(id)} className={`h-8 rounded-full border text-[11px] cursor-pointer ${cls} ${fontStyle === id ? (isNight ? 'bg-white text-black border-white' : 'bg-[#1C1917] text-white border-[#1C1917]') : subtleBorder}`}>{label}</button>
                    ))}
                  </div>
                  {typoSliders.map(([label, display, min, max, step, val, setVal]) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={mutedText}>{label}</span><span className="font-mono tabular-nums">{display}</span>
                      </div>
                      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => setVal(Number(e.target.value))} className="w-full accent-[#8C5A3C] cursor-pointer" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-12 md:px-16 py-8 sm:py-11 scroll-smooth">
            {loadingPaper ? (
              <div className="h-full min-h-[360px] flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="w-6 h-6 animate-spin opacity-60" />
                <div className="text-sm font-medium">Fetching full arXiv paper HTML…</div>
                <div className={`text-xs ${mutedText}`}>Loading all sections and paragraphs from arXiv / ar5iv</div>
              </div>
            ) : (
              <article className="max-w-[630px] mx-auto pb-16">
                {paperError && (
                  <div className={`mb-6 px-4 py-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${isNight ? 'bg-red-950/30 border-red-800/40 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <span>{paperError}</span>
                    <button type="button" onClick={() => loadArxivPaper(paper.arxivId)} className="underline shrink-0 cursor-pointer inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /><span>Retry</span></button>
                  </div>
                )}

                <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-wide ${mutedText}`}>
                  <span className="font-mono tabular-nums">arXiv:{paper.arxivId}</span><span aria-hidden="true">·</span>
                  <span>{paper.primaryCategory}</span>
                  {paper.published && <><span aria-hidden="true">·</span><span className="font-mono tabular-nums">{paper.published}</span></>}
                  <span aria-hidden="true">·</span><span>{sourceLabel}</span><span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{paper.sections.length} sections · {readingStats.totalMinutes} min read</span>
                </div>

                <h1 style={{ fontFamily: bodyFontFamily, textWrap: 'balance' }} className="mt-3.5 text-[24px] sm:text-[30px] font-semibold leading-[1.28] tracking-[-0.01em]">{paper.title}</h1>
                {paper.authors.length > 0 && (
                  <p className={`mt-3 text-xs leading-relaxed ${mutedText}`}>
                    {paper.authors.slice(0, 8).join(', ')}{paper.authors.length > 8 ? ` +${paper.authors.length - 8} more` : ''}
                  </p>
                )}

                <hr className={`my-7 border-0 border-t ${subtleBorder}`} />
                <div className={`mb-7 text-[11px] flex items-center justify-between gap-2 ${mutedText}`}>
                  <span>Select any passage to highlight and write a note, or tap Annotate below any paragraph.</span>
                </div>

                <div className="space-y-9">
                  {paper.sections.map((section) => (
                    <section key={section.id} ref={(el) => { sectionRefs.current[section.id] = el; }} className="scroll-mt-8">
                      <h2 style={{ fontFamily: bodyFontFamily }} className={section.level === 2 ? 'text-[16px] sm:text-[17px] font-semibold leading-[1.4] mb-3 opacity-90' : section.level === 3 ? 'text-[15px] font-semibold leading-[1.4] mb-2.5 opacity-85' : 'text-[18px] sm:text-[20px] font-semibold leading-[1.35] mb-4'}>
                        {section.title}
                      </h2>
                      <div>
                        {section.paragraphs.map((para, pIdx) => {
                          const paraHighlights = paperHighlights.filter((h) => h.sectionId === section.id && h.paragraphIndex === pIdx);
                          const isPendingHere = pendingSelection?.sectionId === section.id && pendingSelection.paragraphIndex === pIdx;
                          return (
                            <div key={`${section.id}-p-${pIdx}`} style={{ marginBottom: `${paragraphGap}em` }} className="group relative">
                              <p onMouseUp={() => handleParagraphSelection(section.id, section.title, pIdx, para)} onTouchEnd={() => handleParagraphSelection(section.id, section.title, pIdx, para)} style={{ fontFamily: bodyFontFamily, fontSize: `${fontSize}px`, lineHeight }} className="selection:bg-[#FEF08A] selection:text-[#1C1917]">
                                {renderHighlightedParagraph(para, section.id, pIdx)}
                              </p>
                              <div className="mt-1 flex items-center justify-end gap-3 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <button type="button" onClick={() => openQuickParagraphAnnotate(section.id, section.title, pIdx, para)} className={`text-[11px] inline-flex items-center gap-1 cursor-pointer ${mutedText} hover:opacity-100`}><Highlighter className="w-3 h-3" /><span>Annotate</span></button>
                                {onAskTutor && (
                                  <button type="button" onClick={() => onAskTutor(`Explain this passage from arXiv:${paper.arxivId} ("${paper.title}"):\n\n"${para}"`, paper.title.slice(0, 64))} className={`text-[11px] inline-flex items-center gap-1 cursor-pointer ${mutedText} hover:opacity-100`}>
                                    <MessageSquare className="w-3 h-3" /><span>Ask Tutor</span>
                                  </button>
                                )}
                              </div>

                              {isPendingHere && pendingSelection && (
                                <div className={`mt-3 rounded-3xl border p-4 shadow-lg transition-all ${isNight ? 'bg-[#19191E] border-white/[0.12]' : 'bg-[#FFFEFC] border-[#DDD5C7]'}`}>
                                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-current/10">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[11px] font-medium ${mutedText}`}>Highlight</span>
                                      <div className="flex items-center gap-1.5">
                                        {(Object.keys(TONE_STYLES) as HighlightTone[]).map((k) => (
                                          <button key={k} type="button" onClick={() => setPendingSelection((p) => (p ? { ...p, tone: k } : null))} title={TONE_STYLES[k].label} aria-label={TONE_STYLES[k].label} className={`size-5 rounded-full ${TONE_STYLES[k].swatch} cursor-pointer transition-transform ${pendingSelection.tone === k ? 'scale-110 ring-2 ring-offset-2 ring-current/40 ring-offset-transparent' : 'opacity-70 hover:opacity-100'}`} />
                                        ))}
                                      </div>
                                    </div>
                                    <button type="button" onClick={() => setPendingSelection(null)} className={`size-6 rounded-full inline-flex items-center justify-center cursor-pointer ${mutedText}`} aria-label="Cancel annotation"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                  <div style={{ fontFamily: bodyFontFamily }} className={`mt-2.5 text-xs leading-relaxed line-clamp-2 italic ${mutedText}`}>“{pendingSelection.quote}”</div>
                                  <textarea ref={noteInputRef} rows={2} value={pendingSelection.noteDraft} onChange={(e) => setPendingSelection((p) => (p ? { ...p, noteDraft: e.target.value } : null))} placeholder="Write a short annotation, intuition, or question… (optional)" className={`mt-2.5 w-full rounded-2xl border px-3 py-2 text-xs leading-relaxed outline-none resize-none ${isNight ? 'bg-black/30 border-white/[0.1] text-[#E6E3DC] placeholder:text-neutral-500 focus:border-white/30' : 'bg-[#F8F5EE] border-black/[0.08] text-[#1C1917] placeholder:text-[#8A8277] focus:border-[#8C5A3C]/50'}`} />
                                  <div className="mt-3 flex items-center justify-between gap-2">
                                    {onAskTutor ? (
                                      <button type="button" onClick={() => onAskTutor(`Explain this highlighted excerpt from arXiv:${paper.arxivId}:\n"${pendingSelection.quote}"${pendingSelection.noteDraft.trim() ? `\nMy note/question: ${pendingSelection.noteDraft.trim()}` : ''}`, paper.title.slice(0, 64))} className={`h-8 px-3 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer ${surfaceControl}`}>
                                        <Sparkles className="w-3 h-3" /><span>Ask Tutor</span>
                                      </button>
                                    ) : <span />}
                                    <div className="flex items-center gap-1.5">
                                      <button type="button" onClick={() => setPendingSelection(null)} className={`h-8 px-3 rounded-full text-[11px] cursor-pointer ${mutedText}`}>Cancel</button>
                                      <button type="button" onClick={handleSaveHighlight} className={`h-8 px-4 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${isNight ? 'bg-[#E6E3DC] text-[#121215] hover:bg-white' : 'bg-[#1C1917] text-[#FBF9F5] hover:bg-black'}`}>
                                        <Check className="w-3 h-3" /><span>Save Note</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {paraHighlights.filter((hl) => hl.note || activeNoteId === hl.id).map((hl) => (
                                <div key={hl.id} className={`mt-2.5 rounded-2xl border px-3.5 py-2.5 text-xs transition-colors ${isNight ? TONE_STYLES[hl.tone].borderNight : TONE_STYLES[hl.tone].borderLight}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className={`text-[10px] font-medium ${mutedText}`}>Note · {TONE_STYLES[hl.tone].label} Highlight</div>
                                      {hl.note ? <p className="text-[12px] leading-[1.65] whitespace-pre-wrap">{hl.note}</p> : <p className={`text-[11px] italic ${mutedText}`}>Saved highlight (tap Edit to add a note)</p>}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button type="button" onClick={() => setPendingSelection({ sectionId: hl.sectionId, sectionTitle: hl.sectionTitle, paragraphIndex: hl.paragraphIndex, quote: hl.quote, tone: hl.tone, noteDraft: hl.note, editingHighlightId: hl.id })} className={`px-2 py-1 rounded-full text-[10px] cursor-pointer ${mutedText} hover:opacity-100`}>Edit</button>
                                      <button type="button" onClick={() => handleDeleteHighlight(hl.id)} className={`size-6 rounded-full inline-flex items-center justify-center cursor-pointer ${mutedText} hover:text-red-500`} aria-label="Delete highlight"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </article>
            )}
          </div>

          <div className={`shrink-0 h-11 px-5 sm:px-8 border-t flex items-center justify-between gap-3 text-[11px] ${subtleBorder} ${mutedText}`}>
            <button type="button" onClick={() => { setTocTab('contents'); setTocOpen(true); }} className="truncate text-left hover:opacity-100 cursor-pointer flex items-center gap-1.5 min-w-0">
              <BookOpen className="w-3 h-3 shrink-0 opacity-70" /><span className="truncate">{activeSectionTitle}</span>
            </button>
            <div className="flex items-center gap-2.5 shrink-0 font-mono tabular-nums">
              <span>{readingStats.remainingMinutes} min left</span><span aria-hidden="true">·</span><span>{scrollProgress}%</span>
            </div>
          </div>

          {tocOpen && (
            <div className="absolute inset-0 z-30 flex">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={() => setTocOpen(false)} aria-hidden="true" />
              <aside className={`relative z-10 w-[84%] max-w-[340px] h-full flex flex-col border-r shadow-2xl ${drawerCls}`}>
                <div className={`px-4 pt-4 pb-3 border-b ${subtleBorder} space-y-3`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{paper.title}</div>
                      <div className={`text-[10px] font-mono tabular-nums mt-0.5 ${mutedText}`}>arXiv:{paper.arxivId} · {scrollProgress}% read</div>
                    </div>
                    <button type="button" onClick={() => setTocOpen(false)} className={`size-8 rounded-full inline-flex items-center justify-center cursor-pointer shrink-0 ${mutedText}`} aria-label="Close Table of Contents"><X className="w-4 h-4" /></button>
                  </div>
                  <div className={`grid grid-cols-2 p-0.5 rounded-full border ${isNight ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-black/[0.04] border-black/[0.08]'}`}>
                    {([['contents', `Contents (${paper.sections.length})`], ['notes', `Notes (${paperHighlights.length})`]] as const).map(([id, label]) => (
                      <button key={id} type="button" onClick={() => setTocTab(id)} className={`h-7 rounded-full text-[11px] font-medium cursor-pointer transition-colors ${tocTab === id ? pillActive : mutedText}`}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
                  {tocTab === 'contents' ? paper.sections.map((sec, idx) => {
                    const isCurrent = sec.id === activeSectionId;
                    const noteCount = paperHighlights.filter((h) => h.sectionId === sec.id).length;
                    return (
                      <button key={sec.id} type="button" onClick={() => jumpToSection(sec.id)} className={`w-full pr-3 py-2 rounded-2xl text-left flex items-start justify-between gap-2 transition-colors cursor-pointer ${sec.level === 2 ? 'pl-6' : sec.level === 3 ? 'pl-9' : 'pl-3'} ${isCurrent ? (isNight ? 'bg-white/[0.09] text-white' : 'bg-[#EFE9DC] text-[#1C1917]') : isNight ? 'hover:bg-white/[0.05] text-[#C8C2B8]' : 'hover:bg-black/[0.04] text-[#44403C]'}`}>
                        <div className="min-w-0 flex-1">
                          <div style={{ fontFamily: bodyFontFamily }} className={`text-[12.5px] leading-snug ${isCurrent ? 'font-semibold' : 'font-normal'}`}>{sec.title}</div>
                          <div className={`text-[10px] font-mono tabular-nums mt-0.5 ${mutedText}`}>{String(idx + 1).padStart(2, '0')} · {sec.paragraphs.length} para{noteCount > 0 ? ` · ${noteCount} note${noteCount > 1 ? 's' : ''}` : ''}</div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-40" />
                      </button>
                    );
                  }) : !paperHighlights.length ? (
                    <div className={`py-10 px-4 text-center text-xs space-y-2 ${mutedText}`}>
                      <Highlighter className="w-5 h-5 mx-auto opacity-50" />
                      <p>No highlights or annotations yet.</p>
                      <p className="text-[11px] opacity-80">Select any sentence in the paper to highlight and add a note.</p>
                    </div>
                  ) : paperHighlights.map((hl) => (
                    <div key={hl.id} className={`p-3 rounded-2xl border space-y-1.5 ${isNight ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white/80 border-black/[0.07]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => jumpToSection(hl.sectionId)} className={`text-[10px] truncate cursor-pointer hover:underline ${mutedText}`}>{hl.sectionTitle}</button>
                        <button type="button" onClick={() => handleDeleteHighlight(hl.id)} className={`size-6 rounded-full inline-flex items-center justify-center cursor-pointer ${mutedText} hover:text-red-500`} aria-label="Delete note"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <button type="button" onClick={() => jumpToSection(hl.sectionId)} style={{ fontFamily: bodyFontFamily }} className="text-left text-xs leading-relaxed line-clamp-3 cursor-pointer italic">“{hl.quote}”</button>
                      {hl.note && <div className={`pt-1.5 border-t text-[11px] leading-relaxed ${subtleBorder} ${mutedText}`}>{hl.note}</div>}
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          )}

          {libraryOpen && (
            <div className="absolute inset-0 z-30 flex justify-end">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={() => setLibraryOpen(false)} aria-hidden="true" />
              <aside className={`relative z-10 w-[88%] max-w-[380px] h-full flex flex-col border-l shadow-2xl ${drawerCls}`}>
                <div className={`px-4 py-3.5 border-b flex items-center justify-between ${subtleBorder}`}>
                  <div><div className="text-xs font-semibold">Search arXiv Papers</div><div className={`text-[10px] ${mutedText}`}>Search by topic or paste any arXiv ID / URL</div></div>
                  <button type="button" onClick={() => setLibraryOpen(false)} className={`size-8 rounded-full inline-flex items-center justify-center cursor-pointer ${mutedText}`}><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleArxivSearch} className={`p-3 border-b ${subtleBorder}`}>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isNight ? 'bg-black/30 border-white/[0.12]' : 'bg-white border-black/[0.1]'}`}>
                    <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="e.g. 2501.12948 or diffusion transformers" className="w-full bg-transparent text-xs outline-none" />
                    <button type="submit" disabled={searching || !searchQuery.trim()} className={`h-7 px-3 rounded-full text-[11px] font-medium shrink-0 cursor-pointer disabled:opacity-40 ${isNight ? 'bg-white text-black' : 'bg-[#1C1917] text-white'}`}>{searching ? '...' : 'Open'}</button>
                  </div>
                  {searchError && <p className="mt-2 text-[11px] text-red-500 px-1">{searchError}</p>}
                </form>
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
                  {searchHits.length > 0 && (
                    <div className="space-y-1.5">
                      <div className={`px-1 text-[10px] font-semibold ${mutedText}`}>Search Results · {searchHits.length}</div>
                      {searchHits.map((hit) => (
                        <button key={hit.id} type="button" onClick={() => loadArxivPaper(hit.id)} className={`w-full p-3 rounded-2xl border text-left transition-colors cursor-pointer ${isNight ? 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08]' : 'bg-white/80 hover:bg-white border-black/[0.07]'}`}>
                          <div className="text-xs font-medium leading-snug line-clamp-2">{hit.title}</div>
                          <div className={`mt-1 text-[10px] font-mono tabular-nums ${mutedText}`}>arXiv:{hit.id} · {hit.published?.slice(0, 10)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className={`px-1 text-[10px] font-semibold ${mutedText}`}>Landmark Papers</div>
                    {FEATURED_PAPERS.map(([id, title, meta]) => (
                      <button key={id} type="button" onClick={() => loadArxivPaper(id)} className={`w-full p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-colors cursor-pointer ${paper.arxivId === id ? (isNight ? 'bg-white/[0.1] border-white/25' : 'bg-[#EFE9DC] border-[#D6CBB8]') : isNight ? 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08]' : 'bg-white/75 hover:bg-white border-black/[0.07]'}`}>
                        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium leading-snug">{title}</div>
                          <div className={`mt-1 text-[10px] font-mono tabular-nums ${mutedText}`}>arXiv:{id} · {meta}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
