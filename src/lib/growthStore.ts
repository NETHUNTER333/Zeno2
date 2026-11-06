import {
  DiscoverCategory,
  ArtifactOutputType,
  PublicArtifact,
  KnowledgeVaultItem,
  KnowledgeCollection,
  CreatorPublicProfile,
  KinichReferralStatus,
  KinichMissionItem,
  KinichIntelligenceLevel,
  KinichNotificationPreferences,
  GrowthAnalyticsEventName,
  GrowthFunnelSummary,
  SearchSource,
  EliteReferrerLeaderboardEntry,
  TopContributorEntry,
  KinichFeedbackCategory,
  KinichFeedbackSubmission,
  AgentReplyCard,
  VaultThread,
  VaultThreadType,
  VaultKeyPoint,
  VaultThreadComment,
  VaultMemoryIndexItem,
} from '../types';
import {
  auth,
  getAuthHeaders,
  saveVaultItemToFirestore,
  deleteVaultItemFromFirestore,
  loadUserVaultItemsFromFirestore,
  saveVaultThreadToFirestore,
  loadVaultThreadsFromFirestore,
  deleteVaultThreadFromFirestore,
  saveVaultCommentToFirestore,
  saveAgentMemoryToFirestore,
  loadAgentMemoryFromFirestore,
  recordAgentUsageToFirestore,
  savePublicArtifactToFirestore,
  deletePublicArtifactFromFirestore,
} from './firebase';
import { UserAccountStore } from './userAccountStore';
import { ShareCardTheme } from './exportChat';
import { apiFetch } from './apiBase';
import {
  captureInboundReferral,
  claimPendingReferralAfterAuth,
  getOrCreateSharedClientId,
  computeCanonicalReferralCode,
  isSelfReferralCode,
} from './referralClient';

const GROWTH_KEYS = {
  CLIENT_ID: 'kinich_growth_client_id',
  VAULT_ITEMS: 'kinich_vault_items_v1',
  VAULT_COLLECTIONS: 'kinich_vault_collections_v1',
  MY_ARTIFACTS: 'kinich_my_artifacts_v1',
  CREATOR_PROFILE: 'kinich_creator_profile_v1',
  REFERRAL_STATUS: 'kinich_referral_status_v1',
  PENDING_REF_CODE: 'kinich_pending_ref_code_v1',
  NOTIFY_PREFS: 'kinich_notify_prefs_v1',
  DISMISSED_CONTINUATION: 'kinich_dismissed_continuation_v1',
  LOCAL_ANALYTICS_COUNTS: 'kinich_growth_analytics_counts_v1',
  SEEN_EVENT_KEYS: 'kinich_growth_seen_events_v1',
  FEEDBACK_ITEMS: 'kinich_submitted_feedback_v1',
  USER_REFERRAL_TRACKER: 'kinich_user_referral_tracker_v1',
  CLAIMED_REFERRER_BONUSES: 'kinich_claimed_referrer_bonuses_v1',
  AGENT_MEMORY: 'kinich_agent_memory_v1',
  AGENT_USAGE: 'kinich_agent_usage_v1',
  VAULT_THREADS: 'kinich_vault_threads_v1',
  VAULT_MEMORY_INDEX: 'kinich_vault_memory_index_v1',
};

export const VAULT_FREE_ITEM_LIMIT = 20;

export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
  'Learning',
  'Research',
  'Science',
  'Technology',
  'Programming',
  'Writing',
  'Productivity',
  'Study Resources',
];

export const DEFAULT_VAULT_COLLECTIONS: KnowledgeCollection[] = [
  {
    id: 'col_exam_prep',
    name: 'Exam Preparation',
    description: 'Study guides, active-recall sheets, and formula derivations',
    createdAt: 1761200000000,
  },
  {
    id: 'col_research_ideas',
    name: 'Research Ideas',
    description: 'Cited syntheses, ArXiv paper notes, and literature reviews',
    createdAt: 1761210000000,
  },
  {
    id: 'col_programming',
    name: 'Programming',
    description: 'Architecture patterns, debugging notes, and code blueprints',
    createdAt: 1761220000000,
  },
  {
    id: 'col_reading_list',
    name: 'Reading List',
    description: 'Saved articles, bookmarked Discover resources, and web extracts',
    createdAt: 1761230000000,
  },
  {
    id: 'col_explanations',
    name: 'Useful Explanations',
    description: 'Clear conceptual breakdowns and mental models',
    createdAt: 1761240000000,
  },
];

function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function safeSave<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function getOrCreateClientId(): string {
  return getOrCreateSharedClientId();
}

async function getGrowthHeaders(): Promise<Record<string, string>> {
  const clientId = getOrCreateClientId();
  return getAuthHeaders({ 'X-Kinich-Client-Id': clientId });
}

function emitGrowthUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kinich-growth-updated'));
  }
}

function emitVaultUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kinich-vault-updated'));
    window.dispatchEvent(new Event('kinich-growth-updated'));
  }
}

// ============================================================================
// GROWTH ANALYTICS CLIENT & DEDUPLICATED TRACKING
// ============================================================================

const ALL_EVENT_NAMES: GrowthAnalyticsEventName[] = [
  'signup_completed',
  'first_core_action_completed',
  'knowledge_item_saved',
  'share_card_created',
  'share_action_initiated',
  'public_artifact_created',
  'public_artifact_opened',
  'discover_resource_opened',
  'referral_link_created',
  'referral_visit_recorded',
  'referral_signup_validated',
  'weekly_report_viewed',
  'returning_session_started',
];

export async function trackGrowthEvent(
  event: GrowthAnalyticsEventName,
  metaOrKey?: string | Record<string, any>
): Promise<void> {
  try {
    const idempotencyKey =
      typeof metaOrKey === 'string'
        ? metaOrKey
        : metaOrKey && typeof metaOrKey.idempotencyKey === 'string'
        ? metaOrKey.idempotencyKey
        : undefined;

    const seen = safeLoad<string[]>(GROWTH_KEYS.SEEN_EVENT_KEYS, []);
    if (idempotencyKey && seen.includes(idempotencyKey)) {
      return;
    }
    if (idempotencyKey) {
      const nextSeen = [idempotencyKey, ...seen].slice(0, 400);
      safeSave(GROWTH_KEYS.SEEN_EVENT_KEYS, nextSeen);
    }

    const counts = safeLoad<Record<string, number>>(GROWTH_KEYS.LOCAL_ANALYTICS_COUNTS, {});
    counts[event] = (counts[event] || 0) + 1;
    safeSave(GROWTH_KEYS.LOCAL_ANALYTICS_COUNTS, counts);

    const headers = await getGrowthHeaders();
    await fetch('/api/growth/analytics/event', {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, name: event, idempotencyKey }),
    }).catch(() => {});
  } catch {}
}

export async function fetchGrowthFunnelSummary(): Promise<GrowthFunnelSummary> {
  const localCounts = safeLoad<Record<string, number>>(GROWTH_KEYS.LOCAL_ANALYTICS_COUNTS, {});
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch('/api/growth/analytics/summary', { headers });
    if (res.ok) {
      const data = await res.json();
      if (data?.summary) {
        const s = data.summary;
        return {
          totalEvents: Number(s.totalEvents || 0),
          totalRecordedEvents: Number(s.totalEvents || 0),
          countsByEvent: s.countsByEvent || {},
          acquisition: {
            referralVisits: Number(s.acquisition?.referralVisits || 0),
            publicArtifactOpens: Number(s.acquisition?.publicArtifactOpens || 0),
            publicArtifactVisits: Number(s.acquisition?.publicArtifactOpens || 0),
            discoverOpens: Number(s.acquisition?.discoverOpens || 0),
            discoverResourceOpens: Number(s.acquisition?.discoverOpens || 0),
          },
          activation: {
            signupsCompleted: Number(s.activation?.signupsCompleted || 0),
            firstCoreActions: Number(s.activation?.firstCoreActions || 0),
            knowledgeItemsSaved: Number(s.activation?.knowledgeItemsSaved || 0),
          },
          virality: {
            shareCardsCreated: Number(s.virality?.shareCardsCreated || 0),
            shareActionsInitiated: Number(s.virality?.shareActionsInitiated || 0),
            publicArtifactsCreated: Number(s.virality?.publicArtifactsCreated || 0),
            validatedReferrals: Number(s.virality?.validatedReferrals || 0),
          },
          retention: {
            returningSessions: Number(s.retention?.returningSessions || 0),
            weeklyReportsViewed: Number(s.retention?.weeklyReportsViewed || 0),
            activeDaysLast7: Number(s.retention?.activeDaysLast7 || 1),
            activeDaysObserved: Number(s.retention?.activeDaysLast7 || 1),
          },
        };
      }
    }
  } catch {}

  const countsByEvent = {} as Record<GrowthAnalyticsEventName, number>;
  let totalEvents = 0;
  for (const name of ALL_EVENT_NAMES) {
    const c = Number(localCounts[name] || 0);
    countsByEvent[name] = c;
    totalEvents += c;
  }

  return {
    totalEvents,
    totalRecordedEvents: totalEvents,
    countsByEvent,
    acquisition: {
      referralVisits: countsByEvent.referral_visit_recorded,
      publicArtifactOpens: countsByEvent.public_artifact_opened,
      publicArtifactVisits: countsByEvent.public_artifact_opened,
      discoverOpens: countsByEvent.discover_resource_opened,
      discoverResourceOpens: countsByEvent.discover_resource_opened,
    },
    activation: {
      signupsCompleted: countsByEvent.signup_completed,
      firstCoreActions: countsByEvent.first_core_action_completed,
      knowledgeItemsSaved: countsByEvent.knowledge_item_saved,
    },
    virality: {
      shareCardsCreated: countsByEvent.share_card_created,
      shareActionsInitiated: countsByEvent.share_action_initiated,
      publicArtifactsCreated: countsByEvent.public_artifact_created,
      validatedReferrals: countsByEvent.referral_signup_validated,
    },
    retention: {
      returningSessions: countsByEvent.returning_session_started,
      weeklyReportsViewed: countsByEvent.weekly_report_viewed,
      activeDaysLast7: 1,
      activeDaysObserved: 1,
    },
  };
}

// ============================================================================
// PERSONAL KNOWLEDGE VAULT STORE
// ============================================================================

export function getDismissedContinuationIds(): string[] {
  return safeLoad<string[]>(GROWTH_KEYS.DISMISSED_CONTINUATION, []);
}

export function dismissContinuationItem(id: string): void {
  const existing = getDismissedContinuationIds();
  if (!existing.includes(id)) {
    safeSave(GROWTH_KEYS.DISMISSED_CONTINUATION, [id, ...existing].slice(0, 50));
    emitVaultUpdate();
  }
}

