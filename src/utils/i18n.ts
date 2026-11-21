import type { LanguageCode } from '../types.ts';

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  bn: 'বাংলা',
};

type TranslationKeys = {
  navOverview: string;
  navUniversities: string;
  navScholarships: string;
  navAlumni: string;
  navPricing: string;
  signIn: string;
  openWorkspace: string;
  heroTitle: string;
  heroSubtitle: string;
  explorePrograms: string;
  startFree: string;
  tabOverview: string;
  tabPrograms: string;
  tabScholarships: string;
  tabAlumni: string;
  tabApplications: string;
  tabVault: string;
  tabMessages: string;
  tabBilling: string;
  offlineBanner: string;
  syncNow: string;
};

const DICTIONARY: Record<LanguageCode, TranslationKeys> = {
  en: {
    navOverview: 'Overview',
    navUniversities: 'Universities',
    navScholarships: 'Scholarships',
    navAlumni: 'Alumni',
    navPricing: 'Pricing',
    signIn: 'Sign In',
    openWorkspace: 'Workspace',
    heroTitle: 'International admissions, scholarships, and alumni mentorship in one encrypted portal.',
    heroSubtitle:
      'Compare global degree programs for free, or unlock AI-matched scholarships, automated career guidance, 1-on-1 alumni mentorship, and AES-256 encrypted document storage.',
    explorePrograms: 'Explore Programs',
    startFree: 'Create Student Account',
    tabOverview: 'Dashboard',
    tabPrograms: 'Programs',
    tabScholarships: 'AI Match',
    tabAlumni: 'Alumni',
    tabApplications: 'Applications',
    tabVault: 'E2EE Vault',
    tabMessages: 'Advisor Chat',
    tabBilling: 'Subscription',
    offlineBanner: 'Offline mode active — cached catalog available; new actions queued for cloud sync.',
    syncNow: 'Cloud Sync',
  },
  es: {
    navOverview: 'Resumen',
    navUniversities: 'Universidades',
    navScholarships: 'Becas',
    navAlumni: 'Exalumnos',
    navPricing: 'Planes',
    signIn: 'Iniciar Sesión',
    openWorkspace: 'Mi Panel',
    heroTitle: 'Admisiones internacionales, becas y mentoría de exalumnos en un portal cifrado.',
    heroSubtitle:
      'Explora programas globales gratis o desbloquea becas con IA, orientación profesional, mentoría 1-a-1 y bóveda de documentos cifrada AES-256.',
    explorePrograms: 'Explorar Programas',
    startFree: 'Crear Cuenta',
    tabOverview: 'Panel',
    tabPrograms: 'Programas',
    tabScholarships: 'Becas IA',
    tabAlumni: 'Exalumnos',
    tabApplications: 'Solicitudes',
    tabVault: 'Bóveda E2EE',
    tabMessages: 'Asesoría',
    tabBilling: 'Suscripción',
    offlineBanner: 'Modo sin conexión activo — catálogo en caché disponible; acciones en cola.',
    syncNow: 'Sincronizar',
  },
  fr: {
    navOverview: 'Aperçu',
    navUniversities: 'Universités',
    navScholarships: 'Bourses',
    navAlumni: 'Anciens',
    navPricing: 'Tarifs',
    signIn: 'Connexion',
    openWorkspace: 'Espace',
    heroTitle: 'Admissions internationales, bourses et mentorat des anciens dans un portail chiffré.',
    heroSubtitle:
      'Comparez les cursus mondiaux gratuitement ou activez le matching IA de bourses, l’orientation carrière et le coffre-fort chiffré AES-256.',
    explorePrograms: 'Voir les Programmes',
    startFree: 'Créer un Compte',
    tabOverview: 'Tableau',
    tabPrograms: 'Programmes',
    tabScholarships: 'Bourses IA',
    tabAlumni: 'Mentors',
    tabApplications: 'Dossiers',
    tabVault: 'Coffre E2EE',
    tabMessages: 'Messagerie',
    tabBilling: 'Abonnement',
    offlineBanner: 'Mode hors ligne actif — catalogue en cache disponible; synchronisation en attente.',
    syncNow: 'Synchroniser',
  },
  de: {
    navOverview: 'Überblick',
    navUniversities: 'Universitäten',
    navScholarships: 'Stipendien',
    navAlumni: 'Alumni',
    navPricing: 'Preise',
    signIn: 'Anmelden',
    openWorkspace: 'Arbeitsbereich',
    heroTitle: 'Internationale Zulassungen, Stipendien und Alumni-Mentoring in einem verschlüsselten Portal.',
    heroSubtitle:
      'Vergleichen Sie weltweite Studiengänge kostenlos oder nutzen Sie KI-Stipendienabgleich, Karriereberatung und AES-256-Dokumentenspeicher.',
    explorePrograms: 'Programme ansehen',
    startFree: 'Konto erstellen',
    tabOverview: 'Übersicht',
    tabPrograms: 'Programme',
    tabScholarships: 'KI-Match',
    tabAlumni: 'Alumni',
    tabApplications: 'Bewerbungen',
    tabVault: 'E2EE-Tresor',
    tabMessages: 'Beratung',
    tabBilling: 'Abo',
    offlineBanner: 'Offline-Modus aktiv — zwischengespeicherte Daten verfügbar; Änderungen vorgemerkt.',
    syncNow: 'Cloud-Sync',
  },
  ja: {
    navOverview: '概要',
    navUniversities: '大学一覧',
    navScholarships: '奨学金',
    navAlumni: '卒業生',
    navPricing: '料金プラン',
    signIn: 'ログイン',
    openWorkspace: 'マイページ',
    heroTitle: '海外大学出願、AI奨学金マッチング、卒業生メンターを暗号化ポータルで統合管理。',
    heroSubtitle:
      '世界中の学位プログラムを無料で比較。AI奨学金分析、キャリア指導、1対1の卒業生相談、AES-256暗号化書類保管を利用できます。',
    explorePrograms: 'プログラムを見る',
    startFree: '学生登録',
    tabOverview: 'ホーム',
    tabPrograms: '大学検索',
    tabScholarships: 'AI奨学金',
    tabAlumni: '卒業生',
    tabApplications: '出願状況',
    tabVault: '暗号保管',
    tabMessages: '相談窓口',
    tabBilling: 'プラン',
    offlineBanner: 'オフラインモード中 — キャッシュデータを表示中。接続回復後に自動同期されます。',
    syncNow: '同期する',
  },
  bn: {
    navOverview: 'সারসংক্ষেপ',
    navUniversities: 'বিশ্ববিদ্যালয়',
    navScholarships: 'বৃত্তি',
    navAlumni: 'প্রাক্তন শিক্ষার্থী',
    navPricing: 'সাবস্ক্রিপশন',
    signIn: 'লগইন',
    openWorkspace: 'ড্যাশবোর্ড',
    heroTitle: 'আন্তর্জাতিক ভর্তি, এআই বৃত্তি ম্যাচিং এবং অ্যালামনাই মেন্টরশিপ একটি সুরক্ষিত পোর্টালে।',
    heroSubtitle:
      'বিনামূল্যে বিশ্বব্যাপী প্রোগ্রাম দেখুন অথবা এআই বৃত্তি পরামর্শ, ক্যারিয়ার গাইডেন্স এবং AES-256 এনক্রিপ্টেড ডকুমেন্ট ভল্ট ব্যবহার করুন।',
    explorePrograms: 'প্রোগ্রাম দেখুন',
    startFree: 'অ্যাকাউন্ট খুলুন',
    tabOverview: 'ড্যাশবোর্ড',
    tabPrograms: 'প্রোগ্রাম',
    tabScholarships: 'এআই ম্যাচ',
    tabAlumni: 'অ্যালামনাই',
    tabApplications: 'আবেদন',
    tabVault: 'ভল্ট',
    tabMessages: 'সহায়তা চ্যাট',
    tabBilling: 'প্ল্যান',
    offlineBanner: 'অফলাইন মোড চালু — সংরক্ষিত তথ্য দেখা যাচ্ছে; অনলাইন হলে সিঙ্ক হবে।',
    syncNow: 'ক্লাউড সিঙ্ক',
  },
};

export function t(lang: LanguageCode, key: keyof TranslationKeys): string {
  return DICTIONARY[lang]?.[key] ?? DICTIONARY.en[key];
}
