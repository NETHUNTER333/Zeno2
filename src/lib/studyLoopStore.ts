import {
  auth,
  getAuthHeaders,
  saveExamToFirestore,
  loadExamsFromFirestore,
  deleteExamFromFirestore,
  saveRecallCardToFirestore,
  loadRecallCardsFromFirestore,
  deleteRecallCardFromFirestore,
  type FirestoreExamDoc,
  type FirestoreExamPlanDay,
  type FirestoreRecallCardDoc,
} from './firebase';
import { UserAccountStore, toIstDateKey } from './userAccountStore';
import { KnowledgeVaultStore } from './growthStore';

export type RecallGrade = 'again' | 'hard' | 'good' | 'easy';

export interface StudyLanguageOption {
  id: string;
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
  bcp47: string;
  countries: string;
}

export const SUPPORTED_STUDY_LANGUAGES: StudyLanguageOption[] = [
  { id: 'English', code: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸', bcp47: 'en-US', countries: 'US, UK, CA, AU, SG, NZ, ZA, NG, IE' },
  { id: 'Hindi', code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी (Hindi)', flag: '🇮🇳', bcp47: 'hi-IN', countries: 'India' },
  { id: 'Telugu', code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు (Telugu)', flag: '🇮🇳', bcp47: 'te-IN', countries: 'India' },
  { id: 'Tamil', code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ் (Tamil)', flag: '🇮🇳', bcp47: 'ta-IN', countries: 'India, Singapore, Malaysia' },
  { id: 'Kannada', code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳', bcp47: 'kn-IN', countries: 'India' },
  { id: 'Malayalam', code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം (Malayalam)', flag: '🇮🇳', bcp47: 'ml-IN', countries: 'India' },
  { id: 'Marathi', code: 'mr', label: 'Marathi', nativeLabel: 'मराठी (Marathi)', flag: '🇮🇳', bcp47: 'mr-IN', countries: 'India' },
  { id: 'Bengali', code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা (Bengali)', flag: '🇮🇳', bcp47: 'bn-IN', countries: 'India' },
  { id: 'Gujarati', code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી (Gujarati)', flag: '🇮🇳', bcp47: 'gu-IN', countries: 'India' },
  { id: 'Punjabi', code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳', bcp47: 'pa-IN', countries: 'India' },
  { id: 'Spanish', code: 'es', label: 'Spanish', nativeLabel: 'Español (Spanish)', flag: '🇪🇸', bcp47: 'es-ES', countries: 'Spain, Mexico, Argentina, Chile, Colombia, Peru' },
  { id: 'French', code: 'fr', label: 'French', nativeLabel: 'Français (French)', flag: '🇫🇷', bcp47: 'fr-FR', countries: 'France, Canada, Belgium, Switzerland' },
  { id: 'German', code: 'de', label: 'German', nativeLabel: 'Deutsch (German)', flag: '🇩🇪', bcp47: 'de-DE', countries: 'Germany, Austria, Switzerland' },
  { id: 'Portuguese', code: 'pt', label: 'Portuguese', nativeLabel: 'Português (Portuguese)', flag: '🇧🇷', bcp47: 'pt-BR', countries: 'Brazil, Portugal' },
  { id: 'Italian', code: 'it', label: 'Italian', nativeLabel: 'Italiano (Italian)', flag: '🇮🇹', bcp47: 'it-IT', countries: 'Italy, Switzerland' },
  { id: 'Dutch', code: 'nl', label: 'Dutch', nativeLabel: 'Nederlands (Dutch)', flag: '🇳🇱', bcp47: 'nl-NL', countries: 'Netherlands, Belgium' },
  { id: 'Polish', code: 'pl', label: 'Polish', nativeLabel: 'Polski (Polish)', flag: '🇵🇱', bcp47: 'pl-PL', countries: 'Poland' },
  { id: 'Swedish', code: 'sv', label: 'Swedish', nativeLabel: 'Svenska (Swedish)', flag: '🇸🇪', bcp47: 'sv-SE', countries: 'Sweden' },
  { id: 'Norwegian', code: 'no', label: 'Norwegian', nativeLabel: 'Norsk (Norwegian)', flag: '🇳🇴', bcp47: 'nb-NO', countries: 'Norway' },
  { id: 'Danish', code: 'da', label: 'Danish', nativeLabel: 'Dansk (Danish)', flag: '🇩🇰', bcp47: 'da-DK', countries: 'Denmark' },
  { id: 'Finnish', code: 'fi', label: 'Finnish', nativeLabel: 'Suomi (Finnish)', flag: '🇫🇮', bcp47: 'fi-FI', countries: 'Finland' },
  { id: 'Japanese', code: 'ja', label: 'Japanese', nativeLabel: '日本語 (Japanese)', flag: '🇯🇵', bcp47: 'ja-JP', countries: 'Japan' },
  { id: 'Korean', code: 'ko', label: 'Korean', nativeLabel: '한국어 (Korean)', flag: '🇰🇷', bcp47: 'ko-KR', countries: 'South Korea' },
  { id: 'Chinese', code: 'zh', label: 'Chinese', nativeLabel: '中文 (Chinese)', flag: '🇭🇰', bcp47: 'zh-TW', countries: 'Hong Kong, Taiwan, Singapore' },
  { id: 'Arabic', code: 'ar', label: 'Arabic', nativeLabel: 'العربية (Arabic)', flag: '🇦🇪', bcp47: 'ar-SA', countries: 'UAE, Saudi Arabia, Egypt' },
  { id: 'Filipino', code: 'tl', label: 'Filipino', nativeLabel: 'Filipino (Tagalog)', flag: '🇵🇭', bcp47: 'fil-PH', countries: 'Philippines' },
  { id: 'Malay', code: 'ms', label: 'Malay', nativeLabel: 'Bahasa Melayu (Malay)', flag: '🇲🇾', bcp47: 'ms-MY', countries: 'Malaysia, Singapore' },
  { id: 'Indonesian', code: 'id', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', flag: '🇮🇩', bcp47: 'id-ID', countries: 'Indonesia' },
  { id: 'Thai', code: 'th', label: 'Thai', nativeLabel: 'ไทย (Thai)', flag: '🇹🇭', bcp47: 'th-TH', countries: 'Thailand' },
  { id: 'Vietnamese', code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt (Vietnamese)', flag: '🇻🇳', bcp47: 'vi-VN', countries: 'Vietnam' },
  { id: 'Turkish', code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe (Turkish)', flag: '🇹🇷', bcp47: 'tr-TR', countries: 'Turkey' },
  { id: 'Hebrew', code: 'he', label: 'Hebrew', nativeLabel: 'עברית (Hebrew)', flag: '🇮🇱', bcp47: 'he-IL', countries: 'Israel' },
  { id: 'Swahili', code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili (Swahili)', flag: '🇰🇪', bcp47: 'sw-KE', countries: 'Kenya' },
  { id: 'Czech', code: 'cs', label: 'Czech', nativeLabel: 'Čeština (Czech)', flag: '🇨🇿', bcp47: 'cs-CZ', countries: 'Czechia' },
  { id: 'Hungarian', code: 'hu', label: 'Hungarian', nativeLabel: 'Magyar (Hungarian)', flag: '🇭🇺', bcp47: 'hu-HU', countries: 'Hungary' },
  { id: 'Romanian', code: 'ro', label: 'Romanian', nativeLabel: 'Română (Romanian)', flag: '🇷🇴', bcp47: 'ro-RO', countries: 'Romania' },
  { id: 'Greek', code: 'el', label: 'Greek', nativeLabel: 'Ελληνικά (Greek)', flag: '🇬🇷', bcp47: 'el-GR', countries: 'Greece' },
  { id: 'Afrikaans', code: 'af', label: 'Afrikaans', nativeLabel: 'Afrikaans', flag: '🇿🇦', bcp47: 'af-ZA', countries: 'South Africa' },
];

export type StudyLanguage = string;
export type StudyExplainLanguage = StudyLanguage;

export type ExamPlanDay = FirestoreExamPlanDay;
export type StudyExam = FirestoreExamDoc;
export type RecallCard = FirestoreRecallCardDoc;

export interface ChapterWeakSpot {
  chapter: string;
  subject: string;
  correctCount: number;
  wrongCount: number;
  totalAttempts: number;
  percentCorrect: number;
  cardsCount: number;
}

export interface DailyRevisionSummary {
  totalCardsToday: number;
  estimatedMinutes: number;
  dueCards: RecallCard[];
  weakCards: RecallCard[];
  nearestExamCards: RecallCard[];
  mixedQueue: RecallCard[];
  nearestExam: {
    exam: StudyExam;
    daysRemaining: number;
    countdownLabel: string;
  } | null;
}

export interface SnapSolveResult {
  questionExtracted: string;
  steps: string[];
  answer: string;
  finalAnswer: string;
  conceptBehindIt?: {
    title: string;
    subject: string;
    chapter: string;
    explanation: string;
  };
  similarPracticeQuestion?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
  confidence: 'high' | 'medium' | 'low';
  checkWithTextbook: boolean;
}

export interface SnapSolveApiResponse {
  ok?: boolean;
  success?: boolean;
  questionExtracted?: string;
  steps?: string[];
  answer?: string;
  finalAnswer?: string;
  conceptBehindIt?: SnapSolveResult['conceptBehindIt'];
  similarPracticeQuestion?: SnapSolveResult['similarPracticeQuestion'];
  confidence?: 'high' | 'medium' | 'low';
  checkWithTextbook?: boolean;
  error?: string;
  message?: string;
}

export interface UploadedStudyPack {
  id: string;
  fileHash: string;
  sourceType: 'pdf' | 'image' | 'text';
  title: string;
  subject: string;
  chapter: string;
  pageCount: number;
  summaryBullets: Array<{ text: string; page: number }>;
  chapters: Array<{
    id: string;
    title: string;
    page: number;
    pageLabel: string;
    summary: string;
  }>;
  flashcards: Array<{
    id: string;
    front: string;
    back: string;
    page: number;
    pageLabel: string;
    chapter: string;
  }>;
  quiz: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    page: number;
    pageLabel: string;
    chapter: string;
  }>;
  pagesText?: Array<{ page: number; text: string }>;
  createdAt: number;
  deduplicated?: boolean;
}

const STORAGE_KEYS = {
  EXAMS: 'kinich_study_exams_v1',
  CARDS: 'kinich_recall_cards_v1',
  DAILY_REVIEW_STATS: 'kinich_recall_daily_stats_v1',
  UPLOAD_PACKS_CACHE: 'kinich_upload_packs_cache_v1',
};

// In-memory transient state for Guest mode so guests can try Daily Revision, Countdown & Weak Spots
// without anything being saved to localStorage or Firestore.
function buildGuestDemoState(): { exams: StudyExam[]; cards: RecallCard[] } {
  const todayIst = toIstDateKey();
  const [y, m, d] = todayIst.split('-').map(Number);
  const nineDaysLater = new Date(Date.UTC(y || 2026, (m || 1) - 1, (d || 1) + 9))
    .toISOString()
    .slice(0, 10);

  const demoChapters = [
    'Thermodynamics & Heat Engines',
    'Electromagnetism & Circuits',
    'Quantum Mechanics & Photons',
    'Optics & Wave Interference',
  ];

  const planDays = buildClientIstAutoPlan(nineDaysLater, demoChapters, []);

  const demoExam: StudyExam = {
    id: 'guest_demo_physics_exam',
    userId: 'guest',
    name: 'Physics Exam',
    examDate: nineDaysLater,
    subject: 'Physics',
    chapters: demoChapters,
    planDays,
    lastReplannedAt: todayIst,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  };

  const now = Date.now();
  const demoCards: RecallCard[] = [
    {
      id: 'guest_card_1',
      userId: 'guest',
      type: 'flashcard',
      front: 'State the First Law of Thermodynamics and its mathematical conservation form.',
      back: 'ΔU = Q - W (change in internal energy equals heat added to the system minus work done by the system). Energy cannot be created or destroyed.',
      subject: 'Physics',
      chapter: 'Thermodynamics & Heat Engines',
      examId: demoExam.id,
      pageOrTimestamp: 'Page 4',
      ease: 2.3,
      interval: 1,
      repetitions: 1,
      dueAt: now - 3600 * 1000,
      wrongCount: 3,
      correctCount: 2,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 3600 * 1000,
    },
    {
      id: 'guest_card_2',
      userId: 'guest',
      type: 'quiz',
      front: 'Why can no heat engine operating between two temperatures T_H and T_C exceed the Carnot efficiency?',
      back: 'η_max = 1 - (T_C / T_H). Exceeding Carnot efficiency would violate the Second Law of Thermodynamics by decreasing total entropy.',
      options: [
        'Because η_max = 1 - (T_C / T_H) is bounded by the Second Law of Thermodynamics (entropy non-decrease)',
        'Because mechanical friction is always 100% of heat input',
        'Because ideal gases cannot expand isothermally',
        'Because specific heat capacity is always zero',
      ],
      correctIndex: 0,
      explanation: 'A reversible Carnot cycle sets the theoretical upper bound η = 1 - T_C/T_H between two reservoirs.',
      subject: 'Physics',
      chapter: 'Thermodynamics & Heat Engines',
      examId: demoExam.id,
      pageOrTimestamp: 'Page 12',
      ease: 2.2,
      interval: 1,
      repetitions: 1,
      dueAt: now - 1800 * 1000,
      wrongCount: 2,
      correctCount: 1,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 1800 * 1000,
    },
    {
      id: 'guest_card_3',
      userId: 'guest',
      type: 'flashcard',
      front: 'What does Faraday’s Law of Electromagnetic Induction state?',
      back: 'The induced electromotive force (EMF) in any closed circuit is equal to the negative rate of change of the magnetic flux through the circuit: ε = -dΦ_B / dt.',
      subject: 'Physics',
      chapter: 'Electromagnetism & Circuits',
      examId: demoExam.id,
      pageOrTimestamp: '04:15',
      ease: 2.5,
      interval: 2,
      repetitions: 2,
      dueAt: now - 600 * 1000,
      wrongCount: 1,
      correctCount: 3,
      createdAt: now - 86400000 * 3,
      updatedAt: now - 600 * 1000,
    },
    {
      id: 'guest_card_4',
      userId: 'guest',
      type: 'flashcard',
      front: 'In the photoelectric effect, what determines the maximum kinetic energy of emitted photoelectrons?',
      back: 'K_max = hν - φ (incident photon frequency ν and metal work function φ, independent of light intensity).',
      subject: 'Physics',
      chapter: 'Quantum Mechanics & Photons',
      examId: demoExam.id,
      pageOrTimestamp: 'Page 19',
      ease: 2.6,
      interval: 3,
      repetitions: 2,
      dueAt: now - 300 * 1000,
      wrongCount: 0,
      correctCount: 4,
      createdAt: now - 86400000 * 3,
      updatedAt: now - 300 * 1000,
    },
  ];

  return { exams: [demoExam], cards: demoCards };
}

let guestMemoryState = buildGuestDemoState();

export function buildClientIstAutoPlan(
  examDateStr: string,
  chapters: string[],
  completedDates: string[] = []
): ExamPlanDay[] {
  const todayIst = toIstDateKey();
  const cleanChapters = (Array.isArray(chapters) ? chapters : [])
    .map((c) => String(c || '').trim())
    .filter(Boolean);
  if (cleanChapters.length === 0) {
    cleanChapters.push('Core Concepts & Definitions', 'Problem Solving & Exam Drills');
  }

  const [ty, tm, td] = todayIst.split('-').map(Number);
  const [ey, em, ed] = String(examDateStr || todayIst)
    .slice(0, 10)
    .split('-')
    .map(Number);

  const startUtc = Date.UTC(ty || 2026, (tm || 1) - 1, td || 1);
  const endUtc = Date.UTC(ey || ty || 2026, (em || tm || 1) - 1, ed || td || 1);
  const diffDays = Math.max(1, Math.min(180, Math.round((endUtc - startUtc) / 86400000)));

  const completedSet = new Set(completedDates);
  const planDays: ExamPlanDay[] = [];

  // Last 2 days reserved for Full Revision whenever diffDays >= 3
  const revisionDaysCount = diffDays >= 3 ? 2 : diffDays === 2 ? 1 : 0;
  const studyDaysCount = Math.max(1, diffDays - revisionDaysCount);

  for (let i = 0; i < diffDays; i++) {
    const dayUtc = new Date(startUtc + i * 86400000);
    const dateIst = dayUtc.toISOString().slice(0, 10);
    const isFullRevision = i >= studyDaysCount;

    let dayChapters: string[] = [];
    if (isFullRevision) {
      dayChapters = [
        `Full Syllabus Revision (${cleanChapters.length} chapters)`,
        'Weak-Spot Drills & Active Recall Mock Test',
      ];
    } else {
      if (cleanChapters.length <= studyDaysCount) {
        const chIdx = Math.min(
          cleanChapters.length - 1,
          Math.floor((i * cleanChapters.length) / studyDaysCount)
        );
        dayChapters = [cleanChapters[chIdx]];
      } else {
        const startIdx = Math.floor((i * cleanChapters.length) / studyDaysCount);
        const endIdx = Math.max(
          startIdx + 1,
          Math.floor(((i + 1) * cleanChapters.length) / studyDaysCount)
        );
        dayChapters = cleanChapters.slice(startIdx, endIdx);
      }
    }

    planDays.push({
      dateIst,
      dayNumber: i + 1,
      isFullRevision,
      chapters: dayChapters,
      completed: completedSet.has(dateIst),
    });
  }

  return planDays;
}

export function getDaysUntilIstDate(examDateStr: string): number {
  const todayIst = toIstDateKey();
  const [ty, tm, td] = todayIst.split('-').map(Number);
  const [ey, em, ed] = String(examDateStr || todayIst)
    .slice(0, 10)
    .split('-')
    .map(Number);
  const startUtc = Date.UTC(ty || 2026, (tm || 1) - 1, td || 1);
  const endUtc = Date.UTC(ey || ty || 2026, (em || tm || 1) - 1, ed || td || 1);
  return Math.max(0, Math.round((endUtc - startUtc) / 86400000));
}

export function computeSm2Local(
  card: RecallCard,
  grade: RecallGrade,
  nowMs = Date.now()
): Pick<RecallCard, 'ease' | 'interval' | 'repetitions' | 'dueAt' | 'wrongCount' | 'correctCount'> {
  let ease = Math.max(1.3, Math.min(4.0, Number(card.ease) || 2.5));
  let interval = Math.max(0, Math.floor(Number(card.interval) || 0));
  let repetitions = Math.max(0, Math.floor(Number(card.repetitions) || 0));
  let wrongCount = Math.max(0, Math.floor(Number(card.wrongCount) || 0));
  let correctCount = Math.max(0, Math.floor(Number(card.correctCount) || 0));

  if (grade === 'again') {
    repetitions = 0;
    interval = 0;
    ease = Math.max(1.3, Number((ease - 0.2).toFixed(2)));
    wrongCount += 1;
    return {
      ease,
      interval,
      repetitions,
      dueAt: nowMs + 10 * 60 * 1000,
      wrongCount,
      correctCount,
    };
  }

  correctCount += 1;
  if (grade === 'hard') {
    repetitions += 1;
    interval = interval <= 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
    ease = Math.max(1.3, Number((ease - 0.15).toFixed(2)));
  } else if (grade === 'good') {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 3;
    else interval = Math.max(4, Math.round(interval * ease));
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 4;
    else interval = Math.max(5, Math.round(interval * ease * 1.3));
    ease = Math.min(3.5, Number((ease + 0.15).toFixed(2)));
  }

  return {
    ease,
    interval,
    repetitions,
    dueAt: nowMs + interval * 86400 * 1000,
    wrongCount,
    correctCount,
  };
}

export async function computeSha256FileHash(input: ArrayBuffer | string): Promise<string> {
  try {
    const buffer =
      typeof input === 'string' ? new TextEncoder().encode(input).buffer : input;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  // Fallback deterministic DJB2-64 hex hash if crypto.subtle unavailable
  const str =
    typeof input === 'string'
      ? input
      : new TextDecoder().decode(new Uint8Array(input).slice(0, 8192));
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export function promptGuestSignInForVault(reason = 'Sign in to keep this in your Vault'): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('kinich-open-auth', {
        detail: { reason },
      })
    );
  }
}

export const StudyLoopStore = {
  emitUpdate(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kinich-study-loop-updated'));
    }
  },

  getTierLimits() {
    const plan = UserAccountStore.getCurrentPlan();
    if (plan === 'fire') {
      return {
        tier: 'fire' as const,
        maxExams: 20,
        dailyRecallReviews: 500,
        autoPlanEnabled: true,
        weakTopicDrillsPerDay: 50,
        pdfMaxPages: 300,
        audioRecapFullAccess: true,
        audioRecapMaxSeconds: 300,
      };
    }
    if (plan === 'spark') {
      return {
        tier: 'spark' as const,
        maxExams: 5,
        dailyRecallReviews: 150,
        autoPlanEnabled: true,
        weakTopicDrillsPerDay: 15,
        pdfMaxPages: 150,
        audioRecapFullAccess: true,
        audioRecapMaxSeconds: 300,
      };
    }
    return {
      tier: 'free' as const,
      maxExams: 10,
      dailyRecallReviews: 30,
      autoPlanEnabled: true,
      weakTopicDrillsPerDay: 10,
      pdfMaxPages: 50,
      audioRecapFullAccess: false,
      audioRecapMaxSeconds: 30,
    };
  },

  getDailyReviewCount(): { dateIst: string; reviewedToday: number } {
    const todayIst = toIstDateKey();
    if (UserAccountStore.isGuest()) {
      return { dateIst: todayIst, reviewedToday: 0 };
    }
    const raw = loadJson<{ dateIst?: string; reviewedToday?: number }>(
      STORAGE_KEYS.DAILY_REVIEW_STATS,
      {}
    );
    if (raw.dateIst !== todayIst) {
      return { dateIst: todayIst, reviewedToday: 0 };
    }
    return { dateIst: todayIst, reviewedToday: Math.max(0, Number(raw.reviewedToday || 0)) };
  },

  incrementDailyReviewCount(): number {
    const todayIst = toIstDateKey();
    if (UserAccountStore.isGuest()) return 1;
    const current = this.getDailyReviewCount();
    const next = current.reviewedToday + 1;
    saveJson(STORAGE_KEYS.DAILY_REVIEW_STATS, { dateIst: todayIst, reviewedToday: next });
    return next;
  },

  getExams(): StudyExam[] {
    if (UserAccountStore.isGuest()) {
      return guestMemoryState.exams;
    }
    const exams = loadJson<StudyExam[]>(STORAGE_KEYS.EXAMS, []);
    // Auto re-plan if user missed a past day in IST
    return this.autoReplanMissedDays(exams, false);
  },

  saveExamsLocal(exams: StudyExam[]): void {
    if (UserAccountStore.isGuest()) {
      guestMemoryState.exams = exams;
      this.emitUpdate();
      return;
    }
    saveJson(STORAGE_KEYS.EXAMS, exams);
    this.emitUpdate();
  },

  autoReplanMissedDays(exams: StudyExam[], forceSave = true): StudyExam[] {
    const todayIst = toIstDateKey();
    let changed = false;

    const updatedExams = exams.map((exam) => {
      if (!Array.isArray(exam.planDays) || exam.planDays.length === 0) {
        const built = buildClientIstAutoPlan(exam.examDate, exam.chapters, []);
        changed = true;
        return { ...exam, planDays: built, lastReplannedAt: todayIst };
      }

      // Check if there is any past uncompleted day (< todayIst) and we haven't replanned today
      const hasMissedPastDay = exam.planDays.some(
        (pd) => pd.dateIst < todayIst && !pd.completed
      );

      if (hasMissedPastDay && exam.lastReplannedAt !== todayIst) {
        const completedDates = exam.planDays
          .filter((pd) => pd.completed)
          .map((pd) => pd.dateIst);
        const completedChaptersSet = new Set<string>();
        exam.planDays
          .filter((pd) => pd.completed && !pd.isFullRevision)
          .forEach((pd) => pd.chapters.forEach((c) => completedChaptersSet.add(c)));

        const remainingChapters = exam.chapters.filter((c) => !completedChaptersSet.has(c));
        const chaptersToSchedule =
          remainingChapters.length > 0 ? remainingChapters : exam.chapters;

        const rebuilt = buildClientIstAutoPlan(exam.examDate, chaptersToSchedule, completedDates);
        changed = true;
        const nextExam: StudyExam = {
          ...exam,
          planDays: rebuilt,
          lastReplannedAt: todayIst,
          updatedAt: Date.now(),
        };
        if (!UserAccountStore.isGuest()) {
          saveExamToFirestore(nextExam).catch(() => {});
        }
        return nextExam;
      }

      return exam;
    });

    if (changed && forceSave && !UserAccountStore.isGuest()) {
      saveJson(STORAGE_KEYS.EXAMS, updatedExams);
    }
    return updatedExams;
  },

  async syncFromFirestore(): Promise<void> {
    if (UserAccountStore.isGuest() || !auth.currentUser || auth.currentUser.isAnonymous) {
      return;
    }
    try {
      const [remoteExams, remoteCards] = await Promise.all([
        loadExamsFromFirestore(),
        loadRecallCardsFromFirestore(),
      ]);

      if (remoteExams.length > 0) {
        const localExams = loadJson<StudyExam[]>(STORAGE_KEYS.EXAMS, []);
        const map = new Map<string, StudyExam>();
        localExams.forEach((e) => map.set(e.id, e));
        remoteExams.forEach((e) => map.set(e.id, e));
        const merged = Array.from(map.values()).sort((a, b) =>
          String(a.examDate).localeCompare(String(b.examDate))
        );
        saveJson(STORAGE_KEYS.EXAMS, merged);
      }

      if (remoteCards.length > 0) {
        const localCards = loadJson<RecallCard[]>(STORAGE_KEYS.CARDS, []);
        const map = new Map<string, RecallCard>();
        localCards.forEach((c) => map.set(c.id, c));
        remoteCards.forEach((c) => map.set(c.id, c));
        const merged = Array.from(map.values()).sort((a, b) => a.dueAt - b.dueAt);
        saveJson(STORAGE_KEYS.CARDS, merged);
      }

      this.emitUpdate();
    } catch {}
  },

  async addOrUpdateExam(input: {
    id?: string;
    name: string;
    examDate: string;
    subject?: string;
    chapters: string[];
  }): Promise<{ ok: boolean; exam?: StudyExam; error?: string; requiresSignIn?: boolean }> {
    // Rule: Guests can try features but nothing is saved. Any save shows the compact "Sign in to keep this in your Vault" sheet.
    if (UserAccountStore.isGuest()) {
      promptGuestSignInForVault('Sign in to keep this in your Vault');
      return {
        ok: false,
        requiresSignIn: true,
        error: 'Sign in to keep this in your Vault',
      };
    }

    const existingExams = this.getExams();
    const isUpdate = Boolean(input.id && existingExams.some((e) => e.id === input.id));
    const limits = this.getTierLimits();

    if (!isUpdate && existingExams.length >= limits.maxExams) {
      return {
        ok: false,
        error: `Your ${limits.tier.toUpperCase()} tier supports ${limits.maxExams} active exam${limits.maxExams === 1 ? '' : 's'}. Upgrade to Spark or Fire to add more exams and unlock full Auto Plan.`,
      };
    }

    const cleanChapters = input.chapters
      .map((c) => String(c || '').trim())
      .filter(Boolean);
    if (cleanChapters.length === 0) {
      cleanChapters.push('Core Concepts');
    }

    let planDays = buildClientIstAutoPlan(input.examDate, cleanChapters, []);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/study-loop/exams/plan', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: auth.currentUser?.uid || UserAccountStore.getProfile().id,
          userTier: UserAccountStore.getCurrentPlan(),
          existingExamsCount: existingExams.length,
          isUpdate,
          name: input.name,
          examDate: input.examDate,
          chapters: cleanChapters,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData?.error) {
          return { ok: false, error: errData.error };
        }
      } else {
        const data = await res.json();
        if (Array.isArray(data?.planDays) && data.planDays.length > 0) {
          planDays = data.planDays;
        }
      }
    } catch {}

    const examId = input.id || `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const newExam: StudyExam = {
      id: examId,
      userId: auth.currentUser?.uid || UserAccountStore.getProfile().id || 'user',
      name: input.name.trim().slice(0, 120) || 'Upcoming Exam',
      examDate: input.examDate.slice(0, 10),
      subject: (input.subject || 'General Studies').trim().slice(0, 80),
      chapters: cleanChapters,
      planDays,
      lastReplannedAt: toIstDateKey(),
      createdAt: isUpdate
        ? existingExams.find((e) => e.id === examId)?.createdAt || now
        : now,
      updatedAt: now,
    };

    const nextExams = isUpdate
      ? existingExams.map((e) => (e.id === examId ? newExam : e))
      : [...existingExams, newExam];
    nextExams.sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));

    this.saveExamsLocal(nextExams);
    await saveExamToFirestore(newExam);
    UserAccountStore.recordDailyInteraction();
    return { ok: true, exam: newExam };
  },

  async togglePlanDayCompleted(examId: string, dateIst: string): Promise<StudyExam | null> {
    const exams = this.getExams();
    const target = exams.find((e) => e.id === examId);
    if (!target) return null;

    const updatedPlanDays = target.planDays.map((pd) =>
      pd.dateIst === dateIst ? { ...pd, completed: !pd.completed } : pd
    );
    const updatedExam: StudyExam = {
      ...target,
      planDays: updatedPlanDays,
      updatedAt: Date.now(),
    };
    const nextExams = exams.map((e) => (e.id === examId ? updatedExam : e));
    this.saveExamsLocal(nextExams);

    if (!UserAccountStore.isGuest()) {
      await saveExamToFirestore(updatedExam);
    }
    return updatedExam;
  },

  async replanExamNow(examId: string): Promise<StudyExam | null> {
    const exams = this.getExams();
    const target = exams.find((e) => e.id === examId);
    if (!target) return null;

    const completedDates = target.planDays
      .filter((pd) => pd.completed)
      .map((pd) => pd.dateIst);
    const completedChapters = new Set<string>();
    target.planDays
      .filter((pd) => pd.completed && !pd.isFullRevision)
      .forEach((pd) => pd.chapters.forEach((c) => completedChapters.add(c)));

    const remainingChapters = target.chapters.filter((c) => !completedChapters.has(c));
    const chaptersToPlan = remainingChapters.length > 0 ? remainingChapters : target.chapters;

    const newPlanDays = buildClientIstAutoPlan(
      target.examDate,
      chaptersToPlan,
      completedDates
    );
    const updatedExam: StudyExam = {
      ...target,
      planDays: newPlanDays,
      lastReplannedAt: toIstDateKey(),
      updatedAt: Date.now(),
    };
    const nextExams = exams.map((e) => (e.id === examId ? updatedExam : e));
    this.saveExamsLocal(nextExams);

    if (!UserAccountStore.isGuest()) {
      await saveExamToFirestore(updatedExam);
    }
    return updatedExam;
  },

  async deleteExam(examId: string): Promise<void> {
    const exams = this.getExams().filter((e) => e.id !== examId);
    this.saveExamsLocal(exams);
    if (!UserAccountStore.isGuest()) {
      await deleteExamFromFirestore(examId);
    }
  },

  getCards(): RecallCard[] {
    if (UserAccountStore.isGuest()) {
      return guestMemoryState.cards;
    }
    const saved = loadJson<RecallCard[]>(STORAGE_KEYS.CARDS, []);
    if (saved.length > 0) return saved;

    // Also pull any saved study items from KnowledgeVaultStore so existing study notes/flashcards become Recall cards
    try {
      const vaultItems = KnowledgeVaultStore.getItems();
      if (Array.isArray(vaultItems) && vaultItems.length > 0) {
        const converted: RecallCard[] = vaultItems.slice(0, 20).map((it) => ({
          id: `vault_${it.id}`,
          userId: auth.currentUser?.uid || UserAccountStore.getProfile().id || 'user',
          type: 'flashcard',
          front: it.title || 'Core Concept Review',
          back: (it.summary || it.content || '').slice(0, 400),
          subject: it.subject || 'General Studies',
          chapter: it.chapter || 'Core Concepts',
          sourceId: it.id,
          ease: 2.5,
          interval: 0,
          repetitions: 0,
          dueAt: Date.now(),
          wrongCount: 0,
          correctCount: 0,
          createdAt: it.createdAt || Date.now(),
          updatedAt: Date.now(),
        }));
        saveJson(STORAGE_KEYS.CARDS, converted);
        return converted;
      }
    } catch {}

    return [];
  },

  saveCardsLocal(cards: RecallCard[]): void {
    if (UserAccountStore.isGuest()) {
      guestMemoryState.cards = cards;
      this.emitUpdate();
      return;
    }
    saveJson(STORAGE_KEYS.CARDS, cards);
    this.emitUpdate();
  },

  /**
   * Every flashcard and quiz question a user creates or saves becomes a Recall review card in users/{uid}/cards.
   * For guests, shows the compact "Sign in to keep this in your Vault" sheet and saves nothing.
   */
  async addCardsToRecall(
    items: Array<{
      type: 'flashcard' | 'quiz';
      front: string;
      back: string;
      options?: string[];
      correctIndex?: number;
      explanation?: string;
      subject?: string;
      chapter?: string;
      examId?: string;
      sourceId?: string;
      pageOrTimestamp?: string;
    }>,
    options: { silentForGuest?: boolean } = {}
  ): Promise<{ ok: boolean; addedCount: number; requiresSignIn?: boolean }> {
    if (UserAccountStore.isGuest()) {
      if (!options.silentForGuest) {
        promptGuestSignInForVault('Sign in to keep this in your Vault');
      }
      return { ok: false, addedCount: 0, requiresSignIn: true };
    }

    const existing = this.getCards();
    const existingFrontSet = new Set(
      existing.map((c) => c.front.trim().toLowerCase())
    );
    const now = Date.now();
    const uid = auth.currentUser?.uid || UserAccountStore.getProfile().id || 'user';
    const newlyAdded: RecallCard[] = [];

    for (let i = 0; i < items.length; i++) {
      const raw = items[i];
      const cleanFront = String(raw.front || '').trim();
      const cleanBack = String(raw.back || '').trim();
      if (!cleanFront || !cleanBack) continue;
      if (existingFrontSet.has(cleanFront.toLowerCase())) continue;

      existingFrontSet.add(cleanFront.toLowerCase());
      const card: RecallCard = {
        id: `rc_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        userId: uid,
        type: raw.type === 'quiz' ? 'quiz' : 'flashcard',
        front: cleanFront.slice(0, 1500),
        back: cleanBack.slice(0, 3000),
        options: Array.isArray(raw.options) ? raw.options.slice(0, 6) : undefined,
        correctIndex: raw.correctIndex,
        explanation: raw.explanation,
        subject: (raw.subject || 'General Studies').trim().slice(0, 80),
        chapter: (raw.chapter || 'Core Concepts').trim().slice(0, 120),
        examId: raw.examId,
        sourceId: raw.sourceId,
        pageOrTimestamp: raw.pageOrTimestamp,
        ease: 2.5,
        interval: 0,
        repetitions: 0,
        dueAt: now,
        wrongCount: 0,
        correctCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      newlyAdded.push(card);
    }

    if (newlyAdded.length === 0) {
      return { ok: true, addedCount: 0 };
    }

    const merged = [...newlyAdded, ...existing];
    this.saveCardsLocal(merged);

    for (const card of newlyAdded) {
      saveRecallCardToFirestore(card).catch(() => {});
    }

    return { ok: true, addedCount: newlyAdded.length };
  },

  async gradeCard(
    cardId: string,
    grade: RecallGrade
  ): Promise<{
    ok: boolean;
    card?: RecallCard;
    error?: string;
    capReached?: boolean;
  }> {
    const cards = this.getCards();
    const target = cards.find((c) => c.id === cardId);
    if (!target) {
      return { ok: false, error: 'Card not found.' };
    }

    const limits = this.getTierLimits();
    const dailyStats = this.getDailyReviewCount();
    if (!UserAccountStore.isGuest() && dailyStats.reviewedToday >= limits.dailyRecallReviews) {
      return {
        ok: false,
        capReached: true,
        error: `You've reached your ${limits.dailyRecallReviews} daily Recall cards on the ${limits.tier.toUpperCase()} tier for today. Upgrade to Spark or Fire for higher daily Recall limits.`,
      };
    }

    let nextMetrics = computeSm2Local(target, grade, Date.now());

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/study-loop/cards/grade', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: auth.currentUser?.uid || UserAccountStore.getProfile().id || 'guest',
          userTier: UserAccountStore.getCurrentPlan(),
          grade,
          card: {
            ease: target.ease,
            interval: target.interval,
            repetitions: target.repetitions,
            wrongCount: target.wrongCount,
            correctCount: target.correctCount,
          },
        }),
      });
      if (res.status === 429) {
        const errJson = await res.json().catch(() => ({}));
        return {
          ok: false,
          capReached: true,
          error:
            errJson?.error ||
            `Daily Recall review cap (${limits.dailyRecallReviews} cards) reached for your tier.`,
        };
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.cardMetrics) {
          nextMetrics = data.cardMetrics;
        }
      }
    } catch {}

    const updatedCard: RecallCard = {
      ...target,
      ...nextMetrics,
      lastGrade: grade,
      lastReviewedAt: Date.now(),
      updatedAt: Date.now(),
    };

    const nextCards = cards.map((c) => (c.id === cardId ? updatedCard : c));
    this.saveCardsLocal(nextCards);
    this.incrementDailyReviewCount();

    saveRecallCardToFirestore(updatedCard).catch(() => {});
    if (!UserAccountStore.isGuest()) {
      UserAccountStore.recordDailyInteraction();
    }

    return { ok: true, card: updatedCard };
  },

  getCardGrade(idOrFront: string): RecallGrade | undefined {
    const key = String(idOrFront || '').trim();
    if (!key) return undefined;
    const safeId = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    const cards = this.getCards();
    const found = cards.find(
      (c) =>
        c.id === key ||
        c.id === safeId ||
        c.front.trim().toLowerCase() === key.toLowerCase()
    );
    return found?.lastGrade;
  },

  async rateOrUpsertCard(
    item: {
      id?: string;
      type: 'flashcard' | 'quiz';
      front: string;
      back: string;
      options?: string[];
      correctIndex?: number;
      explanation?: string;
      subject?: string;
      chapter?: string;
      sourceId?: string;
      pageOrTimestamp?: string;
    },
    grade: RecallGrade
  ): Promise<{ ok: boolean; card?: RecallCard; error?: string }> {
    const cleanFront = String(item.front || '').trim();
    const cleanBack = String(item.back || 'Answer').trim() || 'Answer';
    if (!cleanFront) {
      return { ok: false, error: 'Missing card prompt.' };
    }

    const cards = this.getCards();
    const rawId = String(item.id || `sm2_${cleanFront.slice(0, 48)}`).replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    ).slice(0, 128);

    const existing = cards.find(
      (c) =>
        c.id === rawId ||
        c.id === item.id ||
        c.front.trim().toLowerCase() === cleanFront.toLowerCase()
    );

    if (existing) {
      return this.gradeCard(existing.id, grade);
    }

    const now = Date.now();
    const uid = auth.currentUser?.uid || UserAccountStore.getProfile().id || 'user';
    const baseCard: RecallCard = {
      id: rawId || `rc_${now}`,
      userId: uid,
      type: item.type === 'quiz' ? 'quiz' : 'flashcard',
      front: cleanFront.slice(0, 1500),
      back: cleanBack.slice(0, 3000),
      options: Array.isArray(item.options) ? item.options.slice(0, 6) : undefined,
      correctIndex: item.correctIndex,
      explanation: item.explanation,
      subject: (item.subject || 'General Studies').trim().slice(0, 80),
      chapter: (item.chapter || 'Core Concepts').trim().slice(0, 120),
      sourceId: item.sourceId,
      pageOrTimestamp: item.pageOrTimestamp,
      ease: 2.5,
      interval: 0,
      repetitions: 0,
      dueAt: now,
      wrongCount: 0,
      correctCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const nextMetrics = computeSm2Local(baseCard, grade, now);
    const updatedCard: RecallCard = {
      ...baseCard,
      ...nextMetrics,
      lastGrade: grade,
      lastReviewedAt: now,
      updatedAt: now,
    };

    const nextCards = [updatedCard, ...cards];
    this.saveCardsLocal(nextCards);
    this.incrementDailyReviewCount();

    saveRecallCardToFirestore(updatedCard).catch(() => {});
    if (!UserAccountStore.isGuest()) {
      UserAccountStore.recordDailyInteraction();
    }

    return { ok: true, card: updatedCard };
  },

  getNearestExamCountdown(): {
    exam: StudyExam;
    daysRemaining: number;
    countdownLabel: string;
  } | null {
    const exams = this.getExams();
    if (exams.length === 0) return null;

    const sorted = [...exams].sort((a, b) =>
      String(a.examDate).localeCompare(String(b.examDate))
    );
    const todayIst = toIstDateKey();
    const upcoming = sorted.find((e) => e.examDate >= todayIst) || sorted[0];
    const daysRemaining = getDaysUntilIstDate(upcoming.examDate);
    const countdownLabel =
      daysRemaining === 0
        ? `${upcoming.name} is today`
        : daysRemaining === 1
        ? `${upcoming.name} in 1 day`
        : `${upcoming.name} in ${daysRemaining} days`;

    return {
      exam: upcoming,
      daysRemaining,
      countdownLabel,
    };
  },

  /**
   * Builds the Daily Revision queue:
   * Mixes due cards, weak topics (most wrong answers), and topics for the nearest exam.
   * Formats "Today: X cards, ~Y min" and shows the nearest exam countdown.
   */
  getDailyRevisionSummary(): DailyRevisionSummary {
    const cards = this.getCards();
    const now = Date.now();
    const nearestExam = this.getNearestExamCountdown();
    const limits = this.getTierLimits();
    const dailyStats = this.getDailyReviewCount();
    const remainingCap = Math.max(0, limits.dailyRecallReviews - dailyStats.reviewedToday);

    const dueCards = cards
      .filter((c) => c.dueAt <= now)
      .sort((a, b) => a.dueAt - b.dueAt);

    const weakCards = cards
      .filter((c) => c.wrongCount > 0)
      .sort((a, b) => b.wrongCount - a.wrongCount);

    const examChaptersSet = new Set(
      (nearestExam?.exam.chapters || []).map((ch) => ch.toLowerCase())
    );
    const nearestExamCards = cards.filter(
      (c) =>
        (nearestExam && c.examId === nearestExam.exam.id) ||
        examChaptersSet.has(c.chapter.toLowerCase()) ||
        (nearestExam?.exam.subject &&
          c.subject.toLowerCase() === nearestExam.exam.subject.toLowerCase())
    );

    // Interleave due cards, weak cards, and nearest-exam cards without duplicates
    const seen = new Set<string>();
    const mixedQueue: RecallCard[] = [];

    const addUnique = (c: RecallCard) => {
      if (!c || seen.has(c.id)) return;
      if (mixedQueue.length >= Math.max(1, remainingCap)) return;
      seen.add(c.id);
      mixedQueue.push(c);
    };

    const maxLen = Math.max(dueCards.length, weakCards.length, nearestExamCards.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < dueCards.length) addUnique(dueCards[i]);
      if (i < weakCards.length) addUnique(weakCards[i]);
      if (i < nearestExamCards.length) addUnique(nearestExamCards[i]);
    }

    // If still fewer than 12 cards and user has upcoming cards, include next due cards for active revision
    if (mixedQueue.length < 12) {
      for (const c of cards) {
        addUnique(c);
        if (mixedQueue.length >= Math.min(12, Math.max(1, remainingCap))) break;
      }
    }

    const totalCardsToday = mixedQueue.length;
    const estimatedMinutes = Math.max(1, Math.round((totalCardsToday * 40) / 60));

    return {
      totalCardsToday,
      estimatedMinutes,
      dueCards,
      weakCards,
      nearestExamCards,
      mixedQueue,
      nearestExam,
    };
  },

  /**
   * Weak spots per chapter: % correct, wrongCount, correctCount, and total cards.
   */
  getWeakSpotsByChapter(): ChapterWeakSpot[] {
    const cards = this.getCards();
    const exams = this.getExams();
    const map = new Map<
      string,
      {
        chapter: string;
        subject: string;
        correctCount: number;
        wrongCount: number;
        cardsCount: number;
      }
    >();

    // Seed chapters from exams so every exam chapter appears in Weak Spots
    for (const ex of exams) {
      for (const ch of ex.chapters) {
        const key = ch.trim().toLowerCase();
        if (!key) continue;
        if (!map.has(key)) {
          map.set(key, {
            chapter: ch.trim(),
            subject: ex.subject || 'General Studies',
            correctCount: 0,
            wrongCount: 0,
            cardsCount: 0,
          });
        }
      }
    }

    for (const c of cards) {
      const ch = (c.chapter || 'Core Concepts').trim();
      const key = ch.toLowerCase();
      const entry = map.get(key) || {
        chapter: ch,
        subject: c.subject || 'General Studies',
        correctCount: 0,
        wrongCount: 0,
        cardsCount: 0,
      };
      entry.correctCount += Math.max(0, Number(c.correctCount || 0));
      entry.wrongCount += Math.max(0, Number(c.wrongCount || 0));
      entry.cardsCount += 1;
      map.set(key, entry);
    }

    const list: ChapterWeakSpot[] = Array.from(map.values()).map((entry) => {
      const totalAttempts = entry.correctCount + entry.wrongCount;
      const percentCorrect =
        totalAttempts > 0
          ? Math.round((entry.correctCount / totalAttempts) * 100)
          : 50;
      return {
        ...entry,
        totalAttempts,
        percentCorrect,
      };
    });

    // Sort weakest (% correct ascending, wrongCount descending) first
    list.sort((a, b) => {
      if (a.percentCorrect !== b.percentCorrect) return a.percentCorrect - b.percentCorrect;
      return b.wrongCount - a.wrongCount;
    });

    return list;
  },

  /**
   * Generates 5 new practice questions on a specific weak chapter with timeout and friendly error.
   */
  async generateWeakChapterPractice(
    chapter: string,
    subject = 'General Studies',
    examName = ''
  ): Promise<{
    ok: boolean;
    questions?: Array<{
      id: string;
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
      chapter: string;
      subject: string;
    }>;
    error?: string;
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 32000);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/study-loop/weak-spots/practice', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          userId: auth.currentUser?.uid || UserAccountStore.getProfile().id || 'guest',
          userTier: UserAccountStore.getCurrentPlan(),
          chapter,
          subject,
          examName,
        }),
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !Array.isArray(data.questions) || data.questions.length === 0) {
        return {
          ok: false,
          error:
            data?.message ||
            data?.error ||
            'Could not generate practice questions right now. Tap Retry to try again.',
        };
      }

      const questions = data.questions;
      // If signed in, also add these 5 questions into Recall cards automatically
      if (!UserAccountStore.isGuest() && questions.length > 0) {
        await this.addCardsToRecall(
          questions.map((q: any) => ({
            type: 'quiz' as const,
            front: q.question,
            back: q.options?.[q.correctIndex] || q.explanation,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            subject: q.subject || subject,
            chapter: q.chapter || chapter,
          })),
          { silentForGuest: true }
        );
      }

      return { ok: true, questions };
    } catch {
      clearTimeout(timer);
      return {
        ok: false,
        error: 'Practice question generation timed out. Tap Retry to generate your 5 drill questions.',
      };
    }
  },

  /**
   * Phase B: Upload Anything (PDF, Image, Pasted Text) with SHA-256 deduplication and page citations.
   */
  async uploadAndSynthesizeStudyPack(input: {
    type: 'pdf' | 'image' | 'text';
    title: string;
    fileHash: string;
    pageCount?: number;
    pagesText?: Array<{ page: number; text: string }>;
    rawText?: string;
    imageDataUrl?: string;
  }): Promise<{
    ok: boolean;
    deduplicated?: boolean;
    studyPack?: UploadedStudyPack;
    error?: string;
  }> {
    // Check client-side hash cache first
    const cachedMap = loadJson<Record<string, UploadedStudyPack>>(
      STORAGE_KEYS.UPLOAD_PACKS_CACHE,
      {}
    );
    if (input.fileHash && cachedMap[input.fileHash]) {
      return {
        ok: true,
        deduplicated: true,
        studyPack: { ...cachedMap[input.fileHash], deduplicated: true },
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/study/upload', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          userId: auth.currentUser?.uid || UserAccountStore.getProfile().id || 'guest',
          userTier: UserAccountStore.getCurrentPlan(),
          ...input,
        }),
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.studyPack) {
        return {
          ok: false,
          error:
            data?.message ||
            data?.error ||
            'Could not process this study upload right now. Please tap Retry.',
        };
      }

      const pack: UploadedStudyPack = {
        ...data.studyPack,
        deduplicated: Boolean(data.deduplicated),
      };

      if (input.fileHash) {
        cachedMap[input.fileHash] = pack;
        saveJson(STORAGE_KEYS.UPLOAD_PACKS_CACHE, cachedMap);
      }

      return {
        ok: true,
        deduplicated: Boolean(data.deduplicated),
        studyPack: pack,
      };
    } catch {
      clearTimeout(timer);
      return {
        ok: false,
        error: 'Upload analysis timed out. Please tap Retry to process your material.',
      };
    }
  },

  /**
   * Phase B: Snap & Solve (Photo of one question -> step-by-step solution, concept behind it, 1 similar practice question).
   */
  async runSnapAndSolve(input: {
    imageDataUrl?: string;
    questionText?: string;
    language?: StudyLanguage;
  }): Promise<{
    ok: boolean;
    result?: SnapSolveResult;
    error?: string;
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 16000);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/study/snap-solve', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          userId: auth.currentUser?.uid || UserAccountStore.getProfile().id || 'guest',
          userTier: UserAccountStore.getCurrentPlan(),
          text: input.questionText,
          image: input.imageDataUrl,
          imageDataUrl: input.imageDataUrl,
          questionText: input.questionText,
          language: input.language || UserAccountStore.getPreferredStudyLanguage(),
        }),
      });
      clearTimeout(timer);

      const data = (await res.json().catch(() => ({}))) as SnapSolveApiResponse;
      const validSteps = Array.isArray(data?.steps)
        ? data.steps.map((s) => String(s).trim()).filter(Boolean)
        : [];
      const validAnswer = String(data?.answer || data?.finalAnswer || '').trim();

      if (!res.ok || validSteps.length === 0 || !validAnswer) {
        return {
          ok: false,
          error:
            data?.message ||
            data?.error ||
            'Snap & Solve could not analyze the question right now. Please tap Retry.',
        };
      }

      return {
        ok: true,
        result: {
          questionExtracted: data.questionExtracted || input.questionText || 'Problem Solution',
          steps: validSteps,
          answer: validAnswer,
          finalAnswer: validAnswer,
          conceptBehindIt: data.conceptBehindIt,
          similarPracticeQuestion: data.similarPracticeQuestion,
          confidence: data.confidence || 'high',
          checkWithTextbook: Boolean(data.checkWithTextbook),
        },
      };
    } catch {
      clearTimeout(timer);
      return {
        ok: false,
        error: 'Snap & Solve timed out. Tap Retry to solve this question.',
      };
    }
  },

  /**
   * Phase C: Fetch Audio Recap script & metadata (cached per item).
   */
  async fetchAudioRecap(input: {
    itemId: string;
    title: string;
    summaryText: string;
    language?: StudyLanguage;
  }): Promise<{
    ok: boolean;
    script?: string;
    isPreview?: boolean;
    maxDurationSeconds?: number;
    estimatedDurationSeconds?: number;
    error?: string;
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/study/audio-recap', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          userId: auth.currentUser?.uid || UserAccountStore.getProfile().id || 'guest',
          userTier: UserAccountStore.getCurrentPlan(),
          itemId: input.itemId,
          title: input.title,
          summaryText: input.summaryText,
          language: input.language || UserAccountStore.getPreferredStudyLanguage(),
        }),
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        return {
          ok: false,
          error: data?.error || 'Could not prepare Audio Recap. Tap Retry.',
        };
      }

      return {
        ok: true,
        script: data.script,
        isPreview: Boolean(data.isPreview),
        maxDurationSeconds: Number(data.maxDurationSeconds || 30),
        estimatedDurationSeconds: Number(data.estimatedDurationSeconds || 30),
      };
    } catch {
      clearTimeout(timer);
      return {
        ok: false,
        error: 'Audio Recap request timed out. Tap Retry.',
      };
    }
  },

  /**
   * Phase D: Explain in Telugu / Hindi (keeping technical terms in English).
   */
  async explainInLanguage(
    text: string,
    targetLanguage: StudyLanguage
  ): Promise<{
    ok: boolean;
    explainedText?: string;
    error?: string;
  }> {
    if (targetLanguage === 'English') {
      return { ok: true, explainedText: text };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/study/translate-explain', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          text,
          targetLanguage,
        }),
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.explainedText) {
        return {
          ok: false,
          error:
            data?.error ||
            `Could not generate ${targetLanguage} explanation right now. Tap Retry.`,
        };
      }

      return {
        ok: true,
        explainedText: data.explainedText,
      };
    } catch {
      clearTimeout(timer);
      return {
        ok: false,
        error: `${targetLanguage} explanation timed out. Tap Retry.`,
      };
    }
  },
};

