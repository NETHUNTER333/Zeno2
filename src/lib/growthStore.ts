import {
  DiscoverCategory,
  ArtifactOutputType,
  PublicArtifact,
  KnowledgeVaultItem,
  KnowledgeCollection,
  CreatorPublicProfile,
  ZenoReferralStatus,
  ZenoMissionItem,
  ZenoIntelligenceLevel,
  ZenoNotificationPreferences,
  GrowthAnalyticsEventName,
  GrowthFunnelSummary,
  SearchSource,
  EliteReferrerLeaderboardEntry,
  TopContributorEntry,
  ZenoFeedbackCategory,
  ZenoFeedbackSubmission,
} from '../types';
import {
  auth,
  getAuthHeaders,
  saveVaultItemToFirestore,
  deleteVaultItemFromFirestore,
  loadUserVaultItemsFromFirestore,
  savePublicArtifactToFirestore,
  deletePublicArtifactFromFirestore,
} from './firebase';
import { UserAccountStore } from './userAccountStore';
import { ShareCardTheme } from './exportChat';

const GROWTH_KEYS = {
  CLIENT_ID: 'zeno_growth_client_id',
  VAULT_ITEMS: 'zeno_vault_items_v1',
  VAULT_COLLECTIONS: 'zeno_vault_collections_v1',
  MY_ARTIFACTS: 'zeno_my_artifacts_v1',
  CREATOR_PROFILE: 'zeno_creator_profile_v1',
  REFERRAL_STATUS: 'zeno_referral_status_v1',
  PENDING_REF_CODE: 'zeno_pending_ref_code_v1',
  NOTIFY_PREFS: 'zeno_notify_prefs_v1',
  DISMISSED_CONTINUATION: 'zeno_dismissed_continuation_v1',
  LOCAL_ANALYTICS_COUNTS: 'zeno_growth_analytics_counts_v1',
  SEEN_EVENT_KEYS: 'zeno_growth_seen_events_v1',
  FEEDBACK_ITEMS: 'zeno_submitted_feedback_v1',
  USER_REFERRAL_TRACKER: 'zeno_user_referral_tracker_v1',
  CLAIMED_REFERRER_BONUSES: 'zeno_claimed_referrer_bonuses_v1',
};

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
  try {
    const existing = localStorage.getItem(GROWTH_KEYS.CLIENT_ID);
    if (existing && /^[a-zA-Z0-9_-]{6,64}$/.test(existing)) {
      return existing;
    }
    const generated = `zcid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(GROWTH_KEYS.CLIENT_ID, generated);
    return generated;
  } catch {
    return 'zcid_session_fallback';
  }
}

async function getGrowthHeaders(): Promise<Record<string, string>> {
  const clientId = getOrCreateClientId();
  return getAuthHeaders({ 'X-Zeno-Client-Id': clientId });
}

function emitGrowthUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('zeno-growth-updated'));
  }
}

function emitVaultUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('zeno-vault-updated'));
    window.dispatchEvent(new Event('zeno-growth-updated'));
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

export const KnowledgeVaultStore = {
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

  getItems(): KnowledgeVaultItem[] {
    const items = safeLoad<KnowledgeVaultItem[]>(GROWTH_KEYS.VAULT_ITEMS, []);
    return items
      .map((i) => ({
        ...i,
        summary: i.summary || (i.content || '').slice(0, 200),
        isPinned: Boolean(i.isPinned ?? i.pinned),
        pinned: Boolean(i.isPinned ?? i.pinned),
        sourceThreadId: i.sourceThreadId || i.threadId,
        sourceMessageId: i.sourceMessageId || i.messageId,
      }))
      .sort(
        (a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt
      );
  },

  saveItem(input: {
    id?: string;
    title: string;
    content: string;
    summary?: string;
    collectionId?: string;
    tags?: string[];
    sourceType?: KnowledgeVaultItem['sourceType'];
    type?: KnowledgeVaultItem['sourceType'];
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
    const resolvedType = input.sourceType || input.type || 'ai_response';
    const resolvedThreadId = input.threadId || input.sourceThreadId;
    const resolvedMsgId = input.messageId || input.sourceMessageId;

    const existingIdx = input.id ? items.findIndex((i) => i.id === input.id) : -1;
    const item: KnowledgeVaultItem =
      existingIdx >= 0
        ? {
            ...items[existingIdx],
            title: cleanTitle,
            content: cleanContent,
            summary: cleanSummary,
            collectionId:
              input.collectionId || items[existingIdx].collectionId || 'col_research_ideas',
            tags: input.tags ?? items[existingIdx].tags,
            isPinned: isPinnedVal,
            pinned: isPinnedVal,
            updatedAt: now,
          }
        : {
            id: input.id || `kv_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            userId,
            title: cleanTitle,
            content: cleanContent,
            summary: cleanSummary,
            collectionId: input.collectionId || 'col_research_ideas',
            tags: (input.tags || [])
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean)
              .slice(0, 8),
            sourceType: resolvedType,
            type: resolvedType,
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
          };

    const nextItems =
      existingIdx >= 0
        ? items.map((it, idx) => (idx === existingIdx ? item : it))
        : [item, ...items];

    safeSave(GROWTH_KEYS.VAULT_ITEMS, nextItems);
    saveVaultItemToFirestore(item).catch(() => {});
    trackGrowthEvent('knowledge_item_saved', `kv_save_${item.id}`);
    emitVaultUpdate();
    return item;
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
          merged.set(r.id, {
            id: r.id,
            userId: r.userId,
            title: r.title,
            content: r.content,
            summary: r.summary || (r.content || '').slice(0, 200),
            collectionId: r.collectionId || 'col_research_ideas',
            tags: Array.isArray(r.tags) ? r.tags : [],
            sourceType: r.sourceType || 'ai_response',
            type: r.sourceType || 'ai_response',
            isPinned: pin,
            pinned: pin,
            createdAt: r.createdAt || Date.now(),
            updatedAt: r.updatedAt || Date.now(),
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
      '# Zeno Personal Knowledge Vault Export',
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

export async function publishZenoArtifact(input: {
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
    authorName: input.authorName || profile.displayName || 'Zeno Researcher',
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

export const publishPublicArtifact = publishZenoArtifact;

export async function updateZenoArtifact(
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

export const updatePublicArtifact = updateZenoArtifact;

export async function deleteZenoArtifact(artifactId: string): Promise<boolean> {
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

export const deletePublicArtifact = deleteZenoArtifact;

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

export async function getMyReferralStatus(): Promise<ZenoReferralStatus> {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://zeno0x.vercel.app';
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch('/api/growth/referrals/me', { headers });
    if (res.ok) {
      const data = await res.json();
      const raw = data?.status || data;
      const code = raw?.referralCode || raw?.code;
      if (code) {
        const inviteUrl = `${origin}/?ref=${encodeURIComponent(code)}`;
        const validated = Number(
          raw.validatedSignupsCount ?? raw.verifiedReferralsCount ?? 0
        );
        const status: ZenoReferralStatus = {
          referralCode: code,
          code,
          referrerUid: raw.referrerUid || getOrCreateClientId(),
          inviteUrl,
          referralUrl: inviteUrl,
          visitsCount: Number(raw.visitsCount || 0),
          validatedSignupsCount: validated,
          verifiedReferralsCount: validated,
          qualifiedActionsCount: Number(raw.qualifiedActionsCount || validated),
          unlockedThemes: Array.isArray(raw.unlockedThemes)
            ? raw.unlockedThemes
            : ['carbon', 'ivory', 'slate'],
          referredByCode: raw.referredByCode || null,
          attributionWindowDays: Number(raw.attributionWindowDays || 14),
          createdAt: Number(raw.createdAt || Date.now()),
        };
        safeSave(GROWTH_KEYS.REFERRAL_STATUS, status);
        return status;
      }
    }
  } catch {}

  const cached = safeLoad<ZenoReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
  if (cached) return cached;

  const fallbackCode = `zp_${getOrCreateClientId().replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`;
  const inviteUrl = `${origin}/?ref=${fallbackCode}`;
  return {
    referralCode: fallbackCode,
    code: fallbackCode,
    referrerUid: getOrCreateClientId(),
    inviteUrl,
    referralUrl: inviteUrl,
    visitsCount: 0,
    validatedSignupsCount: 0,
    verifiedReferralsCount: 0,
    qualifiedActionsCount: 0,
    unlockedThemes: ['carbon', 'ivory', 'slate'],
    referredByCode: null,
    attributionWindowDays: 14,
    createdAt: Date.now(),
  };
}

export const fetchMyReferralStatus = getMyReferralStatus;

export function getUnlockedCosmeticThemes(): ShareCardTheme[] {
  const cached = safeLoad<ZenoReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
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
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref')?.trim();
    if (!refCode || !/^zp_[a-zA-Z0-9_-]{3,28}$/.test(refCode)) return null;

    safeSave(GROWTH_KEYS.PENDING_REF_CODE, {
      code: refCode,
      capturedAt: Date.now(),
    });

    const headers = await getGrowthHeaders();
    await fetch('/api/growth/referrals/visit', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        referralCode: refCode,
        code: refCode,
        visitorId: getOrCreateClientId(),
      }),
    }).catch(() => {});

    return refCode;
  } catch {
    return null;
  }
}

export const captureReferralFromUrlIfPresent = captureInboundReferralFromUrl;

export async function validatePendingReferralIfEligible(
  _qualifyingAction = 'first_core_action'
): Promise<boolean> {
  const pending = safeLoad<{ code: string; capturedAt: number } | null>(
    GROWTH_KEYS.PENDING_REF_CODE,
    null
  );
  if (!pending || !pending.code) return false;

  try {
    const headers = await getGrowthHeaders();
    const res = await fetch('/api/growth/referrals/claim', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        referralCode: pending.code,
        code: pending.code,
        visitTimestampMs: pending.capturedAt,
      }),
    });
    if (res.ok) {
      localStorage.removeItem(GROWTH_KEYS.PENDING_REF_CODE);
      emitGrowthUpdate();
      return true;
    }
    if (res.status === 400 || res.status === 409) {
      localStorage.removeItem(GROWTH_KEYS.PENDING_REF_CODE);
    }
  } catch {}
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
  missions: ZenoMissionItem[];
  level: ZenoIntelligenceLevel & { xp: number };
  intelligenceLevel: ZenoIntelligenceLevel;
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

  const missions: ZenoMissionItem[] = [
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
      title: 'Create a Zeno Share Card',
      description: 'Export a high-resolution Share Card or share a research snapshot.',
      xp: 100,
      progress: Math.min(1, shareCardsCount),
      target: 1,
      completed: shareCardsCount >= 1,
    },
    {
      id: 'mission_publish_page',
      title: 'Publish a Public Zeno Resource',
      description: 'Publish a study guide, research synthesis, or workflow to Zeno Discover.',
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
    name: ZenoIntelligenceLevel['name'];
    achievement: string;
    minXp: number;
    nextXp: number;
  }> = [
    { level: 1, name: 'Explorer', achievement: 'Discover Zeno', minXp: 0, nextXp: 75 },
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

export const DEFAULT_NOTIFICATION_PREFS: ZenoNotificationPreferences = {
  enabled: false,
  unfinishedResearchReminders: true,
  weeklyIntelligenceBrief: true,
  weeklyIntelligenceReport: true,
  referralMilestones: true,
  frequency: 'weekly',
  updatedAt: Date.now(),
};

export function getNotificationPreferences(): ZenoNotificationPreferences {
  const loaded = safeLoad<ZenoNotificationPreferences>(
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
  prefs: Partial<ZenoNotificationPreferences>
): ZenoNotificationPreferences {
  const current = getNotificationPreferences();
  const briefVal =
    prefs.weeklyIntelligenceReport !== undefined
      ? prefs.weeklyIntelligenceReport
      : prefs.weeklyIntelligenceBrief !== undefined
      ? prefs.weeklyIntelligenceBrief
      : current.weeklyIntelligenceBrief;
  const updated: ZenoNotificationPreferences = {
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
    displayName: userProfile.displayName || 'Zeno Researcher',
    username: userProfile.username || 'researcher',
    bio: userProfile.bio || 'Exploring ideas, research papers, and technical workflows on Zeno.',
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
    uid: 'zeno_editorial',
    displayName: 'Zeno Research Team',
    username: 'zeno_research',
    bio: 'Curated reference synthesis and mathematical study guides built with Zeno.',
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
    uid: 'zeno_systems',
    displayName: 'Zeno Systems Lab',
    username: 'zeno_systems',
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
    uid: 'zeno_study',
    displayName: 'Zeno Study Studio',
    username: 'zeno_study',
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
    uid: 'zeno_learning',
    displayName: 'Zeno Learning Lab',
    username: 'zeno_learning',
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
      'Zeno Researcher',
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
  const cachedRef = safeLoad<ZenoReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
  if (
    updated.uid === myId ||
    updated.uid === auth.currentUser?.uid ||
    (cachedRef && cachedRef.referralCode === updated.referralCode)
  ) {
    if (cachedRef) {
      const nextStatus: ZenoReferralStatus = {
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
      ? '+5 File Uploads, +25 Messages & Obsidian Gold + Emerald Themes'
      : entry.claimedReferrals >= 10 || (entry.rank && entry.rank <= 3)
      ? '+5 File Uploads, +25 Messages & Emerald Terminal Theme'
      : '+3 File Uploads, +15 Messages & Obsidian Gold Theme';

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
  const cachedRef = safeLoad<ZenoReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
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

  // Grant bonus daily upload and message quota
  UserAccountStore.grantReferrerBonusQuota(5, 25);
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

  const cachedRef = safeLoad<ZenoReferralStatus | null>(GROWTH_KEYS.REFERRAL_STATUS, null);
  const myUid = getOrCreateClientId();
  const tracker = getLocalReferralTracker();
  const localMyCount = tracker[myUid]?.referredCount || cachedRef?.validatedSignupsCount || 0;
  const myEntry: EliteReferrerLeaderboardEntry = {
    rank: FALLBACK_ELITE_REFERRERS.length + 1,
    uid: myUid,
    displayName: UserAccountStore.getProfile().displayName || 'You (Zeno Explorer)',
    username: UserAccountStore.getProfile().username || 'you',
    referralCode: cachedRef?.referralCode || 'zp_explorer',
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
      message: 'Please enter a valid Zeno Pass code starting with zp_ (e.g. zp_elena94x).',
    };
  }

  try {
    const headers = await getGrowthHeaders();
    const res = await fetch('/api/growth/referrals/claim', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        referralCode: code,
        code,
        visitTimestampMs: Date.now(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      localStorage.removeItem(GROWTH_KEYS.PENDING_REF_CODE);
      incrementLocalReferralCountForUser({ referralCode: code, delta: 1 });
      emitGrowthUpdate();
      return {
        ok: true,
        message: `Referral pass ${code} verified! Local & leaderboard referral counter updated.`,
      };
    }
    return {
      ok: false,
      message:
        data?.error?.message ||
        data?.message ||
        'Could not claim this referral code (self-referrals and duplicate claims are blocked).',
    };
  } catch {
    incrementLocalReferralCountForUser({ referralCode: code, delta: 1 });
    return {
      ok: true,
      message: `Referral pass ${code} recorded in local referral tracker.`,
    };
  }
}

export async function submitZenoFeedback(input: {
  category: ZenoFeedbackCategory;
  rating: number;
  subject: string;
  message: string;
  includeDiagnostics?: boolean;
  diagnosticsSummary?: string;
}): Promise<{ ok: boolean; item?: ZenoFeedbackSubmission; error?: string }> {
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
      const savedList = safeLoad<ZenoFeedbackSubmission[]>(GROWTH_KEYS.FEEDBACK_ITEMS, []);
      const nextList = [data.item as ZenoFeedbackSubmission, ...savedList].slice(0, 30);
      safeSave(GROWTH_KEYS.FEEDBACK_ITEMS, nextList);
      emitGrowthUpdate();
      return { ok: true, item: data.item as ZenoFeedbackSubmission };
    }
    return {
      ok: false,
      error: data?.error?.message || 'Could not submit feedback right now.',
    };
  } catch {
    const fallbackItem: ZenoFeedbackSubmission = {
      id: `fb_local_${Date.now().toString(36)}`,
      category: input.category,
      rating: input.rating,
      subject: cleanSubject,
      message: cleanMessage,
      includeDiagnostics: Boolean(input.includeDiagnostics),
      status: 'routed',
      createdAt: Date.now(),
    };
    const savedList = safeLoad<ZenoFeedbackSubmission[]>(GROWTH_KEYS.FEEDBACK_ITEMS, []);
    safeSave(GROWTH_KEYS.FEEDBACK_ITEMS, [fallbackItem, ...savedList].slice(0, 30));
    emitGrowthUpdate();
    return { ok: true, item: fallbackItem };
  }
}

export async function fetchMySubmittedFeedback(): Promise<ZenoFeedbackSubmission[]> {
  const local = safeLoad<ZenoFeedbackSubmission[]>(GROWTH_KEYS.FEEDBACK_ITEMS, []);
  try {
    const headers = await getGrowthHeaders();
    const res = await fetch('/api/growth/feedback/mine', { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.items) && data.items.length > 0) {
        safeSave(GROWTH_KEYS.FEEDBACK_ITEMS, data.items);
        return data.items as ZenoFeedbackSubmission[];
      }
    }
  } catch {}
  return local;
}
