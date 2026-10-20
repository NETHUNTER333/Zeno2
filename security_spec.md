# Zeno Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default-Deny Catch-All**: All paths under `/databases/{database}/documents/{document=**}` are denied by default (`allow read, write: if false;`).
2. **Authentication Requirement**: Unauthenticated callers (`request.auth == null`) cannot read or write any document under `/users/{userId}`, `/users/{userId}/threads/{threadId}`, or `/users/{userId}/bookmarks/{bookmarkId}`.
3. **Strict Tenant Isolation**: A signed-in user `request.auth.uid` may only read, query (`list`), create, update, or delete resources under `/users/{userId}` when `request.auth.uid == userId`.
4. **No Privilege Escalation / Shadow Fields**: `/users/{userId}` strictly permits only `['uid', 'email', 'displayName', 'photoURL', 'createdAt', 'updatedAt']`. Privileged fields (`role`, `isAdmin`, `subscription`, `plan`, `usageQuota`, `tokenLimit`) are unconditionally rejected on both `create` and `update`.
5. **Immutable Identity & Creation Timestamps**:
   - On `/users/{userId}` update: `uid` and `createdAt` cannot be modified (`affectedKeys().hasOnly(['displayName', 'photoURL', 'updatedAt', 'email'])`).
   - On `/users/{userId}/threads/{threadId}` update: `id`, `userId`, and `createdAt` cannot be modified (`affectedKeys().hasOnly(['title', 'messages', 'updatedAt', 'preview'])`).
   - On `/users/{userId}/bookmarks/{bookmarkId}` update: `id`, `userId`, `threadId`, `messageId`, `role`, and `savedAt` cannot be modified (`affectedKeys().hasOnly(['snippet', 'threadTitle'])`).
6. **Secure List Queries**: `allow list` on `/threads` and `/bookmarks` enforces `isOwner(userId) && resource.data.userId == request.auth.uid`.
7. **Explicit Limited Conversation Sharing**: Private threads in `/users/{userId}/threads/{threadId}` are never publicly readable. Shared conversation snapshots live exclusively in `/shared_threads/{shareId}`, allow single-document `get` (never `list`), require `ownerId == request.auth.uid` on `create`/`delete`, and disallow `update`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Operation | Payload / Context | Expected Outcome |
|---|---|---|---|---|---|
| 1 | Unauthenticated Profile Read | `/users/user_alice` | `get` | `auth = null` | `PERMISSION_DENIED` |
| 2 | Cross-User Profile Read (PII Leak) | `/users/user_alice` | `get` | `auth.uid = "user_mallory"` | `PERMISSION_DENIED` |
| 3 | Privilege Escalation (`isAdmin` / `plan` Shadow Fields) | `/users/user_alice` | `create` | `{ uid: "user_alice", email: "a@b.com", isAdmin: true, plan: "enterprise" }` | `PERMISSION_DENIED` |
| 4 | Profile Ownership (`uid`) Mutation on Update | `/users/user_alice` | `update` | `{ uid: "user_mallory", email: "a@b.com", displayName: "Alice" }` | `PERMISSION_DENIED` |
| 5 | Profile `createdAt` Tampering on Update | `/users/user_alice` | `update` | `{ uid: "user_alice", email: "a@b.com", createdAt: 999999999 }` | `PERMISSION_DENIED` |
| 6 | Cross-User Thread Read / List | `/users/user_alice/threads/t_1` | `get` / `list` | `auth.uid = "user_mallory"` | `PERMISSION_DENIED` |
| 7 | Thread Ownership Spoofing on Create | `/users/user_alice/threads/t_1` | `create` | `{ id: "t_1", userId: "user_mallory", title: "Hi", createdAt: 1, messages: [] }` | `PERMISSION_DENIED` |
| 8 | Thread Ownership / `createdAt` Mutation on Update | `/users/user_alice/threads/t_1` | `update` | `{ id: "t_1", userId: "user_alice", title: "Hi", createdAt: 2, messages: [] }` | `PERMISSION_DENIED` |
| 9 | Thread Resource Exhaustion (> 500 messages or > 200 char title) | `/users/user_alice/threads/t_1` | `create` | `title.size() == 250` or `messages.size() == 501` | `PERMISSION_DENIED` |
| 10 | Cross-User Bookmark Delete / Write | `/users/user_alice/bookmarks/bm_1` | `delete` / `create` | `auth.uid = "user_mallory"` | `PERMISSION_DENIED` |
| 11 | Bookmark Invalid Role / Oversized Snippet | `/users/user_alice/bookmarks/bm_1` | `create` | `{ role: "system", snippet: "x".repeat(2500) }` | `PERMISSION_DENIED` |
| 12 | Shared Thread Enumeration (`list`) or Non-Owner Delete | `/shared_threads/sh_1` | `list` / `delete` | `auth.uid = "user_mallory"` | `PERMISSION_DENIED` |
