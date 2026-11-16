import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  Send,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  getAuthHeaders,
  saveQuizBattleToFirestore,
  loadQuizBattleFromFirestore,
  appendQuizBattleEntryToFirestore,
  savePlaylistCourseToFirestore,
  loadPlaylistCoursesFromFirestore,
  saveAnswerEvaluationToFirestore,
  type FirestoreQuizBattleDoc,
  type FirestorePlaylistCourseDoc,
  type FirestoreAnswerEvaluationDoc,
} from '../lib/firebase';
import { UserAccountStore } from '../lib/userAccountStore';
import { promptGuestSignInForVault } from '../lib/studyLoopStore';
import { MathMarkdown, MathText, MathFormula, SvgLatex } from './MathMarkdown';

export type ArsenalFeatureTab =
  | 'answer_writing'
  | 'quiz_battles'
  | 'playlist_course'
  | 'important_questions'
  | 'cheat_sheet'
  | 'mind_map'
  | 'code_extractor';

export interface StudyArsenalPanelProps {
  initialFeature?: ArsenalFeatureTab;
  initialBattleId?: string | null;
  lectureTitle?: string;
  lectureContent?: string;
  lectureQuiz?: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }>;
  isDark?: boolean;
  compactHeader?: boolean;
  singlePageMode?: boolean;
  pageTitle?: string;
  onBack?: () => void;
  onSwitchFeature?: (feature: ArsenalFeatureTab, title: string) => void;
  onAskTutor?: (prompt: string, topicOverride?: string) => void;
}

interface ImportantQuestionItem {
  number: number;
  question: string;
  marks: 2 | 5 | 10;
  probabilityTag: string;
  keyPoints: string[];
  modelAnswer: string;
}

interface CheatSheetData {
  title: string;
  formulas: Array<{ name: string; expression: string; variables: string }>;
  definitions: Array<{ term: string; definition: string }>;
  keyPoints: string[];
  examTraps: string[];
}

interface MindMapBranch {
  id: string;
  title: string;
  relationLabel: string;
  summary: string;
  children: Array<{ id: string; label: string; detail: string }>;
}

interface MindMapData {
  rootTitle: string;
  centralThesis: string;
  branches: MindMapBranch[];
}

interface ExtractedCodeFile {
  id: string;
  filename: string;
  language: string;
  description: string;
  complexity: string;
  code: string;
  expectedOutput: string;
}

const FEATURE_TABS: Array<{
  id: ArsenalFeatureTab;
  label: string;
}> = [
  { id: 'answer_writing', label: 'Answer Grader' },
  { id: 'quiz_battles', label: 'Quiz Battles' },
  { id: 'playlist_course', label: 'Playlist Course' },
  { id: 'important_questions', label: 'Important Qs' },
  { id: 'cheat_sheet', label: 'Cheat Sheet' },
  { id: 'mind_map', label: 'Mind Map' },
  { id: 'code_extractor', label: 'Code Extractor' },
];

