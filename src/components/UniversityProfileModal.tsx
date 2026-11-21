import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  FileText,
  Plane,
  ShieldCheck,
  Square,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import type { AcademicProfile, DocumentType, EncryptedDocument, Program, PublicUser } from '../types.ts';
import { evaluateUniversityChance, getUniversityGuide } from '../utils/universityGuide.ts';

type ProfileTab = 'checklist' | 'costs' | 'visa' | 'documents';

interface UniversityProfileModalProps {
  program: Program;
  user: PublicUser | null;
  profileOverride?: AcademicProfile;
  documents?: EncryptedDocument[];
  alreadyApplied?: boolean;
  initialTab?: ProfileTab;
  checkedSteps: string[];
  onToggleStep: (programId: string, stepId: string) => void;
  onClose: () => void;
  onApplyDirect?: (program: Program) => void;
  onUploadToVault?: (docType: DocumentType) => void;
  onUpgradeRequired?: () => void;
  onRequestAuth?: () => void;
}

function getSafeExternalUrl(rawUrl: string | undefined, fallbackQuery: string): string {
  const fallback = `https://www.google.com/search?q=${encodeURIComponent(fallbackQuery)}`;
  if (!rawUrl) return fallback;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // ignore malformed URL
  }
  return fallback;
}

export const UniversityProfileModal: React.FC<UniversityProfileModalProps> = ({
  program,
  user,
  profileOverride,
  documents = [],
  alreadyApplied = false,
  initialTab = 'checklist',
  checkedSteps,
  onToggleStep,
  onClose,
  onApplyDirect,
  onUploadToVault,
  onUpgradeRequired,
  onRequestAuth,
}) => {
  const [tab, setTab] = useState<ProfileTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [program.id, initialTab]);

  const guide = getUniversityGuide(program);
  const activeProfile = profileOverride ?? user?.academicProfile;
  const chanceEval = activeProfile ? evaluateUniversityChance(program, activeProfile, documents) : null;
  const defaultDocEval = evaluateUniversityChance(
    program,
    activeProfile ?? {
      gpa: 3.5,
      degreeTarget: program.degreeLevel,
      field: program.field,
      targetCountries: [program.country],
      financialNeed: 'moderate',
      englishScore: 'IELTS 7.0',
      workExperienceMonths: 12,
    },
    documents,
  );

  const completedCount = guide.steps.filter((s) => checkedSteps.includes(s.id)).length;
  const progressPct = Math.round((completedCount / guide.steps.length) * 100);
  const isFreeStudent = Boolean(user && user.role === 'student' && user.subscriptionTier === 'free');
  const effectiveAppFee = user?.subscriptionTier === 'fellowship' ? 0 : program.applicationFeeUsd;
  const portalUrl = getSafeExternalUrl(
    program.admissionsPortalUrl,
    `${program.university} official admissions portal`,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-sm p-0 sm:p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="uni-profile-heading"
    >
      <div className="w-full max-w-3xl h-[92dvh] sm:h-auto sm:max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Top University Banner */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-4 min-w-0">
            <img
              src={program.imageUrl}
              alt={`${program.university} campus`}
              referrerPolicy="no-referrer"
              className="hidden sm:block w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {program.city}, {program.country} · QS Rank #{program.qsRank} · Acceptance {program.acceptanceRate} · {program.language}
              </p>
              <h2 id="uni-profile-heading" className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {program.university}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{program.title}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close university profile"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6 space-y-5">
          {/* 4-Card Quick Overview Strip: Tuition, Living, Visa, Air Ticket */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">University Fee / Yr</p>
              <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                ${program.tuitionUsd.toLocaleString()}
              </p>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                App fee: {effectiveAppFee === 0 ? '$0 (Waived)' : `$${effectiveAppFee}`}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Living Expenses</p>
              <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                ${guide.living.totalMonthlyUsd.toLocaleString()}/mo
              </p>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                ~${guide.living.totalAnnualUsd.toLocaleString()}/yr est.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Visa & Funds Proof</p>
              <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                ${(guide.visa.visaFeeUsd + guide.visa.healthSurchargeUsd).toLocaleString()} fee
              </p>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                Funds: ${guide.visa.proofOfFundsUsd.toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Air Ticket ({guide.airTicket.airportCode})
              </p>
              <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                ~${guide.airTicket.estimatedOneWayUsd}
              </p>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                Round-trip ~${guide.airTicket.estimatedRoundTripUsd}
              </p>
            </div>
          </div>

          {/* Personalized Admission Probability Banner (when profile is available) */}
          {chanceEval && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Your Estimated Admission Chance · Deadline {program.deadline}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {chanceEval.probability}% · {chanceEval.chanceLabel}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" aria-hidden="true">
                <div
                  className={`h-full rounded-full ${
                    chanceEval.probability >= 65
                      ? 'bg-emerald-500'
                      : chanceEval.probability >= 45
                        ? 'bg-blue-600'
                        : 'bg-amber-500'
                  }`}
                  style={{ width: `${chanceEval.probability}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {chanceEval.reasons.slice(0, 3).join(' · ')}
              </p>
            </div>
          )}

          {/* Profile Section Switcher */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800" role="tablist" aria-label="University profile sections">
            {(
              [
                {
                  id: 'checklist',
                  label: `Step-by-Step (${completedCount}/${guide.steps.length})`,
                  icon: <CheckSquare className="w-3.5 h-3.5" />,
                },
                {
                  id: 'costs',
                  label: 'Fees, Living & Air Ticket',
                  icon: <Wallet className="w-3.5 h-3.5" />,
                },
                {
                  id: 'visa',
                  label: 'Visa & Travel Process',
                  icon: <Plane className="w-3.5 h-3.5" />,
                },
                {
                  id: 'documents',
                  label: `Documents (${defaultDocEval.requiredDocs.length})`,
                  icon: <FileText className="w-3.5 h-3.5" />,
                },
              ] as { id: ProfileTab; label: string; icon: React.ReactNode }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`flex-1 min-w-[130px] inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                  tab === item.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: STEP-BY-STEP INTERACTIVE CHECKLIST */}
          {tab === 'checklist' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Step-by-Step Application to Arrival Checklist
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click any step to mark it complete from documents and varsity portal submission through visa, air ticket, and campus registration.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0 tabular-nums">
                  {progressPct}% complete
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" aria-hidden="true">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progressPct}%` }} />
              </div>

              <ul className="space-y-2.5">
                {guide.steps.map((step) => {
                  const checked = checkedSteps.includes(step.id);
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => onToggleStep(program.id, step.id)}
                        className={`w-full text-left rounded-xl border p-4 flex items-start gap-3.5 transition-colors ${
                          checked
                            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <span className="mt-0.5 shrink-0">
                          {checked ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-mono text-blue-600 dark:text-blue-400">
                              Step {step.stepNumber} · {step.phase}
                            </p>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {step.timelineHint}
                            </span>
                          </div>
                          <p
                            className={`text-sm font-semibold mt-0.5 ${
                              checked
                                ? 'line-through text-slate-500 dark:text-slate-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {step.title}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* TAB 2: FEES, LIVING EXPENSES & AIR TICKET BREAKDOWN */}
          {tab === 'costs' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Living Expenses Breakdown ({program.city}, {program.country})
                  </h3>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {guide.living.currencyLabel}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Student Housing / Dormitory Rent</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      ${guide.living.housingMonthlyUsd.toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Food, Groceries & Campus Meals</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      ${guide.living.foodMonthlyUsd.toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Local Transit Pass & Utilities / Mobile</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      ${guide.living.transitUtilitiesMonthlyUsd.toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Student Health Insurance (Monthly eq.)</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      {guide.living.healthInsuranceMonthlyUsd === 0
                        ? 'Included in Visa IHS'
                        : `$${guide.living.healthInsuranceMonthlyUsd.toLocaleString()}/mo`}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between bg-slate-50 dark:bg-slate-950/60 font-semibold">
                    <span className="text-slate-900 dark:text-white">Estimated Monthly / Annual Living Cost</span>
                    <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">
                      ${guide.living.totalMonthlyUsd.toLocaleString()}/mo (${guide.living.totalAnnualUsd.toLocaleString()}/yr)
                    </span>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <strong>Housing Tip:</strong> {guide.living.housingTip}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Estimated First-Year Total Budget (All-In)
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Annual University Tuition + Application Fee</span>
                    <span className="font-mono font-semibold tabular-nums">
                      ${(program.tuitionUsd + effectiveAppFee).toLocaleString()}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">12-Month Living Expenses</span>
                    <span className="font-mono font-semibold tabular-nums">
                      ${guide.living.totalAnnualUsd.toLocaleString()}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Visa Fee + Immigration Health / SEVIS Surcharge</span>
                    <span className="font-mono font-semibold tabular-nums">
                      ${(guide.visa.visaFeeUsd + guide.visa.healthSurchargeUsd).toLocaleString()}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">
                      One-Way International Air Ticket ({guide.airTicket.airportCode})
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      ~${guide.airTicket.estimatedOneWayUsd.toLocaleString()}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between bg-blue-50/70 dark:bg-blue-950/30 font-bold text-sm">
                    <span className="text-slate-900 dark:text-white">Total First-Year Estimated Budget</span>
                    <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">
                      ${(guide.firstYearTotalUsd + effectiveAppFee).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VISA PROCESS & AIR TICKET GUIDE */}
          {tab === 'visa' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400">
                      {program.country} Student Immigration
                    </p>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {guide.visa.visaName}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                    Processing: {guide.visa.processingWeeks}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <span className="text-slate-500 dark:text-slate-400 block">Embassy Visa Fee</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ${guide.visa.visaFeeUsd.toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <span className="text-slate-500 dark:text-slate-400 block">Health / SEVIS / Biometrics</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ${guide.visa.healthSurchargeUsd.toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <span className="text-slate-500 dark:text-slate-400 block">Proof of Funds Required</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ${guide.visa.proofOfFundsUsd.toLocaleString()}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
                  <strong>Financial Proof Rule:</strong> {guide.visa.proofOfFundsNote}
                </p>

                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Embassy & Visa Application Steps
                  </p>
                  <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside">
                    {guide.visa.embassySteps.map((st, idx) => (
                      <li key={idx} className="leading-relaxed">{st}</li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Air Ticket & Arrival Transit
                    </p>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {guide.airTicket.airportName} ({guide.airTicket.airportCode})
                    </h3>
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums">
                    <p className="font-bold text-slate-900 dark:text-white">
                      One-way ~${guide.airTicket.estimatedOneWayUsd}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      Round-trip ~${guide.airTicket.estimatedRoundTripUsd}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  <strong>Booking Guidance:</strong> {guide.airTicket.bookingTip}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  <strong>Airport to Campus:</strong> {guide.airTicket.localTransferNote}
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: REQUIRED DOCUMENTS CHECKLIST */}
          {tab === 'documents' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Required Admissions & Visa Documents
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tailored for {program.degreeLevel} applicants to {program.country}.
                  </p>
                </div>
                {user && (
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {defaultDocEval.requiredDocs.filter((d) => Boolean(d.inVault)).length} of{' '}
                    {defaultDocEval.requiredDocs.length} ready in Vault
                  </span>
                )}
              </div>

              <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                {defaultDocEval.requiredDocs.map((reqDoc, idx) => (
                  <li key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2.5">
                      {reqDoc.inVault ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{reqDoc.label}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {user
                            ? reqDoc.inVault
                              ? `Encrypted in E2EE Vault: ${reqDoc.inVault.fileName} (${reqDoc.inVault.processingStatus})`
                              : `Vault Category: ${reqDoc.vaultDocType} · Not uploaded yet`
                            : `Vault Category: ${reqDoc.vaultDocType} · Sign in to encrypt with AES-256-GCM`}
                        </p>
                      </div>
                    </div>

                    {user ? (
                      isFreeStudent ? (
                        onUpgradeRequired && (
                          <button
                            type="button"
                            onClick={onUpgradeRequired}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-[11px] font-semibold rounded-lg border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 shrink-0"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Upgrade for Vault</span>
                          </button>
                        )
                      ) : (
                        !reqDoc.inVault &&
                        onUploadToVault && (
                          <button
                            type="button"
                            onClick={() => onUploadToVault(reqDoc.vaultDocType)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-[11px] font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Upload to Vault</span>
                          </button>
                        )
                      )
                    ) : (
                      onRequestAuth && (
                        <button
                          type="button"
                          onClick={onRequestAuth}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-[11px] font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Sign In to Vault</span>
                        </button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sticky Footer Action Bar */}
        <div className="p-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row gap-3">
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 min-h-[44px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Official {program.university} Portal</span>
          </a>

          {user && isFreeStudent ? (
            <button
              type="button"
              onClick={onUpgradeRequired ?? (() => onApplyDirect?.(program))}
              className="flex-1 py-2.5 px-4 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Upgrade to Scholar Pro to Apply
            </button>
          ) : user && onApplyDirect ? (
            <button
              type="button"
              disabled={alreadyApplied}
              onClick={() => onApplyDirect(program)}
              className="flex-1 py-2.5 px-4 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500 transition-colors"
            >
              {alreadyApplied
                ? 'Already Applied via StudyGlobe'
                : `Apply Directly (${effectiveAppFee === 0 ? '$0 Fee' : `$${effectiveAppFee} Fee`})`}
            </button>
          ) : (
            <button
              type="button"
              onClick={onRequestAuth}
              className="flex-1 py-2.5 px-4 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Sign In / Register to Apply & Save Progress
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
