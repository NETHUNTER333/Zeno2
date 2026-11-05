/**
 * Central Legal, Trust & Safety Configuration for Kinich
 * Every legal policy page (/terms, /privacy, /refund, /contact, /acceptable-use, /cookies, /legal),
 * server prerenderer, footer, and product enforcement module imports from this single source of truth.
 */

export const LEGAL_CONFIG = {
  OPERATOR_NAME: 'Kinich',
  TRADE_NAME: 'Kinich',
  LIVE_SITE_URL: 'https://kinich.app',
  ADDRESS: 'Operated online from India',
  GOVERNING_COURTS: 'Hyderabad, Telangana, India',
  SUPPORT_EMAIL: 'kinich.app@kinich.app',
  PRIVACY_EMAIL: 'kinich.app@kinich.app',
  GRIEVANCE_EMAIL: 'kinich.app@kinich.app',
  ABUSE_EMAIL: 'kinich.app@kinich.app',
  COPYRIGHT_EMAIL: 'kinich.app@kinich.app',
  GRIEVANCE_OFFICER_NAME: 'Kinich Grievance Officer',
  EFFECTIVE_DATE: 'November 1, 2026',
  EFFECTIVE_DATE_ISO: '2026-11-01',
  PRICE: '$3/month (Spark) · $7/month (Fire)',
  SPARK_PRICE_MONTHLY: '$3/month',
  SPARK_PRICE_ANNUAL: '$29/year',
  SPARK_MONTHLY_PRICE_USD: 3,
  SPARK_YEARLY_PRICE_USD: 29,
  SPARK_YEARLY_MONTHLY_EQUIV_USD: '2.42',
  FIRE_PRICE_MONTHLY: '$7/month',
  FIRE_PRICE_ANNUAL: '$67/year',
  FIRE_MONTHLY_PRICE_USD: 7,
  FIRE_YEARLY_PRICE_USD: 67,
  FIRE_YEARLY_MONTHLY_EQUIV_USD: '5.58',
  REFUND_WINDOW_DAYS: 7,
  RENEWAL_REFUND_HOURS: 48,
  OUTAGE_REFUND_HOURS: 72,
  MIN_AGE: 18,
  MIN_AGE_WITH_PARENTAL_CONSENT: 18,
  CONSENT_VERSION: '2026.11.02',
  LEGAL_REVIEW_STATUS: 'active policy',
  LIABILITY_CAP_INR: 'INR 1,000',
  LIABILITY_CAP_USD: 'USD 10',
  INFORMAL_RESOLUTION_DAYS: 30,
  GRIEVANCE_ACK_HOURS: 24,
  GRIEVANCE_RESOLUTION_DAYS: 30,
  DATA_RIGHTS_RESPONSE_DAYS: 30,
  ACCOUNT_DELETION_PURGE_DAYS: 30,
  GUEST_RETENTION_DAYS: 30,
  SERVER_LOG_RETENTION_DAYS: 90,
  REFERRAL_ATTRIBUTION_DAYS: 30,
  TELE_MANAS_HELPLINE: '14416 / 1800-891-4416',
  INTERNATIONAL_HELPLINE_URL: 'https://findahelpline.com',
  CONSENT_STORAGE_KEY: 'kinich_consent_version_v1',
  CONSENT_TIMESTAMP_KEY: 'kinich_consent_timestamp_v1',
  COOKIE_CONSENT_KEY: 'kinich_cookie_consent_v1',
} as const;

export const OPERATOR_NAME = LEGAL_CONFIG.OPERATOR_NAME;
export const TRADE_NAME = LEGAL_CONFIG.TRADE_NAME;
export const ADDRESS = LEGAL_CONFIG.ADDRESS;
export const SUPPORT_EMAIL = LEGAL_CONFIG.SUPPORT_EMAIL;
export const PRIVACY_EMAIL = LEGAL_CONFIG.PRIVACY_EMAIL;
export const GRIEVANCE_EMAIL = LEGAL_CONFIG.GRIEVANCE_EMAIL;
export const GRIEVANCE_OFFICER_NAME = LEGAL_CONFIG.GRIEVANCE_OFFICER_NAME;
export const EFFECTIVE_DATE = LEGAL_CONFIG.EFFECTIVE_DATE;
export const PRICE = LEGAL_CONFIG.PRICE;
export const REFUND_WINDOW_DAYS = LEGAL_CONFIG.REFUND_WINDOW_DAYS;
export const MIN_AGE = LEGAL_CONFIG.MIN_AGE;
export const CONSENT_VERSION = LEGAL_CONFIG.CONSENT_VERSION;