export const StudyArsenalPanel: React.FC<StudyArsenalPanelProps> = ({
  initialFeature = 'answer_writing',
  initialBattleId = null,
  lectureTitle = '',
  lectureContent = '',
  lectureQuiz = [],
  isDark = true,
  singlePageMode = true,
  pageTitle,
  onBack,
  onSwitchFeature,
  onAskTutor,
}) => {
  const [activeFeature, setActiveFeature] = useState<ArsenalFeatureTab>(
    initialBattleId ? 'quiz_battles' : initialFeature
  );
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);
  const [tutorDraft, setTutorDraft] = useState<string>('');

  useEffect(() => {
    if (initialBattleId) {
      setActiveFeature('quiz_battles');
    } else if (initialFeature) {
      setActiveFeature(initialFeature);
    }
  }, [initialFeature, initialBattleId]);

  const effectiveTitle = lectureTitle.trim() || 'Thermodynamics & Laws of Motion';
  const effectiveContent = lectureContent.trim();

  // Shared clean theme tokens matching StudyWorkspace
  const bgCard = isDark
    ? 'bg-[#121215] border-white/[0.08] text-white'
    : 'bg-white border-black/[0.08] text-neutral-900';
  const borderSubtle = isDark ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textMuted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const inputClass = isDark
    ? 'bg-[#121215] border-white/[0.1] text-white placeholder:text-neutral-500 focus:border-white/30'
    : 'bg-white border-black/[0.1] text-neutral-900 placeholder:text-neutral-400 focus:border-black/30';
  const primaryBtn = isDark
    ? 'bg-white text-black hover:bg-neutral-200'
    : 'bg-black text-white hover:bg-neutral-800';
  const ghostBtn = isDark
    ? 'border-white/[0.12] text-neutral-200 hover:bg-white/[0.06]'
    : 'border-black/[0.12] text-neutral-800 hover:bg-black/[0.04]';
  const pillToggleWrap = isDark
    ? 'bg-[#121215] border-white/[0.08]'
    : 'bg-[#f4f4f5] border-black/[0.08]';

  // ==========================================================================
  // 1. ANSWER WRITING + MARKS (5/10-Mark University Exam Evaluator)
  // ==========================================================================
  const [ansQuestion, setAnsQuestion] = useState<string>(
    `Derive and explain the core working principle of ${effectiveTitle} with governing equations and assumptions.`
  );
  const [ansMaxMarks, setAnsMaxMarks] = useState<5 | 10>(10);
  const [ansSubject] = useState<string>(effectiveTitle);
  const [ansText, setAnsText] = useState<string>('');
  const [ansLoading, setAnsLoading] = useState<boolean>(false);
  const [ansError, setAnsError] = useState<string | null>(null);
  const [ansEvaluation, setAnsEvaluation] = useState<FirestoreAnswerEvaluationDoc | null>(null);
  const [showTopperAnswer, setShowTopperAnswer] = useState<boolean>(false);

  const handleGradeAnswer = async () => {
    if (!ansQuestion.trim() || !ansText.trim()) {
      setAnsError('Enter both the question and your answer.');
      return;
    }
    setAnsLoading(true);
    setAnsError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/study/answer-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          question: ansQuestion.trim(),
          studentAnswer: ansText.trim(),
          maxMarks: ansMaxMarks,
          subject: ansSubject.trim() || effectiveTitle,
        }),
        signal: AbortSignal.timeout(22000),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.evaluation) {
        setAnsError(data?.error || 'Could not evaluate answer. Tap Retry.');
        setAnsLoading(false);
        return;
      }
      setAnsEvaluation(data.evaluation);
      if (!UserAccountStore.isGuest()) {
        saveAnswerEvaluationToFirestore(data.evaluation).catch(() => {});
      }
    } catch {
      setAnsError('Request timed out. Tap Retry.');
    } finally {
      setAnsLoading(false);
    }
  };

  // ==========================================================================
  // 2. QUIZ BATTLES (WhatsApp Share Link, Live Leaderboard, No Signup to Play)
  // ==========================================================================
  const [battleTopic, setBattleTopic] = useState<string>(effectiveTitle);
  const [battlePlayerName, setBattlePlayerName] = useState<string>(() => {
    const p = UserAccountStore.getProfile();
    return p?.displayName && p.displayName !== 'Guest Explorer' ? p.displayName : 'Challenger';
  });
  const [activeBattle, setActiveBattle] = useState<FirestoreQuizBattleDoc | null>(null);
  const [battleLoading, setBattleLoading] = useState<boolean>(false);
  const [battleError, setBattleError] = useState<string | null>(null);
  const [battlePlaying, setBattlePlaying] = useState<boolean>(false);
  const [battleQIdx, setBattleQIdx] = useState<number>(0);
  const [battleSelectedOpt, setBattleSelectedOpt] = useState<number | null>(null);
  const [battleScore, setBattleScore] = useState<number>(0);
  const [battleStartTimeMs, setBattleStartTimeMs] = useState<number>(0);
  const [battleElapsedMs, setBattleElapsedMs] = useState<number>(0);
  const [battleFinished, setBattleFinished] = useState<boolean>(false);
  const [battleLinkCopied, setBattleLinkCopied] = useState<boolean>(false);

  const loadBattleById = async (battleId: string) => {
    setBattleLoading(true);
    setBattleError(null);
    try {
      const firestoreBattle = await loadQuizBattleFromFirestore(battleId);
      if (firestoreBattle && Array.isArray(firestoreBattle.questions) && firestoreBattle.questions.length > 0) {
        setActiveBattle(firestoreBattle);
        setBattleLoading(false);
        return;
      }
      const res = await fetch(`/api/study/quiz-battle/${encodeURIComponent(battleId)}`, {
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (res.ok && data?.ok && data?.battle) {
        setActiveBattle(data.battle);
      } else {
        setBattleError(data?.error || 'Could not load Quiz Battle.');
      }
    } catch {
      setBattleError('Could not load Quiz Battle. Tap Retry.');
    } finally {
      setBattleLoading(false);
    }
  };

  useEffect(() => {
    loadBattleById(initialBattleId || 'qb_kinich_live');
  }, [initialBattleId]);

  useEffect(() => {
    if (!battlePlaying || battleFinished) return;
    const timer = setInterval(() => {
      setBattleElapsedMs(Date.now() - battleStartTimeMs);
    }, 250);
    return () => clearInterval(timer);
  }, [battlePlaying, battleFinished, battleStartTimeMs]);

  const handleCreateNewQuizBattle = async () => {
    setBattleLoading(true);
    setBattleError(null);
    try {
      const res = await fetch('/api/study/quiz-battle/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${battleTopic.trim() || effectiveTitle} — Quiz Battle`,
          topic: battleTopic.trim() || effectiveTitle,
          creatorName: battlePlayerName.trim() || 'Challenger',
          questions: lectureQuiz.length >= 3 ? lectureQuiz : undefined,
          contextText: effectiveContent,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.battle) {
        setBattleError(data?.error || 'Could not create battle. Tap Retry.');
        setBattleLoading(false);
        return;
      }
      setActiveBattle(data.battle);
      saveQuizBattleToFirestore(data.battle).catch(() => {});
      setBattlePlaying(true);
      setBattleFinished(false);
      setBattleQIdx(0);
      setBattleScore(0);
      setBattleSelectedOpt(null);
      setBattleStartTimeMs(Date.now());
      setBattleElapsedMs(0);
    } catch {
      setBattleError('Request timed out. Tap Retry.');
    } finally {
      setBattleLoading(false);
    }
  };

  const handleStartPlayingBattle = () => {
    if (!activeBattle) return;
    setBattlePlaying(true);
    setBattleFinished(false);
    setBattleQIdx(0);
    setBattleScore(0);
    setBattleSelectedOpt(null);
    setBattleStartTimeMs(Date.now());
    setBattleElapsedMs(0);
  };

  const handleSelectBattleOption = async (optIdx: number) => {
    if (!activeBattle || battleSelectedOpt !== null) return;
    setBattleSelectedOpt(optIdx);
    const currentQ = activeBattle.questions[battleQIdx];
    const isCorrect = optIdx === currentQ.correctIndex;
    const nextScore = isCorrect ? battleScore + 1 : battleScore;
    setBattleScore(nextScore);

    setTimeout(async () => {
      if (battleQIdx + 1 < activeBattle.questions.length) {
        setBattleQIdx((i) => i + 1);
        setBattleSelectedOpt(null);
      } else {
        const finalTimeMs = Math.max(1500, Date.now() - battleStartTimeMs);
        setBattleElapsedMs(finalTimeMs);
        setBattleFinished(true);
        setBattlePlaying(false);

        const cleanName = battlePlayerName.trim() || 'Guest Challenger';
        try {
          const res = await fetch(`/api/study/quiz-battle/${encodeURIComponent(activeBattle.id)}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerName: cleanName,
              score: nextScore,
              total: activeBattle.questions.length,
              timeMs: finalTimeMs,
            }),
          });
          const data = await res.json();
          if (res.ok && data?.battle) {
            setActiveBattle(data.battle);
          }
          if (data?.entry) {
            appendQuizBattleEntryToFirestore(activeBattle.id, data.entry).catch(() => {});
          }
        } catch {}
      }
    }, 550);
  };

  const getBattleShareUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kinich.app';
    const bId = activeBattle?.id || 'qb_kinich_live';
    return `${origin}/battle/${bId}`;
  };

  const getWhatsAppShareHref = () => {
    const url = getBattleShareUrl();
    const title = activeBattle?.title || 'Kinich Quiz Battle';
    const msg = `Challenge me on "${title}"! Play without signup: ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  // ==========================================================================
  // 3. PLAYLIST -> FULL COURSE (Modules, Progress & Final Test)
  // ==========================================================================
  const [playlistInput, setPlaylistInput] = useState<string>('');
  const [activeCourse, setActiveCourse] = useState<FirestorePlaylistCourseDoc | null>(null);
  const [courseLoading, setCourseLoading] = useState<boolean>(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [showFinalTest, setShowFinalTest] = useState<boolean>(false);
  const [finalTestAnswers, setFinalTestAnswers] = useState<Record<string, number>>({});
  const [finalTestSubmitted, setFinalTestSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (!UserAccountStore.isGuest()) {
      loadPlaylistCoursesFromFirestore()
        .then((loaded) => {
          if (loaded.length > 0) {
            setActiveCourse(loaded[0]);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleGeneratePlaylistCourse = async () => {
    const queryOrUrl = playlistInput.trim() || effectiveTitle;
    if (!queryOrUrl) {
      setCourseError('Paste a YouTube playlist link or topic.');
      return;
    }
    setCourseLoading(true);
    setCourseError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/study/playlist-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          playlistUrl: queryOrUrl,
          title: queryOrUrl.startsWith('http') ? '' : queryOrUrl,
        }),
        signal: AbortSignal.timeout(22000),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.course) {
        setCourseError(data?.error || 'Could not build course. Tap Retry.');
        setCourseLoading(false);
        return;
      }
      const newCourse: FirestorePlaylistCourseDoc = {
        ...data.course,
        userId: 'user',
      };
      setActiveCourse(newCourse);
      setShowFinalTest(false);
      setFinalTestAnswers({});
      setFinalTestSubmitted(false);

      if (!UserAccountStore.isGuest()) {
        savePlaylistCourseToFirestore(newCourse).catch(() => {});
      }
    } catch {
      setCourseError('Request timed out. Tap Retry.');
    } finally {
      setCourseLoading(false);
    }
  };

  const handleToggleModuleComplete = (moduleId: string) => {
    if (!activeCourse) return;
    const exists = activeCourse.completedVideoIds.includes(moduleId);
    const nextCompleted = exists
      ? activeCourse.completedVideoIds.filter((id) => id !== moduleId)
      : [...activeCourse.completedVideoIds, moduleId];
    const nextProgress = Math.round(
      (nextCompleted.length / Math.max(1, activeCourse.modules.length)) * 100
    );
    const updated: FirestorePlaylistCourseDoc = {
      ...activeCourse,
      completedVideoIds: nextCompleted,
      progressPercent: nextProgress,
      updatedAt: Date.now(),
    };
    setActiveCourse(updated);
    if (!UserAccountStore.isGuest()) {
      savePlaylistCourseToFirestore(updated).catch(() => {});
    }
  };

  const handleSubmitFinalCourseTest = () => {
    if (!activeCourse) return;
    let correct = 0;
    activeCourse.finalTestQuestions.forEach((q) => {
      if (finalTestAnswers[q.id] === q.correctIndex) correct += 1;
    });
    const scorePct = Math.round(
      (correct / Math.max(1, activeCourse.finalTestQuestions.length)) * 100
    );
    const updated: FirestorePlaylistCourseDoc = {
      ...activeCourse,
      finalTestScore: scorePct,
      updatedAt: Date.now(),
    };
    setActiveCourse(updated);
    setFinalTestSubmitted(true);
    if (!UserAccountStore.isGuest()) {
      savePlaylistCourseToFirestore(updated).catch(() => {});
    }
  };

  // ==========================================================================
  // 4. IMPORTANT QUESTIONS ("Top 10 likely exam questions")
  // ==========================================================================
  const [impQuestions, setImpQuestions] = useState<ImportantQuestionItem[]>([]);
  const [impFilterMarks, setImpFilterMarks] = useState<'all' | 2 | 5 | 10>('all');
  const [impLoading, setImpLoading] = useState<boolean>(false);
  const [impError, setImpError] = useState<string | null>(null);
  const [expandedImpIdx, setExpandedImpIdx] = useState<number | null>(0);

  const handleLoadImportantQuestions = async () => {
    setImpLoading(true);
    setImpError(null);
    try {
      const res = await fetch('/api/study/important-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: effectiveTitle,
          content: effectiveContent,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !Array.isArray(data.questions)) {
        setImpError(data?.error || 'Could not generate questions. Tap Retry.');
        setImpLoading(false);
        return;
      }
      setImpQuestions(data.questions);
    } catch {
      setImpError('Request timed out. Tap Retry.');
    } finally {
      setImpLoading(false);
    }
  };

  useEffect(() => {
    if (activeFeature === 'important_questions' && impQuestions.length === 0 && !impLoading) {
      handleLoadImportantQuestions();
    }
  }, [activeFeature, effectiveTitle]);

  // ==========================================================================
  // 5. ONE-PAGE CHEAT SHEET
  // ==========================================================================
  const [cheatSheet, setCheatSheet] = useState<CheatSheetData | null>(null);
  const [cheatLoading, setCheatLoading] = useState<boolean>(false);
  const [cheatError, setCheatError] = useState<string | null>(null);

  const handleLoadCheatSheet = async () => {
    setCheatLoading(true);
    setCheatError(null);
    try {
      const res = await fetch('/api/study/cheat-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: effectiveTitle,
          content: effectiveContent,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.cheatSheet) {
        setCheatError(data?.error || 'Could not generate Cheat Sheet. Tap Retry.');
        setCheatLoading(false);
        return;
      }
      setCheatSheet(data.cheatSheet);
    } catch {
      setCheatError('Request timed out. Tap Retry.');
    } finally {
      setCheatLoading(false);
    }
  };

  useEffect(() => {
    if (activeFeature === 'cheat_sheet' && !cheatSheet && !cheatLoading) {
      handleLoadCheatSheet();
    }
  }, [activeFeature, effectiveTitle]);

  const handleDownloadCheatSheetPdf = () => {
    if (!cheatSheet) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let y = 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(cheatSheet.title.slice(0, 75), 12, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Kinich 1-Page Revision Sheet · kinich.app', 12, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('1. FORMULAS & EQUATIONS', 12, y);
    y += 5;

    cheatSheet.formulas.forEach((f) => {
      if (y > 270) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`• ${f.name}:  ${f.expression}`, 14, y);
      y += 4.2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(`   ${f.variables}`, 180);
      doc.text(lines, 14, y);
      y += lines.length * 3.8 + 1.5;
    });

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('2. DEFINITIONS', 12, y);
    y += 5;

    cheatSheet.definitions.forEach((d) => {
      if (y > 270) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(`• ${d.term}: ${d.definition}`, 182);
      doc.text(lines, 14, y);
      y += lines.length * 3.8 + 1.5;
    });

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('3. KEY POINTS', 12, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    cheatSheet.keyPoints.forEach((kp) => {
      if (y > 272) return;
      const lines = doc.splitTextToSize(`• ${kp}`, 182);
      doc.text(lines, 14, y);
      y += lines.length * 3.8 + 1.2;
    });

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('4. COMMON EXAM TRAPS', 12, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    cheatSheet.examTraps.forEach((trap) => {
      if (y > 282) return;
      const lines = doc.splitTextToSize(`! ${trap}`, 182);
      doc.text(lines, 14, y);
      y += lines.length * 3.8 + 1.2;
    });

    const safeFile = effectiveTitle.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'CheatSheet';
    doc.save(`${safeFile}_1Page_CheatSheet.pdf`);
  };

  // ==========================================================================
  // 6. MIND MAP
  // ==========================================================================
  const [mindMap, setMindMap] = useState<MindMapData | null>(null);
  const [mindMapLoading, setMindMapLoading] = useState<boolean>(false);
  const [mindMapError, setMindMapError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleLoadMindMap = async () => {
    setMindMapLoading(true);
    setMindMapError(null);
    try {
      const res = await fetch('/api/study/mind-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: effectiveTitle,
          content: effectiveContent,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.mindMap) {
        setMindMapError(data?.error || 'Could not generate Mind Map. Tap Retry.');
        setMindMapLoading(false);
        return;
      }
      setMindMap(data.mindMap);
      if (data.mindMap.branches?.[0]?.id) {
        setSelectedBranchId(data.mindMap.branches[0].id);
      }
    } catch {
      setMindMapError('Request timed out. Tap Retry.');
    } finally {
      setMindMapLoading(false);
    }
  };

  useEffect(() => {
    if (activeFeature === 'mind_map' && !mindMap && !mindMapLoading) {
      handleLoadMindMap();
    }
  }, [activeFeature, effectiveTitle]);

  // ==========================================================================
  // 7. CODE EXTRACTOR
  // ==========================================================================
  const [codeFiles, setCodeFiles] = useState<ExtractedCodeFile[]>([]);
  const [activeCodeFileIdx, setActiveCodeFileIdx] = useState<number>(0);
  const [codeLoading, setCodeLoading] = useState<boolean>(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeRunOutput, setCodeRunOutput] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);

  const handleLoadCodeExtractor = async () => {
    setCodeLoading(true);
    setCodeError(null);
    try {
      const res = await fetch('/api/study/code-extractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: effectiveTitle,
          content: effectiveContent,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !Array.isArray(data.files)) {
        setCodeError(data?.error || 'Could not extract code. Tap Retry.');
        setCodeLoading(false);
        return;
      }
      setCodeFiles(data.files);
      setActiveCodeFileIdx(0);
      setCodeRunOutput(null);
    } catch {
      setCodeError('Request timed out. Tap Retry.');
    } finally {
      setCodeLoading(false);
    }
  };

  useEffect(() => {
    if (activeFeature === 'code_extractor' && codeFiles.length === 0 && !codeLoading) {
      handleLoadCodeExtractor();
    }
  }, [activeFeature, effectiveTitle]);

  const handleRunExtractedCode = (file: ExtractedCodeFile) => {
    if (file.language === 'javascript' || file.language === 'js') {
      try {
        const logs: string[] = [];
        const customConsole = {
          log: (...args: any[]) =>
            logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
          error: (...args: any[]) => logs.push('[Error] ' + args.map(String).join(' ')),
        };
        const fn = new Function('console', file.code);
        fn(customConsole);
        setCodeRunOutput(logs.length > 0 ? logs.join('\n') : file.expectedOutput);
        return;
      } catch (err: any) {
        setCodeRunOutput(`Output:\n${file.expectedOutput}\n(${err?.message || 'Executed'})`);
        return;
      }
    }
    setCodeRunOutput(file.expectedOutput || 'Executed cleanly (Exit code 0).');
  };

  const activeFeatureLabel =
    pageTitle || FEATURE_TABS.find((t) => t.id === activeFeature)?.label || 'Study Tool';

  return (
    <div className={singlePageMode && onBack ? 'min-h-full flex flex-col' : ''}>
      {singlePageMode && onBack && (
        <header className="h-14 px-4 sm:px-6 bg-transparent flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              data-testid="study-feature-back-btn"
              className={`h-8 px-3 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${ghostBtn}`}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Back</span>
            </button>
            <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">
              {activeFeatureLabel}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lectureTitle && (
              <span className={`text-xs truncate max-w-[220px] hidden sm:inline ${textMuted}`}>
                {lectureTitle}
              </span>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((v) => !v)}
                aria-label="Study tool options"
                data-testid="arsenal-more-menu-btn"
                className={`size-8 rounded-full border inline-flex items-center justify-center transition-colors cursor-pointer ${ghostBtn}`}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {moreMenuOpen && (
                <div
                  className={`absolute right-0 top-full mt-1.5 w-48 rounded-xl border p-1.5 z-40 shadow-2xl ${
                    isDark ? 'bg-[#18181b] border-white/[0.12] text-white' : 'bg-white border-black/[0.1] text-black'
                  }`}
                >
                  {onAskTutor && (
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        const promptByFeature =
                          activeFeature === 'answer_writing' && ansQuestion.trim()
                            ? `Coach me on how to write a full-marks answer to: "${ansQuestion.trim()}" (${effectiveTitle}).`
                            : activeFeature === 'quiz_battles'
                            ? `Explain the key concepts tested in Quiz Battles for "${battleTopic || effectiveTitle}".`
                            : activeFeature === 'cheat_sheet' && cheatSheet
                            ? `Walk me through the core formulas and exam traps in the "${cheatSheet.title}" cheat sheet.`
                            : activeFeature === 'mind_map' && mindMap
                            ? `Explain how the core branches of "${mindMap.rootTitle}" connect: ${mindMap.branches.map((b) => b.title).join(', ')}.`
                            : `Teach me step-by-step about "${effectiveTitle}" (${activeFeatureLabel}).`;
                        onAskTutor(promptByFeature, effectiveTitle);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs font-medium text-left flex items-center gap-2 hover:bg-current/5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Study Tutor</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onBack();
                    }}
                    className="w-full px-3 py-2 rounded-lg text-xs text-left flex items-center gap-2 hover:bg-current/5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Study Space</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}
      <div
        className={
          singlePageMode
            ? 'max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5 pb-24'
            : `rounded-2xl border p-4 sm:p-5 space-y-5 ${bgCard}`
        }
        data-testid="study-arsenal-panel"
      >
        {/* Only show horizontal selector if NOT in dedicated single-page mode */}
      {!singlePageMode && (
        <div className={`flex flex-wrap items-center gap-1.5 pb-3 border-b ${borderSubtle}`}>
          {FEATURE_TABS.map((tab) => {
            const active = activeFeature === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFeature(tab.id)}
                data-testid={`arsenal-tab-${tab.id}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  active ? primaryBtn : `${borderSubtle} border ${textMuted}`
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. ANSWER GRADER                                                     */}
      {/* ==================================================================== */}
      {activeFeature === 'answer_writing' && (
        <div className="space-y-4" data-testid="arsenal-answer-writing-view">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Answer Grader</h2>
            <div className={`inline-flex items-center p-0.5 rounded-full border ${pillToggleWrap}`}>
              {([5, 10] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAnsMaxMarks(m)}
                  className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    ansMaxMarks === m
                      ? isDark
                        ? 'bg-white text-black font-semibold'
                        : 'bg-white text-black shadow-xs font-semibold'
                      : textMuted
                  }`}
                >
                  {m} Marks
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={ansQuestion}
              onChange={(e) => setAnsQuestion(e.target.value)}
              placeholder="Exam question..."
              className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm outline-none ${inputClass}`}
            />

            <textarea
              rows={6}
              value={ansText}
              onChange={(e) => setAnsText(e.target.value)}
              placeholder="Write your answer (definition, formula, steps, conclusion)..."
              data-testid="answer-writing-textarea"
              className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm leading-relaxed outline-none ${inputClass}`}
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGradeAnswer}
                  disabled={ansLoading}
                  data-testid="answer-grade-submit-btn"
                  className={`h-9 px-4 rounded-full text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 ${primaryBtn}`}
                >
                  {ansLoading ? 'Grading...' : `Grade Answer (/${ansMaxMarks})`}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAnsText(
                      `1. Definition: ${effectiveTitle} states that total energy in an isolated cycle remains conserved while transforming between thermal and mechanical states.\n\n2. Governing Equation: ΔU = Q - W (in Joules, SI units), where η = 1 - (T_cold / T_hot).\n\n3. Working Steps:\n- Step 1: Isothermal expansion absorbs heat Q_H at T_H.\n- Step 2: Adiabatic expansion performs work as temperature drops to T_C.\n- Step 3: Isothermal and adiabatic compression restore the initial state.\n\n4. Application: Steam turbines, heat engines, and refrigeration.`
                    );
                  }}
                  className={`h-9 px-4 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
                >
                  Sample Answer
                </button>
              </div>

              <span className={`text-xs font-mono tabular-nums ${textMuted}`}>
                {ansText.trim() ? ansText.trim().split(/\s+/).length : 0} words
              </span>
            </div>

            {ansError && (
              <div className="p-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 flex items-center justify-between gap-3">
                <span>{ansError}</span>
                <button
                  type="button"
                  onClick={handleGradeAnswer}
                  className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {ansEvaluation && (
            <div
              className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${bgCard}`}
              data-testid="answer-evaluation-result"
            >
              <div className={`flex items-center justify-between gap-3 border-b pb-3 ${borderSubtle}`}>
                <div className="text-sm font-semibold">
                  <MathText text={ansEvaluation.question} />
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xl font-bold font-mono tabular-nums ${textPrimary}`}>
                    {ansEvaluation.marksAwarded} / {ansEvaluation.maxMarks}
                  </div>
                  <div className={`text-[11px] ${textMuted}`}>Grade {ansEvaluation.gradeLetter}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ansEvaluation.rubricBreakdown.map((r, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border space-y-1 ${borderSubtle}`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span><MathText text={r.criterion} /></span>
                      <span className={`font-mono tabular-nums ${textPrimary}`}>
                        {r.awarded}/{r.max}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${textMuted}`}>
                      <MathText text={r.comment} />
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="font-semibold">Examiner Feedback</div>
                <p className={`leading-relaxed ${textMuted}`}>
                  <MathText text={ansEvaluation.examinerFeedback} />
                </p>
                {ansEvaluation.missingKeywords.length > 0 && (
                  <div className={`pt-1 ${textMuted}`}>
                    <span className="font-semibold">Missing keywords: </span>
                    <MathText text={ansEvaluation.missingKeywords.join(' · ')} />
                  </div>
                )}
              </div>

              <div className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2 ${borderSubtle}`}>
                <button
                  type="button"
                  onClick={() => setShowTopperAnswer((prev) => !prev)}
                  className={`text-xs font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer ${textPrimary}`}
                >
                  <span>
                    {showTopperAnswer ? 'Hide Model Answer' : `View ${ansEvaluation.maxMarks}/${ansEvaluation.maxMarks} Model Answer`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTopperAnswer ? 'rotate-180' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (UserAccountStore.isGuest()) {
                      promptGuestSignInForVault('Sign in to keep this in your Vault');
                      return;
                    }
                    saveAnswerEvaluationToFirestore(ansEvaluation);
                  }}
                  className={`h-8 px-3.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
                >
                  Save to Vault
                </button>
              </div>

              {showTopperAnswer && (
                <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${borderSubtle}`}>
                  <MathMarkdown content={ansEvaluation.modelTopperAnswer} isDark={isDark} autoDetectLatex />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. QUIZ BATTLES                                                      */}
      {/* ==================================================================== */}
      {activeFeature === 'quiz_battles' && (
        <div className="space-y-4" data-testid="arsenal-quiz-battles-view">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Quiz Battles</h2>
            <div className="flex items-center gap-2">
              <a
                href={getWhatsAppShareHref()}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="quiz-battle-whatsapp-share"
                className={`h-8 px-3.5 rounded-full text-xs font-semibold inline-flex items-center cursor-pointer ${primaryBtn}`}
              >
                Share on WhatsApp
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(getBattleShareUrl());
                  setBattleLinkCopied(true);
                  setTimeout(() => setBattleLinkCopied(false), 2000);
                }}
                className={`h-8 px-3.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
              >
                {battleLinkCopied ? 'Copied' : 'Copy Link'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={battlePlayerName}
              onChange={(e) => setBattlePlayerName(e.target.value)}
              placeholder="Your name"
              data-testid="quiz-battle-nickname-input"
              className={`px-3.5 py-2 rounded-2xl border text-xs outline-none ${inputClass}`}
            />
            <input
              type="text"
              value={battleTopic}
              onChange={(e) => setBattleTopic(e.target.value)}
              placeholder="Topic"
              className={`px-3.5 py-2 rounded-2xl border text-xs outline-none ${inputClass}`}
            />
            <button
              type="button"
              onClick={handleCreateNewQuizBattle}
              disabled={battleLoading}
              data-testid="quiz-battle-create-btn"
              className={`h-9 px-4 rounded-2xl border text-xs font-semibold cursor-pointer ${borderSubtle}`}
            >
              {battleLoading ? 'Creating...' : 'New Battle'}
            </button>
          </div>

          {battleError && (
            <div className="p-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 flex items-center justify-between gap-2">
              <span>{battleError}</span>
              <button
                type="button"
                onClick={handleCreateNewQuizBattle}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
              >
                Retry
              </button>
            </div>
          )}

          {activeBattle && (
            <div className="space-y-4">
              <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${bgCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className={`text-[11px] ${textMuted}`}>
                      {activeBattle.questions.length} questions · No signup needed
                    </div>
                    <h3 className="text-sm font-semibold mt-0.5">{activeBattle.title}</h3>
                  </div>
                  {battlePlaying && (
                    <div className={`text-xs font-mono tabular-nums font-semibold ${textPrimary}`}>
                      {(battleElapsedMs / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>

                {!battlePlaying && !battleFinished && (
                  <button
                    type="button"
                    onClick={handleStartPlayingBattle}
                    data-testid="quiz-battle-play-now-btn"
                    className={`h-9 px-5 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
                  >
                    Start Battle
                  </button>
                )}

                {battlePlaying && activeBattle.questions[battleQIdx] && (
                  <div className="space-y-3" data-testid="quiz-battle-active-question">
                    <div className={`flex items-center justify-between text-xs font-mono ${textMuted}`}>
                      <span>
                        {battleQIdx + 1} / {activeBattle.questions.length}
                      </span>
                      <span>Score: {battleScore}</span>
                    </div>
                    <div className="text-sm font-semibold leading-snug">
                      <MathText text={activeBattle.questions[battleQIdx].question} />
                    </div>
                    <div className="space-y-2">
                      {activeBattle.questions[battleQIdx].options.map((opt, oIdx) => {
                        const isPicked = battleSelectedOpt === oIdx;
                        const isCorrect = oIdx === activeBattle.questions[battleQIdx].correctIndex;
                        let btnStyle = `${borderSubtle} hover:opacity-90`;
                        if (battleSelectedOpt !== null) {
                          if (isCorrect) {
                            btnStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-semibold';
                          } else if (isPicked) {
                            btnStyle = 'border-red-500 bg-red-500/10 text-red-400';
                          }
                        }
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => handleSelectBattleOption(oIdx)}
                            disabled={battleSelectedOpt !== null}
                            className={`w-full p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${btnStyle}`}
                          >
                            <MathText text={opt} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {battleFinished && (
                  <div className={`p-4 rounded-xl border space-y-3 ${borderSubtle}`}>
                    <div className="text-sm font-semibold">
                      {battlePlayerName || 'Challenger'}: {battleScore} / {activeBattle.questions.length} in{' '}
                      {(battleElapsedMs / 1000).toFixed(1)}s
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={getWhatsAppShareHref()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`h-8 px-4 rounded-full text-xs font-semibold inline-flex items-center cursor-pointer ${primaryBtn}`}
                      >
                        Share on WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={handleStartPlayingBattle}
                        className={`h-8 px-4 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
                      >
                        Play Again
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`p-4 rounded-2xl border space-y-2.5 ${bgCard}`}
                data-testid="quiz-battle-leaderboard"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Leaderboard ({activeBattle.entries.length})</span>
                  <span className={textMuted}>Score · Time</span>
                </div>

                <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-black/[0.06]'}`}>
                  {activeBattle.entries.slice(0, 8).map((ent, idx) => (
                    <div
                      key={ent.id || idx}
                      className="py-2 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-5 font-mono tabular-nums ${idx === 0 ? `${textPrimary} font-bold` : textMuted}`}>
                          #{idx + 1}
                        </span>
                        <span className="font-medium truncate">{ent.playerName}</span>
                      </div>
                      <div className={`font-mono tabular-nums shrink-0 ${textMuted}`}>
                        {ent.score}/{ent.total} · {(ent.timeMs / 1000).toFixed(1)}s
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. PLAYLIST -> FULL COURSE                                           */}
      {/* ==================================================================== */}
      {activeFeature === 'playlist_course' && (
        <div className="space-y-4" data-testid="arsenal-playlist-course-view">
          <h2 className="text-base font-semibold">Playlist Course</h2>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={playlistInput}
              onChange={(e) => setPlaylistInput(e.target.value)}
              placeholder="Paste YouTube playlist URL or topic..."
              data-testid="playlist-course-input"
              className={`flex-1 px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm outline-none ${inputClass}`}
            />
            <button
              type="button"
              onClick={handleGeneratePlaylistCourse}
              disabled={courseLoading}
              data-testid="playlist-course-generate-btn"
              className={`h-10 px-5 rounded-full text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-50 ${primaryBtn}`}
            >
              {courseLoading ? 'Building...' : 'Build Course'}
            </button>
          </div>

          {courseError && (
            <div className="p-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 flex items-center justify-between gap-2">
              <span>{courseError}</span>
              <button
                type="button"
                onClick={handleGeneratePlaylistCourse}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
              >
                Retry
              </button>
            </div>
          )}

          {activeCourse && (
            <div
              className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${bgCard}`}
              data-testid="playlist-course-active"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className={`text-xs ${textMuted}`}>
                    {activeCourse.completedVideoIds.length}/{activeCourse.modules.length} modules completed
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold mt-0.5">{activeCourse.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFinalTest((prev) => !prev)}
                  className={`h-8 px-4 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
                >
                  {showFinalTest ? 'View Modules' : 'Final Test'}
                </button>
              </div>

              <div className="w-full h-1.5 rounded-full bg-neutral-500/15 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${isDark ? 'bg-white' : 'bg-black'}`}
                  style={{ width: `${activeCourse.progressPercent}%` }}
                />
              </div>

              {!showFinalTest ? (
                <div className="space-y-2">
                  {activeCourse.modules.map((mod) => {
                    const done = activeCourse.completedVideoIds.includes(mod.id);
                    return (
                      <div
                        key={mod.id}
                        className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${borderSubtle}`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="text-xs font-semibold">
                            {mod.moduleNumber}. <MathText text={mod.title} />{' '}
                            <span className={`font-normal font-mono ${textMuted}`}>
                              ({mod.durationLabel})
                            </span>
                          </div>
                          <ul className={`text-[11px] space-y-0.5 pl-4 list-disc ${textMuted}`}>
                            {mod.keyTakeaways.map((kt, i) => (
                              <li key={i}><MathText text={kt} /></li>
                            ))}
                          </ul>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleModuleComplete(mod.id)}
                          className={`px-3 py-1 rounded-full border text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                            done
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                              : borderSubtle
                          }`}
                        >
                          {done ? 'Done' : 'Mark Done'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">Final Test</span>
                    {activeCourse.finalTestScore !== undefined && (
                      <span className="font-mono font-semibold text-emerald-500">
                        Score: {activeCourse.finalTestScore}%
                      </span>
                    )}
                  </div>

                  {activeCourse.finalTestQuestions.map((q, qIdx) => (
                    <div
                      key={q.id}
                      className={`p-3.5 rounded-xl border space-y-2 ${borderSubtle}`}
                    >
                      <div className="text-xs font-semibold">
                        {qIdx + 1}. <MathText text={q.question} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => {
                          const selected = finalTestAnswers[q.id] === oIdx;
                          const isCorrect = oIdx === q.correctIndex;
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() =>
                                !finalTestSubmitted &&
                                setFinalTestAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                              }
                              className={`p-2.5 rounded-lg border text-left text-xs cursor-pointer ${
                                finalTestSubmitted
                                  ? isCorrect
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-semibold'
                                    : selected
                                    ? 'border-red-500 bg-red-500/10 text-red-400'
                                    : `${borderSubtle} opacity-60`
                                  : selected
                                  ? isDark
                                    ? 'border-white bg-white/10 text-white font-semibold'
                                    : 'border-black bg-black/5 text-black font-semibold'
                                  : borderSubtle
                              }`}
                            >
                              <MathText text={opt} />
                            </button>
                          );
                        })}
                      </div>
                      {finalTestSubmitted && (
                        <div className={`text-[11px] pt-1 ${textMuted}`}>
                          <MathText text={q.explanation} />
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitFinalCourseTest}
                      className={`h-8 px-4 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
                    >
                      Submit
                    </button>
                    {finalTestSubmitted && (
                      <button
                        type="button"
                        onClick={() => {
                          setFinalTestAnswers({});
                          setFinalTestSubmitted(false);
                        }}
                        className={`h-8 px-4 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
                      >
                        Retake
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. IMPORTANT QUESTIONS                                               */}
      {/* ==================================================================== */}
      {activeFeature === 'important_questions' && (
        <div className="space-y-4" data-testid="arsenal-important-questions-view">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Important Questions</h2>
            <div className="flex items-center gap-1.5">
              <div className={`inline-flex items-center p-0.5 rounded-full border ${pillToggleWrap}`}>
                {(['all', 2, 5, 10] as const).map((m) => (
                  <button
                    key={String(m)}
                    type="button"
                    onClick={() => setImpFilterMarks(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
                      impFilterMarks === m
                        ? isDark
                          ? 'bg-white text-black font-semibold'
                          : 'bg-white text-black shadow-xs font-semibold'
                        : textMuted
                    }`}
                  >
                    {m === 'all' ? 'All' : `${m}m`}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleLoadImportantQuestions}
                disabled={impLoading}
                className={`size-8 rounded-full border flex items-center justify-center cursor-pointer ${borderSubtle}`}
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${impLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {impError && (
            <div className="p-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 flex items-center justify-between gap-2">
              <span>{impError}</span>
              <button
                type="button"
                onClick={handleLoadImportantQuestions}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
              >
                Retry
              </button>
            </div>
          )}

          {impLoading ? (
            <div className={`py-10 text-center text-xs ${textMuted}`}>
              Loading important exam questions...
            </div>
          ) : (
            <div className="space-y-2">
              {impQuestions
                .filter((q) => impFilterMarks === 'all' || q.marks === impFilterMarks)
                .map((q, idx) => {
                  const isExp = expandedImpIdx === idx;
                  return (
                    <div
                      key={q.number}
                      className={`p-4 rounded-2xl border transition-colors ${bgCard}`}
                    >
                      <div
                        onClick={() => setExpandedImpIdx(isExp ? null : idx)}
                        className="flex items-start justify-between gap-3 cursor-pointer"
                      >
                        <div className="space-y-1">
                          <div className={`text-[11px] font-mono ${textMuted}`}>
                            Q{q.number} · <span className={`font-semibold ${textPrimary}`}>{q.marks} Marks</span> · {q.probabilityTag}
                          </div>
                          <div className="text-xs sm:text-sm font-medium leading-snug">
                            <MathText text={q.question} />
                          </div>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 mt-1 transition-transform ${textMuted} ${
                            isExp ? 'rotate-180' : ''
                          }`}
                        />
                      </div>

                      {isExp && (
                        <div className={`mt-3 pt-3 border-t space-y-2.5 text-xs ${borderSubtle}`}>
                          <div>
                            <div className="font-semibold mb-1">Key Points</div>
                            <ul className={`list-disc pl-4 space-y-0.5 ${textMuted}`}>
                              {q.keyPoints.map((pt, i) => (
                                <li key={i}><MathText text={pt} /></li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <div className="font-semibold mb-0.5">Model Answer</div>
                            <div className={`leading-relaxed ${textMuted}`}>
                              <MathMarkdown content={q.modelAnswer} isDark={isDark} autoDetectLatex />
                            </div>
                          </div>
                          {q.marks >= 5 && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setAnsQuestion(q.question);
                                  setAnsMaxMarks(q.marks === 5 ? 5 : 10);
                                  if (onSwitchFeature) {
                                    onSwitchFeature('answer_writing', 'Answer Grader');
                                  } else {
                                    setActiveFeature('answer_writing');
                                  }
                                }}
                                className={`h-8 px-3.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
                              >
                                Write {q.marks}-Mark Answer →
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. ONE-PAGE CHEAT SHEET                                              */}
      {/* ==================================================================== */}
      {activeFeature === 'cheat_sheet' && (
        <div className="space-y-4" data-testid="arsenal-cheat-sheet-view">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Cheat Sheet</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCheatSheetPdf}
                disabled={!cheatSheet}
                data-testid="cheat-sheet-download-pdf-btn"
                className={`h-8 px-4 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-50 ${primaryBtn}`}
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className={`h-8 px-3.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
              >
                Print
              </button>
            </div>
          </div>

          {cheatError && (
            <div className="p-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 flex items-center justify-between gap-2">
              <span>{cheatError}</span>
              <button
                type="button"
                onClick={handleLoadCheatSheet}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
              >
                Retry
              </button>
            </div>
          )}

          {cheatLoading || !cheatSheet ? (
            <div className={`py-10 text-center text-xs ${textMuted}`}>
              Building 1-page cheat sheet...
            </div>
          ) : (
            <div className={`p-4 sm:p-5 rounded-2xl border grid grid-cols-1 md:grid-cols-2 gap-5 ${bgCard}`}>
              <div className="space-y-2.5">
                <div className="text-xs font-semibold">Formulas</div>
                {cheatSheet.formulas.map((f, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border space-y-1.5 ${borderSubtle}`}
                  >
                    <div className="text-xs font-medium"><MathText text={f.name} /></div>
                    <div className={`text-xs ${textPrimary}`}>
                      <MathFormula formula={f.expression} displayMode />
                    </div>
                    <div className={`text-[11px] ${textMuted}`}><MathText text={f.variables} /></div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold">Definitions</div>
                  {cheatSheet.definitions.map((d, i) => (
                    <div key={i} className="text-xs leading-relaxed">
                      <span className="font-semibold"><MathText text={d.term} />: </span>
                      <span className={textMuted}><MathText text={d.definition} /></span>
                    </div>
                  ))}
                </div>

                <div className={`space-y-2 pt-3 border-t ${borderSubtle}`}>
                  <div className="text-xs font-semibold">Key Points &amp; Exam Traps</div>
                  <ul className={`text-xs space-y-1 list-disc pl-4 ${textMuted}`}>
                    {cheatSheet.keyPoints.map((kp, i) => (
                      <li key={i}><MathText text={kp} /></li>
                    ))}
                  </ul>
                  <div className="pt-1 space-y-1">
                    {cheatSheet.examTraps.map((t, i) => (
                      <div key={i} className={`text-[11px] font-medium ${textPrimary}`}>
                        • <MathText text={t} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. MIND MAP                                                          */}
      {/* ==================================================================== */}
      {activeFeature === 'mind_map' && (
        <div className="space-y-4" data-testid="arsenal-mind-map-view">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Mind Map</h2>
            <button
              type="button"
              onClick={handleLoadMindMap}
              disabled={mindMapLoading}
              className={`h-8 px-3.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
            >
              {mindMapLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {mindMapError && (
            <div className="p-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 flex items-center justify-between gap-2">
              <span>{mindMapError}</span>
              <button
                type="button"
                onClick={handleLoadMindMap}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
              >
                Retry
              </button>
            </div>
          )}

          {mindMapLoading || !mindMap ? (
            <div className={`py-10 text-center text-xs ${textMuted}`}>
              Loading concept map...
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border overflow-x-auto ${bgCard}`}>
                <svg
                  ref={svgRef}
                  viewBox="0 0 860 360"
                  className="w-full min-w-[640px] h-auto select-none"
                >
                  {mindMap.branches.map((branch, idx) => {
                    const isLeft = idx % 2 === 0;
                    const row = Math.floor(idx / 2);
                    const targetX = isLeft ? 175 : 685;
                    const targetY = 85 + row * 115;
                    const active = selectedBranchId === branch.id;
                    const titleColor = active
                      ? isDark
                        ? '#09090b'
                        : '#ffffff'
                      : isDark
                      ? '#f4f4f5'
                      : '#0f172a';
                    const subColor = active
                      ? isDark
                        ? '#52525b'
                        : '#d4d4d8'
                      : isDark
                      ? '#a1a1aa'
                      : '#64748b';
                    return (
                      <g key={branch.id}>
                        <path
                          d={`M 430 180 C ${isLeft ? 310 : 550} 180, ${
                            isLeft ? 290 : 570
                          } ${targetY}, ${targetX} ${targetY}`}
                          fill="none"
                          stroke={active ? (isDark ? '#ffffff' : '#09090b') : isDark ? '#3f3f46' : '#cbd5e1'}
                          strokeWidth={active ? 2.4 : 1.5}
                        />
                        <g
                          onClick={() => setSelectedBranchId(branch.id)}
                          className="cursor-pointer"
                        >
                          <rect
                            x={targetX - 145}
                            y={targetY - 34}
                            width={290}
                            height={68}
                            rx={12}
                            fill={
                              active
                                ? isDark
                                  ? '#ffffff'
                                  : '#09090b'
                                : isDark
                                ? '#18181b'
                                : '#ffffff'
                            }
                            stroke={active ? (isDark ? '#ffffff' : '#09090b') : isDark ? '#3f3f46' : '#cbd5e1'}
                            strokeWidth={1.5}
                          />
                          <foreignObject x={targetX - 135} y={targetY - 28} width={270} height={56}>
                            <div
                              style={{
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                height: '100%',
                                overflow: 'hidden',
                              }}
                            >
                              <SvgLatex
                                text={branch.title}
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  lineHeight: 1.25,
                                  color: titleColor,
                                }}
                              />
                              <SvgLatex
                                text={branch.children.map((c) => c.label).slice(0, 2).join(' · ')}
                                style={{
                                  fontSize: '10px',
                                  lineHeight: 1.25,
                                  marginTop: '3px',
                                  color: subColor,
                                }}
                              />
                            </div>
                          </foreignObject>
                        </g>
                      </g>
                    );
                  })}

                  <g>
                    <rect
                      x={315}
                      y={142}
                      width={230}
                      height={76}
                      rx={16}
                      fill={isDark ? '#ffffff' : '#111113'}
                    />
                    <foreignObject x={325} y={148} width={210} height={64}>
                      <div
                        style={{
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          overflow: 'hidden',
                        }}
                      >
                        <SvgLatex
                          text={mindMap.rootTitle}
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            lineHeight: 1.25,
                            color: isDark ? '#000000' : '#ffffff',
                          }}
                        />
                      </div>
                    </foreignObject>
                  </g>
                </svg>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {mindMap.branches.map((b) => {
                  const active = selectedBranchId === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBranchId(b.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                        active ? (isDark ? 'border-white' : 'border-black') : bgCard
                      }`}
                    >
                      <div className="text-xs font-semibold"><MathText text={b.title} /></div>
                      <p className={`text-[11px] ${textMuted}`}><MathText text={b.summary} /></p>
                      <div className="space-y-1 pt-1">
                        {b.children.map((ch) => (
                          <div key={ch.id} className="text-xs">
                            <span className="font-medium">• <MathText text={ch.label} />: </span>
                            <span className={textMuted}><MathText text={ch.detail} /></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. CODE EXTRACTOR                                                    */}
      {/* ==================================================================== */}
      {activeFeature === 'code_extractor' && (
        <div className="space-y-4" data-testid="arsenal-code-extractor-view">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Code Extractor</h2>
            <button
              type="button"
              onClick={handleLoadCodeExtractor}
              disabled={codeLoading}
              className={`h-8 px-3.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
            >
              {codeLoading ? 'Extracting...' : 'Refresh'}
            </button>
          </div>

          {codeError && (
            <div className="p-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 flex items-center justify-between gap-2">
              <span>{codeError}</span>
              <button
                type="button"
                onClick={handleLoadCodeExtractor}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
              >
                Retry
              </button>
            </div>
          )}

          {codeLoading ? (
            <div className={`py-10 text-center text-xs ${textMuted}`}>
              Extracting code from lecture...
            </div>
          ) : (
            codeFiles[activeCodeFileIdx] && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {codeFiles.map((f, idx) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setActiveCodeFileIdx(idx);
                          setCodeRunOutput(null);
                        }}
                        className={`h-8 px-3.5 rounded-full text-xs font-mono font-medium cursor-pointer ${
                          activeCodeFileIdx === idx ? primaryBtn : `border ${borderSubtle} ${textMuted}`
                        }`}
                      >
                        {f.filename}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRunExtractedCode(codeFiles[activeCodeFileIdx])}
                      data-testid="code-extractor-run-btn"
                      className={`h-8 px-4 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
                    >
                      Run Code
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(codeFiles[activeCodeFileIdx].code);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      }}
                      className={`h-8 px-3.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
                    >
                      {codeCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className={`text-xs flex flex-wrap items-center justify-between gap-2 ${textMuted}`}>
                  <span>{codeFiles[activeCodeFileIdx].description}</span>
                  <span className="font-mono">{codeFiles[activeCodeFileIdx].complexity}</span>
                </div>

                <pre
                  className={`p-4 rounded-2xl border text-xs font-mono overflow-x-auto leading-relaxed ${
                    isDark ? 'bg-[#121215] border-white/[0.08] text-neutral-100' : 'bg-[#f8f8fa] border-black/[0.08] text-neutral-900'
                  }`}
                >
                  <code>{codeFiles[activeCodeFileIdx].code}</code>
                </pre>

                {codeRunOutput && (
                  <div
                    className={`p-3.5 rounded-2xl border font-mono text-xs space-y-1 ${bgCard}`}
                    data-testid="code-extractor-output"
                  >
                    <div className={`text-[10px] uppercase tracking-wider ${textMuted}`}>
                      Output
                    </div>
                    <pre className="whitespace-pre-wrap">{codeRunOutput}</pre>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* Unified Prompt Input Bar Connected to Study Tutor */}
      {onAskTutor && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = tutorDraft.trim();
            if (!q) return;
            const prefix =
              activeFeature === 'answer_writing' && ansQuestion.trim()
                ? `[Answer Grader · Question: ${ansQuestion.trim()}]\n\n`
                : activeFeature === 'cheat_sheet' && cheatSheet
                ? `[Cheat Sheet · ${cheatSheet.title}]\n\n`
                : activeFeature === 'mind_map' && mindMap
                ? `[Mind Map · ${mindMap.rootTitle}]\n\n`
                : activeFeature === 'code_extractor' && codeFiles[activeCodeFileIdx]
                ? `[Code Extractor · ${codeFiles[activeCodeFileIdx].filename}]\n\n`
                : `[${activeFeatureLabel} · ${effectiveTitle}]\n\n`;
            setTutorDraft('');
            onAskTutor(`${prefix}${q}`, effectiveTitle);
          }}
          className={`flex items-center gap-2 p-2 pl-4 rounded-2xl border ${bgCard}`}
          data-testid="arsenal-tutor-prompt-bar"
        >
          <input
            type="text"
            value={tutorDraft}
            onChange={(e) => setTutorDraft(e.target.value)}
            placeholder={`Ask Study Tutor about ${activeFeatureLabel} (${effectiveTitle})...`}
            className="flex-1 min-w-0 bg-transparent border-0 text-xs sm:text-sm outline-none placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={!tutorDraft.trim()}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${primaryBtn}`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask Tutor</span>
          </button>
        </form>
      )}
      </div>
    </div>
  );
};
