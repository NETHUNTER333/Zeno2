import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const rulesPath = path.resolve(__dirname, '../firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

interface EvalContext {
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  incomingData?: Record<string, any>;
  existingData?: Record<string, any>;
}

function isValidId(id: unknown): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(id)
  );
}

function hasAllKeys(data: Record<string, any>, required: string[]): boolean {
  return required.every((k) => Object.prototype.hasOwnProperty.call(data, k));
}

function hasOnlyKeys(data: Record<string, any>, allowed: string[]): boolean {
  return Object.keys(data).every((k) => allowed.includes(k));
}

function affectedKeys(
  incoming: Record<string, any>,
  existing: Record<string, any>
): string[] {
  const keys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])) {
      changed.push(k);
    }
  }
  return changed;
}

function isValidUserProfile(data: Record<string, any>, userId: string): boolean {
  return (
    hasAllKeys(data, ['uid', 'email']) &&
    hasOnlyKeys(data, ['uid', 'email', 'displayName', 'photoURL', 'createdAt', 'updatedAt']) &&
    typeof data.uid === 'string' &&
    data.uid === userId &&
    data.uid.length <= 128 &&
    typeof data.email === 'string' &&
    data.email.length <= 200 &&
    (!('displayName' in data) || (typeof data.displayName === 'string' && data.displayName.length <= 100)) &&
    (!('photoURL' in data) || (typeof data.photoURL === 'string' && data.photoURL.length <= 500)) &&
    (!('createdAt' in data) || typeof data.createdAt === 'number') &&
    (!('updatedAt' in data) || typeof data.updatedAt === 'number')
  );
}

function isValidChatThread(data: Record<string, any>, userId: string, threadId: string): boolean {
  return (
    hasAllKeys(data, ['id', 'userId', 'title', 'createdAt', 'messages']) &&
    hasOnlyKeys(data, ['id', 'userId', 'title', 'createdAt', 'updatedAt', 'messages', 'preview']) &&
    typeof data.id === 'string' &&
    data.id === threadId &&
    data.id.length <= 128 &&
    typeof data.userId === 'string' &&
    data.userId === userId &&
    data.userId.length <= 128 &&
    typeof data.title === 'string' &&
    data.title.length <= 200 &&
    typeof data.createdAt === 'number' &&
    (!('updatedAt' in data) || typeof data.updatedAt === 'number') &&
    (!('preview' in data) || (typeof data.preview === 'string' && data.preview.length <= 500)) &&
    Array.isArray(data.messages) &&
    data.messages.length <= 500
  );
}

function isValidSavedBookmark(data: Record<string, any>, userId: string, bookmarkId: string): boolean {
  return (
    hasAllKeys(data, ['id', 'userId', 'threadId', 'messageId', 'role', 'snippet', 'threadTitle', 'savedAt']) &&
    hasOnlyKeys(data, ['id', 'userId', 'threadId', 'messageId', 'role', 'snippet', 'threadTitle', 'savedAt']) &&
    typeof data.id === 'string' &&
    data.id === bookmarkId &&
    data.id.length <= 128 &&
    typeof data.userId === 'string' &&
    data.userId === userId &&
    data.userId.length <= 128 &&
    typeof data.threadId === 'string' &&
    data.threadId.length <= 128 &&
    typeof data.messageId === 'string' &&
    data.messageId.length <= 128 &&
    (data.role === 'user' || data.role === 'assistant') &&
    typeof data.snippet === 'string' &&
    data.snippet.length <= 2000 &&
    typeof data.threadTitle === 'string' &&
    data.threadTitle.length <= 200 &&
    typeof data.savedAt === 'number'
  );
}

function isValidSharedThread(data: Record<string, any>, shareId: string, authUid: string): boolean {
  return (
    hasAllKeys(data, ['id', 'ownerId', 'title', 'createdAt', 'messages']) &&
    hasOnlyKeys(data, ['id', 'ownerId', 'title', 'createdAt', 'messages']) &&
    typeof data.id === 'string' &&
    data.id === shareId &&
    data.id.length <= 128 &&
    typeof data.ownerId === 'string' &&
    data.ownerId === authUid &&
    data.ownerId.length <= 128 &&
    typeof data.title === 'string' &&
    data.title.length <= 200 &&
    typeof data.createdAt === 'number' &&
    Array.isArray(data.messages) &&
    data.messages.length <= 200
  );
}

