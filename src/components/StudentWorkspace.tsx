import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  Cloud,
  CreditCard,
  Download,
  FileLock2,
  FileText,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Moon,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  WifiOff,
  AlertCircle,
} from 'lucide-react';
import type {
  AcademicProfile,
  AlumniMentor,
  Application,
  CareerGuidanceResult,
  DocumentType,
  EncryptedDocument,
  LanguageCode,
  MentorshipBooking,
  PortalNotification,
  Program,
  PublicUser,
  Scholarship,
  SiteCustomization,
  SupportMessage,
  SubscriptionTier,
} from '../types.ts';
import { decryptDocumentPayload, encryptDocumentFile } from '../utils/crypto.ts';
import { safeReadJson } from '../utils/http.ts';
import { LANGUAGE_LABELS, t } from '../utils/i18n.ts';
import { enqueueOfflineAction, type OfflineQueuedAction } from '../utils/offline.ts';
import { evaluateUniversityChance, getUniversityGuide } from '../utils/universityGuide.ts';
import { UniversityProfileModal } from './UniversityProfileModal.tsx';

type StudentTab =
  | 'overview'
  | 'programs'
  | 'ai-match'
  | 'alumni'
  | 'applications'
  | 'vault'
  | 'chat'
  | 'billing';

interface StudentWorkspaceProps {
  token: string;
  user: PublicUser;
  programs: Program[];
  scholarships: Scholarship[];
  alumni: AlumniMentor[];
  bookings: MentorshipBooking[];
  applications: Application[];
  documents: EncryptedDocument[];
  messages: SupportMessage[];
  notifications: PortalNotification[];
  customizations: SiteCustomization[];
  isOffline: boolean;
  offlineQueue: OfflineQueuedAction[];
  initialTab?: 'overview' | 'billing';
  initialCheckoutTier?: SubscriptionTier | null;
  onConsumeInitialIntent?: () => void;
  onRefreshQueue?: () => void;
  onToggleOfflineSim: () => void;
  onSyncNow: () => Promise<void>;
  onUpdateUser: (user: PublicUser) => void;
  onBackToPublic: () => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: number;
  onChangeFontScale: (scale: number) => void;
}

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({
  token,
  user,
  programs,
  scholarships,
  alumni,
  bookings,
  applications,
  documents,
  messages,
  notifications,
  customizations,
  isOffline,
  offlineQueue,
  initialTab,
  initialCheckoutTier,
  onConsumeInitialIntent,
  onRefreshQueue,
  onToggleOfflineSim,
  onSyncNow,
  onUpdateUser,
  onBackToPublic,
  onLogout,
  darkMode,
  onToggleDarkMode,
  language,
  onChangeLanguage,
  highContrast,
  onToggleHighContrast,
  fontScale,
  onChangeFontScale,
}) => {
  const isPaidMember =
    user.role === 'admin' || user.subscriptionTier === 'pro' || user.subscriptionTier === 'fellowship';

  const [activeTab, setActiveTab] = useState<StudentTab>(initialTab || 'overview');
  const [toast, setToast] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  // Programs filtering
  const [progSearch, setProgSearch] = useState('');
  const [progCountry, setProgCountry] = useState('All');
  const [progDegree, setProgDegree] = useState('All');
  const [progMaxTuition, setProgMaxTuition] = useState(40000);
  const [sortByUrgency, setSortByUrgency] = useState(true);
  const [checkoutProgram, setCheckoutProgram] = useState<Program | null>(null);
  const [activeVarsityProgram, setActiveVarsityProgram] = useState<Program | null>(null);
  const [journeyChecklists, setJourneyChecklists] = useState<Record<string, string[]>>(() => {
    try {
      const cached = localStorage.getItem(`sg_checklists_${user.id}`);
      const parsed = cached ? (JSON.parse(cached) as Record<string, string[]>) : {};
      return { ...parsed, ...(user.journeyChecklists || {}) };
    } catch {
      return user.journeyChecklists || {};
    }
  });
  const [cardInput, setCardInput] = useState('4242 4242 4242 4242');
  const [applyNotes, setApplyNotes] = useState('');
  const [applying, setApplying] = useState(false);

  // AI Match & Career state
  const [profileForm, setProfileForm] = useState(user.academicProfile);
  const [targetCountriesText, setTargetCountriesText] = useState(
    user.academicProfile.targetCountries.join(', '),
  );
  const [includeGlobalAlternatives, setIncludeGlobalAlternatives] = useState(true);
  const [aiMatching, setAiMatching] = useState(false);
  const [aiError, setAiError] = useState('');
  const [careerResult, setCareerResult] = useState<CareerGuidanceResult | null>(null);
  const [ruleMatchedList, setRuleMatchedList] = useState<
    {
      scholarship: Scholarship;
      score: number;
      gpaMet: boolean;
      urgency: 'Immediate' | 'Upcoming' | 'Flexible';
      reasons: string[];
    }[]
  >([]);
  const [filteredUniMatches, setFilteredUniMatches] = useState<
    {
      program: Program;
      probability: number;
      chanceLabel: string;
      countryMatched: boolean;
      reasons: string[];
      requiredDocs: { label: string; vaultDocType: DocumentType; inVault: EncryptedDocument | undefined }[];
    }[]
  >([]);

  // Alumni mentorship booking state
  const [bookingMentor, setBookingMentor] = useState<AlumniMentor | null>(null);
  const [bookingSlot, setBookingSlot] = useState('');
  const [bookingTopic, setBookingTopic] = useState('');

  // E2EE Vault state
  const [vaultFile, setVaultFile] = useState<File | null>(null);
  const [vaultDocType, setVaultDocType] = useState<DocumentType>('Transcript');
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [decryptPassphrase, setDecryptPassphrase] = useState('');
  const [encrypting, setEncrypting] = useState(false);

  // Chat & AI Advisor state
  const [chatMode, setChatMode] = useState<'ai' | 'moderator'>('ai');
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: `Hello ${user.name}. I am your StudyGlobe AI Advisor. Ask me about university admission requirements, scholarship strategies, visa timelines, or career paths.`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  // Feedback form
  const [feedbackCat, setFeedbackCat] = useState('Accessibility & Study UX');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Billing checkout state
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(
    initialCheckoutTier && initialCheckoutTier !== user.subscriptionTier ? initialCheckoutTier : null,
  );
  const [billingMethod, setBillingMethod] = useState<'card' | 'sandbox'>('card');
  const [billingCardName, setBillingCardName] = useState(user.name);
  const [billingCard, setBillingCard] = useState('4242 4242 4242 4242');
  const [billingExpiry, setBillingExpiry] = useState('12/28');
  const [billingCvc, setBillingCvc] = useState('424');
  const [billingError, setBillingError] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingReceipt, setBillingReceipt] = useState<{
    tier: SubscriptionTier;
    invoiceId: string;
    amountUsd: number;
    paidAt: string;
    cardLast4: string;
  } | null>(null);

  useEffect(() => {
    if (initialTab || initialCheckoutTier) {
      if (initialTab) setActiveTab(initialTab);
      if (initialCheckoutTier && initialCheckoutTier !== user.subscriptionTier) {
        setSelectedTier(initialCheckoutTier);
        setBillingError('');
      }
      onConsumeInitialIntent?.();
    }
  }, [initialTab, initialCheckoutTier, user.subscriptionTier, onConsumeInitialIntent]);

  // Sync local state when switching accounts in the same session
  useEffect(() => {
    setProfileForm(user.academicProfile);
    setTargetCountriesText(user.academicProfile.targetCountries.join(', '));
    try {
      const cached = localStorage.getItem(`sg_checklists_${user.id}`);
      const parsed = cached ? (JSON.parse(cached) as Record<string, string[]>) : {};
      setJourneyChecklists({ ...parsed, ...(user.journeyChecklists || {}) });
    } catch {
      setJourneyChecklists(user.journeyChecklists || {});
    }
    setAiError('');
    setChatError('');
    setCareerResult(null);
    setAiMessages([
      {
        role: 'assistant',
        text: `Hello ${user.name}. I am your StudyGlobe AI Advisor. Ask me about university admission requirements, scholarship strategies, visa timelines, or career paths.`,
      },
    ]);
    setCheckoutProgram(null);
    setBookingMentor(null);
    setSelectedTier(null);
    setBillingError('');
    setBillingReceipt(null);
    setBillingCardName(user.name);
    setActiveVarsityProgram(null);
    setChatInput('');
  }, [user.id]);

  const studyFocusEnabled = customizations.some((c) => c.key === 'study_focus_layout' && c.enabled);
  const deadlineBannerEnabled = customizations.some((c) => c.key === 'compact_deadline_banner' && c.enabled);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

  const requirePaidMembership = (featureLabel: string): boolean => {
    if (isPaidMember) return true;
    showToast(`${featureLabel} requires an active Scholar Pro ($14/mo) or Global Fellowship ($29/mo) subscription.`);
    setActiveTab('billing');
    return false;
  };

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSyncNow();
      showToast('Cloud sync complete across devices.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const filteredPrograms = useMemo(() => {
    const list = programs.filter((p) => {
      const q = progSearch.trim().toLowerCase();
      const matchesQ =
        !q ||
        p.university.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.field.toLowerCase().includes(q);
      const matchesCountry = progCountry === 'All' || p.country === progCountry;
      const matchesDegree = progDegree === 'All' || p.degreeLevel === progDegree;
      const matchesTuition = p.tuitionUsd <= progMaxTuition;
      return matchesQ && matchesCountry && matchesDegree && matchesTuition;
    });
    if (sortByUrgency) {
      return [...list].sort((a, b) => a.deadline.localeCompare(b.deadline));
    }
    return list;
  }, [programs, progSearch, progCountry, progDegree, progMaxTuition, sortByUrgency]);

  const urgentPrograms = useMemo(() => {
    return [...programs].sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3);
  }, [programs]);

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutProgram) return;
    if (!requirePaidMembership('Submitting university applications')) {
      setCheckoutProgram(null);
      return;
    }
    const needsCard = user.subscriptionTier !== 'fellowship' && checkoutProgram.applicationFeeUsd > 0;
    const digitsOnly = cardInput.replace(/[\s-]+/g, '');
    if (needsCard && !/^\d{13,19}$/.test(digitsOnly)) {
      showToast('Please enter a valid 13-to-19 digit card number to process the application fee.');
      return;
    }
    setApplying(true);
    const payload = {
      programId: checkoutProgram.id,
      notes: applyNotes || 'Submitted through StudyGlobe Portal.',
      payFee: true,
    };
    try {
      if (isOffline) {
        enqueueOfflineAction({
          endpoint: '/api/applications',
          method: 'POST',
          body: payload,
          label: `Apply to ${checkoutProgram.university}`,
        });
        onRefreshQueue?.();
        showToast(`Offline: Application to ${checkoutProgram.university} queued for sync.`);
        setCheckoutProgram(null);
        return;
      }
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Application failed');
      await onSyncNow();
      setCheckoutProgram(null);
      setApplyNotes('');
      showToast(`Application submitted to ${checkoutProgram.university}. Email & push confirmation sent.`);
      setActiveTab('applications');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  const handleToggleJourneyStep = async (programId: string, stepId: string) => {
    const current = journeyChecklists[programId] || [];
    const nextSteps = current.includes(stepId)
      ? current.filter((id) => id !== stepId)
      : [...current, stepId];
    const updated = { ...journeyChecklists, [programId]: nextSteps };
    setJourneyChecklists(updated);
    try {
      localStorage.setItem(`sg_checklists_${user.id}`, JSON.stringify(updated));
    } catch {
      // ignore localStorage failure
    }
    if (!isOffline) {
      try {
        const res = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ journeyChecklists: { [programId]: nextSteps } }),
        });
        const data = await safeReadJson(res);
        if (res.ok && data.user) {
          onUpdateUser(data.user);
        }
      } catch {
        // local state remains saved
      }
    }
  };

  const runAlgorithmicEligibilityMatch = (overrideProfile?: AcademicProfile, overrideGlobal?: boolean) => {
    const activeProfile = overrideProfile ?? {
      ...profileForm,
      targetCountries: targetCountriesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const useGlobal = overrideGlobal ?? includeGlobalAlternatives;

    const today = new Date('2026-11-19T00:00:00Z').getTime();
    const scored = scholarships.map((sch) => {
      let score = 40;
      const reasons: string[] = [];
      const gpaMet = activeProfile.gpa >= sch.minGpa;
      if (gpaMet) {
        score += 22;
        reasons.push(`GPA ${activeProfile.gpa.toFixed(2)} meets minimum ${sch.minGpa.toFixed(1)}`);
      } else {
        score -= 15;
        reasons.push(`GPA ${activeProfile.gpa.toFixed(2)} is below recommended ${sch.minGpa.toFixed(1)}`);
      }
      if (sch.eligibleDegrees.includes(activeProfile.degreeTarget)) {
        score += 15;
        reasons.push(`Open to ${activeProfile.degreeTarget} candidates`);
      }
      if (
        activeProfile.targetCountries.some(
          (c) => sch.country.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(sch.country.toLowerCase()),
        )
      ) {
        score += 13;
        reasons.push(`Matches target country (${sch.country})`);
      }
      if (activeProfile.financialNeed === 'high' && sch.needBased) {
        score += 10;
        reasons.push('Prioritizes high financial need');
      }
      const daysLeft = Math.ceil((new Date(sch.deadline).getTime() - today) / 86400000);
      const urgency: 'Immediate' | 'Upcoming' | 'Flexible' =
        daysLeft <= 25 ? 'Immediate' : daysLeft <= 60 ? 'Upcoming' : 'Flexible';

      return {
        scholarship: sch,
        score: Math.max(10, Math.min(99, score)),
        gpaMet,
        urgency,
        reasons,
      };
    });
    scored.sort((a, b) => b.score - a.score);
    setRuleMatchedList(scored);

    const evaluatedUnis = programs.map((prog) => evaluateUniversityChance(prog, activeProfile, documents));
    const filtered = evaluatedUnis.filter((item) => {
      if (activeProfile.targetCountries.length === 0) return true;
      if (item.countryMatched) return true;
      return useGlobal && item.program.degreeLevel === activeProfile.degreeTarget;
    });

    filtered.sort((a, b) => {
      if (a.countryMatched !== b.countryMatched) return a.countryMatched ? -1 : 1;
      return b.probability - a.probability;
    });
    setFilteredUniMatches(filtered.slice(0, 12));
  };

  useEffect(() => {
    if (programs.length > 0) {
      runAlgorithmicEligibilityMatch();
    }
  }, [programs, scholarships, documents.length]);

  const handleSaveAndMatchAI = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCountries = targetCountriesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const updatedProfile: AcademicProfile = {
      ...profileForm,
      targetCountries: parsedCountries,
    };
    setProfileForm(updatedProfile);
    setAiError('');
    runAlgorithmicEligibilityMatch(updatedProfile);

    if (!isPaidMember) {
      requirePaidMembership('AI Scholarship & Career Agent');
      return;
    }

    setAiMatching(true);
    try {
      const profRes = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ academicProfile: updatedProfile }),
      });
      const profData = await safeReadJson(profRes);
      if (!profRes.ok) throw new Error(profData.error || 'Profile update failed');
      onUpdateUser(profData.user);

      const res = await fetch('/api/ai/match-scholarships', {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'AI matching failed');
      setCareerResult(data.result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI matching error');
    } finally {
      setAiMatching(false);
    }
  };

  const handleBookMentorship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingMentor) return;
    if (!requirePaidMembership('1-on-1 alumni mentorship booking')) {
      setBookingMentor(null);
      return;
    }
    const payload = {
      mentorId: bookingMentor.id,
      slot: bookingSlot || bookingMentor.availableSlots[0],
      topic: bookingTopic || 'Program fit & scholarship review',
    };
    try {
      if (isOffline) {
        enqueueOfflineAction({
          endpoint: '/api/mentorship/book',
          method: 'POST',
          body: payload,
          label: `Mentorship with ${bookingMentor.name}`,
        });
        onRefreshQueue?.();
        showToast('Offline: Mentorship booking queued for cloud sync.');
        setBookingMentor(null);
        return;
      }
      const res = await fetch('/api/mentorship/book', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      await onSyncNow();
      setBookingMentor(null);
      setBookingTopic('');
      showToast(`1-on-1 session booked with ${bookingMentor.name}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Booking error');
    }
  };

  const handleEncryptAndUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requirePaidMembership('E2EE Document Vault storage')) {
      return;
    }
    if (!vaultFile || vaultPassphrase.length < 6) {
      showToast('Select a file and enter a passphrase (min 6 characters).');
      return;
    }
    setEncrypting(true);
    try {
      const encrypted = await encryptDocumentFile(vaultFile, vaultPassphrase);
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          fileName: vaultFile.name,
          docType: vaultDocType,
          sizeBytes: vaultFile.size,
          ...encrypted,
        }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await onSyncNow();
      setVaultFile(null);
      showToast(`Encrypted ${vaultFile.name} locally with AES-256-GCM and uploaded ciphertext.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Encryption error');
    } finally {
      setEncrypting(false);
    }
  };

  const handleDecryptDownload = async (doc: EncryptedDocument) => {
    const pass = decryptPassphrase || vaultPassphrase;
    if (!pass) {
      showToast('Enter your decryption passphrase in the Vault Passphrase field first.');
      return;
    }
    try {
      const bytes = await decryptDocumentPayload(
        doc.ciphertextBase64,
        doc.ivBase64,
        doc.saltBase64,
        pass,
      );
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const blob = new Blob([copy.buffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Decrypted ${doc.fileName} locally in your browser.`);
    } catch {
      showToast('Decryption failed: verify your vault passphrase.');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requirePaidMembership(chatMode === 'ai' ? 'AI Advisor chat' : 'Moderator desk chat')) {
      return;
    }
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    setChatError('');

    if (chatMode === 'ai') {
      setAiMessages((prev) => [...prev, { role: 'user', text }]);
      setChatLoading(true);
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ question: text }),
        });
        const data = await safeReadJson(res);
        if (!res.ok) throw new Error(data.error || 'AI error');
        setAiMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      } catch (err) {
        setChatError(err instanceof Error ? err.message : 'Unable to reach AI advisor.');
      } finally {
        setChatLoading(false);
      }
      return;
    }

    // Moderator direct message
    try {
      if (isOffline) {
        enqueueOfflineAction({
          endpoint: '/api/messages',
          method: 'POST',
          body: { content: text },
          label: 'Send message to moderator',
        });
        onRefreshQueue?.();
        showToast('Offline: Moderator message queued.');
        return;
      }
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const d = await safeReadJson(res);
        throw new Error(d.error || 'Message failed');
      }
      await onSyncNow();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to send');
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMsg.trim()) return;
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ category: feedbackCat, message: feedbackMsg }),
      });
      if (!res.ok) throw new Error('Feedback error');
      setFeedbackMsg('');
      showToast('Feedback recorded. AI site-customization engine will review it.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    }
  };

  const openTierCheckout = (tier: SubscriptionTier) => {
    setBillingError('');
    setBillingCardName(user.name);
    setSelectedTier(tier);
  };

  const handleCheckoutTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;
    setBillingError('');

    const isPaidUpgrade = selectedTier !== 'free';
    const digitsOnly = billingCard.replace(/[\s-]+/g, '');
    if (isPaidUpgrade && billingMethod === 'card') {
      if (!billingCardName.trim()) {
        setBillingError('Please enter the cardholder name.');
        return;
      }
      if (!/^\d{13,19}$/.test(digitsOnly)) {
        setBillingError('Please enter a valid 13-to-19 digit card number (e.g. 4242 4242 4242 4242).');
        return;
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(billingExpiry.trim())) {
        setBillingError('Please enter card expiry in MM/YY format.');
        return;
      }
      if (!/^\d{3,4}$/.test(billingCvc.trim())) {
        setBillingError('Please enter a valid 3 or 4 digit security code (CVC).');
        return;
      }
    }

    const last4 = billingMethod === 'sandbox' ? '4242' : digitsOnly.slice(-4) || '4242';
    const planPrice = selectedTier === 'pro' ? 14 : selectedTier === 'fellowship' ? 29 : 0;

    if (isOffline && !token.startsWith('static-preview:')) {
      setBillingError('You are currently in Offline mode. Switch back to Online in the top bar to complete payment.');
      return;
    }

    setBillingLoading(true);
    try {
      if (token.startsWith('static-preview:')) {
        const invoiceId = `INV-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
        const updatedUser: PublicUser = {
          ...user,
          subscriptionTier: selectedTier,
          lastSyncedAt: new Date().toISOString(),
        };
        onUpdateUser(updatedUser);
        setBillingReceipt({
          tier: selectedTier,
          invoiceId,
          amountUsd: planPrice,
          paidAt: new Date().toISOString(),
          cardLast4: last4,
        });
        setSelectedTier(null);
        showToast(
          selectedTier === 'free'
            ? `Switched to Explorer Free plan.`
            : `Subscription active (${selectedTier.toUpperCase()})! Invoice ${invoiceId} confirmed.`,
        );
        return;
      }

      const res = await fetch('/api/payments/subscribe', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          tier: selectedTier,
          cardLast4: last4,
        }),
      });

      const ct = res.headers.get('content-type') || '';
      if (res.status === 404 || res.status === 405 || !ct.includes('application/json')) {
        const invoiceId = `INV-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
        const updatedUser: PublicUser = {
          ...user,
          subscriptionTier: selectedTier,
          lastSyncedAt: new Date().toISOString(),
        };
        onUpdateUser(updatedUser);
        setBillingReceipt({
          tier: selectedTier,
          invoiceId,
          amountUsd: planPrice,
          paidAt: new Date().toISOString(),
          cardLast4: last4,
        });
        setSelectedTier(null);
        showToast(`Subscription upgraded to ${selectedTier.toUpperCase()}! Invoice ${invoiceId} confirmed.`);
        return;
      }

      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Payment failed');
      onUpdateUser(data.user);
      setBillingReceipt({
        tier: selectedTier,
        invoiceId: data.invoiceId,
        amountUsd: Number(data.amountUsd ?? planPrice),
        paidAt: new Date().toISOString(),
        cardLast4: last4,
      });
      setSelectedTier(null);
      await onSyncNow();
      showToast(
        selectedTier === 'free'
          ? `Switched to Explorer Free plan (Ref ${data.invoiceId}).`
          : `Subscription upgraded to ${selectedTier.toUpperCase()}! Invoice ${data.invoiceId} emailed.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout error';
      setBillingError(msg);
      showToast(msg);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleToggleMfa = async () => {
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ mfaEnabled: !user.mfaEnabled }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update MFA');
      onUpdateUser(data.user);
      showToast(`Multi-factor authentication ${data.user.mfaEnabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleMarkNotificationsRead = async () => {
    await fetch('/api/notifications/read', { method: 'POST', headers: authHeaders });
    await onSyncNow();
  };

  const navItems: { id: StudentTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t(language, 'tabOverview'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'programs', label: t(language, 'tabPrograms'), icon: <BookOpen className="w-4 h-4" /> },
    { id: 'ai-match', label: t(language, 'tabScholarships'), icon: <Sparkles className="w-4 h-4" /> },
    { id: 'alumni', label: t(language, 'tabAlumni'), icon: <Users className="w-4 h-4" /> },
    { id: 'applications', label: t(language, 'tabApplications'), icon: <FileText className="w-4 h-4" /> },
    { id: 'vault', label: t(language, 'tabVault'), icon: <FileLock2 className="w-4 h-4" /> },
    { id: 'chat', label: t(language, 'tabMessages'), icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'billing', label: t(language, 'tabBilling'), icon: <CreditCard className="w-4 h-4" /> },
  ];

  const docCounts = {
    verified: documents.filter((d) => d.processingStatus === 'Encrypted & Verified').length,
    review: documents.filter((d) => d.processingStatus === 'Under Compliance Review').length,
    approved: documents.filter((d) => d.processingStatus === 'Approved').length,
  };

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row ${studyFocusEnabled ? 'leading-loose' : ''}`}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onBackToPublic}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white"
          >
            StudyGlobe
          </button>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {user.subscriptionTier.toUpperCase()}
          </span>
        </div>

        <nav aria-label="Student workspace navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="text-xs">
            <p className="font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
            <p className="text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen pb-20 md:pb-0">
        {/* Contextual Top Bar */}
        <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <button
              type="button"
              onClick={onBackToPublic}
              className="md:hidden font-display font-bold text-slate-900 dark:text-white truncate shrink-0"
            >
              StudyGlobe
            </button>
            <span className="hidden md:inline text-slate-400">Student Portal</span>
            <span className="hidden md:inline text-slate-400">/</span>
            <span className="font-semibold text-slate-900 dark:text-white truncate">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleOfflineSim}
              title="Toggle offline mode simulation"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border transition-colors ${
                isOffline
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isOffline ? 'Offline' : 'Online'}</span>
            </button>

            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || isOffline}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">{t(language, 'syncNow')}</span>
            </button>

            <select
              aria-label="Language"
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
              className="hidden sm:block rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200"
            >
              {(Object.keys(LANGUAGE_LABELS) as LanguageCode[]).map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label="Toggle dark mode"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              aria-label={`Notifications (${unreadCount} unread)`}
              className="relative min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="ml-1 text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('billing')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg border transition-colors ${
                user.subscriptionTier === 'free'
                  ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                  : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{user.subscriptionTier === 'free' ? 'Upgrade Pro' : user.subscriptionTier.toUpperCase()}</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Offline Banner */}
        {isOffline && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900 px-4 sm:px-6 py-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-4">
            <span>{t(language, 'offlineBanner')}</span>
            <span className="font-mono tabular-nums shrink-0">{offlineQueue.length} queued</span>
          </div>
        )}

        {/* Toast Feedback */}
        {toast && (
          <div role="status" aria-live="polite" className="mx-4 sm:mx-6 mt-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5 text-xs font-medium text-blue-800 dark:text-blue-200">
            {toast}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    Welcome back, {user.name}
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    Target: {user.academicProfile.degreeTarget} in {user.academicProfile.field} · GPA {user.academicProfile.gpa.toFixed(2)} · Last synced {new Date(user.lastSyncedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleHighContrast}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {highContrast ? 'Standard Contrast' : 'High Contrast'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeFontScale(fontScale >= 1.15 ? 1 : 1.15)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Text: {fontScale >= 1.15 ? 'Large' : 'Standard'}
                  </button>
                </div>
              </div>

              {/* Free Tier Notice / Subscription Gate Summary */}
              {!isPaidMember && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Explorer Free Plan · Directory & Checklist Preview
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Upgrade to Scholar Pro ($14/mo) or Global Fellowship ($29/mo) to submit university applications, book 1-on-1 alumni mentorship, use Gemini AI agents & advisor chat, and store documents in the AES-256 Vault.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('billing')}
                    className="px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
                  >
                    Upgrade Plan
                  </button>
                </div>
              )}

              {/* Metrics Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Active Applications</p>
                  <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{applications.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Mentorship Calls</p>
                  <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{bookings.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Encrypted Documents</p>
                  <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{documents.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Security Posture</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {user.mfaEnabled ? 'MFA Enabled' : 'Standard Auth'}
                  </p>
                </div>
              </div>

              {/* Urgent Deadlines Banner (AI Customization) */}
              {deadlineBannerEnabled && (
                <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Approaching Admission Deadlines
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('programs')}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View all programs
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {urgentPrograms.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActiveVarsityProgram(p)}
                        className="text-left p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
                      >
                        <p className="text-xs font-mono text-amber-600 dark:text-amber-400">
                          Closes {p.deadline}
                        </p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                          {p.university}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {p.title}
                        </p>
                        <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-2">
                          Open Varsity Profile & Checklist →
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Email & Push Notification Log */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Personal Email & Push Notifications
                  </h2>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkNotificationsRead}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.slice(0, 8).map((n) => (
                      <li key={n.id} className="py-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {n.channel.toUpperCase()} · {new Date(n.createdAt).toLocaleString()} {!n.read ? '· Unread' : ''}
                          </p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{n.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {/* PROGRAMS TAB */}
          {activeTab === 'programs' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Filter Universities & Enroll
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Sort by deadline urgency, budget, and degree level.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Search</label>
                  <input
                    type="search"
                    value={progSearch}
                    onChange={(e) => setProgSearch(e.target.value)}
                    placeholder="University or major"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Country</label>
                  <select
                    value={progCountry}
                    onChange={(e) => setProgCountry(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="All">All Countries</option>
                    {Array.from(new Set(programs.map((p) => p.country))).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Degree</label>
                  <select
                    value={progDegree}
                    onChange={(e) => setProgDegree(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="All">All Degrees</option>
                    <option value="Bachelor">Bachelor</option>
                    <option value="Master">Master</option>
                    <option value="PhD">PhD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Max Tuition: <span className="font-mono">${progMaxTuition.toLocaleString()}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={40000}
                    step={1000}
                    value={progMaxTuition}
                    onChange={(e) => setProgMaxTuition(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSortByUrgency(!sortByUrgency)}
                  className={`py-2 px-3 min-h-[40px] text-xs font-medium rounded-lg border transition-colors ${
                    sortByUrgency
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {sortByUrgency ? 'Sorted: Deadline Urgency' : 'Default Order'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredPrograms.map((p) => {
                  const alreadyApplied = applications.some((a) => a.programId === p.id);
                  const guide = getUniversityGuide(p);
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveVarsityProgram(p)}
                        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
                      >
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {p.country} · QS #{p.qsRank} · {p.degreeLevel} · Fee ${user.subscriptionTier === 'fellowship' ? 0 : p.applicationFeeUsd}
                        </p>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                          {p.university}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{p.title}</p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          <span>Tuition: ${p.tuitionUsd.toLocaleString()}/yr</span>
                          <span>Living: ~${guide.living.totalMonthlyUsd.toLocaleString()}/mo</span>
                          <span>Flight ({guide.airTicket.airportCode}): ~${guide.airTicket.estimatedOneWayUsd}</span>
                          <span>Deadline: {p.deadline}</span>
                        </div>
                      </button>
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveVarsityProgram(p)}
                          className="flex-1 py-2.5 px-3 min-h-[44px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          Varsity Profile, Visa & Costs
                        </button>
                        <button
                          type="button"
                          disabled={alreadyApplied}
                          onClick={() => {
                            if (requirePaidMembership('Submitting university applications')) {
                              setCheckoutProgram(p);
                            }
                          }}
                          className="flex-1 py-2.5 px-3 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500 transition-colors"
                        >
                          {alreadyApplied
                            ? 'Already Applied'
                            : isPaidMember
                              ? 'Apply & Process Fee'
                              : 'Upgrade to Apply'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI SCHOLARSHIP & CAREER MATCHING TAB */}
          {activeTab === 'ai-match' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  AI Scholarship Matching & Career Guidance
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Powered by Gemini AI to score scholarships by GPA, financial need, and deadline urgency, plus personalized career roadmap.
                </p>
              </div>

              <form
                onSubmit={handleSaveAndMatchAI}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">GPA (4.0 scale)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max="4"
                      value={profileForm.gpa}
                      onChange={(e) => setProfileForm({ ...profileForm, gpa: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Target Degree</label>
                    <select
                      value={profileForm.degreeTarget}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, degreeTarget: e.target.value as 'Bachelor' | 'Master' | 'PhD' })
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    >
                      <option value="Bachelor">Bachelor</option>
                      <option value="Master">Master</option>
                      <option value="PhD">PhD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Financial Need</label>
                    <select
                      value={profileForm.financialNeed}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          financialNeed: e.target.value as 'high' | 'moderate' | 'self-funded',
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    >
                      <option value="high">High Need (Full Funding)</option>
                      <option value="moderate">Moderate Aid</option>
                      <option value="self-funded">Self-Funded</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Field of Study</label>
                    <input
                      type="text"
                      value={profileForm.field}
                      onChange={(e) => setProfileForm({ ...profileForm, field: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">English Score</label>
                    <input
                      type="text"
                      value={profileForm.englishScore}
                      onChange={(e) => setProfileForm({ ...profileForm, englishScore: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Target Countries</label>
                    <input
                      type="text"
                      value={targetCountriesText}
                      onChange={(e) => {
                        setTargetCountriesText(e.target.value);
                        setProfileForm({
                          ...profileForm,
                          targetCountries: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        });
                      }}
                      placeholder="e.g. Canada, Germany, Switzerland"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeGlobalAlternatives}
                      onChange={(e) => {
                        setIncludeGlobalAlternatives(e.target.checked);
                        runAlgorithmicEligibilityMatch(undefined, e.target.checked);
                      }}
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
                    />
                    <span>
                      Include global alternatives outside target countries ({programs.length} programs · {scholarships.length} scholarships)
                    </span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => runAlgorithmicEligibilityMatch()}
                      className="px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      AI Filter & Calculate Chance
                    </button>
                    {isPaidMember ? (
                      <button
                        type="submit"
                        disabled={aiMatching || isOffline}
                        className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>{aiMatching ? 'Analyzing Profile...' : 'Run AI Scholarship & Career Agent'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requirePaidMembership('Gemini AI Scholarship & Career Agent')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Upgrade to Unlock AI Agent</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>

              {!isPaidMember && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-700 dark:text-slate-200">
                    <strong>Explorer Free Preview:</strong> Showing top 3 matched universities and top 2 scholarships. Upgrade to Scholar Pro ($14/mo) for all matches and full Gemini AI career & scholarship roadmaps.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('billing')}
                    className="px-3.5 py-2 min-h-[36px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shrink-0"
                  >
                    Upgrade Plan
                  </button>
                </div>
              )}

              {aiError && (
                <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-xs text-red-700 dark:text-red-300">
                  {aiError}
                </div>
              )}

              {/* Filtered Universities & Admission Probability Results */}
              {filteredUniMatches.length > 0 && (
                <section className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Filtered Universities & Admission Probability</span>
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Ranked by admission chance for GPA {profileForm.gpa.toFixed(2)}, {profileForm.degreeTarget}, {profileForm.englishScore}, and {targetCountriesText || 'all countries'}.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Showing {(isPaidMember ? filteredUniMatches : filteredUniMatches.slice(0, 3)).length} of {filteredUniMatches.length} matched universities
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {(isPaidMember ? filteredUniMatches : filteredUniMatches.slice(0, 3)).map((match) => {
                      const p = match.program;
                      const alreadyApplied = applications.some((a) => a.programId === p.id);
                      const readyDocsCount = match.requiredDocs.filter((d) => Boolean(d.inVault)).length;
                      const guide = getUniversityGuide(p);
                      const doneSteps = (journeyChecklists[p.id] || []).length;
                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => setActiveVarsityProgram(p)}
                                className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
                              >
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {p.country} · QS #{p.qsRank} · {p.degreeLevel} · {!match.countryMatched ? 'Global Alternative' : 'Target Country'}
                                </p>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-0.5 hover:underline">
                                  {p.university}
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-300">{p.title}</p>
                              </button>
                              <div className="text-right shrink-0">
                                <p className="text-xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                                  {match.probability}%
                                </p>
                                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                  {match.chanceLabel}
                                </p>
                              </div>
                            </div>

                            {/* Probability bar */}
                            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" aria-hidden="true">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  match.probability >= 65
                                    ? 'bg-emerald-500'
                                    : match.probability >= 45
                                      ? 'bg-blue-600'
                                      : 'bg-amber-500'
                                }`}
                                style={{ width: `${match.probability}%` }}
                              />
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              <span>Tuition: ${p.tuitionUsd.toLocaleString()}/yr</span>
                              <span>Living: ~${guide.living.totalMonthlyUsd.toLocaleString()}/mo</span>
                              <span>Visa: ${guide.visa.visaFeeUsd + guide.visa.healthSurchargeUsd}</span>
                              <span>Flight ({guide.airTicket.airportCode}): ~${guide.airTicket.estimatedOneWayUsd}</span>
                            </div>

                            <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
                              {match.reasons.slice(0, 3).map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>

                            {/* Compact Required Documents Preview */}
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  Documents ({readyDocsCount}/{match.requiredDocs.length} Vault) · Journey ({doneSteps}/{guide.steps.length} steps)
                                </span>
                              </div>
                              <ul className="space-y-1">
                                {match.requiredDocs.slice(0, 3).map((docItem, idx) => (
                                  <li key={idx} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 truncate">
                                      {docItem.inVault ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                      ) : (
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                      )}
                                      <span className="truncate">{docItem.label}</span>
                                    </span>
                                    <span className="text-[11px] font-mono shrink-0 text-slate-500 dark:text-slate-400">
                                      {docItem.inVault ? 'In Vault' : 'Needed'}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveVarsityProgram(p)}
                              className="flex-1 py-2.5 px-3 min-h-[44px] text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors"
                            >
                              Varsity Profile, Visa & Checklist
                            </button>
                            <button
                              type="button"
                              disabled={alreadyApplied}
                              onClick={() => {
                                if (requirePaidMembership('Submitting university applications')) {
                                  setCheckoutProgram(p);
                                }
                              }}
                              className="py-2.5 px-3 min-h-[44px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                              {alreadyApplied ? 'Applied' : isPaidMember ? 'Direct Apply' : 'Upgrade to Apply'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {!careerResult && ruleMatchedList.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Scholarship Eligibility & Deadline Matches
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Scored by GPA, country, degree & deadline
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(isPaidMember ? ruleMatchedList : ruleMatchedList.slice(0, 2)).map((item) => (
                      <div
                        key={item.scholarship.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.scholarship.name}
                          </h3>
                          <span className="font-mono text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400 shrink-0">
                            {item.score}% fit
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.scholarship.country} · Value ${item.scholarship.amountUsd.toLocaleString()} · Deadline {item.scholarship.deadline} ({item.urgency})
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {item.scholarship.coverage}
                        </p>
                        <ul className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs text-slate-600 dark:text-slate-400 list-disc list-inside">
                          {item.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {careerResult && (
                <div className="space-y-5">
                  <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Automated Career Guidance
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {careerResult.careerSummary}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                          Recommended Career Roles
                        </p>
                        <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 list-disc list-inside">
                          {careerResult.recommendedRoles?.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                          Skill Gaps to Strengthen Before Applying
                        </p>
                        <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 list-disc list-inside">
                          {careerResult.skillGapsToClose?.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>

                  {careerResult.universityMatches && careerResult.universityMatches.length > 0 && (
                    <section className="space-y-3">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                        AI University Admission Forecast
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {careerResult.universityMatches.map((um, idx) => {
                          const matchedProg = programs.find(
                            (p) => p.id === um.programId || p.university.toLowerCase() === um.university.toLowerCase(),
                          );
                          return (
                            <div
                              key={um.programId || idx}
                              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {um.university}
                                </h3>
                                <span className="font-mono text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400 shrink-0">
                                  {um.admissionProbability}% · {um.chanceLabel}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-300">{um.rationale}</p>
                              {um.requiredDocuments?.length > 0 && (
                                <ul className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs text-slate-600 dark:text-slate-400 list-disc list-inside">
                                  {um.requiredDocuments.map((doc, dIdx) => (
                                    <li key={dIdx}>{doc}</li>
                                  ))}
                                </ul>
                              )}
                              {matchedProg && (
                                <button
                                  type="button"
                                  onClick={() => setActiveVarsityProgram(matchedProg)}
                                  className="mt-2 w-full py-2 px-3 min-h-[40px] text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700"
                                >
                                  Access {matchedProg.university} Portal
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  <section className="space-y-3">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Ranked Scholarship Matches
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {careerResult.scholarshipMatches?.map((m, idx) => (
                        <div
                          key={m.scholarshipId || idx}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                              {m.scholarshipName}
                            </h3>
                            <span className="font-mono text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400 shrink-0">
                              {m.matchScore}% match
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Deadline Urgency: {m.urgencyLevel}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{m.rationale}</p>
                          <ul className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs text-slate-600 dark:text-slate-400 list-disc list-inside">
                            {m.actionSteps?.map((step, sIdx) => (
                              <li key={sIdx}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}

          {/* ALUMNI MENTORSHIP TAB */}
          {activeTab === 'alumni' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  University Alumni Mentors
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Schedule 1-on-1 mentorship calls with alumni from your target universities.
                </p>
              </div>

              {!isPaidMember && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-700 dark:text-slate-200">
                    <strong>Subscription Required:</strong> 1-on-1 alumni mentorship scheduling is included with Scholar Pro ($14/mo) and Global Fellowship ($29/mo).
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('billing')}
                    className="px-3.5 py-2 min-h-[36px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shrink-0"
                  >
                    Upgrade Plan
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {alumni.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <img
                          src={m.avatarUrl}
                          alt={m.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{m.name}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {m.university} · {m.graduationYear}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-3">
                        {m.currentRole} · {m.company}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">{m.bio}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Languages: {m.languages.join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!requirePaidMembership('1-on-1 alumni mentorship booking')) return;
                        setBookingMentor(m);
                        setBookingSlot(m.availableSlots[0] || '');
                      }}
                      className="mt-4 w-full py-2.5 px-4 min-h-[44px] text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700"
                    >
                      {isPaidMember ? 'Schedule 1-on-1 Session' : 'Upgrade to Book Session'}
                    </button>
                  </div>
                ))}
              </div>

              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Your Scheduled Mentorship Sessions
                </h2>
                {bookings.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No mentorship sessions booked yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bookings.map((b) => (
                      <div key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {b.mentorName} ({b.university})
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Topic: {b.topic}
                          </p>
                        </div>
                        <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
                          {b.slot} · {b.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* APPLICATIONS TRACKER TAB */}
          {activeTab === 'applications' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Application Status Tracker
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Every stage update dispatches automated email and push notifications.
                </p>
              </div>

              {!isPaidMember ? (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                  <Lock className="w-7 h-7 text-blue-600 dark:text-blue-400 mx-auto" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Direct University Applications Require Scholar Pro
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    Upgrade to Scholar Pro ($14/mo) or Global Fellowship ($29/mo) to submit international university applications and receive real-time stage updates.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('billing')}
                    className="mt-2 px-5 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Upgrade to Scholar Pro ($14/mo)
                  </button>
                </div>
              ) : applications.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    You have not started any university applications yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('programs')}
                    className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white"
                  >
                    Browse Programs
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {app.university} · Submitted {new Date(app.submittedAt).toLocaleDateString()}
                          </p>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-0.5">
                            {app.programTitle}
                          </h3>
                        </div>
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          Status: {app.status} · {app.feePaid ? `Fee Paid ($${app.feeAmountUsd})` : 'Fee Pending'}
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{app.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* E2EE DOCUMENT VAULT TAB */}
          {activeTab === 'vault' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  End-to-End Encrypted Document Vault
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Transcripts, recommendation letters, and SOPs are encrypted locally in your browser via Web Crypto AES-256-GCM before transmission.
                </p>
              </div>

              {/* Document Processing Analytics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Encrypted & Verified</p>
                  <p className="text-xl font-bold font-mono tabular-nums mt-1">{docCounts.verified}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Compliance Review</p>
                  <p className="text-xl font-bold font-mono tabular-nums mt-1">{docCounts.review}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Approved</p>
                  <p className="text-xl font-bold font-mono tabular-nums mt-1">{docCounts.approved}</p>
                </div>
              </div>

              {!isPaidMember ? (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 p-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>AES-256-GCM Document Vault Requires Scholar Pro</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Upgrade to Scholar Pro ($14/mo) or Global Fellowship ($29/mo) to encrypt and store official transcripts, SOPs, passports, and recommendation letters.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('billing')}
                    className="px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Upgrade to Unlock E2EE Vault
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleEncryptAndUpload}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
                >
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Encrypt & Upload Document (AES-256-GCM)</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Document Type</label>
                      <select
                        value={vaultDocType}
                        onChange={(e) => setVaultDocType(e.target.value as DocumentType)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      >
                        <option value="Transcript">Official Transcript</option>
                        <option value="Recommendation Letter">Letter of Recommendation</option>
                        <option value="Statement of Purpose">Statement of Purpose</option>
                        <option value="Passport / ID">Passport / ID</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Select File</label>
                      <input
                        type="file"
                        onChange={(e) => setVaultFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-xs file:font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Vault Passphrase (never sent to server)
                      </label>
                      <input
                        type="password"
                        value={vaultPassphrase}
                        onChange={(e) => setVaultPassphrase(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={encrypting || isOffline}
                    className="px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {encrypting ? 'Encrypting Locally...' : 'Encrypt & Store in Vault'}
                  </button>
                </form>
              )}

              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Stored Encrypted Documents
                  </h2>
                  <input
                    type="password"
                    value={decryptPassphrase}
                    onChange={(e) => setDecryptPassphrase(e.target.value)}
                    placeholder="Passphrase to decrypt"
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                {documents.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No encrypted documents stored yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {documents.map((doc) => (
                      <div key={doc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {doc.fileName}
                          </p>
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {doc.docType} · {doc.algorithm} · SHA-256: {doc.sha256Fingerprint} · {doc.processingStatus}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDecryptDownload(doc)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Decrypt & Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ADVISOR & MODERATOR CHAT TAB */}
          {activeTab === 'chat' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    AI Assistant & Moderator Desk
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    Switch between instant Gemini AI guidance and direct human moderator support.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
                  <button
                    type="button"
                    onClick={() => {
                      setChatMode('ai');
                      setChatError('');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      chatMode === 'ai'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    AI Advisor Bot
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChatMode('moderator');
                      setChatError('');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      chatMode === 'moderator'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Human Moderator
                  </button>
                </div>
              </div>

              {!isPaidMember ? (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                  <Lock className="w-7 h-7 text-blue-600 dark:text-blue-400 mx-auto" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    AI Advisor Bot & Moderator Desk Require Scholar Pro
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    Upgrade to Scholar Pro ($14/mo) or Global Fellowship ($29/mo) for instant Gemini AI admissions advice and direct human moderator support.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('billing')}
                    className="mt-2 px-5 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Upgrade to Scholar Pro
                  </button>
                </div>
              ) : (
                <>
                  {chatError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{chatError}</span>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[420px]">
                    <div className="flex-1 p-4 overflow-y-auto space-y-3">
                      {chatMode === 'ai' ? (
                        aiMessages.map((m, idx) => (
                          <div
                            key={idx}
                            className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                              m.role === 'user'
                                ? 'ml-auto bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            <p className="text-xs opacity-75 mb-1 flex items-center gap-1">
                              {m.role === 'assistant' && <Bot className="w-3.5 h-3.5" />}
                              <span>{m.role === 'user' ? user.name : 'StudyGlobe AI Advisor'}</span>
                            </p>
                            <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                          </div>
                        ))
                      ) : messages.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          No moderator inquiries yet. Ask any admissions or document question below.
                        </p>
                      ) : (
                        messages.map((m) => (
                          <div
                            key={m.id}
                            className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                              m.senderRole === 'student'
                                ? 'ml-auto bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            <p className="text-xs opacity-75 mb-1">
                              {m.senderName} · {new Date(m.createdAt).toLocaleTimeString()}
                            </p>
                            <p className="leading-relaxed">{m.content}</p>
                          </div>
                        ))
                      )}
                      {chatLoading && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">Generating AI response...</p>
                      )}
                    </div>

                    <form onSubmit={handleSendChat} className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={
                          chatMode === 'ai'
                            ? 'Ask AI about scholarships, visas, or career outlook...'
                            : 'Send a direct question to StudyGlobe moderators...'
                        }
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={chatLoading}
                        className="px-4 py-2 min-h-[44px] rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </form>
                  </div>
                </>
              )}

              {/* Site Feedback for Continuous AI Customization */}
              <form
                onSubmit={handleSubmitFeedback}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Submit Portal Feedback (Feeds AI Site Customization)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={feedbackCat}
                    onChange={(e) => setFeedbackCat(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="Accessibility & Study UX">Accessibility & Study UX</option>
                    <option value="Scholarship Filters">Scholarship Filters</option>
                    <option value="Mobile Navigation">Mobile Navigation</option>
                  </select>
                  <input
                    type="text"
                    value={feedbackMsg}
                    onChange={(e) => setFeedbackMsg(e.target.value)}
                    placeholder="Suggest an interface or study improvement..."
                    className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Submit Feedback
                </button>
              </form>
            </div>
          )}

          {/* BILLING & SECURITY TAB */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Subscription & Account Security
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Current Plan:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {user.subscriptionTier === 'pro'
                      ? 'SCHOLAR PRO ($14/mo)'
                      : user.subscriptionTier === 'fellowship'
                        ? 'GLOBAL FELLOWSHIP ($29/mo)'
                        : 'EXPLORER FREE ($0/mo)'}
                  </strong>
                </p>
              </div>

              {billingReceipt && (
                <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <h2 className="text-sm font-bold">
                        Payment Confirmed ·{' '}
                        {billingReceipt.tier === 'pro'
                          ? 'Scholar Pro Active'
                          : billingReceipt.tier === 'fellowship'
                            ? 'Global Fellowship Active'
                            : 'Explorer Free Active'}
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300">
                      Invoice {billingReceipt.invoiceId} · ${billingReceipt.amountUsd}/mo · Card ending{' '}
                      {billingReceipt.cardLast4}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    All Pro capabilities are unlocked on your account right now: direct university applications, Gemini AI Scholarship & Career Agent, AI Advisor & Moderator chat, 1-on-1 Alumni booking, and AES-256 E2EE Document Vault.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('programs')}
                      className="px-3.5 py-2 min-h-[36px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Apply to Universities
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('ai-match')}
                      className="px-3.5 py-2 min-h-[36px] text-xs font-semibold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Open AI Match
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('vault')}
                      className="px-3.5 py-2 min-h-[36px] text-xs font-semibold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Open E2EE Vault
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('chat')}
                      className="px-3.5 py-2 min-h-[36px] text-xs font-semibold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Open Advisor Chat
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  {
                    id: 'free' as SubscriptionTier,
                    name: 'Explorer Free',
                    price: '$0/mo',
                    desc: 'Overview universities & deadlines with limited match preview.',
                    features: [
                      '36 university & scholarship directory preview',
                      'Living, visa & airfare calculator',
                      'Top 3 eligibility matches preview',
                    ],
                  },
                  {
                    id: 'pro' as SubscriptionTier,
                    name: 'Scholar Pro',
                    price: '$14/mo',
                    desc: 'Unlock direct university applications, unlimited AI guidance, and E2EE vault.',
                    features: [
                      'Submit & track university applications',
                      'Unlimited Gemini AI Scholarship & Advisor Chat',
                      'AES-256-GCM Encrypted Document Vault',
                      '1-on-1 Alumni mentorship session booking',
                    ],
                  },
                  {
                    id: 'fellowship' as SubscriptionTier,
                    name: 'Global Fellowship',
                    price: '$29/mo',
                    desc: 'Everything in Scholar Pro plus $0 partner application fee waivers.',
                    features: [
                      'All Scholar Pro features unlocked',
                      '$0 application fee waivers on partner universities',
                      'Priority 1-on-1 alumni & compliance review',
                    ],
                  },
                ].map((plan) => {
                  const isCurrent = user.subscriptionTier === plan.id;
                  return (
                    <div
                      key={plan.id}
                      className={`rounded-xl border p-5 flex flex-col justify-between bg-white dark:bg-slate-900 ${
                        isCurrent
                          ? 'border-2 border-blue-600 dark:border-blue-500'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                          {isCurrent && (
                            <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-2xl font-bold font-mono tabular-nums mt-2">{plan.price}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{plan.desc}</p>
                        <ul className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                          {plan.features.map((feat) => (
                            <li key={feat} className="flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => openTierCheckout(plan.id)}
                        className="mt-5 w-full py-2.5 px-4 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        {isCurrent
                          ? 'Active Plan'
                          : plan.id === 'free'
                            ? 'Switch to Free'
                            : `Upgrade to ${plan.name} (${plan.price})`}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* MFA & GDPR/HIPAA Privacy Panel */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Multi-Factor Authentication (MFA) & Privacy Compliance</span>
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    GDPR data minimization & HIPAA-grade encryption active. Require a 6-digit verification code on sign-in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleMfa}
                  className="px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  {user.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
                </button>
              </section>

              {/* Mobile Account Sign-Out Card */}
              <section className="md:hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Thumb-Zone Navigation (max 15% height, >= 44px touch targets) */}
      <nav
        aria-label="Mobile quick navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center"
      >
        {(
          [
            { id: 'overview', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
            { id: 'programs', label: 'Programs', icon: <BookOpen className="w-5 h-5" /> },
            { id: 'ai-match', label: 'AI Match', icon: <Sparkles className="w-5 h-5" /> },
            { id: 'vault', label: 'Vault', icon: <FileLock2 className="w-5 h-5" /> },
            { id: 'chat', label: 'Advisor', icon: <MessageSquare className="w-5 h-5" /> },
          ] as { id: StudentTab; label: string; icon: React.ReactNode }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`min-h-[48px] flex flex-col items-center justify-center text-[10px] font-medium ${
              activeTab === item.id
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {item.icon}
            <span className="mt-0.5">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Application Fee Payment Checkout Modal */}
      {checkoutProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={handleSubmitApplication}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Submit Application · {checkoutProgram.university}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{checkoutProgram.title}</p>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs flex justify-between">
              <span>Application Fee</span>
              <span className="font-mono font-bold">
                {user.subscriptionTier === 'fellowship'
                  ? '$0 (Waived by Global Fellowship)'
                  : `$${checkoutProgram.applicationFeeUsd}`}
              </span>
            </div>

            {user.subscriptionTier !== 'fellowship' && checkoutProgram.applicationFeeUsd > 0 && (
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Card Number (Secure Payment Gateway)
                </label>
                <input
                  type="text"
                  required
                  value={cardInput}
                  onChange={(e) => setCardInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Applicant Notes</label>
              <textarea
                rows={2}
                value={applyNotes}
                onChange={(e) => setApplyNotes(e.target.value)}
                placeholder="Optional statement summary or scholarship reference..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCheckoutProgram(null)}
                className="flex-1 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={applying}
                className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                {applying ? 'Processing...' : 'Confirm & Apply'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mentorship Booking Modal */}
      {bookingMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={handleBookMentorship}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Schedule 1-on-1 · {bookingMentor.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {bookingMentor.university} · {bookingMentor.currentRole}
            </p>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Select Time Slot</label>
              <select
                value={bookingSlot}
                onChange={(e) => setBookingSlot(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              >
                {bookingMentor.availableSlots.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Session Topic</label>
              <input
                type="text"
                required
                value={bookingTopic}
                onChange={(e) => setBookingTopic(e.target.value)}
                placeholder="e.g., SOP feedback & scholarship interview prep"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setBookingMentor(null)}
                className="flex-1 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Confirm Session
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Comprehensive University Profile, Living, Visa, Airfare & Step-by-Step Checklist Modal */}
      {activeVarsityProgram && (
        <UniversityProfileModal
          program={activeVarsityProgram}
          user={user}
          profileOverride={{
            ...profileForm,
            targetCountries: targetCountriesText.split(',').map((s) => s.trim()).filter(Boolean),
          }}
          documents={documents}
          alreadyApplied={applications.some((a) => a.programId === activeVarsityProgram.id)}
          checkedSteps={journeyChecklists[activeVarsityProgram.id] || []}
          onToggleStep={handleToggleJourneyStep}
          onClose={() => setActiveVarsityProgram(null)}
          onApplyDirect={(prog) => {
            setActiveVarsityProgram(null);
            if (requirePaidMembership('Submitting university applications')) {
              setCheckoutProgram(prog);
            }
          }}
          onUploadToVault={(docType) => {
            setActiveVarsityProgram(null);
            if (requirePaidMembership('E2EE Document Vault storage')) {
              setVaultDocType(docType);
              setActiveTab('vault');
            }
          }}
          onUpgradeRequired={() => {
            setActiveVarsityProgram(null);
            setActiveTab('billing');
          }}
        />
      )}

      {/* Subscription Payment Checkout Modal */}
      {selectedTier && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-checkout-title"
        >
          <form
            onSubmit={handleCheckoutTier}
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="subscription-checkout-title"
                  className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    {selectedTier === 'pro'
                      ? 'Upgrade to Scholar Pro'
                      : selectedTier === 'fellowship'
                        ? 'Upgrade to Global Fellowship'
                        : 'Switch to Explorer Free'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedTier === 'free'
                    ? 'Downgrade billing cycle to $0/mo'
                    : 'Encrypted payment processing · Instant Pro mode activation'}
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 shrink-0">
                {selectedTier === 'pro' ? '$14/mo' : selectedTier === 'fellowship' ? '$29/mo' : '$0/mo'}
              </span>
            </div>

            {selectedTier !== 'free' && (
              <>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs space-y-1 text-slate-700 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-white">Unlocks immediately:</p>
                  <p>Direct applications, AI Scholarship & Career Agent, AI Advisor & Moderator chat, 1-on-1 Alumni booking, and E2EE Vault{selectedTier === 'fellowship' ? ' + $0 partner fee waivers' : ''}.</p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setBillingMethod('card');
                      setBillingError('');
                    }}
                    className={`py-2 px-2 text-xs font-semibold rounded-md transition-colors ${
                      billingMethod === 'card'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Credit / Debit Card
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillingMethod('sandbox');
                      setBillingError('');
                    }}
                    className={`py-2 px-2 text-xs font-semibold rounded-md transition-colors ${
                      billingMethod === 'sandbox'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Instant Test Pass
                  </button>
                </div>

                {billingMethod === 'card' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        required
                        value={billingCardName}
                        onChange={(e) => {
                          setBillingCardName(e.target.value);
                          setBillingError('');
                        }}
                        placeholder="Full name on card"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Card Number
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={billingCard}
                        onChange={(e) => {
                          setBillingCard(e.target.value);
                          setBillingError('');
                        }}
                        placeholder="4242 4242 4242 4242"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          Expiry (MM/YY)
                        </label>
                        <input
                          type="text"
                          required
                          value={billingExpiry}
                          onChange={(e) => {
                            setBillingExpiry(e.target.value);
                            setBillingError('');
                          }}
                          placeholder="12/28"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          CVC
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={billingCvc}
                          onChange={(e) => {
                            setBillingCvc(e.target.value);
                            setBillingError('');
                          }}
                          placeholder="424"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-3.5 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                    <p className="font-semibold">Student Sandbox Instant Pass Selected</p>
                    <p>Activates {selectedTier.toUpperCase()} mode immediately using sandbox verification ending in 4242 without external card charges.</p>
                  </div>
                )}
              </>
            )}

            {billingError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{billingError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedTier(null);
                  setBillingError('');
                }}
                className="flex-1 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={billingLoading}
                className="flex-1 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {billingLoading
                  ? 'Activating...'
                  : selectedTier === 'free'
                    ? 'Confirm Free Plan'
                    : `Pay ${selectedTier === 'pro' ? '$14' : '$29'}/mo & Activate`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