export interface SubprocessorEntry {
  name: string;
  category: string;
  purpose: string;
  dataShared: string;
  location: string;
  privacyPolicyUrl: string;
}

export const THIRD_PARTY_SERVICES_AUDIT: SubprocessorEntry[] = [
  {
    name: 'Google Firebase (Authentication & Cloud Firestore)',
    category: 'Authentication & Cloud Database',
    purpose: 'Email/password and Google OAuth sign-in, encrypted storage of conversation threads, Knowledge Vault notes, bookmarks, consent records, and daily quota counters.',
    dataShared: 'User UID, email address, display name, profile photo URL, saved threads, vault items, and quota state.',
    location: 'United States / Multi-region Google Cloud',
    privacyPolicyUrl: 'https://firebase.google.com/support/privacy',
  },
  {
    name: 'Vercel Inc.',
    category: 'Frontend Hosting, Edge CDN & Web Analytics',
    purpose: 'Static asset delivery, TLS termination, edge routing, and aggregate non-identifying performance telemetry (@vercel/analytics).',
    dataShared: 'IP address, HTTP request headers, browser user-agent, and page route metrics.',
    location: 'Global Edge Network (United States HQ)',
    privacyPolicyUrl: 'https://vercel.com/legal/privacy-policy',
  },
  {
    name: 'InstaCloud Compute Edge (kinich-api)',
    category: 'Backend API & Multi-Agent Compute Runtime',
    purpose: 'API request routing, rate limiting, search synthesis, transcript processing, and content safety moderation.',
    dataShared: 'API payloads, search queries, attachment buffers (transiently in memory), and rate-limit identifiers.',
    location: 'United States / Global Edge',
    privacyPolicyUrl: 'https://kinich.app/privacy',
  },
  {
    name: 'Dodo Payments',
    category: 'Merchant of Record & Payment Processing',
    purpose: 'Subscription checkout, recurring billing, tax/GST/VAT calculation, invoicing, and refund processing as Merchant of Record.',
    dataShared: 'Billing email, plan selection, transaction IDs, tax jurisdiction, and payment method details (handled directly by Dodo Payments; Kinich never sees or stores raw card numbers or UPI PINs).',
    location: 'United States / India / Global',
    privacyPolicyUrl: 'https://dodopayments.com/privacy-policy',
  },
  {
    name: 'Google Gemini API (@google/genai)',
    category: 'AI Model Provider',
    purpose: 'Multimodal reasoning, PDF/image study synthesis, quiz/flashcard generation, and safety moderation via enterprise API.',
    dataShared: 'User prompts, conversation context, and study material attachments submitted for inference (not used to train models under paid API terms).',
    location: 'United States / Google Cloud',
    privacyPolicyUrl: 'https://ai.google.dev/gemini-api/terms',
  },
  {
    name: 'DeepSeek / OpenRouter / TokenHarbor / MoonMath / IteraCompute',
    category: 'AI Inference & Model Routing Gateways',
    purpose: 'Serving open-weight and frontier language models (DeepSeek V4.1 Flash, GLM-5.3, Qwen 3.8, Kimi K3, Claude/GPT routed models) via stateless API calls.',
    dataShared: 'Prompt text, system instructions, and conversation history turns required to generate a response.',
    location: 'United States / Global API Gateways',
    privacyPolicyUrl: 'https://openrouter.ai/privacy',
  },
  {
    name: 'Treg Search & TinyFish Web Grounding',
    category: 'Web Search & Page Extraction',
    purpose: 'Real-time web search results, news grounding, image search, and URL text extraction when Web Search is active.',
    dataShared: 'Search query keywords derived from the current prompt and public URLs requested for extraction.',
    location: 'United States / Global',
    privacyPolicyUrl: 'https://kinich.app/privacy',
  },
  {
    name: 'YouTube IFrame API & Public Caption Services',
    category: 'Educational Video Playback & Transcripts',
    purpose: 'Embedded video playback and fetching public captions/transcripts for user-requested YouTube videos in the Study Workspace.',
    dataShared: 'YouTube video ID and standard embedded player requests to youtube.com / youtube-nocookie.com.',
    location: 'United States / Google LLC',
    privacyPolicyUrl: 'https://policies.google.com/privacy',
  },
  {
    name: 'arXiv, PubMed (NCBI) & GitHub Public APIs',
    category: 'Academic & Open-Source Grounding',
    purpose: 'Retrieving open-access scientific preprints, biomedical abstracts, and public GitHub repository metadata for research and Kinich Discover.',
    dataShared: 'Search topic keywords and public paper/repository identifiers.',
    location: 'United States',
    privacyPolicyUrl: 'https://info.arxiv.org/help/policies/privacy_policy.html',
  },
];

