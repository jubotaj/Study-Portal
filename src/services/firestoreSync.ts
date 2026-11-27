import type { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase.ts';
import type {
  AcademicProfile,
  Application,
  EncryptedDocument,
  LanguageCode,
  MentorshipBooking,
  PortalNotification,
  PublicUser,
  SubscriptionTier,
  SupportMessage,
  UserFeedback,
} from '../types.ts';

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

function clampString(raw: unknown, max: number, fallback = ''): string {
  const str = String(raw ?? fallback).trim();
  if (!str && fallback) return fallback.slice(0, max);
  return str.slice(0, max);
}

function clampCountries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ['Germany', 'Switzerland'];
  return raw
    .map((c) => clampString(c, 60))
    .filter(Boolean)
    .slice(0, 15);
}

function isoFromFirestoreTime(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string' && val) return val;
  return new Date().toISOString();
}

function buildDefaultProfile(seed?: PublicUser | null): AcademicProfile {
  return (
    seed?.academicProfile ?? {
      gpa: 3.7,
      degreeTarget: 'Master',
      field: 'Computer Science & AI',
      targetCountries: ['Switzerland', 'Germany'],
      financialNeed: 'moderate',
      englishScore: 'IELTS 7.5',
      workExperienceMonths: 12,
    }
  );
}

export async function ensureFirebaseUserWorkspaceDocs(
  firebaseUser: FirebaseUser,
  seedUser?: PublicUser | null,
): Promise<PublicUser> {
  const uid = sanitizeId(firebaseUser.uid, 'usr');
  const userDocPath = `users/${uid}`;
  const privateDocPath = `users/${uid}/private/info`;

  let snap;
  try {
    snap = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userDocPath);
  }

  let privateSnap;
  try {
    privateSnap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privateDocPath);
  }

  const profile = buildDefaultProfile(seedUser);
  const nowIso = new Date().toISOString();

  if (!snap.exists()) {
    const batch = writeBatch(db);
    const tier: SubscriptionTier =
      seedUser?.subscriptionTier === 'pro' || seedUser?.subscriptionTier === 'fellowship'
        ? seedUser.subscriptionTier
        : 'free';
    const lang: LanguageCode =
      seedUser?.preferredLanguage && ['en', 'es', 'fr', 'de', 'ja', 'bn'].includes(seedUser.preferredLanguage)
        ? seedUser.preferredLanguage
        : 'en';

    batch.set(doc(db, 'users', uid), {
      uid,
      name: clampString(firebaseUser.displayName || seedUser?.name || 'StudyGlobe Student', 120, 'Student'),
      role: 'student',
      blocked: false,
      subscriptionTier: tier,
      mfaEnabled: Boolean(seedUser?.mfaEnabled),
      preferredLanguage: lang,
      gpa: Math.max(0, Math.min(4.0, Number(profile.gpa) || 3.7)),
      degreeTarget: ['Bachelor', 'Master', 'PhD'].includes(profile.degreeTarget)
        ? profile.degreeTarget
        : 'Master',
      field: clampString(profile.field, 120, 'Computer Science & AI'),
      targetCountries: clampCountries(profile.targetCountries),
      financialNeed: ['high', 'moderate', 'self-funded'].includes(profile.financialNeed)
        ? profile.financialNeed
        : 'moderate',
      englishScore: clampString(profile.englishScore, 60, 'IELTS 7.5'),
      workExperienceMonths: Math.max(0, Math.min(600, Math.round(Number(profile.workExperienceMonths) || 0))),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'users', uid, 'private', 'info'), {
      uid,
      email: clampString(firebaseUser.email || seedUser?.email || '', 180, 'student@studyglobe.edu'),
      phoneCountry: clampString(seedUser?.phoneCountry || 'BD', 10),
      phoneNumber: clampString(seedUser?.phoneNumber || '', 40),
      emailVerified: Boolean(firebaseUser.emailVerified),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userDocPath);
    }

    return {
      id: uid,
      name: clampString(firebaseUser.displayName || seedUser?.name || 'StudyGlobe Student', 120, 'Student'),
      email: clampString(firebaseUser.email || seedUser?.email || '', 180),
      phoneCountry: seedUser?.phoneCountry,
      phoneNumber: seedUser?.phoneNumber,
      emailVerified: Boolean(firebaseUser.emailVerified),
      role: 'student',
      blocked: false,
      subscriptionTier: tier,
      mfaEnabled: Boolean(seedUser?.mfaEnabled),
      preferredLanguage: lang,
      academicProfile: profile,
      journeyChecklists: seedUser?.journeyChecklists,
      lastSyncedAt: nowIso,
      createdAt: nowIso,
    };
  }

  const data = snap.data();
  const priv = privateSnap.exists() ? privateSnap.data() : null;

  return {
    id: uid,
    name: clampString(data.name || firebaseUser.displayName || 'StudyGlobe Student', 120),
    email: clampString(priv?.email || firebaseUser.email || seedUser?.email || '', 180),
    phoneCountry: priv?.phoneCountry ? String(priv.phoneCountry) : undefined,
    phoneNumber: priv?.phoneNumber ? String(priv.phoneNumber) : undefined,
    emailVerified: Boolean(priv?.emailVerified ?? firebaseUser.emailVerified),
    role: data.role === 'admin' ? 'admin' : 'student',
    blocked: Boolean(data.blocked),
    subscriptionTier: (['free', 'pro', 'fellowship'].includes(data.subscriptionTier)
      ? data.subscriptionTier
      : 'free') as SubscriptionTier,
    mfaEnabled: Boolean(data.mfaEnabled),
    preferredLanguage: (['en', 'es', 'fr', 'de', 'ja', 'bn'].includes(data.preferredLanguage)
      ? data.preferredLanguage
      : 'en') as LanguageCode,
    academicProfile: {
      gpa: Number(data.gpa ?? profile.gpa),
      degreeTarget: (['Bachelor', 'Master', 'PhD'].includes(data.degreeTarget)
        ? data.degreeTarget
        : 'Master') as AcademicProfile['degreeTarget'],
      field: clampString(data.field, 120, 'Computer Science & AI'),
      targetCountries: clampCountries(data.targetCountries),
      financialNeed: (['high', 'moderate', 'self-funded'].includes(data.financialNeed)
        ? data.financialNeed
        : 'moderate') as AcademicProfile['financialNeed'],
      englishScore: clampString(data.englishScore, 60, 'IELTS 7.5'),
      workExperienceMonths: Number(data.workExperienceMonths ?? 0),
    },
    journeyChecklists: seedUser?.journeyChecklists,
    lastSyncedAt: isoFromFirestoreTime(data.updatedAt),
    createdAt: isoFromFirestoreTime(data.createdAt),
  };
}

