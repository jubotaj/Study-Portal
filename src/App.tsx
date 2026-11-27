/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { AdminWorkspace } from './components/AdminWorkspace.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { PublicPortal } from './components/PublicPortal.tsx';
import { StudentWorkspace } from './components/StudentWorkspace.tsx';
import { auth, signOutFromFirebase } from './firebase.ts';
import {
  ensureFirebaseUserWorkspaceDocs,
  subscribeToFirebaseUserWorkspace,
  syncUserProfileToFirestore,
} from './services/firestoreSync.ts';
import type {
  AlumniMentor,
  Application,
  EncryptedDocument,
  LanguageCode,
  MentorshipBooking,
  PortalNotification,
  Program,
  PublicUser,
  Scholarship,
  SiteCustomization,
  SubscriptionTier,
  SupportMessage,
} from './types.ts';
import {
  clearOfflineQueue,
  getOfflineQueue,
  loadOfflineCache,
  saveOfflineCache,
  type OfflineQueuedAction,
} from './utils/offline.ts';
import {
  createInitialCustomizations,
  ENRICHED_INITIAL_PROGRAMS,
  INITIAL_ALUMNI,
  INITIAL_PUBLIC_STATS,
  INITIAL_SCHOLARSHIPS,
  STATIC_DEMO_ACCOUNTS,
  STATIC_INITIAL_APPLICATIONS,
  STATIC_INITIAL_BOOKINGS,
  STATIC_INITIAL_MESSAGES,
  STATIC_INITIAL_NOTIFICATIONS,
} from './data/catalog.ts';

