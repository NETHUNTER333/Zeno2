import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Shield,
  FileText,
  RefreshCcw,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Scale,
  Cookie,
  Gavel,
  Link as LinkIcon,
  Flag,
  X,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import { GrokLogo } from './GrokLogo';
import {
  LEGAL_CONFIG,
  OPERATOR_NAME,
  TRADE_NAME,
  ADDRESS,
  SUPPORT_EMAIL,
  PRIVACY_EMAIL,
  GRIEVANCE_EMAIL,
  GRIEVANCE_OFFICER_NAME,
  EFFECTIVE_DATE,
  PRICE,
  REFUND_WINDOW_DAYS,
  MIN_AGE,
  CONSENT_VERSION,
} from '../legal/config';
import {
  LEGAL_DOCUMENTS,
  type LegalDocumentId,
  type LegalDocumentData,
} from '../legal/policiesData';

export type LegalPageRoute = LegalDocumentId | '404';

export function resolveLegalOr404Route(pathname: string): LegalPageRoute | null {
  const raw = (pathname || '/').replace(/\/+$/, '').toLowerCase() || '/';
  const clean = raw.endsWith('.html') && raw !== '/index.html' ? raw.slice(0, -5) : raw;

  if (
    clean === '/docs' ||
    clean === '/doc' ||
    clean === '/dox' ||
    clean === '/guide' ||
    clean === '/guides' ||
    clean === '/info'
  ) {
    return 'docs';
  }
  if (clean === '/legal' || clean === '/policies' || clean === '/trust') return 'legal';
  if (clean === '/privacy' || clean === '/privacy-policy') return 'privacy';
  if (clean === '/terms' || clean === '/terms-of-service' || clean === '/tos') return 'terms';
  if (
    clean === '/refund' ||
    clean === '/refunds' ||
    clean === '/refund-policy' ||
    clean === '/cancellation'
  ) {
    return 'refund';
  }
  if (clean === '/contact' || clean === '/support' || clean === '/help') return 'contact';
  if (
    clean === '/acceptable-use' ||
    clean === '/aup' ||
    clean === '/safety' ||
    clean === '/content-policy'
  ) {
    return 'acceptable-use';
  }
  if (clean === '/cookies' || clean === '/cookie-policy' || clean === '/cookie-notice') {
    return 'cookies';
  }

  // Known valid SPA routes
  if (
    clean === '/' ||
    clean === '/index.html' ||
    clean === '/login' ||
    clean === '/signup' ||
    clean === '/chat' ||
    clean.startsWith('/chat/') ||
    clean === '/study' ||
    clean.startsWith('/study/') ||
    clean === '/snap-solve' ||
    clean.startsWith('/snap-solve') ||
    clean === '/research' ||
    clean.startsWith('/research/') ||
    clean === '/pricing' ||
    clean.startsWith('/pricing/') ||
    clean === '/billing/return' ||
    clean.startsWith('/billing/') ||
    clean === '/discover' ||
    clean.startsWith('/discover/') ||
    clean === '/vault' ||
    clean.startsWith('/vault/') ||
    clean === '/account' ||
    clean.startsWith('/account/') ||
    clean === '/settings' ||
    clean.startsWith('/settings/') ||
    clean === '/r' ||
    clean.startsWith('/r/') ||
    clean === '/invite' ||
    clean.startsWith('/invite/') ||
    clean === '/s' ||
    clean.startsWith('/s/') ||
    clean === '/battle' ||
    clean.startsWith('/battle/') ||
    clean.startsWith('/share/') ||
    clean.startsWith('/p/') ||
    clean.startsWith('/u/')
  ) {
    return null;
  }

  return '404';
}

