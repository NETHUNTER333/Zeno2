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
  VaultThreadType,
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
import { KinichGrowthHubModal, GrowthHubTab } from './components/KinichGrowthHubModal';
import { PublicArtifactView } from './components/PublicArtifactView';
import { StreakReminderToast } from './components/StreakReminderToast';
import { AchievementToast } from './components/AchievementToast';
import { DeleteThreadConfirmDialog, DeleteThreadTarget } from './components/DeleteThreadConfirmDialog';
import {
  captureReferralFromUrlIfPresent,
  claimPendingReferralIfEligible,
  trackGrowthEvent,
  KnowledgeVaultStore,
  AgentMemoryStore,
  VaultThreadStore,
} from './lib/growthStore';
import {
  captureInboundReferral,
  claimPendingReferralAfterAuth,
} from './lib/referralClient';
import {
  getStoredLocationPref,
  getEffectiveLocationPayload,
  ensureClientIpLocationResolved,
  detectAndSaveHomeCityFromText,
} from './lib/locationStore';
import { ModelRadiantBackground } from './components/ModelRadiantBackground';
import { PullToRefresh } from './components/PullToRefresh';
import {
  BackgroundGradientMode,
  getStoredBackgroundGradientMode,
  setStoredBackgroundGradientMode,
} from './lib/modelGradients';

import { Signup1 } from './components/ui/signup-1';
import {
  LegalAndInfoPages,
  LegalPageRoute,
  resolveLegalOr404Route,
  SiteFooter,
  GuestFirstPromptConsentModal,
  ReportContentModal,
  hasValidUserConsent,
} from './components/LegalAndInfoPages';
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