function inferInitialSubjectAndChapter(title: string, content: string): {
  subject: string;
  chapter: string;
  tags: string[];
} {
  const hay = `${title || ''} ${content || ''}`.toLowerCase();
  const rules: Array<{
    subject: string;
    keywords: string[];
    chapters: Array<{ name: string; keywords: string[] }>;
  }> = [
    {
      subject: 'Physics',
      keywords: ['physics', 'thermodynamics', 'entropy', 'heat', 'carnot', 'quantum', 'mechanics', 'electromagnetism', 'optics', 'kinematics', 'newton', 'circuit', 'voltage', 'boltzmann'],
      chapters: [
        { name: 'Thermodynamics & Heat Engines', keywords: ['thermodynamics', 'entropy', 'heat', 'carnot', 'enthalpy', 'kelvin', 'boltzmann'] },
        { name: 'Quantum Mechanics & Atomic Physics', keywords: ['quantum', 'photon', 'planck', 'wavefunction', 'schrodinger', 'orbital'] },
        { name: 'Electromagnetism & Circuits', keywords: ['electromagnetism', 'circuit', 'voltage', 'magnetic', 'maxwell', 'capacitor'] },
        { name: 'Classical Mechanics & Kinematics', keywords: ['mechanics', 'kinematics', 'newton', 'momentum', 'torque', 'gravity'] },
      ],
    },
    {
      subject: 'Biology & Life Sciences',
      keywords: ['biology', 'cell', 'cellular', 'photosynthesis', 'chloroplast', 'mitochondria', 'atp', 'dna', 'rna', 'genetics', 'crispr', 'protein', 'enzyme', 'neuron', 'synapse', 'respiration'],
      chapters: [
        { name: 'Cellular Energetics & Photosynthesis', keywords: ['photosynthesis', 'chloroplast', 'calvin', 'respiration', 'mitochondria', 'atp', 'glycolysis'] },
        { name: 'Molecular Genetics & Gene Editing', keywords: ['dna', 'rna', 'crispr', 'genome', 'transcription', 'mutation'] },
        { name: 'Neurobiology & Nervous System', keywords: ['neuron', 'synapse', 'brain', 'neurotransmitter', 'cortex'] },
      ],
    },
    {
      subject: 'Computer Science & AI',
      keywords: ['computer', 'algorithm', 'data structure', 'transformer', 'neural network', 'machine learning', 'deep learning', 'llm', 'attention', 'python', 'typescript', 'react', 'database', 'sql', 'system'],
      chapters: [
        { name: 'Deep Learning & Transformer Architectures', keywords: ['transformer', 'attention', 'llm', 'neural network', 'backpropagation', 'embedding', 'gpt'] },
        { name: 'Data Structures & Algorithms', keywords: ['algorithm', 'data structure', 'graph', 'tree', 'dynamic programming', 'sorting', 'complexity'] },
        { name: 'Systems & Software Engineering', keywords: ['database', 'sql', 'distributed', 'typescript', 'react', 'python', 'api'] },
      ],
    },
    {
      subject: 'Mathematics',
      keywords: ['mathematics', 'calculus', 'derivative', 'integral', 'differential', 'linear algebra', 'matrix', 'eigenvalue', 'vector', 'probability', 'statistics', 'bayes', 'theorem'],
      chapters: [
        { name: 'Calculus & Differential Equations', keywords: ['calculus', 'derivative', 'integral', 'differential', 'limit', 'taylor', 'fourier'] },
        { name: 'Linear Algebra & Vector Spaces', keywords: ['linear algebra', 'matrix', 'eigenvalue', 'eigenvector', 'vector', 'determinant'] },
        { name: 'Probability & Statistics', keywords: ['probability', 'statistics', 'bayes', 'distribution', 'variance'] },
      ],
    },
    {
      subject: 'Chemistry',
      keywords: ['chemistry', 'organic', 'inorganic', 'covalent', 'ionic', 'stoichiometry', 'periodic', 'acid', 'base', 'redox', 'kinetics', 'equilibrium', 'molecule', 'alkane', 'benzene'],
      chapters: [
        { name: 'Organic Chemistry & Mechanisms', keywords: ['organic', 'alkane', 'benzene', 'polymer', 'nucleophile', 'carbonyl'] },
        { name: 'Physical Chemistry & Kinetics', keywords: ['kinetics', 'equilibrium', 'redox', 'electrochemistry', 'catalyst'] },
      ],
    },
    {
      subject: 'Economics, History & Humanities',
      keywords: ['economics', 'macroeconomics', 'inflation', 'gdp', 'monetary', 'fiscal', 'market', 'history', 'civilization', 'constitution', 'polity', 'geopolitics'],
      chapters: [
        { name: 'Macroeconomics & Monetary Policy', keywords: ['macroeconomics', 'inflation', 'gdp', 'monetary', 'fiscal'] },
        { name: 'World History & Governance', keywords: ['history', 'civilization', 'constitution', 'polity', 'geopolitics'] },
      ],
    },
  ];

  for (const r of rules) {
    if (r.keywords.some((kw) => hay.includes(kw))) {
      const matchedCh = r.chapters.find((c) => c.keywords.some((ckw) => hay.includes(ckw)));
      const matchedTags = r.keywords.filter((kw) => hay.includes(kw)).slice(0, 5);
      return {
        subject: r.subject,
        chapter: matchedCh ? matchedCh.name : r.chapters[0]?.name || 'Core Concepts',
        tags: matchedTags,
      };
    }
  }

  const cleanTitle = String(title || 'Core Study Topic')
    .replace(/^(youtube study|study notes|deep research|saved response)[:\s-]*/i, '')
    .trim();
  const shortChapter = cleanTitle.split(/\s+/).slice(0, 5).join(' ') || 'Core Concepts';
  return {
    subject: 'General Studies',
    chapter: shortChapter.slice(0, 70),
    tags: ['study-vault'],
  };
}

export const AgentMemoryStore = {
  getFacts(agentId = 'sage'): string[] {
    const map = safeLoad<Record<string, string[]>>(GROWTH_KEYS.AGENT_MEMORY, {});
    return Array.isArray(map[agentId]) ? map[agentId].slice(0, 50) : [];
  },

  setFacts(agentId: string, facts: string[]): string[] {
    const map = safeLoad<Record<string, string[]>>(GROWTH_KEYS.AGENT_MEMORY, {});
    const cleaned = Array.from(
      new Set(
        (Array.isArray(facts) ? facts : [])
          .map((f) => String(f || '').trim().slice(0, 160))
          .filter(Boolean)
      )
    ).slice(0, 50);
    map[agentId] = cleaned;
    safeSave(GROWTH_KEYS.AGENT_MEMORY, map);
    saveAgentMemoryToFirestore(agentId, cleaned).catch(() => {});
    emitVaultUpdate();
    return cleaned;
  },

  addFact(agentId: string, fact: string): string[] {
    const clean = String(fact || '').trim().slice(0, 160);
    if (!clean) return this.getFacts(agentId);
    const existing = this.getFacts(agentId);
    return this.setFacts(agentId, [clean, ...existing]);
  },

  getAllMemories(): Record<string, string[]> {
    return safeLoad<Record<string, string[]>>(GROWTH_KEYS.AGENT_MEMORY, {});
  },

  async syncFromFirestore(agentId = 'sage'): Promise<string[]> {
    const remote = await loadAgentMemoryFromFirestore(agentId);
    if (remote && remote.length > 0) {
      const local = this.getFacts(agentId);
      return this.setFacts(agentId, [...remote, ...local]);
    }
    return this.getFacts(agentId);
  },
};