const OFFLINE_QUEUE_STORAGE_KEY = 'studyglobe_offline_queue_v1';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const staticUserRef = useRef<PublicUser | null>(null);
  const lastSyncedTokenRef = useRef<string | null>(null);
  const [viewMode, setViewMode] = useState<'public' | 'workspace'>('public');
  const [studentInitialTab, setStudentInitialTab] = useState<'overview' | 'billing' | null>(null);
  const [studentPreselectTier, setStudentPreselectTier] = useState<SubscriptionTier | null>(null);
  const pendingPlanRef = useRef<SubscriptionTier | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register' | 'admin'>('login');

  // Accessibility & Theme preferences
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem('sg_dark') === 'true');
  const [highContrast, setHighContrast] = useState<boolean>(() => localStorage.getItem('sg_hc') === 'true');
  const [fontScale, setFontScale] = useState<number>(() => Number(localStorage.getItem('sg_scale')) || 1);
  const [language, setLanguage] = useState<LanguageCode>(
    () => (localStorage.getItem('sg_lang') as LanguageCode) || 'en',
  );

  // Offline & Sync state
  const [browserOffline, setBrowserOffline] = useState(!navigator.onLine);
  const [offlineSim, setOfflineSim] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedAction[]>(() => getOfflineQueue());
  const isOffline = browserOffline || offlineSim;

  // Shared Portal Data (pre-populated with full 36-university catalog so static hosts work out-of-the-box)
  const [programs, setPrograms] = useState<Program[]>(ENRICHED_INITIAL_PROGRAMS);
  const [scholarships, setScholarships] = useState<Scholarship[]>(INITIAL_SCHOLARSHIPS);
  const [alumni, setAlumni] = useState<AlumniMentor[]>(INITIAL_ALUMNI);
  const [customizations, setCustomizations] = useState<SiteCustomization[]>(() =>
    createInitialCustomizations(),
  );
  const [stats, setStats] = useState(INITIAL_PUBLIC_STATS);

  // Authenticated User Data
  const [bookings, setBookings] = useState<MentorshipBooking[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<EncryptedDocument[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);

  // Apply Dark Mode, High Contrast, and Font Scale to documentElement
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('sg_dark', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    localStorage.setItem('sg_hc', String(highContrast));
  }, [highContrast]);

  useEffect(() => {
    document.documentElement.style.setProperty('--a11y-scale', String(fontScale));
    localStorage.setItem('sg_scale', String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    localStorage.setItem('sg_lang', language);
  }, [language]);

  useEffect(() => {
    const onOnline = () => setBrowserOffline(false);
    const onOffline = () => setBrowserOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const fetchPublicOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/overview');
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) return;
      const data = await res.json();
      if (Array.isArray(data?.programs) && data.programs.length > 0) {
        setPrograms(data.programs);
        setScholarships(data.scholarships || INITIAL_SCHOLARSHIPS);
        setAlumni(data.alumni || INITIAL_ALUMNI);
        setCustomizations(data.customizations || createInitialCustomizations());
        if (data.stats) setStats(data.stats);
        saveOfflineCache(data);
      }
    } catch {
      const cached = loadOfflineCache<any>();
      if (cached?.snapshot?.programs?.length) {
        setPrograms(cached.snapshot.programs);
        setScholarships(cached.snapshot.scholarships || INITIAL_SCHOLARSHIPS);
        setAlumni(cached.snapshot.alumni || INITIAL_ALUMNI);
        setCustomizations(cached.snapshot.customizations || createInitialCustomizations());
        if (cached.snapshot.stats) setStats(cached.snapshot.stats);
      }
    }
  }, []);

  const hydrateStaticPreviewWorkspace = useCallback((staticEmail?: string) => {
    let resolvedUser: PublicUser | null = staticUserRef.current;
    if (!resolvedUser && staticEmail && STATIC_DEMO_ACCOUNTS[staticEmail]) {
      resolvedUser = STATIC_DEMO_ACCOUNTS[staticEmail];
    }
    if (resolvedUser) {
      setUser(resolvedUser);
      setPrograms(ENRICHED_INITIAL_PROGRAMS);
      setScholarships(INITIAL_SCHOLARSHIPS);
      setAlumni(INITIAL_ALUMNI);
      setCustomizations(createInitialCustomizations());
      setApplications(STATIC_INITIAL_APPLICATIONS.filter((a) => a.studentId === resolvedUser!.id));
      setBookings(STATIC_INITIAL_BOOKINGS.filter((b) => b.studentId === resolvedUser!.id));
      setMessages(STATIC_INITIAL_MESSAGES.filter((m) => m.studentId === resolvedUser!.id));
      setNotifications(STATIC_INITIAL_NOTIFICATIONS.filter((n) => n.userId === resolvedUser!.id));
    }
  }, []);

  const syncWorkspace = useCallback(
    async (activeToken?: string) => {
      const tk = activeToken ?? token;
      if (!tk) return;

      if (tk.startsWith('static-preview:')) {
        hydrateStaticPreviewWorkspace(tk.slice('static-preview:'.length));
        return;
      }

      if (tk.startsWith('firebase:')) {
        if (auth.currentUser?.emailVerified) {
          try {
            const fbUser = await ensureFirebaseUserWorkspaceDocs(auth.currentUser, user);
            setUser((prev) => prev ?? fbUser);
          } catch {
            // ErrorBoundary or console handles structured Firestore error
          }
        }
        return;
      }

      // Replay queued offline actions if online
      const queued = getOfflineQueue();
      if (!isOffline && queued.length > 0) {
        const remaining: OfflineQueuedAction[] = [];
        for (const item of queued) {
          try {
            const qRes = await fetch(item.endpoint, {
              method: item.method,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tk}`,
              },
              body: JSON.stringify(item.body),
            });
            // Keep items only on transient 5xx failures; drop succeeded or permanent 4xx rejections
            if (qRes.status >= 500) {
              remaining.push(item);
            }
          } catch {
            remaining.push(item);
          }
        }
        if (remaining.length === 0) {
          clearOfflineQueue();
        } else {
          try {
            localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(remaining));
          } catch {
            // ignore storage errors
          }
        }
        setOfflineQueue(remaining);
      }

      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tk}` },
        });
        const ct = res.headers.get('content-type') || '';
        if (res.status === 401 || res.status === 403) {
          lastSyncedTokenRef.current = null;
          staticUserRef.current = null;
          setToken(null);
          setUser(null);
          setViewMode('public');
          return;
        }
        if (!res.ok || !ct.includes('application/json')) {
          hydrateStaticPreviewWorkspace();
          return;
        }
        const data = await res.json();
        setUser(data.user);
        setPrograms(data.programs);
        setScholarships(data.scholarships);
        setAlumni(data.alumni);
        setCustomizations(data.customizations);
        setApplications(data.applications);
        setBookings(data.bookings);
        setDocuments(data.documents);
        setMessages(data.messages);
        setNotifications(data.notifications);
        if (data.user?.preferredLanguage) {
          setLanguage(data.user.preferredLanguage);
        }
        saveOfflineCache(data);
      } catch {
        hydrateStaticPreviewWorkspace();
      }
    },
    [token, isOffline, hydrateStaticPreviewWorkspace],
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUid(fbUser && fbUser.emailVerified ? fbUser.uid : null);
      setFirebaseAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!firebaseAuthReady || !firebaseUid || !user) return;
    const unsub = subscribeToFirebaseUserWorkspace(firebaseUid, {
      onApplications: (items) => setApplications(items),
      onBookings: (items) => setBookings(items),
      onDocuments: (items) => setDocuments(items),
      onMessages: (items) => setMessages(items),
      onNotifications: (items) => setNotifications(items),
    });
    return () => unsub();
  }, [firebaseAuthReady, firebaseUid, user?.id]);

  useEffect(() => {
    fetchPublicOverview();
  }, [fetchPublicOverview]);

  useEffect(() => {
    if (token && lastSyncedTokenRef.current !== token) {
      lastSyncedTokenRef.current = token;
      syncWorkspace(token).then(() => {
        setViewMode('workspace');
      });
    }
  }, [token, syncWorkspace]);

  // Refresh offline queue badge when offline status or workspace data changes
  useEffect(() => {
    setOfflineQueue(getOfflineQueue());
  }, [isOffline, applications.length, bookings.length]);

  const handleUpdateUser = useCallback(
    (updatedUser: PublicUser) => {
      setUser(updatedUser);
      if (staticUserRef.current || token?.startsWith('static-preview:')) {
        staticUserRef.current = updatedUser;
      }
    },
    [token],
  );

  const handleAuthSuccess = (newToken: string, newUser: PublicUser) => {
    staticUserRef.current = newToken.startsWith('static-preview:') ? newUser : null;
    lastSyncedTokenRef.current = null;
    setUser(newUser);
    setToken(newToken);
    setAuthModalOpen(false);
    if (pendingPlanRef.current && newUser.role === 'student') {
      setStudentInitialTab('billing');
      setStudentPreselectTier(pendingPlanRef.current);
      pendingPlanRef.current = null;
    } else {
      setStudentInitialTab('overview');
      setStudentPreselectTier(null);
      pendingPlanRef.current = null;
    }
  };

  const handleConsumeInitialIntent = useCallback(() => {
    setStudentInitialTab(null);
    setStudentPreselectTier(null);
  }, []);

  const handleLogout = () => {
    lastSyncedTokenRef.current = null;
    staticUserRef.current = null;
    pendingPlanRef.current = null;
    setToken(null);
    setUser(null);
    setApplications([]);
    setBookings([]);
    setDocuments([]);
    setMessages([]);
    setNotifications([]);
    setStudentInitialTab(null);
    setStudentPreselectTier(null);
    setViewMode('public');
    signOutFromFirebase().catch(() => undefined);
  };

  const handleChangeLanguage = async (nextLang: LanguageCode) => {
    setLanguage(nextLang);
    if (firebaseUid) {
      syncUserProfileToFirestore(firebaseUid, { preferredLanguage: nextLang }).catch(() => undefined);
    }
    if (token && !token.startsWith('static-preview:') && !token.startsWith('firebase:') && !isOffline) {
      try {
        await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferredLanguage: nextLang }),
        });
      } catch {
        // Ignore network errors on preference sync
      }
    }
  };

  return (
    <>
      {viewMode === 'workspace' && user && token ? (
        user.role === 'admin' ? (
          <AdminWorkspace
            token={token}
            adminUser={user}
            programs={programs}
            scholarships={scholarships}
            onRefreshPublic={fetchPublicOverview}
            onBackToPublic={() => setViewMode('public')}
            onLogout={handleLogout}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((d) => !d)}
          />
        ) : (
          <StudentWorkspace
            token={token}
            user={user}
            programs={programs}
            scholarships={scholarships}
            alumni={alumni}
            bookings={bookings}
            applications={applications}
            documents={documents}
            messages={messages}
            notifications={notifications}
            customizations={customizations}
            isOffline={isOffline}
            offlineQueue={offlineQueue}
            initialTab={studentInitialTab}
            initialCheckoutTier={studentPreselectTier}
            onConsumeInitialIntent={handleConsumeInitialIntent}
            onRefreshQueue={() => setOfflineQueue(getOfflineQueue())}
            onToggleOfflineSim={() => setOfflineSim((v) => !v)}
            onSyncNow={() => syncWorkspace()}
            onUpdateUser={handleUpdateUser}
            onBackToPublic={() => setViewMode('public')}
            onLogout={handleLogout}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((d) => !d)}
            language={language}
            onChangeLanguage={handleChangeLanguage}
            highContrast={highContrast}
            onToggleHighContrast={() => setHighContrast((h) => !h)}
            fontScale={fontScale}
            onChangeFontScale={setFontScale}
          />
        )
      ) : (
        <PublicPortal
          programs={programs}
          scholarships={scholarships}
          alumni={alumni}
          stats={stats}
          currentUser={user}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          language={language}
          onChangeLanguage={handleChangeLanguage}
          highContrast={highContrast}
          onToggleHighContrast={() => setHighContrast((h) => !h)}
          fontScale={fontScale}
          onChangeFontScale={setFontScale}
          onOpenAuth={(mode, preselectTier) => {
            pendingPlanRef.current = preselectTier ?? null;
            setAuthInitialMode(mode);
            setAuthModalOpen(true);
          }}
          onEnterWorkspace={(targetTab, preselectTier) => {
            setStudentInitialTab(targetTab ?? null);
            setStudentPreselectTier(preselectTier ?? null);
            setViewMode('workspace');
          }}
          onLogout={handleLogout}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
