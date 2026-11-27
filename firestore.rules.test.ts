/**
 * Phase 0 Dirty Dozen Security Rule Verification Suite
 * Designed for @firebase/rules-unit-testing against firestore.rules.
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  actorUid: string | null;
  emailVerified: boolean;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read of user profile',
    actorUid: null,
    emailVerified: false,
    operation: 'get',
    path: 'users/student_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email user creates profile',
    actorUid: 'student_1',
    emailVerified: false,
    operation: 'create',
    path: 'users/student_1',
    payload: { uid: 'student_1', role: 'student' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-assigned admin privilege escalation on create',
    actorUid: 'student_1',
    emailVerified: true,
    operation: 'create',
    path: 'users/student_1',
    payload: { uid: 'student_1', role: 'admin', blocked: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-user PII read on private info',
    actorUid: 'student_2',
    emailVerified: true,
    operation: 'get',
    path: 'users/student_1/private/info',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity spoofing on application creation',
    actorUid: 'student_1',
    emailVerified: true,
    operation: 'create',
    path: 'users/student_1/applications/app_1',
    payload: { studentId: 'student_2', programId: 'prog_1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow ghost field injection on user profile',
    actorUid: 'student_1',
    emailVerified: true,
    operation: 'create',
    path: 'users/student_1',
    payload: { uid: 'student_1', role: 'student', isSuperAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Document ID poisoning with invalid characters',
    actorUid: 'student_1',
    emailVerified: true,
    operation: 'create',
    path: 'users/student_1/applications/bad$id',
    payload: { studentId: 'student_1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-forged createdAt timestamp',
    actorUid: 'student_1',
    emailVerified: true,
    operation: 'create',
    path: 'users/student_1/bookings/bk_1',
    payload: { studentId: 'student_1', createdAt: '2020-01-01T00:00:00.000Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable studentId mutation on update',
    actorUid: 'student_1',
    emailVerified: true,
    operation: 'update',
    path: 'users/student_1/applications/app_1',
    payload: { studentId: 'student_2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal state downgrade on Accepted application',
    actorUid: 'student_1',
    emailVerified: true,
    operation: 'update',
    path: 'users/student_1/applications/app_accepted',
    payload: { status: 'Draft' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Student self-approving encrypted vault document',
    actorUid: 'student_1',
    emailVerified: true,
    operation: 'update',
    path: 'users/student_1/documents/doc_1',
    payload: { processingStatus: 'Approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cross-tenant collection list query',
    actorUid: 'student_2',
    emailVerified: true,
    operation: 'list',
    path: 'users/student_1/applications',
    expected: 'PERMISSION_DENIED',
  },
];