export const KnowledgeVaultStore = {
  VAULT_FREE_ITEM_LIMIT,

  isGuest(): boolean {
    return UserAccountStore.isGuest();
  },

  canSaveToVault(existingItemId?: string): {
    allowed: boolean;
    reason: 'ok' | 'guest' | 'free_limit';
    message: string;
    currentCount: number;
    maxCount: number | null;
  } {
    if (UserAccountStore.isGuest()) {
      return {
        allowed: false,
        reason: 'guest',
        message: 'Sign in to save',
        currentCount: 0,
        maxCount: 0,
      };
    }
    const items = this.getItems();
    const plan = UserAccountStore.getCurrentPlan();
    if (existingItemId && items.some((i) => i.id === existingItemId)) {
      return {
        allowed: true,
        reason: 'ok',
        message: 'Update in Vault',
        currentCount: items.length,
        maxCount: plan === 'free' ? VAULT_FREE_ITEM_LIMIT : null,
      };
    }
    if (plan === 'free' && items.length >= VAULT_FREE_ITEM_LIMIT) {
      return {
        allowed: false,
        reason: 'free_limit',
        message: `Free tier Vault cap reached (${VAULT_FREE_ITEM_LIMIT}/${VAULT_FREE_ITEM_LIMIT} items). Upgrade to Spark for unlimited Vault items + Sage auto-organizer.`,
        currentCount: items.length,
        maxCount: VAULT_FREE_ITEM_LIMIT,
      };
    }
    return {
      allowed: true,
      reason: 'ok',
      message: 'Save to Vault',
      currentCount: items.length,
      maxCount: plan === 'free' ? VAULT_FREE_ITEM_LIMIT : null,
    };
  },

  getCollections(): KnowledgeCollection[] {
    return safeLoad<KnowledgeCollection[]>(
      GROWTH_KEYS.VAULT_COLLECTIONS,
      DEFAULT_VAULT_COLLECTIONS
    );
  },

  addCollection(name: string, description = ''): KnowledgeCollection {
    const cleanName = name.trim().slice(0, 60);
    if (!cleanName) throw new Error('Collection name is required');
    const collections = this.getCollections();
    const created: KnowledgeCollection = {
      id: `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      description: description.trim().slice(0, 160),
      createdAt: Date.now(),
    };
    safeSave(GROWTH_KEYS.VAULT_COLLECTIONS, [created, ...collections]);
    emitVaultUpdate();
    return created;
  },

  createCollection(name: string, description = ''): KnowledgeCollection {
    return this.addCollection(name, description);
  },

  deleteCollection(collectionId: string): void {
    const collections = this.getCollections().filter((c) => c.id !== collectionId);
    safeSave(
      GROWTH_KEYS.VAULT_COLLECTIONS,
      collections.length > 0 ? collections : DEFAULT_VAULT_COLLECTIONS
    );
    emitVaultUpdate();
  },

  getAll(): KnowledgeVaultItem[] {
    return this.getItems();
  },

  getItems(): KnowledgeVaultItem[] {
    const items = safeLoad<KnowledgeVaultItem[]>(GROWTH_KEYS.VAULT_ITEMS, []);
    return items
      .map((i) => {
        const inferred =
          !i.subject || !i.chapter
            ? inferInitialSubjectAndChapter(i.title || '', i.content || '')
            : null;
        const resolvedType = (i.type || i.sourceType || 'chat_answer') as KnowledgeVaultItem['type'];
        return {
          ...i,
          type: resolvedType,
          sourceType: resolvedType,
          subject: i.subject || inferred?.subject || 'General Studies',
          chapter: i.chapter || inferred?.chapter || 'Core Concepts',
          tags: Array.isArray(i.tags) && i.tags.length > 0 ? i.tags : inferred?.tags || [],
          sourceUrl: i.sourceUrl || '',
          timestamps: Array.isArray(i.timestamps) ? i.timestamps : [],
          relatedItemIds: Array.isArray(i.relatedItemIds) ? i.relatedItemIds : [],
          lastReviewedAt: i.lastReviewedAt || i.updatedAt || i.createdAt || Date.now(),
          summary: i.summary || (i.content || '').slice(0, 200),
          isPinned: Boolean(i.isPinned ?? i.pinned),
          pinned: Boolean(i.isPinned ?? i.pinned),
          sourceThreadId: i.sourceThreadId || i.threadId,
          sourceMessageId: i.sourceMessageId || i.messageId,
        };
      })
      .sort(
        (a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt
      );
  },

  getGroupedBySubjectAndChapter(itemsInput?: KnowledgeVaultItem[]): Array<{
    subject: string;
    totalItems: number;
    chapters: Array<{
      chapter: string;
      items: KnowledgeVaultItem[];
    }>;
  }> {
    const items = itemsInput || this.getItems();
    const subjectMap = new Map<string, Map<string, KnowledgeVaultItem[]>>();

    for (const item of items) {
      const subj = (item.subject || 'General Studies').trim();
      const chap = (item.chapter || 'Core Concepts').trim();
      if (!subjectMap.has(subj)) {
        subjectMap.set(subj, new Map());
      }
      const chMap = subjectMap.get(subj)!;
      if (!chMap.has(chap)) {
        chMap.set(chap, []);
      }
      chMap.get(chap)!.push(item);
    }

    return Array.from(subjectMap.entries())
      .map(([subject, chMap]) => {
        const chapters = Array.from(chMap.entries()).map(([chapter, chItems]) => ({
          chapter,
          items: chItems,
        }));
        const totalItems = chapters.reduce((acc, c) => acc + c.items.length, 0);
        return { subject, totalItems, chapters };
      })
      .sort((a, b) => b.totalItems - a.totalItems || a.subject.localeCompare(b.subject));
  },

  saveItem(input: {
    id?: string;
    title: string;
    content: string;
    summary?: string;
    subject?: string;
    chapter?: string;
    collectionId?: string;
    tags?: string[];
    sourceType?: KnowledgeVaultItem['sourceType'];
    type?: KnowledgeVaultItem['sourceType'];
    sourceUrl?: string;
    timestamps?: string[];
    relatedItemIds?: string[];
    sageNote?: string;
    organizedBySage?: boolean;
    skipSage?: boolean;
    threadId?: string;
    sourceThreadId?: string;
    messageId?: string;
    sourceMessageId?: string;
    artifactId?: string;
    sources?: SearchSource[];
    isPinned?: boolean;
    pinned?: boolean;
  }): KnowledgeVaultItem {
    const items = this.getItems();
    const userId =
      auth.currentUser?.uid || UserAccountStore.getProfile().id || getOrCreateClientId();
    const now = Date.now();
    const cleanTitle = (input.title || 'Saved Insight').trim().slice(0, 180);
    const cleanContent = (input.content || '').trim().slice(0, 24000);
    const cleanSummary =
      (input.summary || '').trim().slice(0, 320) ||
      cleanContent
        .replace(/[#*`>_~[\]()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);

    const isPinnedVal = Boolean(input.isPinned ?? input.pinned);
    const resolvedType = (input.type || input.sourceType || 'chat_answer') as KnowledgeVaultItem['type'];
    const resolvedThreadId = input.threadId || input.sourceThreadId;
    const resolvedMsgId = input.messageId || input.sourceMessageId;

    const inferred = inferInitialSubjectAndChapter(cleanTitle, cleanContent);
    const initialSubject = (input.subject || inferred.subject || 'General Studies').trim();
    const initialChapter = (input.chapter || inferred.chapter || 'Core Concepts').trim();
    const initialTags = Array.from(
      new Set(
        [...(input.tags || []), ...inferred.tags]
          .map((t) => String(t || '').trim().toLowerCase())
          .filter(Boolean)
      )
    ).slice(0, 8);

    const existingIdx = input.id ? items.findIndex((i) => i.id === input.id) : -1;

    // Enforce Free tier 20-item cap on new items
    if (existingIdx < 0 && UserAccountStore.getCurrentPlan() === 'free' && items.length >= VAULT_FREE_ITEM_LIMIT) {
      throw new Error(
        `Free tier Vault limit reached (${VAULT_FREE_ITEM_LIMIT} items). Upgrade to Spark for unlimited Vault items.`
      );
    }

    const item: KnowledgeVaultItem =
      existingIdx >= 0
        ? {
            ...items[existingIdx],
            title: cleanTitle,
            content: cleanContent,
            summary: cleanSummary,
            subject: input.subject || items[existingIdx].subject || initialSubject,
            chapter: input.chapter || items[existingIdx].chapter || initialChapter,
            collectionId:
              input.collectionId || items[existingIdx].collectionId || 'col_research_ideas',
            tags: input.tags ?? items[existingIdx].tags ?? initialTags,
            sourceUrl: input.sourceUrl ?? items[existingIdx].sourceUrl ?? '',
            timestamps: input.timestamps ?? items[existingIdx].timestamps ?? [],
            relatedItemIds: input.relatedItemIds ?? items[existingIdx].relatedItemIds ?? [],
            sageNote: input.sageNote ?? items[existingIdx].sageNote,
            organizedBySage: input.organizedBySage ?? items[existingIdx].organizedBySage,
            isPinned: isPinnedVal,
            pinned: isPinnedVal,
            updatedAt: now,
            lastReviewedAt: now,
          }
        : {
            id: input.id || `kv_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            userId,
            type: resolvedType,
            sourceType: resolvedType,
            title: cleanTitle,
            subject: initialSubject,
            chapter: initialChapter,
            content: cleanContent,
            summary: cleanSummary,
            collectionId: input.collectionId || 'col_research_ideas',
            tags: initialTags,
            sourceUrl: input.sourceUrl || '',
            timestamps: Array.isArray(input.timestamps) ? input.timestamps.slice(0, 50) : [],
            relatedItemIds: Array.isArray(input.relatedItemIds) ? input.relatedItemIds : [],
            sageNote: input.sageNote || '',
            organizedBySage: Boolean(input.organizedBySage),
            organizingStatus: input.skipSage ? 'organized' : 'organizing',
            threadId: resolvedThreadId,
            sourceThreadId: resolvedThreadId,
            messageId: resolvedMsgId,
            sourceMessageId: resolvedMsgId,
            artifactId: input.artifactId,
            sources: input.sources,
            isPinned: isPinnedVal,
            pinned: isPinnedVal,
            createdAt: now,
            updatedAt: now,
            lastReviewedAt: now,
          };

    const nextItems =
      existingIdx >= 0
        ? items.map((it, idx) => (idx === existingIdx ? item : it))
        : [item, ...items];

    safeSave(GROWTH_KEYS.VAULT_ITEMS, nextItems);
    saveVaultItemToFirestore(item).catch(() => {});
    trackGrowthEvent('knowledge_item_saved', `kv_save_${item.id}`);
    emitVaultUpdate();

    // Trigger Agent "Sage" (on_save) in background to auto-assign Subject + Chapter + Tags and link related Vault items within <10s
    if (!input.skipSage && !UserAccountStore.isGuest()) {
      this.organizeWithSage(item, nextItems).catch(() => {});
    }

    return item;
  },

  async organizeWithSage(
    savedItem: KnowledgeVaultItem,
    allItemsInput?: KnowledgeVaultItem[]
  ): Promise<{
    item: KnowledgeVaultItem;
    agentReply?: AgentReplyCard;
  }> {
    const allItems = allItemsInput || this.getItems();
    const existingOthers = allItems
      .filter((i) => i.id !== savedItem.id)
      .slice(0, 20)
      .map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        subject: i.subject,
        chapter: i.chapter,
        tags: i.tags,
        timestamps: i.timestamps,
        content: (i.summary || i.content || '').slice(0, 500),
      }));

    try {
      const headers = await getGrowthHeaders();
      const res = await fetch('/api/agents/on-save', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientSessionId: getOrCreateClientId(),
          userTier: UserAccountStore.getCurrentPlan(),
          item: {
            id: savedItem.id,
            type: savedItem.type,
            title: savedItem.title,
            subject: savedItem.subject,
            chapter: savedItem.chapter,
            tags: savedItem.tags,
            sourceUrl: savedItem.sourceUrl,
            timestamps: savedItem.timestamps,
            content: (savedItem.content || '').slice(0, 2200),
            summary: savedItem.summary,
          },
          existingVaultItems: existingOthers,
          agentMemory: AgentMemoryStore.getFacts('sage'),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = this.updateItem(savedItem.id, {
          subject: data.subject || savedItem.subject,
          chapter: data.chapter || savedItem.chapter,
          tags: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : savedItem.tags,
          relatedItemIds: Array.isArray(data.relatedItemIds) ? data.relatedItemIds : [],
          sageNote: data.sageNote || '',
          organizedBySage: true,
          organizingStatus: 'organized',
        });

        // Also back-link related items so both lectures point to each other
        if (Array.isArray(data.relatedItemIds) && data.relatedItemIds.length > 0) {
          for (const relId of data.relatedItemIds) {
            const relItem = this.getItems().find((it) => it.id === relId);
            if (relItem) {
              const nextRelIds = Array.from(
                new Set([savedItem.id, ...(relItem.relatedItemIds || [])])
              ).slice(0, 15);
              this.updateItem(relId, {
                relatedItemIds: nextRelIds,
              });
            }
          }
        }

        if (Array.isArray(data.memoryFacts) && data.memoryFacts.length > 0) {
          AgentMemoryStore.setFacts('sage', data.memoryFacts);
        }

        if (data.tokensUsed) {
          recordAgentUsageToFirestore({
            agentId: 'sage',
            tokensUsed: Number(data.tokensUsed) || 180,
            callsCount: 1,
          }).catch(() => {});
        }

        if (typeof window !== 'undefined' && data.agentReply) {
          window.dispatchEvent(
            new CustomEvent('kinich-sage-organized', {
              detail: {
                item: updated || savedItem,
                agentReply: data.agentReply as AgentReplyCard,
              },
            })
          );
        }

        return {
          item: updated || savedItem,
          agentReply: data.agentReply as AgentReplyCard | undefined,
        };
      }
    } catch {}

    const fallbackUpdated = this.updateItem(savedItem.id, {
      organizedBySage: true,
      organizingStatus: 'organized',
    });
    return { item: fallbackUpdated || savedItem };
  },

  updateItem(
    itemId: string,
    patch: Partial<KnowledgeVaultItem> & { pinned?: boolean }
  ): KnowledgeVaultItem | null {
    const items = this.getItems();
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) return null;
    const current = items[idx];
    const nextPinned =
      patch.isPinned !== undefined
        ? patch.isPinned
        : patch.pinned !== undefined
        ? patch.pinned
        : current.isPinned;
    const updated: KnowledgeVaultItem = {
      ...current,
      ...patch,
      isPinned: Boolean(nextPinned),
      pinned: Boolean(nextPinned),
      updatedAt: Date.now(),
    };
    items[idx] = updated;
    safeSave(GROWTH_KEYS.VAULT_ITEMS, items);
    saveVaultItemToFirestore(updated).catch(() => {});
    emitVaultUpdate();
    return updated;
  },

  markReviewed(itemId: string): KnowledgeVaultItem | null {
    return this.updateItem(itemId, { lastReviewedAt: Date.now() });
  },

  togglePin(itemId: string): void {
    const items = this.getItems();
    const target = items.find((i) => i.id === itemId);
    if (!target) return;
    this.updateItem(itemId, { isPinned: !target.isPinned });
  },

  deleteItem(itemId: string): void {
    const items = this.getItems().filter((i) => i.id !== itemId);
    safeSave(GROWTH_KEYS.VAULT_ITEMS, items);
    deleteVaultItemFromFirestore(itemId).catch(() => {});
    emitVaultUpdate();
  },

  isArtifactBookmarked(artifactId: string): boolean {
    return this.getItems().some((i) => i.artifactId === artifactId);
  },

  toggleBookmarkFromArtifact(artifact: PublicArtifact): boolean {
    const existing = this.getItems().find((i) => i.artifactId === artifact.id);
    if (existing) {
      this.deleteItem(existing.id);
      return false;
    }
    this.saveItem({
      title: artifact.title,
      summary: artifact.summary,
      content: artifact.content,
      collectionId: 'col_reading_list',
      tags: artifact.tags || [],
      sourceType: 'discover_resource',
      type: 'note',
      artifactId: artifact.id,
      sources: artifact.sources || [],
    });
    return true;
  },

  async syncWithFirestore(): Promise<KnowledgeVaultItem[]> {
    const remote = await loadUserVaultItemsFromFirestore();
    if (!remote || remote.length === 0) return this.getItems();
    const local = this.getItems();
    const merged = new Map<string, KnowledgeVaultItem>();
    for (const item of local) merged.set(item.id, item);
    for (const r of remote) {
      if (r && r.id) {
        const existing = merged.get(r.id);
        if (!existing || (r.updatedAt || 0) > existing.updatedAt) {
          const pin = Boolean(r.isPinned ?? r.pinned);
          const inferred = inferInitialSubjectAndChapter(r.title || '', r.content || '');
          const resolvedType = (r.type || r.sourceType || 'chat_answer') as KnowledgeVaultItem['type'];
          merged.set(r.id, {
            id: r.id,
            userId: r.userId,
            type: resolvedType,
            sourceType: resolvedType,
            title: r.title,
            subject: r.subject || inferred.subject,
            chapter: r.chapter || inferred.chapter,
            content: r.content,
            summary: r.summary || (r.content || '').slice(0, 200),
            collectionId: r.collectionId || 'col_research_ideas',
            tags: Array.isArray(r.tags) && r.tags.length > 0 ? r.tags : inferred.tags,
            sourceUrl: r.sourceUrl || '',
            timestamps: Array.isArray(r.timestamps) ? r.timestamps : [],
            relatedItemIds: Array.isArray(r.relatedItemIds) ? r.relatedItemIds : [],
            sageNote: r.sageNote || '',
            organizedBySage: Boolean(r.organizedBySage),
            organizingStatus: 'organized',
            isPinned: pin,
            pinned: pin,
            createdAt: r.createdAt || Date.now(),
            updatedAt: r.updatedAt || Date.now(),
            lastReviewedAt: r.lastReviewedAt || r.updatedAt || r.createdAt || Date.now(),
          });
        }
      }
    }
    const list = Array.from(merged.values()).sort(
      (a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt
    );
    safeSave(GROWTH_KEYS.VAULT_ITEMS, list);
    emitVaultUpdate();
    return list;
  },

  async syncFromCloud(): Promise<KnowledgeVaultItem[]> {
    return this.syncWithFirestore();
  },

  getDismissedContinuationIds,
  dismissContinuationItem,

  exportVaultAsMarkdown(): string {
    const items = this.getItems();
    const collections = this.getCollections();
    const colMap = new Map(collections.map((c) => [c.id, c.name]));

    const lines: string[] = [
      '# Kinich Personal Knowledge Vault Export',
      '',
      `- **Exported**: ${new Date().toLocaleString()}`,
      `- **Total Saved Insights**: ${items.length}`,
      '',
      '---',
      '',
    ];

    items.forEach((item, idx) => {
      const colName = colMap.get(item.collectionId) || 'General';
      lines.push(`## ${idx + 1}. ${item.title}`);
      lines.push(
        `_Collection: ${colName} · Saved: ${new Date(item.createdAt).toLocaleDateString()}${
          item.tags.length > 0 ? ` · Tags: ${item.tags.map((t) => `#${t}`).join(', ')}` : ''
        }_`
      );
      lines.push('');
      lines.push(item.content);
      lines.push('');
      if (item.sources && item.sources.length > 0) {
        lines.push('**Cited Sources:**');
        item.sources.forEach((s, sIdx) => {
          lines.push(`${sIdx + 1}. [${s.title || s.domain || s.url}](${s.url})`);
        });
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  },

  exportVaultAsJson(): string {
    return JSON.stringify(
      {
        exportVersion: '1.0',
        exportedAt: new Date().toISOString(),
        collections: this.getCollections(),
        items: this.getItems(),
      },
      null,
      2
    );
  },
};

// ============================================================================
// REDDIT-STYLE VAULT THREADS STORE (AUTO-CAPTURE, DEDUPLICATION, COMMENTS, MEMORY)
// ============================================================================

export function formatToIstDate(dateInput: number | string | Date): string {
  const date =
    typeof dateInput === 'number' || typeof dateInput === 'string'
      ? new Date(dateInput)
      : dateInput;
  if (!date || isNaN(date.getTime())) return '';
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return formatted.replace(', ', ', ').replace(/, ([0-9]{1,2}:)/, ' · $1');
  } catch {
    return date.toISOString().slice(0, 16);
  }
}

export const VaultThreadStore = {
  isGuest(): boolean {
    return UserAccountStore.isGuest();
  },

  getThreads(): VaultThread[] {
    const plan = UserAccountStore.getCurrentPlan();
    const threads = safeLoad<VaultThread[]>(GROWTH_KEYS.VAULT_THREADS, []);
    // Tiers: Guest keeps nothing, Free keeps last 20 threads, Spark/Fire keep all
    const sorted = [...threads].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt
    );
    if (plan === 'free') {
      return sorted.slice(0, 20);
    }
    return sorted;
  },

  getThread(threadId: string): VaultThread | null {
    const threads = this.getThreads();
    return threads.find((t) => t.id === threadId) || null;
  },

  saveThread(thread: VaultThread): VaultThread {
    if (this.isGuest()) return thread;
    const plan = UserAccountStore.getCurrentPlan();
    const current = safeLoad<VaultThread[]>(GROWTH_KEYS.VAULT_THREADS, []);
    const idx = current.findIndex((t) => t.id === thread.id);
    let next: VaultThread[];
    if (idx >= 0) {
      next = [...current];
      next[idx] = { ...current[idx], ...thread, updatedAt: Date.now() };
    } else {
      next = [thread, ...current];
    }
    if (plan === 'free' && next.length > 20) {
      next = next.slice(0, 20);
    }
    safeSave(GROWTH_KEYS.VAULT_THREADS, next);

    // Save to Firestore & index memory
    saveVaultThreadToFirestore(thread).catch(() => {});
    this.indexKeyPoints(thread);
    emitVaultUpdate();
    return thread;
  },

  findDuplicate(sourceUrl?: string): VaultThread | null {
    if (!sourceUrl || !sourceUrl.trim()) return null;
    const cleanSource = sourceUrl.trim().toLowerCase().replace(/\/+$/, '');
    const ytMatch = cleanSource.match(
      /(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
    );
    const targetVideoId = ytMatch ? ytMatch[1] : null;

    const threads = this.getThreads();
    for (const t of threads) {
      if (!t.sourceUrl) continue;
      const existingClean = t.sourceUrl.trim().toLowerCase().replace(/\/+$/, '');
      if (existingClean === cleanSource) return t;
      if (targetVideoId) {
        const existingYt = existingClean.match(
          /(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
        );
        if (existingYt && existingYt[1] === targetVideoId) {
          return t;
        }
      }
    }
    return null;
  },

  async autoCapture(input: {
    content: string;
    title?: string;
    sourceUrl?: string;
    thumbnail?: string;
    timestamps?: any[];
    inputType?: VaultThreadType;
  }): Promise<{
    ok: boolean;
    isGuest?: boolean;
    deduplicated?: boolean;
    thread?: VaultThread;
    message?: string;
  }> {
    if (this.isGuest()) {
      return {
        ok: true,
        isGuest: true,
        message: 'Sign in to keep this in your Vault',
      };
    }

    // Deduplicate on client first
    const duplicate = this.findDuplicate(input.sourceUrl);
    if (duplicate) {
      return {
        ok: true,
        deduplicated: true,
        thread: duplicate,
      };
    }

    try {
      const headers = await getGrowthHeaders();
      const plan = UserAccountStore.getCurrentPlan();
      const res = await fetch('/api/vault/auto-capture', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...input,
          userTier: plan,
          userId: auth.currentUser?.uid,
          existingThreads: this.getThreads().slice(0, 20),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.thread) {
          this.saveThread(data.thread);
          return {
            ok: true,
            deduplicated: Boolean(data.deduplicated),
            thread: data.thread,
          };
        }
      }
    } catch {}

    // Offline / direct heuristic fallback
    const heuristic = inferInitialSubjectAndChapter(input.title || '', input.content);
    const now = Date.now();
    const threadId = `vth_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const defaultTitle =
      input.title && input.title.trim()
        ? input.title.trim().slice(0, 160)
        : input.inputType === 'youtube'
        ? 'YouTube Study Lecture'
        : 'Study Topic Thread';

    const fallbackThread: VaultThread = {
      id: threadId,
      userId: auth.currentUser?.uid || 'user',
      type: input.inputType || 'text',
      title: defaultTitle,
      sourceUrl: input.sourceUrl,
      thumbnail: input.thumbnail,
      tldr: (input.content || '').slice(0, 180) || `Core study notes on ${defaultTitle}`,
      keyPoints: [
        {
          id: `kp_1_${now}`,
          text: `Key point overview for ${defaultTitle}`,
          timestamp: '00:00',
          score: 1,
        },
        {
          id: `kp_2_${now}`,
          text: `Mechanisms and main principles in ${heuristic.chapter}`,
          timestamp: '03:15',
          score: 1,
        },
        {
          id: `kp_3_${now}`,
          text: `Active recall takeaways and practice formulas`,
          timestamp: '07:30',
          score: 1,
        },
      ],
      subject: heuristic.subject,
      chapter: heuristic.chapter,
      tags: heuristic.tags,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      score: 1,
      commentCount: 2,
      comments: [
        {
          id: `cm_sage_${now}`,
          threadId,
          author: 'sage',
          authorName: 'Sage',
          text: `Filed under ${heuristic.subject} → ${heuristic.chapter}. Key points saved and indexed into your Vault memory.`,
          createdAt: now,
          score: 1,
        },
        {
          id: `cm_recall_${now + 500}`,
          threadId,
          author: 'recall',
          authorName: 'Recall',
          text: `Quiz time: 3 active recall questions prepared from this topic for tomorrow's review.`,
          createdAt: now + 500,
          score: 1,
        },
      ],
    };

    this.saveThread(fallbackThread);
    return { ok: true, deduplicated: false, thread: fallbackThread };
  },

  forgetThread(threadId: string): void {
    // 1. Remove from local store
    const current = safeLoad<VaultThread[]>(GROWTH_KEYS.VAULT_THREADS, []);
    safeSave(
      GROWTH_KEYS.VAULT_THREADS,
      current.filter((t) => t.id !== threadId)
    );

    // 2. Wipe memory index entries
    const memIndex = safeLoad<VaultMemoryIndexItem[]>(GROWTH_KEYS.VAULT_MEMORY_INDEX, []);
    safeSave(
      GROWTH_KEYS.VAULT_MEMORY_INDEX,
      memIndex.filter((m) => m.threadId !== threadId)
    );

    // 3. Remove from Firestore
    deleteVaultThreadFromFirestore(threadId).catch(() => {});

    // 4. Notify backend
    getGrowthHeaders().then((headers) => {
      fetch(`/api/vault/threads/${encodeURIComponent(threadId)}`, {
        method: 'DELETE',
        headers,
      }).catch(() => {});
    });

    emitVaultUpdate();
  },

  addComment(
    threadId: string,
    commentInput: string | { text: string; author?: string; authorName?: string; parentId?: string | null },
    parentId: string | null = null,
    author = 'user',
    authorName = 'Student'
  ): VaultThreadComment | null {
    const thread = this.getThread(threadId);
    if (!thread) return null;
    const now = Date.now();
    const effectiveText = typeof commentInput === 'string' ? commentInput : commentInput.text;
    const effectiveParent = typeof commentInput === 'object' && commentInput.parentId !== undefined ? commentInput.parentId : parentId;
    const effectiveAuthor = typeof commentInput === 'object' && commentInput.author ? commentInput.author : author;
    const effectiveAuthorName = typeof commentInput === 'object' && commentInput.authorName ? commentInput.authorName : authorName;

    const comment: VaultThreadComment = {
      id: `cm_${now}_${Math.random().toString(36).slice(2, 6)}`,
      threadId,
      userId: auth.currentUser?.uid,
      author: effectiveAuthor,
      authorName: effectiveAuthorName,
      text: (effectiveText || '').trim().slice(0, 5000),
      createdAt: now,
      parentId: effectiveParent || null,
      score: 1,
    };

    const nextComments = [...(thread.comments || []), comment];
    thread.comments = nextComments;
    thread.commentCount = nextComments.length;
    thread.updatedAt = now;
    this.saveThread(thread);

    saveVaultCommentToFirestore(comment).catch(() => {});
    return comment;
  },

  voteThread(threadId: string, delta: number, keyPointId?: string): VaultThread | null {
    const thread = this.getThread(threadId);
    if (!thread) return null;
    if (keyPointId) {
      const kp = (thread.keyPoints || []).find((k) => k.id === keyPointId);
      if (kp) {
        kp.score = (kp.score || 0) + delta;
        if (delta > 0) {
          kp.upvoted = !kp.upvoted;
          kp.downvoted = false;
        } else {
          kp.downvoted = !kp.downvoted;
          kp.upvoted = false;
        }
      }
    } else {
      thread.score = (thread.score || 0) + delta;
      if (delta > 0) {
        thread.upvoted = !thread.upvoted;
        thread.downvoted = false;
      } else {
        thread.downvoted = !thread.downvoted;
        thread.upvoted = false;
      }
    }
    return this.saveThread(thread);
  },

  voteComment(threadId: string, commentId: string, delta: number): VaultThreadComment | null {
    const thread = this.getThread(threadId);
    if (!thread || !thread.comments) return null;
    const cm = thread.comments.find((c) => c.id === commentId);
    if (!cm) return null;
    cm.score = (cm.score || 0) + delta;
    if (delta > 0) {
      cm.upvoted = !cm.upvoted;
      cm.downvoted = false;
    } else {
      cm.downvoted = !cm.downvoted;
      cm.upvoted = false;
    }
    this.saveThread(thread);
    return cm;
  },

  indexKeyPoints(thread: VaultThread): void {
    const current = safeLoad<VaultMemoryIndexItem[]>(GROWTH_KEYS.VAULT_MEMORY_INDEX, []);
    const filtered = current.filter((m) => m.threadId !== thread.id);
    const newItems: VaultMemoryIndexItem[] = (thread.keyPoints || []).map((kp, idx) => ({
      id: `mem_${thread.id}_${idx}`,
      threadId: thread.id,
      userId: thread.userId,
      type: thread.type,
      title: thread.title,
      keyPointText: kp.text,
      timestamp: kp.timestamp,
      sourceUrl: thread.sourceUrl,
      subject: thread.subject,
      chapter: thread.chapter,
      createdAt: thread.createdAt,
    }));
    safeSave(GROWTH_KEYS.VAULT_MEMORY_INDEX, [...newItems, ...filtered].slice(0, 300));
  },

  searchMemoryCitations(query: string): string[] {
    const entries = safeLoad<VaultMemoryIndexItem[]>(GROWTH_KEYS.VAULT_MEMORY_INDEX, []);
    if (entries.length === 0 || !query.trim()) return [];
    const tokens = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    if (tokens.length === 0) return [];

    const scored: Array<{ score: number; entry: VaultMemoryIndexItem }> = [];
    for (const e of entries) {
      const hay = `${e.title} ${e.subject} ${e.chapter} ${e.keyPointText}`.toLowerCase();
      let s = 0;
      for (const t of tokens) {
        if (hay.includes(t)) s += 1;
      }
      if (s > 0) scored.push({ score: s, entry: e });
    }
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 3).map(({ entry }) => {
      const dateFormatted = formatToIstDate(entry.createdAt).split(' · ')[0] || 'past lecture';
      const ts = entry.timestamp ? ` (${entry.timestamp})` : '';
      const noun = entry.type === 'youtube' ? 'lecture' : 'study note';
      return `From your ${dateFormatted} ${noun} on ${entry.subject} → ${entry.chapter}${ts}: "${entry.keyPointText}"`;
    });
  },

  async syncWithFirestore(): Promise<VaultThread[]> {
    if (this.isGuest()) return [];
    try {
      const remote = await loadVaultThreadsFromFirestore();
      if (Array.isArray(remote) && remote.length > 0) {
        const local = this.getThreads();
        const mergedMap = new Map<string, VaultThread>();
        for (const item of [...remote, ...local]) {
          if (item?.id) {
            mergedMap.set(item.id, item as VaultThread);
          }
        }
        const merged = Array.from(mergedMap.values());
        const plan = UserAccountStore.getCurrentPlan();
        const finalThreads = plan === 'free' ? merged.slice(0, 20) : merged;
        safeSave(GROWTH_KEYS.VAULT_THREADS, finalThreads);
        emitVaultUpdate();
        return finalThreads;
      }
    } catch {}
    return this.getThreads();
  },
};