export interface StorageKeyAuditEntry {
  key: string;
  storageType: 'localStorage' | 'Cookie' | 'IndexedDB';
  category: 'Strictly Necessary' | 'Functional / Preferences' | 'Attribution';
  purpose: string;
  duration: string;
}

export const STORAGE_KEYS_AUDIT: StorageKeyAuditEntry[] = [
  {
    key: 'kinich_auth_session / firebase:authUser:*',
    storageType: 'localStorage',
    category: 'Strictly Necessary',
    purpose: 'Maintains your authenticated Firebase session token and sign-in state across page reloads.',
    duration: 'Until sign-out or account deletion',
  },
  {
    key: 'kinich_consent_record_v1',
    storageType: 'localStorage',
    category: 'Strictly Necessary',
    purpose: 'Stores your acceptance of Kinich Terms, Privacy Policy, Acceptable Use Policy, consent version, and timestamp.',
    duration: '12 months or until policy version update',
  },
  {
    key: 'kinich_cookie_preferences_v1',
    storageType: 'localStorage',
    category: 'Strictly Necessary',
    purpose: 'Remembers your cookie and local storage consent choice (Accept All, Essential Only, or Custom).',
    duration: '12 months',
  },
  {
    key: 'kinich_usage_quota_v2 / kinich_user_subscription_v2',
    storageType: 'localStorage',
    category: 'Strictly Necessary',
    purpose: 'Caches your active plan tier (Free, Spark, Fire) and daily usage counters synced with the server.',
    duration: 'Resets daily at 00:00 UTC',
  },
  {
    key: 'kinich_user_profile',
    storageType: 'localStorage',
    category: 'Strictly Necessary',
    purpose: 'Caches your display name, account mode (guest vs signed-in), and local profile metadata.',
    duration: 'Until cleared or 30 days for guests',
  },
  {
    key: 'kinich_threads_v2 / kinich_active_thread',
    storageType: 'localStorage',
    category: 'Functional / Preferences',
    purpose: 'Stores your conversation threads and active chat session locally for instant loading and guest mode support.',
    duration: 'Until deleted by user (or 30 days of guest inactivity)',
  },
  {
    key: 'kinich_theme / kinich_sidebar_workspace_collapsed',
    storageType: 'localStorage',
    category: 'Functional / Preferences',
    purpose: 'Remembers Dark/Light mode appearance and whether your sidebar workspace is collapsed.',
    duration: 'Persistent until cleared',
  },
  {
    key: 'kinich_user_personalization / kinich_saved_bookmarks / kinich_knowledge_vault_v1',
    storageType: 'localStorage',
    category: 'Functional / Preferences',
    purpose: 'Stores preferred language, pinned message bookmarks, and saved Knowledge Vault study notes.',
    duration: 'Until deleted by user',
  },
  {
    key: 'kinich_daily_streak_v1',
    storageType: 'localStorage',
    category: 'Functional / Preferences',
    purpose: 'Tracks daily study streak calendar, unlocked achievement badges, and streak shields.',
    duration: 'Until account or guest data is cleared',
  },
  {
    key: 'kinich_pending_ref_code / ref (Cookie & localStorage)',
    storageType: 'Cookie',
    category: 'Attribution',
    purpose: 'Stores an inbound referral code (?ref=zp_...) so both you and the friend who invited you receive referral rewards upon registration.',
    duration: '30 days maximum',
  },
];
