import React, { useState, useEffect, useRef } from 'react';
import { Plus, PanelLeft, Download, FileText } from 'lucide-react';
import { ChatMessage as ChatMessageType, SearchMode } from './types';
import { GrokLogo } from './components/GrokLogo';
import { ChatInput, ChatHistoryItem, ChatHistoryMessageItem, MessageScroller } from './components/kobra';
import { GrokChatMessage } from './components/GrokChatMessage';
import { GROK_MODELS, ModelOption, getDefaultVisionModel, GrokModelPicker } from './components/GrokModelPicker';
import { Sidebar, ChatThread } from './components/Sidebar';
import { AccountWorkspacePage, AccountTab } from './components/AccountWorkspacePage';
import { StudyWorkspace } from './components/StudyWorkspace';
import { YouTubeVideoInfo } from './types';
import { QuickOnboardingModal } from './components/QuickOnboardingModal';
import { UserAccountStore } from './lib/userAccountStore';
import { exportConversationAsMarkdown, exportConversationAsPdf } from './lib/exportChat';

import { ReadingProgressBar } from './components/ReadingProgressBar';
import { AnalyticsDashboardModal } from './components/AnalyticsDashboardModal';
import { Signup1 } from './components/ui/signup-1';
import {
  auth,
  getAuthHeaders,
  saveChatThreadToFirestore,
  loadUserChatThreadsFromFirestore,
  deleteChatThreadFromFirestore,
  clearAllChatThreadsFromFirestore,
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface SavedThread extends ChatThread {
  messages: ChatMessageType[];
}

const INSTACLOUD_API_BASE = 'https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';

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
    if (localRes.ok && contentType.includes('application/json')) {
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
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
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

  const [isSignedIn, setIsSignedIn] = useState(() => UserAccountStore.isUserSignedIn());

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
  const messages = activeThread ? activeThread.messages : [];
  const isThreadEmpty = messages.length === 0;

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

  // Progressive streaming assistant text output using @kobra/streaming-text
  const streamResponseIntoMessage = async (
    threadId: string,
    messageId: string,
    data: any,
    signal?: AbortSignal
  ) => {
    const fullText = data.text || '';

    // Deliver rich metadata payload while streaming (preserve live search sources if already populated and data.sources is empty)
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      content: '',
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
                      isStreaming: true,
                    }
                  : m
              ),
            }
          : t
      )
    );

    if (!fullText || fullText.length <= 1 || signal?.aborted) {
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
                        isStreaming: false,
                      }
                    : m
                ),
              }
            : t
        )
      );
      return;
    }

    const totalLength = fullText.length;
    let currentPos = 0;

    await new Promise<void>((resolve) => {
      let timer: any = null;

      const streamNext = () => {
        if (signal?.aborted) {
          resolve();
          return;
        }

        if (currentPos >= totalLength) {
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
                            isStreaming: false,
                          }
                        : m
                    ),
                  }
                : t
            )
          );
          resolve();
          return;
        }

        // Maxed out fast streaming cadence with zero lag
        const remaining = totalLength - currentPos;
        const step = Math.min(remaining, Math.max(96, Math.floor(remaining * 0.65)));

        currentPos = Math.min(totalLength, currentPos + step);
        const chunk = fullText.slice(0, currentPos);
        const isDone = currentPos >= totalLength;

        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === messageId
                      ? {
                          ...m,
                          content: chunk,
                          isStreaming: !isDone,
                        }
                      : m
                  ),
                }
              : t
          )
        );

        if (isDone) {
          resolve();
          return;
        }

        // Ultra-fast 4ms tick rate
        const delay = 4;
        timer = setTimeout(streamNext, delay);
      };

      streamNext();
    });
  };

  const handleSend = async (
    promptText: string,
    mode: SearchMode = searchMode,
    attachments: any[] = []
  ) => {
    const query = promptText.trim();
    if (!query || isRunning) return;

    // Auto-select vision model when user sends an image or file attachment
    const hasImageAtt = attachments.some((a) => a?.type?.startsWith('image/'));
    const hasAnyAtt = attachments.length > 0;
    let activeModel = selectedModel;
    if (hasAnyAtt && !selectedModel.supportsVision) {
      activeModel = getDefaultVisionModel();
      setSelectedModel(activeModel);
    }

    const isCasualOrGreeting =
      /^[\p{Extended_Pictographic}\p{Emoji}\s\u200d\ufe0f👋✋✌️🙌🤝✨💌🎉❤️]+$/u.test(query.trim()) ||
      /^(hi+|hey+|hello+|yo+|sup|wassup|whats up|howdy|greetings|good (morning|afternoon|evening|night)|how are you|thanks|thank you|thx|ty|ok|okay|k|cool|nice|great|awesome|got it|wave|hand wave|waving|bye|cya)$/i.test(query.trim().toLowerCase());

    const effectiveMode = isResearchMode ? 'organic' : mode;
    const hasSearchIntent =
      isResearchMode ||
      (effectiveMode !== 'off' &&
        !isCasualOrGreeting &&
        (effectiveMode === 'news' ||
          /\b(search|google|browse|find online|sources?|links?|url|website|latest|news|today|recent|yesterday|this week|2024|2025|2026|weather|stock|price|who won|score|schedule|release date|images?|photos?|pics?|pictures?|videos?|youtube|tweets?|x\.com|twitter|handle|reddit|github|arxiv|persona|wiki|who is|fentch|fetch|scrape|https?:\/\/|[a-z0-9.-]+\.(?:com|org|net|io|ai|edu|gov))\b/i.test(
            query
          )));

    const computedLoadingMode: 'vision' | 'file' | 'search' | 'thinking' = hasImageAtt
      ? 'vision'
      : hasAnyAtt
      ? 'file'
      : (isResearchMode || (effectiveMode !== 'off' && hasSearchIntent)) && !isCasualOrGreeting
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
          if (liveData?.success && Array.isArray(liveData.sources) && liveData.sources.length > 0) {
            liveData.sources.forEach((_: any, idx: number) => {
              setTimeout(() => {
                if (controller.signal.aborted || chatCompleted) return;
                const partialSources = liveData.sources.slice(0, idx + 1);
                setThreads((prev) =>
                  prev.map((t) =>
                    t.id === currentThreadId
                      ? {
                          ...t,
                          messages: t.messages.map((m) =>
                            m.id === streamingMessage.id &&
                            (!m.sources || m.sources.length < partialSources.length)
                              ? { ...m, sources: partialSources }
                              : m
                          ),
                        }
                      : t
                  )
                );
              }, idx * 55);
            });
          }
        })
        .catch(() => {});
    }

    try {
      const allPriorMessages = activeThread ? activeThread.messages : [];
      const authHeaders = await getAuthHeaders();
      const response = await fetchZenoApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...allPriorMessages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
          webSearch: hasSearchIntent,
          searchMode: effectiveMode,
          model: activeModel.geminiModel,
          nsfwMode,
          isResearchMode,
          personalization: UserAccountStore.getPersonalization(),
          pinnedInsights: UserAccountStore.getBookmarks().slice(0, 10),
        }),
      });

      const rawText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error('Server took too long or returned an unexpected response. Please try again.');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate response');
      }

      // Record token & search usage in persistent account quota
      if (data?.timing?.totalTokens) {
        UserAccountStore.recordUsage(
          data.timing.totalTokens,
          Array.isArray(data.sources) && data.sources.length > 0 ? 1 : 0,
          Array.isArray(data.toolsUsed) ? data.toolsUsed.length : 0
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
          webSearch: searchMode === 'news' || isResearchMode,
          searchMode,
          model: targetModel.geminiModel,
          nsfwMode,
          personalization: UserAccountStore.getPersonalization(),
          pinnedInsights: UserAccountStore.getBookmarks().slice(0, 10),
        }),
      });

      const rawText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error('Server took too long or returned an unexpected response. Please try again.');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to regenerate response');
      }

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
          webSearch: searchMode === 'news' || isResearchMode,
          searchMode,
          model: selectedModel.geminiModel,
          nsfwMode,
          personalization: UserAccountStore.getPersonalization(),
          pinnedInsights: UserAccountStore.getBookmarks().slice(0, 10),
        }),
      });

      const rawText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error('Server took too long or returned an unexpected response. Please try again.');
      }
      if (!response.ok || !data.success) {
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
            onOpenAnalytics={() => setIsAnalyticsOpen(true)}
            onOpenAccountModal={(tab) => {
              setAccountPageTab((tab as AccountTab) || 'profile');
              setCurrentView('account');
            }}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
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
              {/* Glassmorphic Floating Top Controls (Sidebar toggle, Export & Small Icon-only New Chat) */}
              <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] left-3 right-3 sm:left-4 sm:right-4 z-30 flex items-center justify-between gap-2 pointer-events-none">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`pointer-events-auto p-1.5 rounded-xl border backdrop-blur-2xl transition-all cursor-pointer ${
                    isDark
                      ? 'bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.15] text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
                      : 'bg-white/70 hover:bg-white/90 border-black/[0.08] text-[#000000] shadow-[0_8px_32px_rgba(0,0,0,0.08)]'
                  }`}
                  title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>

                {/* Dynamic Island Model Selector */}
                <div className="pointer-events-auto flex items-center justify-center gap-2">
                  <GrokModelPicker
                    selectedModelId={selectedModel.id}
                    onSelectModel={setSelectedModel}
                    isDark={isDark}
                    dropdownDirection="down"
                    variant="header"
                  />
                </div>

                {/* Top Right Controls: New Chat Button */}
                <div className="flex items-center gap-2 pointer-events-auto">
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className={`pointer-events-auto p-1.5 rounded-xl border backdrop-blur-2xl transition-all cursor-pointer ${
                      isDark
                        ? 'bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.15] text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
                        : 'bg-white/70 hover:bg-white/90 border-black/[0.08] text-[#000000] shadow-[0_8px_32px_rgba(0,0,0,0.08)]'
                    }`}
                    title="New chat"
                    aria-label="New chat"
                  >
                    <Plus className="w-3 h-3 stroke-[2.2]" />
                  </button>
                </div>
              </div>

              {/* Content State: Empty vs Thread */}
              {isThreadEmpty ? (
                /* Empty State: Center logo, small subtle suggestions above prompt input, prompt input anchored at bottom */
                <div className="flex-1 min-w-0 flex flex-col items-center justify-between px-3 sm:px-4 w-full overflow-y-auto pt-14 sm:pt-16 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-8">
                  {/* Center Area: Centered Grok Wordmark */}
                  <div className="flex-1 flex flex-col items-center justify-center my-auto">
                    <GrokLogo size="lg" isDark={isDark} />
                  </div>

                  {/* Bottom Anchored Area: Prompt Input at the bottom */}
                  <div className="w-full max-w-3xl flex flex-col items-center mt-auto">
                    {/* ChatInput (@kobra/chat-input with @kobra/chat-history & upward model selector) */}
                    <div className="w-full">
                      <ChatInput
                        onSend={handleSend}
                        onCancel={handleCancel}
                        isRunning={isRunning}
                        searchMode={searchMode}
                        onToggleSearchMode={(m) => setSearchMode(m)}
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
                  {/* Slim horizontal reading progress bar at top of chat viewport */}
                  <ReadingProgressBar viewportRef={messagesContainerRef} isDark={isDark} />

                  {/* Scrollable Messages Viewport with bottom padding so content flows beneath the floating composer */}
                  <div ref={messagesContainerRef} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 pb-36 scrollbar-thin">
                    <div className="py-4 max-w-3xl mx-auto w-full min-w-0">
                      {messages.map((msg) => (
                        <GrokChatMessage
                          key={msg.id}
                          message={msg}
                          threadId={activeThread?.id}
                          threadTitle={activeThread?.title}
                          onRetry={(modelOverride) => handleRegenerateMessage(msg.id, modelOverride)}
                          onEdit={(content) => handleEditMessage(msg.id, content)}
                          onAskZeno={(prompt) => handleSend(prompt)}
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
                        searchMode={searchMode}
                        onToggleSearchMode={(m) => setSearchMode(m)}
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

          {/* Analytics Dashboard Modal */}
          <AnalyticsDashboardModal
            isOpen={isAnalyticsOpen}
            onClose={() => setIsAnalyticsOpen(false)}
            threads={threads}
            isDark={isDark}
          />
        </>
      )}
    </div>
  );
}