// ============================================================================
// PUBLIC ZENO PAGES & DISCOVER CLIENT
// ============================================================================

export async function fetchDiscoverArtifacts(params: {
  category?: string;
  q?: string;
  sort?: 'recent' | 'saved' | 'views';
  ownerId?: string;
  limit?: number;
}): Promise<{ items: PublicArtifact[]; total: number }> {
  try {
    const headers = await getGrowthHeaders();
    const url = new URL('/api/growth/discover', window.location.origin);
    if (params.category && params.category !== 'All')
      url.searchParams.set('category', params.category);
    if (params.q) url.searchParams.set('q', params.q);
    if (params.sort) url.searchParams.set('sort', params.sort);
    if (params.ownerId) url.searchParams.set('ownerId', params.ownerId);
    if (params.limit) url.searchParams.set('limit', String(params.limit));

    const res = await fetch(url.toString(), { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.items)) {
        return {
          items: data.items as PublicArtifact[],
          total: Number(data.total ?? data.items.length),
        };
      }
    }
  } catch {}

  const localMy = safeLoad<PublicArtifact[]>(GROWTH_KEYS.MY_ARTIFACTS, []).filter(
    (a) => a.visibility === 'public'
  );
  return { items: localMy, total: localMy.length };
}

export async function fetchPublicArtifactById(
  artifactId: string
): Promise<PublicArtifact | null> {
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch(`/api/growth/artifacts/${encodeURIComponent(artifactId)}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data?.artifact) {
        return data.artifact as PublicArtifact;
      }
    }
    if (res.status === 403 || res.status === 404) {
      return null;
    }
  } catch {}

  const localMy = safeLoad<PublicArtifact[]>(GROWTH_KEYS.MY_ARTIFACTS, []);
  const found = localMy.find((a) => a.id === artifactId);
  if (found && (found.visibility === 'public' || found.ownerId === auth.currentUser?.uid)) {
    return found;
  }
  return null;
}

export async function publishKinichArtifact(input: {
  id?: string;
  title: string;
  summary: string;
  content: string;
  promptText?: string;
  modelUsed?: string;
  category: DiscoverCategory;
  tags: string[];
  visibility: 'public' | 'private';
  outputType?: ArtifactOutputType;
  type?: ArtifactOutputType;
  showAuthorAttribution: boolean;
  authorName?: string;
  authorAvatar?: string;
  sources?: SearchSource[];
}): Promise<PublicArtifact> {
  const profile = UserAccountStore.getProfile();
  const outputType = input.outputType || input.type || 'research_summary';
  const payload = {
    ...input,
    outputType,
    authorName: input.authorName || profile.displayName || 'Kinich Researcher',
    authorUsername: profile.username || undefined,
    authorBio: profile.bio || undefined,
  };

  let createdArtifact: PublicArtifact | null = null;
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch('/api/growth/artifacts', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.artifact) {
        createdArtifact = {
          ...(data.artifact as PublicArtifact),
          promptText: input.promptText,
          modelUsed: input.modelUsed,
        };
      }
    }
  } catch {}

  const now = Date.now();
  if (!createdArtifact) {
    createdArtifact = {
      id: input.id || `art_local_${now.toString(36)}`,
      ownerId: auth.currentUser?.uid || profile.id || getOrCreateClientId(),
      authorName: payload.authorName,
      authorUsername: payload.authorUsername,
      authorBio: payload.authorBio,
      authorAvatar: input.authorAvatar,
      showAuthorAttribution: input.showAuthorAttribution,
      title: input.title.trim().slice(0, 180),
      summary: input.summary.trim().slice(0, 320),
      content: input.content.trim().slice(0, 32000),
      promptText: input.promptText,
      modelUsed: input.modelUsed,
      category: input.category,
      tags: input.tags.slice(0, 8),
      visibility: input.visibility,
      outputType,
      sources: input.sources,
      createdAt: now,
      updatedAt: now,
      viewsCount: 1,
      savesCount: 0,
      forksCount: 0,
    };
  }

  const localMy = safeLoad<PublicArtifact[]>(GROWTH_KEYS.MY_ARTIFACTS, []);
  const nextMy = [createdArtifact, ...localMy.filter((a) => a.id !== createdArtifact!.id)];
  safeSave(GROWTH_KEYS.MY_ARTIFACTS, nextMy);

  savePublicArtifactToFirestore(createdArtifact).catch(() => {});
  if (createdArtifact.visibility === 'public') {
    trackGrowthEvent('public_artifact_created', `pub_${createdArtifact.id}`);
  }
  emitGrowthUpdate();
  return createdArtifact;
}

export const publishPublicArtifact = publishKinichArtifact;

export async function updateKinichArtifact(
  artifactId: string,
  patch: Partial<
    Pick<
      PublicArtifact,
      'title' | 'summary' | 'content' | 'category' | 'tags' | 'visibility' | 'showAuthorAttribution'
    >
  >
): Promise<PublicArtifact | null> {
  let updated: PublicArtifact | null = null;
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch(`/api/growth/artifacts/${encodeURIComponent(artifactId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.artifact) updated = data.artifact as PublicArtifact;
    }
  } catch {}

  const localMy = safeLoad<PublicArtifact[]>(GROWTH_KEYS.MY_ARTIFACTS, []);
  const nextMy = localMy.map((a) => {
    if (a.id === artifactId) {
      const merged = updated || { ...a, ...patch, updatedAt: Date.now() };
      updated = merged;
      savePublicArtifactToFirestore(merged).catch(() => {});
      return merged;
    }
    return a;
  });
  safeSave(GROWTH_KEYS.MY_ARTIFACTS, nextMy);
  emitGrowthUpdate();
  return updated;
}

