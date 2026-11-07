import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Flame,
  Brain,
  Target,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Bell,
  Clock,
  BookOpen,
  Sparkles,
  ChevronRight,
  Trash2,
  Upload,
  Camera,
  FileText,
  Volume2,
  Pause,
  Square,
  Globe,
  X,
  Lock,
  HelpCircle,
  Layers,
  Award,
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
  onOpenPricing?: () => void;
}

export const StudyLoopPanel: React.FC<StudyLoopPanelProps> = ({
  isOpen = true,
  onClose,
  initialTab = 'revision',
  embedded = false,
  onOpenPricing,
}) => {
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

  // Available chapters from user's Vault items & threads
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

  // Phase B: Image OCR Upload Handler (notes or textbook page)
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

  const handleAddPackToRecall = async ( studyPack: UploadedStudyPack ) => {
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
    ? 'w-full text-[#F5F2EB]'
    : 'fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto';

  const panelClass = embedded
    ? 'w-full bg-[#111113] border border-white/10 rounded-2xl overflow-hidden shadow-2xl'
    : 'w-full max-w-5xl bg-[#111113] border border-[#FC4C01]/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(252,76,1,0.12)] max-h-[92vh] flex flex-col';

  return (
    <div className={containerClass} data-testid="study-loop-panel">
      <div className={panelClass}>
        {/* Top Header with Exam Countdown Banner + Streak + IST Reminder + Language Selector */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-[#161514] border-b border-white/10 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 flex items-center justify-center text-[#FC4C01] shadow-[0_0_18px_rgba(252,76,1,0.2)]">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    Kinich Study Loop
                  </h2>
                  <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-md bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30">
                    {planTier.toUpperCase()} TIER
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Material in → Daily SM-2 Recall → Exam Ready (All schedules in IST)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Nearest Exam Countdown Pill */}
              {revisionSummary.nearestExam && (
                <div
                  data-testid="exam-countdown-banner"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 text-[#FC4C01] text-xs font-semibold shadow-[0_0_14px_rgba(252,76,1,0.18)]"
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{revisionSummary.nearestExam.countdownLabel}</span>
                </div>
              )}

              <button
                type="button"
                data-testid="add-exam-btn"
                onClick={() => {
                  setExamFormError(null);
                  setShowAddExamModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add exam</span>
              </button>

              {/* Language Switcher (English / తెలుగు / हिन्दी) */}
              <div
                className="flex items-center rounded-xl bg-black/50 border border-white/10 p-0.5 text-xs"
                data-testid="study-language-toggle"
              >
                {(['English', 'Telugu', 'Hindi'] as StudyLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setLanguage(lang);
                      UserAccountStore.setPreferredStudyLanguage(lang);
                    }}
                    className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                      language === lang
                        ? 'bg-[#FC4C01] text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {lang === 'English' ? 'EN' : lang === 'Telugu' ? 'తెలుగు' : 'हिन्दी'}
                  </button>
                ))}
              </div>

              {onClose && !embedded && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                  aria-label="Close Study Loop"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Streak Counter & Daily 7:00 PM IST Reminder Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="flex items-center gap-1.5 text-[#FC4C01] font-semibold"
                data-testid="study-streak-counter"
              >
                <Flame className="w-4 h-4 fill-[#FC4C01]" />
                <span>{streak.currentStreak}-Day Study Streak</span>
              </div>
              <span className="text-zinc-500">•</span>
              <span
                className="text-zinc-300 font-medium"
                data-testid="daily-revision-summary-badge"
              >
                Today: {revisionSummary.totalCardsToday} cards, ~{revisionSummary.estimatedMinutes}{' '}
                min
              </span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400">
                Daily Recall Cap: {dailyReviewStats.reviewedToday}/{tierLimits.dailyRecallReviews}{' '}
                reviewed
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-[#FC4C01]" />
              <span className="text-zinc-400">Daily IST Reminder:</span>
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
                className="bg-black/60 border border-white/15 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#FC4C01]"
              />
              <span className="text-[11px] text-zinc-400">IST</span>
              <button
                type="button"
                onClick={handleToggleWebPush}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                  streak.browserNotificationsEnabled
                    ? 'bg-[#FC4C01]/15 border-[#FC4C01]/40 text-[#FC4C01]'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                {streak.browserNotificationsEnabled ? 'Push On' : 'Enable Push'}
              </button>
            </div>
          </div>

          {/* Mobile-First Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: 'revision', label: 'Daily Revision (SM-2)', icon: Brain },
              { id: 'plan', label: 'Exam Auto Plan', icon: Calendar },
              { id: 'weak_spots', label: 'Weak Spots', icon: Target },
              { id: 'upload', label: 'Upload Anything → Study', icon: Upload },
              { id: 'snap_solve', label: 'Snap & Solve', icon: Camera },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`study-loop-tab-${t.id}`}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-[#FC4C01] text-white shadow-[0_0_16px_rgba(252,76,1,0.28)]'
                      : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {isGuest && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#FC4C01]/10 border border-[#FC4C01]/30 text-xs text-zinc-200">
              <span>
                You’re trying Kinich Study Loop in Guest mode. Try grading cards, generating weak-topic drills, or Snap & Solve — sign in to save your exams and Recall deck in your Vault.
              </span>
              <button
                type="button"
                onClick={() => promptGuestSignInForVault('Sign in to keep this in your Vault')}
                className="px-3 py-1 rounded-lg bg-[#FC4C01] text-white font-semibold hover:bg-[#e04300] transition cursor-pointer shrink-0"
              >
                Sign in to save
              </button>
            </div>
          )}

          {recallAddedToast && (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between">
              <span>{recallAddedToast}</span>
              <button
                type="button"
                onClick={() => setRecallAddedToast(null)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 1: DAILY REVISION (SM-2 RECALL ENGINE)                       */}
          {/* ================================================================ */}
          {activeTab === 'revision' && (
            <div className="space-y-4" data-testid="daily-revision-screen">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#171615] border border-white/10 rounded-2xl p-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#FC4C01] font-semibold">
                    Daily Revision Queue (IST)
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                    Today: {revisionSummary.totalCardsToday} cards, ~
                    {revisionSummary.estimatedMinutes} min
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Mixes {revisionSummary.dueCards.length} due cards,{' '}
                    {revisionSummary.weakCards.length} weak-topic cards, and{' '}
                    {revisionSummary.nearestExamCards.length} cards for{' '}
                    {revisionSummary.nearestExam?.exam.name || 'your upcoming exam'}.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isGuest) {
                        promptGuestSignInForVault('Sign in to keep this in your Vault');
                        return;
                      }
                      setShowAddCardForm((v) => !v);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FC4C01]" />
                    <span>New Recall Card</span>
                  </button>
                </div>
              </div>

              {showAddCardForm && (
                <form
                  onSubmit={handleQuickAddCard}
                  className="bg-[#181716] border border-[#FC4C01]/30 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#FC4C01]">
                      Create Flashcard in Recall (SM-2)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddCardForm(false)}
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Question / Front of card"
                      value={newCardFront}
                      onChange={(e) => setNewCardFront(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Answer / Back of card"
                      value={newCardBack}
                      onChange={(e) => setNewCardBack(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Chapter (e.g. Thermodynamics)"
                      value={newCardChapter}
                      onChange={(e) => setNewCardChapter(e.target.value)}
                      className="bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white flex-1"
                    />
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold hover:bg-[#e04300] transition cursor-pointer"
                    >
                      Save to Recall
                    </button>
                  </div>
                </form>
              )}

              {revisionBannerMsg && (
                <div className="p-3.5 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 text-xs text-white flex items-center justify-between gap-2">
                  <span>{revisionBannerMsg}</span>
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
                  className="bg-[#161514] border border-white/15 rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg"
                  data-testid="active-recall-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#FC4C01]/15 text-[#FC4C01] font-semibold">
                        {activeCard.subject} → {activeCard.chapter}
                      </span>
                      {activeCard.pageOrTimestamp && (
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300 font-mono">
                          {activeCard.pageOrTimestamp}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span>
                        Card {currentCardIndex + 1} of {revisionSummary.mixedQueue.length}
                      </span>
                      <span>Ease: {activeCard.ease.toFixed(2)}</span>
                      <span>Interval: {activeCard.interval}d</span>
                    </div>
                  </div>

                  {/* Question / Front */}
                  <div className="py-3">
                    <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5 font-semibold">
                      {activeCard.type === 'quiz' ? 'Active Recall Quiz Question' : 'Recall Prompt'}
                    </div>
                    <p className="text-base sm:text-lg font-semibold text-white leading-relaxed">
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
                          let btnStyle =
                            'bg-black/40 border-white/10 text-zinc-200 hover:border-white/25';
                          if (selectedQuizOption !== null) {
                            if (isCorrect) {
                              btnStyle =
                                'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';
                            } else if (isSelected) {
                              btnStyle = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
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
                      className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-sm font-semibold text-white transition cursor-pointer"
                    >
                      Show Answer & Grade Recall
                    </button>
                  ) : (
                    <div className="space-y-4 pt-3 border-t border-white/10">
                      <div className="p-3.5 rounded-xl bg-black/50 border border-[#FC4C01]/30">
                        <div className="text-[11px] uppercase tracking-wider text-[#FC4C01] font-semibold mb-1">
                          Verified Answer
                        </div>
                        <p className="text-sm text-zinc-100 leading-relaxed">{activeCard.back}</p>
                        {activeCard.explanation && (
                          <p className="text-xs text-zinc-400 mt-2">{activeCard.explanation}</p>
                        )}
                      </div>

                      {/* SM-2 Grade Buttons: Again / Hard / Good / Easy */}
                      <div>
                        <div className="text-[11px] text-zinc-400 mb-2 font-medium">
                          How well did you recall this? (SM-2 Spaced Repetition)
                        </div>
                        <div
                          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                          data-testid="sm2-grade-buttons"
                        >
                          <button
                            type="button"
                            data-testid="grade-again-btn"
                            onClick={() => handleGradeCard('again')}
                            className="py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 text-xs font-bold transition cursor-pointer flex flex-col items-center"
                          >
                            <span>Again</span>
                            <span className="text-[10px] font-normal text-rose-300/80">
                              &lt; 10m (Reset)
                            </span>
                          </button>
                          <button
                            type="button"
                            data-testid="grade-hard-btn"
                            onClick={() => handleGradeCard('hard')}
                            className="py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-xs font-bold transition cursor-pointer flex flex-col items-center"
                          >
                            <span>Hard</span>
                            <span className="text-[10px] font-normal text-amber-300/80">
                              {Math.max(1, Math.round((activeCard.interval || 1) * 1.2))}d
                            </span>
                          </button>
                          <button
                            type="button"
                            data-testid="grade-good-btn"
                            onClick={() => handleGradeCard('good')}
                            className="py-2.5 px-3 rounded-xl bg-[#FC4C01]/20 hover:bg-[#FC4C01]/30 border border-[#FC4C01]/50 text-white text-xs font-bold transition cursor-pointer flex flex-col items-center"
                          >
                            <span>Good</span>
                            <span className="text-[10px] font-normal text-zinc-300">
                              {activeCard.repetitions === 0
                                ? '1d'
                                : activeCard.repetitions === 1
                                ? '3d'
                                : `${Math.max(4, Math.round(activeCard.interval * activeCard.ease))}d`}
                            </span>
                          </button>
                          <button
                            type="button"
                            data-testid="grade-easy-btn"
                            onClick={() => handleGradeCard('easy')}
                            className="py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition cursor-pointer flex flex-col items-center"
                          >
                            <span>Easy</span>
                            <span className="text-[10px] font-normal text-emerald-300/80">
                              {activeCard.repetitions === 0
                                ? '4d'
                                : `${Math.max(5, Math.round(activeCard.interval * activeCard.ease * 1.3))}d`}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-[#161514] border border-white/10 text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-[#FC4C01] mx-auto" />
                  <h4 className="text-base font-bold text-white">
                    All caught up on Recall cards!
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Every flashcard and quiz question you generate from YouTube lectures, uploaded PDFs, or notes automatically enters your SM-2 Recall queue.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: EXAM COUNTDOWN & AUTO PLAN (IST DAY-BY-DAY SCHEDULE)       */}
          {/* ================================================================ */}
          {activeTab === 'plan' && (
            <div className="space-y-4" data-testid="exam-auto-plan-screen">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Exam Countdown & Day-by-Day Auto Plan (IST)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Spreads your exam chapters across remaining days, reserving the last 2 days for Full Revision. Automatically re-plans if you miss a day.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddExamModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold hover:bg-[#e04300] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add exam ({exams.length}/{tierLimits.maxExams})</span>
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
                    className="bg-[#161514] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white">{exam.name}</h4>
                          <span className="px-2.5 py-0.5 rounded-lg bg-[#FC4C01]/15 border border-[#FC4C01]/40 text-[#FC4C01] text-xs font-semibold">
                            {daysLeft === 0
                              ? 'Exam Today'
                              : `${exam.name} in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Exam Date: <span className="text-zinc-200 font-mono">{exam.examDate}</span>{' '}
                          (IST) • {exam.chapters.length} Chapters
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
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 transition cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-[#FC4C01]" />
                          <span>Missed a day? Re-plan</span>
                        </button>
                        {!exam.id.startsWith('guest_') && (
                          <button
                            type="button"
                            onClick={async () => {
                              await StudyLoopStore.deleteExam(exam.id);
                              setExams(StudyLoopStore.getExams());
                            }}
                            className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 transition cursor-pointer"
                            title="Delete exam"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Simple Day List */}
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {exam.planDays.map((day) => {
                        const todayIst = toIstDateKey();
                        const isToday = day.dateIst === todayIst;
                        return (
                          <div
                            key={day.dateIst}
                            className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                              day.isFullRevision
                                ? 'bg-[#FC4C01]/10 border-[#FC4C01]/40'
                                : isToday
                                ? 'bg-white/[0.06] border-white/25'
                                : 'bg-black/40 border-white/10'
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
                                    : 'border-white/25 text-transparent hover:border-[#FC4C01]'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-white">
                                    Day {day.dayNumber} • {day.dateIst}
                                  </span>
                                  {isToday && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#FC4C01] text-white text-[10px] font-bold uppercase">
                                      Today (IST)
                                    </span>
                                  )}
                                  {day.isFullRevision && (
                                    <span className="px-2 py-0.5 rounded bg-[#FC4C01]/20 text-[#FC4C01] text-[10px] font-bold uppercase">
                                      Last 2 Days: Full Revision
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={`text-xs mt-1 ${
                                    day.completed ? 'line-through text-zinc-500' : 'text-zinc-300'
                                  }`}
                                >
                                  {day.chapters.join(' • ')}
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
            <div className="space-y-4" data-testid="weak-spots-screen">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Weak Spots by Chapter
                </h3>
                <p className="text-xs text-zinc-400">
                  Tracks your % correct across Recall reviews and quizzes. Tap “Practice weak topics” on any chapter to generate 5 targeted questions on that chapter only.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {weakSpots.map((ws) => (
                  <div
                    key={ws.chapter}
                    className="p-4 rounded-2xl bg-[#161514] border border-white/10 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                          {ws.subject}
                        </span>
                        <span
                          className={`text-xs font-bold font-mono ${
                            ws.percentCorrect < 60
                              ? 'text-rose-400'
                              : ws.percentCorrect < 80
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {ws.percentCorrect}% correct
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1">{ws.chapter}</h4>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mt-2">
                        <div
                          className="h-full bg-[#FC4C01] transition-all"
                          style={{ width: `${Math.max(8, ws.percentCorrect)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1.5">
                        <span>
                          {ws.correctCount} right / {ws.wrongCount} wrong
                        </span>
                        <span>{ws.cardsCount} cards in Recall</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid={`practice-weak-topic-btn`}
                      onClick={() => handlePracticeWeakTopic(ws.chapter, ws.subject)}
                      disabled={drillLoading && drillingChapter === ws.chapter}
                      className="w-full py-2 px-3 rounded-xl bg-[#FC4C01]/15 hover:bg-[#FC4C01] text-[#FC4C01] hover:text-white border border-[#FC4C01]/40 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>
                        {drillLoading && drillingChapter === ws.chapter
                          ? 'Generating 5 questions...'
                          : 'Practice weak topics (5 questions)'}
                      </span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Weak Chapter 5-Question Drill Output */}
              {drillingChapter && (
                <div
                  className="bg-[#181716] border border-[#FC4C01]/40 rounded-2xl p-4 sm:p-5 space-y-4"
                  data-testid="weak-spot-drill-container"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-[#FC4C01] font-bold">
                        Targeted 5-Question Drill
                      </span>
                      <h4 className="text-base font-bold text-white">{drillingChapter}</h4>
                    </div>
                    {drillError && (
                      <button
                        type="button"
                        onClick={() => handlePracticeWeakTopic(drillingChapter, 'General Studies')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>

                  {drillLoading && (
                    <div className="py-6 text-center text-xs text-zinc-300 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#FC4C01]" />
                      <span>Generating 5 targeted exam questions for {drillingChapter}...</span>
                    </div>
                  )}

                  {drillError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between">
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
                    <div className="space-y-3">
                      {drillQuestions.map((q, qIdx) => {
                        const chosen = drillAnswers[q.id];
                        return (
                          <div
                            key={q.id}
                            className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2.5"
                          >
                            <div className="text-xs sm:text-sm font-semibold text-white">
                              {qIdx + 1}. {q.question}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, oIdx) => {
                                const isPicked = chosen === oIdx;
                                const isRight = q.correctIndex === oIdx;
                                let cls =
                                  'bg-white/5 border-white/10 text-zinc-200 hover:border-white/25';
                                if (chosen !== undefined) {
                                  if (isRight) {
                                    cls =
                                      'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';
                                  } else if (isPicked) {
                                    cls = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
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
                              <div className="text-xs text-zinc-300 bg-white/5 p-2.5 rounded-lg border border-white/10">
                                <strong className="text-[#FC4C01]">Explanation:</strong>{' '}
                                {q.explanation}
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
          {/* TAB 4: PHASE B — UPLOAD ANYTHING → STUDY (PDF, IMAGE OCR, TEXT)   */}
          {/*        + PHASE C AUDIO RECAP + PHASE D TELUGU/HINDI TOGGLE       */}
          {/* ================================================================ */}
          {activeTab === 'upload' && (
            <div className="space-y-4" data-testid="upload-anything-screen">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Upload Anything → Complete Study Pack
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Upload a PDF (up to {tierLimits.pdfMaxPages} pages on your tier), photo of handwritten/textbook notes (OCR), or pasted text. Deduplicated by SHA-256 hash and cites Page numbers.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {(['pdf', 'image', 'text'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setUploadMode(m)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition cursor-pointer ${
                        uploadMode === m
                          ? 'bg-[#FC4C01] text-white'
                          : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {m === 'pdf' ? 'PDF' : m === 'image' ? 'Image / Notes OCR' : 'Paste Text'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Controls */}
              {uploadMode === 'pdf' && (
                <div className="p-6 rounded-2xl bg-[#161514] border border-dashed border-[#FC4C01]/40 text-center space-y-3">
                  <FileText className="w-8 h-8 text-[#FC4C01] mx-auto" />
                  <div className="text-sm font-semibold text-white">
                    Select a PDF Textbook Chapter or Lecture Slides
                  </div>
                  <p className="text-xs text-zinc-400">
                    Extracts text page-by-page (max {tierLimits.pdfMaxPages} pages on{' '}
                    {planTier.toUpperCase()} tier) and cites exact Page numbers.
                  </p>
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
                <div className="p-6 rounded-2xl bg-[#161514] border border-dashed border-[#FC4C01]/40 text-center space-y-3">
                  <Camera className="w-8 h-8 text-[#FC4C01] mx-auto" />
                  <div className="text-sm font-semibold text-white">
                    Upload Photo of Handwritten Notes or Textbook Page (Vision OCR)
                  </div>
                  <p className="text-xs text-zinc-400">
                    Supports handwritten notes, printed textbook pages, and board diagrams.
                  </p>
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
                  className="p-4 rounded-2xl bg-[#161514] border border-white/10 space-y-3"
                >
                  <input
                    type="text"
                    placeholder="Topic / Chapter Title (e.g. Second Law of Thermodynamics)"
                    value={pastedStudyTitle}
                    onChange={(e) => setPastedStudyTitle(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <textarea
                    rows={4}
                    placeholder="Paste your lecture notes, textbook excerpt, or syllabus points here..."
                    value={pastedStudyText}
                    onChange={(e) => setPastedStudyText(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-xs text-white"
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
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-2">
                  <span>{uploadError}</span>
                  <button
                    type="button"
                    onClick={handleRetryUpload}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#FC4C01] text-white font-semibold shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              )}

              {/* Synthesized Study Pack Output */}
              {activeStudyPack && (
                <div
                  className="bg-[#161514] border border-white/15 rounded-2xl p-4 sm:p-5 space-y-4"
                  data-testid="uploaded-study-pack-output"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-white">{activeStudyPack.title}</h4>
                        <span className="px-2 py-0.5 rounded bg-[#FC4C01]/15 text-[#FC4C01] text-[11px] font-semibold">
                          {activeStudyPack.subject} → {activeStudyPack.chapter}
                        </span>
                        {activeStudyPack.deduplicated && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono">
                            Instant Cache Hit (SHA-256 Dedup)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {activeStudyPack.pageCount} page{activeStudyPack.pageCount === 1 ? '' : 's'}{' '}
                        analyzed • Cited by Page number
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Phase C: Listen (Audio Recap) Button */}
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white transition cursor-pointer"
                      >
                        {audioState === 'playing' ? (
                          <>
                            <Square className="w-3.5 h-3.5 text-[#FC4C01]" />
                            <span>Stop Audio Recap</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-[#FC4C01]" />
                            <span>
                              {audioState === 'loading'
                                ? 'Preparing Audio...'
                                : planTier === 'free'
                                ? 'Listen (30s Preview)'
                                : 'Listen (2–5m Audio Recap)'}
                            </span>
                          </>
                        )}
                      </button>

                      {/* Add to Recall Button */}
                      <button
                        type="button"
                        data-testid="add-pack-to-recall-btn"
                        onClick={() => handleAddPackToRecall(activeStudyPack)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Recall</span>
                      </button>
                    </div>
                  </div>

                  {/* Audio Recap Status / Script Preview Bar */}
                  {(audioScriptPreview || audioInfoMsg) && (
                    <div className="p-3 rounded-xl bg-black/50 border border-[#FC4C01]/30 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#FC4C01] flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>
                            Audio Recap ({language}){' '}
                            {audioIsPreviewTier ? '• Free Tier 30s Preview' : '• Full Background Playback Ready'}
                          </span>
                        </span>
                        {audioIsPreviewTier && onOpenPricing && (
                          <button
                            type="button"
                            onClick={onOpenPricing}
                            className="text-[11px] font-semibold text-[#FC4C01] underline cursor-pointer"
                          >
                            Unlock Full 2–5m Recap on Spark
                          </button>
                        )}
                      </div>
                      {audioScriptPreview && (
                        <p className="text-zinc-300 leading-relaxed line-clamp-3">
                          {audioScriptPreview}
                        </p>
                      )}
                      {audioInfoMsg && <p className="text-amber-300">{audioInfoMsg}</p>}
                    </div>
                  )}

                  {/* Phase D: Explain in Telugu / Hindi Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-black/40 p-2.5 rounded-xl border border-white/10 text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#FC4C01]" />
                      <span>Explain Summary in Local Language (keeps technical terms in English):</span>
                    </span>
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
                              : 'bg-white/5 text-zinc-300 hover:text-white'
                          }`}
                        >
                          {lang === 'English'
                            ? 'English'
                            : lang === 'Telugu'
                            ? 'Explain in తెలుగు'
                            : 'Explain in हिन्दी'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {packTranslateError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between">
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

                  {/* Sub-tabs: Summary / Flashcards / Quiz */}
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2">
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
                            ? 'bg-[#FC4C01]/20 text-[#FC4C01] border border-[#FC4C01]/40'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {packSubTab === 'summary' && (
                    <div className="space-y-3">
                      {packTranslatedSummary && (
                        <div className="p-3.5 rounded-xl bg-[#FC4C01]/10 border border-[#FC4C01]/30 text-xs text-zinc-100 whitespace-pre-wrap leading-relaxed">
                          {packTranslatedSummary}
                        </div>
                      )}
                      {activeStudyPack.summaryBullets.map((b, i) => (
                        <div
                          key={i}
                          className="flex items-start justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/10"
                        >
                          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
                            {b.text}
                          </p>
                          <span className="px-2 py-0.5 rounded bg-[#FC4C01]/15 text-[#FC4C01] text-[11px] font-mono font-semibold shrink-0">
                            Page {b.page}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {packSubTab === 'flashcards' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeStudyPack.flashcards.map((fc) => {
                        const flipped = Boolean(packFlippedCards[fc.id]);
                        return (
                          <div
                            key={fc.id}
                            onClick={() =>
                              setPackFlippedCards((prev) => ({ ...prev, [fc.id]: !flipped }))
                            }
                            className="p-4 rounded-xl bg-black/50 border border-white/10 hover:border-[#FC4C01]/40 transition cursor-pointer space-y-2"
                          >
                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                              <span>{flipped ? 'ANSWER' : 'QUESTION (Tap to flip)'}</span>
                              <span className="font-mono text-[#FC4C01]">{fc.pageLabel}</span>
                            </div>
                            <p className="text-xs sm:text-sm font-medium text-white">
                              {flipped ? fc.back : fc.front}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {packSubTab === 'quiz' && (
                    <div className="space-y-3">
                      {activeStudyPack.quiz.map((q, idx) => {
                        const picked = packQuizAnswers[q.id];
                        return (
                          <div
                            key={q.id}
                            className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs sm:text-sm font-semibold text-white">
                                {idx + 1}. {q.question}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-[#FC4C01]/15 text-[#FC4C01] text-[11px] font-mono shrink-0">
                                {q.pageLabel}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, oIdx) => {
                                const isChosen = picked === oIdx;
                                const isRight = q.correctIndex === oIdx;
                                let cls = 'bg-white/5 border-white/10 text-zinc-200';
                                if (picked !== undefined) {
                                  if (isRight)
                                    cls =
                                      'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';
                                  else if (isChosen)
                                    cls = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
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
                              <p className="text-xs text-zinc-300 bg-white/5 p-2 rounded-lg">
                                <strong className="text-[#FC4C01]">Explanation:</strong>{' '}
                                {q.explanation}
                              </p>
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
          {/* TAB 5: PHASE B — SNAP & SOLVE (PHOTO/TEXT OF 1 QUESTION)         */}
          {/* ================================================================ */}
          {activeTab === 'snap_solve' && (
            <div className="space-y-4" data-testid="snap-and-solve-screen">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Snap & Solve (Single Question Tutor)
                </h3>
                <p className="text-xs text-zinc-400">
                  Snap a photo of one homework/exam question or paste it below → get a step-by-step solution, the core concept behind it, and 1 similar practice question.
                </p>
              </div>

              <div className="bg-[#161514] border border-white/10 rounded-2xl p-4 space-y-3">
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
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Snap / Upload Question Photo</span>
                  </button>
                  <span className="text-xs text-zinc-400">or type/paste question below:</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    data-testid="snap-question-input"
                    placeholder="e.g. A Carnot engine operates between 600K and 300K. Find its thermal efficiency..."
                    value={snapQuestionText}
                    onChange={(e) => setSnapQuestionText(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#FC4C01]"
                  />
                  <button
                    type="button"
                    data-testid="snap-solve-submit-btn"
                    onClick={() => triggerSnapSolve(snapImageDataUrl, snapQuestionText, language)}
                    disabled={snapLoading}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-[#FC4C01] text-white text-xs font-semibold transition cursor-pointer shrink-0"
                  >
                    {snapLoading ? 'Solving Step-by-Step...' : 'Solve Question'}
                  </button>
                </div>
              </div>

              {snapError && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-2">
                  <span>{snapError}</span>
                  <button
                    type="button"
                    onClick={() => triggerSnapSolve(snapImageDataUrl, snapQuestionText, language)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#FC4C01] text-white font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              )}

              {snapResult && (
                <div
                  className="bg-[#161514] border border-white/15 rounded-2xl p-4 sm:p-5 space-y-4"
                  data-testid="snap-solve-result"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-[#FC4C01] font-bold">
                        Step-by-Step Worked Solution
                      </span>
                      <h4 className="text-sm sm:text-base font-bold text-white mt-0.5">
                        {snapResult.questionExtracted}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {snapResult.checkWithTextbook && (
                        <span
                          data-testid="check-with-textbook-badge"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Check with your textbook</span>
                        </span>
                      )}

                      {/* Phase D: Telugu / Hindi toggle on Snap & Solve */}
                      <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10 text-xs">
                        {(['English', 'Telugu', 'Hindi'] as StudyLanguage[]).map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => handleExplainSnapSolve(lang)}
                            disabled={snapTranslating}
                            className={`px-2 py-0.5 rounded-lg font-medium transition cursor-pointer ${
                              language === lang
                                ? 'bg-[#FC4C01] text-white'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {lang === 'English' ? 'EN' : lang === 'Telugu' ? 'తెలుగు' : 'हिन्दी'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {snapTranslateError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between">
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
                    <div className="p-3.5 rounded-xl bg-[#FC4C01]/10 border border-[#FC4C01]/30 text-xs text-zinc-100 whitespace-pre-wrap leading-relaxed">
                      {snapTranslatedText}
                    </div>
                  )}

                  {/* Steps */}
                  <div className="space-y-2">
                    {snapResult.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs sm:text-sm text-zinc-200 leading-relaxed"
                      >
                        {step}
                      </div>
                    ))}
                    <div className="p-3 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 text-xs sm:text-sm font-bold text-white">
                      Final Answer: {snapResult.finalAnswer}
                    </div>
                  </div>

                  {/* Concept Behind It */}
                  <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-1">
                    <div className="text-[11px] uppercase tracking-wider text-[#FC4C01] font-bold">
                      Concept Behind It • {snapResult.conceptBehindIt.subject} →{' '}
                      {snapResult.conceptBehindIt.chapter}
                    </div>
                    <div className="text-sm font-bold text-white">
                      {snapResult.conceptBehindIt.title}
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {snapResult.conceptBehindIt.explanation}
                    </p>
                  </div>

                  {/* 1 Similar Practice Question */}
                  <div className="p-4 rounded-xl bg-black/50 border border-[#FC4C01]/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#FC4C01]">
                        1 Similar Practice Question (Test Yourself)
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
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      {snapResult.similarPracticeQuestion.question}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {snapResult.similarPracticeQuestion.options.map((opt, idx) => {
                        const isPicked = snapPracticeAnswer === idx;
                        const isRight =
                          snapResult.similarPracticeQuestion.correctIndex === idx;
                        let cls = 'bg-white/5 border-white/10 text-zinc-200';
                        if (snapPracticeAnswer !== null) {
                          if (isRight)
                            cls =
                              'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';
                          else if (isPicked)
                            cls = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
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
                      <div className="text-xs text-zinc-300 bg-white/5 p-2.5 rounded-lg">
                        <strong className="text-[#FC4C01]">Explanation:</strong>{' '}
                        {snapResult.similarPracticeQuestion.explanation}
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
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateExam}
            className="w-full max-w-lg bg-[#161514] border border-[#FC4C01]/40 rounded-2xl p-5 space-y-4 shadow-2xl"
            data-testid="add-exam-modal"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Add Exam & Generate Auto Plan (IST)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddExamModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {examFormError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
                {examFormError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Exam Name</label>
                <input
                  type="text"
                  data-testid="exam-name-input"
                  placeholder="e.g. Physics Exam"
                  value={examNameInput}
                  onChange={(e) => setExamNameInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Exam Date (IST)</label>
                <input
                  type="date"
                  data-testid="exam-date-input"
                  min={toIstDateKey()}
                  value={examDateInput}
                  onChange={(e) => setExamDateInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Subject</label>
              <input
                type="text"
                placeholder="e.g. Physics, Biology, Mathematics"
                value={examSubjectInput}
                onChange={(e) => setExamSubjectInput(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Pick Chapters from Vault or Type Custom ({selectedChapters.length} selected)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-xl bg-black/40 border border-white/10">
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
                          : 'bg-white/5 text-zinc-300 hover:bg-white/10'
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
                  className="flex-1 bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
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
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                >
                  + Add Chapter
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddExamModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="save-exam-submit-btn"
                className="px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-xs font-semibold text-white cursor-pointer"
              >
                Save Exam & Build Plan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
