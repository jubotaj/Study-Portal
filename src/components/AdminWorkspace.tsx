import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Building2,
  Download,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sliders,
  Sun,
  Users,
} from 'lucide-react';
import type {
  Application,
  ApplicationStatus,
  EncryptedDocument,
  Program,
  PublicUser,
  Scholarship,
  SiteCustomization,
  SupportMessage,
  SystemPerformanceReport,
  UserFeedback,
} from '../types.ts';
import { safeReadJson } from '../utils/http.ts';

type AdminTab = 'overview' | 'programs' | 'students' | 'messages' | 'performance';

interface AdminWorkspaceProps {
  token: string;
  adminUser: PublicUser;
  programs: Program[];
  scholarships: Scholarship[];
  onRefreshPublic: () => Promise<void>;
  onBackToPublic: () => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  token,
  adminUser,
  programs,
  scholarships,
  onRefreshPublic,
  onBackToPublic,
  onLogout,
  darkMode,
  onToggleDarkMode,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [students, setStudents] = useState<PublicUser[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [documents, setDocuments] = useState<EncryptedDocument[]>([]);
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [customizations, setCustomizations] = useState<SiteCustomization[]>([]);
  const [performance, setPerformance] = useState<SystemPerformanceReport | null>(null);

  const [toast, setToast] = useState('');
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // AI Autopilot state
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [aiRecs, setAiRecs] = useState<{ title: string; impact: string; action: string }[]>([]);
  const [focusRegion, setFocusRegion] = useState('Europe or Asia-Pacific');

  // Enroll Program form
  const [progForm, setProgForm] = useState({
    university: '',
    country: '',
    city: '',
    title: '',
    degreeLevel: 'Master',
    field: 'Computer Science & AI',
    tuitionUsd: 12000,
    deadline: '2027-02-15',
    qsRank: 45,
    applicationFeeUsd: 75,
  });

  // Add Scholarship form
  const [schForm, setSchForm] = useState({
    name: '',
    provider: '',
    country: '',
    coverage: 'Full tuition + living stipend',
    amountUsd: 22000,
    deadline: '2027-01-30',
    minGpa: 3.5,
  });

  // Moderator reply state
  const [replyTargetStudentId, setReplyTargetStudentId] = useState('');
  const [replyContent, setReplyContent] = useState('');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

  const loadAdminOverview = async () => {
    setLoadingAdmin(true);
    try {
      const res = await fetch('/api/admin/overview', { headers: authHeaders });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to load admin overview');
      setStudents(data.students);
      setApplications(data.applications);
      setMessages(data.messages);
      setDocuments(data.documents);
      setFeedbacks(data.feedbacks);
      setCustomizations(data.customizations);
      setPerformance(data.performance);
      if (!replyTargetStudentId && data.students.length > 0) {
        setReplyTargetStudentId(data.students[0].id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Admin load error');
    } finally {
      setLoadingAdmin(false);
    }
  };

  useEffect(() => {
    loadAdminOverview();
  }, []);

  const runAutopilot = async (
    action: 'enrich_catalog' | 'auto_reply' | 'customize_from_feedback' | 'system_audit',
  ) => {
    setAiBusy(action);
    setAiSummary('');
    try {
      const res = await fetch('/api/ai/admin-autopilot', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action, focusRegion }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Autopilot failed');
      setAiSummary(data.summary);
      if (data.recommendations) setAiRecs(data.recommendations);
      await loadAdminOverview();
      await onRefreshPublic();
      showToast(data.summary);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI Autopilot error');
    } finally {
      setAiBusy(null);
    }
  };

  const handleEnrollProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/programs', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(progForm),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to enroll program');
      setProgForm({ ...progForm, university: '', country: '', city: '', title: '' });
      await onRefreshPublic();
      await loadAdminOverview();
      showToast(`Enrolled ${data.program.university} — ${data.program.title}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleAddScholarship = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/scholarships', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(schForm),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to add scholarship');
      setSchForm({ ...schForm, name: '', provider: '', country: '' });
      await onRefreshPublic();
      showToast(`Added scholarship ${data.scholarship.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleToggleBlockStudent = async (student: PublicUser) => {
    try {
      const res = await fetch(`/api/admin/students/${student.id}/block`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ blocked: !student.blocked }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || 'Update failed');
      await loadAdminOverview();
      showToast(`${data.student.name} has been ${data.student.blocked ? 'blocked' : 'unblocked'}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleUpdateApplicationStatus = async (appId: string, status: ApplicationStatus) => {
    try {
      const res = await fetch(`/api/admin/applications/${appId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Update failed');
      await loadAdminOverview();
      showToast(`Application updated to ${status}. Student notified via email & push.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleApproveDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/admin/documents/${docId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ processingStatus: 'Approved' }),
      });
      if (!res.ok) throw new Error('Failed');
      await loadAdminOverview();
      showToast('Document compliance status updated to Approved.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !replyTargetStudentId) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ studentId: replyTargetStudentId, content: replyContent }),
      });
      if (!res.ok) throw new Error('Failed to send reply');
      setReplyContent('');
      await loadAdminOverview();
      showToast('Reply sent and emailed to student.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleToggleCustomization = async (cust: SiteCustomization) => {
    try {
      const res = await fetch(`/api/admin/customizations/${cust.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ enabled: !cust.enabled }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      await loadAdminOverview();
      await onRefreshPublic();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDownloadAuditReport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch('/api/admin/audit-report', { headers: authHeaders });
      const report = await res.json();
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studyglobe-monthly-audit-${report.reportingPeriod}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const rows = [
          ['Timestamp', 'Actor', 'Role', 'Regulation', 'Action', 'Details'].join(','),
          ...report.auditTrail.map((l: any) =>
            [l.timestamp, l.actorEmail, l.actorRole, l.regulation, l.action, `"${String(l.details).replace(/"/g, '""')}"`].join(','),
          ),
        ];
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studyglobe-monthly-audit-${report.reportingPeriod}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      showToast(`Monthly compliance audit report (${format.toUpperCase()}) downloaded.`);
    } catch {
      showToast('Failed to export audit report.');
    }
  };

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'AI Autopilot', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'programs', label: 'Programs & Aid', icon: <Building2 className="w-4 h-4" /> },
    { id: 'students', label: 'Students & Docs', icon: <Users className="w-4 h-4" /> },
    { id: 'messages', label: 'Inquiries & UX', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'performance', label: 'Audit & Health', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
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
          <span className="text-xs font-mono text-blue-600 dark:text-blue-400">ADMIN</span>
        </div>

        <nav aria-label="Administrator navigation" className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="text-xs">
            <p className="font-semibold text-slate-900 dark:text-white truncate">{adminUser.name}</p>
            <p className="text-slate-500 dark:text-slate-400 truncate">MFA Protected Admin</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen pb-20 md:pb-0">
        <header className="sticky top-0 z-30 h-14 px-3 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
            <button
              type="button"
              onClick={onBackToPublic}
              className="md:hidden font-display font-bold text-slate-900 dark:text-white truncate"
            >
              StudyGlobe Admin
            </button>
            <span className="hidden md:inline text-slate-400">Administrator Console</span>
            <span className="hidden md:inline text-slate-400">/</span>
            <span className="hidden sm:inline font-semibold text-slate-900 dark:text-white truncate">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={loadAdminOverview}
              disabled={loadingAdmin}
              aria-label="Refresh admin data"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAdmin ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label="Toggle dark mode"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign Out"
              className="md:hidden inline-flex items-center justify-center gap-1.5 min-h-[36px] min-w-[36px] px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {toast && (
          <div role="status" aria-live="polite" className="mx-4 sm:mx-6 mt-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5 text-xs font-medium text-blue-800 dark:text-blue-200">
            {toast}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
          {/* OVERVIEW & AI AUTOPILOT TAB */}
          {activeTab === 'overview' && (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Portal Command & Autonomous AI Operations
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Monitor platform health, trigger AI data curation, reply to students, and evolve UX from live feedback.
                </p>
              </div>

              {performance && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Active Students</p>
                    <p className="text-2xl font-bold font-mono tabular-nums mt-1">{performance.activeStudents}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{performance.blockedStudents} blocked</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Applications</p>
                    <p className="text-2xl font-bold font-mono tabular-nums mt-1">{performance.totalApplications}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{programs.length} programs active</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Encrypted Docs</p>
                    <p className="text-2xl font-bold font-mono tabular-nums mt-1">{performance.encryptedDocumentsCount}</p>
                    <p className="text-xs text-slate-500 mt-0.5">AES-256-GCM vault</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">SLA & Avg Latency</p>
                    <p className="text-2xl font-bold font-mono tabular-nums mt-1">{performance.uptimeSlaPercent}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">{performance.avgApiLatencyMs} ms API avg</p>
                  </div>
                </div>
              )}

              {/* Autonomous AI Bot Control Center */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span>StudyGlobe Autonomous AI Bot</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Run AI operations to populate real-life university data, reply to student inquiries, add customization options from feedback, or audit performance.
                    </p>
                  </div>
                  <input
                    type="text"
                    aria-label="Target region for AI data enrichment"
                    value={focusRegion}
                    onChange={(e) => setFocusRegion(e.target.value)}
                    placeholder="Target region (e.g., Nordic Europe)"
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    type="button"
                    disabled={aiBusy !== null}
                    onClick={() => runAutopilot('enrich_catalog')}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-left transition-colors disabled:opacity-50"
                  >
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">01. Data Curation</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                      {aiBusy === 'enrich_catalog' ? 'Generating Data...' : 'Add Real-Life Program & Aid'}
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={aiBusy !== null}
                    onClick={() => runAutopilot('auto_reply')}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-left transition-colors disabled:opacity-50"
                  >
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">02. Support Automation</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                      {aiBusy === 'auto_reply' ? 'Replying...' : 'Auto-Reply Pending Inquiries'}
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={aiBusy !== null}
                    onClick={() => runAutopilot('customize_from_feedback')}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-left transition-colors disabled:opacity-50"
                  >
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">03. UX Evolution</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                      {aiBusy === 'customize_from_feedback' ? 'Analyzing...' : 'Customize Site from Feedback'}
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={aiBusy !== null}
                    onClick={() => runAutopilot('system_audit')}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-left transition-colors disabled:opacity-50"
                  >
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">04. Proactive Ops</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                      {aiBusy === 'system_audit' ? 'Auditing...' : 'Suggest Performance Fixes'}
                    </p>
                  </button>
                </div>

                {aiSummary && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm space-y-3">
                    <p className="font-medium text-slate-900 dark:text-white">{aiSummary}</p>
                    {aiRecs.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                        {aiRecs.map((rec, i) => (
                          <div key={i} className="text-xs space-y-1">
                            <p className="font-semibold text-slate-900 dark:text-white">{rec.title}</p>
                            <p className="text-slate-500 dark:text-slate-400">Impact: {rec.impact}</p>
                            <p className="text-slate-600 dark:text-slate-300">{rec.action}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {/* PROGRAMS & SCHOLARSHIPS MANAGER TAB */}
          {activeTab === 'programs' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                Enroll Programs & Scholarships
              </h1>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form
                  onSubmit={handleEnrollProgram}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>Enroll New University Program</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="University Name"
                      value={progForm.university}
                      onChange={(e) => setProgForm({ ...progForm, university: e.target.value })}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Country"
                      value={progForm.country}
                      onChange={(e) => setProgForm({ ...progForm, country: e.target.value })}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Degree Title (e.g., MSc Robotics)"
                      value={progForm.title}
                      onChange={(e) => setProgForm({ ...progForm, title: e.target.value })}
                      className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                    <select
                      value={progForm.degreeLevel}
                      onChange={(e) => setProgForm({ ...progForm, degreeLevel: e.target.value })}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    >
                      <option value="Bachelor">Bachelor</option>
                      <option value="Master">Master</option>
                      <option value="PhD">PhD</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Annual Tuition USD"
                      value={progForm.tuitionUsd}
                      onChange={(e) => setProgForm({ ...progForm, tuitionUsd: Number(e.target.value) })}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Publish Program
                  </button>
                </form>

                <form
                  onSubmit={handleAddScholarship}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>Insert Scholarship Record</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Scholarship Name"
                      value={schForm.name}
                      onChange={(e) => setSchForm({ ...schForm, name: e.target.value })}
                      className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Provider"
                      value={schForm.provider}
                      onChange={(e) => setSchForm({ ...schForm, provider: e.target.value })}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Country"
                      value={schForm.country}
                      onChange={(e) => setSchForm({ ...schForm, country: e.target.value })}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Award USD"
                      value={schForm.amountUsd}
                      onChange={(e) => setSchForm({ ...schForm, amountUsd: Number(e.target.value) })}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Deadline YYYY-MM-DD"
                      value={schForm.deadline}
                      onChange={(e) => setSchForm({ ...schForm, deadline: e.target.value })}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white"
                  >
                    Add Scholarship
                  </button>
                </form>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <th className="py-3 px-4">University</th>
                      <th className="py-3 px-4">Program</th>
                      <th className="py-3 px-4">Country</th>
                      <th className="py-3 px-4 text-right">Tuition</th>
                      <th className="py-3 px-4 text-right">Curated By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {programs.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 px-4 font-medium">{p.university}</td>
                        <td className="py-3 px-4">{p.title}</td>
                        <td className="py-3 px-4 text-slate-500">{p.country}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">${p.tuitionUsd.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-xs font-mono">
                          {p.addedBy === 'ai-bot' ? 'AI Bot' : 'Admin'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Total active scholarships in catalog: {scholarships.length}</p>
            </div>
          )}

          {/* STUDENTS, APPLICATIONS & ENCRYPTED DOCUMENTS TAB */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                Student Access Control, Applications & Encrypted Vault Compliance
              </h1>

              {/* Student Blocking Table */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
                  Registered International Students
                </div>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Tier</th>
                      <th className="py-3 px-4">Target</th>
                      <th className="py-3 px-4">Account Status</th>
                      <th className="py-3 px-4 text-right">Moderation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {students.map((st) => (
                      <tr key={st.id}>
                        <td className="py-3 px-4">
                          <p className="font-medium">{st.name}</p>
                          <p className="text-xs text-slate-500">{st.email}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{st.subscriptionTier.toUpperCase()}</td>
                        <td className="py-3 px-4 text-xs">
                          {st.academicProfile.degreeTarget} · {st.academicProfile.field}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium">
                          {st.blocked ? (
                            <span className="text-red-600 dark:text-red-400">Blocked</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleBlockStudent(st)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                              st.blocked
                                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300'
                                : 'border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                            }`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>{st.blocked ? 'Unblock' : 'Block Student'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* Applications Review */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
                  Student Applications Status Control
                </div>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <th className="py-3 px-4">Applicant</th>
                      <th className="py-3 px-4">University & Program</th>
                      <th className="py-3 px-4">Current Status</th>
                      <th className="py-3 px-4 text-right">Update Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {applications.map((app) => (
                      <tr key={app.id}>
                        <td className="py-3 px-4 font-medium">{app.studentName}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{app.university}</p>
                          <p className="text-xs text-slate-500">{app.programTitle}</p>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {app.status}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <select
                            aria-label={`Update status for ${app.studentName}`}
                            value={app.status}
                            onChange={(e) =>
                              handleUpdateApplicationStatus(app.id, e.target.value as ApplicationStatus)
                            }
                            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                          >
                            <option value="Draft">Draft</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Interview">Interview</option>
                            <option value="Accepted">Accepted</option>
                            <option value="Waitlisted">Waitlisted</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* E2EE Document Analytics */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-blue-600" />
                  <span>Encrypted Document Processing Metadata (Zero-Plaintext View)</span>
                </h2>
                {documents.length === 0 ? (
                  <p className="text-xs text-slate-500">No encrypted documents uploaded by students yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {documents.map((doc) => (
                      <div key={doc.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                        <div>
                          <p className="font-medium text-sm">
                            {doc.studentName} · {doc.docType} ({doc.fileName})
                          </p>
                          <p className="font-mono text-slate-500">
                            {doc.algorithm} · SHA-256: {doc.sha256Fingerprint} · {doc.processingStatus}
                          </p>
                        </div>
                        {doc.processingStatus !== 'Approved' && (
                          <button
                            type="button"
                            onClick={() => handleApproveDoc(doc.id)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                          >
                            Mark Approved
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* INQUIRIES & AI CUSTOMIZATIONS TAB */}
          {activeTab === 'messages' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                Student Inquiries & Site Customization Controls
              </h1>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                  <h2 className="text-sm font-semibold">Student Support Desk</h2>
                  <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                    {messages.map((m) => (
                      <div key={m.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs">
                        <p className="text-slate-500 dark:text-slate-400">
                          {m.senderName} ({m.senderRole}) · For {m.studentName}
                        </p>
                        <p className="text-sm text-slate-900 dark:text-white mt-1">{m.content}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendAdminReply} className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <select
                      value={replyTargetStudentId}
                      onChange={(e) => setReplyTargetStudentId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    >
                      {students.map((st) => (
                        <option key={st.id} value={st.id}>
                          Reply to {st.name} ({st.email})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write moderator response..."
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Reply</span>
                      </button>
                    </div>
                  </form>
                </section>

                <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span>Site Customization Toggles & User Feedback</span>
                  </h2>
                  <div className="space-y-2.5">
                    {customizations.map((c) => (
                      <div key={c.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div>
                          <p className="text-sm font-medium">{c.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
                          <p className="text-[11px] font-mono text-slate-400 mt-1">
                            Suggested by: {c.suggestedBy}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleCustomization(c)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 ${
                            c.enabled
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {c.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Recent Student Feedback</p>
                    {feedbacks.map((fb) => (
                      <div key={fb.id} className="text-xs text-slate-600 dark:text-slate-300">
                        <strong>{fb.userName}</strong> ({fb.category} · {fb.status}): {fb.message}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* SYSTEM PERFORMANCE & MONTHLY AUDIT REPORTS TAB */}
          {activeTab === 'performance' && performance && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    System Performance, Compliance & Monthly Audit Reports
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    GDPR, HIPAA, and Multi-Factor Security telemetry with automated monthly report export.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadAuditReport('json')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Audit JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadAuditReport('csv')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500">Node Process Uptime</p>
                  <p className="text-xl font-bold font-mono tabular-nums mt-1">{performance.uptimeSeconds}s</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500">Memory RSS / Heap</p>
                  <p className="text-xl font-bold font-mono tabular-nums mt-1">
                    {performance.memoryRssMb} / {performance.memoryHeapUsedMb} MB
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500">Total Requests Served</p>
                  <p className="text-xl font-bold font-mono tabular-nums mt-1">{performance.totalRequests}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs text-slate-500">Compliance Frameworks</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                    GDPR · HIPAA · MFA Active
                  </p>
                </div>
              </div>

              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
                  Live Security & Compliance Audit Log
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Actor</th>
                      <th className="py-2.5 px-4">Regulation</th>
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {performance.recentAuditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-4 font-mono whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4">{log.actorEmail}</td>
                        <td className="py-2.5 px-4 font-mono">{log.regulation}</td>
                        <td className="py-2.5 px-4 font-mono">{log.action}</td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav
        aria-label="Mobile admin navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center"
      >
        {navItems.map((item) => (
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
            <span className="mt-0.5 truncate max-w-[64px]">{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