export const updatePublicArtifact = updateKinichArtifact;

export async function deleteKinichArtifact(artifactId: string): Promise<boolean> {
  try {
    const headers = await getGrowthHeaders();
    await fetch(`/api/growth/artifacts/${encodeURIComponent(artifactId)}`, {
      method: 'DELETE',
      headers,
    });
  } catch {}

  const localMy = safeLoad<PublicArtifact[]>(GROWTH_KEYS.MY_ARTIFACTS, []).filter(
    (a) => a.id !== artifactId
  );
  safeSave(GROWTH_KEYS.MY_ARTIFACTS, localMy);
  deletePublicArtifactFromFirestore(artifactId).catch(() => {});
  emitGrowthUpdate();
  return true;
}

export const deletePublicArtifact = deleteKinichArtifact;

export function getMyPublishedArtifacts(): PublicArtifact[] {
  return safeLoad<PublicArtifact[]>(GROWTH_KEYS.MY_ARTIFACTS, []);
}

export async function reportPublicArtifact(
  artifactId: string,
  reason: string,
  details: string
): Promise<boolean> {
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch(`/api/growth/artifacts/${encodeURIComponent(artifactId)}/report`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason, details }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function recordArtifactInteraction(
  artifactId: string,
  action: 'view' | 'fork' | 'save' | 'cta' | 'share'
): Promise<void> {
  const mappedAction = action === 'cta' || action === 'fork' ? 'fork' : action === 'save' ? 'save' : null;
  if (!mappedAction) return;
  try {
    const headers = await getGrowthHeaders();
    await fetch(`/api/growth/artifacts/${encodeURIComponent(artifactId)}/action`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: mappedAction }),
    });
  } catch {}
}

export const recordArtifactEngagement = recordArtifactInteraction;

// ============================================================================
// REFERRAL SYSTEM ("ZENO PASSES")
// ============================================================================

export async function getMyReferralStatus(): Promise<KinichReferralStatus> {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://kinich.app';
  try {
    const headers = await getGrowthHeaders();
    // Try primary new /api/referral/me first, fallback to /api/growth/referrals/me
    let res = await apiFetch('/api/referral/me', { headers }).catch(() => null);
    if (!res || !res.ok) {
      res = await apiFetch('/api/growth/referrals/me', { headers }).catch(() => null);
    }

    if (res && res.ok) {
      const data = await res.json();
      const code = data?.code || data?.referralCode;
      if (code) {
        const inviteUrl = data.link || `${origin}/r/${encodeURIComponent(code)}`;
        const invited = Number(data.stats?.invited ?? data.validatedSignupsCount ?? 0);
        const qualified = Number(data.stats?.qualified ?? data.verifiedReferralsCount ?? 0);
        const rewarded = Number(data.stats?.rewarded ?? data.qualifiedActionsCount ?? 0);

        const status: KinichReferralStatus = {
          referralCode: code,
          code,
          referrerUid: auth.currentUser?.uid || data.referrerUid || getOrCreateClientId(),
          inviteUrl,
          referralUrl: inviteUrl,
          visitsCount: Number(data.visitsCount || invited * 2),
          validatedSignupsCount: invited,
          verifiedReferralsCount: qualified,
          qualifiedActionsCount: rewarded,
          unlockedThemes: Array.isArray(data.unlockedThemes)
            ? data.unlockedThemes
            : ['carbon', 'ivory', 'slate', 'obsidian-gold', 'emerald-terminal'],
          referredByCode: data.referredByCode || null,
          attributionWindowDays: 7,
          createdAt: Number(data.createdAt || Date.now()),
        };
        safeSave(GROWTH_KEYS.REFERRAL_STATUS, status);
        return status;
      }
    }
  } catch {}

  const myUid = auth.currentUser?.uid || getOrCreateClientId();
  const canonicalCode = computeCanonicalReferralCode(myUid);
  const cached = safeLoad<KinichReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
  if (cached && cached.referralCode === canonicalCode) return cached;

  const fallbackCode = canonicalCode;
  const inviteUrl = `${origin}/r/${fallbackCode}`;
  const fallbackStatus: KinichReferralStatus = {
    referralCode: fallbackCode,
    code: fallbackCode,
    referrerUid: myUid,
    inviteUrl,
    referralUrl: inviteUrl,
    visitsCount: cached?.visitsCount || 0,
    validatedSignupsCount: cached?.validatedSignupsCount || 0,
    verifiedReferralsCount: cached?.verifiedReferralsCount || 0,
    qualifiedActionsCount: cached?.qualifiedActionsCount || 0,
    unlockedThemes: cached?.unlockedThemes || ['carbon', 'ivory', 'slate'],
    referredByCode: cached?.referredByCode || null,
    attributionWindowDays: 7,
    createdAt: cached?.createdAt || Date.now(),
  };
  safeSave(GROWTH_KEYS.REFERRAL_STATUS, fallbackStatus);
  return fallbackStatus;
}

export const fetchMyReferralStatus = getMyReferralStatus;

export function getUnlockedCosmeticThemes(): ShareCardTheme[] {
  const cached = safeLoad<KinichReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
  const base: ShareCardTheme[] = ['carbon', 'ivory', 'slate'];
  if (!cached || !Array.isArray(cached.unlockedThemes)) return base;
  if (
    cached.unlockedThemes.includes('obsidian-gold') ||
    (cached.validatedSignupsCount || 0) >= 1
  ) {
    base.push('obsidian-gold');
  }
  if (
    cached.unlockedThemes.includes('emerald-terminal') ||
    (cached.validatedSignupsCount || 0) >= 3
  ) {
    base.push('emerald-terminal');
  }
  return base;
}

export async function captureInboundReferralFromUrl(): Promise<string | null> {
  const res = await captureInboundReferral();
  return res ? res.code : null;
}

export const captureReferralFromUrlIfPresent = captureInboundReferralFromUrl;

export async function validatePendingReferralIfEligible(
  _qualifyingAction = 'first_core_action'
): Promise<boolean> {
  const uid = auth.currentUser?.uid || getOrCreateClientId();
  const res = await claimPendingReferralAfterAuth(uid, auth.currentUser?.email || '');
  if (res.success) {
    emitGrowthUpdate();
    return true;
  }
  return false;
}

export const claimPendingReferralIfEligible = validatePendingReferralIfEligible;

// ============================================================================
// MISSIONS, INTELLIGENCE LEVELS & WEEKLY REPORT AGGREGATOR
// ============================================================================

