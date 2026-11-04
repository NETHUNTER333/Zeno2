import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Upload,
  Layers,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Shuffle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ListTree,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { MathMarkdown } from './MathMarkdown';
import { speakTextWithSmallestAi, stopSmallestSpeech } from '../lib/smallestAi';
import { getAuthHeaders } from '../lib/firebase';
import { ArxivPaper } from '../types';
import {
  DocumentStudyBundle,
  extractTextFromPdfFile,
} from '../lib/pdfStudyEngine';

export type PdfStudioTab =
  | 'learn'
  | 'quiz'
  | 'flashcards'
  | 'summary'
  | 'explanation'
  | 'cheatsheet'
  | 'chat';

export interface InbuiltPdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl?: string;
  pdfName?: string;
  title?: string;
  arxivId?: string;
  authors?: string[];
  published?: string;
  summary?: string;
  extractedText?: string;
  initialTab?: PdfStudioTab;
  isDark?: boolean;
  onAskKinich?: (prompt: string) => void;
  enableArxivSearch?: boolean;
}

interface TextSelectionMenu {
  text: string;
  x: number;
  y: number;
}

interface PdfChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const INSTACLOUD_API_BASE = 'https://prod-main-kinich-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';

async function callKinichApi(path: string, init?: RequestInit): Promise<Response> {
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
  pdfName: initialPdfName,
  title: initialTitle,
  arxivId,
  authors,
  published,
  summary: initialSummary,
  extractedText: initialExtractedText = '',
  initialTab = 'quiz',
  isDark = true,
  onAskKinich,
  enableArxivSearch = false,
}) => {
  const resolvedInitialTitle =
    initialPdfName || initialTitle || 'Academic Paper & PDF Study Studio';
  const resolvedInitialText = useMemo(() => {
    if (initialExtractedText && initialExtractedText.trim()) {
      return initialExtractedText;
    }
    if (initialSummary && initialSummary.trim()) {
      return initialSummary.trim();
    }
    return '';
  }, [initialExtractedText, initialSummary]);

  const [activePdfUrl, setActivePdfUrl] = useState<string>(initialPdfUrl || '');
  const [activePdfName, setActivePdfName] = useState<string>(resolvedInitialTitle);
  const [activeExtractedText, setActiveExtractedText] = useState<string>(resolvedInitialText);
  const [activePageCount, setActivePageCount] = useState<number>(1);

  const [viewMode, setViewMode] = useState<'pdf' | 'reader'>('pdf');
  const [layoutMode, setLayoutMode] = useState<'split' | 'studio' | 'document'>(
    initialPdfUrl ? 'split' : 'studio'
  );
  const [readerTheme, setReaderTheme] = useState<'dark' | 'light' | 'sepia'>(
    isDark ? 'dark' : 'light'
  );
  const [isPlayingTts, setIsPlayingTts] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState<boolean>(false);

  // Studio Tab State
  const [studioTab, setStudioTab] = useState<PdfStudioTab>(initialTab);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [studyBundle, setStudyBundle] = useState<DocumentStudyBundle | null>(null);
  const [isSynthesizingBundle, setIsSynthesizingBundle] = useState<boolean>(false);

  // Flashcards State
  const [cardIndex, setCardIndex] = useState<number>(0);
  const [isCardFlipped, setIsCardFlipped] = useState<boolean>(false);
  const [cardMastery, setCardMastery] = useState<Record<string, 'known' | 'review'>>({});
  const [filterReviewOnly, setFilterReviewOnly] = useState<boolean>(false);
  const [shuffledCardIds, setShuffledCardIds] = useState<string[] | null>(null);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [retryIncorrectOnly, setRetryIncorrectOnly] = useState<boolean>(false);

  // Deep Concept / Math Lens State
  const [activeActionTab, setActiveActionTab] = useState<string>('');
  const [copilotResponse, setCopilotResponse] = useState<string>('');
  const [isCopilotLoading, setIsCopilotLoading] = useState<boolean>(false);
  const [copiedAnalysis, setCopiedAnalysis] = useState<boolean>(false);

  // Cheatsheet & Scratchpad Notes State
  const [userNotes, setUserNotes] = useState<string>('');
  const [copiedStudyPack, setCopiedStudyPack] = useState<boolean>(false);

  // Contextual PDF Chat State
  const [chatTurns, setChatTurns] = useState<PdfChatTurn[]>([]);
  const [chatDraft, setChatDraft] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // ArXiv live search state
  const [arxivSearchQuery, setArxivSearchQuery] = useState<string>('');
  const [isSearchingArxiv, setIsSearchingArxiv] = useState<boolean>(false);
  const [arxivResults, setArxivResults] = useState<ArxivPaper[]>([]);
  const [showArxivSearchDrawer, setShowArxivSearchDrawer] = useState<boolean>(
    enableArxivSearch && !initialPdfUrl
  );

  // Selection pop-up state
  const [selectionMenu, setSelectionMenu] = useState<TextSelectionMenu | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [showFeatureDropdown, setShowFeatureDropdown] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const featureDropdownRef = useRef<HTMLDivElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const studyRequestSeqRef = useRef<number>(0);

  useEffect(() => {
    if (!showFeatureDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (featureDropdownRef.current && !featureDropdownRef.current.contains(e.target as Node)) {
        setShowFeatureDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFeatureDropdown]);

  // Synthesize study bundle (Quiz, Flashcards, Summary, Concepts, Cheatsheet) from document text via LLM
  const generateStudyBundleForDoc = async (
    docTitle: string,
    docText: string,
    pages = 1,
    targetDifficulty: 'easy' | 'medium' | 'hard' = difficulty
  ) => {
    const reqSeq = ++studyRequestSeqRef.current;
    setCardIndex(0);
    setIsCardFlipped(false);
    setShuffledCardIds(null);
    setQuizAnswers({});
    setRetryIncorrectOnly(false);

    if (!docText || docText.trim().length < 25) {
      setIsSynthesizingBundle(false);
      return;
    }

    setIsSynthesizingBundle(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await callKinichApi('/api/pdf/study', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: docTitle,
          textContent: docText.slice(0, 14000),
          pageCount: pages,
          difficulty: targetDifficulty,
        }),
      });
      if (reqSeq !== studyRequestSeqRef.current) return;
      const data = await res.json();
      if (reqSeq !== studyRequestSeqRef.current) return;
      const remote = data?.study;
      if (res.ok && data?.success && remote) {
        const wordCount = Math.max(100, docText.trim().split(/\s+/).length);
        const readTimeMin = Math.max(1, Math.ceil(wordCount / 220));
        const remoteFlashcards = Array.isArray(remote?.flashcards)
          ? remote.flashcards.map((fc: any, idx: number) => ({
              id: fc.id || `pdf-fc-${targetDifficulty}-${idx + 1}`,
              front: String(fc.front || ''),
              back: String(fc.back || ''),
              category: String(fc.category || 'Core Concept'),
              pageRef: Number(fc.pageRef) || 1,
              difficulty: targetDifficulty,
            }))
          : [];

        const remoteQuiz = Array.isArray(remote?.quiz)
          ? remote.quiz.map((q: any, idx: number) => ({
              id: q.id || `pdf-q-${targetDifficulty}-${idx + 1}`,
              question: String(q.question || ''),
              options:
                Array.isArray(q.options) && q.options.length >= 2
                  ? q.options.map(String)
                  : [],
              correctIndex:
                typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4
                  ? q.correctIndex
                  : 0,
              explanation: String(q.explanation || ''),
              pageRef: Number(q.pageRef) || 1,
              difficulty: targetDifficulty,
            }))
          : [];

        setStudyBundle({
          title: docTitle.replace(/\.pdf$/i, ''),
          pageCount: pages,
          wordCount,
          readTimeMin,
          summary: {
            overview: String(remote?.summary?.overview || ''),
            keyPoints: Array.isArray(remote?.summary?.keyPoints) ? remote.summary.keyPoints : [],
            sections: Array.isArray(remote?.summary?.sections) ? remote.summary.sections : [],
          },
          explanation: {
            coreThesis: String(remote?.explanation?.coreThesis || remote?.summary?.overview || ''),
            concepts: Array.isArray(remote?.explanation?.concepts) ? remote.explanation.concepts : [],
          },
          flashcards: remoteFlashcards,
          quiz: remoteQuiz,
          cheatsheet: {
            formulasOrRules: Array.isArray(remote?.cheatsheet?.formulasOrRules)
              ? remote.cheatsheet.formulasOrRules
              : [],
            examTips: Array.isArray(remote?.cheatsheet?.examTips)
              ? remote.cheatsheet.examTips
              : [],
          },
        });
      }
    } catch {} finally {
      if (reqSeq === studyRequestSeqRef.current) {
        setIsSynthesizingBundle(false);
      }
    }
  };

  // Sync props when modal opens or active PDF changes
  useEffect(() => {
    if (!isOpen) return;
    setActivePdfUrl(initialPdfUrl || '');
    setActivePdfName(resolvedInitialTitle);
    setStudioTab(initialTab || 'quiz');
    setReaderTheme(isDark ? 'dark' : 'light');
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 1024;
    setLayoutMode(initialPdfUrl && !isMobileViewport ? 'split' : 'studio');

    if (enableArxivSearch && !initialPdfUrl && !resolvedInitialText) {
      setShowArxivSearchDrawer(true);
    }

    // Load saved user notes for this document
    try {
      const savedNote = localStorage.getItem(`kinich_pdf_notes_${resolvedInitialTitle}`);
      if (savedNote !== null) setUserNotes(savedNote);
      else setUserNotes('');
    } catch {}

    if (resolvedInitialText && resolvedInitialText.trim().length > 30) {
      const isDefaultTransformer = /attention is all you need/i.test(resolvedInitialTitle);
      const estPages = isDefaultTransformer
        ? 15
        : Math.max(1, Math.ceil(resolvedInitialText.split(/\s+/).length / 300));
      setActiveExtractedText(resolvedInitialText);
      setActivePageCount(estPages);
      generateStudyBundleForDoc(resolvedInitialTitle, resolvedInitialText, estPages, difficulty);
    } else if (initialPdfUrl && (initialPdfUrl.startsWith('data:') || initialPdfUrl.startsWith('blob:'))) {
      setIsExtractingPdf(true);
      extractTextFromPdfFile(initialPdfUrl, resolvedInitialTitle)
        .then((res) => {
          setActiveExtractedText(res.text);
          setActivePageCount(res.pageCount);
          generateStudyBundleForDoc(resolvedInitialTitle, res.text, res.pageCount, difficulty);
        })
        .finally(() => setIsExtractingPdf(false));
    } else {
      const defaultStarterGuide = [
        'Section 1: Transformer Architecture & Self-Attention',
        'Scaled dot-product attention computes Attention(Q, K, V) = softmax((QK^T) / sqrt(d_k))V, enabling direct token-to-token dependency modeling in O(1) sequential operations rather than O(n) recurrent steps.',
        'Multi-head attention projects queries, keys, and values into h distinct subspaces so the model jointly attends to syntactic, semantic, and positional relationships across long contexts.',
        '',
        'Section 2: Memory-Efficient Inference & KV-Cache Optimization',
        'During autoregressive decoding, Key-Value (KV) caching stores past token activations to avoid redundant recomputation, shifting decoding from compute-bound to memory-bandwidth-bound.',
        'FlashAttention tiles Q, K, and V blocks into fast on-chip SRAM using online softmax rescaling, avoiding O(N^2) HBM reads/writes and achieving 2-4x wall-clock speedups.',
        '',
        'Section 3: Post-Training Alignment & Fine-Tuning',
        'Low-Rank Adaptation (LoRA) freezes pre-trained weights W_0 and injects trainable rank-decomposition matrices B and A (Delta W = BA with rank r << d), cutting trainable parameters by up to 10,000x.',
        'Direct Preference Optimization (DPO) optimizes policy alignment directly on human preference pairs without training a separate reward model or running unstable reinforcement learning loops.',
      ].join('\n');
      const fallbackText = resolvedInitialText || defaultStarterGuide;
      setActiveExtractedText(fallbackText);
      setActivePageCount(15);
      generateStudyBundleForDoc(resolvedInitialTitle, fallbackText, 15, difficulty);
    }
  }, [isOpen, initialPdfUrl, resolvedInitialTitle, resolvedInitialText, initialTab, isDark]);

  useEffect(() => {
    if (!isOpen) {
      stopSmallestSpeech();
      setIsPlayingTts(false);
      setSelectionMenu(null);
    }
  }, [isOpen]);

  // Keyboard navigation: Escape to close, Space/Arrows for Flashcards
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (studioTab === 'flashcards') {
        if (e.code === 'Space') {
          e.preventDefault();
          setIsCardFlipped((prev) => !prev);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          setIsCardFlipped(false);
          setCardIndex((prev) => prev + 1);
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          setIsCardFlipped(false);
          setCardIndex((prev) => Math.max(0, prev - 1));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, studioTab, onClose]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatTurns, isChatLoading]);

  // Handle direct PDF / Document file upload inside the Padded Studio Modal
  const handleUploadedFileInStudio = async (file: File) => {
    if (!file) return;
    setIsExtractingPdf(true);
    setActivePdfName(file.name);
    setShowArxivSearchDrawer(false);
    setChatTurns([]);
    setCopilotResponse('');

    try {
      const objectUrl = URL.createObjectURL(file);
      setActivePdfUrl(objectUrl);
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setLayoutMode('split');
      } else {
        setLayoutMode('studio');
      }

      const isPdf = file.type.includes('pdf') || /\.pdf$/i.test(file.name);
      if (isPdf) {
        const extracted = await extractTextFromPdfFile(file, file.name);
        setActiveExtractedText(extracted.text);
        setActivePageCount(extracted.pageCount);
        await generateStudyBundleForDoc(
          file.name,
          extracted.text,
          extracted.pageCount,
          difficulty
        );
      } else {
        const text = await file.text();
        const sliced = text.slice(0, 150000);
        const estPages = Math.max(1, Math.ceil(sliced.split(/\s+/).length / 300));
        setActiveExtractedText(sliced);
        setActivePageCount(estPages);
        await generateStudyBundleForDoc(file.name, sliced, estPages, difficulty);
      }
    } catch {} finally {
      setIsExtractingPdf(false);
    }
  };

  const handleSearchArxiv = async (queryOverride?: string) => {
    const q = (queryOverride ?? arxivSearchQuery).trim();
    if (!q || isSearchingArxiv) return;
    setIsSearchingArxiv(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await callKinichApi(`/api/arxiv/search?q=${encodeURIComponent(q)}&max_results=6`, {
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
    const extracted = `Paper Title: ${paper.title}\narXiv ID: arXiv:${paper.id}\nAuthors: ${paper.authors.join(
      ', '
    )}\nPublished: ${paper.published}\nCategories: ${paper.categories.join(', ')}\n\nABSTRACT:\n${
      paper.summary
    }`;
    setActivePdfUrl(paper.pdfUrl);
    setActivePdfName(paper.title);
    setActiveExtractedText(extracted);
    setActivePageCount(12);
    setShowArxivSearchDrawer(false);
    setCopilotResponse('');
    setActiveActionTab('');
    setChatTurns([]);
    generateStudyBundleForDoc(paper.title, extracted, 12, difficulty);
  };

  const runPaperDeepBreakdown = async (
    mode: 'math' | 'contributions' | 'methodology' | 'custom',
    customPromptText?: string
  ) => {
    if (isCopilotLoading) return;
    setStudioTab('explanation');
    setIsCopilotLoading(true);
    setActiveActionTab(mode);

    const taskPrompt =
      mode === 'math'
        ? `Explain the core mathematical formulations, equations, objective functions, and theoretical foundations of "${activePdfName}". Write key equations in clean LaTeX ($...$ and $$...$$) and explain every variable intuitively.`
        : mode === 'contributions'
        ? `Provide a structured breakdown of the Key Contributions, novelty over prior state-of-the-art, empirical benchmark results, and main takeaways of "${activePdfName}".`
        : mode === 'methodology'
        ? `Provide a deep Methodology & Architecture Breakdown of "${activePdfName}"—covering model/system architecture, experimental setup, algorithmic pipeline, and limitations.`
        : customPromptText || `Analyze "${activePdfName}".`;

    try {
      const authHeaders = await getAuthHeaders();
      const res = await callKinichApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `You are an Academic Paper & PDF Deep Reader Co-Pilot.\n\nDocument Context:\n${
                (activeExtractedText || activePdfName).slice(0, 14000)
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
      setCopilotResponse(`Error analyzing document: ${err.message}`);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleSendPdfChat = async (promptOverride?: string) => {
    const q = (promptOverride ?? chatDraft).trim();
    if (!q || isChatLoading) return;

    const userTurn: PdfChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: q,
    };
    const updatedTurns = [...chatTurns, userTurn];
    setChatTurns(updatedTurns);
    if (!promptOverride) setChatDraft('');
    setIsChatLoading(true);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await callKinichApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `You are a rigorous PDF Study & Assessment Tutor for the document "${activePdfName}".\n\nDocument Content:\n${(
                activeExtractedText || activePdfName
              ).slice(0, 14000)}\n\nStudent Question: ${q}`,
            },
          ],
          webSearch: false,
          searchMode: 'off',
          model: 'deepseek-v4.1-flash:free',
        }),
      });
      const data = await res.json();
      const replyText =
        data?.text ||
        data?.reply ||
        'Based on the uploaded document, here is the grounded breakdown.';
      setChatTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: replyText,
        },
      ]);
    } catch {
      setChatTurns((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Could not reach document analysis service. Please try again.',
        },
      ]);
    } finally {
      setIsChatLoading(false);
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
          x: Math.max(
            120,
            Math.min(rect.left - containerRect.left + rect.width / 2, containerRect.width - 120)
          ),
          y: Math.max(60, rect.top - containerRect.top - 12),
        });
      }
    } catch {
      setSelectionMenu(null);
    }
  };

  const handleToggleReadAloud = () => {
    if (isPlayingTts) {
      stopSmallestSpeech();
      setIsPlayingTts(false);
      return;
    }

    const textToRead = (
      copilotResponse ||
      studyBundle?.summary.overview ||
      activeExtractedText ||
      activePdfName
    ).slice(0, 2000);
    speakTextWithSmallestAi(
      textToRead,
      'auto',
      () => setIsPlayingTts(true),
      () => setIsPlayingTts(false),
      () => setIsPlayingTts(false)
    );
  };

  const handleExportStudyPackMarkdown = () => {
    if (!studyBundle) return;
    let md = `# Study & Assessment Pack: ${activePdfName}\n\n`;
    md += `Pages: ${studyBundle.pageCount} · Words: ${studyBundle.wordCount.toLocaleString()} · Read Time: ${studyBundle.readTimeMin} min\n\n`;
    md += `## 1. Executive Summary\n${studyBundle.summary.overview}\n\n`;
    md += `### Key Takeaways\n`;
    studyBundle.summary.keyPoints.forEach((kp, i) => {
      md += `${i + 1}. ${kp}\n`;
    });
    md += `\n## 2. First-Principles Concepts\n`;
    studyBundle.explanation.concepts.forEach((c) => {
      md += `- **${c.term}** (Page ${c.pageRef || 1}): ${c.definition} — *Mechanism:* ${c.mechanism}\n`;
    });
    md += `\n## 3. Flashcards (${studyBundle.flashcards.length})\n`;
    studyBundle.flashcards.forEach((fc, i) => {
      md += `**Q${i + 1} [${fc.category}]**: ${fc.front}\n**A**: ${fc.back}\n\n`;
    });
    md += `\n## 4. Assessment Quiz (${studyBundle.quiz.length})\n`;
    studyBundle.quiz.forEach((q, i) => {
      md += `**Q${i + 1}**: ${q.question}\n`;
      q.options.forEach((opt, oIdx) => {
        md += `  - ${String.fromCharCode(65 + oIdx)}) ${opt}${
          oIdx === q.correctIndex ? ' (CORRECT)' : ''
        }\n`;
      });
      md += `  *Explanation*: ${q.explanation}\n\n`;
    });
    if (userNotes.trim()) {
      md += `\n## 5. Personal Study Notes\n${userNotes}\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePdfName.replace(/[^a-z0-9-_]/gi, '_').slice(0, 40)}_study_pack.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCopiedStudyPack(true);
    setTimeout(() => setCopiedStudyPack(false), 2000);
  };

  // Flashcard Deck Computed State (must run before early return to preserve Hook order)
  const allFlashcards = studyBundle?.flashcards || [];
  const orderedFlashcards = useMemo(() => {
    if (!shuffledCardIds) return allFlashcards;
    const map = new Map(allFlashcards.map((c) => [c.id, c]));
    return shuffledCardIds.map((id) => map.get(id)).filter(Boolean) as typeof allFlashcards;
  }, [allFlashcards, shuffledCardIds]);

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

  const deckCards = filterReviewOnly
    ? orderedFlashcards.filter((c) => cardMastery[c.id] !== 'known')
    : orderedFlashcards;
  const safeCardIndex = deckCards.length > 0 ? Math.min(cardIndex, deckCards.length - 1) : 0;
  const currentCard = deckCards[safeCardIndex] || null;
  const knownCount = allFlashcards.filter((c) => cardMastery[c.id] === 'known').length;
  const reviewCount = allFlashcards.filter((c) => cardMastery[c.id] === 'review').length;

  // Quiz Computed State
  const allQuizItems = studyBundle?.quiz || [];
  const visibleQuizItems = retryIncorrectOnly
    ? allQuizItems.filter(
        (q) => quizAnswers[q.id] !== undefined && quizAnswers[q.id] !== q.correctIndex
      )
    : allQuizItems;
  const answeredQuizCount = Object.keys(quizAnswers).length;
  const correctQuizCount = allQuizItems.filter(
    (q) => quizAnswers[q.id] !== undefined && quizAnswers[q.id] === q.correctIndex
  ).length;
  const accuracyPct =
    answeredQuizCount > 0 ? Math.round((correctQuizCount / answeredQuizCount) * 100) : 0;

  const getReaderSurfaceClass = () => {
    if (readerTheme === 'sepia') return 'bg-[#f9f1df] text-[#382b1e] border-[#e2d3b5]';
    if (readerTheme === 'light') return 'bg-[#fafafa] text-[#111111] border-[#e4e4e7]';
    return 'bg-[#0e1015] text-[#e4e4e7] border-[#222530]';
  };

  return (
    <div
      className="fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden select-text"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);
        const droppedFile = e.dataTransfer?.files?.[0];
        if (droppedFile) {
          handleUploadedFileInStudio(droppedFile);
        }
      }}
    >
      {/* Hidden File Input for 1-Click PDF / Document Upload */}
      <input
        ref={fileUploadInputRef}
        type="file"
        accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUploadedFileInStudio(f);
          if (fileUploadInputRef.current) fileUploadInputRef.current.value = '';
        }}
      />

      {/* Full-Page Studio Workspace Container */}
      <div
        ref={containerRef}
        onMouseUp={handleTextSelection}
        className={`relative w-full h-full flex flex-col overflow-hidden transition-colors ${
          isDark ? 'bg-[#0b0c10] text-white' : 'bg-white text-[#0d0d0d]'
        }`}
      >
        {/* Drag & Drop PDF Overlay */}
        {isDraggingFile && (
          <div className="absolute inset-4 z-50 rounded-3xl border-2 border-dashed border-sky-400 bg-sky-500/15 backdrop-blur-xl flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div className="size-14 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
              <Upload className="w-7 h-7 animate-bounce" />
            </div>
            <div className="text-base font-semibold text-white">
              Drop your PDF or Document to generate Quiz, Flashcards & Study Pack
            </div>
            <div className="text-xs text-neutral-300">
              Instant page extraction · Interactive Quiz · Flip Flashcards · Executive Summary
            </div>
          </div>
        )}

        {/* Compact Single-Row Top Header Bar */}
        <div
          className={`px-3 sm:px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2.5 border-b flex items-center justify-between gap-2 shrink-0 ${
            isDark ? 'bg-[#0b0c10] border-white/[0.08]' : 'bg-white border-black/[0.08]'
          }`}
        >
          {/* Left: Back Button + Truncated Title */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={onClose}
              className={`size-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-white/[0.04] border-white/[0.12] hover:bg-white/[0.09] text-white'
                  : 'bg-black/[0.03] border-black/[0.1] hover:bg-black/[0.06] text-[#0d0d0d]'
              }`}
              title="Back to Chat"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <h2
              className="font-semibold text-[13px] sm:text-sm truncate tracking-tight"
              title={activePdfName}
            >
              {activePdfName}
            </h2>

            {(isExtractingPdf || isSynthesizingBundle) && (
              <Loader2 className="w-3.5 h-3.5 animate-spin opacity-60 shrink-0" />
            )}
          </div>

          {/* Center / Right: Model-Selector-Style Feature Dropdown + Compact Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Feature Selector Dropdown (Matching Model Selector Style) */}
            <div ref={featureDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setShowFeatureDropdown((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium tracking-tight transition-all cursor-pointer select-none whitespace-nowrap backdrop-blur-2xl ${
                  isDark
                    ? 'bg-neutral-900/75 hover:bg-neutral-800/85 border-white/[0.16] text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)]'
                    : 'bg-white/85 hover:bg-neutral-100 border-black/[0.1] text-[#0d0d0d] shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
                }`}
              >
                <span>
                  {studioTab === 'quiz'
                    ? `Quiz${allQuizItems.length ? ` (${allQuizItems.length})` : ''}`
                    : studioTab === 'flashcards'
                    ? `Flashcards${allFlashcards.length ? ` (${allFlashcards.length})` : ''}`
                    : studioTab === 'summary'
                    ? 'Summary'
                    : studioTab === 'explanation'
                    ? 'Concepts & Math'
                    : studioTab === 'cheatsheet'
                    ? 'Cheatsheet'
                    : 'Ask PDF'}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 opacity-60 transition-transform duration-150 ${
                    showFeatureDropdown ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showFeatureDropdown && (
                <div
                  className={`absolute right-0 top-full mt-2 w-56 rounded-2xl border p-1.5 z-50 backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
                    isDark
                      ? 'bg-[#141418]/95 border-white/[0.14] text-white shadow-black/80'
                      : 'bg-white/95 border-black/[0.1] text-[#0d0d0d] shadow-black/15'
                  }`}
                >
                  <div className="space-y-0.5">
                    {(
                      [
                        { id: 'learn', label: 'Learn Tab', meta: 'All Tools' },
                        {
                          id: 'quiz',
                          label: 'Quiz',
                          meta: allQuizItems.length ? `${allQuizItems.length} questions` : '',
                        },
                        {
                          id: 'flashcards',
                          label: 'Flashcards',
                          meta: allFlashcards.length ? `${allFlashcards.length} cards` : '',
                        },
                        { id: 'summary', label: 'Summary', meta: 'Synthesis' },
                        { id: 'explanation', label: 'Concepts & Math', meta: 'LaTeX' },
                        { id: 'cheatsheet', label: 'Cheatsheet', meta: 'Formulas' },
                        { id: 'chat', label: 'Ask PDF', meta: 'Q&A' },
                      ] as const
                    ).map((item) => {
                      const active = studioTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setStudioTab(item.id);
                            setLayoutMode('studio');
                            setShowFeatureDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                            active
                              ? isDark
                                ? 'bg-white text-black font-semibold'
                                : 'bg-[#0d0d0d] text-white font-semibold'
                              : isDark
                              ? 'text-neutral-300 hover:bg-white/[0.07]'
                              : 'text-neutral-700 hover:bg-black/[0.05]'
                          }`}
                        >
                          <span>{item.label}</span>
                          {item.meta && (
                            <span
                              className={`text-[10px] font-mono ${
                                active ? 'opacity-80' : 'opacity-50'
                              }`}
                            >
                              {item.meta}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Difficulty Picker inside Dropdown */}
                  <div
                    className={`mt-1.5 pt-1.5 border-t ${
                      isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                    }`}
                  >
                    <div className="px-2 py-1 text-[10px] font-mono uppercase opacity-50">
                      Difficulty
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            setDifficulty(lvl);
                            generateStudyBundleForDoc(
                              activePdfName,
                              activeExtractedText,
                              activePageCount,
                              lvl
                            );
                            setShowFeatureDropdown(false);
                          }}
                          className={`py-1.5 rounded-lg text-[11px] capitalize transition-colors cursor-pointer ${
                            difficulty === lvl
                              ? isDark
                                ? 'bg-white/15 text-white font-semibold'
                                : 'bg-black/10 text-black font-semibold'
                              : 'opacity-65 hover:opacity-100'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* View Mode & Export inside Dropdown */}
                  <div
                    className={`mt-1.5 pt-1.5 border-t flex items-center justify-between gap-1 ${
                      isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setLayoutMode(layoutMode === 'document' ? 'studio' : 'document');
                        setShowFeatureDropdown(false);
                      }}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium text-center transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-black/[0.05]'
                      }`}
                    >
                      {layoutMode === 'document' ? 'Switch to Studio' : 'Open Reader'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleExportStudyPackMarkdown();
                        setShowFeatureDropdown(false);
                      }}
                      className={`py-1.5 px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-black/[0.05]'
                      }`}
                    >
                      Export .md
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Compact Upload Pill */}
            <button
              type="button"
              onClick={() => fileUploadInputRef.current?.click()}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isDark
                  ? 'bg-white text-black hover:bg-neutral-200'
                  : 'bg-[#0d0d0d] text-white hover:bg-neutral-800'
              }`}
              title="Upload PDF"
            >
              Upload
            </button>

            {/* Compact ArXiv Search Toggle */}
            <button
              type="button"
              onClick={() => setShowArxivSearchDrawer(!showArxivSearchDrawer)}
              className={`px-2.5 py-1.5 rounded-full border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                showArxivSearchDrawer
                  ? isDark
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-black/10 border-black/30 text-black'
                  : isDark
                  ? 'bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.08] text-neutral-300'
                  : 'bg-black/[0.03] border-black/[0.1] hover:bg-black/[0.06] text-neutral-700'
              }`}
              title="Search ArXiv Papers"
            >
              ArXiv
            </button>
          </div>
        </div>

        {/* Collapsible ArXiv Search Drawer */}
        {showArxivSearchDrawer && (
          <div
            className={`px-4 sm:px-6 py-3 border-b z-10 ${
              isDark ? 'bg-[#101218] border-white/[0.08]' : 'bg-[#f8f9fa] border-black/[0.08]'
            }`}
          >
            <div className="max-w-3xl mx-auto space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={arxivSearchQuery}
                  onChange={(e) => setArxivSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchArxiv();
                  }}
                  placeholder="Search ArXiv papers by title, author, or ID..."
                  className={`flex-1 px-3.5 py-2 rounded-full border text-xs outline-none ${
                    isDark
                      ? 'bg-[#0b0c10] border-white/[0.12] text-white placeholder-neutral-500'
                      : 'bg-white border-black/[0.12] text-[#0d0d0d] placeholder-neutral-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleSearchArxiv()}
                  disabled={isSearchingArxiv || !arxivSearchQuery.trim()}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                    isDark ? 'bg-white text-black' : 'bg-[#0d0d0d] text-white'
                  }`}
                >
                  {isSearchingArxiv ? '...' : 'Search'}
                </button>
              </div>

              {arxivResults.length === 0 && !isSearchingArxiv && (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                  {[
                    'Attention Is All You Need',
                    'FlashAttention',
                    'Mamba Sequence Modeling',
                    'LoRA Low-Rank Adaptation',
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setArxivSearchQuery(q);
                        handleSearchArxiv(q);
                      }}
                      className={`px-2.5 py-1 rounded-full border text-[11px] whitespace-nowrap shrink-0 cursor-pointer ${
                        isDark
                          ? 'bg-white/[0.04] border-white/[0.1] text-neutral-300 hover:text-white'
                          : 'bg-white border-black/[0.08] text-neutral-700 hover:text-black'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {arxivResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pt-1">
                  {arxivResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectArxivPaper(p)}
                      className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-[#0b0c10] border-white/[0.08] hover:border-white/30'
                          : 'bg-white border-black/[0.08] hover:border-black/30'
                      }`}
                    >
                      <div className="text-[10px] font-mono opacity-55">arXiv:{p.id}</div>
                      <div className="text-xs font-semibold line-clamp-1 mt-0.5">{p.title}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Workspace Split Grid */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* LEFT PANE: PDF Viewer / Extracted Text Reader */}
          {layoutMode !== 'studio' && (
            <div
              className={`min-h-0 overflow-y-auto scrollbar-thin p-4 sm:p-5 flex flex-col gap-3 ${
                layoutMode === 'split'
                  ? 'lg:col-span-5 border-b lg:border-b-0 lg:border-r'
                  : 'lg:col-span-12'
              } ${
                isDark ? 'border-white/[0.08] bg-[#090a0e]' : 'border-black/[0.08] bg-[#f7f7f8]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('pdf')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      viewMode === 'pdf'
                        ? isDark
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#0d0d0d] text-white font-semibold'
                        : 'opacity-65 hover:opacity-100'
                    }`}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('reader')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      viewMode === 'reader'
                        ? isDark
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#0d0d0d] text-white font-semibold'
                        : 'opacity-65 hover:opacity-100'
                    }`}
                  >
                    Text
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setLayoutMode('studio')}
                  className={`px-3 py-1 rounded-full border text-xs font-medium cursor-pointer ${
                    isDark ? 'border-white/[0.12] text-neutral-300' : 'border-black/[0.12] text-neutral-700'
                  }`}
                >
                  Back to Studio
                </button>
              </div>

              {viewMode === 'pdf' && directPdfUrl ? (
                <div className="flex-1 min-h-[380px] w-full rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black">
                  <iframe
                    src={onlinePdfEmbedUrl}
                    title={activePdfName}
                    className="w-full h-full min-h-[56vh] border-0 block"
                  />
                </div>
              ) : (
                <div
                  className={`flex-1 w-full p-5 rounded-2xl border leading-relaxed whitespace-pre-wrap text-xs sm:text-sm overflow-y-auto ${getReaderSurfaceClass()}`}
                >
                  {activeExtractedText ||
                    'Upload a PDF document using the "Upload" button above or drag-and-drop any PDF onto this studio.'}
                </div>
              )}
            </div>
          )}

          {/* RIGHT PANE: Study Studio */}
          {layoutMode !== 'document' && (
            <div
              className={`min-h-0 flex flex-col h-full overflow-hidden ${
                layoutMode === 'split' ? 'lg:col-span-7' : 'lg:col-span-12'
              } ${isDark ? 'bg-[#0b0c10] text-white' : 'bg-white text-[#0d0d0d]'}`}
            >
              {/* Single-Row Horizontally Scrollable Feature Pills (No Outer Wrapper Box, No Icons) */}
              <div
                className={`px-3 sm:px-5 py-2 border-b flex items-center justify-between gap-2 overflow-x-auto scrollbar-none shrink-0 ${
                  isDark ? 'bg-[#0b0c10] border-white/[0.07]' : 'bg-white border-black/[0.07]'
                }`}
              >
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  {(
                    [
                      { id: 'learn', label: 'Learn Tab' },
                      {
                        id: 'quiz',
                        label: `Quiz${allQuizItems.length ? ` (${allQuizItems.length})` : ''}`,
                      },
                      {
                        id: 'flashcards',
                        label: `Flashcards${
                          allFlashcards.length ? ` (${allFlashcards.length})` : ''
                        }`,
                      },
                      { id: 'summary', label: 'Summary' },
                      { id: 'explanation', label: 'Concepts & Math' },
                      { id: 'cheatsheet', label: 'Cheatsheet' },
                      { id: 'chat', label: 'Ask PDF' },
                    ] as const
                  ).map((tab) => {
                    const active = studioTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStudioTab(tab.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                          active
                            ? isDark
                              ? 'bg-white text-black border-white font-semibold'
                              : 'bg-[#0d0d0d] text-white border-[#0d0d0d] font-semibold'
                            : isDark
                            ? 'bg-white/[0.03] border-white/[0.08] text-neutral-400 hover:text-white'
                            : 'bg-black/[0.025] border-black/[0.08] text-neutral-600 hover:text-black'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Inline Difficulty Pills (Only shown on Quiz or Flashcards) */}
                {(studioTab === 'quiz' || studioTab === 'flashcards') && (
                  <div className="flex items-center gap-1 shrink-0 pl-2">
                    {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => {
                          setDifficulty(lvl);
                          generateStudyBundleForDoc(
                            activePdfName,
                            activeExtractedText,
                            activePageCount,
                            lvl
                          );
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] capitalize transition-colors cursor-pointer whitespace-nowrap ${
                          difficulty === lvl
                            ? isDark
                              ? 'bg-white/15 text-white font-semibold'
                              : 'bg-black/10 text-black font-semibold'
                            : 'text-neutral-500 hover:text-current'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Studio Content Viewport */}
              <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 scrollbar-thin">
                {/* ========================================================= */}
                {/* TAB 0: LEARN TAB (2-Column Monochrome Options Grid)       */}
                {/* ========================================================= */}
                {studioTab === 'learn' && (
                  <div className="max-w-3xl mx-auto space-y-6">
                    <div className="space-y-3">
                      <div className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        Generate
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        {[
                          { label: 'Podcast / Audio', icon: Volume2, onClick: () => handleToggleReadAloud() },
                          { label: 'Document Reader', icon: FileText, onClick: () => setLayoutMode('document') },
                          { label: 'Summary', icon: ListTree, onClick: () => setStudioTab('summary') },
                          { label: 'Quiz', icon: HelpCircle, onClick: () => setStudioTab('quiz') },
                          { label: 'Flashcards', icon: Layers, onClick: () => setStudioTab('flashcards') },
                          { label: 'Cheatsheet & Notes', icon: BookOpen, onClick: () => setStudioTab('cheatsheet') },
                          { label: 'Concepts & Math', icon: Sigma, onClick: () => setStudioTab('explanation') },
                          { label: 'Ask PDF Tutor', icon: MessageSquare, onClick: () => setStudioTab('chat') },
                        ].map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={item.onClick}
                              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 text-left transition-all cursor-pointer ${
                                isDark
                                  ? 'bg-[#12141c] border-white/[0.08] hover:border-white/[0.22]'
                                  : 'bg-white border-black/[0.08] hover:border-black/[0.22]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`size-9 rounded-xl border flex items-center justify-center shrink-0 ${
                                    isDark
                                      ? 'bg-white/[0.06] border-white/[0.08] text-neutral-200'
                                      : 'bg-black/[0.04] border-black/[0.06] text-neutral-800'
                                  }`}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <span className="text-xs sm:text-sm font-medium truncate">
                                  {item.label}
                                </span>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 opacity-45 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        My Sets
                      </div>
                      {[
                        {
                          title: 'Detailed Summary',
                          sub: `Summary · ${studyBundle?.summary.keyPoints.length || 0} takeaways`,
                          tab: 'summary' as const,
                        },
                        {
                          title: `${activePdfName.slice(0, 24)} Flashcards`,
                          sub: `Flashcards · ${allFlashcards.length} cards`,
                          tab: 'flashcards' as const,
                        },
                        {
                          title: `${activePdfName.slice(0, 24)} Quiz`,
                          sub: `Quiz · ${allQuizItems.length} questions`,
                          tab: 'quiz' as const,
                        },
                      ].map((s) => (
                        <button
                          key={s.title}
                          type="button"
                          onClick={() => setStudioTab(s.tab)}
                          className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-[#11131a] border-white/[0.07] hover:border-white/[0.2]'
                              : 'bg-white border-black/[0.07] hover:border-black/[0.2]'
                          }`}
                        >
                          <div>
                            <div className="text-xs sm:text-sm font-medium">{s.title}</div>
                            <div className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                              {s.sub}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-50" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 1: INTERACTIVE QUIZ                                   */}
                {/* ========================================================= */}
                {studioTab === 'quiz' && (
                  <div className="space-y-3.5 max-w-3xl mx-auto">
                    {/* Minimal Single-Line Quiz Status */}
                    <div className="flex items-center justify-between gap-2 text-xs px-1">
                      <span
                        className={`font-mono tabular-nums ${
                          isDark ? 'text-neutral-400' : 'text-neutral-500'
                        }`}
                      >
                        {correctQuizCount} / {allQuizItems.length} correct
                        {answeredQuizCount > 0 ? ` · ${accuracyPct}%` : ''}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {answeredQuizCount > 0 && correctQuizCount < answeredQuizCount && (
                          <button
                            type="button"
                            onClick={() => setRetryIncorrectOnly(!retryIncorrectOnly)}
                            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors cursor-pointer ${
                              retryIncorrectOnly
                                ? isDark
                                  ? 'bg-white text-black border-white'
                                  : 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                                : isDark
                                ? 'border-white/[0.1] text-neutral-400 hover:text-white'
                                : 'border-black/[0.1] text-neutral-600 hover:text-black'
                            }`}
                          >
                            {retryIncorrectOnly ? 'All Questions' : 'Missed Only'}
                          </button>
                        )}
                        {answeredQuizCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuizAnswers({});
                              setRetryIncorrectOnly(false);
                            }}
                            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors cursor-pointer ${
                              isDark
                                ? 'border-white/[0.1] text-neutral-400 hover:text-white'
                                : 'border-black/[0.1] text-neutral-600 hover:text-black'
                            }`}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quiz Questions List */}
                    <div className="space-y-3.5">
                      {visibleQuizItems.map((q, qIdx) => {
                        const selectedOpt = quizAnswers[q.id];
                        const hasAnswered = selectedOpt !== undefined;

                        return (
                          <div
                            key={q.id}
                            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                              isDark
                                ? 'bg-[#11131a] border-white/[0.08]'
                                : 'bg-white border-black/[0.08]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="text-[13px] sm:text-sm font-medium leading-relaxed">
                                <span
                                  className={`font-mono tabular-nums mr-1.5 ${
                                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                                  }`}
                                >
                                  {qIdx + 1}.
                                </span>
                                <MathMarkdown content={q.question} isDark={isDark} inline />
                              </div>
                              {q.pageRef && (
                                <span
                                  className={`text-[10px] font-mono tabular-nums shrink-0 pt-0.5 ${
                                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                                  }`}
                                >
                                  p.{q.pageRef}
                                </span>
                              )}
                            </div>

                            <div className="space-y-2">
                              {q.options.map((opt, oIdx) => {
                                const isSelected = selectedOpt === oIdx;
                                const isCorrect = q.correctIndex === oIdx;

                                let optionStyle = isDark
                                  ? 'bg-[#161922] border-white/[0.07] text-neutral-200 hover:border-white/[0.22]'
                                  : 'bg-[#f8f9fa] border-black/[0.07] text-neutral-800 hover:border-black/[0.22]';

                                if (hasAnswered) {
                                  if (isCorrect) {
                                    optionStyle = isDark
                                      ? 'bg-white/[0.12] border-white/50 text-white font-medium'
                                      : 'bg-black/[0.07] border-black/50 text-black font-medium';
                                  } else if (isSelected && !isCorrect) {
                                    optionStyle = isDark
                                      ? 'bg-white/[0.02] border-white/[0.15] text-neutral-500 line-through'
                                      : 'bg-black/[0.02] border-black/[0.15] text-neutral-400 line-through';
                                  } else {
                                    optionStyle = isDark
                                      ? 'bg-[#14161e] border-white/[0.04] text-neutral-500'
                                      : 'bg-[#fafafa] border-black/[0.04] text-neutral-400';
                                  }
                                }

                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    disabled={hasAnswered}
                                    onClick={() =>
                                      setQuizAnswers((prev) => ({
                                        ...prev,
                                        [q.id]: oIdx,
                                      }))
                                    }
                                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs transition-all flex items-start justify-between gap-3 cursor-pointer disabled:cursor-default ${optionStyle}`}
                                  >
                                    <div className="flex items-start gap-2 min-w-0">
                                      <span className="font-mono text-[11px] opacity-60 shrink-0 pt-0.5">
                                        {String.fromCharCode(65 + oIdx)}.
                                      </span>
                                      <div className="leading-relaxed min-w-0">
                                        <MathMarkdown content={opt} isDark={isDark} inline />
                                      </div>
                                    </div>

                                    {hasAnswered && isCorrect && (
                                      <span className="text-[10px] font-mono uppercase opacity-80 shrink-0 pt-0.5">
                                        Correct
                                      </span>
                                    )}
                                    {hasAnswered && isSelected && !isCorrect && (
                                      <span className="text-[10px] font-mono uppercase opacity-60 shrink-0 pt-0.5">
                                        Wrong
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {hasAnswered && q.explanation && (
                              <div
                                className={`mt-3 p-3 rounded-xl border text-xs leading-relaxed ${
                                  isDark
                                    ? 'bg-white/[0.03] border-white/[0.07] text-neutral-300'
                                    : 'bg-[#f8f9fa] border-black/[0.07] text-neutral-700'
                                }`}
                              >
                                <MathMarkdown content={q.explanation} isDark={isDark} inline />
                              </div>
                            )}

                            {/* Ask Chat & Don't Know Row */}
                            <div className="mt-3 pt-2.5 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setStudioTab('chat');
                                  handleSendPdfChat(`Walk me through this question: "${q.question}"`);
                                }}
                                className={`px-3 py-1.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                  isDark
                                    ? 'border-white/[0.1] text-neutral-300 hover:bg-white/[0.06]'
                                    : 'border-black/[0.1] text-neutral-700 hover:bg-black/[0.04]'
                                }`}
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Ask chat</span>
                              </button>
                              {!hasAnswered && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuizAnswers((prev) => ({
                                      ...prev,
                                      [q.id]: q.correctIndex,
                                    }))
                                  }
                                  className={`px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors cursor-pointer ${
                                    isDark
                                      ? 'border-white/[0.1] text-neutral-300 hover:bg-white/[0.06]'
                                      : 'border-black/[0.1] text-neutral-700 hover:bg-black/[0.04]'
                                  }`}
                                >
                                  Don't know
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 2: INTERACTIVE FLASHCARDS                             */}
                {/* ========================================================= */}
                {studioTab === 'flashcards' && (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {/* Minimal Single-Line Flashcard Controls (No Icons, No Colored Numbers) */}
                    <div className="flex items-center justify-between gap-2 text-xs px-1">
                      <span
                        className={`font-mono tabular-nums ${
                          isDark ? 'text-neutral-400' : 'text-neutral-500'
                        }`}
                      >
                        {deckCards.length > 0
                          ? `${safeCardIndex + 1} / ${deckCards.length}`
                          : '0 cards'}
                        {knownCount > 0 ? ` · ${knownCount} known` : ''}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const ids = allFlashcards.map((c) => c.id);
                            for (let i = ids.length - 1; i > 0; i--) {
                              const j = Math.floor(Math.random() * (i + 1));
                              [ids[i], ids[j]] = [ids[j], ids[i]];
                            }
                            setShuffledCardIds(ids);
                            setCardIndex(0);
                            setIsCardFlipped(false);
                          }}
                          className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors cursor-pointer ${
                            isDark
                              ? 'border-white/[0.1] text-neutral-300 hover:text-white'
                              : 'border-black/[0.1] text-neutral-700 hover:text-black'
                          }`}
                        >
                          Shuffle
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFilterReviewOnly((prev) => !prev);
                            setCardIndex(0);
                            setIsCardFlipped(false);
                          }}
                          className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors cursor-pointer ${
                            filterReviewOnly
                              ? isDark
                                ? 'bg-white text-black border-white'
                                : 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                              : isDark
                              ? 'border-white/[0.1] text-neutral-300 hover:text-white'
                              : 'border-black/[0.1] text-neutral-700 hover:text-black'
                          }`}
                        >
                          {filterReviewOnly ? 'All Cards' : 'Unmastered'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCardMastery({});
                            setFilterReviewOnly(false);
                            setShuffledCardIds(null);
                            setCardIndex(0);
                            setIsCardFlipped(false);
                          }}
                          className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors cursor-pointer ${
                            isDark
                              ? 'border-white/[0.1] text-neutral-400 hover:text-white'
                              : 'border-black/[0.1] text-neutral-500 hover:text-black'
                          }`}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {currentCard ? (
                      <>
                        {/* Clean Flip Card with KaTeX Support */}
                        <div
                          onClick={() => setIsCardFlipped((prev) => !prev)}
                          className={`min-h-[250px] p-6 sm:p-8 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer select-none ${
                            isDark
                              ? 'bg-[#12141c] border-white/[0.1] hover:border-white/[0.24]'
                              : 'bg-[#f8f9fb] border-black/[0.09] hover:border-black/[0.22]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono opacity-55">
                            <span>
                              {isCardFlipped ? 'Answer' : 'Prompt'} · {currentCard.category}
                            </span>
                            {currentCard.pageRef && <span>p.{currentCard.pageRef}</span>}
                          </div>

                          <div className="my-auto py-6 text-center px-2">
                            <div
                              className={`text-sm sm:text-base font-medium leading-relaxed ${
                                isDark ? 'text-white' : 'text-[#0d0d0d]'
                              }`}
                            >
                              <MathMarkdown
                                content={isCardFlipped ? currentCard.back : currentCard.front}
                                isDark={isDark}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono opacity-45">
                            <span>Tap card to flip</span>
                            {cardMastery[currentCard.id] && (
                              <span className="uppercase">
                                {cardMastery[currentCard.id] === 'known' ? 'Known' : 'Review'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Compact Flashcard Navigation Pills */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={safeCardIndex === 0}
                            onClick={() => {
                              setIsCardFlipped(false);
                              setCardIndex(Math.max(0, safeCardIndex - 1));
                            }}
                            className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-colors cursor-pointer disabled:opacity-35 ${
                              isDark
                                ? 'bg-[#14161f] border-white/[0.1] text-white'
                                : 'bg-white border-black/[0.1] text-black'
                            }`}
                          >
                            Prev
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCardMastery((prev) => ({
                                  ...prev,
                                  [currentCard.id]: 'review',
                                }));
                                setIsCardFlipped(false);
                                if (safeCardIndex < deckCards.length - 1) {
                                  setCardIndex(safeCardIndex + 1);
                                }
                              }}
                              className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                                cardMastery[currentCard.id] === 'review'
                                  ? isDark
                                    ? 'bg-white/15 border-white/40 text-white'
                                    : 'bg-black/10 border-black/40 text-black'
                                  : isDark
                                  ? 'bg-[#14161f] border-white/[0.1] text-neutral-300'
                                  : 'bg-white border-black/[0.1] text-neutral-700'
                              }`}
                            >
                              Review
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCardMastery((prev) => ({
                                  ...prev,
                                  [currentCard.id]: 'known',
                                }));
                                setIsCardFlipped(false);
                                if (safeCardIndex < deckCards.length - 1) {
                                  setCardIndex(safeCardIndex + 1);
                                }
                              }}
                              className={`px-3.5 py-2 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
                                isDark
                                  ? 'bg-white text-black border-white'
                                  : 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                              }`}
                            >
                              Known
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={safeCardIndex >= deckCards.length - 1}
                            onClick={() => {
                              setIsCardFlipped(false);
                              setCardIndex(Math.min(deckCards.length - 1, safeCardIndex + 1));
                            }}
                            className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-colors cursor-pointer disabled:opacity-35 ${
                              isDark
                                ? 'bg-[#14161f] border-white/[0.1] text-white'
                                : 'bg-white border-black/[0.1] text-black'
                            }`}
                          >
                            Next
                          </button>
                        </div>
                      </>
                    ) : (
                      <div
                        className={`p-6 rounded-2xl border text-center text-xs ${
                          isDark
                            ? 'bg-[#12151e] border-white/[0.08] text-neutral-400'
                            : 'bg-[#f8f9fb] border-black/[0.08] text-neutral-600'
                        }`}
                      >
                        All flashcards marked as known. Tap Reset to review again.
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 3: SUMMARY                                            */}
                {/* ========================================================= */}
                {studioTab === 'summary' && studyBundle && (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    <div
                      className={`p-4 sm:p-5 rounded-2xl border ${
                        isDark
                          ? 'bg-[#12151e] border-white/[0.08]'
                          : 'bg-[#f8f9fb] border-black/[0.08]'
                      }`}
                    >
                      <div
                        className={`text-xs sm:text-sm leading-relaxed ${
                          isDark ? 'text-neutral-100' : 'text-neutral-900'
                        }`}
                      >
                        <MathMarkdown content={studyBundle.summary.overview} isDark={isDark} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      {studyBundle.summary.keyPoints.map((point, idx) => (
                        <div
                          key={idx}
                          className={`p-3.5 sm:p-4 rounded-2xl border flex items-start gap-2.5 ${
                            isDark
                              ? 'bg-[#11131a] border-white/[0.07]'
                              : 'bg-white border-black/[0.07]'
                          }`}
                        >
                          <span
                            className={`font-mono text-[11px] tabular-nums pt-0.5 shrink-0 ${
                              isDark ? 'text-neutral-500' : 'text-neutral-400'
                            }`}
                          >
                            {idx + 1}.
                          </span>
                          <div
                            className={`text-xs sm:text-[13px] leading-relaxed min-w-0 ${
                              isDark ? 'text-neutral-200' : 'text-neutral-800'
                            }`}
                          >
                            <MathMarkdown content={point} isDark={isDark} inline />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {studyBundle.summary.sections.map((sec, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-2xl border ${
                            isDark
                              ? 'bg-[#11131a] border-white/[0.07]'
                              : 'bg-white border-black/[0.07]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold">{sec.title}</span>
                            <span
                              className={`text-[10px] font-mono tabular-nums ${
                                isDark ? 'text-neutral-500' : 'text-neutral-400'
                              }`}
                            >
                              p.{sec.pageNumber}
                            </span>
                          </div>
                          <div
                            className={`text-xs leading-relaxed ${
                              isDark ? 'text-neutral-400' : 'text-neutral-600'
                            }`}
                          >
                            <MathMarkdown content={sec.summary} isDark={isDark} inline />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 4: CONCEPTS & MATH                                    */}
                {/* ========================================================= */}
                {studioTab === 'explanation' && studyBundle && (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {/* Compact Single-Row Scrollable Deep Lens Pills (Replaces Stacked Cards) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap pb-0.5">
                      {(
                        [
                          { id: 'math', label: 'Explain Math & Equations' },
                          { id: 'contributions', label: 'Key Contributions' },
                          { id: 'methodology', label: 'Methodology' },
                        ] as const
                      ).map((lens) => {
                        const active = activeActionTab === lens.id;
                        return (
                          <button
                            key={lens.id}
                            type="button"
                            onClick={() => runPaperDeepBreakdown(lens.id)}
                            className={`px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer shrink-0 ${
                              active
                                ? isDark
                                  ? 'bg-white text-black border-white font-semibold'
                                  : 'bg-[#0d0d0d] text-white border-[#0d0d0d] font-semibold'
                                : isDark
                                ? 'bg-[#12151e] border-white/[0.09] text-neutral-300 hover:text-white'
                                : 'bg-[#f8f9fb] border-black/[0.08] text-neutral-700 hover:text-black'
                            }`}
                          >
                            {lens.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Deep Lens Output if active */}
                    {(isCopilotLoading || copilotResponse) && (
                      <div
                        className={`p-4 sm:p-5 rounded-2xl border ${
                          isDark
                            ? 'bg-[#12151e] border-white/[0.1]'
                            : 'bg-[#f8f9fb] border-black/[0.09]'
                        }`}
                      >
                        {isCopilotLoading ? (
                          <div className="py-6 flex items-center justify-center gap-2 text-xs text-neutral-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Synthesizing breakdown...</span>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-current/10">
                              <span className="text-xs font-semibold">Analysis</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(copilotResponse);
                                  setCopiedAnalysis(true);
                                  setTimeout(() => setCopiedAnalysis(false), 2000);
                                }}
                                className="text-[11px] font-medium opacity-70 hover:opacity-100 cursor-pointer"
                              >
                                {copiedAnalysis ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <div className="prose-grok max-w-none text-xs sm:text-sm leading-relaxed">
                              <MathMarkdown content={copilotResponse} isDark={isDark} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Clean Concept Cards with KaTeX Rendering */}
                    <div className="space-y-2.5">
                      {studyBundle.explanation.concepts.map((concept, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-2xl border ${
                            isDark
                              ? 'bg-[#11131a] border-white/[0.08]'
                              : 'bg-white border-black/[0.08]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <h4 className="text-xs sm:text-sm font-semibold">{concept.term}</h4>
                            {concept.pageRef && (
                              <span
                                className={`text-[10px] font-mono tabular-nums ${
                                  isDark ? 'text-neutral-500' : 'text-neutral-400'
                                }`}
                              >
                                p.{concept.pageRef}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5 text-xs leading-relaxed">
                            <div className={isDark ? 'text-neutral-200' : 'text-neutral-800'}>
                              <MathMarkdown content={concept.definition} isDark={isDark} inline />
                            </div>
                            {concept.mechanism && concept.mechanism !== concept.definition && (
                              <div className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>
                                <MathMarkdown content={concept.mechanism} isDark={isDark} inline />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 5: CHEATSHEET & NOTES                                 */}
                {/* ========================================================= */}
                {studioTab === 'cheatsheet' && studyBundle && (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {/* Core Equations & Rules */}
                    <div className="space-y-2.5">
                      {studyBundle.cheatsheet.formulasOrRules.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-2xl border ${
                            isDark
                              ? 'bg-[#12151e] border-white/[0.08]'
                              : 'bg-[#f8f9fb] border-black/[0.08]'
                          }`}
                        >
                          <div className="text-xs font-semibold mb-2">{item.label}</div>
                          <div
                            className={`text-xs px-3 py-2 rounded-xl mb-2 overflow-x-auto ${
                              isDark ? 'bg-white/[0.04] text-white' : 'bg-black/[0.035] text-black'
                            }`}
                          >
                            <MathMarkdown
                              content={
                                item.expression.includes('$')
                                  ? item.expression
                                  : `$${item.expression}$`
                              }
                              isDark={isDark}
                              inline
                            />
                          </div>
                          <div
                            className={`text-xs leading-relaxed ${
                              isDark ? 'text-neutral-300' : 'text-neutral-700'
                            }`}
                          >
                            <MathMarkdown content={item.meaning} isDark={isDark} inline />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Key Review Points */}
                    <div
                      className={`p-4 rounded-2xl border space-y-2 ${
                        isDark
                          ? 'bg-[#11131a] border-white/[0.08]'
                          : 'bg-white border-black/[0.08]'
                      }`}
                    >
                      {studyBundle.cheatsheet.examTips.map((tip, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                          <span className="font-mono opacity-45 shrink-0">{idx + 1}.</span>
                          <div className="min-w-0">
                            <MathMarkdown content={tip} isDark={isDark} inline />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Personal Notes */}
                    <div>
                      <textarea
                        value={userNotes}
                        onChange={(e) => {
                          const val = e.target.value;
                          setUserNotes(val);
                          try {
                            localStorage.setItem(`kinich_pdf_notes_${activePdfName}`, val);
                          } catch {}
                        }}
                        rows={4}
                        placeholder="Add personal study notes..."
                        className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm leading-relaxed outline-none resize-y ${
                          isDark
                            ? 'bg-[#11131a] border-white/[0.1] text-white placeholder-neutral-500 focus:border-white/30'
                            : 'bg-[#f8f9fb] border-black/[0.1] text-black placeholder-neutral-400 focus:border-black/30'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 6: ASK PDF                                            */}
                {/* ========================================================= */}
                {studioTab === 'chat' && (
                  <div className="flex flex-col h-[68vh] max-w-3xl mx-auto">
                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                      {chatTurns.length === 0 ? (
                        <div className="space-y-2 pt-1">
                          {[
                            'Give me a 5-bullet executive briefing of this PDF',
                            'Quiz me with 3 hard open-ended questions on this document',
                            'Extract all quantitative metrics, tables, and LaTeX formulas',
                            'What are the main limitations or counterarguments?',
                          ].map((qText, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSendPdfChat(qText)}
                              className={`w-full px-4 py-3 rounded-2xl border text-xs text-left transition-colors cursor-pointer ${
                                isDark
                                  ? 'bg-[#12151e] border-white/[0.08] text-neutral-200 hover:border-white/25'
                                  : 'bg-[#f8f9fb] border-black/[0.08] text-neutral-800 hover:border-black/25'
                              }`}
                            >
                              {qText}
                            </button>
                          ))}
                        </div>
                      ) : (
                        chatTurns.map((turn) => (
                          <div
                            key={turn.id}
                            className={`p-3.5 sm:p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed ${
                              turn.role === 'user'
                                ? isDark
                                  ? 'bg-white/[0.07] border-white/[0.14] ml-8'
                                  : 'bg-black/[0.04] border-black/[0.09] ml-8'
                                : isDark
                                ? 'bg-[#12151e] border-white/[0.08] mr-2'
                                : 'bg-white border-black/[0.08] mr-2'
                            }`}
                          >
                            <div className="prose-grok max-w-none text-xs sm:text-sm leading-relaxed">
                              <MathMarkdown content={turn.content} isDark={isDark} />
                            </div>
                          </div>
                        ))
                      )}

                      {isChatLoading && (
                        <div
                          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${
                            isDark
                              ? 'bg-[#12151e] border-white/[0.08] text-neutral-400'
                              : 'bg-white border-black/[0.08] text-neutral-600'
                          }`}
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Analyzing document...</span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendPdfChat();
                      }}
                      className="mt-3 pt-2.5 border-t border-current/10 flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        placeholder={`Ask about ${activePdfName}...`}
                        className={`flex-1 px-4 py-2.5 rounded-full border text-xs sm:text-sm outline-none ${
                          isDark
                            ? 'bg-[#12151e] border-white/[0.12] text-white placeholder-neutral-500 focus:border-white/30'
                            : 'bg-[#f8f9fb] border-black/[0.12] text-black placeholder-neutral-400 focus:border-black/30'
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={!chatDraft.trim() || isChatLoading}
                        className={`px-4 py-2.5 rounded-full text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 shrink-0 ${
                          isDark
                            ? 'bg-white text-black hover:bg-neutral-200'
                            : 'bg-[#0d0d0d] text-white hover:bg-neutral-800'
                        }`}
                      >
                        Ask
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Interactive Floating Text-Selection Action Menu */}
        {selectionMenu && (
          <div
            style={{
              left: `${selectionMenu.x}px`,
              top: `${selectionMenu.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
            className={`absolute z-50 flex items-center gap-1 p-1 rounded-full border shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 ${
              isDark
                ? 'bg-[#18181b]/95 border-white/20 text-white shadow-black/90'
                : 'bg-white/95 border-black/15 text-black shadow-black/20'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                const txt = selectionMenu.text;
                setSelectionMenu(null);
                runPaperDeepBreakdown(
                  'custom',
                  `Summarize and explain this passage from the document:\n\n"${txt}"`
                );
              }}
              className="px-2.5 py-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-xs font-medium"
            >
              Summarize
            </button>
            <button
              type="button"
              onClick={() => {
                const txt = selectionMenu.text;
                setSelectionMenu(null);
                runPaperDeepBreakdown(
                  'custom',
                  `Explain the mathematical and technical meaning of this passage from first principles:\n\n"${txt}"`
                );
              }}
              className="px-2.5 py-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-xs font-medium"
            >
              Explain
            </button>
            <button
              type="button"
              onClick={() => {
                const txt = selectionMenu.text;
                setSelectionMenu(null);
                setStudioTab('chat');
                handleSendPdfChat(
                  `Create 3 flashcards and 2 multiple-choice quiz questions specifically testing this passage:\n\n"${txt}"`
                );
              }}
              className="px-2.5 py-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-xs font-medium"
            >
              Quiz This
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
