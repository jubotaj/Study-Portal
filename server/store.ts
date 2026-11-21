import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AlumniMentor,
  Application,
  AuditLog,
  EncryptedDocument,
  MentorshipBooking,
  PortalNotification,
  Program,
  PublicUser,
  Scholarship,
  SiteCustomization,
  SupportMessage,
  UserFeedback,
} from '../src/types.ts';
import {
  createInitialCustomizations,
  ENRICHED_INITIAL_PROGRAMS,
  enrichProgramMetadata,
  INITIAL_ALUMNI,
  INITIAL_SCHOLARSHIPS,
  STATIC_INITIAL_APPLICATIONS,
  STATIC_INITIAL_BOOKINGS,
  STATIC_INITIAL_MESSAGES,
  STATIC_INITIAL_NOTIFICATIONS,
} from '../src/data/catalog.ts';

export { enrichProgramMetadata };

export interface StoredUser extends PublicUser {
  passwordHash: string;
}

export interface DatabaseSchema {
  users: StoredUser[];
  programs: Program[];
  scholarships: Scholarship[];
  alumni: AlumniMentor[];
  bookings: MentorshipBooking[];
  applications: Application[];
  documents: EncryptedDocument[];
  messages: SupportMessage[];
  notifications: PortalNotification[];
  customizations: SiteCustomization[];
  feedbacks: UserFeedback[];
  auditLogs: AuditLog[];
}

function resolveWritableDataDir(): string {
  const preferred = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    const tmpFallback = path.join(os.tmpdir(), 'studyglobe-data');
    if (!fs.existsSync(tmpFallback)) {
      fs.mkdirSync(tmpFallback, { recursive: true });
    }
    return tmpFallback;
  }
}

const DATA_DIR = resolveWritableDataDir();
const DB_FILE = path.join(DATA_DIR, 'studyglobe.json');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _ignored, ...rest } = user;
  return rest;
}

function buildInitialData(): DatabaseSchema {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: 'usr_admin_1',
        name: 'Dr. Elena Vance',
        email: 'admin@studyglobe.edu',
        passwordHash: hashPassword('AdminGlobe!2026'),
        role: 'admin',
        blocked: false,
        subscriptionTier: 'fellowship',
        mfaEnabled: true,
        preferredLanguage: 'en',
        academicProfile: {
          gpa: 4.0,
          degreeTarget: 'PhD',
          field: 'International Education Policy',
          targetCountries: ['Switzerland', 'Germany', 'United Kingdom'],
          financialNeed: 'self-funded',
          englishScore: 'IELTS 8.5',
          workExperienceMonths: 96,
        },
        lastSyncedAt: now,
        createdAt: now,
      },
      {
        id: 'usr_student_free',
        name: 'Maya Lin',
        email: 'maya.lin@student.edu',
        passwordHash: hashPassword('Student!2026'),
        role: 'student',
        blocked: false,
        subscriptionTier: 'free',
        mfaEnabled: false,
        preferredLanguage: 'en',
        academicProfile: {
          gpa: 3.78,
          degreeTarget: 'Master',
          field: 'Computer Science & AI',
          targetCountries: ['Switzerland', 'Germany', 'Japan'],
          financialNeed: 'high',
          englishScore: 'TOEFL 108',
          workExperienceMonths: 14,
        },
        lastSyncedAt: now,
        createdAt: now,
      },
      {
        id: 'usr_student_pro',
        name: 'Arjun Patel',
        email: 'arjun.patel@student.edu',
        passwordHash: hashPassword('Student!2026'),
        role: 'student',
        blocked: false,
        subscriptionTier: 'pro',
        mfaEnabled: true,
        preferredLanguage: 'en',
        academicProfile: {
          gpa: 3.91,
          degreeTarget: 'Master',
          field: 'Biomedical Engineering',
          targetCountries: ['Canada', 'United Kingdom', 'Netherlands'],
          financialNeed: 'moderate',
          englishScore: 'IELTS 8.0',
          workExperienceMonths: 24,
        },
        lastSyncedAt: now,
        createdAt: now,
      },
    ],
    programs: ENRICHED_INITIAL_PROGRAMS.map((p) => ({ ...p })),
    scholarships: INITIAL_SCHOLARSHIPS.map((s) => ({ ...s })),
    alumni: INITIAL_ALUMNI.map((a) => ({ ...a })),
    bookings: STATIC_INITIAL_BOOKINGS.map((b) => ({ ...b })),
    applications: STATIC_INITIAL_APPLICATIONS.map((a) => ({ ...a })),
    documents: [],
    messages: STATIC_INITIAL_MESSAGES.map((m) => ({ ...m })),
    notifications: STATIC_INITIAL_NOTIFICATIONS.map((n) => ({ ...n })),
    customizations: createInitialCustomizations(now),
    feedbacks: [
      {
        id: 'fb_1',
        userId: 'usr_student_free',
        userName: 'Maya Lin',
        category: 'Accessibility & Study UX',
        message: 'Would love a low-glare extended reading mode and quicker filter for zero-application-fee European programs.',
        status: 'Open',
        createdAt: '2026-11-18T20:10:00Z',
      },
    ],
    auditLogs: [
      {
        id: 'aud_1',
        actorEmail: 'admin@studyglobe.edu',
        actorRole: 'admin',
        action: 'PORTAL_INITIALIZATION',
        regulation: 'GDPR',
        details: 'Verified AES-256-GCM client-side encryption vault policy and EU data minimization safeguards.',
        timestamp: now,
      },
      {
        id: 'aud_2',
        actorEmail: 'admin@studyglobe.edu',
        actorRole: 'admin',
        action: 'MFA_ENFORCEMENT_CHECK',
        regulation: 'SEC-MFA',
        details: 'Confirmed mandatory multi-factor verification for administrative operations.',
        timestamp: now,
      },
    ],
  };
}