export function evaluateMissionsAndLevel(
  threads: Array<{ id: string; title: string; createdAt: number; messages?: any[] }>,
  vaultItemsArg?: KnowledgeVaultItem[]
): {
  missions: KinichMissionItem[];
  level: KinichIntelligenceLevel & { xp: number };
  intelligenceLevel: KinichIntelligenceLevel;
} {
  const vaultItems = vaultItemsArg || KnowledgeVaultStore.getItems();
  const collections = KnowledgeVaultStore.getCollections();
  const myArtifacts = getMyPublishedArtifacts();
  const bookmarks = UserAccountStore.getBookmarks();
  const localCounts = safeLoad<Record<string, number>>(GROWTH_KEYS.LOCAL_ANALYTICS_COUNTS, {});

  const citedMessagesCount = threads.reduce((acc, t) => {
    const msgs = Array.isArray(t.messages) ? t.messages : [];
    return (
      acc +
      msgs.filter(
        (m) => m.role === 'assistant' && Array.isArray(m.sources) && m.sources.length > 0
      ).length
    );
  }, 0);

  const totalSavedItems = vaultItems.length + bookmarks.length;
  const customCollectionsCount = Math.max(
    0,
    collections.length - DEFAULT_VAULT_COLLECTIONS.length
  );
  const publicArtifactsCount = myArtifacts.filter((a) => a.visibility === 'public').length;
  const shareCardsCount =
    Number(localCounts.share_card_created || 0) +
    Number(localCounts.share_action_initiated || 0);
  const multiTurnThreadsCount = threads.filter((t) => (t.messages?.length || 0) >= 4).length;

  const missions: KinichMissionItem[] = [
    {
      id: 'mission_save_insight',
      title: 'Save your first useful answer',
      description: 'Save a synthesized answer or research note into your Personal Knowledge Vault.',
      xp: 50,
      progress: Math.min(1, totalSavedItems),
      target: 1,
      completed: totalSavedItems >= 1,
    },
    {
      id: 'mission_cited_research',
      title: 'Complete a cited research session',
      description: 'Run a web or academic research query with verified source citations.',
      xp: 75,
      progress: Math.min(1, citedMessagesCount),
      target: 1,
      completed: citedMessagesCount >= 1,
    },
    {
      id: 'mission_vault_collection',
      title: 'Build a structured knowledge collection',
      description:
        'Save at least 3 insights or create a custom collection in your Knowledge Vault.',
      xp: 100,
      progress: Math.min(3, totalSavedItems + customCollectionsCount * 2),
      target: 3,
      completed: totalSavedItems >= 3 || customCollectionsCount >= 1,
    },
    {
      id: 'mission_share_card',
      title: 'Create a Kinich Share Card',
      description: 'Export a high-resolution Share Card or share a research snapshot.',
      xp: 100,
      progress: Math.min(1, shareCardsCount),
      target: 1,
      completed: shareCardsCount >= 1,
    },
    {
      id: 'mission_publish_page',
      title: 'Publish a Public Kinich Resource',
      description: 'Publish a study guide, research synthesis, or workflow to Kinich Discover.',
      xp: 150,
      progress: Math.min(1, publicArtifactsCount),
      target: 1,
      completed: publicArtifactsCount >= 1,
    },
    {
      id: 'mission_deep_continuation',
      title: 'Continue an in-depth investigation',
      description: 'Build a multi-turn research thread with 4 or more messages.',
      xp: 125,
      progress: Math.min(1, multiTurnThreadsCount),
      target: 1,
      completed: multiTurnThreadsCount >= 1,
    },
  ];

  const earnedXp = missions.reduce(
    (sum, m) => sum + (m.completed ? m.xp : Math.floor((m.progress / m.target) * m.xp * 0.5)),
    25
  );

  const levels: Array<{
    level: number;
    name: KinichIntelligenceLevel['name'];
    achievement: string;
    minXp: number;
    nextXp: number;
  }> = [
    { level: 1, name: 'Explorer', achievement: 'Discover Kinich', minXp: 0, nextXp: 75 },
    {
      level: 2,
      name: 'Researcher',
      achievement: 'Complete your first research session',
      minXp: 75,
      nextXp: 175,
    },
    {
      level: 3,
      name: 'Analyst',
      achievement: 'Synthesize cited evidence across sources',
      minXp: 175,
      nextXp: 300,
    },
    {
      level: 4,
      name: 'Scholar',
      achievement: 'Build a collection of useful knowledge',
      minXp: 300,
      nextXp: 450,
    },
    {
      level: 5,
      name: 'Architect',
      achievement: 'Publish reusable study guides & workflows',
      minXp: 450,
      nextXp: 575,
    },
    {
      level: 6,
      name: 'Polymath',
      achievement: 'Master multiple knowledge domains',
      minXp: 575,
      nextXp: 750,
    },
  ];

  let current = levels[0];
  for (const lvl of levels) {
    if (earnedXp >= lvl.minXp) current = lvl;
  }

  const levelObj = {
    level: current.level,
    name: current.name,
    achievement: current.achievement,
    xp: earnedXp,
    currentXp: earnedXp,
    nextLevelXp: current.nextXp,
  };

  return {
    missions,
    level: levelObj,
    intelligenceLevel: levelObj,
  };
}

export const computeMissionsAndIntelligenceLevel = evaluateMissionsAndLevel;

export interface WeeklyIntelligenceReportSummary {
  periodLabel: string;
  conversationsCount: number;
  researchSessionsCount: number;
  savedVaultItemsCount: number;
  studyGuidesCount: number;
  publishedArtifactsCount: number;
  activeDaysCount: number;
  topTopics: string[];
}

export function computeWeeklyIntelligenceReport(
  threads: Array<{ id: string; title: string; createdAt: number; messages?: any[] }>,
  vaultItemsArg?: KnowledgeVaultItem[]
): WeeklyIntelligenceReportSummary {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const startStr = new Date(sevenDaysAgo).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endStr = new Date(now).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const vaultItems = vaultItemsArg || KnowledgeVaultStore.getItems();
  const recentThreads = threads.filter((t) => (t.createdAt || now) >= sevenDaysAgo);

  const activeDayKeys = new Set<string>();
  recentThreads.forEach((t) => {
    activeDayKeys.add(new Date(t.createdAt || now).toISOString().slice(0, 10));
  });
  vaultItems
    .filter((i) => i.createdAt >= sevenDaysAgo)
    .forEach((i) => {
      activeDayKeys.add(new Date(i.createdAt).toISOString().slice(0, 10));
    });

  const researchSessionsCount = recentThreads.filter((t) => {
    const msgs = Array.isArray(t.messages) ? t.messages : [];
    return msgs.some(
      (m) =>
        (Array.isArray(m.sources) && m.sources.length > 0) ||
        (Array.isArray(m.arxivPapers) && m.arxivPapers.length > 0) ||
        msgs.length >= 2
    );
  }).length;

  const studyGuidesCount =
    vaultItems.filter(
      (i) => i.sourceType === 'study_guide' || i.sourceType === 'pdf_insight'
    ).length +
    recentThreads.filter((t) => /study|quiz|flashcard|pdf|paper|arxiv/i.test(t.title || '')).length;

  const publishedArtifactsCount = getMyPublishedArtifacts().filter(
    (a) => a.visibility === 'public'
  ).length;

  const topTopics = recentThreads
    .map((t) => (t.title || '').trim())
    .filter((title) => title && title !== 'New Chat')
    .slice(0, 5);

  return {
    periodLabel: `${startStr} – ${endStr}`,
    conversationsCount: recentThreads.length,
    researchSessionsCount,
    savedVaultItemsCount: vaultItems.length,
    studyGuidesCount,
    publishedArtifactsCount,
    activeDaysCount: Math.max(1, activeDayKeys.size),
    topTopics,
  };
}

// ============================================================================
// RESPECTFUL NOTIFICATION PREFERENCES & CREATOR PROFILES
// ============================================================================

export const DEFAULT_NOTIFICATION_PREFS: KinichNotificationPreferences = {
  enabled: false,
  unfinishedResearchReminders: true,
  weeklyIntelligenceBrief: true,
  weeklyIntelligenceReport: true,
  referralMilestones: true,
  frequency: 'weekly',
  updatedAt: Date.now(),
};

export function getNotificationPreferences(): KinichNotificationPreferences {
  const loaded = safeLoad<KinichNotificationPreferences>(
    GROWTH_KEYS.NOTIFY_PREFS,
    DEFAULT_NOTIFICATION_PREFS
  );
  return {
    ...loaded,
    weeklyIntelligenceReport: Boolean(
      loaded.weeklyIntelligenceReport ?? loaded.weeklyIntelligenceBrief
    ),
  };
}

export function saveNotificationPreferences(
  prefs: Partial<KinichNotificationPreferences>
): KinichNotificationPreferences {
  const current = getNotificationPreferences();
  const briefVal =
    prefs.weeklyIntelligenceReport !== undefined
      ? prefs.weeklyIntelligenceReport
      : prefs.weeklyIntelligenceBrief !== undefined
      ? prefs.weeklyIntelligenceBrief
      : current.weeklyIntelligenceBrief;
  const updated: KinichNotificationPreferences = {
    ...current,
    ...prefs,
    weeklyIntelligenceBrief: briefVal,
    weeklyIntelligenceReport: briefVal,
    updatedAt: Date.now(),
  };
  safeSave(GROWTH_KEYS.NOTIFY_PREFS, updated);
  emitGrowthUpdate();
  return updated;
}

export function getCreatorProfileLocal(): CreatorPublicProfile {
  const userProfile = UserAccountStore.getProfile();
  return safeLoad<CreatorPublicProfile>(GROWTH_KEYS.CREATOR_PROFILE, {
    uid: auth.currentUser?.uid || userProfile.id || getOrCreateClientId(),
    displayName: userProfile.displayName || 'Kinich Researcher',
    username: userProfile.username || 'researcher',
    bio: userProfile.bio || 'Exploring ideas, research papers, and technical workflows on Kinich.',
    avatarUrl: userProfile.avatar || '',
    isPublic: false,
    specialtyTags: ['research', 'ai'],
    publishedCount: getMyPublishedArtifacts().filter((a) => a.visibility === 'public').length,
    joinedAt: userProfile.createdAt || Date.now(),
    featuredArtifactIds: [],
    updatedAt: Date.now(),
  });
}