export function navigateToLegalRoute(path: string, customNavigate?: (p: string) => void) {
  if (customNavigate) {
    customNavigate(path);
    return;
  }
  if (typeof window !== 'undefined') {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ============================================================================
// CONSENT & COOKIE STORAGE HELPERS
// ============================================================================
export interface StoredLegalConsent {
  version: string;
  timestamp: string;
  ageConfirmed: boolean;
  uid?: string;
}

export function getStoredLegalConsent(): StoredLegalConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const version = localStorage.getItem(LEGAL_CONFIG.CONSENT_STORAGE_KEY);
    const timestamp = localStorage.getItem(LEGAL_CONFIG.CONSENT_TIMESTAMP_KEY);
    if (!version || !timestamp) return null;
    return {
      version,
      timestamp,
      ageConfirmed: true,
    };
  } catch {
    return null;
  }
}

export function hasValidUserConsent(): boolean {
  return true;
}

export async function recordUserLegalConsent(uid?: string, source = 'signup_or_guest_modal'): Promise<void> {
  const nowIso = new Date().toISOString();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LEGAL_CONFIG.CONSENT_STORAGE_KEY, CONSENT_VERSION);
      localStorage.setItem(LEGAL_CONFIG.CONSENT_TIMESTAMP_KEY, nowIso);
    } catch {}
  }
  try {
    await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: uid || undefined,
        consentVersion: CONSENT_VERSION,
        consentTimestamp: nowIso,
        ageConfirmed: true,
        source,
      }),
    });
  } catch {}
}

export type CookiePreferenceChoice = 'all' | 'essential';

export function getCookiePreference(): CookiePreferenceChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(LEGAL_CONFIG.COOKIE_CONSENT_KEY);
    if (val === 'all' || val === 'essential') return val;
    return null;
  } catch {
    return null;
  }
}

export function setCookiePreference(choice: CookiePreferenceChoice): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LEGAL_CONFIG.COOKIE_CONSENT_KEY, choice);
    if (choice === 'essential') {
      // Clear optional functional referral cache if user selects Essential Only
      localStorage.removeItem('kinich_referral_state_v1');
    }
    window.dispatchEvent(new CustomEvent('kinich-cookie-pref-changed', { detail: { choice } }));
  } catch {}
}

