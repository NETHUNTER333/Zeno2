import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  Trash2,
  X,
} from 'lucide-react';
import {
  StudyLoopStore,
  computeSha256FileHash,
  startBackgroundAudioRecap,
  stopBackgroundAudioRecap,
  promptGuestSignInForVault,
  type StudyExam,
  type RecallCard,
  type RecallGrade,
  type StudyLanguage,
  type UploadedStudyPack,
  type SnapSolveResult,
} from '../lib/studyLoopStore';
import { UserAccountStore, toIstDateKey } from '../lib/userAccountStore';
import { KnowledgeVaultStore, VaultThreadStore } from '../lib/growthStore';
import { extractTextFromPdfFile } from '../lib/pdfStudyEngine';

interface StudyLoopPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialTab?: 'revision' | 'plan' | 'weak_spots' | 'upload' | 'snap_solve';
  embedded?: boolean;
  isDark?: boolean;
  onOpenPricing?: () => void;
}

export const StudyLoopPanel: React.FC<StudyLoopPanelProps> = ({
  isOpen = true,
  onClose,
  initialTab = 'revision',
  embedded = false,
  isDark: isDarkProp,
  onOpenPricing,
}) => {
  const [detectedDark, setDetectedDark] = useState<boolean>(() => {
    if (typeof isDarkProp === 'boolean') return isDarkProp;
    try {
      return localStorage.getItem('kinich_theme') !== 'light';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (typeof isDarkProp === 'boolean') {
      setDetectedDark(isDarkProp);
    }
  }, [isDarkProp]);

  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : detectedDark;

  const [activeTab, setActiveTab] = useState<
    'revision' | 'plan' | 'weak_spots' | 'upload' | 'snap_solve'
  >(initialTab);
  const [exams, setExams] = useState<StudyExam[]>(() => StudyLoopStore.getExams());
  const [cards, setCards] = useState<RecallCard[]>(() => StudyLoopStore.getCards());
  const [streak, setStreak] = useState(() => UserAccountStore.getDailyStreak());
  const [planTier, setPlanTier] = useState<'free' | 'spark' | 'fire'>(() =>
    UserAccountStore.getCurrentPlan()
  );
  const [language, setLanguage] = useState<StudyLanguage>(() =>
    UserAccountStore.getPreferredStudyLanguage()
  );
  const [isGuest, setIsGuest] = useState<boolean>(() => UserAccountStore.isGuest());

  // Add Exam Modal State
  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [examNameInput, setExamNameInput] = useState('');
  const [examSubjectInput, setExamSubjectInput] = useState('Physics');
  const [examDateInput, setExamDateInput] = useState(() => {
    const today = toIstDateKey();
    const [y, m, d] = today.split('-').map(Number);
    return new Date(Date.UTC(y || 2026, (m || 1) - 1, (d || 1) + 9))
      .toISOString()
      .slice(0, 10);
  });
  const [customChapterInput, setCustomChapterInput] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([
    'Thermodynamics & Heat Engines',
    'Electromagnetism & Circuits',
    'Optics & Wave Phenomena',
  ]);
  const [examFormError, setExamFormError] = useState<string | null>(null);

  // Daily Revision Active Card State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [revisionBannerMsg, setRevisionBannerMsg] = useState<string | null>(null);

  // Quick Add Card State
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');
  const [newCardChapter, setNewCardChapter] = useState('Thermodynamics & Heat Engines');

  // Weak Spots Drill State
  const [drillingChapter, setDrillingChapter] = useState<string | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [drillQuestions, setDrillQuestions] = useState<
    Array<{
      id: string;
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
      chapter: string;
      subject: string;
    }>
  >([]);
  const [drillAnswers, setDrillAnswers] = useState<Record<string, number>>({});

  // Phase B: Upload Anything State
  const [uploadMode, setUploadMode] = useState<'pdf' | 'image' | 'text'>('pdf');
  const [pastedStudyTitle, setPastedStudyTitle] = useState('');
  const [pastedStudyText, setPastedStudyText] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadInput, setLastUploadInput] = useState<any>(null);
  const [activeStudyPack, setActiveStudyPack] = useState<UploadedStudyPack | null>(null);
  const [packSubTab, setPackSubTab] = useState<'summary' | 'flashcards' | 'quiz'>('summary');
  const [packQuizAnswers, setPackQuizAnswers] = useState<Record<string, number>>({});
  const [packFlippedCards, setPackFlippedCards] = useState<Record<string, boolean>>({});
  const [packTranslatedSummary, setPackTranslatedSummary] = useState<string | null>(null);
  const [packTranslating, setPackTranslating] = useState(false);
  const [packTranslateError, setPackTranslateError] = useState<string | null>(null);
  const [recallAddedToast, setRecallAddedToast] = useState<string | null>(null);

  // Phase C: Audio Recap State
  const [audioState, setAudioState] = useState<
    'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'
  >('idle');
  const [audioInfoMsg, setAudioInfoMsg] = useState<string | null>(null);
  const [audioScriptPreview, setAudioScriptPreview] = useState<string | null>(null);
  const [audioIsPreviewTier, setAudioIsPreviewTier] = useState(false);

  // Phase B: Snap & Solve State
  const [snapQuestionText, setSnapQuestionText] = useState('');
  const [snapImageDataUrl, setSnapImageDataUrl] = useState<string | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);
  const [snapResult, setSnapResult] = useState<SnapSolveResult | null>(null);
  const [snapPracticeAnswer, setSnapPracticeAnswer] = useState<number | null>(null);
  const [snapTranslatedText, setSnapTranslatedText] = useState<string | null>(null);
  const [snapTranslating, setSnapTranslating] = useState(false);
  const [snapTranslateError, setSnapTranslateError] = useState<string | null>(null);

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const snapInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    StudyLoopStore.syncFromFirestore();
    const refresh = () => {
      setExams(StudyLoopStore.getExams());
      setCards(StudyLoopStore.getCards());
      setStreak(UserAccountStore.getDailyStreak());
      setPlanTier(UserAccountStore.getCurrentPlan());
      setLanguage(UserAccountStore.getPreferredStudyLanguage());
      setIsGuest(UserAccountStore.isGuest());
    };
    window.addEventListener('kinich-study-loop-updated', refresh);
    window.addEventListener('kinich-account-updated', refresh);
    window.addEventListener('kinich-language-changed', refresh);
    return () => {
      window.removeEventListener('kinich-study-loop-updated', refresh);
      window.removeEventListener('kinich-account-updated', refresh);
      window.removeEventListener('kinich-language-changed', refresh);
    };
  }, []);

  const vaultChapters = useMemo(() => {
    const set = new Set<string>();
    try {
      KnowledgeVaultStore.getItems().forEach((it) => {
        if (it.chapter && it.chapter !== 'Uncategorized') set.add(it.chapter);
      });
      VaultThreadStore.getThreads().forEach((th) => {
        if (th.chapter && th.chapter !== 'Uncategorized') set.add(th.chapter);
      });
    } catch {}
    [
      'Thermodynamics & Heat Engines',
      'Electromagnetism & Circuits',
      'Quantum Mechanics & Photons',
      'Organic Reaction Mechanisms',
      'Calculus & Differential Equations',
      'Cellular Energetics & ATP',
    ].forEach((d) => set.add(d));
    return Array.from(set).slice(0, 18);
  }, [exams, cards]);

  const revisionSummary = useMemo(
    () => StudyLoopStore.getDailyRevisionSummary(),
    [exams, cards, planTier]
  );

  const weakSpots = useMemo(
    () => StudyLoopStore.getWeakSpotsByChapter(),
    [exams, cards]
  );

  const tierLimits = useMemo(() => StudyLoopStore.getTierLimits(), [planTier]);
  const dailyReviewStats = useMemo(
    () => StudyLoopStore.getDailyReviewCount(),
    [cards, planTier]
  );

  const activeCard =
    revisionSummary.mixedQueue[currentCardIndex] || revisionSummary.mixedQueue[0] || null;

  // Theme helper tokens for crisp Light & Dark mode
  const surfaceOuter = isDark
    ? 'bg-[#121215] border-white/[0.08] text-neutral-100'
    : 'bg-white border-black/[0.08] text-neutral-900 shadow-xs';
  const surfaceHeader = isDark
    ? 'bg-white/[0.015] border-white/[0.07]'
    : 'bg-[#f8f8fa] border-black/[0.06]';
  const surfaceInner = isDark
    ? 'bg-white/[0.025] border-white/[0.08]'
    : 'bg-[#f9f9fb] border-black/[0.07]';
  const surfaceElevated = isDark
    ? 'bg-black/40 border-white/[0.09]'
    : 'bg-white border-black/[0.08]';
  const inputClass = isDark
    ? 'bg-black/40 border-white/[0.12] text-white placeholder:text-neutral-500 focus:border-[#FC4C01]'
    : 'bg-white border-black/[0.12] text-neutral-900 placeholder:text-neutral-400 focus:border-[#FC4C01]';
  const textPrimary = isDark ? 'text-neutral-100' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const borderSubtle = isDark ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const btnGhost = isDark
    ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-neutral-200'
    : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.1] text-neutral-700';

  const handleGradeCard = async (grade: RecallGrade) => {
    if (!activeCard) return;
    setRevisionBannerMsg(null);
    const res = await StudyLoopStore.gradeCard(activeCard.id, grade);
    if (!res.ok) {
      setRevisionBannerMsg(res.error || 'Could not record review.');
      return;
    }
    setIsCardFlipped(false);
    setSelectedQuizOption(null);
    setExams(StudyLoopStore.getExams());
    setCards(StudyLoopStore.getCards());
    if (currentCardIndex + 1 < revisionSummary.mixedQueue.length) {
      setCurrentCardIndex((prev) => prev + 1);
    } else {
      setCurrentCardIndex(0);
      setRevisionBannerMsg('Great job! You completed this round of due Recall cards.');
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setExamFormError(null);
    if (!examNameInput.trim()) {
      setExamFormError('Please enter your exam name (e.g. Physics Final, JEE Main, NEET).');
      return;
    }
    if (selectedChapters.length === 0) {
      setExamFormError('Please select or add at least 1 chapter for your exam.');
      return;
    }
    const res = await StudyLoopStore.addOrUpdateExam({
      name: examNameInput.trim(),
      examDate: examDateInput,
      subject: examSubjectInput.trim() || 'General Studies',
      chapters: selectedChapters,
    });
    if (!res.ok) {
      if (!res.requiresSignIn) {
        setExamFormError(res.error || 'Could not save exam.');
      }
      return;
    }
    setShowAddExamModal(false);
    setExamNameInput('');
    setExams(StudyLoopStore.getExams());
    setActiveTab('plan');
  };

  const handleQuickAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardFront.trim() || !newCardBack.trim()) return;
    const res = await StudyLoopStore.addCardsToRecall([
      {
        type: 'flashcard',
        front: newCardFront.trim(),
        back: newCardBack.trim(),
        subject: examSubjectInput || 'General Studies',
        chapter: newCardChapter.trim() || 'Core Concepts',
      },
    ]);
    if (res.ok) {
      setNewCardFront('');
      setNewCardBack('');
      setShowAddCardForm(false);
      setCards(StudyLoopStore.getCards());
      setRevisionBannerMsg('Card added to your SM-2 Recall deck!');
    }
  };

  const handlePracticeWeakTopic = async (chapter: string, subject: string) => {
    setDrillingChapter(chapter);
    setDrillLoading(true);
    setDrillError(null);
    setDrillQuestions([]);
    setDrillAnswers({});

    const nearest = revisionSummary.nearestExam?.exam.name || '';
    const res = await StudyLoopStore.generateWeakChapterPractice(chapter, subject, nearest);
    setDrillLoading(false);
    if (!res.ok || !res.questions) {
      setDrillError(res.error || 'Could not generate practice questions. Tap Retry.');
      return;
    }
    setDrillQuestions(res.questions);
    setCards(StudyLoopStore.getCards());
  };

  const handleToggleWebPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      UserAccountStore.updateStreakReminderSettings({
        reminderEnabled: true,
        browserNotificationsEnabled: false,
      });
      setStreak(UserAccountStore.getDailyStreak());
      return;
    }
    if (Notification.permission === 'granted') {
      const nextVal = !streak.browserNotificationsEnabled;
      UserAccountStore.updateStreakReminderSettings({
        reminderEnabled: true,
        browserNotificationsEnabled: nextVal,
      });
      setStreak(UserAccountStore.getDailyStreak());
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      UserAccountStore.updateStreakReminderSettings({
        reminderEnabled: true,
        browserNotificationsEnabled: perm === 'granted',
      });
      setStreak(UserAccountStore.getDailyStreak());
    } catch {
      UserAccountStore.updateStreakReminderSettings({
        reminderEnabled: true,
        browserNotificationsEnabled: false,
      });
      setStreak(UserAccountStore.getDailyStreak());
    }
  };

  // Phase B: PDF File Upload Handler
  const handlePdfUpload = async (file: File) => {
    setUploadError(null);
    setUploadLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const fileHash = await computeSha256FileHash(buf);
      const maxPages = tierLimits.pdfMaxPages;
      const extracted = await extractTextFromPdfFile(file, file.name);

      if (extracted.pageCount > maxPages) {
        setUploadLoading(false);
        setUploadError(
          `This PDF has ${extracted.pageCount} pages. Your ${tierLimits.tier.toUpperCase()} tier supports up to ${maxPages} pages (Free: 50, Spark: 150, Fire: 300).`
        );
        return;
      }

      const payload = {
        type: 'pdf' as const,
        title: file.name.replace(/\.pdf$/i, ''),
        fileHash,
        pageCount: Math.max(1, extracted.pageCount),
        pagesText: extracted.pages.map((pText: string, idx: number) => ({
          page: idx + 1,
          text: pText.replace(/^\[Page\s+\d+\]\s*/i, ''),
        })),
      };
      setLastUploadInput(payload);

      const res = await StudyLoopStore.uploadAndSynthesizeStudyPack(payload);
      setUploadLoading(false);
      if (!res.ok || !res.studyPack) {
        setUploadError(res.error || 'Could not analyze PDF. Tap Retry.');
        return;
      }
      setActiveStudyPack(res.studyPack);
      setPackTranslatedSummary(null);
    } catch {
      setUploadLoading(false);
      setUploadError('Could not read PDF file. Please try another PDF or tap Retry.');
    }
  };

  // Phase B: Image OCR Upload Handler
  const handleImageStudyUpload = async (file: File) => {
    setUploadError(null);
    setUploadLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const fileHash = await computeSha256FileHash(buf);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const payload = {
        type: 'image' as const,
        title: file.name.replace(/\.[a-z0-9]+$/i, '') || 'Handwritten / Textbook Notes',
        fileHash,
        pageCount: 1,
        imageDataUrl: dataUrl,
      };
      setLastUploadInput(payload);

      const res = await StudyLoopStore.uploadAndSynthesizeStudyPack(payload);
      setUploadLoading(false);
      if (!res.ok || !res.studyPack) {
        setUploadError(res.error || 'Could not run OCR on image. Tap Retry.');
        return;
      }
      setActiveStudyPack(res.studyPack);
      setPackTranslatedSummary(null);
    } catch {
      setUploadLoading(false);
      setUploadError('Could not process image upload. Tap Retry.');
    }
  };

  // Phase B: Pasted Text Study Handler
  const handlePastedTextUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedStudyText.trim()) return;
    setUploadError(null);
    setUploadLoading(true);
    const fileHash = await computeSha256FileHash(pastedStudyText.trim());
    const payload = {
      type: 'text' as const,
      title: pastedStudyTitle.trim() || 'Pasted Study Notes',
      fileHash,
      pageCount: Math.max(1, Math.ceil(pastedStudyText.trim().length / 1600)),
      rawText: pastedStudyText.trim(),
    };
    setLastUploadInput(payload);

    const res = await StudyLoopStore.uploadAndSynthesizeStudyPack(payload);
    setUploadLoading(false);
    if (!res.ok || !res.studyPack) {
      setUploadError(res.error || 'Could not synthesize study notes. Tap Retry.');
      return;
    }
    setActiveStudyPack(res.studyPack);
    setPackTranslatedSummary(null);
  };

  const handleRetryUpload = async () => {
    if (!lastUploadInput) return;
    setUploadError(null);
    setUploadLoading(true);
    const res = await StudyLoopStore.uploadAndSynthesizeStudyPack(lastUploadInput);
    setUploadLoading(false);
    if (!res.ok || !res.studyPack) {
      setUploadError(res.error || 'Upload analysis failed. Tap Retry.');
      return;
    }
    setActiveStudyPack(res.studyPack);
  };

  const handleAddPackToRecall = async (studyPack: UploadedStudyPack) => {
    const itemsToSave = [
      ...studyPack.flashcards.map((f) => ({
        type: 'flashcard' as const,
        front: f.front,
        back: f.back,
        subject: studyPack.subject,
        chapter: f.chapter || studyPack.chapter,
        sourceId: studyPack.id,
        pageOrTimestamp: f.pageLabel || `Page ${f.page}`,
      })),
      ...studyPack.quiz.map((q) => ({
        type: 'quiz' as const,
        front: q.question,
        back: q.options[q.correctIndex] || q.explanation,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        subject: studyPack.subject,
        chapter: q.chapter || studyPack.chapter,
        sourceId: studyPack.id,
        pageOrTimestamp: q.pageLabel || `Page ${q.page}`,
      })),
    ];

    const res = await StudyLoopStore.addCardsToRecall(itemsToSave);
    if (res.ok) {
      setCards(StudyLoopStore.getCards());
      setRecallAddedToast(
        `Added ${res.addedCount || itemsToSave.length} cards (${studyPack.title}) to your Recall deck!`
      );
      setTimeout(() => setRecallAddedToast(null), 4000);
    }
  };

  // Phase C: Audio Recap Handler on Summary
  const handleListenAudioRecap = async (
    itemId: string,
    title: string,
    summaryBullets: Array<{ text: string; page: number }>
  ) => {
    if (audioState === 'playing') {
      stopBackgroundAudioRecap();
      setAudioState('idle');
      return;
    }

    setAudioState('loading');
    setAudioInfoMsg(null);
    const summaryText = summaryBullets
      .map((b) => `Page ${b.page}: ${b.text}`)
      .join('. ');

    const res = await StudyLoopStore.fetchAudioRecap({
      itemId,
      title,
      summaryText,
      language,
    });

    if (!res.ok || !res.script) {
      setAudioState('error');
      setAudioInfoMsg(res.error || 'Could not generate Audio Recap. Tap Retry.');
      return;
    }

    setAudioScriptPreview(res.script);
    setAudioIsPreviewTier(Boolean(res.isPreview));

    await startBackgroundAudioRecap({
      itemId,
      title,
      script: res.script,
      language,
      isPreview: Boolean(res.isPreview),
      maxDurationSeconds: res.maxDurationSeconds || 30,
      onStateChange: (st, info) => {
        setAudioState(st);
        if (info) setAudioInfoMsg(info);
      },
    });
  };

  // Phase D: Explain in Telugu / Hindi on Pack Summary
  const handleExplainPackSummary = async (targetLang: StudyLanguage) => {
    setLanguage(targetLang);
    UserAccountStore.setPreferredStudyLanguage(targetLang);
    if (!activeStudyPack) return;
    if (targetLang === 'English') {
      setPackTranslatedSummary(null);
      setPackTranslateError(null);
      return;
    }

    setPackTranslating(true);
    setPackTranslateError(null);
    const rawSummary = activeStudyPack.summaryBullets
      .map((b) => `[Page ${b.page}] ${b.text}`)
      .join('\n');

    const res = await StudyLoopStore.explainInLanguage(rawSummary, targetLang);
    setPackTranslating(false);
    if (!res.ok || !res.explainedText) {
      setPackTranslateError(res.error || `Could not explain in ${targetLang}. Tap Retry.`);
      return;
    }
    setPackTranslatedSummary(res.explainedText);
  };

  // Phase B: Snap & Solve Handler
  const handleSnapImageUpload = async (file: File) => {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setSnapImageDataUrl(dataUrl);
      await triggerSnapSolve(dataUrl, snapQuestionText, language);
    } catch {
      setSnapError('Could not load question photo. Please try again.');
    }
  };

  const triggerSnapSolve = async (
    imgUrl: string | null,
    qText: string,
    lang: StudyLanguage
  ) => {
    if (!imgUrl && !qText.trim()) {
      setSnapError('Upload a photo of a question or type/paste the question below.');
      return;
    }
    setSnapLoading(true);
    setSnapError(null);
    setSnapPracticeAnswer(null);
    setSnapTranslatedText(null);

    const res = await StudyLoopStore.runSnapAndSolve({
      imageDataUrl: imgUrl || undefined,
      questionText: qText.trim() || undefined,
      language: lang,
    });
    setSnapLoading(false);
    if (!res.ok || !res.result) {
      setSnapError(res.error || 'Snap & Solve timed out. Tap Retry.');
      return;
    }
    setSnapResult(res.result);
  };

  const handleExplainSnapSolve = async (targetLang: StudyLanguage) => {
    setLanguage(targetLang);
    UserAccountStore.setPreferredStudyLanguage(targetLang);
    if (!snapResult) return;
    if (targetLang === 'English') {
      setSnapTranslatedText(null);
      setSnapTranslateError(null);
      return;
    }
    setSnapTranslating(true);
    setSnapTranslateError(null);
    const combined = `${snapResult.steps.join('\n')}\n\nConcept (${snapResult.conceptBehindIt.title}): ${snapResult.conceptBehindIt.explanation}`;
    const res = await StudyLoopStore.explainInLanguage(combined, targetLang);
    setSnapTranslating(false);
    if (!res.ok || !res.explainedText) {
      setSnapTranslateError(res.error || `Could not explain in ${targetLang}. Tap Retry.`);
      return;
    }
    setSnapTranslatedText(res.explainedText);
  };

  if (!isOpen) return null;

  const containerClass = embedded
    ? 'w-full'
    : 'fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 overflow-y-auto';

  const panelClass = embedded
    ? `w-full rounded-2xl border overflow-hidden transition-colors ${surfaceOuter}`
    : `w-full max-w-5xl rounded-2xl border overflow-hidden shadow-2xl max-h-[92vh] flex flex-col ${surfaceOuter}`;

  return (
    <div className={containerClass} data-testid="study-loop-panel">
      <div className={panelClass}>
        {/* Simple Header */}
        <div className={`px-4 py-3 sm:px-5 sm:py-3.5 border-b flex flex-col gap-2.5 ${surfaceHeader}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className={`text-sm font-semibold tracking-tight ${textPrimary}`}>
                Study Loop
              </h2>
              <span className={`text-xs ${textSecondary}`}>·</span>
              <span
                className="text-xs font-semibold text-[#FC4C01]"
                data-testid="study-streak-counter"
              >
                {streak.currentStreak}d streak
              </span>
              <span className={`text-xs ${textSecondary}`}>·</span>
              <span
                className={`text-xs font-mono tabular-nums ${textSecondary}`}
                data-testid="daily-revision-summary-badge"
              >
                {dailyReviewStats.reviewedToday}/{tierLimits.dailyRecallReviews} reviewed
              </span>
              {revisionSummary.nearestExam && (
                <>
                  <span className={`text-xs hidden sm:inline ${textSecondary}`}>·</span>
                  <span
                    data-testid="exam-countdown-banner"
                    className="text-xs font-semibold text-[#FC4C01]"
                  >
                    {revisionSummary.nearestExam.countdownLabel}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                data-testid="add-exam-btn"
                onClick={() => {
                  setExamFormError(null);
                  setShowAddExamModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition cursor-pointer"
              >
                + Add exam
              </button>

              {onClose && !embedded && (
                <button
                  type="button"
                  onClick={onClose}
                  className={`p-1.5 rounded-lg border transition cursor-pointer ${btnGhost}`}
                  aria-label="Close Study Loop"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 pt-0.5">
            {[
              { id: 'revision', label: 'Daily Recall' },
              { id: 'plan', label: 'Exam Plan' },
              { id: 'weak_spots', label: 'Weak Spots' },
              { id: 'upload', label: 'Upload Pack' },
              { id: 'snap_solve', label: 'Snap & Solve' },
            ].map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`study-loop-tab-${t.id}`}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center justify-center px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer truncate ${
                    isActive
                      ? 'bg-[#FC4C01] text-white'
                      : isDark
                      ? 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'
                      : 'bg-white text-neutral-700 hover:bg-black/[0.04] hover:text-black border border-black/[0.07]'
                  }`}
                >
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {isGuest && (
            <div
              className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
                isDark
                  ? 'bg-[#FC4C01]/10 border-[#FC4C01]/25 text-neutral-200'
                  : 'bg-[#FC4C01]/[0.06] border-[#FC4C01]/25 text-neutral-800'
              }`}
            >
              <span>
                Guest mode preview — sign in to save your exams and SM-2 Recall deck to your Vault.
              </span>
              <button
                type="button"
                onClick={() => promptGuestSignInForVault('Sign in to keep this in your Vault')}
                className="px-2.5 py-1 rounded-lg bg-[#FC4C01] text-white font-semibold hover:bg-[#e04300] transition cursor-pointer shrink-0"
              >
                Sign in
              </button>
            </div>
          )}

          {recallAddedToast && (
            <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
              <span>{recallAddedToast}</span>
              <button
                type="button"
                onClick={() => setRecallAddedToast(null)}
                className="opacity-70 hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 1: DAILY REVISION (SM-2 RECALL ENGINE)                       */}
          {/* ================================================================ */}
          {activeTab === 'revision' && (
            <div className="space-y-3" data-testid="daily-revision-screen">
              {/* Compact Queue Bar + IST Reminder */}
              <div
                className={`flex flex-wrap items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 ${surfaceInner}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`font-semibold ${textPrimary}`}>
                    Today: {revisionSummary.totalCardsToday} cards (~{revisionSummary.estimatedMinutes} min)
                  </span>
                  <span className={textSecondary}>
                    · {revisionSummary.dueCards.length} due, {revisionSummary.weakCards.length} weak-topic,{' '}
                    {revisionSummary.nearestExamCards.length} exam
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`inline-flex items-center gap-1.5 text-[11px] ${textSecondary}`}>
                    <input
                      type="time"
                      aria-label="Daily IST reminder time"
                      data-testid="ist-reminder-time-input"
                      value={streak.reminderTime || '19:00'}
                      onChange={(e) => {
                        UserAccountStore.updateStreakReminderSettings({
                          reminderEnabled: true,
                          reminderTime: e.target.value || '19:00',
                        });
                        setStreak(UserAccountStore.getDailyStreak());
                      }}
                      className={`rounded-md border px-1.5 py-0.5 text-[11px] font-mono outline-none ${inputClass}`}
                    />
                    <span>IST</span>
                    <button
                      type="button"
                      onClick={handleToggleWebPush}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition cursor-pointer ${
                        streak.browserNotificationsEnabled
                          ? 'bg-[#FC4C01]/15 border-[#FC4C01]/40 text-[#FC4C01]'
                          : btnGhost
                      }`}
                    >
                      {streak.browserNotificationsEnabled ? 'Push On' : 'Push'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isGuest) {
                        promptGuestSignInForVault('Sign in to keep this in your Vault');
                        return;
                      }
                      setShowAddCardForm((v) => !v);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer ${btnGhost}`}
                  >
                    + New Card
                  </button>
                </div>
              </div>

              {showAddCardForm && (
                <form
                  onSubmit={handleQuickAddCard}
                  className={`rounded-xl border p-3.5 space-y-2.5 ${surfaceInner}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#FC4C01]">
                      New Flashcard in Recall (SM-2)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddCardForm(false)}
                      className={textSecondary}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Question / Front of card"
                      value={newCardFront}
                      onChange={(e) => setNewCardFront(e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${inputClass}`}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Answer / Back of card"
                      value={newCardBack}
                      onChange={(e) => setNewCardBack(e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${inputClass}`}
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Chapter (e.g. Thermodynamics)"
                      value={newCardChapter}
                      onChange={(e) => setNewCardChapter(e.target.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs flex-1 outline-none ${inputClass}`}
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-[#FC4C01] text-white text-xs font-semibold hover:bg-[#e04300] transition cursor-pointer"
                    >
                      Save Card
                    </button>
                  </div>
                </form>
              )}

              {revisionBannerMsg && (
                <div className="p-3 rounded-xl bg-[#FC4C01]/10 border border-[#FC4C01]/30 text-xs flex items-center justify-between gap-2">
                  <span className={textPrimary}>{revisionBannerMsg}</span>
                  {planTier === 'free' && onOpenPricing && (
                    <button
                      type="button"
                      onClick={onOpenPricing}
                      className="px-3 py-1 rounded-lg bg-[#FC4C01] text-white font-semibold shrink-0 cursor-pointer"
                    >
                      Upgrade Tier
                    </button>
                  )}
                </div>
              )}

              {activeCard ? (
                <div
                  className={`rounded-xl border p-4 sm:p-5 space-y-4 ${surfaceElevated}`}
                  data-testid="active-recall-card"
                >
                  <div className={`flex flex-wrap items-center justify-between gap-2 text-xs ${textSecondary}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#FC4C01]">
                        {activeCard.subject} → {activeCard.chapter}
                      </span>
                      {activeCard.pageOrTimestamp && (
                        <span className="font-mono text-[11px]">
                          · {activeCard.pageOrTimestamp}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
                      <span>
                        Card {currentCardIndex + 1}/{revisionSummary.mixedQueue.length}
                      </span>
                      <span>Ease {activeCard.ease.toFixed(2)}</span>
                      <span>Int {activeCard.interval}d</span>
                    </div>
                  </div>

                  {/* Question / Front */}
                  <div className="py-1">
                    <div className={`text-[11px] uppercase tracking-wider mb-1 font-semibold ${textSecondary}`}>
                      {activeCard.type === 'quiz' ? 'Active Recall Quiz' : 'Recall Prompt'}
                    </div>
                    <p className={`text-sm sm:text-base font-semibold leading-relaxed ${textPrimary}`}>
                      {activeCard.front}
                    </p>
                  </div>

                  {/* If Quiz Card with Options */}
                  {activeCard.type === 'quiz' &&
                    Array.isArray(activeCard.options) &&
                    activeCard.options.length > 0 && (
                      <div className="grid grid-cols-1 gap-2">
                        {activeCard.options.map((opt, idx) => {
                          const isSelected = selectedQuizOption === idx;
                          const isCorrect = activeCard.correctIndex === idx;
                          let btnStyle = isDark
                            ? 'bg-white/[0.03] border-white/10 text-neutral-200 hover:border-white/25'
                            : 'bg-[#f8f8fa] border-black/10 text-neutral-800 hover:border-black/25';
                          if (selectedQuizOption !== null) {
                            if (isCorrect) {
                              btnStyle =
                                'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-300 font-semibold';
                            } else if (isSelected) {
                              btnStyle = 'bg-rose-500/15 border-rose-500/50 text-rose-600 dark:text-rose-300';
                            }
                          }
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSelectedQuizOption(idx);
                                setIsCardFlipped(true);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition cursor-pointer ${btnStyle}`}
                            >
                              <span className="font-mono font-bold mr-2">
                                {String.fromCharCode(65 + idx)}.
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                  {/* Show Answer / Back */}
                  {!isCardFlipped ? (
                    <button
                      type="button"
                      data-testid="reveal-recall-answer-btn"
                      onClick={() => setIsCardFlipped(true)}
                      className={`w-full py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition cursor-pointer ${btnGhost}`}
                    >
                      Show Answer &amp; Grade Recall
                    </button>
                  ) : (
                    <div className={`space-y-3.5 pt-3 border-t ${borderSubtle}`}>
                      <div className={`p-3.5 rounded-xl border border-[#FC4C01]/30 bg-[#FC4C01]/[0.06]`}>
                        <div className="text-[11px] uppercase tracking-wider text-[#FC4C01] font-semibold mb-1">
                          Verified Answer
                        </div>
                        <p className={`text-xs sm:text-sm leading-relaxed ${textPrimary}`}>
                          {activeCard.back}
                        </p>
                        {activeCard.explanation && (
                          <p className={`text-xs mt-1.5 ${textSecondary}`}>{activeCard.explanation}</p>
                        )}
                      </div>

                      <div
                        className="flex flex-wrap items-center justify-center gap-2"
                        data-testid="sm2-grade-buttons"
                      >
                        {(['again', 'hard', 'good', 'easy'] as const).map((g) => {
                          const label = g.charAt(0).toUpperCase() + g.slice(1);
                          const isSelected = activeCard.lastGrade === g;
                          return (
                            <button
                              key={g}
                              type="button"
                              data-testid={`grade-${g}-btn`}
                              onClick={() => handleGradeCard(g)}
                              className={`px-4 py-1.5 rounded-full border text-xs font-medium transition cursor-pointer ${
                                isSelected
                                  ? 'bg-[#FC4C01] text-white border-[#FC4C01]'
                                  : btnGhost
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`px-4 py-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${surfaceInner}`}
                >
                  <span className={`text-xs sm:text-sm font-medium ${textPrimary}`}>
                    All caught up on Recall cards for today
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('weak_spots')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer shrink-0 ${btnGhost}`}
                  >
                    Practice Weak Spots →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: EXAM COUNTDOWN & AUTO PLAN (IST DAY-BY-DAY SCHEDULE)       */}
          {/* ================================================================ */}
          {activeTab === 'plan' && (
            <div className="space-y-3.5" data-testid="exam-auto-plan-screen">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={`text-sm font-semibold ${textPrimary}`}>
                  Exam Plan (IST)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddExamModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold hover:bg-[#e04300] transition cursor-pointer"
                >
                  + Add exam ({exams.length}/{tierLimits.maxExams})
                </button>
              </div>

              {exams.map((exam) => {
                const daysLeft = Math.max(
                  0,
                  revisionSummary.nearestExam?.exam.id === exam.id
                    ? revisionSummary.nearestExam.daysRemaining
                    : exam.planDays.length
                );
                return (
                  <div
                    key={exam.id}
                    className={`rounded-xl border p-4 space-y-3.5 ${surfaceInner}`}
                  >
                    <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${borderSubtle}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm sm:text-base font-bold ${textPrimary}`}>{exam.name}</h4>
                          <span className="text-xs font-semibold text-[#FC4C01]">
                            · {daysLeft === 0 ? 'Exam Today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${textSecondary}`}>
                          Exam Date: <span className={`font-mono ${textPrimary}`}>{exam.examDate}</span> (IST) · {exam.chapters.length} Chapters
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          data-testid={`replan-exam-${exam.id}`}
                          onClick={async () => {
                            await StudyLoopStore.replanExamNow(exam.id);
                            setExams(StudyLoopStore.getExams());
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${btnGhost}`}
                        >
                          Missed a day? Re-plan
                        </button>
                        {!exam.id.startsWith('guest_') && (
                          <button
                            type="button"
                            onClick={async () => {
                              await StudyLoopStore.deleteExam(exam.id);
                              setExams(StudyLoopStore.getExams());
                            }}
                            className={`p-1.5 rounded-lg border hover:text-rose-500 transition cursor-pointer ${btnGhost}`}
                            title="Delete exam"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {exam.planDays.map((day) => {
                        const todayIst = toIstDateKey();
                        const isToday = day.dateIst === todayIst;
                        return (
                          <div
                            key={day.dateIst}
                            className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                              day.isFullRevision
                                ? 'bg-[#FC4C01]/[0.07] border-[#FC4C01]/35'
                                : isToday
                                ? isDark
                                  ? 'bg-white/[0.05] border-white/20'
                                  : 'bg-black/[0.03] border-black/20'
                                : surfaceElevated
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={async () => {
                                  await StudyLoopStore.togglePlanDayCompleted(
                                    exam.id,
                                    day.dateIst
                                  );
                                  setExams(StudyLoopStore.getExams());
                                }}
                                className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer ${
                                  day.completed
                                    ? 'bg-[#FC4C01] border-[#FC4C01] text-white'
                                    : isDark
                                    ? 'border-white/25 text-transparent hover:border-[#FC4C01]'
                                    : 'border-black/25 text-transparent hover:border-[#FC4C01]'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-bold ${textPrimary}`}>
                                    Day {day.dayNumber} · {day.dateIst}
                                  </span>
                                  {isToday && (
                                    <span className="text-[10px] font-bold uppercase text-[#FC4C01]">
                                      · Today (IST)
                                    </span>
                                  )}
                                  {day.isFullRevision && (
                                    <span className="text-[10px] font-bold uppercase text-[#FC4C01]">
                                      · Last 2 Days: Full Revision
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={`text-xs mt-0.5 ${
                                    day.completed ? `line-through ${textSecondary}` : textSecondary
                                  }`}
                                >
                                  {day.chapters.join(' · ')}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: WEAK SPOTS (% CORRECT PER CHAPTER + 5-QUESTION DRILL)      */}
          {/* ================================================================ */}
          {activeTab === 'weak_spots' && (
            <div className="space-y-3.5" data-testid="weak-spots-screen">
              <h3 className={`text-sm font-semibold ${textPrimary}`}>
                Weak Spots by Chapter
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {weakSpots.map((ws) => (
                  <div
                    key={ws.chapter}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${surfaceInner}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] uppercase tracking-wider font-semibold ${textSecondary}`}>
                          {ws.subject}
                        </span>
                        <span
                          className={`text-xs font-bold font-mono tabular-nums ${
                            ws.percentCorrect < 60
                              ? 'text-rose-500'
                              : ws.percentCorrect < 80
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }`}
                        >
                          {ws.percentCorrect}% correct
                        </span>
                      </div>
                      <h4 className={`text-sm font-bold mt-0.5 ${textPrimary}`}>{ws.chapter}</h4>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden mt-2 ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                        <div
                          className="h-full bg-[#FC4C01] transition-all"
                          style={{ width: `${Math.max(8, ws.percentCorrect)}%` }}
                        />
                      </div>
                      <div className={`flex items-center justify-between text-[11px] mt-1.5 ${textSecondary}`}>
                        <span>
                          {ws.correctCount} right / {ws.wrongCount} wrong
                        </span>
                        <span>{ws.cardsCount} cards in Recall</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid="practice-weak-topic-btn"
                      onClick={() => handlePracticeWeakTopic(ws.chapter, ws.subject)}
                      disabled={drillLoading && drillingChapter === ws.chapter}
                      className="w-full py-2 px-3 rounded-lg bg-[#FC4C01]/12 hover:bg-[#FC4C01] text-[#FC4C01] hover:text-white border border-[#FC4C01]/30 text-xs font-semibold transition cursor-pointer"
                    >
                      {drillLoading && drillingChapter === ws.chapter
                        ? 'Generating 5 questions...'
                        : 'Practice weak topics (5 questions)'}
                    </button>
                  </div>
                ))}
              </div>

              {drillingChapter && (
                <div
                  className={`rounded-xl border p-4 space-y-3.5 ${surfaceInner}`}
                  data-testid="weak-spot-drill-container"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-[#FC4C01] font-bold">
                        Targeted 5-Question Drill
                      </span>
                      <h4 className={`text-sm sm:text-base font-bold ${textPrimary}`}>{drillingChapter}</h4>
                    </div>
                    {drillError && (
                      <button
                        type="button"
                        onClick={() => handlePracticeWeakTopic(drillingChapter, 'General Studies')}
                        className="px-3 py-1.5 rounded-lg bg-[#FC4C01] text-white text-xs font-semibold cursor-pointer"
                      >
                        Retry
                      </button>
                    )}
                  </div>

                  {drillLoading && (
                    <div className={`py-6 text-center text-xs ${textSecondary}`}>
                      Generating 5 targeted exam questions for {drillingChapter}...
                    </div>
                  )}

                  {drillError && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-200 flex items-center justify-between">
                      <span>{drillError}</span>
                      <button
                        type="button"
                        onClick={() => handlePracticeWeakTopic(drillingChapter, 'General Studies')}
                        className="px-3 py-1 rounded-lg bg-[#FC4C01] text-white font-semibold"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {drillQuestions.length > 0 && (
                    <div className="space-y-2.5">
                      {drillQuestions.map((q, qIdx) => {
                        const chosen = drillAnswers[q.id];
                        return (
                          <div
                            key={q.id}
                            className={`p-3.5 rounded-xl border space-y-2 ${surfaceElevated}`}
                          >
                            <div className={`text-xs sm:text-sm font-semibold ${textPrimary}`}>
                              {qIdx + 1}. {q.question}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, oIdx) => {
                                const isPicked = chosen === oIdx;
                                const isRight = q.correctIndex === oIdx;
                                let cls = isDark
                                  ? 'bg-white/[0.03] border-white/10 text-neutral-200 hover:border-white/25'
                                  : 'bg-[#f8f8fa] border-black/10 text-neutral-800 hover:border-black/25';
                                if (chosen !== undefined) {
                                  if (isRight) {
                                    cls =
                                      'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-200 font-semibold';
                                  } else if (isPicked) {
                                    cls = 'bg-rose-500/15 border-rose-500/50 text-rose-600 dark:text-rose-200';
                                  }
                                }
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() => {
                                      setDrillAnswers((prev) => ({ ...prev, [q.id]: oIdx }));
                                    }}
                                    className={`text-left px-3 py-2 rounded-lg border text-xs transition cursor-pointer ${cls}`}
                                  >
                                    <span className="font-mono font-bold mr-1.5">
                                      {String.fromCharCode(65 + oIdx)}.
                                    </span>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {chosen !== undefined && (
                              <div className={`text-xs p-2.5 rounded-lg border ${surfaceInner}`}>
                                <strong className="text-[#FC4C01]">Explanation:</strong>{' '}
                                <span className={textPrimary}>{q.explanation}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 4: UPLOAD ANYTHING → STUDY (PDF, IMAGE OCR, TEXT)            */}
          {/* ================================================================ */}
          {activeTab === 'upload' && (
            <div className="space-y-3.5" data-testid="upload-anything-screen">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={`text-sm font-semibold ${textPrimary}`}>
                  Upload Pack
                </h3>

                <div className="flex items-center gap-1.5">
                  {(['pdf', 'image', 'text'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setUploadMode(m)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        uploadMode === m
                          ? 'bg-[#FC4C01] text-white'
                          : btnGhost
                      }`}
                    >
                      {m === 'pdf' ? 'PDF' : m === 'image' ? 'Image OCR' : 'Paste Text'}
                    </button>
                  ))}
                </div>
              </div>

              {uploadMode === 'pdf' && (
                <div className={`p-5 rounded-xl border border-dashed border-[#FC4C01]/40 text-center space-y-2.5 ${surfaceInner}`}>
                  <div className={`text-xs sm:text-sm font-semibold ${textPrimary}`}>
                    Select a PDF (up to {tierLimits.pdfMaxPages} pages)
                  </div>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePdfUpload(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={uploadLoading}
                    className="px-4 py-2 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold hover:bg-[#e04300] transition cursor-pointer"
                  >
                    {uploadLoading ? 'Analyzing PDF Pages...' : 'Choose PDF File'}
                  </button>
                </div>
              )}

              {uploadMode === 'image' && (
                <div className={`p-5 rounded-xl border border-dashed border-[#FC4C01]/40 text-center space-y-2.5 ${surfaceInner}`}>
                  <div className={`text-xs sm:text-sm font-semibold ${textPrimary}`}>
                    Upload Photo of Notes or Textbook Page
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageStudyUpload(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadLoading}
                    className="px-4 py-2 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold hover:bg-[#e04300] transition cursor-pointer"
                  >
                    {uploadLoading ? 'Running Vision OCR...' : 'Upload Notes Photo'}
                  </button>
                </div>
              )}

              {uploadMode === 'text' && (
                <form
                  onSubmit={handlePastedTextUpload}
                  className={`p-4 rounded-xl border space-y-2.5 ${surfaceInner}`}
                >
                  <input
                    type="text"
                    placeholder="Topic / Chapter Title (e.g. Second Law of Thermodynamics)"
                    value={pastedStudyTitle}
                    onChange={(e) => setPastedStudyTitle(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${inputClass}`}
                  />
                  <textarea
                    rows={4}
                    placeholder="Paste your lecture notes, textbook excerpt, or syllabus points here..."
                    value={pastedStudyText}
                    onChange={(e) => setPastedStudyText(e.target.value)}
                    className={`w-full rounded-lg border p-3 text-xs outline-none ${inputClass}`}
                    required
                  />
                  <button
                    type="submit"
                    disabled={uploadLoading}
                    className="px-4 py-2 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold hover:bg-[#e04300] transition cursor-pointer"
                  >
                    {uploadLoading
                      ? 'Generating Summary, Quiz & Flashcards...'
                      : 'Generate Study Pack'}
                  </button>
                </form>
              )}

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-200 flex items-center justify-between gap-2">
                  <span>{uploadError}</span>
                  <button
                    type="button"
                    onClick={handleRetryUpload}
                    className="px-3 py-1 rounded-lg bg-[#FC4C01] text-white font-semibold shrink-0 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {activeStudyPack && (
                <div
                  className={`rounded-xl border p-4 space-y-3.5 ${surfaceInner}`}
                  data-testid="uploaded-study-pack-output"
                >
                  <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${borderSubtle}`}>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-sm sm:text-base font-bold ${textPrimary}`}>{activeStudyPack.title}</h4>
                        <span className="text-xs font-semibold text-[#FC4C01]">
                          · {activeStudyPack.subject} → {activeStudyPack.chapter}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${textSecondary}`}>
                        {activeStudyPack.pageCount} page{activeStudyPack.pageCount === 1 ? '' : 's'} analyzed
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        data-testid="listen-audio-recap-btn"
                        onClick={() =>
                          handleListenAudioRecap(
                            activeStudyPack.id,
                            activeStudyPack.title,
                            activeStudyPack.summaryBullets
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${btnGhost}`}
                      >
                        {audioState === 'playing'
                          ? 'Stop Audio'
                          : audioState === 'loading'
                          ? 'Preparing Audio...'
                          : planTier === 'free'
                          ? 'Listen (30s Preview)'
                          : 'Listen (Audio Recap)'}
                      </button>

                      <button
                        type="button"
                        data-testid="add-pack-to-recall-btn"
                        onClick={() => handleAddPackToRecall(activeStudyPack)}
                        className="px-3 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition cursor-pointer"
                      >
                        + Add to Recall
                      </button>
                    </div>
                  </div>

                  {(audioScriptPreview || audioInfoMsg) && (
                    <div className={`p-3 rounded-xl border border-[#FC4C01]/30 space-y-1.5 text-xs ${surfaceElevated}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#FC4C01]">
                          Audio Recap ({language}){' '}
                          {audioIsPreviewTier ? '· Free Tier 30s Preview' : '· Full Playback'}
                        </span>
                        {audioIsPreviewTier && onOpenPricing && (
                          <button
                            type="button"
                            onClick={onOpenPricing}
                            className="text-[11px] font-semibold text-[#FC4C01] underline cursor-pointer"
                          >
                            Unlock Full Recap on Spark
                          </button>
                        )}
                      </div>
                      {audioScriptPreview && (
                        <p className={`leading-relaxed line-clamp-3 ${textPrimary}`}>
                          {audioScriptPreview}
                        </p>
                      )}
                      {audioInfoMsg && <p className="text-[#FC4C01]">{audioInfoMsg}</p>}
                    </div>
                  )}

                  {/* Explain in Telugu / Hindi Bar */}
                  <div className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border text-xs ${surfaceElevated}`}>
                    <span className={textSecondary}>Explain in Language:</span>
                    <div className="flex items-center gap-1.5">
                      {(['English', 'Telugu', 'Hindi'] as StudyLanguage[]).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => handleExplainPackSummary(lang)}
                          disabled={packTranslating}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                            language === lang
                              ? 'bg-[#FC4C01] text-white'
                              : btnGhost
                          }`}
                        >
                          {lang === 'English'
                            ? 'English'
                            : lang === 'Telugu'
                            ? 'తెలుగు'
                            : 'हिन्दी'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {packTranslateError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-200 flex items-center justify-between">
                      <span>{packTranslateError}</span>
                      <button
                        type="button"
                        onClick={() => handleExplainPackSummary(language)}
                        className="px-2.5 py-1 rounded bg-[#FC4C01] text-white font-semibold"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  <div className={`flex items-center gap-2 border-b pb-2 ${borderSubtle}`}>
                    {[
                      { id: 'summary', label: 'Summary (Page Cited)' },
                      {
                        id: 'flashcards',
                        label: `Flashcards (${activeStudyPack.flashcards.length})`,
                      },
                      { id: 'quiz', label: `Quiz (${activeStudyPack.quiz.length})` },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setPackSubTab(st.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          packSubTab === st.id
                            ? 'bg-[#FC4C01] text-white'
                            : btnGhost
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {packSubTab === 'summary' && (
                    <div className="space-y-2.5">
                      {packTranslatedSummary && (
                        <div className={`p-3.5 rounded-xl border border-[#FC4C01]/30 text-xs whitespace-pre-wrap leading-relaxed ${surfaceElevated}`}>
                          {packTranslatedSummary}
                        </div>
                      )}
                      {activeStudyPack.summaryBullets.map((b, i) => (
                        <div
                          key={i}
                          className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${surfaceElevated}`}
                        >
                          <p className={`text-xs sm:text-sm leading-relaxed ${textPrimary}`}>
                            {b.text}
                          </p>
                          <span className="text-[11px] font-mono font-semibold text-[#FC4C01] shrink-0">
                            p.{b.page}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {packSubTab === 'flashcards' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeStudyPack.flashcards.map((fc) => {
                        const flipped = Boolean(packFlippedCards[fc.id]);
                        const activeGrade = StudyLoopStore.getCardGrade(fc.id) || StudyLoopStore.getCardGrade(fc.front);
                        return (
                          <div
                            key={fc.id}
                            onClick={() =>
                              setPackFlippedCards((prev) => ({ ...prev, [fc.id]: !flipped }))
                            }
                            className={`p-3.5 rounded-xl border hover:border-[#FC4C01]/50 transition cursor-pointer space-y-2.5 ${surfaceElevated}`}
                          >
                            <div className={`flex items-center justify-between text-[11px] ${textSecondary}`}>
                              <span>{flipped ? 'Answer' : 'Question'}</span>
                              <span className="font-mono text-[#FC4C01]">{fc.pageLabel}</span>
                            </div>
                            <p className={`text-xs sm:text-sm font-medium ${textPrimary}`}>
                              {flipped ? fc.back : fc.front}
                            </p>
                            <div
                              className="flex items-center gap-1.5 pt-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(['again', 'hard', 'good', 'easy'] as const).map((g) => {
                                const isSelected = activeGrade === g;
                                const label = g.charAt(0).toUpperCase() + g.slice(1);
                                return (
                                  <button
                                    key={g}
                                    type="button"
                                    onClick={async () => {
                                      await StudyLoopStore.rateOrUpsertCard(
                                        {
                                          id: fc.id,
                                          type: 'flashcard',
                                          front: fc.front,
                                          back: fc.back,
                                          subject: activeStudyPack.subject,
                                          chapter: fc.chapter || activeStudyPack.chapter,
                                          sourceId: activeStudyPack.id,
                                          pageOrTimestamp: fc.pageLabel || `Page ${fc.page}`,
                                        },
                                        g
                                      );
                                      setCards(StudyLoopStore.getCards());
                                    }}
                                    className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-[#FC4C01] text-white border-[#FC4C01]'
                                        : btnGhost
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {packSubTab === 'quiz' && (
                    <div className="space-y-2.5">
                      {activeStudyPack.quiz.map((q, idx) => {
                        const picked = packQuizAnswers[q.id];
                        const activeGrade = StudyLoopStore.getCardGrade(q.id) || StudyLoopStore.getCardGrade(q.question);
                        return (
                          <div
                            key={q.id}
                            className={`p-3.5 rounded-xl border space-y-2.5 ${surfaceElevated}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-xs sm:text-sm font-semibold ${textPrimary}`}>
                                {idx + 1}. {q.question}
                              </span>
                              <span className="text-[11px] font-mono text-[#FC4C01] shrink-0">
                                {q.pageLabel}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, oIdx) => {
                                const isChosen = picked === oIdx;
                                const isRight = q.correctIndex === oIdx;
                                let cls = isDark
                                  ? 'bg-white/[0.03] border-white/10 text-neutral-200'
                                  : 'bg-[#f8f8fa] border-black/10 text-neutral-800';
                                if (picked !== undefined) {
                                  if (isRight)
                                    cls =
                                      'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-200 font-semibold';
                                  else if (isChosen)
                                    cls = 'bg-rose-500/15 border-rose-500/50 text-rose-600 dark:text-rose-200';
                                }
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() =>
                                      setPackQuizAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                                    }
                                    className={`text-left px-3 py-2 rounded-lg border text-xs transition cursor-pointer ${cls}`}
                                  >
                                    <span className="font-mono font-bold mr-1.5">
                                      {String.fromCharCode(65 + oIdx)}.
                                    </span>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {picked !== undefined && (
                              <p className={`text-xs p-2.5 rounded-lg border ${surfaceInner}`}>
                                <strong className="text-[#FC4C01]">Explanation:</strong>{' '}
                                <span className={textPrimary}>{q.explanation}</span>
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 pt-1">
                              {(['again', 'hard', 'good', 'easy'] as const).map((g) => {
                                const isSelected = activeGrade === g;
                                const label = g.charAt(0).toUpperCase() + g.slice(1);
                                return (
                                  <button
                                    key={g}
                                    type="button"
                                    onClick={async () => {
                                      await StudyLoopStore.rateOrUpsertCard(
                                        {
                                          id: q.id,
                                          type: 'quiz',
                                          front: q.question,
                                          back: q.options[q.correctIndex] || q.explanation,
                                          options: q.options,
                                          correctIndex: q.correctIndex,
                                          explanation: q.explanation,
                                          subject: activeStudyPack.subject,
                                          chapter: q.chapter || activeStudyPack.chapter,
                                          sourceId: activeStudyPack.id,
                                          pageOrTimestamp: q.pageLabel || `Page ${q.page}`,
                                        },
                                        g
                                      );
                                      setCards(StudyLoopStore.getCards());
                                    }}
                                    className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-[#FC4C01] text-white border-[#FC4C01]'
                                        : btnGhost
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 5: SNAP & SOLVE (PHOTO/TEXT OF 1 QUESTION)                   */}
          {/* ================================================================ */}
          {activeTab === 'snap_solve' && (
            <div className="space-y-3.5" data-testid="snap-and-solve-screen">
              <h3 className={`text-sm font-semibold ${textPrimary}`}>
                Snap &amp; Solve
              </h3>

              <div className={`rounded-xl border p-3.5 space-y-3 ${surfaceInner}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={snapInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSnapImageUpload(f);
                    }}
                  />
                  <button
                    type="button"
                    data-testid="snap-photo-upload-btn"
                    onClick={() => snapInputRef.current?.click()}
                    disabled={snapLoading}
                    className="px-3.5 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Snap / Upload Question Photo
                  </button>
                  <span className={`text-xs ${textSecondary}`}>or type/paste question below:</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    data-testid="snap-question-input"
                    placeholder="e.g. A Carnot engine operates between 600K and 300K. Find its thermal efficiency..."
                    value={snapQuestionText}
                    onChange={(e) => setSnapQuestionText(e.target.value)}
                    className={`flex-1 rounded-xl border px-3.5 py-2 text-xs sm:text-sm outline-none ${inputClass}`}
                  />
                  <button
                    type="button"
                    data-testid="snap-solve-submit-btn"
                    onClick={() => triggerSnapSolve(snapImageDataUrl, snapQuestionText, language)}
                    disabled={snapLoading}
                    className={`px-4 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer shrink-0 ${btnGhost}`}
                  >
                    {snapLoading ? 'Solving...' : 'Solve Question'}
                  </button>
                </div>
              </div>

              {snapError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-200 flex items-center justify-between gap-2">
                  <span>{snapError}</span>
                  <button
                    type="button"
                    onClick={() => triggerSnapSolve(snapImageDataUrl, snapQuestionText, language)}
                    className="px-3 py-1 rounded-lg bg-[#FC4C01] text-white font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {snapResult && (
                <div
                  className={`rounded-xl border p-4 space-y-3.5 ${surfaceInner}`}
                  data-testid="snap-solve-result"
                >
                  <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${borderSubtle}`}>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-[#FC4C01] font-bold">
                        Step-by-Step Worked Solution
                      </span>
                      <h4 className={`text-sm sm:text-base font-bold mt-0.5 ${textPrimary}`}>
                        {snapResult.questionExtracted}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {snapResult.checkWithTextbook && (
                        <span
                          data-testid="check-with-textbook-badge"
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-600 dark:text-amber-300 text-xs font-semibold"
                        >
                          Check with your textbook
                        </span>
                      )}
                    </div>
                  </div>

                  {snapTranslateError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-200 flex items-center justify-between">
                      <span>{snapTranslateError}</span>
                      <button
                        type="button"
                        onClick={() => handleExplainSnapSolve(language)}
                        className="px-2.5 py-1 rounded bg-[#FC4C01] text-white font-semibold"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {snapTranslatedText && (
                    <div className={`p-3.5 rounded-xl border border-[#FC4C01]/30 text-xs whitespace-pre-wrap leading-relaxed ${surfaceElevated}`}>
                      {snapTranslatedText}
                    </div>
                  )}

                  <div className="space-y-2">
                    {snapResult.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs sm:text-sm leading-relaxed ${surfaceElevated} ${textPrimary}`}
                      >
                        {step}
                      </div>
                    ))}
                    <div className="p-3 rounded-xl bg-[#FC4C01]/12 border border-[#FC4C01]/35 text-xs sm:text-sm font-bold text-[#FC4C01]">
                      Final Answer: {snapResult.finalAnswer}
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-xl border space-y-1 ${surfaceElevated}`}>
                    <div className="text-[11px] uppercase tracking-wider text-[#FC4C01] font-bold">
                      Concept Behind It · {snapResult.conceptBehindIt.subject} → {snapResult.conceptBehindIt.chapter}
                    </div>
                    <div className={`text-sm font-bold ${textPrimary}`}>
                      {snapResult.conceptBehindIt.title}
                    </div>
                    <p className={`text-xs leading-relaxed ${textSecondary}`}>
                      {snapResult.conceptBehindIt.explanation}
                    </p>
                  </div>

                  <div className={`p-3.5 rounded-xl border border-[#FC4C01]/30 space-y-2.5 ${surfaceElevated}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#FC4C01]">
                        1 Similar Practice Question
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          StudyLoopStore.addCardsToRecall([
                            {
                              type: 'quiz',
                              front: snapResult.similarPracticeQuestion.question,
                              back:
                                snapResult.similarPracticeQuestion.options[
                                  snapResult.similarPracticeQuestion.correctIndex
                                ] || snapResult.similarPracticeQuestion.explanation,
                              options: snapResult.similarPracticeQuestion.options,
                              correctIndex: snapResult.similarPracticeQuestion.correctIndex,
                              explanation: snapResult.similarPracticeQuestion.explanation,
                              subject: snapResult.conceptBehindIt.subject,
                              chapter: snapResult.conceptBehindIt.chapter,
                            },
                          ])
                        }
                        className="text-xs font-semibold text-[#FC4C01] hover:underline cursor-pointer"
                      >
                        + Add to Recall
                      </button>
                    </div>
                    <p className={`text-xs sm:text-sm font-semibold ${textPrimary}`}>
                      {snapResult.similarPracticeQuestion.question}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {snapResult.similarPracticeQuestion.options.map((opt, idx) => {
                        const isPicked = snapPracticeAnswer === idx;
                        const isRight =
                          snapResult.similarPracticeQuestion.correctIndex === idx;
                        let cls = isDark
                          ? 'bg-white/[0.03] border-white/10 text-neutral-200'
                          : 'bg-[#f8f8fa] border-black/10 text-neutral-800';
                        if (snapPracticeAnswer !== null) {
                          if (isRight)
                            cls =
                              'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-200 font-semibold';
                          else if (isPicked)
                            cls = 'bg-rose-500/15 border-rose-500/50 text-rose-600 dark:text-rose-200';
                        }
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSnapPracticeAnswer(idx)}
                            className={`text-left px-3 py-2 rounded-lg border text-xs transition cursor-pointer ${cls}`}
                          >
                            <span className="font-mono font-bold mr-1.5">
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {snapPracticeAnswer !== null && (
                      <div className={`text-xs p-2.5 rounded-lg border ${surfaceInner}`}>
                        <strong className="text-[#FC4C01]">Explanation:</strong>{' '}
                        <span className={textPrimary}>
                          {snapResult.similarPracticeQuestion.explanation}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ADD EXAM MODAL                                                       */}
      {/* ==================================================================== */}
      {showAddExamModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateExam}
            className={`w-full max-w-lg rounded-2xl border p-5 space-y-4 shadow-2xl ${surfaceOuter}`}
            data-testid="add-exam-modal"
          >
            <div className="flex items-center justify-between">
              <h3 className={`text-base font-bold ${textPrimary}`}>
                Add Exam &amp; Generate Auto Plan (IST)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddExamModal(false)}
                className={textSecondary}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {examFormError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-200">
                {examFormError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs mb-1 ${textSecondary}`}>Exam Name</label>
                <input
                  type="text"
                  data-testid="exam-name-input"
                  placeholder="e.g. Physics Exam"
                  value={examNameInput}
                  onChange={(e) => setExamNameInput(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-xs outline-none ${inputClass}`}
                  required
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${textSecondary}`}>Exam Date (IST)</label>
                <input
                  type="date"
                  data-testid="exam-date-input"
                  min={toIstDateKey()}
                  value={examDateInput}
                  onChange={(e) => setExamDateInput(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-xs outline-none ${inputClass}`}
                  required
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs mb-1 ${textSecondary}`}>Subject</label>
              <input
                type="text"
                placeholder="e.g. Physics, Biology, Mathematics"
                value={examSubjectInput}
                onChange={(e) => setExamSubjectInput(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs outline-none ${inputClass}`}
              />
            </div>

            <div>
              <label className={`block text-xs mb-1 ${textSecondary}`}>
                Pick Chapters from Vault or Type Custom ({selectedChapters.length} selected)
              </label>
              <div className={`flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-xl border ${surfaceInner}`}>
                {vaultChapters.map((ch) => {
                  const active = selectedChapters.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() =>
                        setSelectedChapters((prev) =>
                          active ? prev.filter((item) => item !== ch) : [...prev, ch]
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'bg-[#FC4C01] text-white'
                          : btnGhost
                      }`}
                    >
                      {ch}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Type a custom chapter and press Add..."
                  value={customChapterInput}
                  onChange={(e) => setCustomChapterInput(e.target.value)}
                  className={`flex-1 rounded-xl border px-3 py-1.5 text-xs outline-none ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = customChapterInput.trim();
                    if (clean && !selectedChapters.includes(clean)) {
                      setSelectedChapters((prev) => [...prev, clean]);
                      setCustomChapterInput('');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${btnGhost}`}
                >
                  + Add Chapter
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddExamModal(false)}
                className={`px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${btnGhost}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="save-exam-submit-btn"
                className="px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-xs font-semibold text-white cursor-pointer"
              >
                Save Exam &amp; Build Plan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