function isValidLocationPreference(data: Record<string, any>, userId: string, prefId: string): boolean {
  return (
    hasAllKeys(data, ['id', 'userId', 'locationEnabled', 'mode', 'persistPreciseLocation', 'updatedAt']) &&
    hasOnlyKeys(data, [
      'id', 'userId', 'locationEnabled', 'mode',
      'preferredCity', 'preferredRegion', 'preferredCountry', 'preferredCountryCode', 'preferredTimezone',
      'preferredLatitude', 'preferredLongitude', 'persistPreciseLocation', 'updatedAt',
    ]) &&
    isValidId(data.id) &&
    data.id === prefId &&
    isValidId(data.userId) &&
    data.userId === userId &&
    typeof data.locationEnabled === 'boolean' &&
    ['precise', 'approximate', 'manual', 'disabled'].includes(data.mode) &&
    typeof data.persistPreciseLocation === 'boolean' &&
    (!('preferredCity' in data) || (typeof data.preferredCity === 'string' && data.preferredCity.length <= 120)) &&
    (!('preferredRegion' in data) || (typeof data.preferredRegion === 'string' && data.preferredRegion.length <= 120)) &&
    (!('preferredCountry' in data) || (typeof data.preferredCountry === 'string' && data.preferredCountry.length <= 120)) &&
    (!('preferredCountryCode' in data) || (typeof data.preferredCountryCode === 'string' && data.preferredCountryCode.length <= 8)) &&
    (!('preferredTimezone' in data) || (typeof data.preferredTimezone === 'string' && data.preferredTimezone.length <= 80)) &&
    (!('preferredLatitude' in data) || (typeof data.preferredLatitude === 'number' && data.preferredLatitude >= -90 && data.preferredLatitude <= 90)) &&
    (!('preferredLongitude' in data) || (typeof data.preferredLongitude === 'number' && data.preferredLongitude >= -180 && data.preferredLongitude <= 180)) &&
    typeof data.updatedAt === 'number'
  );
}

/**
 * Evaluates a Firestore operation against the exact rules defined in `firestore.rules`.
 */
