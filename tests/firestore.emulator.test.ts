import fs from 'fs';
import path from 'path';
import net from 'net';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const PROJECT_ID = 'demo-zeno-security';
const rulesPath = path.resolve(__dirname, '../firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');

function parseEmulatorHostPort(): { host: string; port: number } {
  const envHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (envHost && envHost.includes(':')) {
    const [h, p] = envHost.split(':');
    return { host: h || '127.0.0.1', port: Number(p) || 8080 };
  }
  return { host: '127.0.0.1', port: 8080 };
}

async function isEmulatorReachable(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok: boolean) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(ok);
      }
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

describe('Real Firebase Emulator Suite — Firestore Runtime Authorization Tests', () => {
  let testEnv: RulesTestEnvironment | null = null;
  const { host, port } = parseEmulatorHostPort();

  beforeAll(async () => {
    const reachable = await isEmulatorReachable(host, port);
    if (!reachable) {
      throw new Error(
        `Firestore Emulator is not listening on ${host}:${port}. Run via "npm run test:emulator" (firebase emulators:exec).`
      );
    }
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        rules,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  it('Dirty Dozen #1 & #2: denies unauthenticated and cross-user reads/writes on /users/{userId} in live Emulator', async () => {
    const unauthedDb = testEnv!.unauthenticatedContext().firestore();
    const aliceDb = testEnv!.authenticatedContext('user_alice', { email: 'alice@example.com' }).firestore();
    const malloryDb = testEnv!.authenticatedContext('user_mallory', { email: 'mallory@example.com' }).firestore();

    // Unauthenticated read & create must fail
    await assertFails(getDoc(doc(unauthedDb, 'users/user_alice')));
    await assertFails(
      setDoc(doc(unauthedDb, 'users/user_alice'), {
        uid: 'user_alice',
        email: 'alice@example.com',
      })
    );

    // Owner create succeeds
    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/user_alice'), {
        uid: 'user_alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        createdAt: 1700000000000,
      })
    );

    // Owner read succeeds
    const snap = await assertSucceeds(getDoc(doc(aliceDb, 'users/user_alice')));
    expect(snap.exists()).toBe(true);

    // Cross-user read, update, and delete by Mallory must fail
    await assertFails(getDoc(doc(malloryDb, 'users/user_alice')));
    await assertFails(updateDoc(doc(malloryDb, 'users/user_alice'), { displayName: 'Pwned' }));
    await assertFails(deleteDoc(doc(malloryDb, 'users/user_alice')));
  });

  it('Dirty Dozen #3, #4, #5: blocks privilege escalation fields, uid mutation, and createdAt tampering in live Emulator', async () => {
    const aliceDb = testEnv!.authenticatedContext('user_alice').firestore();
    const profileRef = doc(aliceDb, 'users/user_alice');

    // Privilege escalation shadow fields on create must fail
    await assertFails(
      setDoc(profileRef, {
        uid: 'user_alice',
        email: 'alice@example.com',
        isAdmin: true,
        plan: 'enterprise',
      })
    );

    // Create valid profile
    await assertSucceeds(
      setDoc(profileRef, {
        uid: 'user_alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        createdAt: 1700000000000,
      })
    );

    // Mutating immutable uid on update must fail
    await assertFails(
      updateDoc(profileRef, {
        uid: 'user_mallory',
      })
    );

    // Mutating immutable createdAt on update must fail
    await assertFails(
      updateDoc(profileRef, {
        createdAt: 9999999999999,
      })
    );

    // Injecting shadow role/quota field on update must fail
    await assertFails(
      updateDoc(profileRef, {
        role: 'superadmin',
      })
    );

    // Valid update of allowed fields (displayName, updatedAt) succeeds
    await assertSucceeds(
      updateDoc(profileRef, {
        displayName: 'Alice Verified',
        updatedAt: 1700000050000,
      })
    );
  });

  it('Dirty Dozen #6, #7, #8, #9: enforces thread ownership, immutable metadata, and message bounds in live Emulator', async () => {
    const aliceDb = testEnv!.authenticatedContext('user_alice').firestore();
    const malloryDb = testEnv!.authenticatedContext('user_mallory').firestore();
    const threadRef = doc(aliceDb, 'users/user_alice/threads/thread_1');

    // Spoofed userId on create must fail
    await assertFails(
      setDoc(threadRef, {
        id: 'thread_1',
        userId: 'user_mallory',
        title: 'Spoofed Thread',
        createdAt: 1700000000000,
        messages: [],
      })
    );

    // Oversized messages list (> 500) must fail
    await assertFails(
      setDoc(threadRef, {
        id: 'thread_1',
        userId: 'user_alice',
        title: 'Huge Thread',
        createdAt: 1700000000000,
        messages: new Array(501).fill({ role: 'user', content: 'x' }),
      })
    );

    // Valid thread create succeeds
    await assertSucceeds(
      setDoc(threadRef, {
        id: 'thread_1',
        userId: 'user_alice',
        title: 'Quantum Research',
        createdAt: 1700000000000,
        messages: [{ role: 'user', content: 'Hello Zeno' }],
      })
    );

    // Cross-user read & delete by Mallory must fail
    await assertFails(getDoc(doc(malloryDb, 'users/user_alice/threads/thread_1')));
    await assertFails(deleteDoc(doc(malloryDb, 'users/user_alice/threads/thread_1')));

    // Mutating createdAt or userId on thread update must fail
    await assertFails(
      updateDoc(threadRef, {
        createdAt: 12345,
      })
    );
    await assertFails(
      updateDoc(threadRef, {
        userId: 'user_mallory',
      })
    );

    // Valid update of title + messages + updatedAt succeeds
    await assertSucceeds(
      updateDoc(threadRef, {
        title: 'Quantum Research Updated',
        messages: [
          { role: 'user', content: 'Hello Zeno' },
          { role: 'assistant', content: 'Hi Alice!' },
        ],
        updatedAt: 1700000090000,
      })
    );
  });

  it('Dirty Dozen #10, #11, #12: enforces bookmark schema and /shared_threads/{shareId} non-enumerable snapshot rules in live Emulator', async () => {
    const unauthedDb = testEnv!.unauthenticatedContext().firestore();
    const aliceDb = testEnv!.authenticatedContext('user_alice').firestore();
    const malloryDb = testEnv!.authenticatedContext('user_mallory').firestore();

    const bookmarkRef = doc(aliceDb, 'users/user_alice/bookmarks/bm_1');

    // Invalid role ('system') on bookmark create must fail
    await assertFails(
      setDoc(bookmarkRef, {
        id: 'bm_1',
        userId: 'user_alice',
        threadId: 'thread_1',
        messageId: 'msg_1',
        role: 'system',
        snippet: 'Key insight',
        threadTitle: 'Quantum Research',
        savedAt: 1700000000000,
      })
    );

    // Valid bookmark create succeeds
    await assertSucceeds(
      setDoc(bookmarkRef, {
        id: 'bm_1',
        userId: 'user_alice',
        threadId: 'thread_1',
        messageId: 'msg_1',
        role: 'assistant',
        snippet: 'Key insight',
        threadTitle: 'Quantum Research',
        savedAt: 1700000000000,
      })
    );

    // Shared thread snapshot: owner creates explicit snapshot
    const shareRefAlice = doc(aliceDb, 'shared_threads/share_xyz_123');
    await assertSucceeds(
      setDoc(shareRefAlice, {
        id: 'share_xyz_123',
        ownerId: 'user_alice',
        title: 'Shared Thread Snapshot',
        createdAt: 1700000000000,
        messages: [{ role: 'user', content: 'Shared question' }],
      })
    );

    // Unauthenticated user can get single shared thread by exact ID
    await assertSucceeds(getDoc(doc(unauthedDb, 'shared_threads/share_xyz_123')));

    // Listing/enumerating /shared_threads collection is strictly denied for everyone
    await assertFails(getDocs(collection(unauthedDb, 'shared_threads')));
    await assertFails(getDocs(collection(aliceDb, 'shared_threads')));

    // Updating a shared snapshot is denied (snapshots are immutable)
    await assertFails(
      updateDoc(shareRefAlice, {
        title: 'Mutated Title',
      })
    );

    // Mallory cannot delete Alice's shared snapshot
    await assertFails(deleteDoc(doc(malloryDb, 'shared_threads/share_xyz_123')));

    // Alice (owner) can revoke/delete her own shared snapshot
    await assertSucceeds(deleteDoc(shareRefAlice));
  });
});
