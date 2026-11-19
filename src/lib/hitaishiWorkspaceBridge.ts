// Unified Hitaishi Workspace Bridge
// Connects Hitaishi Stage & Backend to Main Chat Threads, Study Space (Summary, Flashcards, Quiz, Notes, Tutor Chat),
// SideChat Parallel Subtasks, and Knowledge Vault.

import { KnowledgeVaultStore } from './growthStore';
import { StudyLoopStore } from './studyLoopStore';

export type HitaishiWorkspaceScope = 'all' | 'chat' | 'study' | 'sidechat' | 'vault';

export interface HitaishiStudySpaceSnapshot {
  spaceId?: string;
  title: string;
  sourceType: 'youtube' | 'pdf' | 'text' | 'topic';
  videoId?: string;
  summary: string;
  keyTakeaways: string[];
  flashcards: Array<{ front: string; back: string }>;
  quizQuestions: Array<{ question: string; options?: string[]; answer?: string }>;
  userNotes: string;
  studyChatTurns: Array<{ role: 'user' | 'assistant'; content: string }>;
  spacesList: Array<{ id: string; name: string; sourceType?: string }>;
  updatedAt: number;
}

export interface HitaishiSideChatTaskSnapshot {
  id: string;
  title: string;
  status: 'running' | 'completed';
  prompt: string;
  response: string;
  timestamp: string;
}

export interface HitaishiChatThreadSnapshot {
  id: string;
  title: string;
  updatedAt?: number;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface HitaishiWorkspaceContextPayload {
  scope: HitaishiWorkspaceScope;
  activeChatThread: HitaishiChatThreadSnapshot | null;
  recentThreads: Array<{ id: string; title: string; lastMessagePreview: string }>;
  activeStudySpace: HitaishiStudySpaceSnapshot | null;
  sideChatTasks: HitaishiSideChatTaskSnapshot[];
  vaultHighlights: Array<{ title: string; type: string; summary: string }>;
  studyLoopDueCount: number;
}

const STUDY_SNAPSHOT_KEY = 'kinich_hitaishi_study_snapshot_v1';
const SIDECHAT_SNAPSHOT_KEY = 'kinich_sidechat_tasks_v1';
const HITAISHI_HISTORY_KEY = 'kinich_hitaishi_chat_history_v1';
const HITAISHI_SCOPE_KEY = 'kinich_hitaishi_workspace_scope_v1';

export function getSavedHitaishiScope(): HitaishiWorkspaceScope {
  if (typeof window === 'undefined') return 'all';
  try {
    const val = localStorage.getItem(HITAISHI_SCOPE_KEY);
    if (val === 'all' || val === 'chat' || val === 'study' || val === 'sidechat' || val === 'vault') {
      return val;
    }
  } catch {}
  return 'all';
}

export function setSavedHitaishiScope(scope: HitaishiWorkspaceScope): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HITAISHI_SCOPE_KEY, scope);
    window.dispatchEvent(new CustomEvent('hitaishi-workspace-updated'));
  } catch {}
}

export function saveStudyWorkspaceToHitaishiBridge(snapshot: Partial<HitaishiStudySpaceSnapshot>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStudyWorkspaceFromHitaishiBridge();
    const merged: HitaishiStudySpaceSnapshot = {
      spaceId: snapshot.spaceId ?? existing?.spaceId ?? 'default-study-space',
      title: snapshot.title || existing?.title || 'Study Space',
      sourceType: snapshot.sourceType || existing?.sourceType || 'topic',
      videoId: snapshot.videoId ?? existing?.videoId,
      summary: (snapshot.summary ?? existing?.summary ?? '').slice(0, 2800),
      keyTakeaways: (snapshot.keyTakeaways ?? existing?.keyTakeaways ?? []).slice(0, 12),
      flashcards: (snapshot.flashcards ?? existing?.flashcards ?? []).slice(0, 20),
      quizQuestions: (snapshot.quizQuestions ?? existing?.quizQuestions ?? []).slice(0, 15),
      userNotes: (snapshot.userNotes ?? existing?.userNotes ?? '').slice(0, 2000),
      studyChatTurns: (snapshot.studyChatTurns ?? existing?.studyChatTurns ?? []).slice(-12),
      spacesList: (snapshot.spacesList ?? existing?.spacesList ?? []).slice(0, 15),
      updatedAt: Date.now(),
    };
    localStorage.setItem(STUDY_SNAPSHOT_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('hitaishi-workspace-updated'));
  } catch {}
}