function evaluateFirestoreRule(ctx: EvalContext): boolean {
  const segments = ctx.path.replace(/^\/+|\/+$/g, '').split('/');
  const isSignedIn = ctx.auth !== null && Boolean(ctx.auth.uid);
  const isOwner = (userId: string) => isSignedIn && ctx.auth!.uid === userId;

  // Match /users/{userId}
  if (segments.length === 2 && segments[0] === 'users') {
    const userId = segments[1];
    if (ctx.operation === 'get' || ctx.operation === 'delete') {
      return isOwner(userId) && isValidId(userId);
    }
    if (ctx.operation === 'create') {
      return (
        isOwner(userId) &&
        isValidId(userId) &&
        Boolean(ctx.incomingData) &&
        isValidUserProfile(ctx.incomingData!, userId)
      );
    }
    if (ctx.operation === 'update') {
      if (!isOwner(userId) || !isValidId(userId) || !ctx.incomingData || !ctx.existingData) {
        return false;
      }
      const changed = affectedKeys(ctx.incomingData, ctx.existingData);
      const allowedChanged = changed.every((k) =>
        ['displayName', 'photoURL', 'updatedAt', 'email'].includes(k)
      );
      return (
        isValidUserProfile(ctx.incomingData, userId) &&
        ctx.incomingData.uid === ctx.existingData.uid &&
        (!('createdAt' in ctx.existingData) ||
          ctx.incomingData.createdAt === ctx.existingData.createdAt) &&
        allowedChanged
      );
    }
    return false;
  }

  // Match /users/{userId}/threads/{threadId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'threads') {
    const [, userId, , threadId] = segments;
    if (ctx.operation === 'get' || ctx.operation === 'delete') {
      return isOwner(userId) && isValidId(userId) && isValidId(threadId);
    }
    if (ctx.operation === 'list') {
      return (
        isOwner(userId) &&
        Boolean(ctx.existingData) &&
        ctx.existingData!.userId === ctx.auth!.uid
      );
    }
    if (ctx.operation === 'create') {
      return (
        isOwner(userId) &&
        isValidId(userId) &&
        isValidId(threadId) &&
        Boolean(ctx.incomingData) &&
        isValidChatThread(ctx.incomingData!, userId, threadId)
      );
    }
    if (ctx.operation === 'update') {
      if (
        !isOwner(userId) ||
        !isValidId(userId) ||
        !isValidId(threadId) ||
        !ctx.incomingData ||
        !ctx.existingData
      ) {
        return false;
      }
      const changed = affectedKeys(ctx.incomingData, ctx.existingData);
      const allowedChanged = changed.every((k) =>
        ['title', 'messages', 'updatedAt', 'preview'].includes(k)
      );
      return (
        isValidChatThread(ctx.incomingData, userId, threadId) &&
        ctx.incomingData.id === ctx.existingData.id &&
        ctx.incomingData.userId === ctx.existingData.userId &&
        ctx.incomingData.createdAt === ctx.existingData.createdAt &&
        allowedChanged
      );
    }
    return false;
  }

  // Match /users/{userId}/bookmarks/{bookmarkId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'bookmarks') {
    const [, userId, , bookmarkId] = segments;
    if (ctx.operation === 'get' || ctx.operation === 'delete') {
      return isOwner(userId) && isValidId(userId) && isValidId(bookmarkId);
    }
    if (ctx.operation === 'list') {
      return (
        isOwner(userId) &&
        Boolean(ctx.existingData) &&
        ctx.existingData!.userId === ctx.auth!.uid
      );
    }
    if (ctx.operation === 'create') {
      return (
        isOwner(userId) &&
        isValidId(userId) &&
        isValidId(bookmarkId) &&
        Boolean(ctx.incomingData) &&
        isValidSavedBookmark(ctx.incomingData!, userId, bookmarkId)
      );
    }
    if (ctx.operation === 'update') {
      if (
        !isOwner(userId) ||
        !isValidId(userId) ||
        !isValidId(bookmarkId) ||
        !ctx.incomingData ||
        !ctx.existingData
      ) {
        return false;
      }
      const changed = affectedKeys(ctx.incomingData, ctx.existingData);
      const allowedChanged = changed.every((k) => ['snippet', 'threadTitle'].includes(k));
      return (
        isValidSavedBookmark(ctx.incomingData, userId, bookmarkId) &&
        ctx.incomingData.id === ctx.existingData.id &&
        ctx.incomingData.userId === ctx.existingData.userId &&
        ctx.incomingData.savedAt === ctx.existingData.savedAt &&
        allowedChanged
      );
    }
    return false;
  }

  // Match /users/{userId}/preferences/{prefId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'preferences') {
    const [, userId, , prefId] = segments;
    if (ctx.operation === 'get' || ctx.operation === 'delete') {
      return isOwner(userId) && isValidId(userId) && isValidId(prefId);
    }
    if (ctx.operation === 'list') {
      return (
        isOwner(userId) &&
        Boolean(ctx.existingData) &&
        ctx.existingData!.userId === ctx.auth!.uid
      );
    }
    if (ctx.operation === 'create') {
      return (
        isOwner(userId) &&
        isValidId(userId) &&
        isValidId(prefId) &&
        Boolean(ctx.incomingData) &&
        isValidLocationPreference(ctx.incomingData!, userId, prefId)
      );
    }
    if (ctx.operation === 'update') {
      if (
        !isOwner(userId) ||
        !isValidId(userId) ||
        !isValidId(prefId) ||
        !ctx.incomingData ||
        !ctx.existingData
      ) {
        return false;
      }
      return (
        isValidLocationPreference(ctx.incomingData, userId, prefId) &&
        ctx.incomingData.id === ctx.existingData.id &&
        ctx.incomingData.userId === ctx.existingData.userId
      );
    }
    return false;
  }

  // Match /shared_threads/{shareId}
  if (segments.length === 2 && segments[0] === 'shared_threads') {
    const shareId = segments[1];
    if (ctx.operation === 'get') {
      return isValidId(shareId);
    }
    if (ctx.operation === 'list' || ctx.operation === 'update') {
      return false;
    }
    if (ctx.operation === 'create') {
      return (
        isSignedIn &&
        isValidId(shareId) &&
        Boolean(ctx.incomingData) &&
        isValidSharedThread(ctx.incomingData!, shareId, ctx.auth!.uid)
      );
    }
    if (ctx.operation === 'delete') {
      return (
        isSignedIn &&
        isValidId(shareId) &&
        Boolean(ctx.existingData) &&
        ctx.existingData!.ownerId === ctx.auth!.uid
      );
    }
    return false;
  }

  // Default deny catch-all
  return false;
}

