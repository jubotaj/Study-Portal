import React, { useMemo, useState } from 'react';
import { ArrowRight, Calendar, Globe, Lock, LogOut, Moon, Search, Shield, Sun } from 'lucide-react';
import type { AlumniMentor, LanguageCode, Program, PublicUser, Scholarship, SubscriptionTier } from '../types.ts';
import { LANGUAGE_LABELS, t } from '../utils/i18n.ts';
import { getUniversityGuide } from '../utils/universityGuide.ts';
import { HistoricalTrendsSection } from './HistoricalTrendsSection.tsx';
import { UniversityProfileModal } from './UniversityProfileModal.tsx';

interface PublicPortalProps {
  programs: Program[];
  scholarships: Scholarship[];
  alumni: AlumniMentor[];
  stats: {
    universitiesCount: number;
    programsCount: number;
    scholarshipsCount: number;
    mentorsCount: number;
  };
  currentUser: PublicUser | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: number;
  onChangeFontScale: (scale: number) => void;
  onOpenAuth: (mode: 'login' | 'register' | 'admin', preselectTier?: SubscriptionTier) => void;
  onEnterWorkspace: (targetTab?: 'overview' | 'billing', preselectTier?: SubscriptionTier) => void;
  onLogout?: () => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  programs,
  scholarships,
  alumni,
  stats,
  currentUser,
  darkMode,
  onToggleDarkMode,
  language,
  onChangeLanguage,
  highContrast,
  onToggleHighContrast,
  fontScale,
  onChangeFontScale,
  onOpenAuth,
  onEnterWorkspace,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [degreeFilter, setDegreeFilter] = useState<'All' | 'Bachelor' | 'Master' | 'PhD'>('All');
  const [countryFilter, setCountryFilter] = useState<string>('All');
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [guestChecklists, setGuestChecklists] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem('sg_guest_checklists_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const handleToggleGuestStep = (programId: string, stepId: string) => {
    setGuestChecklists((prev) => {
      const current = prev[programId] || [];
      const nextSteps = current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId];
      const updated = { ...prev, [programId]: nextSteps };
      try {
        localStorage.setItem('sg_guest_checklists_v1', JSON.stringify(updated));
      } catch {
        // ignore storage quota errors
      }
      return updated;
    });
  };

  const countries = useMemo(() => {
    const set = new Set(programs.map((p) => p.country));
    return ['All', ...Array.from(set)];
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchesDegree = degreeFilter === 'All' || p.degreeLevel === degreeFilter;
      const matchesCountry = countryFilter === 'All' || p.country === countryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.university.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.field.toLowerCase().includes(q);
      return matchesDegree && matchesCountry && matchesQuery;
    });
  }, [programs, degreeFilter, countryFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#overview"
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            StudyGlobe
          </a>

          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#overview" className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              {t(language, 'navOverview')}
            </a>
            <a href="#universities" className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              {t(language, 'navUniversities')}
            </a>
            <a href="#scholarships" className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              {t(language, 'navScholarships')}
            </a>
            <a href="#alumni" className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              {t(language, 'navAlumni')}
            </a>
            <a href="#pricing" className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              {t(language, 'navPricing')}
            </a>
          </nav>

          <div className="shrink-0 flex items-center gap-2">
            {currentUser ? (
              <>
                <button
                  type="button"
                  onClick={() => onEnterWorkspace()}
                  className="px-3.5 sm:px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                >
                  {t(language, 'openWorkspace')}
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    aria-label="Sign out"
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                {t(language, 'signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="overview">
        {/* Balanced 2-Column Hero Split */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 lg:pt-14 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between py-2">
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
                  Global Admissions · Verified Scholarships · AES-256-GCM Document Vault
                </p>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.15] text-slate-950 dark:text-white [text-wrap:balance]">
                  {t(language, 'heroTitle')}
                </h1>
                <p className="mt-5 text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-xl">
                  {t(language, 'heroSubtitle')}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#universities"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  <span>{t(language, 'explorePrograms')}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace()}
                    className="inline-flex items-center justify-center px-5 py-3 min-h-[44px] text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap"
                  >
                    Open {currentUser.role === 'admin' ? 'Admin Console' : 'Student Dashboard'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenAuth('register')}
                    className="inline-flex items-center justify-center px-5 py-3 min-h-[44px] text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap"
                  >
                    {t(language, 'startFree')}
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-64 sm:h-80 lg:h-full min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-900">
                <img
                  src="/src/assets/images/hero_campus_globe_1795155342431.jpg"
                  alt="International university campus courtyard with students walking at golden hour"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <p className="text-xs text-slate-200">
                    Europe · Asia-Pacific · North America
                  </p>
                  <p className="text-base font-semibold mt-1">
                    Direct applications with GDPR & HIPAA-aligned encrypted transcripts
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column KPI Strip below hero split */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Partner Universities</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {stats.universitiesCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {stats.programsCount} active degree programs
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Verified Scholarships</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {stats.scholarshipsCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                AI profile & financial matching
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Alumni Mentors</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {stats.mentorsCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                1-on-1 scheduled sessions
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Vault Encryption</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                AES-256
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Zero-knowledge client encryption
              </p>
            </div>
          </div>
        </section>

        {/* Historical Performance Metrics & Student Outcomes Trends */}
        <HistoricalTrendsSection
          currentUser={currentUser}
          onOpenAuth={(mode) => onOpenAuth(mode)}
          onEnterWorkspace={() => onEnterWorkspace()}
          onFilterByCountry={(country) => {
            setCountryFilter(country);
            setDegreeFilter('All');
          }}
        />

        {/* Free Overview Banner (Clearly distinguishes Free vs Subscription) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold text-slate-900 dark:text-white">Free Overview Mode:</span>{' '}
              Browse international universities, tuition estimates, visa & living breakdowns, and scholarship deadlines below. Upgrade to Scholar Pro ($14/mo) to submit applications, book 1-on-1 alumni mentorship, unlock Gemini AI agents, and use the AES-256 encrypted vault.
            </div>
            <a
              href="#pricing"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
            >
              Compare Subscription Tiers
            </a>
          </div>
        </section>

        {/* Universities & Programs Explorer */}
        <section id="universities" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                International University Programs ({filteredPrograms.length})
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Filter across {stats.universitiesCount} partner universities by degree level, country, or discipline.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Search universities or programs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search university, field..."
                  className="pl-9 pr-3 py-2 min-h-[40px] text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <select
                aria-label="Filter by country"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="px-3 py-2 min-h-[40px] text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c === 'All' ? 'All Countries' : c}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(['All', 'Bachelor', 'Master', 'PhD'] as const).map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setDegreeFilter(deg)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      degreeFilter === deg
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {deg}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(showAllPrograms || searchQuery.trim() || countryFilter !== 'All' || degreeFilter !== 'All'
              ? filteredPrograms
              : filteredPrograms.slice(0, 12)
            ).map((prog) => {
              const guide = getUniversityGuide(prog);
              return (
                <article
                  key={prog.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedProgram(prog)}
                    className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <div className="h-44 bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <img
                        src={prog.imageUrl}
                        alt={`${prog.university} campus in ${prog.city}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {prog.country} · QS #{prog.qsRank} · {prog.degreeLevel}
                      </p>
                      <h3 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-white">
                        {prog.university}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                        {prog.title}
                      </p>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Tuition / Yr</span>
                          <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                            ${prog.tuitionUsd.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Living Est.</span>
                          <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                            ${guide.living.totalMonthlyUsd.toLocaleString()}/mo
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Deadline</span>
                          <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                            {prog.deadline}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="px-5 pb-5 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProgram(prog)}
                      className="flex-1 py-2.5 px-3 min-h-[44px] text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors"
                    >
                      Varsity Profile, Visa & Costs
                    </button>
                    <button
                      type="button"
                      onClick={() => (currentUser ? onEnterWorkspace() : onOpenAuth('register'))}
                      className="py-2.5 px-3 min-h-[44px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {currentUser ? 'Workspace' : 'Apply'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {!searchQuery.trim() && countryFilter === 'All' && degreeFilter === 'All' && filteredPrograms.length > 12 && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllPrograms((prev) => !prev)}
                className="px-5 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {showAllPrograms
                  ? 'Show Featured 12 Universities'
                  : `View All ${filteredPrograms.length} Partner Universities`}
              </button>
            </div>
          )}
        </section>

        {/* Scholarships Directory Preview */}
        <section id="scholarships" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                International Scholarships & Fellowships
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Sign in to run our AI matching agent against your GPA, financial need, and deadline urgency.
              </p>
            </div>
            <button
              type="button"
              onClick={() => (currentUser ? onEnterWorkspace() : onOpenAuth('login'))}
              className="px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Run AI Scholarship Match
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">Scholarship</th>
                  <th className="py-3 px-4 font-medium">Country</th>
                  <th className="py-3 px-4 font-medium">Coverage</th>
                  <th className="py-3 px-4 font-medium text-right">Est. Value</th>
                  <th className="py-3 px-4 font-medium text-right">Min GPA</th>
                  <th className="py-3 px-4 font-medium text-right">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {scholarships.map((sch) => (
                  <tr key={sch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                      {sch.name}
                      <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                        {sch.provider}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{sch.country}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{sch.coverage}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                      ${sch.amountUsd.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {sch.minGpa.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {sch.deadline}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Alumni Mentorship Showcase */}
        <section id="alumni" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-200 dark:border-slate-800">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              University Alumni Mentors
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Connect directly with graduates across target universities and schedule 1-on-1 mentorship calls.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {alumni.map((mentor) => (
              <article
                key={mentor.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3.5">
                    <img
                      src={mentor.avatarUrl}
                      alt={`${mentor.name}, ${mentor.university} alumnus`}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {mentor.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {mentor.university} · Class of {mentor.graduationYear}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-medium text-blue-600 dark:text-blue-400">
                    {mentor.currentRole} at {mentor.company}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {mentor.bio}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {mentor.availableSlots.length} open slots
                  </span>
                  <button
                    type="button"
                    onClick={() => (currentUser ? onEnterWorkspace() : onOpenAuth('login'))}
                    className="px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  >
                    Schedule 1-on-1
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Tiered Pricing Model */}
        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-2xl mb-8">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Transparent Student Subscription Tiers
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Explore the portal free of charge, or subscribe for ad-free research, personalized AI scholarship agents, and encrypted document workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  For exploring international options
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Explorer Free</h3>
                <p className="mt-3 text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  $0<span className="text-xs font-sans font-normal text-slate-500"> / month</span>
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <li>Full university & scholarship directory overview</li>
                  <li>Living, visa & airfare calculator + checklist</li>
                  <li>Limited algorithmic eligibility preview (top 3 matches)</li>
                  <li>Subscription required to apply, use AI, or vault</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => (currentUser ? onEnterWorkspace() : onOpenAuth('register'))}
                className="mt-6 w-full py-2.5 px-4 min-h-[44px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Start Free
              </button>
            </div>

            <div className="rounded-xl border-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  For active international applicants
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Scholar Pro</h3>
                <p className="mt-3 text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  $14<span className="text-xs font-sans font-normal text-slate-500"> / month</span>
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <li>Direct university applications & live tracking</li>
                  <li>Unlimited AI scholarship & career agents</li>
                  <li>AES-256-GCM encrypted transcript & SOP vault</li>
                  <li>1-on-1 alumni booking, AI & moderator chat</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() =>
                  currentUser
                    ? onEnterWorkspace('billing', 'pro')
                    : onOpenAuth('register', 'pro')
                }
                className="mt-6 w-full py-2.5 px-4 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {currentUser?.subscriptionTier === 'pro' ? 'Active Plan (Scholar Pro)' : 'Choose Scholar Pro'}
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  For multi-country fellowship candidates
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Global Fellowship</h3>
                <p className="mt-3 text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  $29<span className="text-xs font-sans font-normal text-slate-500"> / month</span>
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <li>All Scholar Pro benefits included</li>
                  <li>Application fee waivers on partner programs</li>
                  <li>Priority 1-on-1 alumni mentorship scheduling</li>
                  <li>Dedicated compliance & transcript verification</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() =>
                  currentUser
                    ? onEnterWorkspace('billing', 'fellowship')
                    : onOpenAuth('register', 'fellowship')
                }
                className="mt-6 w-full py-2.5 px-4 min-h-[44px] text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              >
                {currentUser?.subscriptionTier === 'fellowship'
                  ? 'Active Plan (Global Fellowship)'
                  : 'Choose Global Fellowship'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer with Accessibility, Language, Dark Mode, and Admin Sign-In link */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
              StudyGlobe — Abroad Study Portal
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> GDPR & HIPAA Compliant
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> AES-256-GCM E2EE
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onOpenAuth('admin')}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Administrator Login
              </button>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <Globe className="w-3.5 h-3.5" />
              <span className="sr-only">Language</span>
              <select
                aria-label="Select portal language"
                value={language}
                onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                {(Object.keys(LANGUAGE_LABELS) as LanguageCode[]).map((code) => (
                  <option key={code} value={code}>
                    {LANGUAGE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label="Toggle dark mode"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleHighContrast}
              aria-pressed={highContrast}
              className="px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {highContrast ? 'Standard Contrast' : 'High Contrast'}
            </button>

            <button
              type="button"
              onClick={() => onChangeFontScale(fontScale >= 1.15 ? 1 : 1.15)}
              className="px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Text Size: {fontScale >= 1.15 ? 'Large' : 'Default'}
            </button>
          </div>
        </div>
      </footer>

      {selectedProgram && (
        <UniversityProfileModal
          program={selectedProgram}
          user={currentUser}
          checkedSteps={
            currentUser?.journeyChecklists?.[selectedProgram.id] ??
            guestChecklists[selectedProgram.id] ??
            []
          }
          onToggleStep={handleToggleGuestStep}
          onClose={() => setSelectedProgram(null)}
          onApplyDirect={() => {
            setSelectedProgram(null);
            onEnterWorkspace();
          }}
          onUpgradeRequired={() => {
            setSelectedProgram(null);
            onEnterWorkspace();
          }}
          onRequestAuth={() => {
            setSelectedProgram(null);
            onOpenAuth('register');
          }}
        />
      )}
    </div>
  );
};