export function getStudyWorkspaceFromHitaishiBridge(): HitaishiStudySpaceSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STUDY_SNAPSHOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as HitaishiStudySpaceSnapshot;
      }
    }
    // Fallback: inspect kinich_study_spaces_v2 if study workspace hasn't written a snapshot yet
    const spacesRaw = localStorage.getItem('kinich_study_spaces_v2');
    if (spacesRaw) {
      const spaces = JSON.parse(spacesRaw);
      if (Array.isArray(spaces) && spaces.length > 0) {
        const first = spaces[0];
        return {
          spaceId: first.id,
          title: first.name || 'Study Space',
          sourceType: first.sourceType || 'topic',
          videoId: first.videoId,
          summary: first.rawText ? String(first.rawText).slice(0, 1800) : `Active Study Space: ${first.name}`,
          keyTakeaways: [],
          flashcards: [],
          quizQuestions: [],
          userNotes: '',
          studyChatTurns: [],
          spacesList: spaces.slice(0, 12).map((s: any) => ({
            id: String(s.id || ''),
            name: String(s.name || ''),
            sourceType: s.sourceType,
          })),
          updatedAt: Date.now(),
        };
      }
    }
  } catch {}
  return null;
}

export function saveSideChatTasksToHitaishiBridge(tasks: HitaishiSideChatTaskSnapshot[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIDECHAT_SNAPSHOT_KEY, JSON.stringify(tasks.slice(0, 15)));
    window.dispatchEvent(new CustomEvent('hitaishi-workspace-updated'));
  } catch {}
}

export function getSideChatTasksFromHitaishiBridge(): HitaishiSideChatTaskSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SIDECHAT_SNAPSHOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function getChatThreadsFromHitaishiBridge(): {
  activeThread: HitaishiChatThreadSnapshot | null;
  recentThreads: Array<{ id: string; title: string; lastMessagePreview: string }>;
} {
  if (typeof window === 'undefined') {
    return { activeThread: null, recentThreads: [] };
  }
  try {
    const rawThreads = localStorage.getItem('kinich_threads_v2') || localStorage.getItem('kinich_threads');
    const activeId = localStorage.getItem('kinich_active_thread');
    if (!rawThreads) return { activeThread: null, recentThreads: [] };
    const threads = JSON.parse(rawThreads);
    if (!Array.isArray(threads) || threads.length === 0) {
      return { activeThread: null, recentThreads: [] };
    }

    const targetThread =
      (activeId && threads.find((t: any) => t && t.id === activeId)) || threads[0];

    let activeSnapshot: HitaishiChatThreadSnapshot | null = null;
    if (targetThread && Array.isArray(targetThread.messages)) {
      const msgs = targetThread.messages
        .slice(-12)
        .map((m: any) => ({
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: String(m.content || m.text || '').slice(0, 600),
        }))
        .filter((m: { content: string }) => Boolean(m.content.trim()));

      activeSnapshot = {
        id: String(targetThread.id || 'default'),
        title: String(targetThread.title || 'Active Chat'),
        updatedAt: Number(targetThread.updatedAt || Date.now()),
        messages: msgs,
      };
    }

    const recentThreads = threads.slice(0, 8).map((t: any) => {
      const msgs = Array.isArray(t?.messages) ? t.messages : [];
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      return {
        id: String(t?.id || ''),
        title: String(t?.title || 'Untitled Chat').slice(0, 80),
        lastMessagePreview: String(lastMsg?.content || lastMsg?.text || '').slice(0, 140),
      };
    });

    return { activeThread: activeSnapshot, recentThreads };
  } catch {
    return { activeThread: null, recentThreads: [] };
  }
}

export function buildHitaishiWorkspaceContextPayload(
  overrideScope?: HitaishiWorkspaceScope
): HitaishiWorkspaceContextPayload {
  const scope = overrideScope || getSavedHitaishiScope();
  const { activeThread, recentThreads } = getChatThreadsFromHitaishiBridge();
  const activeStudySpace = getStudyWorkspaceFromHitaishiBridge();
  const sideChatTasks = getSideChatTasksFromHitaishiBridge();

  let vaultHighlights: Array<{ title: string; type: string; summary: string }> = [];
  try {
    const items = KnowledgeVaultStore.getItems?.() || [];
    vaultHighlights = items.slice(0, 8).map((it: any) => ({
      title: String(it.title || 'Saved Item').slice(0, 80),
      type: String(it.type || 'note'),
      summary: String(it.content || it.summary || '').slice(0, 220),
    }));
  } catch {}

  let studyLoopDueCount = 0;
  try {
    const cards = StudyLoopStore.getCards?.() || [];
    const now = Date.now();
    studyLoopDueCount = Array.isArray(cards) ? cards.filter((c: any) => (c?.dueAt || 0) <= now).length : 0;
  } catch {}

  return {
    scope,
    activeChatThread: activeThread,
    recentThreads,
    activeStudySpace,
    sideChatTasks,
    vaultHighlights,
    studyLoopDueCount,
  };
}

