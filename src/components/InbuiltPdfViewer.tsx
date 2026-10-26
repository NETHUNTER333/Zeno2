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
import { speakTextWithSmallestAi, stopSmallestSpeech } from '../lib/smallestAi';
import { getAuthHeaders } from '../lib/firebase';
import { ArxivPaper } from '../types';
import {
  DocumentStudyBundle,
  extractTextFromPdfFile,
  buildDeterministicDocumentStudyBundle,
} from '../lib/pdfStudyEngine';

export type PdfStudioTab =
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
  onAskZeno?: (prompt: string) => void;
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
  pdfName: initialPdfName,
  title: initialTitle,
  arxivId,
  authors,
  published,
  summary: initialSummary,
  extractedText: initialExtractedText = '',
  initialTab = 'quiz',
  isDark = true,
  onAskZeno,
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

  const containerRef = useRef<HTMLDivElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const studyRequestSeqRef = useRef<number>(0);

  // Synthesize study bundle (Quiz, Flashcards, Summary, Concepts, Cheatsheet) from document text
  const generateStudyBundleForDoc = async (
    docTitle: string,
    docText: string,
    pages = 1,
    targetDifficulty: 'easy' | 'medium' | 'hard' = difficulty
  ) => {
    const reqSeq = ++studyRequestSeqRef.current;
    const fallbackBundle = buildDeterministicDocumentStudyBundle(
      docTitle,
      docText,
      pages,
      targetDifficulty
    );
    setStudyBundle(fallbackBundle);
    setCardIndex(0);
    setIsCardFlipped(false);
    setShuffledCardIds(null);
    setQuizAnswers({});
    setRetryIncorrectOnly(false);

    if (!docText || docText.trim().length < 25) {
      setIsSynthesizingBundle(false);
      return;
    }

    // If this document matched our handcrafted Easy/Medium/Hard Transformer mastery bank, preserve it immediately
    if (fallbackBundle.quiz[0]?.id?.startsWith('tf-')) {
      setIsSynthesizingBundle(false);
      return;
    }

    setIsSynthesizingBundle(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await callZenoApi('/api/pdf/study', {
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
        setStudyBundle({
          title: docTitle.replace(/\.pdf$/i, ''),
          pageCount: pages,
          wordCount: fallbackBundle.wordCount,
          readTimeMin: fallbackBundle.readTimeMin,
          summary: {
            overview: remote?.summary?.overview || fallbackBundle.summary.overview,
            keyPoints:
              Array.isArray(remote?.summary?.keyPoints) && remote.summary.keyPoints.length > 0
                ? remote.summary.keyPoints
                : fallbackBundle.summary.keyPoints,
            sections:
              Array.isArray(remote?.summary?.sections) && remote.summary.sections.length > 0
                ? remote.summary.sections
                : fallbackBundle.summary.sections,
          },
          explanation: {
            coreThesis: remote?.explanation?.coreThesis || fallbackBundle.explanation.coreThesis,
            concepts:
              Array.isArray(remote?.explanation?.concepts) && remote.explanation.concepts.length > 0
                ? remote.explanation.concepts
                : fallbackBundle.explanation.concepts,
          },
          flashcards:
            Array.isArray(remote?.flashcards) && remote.flashcards.length >= 4
              ? remote.flashcards.map((fc: any, idx: number) => ({
                  id: fc.id || `pdf-fc-${targetDifficulty}-${idx + 1}`,
                  front: String(fc.front || ''),
                  back: String(fc.back || ''),
                  category: String(fc.category || 'Core Concept'),
                  pageRef: Number(fc.pageRef) || 1,
                  difficulty: targetDifficulty,
                }))
              : fallbackBundle.flashcards,
          quiz:
            Array.isArray(remote?.quiz) && remote.quiz.length >= 4
              ? remote.quiz.map((q: any, idx: number) => ({
                  id: q.id || `pdf-q-${targetDifficulty}-${idx + 1}`,
                  question: String(q.question || ''),
                  options:
                    Array.isArray(q.options) && q.options.length >= 2
                      ? q.options.map(String)
                      : fallbackBundle.quiz[0].options,
                  correctIndex:
                    typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4
                      ? q.correctIndex
                      : 0,
                  explanation: String(q.explanation || ''),
                  pageRef: Number(q.pageRef) || 1,
                  difficulty: targetDifficulty,
                }))
              : fallbackBundle.quiz,
          cheatsheet: {
            formulasOrRules:
              Array.isArray(remote?.cheatsheet?.formulasOrRules) &&
              remote.cheatsheet.formulasOrRules.length > 0
                ? remote.cheatsheet.formulasOrRules
                : fallbackBundle.cheatsheet.formulasOrRules,
            examTips:
              Array.isArray(remote?.cheatsheet?.examTips) &&
              remote.cheatsheet.examTips.length > 0
                ? remote.cheatsheet.examTips
                : fallbackBundle.cheatsheet.examTips,
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
      const savedNote = localStorage.getItem(`zeno_pdf_notes_${resolvedInitialTitle}`);
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
      const res = await callZenoApi('/api/chat', {
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
      const res = await callZenoApi('/api/chat', {
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

        {/* Top Full-Page Studio Header Bar */}
        <div
          className={`px-3 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b flex flex-wrap items-center justify-between gap-2.5 shrink-0 ${
            isDark ? 'bg-[#101218] border-white/[0.08]' : 'bg-[#f8f9fa] border-black/[0.08]'
          }`}
        >
          {/* Left: Back to Chat + Document Title & Metadata */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-white/[0.05] border-white/[0.12] hover:bg-white/[0.1] text-white'
                  : 'bg-white border-black/[0.1] hover:bg-black/[0.04] text-[#0d0d0d]'
              }`}
              title="Back to Chat"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Back</span>
            </button>

            <div
              className={`size-9 sm:size-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                isDark
                  ? 'bg-red-500/15 border-red-500/30 text-red-400'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  className="font-semibold text-sm sm:text-base truncate max-w-[200px] sm:max-w-md"
                  title={activePdfName}
                >
                  {activePdfName}
                </h2>
                {(isExtractingPdf || isSynthesizingBundle) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{isExtractingPdf ? 'Reading PDF...' : 'Synthesizing...'}</span>
                  </span>
                )}
              </div>

              <div
                className={`flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              >
                <span>PDF Study & Quiz Studio</span>
                <span aria-hidden="true">·</span>
                <span>{studyBundle?.pageCount || activePageCount} pages</span>
                {studyBundle?.wordCount ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{studyBundle.wordCount.toLocaleString()} words</span>
                    <span aria-hidden="true">·</span>
                    <span>{studyBundle.readTimeMin} min read</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right Controls: Upload PDF, Search ArXiv, Layout Switcher, Audio, Export, Close */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Upload New PDF Button */}
            <button
              type="button"
              onClick={() => fileUploadInputRef.current?.click()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isDark
                  ? 'bg-white text-black border-white hover:bg-neutral-200 shadow-xs'
                  : 'bg-[#0d0d0d] text-white border-black hover:bg-neutral-800 shadow-xs'
              }`}
              title="Upload any PDF or document from your device"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF</span>
            </button>

            {/* ArXiv Search Drawer Toggle */}
            <button
              type="button"
              onClick={() => setShowArxivSearchDrawer(!showArxivSearchDrawer)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showArxivSearchDrawer
                  ? isDark
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-black/10 border-black/30 text-black'
                  : isDark
                  ? 'bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.08] text-neutral-300'
                  : 'bg-white border-black/[0.1] hover:bg-black/[0.04] text-neutral-700'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search ArXiv</span>
            </button>

            {/* Layout Mode Switcher (Studio | Split | PDF Reader) */}
            <div
              className={`flex items-center p-0.5 rounded-xl border text-xs font-medium ${
                isDark ? 'bg-[#151821] border-white/[0.08]' : 'bg-neutral-100 border-black/[0.08]'
              }`}
            >
              <button
                type="button"
                onClick={() => setLayoutMode('studio')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  layoutMode === 'studio'
                    ? isDark
                      ? 'bg-white text-black font-semibold'
                      : 'bg-[#0d0d0d] text-white font-semibold'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title="Expanded Quiz & Flashcards Studio"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Studio</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('split')}
                className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  layoutMode === 'split'
                    ? isDark
                      ? 'bg-white text-black font-semibold'
                      : 'bg-[#0d0d0d] text-white font-semibold'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title="Split PDF + Study Studio"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('document')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  layoutMode === 'document'
                    ? isDark
                      ? 'bg-white text-black font-semibold'
                      : 'bg-[#0d0d0d] text-white font-semibold'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title="Full Document Reader"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Reader</span>
              </button>
            </div>

            {/* Read Aloud TTS */}
            <button
              type="button"
              onClick={handleToggleReadAloud}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isPlayingTts
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : isDark
                  ? 'bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.08] text-neutral-300'
                  : 'bg-white border-black/[0.1] hover:bg-black/[0.04] text-neutral-700'
              }`}
              title="Read Summary or Analysis Aloud"
            >
              {isPlayingTts ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Export Complete Study Pack (.md) */}
            <button
              type="button"
              onClick={handleExportStudyPackMarkdown}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isDark
                  ? 'bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.08] text-neutral-200'
                  : 'bg-white border-black/[0.1] hover:bg-black/[0.04] text-neutral-800'
              }`}
              title="Download Study Guide, Flashcards & Quiz as Markdown"
            >
              {copiedStudyPack ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Export Pack</span>
            </button>

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/[0.04] border-white/[0.12] hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 text-neutral-300'
                  : 'bg-white border-black/[0.1] hover:bg-red-50 hover:text-red-600 text-neutral-700'
              }`}
              title="Close Studio (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible ArXiv Search Drawer */}
        {showArxivSearchDrawer && (
          <div
            className={`px-6 py-4 border-b z-10 ${
              isDark ? 'bg-[#12151f] border-white/[0.08]' : 'bg-slate-50 border-black/[0.08]'
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
                  placeholder="Search ArXiv papers by title, author, topic, or ID (e.g. Attention Is All You Need, DeepSeek-R1)..."
                  className={`flex-1 px-4 py-2.5 rounded-xl border text-xs outline-none ${
                    isDark
                      ? 'bg-[#0b0c10] border-white/[0.12] text-white placeholder-neutral-500'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleSearchArxiv()}
                  disabled={isSearchingArxiv || !arxivSearchQuery.trim()}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
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
                    'Mamba Linear-Time Sequence Modeling',
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
                          ? 'bg-[#181b24] border-white/[0.1] hover:border-white/30 text-neutral-300'
                          : 'bg-white border-slate-200 hover:border-slate-400 text-slate-700'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {arxivResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pt-1">
                  {arxivResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectArxivPaper(p)}
                      className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-[#0b0c10] border-white/[0.1] hover:border-white/40'
                          : 'bg-white border-slate-200 hover:border-slate-900'
                      }`}
                    >
                      <div className="text-[10px] font-mono text-sky-400">
                        arXiv:{p.id} · {p.categories.slice(0, 2).join(', ')}
                      </div>
                      <div className="text-xs font-semibold line-clamp-1 mt-0.5">{p.title}</div>
                      <div className="text-[11px] text-neutral-500 line-clamp-2 mt-1">
                        {p.summary}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Workspace Split Grid */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* LEFT PANE: PDF Viewer / Extracted Text Reader + Quick Dropzone */}
          {layoutMode !== 'studio' && (
            <div
              className={`min-h-0 overflow-y-auto scrollbar-thin p-4 sm:p-5 flex flex-col gap-3 ${
                layoutMode === 'split' ? 'lg:col-span-5 border-b lg:border-b-0 lg:border-r' : 'lg:col-span-12'
              } ${
                isDark ? 'border-white/[0.08] bg-[#090a0e]' : 'border-black/[0.08] bg-[#f3f4f6]'
              }`}
            >
              {/* Reader Sub-Toolbar */}
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div
                  className={`inline-flex items-center p-0.5 rounded-xl border text-xs font-medium ${
                    isDark ? 'bg-[#141720] border-white/[0.08]' : 'bg-white border-black/[0.08]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('pdf')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'pdf'
                        ? isDark
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#0d0d0d] text-white font-semibold'
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
                        ? isDark
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#0d0d0d] text-white font-semibold'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    Extracted Text
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {viewMode === 'reader' && (
                    <div
                      className={`inline-flex items-center gap-0.5 p-0.5 rounded-xl border ${
                        isDark ? 'bg-[#141720] border-white/[0.08]' : 'bg-white border-black/[0.08]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setReaderTheme('dark')}
                        className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                        title="Dark Reader"
                      >
                        <Moon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaderTheme('sepia')}
                        className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                        title="Sepia Reader"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaderTheme('light')}
                        className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                        title="Light Reader"
                      >
                        <Sun className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {directPdfUrl && (
                    <a
                      href={directPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-1.5 rounded-xl border transition-colors ${
                        isDark
                          ? 'bg-[#141720] border-white/[0.08] hover:bg-white/10 text-neutral-300'
                          : 'bg-white border-black/[0.08] hover:bg-black/5 text-neutral-700'
                      }`}
                      title="Open Original PDF in New Tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* PDF Viewer or Clean Text Layer */}
              {viewMode === 'pdf' && directPdfUrl ? (
                <div className="flex-1 min-h-[380px] w-full rounded-2xl overflow-hidden border border-black/15 dark:border-white/15 shadow-xl bg-black">
                  <iframe
                    src={onlinePdfEmbedUrl}
                    title={activePdfName}
                    className="w-full h-full min-h-[56vh] border-0 block"
                  />
                </div>
              ) : (
                <div
                  className={`flex-1 w-full p-5 sm:p-6 rounded-2xl border shadow-md leading-relaxed whitespace-pre-wrap text-xs sm:text-sm overflow-y-auto ${getReaderSurfaceClass()}`}
                >
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-current/10">
                    <span className="font-semibold text-sm">{activePdfName}</span>
                    <span className="text-[11px] font-mono opacity-60">
                      Highlight any sentence for instant math/summary popup
                    </span>
                  </div>
                  {activeExtractedText ||
                    'Upload a PDF document using the "Upload PDF" button above or drag-and-drop any PDF onto this studio.'}
                </div>
              )}
            </div>
          )}

          {/* RIGHT PANE: Interactive Quiz, Flashcards, Summary, Concepts, Cheatsheet & Ask PDF Studio */}
          {layoutMode !== 'document' && (
            <div
              className={`min-h-0 flex flex-col h-full overflow-hidden ${
                layoutMode === 'split' ? 'lg:col-span-7' : 'lg:col-span-12'
              } ${isDark ? 'bg-[#0b0c10] text-white' : 'bg-white text-[#0d0d0d]'}`}
            >
              {/* Segmented Studio Navigation Bar */}
              <div
                className={`px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${
                  isDark ? 'bg-[#101218] border-white/[0.08]' : 'bg-[#f8f9fa] border-black/[0.08]'
                }`}
              >
                <div
                  className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl border ${
                    isDark ? 'bg-[#161922] border-white/[0.08]' : 'bg-[#ededf0] border-black/[0.06]'
                  }`}
                >
                  {(
                    [
                      {
                        id: 'quiz',
                        label: `Quiz${allQuizItems.length ? ` (${allQuizItems.length})` : ''}`,
                        icon: HelpCircle,
                      },
                      {
                        id: 'flashcards',
                        label: `Flashcards${
                          allFlashcards.length ? ` (${allFlashcards.length})` : ''
                        }`,
                        icon: Layers,
                      },
                      { id: 'summary', label: 'Summary', icon: ListTree },
                      { id: 'explanation', label: 'Concepts & Math', icon: Sigma },
                      { id: 'cheatsheet', label: 'Cheatsheet & Notes', icon: ListChecks },
                      { id: 'chat', label: 'Ask PDF', icon: MessageSquare },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const active = studioTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStudioTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? isDark
                              ? 'bg-white text-black font-semibold shadow-xs'
                              : 'bg-[#0d0d0d] text-white font-semibold shadow-xs'
                            : isDark
                            ? 'text-neutral-400 hover:text-white'
                            : 'text-neutral-600 hover:text-black'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Difficulty Selector & Regenerate Control */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`inline-flex items-center p-0.5 rounded-xl border text-[11px] font-medium ${
                      isDark ? 'bg-[#161922] border-white/[0.08]' : 'bg-[#ededf0] border-black/[0.06]'
                    }`}
                  >
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
                        className={`px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer whitespace-nowrap ${
                          difficulty === lvl
                            ? isDark
                              ? 'bg-white/15 text-white font-semibold'
                              : 'bg-white text-black font-semibold shadow-2xs'
                            : 'text-neutral-500 hover:text-current'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      generateStudyBundleForDoc(
                        activePdfName,
                        activeExtractedText,
                        activePageCount,
                        difficulty
                      )
                    }
                    disabled={isSynthesizingBundle}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#161922] border-white/[0.08] hover:bg-white/[0.08] text-neutral-300'
                        : 'bg-white border-black/[0.08] hover:bg-black/[0.04] text-neutral-700'
                    }`}
                    title="Regenerate fresh Quiz & Flashcards from PDF"
                  >
                    <RotateCcw
                      className={`w-3.5 h-3.5 ${isSynthesizingBundle ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Padded Studio Content Viewport */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
                {/* Interactive PDF Upload & Study Deck Launchpad when no custom PDF is uploaded yet */}
                {!activePdfUrl && (
                  <div
                    className={`mb-5 p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-3xl mx-auto ${
                      isDark
                        ? 'bg-[#131722] border-white/[0.12] text-white'
                        : 'bg-[#f4f6fa] border-black/[0.09] text-[#0d0d0d]'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                        <span>Upload any PDF or Lecture Slides for Instant Quiz & Flashcards</span>
                      </div>
                      <p
                        className={`text-[11px] sm:text-xs leading-relaxed ${
                          isDark ? 'text-neutral-400' : 'text-neutral-600'
                        }`}
                      >
                        Drop a PDF anywhere or click Upload to extract every page into interactive multiple-choice quizzes, 3D flip flashcards, and LaTeX concept breakdowns.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileUploadInputRef.current?.click()}
                        className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          isDark
                            ? 'bg-white text-black hover:bg-neutral-200'
                            : 'bg-[#0d0d0d] text-white hover:bg-neutral-800'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose PDF File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowArxivSearchDrawer(true)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          isDark
                            ? 'bg-white/[0.05] border-white/[0.12] hover:bg-white/[0.1] text-neutral-200'
                            : 'bg-white border-black/[0.12] hover:bg-black/[0.04] text-neutral-800'
                        }`}
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>ArXiv Papers</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 1: INTERACTIVE QUIZ                                   */}
                {/* ========================================================= */}
                {studioTab === 'quiz' && (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {/* Quiz Score & Mastery Header Card */}
                    <div
                      className={`p-4 sm:p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
                        isDark
                          ? 'bg-[#12151e] border-white/[0.09]'
                          : 'bg-[#f8f9fb] border-black/[0.08]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-semibold flex items-center gap-2">
                          <span>Document Mastery Quiz</span>
                          <span
                            className={`text-[11px] font-mono tabular-nums ${
                              isDark ? 'text-neutral-400' : 'text-neutral-500'
                            }`}
                          >
                            · {difficulty.toUpperCase()}
                          </span>
                        </div>
                        <div
                          className={`text-xs font-mono tabular-nums ${
                            isDark ? 'text-neutral-300' : 'text-neutral-700'
                          }`}
                        >
                          Score: <strong className="text-emerald-400">{correctQuizCount}</strong> /{' '}
                          {allQuizItems.length} · Answered: {answeredQuizCount} · Accuracy:{' '}
                          <strong>{accuracyPct}%</strong>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {answeredQuizCount > 0 && correctQuizCount < answeredQuizCount && (
                          <button
                            type="button"
                            onClick={() => setRetryIncorrectOnly(!retryIncorrectOnly)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                              retryIncorrectOnly
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : isDark
                                ? 'bg-[#181c26] border-white/[0.1] text-neutral-300 hover:text-white'
                                : 'bg-white border-black/[0.1] text-neutral-700 hover:text-black'
                            }`}
                          >
                            {retryIncorrectOnly ? 'Showing Missed Only' : 'Filter Missed'}
                          </button>
                        )}

                        {answeredQuizCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuizAnswers({});
                              setRetryIncorrectOnly(false);
                            }}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                              isDark
                                ? 'bg-[#181c26] border-white/[0.1] text-neutral-300 hover:text-white'
                                : 'bg-white border-black/[0.1] text-neutral-700 hover:text-black'
                            }`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Answers</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quiz Questions List */}
                    <div className="space-y-4">
                      {visibleQuizItems.map((q, qIdx) => {
                        const selectedOpt = quizAnswers[q.id];
                        const hasAnswered = selectedOpt !== undefined;

                        return (
                          <div
                            key={q.id}
                            className={`p-5 rounded-2xl border transition-all ${
                              isDark
                                ? 'bg-[#11131a] border-white/[0.08]'
                                : 'bg-white border-black/[0.08] shadow-2xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3.5">
                              <div className="text-xs sm:text-sm font-semibold leading-relaxed">
                                <span
                                  className={`font-mono tabular-nums mr-2 ${
                                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                                  }`}
                                >
                                  Q{qIdx + 1}.
                                </span>
                                {q.question}
                              </div>
                              {q.pageRef && (
                                <span
                                  className={`text-[11px] font-mono tabular-nums shrink-0 ${
                                    isDark ? 'text-neutral-400' : 'text-neutral-500'
                                  }`}
                                >
                                  Page {q.pageRef}
                                </span>
                              )}
                            </div>

                            <div className="space-y-2">
                              {q.options.map((opt, oIdx) => {
                                const isSelected = selectedOpt === oIdx;
                                const isCorrect = q.correctIndex === oIdx;

                                let optionStyle = isDark
                                  ? 'bg-[#171a24] border-white/[0.08] text-neutral-200 hover:border-white/[0.24]'
                                  : 'bg-[#f8f9fa] border-black/[0.08] text-neutral-800 hover:border-black/[0.25]';

                                if (hasAnswered) {
                                  if (isCorrect) {
                                    optionStyle =
                                      'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-medium';
                                  } else if (isSelected && !isCorrect) {
                                    optionStyle =
                                      'bg-red-500/15 border-red-500/40 text-red-300';
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
                                    className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start justify-between gap-3 cursor-pointer disabled:cursor-default ${optionStyle}`}
                                  >
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <span className="font-mono text-[11px] opacity-75 shrink-0 pt-0.5">
                                        {String.fromCharCode(65 + oIdx)}.
                                      </span>
                                      <span className="leading-relaxed">{opt}</span>
                                    </div>

                                    {hasAnswered && isCorrect && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-emerald-400 shrink-0">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Correct</span>
                                      </span>
                                    )}
                                    {hasAnswered && isSelected && !isCorrect && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-red-400 shrink-0">
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>Incorrect</span>
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {hasAnswered && q.explanation && (
                              <div
                                className={`mt-3.5 p-3.5 rounded-xl border text-xs leading-relaxed ${
                                  isDark
                                    ? 'bg-white/[0.03] border-white/[0.08] text-neutral-300'
                                    : 'bg-slate-50 border-black/[0.08] text-neutral-700'
                                }`}
                              >
                                <span className="font-semibold">First-Principles Explanation: </span>
                                {q.explanation}
                              </div>
                            )}
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
                  <div className="space-y-5 max-w-3xl mx-auto">
                    {/* Flashcard Deck Status & Controls Bar */}
                    <div
                      className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                        isDark
                          ? 'bg-[#12151e] border-white/[0.09]'
                          : 'bg-[#f8f9fb] border-black/[0.08]'
                      }`}
                    >
                      <div className="text-xs font-mono tabular-nums">
                        {deckCards.length > 0
                          ? `Card ${safeCardIndex + 1} of ${deckCards.length}`
                          : '0 cards'}{' '}
                        · Known: <strong className="text-emerald-400">{knownCount}</strong> ·
                        Review: <strong className="text-amber-400">{reviewCount}</strong>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
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
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-[#181c26] border-white/[0.1] text-neutral-300 hover:text-white'
                              : 'bg-white border-black/[0.1] text-neutral-700 hover:text-black'
                          }`}
                          title="Shuffle Flashcards"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          <span>Shuffle</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFilterReviewOnly((prev) => !prev);
                            setCardIndex(0);
                            setIsCardFlipped(false);
                          }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                            filterReviewOnly
                              ? isDark
                                ? 'bg-white text-black border-white'
                                : 'bg-[#0d0d0d] text-white border-black'
                              : isDark
                              ? 'bg-[#181c26] border-white/[0.1] text-neutral-300 hover:text-white'
                              : 'bg-white border-black/[0.1] text-neutral-700 hover:text-black'
                          }`}
                        >
                          {filterReviewOnly ? 'Showing Unmastered' : 'Filter Unmastered'}
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
                          className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-[#181c26] border-white/[0.1] text-neutral-400 hover:text-white'
                              : 'bg-white border-black/[0.1] text-neutral-600 hover:text-black'
                          }`}
                          title="Reset Flashcard Mastery"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {currentCard ? (
                      <>
                        {/* Interactive Padded Flip Card */}
                        <div
                          onClick={() => setIsCardFlipped((prev) => !prev)}
                          className={`min-h-[290px] p-7 sm:p-9 rounded-3xl border flex flex-col justify-between transition-all cursor-pointer select-none ${
                            isDark
                              ? 'bg-[#131620] border-white/[0.12] hover:border-white/[0.28] shadow-[0_16px_50px_rgba(0,0,0,0.55)]'
                              : 'bg-[#f8f9fb] border-black/[0.12] hover:border-black/[0.28] shadow-lg'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-mono">
                            <span className={isDark ? 'text-neutral-400' : 'text-neutral-500'}>
                              {isCardFlipped ? 'ANSWER / EXPLANATION' : 'QUESTION PROMPT'} ·{' '}
                              {currentCard.category}
                            </span>
                            {currentCard.pageRef && (
                              <span
                                className={`tabular-nums ${
                                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                                }`}
                              >
                                Page {currentCard.pageRef}
                              </span>
                            )}
                          </div>

                          <div className="my-auto py-8 text-center px-3">
                            <p
                              className={`text-base sm:text-xl font-semibold leading-relaxed ${
                                isDark ? 'text-white' : 'text-[#0d0d0d]'
                              }`}
                            >
                              {isCardFlipped ? currentCard.back : currentCard.front}
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className={isDark ? 'text-neutral-500' : 'text-neutral-400'}>
                              Click card or press Space to flip · ← / → to navigate
                            </span>
                            {cardMastery[currentCard.id] && (
                              <span
                                className={`uppercase font-semibold ${
                                  cardMastery[currentCard.id] === 'known'
                                    ? 'text-emerald-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {cardMastery[currentCard.id] === 'known'
                                  ? 'MASTERED'
                                  : 'NEEDS REVIEW'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Flashcard Action Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={safeCardIndex === 0}
                            onClick={() => {
                              setIsCardFlipped(false);
                              setCardIndex(Math.max(0, safeCardIndex - 1));
                            }}
                            className={`px-4 py-2.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                              isDark
                                ? 'bg-[#161922] border-white/[0.1] text-white hover:bg-white/[0.06]'
                                : 'bg-white border-black/[0.1] text-black hover:bg-black/[0.04]'
                            }`}
                          >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Previous</span>
                          </button>

                          <div className="flex items-center gap-2">
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
                              className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                                cardMastery[currentCard.id] === 'review'
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                  : isDark
                                  ? 'bg-[#161922] border-white/[0.1] text-neutral-300 hover:text-white'
                                  : 'bg-white border-black/[0.1] text-neutral-700 hover:text-black'
                              }`}
                            >
                              Review Again
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
                              className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                                cardMastery[currentCard.id] === 'known'
                                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                  : isDark
                                  ? 'bg-white text-black border-white hover:bg-neutral-200'
                                  : 'bg-[#0d0d0d] text-white border-black hover:bg-neutral-800'
                              }`}
                            >
                              Mark Known
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={safeCardIndex >= deckCards.length - 1}
                            onClick={() => {
                              setIsCardFlipped(false);
                              setCardIndex(Math.min(deckCards.length - 1, safeCardIndex + 1));
                            }}
                            className={`px-4 py-2.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                              isDark
                                ? 'bg-[#161922] border-white/[0.1] text-white hover:bg-white/[0.06]'
                                : 'bg-white border-black/[0.1] text-black hover:bg-black/[0.04]'
                            }`}
                          >
                            <span>Next</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Deck Overview Grid */}
                        <div className="pt-3">
                          <div
                            className={`text-xs font-semibold mb-2.5 ${
                              isDark ? 'text-neutral-300' : 'text-neutral-700'
                            }`}
                          >
                            All Cards in Deck ({deckCards.length})
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {deckCards.map((fc, idx) => {
                              const status = cardMastery[fc.id];
                              const isCurrent = idx === safeCardIndex;
                              return (
                                <button
                                  key={fc.id}
                                  type="button"
                                  onClick={() => {
                                    setCardIndex(idx);
                                    setIsCardFlipped(false);
                                  }}
                                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                                    isCurrent
                                      ? isDark
                                        ? 'bg-white/[0.09] border-white/40'
                                        : 'bg-black/[0.06] border-black/40'
                                      : isDark
                                      ? 'bg-[#11131a] border-white/[0.07] hover:border-white/[0.2]'
                                      : 'bg-white border-black/[0.08] hover:border-black/[0.2]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                    <span className="opacity-60">
                                      #{idx + 1} · {fc.category}
                                    </span>
                                    {status && (
                                      <span
                                        className={
                                          status === 'known' ? 'text-emerald-400' : 'text-amber-400'
                                        }
                                      >
                                        {status.toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs font-medium line-clamp-2">{fc.front}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div
                        className={`p-8 rounded-2xl border text-center text-xs ${
                          isDark
                            ? 'bg-[#12151e] border-white/[0.08] text-neutral-400'
                            : 'bg-slate-50 border-black/[0.08] text-neutral-600'
                        }`}
                      >
                        All flashcards have been marked as known. Click "Filter Unmastered" or Reset
                        to review the full deck again.
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 3: EXECUTIVE SUMMARY & SECTION BREAKDOWN              */}
                {/* ========================================================= */}
                {studioTab === 'summary' && studyBundle && (
                  <div className="space-y-5 max-w-3xl mx-auto">
                    <div
                      className={`p-5 rounded-2xl border ${
                        isDark
                          ? 'bg-[#12151e] border-white/[0.09]'
                          : 'bg-[#f8f9fb] border-black/[0.08]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`text-xs font-semibold ${
                            isDark ? 'text-neutral-300' : 'text-neutral-700'
                          }`}
                        >
                          01. Executive Synthesis
                        </span>
                        {onAskZeno && (
                          <button
                            type="button"
                            onClick={() => {
                              onAskZeno(
                                `Here is the executive summary of "${activePdfName}":\n\n${studyBundle.summary.overview}\n\nKey Takeaways:\n${studyBundle.summary.keyPoints
                                  .map((k, i) => `${i + 1}. ${k}`)
                                  .join('\n')}\n\nProvide a deeper critique and actionable implications.`
                              );
                              onClose();
                            }}
                            className="text-xs font-medium underline opacity-80 hover:opacity-100 cursor-pointer"
                          >
                            Continue in Main Chat
                          </button>
                        )}
                      </div>
                      <p
                        className={`text-sm leading-relaxed ${
                          isDark ? 'text-neutral-100' : 'text-neutral-900'
                        }`}
                      >
                        {studyBundle.summary.overview}
                      </p>
                    </div>

                    {/* Key Takeaways */}
                    <div>
                      <div className="text-xs font-semibold mb-2.5">
                        02. High-Signal Takeaways ({studyBundle.summary.keyPoints.length})
                      </div>
                      <div className="space-y-2.5">
                        {studyBundle.summary.keyPoints.map((point, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border flex items-start gap-3 ${
                              isDark
                                ? 'bg-[#11131a] border-white/[0.08]'
                                : 'bg-white border-black/[0.08]'
                            }`}
                          >
                            <span
                              className={`font-mono text-xs tabular-nums pt-0.5 shrink-0 ${
                                isDark ? 'text-neutral-500' : 'text-neutral-400'
                              }`}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <p
                              className={`text-xs sm:text-sm leading-relaxed ${
                                isDark ? 'text-neutral-200' : 'text-neutral-800'
                              }`}
                            >
                              {point}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section / Page Breakdown */}
                    <div>
                      <div className="text-xs font-semibold mb-2.5">
                        03. Section-by-Section Breakdown
                      </div>
                      <div className="space-y-2.5">
                        {studyBundle.summary.sections.map((sec, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border ${
                              isDark
                                ? 'bg-[#11131a] border-white/[0.08]'
                                : 'bg-white border-black/[0.08]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs sm:text-sm font-semibold">{sec.title}</span>
                              <span
                                className={`text-[11px] font-mono tabular-nums ${
                                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                                }`}
                              >
                                Page {sec.pageNumber}
                              </span>
                            </div>
                            <p
                              className={`text-xs leading-relaxed ${
                                isDark ? 'text-neutral-400' : 'text-neutral-600'
                              }`}
                            >
                              {sec.summary}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 4: DEEP CONCEPTS & MATH BREAKDOWN                     */}
                {/* ========================================================= */}
                {studioTab === 'explanation' && studyBundle && (
                  <div className="space-y-5 max-w-3xl mx-auto">
                    {/* 1-Click Academic Deep Lenses */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => runPaperDeepBreakdown('math')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          activeActionTab === 'math'
                            ? isDark
                              ? 'bg-white/10 border-white/40'
                              : 'bg-black/5 border-black/40'
                            : isDark
                            ? 'bg-[#12151e] border-white/[0.08] hover:border-white/25'
                            : 'bg-[#f8f9fb] border-black/[0.08] hover:border-black/25'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center gap-2">
                          <Sigma className="w-4 h-4 text-sky-400" />
                          <span>Explain Math & Equations</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-1">
                          LaTeX derivations, variables & objective functions
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => runPaperDeepBreakdown('contributions')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          activeActionTab === 'contributions'
                            ? isDark
                              ? 'bg-white/10 border-white/40'
                              : 'bg-black/5 border-black/40'
                            : isDark
                            ? 'bg-[#12151e] border-white/[0.08] hover:border-white/25'
                            : 'bg-[#f8f9fb] border-black/[0.08] hover:border-black/25'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center gap-2">
                          <ListChecks className="w-4 h-4 text-emerald-400" />
                          <span>Key Contributions</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-1">
                          Novelty over prior work & empirical benchmarks
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => runPaperDeepBreakdown('methodology')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          activeActionTab === 'methodology'
                            ? isDark
                              ? 'bg-white/10 border-white/40'
                              : 'bg-black/5 border-black/40'
                            : isDark
                            ? 'bg-[#12151e] border-white/[0.08] hover:border-white/25'
                            : 'bg-[#f8f9fb] border-black/[0.08] hover:border-black/25'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-amber-400" />
                          <span>Methodology Breakdown</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-1">
                          Architecture, pipeline & experimental setup
                        </p>
                      </button>
                    </div>

                    {/* Deep Lens Output if active */}
                    {(isCopilotLoading || copilotResponse) && (
                      <div
                        className={`p-5 rounded-2xl border ${
                          isDark
                            ? 'bg-[#12151e] border-white/[0.12]'
                            : 'bg-[#f8f9fb] border-black/[0.1]'
                        }`}
                      >
                        {isCopilotLoading ? (
                          <div className="py-10 flex items-center justify-center gap-2.5 text-xs text-neutral-400">
                            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                            <span>Synthesizing deep technical breakdown...</span>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-current/10">
                              <span className="text-xs font-semibold">Deep Lens Analysis</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(copilotResponse);
                                  setCopiedAnalysis(true);
                                  setTimeout(() => setCopiedAnalysis(false), 2000);
                                }}
                                className="inline-flex items-center gap-1 text-xs opacity-75 hover:opacity-100 cursor-pointer"
                              >
                                {copiedAnalysis ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span>{copiedAnalysis ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                            <div className="prose-grok max-w-none text-xs sm:text-sm leading-relaxed">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                              >
                                {copilotResponse}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* First-Principles Concept Glossary */}
                    <div className="space-y-3">
                      <div className="text-xs font-semibold">
                        First-Principles Concept Glossary ({studyBundle.explanation.concepts.length})
                      </div>
                      {studyBundle.explanation.concepts.map((concept, idx) => (
                        <div
                          key={idx}
                          className={`p-4 sm:p-5 rounded-2xl border ${
                            isDark
                              ? 'bg-[#11131a] border-white/[0.08]'
                              : 'bg-white border-black/[0.08]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono text-xs tabular-nums ${
                                  isDark ? 'text-neutral-500' : 'text-neutral-400'
                                }`}
                              >
                                0{idx + 1}.
                              </span>
                              <h4 className="text-sm font-semibold">{concept.term}</h4>
                            </div>
                            {concept.pageRef && (
                              <span
                                className={`text-[11px] font-mono tabular-nums ${
                                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                                }`}
                              >
                                Page {concept.pageRef}
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-xs leading-relaxed">
                            <div>
                              <span className="font-semibold">Definition: </span>
                              <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
                                {concept.definition}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold">Mechanism & Application: </span>
                              <span className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>
                                {concept.mechanism}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 5: HIGH-YIELD CHEATSHEET & SCRATCHPAD NOTES           */}
                {/* ========================================================= */}
                {studioTab === 'cheatsheet' && studyBundle && (
                  <div className="space-y-5 max-w-3xl mx-auto">
                    {/* Rapid-Review Formulas & Core Principles */}
                    <div>
                      <div className="text-xs font-semibold mb-2.5">
                        01. Core Equations, Rules & Structural Principles
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {studyBundle.cheatsheet.formulasOrRules.map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border ${
                              isDark
                                ? 'bg-[#12151e] border-white/[0.08]'
                                : 'bg-[#f8f9fb] border-black/[0.08]'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-semibold">{item.label}</span>
                              <code
                                className={`text-xs font-mono px-2.5 py-0.5 rounded-lg ${
                                  isDark ? 'bg-white/[0.07] text-sky-300' : 'bg-black/[0.06] text-sky-700'
                                }`}
                              >
                                {item.expression}
                              </code>
                            </div>
                            <p
                              className={`text-xs leading-relaxed ${
                                isDark ? 'text-neutral-300' : 'text-neutral-700'
                              }`}
                            >
                              {item.meaning}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* High-Yield Exam / Review Bullets */}
                    <div>
                      <div className="text-xs font-semibold mb-2.5">
                        02. High-Yield Exam & Interview Checklist
                      </div>
                      <div
                        className={`p-4 rounded-2xl border space-y-2.5 ${
                          isDark
                            ? 'bg-[#11131a] border-white/[0.08]'
                            : 'bg-white border-black/[0.08]'
                        }`}
                      >
                        {studyBundle.cheatsheet.examTips.map((tip, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs leading-relaxed">
                            <span className="font-mono text-emerald-400 shrink-0">✓</span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Personal Persistent Scratchpad Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold">
                          03. Personal Study Scratchpad (Auto-Saved)
                        </span>
                        <button
                          type="button"
                          onClick={handleExportStudyPackMarkdown}
                          className="text-xs font-medium underline opacity-80 hover:opacity-100 cursor-pointer"
                        >
                          Download Full Study Pack (.md)
                        </button>
                      </div>
                      <textarea
                        value={userNotes}
                        onChange={(e) => {
                          const val = e.target.value;
                          setUserNotes(val);
                          try {
                            localStorage.setItem(`zeno_pdf_notes_${activePdfName}`, val);
                          } catch {}
                        }}
                        rows={5}
                        placeholder="Write your own annotations, key formulas, or exam reminders for this PDF..."
                        className={`w-full p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed outline-none resize-y ${
                          isDark
                            ? 'bg-[#11131a] border-white/[0.1] text-white placeholder-neutral-500 focus:border-white/30'
                            : 'bg-[#f8f9fb] border-black/[0.1] text-black placeholder-neutral-400 focus:border-black/30'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 6: ASK PDF CO-PILOT Q&A                               */}
                {/* ========================================================= */}
                {studioTab === 'chat' && (
                  <div className="flex flex-col h-[62vh] max-w-3xl mx-auto">
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                      {chatTurns.length === 0 ? (
                        <div
                          className={`p-5 rounded-2xl border ${
                            isDark
                              ? 'bg-[#12151e] border-white/[0.09]'
                              : 'bg-[#f8f9fb] border-black/[0.08]'
                          }`}
                        >
                          <div className="text-xs sm:text-sm font-semibold mb-1">
                            Ask anything about "{activePdfName}"
                          </div>
                          <p
                            className={`text-xs leading-relaxed mb-4 ${
                              isDark ? 'text-neutral-400' : 'text-neutral-600'
                            }`}
                          >
                            Responses are grounded directly in the extracted text of your uploaded
                            PDF document.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              'Give me a 5-bullet executive briefing of this PDF',
                              'Quiz me with 3 hard open-ended questions on this document',
                              'Extract all quantitative metrics, tables, and formulas',
                              'What are the main limitations or counterarguments?',
                            ].map((qText, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSendPdfChat(qText)}
                                className={`px-3.5 py-2 rounded-xl border text-xs text-left transition-colors cursor-pointer ${
                                  isDark
                                    ? 'bg-[#171b26] border-white/[0.08] text-neutral-200 hover:border-white/30'
                                    : 'bg-white border-black/[0.08] text-neutral-800 hover:border-black/30'
                                }`}
                              >
                                {qText}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        chatTurns.map((turn) => (
                          <div
                            key={turn.id}
                            className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed ${
                              turn.role === 'user'
                                ? isDark
                                  ? 'bg-white/[0.08] border-white/[0.15] ml-8'
                                  : 'bg-black/[0.05] border-black/[0.1] ml-8'
                                : isDark
                                ? 'bg-[#12151e] border-white/[0.08] mr-4'
                                : 'bg-white border-black/[0.08] mr-4'
                            }`}
                          >
                            <div
                              className={`text-[10px] font-mono uppercase mb-1 ${
                                isDark ? 'text-neutral-400' : 'text-neutral-500'
                              }`}
                            >
                              {turn.role === 'user' ? 'You' : 'PDF Study Co-Pilot'}
                            </div>
                            <div className="prose-grok max-w-none text-xs sm:text-sm leading-relaxed">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                              >
                                {turn.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))
                      )}

                      {isChatLoading && (
                        <div
                          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 ${
                            isDark
                              ? 'bg-[#12151e] border-white/[0.08] text-neutral-400'
                              : 'bg-white border-black/[0.08] text-neutral-600'
                          }`}
                        >
                          <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                          <span>Analyzing document pages...</span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendPdfChat();
                      }}
                      className="mt-3 pt-3 border-t border-current/10 flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        placeholder={`Ask a specific question about ${activePdfName}...`}
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-xs sm:text-sm outline-none ${
                          isDark
                            ? 'bg-[#141720] border-white/[0.12] text-white placeholder-neutral-500 focus:border-white/30'
                            : 'bg-[#f8f9fb] border-black/[0.12] text-black placeholder-neutral-400 focus:border-black/30'
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={!chatDraft.trim() || isChatLoading}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                          isDark
                            ? 'bg-white text-black hover:bg-neutral-200'
                            : 'bg-[#0d0d0d] text-white hover:bg-neutral-800'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Ask PDF</span>
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
            className={`absolute z-50 flex items-center gap-1 p-1.5 rounded-2xl border shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 ${
              isDark
                ? 'bg-[#18181b]/98 border-white/20 text-white shadow-black/90'
                : 'bg-white/98 border-black/15 text-black shadow-black/20'
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-sky-500 hover:text-white transition-colors cursor-pointer text-xs font-medium"
            >
              <span>Summarize</span>
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-sky-500 hover:text-white transition-colors cursor-pointer text-xs font-medium"
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span>Explain</span>
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-sky-500 hover:text-white transition-colors cursor-pointer text-xs font-medium"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Quiz This</span>
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(selectionMenu.text);
                setCopiedSuccess(true);
                setTimeout(() => {
                  setCopiedSuccess(false);
                  setSelectionMenu(null);
                }, 1000);
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-xs"
            >
              {copiedSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
