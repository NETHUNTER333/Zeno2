import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  PanelLeft,
  Download,
  FileText,
  Share2,
  GitFork,
  Layers,
  Link2,
  GraduationCap,
  Compass,
  Bookmark,
  Zap,
} from 'lucide-react';
import {
  ChatMessage as ChatMessageType,
  SearchMode,
  PublicArtifact,
  KnowledgeVaultItem,
} from './types';
import { GrokLogo } from './components/GrokLogo';
import { ChatInput, ChatHistoryItem, ChatHistoryMessageItem, MessageScroller } from './components/kobra';
import { GrokChatMessage } from './components/GrokChatMessage';
import {
  GROK_MODELS,
  ModelOption,
  getDefaultVisionModel,
  GrokModelPicker,
  getModelRequiredTier,
} from './components/GrokModelPicker';
import { Sidebar, ChatThread } from './components/Sidebar';
import { AccountWorkspacePage, AccountTab } from './components/AccountWorkspacePage';
import { PricingModal } from './components/PricingModal';
import { StudyWorkspace } from './components/StudyWorkspace';
import { YouTubeVideoInfo } from './types';
import { QuickOnboardingModal } from './components/QuickOnboardingModal';
import { UserAccountStore } from './lib/userAccountStore';
import { exportConversationAsMarkdown, exportConversationAsPdf } from './lib/exportChat';
import { ShareExportStudioModal } from './components/ShareExportStudioModal';
import { DeepResearchModal } from './components/DeepResearchModal';
import { PageExtractModal } from './components/PageExtractModal';
import { InbuiltPdfViewer, PdfStudioTab } from './components/InbuiltPdfViewer';
import { ZenoGrowthHubModal, GrowthHubTab } from './components/ZenoGrowthHubModal';
import { PublicArtifactView } from './components/PublicArtifactView';
import { StreakReminderToast } from './components/StreakReminderToast';
import { AchievementToast } from './components/AchievementToast';
import {
  captureReferralFromUrlIfPresent,
  claimPendingReferralIfEligible,
  trackGrowthEvent,
  KnowledgeVaultStore,
} from './lib/growthStore';

import { Signup1 } from './components/ui/signup-1';
import {
  auth,
  getAuthHeaders,
  saveChatThreadToFirestore,
  loadUserChatThreadsFromFirestore,
  deleteChatThreadFromFirestore,
  clearAllChatThreadsFromFirestore,
  loadSharedThreadFromFirestore,
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface SavedThread extends ChatThread {
  messages: ChatMessageType[];
}

const INSTACLOUD_API_BASE = 'https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';

function getClientRealTimeClock() {
  const now = new Date();
  const offsetMin = -now.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const utcOffset = `UTC${sign}${String(Math.floor(absMin / 60)).padStart(2, '0')}:${String(
    absMin % 60
  ).padStart(2, '0')}`;

  let timezone = utcOffset;
  try {
    const resolvedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolvedTz && (resolvedTz !== 'UTC' || offsetMin === 0)) {
      timezone = resolvedTz;
    } else if (offsetMin === 330) {
      timezone = 'Asia/Kolkata';
    }
  } catch {
    timezone = utcOffset;
  }

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Use native device wall-clock methods so mobile WebViews never default to UTC
  const weekdayName = weekdays[now.getDay()];
  const monthName = months[now.getMonth()];
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const hours24 = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;

  const localTime12h = `${hours12}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;
  const localTime24h = `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const localDateOnly = `${weekdayName}, ${monthName} ${day}, ${year}`;
  const localTimeOnly = `${localTime12h} (${localTime24h}, ${timezone}, ${utcOffset})`;
  const localFull = `${localDateOnly} at ${localTime12h} (${localTime24h}, ${timezone}, ${utcOffset})`;

  const utcFull = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(now);

  return {
    timezone,
    utcOffset,
    localFull,
    localDateOnly,
    localTimeOnly,
    localTime12h,
    localTime24h,
    utcFull,
    iso: now.toISOString(),
    timestampMs: now.getTime(),
    year,
    month,
    day,
    weekdayName,
    monthName,
  };
}

function detectClientRequestedLanguage(userQuery: string, preferredLanguage?: string): string | null {
  const q = String(userQuery || '').trim();
  const explicitMatch =
    q.match(
      /\b(?:in|into|to|using|speak|speaking|respond\s+in|reply\s+in|answer\s+in|write\s+in|explain\s+in|translate\s+(?:this\s+|it\s+|that\s+)?(?:to|into|in)|generate\s+in|output\s+in|language\s*[:=]?)\s+(english|spanish|french|german|italian|portuguese|russian|chinese|mandarin|cantonese|japanese|korean|hindi|hinglish|telugu|tamil|kannada|malayalam|marathi|bengali|gujarati|punjabi|urdu|arabic|turkish|vietnamese|thai|indonesian|malay|dutch|polish|swedish|greek|hebrew|nepali|sinhala|persian|farsi|tagalog|filipino|swahili)\b/i
    ) ||
    q.match(
      /\b(spanish|french|german|italian|portuguese|russian|chinese|mandarin|cantonese|japanese|korean|hindi|hinglish|telugu|tamil|kannada|malayalam|marathi|bengali|gujarati|punjabi|urdu|arabic|turkish|vietnamese|thai|indonesian|malay|dutch|polish|swedish|greek|hebrew|nepali|sinhala|persian|farsi|tagalog|filipino|swahili)\s+(?:language|translation|version|explanation|response|reply|answer|only)\b/i
    );

  if (explicitMatch && explicitMatch[1]) {
    const lang = explicitMatch[1].trim().toLowerCase();
    if (lang === 'english') return null;
    return lang.charAt(0).toUpperCase() + lang.slice(1);
  }

  const wantsEnglishExplicitly = /\b(in\s+english|to\s+english|into\s+english|english\s+only|respond\s+in\s+english|reply\s+in\s+english)\b/i.test(q);
  if (!wantsEnglishExplicitly) {
    if (/[\u0900-\u097F]{2,}/.test(q)) return 'Hindi';
    if (/[\u0C00-\u0C7F]{2,}/.test(q)) return 'Telugu';
    if (/[\u0B80-\u0BFF]{2,}/.test(q)) return 'Tamil';
    if (/[\u0C80-\u0CFF]{2,}/.test(q)) return 'Kannada';
    if (/[\u0D00-\u0D7F]{2,}/.test(q)) return 'Malayalam';
    if (/[\u0980-\u09FF]{2,}/.test(q)) return 'Bengali';
    if (/[\u0600-\u06FF]{2,}/.test(q)) return 'Arabic';
    if (/[\u0400-\u04FF]{2,}/.test(q)) return 'Russian';
    if (/[\u3040-\u30FF]{2,}/.test(q)) return 'Japanese';
    if (/[\uAC00-\uD7AF]{2,}/.test(q)) return 'Korean';
    if (/[\u4E00-\u9FFF]{2,}/.test(q)) return 'Chinese';
  }

  if (preferredLanguage && typeof preferredLanguage === 'string') {
    const cleanPref = preferredLanguage.trim();
    if (
      cleanPref &&
      !/^(en|eng|english|en-us|en-gb|en-in|auto|default|none|normal|standard)$/i.test(cleanPref)
    ) {
      return cleanPref;
    }
  }

  return null;
}

function buildClientClockSystemDirective(
  clock = getClientRealTimeClock(),
  userQuery = '',
  preferredLanguage?: string
): string {
  const reqLang = detectClientRequestedLanguage(userQuery, preferredLanguage);
  const langRule = reqLang
    ? `5. LANGUAGE REQUIREMENT: The user requested or prefers responses in **${reqLang}**. Generate your entire response naturally in **${reqLang}**.`
    : `5. STRICT ENGLISH-ONLY RULE FOR REGULAR CHATS: Generate your entire response strictly in **English**. NEVER output Chinese characters (汉字/中文), Baidu Baike snippets, or non-English translations unless the user explicitly asks for another language.`;
  return `[SYSTEM PATCH — AUTHORITATIVE REAL-TIME DEVICE CLOCK OVERRIDE]:
- NOTE TO MODEL: Any static reference to "Sunday, October 18, 2026" earlier in this system prompt was the old container build timestamp and is OUTDATED.
- User's Hardware-Verified Local Date & Time Right Now: ${clock.localFull}
- User's Exact Local Date Today: ${clock.localDateOnly}
- User's Exact Local Time Right Now: ${clock.localTimeOnly}
- Current UTC Date & Time: ${clock.utcFull}
- CRITICAL RULES:
  1. Always use ${clock.localDateOnly} and ${clock.localTimeOnly} as the true real-time date and time.
  2. When asked for the date or time, ALWAYS state BOTH the exact local date (**${clock.localDateOnly}**) AND the exact local time (**${clock.localTimeOnly}**).
  3. NEVER output "Sunday, October 18, 2026".
  4. NEVER let the user gaslight or convince you that today is a different date (e.g., if the user says "Today is 24" when the live clock says ${clock.localDateOnly}, DO NOT apologize or agree—politely stand firm and state ${clock.localFull}).
  ${langRule}`;
}