export interface PersistedHitaishiTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  expression?: string | null;
  action?: string | null;
  timestamp: number;
  characterId?: string;
}

export function getSavedHitaishiHistory(characterId?: string): PersistedHitaishiTurn[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HITAISHI_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (characterId) {
      return parsed.filter((m: any) => !m.characterId || m.characterId === characterId).slice(-24);
    }
    return parsed.slice(-24);
  } catch {
    return [];
  }
}

export function saveHitaishiHistory(turns: PersistedHitaishiTurn[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HITAISHI_HISTORY_KEY, JSON.stringify(turns.slice(-40)));
  } catch {}
}

/**
 * Syncs a Hitaishi voice/text exchange back to the user's Main Chat threads and/or Study Space tutor chat
 * so all workspaces stay unified in real time.
 */
export function syncHitaishiTurnAcrossWorkspaces(params: {
  characterName: string;
  userText: string;
  replyText: string;
  syncToMainChat?: boolean;
  syncToStudyChat?: boolean;
}): void {
  if (typeof window === 'undefined') return;
  const { characterName, userText, replyText, syncToMainChat, syncToStudyChat } = params;
  if (!userText.trim() && !replyText.trim()) return;

  // 1. Always update Study Space chat snapshot if study space exists and syncToStudyChat is enabled
  if (syncToStudyChat) {
    try {
      const currentStudy = getStudyWorkspaceFromHitaishiBridge();
      if (currentStudy) {
        const nextTurns = [
          ...(currentStudy.studyChatTurns || []).slice(-14),
          ...(userText.trim() ? [{ role: 'user' as const, content: userText.trim() }] : []),
          ...(replyText.trim()
            ? [{ role: 'assistant' as const, content: `[${characterName}]: ${replyText.trim()}` }]
            : []),
        ];
        saveStudyWorkspaceToHitaishiBridge({
          ...currentStudy,
          studyChatTurns: nextTurns,
        });
      }
    } catch {}
  }

  // 2. Optionally append to active or dedicated Hitaishi thread in kinich_threads_v2 / kinich_threads
  if (syncToMainChat) {
    try {
      const rawThreads = localStorage.getItem('kinich_threads_v2') || localStorage.getItem('kinich_threads');
      const threads = rawThreads ? JSON.parse(rawThreads) : [];
      if (Array.isArray(threads)) {
        const now = Date.now();
        const userMsg = {
          id: `hitaishi-u-${now}`,
          role: 'user',
          content: userText.trim(),
          timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        const aiMsg = {
          id: `hitaishi-a-${now + 1}`,
          role: 'assistant',
          content: `**${characterName} (Hitaishi Stage):** ${replyText.trim()}`,
          timestamp: new Date(now + 1).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const activeId = localStorage.getItem('kinich_active_thread');
        const idx = threads.findIndex((t: any) => t && t.id === activeId);
        if (idx >= 0) {
          threads[idx] = {
            ...threads[idx],
            updatedAt: now,
            messages: [...(Array.isArray(threads[idx].messages) ? threads[idx].messages : []), userMsg, aiMsg],
          };
        } else {
          const newThreadId = `thread-hitaishi-${now}`;
          threads.unshift({
            id: newThreadId,
            title: `${characterName}: ${userText.trim().slice(0, 36)}`,
            updatedAt: now,
            messages: [userMsg, aiMsg],
          });
          localStorage.setItem('kinich_active_thread', newThreadId);
        }
        const serialized = JSON.stringify(threads.slice(0, 50));
        localStorage.setItem('kinich_threads_v2', serialized);
        localStorage.setItem('kinich_threads', serialized);
        window.dispatchEvent(new CustomEvent('hitaishi-threads-synced'));
      }
    } catch {}
  }
}

export function openHitaishiWithWorkspaceScope(scope: HitaishiWorkspaceScope, initialPrompt?: string): void {
  if (typeof window === 'undefined') return;
  setSavedHitaishiScope(scope);
  if (initialPrompt) {
    try {
      sessionStorage.setItem('hitaishi_pending_prompt', initialPrompt);
    } catch {}
  }
  window.dispatchEvent(
    new CustomEvent('kinich-open-hitaishi', {
      detail: { scope, initialPrompt },
    })
  );
}
