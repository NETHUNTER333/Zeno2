import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { getDataDir } from './config';
import {
  getServerFirestoreAdapter,
  logFirestoreSyncWarning,
  SERVER_COLLECTIONS,
} from './firestorePersistence';

export interface ReferralCodeRow {
  user_id: string;
  code: string;
  created_at: number;
}

export interface ReferralRow {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  status: 'pending' | 'qualified' | 'rewarded';
  created_at: number;
  qualified_at: number | null;
}

export interface RewardLedgerRow {
  id: string;
  user_id: string;
  amount: number;
  days: number;
  reason: string;
  referral_id: string;
  created_at: number;
}

export interface ReferralStats {
  invited: number;
  qualified: number;
  rewarded: number;
}

export interface ReferralDashboardData {
  code: string;
  link: string;
  stats: ReferralStats;
  referrals: Array<{
    id: string;
    referredUserId: string;
    status: string;
    createdAt: number;
    qualifiedAt: number | null;
  }>;
  rewards: Array<{
    id: string;
    amount: number;
    days: number;
    reason: string;
    referralId: string;
    createdAt: number;
  }>;
}

// In-memory sliding-window rate limit trackers
const claimIpRateLimits = new Map<string, number[]>();
const validateIpRateLimits = new Map<string, number[]>();