export async function fetchCreatorPublicProfile(
  uid: string
): Promise<{ profile: CreatorPublicProfile; artifacts: PublicArtifact[] } | null> {
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch(`/api/growth/profile/${encodeURIComponent(uid)}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data?.profile) {
        return {
          profile: data.profile as CreatorPublicProfile,
          artifacts: Array.isArray(data.artifacts) ? data.artifacts : [],
        };
      }
    }
  } catch {}
  const local = getCreatorProfileLocal();
  if (local.uid === uid && local.isPublic) {
    return {
      profile: local,
      artifacts: getMyPublishedArtifacts().filter((a) => a.visibility === 'public'),
    };
  }
  return null;
}

export async function saveCreatorPublicProfile(
  patch: Partial<CreatorPublicProfile>
): Promise<CreatorPublicProfile> {
  const current = getCreatorProfileLocal();
  const updated: CreatorPublicProfile = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  safeSave(GROWTH_KEYS.CREATOR_PROFILE, updated);
  try {
    const headers = await getGrowthHeaders();
    await fetch('/api/growth/profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify(updated),
    });
  } catch {}
  emitGrowthUpdate();
  return updated;
}

export const saveCreatorProfile = saveCreatorPublicProfile;

// ============================================================================
// ELITE REFERRER LEADERBOARD, TOP CONTRIBUTORS & FEEDBACK CLIENT
// ============================================================================

const FALLBACK_ELITE_REFERRERS: EliteReferrerLeaderboardEntry[] = [
  {
    rank: 1,
    uid: 'ref_elena_vance',
    displayName: 'Dr. Elena Vance',
    username: 'elena_quantum',
    referralCode: 'zp_elena94x',
    claimedReferrals: 31,
    visitsCount: 148,
    conversionRate: 21,
    tier: 'Grand Ambassador',
    unlockedThemes: ['carbon-default', 'obsidian-gold', 'solar-ivory', 'emerald-terminal'],
    specialtyTag: 'Quantum & Physics',
  },
  {
    rank: 2,
    uid: 'ref_marcus_chen',
    displayName: 'Marcus Chen',
    username: 'mchen_systems',
    referralCode: 'zp_mchen88k',
    claimedReferrals: 22,
    visitsCount: 104,
    conversionRate: 21,
    tier: 'Apex Referrer',
    unlockedThemes: ['carbon-default', 'obsidian-gold', 'solar-ivory', 'emerald-terminal'],
    specialtyTag: 'Distributed Systems',
  },
  {
    rank: 3,
    uid: 'ref_aria_lindqvist',
    displayName: 'Aria Lindqvist',
    username: 'aria_ml',
    referralCode: 'zp_arialq72',
    claimedReferrals: 16,
    visitsCount: 82,
    conversionRate: 20,
    tier: 'Apex Referrer',
    unlockedThemes: ['carbon-default', 'obsidian-gold', 'solar-ivory', 'emerald-terminal'],
    specialtyTag: 'Deep Learning',
  },
  {
    rank: 4,
    uid: 'ref_siddharth_rao',
    displayName: 'Siddharth Rao',
    username: 'srao_arxiv',
    referralCode: 'zp_srao51m',
    claimedReferrals: 11,
    visitsCount: 54,
    conversionRate: 20,
    tier: 'Catalyst',
    unlockedThemes: ['carbon-default', 'obsidian-gold', 'solar-ivory', 'emerald-terminal'],
    specialtyTag: 'Literature Review',
  },
  {
    rank: 5,
    uid: 'ref_lucas_meyer',
    displayName: 'Lucas Meyer',
    username: 'lmeyer_dev',
    referralCode: 'zp_lmeyer33',
    claimedReferrals: 7,
    visitsCount: 39,
    conversionRate: 18,
    tier: 'Catalyst',
    unlockedThemes: ['carbon-default', 'obsidian-gold', 'solar-ivory', 'emerald-terminal'],
    specialtyTag: 'Edge AI & WebGPU',
  },
  {
    rank: 6,
    uid: 'ref_nadia_okafor',
    displayName: 'Nadia Okafor',
    username: 'nadia_bio',
    referralCode: 'zp_nadia19p',
    claimedReferrals: 4,
    visitsCount: 27,
    conversionRate: 15,
    tier: 'Vanguard',
    unlockedThemes: ['carbon-default', 'obsidian-gold', 'solar-ivory'],
    specialtyTag: 'STEM & Bio',
  },
  {
    rank: 7,
    uid: 'ref_kaito_takahashi',
    displayName: 'Kaito Takahashi',
    username: 'kaito_wasm',
    referralCode: 'zp_kaito07z',
    claimedReferrals: 2,
    visitsCount: 18,
    conversionRate: 11,
    tier: 'Vanguard',
    unlockedThemes: ['carbon-default', 'obsidian-gold'],
    specialtyTag: 'Model Arena',
  },
];

const FALLBACK_TOP_CONTRIBUTORS: TopContributorEntry[] = [
  {
    rank: 1,
    uid: 'kinich_editorial',
    displayName: 'Kinich Research Team',
    username: 'kinich_research',
    bio: 'Curated reference synthesis and mathematical study guides built with Kinich.',
    publishedCount: 2,
    totalSaves: 17,
    totalForks: 11,
    totalViews: 36,
    impactScore: 183,
    specialtyTags: ['transformers', 'attention', 'arxiv', 'research-methods'],
    badge: 'Distinguished Fellow',
    topArtifactTitle: 'How to Synthesize a 40-Page Research Paper in 15 Minutes',
    topArtifactId: 'art_scientific_literature_synthesis',
  },
  {
    rank: 2,
    uid: 'kinich_systems',
    displayName: 'Kinich Systems Lab',
    username: 'kinich_systems',
    bio: 'Production architecture patterns and systems engineering notes.',
    publishedCount: 2,
    totalSaves: 13,
    totalForks: 8,
    totalViews: 31,
    impactScore: 147,
    specialtyTags: ['typescript', 'redis', 'webgpu', 'distributed-systems'],
    badge: 'Distinguished Fellow',
    topArtifactTitle: 'Atomic Token Bucket & Sliding Window Rate Limiting in Redis + TypeScript',
    topArtifactId: 'art_distributed_rate_limiter_ts',
  },
  {
    rank: 3,
    uid: 'kinich_study',
    displayName: 'Kinich Study Studio',
    username: 'kinich_study',
    bio: 'High-yield study sheets and university STEM exam guides.',
    publishedCount: 1,
    totalSaves: 10,
    totalForks: 6,
    totalViews: 21,
    impactScore: 103,
    specialtyTags: ['organic-chemistry', 'stem', 'exam-prep'],
    badge: 'Principal Author',
    topArtifactTitle: 'SN1, SN2, E1 & E2 Reaction Mechanisms Decision Matrix',
    topArtifactId: 'art_organic_chemistry_mechanisms_sheet',
  },
  {
    rank: 4,
    uid: 'kinich_learning',
    displayName: 'Kinich Learning Lab',
    username: 'kinich_learning',
    bio: 'Evidence-based learning frameworks and exam preparation workflows.',
    publishedCount: 1,
    totalSaves: 9,
    totalForks: 5,
    totalViews: 17,
    impactScore: 90,
    specialtyTags: ['active-recall', 'spaced-repetition', 'cognitive-science'],
    badge: 'Principal Author',
    topArtifactTitle: 'Active Recall vs. Passive Highlighting: Exam Mastery Protocol',
    topArtifactId: 'art_spaced_repetition_active_recall',
  },
];

function computeTierFromCount(count: number): EliteReferrerLeaderboardEntry['tier'] {
  if (count >= 25) return 'Grand Ambassador';
  if (count >= 12) return 'Apex Referrer';
  if (count >= 5) return 'Catalyst';
  if (count >= 1) return 'Vanguard';
  return 'Scout';
}

export interface LocalUserReferralRecord {
  uid: string;
  displayName: string;
  username: string;
  referralCode: string;
  referredCount: number;
  lastUpdatedAt: number;
  bonusClaimed: boolean;
  bonusClaimedAt?: number;
  bonusRewardLabel?: string;
}

export function getLocalReferralTracker(): Record<string, LocalUserReferralRecord> {
  return safeLoad<Record<string, LocalUserReferralRecord>>(GROWTH_KEYS.USER_REFERRAL_TRACKER, {});
}

export function getClaimedReferrerBonuses(): Record<
  string,
  { claimedAt: number; rewardLabel: string; referredCountAtClaim: number }
> {
  return safeLoad<
    Record<string, { claimedAt: number; rewardLabel: string; referredCountAtClaim: number }>
  >(GROWTH_KEYS.CLAIMED_REFERRER_BONUSES, {});
}

export function syncReferralTrackerWithEntries(
  entries: EliteReferrerLeaderboardEntry[]
): EliteReferrerLeaderboardEntry[] {
  const tracker = getLocalReferralTracker();
  const claimedMap = getClaimedReferrerBonuses();

  const updatedEntries = entries.map((entry) => {
    const existingByUid = tracker[entry.uid];
    const existingByCode = Object.values(tracker).find(
      (r) => r.referralCode && r.referralCode === entry.referralCode
    );
    const localRecord = existingByUid || existingByCode;
    const effectiveCount = Math.max(
      Number(entry.claimedReferrals || 0),
      Number(localRecord?.referredCount || 0)
    );
    const isClaimed = Boolean(
      claimedMap[entry.uid] ||
        claimedMap[entry.referralCode] ||
        localRecord?.bonusClaimed
    );

    tracker[entry.uid] = {
      uid: entry.uid,
      displayName: entry.displayName,
      username: entry.username,
      referralCode: entry.referralCode,
      referredCount: effectiveCount,
      lastUpdatedAt: localRecord?.lastUpdatedAt || Date.now(),
      bonusClaimed: isClaimed,
      bonusClaimedAt:
        claimedMap[entry.uid]?.claimedAt ||
        localRecord?.bonusClaimedAt,
      bonusRewardLabel:
        claimedMap[entry.uid]?.rewardLabel ||
        localRecord?.bonusRewardLabel,
    };

    return {
      ...entry,
      claimedReferrals: effectiveCount,
      tier: computeTierFromCount(effectiveCount),
    };
  });

  // Sort by effective referredCount descending and update rank numbers
  updatedEntries.sort((a, b) => b.claimedReferrals - a.claimedReferrals);
  updatedEntries.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  safeSave(GROWTH_KEYS.USER_REFERRAL_TRACKER, tracker);
  return updatedEntries;
}

export function incrementLocalReferralCountForUser(params: {
  uid?: string;
  referralCode?: string;
  displayName?: string;
  username?: string;
  delta?: number;
}): LocalUserReferralRecord {
  const tracker = getLocalReferralTracker();
  const delta = params.delta ?? 1;
  const matchKey =
    (params.uid && tracker[params.uid] ? params.uid : undefined) ||
    Object.keys(tracker).find(
      (k) => params.referralCode && tracker[k]?.referralCode === params.referralCode
    ) ||
    params.uid ||
    params.referralCode ||
    getOrCreateClientId();

  const existing = tracker[matchKey];
  const nextCount = Math.max(0, (existing?.referredCount || 0) + delta);
  const updated: LocalUserReferralRecord = {
    uid: existing?.uid || params.uid || matchKey,
    displayName:
      existing?.displayName ||
      params.displayName ||
      UserAccountStore.getProfile().displayName ||
      'Kinich Researcher',
    username:
      existing?.username ||
      params.username ||
      UserAccountStore.getProfile().username ||
      'researcher',
    referralCode: existing?.referralCode || params.referralCode || 'zp_explorer',
    referredCount: nextCount,
    lastUpdatedAt: Date.now(),
    bonusClaimed: Boolean(existing?.bonusClaimed),
    bonusClaimedAt: existing?.bonusClaimedAt,
    bonusRewardLabel: existing?.bonusRewardLabel,
  };

  tracker[updated.uid] = updated;
  safeSave(GROWTH_KEYS.USER_REFERRAL_TRACKER, tracker);

  // If this matches the current user, also sync REFERRAL_STATUS in localStorage
  const myId = getOrCreateClientId();
  const cachedRef = safeLoad<KinichReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
  if (
    updated.uid === myId ||
    updated.uid === auth.currentUser?.uid ||
    (cachedRef && cachedRef.referralCode === updated.referralCode)
  ) {
    if (cachedRef) {
      const nextStatus: KinichReferralStatus = {
        ...cachedRef,
        validatedSignupsCount: Math.max(cachedRef.validatedSignupsCount || 0, nextCount),
        verifiedReferralsCount: Math.max(cachedRef.verifiedReferralsCount || 0, nextCount),
      };
      safeSave(GROWTH_KEYS.REFERRAL_STATUS, nextStatus);
    }
  }

  emitGrowthUpdate();
  return updated;
}

export function claimTopReferrerBonus(entry: {
  uid: string;
  displayName: string;
  username?: string;
  referralCode: string;
  claimedReferrals: number;
  rank?: number;
  tier?: string;
}): {
  ok: boolean;
  alreadyClaimed?: boolean;
  rewardLabel: string;
  message: string;
} {
  const claimedMap = getClaimedReferrerBonuses();
  const tracker = getLocalReferralTracker();

  if (claimedMap[entry.uid] || tracker[entry.uid]?.bonusClaimed) {
    const prev = claimedMap[entry.uid];
    return {
      ok: false,
      alreadyClaimed: true,
      rewardLabel: prev?.rewardLabel || 'Top Referrer Bonus',
      message: `Bonus for ${entry.displayName} was already claimed.`,
    };
  }

  const rewardLabel =
    entry.claimedReferrals >= 20 || entry.rank === 1
      ? '+25 File Uploads, +125 Messages & Obsidian Gold + Emerald Themes (5x Referral Bonus)'
      : entry.claimedReferrals >= 10 || (entry.rank && entry.rank <= 3)
      ? '+25 File Uploads, +125 Messages & Emerald Terminal Theme (5x Referral Bonus)'
      : '+15 File Uploads, +75 Messages & Obsidian Gold Theme (5x Referral Bonus)';

  const now = Date.now();
  claimedMap[entry.uid] = {
    claimedAt: now,
    rewardLabel,
    referredCountAtClaim: entry.claimedReferrals,
  };
  safeSave(GROWTH_KEYS.CLAIMED_REFERRER_BONUSES, claimedMap);

  const existing = tracker[entry.uid];
  tracker[entry.uid] = {
    uid: entry.uid,
    displayName: entry.displayName,
    username: entry.username || existing?.username || 'researcher',
    referralCode: entry.referralCode,
    referredCount: Math.max(entry.claimedReferrals, existing?.referredCount || 0),
    lastUpdatedAt: now,
    bonusClaimed: true,
    bonusClaimedAt: now,
    bonusRewardLabel: rewardLabel,
  };
  safeSave(GROWTH_KEYS.USER_REFERRAL_TRACKER, tracker);

  // Unlock cosmetic share card themes in local referral status
  const cachedRef = safeLoad<KinichReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
  if (cachedRef) {
    const mergedThemes = Array.from(
      new Set([
        ...(cachedRef.unlockedThemes || ['carbon', 'ivory', 'slate']),
        'obsidian-gold',
        'emerald-terminal',
      ])
    );
    safeSave(GROWTH_KEYS.REFERRAL_STATUS, {
      ...cachedRef,
      unlockedThemes: mergedThemes,
    });
  }

  // Grant 5x bonus daily upload and message quota
  UserAccountStore.grantReferrerBonusQuota(25, 125);
  emitGrowthUpdate();

  return {
    ok: true,
    rewardLabel,
    message: `Claimed Top Referrer Bonus for ${entry.displayName} (${entry.claimedReferrals} referrals): ${rewardLabel}!`,
  };
}

export async function fetchGrowthLeaderboards(): Promise<{
  eliteReferrers: EliteReferrerLeaderboardEntry[];
  topContributors: TopContributorEntry[];
  myRank: EliteReferrerLeaderboardEntry | null;
}> {
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch('/api/growth/leaderboard', { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.eliteReferrers) && Array.isArray(data?.topContributors)) {
        const syncedReferrers = syncReferralTrackerWithEntries(
          data.eliteReferrers as EliteReferrerLeaderboardEntry[]
        );
        const syncedMyRank =
          syncedReferrers.find((r) => r.isCurrentUser) ||
          (data.myRank
            ? syncedReferrers.find((r) => r.uid === data.myRank.uid) ||
              (data.myRank as EliteReferrerLeaderboardEntry)
            : null);
        return {
          eliteReferrers: syncedReferrers,
          topContributors: data.topContributors as TopContributorEntry[],
          myRank: syncedMyRank,
        };
      }
    }
  } catch {}

  const cachedRef = safeLoad<KinichReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
  const myUid = getOrCreateClientId();
  const tracker = getLocalReferralTracker();
  const localMyCount = tracker[myUid]?.referredCount || cachedRef?.validatedSignupsCount || 0;
  const myEntry: EliteReferrerLeaderboardEntry = {
    rank: FALLBACK_ELITE_REFERRERS.length + 1,
    uid: myUid,
    displayName: UserAccountStore.getProfile().displayName || 'You (Kinich Explorer)',
    username: UserAccountStore.getProfile().username || 'you',
    referralCode: computeCanonicalReferralCode(auth.currentUser?.uid || myUid),
    claimedReferrals: localMyCount,
    visitsCount: cachedRef?.visitsCount || 0,
    conversionRate: 0,
    tier: computeTierFromCount(localMyCount),
    unlockedThemes: cachedRef?.unlockedThemes || ['carbon-default'],
    specialtyTag: 'Active Member',
    isCurrentUser: true,
  };

  const syncedFallback = syncReferralTrackerWithEntries([
    ...FALLBACK_ELITE_REFERRERS,
    myEntry,
  ]);
  const mySynced = syncedFallback.find((r) => r.isCurrentUser || r.uid === myUid) || myEntry;

  return {
    eliteReferrers: syncedFallback,
    topContributors: FALLBACK_TOP_CONTRIBUTORS,
    myRank: mySynced,
  };
}

export async function claimReferralCodeManual(
  rawCode: string
): Promise<{ ok: boolean; message: string }> {
  const code = rawCode.trim();
  if (!/^zp_[a-zA-Z0-9_-]{3,28}$/.test(code)) {
    return {
      ok: false,
      message: 'Please enter a valid Kinich Pass code starting with zp_ (e.g. zp_elena94x).',
    };
  }
  if (isSelfReferralCode(code)) {
    return {
      ok: false,
      message: 'You cannot claim your own referral code.',
    };
  }

  try {
    const headers = await getGrowthHeaders();
    let res = await apiFetch('/api/referral/claim', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    }).catch(() => null);

    if (!res || !res.ok) {
      res = await apiFetch('/api/growth/referrals/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({ referralCode: code, code }),
      }).catch(() => null);
    }

    const data = await res?.json().catch(() => ({}));
    if (res && res.ok && data?.success) {
      localStorage.removeItem(GROWTH_KEYS.PENDING_REF_CODE);
      incrementLocalReferralCountForUser({ referralCode: code, delta: 1 });
      emitGrowthUpdate();
      return {
        ok: true,
        message: data.alreadyClaimed
          ? `Referral code ${code} is already attributed to your account!`
          : `Referral pass ${code} verified! You'll receive rewards once qualified.`,
      };
    }

    return {
      ok: false,
      message:
        data?.error?.message ||
        data?.error ||
        data?.message ||
        'Could not claim this referral code (self-referrals and duplicate claims are blocked).',
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Network error claiming referral code.',
    };
  }
}