export async function syncUserProfileToFirestore(
  uid: string,
  updates: {
    name?: string;
    subscriptionTier?: SubscriptionTier;
    mfaEnabled?: boolean;
    preferredLanguage?: LanguageCode;
    academicProfile?: AcademicProfile;
  },
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) return;
  const safeUid = sanitizeId(uid, 'usr');
  const path = `users/${safeUid}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.name !== undefined) payload.name = clampString(updates.name, 120, 'Student');
  if (updates.subscriptionTier !== undefined) payload.subscriptionTier = updates.subscriptionTier;
  if (updates.mfaEnabled !== undefined) payload.mfaEnabled = Boolean(updates.mfaEnabled);
  if (updates.preferredLanguage !== undefined) payload.preferredLanguage = updates.preferredLanguage;
  if (updates.academicProfile) {
    payload.gpa = Math.max(0, Math.min(4.0, Number(updates.academicProfile.gpa) || 3.5));
    payload.degreeTarget = updates.academicProfile.degreeTarget;
    payload.field = clampString(updates.academicProfile.field, 120, 'Computer Science & AI');
    payload.targetCountries = clampCountries(updates.academicProfile.targetCountries);
    payload.financialNeed = updates.academicProfile.financialNeed;
    payload.englishScore = clampString(updates.academicProfile.englishScore, 60, 'IELTS 7.5');
    payload.workExperienceMonths = Math.max(
      0,
      Math.min(600, Math.round(Number(updates.academicProfile.workExperienceMonths) || 0)),
    );
  }

  try {
    await updateDoc(doc(db, 'users', safeUid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveApplicationToFirestore(uid: string, appRecord: Application): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) return;
  const safeUid = sanitizeId(uid, 'usr');
  const appId = sanitizeId(appRecord.id, 'app');
  const path = `users/${safeUid}/applications/${appId}`;
  try {
    await setDoc(doc(db, 'users', safeUid, 'applications', appId), {
      studentId: safeUid,
      studentName: clampString(appRecord.studentName, 120, 'Student'),
      programId: sanitizeId(appRecord.programId, 'prog'),
      university: clampString(appRecord.university, 160, 'University'),
      programTitle: clampString(appRecord.programTitle, 160, 'Program'),
      status: appRecord.status === 'Draft' ? 'Draft' : 'Submitted',
      feePaid: Boolean(appRecord.feePaid),
      feeAmountUsd: Math.max(0, Math.min(5000, Number(appRecord.feeAmountUsd) || 0)),
      notes: clampString(appRecord.notes, 1000),
      submittedAt: clampString(appRecord.submittedAt, 64, new Date().toISOString()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveBookingToFirestore(uid: string, booking: MentorshipBooking): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) return;
  const safeUid = sanitizeId(uid, 'usr');
  const bookingId = sanitizeId(booking.id, 'bk');
  const path = `users/${safeUid}/bookings/${bookingId}`;
  try {
    await setDoc(doc(db, 'users', safeUid, 'bookings', bookingId), {
      studentId: safeUid,
      studentName: clampString(booking.studentName, 120, 'Student'),
      mentorId: sanitizeId(booking.mentorId, 'alm'),
      mentorName: clampString(booking.mentorName, 120, 'Mentor'),
      university: clampString(booking.university, 160, 'University'),
      slot: clampString(booking.slot, 80, 'TBD'),
      topic: clampString(booking.topic, 400, 'Admissions consultation'),
      status: 'Confirmed',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveDocumentToFirestore(uid: string, docRecord: EncryptedDocument): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) return;
  if (docRecord.ciphertextBase64.length > 750000) {
    // Respect Firestore 1MB document limit; large documents remain persisted via backend storage.
    return;
  }
  const safeUid = sanitizeId(uid, 'usr');
  const docId = sanitizeId(docRecord.id, 'doc');
  const path = `users/${safeUid}/documents/${docId}`;
  try {
    await setDoc(doc(db, 'users', safeUid, 'documents', docId), {
      studentId: safeUid,
      studentName: clampString(docRecord.studentName, 120, 'Student'),
      fileName: clampString(docRecord.fileName, 180, 'document'),
      docType: docRecord.docType,
      sizeBytes: Math.max(0, Math.min(15728640, Math.round(docRecord.sizeBytes))),
      algorithm: 'AES-256-GCM',
      ivBase64: clampString(docRecord.ivBase64, 128),
      saltBase64: clampString(docRecord.saltBase64, 128),
      ciphertextBase64: docRecord.ciphertextBase64,
      sha256Fingerprint: clampString(docRecord.sha256Fingerprint, 128),
      processingStatus: 'Encrypted & Verified',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveMessageToFirestore(uid: string, msg: SupportMessage): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) return;
  const safeUid = sanitizeId(uid, 'usr');
  const msgId = sanitizeId(msg.id, 'msg');
  const path = `users/${safeUid}/messages/${msgId}`;
  try {
    await setDoc(doc(db, 'users', safeUid, 'messages', msgId), {
      studentId: safeUid,
      studentName: clampString(msg.studentName, 120, 'Student'),
      senderRole: 'student',
      senderName: clampString(msg.senderName, 120, 'Student'),
      content: clampString(msg.content, 2000, 'Message'),
      replied: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveFeedbackToFirestore(uid: string, fb: UserFeedback): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) return;
  const safeUid = sanitizeId(uid, 'usr');
  const fbId = sanitizeId(fb.id, 'fb');
  const path = `users/${safeUid}/feedback/${fbId}`;
  try {
    await setDoc(doc(db, 'users', safeUid, 'feedback', fbId), {
      userId: safeUid,
      userName: clampString(fb.userName, 120, 'Student'),
      category: clampString(fb.category, 80, 'General UX'),
      message: clampString(fb.message, 1500, 'Feedback'),
      status: 'Open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationsReadInFirestore(
  uid: string,
  notificationIds: string[],
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) return;
  const safeUid = sanitizeId(uid, 'usr');
  for (const rawId of notificationIds) {
    const id = sanitizeId(rawId, 'ntf');
    const path = `users/${safeUid}/notifications/${id}`;
    try {
      await updateDoc(doc(db, 'users', safeUid, 'notifications', id), {
        read: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export interface FirestoreWorkspaceCallbacks {
  onApplications?: (apps: Application[]) => void;
  onBookings?: (bookings: MentorshipBooking[]) => void;
  onDocuments?: (docs: EncryptedDocument[]) => void;
  onMessages?: (messages: SupportMessage[]) => void;
  onNotifications?: (notifications: PortalNotification[]) => void;
}

export function subscribeToFirebaseUserWorkspace(
  uid: string,
  callbacks: FirestoreWorkspaceCallbacks,
): Unsubscribe {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) {
    return () => undefined;
  }
  const safeUid = sanitizeId(uid, 'usr');
  const unsubs: Unsubscribe[] = [];

  if (callbacks.onApplications) {
    const appPath = `users/${safeUid}/applications`;
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', safeUid, 'applications'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          if (snapshot.empty) return;
          const items: Application[] = snapshot.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              studentId: String(x.studentId),
              studentName: String(x.studentName),
              programId: String(x.programId),
              university: String(x.university),
              programTitle: String(x.programTitle),
              status: x.status,
              feePaid: Boolean(x.feePaid),
              feeAmountUsd: Number(x.feeAmountUsd ?? 0),
              submittedAt: String(x.submittedAt || isoFromFirestoreTime(x.createdAt)),
              updatedAt: isoFromFirestoreTime(x.updatedAt),
              notes: String(x.notes || ''),
            };
          });
          callbacks.onApplications?.(items);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, appPath),
      ),
    );
  }

  if (callbacks.onBookings) {
    const bkPath = `users/${safeUid}/bookings`;
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', safeUid, 'bookings'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          if (snapshot.empty) return;
          const items: MentorshipBooking[] = snapshot.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              studentId: String(x.studentId),
              studentName: String(x.studentName),
              mentorId: String(x.mentorId),
              mentorName: String(x.mentorName),
              university: String(x.university),
              slot: String(x.slot),
              topic: String(x.topic),
              status: x.status,
              createdAt: isoFromFirestoreTime(x.createdAt),
            };
          });
          callbacks.onBookings?.(items);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, bkPath),
      ),
    );
  }

  if (callbacks.onDocuments) {
    const docPath = `users/${safeUid}/documents`;
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', safeUid, 'documents'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          if (snapshot.empty) return;
          const items: EncryptedDocument[] = snapshot.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              studentId: String(x.studentId),
              studentName: String(x.studentName),
              fileName: String(x.fileName),
              docType: x.docType,
              sizeBytes: Number(x.sizeBytes ?? 0),
              algorithm: 'AES-256-GCM',
              ivBase64: String(x.ivBase64),
              saltBase64: String(x.saltBase64),
              ciphertextBase64: String(x.ciphertextBase64),
              sha256Fingerprint: String(x.sha256Fingerprint || ''),
              processingStatus: x.processingStatus,
              uploadedAt: isoFromFirestoreTime(x.createdAt),
            };
          });
          callbacks.onDocuments?.(items);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, docPath),
      ),
    );
  }

  if (callbacks.onMessages) {
    const msgPath = `users/${safeUid}/messages`;
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', safeUid, 'messages'), orderBy('createdAt', 'asc')),
        (snapshot) => {
          if (snapshot.empty) return;
          const items: SupportMessage[] = snapshot.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              studentId: String(x.studentId),
              studentName: String(x.studentName),
              senderRole: x.senderRole,
              senderName: String(x.senderName),
              content: String(x.content),
              createdAt: isoFromFirestoreTime(x.createdAt),
              replied: Boolean(x.replied),
            };
          });
          callbacks.onMessages?.(items);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, msgPath),
      ),
    );
  }

  if (callbacks.onNotifications) {
    const ntfPath = `users/${safeUid}/notifications`;
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', safeUid, 'notifications'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          if (snapshot.empty) return;
          const items: PortalNotification[] = snapshot.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              userId: String(x.userId),
              channel: x.channel,
              title: String(x.title),
              body: String(x.body),
              read: Boolean(x.read),
              createdAt: isoFromFirestoreTime(x.createdAt),
            };
          });
          callbacks.onNotifications?.(items);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, ntfPath),
      ),
    );
  }

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}
