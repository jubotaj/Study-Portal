import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Lock,
  MailCheck,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { PublicUser } from '../types.ts';
import { safeReadJson } from '../utils/http.ts';
import { STATIC_DEMO_ACCOUNTS } from '../data/catalog.ts';
import { COUNTRY_DIAL_OPTIONS, validateAndFormatPhone } from '../data/countryDialCodes.ts';
import { signInWithGooglePopup } from '../firebase.ts';
import { ensureFirebaseUserWorkspaceDocs } from '../services/firestoreSync.ts';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register' | 'admin';
  onClose: () => void;
  onSuccess: (token: string, user: PublicUser) => void;
}

interface RegVerifyState {
  challengeId: string;
  email: string;
  phoneNumber: string;
  deliveryHint: string;
  demoOtpPreview?: string;
  staticUser?: PublicUser;
  expectedCode?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'admin'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('BD');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [field, setField] = useState('Computer Science & AI');
  const [degreeTarget, setDegreeTarget] = useState<'Bachelor' | 'Master' | 'PhD'>('Master');
  const [gpa, setGpa] = useState('3.75');
  const [financialNeed, setFinancialNeed] = useState<'high' | 'moderate' | 'self-funded'>('moderate');
  const [targetCountries, setTargetCountries] = useState('Switzerland, Germany');