async function fetchKinichApi(path: string, init?: RequestInit): Promise<Response> {
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
      const saved = localStorage.getItem('kinich_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'dark';
  });

  const [threads, setThreads] = useState<SavedThread[]>(() => {
    try {
      const saved = localStorage.getItem('kinich_threads_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    try {
      const active = localStorage.getItem('kinich_active_thread');
      if (active) return active;
    } catch {}
    return null;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'account' | 'study'>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (
        p === '/study' ||
        p.startsWith('/study/') ||
        p === '/battle' ||
        p.startsWith('/battle/') ||
        p === '/snap-solve' ||
        p.startsWith('/snap-solve')
      ) {
        return 'study';
      }
      if (p === '/account' || p.startsWith('/account/') || p === '/settings' || p.startsWith('/settings/')) {
        return 'account';
      }
    }
    return 'chat';
  });
  const [activeStudyVideo, setActiveStudyVideo] = useState<YouTubeVideoInfo | null>(null);
  const [accountPageTab, setAccountPageTab] = useState<AccountTab>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/settings/billing')) {
      return 'pricing';
    }
    return 'profile';
  });
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(() => UserAccountStore.getProfile());
  const [userSub, setUserSub] = useState(() => UserAccountStore.getSubscription());
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('organic');
  const [selectedModel, setSelectedModel] = useState<ModelOption>(GROK_MODELS[0]);
  const [bgGradientMode, setBgGradientMode] = useState<BackgroundGradientMode>(() =>
    getStoredBackgroundGradientMode()
  );
  const handleSelectBgGradientMode = (mode: BackgroundGradientMode) => {
    setBgGradientMode(mode);
    setStoredBackgroundGradientMode(mode);
  };
  // SafeSearch is permanently active and enforced (adult/NSFW content strictly blocked)
  const nsfwMode = false;
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
    initialThreadId?: string | null;
  }>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const lower = p.toLowerCase();
      if (lower === '/vault' || lower.startsWith('/vault/')) {
        const parts = p.split('/').filter(Boolean);
        const tid = parts.length > 1 ? decodeURIComponent(parts[1]) : null;
        return { isOpen: true, initialTab: 'vault', initialThreadId: tid };
      }
      if (lower === '/discover' || lower.startsWith('/discover/')) {
        return { isOpen: true, initialTab: 'discover', initialThreadId: null };
      }
    }
    return { isOpen: false, initialTab: 'discover', initialThreadId: null };
  });
  const [guestAuthModal, setGuestAuthModal] = useState<{
    isOpen: boolean;
    reason: string;
  }>({ isOpen: false, reason: 'Sign in to keep this in your Vault' });
  const [guestAuthEmail, setGuestAuthEmail] = useState('');
  const [guestAuthPassword, setGuestAuthPassword] = useState('');
  const [guestAuthBusy, setGuestAuthBusy] = useState(false);
  const [guestAuthError, setGuestAuthError] = useState<string | null>(null);
  const [showEmailFormInModal, setShowEmailFormInModal] = useState(false);
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
  }>(() => {
    const isPricingRoute =
      typeof window !== 'undefined' &&
      (window.location.pathname.toLowerCase() === '/pricing' ||
        window.location.pathname.toLowerCase().startsWith('/pricing/'));
    return { isOpen: isPricingRoute, highlightPlan: undefined, limitReason: null };
  });
  const [sharedBannerId, setSharedBannerId] = useState<string | null>(null);

  const [isSignedIn, setIsSignedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (
        p === '/study' ||
        p.startsWith('/study/') ||
        p === '/battle' ||
        p.startsWith('/battle/') ||
        p === '/vault' ||
        p.startsWith('/vault/') ||
        p === '/pricing' ||
        p.startsWith('/pricing/') ||
        p === '/research' ||
        p.startsWith('/research/') ||
        p === '/discover' ||
        p.startsWith('/discover/') ||
        p.startsWith('/share/') ||
        p.startsWith('/p/')
      ) {
        return true;
      }
    }
    return UserAccountStore.isUserSignedIn();
  });
  const [legalOr404Route, setLegalOr404Route] = useState<LegalPageRoute | null>(() =>
    typeof window !== 'undefined' ? resolveLegalOr404Route(window.location.pathname) : null
  );
  const [pendingConsentPrompt, setPendingConsentPrompt] = useState<{
    promptText: string;
    mode: SearchMode;
    attachments: any[];
  } | null>(null);

  const [billingReturnState, setBillingReturnState] = useState<{
    isOpen: boolean;
    subscriptionId: string | null;
    urlStatus: string | null;
    pollingStatus: 'polling' | 'activated' | 'timeout';
    activatedPlan: string | null;
    billingCountry: string;
  }>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/billing/return')) {
      const sp = new URLSearchParams(window.location.search);
      let savedCountry = 'US';
      try {
        savedCountry = localStorage.getItem('kinich_billing_country') || 'US';
      } catch {}
      return {
        isOpen: true,
        subscriptionId: sp.get('subscription_id'),
        urlStatus: sp.get('status'),
        pollingStatus: 'polling',
        activatedPlan: null,
        billingCountry: savedCountry,
      };
    }
    return {
      isOpen: false,
      subscriptionId: null,
      urlStatus: null,
      pollingStatus: 'polling',
      activatedPlan: null,
      billingCountry: 'US',
    };
  });

  useEffect(() => {
    if (!billingReturnState.isOpen || billingReturnState.pollingStatus !== 'polling') return;
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch('/api/billing/me', { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          if (data?.billingCountry) {
            setBillingReturnState((prev) => ({ ...prev, billingCountry: data.billingCountry }));
          }
          // NEVER grant access from URL params — ONLY when verified server state (updated by webhook) is active
          if (
            data?.authenticated &&
            data?.planStatus === 'active' &&
            (data?.effectivePlan === 'spark' || data?.effectivePlan === 'fire')
          ) {
            UserAccountStore.upgradePlan(
              data.effectivePlan,
              data.planInterval === 'yearly' ? 'yearly' : 'monthly'
            );
            setUserSub(UserAccountStore.getSubscription());
            setBillingReturnState((prev) => ({
              ...prev,
              pollingStatus: 'activated',
              activatedPlan: data.effectivePlan,
            }));
            return;
          }
        }
      } catch {}

      if (Date.now() - startedAt >= 60_000) {
        if (!cancelled) {
          setBillingReturnState((prev) => ({ ...prev, pollingStatus: 'timeout' }));
        }
      }
    };

    void poll();
    const intervalId = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [billingReturnState.isOpen, billingReturnState.pollingStatus]);

  const syncViewFromPathname = (pathname: string) => {
    const clean = (pathname || '/').toLowerCase();
    if (
      clean === '/study' ||
      clean.startsWith('/study/') ||
      clean === '/battle' ||
      clean.startsWith('/battle/') ||
      clean === '/snap-solve' ||
      clean.startsWith('/snap-solve')
    ) {
      setIsSignedIn(true);
      setCurrentView('study');
      document.title = clean.startsWith('/battle')
        ? 'Quiz Battle Arena · Kinich'
        : clean.startsWith('/snap-solve')
        ? 'Snap & Solve · Kinich'
        : 'YouTube Study Workspace · Kinich';
    } else if (clean.startsWith('/settings/billing')) {
      setAccountPageTab('pricing');
      setCurrentView('account');
      document.title = 'Billing & Subscription · Kinich';
    } else if (clean.startsWith('/billing/return')) {
      const sp = new URLSearchParams(window.location.search);
      setBillingReturnState((prev) => ({
        ...prev,
        isOpen: true,
        subscriptionId: sp.get('subscription_id'),
        urlStatus: sp.get('status'),
        pollingStatus: 'polling',
      }));
      document.title = 'Activating Your Plan · Kinich';
    } else if (clean === '/account' || clean.startsWith('/account/') || clean === '/settings' || clean.startsWith('/settings/')) {
      setCurrentView('account');
      document.title = 'Account & Settings · Kinich';
    } else if (clean === '/pricing' || clean.startsWith('/pricing/')) {
      setIsSignedIn(true);
      setPricingModalState({ isOpen: true, highlightPlan: undefined, limitReason: null });
      document.title = 'Plans & Pricing · Kinich';
    } else if (clean === '/research' || clean.startsWith('/research/')) {
      setIsSignedIn(true);
      setDeepResearchState({ isOpen: true });
      document.title = 'Deep Research · Kinich';
    } else if (clean === '/discover' || clean.startsWith('/discover/')) {
      setIsSignedIn(true);
      setGrowthHubState({ isOpen: true, initialTab: 'discover', initialThreadId: null });
      document.title = 'Discover Public Research · Kinich';
    } else if (clean === '/vault' || clean.startsWith('/vault/')) {
      setIsSignedIn(true);
      const parts = (pathname || '').split('/').filter(Boolean);
      const tid = parts.length > 1 ? decodeURIComponent(parts[1]) : null;
      setGrowthHubState({ isOpen: true, initialTab: 'vault', initialThreadId: tid });
      document.title = 'The Vault · Kinich';
    } else if (clean === '/' || clean === '/chat' || clean.startsWith('/chat/')) {
      setCurrentView('chat');
      document.title = 'Kinich — Deep Research, Real-Time Web Search & YouTube Study Workspace';
    }
  };

  useEffect(() => {
    void ensureClientIpLocationResolved();
  }, []);

  useEffect(() => {
    if (legalOr404Route) return;
    const clean = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '/';
    if (
      currentView === 'study' ||
      clean === '/study' ||
      clean.startsWith('/study/') ||
      clean === '/snap-solve' ||
      clean.startsWith('/snap-solve')
    ) {
      document.title = clean.startsWith('/snap-solve')
        ? 'Snap & Solve · Kinich'
        : 'YouTube Study Workspace · Kinich';
    } else if (currentView === 'account' || clean === '/account' || clean === '/settings') {
      document.title = 'Account & Settings · Kinich';
    } else if (clean === '/pricing' || clean.startsWith('/pricing/')) {
      document.title = 'Plans & Pricing · Kinich';
    } else if (clean === '/research' || clean.startsWith('/research/')) {
      document.title = 'Deep Research · Kinich';
    } else if (clean === '/discover' || clean.startsWith('/discover/')) {
      document.title = 'Discover Public Research · Kinich';
    } else if (clean === '/vault' || clean.startsWith('/vault/')) {
      document.title = 'The Vault · Kinich';
    } else {
      document.title = 'Kinich — Deep Research, Real-Time Web Search & YouTube Study Workspace';
    }
  }, [currentView, legalOr404Route]);

  const navigateRoute = (path: string) => {
    try {
      window.history.pushState({}, '', path);
      setLegalOr404Route(resolveLegalOr404Route(window.location.pathname));
      syncViewFromPathname(window.location.pathname);
    } catch {
      window.location.href = path;
    }
  };

  useEffect(() => {
    const onPopState = () => {
      setLegalOr404Route(resolveLegalOr404Route(window.location.pathname));
      syncViewFromPathname(window.location.pathname);
    };
    const onLegalNav = (e: Event) => {
      const targetPath = (e as CustomEvent)?.detail?.path;
      if (typeof targetPath === 'string') {
        navigateRoute(targetPath);
      }
    };
    const onOpenVaultEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      setGrowthHubState({
        isOpen: true,
        initialTab: 'vault',
        initialThreadId: detail.threadId || null,
      });
    };
    const onOpenAuthEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      setGuestAuthError(null);
      setShowEmailFormInModal(false);
      setGuestAuthModal({
        isOpen: true,
        reason: detail.reason || detail.message || 'Sign in to keep this in your Vault',
      });
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('kinich-navigate-route', onLegalNav);
    window.addEventListener('kinich-open-vault', onOpenVaultEvent);
    window.addEventListener('kinich-open-auth', onOpenAuthEvent);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('kinich-navigate-route', onLegalNav);
      window.removeEventListener('kinich-open-vault', onOpenVaultEvent);
      window.removeEventListener('kinich-open-auth', onOpenAuthEvent);
    };
  }, []);

  // Listen for global 'kinich-open-pricing' events from ChatInput, GrokModelPicker, Sidebar, etc.
  useEffect(() => {
    const handleOpenPricing = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      setPricingModalState({
        isOpen: true,
        highlightPlan: detail.highlightPlan,
        limitReason: detail.reason || null,
      });
    };
    window.addEventListener('kinich-open-pricing', handleOpenPricing);
    return () => window.removeEventListener('kinich-open-pricing', handleOpenPricing);
  }, []);

  // Load Public Shared Thread snapshot (?share=), Public Kinich Page (?artifact=), and Referral attribution (?ref=)
  useEffect(() => {
    try {
      captureReferralFromUrlIfPresent();
      captureInboundReferral();
      trackGrowthEvent('returning_session_started');
      const params = new URLSearchParams(window.location.search);

      const artifactId = params.get('artifact')?.trim();
      if (artifactId) {
        // Public Kinich Pages are accessible without forcing signup
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
          localStorage.setItem('kinich_auth_session', 'true');
          localStorage.removeItem('kinich_explicit_signout');
        } catch {}
        // Automatically claim any captured pending referral code (cookie or localStorage) for this authenticated user
        claimPendingReferralAfterAuth(user.uid, user.email || '').catch((e) => {
          console.warn('[Referral] Auto-claim on auth state change failed:', e);
        });
        try {
          const remoteThreads = await loadUserChatThreadsFromFirestore();
          if (Array.isArray(remoteThreads) && remoteThreads.length > 0) {
            setThreads((prev) => {
              const map = new Map<string, SavedThread>();
              prev.forEach((t) => map.set(t.id, t));
              remoteThreads.forEach((rt: any) => {
                if (rt && rt.id && Array.isArray(rt.messages)) {
                  const existingLocal = map.get(rt.id);
                  if (!existingLocal || existingLocal.messages.length === 0) {
                    map.set(rt.id, {
                      id: rt.id,
                      title: rt.title || 'New Chat',
                      createdAt: rt.createdAt || Date.now(),
                      messages: rt.messages,
                    });
                  }
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
          if (localStorage.getItem('kinich_explicit_signout') === 'true') {
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
        if (localStorage.getItem('kinich_explicit_signout') === 'true') {
          setIsSignedIn(false);
          return;
        }
      } catch {}
      if (UserAccountStore.isUserSignedIn()) {
        setIsSignedIn(true);
      }
    };
    window.addEventListener('kinich-account-updated', handleAccountSync);
    return () => window.removeEventListener('kinich-account-updated', handleAccountSync);
  }, []);

  useEffect(() => {
    const handleOpenStudyWorkspace = (e: any) => {
      if (e?.detail?.video) {
        setActiveStudyVideo(e.detail.video);
      }
      setCurrentView('study');
    };
    window.addEventListener('kinich-open-study-workspace', handleOpenStudyWorkspace);
    return () => window.removeEventListener('kinich-open-study-workspace', handleOpenStudyWorkspace);
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
        title: 'Kinich Research Session',
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
      localStorage.setItem('kinich_theme', theme);
    } catch {}

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Clean up any legacy NSFW Mode from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('kinich_nsfw_mode');
    } catch {}
  }, []);

  // Attach Sage's AgentReplyCard directly to the chat thread message when "Save to Vault" completes
  useEffect(() => {
    const handleSageOrganized = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const agentReply = detail?.result?.agentReply;
      const sourceMessageId = detail?.item?.sourceMessageId;
      if (!agentReply) return;

      setThreads((prev) =>
        prev.map((t) => ({
          ...t,
          messages: t.messages.map((m, idx, arr) => {
            const isTargetMsg =
              (sourceMessageId && m.id === sourceMessageId) ||
              (!sourceMessageId &&
                t.id === activeThreadId &&
                m.role === 'assistant' &&
                idx === arr.length - 1);
            if (!isTargetMsg) return m;
            const prevReplies = Array.isArray(m.agentReplies)
              ? m.agentReplies
              : m.agentReply
              ? [m.agentReply]
              : [];
            const deduped = [
              ...prevReplies.filter((r) => r.agentId !== agentReply.agentId),
              agentReply,
            ];
            return {
              ...m,
              agentReply: deduped[0],
              agentReplies: deduped,
            };
          }),
        }))
      );
    };
    window.addEventListener('kinich-sage-organized', handleSageOrganized);
    return () => window.removeEventListener('kinich-sage-organized', handleSageOrganized);
  }, [activeThreadId]);

  // Persist threads to localStorage & Firebase Firestore
  useEffect(() => {
    try {
      localStorage.setItem('kinich_threads_v2', JSON.stringify(threads));
      if (activeThreadId) {
        localStorage.setItem('kinich_active_thread', activeThreadId);
      } else {
        localStorage.removeItem('kinich_active_thread');
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
    const rawFullText = (data.text || '').replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: t.messages.map((m) => {
                if (m.id !== messageId) return m;
                const existingSources = Array.isArray(m.sources) ? m.sources : [];
                const incomingSources = Array.isArray(data.sources) ? data.sources : [];

                // Prioritize incomingSources from /api/chat because the answer's [1]..[N] citations were generated against incomingSources
                const baseSources = incomingSources.length > 0 ? incomingSources : existingSources;

                // Renumber inline citations in rawFullText by order of first appearance and reorder baseSources to match
                let finalText = rawFullText;
                let finalSources = baseSources;
                if (finalText && baseSources.length > 0) {
                  // Ensure bullet points or substantive paragraphs have inline [1]..[N] citations when sources exist
                  if (!/\[\d{1,2}\](?!\()/.test(finalText)) {
                    let citeCounter = 0;
                    const lines: string[] = String(finalText).split(/\r?\n/);
                    const hasBullets = lines.some((l: string) => /^(\s*[-*•]|\s*\d+\.)\s+/.test(l));
                    finalText = lines
                      .map((line: string) => {
                        const trimmed = line.trim();
                        if (!trimmed || /^#{1,6}\s/.test(trimmed) || trimmed.startsWith('```')) return line;
                        if (hasBullets) {
                          if (/^([-*•]|\d+\.)\s+/.test(trimmed) && !/\[\d{1,2}\]/.test(trimmed)) {
                            const num = (citeCounter++ % baseSources.length) + 1;
                            return `${line.replace(/([.!?])?\s*$/, (_m, p) => p || '.')} [${num}]`;
                          }
                          return line;
                        }
                        if (trimmed.length > 45 && !trimmed.endsWith(':') && !/\[\d{1,2}\]/.test(trimmed)) {
                          const num = (citeCounter++ % baseSources.length) + 1;
                          return `${line.replace(/([.!?])?\s*$/, (_m, p) => p || '.')} [${num}]`;
                        }
                        return line;
                      })
                      .join('\n');
                  }

                  const oldToNew = new Map<number, number>();
                  const ordered: any[] = [];
                  const usedIdx = new Set<number>();

                  const segments = finalText.split(/(```[\s\S]*?```)/g);
                  for (const seg of segments) {
                    if (seg.startsWith('```')) continue;
                    const citeRe = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?!\()/g;
                    let match: RegExpExecArray | null;
                    while ((match = citeRe.exec(seg)) !== null) {
                      for (const part of match[1].split(',')) {
                        const oldNum = parseInt(part.trim(), 10);
                        if (isNaN(oldNum) || oldNum < 1 || oldToNew.has(oldNum)) continue;
                        const idx =
                          baseSources.findIndex((s: any, i: number) => (s?.position ?? i + 1) === oldNum) !== -1
                            ? baseSources.findIndex((s: any, i: number) => (s?.position ?? i + 1) === oldNum)
                            : oldNum <= baseSources.length
                            ? oldNum - 1
                            : -1;
                        if (idx !== -1) {
                          const newNum = ordered.length + 1;
                          oldToNew.set(oldNum, newNum);
                          usedIdx.add(idx);
                          ordered.push({ ...baseSources[idx], position: newNum });
                        }
                      }
                    }
                  }

                  if (oldToNew.size > 0) {
                    baseSources.forEach((s: any, idx: number) => {
                      if (!usedIdx.has(idx)) {
                        ordered.push({ ...s, position: ordered.length + 1 });
                      }
                    });
                    finalSources = ordered;
                    finalText = segments
                      .map((seg: string) => {
                        if (seg.startsWith('```')) return seg;
                        return seg.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?!\()/g, (_m: string, listStr: string) => {
                          const mapped: number[] = [];
                          for (const p of listStr.split(',')) {
                            const oldNum = parseInt(p.trim(), 10);
                            const newNum = oldToNew.get(oldNum) ?? oldNum;
                            if (!mapped.includes(newNum)) mapped.push(newNum);
                          }
                          return mapped.map((n) => `[${n}]`).join('');
                        });
                      })
                      .join('');
                  } else {
                    finalSources = baseSources.map((s: any, idx: number) => ({ ...s, position: idx + 1 }));
                  }
                }

                return {
                  ...m,
                  content: finalText,
                  sources: finalSources.length > 0 ? finalSources : undefined,
                  sourcesNotLinked: false,
                  images: Array.isArray(data.images) && data.images.length > 0 ? data.images : undefined,
                  personaWiki: data.personaWiki || undefined,
                  videos: Array.isArray(data.videos) && data.videos.length > 0 ? data.videos : undefined,
                  arxivPapers: Array.isArray(data.arxivPapers) && data.arxivPapers.length > 0 ? data.arxivPapers : undefined,
                  githubRepos: Array.isArray(data.githubRepos) && data.githubRepos.length > 0 ? data.githubRepos : undefined,
                  xPosts: Array.isArray(data.xPosts) && data.xPosts.length > 0 ? data.xPosts : undefined,
                  searchQueries:
                    Array.isArray(data.searchQueries) && data.searchQueries.length > 0
                      ? data.searchQueries
                      : m.searchQueries,
                  toolsUsed: Array.isArray(data.toolsUsed) && data.toolsUsed.length > 0 ? data.toolsUsed : undefined,
                  timing: data.timing,
                  modelUsed: m.modelUsed || data.modelUsed,
                  isStreaming: false,
                };
              }),
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
      modelUsed: artifact.modelUsed || 'Kinich Synthesis',
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
      modelUsed: 'Kinich Knowledge Vault',
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
    attachments: any[] = [],
    bypassConsentGate = false
  ) => {
    const query = promptText.trim();
    if (!query || isRunning) return;

    // Automatically detect and persist home city if user states where they live (e.g. "I live in Ramagundam, Telangana")
    detectAndSaveHomeCityFromText(query);

    // 1. Check daily prompt/message limit and file upload limit
    const currentUsage = UserAccountStore.getUsage();
    const currentPlanNorm = UserAccountStore.getNormalizedPlan();
    if (currentUsage.messagesUsed >= currentUsage.messageLimit) {
      setPricingModalState({
        isOpen: true,
        highlightPlan: currentPlanNorm === 'free' ? 'spark' : 'fire',
        limitReason: `Daily message limit reached (${currentUsage.messagesUsed}/${currentUsage.messageLimit} prompts used). Upgrade to Spark ($3/mo) for 1,500 messages/day or Fire ($7/mo) for 5,000 messages/day.`,
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
        limitReason: `File upload limit reached (${currentUsage.filesUploaded}/${currentUsage.fileUploadLimit} files used on your plan). Upgrade to Spark ($3/mo) for 250 uploads/day or Fire ($7/mo) for 1,000 uploads/day.`,
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

    // Auto-capture as a Vault Study Thread for signed-in users (Deduplicated, 5-10 key points, IST timestamp, agent comments)
    if (!UserAccountStore.isGuestUser() && !isCasualOrGreeting) {
      let detectedType: VaultThreadType = 'text';
      let detectedUrl: string | undefined = undefined;

      const ytMatch = query.match(
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
      );
      const urlMatch = query.match(/https?:\/\/[^\s]+/i);

      if (hasImageAtt) {
        detectedType = 'image';
      } else if (attachments.some((a) => a?.type?.includes('pdf') || a?.name?.endsWith('.pdf'))) {
        detectedType = 'pdf';
      } else if (ytMatch) {
        detectedType = 'youtube';
        detectedUrl = ytMatch[0];
      } else if (urlMatch) {
        detectedType = 'web_link';
        detectedUrl = urlMatch[0];
      } else {
        detectedType = 'text';
      }

      VaultThreadStore.autoCapture({
        content: query,
        inputType: detectedType,
        sourceUrl: detectedUrl,
      }).catch(() => {});
    }

    const allPriorMessages = activeThread ? activeThread.messages : [];

    // Rewrite follow-up questions into a standalone search query using conversation context
    const rewriteFollowUpIntoStandaloneQuery = (
      rawQ: string,
      priorMsgs: ChatMessageType[]
    ): string => {
      if (!priorMsgs || priorMsgs.length === 0) return rawQ;
      const priorUserMsgs = priorMsgs
        .filter((m) => m.role === 'user' && m.content && m.content.trim().length > 2)
        .map((m) => stripInjectedClockNote(m.content).trim());
      if (priorUserMsgs.length === 0) return rawQ;

      const lastUserTopic = priorUserMsgs[priorUserMsgs.length - 1]
        .replace(
          /\b(show\s+me\s+|fetch\s+|find\s+|get\s+|search\s+for\s+)?(images?|imgs?|photos?|pics?|pictures?|wallpapers?|gallery|portraits?)\s+(of|for|from|about)?\s*/gi,
          ' '
        )
        .replace(/[?!.]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!lastUserTopic) return rawQ;

      const qNoTemporal = rawQ.replace(
        /\b(this|these|that|those)\s+(week|month|year|morning|afternoon|evening|night|weekend|quarter|season|days?)\b/gi,
        ' '
      );
      const isReferentialFollowUp =
        /\b(which\s+one|which\s+of|what\s+about|how\s+about|why\s+is\s+that|why\s+does|how\s+does\s+it|how\s+do\s+they|it|its|they|them|their|these|those|that\s+one|this\s+one|same\s+one|of\s+these|of\s+those|among\s+them|between\s+them|the\s+first|the\s+second|the\s+third|compare\s+them|for\s+developers)\b/i.test(
          qNoTemporal
        ) || /^(which|why|what\s+about|how\s+about|and\s+|so\s+|also\s+)/i.test(rawQ.trim());

      const topicWords = lastUserTopic
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length >= 2 && !/^(what|which|when|where|who|how|why|the|and|for|from|with|this|that)$/.test(w));
      const alreadyHasTopic =
        topicWords.length > 0 &&
        topicWords.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(rawQ));

      if (!isReferentialFollowUp || alreadyHasTopic) {
        return rawQ;
      }

      // E.g. "which one matters most for developers?" after "AI news this week" -> "most important AI news this week for developers"
      if (/\bwhich\s+one\s+matters\s+most\b/i.test(rawQ)) {
        const remainder = rawQ
          .replace(/^.*?\bwhich\s+one\s+matters\s+most\b/i, '')
          .replace(/[?!.]+$/g, '')
          .trim();
        return `most important ${lastUserTopic} ${remainder}`.replace(/\s+/g, ' ').trim();
      }

      const cleanedFollowUp = rawQ
        .replace(/\b(which\s+one|that\s+one|this\s+one|of\s+these|of\s+those|among\s+them)\b/gi, lastUserTopic)
        .replace(/[?!.]+$/g, '')
        .trim();

      if (cleanedFollowUp.toLowerCase().includes(lastUserTopic.toLowerCase())) {
        return cleanedFollowUp;
      }
      return `${lastUserTopic} ${cleanedFollowUp}`.replace(/\s+/g, ' ').slice(0, 120).trim();
    };

    const standaloneSearchQuery = rewriteFollowUpIntoStandaloneQuery(query, allPriorMessages);

    const isClockQuery = isDateOrTimeClockQuery(query);
    const isNewsQuery =
      /\b(news|headlines|happened|update|updates|this\s+week|today'?s\s+news|latest\s+news|breaking)\b/i.test(
        standaloneSearchQuery
      );
    const effectiveMode: SearchMode = isResearchMode
      ? 'organic'
      : mode === 'news' || isNewsQuery
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
      searchQueries: computedLoadingMode === 'search' ? [standaloneSearchQuery] : undefined,
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
        fetchKinichApi('/api/search/live', {
          method: 'POST',
          headers: authHeaders,
          signal: controller.signal,
          body: JSON.stringify({
            query: standaloneSearchQuery,
            searchMode: effectiveMode,
            nsfwMode,
            isResearchMode,
            location: getEffectiveLocationPayload(),
            clientClock: getClientRealTimeClock(),
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
      const authHeaders = await getAuthHeaders();
      const clientClock = getClientRealTimeClock();
      const userPersonalization = UserAccountStore.getPersonalization();
      const clockSystemPrompt = buildClientClockSystemDirective(
        clientClock,
        query,
        userPersonalization?.preferredLanguage
      );
      const response = await fetchKinichApi('/api/chat', {
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
            const isLastUserMsg = idx === arr.length - 1 && m.role === 'user';
            return {
              role: m.role,
              content:
                isLastUserMsg && isClockQuery
                  ? `${cleanContent}\n\n[VERIFIED REAL-TIME DEVICE CLOCK: Today is ${clientClock.localDateOnly} and the current local time is ${clientClock.localTimeOnly} / UTC: ${clientClock.utcFull}. State BOTH this exact real-time date and time, and do NOT agree if the user claims today is a different date.]`
                  : cleanContent,
              attachments: m.attachments,
              sources: m.role === 'assistant' && Array.isArray(m.sources) ? m.sources.slice(0, 6) : undefined,
            };
          }),
          searchQuery: standaloneSearchQuery,
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
          location: getEffectiveLocationPayload(),
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

      // Personal Study Agent Router (on_message): cheap router checks if an agent (Doubt Buddy, Planner, Recall, Sage) should respond
      const activePlanTier = UserAccountStore.getNormalizedPlan();
      if (activePlanTier !== 'free' && !controller.signal.aborted) {
        const memoryCitations = VaultThreadStore.searchMemoryCitations(query);
        fetchKinichApi('/api/agents/on-message', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            message: query,
            tier: activePlanTier,
            vaultItems: KnowledgeVaultStore.getAll().slice(0, 30),
            memoryByAgent: AgentMemoryStore.getAllMemories(),
            memoryCitations,
          }),
        })
          .then((r) => r.json())
          .then((agentRes) => {
            if (agentRes?.acted && agentRes?.agentReply) {
              if (Array.isArray(agentRes.memoryUpdated) && agentRes.agentReply.agentId) {
                AgentMemoryStore.setFacts(agentRes.agentReply.agentId, agentRes.memoryUpdated);
              }
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === currentThreadId
                    ? {
                        ...t,
                        messages: t.messages.map((m) => {
                          if (m.id !== streamingMessage.id) return m;
                          const prevReplies = Array.isArray(m.agentReplies)
                            ? m.agentReplies
                            : m.agentReply
                            ? [m.agentReply]
                            : [];
                          const nextReplies = [
                            ...prevReplies.filter(
                              (r) => r.agentId !== agentRes.agentReply.agentId
                            ),
                            agentRes.agentReply,
                          ];
                          return {
                            ...m,
                            agentReply: nextReplies[0],
                            agentReplies: nextReplies,
                          };
                        }),
                      }
                    : t
                )
              );
            }
          })
          .catch(() => {});
      }
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

  const [pendingDeleteThread, setPendingDeleteThread] = useState<DeleteThreadTarget | null>(null);

  const handleDeleteThread = (threadId: string) => {
    const target = threads.find((t) => t.id === threadId);
    setPendingDeleteThread({
      id: threadId,
      title: target?.title || 'Untitled conversation',
      messageCount: target?.messages?.length || 0,
    });
  };

  const confirmDeleteThread = (threadId: string) => {
    setPendingDeleteThread(null);
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
    localStorage.removeItem('kinich_threads_v2');
    localStorage.removeItem('kinich_active_thread');
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

    // Set existing assistant message to streaming state in-place, clearing any previous media/gallery
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
                      personaWiki: undefined,
                      videos: undefined,
                      arxivPapers: undefined,
                      githubRepos: undefined,
                      xPosts: undefined,
                      searchQueries: undefined,
                      toolsUsed: undefined,
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
      const isRegenCasualOrGreeting =
        /^[\p{Extended_Pictographic}\p{Emoji}\s\u200d\ufe0f👋✋✌️🙌🤝✨💌🎉❤️]+$/u.test(regenQuery.trim()) ||
        /^(hi+|hey+|hello+|yo+|sup|wassup|whats up|howdy|greetings|good (morning|afternoon|evening|night)|how are you|thanks|thank you|thx|ty|ok|okay|k|cool|nice|great|awesome|got it|wave|hand wave|waving|bye|cya)$/i.test(
          regenQuery.trim().toLowerCase()
        );

      const response = await fetchKinichApi('/api/chat', {
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
          webSearch: isRegenClockQuery || isRegenCasualOrGreeting ? false : true,
          isRegenerate: true,
          searchMode: searchMode === 'news' ? 'news' : 'organic',
          model: targetModel.geminiModel,
          nsfwMode,
          clientClock,
          location: getEffectiveLocationPayload(),
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
      // Do not keep or re-attach the old image gallery when refreshing a reply
      data.images = undefined;
      data.personaWiki = undefined;

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
            personaWiki: undefined,
            videos: undefined,
            arxivPapers: undefined,
            githubRepos: undefined,
            xPosts: undefined,
            searchQueries: undefined,
            toolsUsed: undefined,
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
      const isEditClockQ = isDateOrTimeClockQuery(query);
      const isEditCasual =
        /^[\p{Extended_Pictographic}\p{Emoji}\s\u200d\ufe0f👋✋✌️🙌🤝✨💌🎉❤️]+$/u.test(query.trim()) ||
        /^(hi+|hey+|hello+|yo+|sup|wassup|whats up|howdy|greetings|good (morning|afternoon|evening|night)|how are you|thanks|thank you|thx|ty|ok|okay|k|cool|nice|great|awesome|got it|wave|hand wave|waving|bye|cya)$/i.test(
          query.trim().toLowerCase()
        );
      const response = await fetchKinichApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          messages: contextMessages.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
          webSearch: isEditClockQ || isEditCasual ? false : true,
          searchMode: searchMode === 'news' ? 'news' : 'organic',
          model: selectedModel.geminiModel,
          nsfwMode,
          clientClock,
          location: getEffectiveLocationPayload(),
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
      className={`app-viewport-shell relative isolate flex h-[100dvh] w-full max-w-[100vw] overflow-hidden font-sans select-text transition-colors duration-200 ${
        isDark
          ? bgGradientMode === 'off'
            ? 'bg-[#000000] text-white'
            : 'text-white'
          : bgGradientMode === 'off'
          ? 'bg-[#ffffff] text-[#000000]'
          : 'text-[#000000]'
      }`}
    >
      <PullToRefresh isDark={isDark} />
      <ModelRadiantBackground
        modelId={selectedModel.id}
        theme={theme}
        mode={bgGradientMode}
      />
      {legalOr404Route ? (
        <div className="flex-1 w-full h-full overflow-y-auto relative z-10">
          <LegalAndInfoPages
            route={legalOr404Route}
            onNavigate={(path) => navigateRoute(path)}
            isDark={isDark}
          />
        </div>
      ) : !isSignedIn ? (
        <Signup1 isDark={isDark} onSuccess={() => setIsSignedIn(true)} />
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
                highlightPlan,
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
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative z-10">
              <AccountWorkspacePage
                onBackToChat={() => {
                  if (typeof window !== 'undefined' && window.location.pathname !== '/') {
                    window.history.pushState({}, '', '/');
                  }
                  setCurrentView('chat');
                }}
                initialTab={accountPageTab}
                threads={threads}
                theme={theme}
                onThemeChange={(newTheme) => setTheme(newTheme)}
                selectedModel={selectedModel}
                onSelectModel={(newModel) => setSelectedModel(newModel)}
                webSearchDefault={searchMode !== 'off'}
                onToggleWebSearchDefault={(enabled) => setSearchMode(enabled ? 'organic' : 'off')}
                nsfwMode={false}
                onClearAllHistory={handleClearAllHistory}
                onSelectThread={handleSelectThread}
                onDeleteThread={handleDeleteThread}
                bgGradientMode={bgGradientMode}
                onSelectBgGradientMode={handleSelectBgGradientMode}
              />
            </div>
          ) : currentView === 'study' ? (
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative z-10">
              <StudyWorkspace
                initialVideo={activeStudyVideo}
                onBackToChat={() => {
                  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/study')) {
                    window.history.pushState({}, '', '/');
                  }
                  setCurrentView('chat');
                }}
                isDark={isDark}
                onAskKinich={(prompt) => {
                  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/study')) {
                    window.history.pushState({}, '', '/');
                  }
                  setCurrentView('chat');
                  handleSend(prompt);
                }}
                onOpenPricing={(highlightPlan, reason) =>
                  setPricingModalState({
                    isOpen: true,
                    highlightPlan: highlightPlan || 'spark',
                    limitReason: reason || null,
                  })
                }
              />
            </div>
          ) : (
            /* Main Chat Canvas */
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative z-10">
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
                          limitReason: `Study Space limit reached (${u.pdfStudyUsed}/${u.pdfStudyLimit} sessions used). Upgrade to Spark ($3/mo) for 200 sessions/day or Fire ($7/mo) for 500 Study Space sessions/day.`,
                        });
                        return;
                      }
                      UserAccountStore.recordPdfStudySession();
                      setActiveStudyVideo(null);
                      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/study')) {
                        window.history.pushState({}, '', '/study');
                      }
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
                  {/* Center Area: Clean spacer */}
                  <div className="flex-1 my-auto" />

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

                    {/* Minimalist disclaimer */}
                    <div
                      className={`mt-2 text-center text-[10px] ${
                        isDark ? 'text-[#666666]' : 'text-[#8a8a8a]'
                      }`}
                    >
                      Kinich can make mistakes. Verify important information.
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
                          onAskKinich={(prompt) => handleSend(prompt)}
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
                        Kinich can make mistakes. Verify important information.
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
                modelUsed: 'Kinich Deep Research Agent',
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

          {/* Kinich Growth Hub Modal (Discover, Knowledge Vault, Weekly Brief, Kinich Passes) */}
          <KinichGrowthHubModal
            isOpen={growthHubState.isOpen}
            onClose={() => {
              setGrowthHubState((prev) => ({ ...prev, isOpen: false }));
              if (
                typeof window !== 'undefined' &&
                window.location.pathname.toLowerCase().startsWith('/vault')
              ) {
                window.history.pushState({}, '', '/');
              }
            }}
            initialTab={growthHubState.initialTab}
            initialThreadId={growthHubState.initialThreadId}
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

          {/* Public Kinich Page Reader & Fork Modal (?artifact=<id>) */}
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
            onAskKinich={(prompt) => handleSend(prompt)}
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

          {/* Full-Page Pricing & Plans Modal (Spark $3 · Fire $7) */}
          <PricingModal
            isOpen={pricingModalState.isOpen}
            onClose={() => setPricingModalState((prev) => ({ ...prev, isOpen: false }))}
            initialHighlightPlan={pricingModalState.highlightPlan}
            limitReason={pricingModalState.limitReason}
            isDark={isDark}
          />

          {/* Dodo Payments Checkout Return Handler (/billing/return) — Polls /api/billing/me, NEVER grants access from URL */}
          {billingReturnState.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
              <div
                className={`w-full max-w-md rounded-3xl border p-6 sm:p-7 shadow-2xl space-y-4 ${
                  isDark ? 'bg-[#141418] border-white/15 text-white' : 'bg-white border-black/10 text-[#18181b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-[#FC4C01]/15 border border-[#FC4C01]/35 flex items-center justify-center text-[#FC4C01] font-bold">
                    ⚡
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold tracking-tight">
                      {billingReturnState.pollingStatus === 'activated'
                        ? `Kinich ${String(billingReturnState.activatedPlan).toUpperCase()} Plan Active!`
                        : 'Activating your plan...'}
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      {billingReturnState.subscriptionId
                        ? `Subscription Reference: ${billingReturnState.subscriptionId}`
                        : 'Verifying webhook confirmation with Dodo Payments'}
                    </p>
                  </div>
                </div>

                {billingReturnState.pollingStatus === 'polling' && (
                  <div className="space-y-2.5 text-xs leading-relaxed">
                    <div className="flex items-center gap-2 font-medium text-[#FC4C01]">
                      <span className="size-2 rounded-full bg-[#FC4C01] animate-ping" />
                      <span>Waiting for verified Dodo Payments webhook confirmation...</span>
                    </div>
                    {billingReturnState.billingCountry === 'IN' && (
                      <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
                        Your bank may take a little while to confirm UPI AutoPay or RBI e-Mandate authorization. Your plan will activate automatically once confirmed.
                      </div>
                    )}
                  </div>
                )}

                {billingReturnState.pollingStatus === 'activated' && (
                  <p className="text-xs leading-relaxed text-emerald-400 font-medium">
                    Your subscription has been cryptographically verified via Dodo Payments webhook and your daily limits are now unlocked.
                  </p>
                )}

                {billingReturnState.pollingStatus === 'timeout' && (
                  <div className="space-y-2 text-xs leading-relaxed">
                    <p className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
                      We are still waiting for your bank or payment provider to finalize the webhook notification. Your plan will unlock automatically as soon as Dodo Payments confirms the charge.
                    </p>
                    <p className="text-[#FC4C01] font-medium">
                      Your bank may take a little while to confirm.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBillingReturnState((prev) => ({ ...prev, isOpen: false }));
                      navigateRoute('/settings/billing');
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border cursor-pointer ${
                      isDark ? 'border-white/15 hover:bg-white/10 text-white' : 'border-black/15 hover:bg-neutral-100 text-black'
                    }`}
                  >
                    Open Billing Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillingReturnState((prev) => ({ ...prev, isOpen: false }));
                      navigateRoute('/');
                    }}
                    className="px-4 py-2 rounded-full text-xs font-bold bg-[#FC4C01] hover:bg-[#e04300] text-white cursor-pointer"
                  >
                    Continue to Kinich
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Daily Streak Reminder Notification / Toast (Only active after user signs in) */}
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

          {/* Achievement Unlocked Milestone & Badge Toast Notification System (Only after login) */}
          <AchievementToast isDark={isDark} />

          {/* Thread Deletion Confirmation Dialog */}
          <DeleteThreadConfirmDialog
            thread={pendingDeleteThread}
            isDark={isDark}
            onConfirm={confirmDeleteThread}
            onCancel={() => setPendingDeleteThread(null)}
          />
        </>
      )}

      {/* Global Content & Safety Report Modal */}
      <ReportContentModal isDark={isDark} />

      {/* Compact In-Place Guest Sign-In Modal / Sheet */}
      {guestAuthModal.isOpen && (
        <div
          data-testid="guest-signin-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setGuestAuthModal((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-xl border p-4 shadow-xl space-y-3 ${
              isDark
                ? 'bg-[#121215] border-white/10 text-white'
                : 'bg-white border-neutral-200 text-neutral-900'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-neutral-900'
                }`}>
                  <Bookmark className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h3
                    data-testid="guest-signin-modal-title"
                    className="text-xs font-semibold truncate"
                  >
                    {guestAuthModal.reason || 'Sign in to Kinich'}
                  </h3>
                  <p className={`text-[11px] truncate ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Sync your vault, notes, and study history.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuestAuthModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer shrink-0"
                aria-label="Close sign-in modal"
              >
                ✕
              </button>
            </div>

            {guestAuthError && (
              <div className="p-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">
                {guestAuthError}
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                data-testid="modal-google-signin-btn"
                disabled={guestAuthBusy}
                onClick={async () => {
                  setGuestAuthBusy(true);
                  setGuestAuthError(null);
                  try {
                    const user = await UserAccountStore.signIn();
                    if (user) {
                      setGuestAuthModal((prev) => ({ ...prev, isOpen: false }));
                    }
                  } catch (err: any) {
                    setGuestAuthError(err?.message || 'Google sign-in could not be completed.');
                  } finally {
                    setGuestAuthBusy(false);
                  }
                }}
                className={`w-full h-9 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-black text-white hover:bg-neutral-800'
                }`}
              >
                <span>{guestAuthBusy ? 'Signing in…' : 'Continue with Google'}</span>
              </button>

              {!showEmailFormInModal ? (
                <button
                  type="button"
                  data-testid="modal-email-toggle-btn"
                  onClick={() => setShowEmailFormInModal(true)}
                  className={`w-full h-9 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    isDark
                      ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-900'
                  }`}
                >
                  <span>Continue with Email</span>
                </button>
              ) : (
                <form
                  data-testid="modal-email-signin-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!guestAuthEmail.trim() || !guestAuthPassword) return;
                    setGuestAuthBusy(true);
                    setGuestAuthError(null);
                    try {
                      let user;
                      try {
                        user = await UserAccountStore.loginWithEmail(
                          guestAuthEmail.trim(),
                          guestAuthPassword
                        );
                      } catch {
                        user = await UserAccountStore.signUp(
                          guestAuthEmail.trim(),
                          guestAuthPassword
                        );
                      }
                      if (user) {
                        setGuestAuthModal((prev) => ({ ...prev, isOpen: false }));
                      }
                    } catch (err: any) {
                      setGuestAuthError(err?.message || 'Could not sign in with Email.');
                    } finally {
                      setGuestAuthBusy(false);
                    }
                  }}
                  className="space-y-2 pt-1"
                >
                  <input
                    type="email"
                    required
                    value={guestAuthEmail}
                    onChange={(e) => setGuestAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`w-full h-9 px-3 rounded-xl border text-xs outline-none ${
                      isDark
                        ? 'bg-black/40 border-white/15 text-white placeholder:text-neutral-500'
                        : 'bg-neutral-50 border-black/15 text-black placeholder:text-neutral-400'
                    }`}
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={guestAuthPassword}
                    onChange={(e) => setGuestAuthPassword(e.target.value)}
                    placeholder="Password (6+ chars)"
                    className={`w-full h-9 px-3 rounded-xl border text-xs outline-none ${
                      isDark
                        ? 'bg-black/40 border-white/15 text-white placeholder:text-neutral-500'
                        : 'bg-neutral-50 border-black/15 text-black placeholder:text-neutral-400'
                    }`}
                  />
                  <button
                    type="submit"
                    data-testid="modal-email-signin-btn"
                    disabled={guestAuthBusy}
                    className={`w-full h-9 px-4 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                      isDark
                        ? 'border-white/20 bg-white text-black hover:bg-neutral-200'
                        : 'border-black/20 bg-black text-white hover:bg-neutral-800'
                    }`}
                  >
                    {guestAuthBusy ? 'Signing in…' : 'Sign in with Email'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
