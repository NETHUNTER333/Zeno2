import { db, auth } from './firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { ThinkingStep } from '../components/ui/thinking-state';

export interface AnswerSource {
  id: number;
  name: string;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

export interface DeepResearchRecord {
  id: string;
  topic: string;
  question: string;
  fullAnswer: string;
  sources: AnswerSource[];
  thinkingSteps?: ThinkingStep[];
  durationSec: number;
  thinkingDuration?: number;
  followUps?: string[];
  modelId?: string;
  createdAt: number;
}

const STORAGE_KEY = 'zeno_deep_research_history_v1';
const LISTENERS: Set<() => void> = new Set();

function notifyListeners() {
  LISTENERS.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

function loadLocalHistory(): DeepResearchRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  } catch {}
  return [];
}

function saveLocalHistory(records: DeepResearchRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 100)));
  } catch {}
  notifyListeners();
}

export const DeepResearchHistoryStore = {
  getHistory(): DeepResearchRecord[] {
    return loadLocalHistory();
  },

  subscribe(listener: () => void): () => void {
    LISTENERS.add(listener);
    return () => {
      LISTENERS.delete(listener);
    };
  },

  async saveRecord(
    input: Omit<DeepResearchRecord, 'id' | 'createdAt'> & {
      id?: string;
      createdAt?: number;
    }
  ): Promise<DeepResearchRecord> {
    const id =
      input.id ||
      `dr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = input.createdAt || Date.now();

    const record: DeepResearchRecord = {
      id,
      topic: input.topic || input.question.slice(0, 80),
      question: input.question,
      fullAnswer: input.fullAnswer,
      sources: input.sources || [],
      thinkingSteps: input.thinkingSteps || [],
      durationSec: input.durationSec || 0,
      thinkingDuration: input.thinkingDuration || 1,
      followUps: input.followUps || [],
      modelId: input.modelId || 'deepseek-v4.1',
      createdAt,
    };

    // 1. Immediately update local storage
    const current = loadLocalHistory();
    const filtered = current.filter((r) => r.id !== id);
    const updated = [record, ...filtered];
    saveLocalHistory(updated);

    // 2. Persist to Firestore if user is authenticated
    try {
      const user = auth.currentUser;
      if (user && db) {
        const docRef = doc(db, 'users', user.uid, 'deep_research', id);
        await setDoc(docRef, {
          id: record.id,
          topic: record.topic,
          question: record.question,
          fullAnswer: record.fullAnswer,
          sources: record.sources,
          thinkingSteps: record.thinkingSteps,
          durationSec: record.durationSec,
          thinkingDuration: record.thinkingDuration,
          followUps: record.followUps,
          modelId: record.modelId,
          createdAt: record.createdAt,
        });
      }
    } catch {
      // Graceful fallback to offline/localStorage
    }

    return record;
  },

  async deleteRecord(id: string): Promise<void> {
    const current = loadLocalHistory();
    const updated = current.filter((r) => r.id !== id);
    saveLocalHistory(updated);

    try {
      const user = auth.currentUser;
      if (user && db) {
        const docRef = doc(db, 'users', user.uid, 'deep_research', id);
        await deleteDoc(docRef);
      }
    } catch {}
  },

  async clearAll(): Promise<void> {
    const current = loadLocalHistory();
    saveLocalHistory([]);

    try {
      const user = auth.currentUser;
      if (user && db) {
        for (const item of current) {
          const docRef = doc(db, 'users', user.uid, 'deep_research', item.id);
          deleteDoc(docRef).catch(() => {});
        }
      }
    } catch {}
  },

  async syncFromFirestore(): Promise<DeepResearchRecord[]> {
    try {
      const user = auth.currentUser;
      if (!user || !db) return loadLocalHistory();

      const collRef = collection(db, 'users', user.uid, 'deep_research');
      const q = query(collRef, orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const remoteRecords: DeepResearchRecord[] = [];
        snap.forEach((d) => {
          const data = d.data() as DeepResearchRecord;
          if (data && data.question && data.fullAnswer) {
            remoteRecords.push(data);
          }
        });

        // Merge with local records
        const local = loadLocalHistory();
        const map = new Map<string, DeepResearchRecord>();
        local.forEach((r) => map.set(r.id, r));
        remoteRecords.forEach((r) => map.set(r.id, r));

        const merged = Array.from(map.values()).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );
        saveLocalHistory(merged);
        return merged;
      }
    } catch {}
    return loadLocalHistory();
  },
};
