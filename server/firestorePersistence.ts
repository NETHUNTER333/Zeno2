import crypto from 'crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { getAdminFirestore, getOrInitFirebaseAdmin } from './auth';
import {
  isServerFirestoreCredentialsAvailable,
  isTestRuntime,
  sanitizeErrorMessage,
} from './config';

export const SERVER_COLLECTIONS = {
  BILLING_USERS: '_server_billing_users',
  BILLING_SUBSCRIPTIONS: '_server_billing_subscriptions',
  BILLING_PAYMENTS: '_server_billing_payments',
  BILLING_REFUNDS: '_server_billing_refunds',
  BILLING_WEBHOOKS: '_server_billing_webhooks',
  BILLING_META: '_server_billing_meta',
  REFERRAL_CODES: '_server_referral_codes',
  REFERRALS: '_server_referrals',
  REFERRAL_REWARDS: '_server_referral_rewards',
  RATE_LIMITS: '_server_rate_limits',
} as const;

export interface ServerDocTransaction {
  get(collectionPath: string, docId: string): Promise<Record<string, any> | null>;
  set(collectionPath: string, docId: string, data: Record<string, any>, merge?: boolean): void;
  delete(collectionPath: string, docId: string): void;
}

export interface ServerFirestoreAdapter {
  getDoc(collectionPath: string, docId: string): Promise<Record<string, any> | null>;
  setDoc(collectionPath: string, docId: string, data: Record<string, any>, merge?: boolean): Promise<void>;
  queryWhere(
    collectionPath: string,
    field: string,
    op: '==' | '>=' | '<=',
    value: unknown,
    limitCount?: number
  ): Promise<Array<{ id: string; data: Record<string, any> }>>;
  runTransaction<T>(fn: (tx: ServerDocTransaction) => Promise<T>): Promise<T>;
}

let customTestAdapter: ServerFirestoreAdapter | null = null;

export function setFirestoreAdapterForTests(adapter: ServerFirestoreAdapter | null): void {
  customTestAdapter = adapter;
}

export function canUseServerFirestore(): boolean {
  if (customTestAdapter) return true;
  if (isTestRuntime()) return false;
  if (process.env.DISABLE_SERVER_FIRESTORE === 'true') return false;
  return isServerFirestoreCredentialsAvailable();
}

export function toSafeFirestoreDocId(rawId: string, fallbackPrefix = 'doc'): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.\-:]/g, '_');
  if (cleaned && cleaned !== '.' && cleaned !== '..' && cleaned.length <= 256) {
    return cleaned;
  }
  const digest = crypto.createHash('sha256').update(String(rawId || fallbackPrefix)).digest('hex').slice(0, 32);
  return `${fallbackPrefix}_${digest}`;
}

export function hashBucketKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function createRealFirestoreAdapter(): ServerFirestoreAdapter {
  const getDb = (): Firestore => getAdminFirestore(getOrInitFirebaseAdmin());

  return {
    async getDoc(collectionPath: string, docId: string) {
      const safeId = toSafeFirestoreDocId(docId);
      const snap = await getDb().collection(collectionPath).doc(safeId).get();
      return snap.exists ? ((snap.data() as Record<string, any>) || null) : null;
    },
    async setDoc(collectionPath: string, docId: string, data: Record<string, any>, merge = true) {
      const safeId = toSafeFirestoreDocId(docId);
      await getDb().collection(collectionPath).doc(safeId).set(data, { merge });
    },
    async queryWhere(
      collectionPath: string,
      field: string,
      op: '==' | '>=' | '<=',
      value: unknown,
      limitCount = 50
    ) {
      const snap = await getDb()
        .collection(collectionPath)
        .where(field, op, value)
        .limit(limitCount)
        .get();
      return snap.docs.map((d) => ({ id: d.id, data: (d.data() as Record<string, any>) || {} }));
    },
    async runTransaction<T>(fn: (tx: ServerDocTransaction) => Promise<T>): Promise<T> {
      const db = getDb();
      return db.runTransaction(async (adminTx: Transaction) => {
        const wrappedTx: ServerDocTransaction = {
          async get(collectionPath: string, docId: string) {
            const ref = db.collection(collectionPath).doc(toSafeFirestoreDocId(docId));
            const snap = await adminTx.get(ref);
            return snap.exists ? ((snap.data() as Record<string, any>) || null) : null;
          },
          set(collectionPath: string, docId: string, data: Record<string, any>, merge = true) {
            const ref = db.collection(collectionPath).doc(toSafeFirestoreDocId(docId));
            adminTx.set(ref, data, { merge });
          },
          delete(collectionPath: string, docId: string) {
            const ref = db.collection(collectionPath).doc(toSafeFirestoreDocId(docId));
            adminTx.delete(ref);
          },
        };
        return fn(wrappedTx);
      });
    },
  };
}

