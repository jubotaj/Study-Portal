export type UserRole = 'admin' | 'student';
export type SubscriptionTier = 'free' | 'pro' | 'fellowship';
export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'bn';

export interface AcademicProfile {
  gpa: number;
  degreeTarget: 'Bachelor' | 'Master' | 'PhD';
  field: string;
  targetCountries: string[];
  financialNeed: 'high' | 'moderate' | 'self-funded';
  englishScore: string;
  workExperienceMonths: number;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phoneCountry?: string;
  phoneNumber?: string;
  emailVerified?: boolean;
  role: UserRole;
  blocked: boolean;
  subscriptionTier: SubscriptionTier;
  mfaEnabled: boolean;
  preferredLanguage: LanguageCode;
  academicProfile: AcademicProfile;
  journeyChecklists?: Record<string, string[]>;
  lastSyncedAt: string;
  createdAt: string;
}

export interface Program {
  id: string;
  university: string;
  country: string;
  city: string;
  title: string;
  degreeLevel: 'Bachelor' | 'Master' | 'PhD';
  field: string;
  tuitionUsd: number;
  deadline: string;
  acceptanceRate: string;
  qsRank: number;
  language: string;
  applicationFeeUsd: number;
  imageUrl: string;
  addedBy: 'admin' | 'ai-bot';
  admissionsPortalUrl?: string;
  requiredDocuments?: string[];
  minGpaRecommended?: number;
}

export interface Scholarship {
  id: string;
  name: string;
  provider: string;
  country: string;
  coverage: string;
  amountUsd: number;
  deadline: string;
  minGpa: number;
  needBased: boolean;
  eligibleDegrees: string[];
  eligibleFields: string[];
  addedBy: 'admin' | 'ai-bot';
}

export interface AlumniMentor {
  id: string;
  name: string;
  university: string;
  graduationYear: number;
  degree: string;
  currentRole: string;
  company: string;
  country: string;
  avatarUrl: string;
  bio: string;
  languages: string[];
  availableSlots: string[];
}

export interface MentorshipBooking {
  id: string;
  studentId: string;
  studentName: string;
  mentorId: string;
  mentorName: string;
  university: string;
  slot: string;
  topic: string;
  status: 'Confirmed' | 'Completed';
  createdAt: string;
}

export type ApplicationStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Interview'
  | 'Accepted'
  | 'Waitlisted';

export interface Application {
  id: string;
  studentId: string;
  studentName: string;
  programId: string;
  university: string;
  programTitle: string;
  status: ApplicationStatus;
  feePaid: boolean;
  feeAmountUsd: number;
  submittedAt: string;
  updatedAt: string;
  notes: string;
}

export type DocumentType =
  | 'Transcript'
  | 'Recommendation Letter'
  | 'Statement of Purpose'
  | 'Passport / ID';

export type DocumentProcessingStatus =
  | 'Encrypted & Verified'
  | 'Under Compliance Review'
  | 'Approved';

export interface EncryptedDocument {
  id: string;
  studentId: string;
  studentName: string;
  fileName: string;
  docType: DocumentType;
  sizeBytes: number;
  algorithm: 'AES-256-GCM';
  ivBase64: string;
  saltBase64: string;
  ciphertextBase64: string;
  sha256Fingerprint: string;
  processingStatus: DocumentProcessingStatus;
  uploadedAt: string;
}

export interface SupportMessage {
  id: string;
  studentId: string;
  studentName: string;
  senderRole: 'student' | 'admin' | 'ai-bot';
  senderName: string;
  content: string;
  createdAt: string;
  replied: boolean;
}

export interface PortalNotification {
  id: string;
  userId: string;
  channel: 'email' | 'push';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface SiteCustomization {
  id: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  suggestedBy: 'admin' | 'ai-bot';
  createdAt: string;
}

export interface UserFeedback {
  id: string;
  userId: string;
  userName: string;
  category: string;
  message: string;
  status: 'Open' | 'Implemented by AI' | 'Reviewed';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorEmail: string;
  actorRole: UserRole | 'ai-bot';
  action: string;
  regulation: 'GDPR' | 'HIPAA' | 'SEC-MFA' | 'SYSTEM';
  details: string;
  timestamp: string;
}

export interface ScholarshipMatchResult {
  scholarshipId: string;
  scholarshipName: string;
  matchScore: number;
  rationale: string;
  urgencyLevel: 'Immediate' | 'Upcoming' | 'Flexible';
  actionSteps: string[];
}

export interface UniversityMatchResult {
  programId: string;
  university: string;
  admissionProbability: number;
  chanceLabel: string;
  rationale: string;
  requiredDocuments: string[];
}

export interface CareerGuidanceResult {
  careerSummary: string;
  recommendedRoles: string[];
  skillGapsToClose: string[];
  recommendedProgramIds: string[];
  scholarshipMatches: ScholarshipMatchResult[];
  universityMatches?: UniversityMatchResult[];
}

export interface SystemPerformanceReport {
  uptimeSeconds: number;
  uptimeSlaPercent: string;
  memoryRssMb: number;
  memoryHeapUsedMb: number;
  avgApiLatencyMs: number;
  totalRequests: number;
  activeStudents: number;
  blockedStudents: number;
  totalApplications: number;
  encryptedDocumentsCount: number;
  documentAnalytics: {
    verified: number;
    reviewing: number;
    approved: number;
  };
  complianceStatus: {
    gdprReady: boolean;
    hipaaSafeguards: boolean;
    e2eeStandard: string;
    mfaEnforcedAdmin: boolean;
  };
  recentAuditLogs: AuditLog[];
}