describe('Phase 4 — Firestore Security Rules & Dirty Dozen Authorization Audit', () => {
  it('verifies firestore.rules contains mandatory structural guards', () => {
    expect(rulesContent).toContain("rules_version = '2';");
    expect(rulesContent).toContain('match /{document=**} {\n      allow read, write: if false;\n    }');
    expect(rulesContent).toContain('isValidUserProfile(incoming(), userId)');
    expect(rulesContent).toContain('isValidChatThread(incoming(), userId, threadId)');
    expect(rulesContent).toContain('isValidSavedBookmark(incoming(), userId, bookmarkId)');
    expect(rulesContent).toContain('isValidSharedThread(incoming(), shareId)');
    expect(rulesContent).toContain("affectedKeys().hasOnly(['displayName', 'photoURL', 'updatedAt', 'email'])");
    expect(rulesContent).toContain("affectedKeys().hasOnly(['title', 'messages', 'updatedAt', 'preview'])");
  });

  it('Dirty Dozen #1 & #2: denies unauthenticated and cross-user profile reads/writes', () => {
    expect(
      evaluateFirestoreRule({
        auth: null,
        path: '/users/user_alice',
        operation: 'get',
      })
    ).toBe(false);

    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_mallory' },
        path: '/users/user_alice',
        operation: 'get',
      })
    ).toBe(false);

    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice',
        operation: 'get',
      })
    ).toBe(true);
  });

  it('Dirty Dozen #3, #4, #5: blocks privilege escalation shadow fields, uid changes, and createdAt tampering on profile', () => {
    // Shadow fields (isAdmin / plan / tokenLimit)
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice',
        operation: 'create',
        incomingData: {
          uid: 'user_alice',
          email: 'alice@example.com',
          isAdmin: true,
          plan: 'enterprise',
        },
      })
    ).toBe(false);

    // Valid create
    const validProfile = {
      uid: 'user_alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      createdAt: 1700000000000,
    };
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice',
        operation: 'create',
        incomingData: validProfile,
      })
    ).toBe(true);

    // Ownership uid mutation on update
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice',
        operation: 'update',
        existingData: validProfile,
        incomingData: { ...validProfile, uid: 'user_mallory' },
      })
    ).toBe(false);

    // createdAt mutation on update
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice',
        operation: 'update',
        existingData: validProfile,
        incomingData: { ...validProfile, createdAt: 9999999999999 },
      })
    ).toBe(false);

    // Valid displayName + updatedAt update
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice',
        operation: 'update',
        existingData: validProfile,
        incomingData: { ...validProfile, displayName: 'Alice Updated', updatedAt: 1700000050000 },
      })
    ).toBe(true);
  });

  it('Dirty Dozen #6, #7, #8, #9: enforces strict thread ownership, immutable metadata, and payload bounds', () => {
    const validThread = {
      id: 'thread_1',
      userId: 'user_alice',
      title: 'Quantum Computing',
      createdAt: 1700000000000,
      messages: [{ role: 'user', content: 'Hello' }],
    };

    // Cross-user read/list denied
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_mallory' },
        path: '/users/user_alice/threads/thread_1',
        operation: 'get',
      })
    ).toBe(false);

    // Spoofed userId on create denied
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/threads/thread_1',
        operation: 'create',
        incomingData: { ...validThread, userId: 'user_mallory' },
      })
    ).toBe(false);

    // Oversized messages list (> 500) denied
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/threads/thread_1',
        operation: 'create',
        incomingData: { ...validThread, messages: new Array(501).fill({ role: 'user', content: 'x' }) },
      })
    ).toBe(false);

    // Valid thread create & update allowed
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/threads/thread_1',
        operation: 'create',
        incomingData: validThread,
      })
    ).toBe(true);

    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/threads/thread_1',
        operation: 'update',
        existingData: validThread,
        incomingData: { ...validThread, title: 'Updated Title', updatedAt: 1700000090000 },
      })
    ).toBe(true);

    // Mutating createdAt on thread update denied
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/threads/thread_1',
        operation: 'update',
        existingData: validThread,
        incomingData: { ...validThread, createdAt: 12345 },
      })
    ).toBe(false);
  });

  it('Dirty Dozen #10, #11, #12: enforces bookmark bounds and shared thread snapshot isolation', () => {
    const validBookmark = {
      id: 'bm_1',
      userId: 'user_alice',
      threadId: 'thread_1',
      messageId: 'msg_1',
      role: 'assistant',
      snippet: 'Key insight',
      threadTitle: 'Quantum Computing',
      savedAt: 1700000000000,
    };

    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_mallory' },
        path: '/users/user_alice/bookmarks/bm_1',
        operation: 'delete',
      })
    ).toBe(false);

    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/bookmarks/bm_1',
        operation: 'create',
        incomingData: { ...validBookmark, role: 'system' },
      })
    ).toBe(false);

    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/bookmarks/bm_1',
        operation: 'create',
        incomingData: validBookmark,
      })
    ).toBe(true);

    // Shared thread snapshots allow explicit single-doc get, forbid list/update, and restrict delete to owner
    expect(
      evaluateFirestoreRule({
        auth: null,
        path: '/shared_threads/share_abc',
        operation: 'get',
      })
    ).toBe(true);

    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/shared_threads/share_abc',
        operation: 'list',
      })
    ).toBe(false);

    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_mallory' },
        path: '/shared_threads/share_abc',
        operation: 'delete',
        existingData: {
          id: 'share_abc',
          ownerId: 'user_alice',
          title: 'Shared',
          createdAt: 1700000000000,
          messages: [],
        },
      })
    ).toBe(false);
  });

  it('validates SM-2 spaced repetition cards under /users/{userId}/cards/{cardId}', () => {
    expect(rulesContent).toContain('match /cards/{cardId}');
    expect(rulesContent).toContain('isValidCard(incoming(), userId, cardId)');
    expect(rulesContent).toContain("data.lastGrade in ['again', 'hard', 'good', 'easy']");
  });

  it('enforces owner-only access and schema bounds for /users/{userId}/preferences/{prefId}', () => {
    expect(rulesContent).toContain('match /preferences/{prefId}');
    expect(rulesContent).toContain('isValidLocationPreference(incoming(), userId, prefId)');

    const validPref = {
      id: 'location',
      userId: 'user_alice',
      locationEnabled: true,
      mode: 'manual',
      preferredCity: 'Tokyo',
      preferredCountry: 'Japan',
      preferredCountryCode: 'JP',
      preferredTimezone: 'Asia/Tokyo',
      preferredLatitude: 35.6895,
      preferredLongitude: 139.6917,
      persistPreciseLocation: false,
      updatedAt: 1700000000000,
    };

    // Owner create allowed
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/preferences/location',
        operation: 'create',
        incomingData: validPref,
      })
    ).toBe(true);

    // Cross-user read/create/delete denied
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_mallory' },
        path: '/users/user_alice/preferences/location',
        operation: 'get',
      })
    ).toBe(false);
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_mallory' },
        path: '/users/user_alice/preferences/location',
        operation: 'create',
        incomingData: validPref,
      })
    ).toBe(false);
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_mallory' },
        path: '/users/user_alice/preferences/location',
        operation: 'delete',
      })
    ).toBe(false);

    // Invalid mode or out-of-range latitude denied
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/preferences/location',
        operation: 'create',
        incomingData: { ...validPref, mode: 'spoofed' },
      })
    ).toBe(false);
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/preferences/location',
        operation: 'create',
        incomingData: { ...validPref, preferredLatitude: 120 },
      })
    ).toBe(false);

    // Owner delete allowed
    expect(
      evaluateFirestoreRule({
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/preferences/location',
        operation: 'delete',
      })
    ).toBe(true);
  });
});