// ============================================================================
// CLIENT-SIDE + SERVER-SIDE UPLOAD MODERATION HELPER
// ============================================================================
export async function moderateFileBeforeUploadClient(params: {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  extractedText?: string;
}): Promise<{ allowed: boolean; reason?: string; category?: string }> {
  try {
    const resp = await fetch('/api/moderation/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || data?.allowed === false) {
      return {
        allowed: false,
        reason:
          data?.reason ||
          "Don't upload photos of people, government IDs, payment cards, or explicit content. Study material only.",
        category: data?.category || 'policy_violation',
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

// ============================================================================
// REPORT MODAL EVENT HELPER
// ============================================================================
export interface ReportModalPayload {
  targetType: 'ai_answer' | 'study_set' | 'discover_item' | 'shared_page';
  targetId?: string;
  contentPreview?: string;
}

export function openKinichReportModal(payload: ReportModalPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('kinich-open-report', { detail: payload }));
}

// ============================================================================
// SITE-WIDE FOOTER COMPONENT
// ============================================================================
interface SiteFooterProps {
  isDark?: boolean;
  compact?: boolean;
  onNavigate?: (path: string) => void;
  className?: string;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({
  isDark = true,
  compact = false,
  onNavigate,
  className = '',
}) => {
  const year = new Date().getFullYear();
  const links: Array<{ label: string; path: string }> = [
    { label: 'Docs & Guide', path: '/docs' },
    { label: 'Terms', path: '/terms' },
    { label: 'Privacy', path: '/privacy' },
    { label: 'Refunds', path: '/refund' },
    { label: 'Acceptable Use', path: '/acceptable-use' },
    { label: 'Cookies', path: '/cookies' },
    { label: 'Contact', path: '/contact' },
  ];

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigateToLegalRoute(path, onNavigate);
  };

  if (compact) {
    return (
      <footer
        className={`w-full text-[11px] leading-relaxed ${
          isDark ? 'text-zinc-400' : 'text-zinc-600'
        } ${className}`}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          {links.map((item, idx) => (
            <React.Fragment key={item.path}>
              <a
                href={item.path}
                onClick={(e) => handleClick(e, item.path)}
                className={`transition-colors hover:underline ${
                  isDark ? 'hover:text-white' : 'hover:text-black'
                }`}
              >
                {item.label}
              </a>
              {idx < links.length - 1 && <span aria-hidden="true">·</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-1 text-[10.5px]">
          {`© ${year} ${OPERATOR_NAME}. All rights reserved.`}
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={`w-full border-t px-4 sm:px-8 py-6 pb-28 sm:pb-24 text-xs ${
        isDark
          ? 'border-white/10 bg-[#09090b] text-zinc-400'
          : 'border-black/10 bg-[#fafafa] text-zinc-600'
      } ${className}`}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-1.5">
          {links.map((item, idx) => (
            <React.Fragment key={item.path}>
              <a
                href={item.path}
                onClick={(e) => handleClick(e, item.path)}
                className={`font-medium transition-colors hover:underline ${
                  isDark ? 'hover:text-white' : 'hover:text-black'
                }`}
              >
                {item.label}
              </a>
              {idx < links.length - 1 && (
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
              )}
            </React.Fragment>
          ))}
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <a
            href="/legal"
            onClick={(e) => handleClick(e, '/legal')}
            className={`font-medium transition-colors hover:underline ${
              isDark ? 'hover:text-white' : 'hover:text-black'
            }`}
          >
            Legal Hub
          </a>
        </div>
        <div className="text-center sm:text-right">
          {`© ${year} ${OPERATOR_NAME}. All rights reserved.`}
        </div>
      </div>
    </footer>
  );
};

// ============================================================================
// COOKIE & LOCAL STORAGE BANNER (Equal Prominence Accept / Essential Only / Manage)
// ============================================================================
export const CookieConsentBanner: React.FC<{
  isDark?: boolean;
  onNavigate?: (path: string) => void;
}> = () => {
  return null;
};

// ============================================================================
// GUEST FIRST-PROMPT & RE-CONSENT MODAL
// ============================================================================
export const GuestFirstPromptConsentModal: React.FC<{
  open: boolean;
  isDark?: boolean;
  onAccept: () => void;
  onCancel: () => void;
  onNavigate?: (path: string) => void;
}> = () => {
  return null;
};

// ============================================================================
// REPORT CONTENT MODAL (AI Answers, Study Sets, Shared / Discover Items)
// ============================================================================
export const ReportContentModal: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => {
  const [payload, setPayload] = useState<ReportModalPayload | null>(null);
  const [reason, setReason] = useState('Inaccurate or hallucinated AI output');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<ReportModalPayload>;
      if (custom.detail) {
        setPayload(custom.detail);
        setReportId(null);
        setErrorMsg(null);
        setDetails('');
      }
    };
    window.addEventListener('kinich-open-report', handler);
    return () => window.removeEventListener('kinich-open-report', handler);
  }, []);

  if (!payload) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: payload.targetType,
          targetId: payload.targetId || '',
          reason,
          details,
          contentPreview: payload.contentPreview || '',
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to submit report.');
      }
      setReportId(data.reportId || 'RPT-LOGGED');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setPayload(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-xl border p-4 shadow-xl ${
          isDark
            ? 'bg-[#121215] border-white/10 text-white'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 opacity-80" />
            <h3 className="text-xs font-semibold">Report Content</h3>
          </div>
          <button
            type="button"
            onClick={() => setPayload(null)}
            aria-label="Close report modal"
            className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {reportId ? (
          <div className="space-y-3">
            <div className={`p-3 rounded-lg border text-xs ${
              isDark ? 'bg-white/[0.04] border-white/10 text-neutral-200' : 'bg-neutral-50 border-neutral-200 text-neutral-800'
            }`}>
              <div className="font-medium flex items-center gap-1.5 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" /> Report Submitted
              </div>
              <p className="mt-1 text-[11px] opacity-70">
                Your report ({reportId}) has been logged for review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPayload(null)}
              className={`w-full py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                isDark ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-neutral-800'
              }`}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-medium mb-1 opacity-80">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none ${
                  isDark
                    ? 'bg-[#18181c] border-white/10 text-white'
                    : 'bg-neutral-50 border-neutral-200 text-black'
                }`}
              >
                <option value="Inaccurate or hallucinated AI output">Inaccurate or hallucinated AI output</option>
                <option value="Harmful, unsafe, or explicit content">Harmful, unsafe, or explicit content</option>
                <option value="Personal data / doxxing / privacy concern">Personal data / privacy concern</option>
                <option value="Copyright or intellectual property infringement">Copyright infringement</option>
                <option value="Spam or referral abuse">Spam or abuse</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1 opacity-80">Details (optional)</label>
              <textarea
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe the issue..."
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none resize-none ${
                  isDark
                    ? 'bg-[#18181c] border-white/10 text-white'
                    : 'bg-neutral-50 border-neutral-200 text-black'
                }`}
              />
            </div>

            {errorMsg && (
              <div className="p-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPayload(null)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                  isDark ? 'border-white/10 text-neutral-300 hover:bg-white/5' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50 transition-colors ${
                  isDark ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-neutral-800'
                }`}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN OPENAI-STYLE LEGAL & TRUST PAGE VIEWER
// ============================================================================
interface LegalAndInfoPagesProps {
  route: LegalPageRoute;
  onNavigate: (path: string) => void;
  isDark?: boolean;
}

export const LegalAndInfoPages: React.FC<LegalAndInfoPagesProps> = ({
  route,
  onNavigate,
  isDark = true,
}) => {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCategory, setContactCategory] = useState('Billing & Refund Request (Dodo Payments)');
  const [contactMessage, setContactMessage] = useState('');
  const [honeypotWebsite, setHoneypotWebsite] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactTicket, setContactTicket] = useState<{
    ticketId: string;
    acknowledgmentSla: string;
    resolutionSla: string;
  } | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [copiedAnchor, setCopiedAnchor] = useState<string | null>(null);
  const [cookiePref, setCookiePrefState] = useState<CookiePreferenceChoice | null>(() =>
    getCookiePreference()
  );

  const activeDoc: LegalDocumentData | null =
    route !== '404' ? LEGAL_DOCUMENTS[route] || LEGAL_DOCUMENTS.legal : null;

  // Sync document title and meta description per route
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (route === '404') {
      document.title = `Page Not Found · ${TRADE_NAME}`;
      return;
    }
    if (activeDoc) {
      document.title = activeDoc.pageTitle;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', activeDoc.metaDescription);
      }
    }
  }, [route, activeDoc]);

  // Scroll to hash anchor if present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      const el = document.getElementById(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      }
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [route]);

  const navTabs: Array<{
    id: LegalDocumentId;
    label: string;
    path: string;
    icon: React.ReactNode;
  }> = [
    { id: 'docs', label: 'Docs & Guide', path: '/docs', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'legal', label: 'Legal Hub', path: '/legal', icon: <Scale className="w-3.5 h-3.5" /> },
    { id: 'terms', label: 'Terms', path: '/terms', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'privacy', label: 'Privacy', path: '/privacy', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'refund', label: 'Refunds', path: '/refund', icon: <RefreshCcw className="w-3.5 h-3.5" /> },
    { id: 'acceptable-use', label: 'Acceptable Use', path: '/acceptable-use', icon: <Gavel className="w-3.5 h-3.5" /> },
    { id: 'cookies', label: 'Cookies', path: '/cookies', icon: <Cookie className="w-3.5 h-3.5" /> },
    { id: 'contact', label: 'Contact', path: '/contact', icon: <Mail className="w-3.5 h-3.5" /> },
  ];

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.trim() || !contactMessage.trim()) return;
    setContactSubmitting(true);
    setContactError(null);
    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          category: contactCategory,
          message: contactMessage.trim(),
          website_url: honeypotWebsite,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to submit inquiry.');
      }
      setContactTicket({
        ticketId: data.ticketId || 'ZENO-TICKET',
        acknowledgmentSla: data.acknowledgmentSla || '24 hours',
        resolutionSla: data.resolutionSla || '15 days',
      });
    } catch (err: any) {
      setContactError(err?.message || 'Unable to submit form right now. Please email us directly.');
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleCopyAnchor = (anchorId: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}#${anchorId}`;
    window.history.replaceState({}, '', `${window.location.pathname}#${anchorId}`);
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedAnchor(anchorId);
    setTimeout(() => setCopiedAnchor(null), 1800);
  };

  return (
    <div
      className={`min-h-[100dvh] w-full flex flex-col font-sans selection:bg-[#FC4C01]/30 ${
        isDark ? 'bg-[#09090b] text-[#f4f4f5]' : 'bg-[#fafafa] text-[#09090b]'
      }`}
    >
      {/* Top Navigation Bar */}
      <header
        className={`sticky top-0 z-30 border-b px-3 sm:px-8 py-3 flex items-center justify-between gap-3 backdrop-blur-md ${
          isDark ? 'bg-[#09090b]/90 border-white/10' : 'bg-white/90 border-black/10'
        }`}
      >
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
              isDark
                ? 'border-white/15 bg-white/5 hover:bg-white/10 text-white'
                : 'border-black/15 bg-black/5 hover:bg-black/10 text-black'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to {TRADE_NAME}</span>
          </button>
          <a
            href="/legal"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/legal');
            }}
            className="hidden sm:flex items-center gap-2 pl-2"
          >
            <GrokLogo className="w-5 h-5 shrink-0" size="sm" showText={false} isDark={isDark} />
            <span className="font-bold tracking-tight text-sm">{TRADE_NAME} Legal</span>
          </a>
        </div>

        <nav
          aria-label="Legal policies navigation"
          className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full py-0.5"
        >
          {navTabs.map((tab) => {
            const active = route === tab.id;
            return (
              <a
                key={tab.id}
                href={tab.path}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(tab.path);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#FC4C01] text-white font-semibold'
                    : isDark
                    ? 'text-white/65 hover:text-white hover:bg-white/5'
                    : 'text-black/65 hover:text-black hover:bg-black/5'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </a>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1080px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {route === '404' || !activeDoc ? (
          <div
            className={`max-w-[560px] mx-auto rounded-2xl border p-8 sm:p-10 text-center space-y-5 ${
              isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#FC4C01]">
                HTTP 404 · Page Not Found
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Page not found</h1>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-white/65' : 'text-black/65'}`}>
                The route{' '}
                <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs">
                  {typeof window !== 'undefined' ? window.location.pathname : '/404'}
                </code>{' '}
                does not exist on {TRADE_NAME}.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="px-5 py-2.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Return to {TRADE_NAME} Home
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/legal')}
                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                  isDark
                    ? 'border-white/15 bg-white/5 hover:bg-white/10 text-white'
                    : 'border-black/15 bg-black/5 hover:bg-black/10 text-black'
                }`}
              >
                Legal Hub
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,720px)] gap-8 lg:gap-12 justify-center items-start">
            {/* Sticky Table of Contents on Desktop */}
            <aside className="hidden lg:block sticky top-20 space-y-4">
              <div className="text-[11px] font-mono uppercase tracking-wider opacity-50">
                On this page
              </div>
              <nav aria-label="Table of contents" className="space-y-1 border-l border-current/10 pl-3">
                <a
                  href="#short-version"
                  className={`block py-1 text-xs transition-colors ${
                    isDark ? 'text-white/65 hover:text-white' : 'text-black/65 hover:text-black'
                  }`}
                >
                  The short version
                </a>
                {activeDoc.sections.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className={`block py-1 text-xs leading-snug transition-colors ${
                      isDark ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black'
                    }`}
                  >
                    {sec.number}. {sec.title}
                  </a>
                ))}
                <a
                  href="#version-history"
                  className={`block py-1 text-xs transition-colors ${
                    isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}
                >
                  Version history
                </a>
              </nav>

              <div
                className={`rounded-xl border p-3 text-[11px] space-y-1.5 ${
                  isDark ? 'border-white/10 bg-white/[0.02]' : 'border-black/10 bg-black/[0.02]'
                }`}
              >
                <div className="font-semibold">Need help or have a question?</div>
                <div className={isDark ? 'text-white/60' : 'text-black/60'}>
                  Support: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
                </div>
                <div className={isDark ? 'text-white/60' : 'text-black/60'}>
                  Privacy / DPDP: <a href={`mailto:${PRIVACY_EMAIL}`} className="underline">{PRIVACY_EMAIL}</a>
                </div>
              </div>
            </aside>

            {/* Single-Column ~720px Legal Document Reader */}
            <article className="w-full max-w-[720px] mx-auto space-y-8">
              {/* Document Header */}
              <header className="space-y-3 border-b border-current/10 pb-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#FC4C01]">
                  <span>{TRADE_NAME} Legal &amp; Trust</span>
                  <span>·</span>
                  <span>Last updated: {activeDoc.lastUpdated}</span>
                  <span>·</span>
                  <span>Effective: {activeDoc.effectiveDate}</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight">
                  {activeDoc.title}
                </h1>
                <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-white/70' : 'text-black/70'}`}>
                  {activeDoc.subtitle}
                </p>
              </header>

              {/* Plain-English Summary Box ("The short version") */}
              <section
                id="short-version"
                className={`rounded-2xl border p-5 sm:p-6 space-y-3 scroll-mt-24 ${
                  isDark
                    ? 'border-white/15 bg-white/[0.03]'
                    : 'border-black/15 bg-white shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-[#FC4C01] font-semibold">
                    The short version (Plain-English Summary)
                  </h2>
                  <span className={`text-[11px] ${isDark ? 'text-white/45' : 'text-black/45'}`}>
                    Non-binding summary · Full terms below govern
                  </span>
                </div>
                <ul className="space-y-2 text-xs sm:text-sm leading-relaxed">
                  {activeDoc.shortVersionBullets.map((bullet: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#FC4C01] shrink-0 mt-0.5" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Legal Hub Directory Cards when route === 'legal' */}
              {route === 'legal' && (
                <section className="space-y-4">
                  <h2 className="text-base font-bold tracking-tight">All {TRADE_NAME} Policies &amp; Notices</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {(
                      [
                        {
                          id: 'terms',
                          title: 'Terms of Service',
                          path: '/terms',
                          desc: '19 sections covering eligibility, AI disclaimers, Dodo Payments billing, IP ownership, and Indian jurisdiction.',
                        },
                        {
                          id: 'privacy',
                          title: 'Privacy Policy',
                          path: '/privacy',
                          desc: 'DPDP Act 2023 & GDPR-style notice covering data collection, retention schedule, and subprocessors.',
                        },
                        {
                          id: 'refund',
                          title: 'Refund & Cancellation Policy',
                          path: '/refund',
                          desc: `${REFUND_WINDOW_DAYS}-day refund window on first purchase, instant cancellation, and Dodo Payments Merchant of Record workflow.`,
                        },
                        {
                          id: 'acceptable-use',
                          title: 'Acceptable Use & Safety Policy',
                          path: '/acceptable-use',
                          desc: 'Prohibited content (Categories A–E), upload guard rules, and graduated enforcement strikes.',
                        },
                        {
                          id: 'cookies',
                          title: 'Cookie & Storage Notice',
                          path: '/cookies',
                          desc: 'Complete inventory of browser cookies and localStorage keys with one-click preference controls.',
                        },
                        {
                          id: 'contact',
                          title: 'Contact & Grievance Officer',
                          path: '/contact',
                          desc: 'Support channels, DPDP/IT Rules Grievance Officer details, and rate-limited support ticket form.',
                        },
                      ] as const
                    ).map((card) => (
                      <a
                        key={card.id}
                        href={card.path}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate(card.path);
                        }}
                        className={`group rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                          isDark
                            ? 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'
                            : 'border-black/10 bg-white hover:border-black/25 shadow-2xs'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm group-hover:text-[#FC4C01] transition-colors">
                              {card.title}
                            </span>
                            <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-[#FC4C01] transition-all" />
                          </div>
                          <p className={`text-xs leading-relaxed ${isDark ? 'text-white/65' : 'text-black/65'}`}>
                            {card.desc}
                          </p>
                        </div>
                        <div className="text-[11px] font-mono text-[#FC4C01]">{card.path}</div>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Numbered Policy Sections with Anchor Links & Tables */}
              <div className="space-y-8">
                {activeDoc.sections.map((sec) => (
                  <section
                    key={sec.id}
                    id={sec.id}
                    className="space-y-3 scroll-mt-24 border-b border-current/10 pb-7 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2 group">
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                        <span className="font-mono text-xs sm:text-sm text-[#FC4C01] mr-2">
                          {sec.number}.
                        </span>
                        {sec.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() => handleCopyAnchor(sec.id)}
                        title={`Copy link to #${sec.id}`}
                        className="opacity-60 hover:opacity-100 p-1.5 rounded-lg border border-transparent hover:border-current/15 text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        {copiedAnchor === sec.id && (
                          <span className="text-[10px] font-mono text-[#FC4C01]">Copied</span>
                        )}
                      </button>
                    </div>

                    {(sec.paragraphs || []).map((p: string, pIdx: number) => (
                      <p
                        key={pIdx}
                        className={`text-sm sm:text-[15px] leading-relaxed ${
                          isDark ? 'text-white/80' : 'text-black/80'
                        }`}
                      >
                        {p}
                      </p>
                    ))}

                    {sec.bullets && sec.bullets.length > 0 && (
                      <ul
                        className={`list-disc pl-5 space-y-1.5 text-sm leading-relaxed ${
                          isDark ? 'text-white/80' : 'text-black/80'
                        }`}
                      >
                        {sec.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    )}

                    {sec.table && (
                      <div className="overflow-x-auto rounded-xl border border-current/15 mt-3">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                          <thead>
                            <tr
                              className={
                                isDark
                                  ? 'bg-white/[0.04] border-b border-white/10'
                                  : 'bg-black/[0.04] border-b border-black/10'
                              }
                            >
                              {sec.table.headers.map((h, hIdx) => (
                                <th key={hIdx} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-current/10">
                            {sec.table.rows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`py-2.5 px-3 align-top leading-relaxed ${
                                      cIdx === 0 ? 'font-medium' : isDark ? 'text-white/75' : 'text-black/75'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {/* Interactive Rate-Limited Contact & Grievance Form on /contact */}
              {route === 'contact' && (
                <section
                  id="contact-form"
                  className={`rounded-2xl border p-6 space-y-4 scroll-mt-24 ${
                    isDark ? 'border-white/15 bg-white/[0.02]' : 'border-black/15 bg-white shadow-xs'
                  }`}
                >
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Submit a Support or Grievance Ticket</h2>
                    <p className={`text-xs mt-1 ${isDark ? 'text-white/65' : 'text-black/65'}`}>
                      Protected by per-IP rate limiting (max 5 submissions/hour). Grievance &amp; privacy tickets are acknowledged within 24 hours.
                    </p>
                  </div>

                  {contactTicket ? (
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Ticket Logged — Reference #{contactTicket.ticketId}</span>
                      </div>
                      <p className="opacity-85 leading-relaxed">
                        We have recorded your inquiry from <strong>{contactEmail}</strong> under{' '}
                        <strong>{contactCategory}</strong>. Acknowledgment SLA:{' '}
                        <strong>{contactTicket.acknowledgmentSla}</strong>; Resolution SLA:{' '}
                        <strong>{contactTicket.resolutionSla}</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setContactTicket(null);
                          setContactMessage('');
                        }}
                        className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold cursor-pointer"
                      >
                        Submit another inquiry
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-3.5 text-xs sm:text-sm">
                      {/* Honeypot spam protection field (hidden from real users) */}
                      <div className="hidden" aria-hidden="true">
                        <label>
                          Website URL
                          <input
                            type="text"
                            tabIndex={-1}
                            autoComplete="off"
                            value={honeypotWebsite}
                            onChange={(e) => setHoneypotWebsite(e.target.value)}
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-semibold mb-1.5">Your Name</label>
                          <input
                            type="text"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            placeholder="Jane Doe"
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${
                              isDark
                                ? 'bg-white/[0.03] border-white/15 text-white focus:border-[#FC4C01]'
                                : 'bg-neutral-50 border-black/15 text-black focus:border-[#FC4C01]'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1.5">Email Address *</label>
                          <input
                            type="email"
                            required
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder="you@example.com"
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${
                              isDark
                                ? 'bg-white/[0.03] border-white/15 text-white focus:border-[#FC4C01]'
                                : 'bg-neutral-50 border-black/15 text-black focus:border-[#FC4C01]'
                            }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Category</label>
                        <select
                          value={contactCategory}
                          onChange={(e) => setContactCategory(e.target.value)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${
                            isDark
                              ? 'bg-[#121215] border-white/15 text-white focus:border-[#FC4C01]'
                              : 'bg-neutral-50 border-black/15 text-black focus:border-[#FC4C01]'
                          }`}
                        >
                          <option value="Billing & Refund Request (Dodo Payments)">
                            Billing &amp; Refund Request (Dodo Payments)
                          </option>
                          <option value="Privacy / DPDP Act Data Request">
                            Privacy / DPDP Act Data Request
                          </option>
                          <option value="Formal Grievance Officer Complaint (IT Rules 2021)">
                            Formal Grievance Officer Complaint (IT Rules 2021)
                          </option>
                          <option value="Abuse, Safety, or Copyright Takedown">
                            Abuse, Safety, or Copyright Takedown
                          </option>
                          <option value="Security Vulnerability Report">
                            Security Vulnerability Report
                          </option>
                          <option value="Technical Support & Feedback">
                            Technical Support &amp; Feedback
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1.5">
                          Message / Order ID / Details *
                        </label>
                        <textarea
                          required
                          rows={4}
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          placeholder="Include your account email, Dodo Payments order/receipt ID (if billing-related), and full details..."
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none resize-y ${
                            isDark
                              ? 'bg-white/[0.03] border-white/15 text-white focus:border-[#FC4C01]'
                              : 'bg-neutral-50 border-black/15 text-black focus:border-[#FC4C01]'
                          }`}
                        />
                      </div>

                      {contactError && (
                        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
                          {contactError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={contactSubmitting}
                        className="px-5 py-2.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
                      >
                        {contactSubmitting ? 'Submitting Ticket…' : 'Submit Support / Grievance Ticket'}
                      </button>
                    </form>
                  )}
                </section>
              )}

              {/* Version History Footer inside Article */}
              <section
                id="version-history"
                className={`rounded-2xl border p-5 space-y-2.5 text-xs scroll-mt-24 ${
                  isDark ? 'border-white/10 bg-white/[0.015]' : 'border-black/10 bg-black/[0.02]'
                }`}
              >
                <div className="font-mono uppercase tracking-wider opacity-60">Version History</div>
                {activeDoc.versionHistory.map((vh, idx) => (
                  <div key={idx} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {vh.version} — {vh.date}
                    </span>
                    <span className={isDark ? 'text-white/65' : 'text-black/65'}>{vh.changes}</span>
                  </div>
                ))}
                <div className={`pt-2 border-t border-current/10 text-[11px] ${isDark ? 'text-white/50' : 'text-black/50'}`}>
                  Operator: {OPERATOR_NAME} · {ADDRESS} · Grievance Officer: {GRIEVANCE_OFFICER_NAME} ({GRIEVANCE_EMAIL})
                </div>
              </section>
            </article>
          </div>
        )}
      </main>

      {/* Site-Wide Footer */}
      <SiteFooter isDark={isDark} onNavigate={onNavigate} />
    </div>
  );
};