export async function submitKinichFeedback(input: {
  category: KinichFeedbackCategory;
  rating: number;
  subject: string;
  message: string;
  includeDiagnostics?: boolean;
  diagnosticsSummary?: string;
}): Promise<{ ok: boolean; item?: KinichFeedbackSubmission; error?: string }> {
  const cleanMessage = (input.message || '').trim();
  if (cleanMessage.length < 4) {
    return { ok: false, error: 'Please write at least a few words of feedback.' };
  }

  const cleanSubject = (input.subject || '').trim() || cleanMessage.slice(0, 72);
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch('/api/growth/feedback', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        category: input.category,
        rating: input.rating,
        subject: cleanSubject,
        message: cleanMessage,
        includeDiagnostics: Boolean(input.includeDiagnostics),
        diagnosticsSummary: input.diagnosticsSummary,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.item) {
      const savedList = safeLoad<KinichFeedbackSubmission[]>(GROWTH_KEYS.FEEDBACK_ITEMS, []);
      const nextList = [data.item as KinichFeedbackSubmission, ...savedList].slice(0, 30);
      safeSave(GROWTH_KEYS.FEEDBACK_ITEMS, nextList);
      emitGrowthUpdate();
      return { ok: true, item: data.item as KinichFeedbackSubmission };
    }
    return {
      ok: false,
      error: data?.error?.message || 'Could not submit feedback right now.',
    };
  } catch {
    const fallbackItem: KinichFeedbackSubmission = {
      id: `fb_local_${Date.now().toString(36)}`,
      category: input.category,
      rating: input.rating,
      subject: cleanSubject,
      message: cleanMessage,
      includeDiagnostics: Boolean(input.includeDiagnostics),
      status: 'routed',
      createdAt: Date.now(),
    };
    const savedList = safeLoad<KinichFeedbackSubmission[]>(GROWTH_KEYS.FEEDBACK_ITEMS, []);
    safeSave(GROWTH_KEYS.FEEDBACK_ITEMS, [fallbackItem, ...savedList].slice(0, 30));
    emitGrowthUpdate();
    return { ok: true, item: fallbackItem };
  }
}

export async function fetchMySubmittedFeedback(): Promise<KinichFeedbackSubmission[]> {
  const local = safeLoad<KinichFeedbackSubmission[]>(GROWTH_KEYS.FEEDBACK_ITEMS, []);
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch('/api/growth/feedback/mine', { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.items) && data.items.length > 0) {
        safeSave(GROWTH_KEYS.FEEDBACK_ITEMS, data.items);
        return data.items as KinichFeedbackSubmission[];
      }
    }
  } catch {}
  return local;
}

// ============================================================================
// 8-REFERRAL TRACKER & REWARD GIVER (MESSAGES, UPLOADS, QUIZZES & RESEARCH)
// ============================================================================

export interface ReferralRewardTier {
  targetReferrals: number;
  title: string;
  subtitle: string;
  bonusMessages: number;
  bonusUploads: number;
  bonusQuizzes: number;
  bonusDeepResearch: number;
}

export const REFERRAL_8_REWARD_TIERS: ReferralRewardTier[] = [
  {
    targetReferrals: 1,
    title: '1 Referral · Starter Bonus',
    subtitle: 'First friend invited',
    bonusMessages: 3,
    bonusUploads: 1,
    bonusQuizzes: 1,
    bonusDeepResearch: 1,
  },
  {
    targetReferrals: 3,
    title: '3 Referrals · Consistency Boost',
    subtitle: '3 friends invited',
    bonusMessages: 6,
    bonusUploads: 2,
    bonusQuizzes: 2,
    bonusDeepResearch: 1,
  },
  {
    targetReferrals: 5,
    title: '5 Referrals · Power Boost',
    subtitle: '5 friends invited',
    bonusMessages: 10,
    bonusUploads: 3,
    bonusQuizzes: 3,
    bonusDeepResearch: 2,
  },
  {
    targetReferrals: 8,
    title: '8 Referrals · Max Milestone',
    subtitle: 'Complete all 8 referrals',
    bonusMessages: 15,
    bonusUploads: 5,
    bonusQuizzes: 5,
    bonusDeepResearch: 3,
  },
];

const EIGHT_REF_STORAGE_KEY = 'kinich_eight_referral_rewards_v1';
const HOME_REF_POPUP_DISMISSED_KEY = 'kinich_home_ref_popup_dismissed_v1';

export interface EightReferralTrackerState {
  count: number;
  target: number;
  claimedTiers: number[];
  code: string;
  inviteUrl: string;
  dismissedOnHome: boolean;
}

export function getEightReferralTrackerState(): EightReferralTrackerState {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://kinich.app';
  const myUid = auth.currentUser?.uid || getOrCreateClientId();
  const cachedRef = safeLoad<KinichReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
  const tracker = getLocalReferralTracker();
  const savedRewards = safeLoad<{ count?: number; claimedTiers?: number[] }>(
    EIGHT_REF_STORAGE_KEY,
    {}
  );

  const code = computeCanonicalReferralCode(myUid);
  const inviteUrl = `${origin}/r/${encodeURIComponent(code)}`;

  const count = Math.max(
    0,
    Number(tracker[myUid]?.referredCount || 0),
    Number(cachedRef?.validatedSignupsCount || 0),
    Number(cachedRef?.verifiedReferralsCount || 0)
  );

  const claimedTiers = Array.isArray(savedRewards.claimedTiers)
    ? Array.from(new Set(savedRewards.claimedTiers.map(Number).filter((n) => n > 0))).sort(
        (a, b) => a - b
      )
    : [];

  let dismissedOnHome = false;
  try {
    dismissedOnHome = localStorage.getItem(HOME_REF_POPUP_DISMISSED_KEY) === 'true';
  } catch {}

  return {
    count,
    target: 8,
    claimedTiers,
    code,
    inviteUrl,
    dismissedOnHome,
  };
}

export function setHomeReferralPopupDismissed(dismissed: boolean): void {
  try {
    if (dismissed) {
      localStorage.setItem(HOME_REF_POPUP_DISMISSED_KEY, 'true');
    } else {
      localStorage.removeItem(HOME_REF_POPUP_DISMISSED_KEY);
    }
  } catch {}
  emitGrowthUpdate();
}

export function addOneReferralProgress(): EightReferralTrackerState {
  return getEightReferralTrackerState();
}

export function claimEightReferralTier(targetReferrals: number): {
  ok: boolean;
  tier?: ReferralRewardTier;
  message: string;
  state: EightReferralTrackerState;
} {
  const state = getEightReferralTrackerState();
  const tier = REFERRAL_8_REWARD_TIERS.find((t) => t.targetReferrals === targetReferrals);
  if (!tier) {
    return { ok: false, message: 'Invalid reward tier.', state };
  }
  if (state.count < tier.targetReferrals) {
    return {
      ok: false,
      tier,
      message: `You need ${tier.targetReferrals} verified referrals to claim ${tier.title}. Share your invite link to reach this milestone!`,
      state,
    };
  }
  if (state.claimedTiers.includes(tier.targetReferrals)) {
    return { ok: false, tier, message: `${tier.title} already claimed.`, state };
  }

  const nextClaimed = Array.from(new Set([...state.claimedTiers, tier.targetReferrals])).sort(
    (a, b) => a - b
  );
  safeSave(EIGHT_REF_STORAGE_KEY, {
    count: state.count,
    claimedTiers: nextClaimed,
  });

  UserAccountStore.grantReferrerBonusQuota(
    tier.bonusUploads,
    tier.bonusMessages,
    tier.bonusQuizzes,
    tier.bonusDeepResearch
  );

  emitGrowthUpdate();
  return {
    ok: true,
    tier,
    message: `Unlocked & claimed ${tier.title}: +${tier.bonusMessages} Messages, +${tier.bonusUploads} Uploads, +${tier.bonusQuizzes} Quizzes!`,
    state: getEightReferralTrackerState(),
  };
}