  const [mfaStep, setMfaStep] = useState<{
    challengeId: string;
    deliveryHint: string;
    demoOtpPreview: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const [regVerifyStep, setRegVerifyStep] = useState<RegVerifyState | null>(null);
  const [regVerifyCode, setRegVerifyCode] = useState('');
  const [resending, setResending] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setMfaStep(null);
      setRegVerifyStep(null);
      setRegVerifyCode('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const selectedDialCountry =
    COUNTRY_DIAL_OPTIONS.find((c) => c.code === phoneCountry) || COUNTRY_DIAL_OPTIONS[0];

  const fillDemo = (type: 'admin' | 'free' | 'pro') => {
    setError('');
    setMfaStep(null);
    setRegVerifyStep(null);
    if (type === 'admin') {
      setMode('admin');
      setEmail('admin@studyglobe.edu');
      setPassword('AdminGlobe!2026');
    } else if (type === 'free') {
      setMode('login');
      setEmail('maya.lin@student.edu');
      setPassword('Student!2026');
    } else {
      setMode('login');
      setEmail('arjun.patel@student.edu');
      setPassword('Student!2026');
    }
  };

  const isBackendUnavailableResponse = (res: Response): boolean => {
    const ct = res.headers.get('content-type') || '';
    return res.status === 404 || res.status === 405 || !ct.includes('application/json');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithGooglePopup();
      const idToken = await cred.user.getIdToken();
      const firestoreUser = await ensureFirebaseUserWorkspaceDocs(cred.user);

      try {
        const res = await fetch('/api/auth/firebase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (!isBackendUnavailableResponse(res)) {
          const data = await safeReadJson(res);
          if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
          onSuccess(data.token, data.user);
          return;
        }
      } catch (backendErr) {
        if (backendErr instanceof Error && backendErr.message.includes('blocked')) {
          throw backendErr;
        }
      }

      onSuccess(`firebase:${cred.user.uid}`, firestoreUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      if (msg.includes('popup-closed-by-user')) {
        setError('Google sign-in window was closed before completing.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendRegistrationCode = async () => {
    if (!regVerifyStep) return;
    setError('');
    setResending(true);
    try {
      if (regVerifyStep.challengeId.startsWith('static-reg:')) {
        const nextCode = String(Math.floor(100000 + Math.random() * 900000));
        setRegVerifyStep({
          ...regVerifyStep,
          expectedCode: nextCode,
          demoOtpPreview: nextCode,
          deliveryHint: `New 6-digit email verification code prepared for ${regVerifyStep.email}.`,
        });
        return;
      }

      const res = await fetch('/api/auth/resend-registration-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: regVerifyStep.challengeId }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Could not resend verification code.');
      setRegVerifyStep({
        ...regVerifyStep,
        deliveryHint: data.deliveryHint,
        demoOtpPreview: data.demoOtpPreview,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (regVerifyStep) {
        const cleanCode = regVerifyCode.trim();
        if (regVerifyStep.challengeId.startsWith('static-reg:')) {
          if (cleanCode !== regVerifyStep.expectedCode) {
            throw new Error('Incorrect 6-digit email verification code.');
          }
          if (regVerifyStep.staticUser) {
            onSuccess(`static-preview:${regVerifyStep.email}`, {
              ...regVerifyStep.staticUser,
              emailVerified: true,
            });
            return;
          }
        }
        const res = await fetch('/api/auth/verify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId: regVerifyStep.challengeId, code: cleanCode }),
        });
        const data = await safeReadJson(res);
        if (!res.ok) throw new Error(data.error || 'Email verification failed');
        onSuccess(data.token, data.user);
        return;
      }

      if (mfaStep) {
        if (mfaStep.challengeId.startsWith('static-mfa:')) {
          if (mfaCode.trim() !== mfaStep.demoOtpPreview) {
            throw new Error('Incorrect 6-digit security code.');
          }
          const demoEmail = mfaStep.challengeId.slice('static-mfa:'.length);
          const demoUser = STATIC_DEMO_ACCOUNTS[demoEmail];
          if (demoUser) {
            onSuccess(`static-preview:${demoEmail}`, demoUser);
            return;
          }
        }
        const res = await fetch('/api/auth/verify-mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId: mfaStep.challengeId, code: mfaCode }),
        });
        const data = await safeReadJson(res);
        if (!res.ok) throw new Error(data.error || 'MFA verification failed');
        onSuccess(data.token, data.user);
        return;
      }

      if (mode === 'register') {
        const phoneCheck = validateAndFormatPhone(phoneCountry, phoneNumber);
        if (!phoneCheck.valid) {
          throw new Error(phoneCheck.error || 'Please enter a valid phone number for the selected country.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password,
            phoneCountry,
            phoneNumber,
            field,
            degreeTarget,
            gpa: Number(gpa),
            financialNeed,
            targetCountries: targetCountries
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          }),
        });

        if (isBackendUnavailableResponse(res)) {
          const now = new Date().toISOString();
          const cleanEmail = email.trim().toLowerCase();
          const code = String(Math.floor(100000 + Math.random() * 900000));
          const pendingUser: PublicUser = {
            id: `usr_${Date.now()}`,
            name: name.trim() || 'StudyGlobe Student',
            email: cleanEmail,
            phoneCountry: phoneCheck.country.code,
            phoneNumber: phoneCheck.formatted,
            emailVerified: false,
            role: 'student',
            blocked: false,
            subscriptionTier: 'free',
            mfaEnabled: false,
            preferredLanguage: 'en',
            academicProfile: {
              gpa: Number(gpa) || 3.5,
              degreeTarget,
              field,
              targetCountries: targetCountries
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              financialNeed,
              englishScore: 'IELTS 7.5',
              workExperienceMonths: 6,
            },
            lastSyncedAt: now,
            createdAt: now,
          };
          setRegVerifyCode('');
          setRegVerifyStep({
            challengeId: `static-reg:${cleanEmail}`,
            email: cleanEmail,
            phoneNumber: phoneCheck.formatted,
            deliveryHint: `6-digit email verification code prepared for ${cleanEmail} (Static Preview Mode).`,
            demoOtpPreview: code,
            expectedCode: code,
            staticUser: pendingUser,
          });
          return;
        }

        const data = await safeReadJson(res);
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        if (data.verificationRequired) {
          setRegVerifyCode('');
          setRegVerifyStep({
            challengeId: data.challengeId,
            email: data.email,
            phoneNumber: data.phoneNumber,
            deliveryHint: data.deliveryHint,
            demoOtpPreview: data.demoOtpPreview,
          });
          return;
        }

        onSuccess(data.token, data.user);
        return;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (isBackendUnavailableResponse(res)) {
        const cleanEmail = email.trim().toLowerCase();
        const demoUser = STATIC_DEMO_ACCOUNTS[cleanEmail];
        if (demoUser) {
          if (demoUser.mfaEnabled) {
            setMfaStep({
              challengeId: `static-mfa:${cleanEmail}`,
              deliveryHint: 'Static Preview Mode: enter the sandbox OTP below to explore the portal.',
              demoOtpPreview: '482910',
            });
            setMfaCode('482910');
            return;
          }
          onSuccess(`static-preview:${cleanEmail}`, demoUser);
          return;
        }
        throw new Error(
          'Static hosting detected: use a Quick Demo Account or Register Student, or deploy full-stack on Render.',
        );
      }

      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Sign in failed');

      if (data.mfaRequired) {
        setMfaStep({
          challengeId: data.challengeId,
          deliveryHint: data.deliveryHint,
          demoOtpPreview: data.demoOtpPreview,
        });
        setMfaCode(data.demoOtpPreview || '');
      } else {
        onSuccess(data.token, data.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
    >
      <div className="w-full max-w-lg h-[92dvh] sm:h-auto sm:max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="min-w-0">
            <h2 id="auth-dialog-title" className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
              {regVerifyStep
                ? 'Verify Your Email'
                : mfaStep
                  ? 'Multi-Factor Verification'
                  : mode === 'register'
                    ? 'Create Student Account'
                    : mode === 'admin'
                      ? 'Administrator Sign In'
                      : 'Student Sign In'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              StudyGlobe · Encrypted Portal Access
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 sm:p-6">
          {!mfaStep && !regVerifyStep && (
            <>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`py-2 px-1.5 sm:px-3 text-[11px] sm:text-xs font-medium rounded-md transition-colors truncate ${
                    mode === 'login'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Student Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`py-2 px-1.5 sm:px-3 text-[11px] sm:text-xs font-medium rounded-md transition-colors truncate ${
                    mode === 'register'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Register Student
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('admin');
                    setError('');
                  }}
                  className={`py-2 px-1.5 sm:px-3 text-[11px] sm:text-xs font-medium rounded-md transition-colors truncate ${
                    mode === 'admin'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Admin Portal
                </button>
              </div>

              {mode !== 'admin' && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors shadow-xs"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                    <span>Continue with Google (Firebase Auth & Cloud Sync)</span>
                  </button>
                  <div className="relative my-3.5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                      <span className="bg-white dark:bg-slate-900 px-2.5 text-slate-400">
                        Or continue with email
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4 pb-3.5 border-b border-slate-200 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Quick Demo Accounts
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fillDemo('admin')}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Admin (MFA)
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemo('free')}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Student (Free Tier)
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemo('pro')}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Student (Scholar Pro)
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form id="auth-modal-form" onSubmit={handleSubmit} className="space-y-4 pb-2">
            {regVerifyStep ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 p-4 text-xs text-slate-700 dark:text-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300">
                    <MailCheck className="w-4 h-4" />
                    <span>Email Verification Code Required</span>
                  </div>
                  <p>{regVerifyStep.deliveryHint}</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Registered Phone:{' '}
                    <strong className="font-mono text-slate-900 dark:text-slate-100">
                      {regVerifyStep.phoneNumber}
                    </strong>
                  </p>
                  {regVerifyStep.demoOtpPreview && (
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-slate-600 dark:text-slate-300">
                        Verification Code:{' '}
                        <strong className="text-slate-900 dark:text-white tracking-wider">
                          {regVerifyStep.demoOtpPreview}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setRegVerifyCode(regVerifyStep.demoOtpPreview || '')}
                        className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-slate-700"
                      >
                        Auto-fill
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="reg-verify-code"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Enter 6-Digit Email Code
                  </label>
                  <input
                    id="reg-verify-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={regVerifyCode}
                    onChange={(e) => setRegVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g., 482910"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm font-mono tracking-widest text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleResendRegistrationCode}
                    disabled={resending}
                    className="inline-flex items-center gap-1.5 py-1 font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    <span>{resending ? 'Sending...' : 'Resend Email Code'}</span>
                  </button>
                  <span className="text-slate-500 dark:text-slate-400">Expires in 10 minutes</span>
                </div>
              </div>
            ) : mfaStep ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 p-4 text-xs text-slate-700 dark:text-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300">
                    <ShieldCheck className="w-4 h-4" />
                    <span>6-Digit MFA Verification Required</span>
                  </div>
                  <p>{mfaStep.deliveryHint}</p>
                  <p className="font-mono text-slate-600 dark:text-slate-300">
                    Sandbox OTP Code:{' '}
                    <strong className="text-slate-900 dark:text-white">{mfaStep.demoOtpPreview}</strong>
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="mfa-code"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Enter 6-Digit Security Code
                  </label>
                  <input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm font-mono tracking-widest text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            ) : (
              <>
                {mode === 'register' && (
                  <div>
                    <label
                      htmlFor="reg-name"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Full Name
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Sofia Rahman"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Email Address {mode === 'register' ? '(Code Sent Here)' : ''}
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={mode === 'admin' ? 'admin@studyglobe.edu' : 'student@university.edu'}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={mode === 'register' ? 6 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                {mode === 'register' && (
                  <>
                    <div>
                      <label
                        htmlFor="reg-phone-number"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Phone Number (According to Country)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <select
                          aria-label="Phone Country Code"
                          value={phoneCountry}
                          onChange={(e) => setPhoneCountry(e.target.value)}
                          className="sm:col-span-5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100"
                        >
                          {COUNTRY_DIAL_OPTIONS.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name} ({c.dialCode})
                            </option>
                          ))}
                        </select>
                        <div className="sm:col-span-7 flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden">
                          <span className="inline-flex items-center gap-1 px-2.5 py-2.5 text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-r border-slate-300 dark:border-slate-700 shrink-0">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            {selectedDialCountry.dialCode}
                          </span>
                          <input
                            id="reg-phone-number"
                            type="tel"
                            inputMode="tel"
                            required
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder={selectedDialCountry.example}
                            className="w-full bg-transparent px-3 py-2.5 text-base sm:text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                          />
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Format for {selectedDialCountry.name}: {selectedDialCountry.dialCode}{' '}
                        {selectedDialCountry.example} (
                        {selectedDialCountry.minDigits === selectedDialCountry.maxDigits
                          ? `${selectedDialCountry.minDigits} digits`
                          : `${selectedDialCountry.minDigits}-${selectedDialCountry.maxDigits} digits`}
                        )
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label
                          htmlFor="reg-degree"
                          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Target Degree
                        </label>
                        <select
                          id="reg-degree"
                          value={degreeTarget}
                          onChange={(e) => setDegreeTarget(e.target.value as 'Bachelor' | 'Master' | 'PhD')}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100"
                        >
                          <option value="Bachelor">Bachelor</option>
                          <option value="Master">Master</option>
                          <option value="PhD">PhD</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="reg-gpa"
                          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                        >
                          GPA (4.0 Scale)
                        </label>
                        <input
                          id="reg-gpa"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="1"
                          max="4"
                          value={gpa}
                          onChange={(e) => setGpa(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-base sm:text-sm font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="reg-field"
                          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Study Field
                        </label>
                        <input
                          id="reg-field"
                          type="text"
                          value={field}
                          onChange={(e) => setField(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="reg-need"
                          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Financial Need
                        </label>
                        <select
                          id="reg-need"
                          value={financialNeed}
                          onChange={(e) =>
                            setFinancialNeed(e.target.value as 'high' | 'moderate' | 'self-funded')
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100"
                        >
                          <option value="high">High (Full Scholarship)</option>
                          <option value="moderate">Moderate Aid</option>
                          <option value="self-funded">Self-Funded</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="reg-countries"
                          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Preferred Countries
                        </label>
                        <input
                          id="reg-countries"
                          type="text"
                          value={targetCountries}
                          onChange={(e) => setTargetCountries(e.target.value)}
                          placeholder="Switzerland, Germany, Japan"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </form>
        </div>

        {/* Sticky Bottom Action Footer — Always visible & tappable on phones */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 sm:px-6 sm:py-4">
          {regVerifyStep ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setRegVerifyStep(null);
                  setRegVerifyCode('');
                  setError('');
                }}
                className="min-h-[44px] px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Edit Details
              </button>
              <button
                type="submit"
                form="auth-modal-form"
                disabled={loading || regVerifyCode.length < 6}
                className="flex-1 min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify Email & Activate Account'}
              </button>
            </div>
          ) : mfaStep ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMfaStep(null)}
                className="min-h-[44px] px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Back
              </button>
              <button
                type="submit"
                form="auth-modal-form"
                disabled={loading}
                className="flex-1 min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
            </div>
          ) : (
            <button
              type="submit"
              form="auth-modal-form"
              disabled={loading}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {mode === 'register' ? <UserPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>
                {loading
                  ? mode === 'register'
                    ? 'Sending Verification Code...'
                    : 'Authenticating...'
                  : mode === 'register'
                    ? 'Send Email Verification Code'
                    : mode === 'admin'
                      ? 'Sign In to Admin Console'
                      : 'Sign In to Student Portal'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