// ============================================================================
// PHASE C: ANDROID CHROME BACKGROUND AUDIO RECAP PLAYER (<audio> + MediaSession)
// ============================================================================
const cachedRecapAudioUrls = new Map<string, string>();
let persistentRecapAudio: HTMLAudioElement | null = null;
let previewStopTimer: ReturnType<typeof setTimeout> | null = null;

function getOrCreatePersistentAudioElement(): HTMLAudioElement {
  if (persistentRecapAudio) return persistentRecapAudio;
  const audio = document.createElement('audio');
  audio.id = 'kinich-background-recap-audio';
  audio.preload = 'auto';
  audio.style.display = 'none';
  document.body.appendChild(audio);
  persistentRecapAudio = audio;
  return audio;
}

export async function startBackgroundAudioRecap(options: {
  itemId: string;
  title: string;
  script: string;
  language: StudyLanguage;
  isPreview: boolean;
  maxDurationSeconds: number;
  onStateChange?: (state: 'loading' | 'playing' | 'paused' | 'ended' | 'error', info?: string) => void;
}): Promise<void> {
  stopBackgroundAudioRecap();
  options.onStateChange?.('loading');

  const cacheKey = `${options.itemId}:${options.language}:${options.isPreview ? 'preview' : 'full'}`;
  let audioUrl = cachedRecapAudioUrls.get(cacheKey) || '';

  if (!audioUrl) {
    try {
      const headers = await getAuthHeaders();
      const matchedLang = SUPPORTED_STUDY_LANGUAGES.find(
        (l) => l.id.toLowerCase() === String(options.language || 'English').toLowerCase()
      );
      const ttsLang = matchedLang ? matchedLang.id.toLowerCase() : 'english';
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: options.script.slice(0, 1800),
          language: ttsLang,
          gender: 'female',
          speed: 1,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 100) {
          audioUrl = URL.createObjectURL(blob);
          cachedRecapAudioUrls.set(cacheKey, audioUrl);
        }
      }
    } catch {}
  }

  const audio = getOrCreatePersistentAudioElement();

  // Configure Android Chrome MediaSession metadata & lock-screen controls
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: options.isPreview ? `${options.title} (30s Preview)` : options.title,
        artist: 'Kinich Study Audio Recap',
        album: `Revision (${options.language})`,
      });
      navigator.mediaSession.setActionHandler('play', () => {
        audio.play().catch(() => {});
        options.onStateChange?.('playing');
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
        options.onStateChange?.('paused');
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        audio.currentTime = Math.max(0, audio.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        audio.currentTime = Math.min(audio.duration || 300, audio.currentTime + 10);
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        stopBackgroundAudioRecap();
        options.onStateChange?.('ended');
      });
    } catch {}
  }

  if (audioUrl) {
    audio.src = audioUrl;
    audio.currentTime = 0;
    audio.onplay = () => {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'playing';
        } catch {}
      }
      options.onStateChange?.('playing');
    };
    audio.onpause = () => {
      if (!audio.ended) {
        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.playbackState = 'paused';
          } catch {}
        }
        options.onStateChange?.('paused');
      }
    };
    audio.onended = () => {
      if (previewStopTimer) clearTimeout(previewStopTimer);
      options.onStateChange?.('ended');
    };

    try {
      await audio.play();
      if (options.isPreview) {
        previewStopTimer = setTimeout(() => {
          audio.pause();
          options.onStateChange?.('ended', '30-second Free tier preview completed.');
        }, options.maxDurationSeconds * 1000);
      }
      return;
    } catch {}
  }

  // Fallback to SpeechSynthesis if /api/tts audio stream was unavailable
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(options.script);
    const matchedSpeechLang = SUPPORTED_STUDY_LANGUAGES.find(
      (l) => l.id.toLowerCase() === String(options.language || 'English').toLowerCase()
    );
    utter.lang = matchedSpeechLang?.bcp47 || 'en-IN';
    utter.onstart = () => options.onStateChange?.('playing');
    utter.onend = () => options.onStateChange?.('ended');
    utter.onerror = () => options.onStateChange?.('ended');
    window.speechSynthesis.speak(utter);
    if (options.isPreview) {
      previewStopTimer = setTimeout(() => {
        window.speechSynthesis.cancel();
        options.onStateChange?.('ended', '30-second Free tier preview completed.');
      }, options.maxDurationSeconds * 1000);
    }
  } else {
    options.onStateChange?.('error', 'Audio playback is not supported on this browser.');
  }
}

export function stopBackgroundAudioRecap(): void {
  if (previewStopTimer) {
    clearTimeout(previewStopTimer);
    previewStopTimer = null;
  }
  if (persistentRecapAudio) {
    try {
      persistentRecapAudio.pause();
      persistentRecapAudio.currentTime = 0;
    } catch {}
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}