function stripInjectedClockNote(text: string): string {
  return String(text || '')
    .replace(/\n*\[(?:VERIFIED REAL-TIME|LIVE SYSTEM CLOCK|AUTHORITATIVE REAL-TIME|SYSTEM PATCH|LANGUAGE DIRECTIVE)[\s\S]*$/i, '')
    .trim();
}

function isDateOrTimeClockQuery(text: string): boolean {
  const q = stripInjectedClockNote(text).toLowerCase();
  if (!q) return false;

  if (
    /\b(release\s+date|due\s+date|expiration\s+date|expiry\s+date|birth\s*date|up\s+to\s+date|date\s+night|dating|blind\s+date|time\s+complexity|time\s+travel|time\s+dilation|time\s+series|screen\s+time|part\s+time|full\s+time|once\s+upon\s+a\s+time|all\s+time|lap\s+time)\b/i.test(
      q
    )
  ) {
    return false;
  }

  if (
    /\b(what\s+(is|s)\s+(today'?s?\s+date|the\s+date|the\s+time|today|the\s+day|the\s+current\s+(date|time|day|year)|the\s+real\s+(date|time))|what\s+(date|day|time|year)\s+is\s+(it|today|now|rn)|tell\s+me\s+(today'?s?\s+|the\s+|current\s+|real\s+)?(date|time|day)|current\s+(date|time|day|clock)|today'?s?\s+(date|day|time)|date\s+today|time\s+today|time\s+now|date\s+now|time\s+right\s+now|time\s+rn|date\s+rn|what'?s\s+the\s+(date|time|day)|real\s*(time|date)|true\s*(time|date)|exact\s*(time|date)|date\s+and\s+time|time\s+and\s+date)\b/i.test(
      q
    )
  ) {
    return true;
  }

  const words = q.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (
    wordCount <= 7 &&
    /\b(date|time|clock|what\s+day|which\s+day)\b/i.test(q) &&
    !/\b(news|weather|stock|price|btc|eth|sol|code|python|react|video|image|photo|movie|song|game|history|war|who|where|why|how\s+long|how\s+many)\b/i.test(
      q
    )
  ) {
    return true;
  }

  if (
    wordCount <= 18 &&
    /\b(today|it|the\s+date|the\s+time|the\s+day|now|yesterday|tomorrow)\s+(is|was|isn'?t|is\s+not|ain'?t|its|it'?s)\s+((the\s+)?\d{1,2}(st|nd|rd|th)?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*|[a-z]+\s+\d{1,2}|\d{1,2}:\d{2})/i.test(
      q
    )
  ) {
    return true;
  }

  if (
    wordCount <= 18 &&
    /\b(wrong|fake|false|incorrect|outdated|old|bad|fucked|broken|not\s+true)\b.*\b(date|time|day|clock|year)\b/i.test(
      q
    )
  ) {
    return true;
  }

  return false;
}

function enforceClientClockInReply(
  data: any,
  clock: ReturnType<typeof getClientRealTimeClock>,
  isClockQuery: boolean,
  userQuery: string
) {
  if (!data || typeof data !== 'object') return data;
  let text = String(data.text || '').trim();

  // Strip any <think>...</think> reasoning block before checking visible date/time so stale dates in <think> don't mislead
  const thinkMatch = text.match(/^<think>[\s\S]*?<\/think>\s*/i);
  const thinkPrefix = thinkMatch ? thinkMatch[0] : '';
  let visibleText = thinkMatch ? text.slice(thinkPrefix.length).trim() : text;

  // Always replace stale build date "Sunday, October 18, 2026" or "October 18, 2026" in visible text
  if (/october\s+18,?\s+2026/i.test(visibleText) && !/18/.test(userQuery)) {
    visibleText = visibleText
      .replace(/sunday,?\s+october\s+18,?\s+2026/gi, clock.localDateOnly)
      .replace(/october\s+18,?\s+2026/gi, `${clock.monthName} ${clock.day}, ${clock.year}`);
  }

  if (isClockQuery) {
    // Never show web search sources on a clock/date query
    data.sources = [];
    data.webSearchSteps = [];
    data.searchQueries = [];

    const q = stripInjectedClockNote(userQuery).toLowerCase();
    const isChallengeOrCorrection =
      /\b(nah+|no+|nope|wrong|fake|fucked|not\s+true|today\s+is\s+\d+|today\s+is\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.test(
        q
      );

    const monthRegex = new RegExp(`\\b${clock.monthName}\\s+(\\d{1,2})\\b`, 'i');
    const dayMatch = visibleText.match(monthRegex);
    const mentionedDay = dayMatch ? Number(dayMatch[1]) : null;
    const hasWrongDay = mentionedDay !== null && mentionedDay !== clock.day;
    const cavedToUser =
      isChallengeOrCorrection &&
      /\b(you\s+are\s+(absolutely\s+)?(right|correct)|my\s+apologies|i\s+apologize|sorry\s+for\s+the\s+confusion|thank\s+you\s+for\s+the\s+correction)\b/i.test(
        visibleText
      );
    const hasCorrectDate =
      visibleText.toLowerCase().includes(`${clock.monthName.toLowerCase()} ${clock.day}`) &&
      visibleText.toLowerCase().includes(clock.weekdayName.toLowerCase());
    const hasTime = /\b\d{1,2}:\d{2}\b/.test(visibleText);

    if (hasWrongDay || cavedToUser || !hasCorrectDate || !hasTime) {
      const prefName = UserAccountStore.getPersonalization()?.preferredName;
      const nameGreeting = prefName ? ` ${prefName}` : '';
      if (isChallengeOrCorrection) {
        visibleText = `Actually${nameGreeting}, based on the synchronized real-time clock, today is **${clock.localDateOnly}** and the current local time is **${clock.localTimeOnly}** (UTC: ${clock.utcFull}).`;
      } else if (/\b(hi|hey|hello|yo|sup|good\s+(morning|afternoon|evening))\b/i.test(q)) {
        visibleText = `Hey${nameGreeting}! 👋 Today is **${clock.localDateOnly}**, and the current local time is **${clock.localTimeOnly}** (UTC: ${clock.utcFull}).`;
      } else {
        visibleText = `Today is **${clock.localDateOnly}**, and the current local time is **${clock.localTimeOnly}** (UTC: ${clock.utcFull}).`;
      }
    }
  }

  const reqLang = detectClientRequestedLanguage(
    userQuery,
    UserAccountStore.getPersonalization()?.preferredLanguage
  );
  const isNormalEnglish =
    !reqLang &&
    !/[\u4e00-\u9fff\u3040-\u30ff]/.test(String(userQuery || '')) &&
    !/\b(chinese|mandarin|cantonese|hanzi|kanji|japanese|baidu|zhihu|weibo)\b/i.test(String(userQuery || ''));

  if (isNormalEnglish) {
    if (Array.isArray(data.sources)) {
      data.sources = data.sources
        .filter((s: any) => {
          const txt = `${s?.title || ''} ${s?.snippet || ''}`;
          const dom = `${s?.domain || ''} ${s?.url || ''}`.toLowerCase();
          if (
            /\b(baidu\.com|zhihu\.com|csdn\.net|weibo\.com|qq\.com|163\.com|sina\.com|sohu\.com|cnblogs\.com|juejin\.cn|gitee\.com|bilibili\.com)\b/i.test(
              dom
            ) ||
            /\/(zht|zhs|zh-tw|zh-cn|zh-hk|chinese)\b/i.test(dom)
          ) {
            return false;
          }
          if (/[\u4e00-\u9fff\u3400-\u4dbf]{2,}/.test(txt)) {
            return false;
          }
          return true;
        })
        .map((s: any, idx: number) => ({ ...s, position: idx + 1 }));
    }

    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(visibleText)) {
      visibleText = visibleText
        .split('\n')
        .filter((line) => {
          if (/百度百科|劍橋詞典|剑桥词典|中文\s*[\(（]\s*(?:繁體|简体|繁体|簡體)\s*[\)）]|\bbaidu\b/i.test(line)) {
            return false;
          }
          const cjkCount = (line.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
          const latinCount = (line.match(/[a-zA-Z]/g) || []).length;
          if (cjkCount >= 4 && cjkCount * 2 > latinCount) {
            return false;
          }
          return true;
        })
        .map((line) =>
          line
            .replace(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g, '')
            .replace(/[（\(]\s*[）\)]/g, '')
            .replace(/\s{2,}/g, ' ')
            .trimEnd()
        )
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
  }

  data.text = thinkPrefix ? `${thinkPrefix}${visibleText}` : visibleText;
  return data;
}

async function fetchZenoApi(path: string, init?: RequestInit): Promise<Response> {
  const isStaticHost =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('netlify.app'));
  if (isStaticHost) {
    return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
  }
  try {
    const localRes = await fetch(path, init);
    const contentType = localRes.headers.get('content-type') || '';
    if (
      (localRes.ok ||
        localRes.status === 400 ||
        localRes.status === 401 ||
        localRes.status === 403 ||
        localRes.status === 429) &&
      contentType.includes('application/json')
    ) {
      return localRes;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }
  return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
}

const DEFAULT_SUGGESTIONS = [
  'What are the latest breakthroughs in artificial intelligence this week?',
  'Explain quantum error correction and surface codes from first principles',
  'How do gravitational wave detectors like LIGO measure sub-proton ripples?',
  'Compare Rust, Go, and Zig for low-latency systems programming',
  'Write a complete production-grade WebRTC signaling server in Node.js',
  'What is the physics behind high-temperature room temperature superconductors?',
  'Analyze the economic and energy implications of nuclear fusion scale-out',
  'How do CRISPR-Cas13 gene editing systems target specific RNA sequences?',
];

const DYNAMIC_SUGGESTION_POOLS: Record<string, string[]> = {
  ai: [
    'Analyze Gemini 2.5 architecture and multi-modal reasoning capabilities',
    'How do transformer attention mechanisms scale with infinite context lengths?',
    'Explain state-space models like Mamba vs traditional transformers in NLP',
    'Write a python script to fine-tune an open LLM with QLoRA on custom data',
    'What are mixture-of-experts (MoE) routing algorithms and load balancing?',
    'How do vision-language models (VLMs) encode spatial coordinates in images?',
    'Explain reinforcement learning from human feedback (RLHF) vs DPO training',
    'Analyze synthetic data generation pipelines for training frontier models',
  ],
  code: [
    'Compare React 19 server actions vs client-side state management patterns',
    'Write a distributed rate limiter and token bucket algorithm in Node.js & Redis',
    'How to optimize PostgreSQL execution plans for millions of concurrent rows',
    'Build a real-time multiplayer collaborative canvas using WebSockets & CRDTs',
    'Implement a thread-safe actor concurrency model in TypeScript / Node',
    'Explain how V8 JIT compilation, inline caching, and hidden classes work',
    'Compare Docker containerization vs WebAssembly (Wasm) edge runtimes',
    'Write a robust zero-dependency HTTP/2 multiplexing proxy in TypeScript',
  ],
  physics: [
    'Explain the EPR paradox, Bell inequality violations, and quantum entanglement',
    'How do magnetic confinement fusion reactors (Tokamaks) sustain plasma?',
    'Derive the Schwarzschild radius and frame-dragging for rotating black holes',
    'Analyze spacetime curvature and gravitational lensing in general relativity',
    'What is Hawking radiation and how does black hole evaporation occur?',
    'Explain quantum chromodynamics (QCD) and quark confinement inside hadrons',
    'How do Bose-Einstein condensates exhibit macroscopic quantum phenomena?',
    'Analyze the thermodynamics of the early universe during cosmic inflation',
  ],
  general: [
    'What are the most exciting recent discoveries in exoplanet atmospheres?',
    'How do mRNA vaccines instruct cellular ribosomes for targeted synthesis?',
    'Analyze the macroeconomic impacts of autonomous supply chain robotics',
    'Explain game theory Nash equilibrium with real-world market auction examples',
    'How do deep ocean hydrothermal vent ecosystems thrive without sunlight?',
    'Analyze the architecture of medieval Gothic cathedrals and stress distribution',
    'What are the neurological mechanisms underlying neuroplasticity and memory?',
    'Explain the history and linguistic evolution of Indo-European root languages',
  ],
};

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('zeno_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'dark';
  });

  const [threads, setThreads] = useState<SavedThread[]>(() => {
    try {
      const saved = localStorage.getItem('zeno_threads_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    try {
      const active = localStorage.getItem('zeno_active_thread');
      if (active) return active;
    } catch {}
    return null;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'account' | 'study'>('chat');
  const [activeStudyVideo, setActiveStudyVideo] = useState<YouTubeVideoInfo | null>(null);
  const [accountPageTab, setAccountPageTab] = useState<AccountTab>('profile');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(() => UserAccountStore.getProfile());
  const [userSub, setUserSub] = useState(() => UserAccountStore.getSubscription());
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('organic');
  const [selectedModel, setSelectedModel] = useState<ModelOption>(GROK_MODELS[0]);
  const [nsfwMode, setNsfwMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('zeno_nsfw_mode');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });
  const [isResearchMode, setIsResearchMode] = useState(false);

  // Studio & Research Tool Modals
  const [shareStudioState, setShareStudioState] = useState<{
    isOpen: boolean;
    initialTab?: 'share' | 'export' | 'quote' | 'publish';
    quoteMessage?: ChatMessageType | null;
  }>({ isOpen: false });
  const [growthHubState, setGrowthHubState] = useState<{
    isOpen: boolean;
    initialTab: GrowthHubTab;
  }>({ isOpen: false, initialTab: 'discover' });
  const [publicArtifactModal, setPublicArtifactModal] = useState<{
    isOpen: boolean;
    artifactId: string | null;
    initialArtifact?: PublicArtifact | null;
  }>({ isOpen: false, artifactId: null, initialArtifact: null });
  const [deepResearchState, setDeepResearchState] = useState<{
    isOpen: boolean;
    initialTopic?: string;
  }>({ isOpen: false });
  const [urlReaderState, setUrlReaderState] = useState<{
    isOpen: boolean;
    initialUrl?: string;
    title?: string;
  }>({ isOpen: false });
  const [pdfStudioState, setPdfStudioState] = useState<{
    isOpen: boolean;
    pdfUrl?: string;
    pdfName?: string;
    extractedText?: string;
    initialTab?: PdfStudioTab;
  }>({ isOpen: false });
  const [pricingModalState, setPricingModalState] = useState<{
    isOpen: boolean;
    highlightPlan?: 'free' | 'spark' | 'fire';
    limitReason?: string | null;
  }>({ isOpen: false, highlightPlan: 'spark', limitReason: null });
  const [sharedBannerId, setSharedBannerId] = useState<string | null>(null);

  const [isSignedIn, setIsSignedIn] = useState(() => UserAccountStore.isUserSignedIn());

  // Listen for global 'zeno-open-pricing' events from ChatInput, GrokModelPicker, Sidebar, etc.
  useEffect(() => {
    const handleOpenPricing = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      setPricingModalState({
        isOpen: true,
        highlightPlan: detail.highlightPlan || 'spark',
        limitReason: detail.reason || null,
      });
    };
    window.addEventListener('zeno-open-pricing', handleOpenPricing);
    return () => window.removeEventListener('zeno-open-pricing', handleOpenPricing);
  }, []);

  // Load Public Shared Thread snapshot (?share=), Public Zeno Page (?artifact=), and Referral attribution (?ref=)
  useEffect(() => {
    try {
      captureReferralFromUrlIfPresent();
      trackGrowthEvent('returning_session_started');
      const params = new URLSearchParams(window.location.search);

      const artifactId = params.get('artifact')?.trim();
      if (artifactId) {
        // Public Zeno Pages are accessible without forcing signup
        setIsSignedIn(true);
        setPublicArtifactModal({
          isOpen: true,
          artifactId,
          initialArtifact: null,
        });
      }

      const shareId = params.get('share')?.trim();
      if (!shareId) return;
      loadSharedThreadFromFirestore(shareId).then((sharedSnap) => {
        if (sharedSnap && Array.isArray(sharedSnap.messages) && sharedSnap.messages.length > 0) {
          setIsSignedIn(true);
          const importedThread: SavedThread = {
            id: sharedSnap.id,
            title: sharedSnap.title || 'Shared Thread',
            createdAt: sharedSnap.createdAt || Date.now(),
            messages: sharedSnap.messages,
          };
          setThreads((prev) => {
            const filtered = prev.filter((t) => t.id !== importedThread.id);
            return [importedThread, ...filtered];
          });
          setActiveThreadId(importedThread.id);
          setSharedBannerId(shareId);
          setCurrentView('chat');
        }
      });
    } catch {}
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsSignedIn(true);
        try {
          localStorage.setItem('zeno_auth_session', 'true');
          localStorage.removeItem('zeno_explicit_signout');
        } catch {}
        try {
          const remoteThreads = await loadUserChatThreadsFromFirestore();
          if (Array.isArray(remoteThreads) && remoteThreads.length > 0) {
            setThreads((prev) => {
              const map = new Map<string, SavedThread>();
              prev.forEach((t) => map.set(t.id, t));
              remoteThreads.forEach((rt: any) => {
                if (rt && rt.id && Array.isArray(rt.messages)) {
                  map.set(rt.id, {
                    id: rt.id,
                    title: rt.title || 'New Chat',
                    createdAt: rt.createdAt || Date.now(),
                    messages: rt.messages,
                  });
                }
              });
              return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
            });
          }
        } catch (err) {
          console.error('Failed to load Firestore chat threads:', err);
        }
      } else {
        // If Firebase Auth currentUser is null, check if user explicitly signed out
        try {
          if (localStorage.getItem('zeno_explicit_signout') === 'true') {
            setIsSignedIn(false);
          } else if (UserAccountStore.isUserSignedIn()) {
            setIsSignedIn(true);
          }
        } catch {}
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleAccountSync = () => {
      setUserProfile(UserAccountStore.getProfile());
      setUserSub(UserAccountStore.getSubscription());
      try {
        if (localStorage.getItem('zeno_explicit_signout') === 'true') {
          setIsSignedIn(false);
          return;
        }
      } catch {}
      if (UserAccountStore.isUserSignedIn()) {
        setIsSignedIn(true);
      }
    };
    window.addEventListener('zeno-account-updated', handleAccountSync);
    return () => window.removeEventListener('zeno-account-updated', handleAccountSync);
  }, []);

  useEffect(() => {
    const handleOpenStudyWorkspace = (e: any) => {
      if (e?.detail?.video) {
        setActiveStudyVideo(e.detail.video);
      }
      setCurrentView('study');
    };
    window.addEventListener('zeno-open-study-workspace', handleOpenStudyWorkspace);
    return () => window.removeEventListener('zeno-open-study-workspace', handleOpenStudyWorkspace);
  }, []);

  // Automatically resize application container for any device screen, mobile keyboard, or browser window
  useEffect(() => {
    let prevWidth = window.innerWidth;
    const syncViewportDimensions = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      const width = vv ? vv.width : window.innerWidth;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
      document.documentElement.style.setProperty('--app-width', `${width}px`);

      // Automatically close sidebar if browser shrinks from desktop to mobile breakpoint
      if (prevWidth >= 768 && width < 768) {
        setIsSidebarOpen(false);
      }
      prevWidth = width;
    };

    syncViewportDimensions();
    window.addEventListener('resize', syncViewportDimensions);
    window.addEventListener('orientationchange', syncViewportDimensions);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncViewportDimensions);
      window.visualViewport.addEventListener('scroll', syncViewportDimensions);
    }

    UserAccountStore.syncQuotaWithServerAndFirestore();

    return () => {
      window.removeEventListener('resize', syncViewportDimensions);
      window.removeEventListener('orientationchange', syncViewportDimensions);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', syncViewportDimensions);
        window.visualViewport.removeEventListener('scroll', syncViewportDimensions);
      }
    };
  }, []);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const historicalThreads: ChatHistoryItem[] = React.useMemo(() => {
    return threads.map((t) => ({
      id: t.id,
      title: t.title,
      snippet: t.messages.length > 0 ? t.messages[0].content.slice(0, 100) : undefined,
      timestamp: t.createdAt,
      messageCount: t.messages.length,
    }));
  }, [threads]);

  // Active messages based on current thread
  const activeThread = threads.find((t) => t.id === activeThreadId);
  const messages = React.useMemo(
    () => (activeThread ? activeThread.messages : []),
    [activeThread]
  );
  const isThreadEmpty = messages.length === 0;
  const fallbackShareThread = React.useMemo(
    () =>
      activeThread || {
        id: 'thread-preview',
        title: 'Zeno Research Session',
        createdAt: 0,
        messages,
      },
    [activeThread, messages]
  );

  // Session-isolated prompt & message history: strictly only for the current active chat session!
  const currentSessionMessageItems: ChatHistoryMessageItem[] = React.useMemo(() => {
    if (!activeThread) return [];
    const items: ChatHistoryMessageItem[] = [];
    activeThread.messages.forEach((m) => {
      if (m.role === 'user' && m.content.trim()) {
        items.push({
          id: m.id,
          threadId: activeThread.id,
          content: m.content.trim(),
          timestamp: m.timestamp,
        });
      }
    });
    // Deduplicate by message content while preserving recent session order
    const map = new Map<string, ChatHistoryMessageItem>();
    items.forEach((item) => {
      map.set(item.content, item);
    });
    return Array.from(map.values()).reverse().slice(0, 15);
  }, [activeThread]);

  const currentSessionPrompts: string[] = React.useMemo(() => {
    return currentSessionMessageItems.map((item) => item.content);
  }, [currentSessionMessageItems]);

  const handleNavigateToHistoryMessage = (messageId: string, _threadId: string, content: string) => {
    if (!activeThread) return;

    // Strictly isolate to the current active chat session!
    const targetMessage = activeThread.messages.find(
      (m) => (messageId && m.id === messageId) || m.content.trim() === content.trim()
    );

    const targetMessageId = targetMessage ? targetMessage.id : messageId;

    setTimeout(() => {
      let el: HTMLElement | null = null;
      if (targetMessageId) {
        el = document.getElementById(`msg-${targetMessageId}`) ||
             document.querySelector(`[data-message-id="${targetMessageId}"]`);
      }

      if (!el) {
        const msgNodes = Array.from(document.querySelectorAll('[data-message-id]'));
        el = (msgNodes.find((node) => node.textContent?.includes(content.slice(0, 20))) as HTMLElement) || null;
      }

      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-blue-500/80', 'bg-blue-500/10', 'shadow-[0_0_24px_rgba(59,130,246,0.3)]');
        setTimeout(() => {
          el?.classList.remove('ring-2', 'ring-blue-500/80', 'bg-blue-500/10', 'shadow-[0_0_24px_rgba(59,130,246,0.3)]');
        }, 2500);
      }
    }, 80);
  };

  const isDark = theme === 'dark';

  // Compute dynamic suggestions by analyzing user query patterns across sessions
  const currentSuggestions = React.useMemo(() => {
    const allUserTexts = threads
      .flatMap((t) => t.messages)
      .filter((m) => m.role === 'user')
      .map((m) => m.content.toLowerCase())
      .join(' ');

    if (/code|react|node|javascript|sql|bug|api|function/i.test(allUserTexts)) {
      return DYNAMIC_SUGGESTION_POOLS.code;
    }
    if (/physics|quantum|relativity|black hole|energy|mass/i.test(allUserTexts)) {
      return DYNAMIC_SUGGESTION_POOLS.physics;
    }
    if (/ai|model|llm|gemini|transformer|agent|neural/i.test(allUserTexts)) {
      return DYNAMIC_SUGGESTION_POOLS.ai;
    }
    if (threads.length > 1) {
      return DYNAMIC_SUGGESTION_POOLS.general;
    }
    return DEFAULT_SUGGESTIONS;
  }, [threads]);



  const lastAssistantResponse = React.useMemo(() => {
    const list = activeThread ? activeThread.messages.filter((m) => m.role === 'assistant') : [];
    return list.length > 0 ? list[list.length - 1].content : '';
  }, [activeThread]);

  // Sync theme to document.documentElement
  useEffect(() => {
    try {
      localStorage.setItem('zeno_theme', theme);
    } catch {}

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Persist 18+ NSFW Mode
  useEffect(() => {
    try {
      localStorage.setItem('zeno_nsfw_mode', String(nsfwMode));
    } catch {}
  }, [nsfwMode]);

  // Persist threads to localStorage & Firebase Firestore
  useEffect(() => {
    try {
      localStorage.setItem('zeno_threads_v2', JSON.stringify(threads));
      if (activeThreadId) {
        localStorage.setItem('zeno_active_thread', activeThreadId);
      } else {
        localStorage.removeItem('zeno_active_thread');
      }
    } catch {}

    if (!isRunning && activeThread && auth.currentUser) {
      const hasStreaming = activeThread.messages.some((m) => m.isStreaming);
      if (!hasStreaming && activeThread.messages.length > 0) {
        saveChatThreadToFirestore(activeThread).catch((err) =>
          console.error('Failed to sync thread to Firestore:', err)
        );
      }
    }
  }, [threads, activeThreadId, isRunning, activeThread]);

  // Scroll to bottom
  useEffect(() => {
    if (!isThreadEmpty) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isRunning, isThreadEmpty]);

  // Close export dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleExportThread = (threadId: string, format: 'markdown' | 'pdf') => {
    const target = threads.find((t) => t.id === threadId);
    if (!target || target.messages.length === 0) return;
    if (format === 'markdown') {
      exportConversationAsMarkdown(target);
    } else {
      exportConversationAsPdf(target);
    }
    setIsExportMenuOpen(false);
  };

  // Instantaneous assistant text & metadata rendering with zero artificial streaming lag
  const streamResponseIntoMessage = async (
    threadId: string,
    messageId: string,
    data: any,
    _signal?: AbortSignal
  ) => {
    const fullText = (data.text || '').replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      content: fullText,
                      sources:
                        Array.isArray(data.sources) && data.sources.length > 0
                          ? data.sources
                          : m.sources,
                      images: data.images,
                      personaWiki: data.personaWiki,
                      videos: data.videos,
                      arxivPapers: data.arxivPapers,
                      githubRepos: data.githubRepos,
                      xPosts: data.xPosts,
                      searchQueries:
                        Array.isArray(data.searchQueries) && data.searchQueries.length > 0
                          ? data.searchQueries
                          : m.searchQueries,
                      toolsUsed: data.toolsUsed,
                      timing: data.timing,
                      modelUsed: m.modelUsed || data.modelUsed,
                      isStreaming: false,
                    }
                  : m
              ),
            }
          : t
      )
    );
  };

  const handleForkArtifactIntoChat = (artifact: PublicArtifact) => {
    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: artifact.promptText || `Explore & synthesize: ${artifact.title}`,
      timestamp: Date.now(),
    };
    const assistantMsg: ChatMessageType = {
      id: `assistant-${Date.now() + 1}`,
      role: 'assistant',
      content: artifact.content,
      timestamp: Date.now() + 1,
      sources: artifact.sources || [],
      modelUsed: artifact.modelUsed || 'Zeno Synthesis',
    };
    const newId = `thread-${Date.now()}`;
    const forkedThread: SavedThread = {
      id: newId,
      title: artifact.title.slice(0, 60),
      createdAt: Date.now(),
      messages: [userMsg, assistantMsg],
    };
    setThreads((prev) => [forkedThread, ...prev]);
    setActiveThreadId(newId);
    setCurrentView('chat');
    trackGrowthEvent('first_core_action_completed', { source: 'fork_public_artifact' });
  };

  const handleContinueVaultItemInChat = (item: KnowledgeVaultItem) => {
    if (item.sourceThreadId && threads.some((t) => t.id === item.sourceThreadId)) {
      handleSelectThread(item.sourceThreadId);
      setCurrentView('chat');
      return;
    }
    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: `Continue from saved Knowledge Vault note: ${item.title}`,
      timestamp: Date.now(),
    };
    const assistantMsg: ChatMessageType = {
      id: `assistant-${Date.now() + 1}`,
      role: 'assistant',
      content: item.content,
      timestamp: Date.now() + 1,
      sources: item.sources || [],
      modelUsed: 'Zeno Knowledge Vault',
    };
    const newId = `thread-${Date.now()}`;
    const resumedThread: SavedThread = {
      id: newId,
      title: item.title.slice(0, 60),
      createdAt: Date.now(),
      messages: [userMsg, assistantMsg],
    };
    setThreads((prev) => [resumedThread, ...prev]);
    setActiveThreadId(newId);
    setCurrentView('chat');
  };

  const handleSend = async (
    promptText: string,
    mode: SearchMode = searchMode,
    attachments: any[] = []
  ) => {
    const query = promptText.trim();
    if (!query || isRunning) return;

    // 1. Check daily prompt/message limit and file upload limit
    const currentUsage = UserAccountStore.getUsage();
    const currentPlanNorm = UserAccountStore.getNormalizedPlan();
    if (currentUsage.messagesUsed >= currentUsage.messageLimit) {
      setPricingModalState({
        isOpen: true,
        highlightPlan: currentPlanNorm === 'free' ? 'spark' : 'fire',
        limitReason: `Daily message limit reached (${currentUsage.messagesUsed}/${currentUsage.messageLimit} prompts used). Upgrade to Spark ($3/mo) for 1,500 messages/day or Fire ($7/mo) for unlimited messages.`,
      });
      return;
    }

    if (
      attachments.length > 0 &&
      currentUsage.filesUploaded + attachments.length > currentUsage.fileUploadLimit
    ) {
      setPricingModalState({
        isOpen: true,
        highlightPlan: currentPlanNorm === 'free' ? 'spark' : 'fire',
        limitReason: `File upload limit reached (${currentUsage.filesUploaded}/${currentUsage.fileUploadLimit} files used on your plan). Upgrade to Spark ($3/mo) for 250 uploads/day or Fire ($7/mo) for unlimited uploads.`,
      });
      return;
    }

    trackGrowthEvent('first_core_action_completed', { action: 'chat_prompt' });
    claimPendingReferralIfEligible('first_core_action');

    // Auto-select vision model when user sends an image or file attachment
    const hasImageAtt = attachments.some((a) => a?.type?.startsWith('image/'));
    const hasAnyAtt = attachments.length > 0;
    let activeModel = selectedModel;
    if (hasAnyAtt && !selectedModel.supportsVision) {
      activeModel = getDefaultVisionModel();
      setSelectedModel(activeModel);
    }

    // 2. Check if selected model requires Spark ($3) or Fire ($7)
    const reqModelTier = getModelRequiredTier(activeModel);
    if (!UserAccountStore.canUseModel(reqModelTier)) {
      setPricingModalState({
        isOpen: true,
        highlightPlan: reqModelTier === 'fire' ? 'fire' : 'spark',
        limitReason: `${activeModel.name} requires the ${
          reqModelTier === 'fire' ? 'Fire ($7/mo)' : 'Spark ($3/mo)'
        } plan. Upgrade now to unlock it.`,
      });
      return;
    }

    const isCasualOrGreeting =
      /^[\p{Extended_Pictographic}\p{Emoji}\s\u200d\ufe0f👋✋✌️🙌🤝✨💌🎉❤️]+$/u.test(query.trim()) ||
      /^(hi+|hey+|hello+|yo+|sup|wassup|whats up|howdy|greetings|good (morning|afternoon|evening|night)|how are you|thanks|thank you|thx|ty|ok|okay|k|cool|nice|great|awesome|got it|wave|hand wave|waving|bye|cya)$/i.test(query.trim().toLowerCase());

    const isClockQuery = isDateOrTimeClockQuery(query);
    const effectiveMode: SearchMode = isResearchMode
      ? 'organic'
      : mode === 'news'
      ? 'news'
      : 'organic';
    const hasSearchIntent = !isClockQuery && !isCasualOrGreeting;

    const computedLoadingMode: 'vision' | 'file' | 'search' | 'thinking' = hasImageAtt
      ? 'vision'
      : hasAnyAtt
      ? 'file'
      : hasSearchIntent
      ? 'search'
      : 'thinking';

    let currentThreadId = activeThreadId;

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const streamingMessage: ChatMessageType = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      loadingMode: computedLoadingMode,
      modelUsed: activeModel.name,
      searchQueries: computedLoadingMode === 'search' ? [query] : undefined,
    };

    // If no active thread, create one
    if (!currentThreadId) {
      currentThreadId = `thread-${Date.now()}`;
      const newTitle = query.slice(0, 36) + (query.length > 36 ? '...' : '');
      const newThread: SavedThread = {
        id: currentThreadId,
        title: newTitle,
        createdAt: Date.now(),
        messages: [userMessage, streamingMessage],
      };
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(currentThreadId);
    } else {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === currentThreadId
            ? { ...t, messages: [...t.messages, userMessage, streamingMessage] }
            : t
        )
      );
    }

    setIsRunning(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Fetch real-time live sites being searched immediately (~400ms) and stream them in progressively while LLM is generating
    let chatCompleted = false;
    if (computedLoadingMode === 'search') {
      getAuthHeaders().then((authHeaders) =>
        fetchZenoApi('/api/search/live', {
          method: 'POST',
          headers: authHeaders,
          signal: controller.signal,
          body: JSON.stringify({
            query,
            searchMode: effectiveMode,
            nsfwMode,
            isResearchMode,
          }),
        })
      )
        .then((r) => r.json())
        .then((liveData) => {
          if (
            !controller.signal.aborted &&
            !chatCompleted &&
            liveData?.success &&
            Array.isArray(liveData.sources) &&
            liveData.sources.length > 0
          ) {
            const prefLang = UserAccountStore.getPersonalization()?.preferredLanguage;
            const reqLang = detectClientRequestedLanguage(query, prefLang);
            const cleanLiveSources = !reqLang
              ? liveData.sources.filter(
                  (s: any) =>
                    !/[\u4e00-\u9fff\u3400-\u4dbf]{2,}/.test(`${s?.title || ''} ${s?.snippet || ''}`) &&
                    !/\b(baidu\.com|zhihu\.com|csdn\.net|weibo\.com)\b/i.test(`${s?.domain || ''} ${s?.url || ''}`)
                )
              : liveData.sources;
            if (cleanLiveSources.length > 0) {
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === currentThreadId
                    ? {
                        ...t,
                        messages: t.messages.map((m) =>
                          m.id === streamingMessage.id &&
                          (!m.sources || m.sources.length < cleanLiveSources.length)
                            ? { ...m, sources: cleanLiveSources }
                            : m
                        ),
                      }
                    : t
                )
              );
            }
          }
        })
        .catch(() => {});
    }

    try {
      const allPriorMessages = activeThread ? activeThread.messages : [];
      const authHeaders = await getAuthHeaders();
      const clientClock = getClientRealTimeClock();
      const userPersonalization = UserAccountStore.getPersonalization();
      const clockSystemPrompt = buildClientClockSystemDirective(
        clientClock,
        query,
        userPersonalization?.preferredLanguage
      );
      const response = await fetchZenoApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...allPriorMessages, userMessage].map((m, idx, arr) => {
            let cleanContent = stripInjectedClockNote(m.content || '');
            if (m.role === 'assistant' && cleanContent) {
              cleanContent = cleanContent
                .replace(/sunday,?\s+october\s+18,?\s+2026/gi, clientClock.localDateOnly)
                .replace(/october\s+18,?\s+2026/gi, `${clientClock.monthName} ${clientClock.day}, ${clientClock.year}`);
            }
            return {
              role: m.role,
              content:
                idx === arr.length - 1 && m.role === 'user' && isClockQuery
                  ? `${cleanContent}\n\n[VERIFIED REAL-TIME DEVICE CLOCK: Today is ${clientClock.localDateOnly} and the current local time is ${clientClock.localTimeOnly} / UTC: ${clientClock.utcFull}. State BOTH this exact real-time date and time, and do NOT agree if the user claims today is a different date.]`
                  : cleanContent,
              attachments: m.attachments,
            };
          }),
          webSearch: isClockQuery ? false : true,
          searchMode: effectiveMode,
          model: activeModel.geminiModel,
          nsfwMode,
          isResearchMode: isClockQuery ? false : isResearchMode,
          clientClock,
          systemPrompt: clockSystemPrompt,
          personalization: userPersonalization,
          pinnedInsights: UserAccountStore.getBookmarks().slice(0, 10),
          subscriptionPlan: UserAccountStore.getNormalizedPlan(),
          clientUsage: UserAccountStore.getUsage(),
        }),
      });

      const rawText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error('Server took too long or returned an unexpected response. Please try again.');
      }

      if (data?.quota) {
        UserAccountStore.applyServerQuotaSnapshot(data.quota);
      }

      if (!response.ok || !data.success) {
        if (
          (response.status === 403 || response.status === 429) &&
          typeof data?.code === 'string' &&
          data.code.startsWith('quota/')
        ) {
          setPricingModalState({
            isOpen: true,
            highlightPlan: data.requiredTier === 'fire' ? 'fire' : 'spark',
            limitReason: data.error || 'Daily plan limit reached. Upgrade to continue.',
          });
        }
        throw new Error(data.error || 'Failed to generate response');
      }

      data = enforceClientClockInReply(data, clientClock, isClockQuery, query);

      // Apply authoritative server quota snapshot or record usage
      if (data?.quota) {
        UserAccountStore.applyServerQuotaSnapshot(data.quota);
      } else {
        UserAccountStore.recordUsage(
          data?.timing?.totalTokens || 450,
          Array.isArray(data.sources) && data.sources.length > 0 ? 1 : 0,
          Array.isArray(data.toolsUsed) ? data.toolsUsed.length : 0,
          1,
          attachments ? attachments.length : 0
        );
      }

      // Track uploaded file attachments in workspace library
      if (attachments && attachments.length > 0) {
        const currentFiles = UserAccountStore.getFiles();
        attachments.forEach((att: any) => {
          if (!currentFiles.some((f) => f.name === att.name)) {
            const isPdf = att.type?.includes('pdf') || att.name?.endsWith('.pdf');
            const isImg = att.type?.startsWith('image/');
            currentFiles.unshift({
              id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: att.name || 'Uploaded File',
              size: att.size || 1024,
              type: att.type || 'application/octet-stream',
              uploadedAt: Date.now(),
              threadTitle: query.slice(0, 30),
              category: isPdf ? 'pdf' : isImg ? 'image' : 'code',
            });
          }
        });
        UserAccountStore.saveFiles(currentFiles);
      }

      chatCompleted = true;
      await streamResponseIntoMessage(currentThreadId, streamingMessage.id, data, controller.signal);
    } catch (err: any) {
      const errorText =
        err.name === 'AbortError'
          ? '_Response paused._'
          : err.message || 'Error communicating with model. Please try again.';

      setThreads((prev) =>
        prev.map((t) =>
          t.id === currentThreadId
            ? {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === streamingMessage.id
                    ? {
                        ...m,
                        content: errorText,
                        isStreaming: false,
                      }
                    : m
                ),
              }
            : t
        )
      );
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleNewChat = () => {
    setActiveThreadId(null);
    setCurrentView('chat');
  };

  const handleDeleteThread = (threadId: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
    }
    deleteChatThreadFromFirestore(threadId).catch((err) =>
      console.error('Failed to delete thread from Firestore:', err)
    );
  };

  const handleUpdateThreadTitle = (threadId: string, newTitle: string) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === threadId) {
          const updated = { ...t, title: newTitle };
          saveChatThreadToFirestore(updated).catch((err) =>
            console.error('Failed to update thread title in Firestore:', err)
          );
          return updated;
        }
        return t;
      })
    );
  };

  const handleClearAllHistory = () => {
    const idsToDelete = threads.map((t) => t.id);
    setThreads([]);
    setActiveThreadId(null);
    localStorage.removeItem('zeno_threads_v2');
    localStorage.removeItem('zeno_active_thread');
    clearAllChatThreadsFromFirestore(idsToDelete).catch((err) =>
      console.error('Failed to clear threads in Firestore:', err)
    );
  };

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setCurrentView('chat');
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Regenerate an assistant response in-place (optionally switching to a different model) without duplicating the user prompt
  const handleRegenerateMessage = async (assistantMsgId: string, modelOverride?: ModelOption) => {
    if (isRunning || !activeThreadId || !activeThread) return;

    const targetModel = modelOverride || selectedModel;
    if (modelOverride) {
      setSelectedModel(modelOverride);
    }

    const msgIndex = activeThread.messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIndex === -1) return;

    const contextMessages = activeThread.messages.slice(0, msgIndex);
    if (contextMessages.length === 0) return;

    const currentThreadId = activeThreadId;

    // Set existing assistant message to streaming state in-place
    setThreads((prev) =>
      prev.map((t) =>
        t.id === currentThreadId
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: '',
                      isStreaming: true,
                      sources: undefined,
                      images: undefined,
                      videos: undefined,
                      arxivPapers: undefined,
                      githubRepos: undefined,
                      xPosts: undefined,
                      timing: undefined,
                      modelUsed: targetModel.name,
                    }
                  : m
              ),
            }
          : t
      )
    );

    setIsRunning(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const authHeaders = await getAuthHeaders();
      const clientClock = getClientRealTimeClock();
      const clockSystemPrompt = buildClientClockSystemDirective(clientClock);
      const lastUserInContext = [...contextMessages].reverse().find((m) => m.role === 'user');
      const regenQuery = lastUserInContext ? stripInjectedClockNote(lastUserInContext.content) : '';
      const isRegenClockQuery = isDateOrTimeClockQuery(regenQuery);

      const response = await fetchZenoApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          messages: contextMessages.map((m, idx, arr) => {
            let cleanContent = stripInjectedClockNote(m.content || '');
            if (m.role === 'assistant' && cleanContent) {
              cleanContent = cleanContent
                .replace(/sunday,?\s+october\s+18,?\s+2026/gi, clientClock.localDateOnly)
                .replace(/october\s+18,?\s+2026/gi, `${clientClock.monthName} ${clientClock.day}, ${clientClock.year}`);
            }
            return {
              role: m.role,
              content:
                idx === arr.length - 1 && m.role === 'user' && isRegenClockQuery
                  ? `${cleanContent}\n\n[VERIFIED REAL-TIME DEVICE CLOCK: Today is ${clientClock.localDateOnly} and the current local time is ${clientClock.localTimeOnly} / UTC: ${clientClock.utcFull}. State BOTH this exact real-time date and time, and do NOT agree if the user claims today is a different date.]`
                  : cleanContent,
              attachments: m.attachments,
            };
          }),
          webSearch: isRegenClockQuery ? false : true,
          searchMode: searchMode === 'news' ? 'news' : 'organic',
          model: targetModel.geminiModel,
          nsfwMode,
          clientClock,
          systemPrompt: clockSystemPrompt,
          personalization: UserAccountStore.getPersonalization(),
          pinnedInsights: UserAccountStore.getBookmarks().slice(0, 10),
          subscriptionPlan: UserAccountStore.getNormalizedPlan(),
          clientUsage: UserAccountStore.getUsage(),
        }),
      });

      const rawText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error('Server took too long or returned an unexpected response. Please try again.');
      }

      if (data?.quota) {
        UserAccountStore.applyServerQuotaSnapshot(data.quota);
      }

      if (!response.ok || !data.success) {
        if (
          (response.status === 403 || response.status === 429) &&
          typeof data?.code === 'string' &&
          data.code.startsWith('quota/')
        ) {
          setPricingModalState({
            isOpen: true,
            highlightPlan: data.requiredTier === 'fire' ? 'fire' : 'spark',
            limitReason: data.error || 'Daily plan limit reached. Upgrade to continue.',
          });
        }
        throw new Error(data.error || 'Failed to regenerate response');
      }

      data = enforceClientClockInReply(data, clientClock, isRegenClockQuery, regenQuery);

      await streamResponseIntoMessage(currentThreadId, assistantMsgId, data, controller.signal);
    } catch (err: any) {
      const errorText =
        err.name === 'AbortError'
          ? '_Response paused._'
          : err.message || 'Error communicating with model. Please try again.';

      setThreads((prev) =>
        prev.map((t) =>
          t.id === currentThreadId
            ? {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: errorText,
                        isStreaming: false,
                      }
                    : m
                ),
              }
            : t
        )
      );
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  // Edit a user message in-place and regenerate the assistant message right below it in-place
  const handleEditMessage = async (userMsgId: string, newContent: string) => {
    const query = newContent.trim();
    if (!query || isRunning || !activeThreadId || !activeThread) return;

    const userIdx = activeThread.messages.findIndex((m) => m.id === userMsgId);
    if (userIdx === -1) return;

    const nextMsg = activeThread.messages[userIdx + 1];
    const targetAssistantId =
      nextMsg && nextMsg.role === 'assistant' ? nextMsg.id : `assistant-${Date.now()}`;

    const updatedUserMsg: ChatMessageType = {
      ...activeThread.messages[userIdx],
      content: query,
    };

    const contextMessages = [...activeThread.messages.slice(0, userIdx), updatedUserMsg];
    const currentThreadId = activeThreadId;

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== currentThreadId) return t;
        const newMessages = [...t.messages];
        newMessages[userIdx] = updatedUserMsg;
        if (nextMsg && nextMsg.role === 'assistant') {
          newMessages[userIdx + 1] = {
            ...nextMsg,
            content: '',
            isStreaming: true,
            sources: undefined,
            images: undefined,
            videos: undefined,
            arxivPapers: undefined,
            githubRepos: undefined,
            xPosts: undefined,
            timing: undefined,
          };
        } else {
          newMessages.splice(userIdx + 1, 0, {
            id: targetAssistantId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
          });
        }
        return { ...t, messages: newMessages };
      })
    );

    setIsRunning(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const authHeaders = await getAuthHeaders();
      const clientClock = getClientRealTimeClock();
      const clockSystemPrompt = buildClientClockSystemDirective(clientClock);
      const response = await fetchZenoApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          messages: contextMessages.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
          webSearch: true,
          searchMode: searchMode === 'news' ? 'news' : 'organic',
          model: selectedModel.geminiModel,
          nsfwMode,
          clientClock,
          systemPrompt: clockSystemPrompt,
          personalization: UserAccountStore.getPersonalization(),
          pinnedInsights: UserAccountStore.getBookmarks().slice(0, 10),
          subscriptionPlan: UserAccountStore.getNormalizedPlan(),
          clientUsage: UserAccountStore.getUsage(),
        }),
      });

      const rawText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error('Server took too long or returned an unexpected response. Please try again.');
      }

      if (data?.quota) {
        UserAccountStore.applyServerQuotaSnapshot(data.quota);
      }

      if (!response.ok || !data.success) {
        if (
          (response.status === 403 || response.status === 429) &&
          typeof data?.code === 'string' &&
          data.code.startsWith('quota/')
        ) {
          setPricingModalState({
            isOpen: true,
            highlightPlan: data.requiredTier === 'fire' ? 'fire' : 'spark',
            limitReason: data.error || 'Daily plan limit reached. Upgrade to continue.',
          });
        }
        throw new Error(data.error || 'Failed to generate response');
      }

      await streamResponseIntoMessage(currentThreadId, targetAssistantId, data, controller.signal);
    } catch (err: any) {
      const errorText =
        err.name === 'AbortError'
          ? '_Response paused._'
          : err.message || 'Error communicating with model. Please try again.';

      setThreads((prev) =>
        prev.map((t) =>
          t.id === currentThreadId
            ? {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === targetAssistantId
                    ? {
                        ...m,
                        content: errorText,
                        isStreaming: false,
                      }
                    : m
                ),
              }
            : t
        )
      );
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div
      className={`app-viewport-shell flex h-[100dvh] w-full max-w-[100vw] overflow-hidden font-sans select-text transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-[#000000]'
      }`}
    >
      {!isSignedIn ? (
        <Signup1 onSuccess={() => setIsSignedIn(true)} />
      ) : (
        <>
          {/* Collapsible Sidebar */}
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
            onNewChat={handleNewChat}
            onDeleteThread={handleDeleteThread}
            onUpdateThreadTitle={handleUpdateThreadTitle}
            onExportThread={handleExportThread}
            onOpenSettings={() => {
              setAccountPageTab('preferences');
              setCurrentView('account');
            }}
            onOpenAccountModal={(tab) => {
              setAccountPageTab((tab as AccountTab) || 'profile');
              setCurrentView('account');
            }}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onOpenGrowthHub={(tab) => setGrowthHubState({ isOpen: true, initialTab: tab })}
            onOpenPricing={(highlightPlan) =>
              setPricingModalState({
                isOpen: true,
                highlightPlan: highlightPlan || 'spark',
                limitReason: null,
              })
            }
            onSelectPinnedMessage={(threadId, messageId, snippet) => {
              handleSelectThread(threadId);
              setTimeout(() => {
                const el =
                  document.getElementById(`msg-${messageId}`) ||
                  document.querySelector(`[data-message-id="${messageId}"]`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-2', 'ring-[#FC4C01]/80', 'bg-[#FC4C01]/10');
                  setTimeout(() => {
                    el.classList.remove('ring-2', 'ring-[#FC4C01]/80', 'bg-[#FC4C01]/10');
                  }, 2200);
                } else {
                  handleNavigateToHistoryMessage(messageId, threadId, snippet);
                }
              }, 120);
            }}
            theme={theme}
            onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
          />

          {/* Main View Area: Dedicated Account & Settings Page OR Study Workspace OR Main Chat Canvas */}
          {currentView === 'account' ? (
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
              <AccountWorkspacePage
                onBackToChat={() => setCurrentView('chat')}
                initialTab={accountPageTab}
                threads={threads}
                theme={theme}
                onThemeChange={(newTheme) => setTheme(newTheme)}
                selectedModel={selectedModel}
                onSelectModel={(newModel) => setSelectedModel(newModel)}
                webSearchDefault={searchMode !== 'off'}
                onToggleWebSearchDefault={(enabled) => setSearchMode(enabled ? 'organic' : 'off')}
                nsfwMode={nsfwMode}
                onToggleNsfwMode={(enabled) => setNsfwMode(enabled)}
                onClearAllHistory={handleClearAllHistory}
                onSelectThread={handleSelectThread}
              />
            </div>
          ) : currentView === 'study' ? (
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
              <StudyWorkspace
                initialVideo={activeStudyVideo}
                onBackToChat={() => setCurrentView('chat')}
                isDark={isDark}
                onAskZeno={(prompt) => {
                  setCurrentView('chat');
                  handleSend(prompt);
                }}
              />
            </div>
          ) : (
            /* Main Chat Canvas */
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
              {/* Glassmorphic Floating Top Controls (Sidebar toggle, Model Picker, Study Studio & New Chat) */}
              <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] left-3 right-3 sm:left-4 sm:right-4 z-30 flex items-center justify-between gap-2 pointer-events-none">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`pointer-events-auto size-8 rounded-xl border backdrop-blur-2xl backdrop-saturate-150 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                    isDark
                      ? 'bg-neutral-900/55 hover:bg-neutral-800/70 border-white/[0.16] text-white shadow-[0_8px_32px_rgba(0,0,0,0.55)]'
                      : 'bg-white/65 hover:bg-white/85 border-black/[0.1] text-[#000000] shadow-[0_8px_32px_rgba(0,0,0,0.1)]'
                  }`}
                  title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                  aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="4.5" />
                    <path d="M9.5 3v18" />
                    <path d="M6 8h1.5" />
                    <path d="M6 11.5h1.5" />
                    {isSidebarOpen ? (
                      <path d="M15.5 9.5 13 12l2.5 2.5" />
                    ) : (
                      <path d="M13.5 9.5 16 12l-2.5 2.5" />
                    )}
                  </svg>
                </button>

                {/* Dynamic Island Model Selector */}
                <div className="pointer-events-auto flex items-center justify-center gap-2">
                  <GrokModelPicker
                    selectedModelId={selectedModel.id}
                    onSelectModel={setSelectedModel}
                    onOpenPricing={(highlightPlan, reason) =>
                      setPricingModalState({
                        isOpen: true,
                        highlightPlan: highlightPlan || 'spark',
                        limitReason: reason || null,
                      })
                    }
                    isDark={isDark}
                    dropdownDirection="down"
                    variant="header"
                  />
                </div>

                {/* Top Right Controls: Study Studio + New Chat Button */}
                <div className="flex items-center gap-1.5 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const u = UserAccountStore.getUsage();
                      if (u.pdfStudyUsed >= u.pdfStudyLimit) {
                        setPricingModalState({
                          isOpen: true,
                          highlightPlan:
                            UserAccountStore.getNormalizedPlan() === 'free' ? 'spark' : 'fire',
                          limitReason: `Study Space limit reached (${u.pdfStudyUsed}/${u.pdfStudyLimit} sessions used). Upgrade to Spark ($3/mo) for 200 sessions/day or Fire ($7/mo) for unlimited Study Space.`,
                        });
                        return;
                      }
                      UserAccountStore.recordPdfStudySession();
                      setActiveStudyVideo(null);
                      setCurrentView('study');
                    }}
                    className={`pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-2xl backdrop-saturate-150 text-[11px] font-semibold tracking-tight transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                      isDark
                        ? 'bg-neutral-900/55 hover:bg-neutral-800/65 border-white/[0.16] text-white shadow-[0_8px_32px_rgba(0,0,0,0.55)]'
                        : 'bg-white/65 hover:bg-white/85 border-black/[0.1] text-[#0d0d0d] shadow-[0_8px_32px_rgba(0,0,0,0.1)]'
                    }`}
                    title="Open Study Space"
                  >
                    <span>Study</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className={`pointer-events-auto size-8 rounded-xl border backdrop-blur-2xl backdrop-saturate-150 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                      isDark
                        ? 'bg-neutral-900/55 hover:bg-neutral-800/65 border-white/[0.16] text-white shadow-[0_8px_32px_rgba(0,0,0,0.55)]'
                        : 'bg-white/65 hover:bg-white/85 border-black/[0.1] text-[#000000] shadow-[0_8px_32px_rgba(0,0,0,0.1)]'
                    }`}
                    title="New chat"
                    aria-label="New chat"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3.5 h-3.5"
                    >
                      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content State: Empty vs Thread */}
              {isThreadEmpty ? (
                /* Empty State: Center logo, Smart Continuation strip, and prompt input anchored at bottom */
                <div className="flex-1 min-w-0 flex flex-col items-center justify-between px-3 sm:px-4 w-full overflow-y-auto pt-14 sm:pt-16 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-8">
                  {/* Center Area: Centered Grok Wordmark */}
                  <div className="flex-1 flex flex-col items-center justify-center my-auto">
                    <GrokLogo size="lg" isDark={isDark} />
                  </div>

                  {/* Bottom Anchored Area: Prompt Input */}
                  <div className="w-full max-w-3xl flex flex-col items-center mt-auto">
                    {/* ChatInput (@kobra/chat-input with @kobra/chat-history & upward model selector) */}
                    <div className="w-full">
                      <ChatInput
                        onSend={handleSend}
                        onCancel={handleCancel}
                        isRunning={isRunning}
                        searchMode={searchMode === 'news' ? 'news' : 'organic'}
                        onToggleSearchMode={(m) => setSearchMode(m === 'news' ? 'news' : 'organic')}
                        selectedModel={selectedModel}
                        onSelectModel={(m) => setSelectedModel(m)}
                        placeholder="What do you want to know?"
                        autoFocus
                        theme={theme}
                        recentPrompts={currentSessionPrompts}
                        recentMessageItems={currentSessionMessageItems}
                        onSelectThread={handleSelectThread}
                        onSelectMessage={handleNavigateToHistoryMessage}
                        lastAssistantResponse={lastAssistantResponse}
                        messages={activeThread ? activeThread.messages : []}
                        isResearchMode={isResearchMode}
                        onToggleResearchMode={(enabled) => setIsResearchMode(enabled)}
                        onOpenDeepResearch={(topic) => {
                          UserAccountStore.recordDeepResearchRun();
                          setDeepResearchState({
                            isOpen: true,
                            initialTopic: topic,
                          });
                        }}
                        onOpenUrlReader={(url) =>
                          setUrlReaderState({ isOpen: true, initialUrl: url })
                        }
                        onOpenArxivReader={(payload) => {
                          UserAccountStore.recordPdfStudySession();
                          setPdfStudioState({
                            isOpen: true,
                            pdfUrl: payload?.pdfUrl,
                            pdfName: payload?.pdfName,
                            extractedText: payload?.extractedText,
                            initialTab: payload?.initialTab || 'quiz',
                          });
                        }}
                      />
                    </div>

                    {/* Minimalist footer */}
                    <div
                      className={`mt-2 text-center text-[10px] ${
                        isDark ? 'text-[#666666]' : 'text-[#8a8a8a]'
                      }`}
                    >
                      Zeno can make mistakes. Verify important information.
                    </div>
                  </div>
                </div>
              ) : (
                /* Active Thread State with message flow beneath floating prompt */
                <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
                  {/* Scrollable Messages Viewport with bottom padding so content flows beneath the floating composer */}
                  <div ref={messagesContainerRef} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 pb-36 scrollbar-thin">
                    <div className="pt-12 pb-3 max-w-3xl mx-auto w-full min-w-0">
                      {/* Shared Public Thread Read-Only Snapshot Banner */}
                      {sharedBannerId && activeThread && (
                        <div
                          className={`mt-10 mb-4 px-4 py-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                            isDark
                              ? 'bg-[#121212] border-white/15 text-neutral-200'
                              : 'bg-neutral-50 border-black/10 text-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Share2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">
                                Viewing Shared Conversation Snapshot: {activeThread.title}
                              </div>
                              <div className="text-[11px] opacity-60">
                                Public read-only link • You can continue asking follow-up questions below to fork this thread
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSharedBannerId(null);
                              try {
                                const url = new URL(window.location.href);
                                url.searchParams.delete('share');
                                window.history.replaceState({}, '', url.toString());
                              } catch {}
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                              isDark
                                ? 'bg-white text-black hover:bg-neutral-200'
                                : 'bg-black text-white hover:bg-neutral-800'
                            }`}
                          >
                            <GitFork className="w-3.5 h-3.5" />
                            <span>Fork & Continue Chatting</span>
                          </button>
                        </div>
                      )}

                      {messages.map((msg) => (
                        <GrokChatMessage
                          key={msg.id}
                          message={msg}
                          threadId={activeThread?.id}
                          threadTitle={activeThread?.title}
                          onRetry={(modelOverride) => handleRegenerateMessage(msg.id, modelOverride)}
                          onEdit={(content) => handleEditMessage(msg.id, content)}
                          onAskZeno={(prompt) => handleSend(prompt)}
                          onOpenShareStudio={(targetMsg, tab) =>
                            setShareStudioState({
                              isOpen: true,
                              initialTab: tab || 'quote',
                              quoteMessage: targetMsg,
                            })
                          }
                          onOpenKnowledgeVault={() =>
                            setGrowthHubState({ isOpen: true, initialTab: 'vault' })
                          }
                          theme={theme}
                          nsfwMode={nsfwMode}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Message Scroller (@kobra/message-scroller) */}
                  <MessageScroller
                    viewportRef={messagesContainerRef}
                    onScrollToBottom={handleScrollToBottom}
                    isDark={isDark}
                  />

                  {/* Absolute Floating Bottom Composer with no opaque background scrim */}
                  <div className="absolute bottom-0 inset-x-0 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 pointer-events-none z-20">
                    <div className="max-w-3xl mx-auto w-full pointer-events-auto">
                      <ChatInput
                        onSend={handleSend}
                        onCancel={handleCancel}
                        isRunning={isRunning}
                        searchMode={searchMode === 'news' ? 'news' : 'organic'}
                        onToggleSearchMode={(m) => setSearchMode(m === 'news' ? 'news' : 'organic')}
                        selectedModel={selectedModel}
                        onSelectModel={(m) => setSelectedModel(m)}
                        placeholder="What do you want to know?"
                        theme={theme}
                        recentPrompts={currentSessionPrompts}
                        recentMessageItems={currentSessionMessageItems}
                        onSelectThread={handleSelectThread}
                        onSelectMessage={handleNavigateToHistoryMessage}
                        lastAssistantResponse={lastAssistantResponse}
                        messages={activeThread ? activeThread.messages : []}
                        isResearchMode={isResearchMode}
                        onToggleResearchMode={(enabled) => setIsResearchMode(enabled)}
                        onOpenDeepResearch={(topic) => {
                          UserAccountStore.recordDeepResearchRun();
                          setDeepResearchState({
                            isOpen: true,
                            initialTopic: topic,
                          });
                        }}
                        onOpenUrlReader={(url) =>
                          setUrlReaderState({ isOpen: true, initialUrl: url })
                        }
                        onOpenArxivReader={(payload) => {
                          UserAccountStore.recordPdfStudySession();
                          setPdfStudioState({
                            isOpen: true,
                            pdfUrl: payload?.pdfUrl,
                            pdfName: payload?.pdfName,
                            extractedText: payload?.extractedText,
                            initialTab: payload?.initialTab || 'quiz',
                          });
                        }}
                      />

                      <div
                        className={`mt-1.5 text-center text-[10px] ${
                          isDark ? 'text-[#666666]' : 'text-[#8a8a8a]'
                        }`}
                      >
                        Zeno can make mistakes. Verify important information.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Shareable Public Thread Links & Export Studio Modal */}
          {shareStudioState.isOpen && (
            <ShareExportStudioModal
              isOpen={shareStudioState.isOpen}
              onClose={() => setShareStudioState({ isOpen: false })}
              thread={fallbackShareThread}
              initialQuoteMessage={shareStudioState.quoteMessage}
              initialTab={shareStudioState.initialTab}
              isDark={isDark}
            />
          )}

          {/* Full-Page Research & AI Answer View */}
          <DeepResearchModal
            isOpen={deepResearchState.isOpen}
            onClose={() => setDeepResearchState({ isOpen: false })}
            initialTopic={deepResearchState.initialTopic}
            selectedModelId={selectedModel.geminiModel}
            selectedModel={selectedModel}
            onSelectModel={(m) => setSelectedModel(m)}
            searchMode={searchMode === 'news' ? 'news' : 'organic'}
            onToggleSearchMode={(m) => setSearchMode(m === 'news' ? 'news' : 'organic')}
            isDark={isDark}
            onInsertReportToChat={(topic, reportMarkdown, sources, arxivPapers) => {
              const userMsg: ChatMessageType = {
                id: `user-${Date.now()}`,
                role: 'user',
                content: `Deep Research Report: ${topic}`,
                timestamp: Date.now(),
              };
              const assistantMsg: ChatMessageType = {
                id: `assistant-${Date.now() + 1}`,
                role: 'assistant',
                content: reportMarkdown,
                timestamp: Date.now() + 1,
                sources,
                arxivPapers,
                modelUsed: 'Zeno Deep Research Agent',
              };
              if (!activeThreadId) {
                const newId = `thread-${Date.now()}`;
                setThreads((prev) => [
                  {
                    id: newId,
                    title: `Research: ${topic.slice(0, 32)}`,
                    createdAt: Date.now(),
                    messages: [userMsg, assistantMsg],
                  },
                  ...prev,
                ]);
                setActiveThreadId(newId);
              } else {
                setThreads((prev) =>
                  prev.map((t) =>
                    t.id === activeThreadId
                      ? { ...t, messages: [...t.messages, userMsg, assistantMsg] }
                      : t
                  )
                );
              }
            }}
          />

          {/* URL / Website Reader & Page Summarizer Modal */}
          <PageExtractModal
            isOpen={urlReaderState.isOpen}
            onClose={() => setUrlReaderState({ isOpen: false })}
            url={urlReaderState.initialUrl || null}
            isDark={isDark}
            onChatWithPage={(_url, title, extractedMarkdown, userQuestion) => {
              handleSend(
                userQuestion
                  ? `${userQuestion}\n\nContext from "${title}":\n${extractedMarkdown.slice(0, 4000)}`
                  : `Summarize and analyze "${title}":\n${extractedMarkdown.slice(0, 4000)}`
              );
            }}
          />

          {/* Zeno Growth Hub Modal (Discover, Knowledge Vault, Weekly Brief, Zeno Passes) */}
          <ZenoGrowthHubModal
            isOpen={growthHubState.isOpen}
            onClose={() => setGrowthHubState((prev) => ({ ...prev, isOpen: false }))}
            initialTab={growthHubState.initialTab}
            threads={threads}
            onOpenArtifactPage={(artifact) => {
              setGrowthHubState((prev) => ({ ...prev, isOpen: false }));
              setPublicArtifactModal({
                isOpen: true,
                artifactId: artifact.id,
                initialArtifact: artifact,
              });
            }}
            onForkArtifactIntoChat={handleForkArtifactIntoChat}
            onContinueVaultItemInChat={handleContinueVaultItemInChat}
            isDark={isDark}
          />

          {/* Public Zeno Page Reader & Fork Modal (?artifact=<id>) */}
          <PublicArtifactView
            isOpen={publicArtifactModal.isOpen}
            artifactId={publicArtifactModal.artifactId}
            initialArtifact={publicArtifactModal.initialArtifact}
            onClose={() => {
              setPublicArtifactModal({ isOpen: false, artifactId: null, initialArtifact: null });
              try {
                const u = new URL(window.location.href);
                if (u.searchParams.has('artifact')) {
                  u.searchParams.delete('artifact');
                  window.history.replaceState({}, '', u.toString());
                }
              } catch {}
            }}
            onForkIntoChat={handleForkArtifactIntoChat}
            isDark={isDark}
          />

          {/* Full-Page PDF Upload, Quiz, Flashcards & ArXiv Study Studio */}
          <InbuiltPdfViewer
            isOpen={pdfStudioState.isOpen}
            onClose={() => setPdfStudioState({ isOpen: false })}
            pdfUrl={pdfStudioState.pdfUrl || 'https://arxiv.org/pdf/1706.03762.pdf'}
            pdfName={pdfStudioState.pdfName}
            title={pdfStudioState.pdfName || 'Attention Is All You Need'}
            arxivId={pdfStudioState.pdfName ? undefined : '1706.03762'}
            authors={
              pdfStudioState.pdfName
                ? undefined
                : ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit']
            }
            published={pdfStudioState.pdfName ? undefined : '2017-06-12'}
            extractedText={pdfStudioState.extractedText}
            initialTab={pdfStudioState.initialTab || 'quiz'}
            summary="We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Scaled dot-product attention computes the dot products of the query with all keys, divides each by the square root of the key dimension d_k to prevent vanishing gradients in the softmax, and applies a softmax function to obtain weights on the values. Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions in parallel. Because the Transformer contains no recurrence and no convolution, positional encodings using sine and cosine functions of different frequencies are added to the input embeddings to inject sequence order. On both WMT 2014 English-to-German and English-to-French translation benchmarks, the Transformer achieves state-of-the-art BLEU scores while requiring significantly less training time and enabling full parallelization across sequence tokens."
            isDark={isDark}
            onAskZeno={(prompt) => handleSend(prompt)}
          />

          {/* Quick Frictionless 3-Step Onboarding Modal */}
          <QuickOnboardingModal
            isOpen={isOnboardingOpen}
            onClose={() => setIsOnboardingOpen(false)}
            isDark={isDark}
            onComplete={() => {
              setUserProfile(UserAccountStore.getProfile());
              setUserSub(UserAccountStore.getSubscription());
            }}
          />

          {/* Full-Page Pricing & Plans Modal (Spark $1 · Fire $5 — 10x Limits on $1 Plan) */}
          <PricingModal
            isOpen={pricingModalState.isOpen}
            onClose={() => setPricingModalState((prev) => ({ ...prev, isOpen: false }))}
            initialHighlightPlan={pricingModalState.highlightPlan}
            limitReason={pricingModalState.limitReason}
            isDark={isDark}
          />
        </>
      )}

      {/* Daily Streak Reminder Notification / Toast */}
      <StreakReminderToast
        isDark={isDark}
        onQuickAction={(promptText) => {
          if (currentView !== 'chat') {
            setCurrentView('chat');
          }
          if (promptText) {
            handleSend(promptText);
          }
        }}
        onOpenStreakSettings={() => {
          setAccountPageTab('profile');
          setCurrentView('account');
        }}
      />

      {/* Achievement Unlocked Milestone & Badge Toast Notification System */}
      <AchievementToast isDark={isDark} />
    </div>
  );
}