function checkRateLimit(
  tracker: Map<string, number[]>,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const timestamps = (tracker.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    tracker.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  tracker.set(key, timestamps);
  return true;
}

export class ReferralDatabase {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
      const parentDir = path.dirname(customPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
    } else {
      const dataDir = getDataDir();
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.dbPath = path.join(dataDir, 'zeno_referrals.db');
    }

    this.db = new DatabaseSync(this.dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        user_id TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS referrals (
        id TEXT PRIMARY KEY,
        referrer_id TEXT NOT NULL,
        referred_user_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK(status IN ('pending', 'qualified', 'rewarded')),
        created_at INTEGER NOT NULL,
        qualified_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS rewards_ledger (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        days INTEGER NOT NULL,
        reason TEXT NOT NULL,
        referral_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS referral_audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        code TEXT,
        ip TEXT,
        success INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
      CREATE INDEX IF NOT EXISTS idx_rewards_user ON rewards_ledger(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_time ON referral_audit_logs(created_at);
    `);
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public logClaimAttempt(
    userId: string | null,
    code: string,
    ip: string,
    success: boolean,
    reason: string
  ): void {
    try {
      const id = `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      this.db
        .prepare(
          `INSERT INTO referral_audit_logs (id, user_id, code, ip, success, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(id, userId, code, ip, success ? 1 : 0, reason, Date.now());
    } catch {}
  }

  /**
   * Computes a deterministic 8-hex referral code (zp_xxxxxxxx) identical on client and server.
   */
  public static computeCanonicalCode(userId: string): string {
    const clean = String(userId || 'guest').trim() || 'guest';
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    const seed = `zeno_ref_${clean}`;
    for (let i = 0; i < seed.length; i++) {
      const ch = seed.charCodeAt(i);
      h1 ^= ch;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= ch + i;
      h2 = Math.imul(h2, 0x85ebca6b);
    }
    const hex1 = (h1 >>> 0).toString(16).padStart(4, '0').slice(-4);
    const hex2 = (h2 >>> 0).toString(16).padStart(4, '0').slice(-4);
    return `zp_${hex1}${hex2}`.toLowerCase();
  }

  /**
   * Generates or retrieves a unique persistent referral code for a user.
   * Format: zp_<unique 8 chars>
   */
  public getOrCreateReferralCode(userId: string): string {
    const canonical = ReferralDatabase.computeCanonicalCode(userId);
    const existing = this.db
      .prepare('SELECT code FROM referral_codes WHERE user_id = ?')
      .get(userId) as { code: string } | undefined;

    if (existing?.code) {
      if (existing.code !== canonical) {
        try {
          this.db
            .prepare('UPDATE referral_codes SET code = ? WHERE user_id = ?')
            .run(canonical, userId);
          return canonical;
        } catch {
          return existing.code;
        }
      }
      return existing.code;
    }

    // Generate unique code based on canonical hash with collision fallback
    let candidate = '';
    let attempts = 0;
    while (attempts < 10) {
      if (attempts === 0) {
        candidate = canonical;
      } else {
        const seed = `${userId}_${attempts}_${Date.now()}`;
        const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8);
        candidate = `zp_${hash}`;
      }

      try {
        this.db
          .prepare('INSERT INTO referral_codes (user_id, code, created_at) VALUES (?, ?, ?)')
          .run(userId, candidate, Date.now());
        return candidate;
      } catch (err: any) {
        if (err?.message?.includes('UNIQUE constraint failed: referral_codes.user_id')) {
          const row = this.db
            .prepare('SELECT code FROM referral_codes WHERE user_id = ?')
            .get(userId) as { code: string };
          return row.code;
        }
        attempts++;
      }
    }
    throw new Error('Failed to generate unique referral code');
  }

  public close(): void {
    try {
      this.db.close();
    } catch {}
  }

  /**
   * Look up a referral code.
   */
  public findByCode(code: string): ReferralCodeRow | null {
    const cleanCode = String(code || '').trim();
    if (!cleanCode) return null;
    const row = this.db
      .prepare('SELECT user_id, code, created_at FROM referral_codes WHERE code = ?')
      .get(cleanCode) as ReferralCodeRow | undefined;
    return row || null;
  }

  /**
   * Look up which referrer referred this user, if any.
   */
  public getReferralForUser(referredUserId: string): ReferralRow | null {
    const row = this.db
      .prepare(
        'SELECT id, referrer_id, referred_user_id, status, created_at, qualified_at FROM referrals WHERE referred_user_id = ?'
      )
      .get(referredUserId) as ReferralRow | undefined;
    return row || null;
  }

  /**
   * Atomically claims a referral code for an authenticated user.
   * Enforces:
   * - No self-referral
   * - One referrer per user, ever
   * - 7-day account creation window
   * - Idempotency
   */
  public claimReferral(params: {
    claimantUserId?: string;
    claimantUid?: string;
    claimantEmail?: string;
    code: string;
    accountCreatedAtMs?: number;
    accountCreatedAt?: number;
    ip?: string;
    ipAddress?: string;
  }): {
    success: boolean;
    claimed: boolean;
    status?: 'claimed' | 'already_claimed' | 'failed';
    alreadyClaimed?: boolean;
    error?: string;
    errorCode?: string;
    code?: string;
    referrerUid?: string;
    referrerId?: string;
    statusCode: number;
  } {
    const claimantUserId = params.claimantUserId || params.claimantUid;
    const claimantEmail = params.claimantEmail;
    const code = params.code;
    const accountCreatedAtMs = params.accountCreatedAtMs ?? params.accountCreatedAt;
    const ip = params.ip || params.ipAddress || '127.0.0.1';

    if (!claimantUserId) {
      this.logClaimAttempt(null, code, ip, false, 'Unauthenticated');
      return { success: false, claimed: false, status: 'failed', error: 'Authentication required', statusCode: 401 };
    }

    const cleanCode = String(code || '').trim();
    if (!cleanCode) {
      this.logClaimAttempt(claimantUserId, code, ip, false, 'Empty code');
      return { success: false, claimed: false, error: 'Referral code is required', statusCode: 400 };
    }

    // Rate limiting: 10 claim requests per 5 minutes per IP
    if (!checkRateLimit(claimIpRateLimits, ip, 10, 5 * 60 * 1000)) {
      this.logClaimAttempt(claimantUserId, cleanCode, ip, false, 'Rate limit exceeded');
      return { success: false, claimed: false, error: 'Too many claim attempts. Please wait a few minutes.', statusCode: 429 };
    }

    const codeRecord = this.findByCode(cleanCode);
    if (!codeRecord) {
      this.logClaimAttempt(claimantUserId, cleanCode, ip, false, 'Code not found');
      return { success: false, claimed: false, error: 'Invalid or unknown referral code', statusCode: 404 };
    }

    // Rule: No self-referral (same user id)
    if (codeRecord.user_id === claimantUserId) {
      this.logClaimAttempt(claimantUserId, cleanCode, ip, false, 'Self-referral by user_id');
      return {
        success: false,
        claimed: false,
        status: 'failed',
        error: 'Self-referrals not permitted. You cannot claim your own referral code.',
        errorCode: 'self_referral_not_allowed',
        statusCode: 400,
      };
    }

    // Rule: 7-day claim window from account creation
    if (accountCreatedAtMs && accountCreatedAtMs > 0) {
      const MAX_CLAIM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - accountCreatedAtMs > MAX_CLAIM_WINDOW_MS) {
        this.logClaimAttempt(claimantUserId, cleanCode, ip, false, 'Account older than 7 days');
        return {
          success: false,
          claimed: false,
          status: 'failed',
          error: 'Referral codes can only be claimed within 7 days of account creation',
          errorCode: 'claim_window_expired',
          statusCode: 400,
        };
      }
    }

    // Rule: One referrer per user, ever. Check existing attribution.
    const existingRef = this.getReferralForUser(claimantUserId);
    if (existingRef) {
      if (existingRef.referrer_id === codeRecord.user_id) {
        // Idempotent success: user already claimed this exact referral
        this.logClaimAttempt(claimantUserId, cleanCode, ip, true, 'Idempotent duplicate claim');
        return {
          success: true,
          claimed: true,
          status: 'already_claimed',
          alreadyClaimed: true,
          referrerUid: codeRecord.user_id,
          referrerId: codeRecord.user_id,
          statusCode: 200,
        };
      }
      this.logClaimAttempt(claimantUserId, cleanCode, ip, false, 'Already referred by another user');
      return {
        success: false,
        claimed: false,
        status: 'failed',
        error: 'This account has already been referred by another researcher',
        errorCode: 'already_referred_by_another',
        statusCode: 409,
      };
    }

    // Insert new pending referral inside immediate transaction
    const refId = `ref_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();

    try {
      this.db.exec('BEGIN IMMEDIATE;');
      this.db
        .prepare(
          `INSERT INTO referrals (id, referrer_id, referred_user_id, status, created_at, qualified_at)
           VALUES (?, ?, ?, 'pending', ?, NULL)`
        )
        .run(refId, codeRecord.user_id, claimantUserId, now);
      this.db.exec('COMMIT;');

      this.logClaimAttempt(claimantUserId, cleanCode, ip, true, 'Successfully claimed referral');
      return {
        success: true,
        claimed: true,
        status: 'claimed',
        referrerUid: codeRecord.user_id,
        referrerId: codeRecord.user_id,
        statusCode: 200,
      };
    } catch (err: any) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {}

      if (err?.message?.includes('UNIQUE constraint failed: referrals.referred_user_id')) {
        const doubleCheck = this.getReferralForUser(claimantUserId);
        if (doubleCheck?.referrer_id === codeRecord.user_id) {
          return { success: true, claimed: true, alreadyClaimed: true, statusCode: 200 };
        }
        return {
          success: false,
          claimed: false,
          error: 'This account has already been referred',
          statusCode: 409,
        };
      }
      this.logClaimAttempt(claimantUserId, cleanCode, ip, false, err?.message || 'Database error');
      return { success: false, claimed: false, error: 'Database transaction failed', statusCode: 500 };
    }
  }

  /**
   * Qualifies a pending referral when the referred user completes a core action
   * (e.g. email verified + first search or chat query executed).
   * Grants rewards atomically in rewards_ledger:
   * - 10 Search Credits + 7 Pro Days for Referrer
   * - 10 Search Credits + 7 Pro Days for Referred User
   * Uses UNIQUE constraints to guarantee double-clicks/retries NEVER pay twice.
   */
  public qualifyReferral(referredUserId: string): {
    qualified: boolean;
    rewarded: boolean;
    rewardCredited?: boolean;
    referrerId?: string;
    referrerUid?: string;
  } {
    const ref = this.getReferralForUser(referredUserId);
    if (!ref || ref.status !== 'pending') {
      return { qualified: false, rewarded: false, rewardCredited: false };
    }

    const now = Date.now();
    const referrerRewardId = `rew_referrer_${ref.id}`;
    const claimantRewardId = `rew_claimant_${ref.id}`;

    try {
      this.db.exec('BEGIN IMMEDIATE;');

      // 1. Mark referral as qualified and rewarded
      const updateRes = this.db
        .prepare(
          `UPDATE referrals
           SET status = 'rewarded', qualified_at = ?
           WHERE id = ? AND status = 'pending'`
        )
        .run(now, ref.id);

      if (updateRes.changes === 0) {
        this.db.exec('ROLLBACK;');
        return { qualified: false, rewarded: false, rewardCredited: false };
      }

      // 2. Insert ledger reward for referrer (+10 Search Credits, +7 Pro Days)
      this.db
        .prepare(
          `INSERT OR IGNORE INTO rewards_ledger (id, user_id, amount, days, reason, referral_id, created_at)
           VALUES (?, ?, 10, 7, 'Referral Bonus: Invited researcher qualified', ?, ?)`
        )
        .run(referrerRewardId, ref.referrer_id, ref.id, now);

      // 3. Insert ledger reward for referred user (+10 Search Credits, +7 Pro Days)
      this.db
        .prepare(
          `INSERT OR IGNORE INTO rewards_ledger (id, user_id, amount, days, reason, referral_id, created_at)
           VALUES (?, ?, 10, 7, 'Welcome Referral Pass Bonus', ?, ?)`
        )
        .run(claimantRewardId, ref.referred_user_id, `${ref.id}_claimant`, now);

      this.db.exec('COMMIT;');
      return {
        qualified: true,
        rewarded: true,
        rewardCredited: true,
        referrerId: ref.referrer_id,
        referrerUid: ref.referrer_id,
      };
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {}
      return { qualified: false, rewarded: false, rewardCredited: false };
    }
  }

  /**
   * Returns dashboard metrics, stats, invited list, and rewards ledger for a user.
   */
  public getDashboard(userId: string): ReferralDashboardData {
    const code = this.getOrCreateReferralCode(userId);
    const link = `https://kinich.app/r/${code}`;

    const referrals = this.db
      .prepare(
        `SELECT id, referred_user_id, status, created_at, qualified_at
         FROM referrals
         WHERE referrer_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId) as Array<{
      id: string;
      referred_user_id: string;
      status: string;
      created_at: number;
      qualified_at: number | null;
    }>;

    const stats: ReferralStats = {
      invited: referrals.length,
      qualified: referrals.filter((r) => r.status === 'qualified' || r.status === 'rewarded').length,
      rewarded: referrals.filter((r) => r.status === 'rewarded').length,
    };

    const rewards = this.db
      .prepare(
        `SELECT id, amount, days, reason, referral_id, created_at
         FROM rewards_ledger
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId) as Array<{
      id: string;
      amount: number;
      days: number;
      reason: string;
      referral_id: string;
      created_at: number;
    }>;

    return {
      code,
      link,
      stats,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredUserId: r.referred_user_id,
        status: r.status,
        createdAt: r.created_at,
        qualifiedAt: r.qualified_at,
      })),
      rewards: rewards.map((rw) => ({
        id: rw.id,
        amount: rw.amount,
        days: rw.days,
        reason: rw.reason,
        referralId: rw.referral_id,
        createdAt: rw.created_at,
      })),
    };
  }

  /**
   * Public validation of a referral code (rate-limited per IP)
   */
  public validateCode(code: string, ip = '127.0.0.1'): {
    valid: boolean;
    code?: string;
    referrerUid?: string;
    referrerName?: string;
    reason?: string;
  } {
    // Rate limit: 30 requests per minute per IP
    if (!checkRateLimit(validateIpRateLimits, ip, 30, 60 * 1000)) {
      return { valid: false, reason: 'Rate limit exceeded. Please wait a moment.' };
    }

    const cleanCode = String(code || '').trim();
    if (!cleanCode || !cleanCode.startsWith('zp_')) {
      return { valid: false, reason: 'Invalid referral code format' };
    }

    const record = this.findByCode(cleanCode);
    if (!record) {
      return { valid: false, reason: 'Referral code not found' };
    }

    const shortId = record.user_id.length > 8 ? record.user_id.slice(0, 6) : record.user_id;
    return {
      valid: true,
      code: record.code,
      referrerUid: record.user_id,
      referrerName: `Researcher ${shortId}`,
    };
  }

  // ============================================================================
  // CROSS-INSTANCE FIRESTORE SYNC & TRANSACTIONAL REFERRAL HELPERS
  // ============================================================================

  private upsertCodeInSqlite(row: ReferralCodeRow): void {
    try {
      this.db
        .prepare(
          `INSERT INTO referral_codes (user_id, code, created_at) VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET code = excluded.code`
        )
        .run(row.user_id, row.code, Number(row.created_at) || Date.now());
    } catch {}
  }

  private upsertReferralInSqlite(row: ReferralRow): void {
    try {
      this.db
        .prepare(
          `INSERT INTO referrals (id, referrer_id, referred_user_id, status, created_at, qualified_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(referred_user_id) DO UPDATE SET
             status = CASE
               WHEN referrals.status = 'rewarded' THEN 'rewarded'
               ELSE excluded.status
             END,
             qualified_at = COALESCE(referrals.qualified_at, excluded.qualified_at)`
        )
        .run(
          row.id,
          row.referrer_id,
          row.referred_user_id,
          row.status,
          Number(row.created_at) || Date.now(),
          row.qualified_at ?? null
        );
    } catch {}
  }

  private upsertRewardInSqlite(row: RewardLedgerRow): void {
    try {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO rewards_ledger (id, user_id, amount, days, reason, referral_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          row.id,
          row.user_id,
          Number(row.amount) || 0,
          Number(row.days) || 0,
          row.reason,
          row.referral_id,
          Number(row.created_at) || Date.now()
        );
    } catch {}
  }

  public async getOrCreateReferralCodeAsync(userId: string): Promise<string> {
    const adapter = getServerFirestoreAdapter();
    if (!adapter) {
      return this.getOrCreateReferralCode(userId);
    }
    try {
      const existing = await adapter.getDoc(SERVER_COLLECTIONS.REFERRAL_CODES, userId);
      const canonical = ReferralDatabase.computeCanonicalCode(userId);
      const code = typeof existing?.code === 'string' && existing.code.startsWith('zp_') ? canonical : canonical;
      const row: ReferralCodeRow = {
        user_id: userId,
        code,
        created_at: Number(existing?.created_at) || Date.now(),
      };
      if (!existing || existing.code !== code) {
        await adapter.setDoc(SERVER_COLLECTIONS.REFERRAL_CODES, userId, row, true);
      }
      this.upsertCodeInSqlite(row);
      return code;
    } catch (err) {
      logFirestoreSyncWarning('referralCodeAsync', err);
      return this.getOrCreateReferralCode(userId);
    }
  }

  public async findByCodeAsync(code: string): Promise<ReferralCodeRow | null> {
    const cleanCode = String(code || '').trim();
    if (!cleanCode) return null;
    const local = this.findByCode(cleanCode);
    if (local) return local;

    const adapter = getServerFirestoreAdapter();
    if (!adapter) return null;
    try {
      const matches = await adapter.queryWhere(SERVER_COLLECTIONS.REFERRAL_CODES, 'code', '==', cleanCode, 1);
      if (matches.length > 0 && matches[0].data?.user_id) {
        const row: ReferralCodeRow = {
          user_id: String(matches[0].data.user_id),
          code: String(matches[0].data.code),
          created_at: Number(matches[0].data.created_at) || Date.now(),
        };
        this.upsertCodeInSqlite(row);
        return row;
      }
    } catch (err) {
      logFirestoreSyncWarning('referralFindCode', err);
    }
    return null;
  }

  public async validateCodeAsync(code: string, ip = '127.0.0.1') {
    if (!checkRateLimit(validateIpRateLimits, ip, 30, 60 * 1000)) {
      return { valid: false, reason: 'Rate limit exceeded. Please wait a moment.' };
    }
    const cleanCode = String(code || '').trim();
    if (!cleanCode || !cleanCode.startsWith('zp_')) {
      return { valid: false, reason: 'Invalid referral code format' };
    }
    const record = await this.findByCodeAsync(cleanCode);
    if (!record) {
      return { valid: false, reason: 'Referral code not found' };
    }
    const shortId = record.user_id.length > 8 ? record.user_id.slice(0, 6) : record.user_id;
    return {
      valid: true,
      code: record.code,
      referrerUid: record.user_id,
      referrerName: `Researcher ${shortId}`,
    };
  }

  public async claimReferralAsync(params: {
    claimantUserId?: string;
    claimantUid?: string;
    claimantEmail?: string;
    code: string;
    accountCreatedAtMs?: number;
    accountCreatedAt?: number;
    ip?: string;
    ipAddress?: string;
  }) {
    const adapter = getServerFirestoreAdapter();
    if (!adapter) {
      return this.claimReferral(params);
    }

    const claimantUserId = params.claimantUserId || params.claimantUid;
    const code = params.code;
    const accountCreatedAtMs = params.accountCreatedAtMs ?? params.accountCreatedAt;
    const ip = params.ip || params.ipAddress || '127.0.0.1';

    if (!claimantUserId) {
      this.logClaimAttempt(null, code, ip, false, 'Unauthenticated');
      return { success: false, claimed: false, status: 'failed' as const, error: 'Authentication required', statusCode: 401 };
    }

    const cleanCode = String(code || '').trim();
    if (!cleanCode) {
      this.logClaimAttempt(claimantUserId, code, ip, false, 'Empty code');
      return { success: false, claimed: false, error: 'Referral code is required', statusCode: 400 };
    }

    if (!checkRateLimit(claimIpRateLimits, ip, 10, 5 * 60 * 1000)) {
      this.logClaimAttempt(claimantUserId, cleanCode, ip, false, 'Rate limit exceeded');
      return { success: false, claimed: false, error: 'Too many claim attempts. Please wait a few minutes.', statusCode: 429 };
    }

    const codeRecord = await this.findByCodeAsync(cleanCode);
    if (!codeRecord) {
      this.logClaimAttempt(claimantUserId, cleanCode, ip, false, 'Code not found');
      return { success: false, claimed: false, error: 'Invalid or unknown referral code', statusCode: 404 };
    }

    if (codeRecord.user_id === claimantUserId) {
      this.logClaimAttempt(claimantUserId, cleanCode, ip, false, 'Self-referral by user_id');
      return {
        success: false,
        claimed: false,
        status: 'failed' as const,
        error: 'Self-referrals not permitted. You cannot claim your own referral code.',
        errorCode: 'self_referral_not_allowed',
        statusCode: 400,
      };
    }

    if (accountCreatedAtMs && accountCreatedAtMs > 0) {
      const MAX_CLAIM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - accountCreatedAtMs > MAX_CLAIM_WINDOW_MS) {
        this.logClaimAttempt(claimantUserId, cleanCode, ip, false, 'Account older than 7 days');
        return {
          success: false,
          claimed: false,
          status: 'failed' as const,
          error: 'Referral codes can only be claimed within 7 days of account creation',
          errorCode: 'claim_window_expired',
          statusCode: 400,
        };
      }
    }

    try {
      const outcome = await adapter.runTransaction(async (tx) => {
        const existingRef = await tx.get(SERVER_COLLECTIONS.REFERRALS, claimantUserId);
        if (existingRef) {
          if (existingRef.referrer_id === codeRecord.user_id) {
            return {
              kind: 'already_claimed' as const,
              row: existingRef as ReferralRow,
            };
          }
          return { kind: 'conflict' as const, row: existingRef as ReferralRow };
        }

        const newRef: ReferralRow = {
          id: `ref_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          referrer_id: codeRecord.user_id,
          referred_user_id: claimantUserId,
          status: 'pending',
          created_at: Date.now(),
          qualified_at: null,
        };
        tx.set(SERVER_COLLECTIONS.REFERRALS, claimantUserId, newRef, false);
        return { kind: 'claimed' as const, row: newRef };
      });

      if (outcome.kind === 'conflict') {
        this.upsertReferralInSqlite(outcome.row);
        this.logClaimAttempt(claimantUserId, cleanCode, ip, false, 'Already referred by another user');
        return {
          success: false,
          claimed: false,
          status: 'failed' as const,
          error: 'This account has already been referred by another researcher',
          errorCode: 'already_referred_by_another',
          statusCode: 409,
        };
      }

      this.upsertReferralInSqlite(outcome.row);
      if (outcome.kind === 'already_claimed') {
        this.logClaimAttempt(claimantUserId, cleanCode, ip, true, 'Idempotent duplicate claim');
        return {
          success: true,
          claimed: true,
          status: 'already_claimed' as const,
          alreadyClaimed: true,
          referrerUid: codeRecord.user_id,
          referrerId: codeRecord.user_id,
          statusCode: 200,
        };
      }

      this.logClaimAttempt(claimantUserId, cleanCode, ip, true, 'Successfully claimed referral');
      return {
        success: true,
        claimed: true,
        status: 'claimed' as const,
        referrerUid: codeRecord.user_id,
        referrerId: codeRecord.user_id,
        statusCode: 200,
      };
    } catch (err) {
      logFirestoreSyncWarning('referralClaimTx', err);
      return this.claimReferral(params);
    }
  }

  public async qualifyReferralAsync(referredUserId: string): Promise<{
    qualified: boolean;
    rewarded: boolean;
    rewardCredited?: boolean;
    referrerId?: string;
    referrerUid?: string;
  }> {
    const adapter = getServerFirestoreAdapter();
    if (!adapter) {
      return this.qualifyReferral(referredUserId);
    }

    try {
      const outcome = await adapter.runTransaction(async (tx) => {
        const ref = (await tx.get(SERVER_COLLECTIONS.REFERRALS, referredUserId)) as ReferralRow | null;
        if (!ref || ref.status !== 'pending') {
          return { qualified: false, rewarded: false, rewardCredited: false };
        }

        const now = Date.now();
        const updatedRef: ReferralRow = {
          ...ref,
          status: 'rewarded',
          qualified_at: now,
        };
        const referrerReward: RewardLedgerRow = {
          id: `rew_referrer_${ref.id}`,
          user_id: ref.referrer_id,
          amount: 10,
          days: 7,
          reason: 'Referral Bonus: Invited researcher qualified',
          referral_id: ref.id,
          created_at: now,
        };
        const claimantReward: RewardLedgerRow = {
          id: `rew_claimant_${ref.id}`,
          user_id: ref.referred_user_id,
          amount: 10,
          days: 7,
          reason: 'Welcome Referral Pass Bonus',
          referral_id: `${ref.id}_claimant`,
          created_at: now,
        };

        tx.set(SERVER_COLLECTIONS.REFERRALS, referredUserId, updatedRef, false);
        tx.set(SERVER_COLLECTIONS.REFERRAL_REWARDS, referrerReward.id, referrerReward, false);
        tx.set(SERVER_COLLECTIONS.REFERRAL_REWARDS, claimantReward.id, claimantReward, false);

        return {
          qualified: true,
          rewarded: true,
          rewardCredited: true,
          referrerId: ref.referrer_id,
          referrerUid: ref.referrer_id,
          updatedRef,
          referrerReward,
          claimantReward,
        };
      });

      if (outcome.qualified && (outcome as any).updatedRef) {
        this.upsertReferralInSqlite((outcome as any).updatedRef);
        this.upsertRewardInSqlite((outcome as any).referrerReward);
        this.upsertRewardInSqlite((outcome as any).claimantReward);
      }

      return {
        qualified: outcome.qualified,
        rewarded: outcome.rewarded,
        rewardCredited: outcome.rewardCredited,
        referrerId: outcome.referrerId,
        referrerUid: outcome.referrerUid,
      };
    } catch (err) {
      logFirestoreSyncWarning('referralQualifyTx', err);
      return this.qualifyReferral(referredUserId);
    }
  }

  public async getReferralForUserAsync(referredUserId: string): Promise<ReferralRow | null> {
    const adapter = getServerFirestoreAdapter();
    if (adapter) {
      try {
        const remote = await adapter.getDoc(SERVER_COLLECTIONS.REFERRALS, referredUserId);
        if (remote?.id && remote?.referrer_id) {
          const row = remote as ReferralRow;
          this.upsertReferralInSqlite(row);
          return row;
        }
      } catch (err) {
        logFirestoreSyncWarning('referralGetForUser', err);
      }
    }
    return this.getReferralForUser(referredUserId);
  }

  public async getDashboardAsync(userId: string): Promise<ReferralDashboardData> {
    await this.getOrCreateReferralCodeAsync(userId);
    const adapter = getServerFirestoreAdapter();
    if (adapter) {
      try {
        const [remoteReferrals, remoteRewards] = await Promise.all([
          adapter.queryWhere(SERVER_COLLECTIONS.REFERRALS, 'referrer_id', '==', userId, 100),
          adapter.queryWhere(SERVER_COLLECTIONS.REFERRAL_REWARDS, 'user_id', '==', userId, 100),
        ]);
        for (const r of remoteReferrals) {
          if (r.data?.id && r.data?.referred_user_id) {
            this.upsertReferralInSqlite(r.data as ReferralRow);
          }
        }
        for (const rw of remoteRewards) {
          if (rw.data?.id && rw.data?.user_id) {
            this.upsertRewardInSqlite(rw.data as RewardLedgerRow);
          }
        }
      } catch (err) {
        logFirestoreSyncWarning('referralDashboardHydrate', err);
      }
    }
    return this.getDashboard(userId);
  }
}

// Global Singleton for the backend server
let globalReferralDb: ReferralDatabase | null = null;

export function getReferralDb(customPath?: string): ReferralDatabase {
  if (customPath) {
    return new ReferralDatabase(customPath);
  }
  if (!globalReferralDb) {
    globalReferralDb = new ReferralDatabase();
  }
  return globalReferralDb;
}