export function getServerFirestoreAdapter(): ServerFirestoreAdapter | null {
  if (!canUseServerFirestore()) return null;
  if (customTestAdapter) return customTestAdapter;
  return createRealFirestoreAdapter();
}

/**
 * Deterministic in-memory Firestore adapter for offline multi-instance integration tests.
 * Uses deep JSON cloning and serialized transaction queuing to mirror real Firestore transactions.
 */
export class InMemoryServerFirestoreAdapter implements ServerFirestoreAdapter {
  private readonly store = new Map<string, Map<string, Record<string, any>>>();
  private txChain: Promise<unknown> = Promise.resolve();
  public simulateOutage = false;

  private getCol(name: string): Map<string, Record<string, any>> {
    let col = this.store.get(name);
    if (!col) {
      col = new Map();
      this.store.set(name, col);
    }
    return col;
  }

  private checkOutage() {
    if (this.simulateOutage) {
      throw new Error('UNAVAILABLE: Firestore simulated outage');
    }
  }

  async getDoc(collectionPath: string, docId: string): Promise<Record<string, any> | null> {
    this.checkOutage();
    const row = this.getCol(collectionPath).get(toSafeFirestoreDocId(docId));
    return row ? structuredClone(row) : null;
  }

  async setDoc(
    collectionPath: string,
    docId: string,
    data: Record<string, any>,
    merge = true
  ): Promise<void> {
    this.checkOutage();
    const safeId = toSafeFirestoreDocId(docId);
    const col = this.getCol(collectionPath);
    const existing = merge ? col.get(safeId) : undefined;
    col.set(safeId, existing ? { ...structuredClone(existing), ...structuredClone(data) } : structuredClone(data));
  }

  async queryWhere(
    collectionPath: string,
    field: string,
    op: '==' | '>=' | '<=',
    value: unknown,
    limitCount = 50
  ): Promise<Array<{ id: string; data: Record<string, any> }>> {
    this.checkOutage();
    const col = this.getCol(collectionPath);
    const out: Array<{ id: string; data: Record<string, any> }> = [];
    for (const [id, data] of col.entries()) {
      const fv = data[field];
      const match =
        op === '==' ? fv === value : op === '>=' ? (fv as any) >= (value as any) : (fv as any) <= (value as any);
      if (match) {
        out.push({ id, data: structuredClone(data) });
        if (out.length >= limitCount) break;
      }
    }
    return out;
  }

  async runTransaction<T>(fn: (tx: ServerDocTransaction) => Promise<T>): Promise<T> {
    this.checkOutage();
    const exec = async () => {
      this.checkOutage();
      const pendingWrites: Array<() => void> = [];
      const tx: ServerDocTransaction = {
        get: async (collectionPath, docId) => {
          const row = this.getCol(collectionPath).get(toSafeFirestoreDocId(docId));
          return row ? structuredClone(row) : null;
        },
        set: (collectionPath, docId, data, merge = true) => {
          pendingWrites.push(() => {
            const safeId = toSafeFirestoreDocId(docId);
            const col = this.getCol(collectionPath);
            const existing = merge ? col.get(safeId) : undefined;
            col.set(
              safeId,
              existing ? { ...structuredClone(existing), ...structuredClone(data) } : structuredClone(data)
            );
          });
        },
        delete: (collectionPath, docId) => {
          pendingWrites.push(() => {
            this.getCol(collectionPath).delete(toSafeFirestoreDocId(docId));
          });
        },
      };
      const result = await fn(tx);
      for (const apply of pendingWrites) apply();
      return result;
    };

    const next = this.txChain.then(exec, exec);
    this.txChain = next.catch(() => {});
    return next;
  }

  clear(): void {
    this.store.clear();
  }
}

export function logFirestoreSyncWarning(scope: string, err: unknown): void {
  if (isTestRuntime()) return;
  console.warn(`[FirestoreSync:${scope}]`, sanitizeErrorMessage(err));
}