class Store {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw) as DatabaseSchema;
        const seed = buildInitialData();
        let mutated = false;
        for (const prog of seed.programs) {
          if (!this.data.programs.some((p) => p.id === prog.id)) {
            this.data.programs.push(prog);
            mutated = true;
          }
        }
        this.data.programs = this.data.programs.map((p) => {
          const needsEnrich =
            !p.admissionsPortalUrl || !p.requiredDocuments || p.requiredDocuments.length === 0 || !p.minGpaRecommended;
          if (needsEnrich) {
            mutated = true;
            return enrichProgramMetadata(p);
          }
          return p;
        });
        for (const sch of seed.scholarships) {
          if (!this.data.scholarships.some((s) => s.id === sch.id)) {
            this.data.scholarships.push(sch);
            mutated = true;
          }
        }
        for (const alm of seed.alumni) {
          if (!this.data.alumni.some((a) => a.id === alm.id)) {
            this.data.alumni.push(alm);
            mutated = true;
          }
        }
        if (mutated) this.save();
      } catch {
        this.data = buildInitialData();
        this.data.programs = this.data.programs.map(enrichProgramMetadata);
        this.save();
      }
    } else {
      this.data = buildInitialData();
      this.data.programs = this.data.programs.map(enrichProgramMetadata);
      this.save();
    }
  }

  getData(): DatabaseSchema {
    return this.data;
  }

  save(): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch {
      // Ignore write failures in strictly ephemeral read-only environments
    }
  }

  addAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): void {
    this.data.auditLogs.unshift({
      id: `aud_${crypto.randomBytes(5).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
    if (this.data.auditLogs.length > 200) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 200);
    }
    this.save();
  }

  addNotification(entry: Omit<PortalNotification, 'id' | 'createdAt' | 'read'>): void {
    this.data.notifications.unshift({
      id: `ntf_${crypto.randomBytes(5).toString('hex')}`,
      read: false,
      createdAt: new Date().toISOString(),
      ...entry,
    });
    this.save();
  }
}

export const store = new Store();
