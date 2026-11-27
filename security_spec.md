# StudyGlobe Firestore Security Specification

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document under `/users/{userId}` and its subcollections (`/applications`, `/bookings`, `/documents`, `/messages`, `/notifications`, `/feedback`, `/private/info`) MUST have `uid == request.auth.uid` or `studentId == request.auth.uid` or `userId == request.auth.uid` matching both the path `{userId}` and `request.auth.uid`.
2. **Master Gate Parent Existence**: Every subcollection write MUST verify the parent `/users/{userId}` document exists (or is created in the same atomic batch via `existsAfter`).
3. **No Self-Assigned Roles**: On create, `/users/{userId}.role` MUST be `'student'` and `blocked == false`. Only admins can change `role` or `blocked`.
4. **PII Isolation**: Email and phone details are stored exclusively under `/users/{userId}/private/info`, readable and writable only by `isOwner(userId)` or `isAdmin()`.
5. **Email Verification**: All authenticated mutations require `request.auth.token.email_verified == true`.
6. **Temporal Integrity**: `createdAt == request.time` on create; `createdAt == existing().createdAt` and `updatedAt == request.time` on update.
7. **Terminal State Locking**: Applications in `'Accepted'` status and bookings in `'Completed'` status cannot be downgraded or altered by non-admin users.
8. **System/Admin-Only Fields**: Non-admins cannot mutate `processingStatus` on encrypted documents away from `'Encrypted & Verified'`, cannot mutate `replied` or `senderRole` (`'admin'`/`'ai-bot'`) on messages, and cannot mutate feedback `status` away from `'Open'`.
9. **Path & Size Bounds**: Every ID matches `^[a-zA-Z0-9_\\-]+$` (`<= 128`), every string enforces `.size()`, and arrays are capped (`targetCountries.size() <= 15`).

## 2. Dirty Dozen Adversarial Payloads (Must All Be Rejected with PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Read `/users/user_a` with `auth == null`.
2. **Unverified Email Write**: Create `/users/user_a` with `email_verified: false`.
3. **Self-Assigned Admin Role**: Create `/users/user_a` with `role: 'admin'`.
4. **Cross-Tenant User Read (PII Leak)**: Read `/users/user_a/private/info` authenticated as `user_b`.
5. **Identity Spoofing on Application**: Create `/users/user_a/applications/app_1` as `user_b` or with `studentId: 'user_b'`.
6. **Shadow Ghost Field Injection**: Create `/users/user_a` with extra key `isSuperAdmin: true`.
7. **ID Poisoning**: Create `/users/user_a/applications/bad$id..slash` with invalid ID characters or length > 128.
8. **Client-Forged Timestamp**: Create `/users/user_a/bookings/bk_1` with `createdAt: '2020-01-01T00:00:00Z'` instead of `request.time`.
9. **Immutable Field Tampering**: Update `/users/user_a/applications/app_1` changing `studentId` or `createdAt`.
10. **Terminal State Bypass**: Update an `'Accepted'` application back to `'Draft'` as a student.
11. **Vault Status Escalation**: Student updates `/users/user_a/documents/doc_1` changing `processingStatus` to `'Approved'`.
12. **Blanket Collection Listing**: Student runs `list` query on `/users` or `/users/user_a/applications` as `user_b`.
