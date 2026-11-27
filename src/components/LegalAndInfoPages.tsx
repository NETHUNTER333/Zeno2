import React, { useEffect, useState } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle2, Link as LinkIcon, Flag, X, Check, ArrowUpRight } from 'lucide-react';
import {
  LEGAL_CONFIG, OPERATOR_NAME, TRADE_NAME, ADDRESS, SUPPORT_EMAIL, PRIVACY_EMAIL,
  GRIEVANCE_EMAIL, GRIEVANCE_OFFICER_NAME, REFUND_WINDOW_DAYS, CONSENT_VERSION,
} from '../legal/config';
import type { LegalDocumentId, LegalDocumentData } from '../legal/policiesData';
import { RouteSkeleton } from './Skeleton';

export type LegalPageRoute = LegalDocumentId | '404';

const LEGAL_ALIAS_MAP: Array<[LegalDocumentId, string[]]> = [
  ['docs', ['/docs', '/doc', '/dox', '/guide', '/guides', '/info']],
  ['legal', ['/legal', '/policies', '/trust']],
  ['privacy', ['/privacy', '/privacy-policy']],
  ['terms', ['/terms', '/terms-of-service', '/tos']],
  ['refund', ['/refund', '/refunds', '/refund-policy', '/cancellation']],
  ['contact', ['/contact', '/support', '/help']],
  ['acceptable-use', ['/acceptable-use', '/aup', '/safety', '/content-policy']],
  ['cookies', ['/cookies', '/cookie-policy', '/cookie-notice']],
];

const SPA_EXACT_ROUTES = new Set(['/', '/index.html', '/login', '/signup', '/chat', '/study', '/snap-solve', '/research', '/pricing', '/billing/return', '/discover', '/vault', '/account', '/settings', '/r', '/invite', '/s', '/battle']);
const SPA_PREFIX_ROUTES = ['/chat/', '/study/', '/snap-solve', '/research/', '/pricing/', '/billing/', '/discover/', '/vault/', '/account/', '/settings/', '/r/', '/invite/', '/s/', '/battle/', '/share/', '/p/', '/u/'];

export function resolveLegalOr404Route(pathname: string): LegalPageRoute | null {
  const raw = (pathname || '/').replace(/\/+$/, '').toLowerCase() || '/';
  const clean = raw.endsWith('.html') && raw !== '/index.html' ? raw.slice(0, -5) : raw;
  for (const [id, paths] of LEGAL_ALIAS_MAP) if (paths.includes(clean)) return id;
  if (SPA_EXACT_ROUTES.has(clean) || SPA_PREFIX_ROUTES.some((p) => clean.startsWith(p))) return null;
  return '404';
}

export function navigateToLegalRoute(path: string, customNavigate?: (p: string) => void) {
  if (customNavigate) return customNavigate(path);
  if (typeof window !== 'undefined') {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export interface StoredLegalConsent { version: string; timestamp: string; ageConfirmed: boolean; uid?: string; }

export function getStoredLegalConsent(): StoredLegalConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const version = localStorage.getItem(LEGAL_CONFIG.CONSENT_STORAGE_KEY);
    const timestamp = localStorage.getItem(LEGAL_CONFIG.CONSENT_TIMESTAMP_KEY);
    return version && timestamp ? { version, timestamp, ageConfirmed: true } : null;
  } catch { return null; }
}

export function hasValidUserConsent(): boolean { return true; }

export async function recordUserLegalConsent(uid?: string, source = 'signup_or_guest_modal'): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LEGAL_CONFIG.CONSENT_STORAGE_KEY, CONSENT_VERSION);
      localStorage.setItem(LEGAL_CONFIG.CONSENT_TIMESTAMP_KEY, nowIso);
    }
  } catch {}
  try {
    await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: uid || undefined, consentVersion: CONSENT_VERSION, consentTimestamp: nowIso, ageConfirmed: true, source }),
    });
  } catch {}
}

export type CookiePreferenceChoice = 'all' | 'essential';

export function getCookiePreference(): CookiePreferenceChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(LEGAL_CONFIG.COOKIE_CONSENT_KEY);
    return val === 'all' || val === 'essential' ? val : null;
  } catch { return null; }
}

export function setCookiePreference(choice: CookiePreferenceChoice): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LEGAL_CONFIG.COOKIE_CONSENT_KEY, choice);
    if (choice === 'essential') localStorage.removeItem('kinich_referral_state_v1');
    window.dispatchEvent(new CustomEvent('kinich-cookie-pref-changed', { detail: { choice } }));
  } catch {}
}

export async function moderateFileBeforeUploadClient(params: {
  fileName: string; mimeType: string; dataUrl?: string; extractedText?: string;
}): Promise<{ allowed: boolean; reason?: string; category?: string }> {
  try {
    const resp = await fetch('/api/moderation/upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || data?.allowed === false) {
      return {
        allowed: false,
        reason: data?.reason || "Don't upload photos of people, government IDs, payment cards, or explicit content. Study material only.",
        category: data?.category || 'policy_violation',
      };
    }
    return { allowed: true };
  } catch { return { allowed: true }; }
}

export interface ReportModalPayload {
  targetType: 'ai_answer' | 'study_set' | 'discover_item' | 'shared_page';
  targetId?: string;
  contentPreview?: string;
}

export function openKinichReportModal(payload: ReportModalPayload): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kinich-open-report', { detail: payload }));
}

const FOOTER_LINKS: Array<[string, string]> = [
  ['Docs & Guide', '/docs'], ['Terms', '/terms'], ['Privacy', '/privacy'],
  ['Refunds', '/refund'], ['Acceptable Use', '/acceptable-use'], ['Cookies', '/cookies'], ['Contact', '/contact'],
];

const NAV_TABS: Array<[LegalDocumentId, string, string]> = [
  ['docs', 'Docs & Guide', '/docs'], ['legal', 'Legal Hub', '/legal'], ['terms', 'Terms', '/terms'],
  ['privacy', 'Privacy', '/privacy'], ['refund', 'Refunds', '/refund'],
  ['acceptable-use', 'Acceptable Use', '/acceptable-use'], ['cookies', 'Cookies', '/cookies'], ['contact', 'Contact', '/contact'],
];

const REPORT_REASONS = [
  ['Inaccurate or hallucinated AI output', 'Inaccurate or hallucinated AI output'],
  ['Harmful, unsafe, or explicit content', 'Harmful, unsafe, or explicit content'],
  ['Personal data / doxxing / privacy concern', 'Personal data / doxxing / privacy concern'],
  ['Copyright or intellectual property infringement', 'Copyright infringement'],
  ['Spam or referral abuse', 'Spam or abuse'],
] as const;

const CONTACT_CATEGORIES = [
  'Billing & Refund Request (Dodo Payments)',
  'Privacy / DPDP Act Data Request',
  'Formal Grievance Officer Complaint (IT Rules 2021)',
  'Abuse, Safety, or Copyright Takedown',
  'Security Vulnerability Report',
  'Technical Support & Feedback',
] as const;

export const SiteFooter: React.FC<{ isDark?: boolean; compact?: boolean; onNavigate?: (path: string) => void; className?: string }> = ({
  isDark = true, compact = false, onNavigate, className = '',
}) => {
  const year = new Date().getFullYear();
  const hoverCls = isDark ? 'hover:text-white' : 'hover:text-black';
  const onLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigateToLegalRoute(path, onNavigate);
  };
  const allLinks: Array<[string, string]> = compact ? FOOTER_LINKS : [...FOOTER_LINKS, ['Legal Hub', '/legal']];
  const copy = `© ${year} ${OPERATOR_NAME}. All rights reserved.`;

  if (compact) {
    return (
      <footer className={`w-full text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'} ${className}`}>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          {allLinks.map(([label, path], i) => (
            <React.Fragment key={path}>
              <a href={path} onClick={(e) => onLink(e, path)} className={`transition-colors hover:underline ${hoverCls}`}>{label}</a>
              {i < allLinks.length - 1 && <span aria-hidden="true">·</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-1 text-[10.5px]">{copy}</div>
      </footer>
    );
  }

  return (
    <footer className={`w-full border-t px-4 sm:px-8 py-6 pb-28 sm:pb-24 text-xs ${isDark ? 'border-white/10 bg-[#09090b] text-zinc-400' : 'border-black/10 bg-[#fafafa] text-zinc-600'} ${className}`}>
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-1.5">
          {allLinks.map(([label, path], i) => (
            <React.Fragment key={path}>
              <a href={path} onClick={(e) => onLink(e, path)} className={`font-medium transition-colors hover:underline ${hoverCls}`}>{label}</a>
              {i < allLinks.length - 1 && <span aria-hidden="true" className="opacity-40">·</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="text-center sm:text-right">{copy}</div>
      </div>
    </footer>
  );
};

export const CookieConsentBanner: React.FC<{ isDark?: boolean; onNavigate?: (path: string) => void }> = () => null;
export const GuestFirstPromptConsentModal: React.FC<{ open: boolean; isDark?: boolean; onAccept: () => void; onCancel: () => void; onNavigate?: (path: string) => void }> = () => null;

export const ReportContentModal: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => {
  const [payload, setPayload] = useState<ReportModalPayload | null>(null);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0][0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ReportModalPayload>).detail;
      if (detail) { setPayload(detail); setReportId(null); setErrorMsg(null); setDetails(''); }
    };
    window.addEventListener('kinich-open-report', handler);
    return () => window.removeEventListener('kinich-open-report', handler);
  }, []);

  if (!payload) return null;

  const fieldCls = `w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none ${isDark ? 'bg-[#18181c] border-white/10 text-white' : 'bg-neutral-50 border-neutral-200 text-black'}`;
  const primaryBtnCls = isDark ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-neutral-800';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: payload.targetType, targetId: payload.targetId || '', reason, details, contentPreview: payload.contentPreview || '' }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) throw new Error(data?.error || 'Failed to submit report.');
      setReportId(data.reportId || 'RPT-LOGGED');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not submit report. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPayload(null)}>
      <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-sm rounded-xl border p-4 shadow-xl ${isDark ? 'bg-[#121215] border-white/10 text-white' : 'bg-white border-neutral-200 text-neutral-900'}`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2"><Flag className="w-4 h-4 opacity-80" /><h3 className="text-xs font-semibold">Report Content</h3></div>
          <button type="button" onClick={() => setPayload(null)} aria-label="Close report modal" className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>

        {reportId ? (
          <div className="space-y-3">
            <div className={`p-3 rounded-lg border text-xs ${isDark ? 'bg-white/[0.04] border-white/10 text-neutral-200' : 'bg-neutral-50 border-neutral-200 text-neutral-800'}`}>
              <div className="font-medium flex items-center gap-1.5 text-emerald-500"><CheckCircle2 className="w-4 h-4" /> Report Submitted</div>
              <p className="mt-1 text-[11px] opacity-70">Your report ({reportId}) has been logged for review.</p>
            </div>
            <button type="button" onClick={() => setPayload(null)} className={`w-full py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${primaryBtnCls}`}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-medium mb-1 opacity-80">Reason</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={fieldCls}>
                {REPORT_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1 opacity-80">Details (optional)</label>
              <textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Describe the issue..." className={`${fieldCls} resize-none`} />
            </div>
            {errorMsg && <div className="p-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{errorMsg}</div>}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => setPayload(null)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${isDark ? 'border-white/10 text-neutral-300 hover:bg-white/5' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-100'}`}>Cancel</button>
              <button type="submit" disabled={submitting} className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50 transition-colors ${primaryBtnCls}`}>{submitting ? 'Submitting…' : 'Submit'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export const LegalAndInfoPages: React.FC<{ route: LegalPageRoute; onNavigate: (path: string) => void; isDark?: boolean }> = ({
  route, onNavigate, isDark = true,
}) => {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCategory, setContactCategory] = useState<string>(CONTACT_CATEGORIES[0]);
  const [contactMessage, setContactMessage] = useState('');
  const [honeypotWebsite, setHoneypotWebsite] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactTicket, setContactTicket] = useState<{ ticketId: string; acknowledgmentSla: string; resolutionSla: string } | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [copiedAnchor, setCopiedAnchor] = useState<string | null>(null);
  const [legalDocs, setLegalDocs] = useState<Record<LegalDocumentId, LegalDocumentData> | null>(null);

  useEffect(() => {
    if (route === '404' || legalDocs) return;
    let active = true;
    import('../legal/policiesData').then((m) => { if (active) setLegalDocs(m.LEGAL_DOCUMENTS); }).catch(() => {});
    return () => { active = false; };
  }, [route, legalDocs]);

  const activeDoc = route !== '404' && legalDocs ? legalDocs[route] || legalDocs.legal : null;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (route === '404') { document.title = `Page Not Found · ${TRADE_NAME}`; return; }
    if (activeDoc) {
      document.title = activeDoc.pageTitle;
      document.querySelector('meta[name="description"]')?.setAttribute('content', activeDoc.metaDescription);
    }
  }, [route, activeDoc]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    const el = hash ? document.getElementById(hash) : null;
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    else window.scrollTo({ top: 0 });
  }, [route]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.trim() || !contactMessage.trim()) return;
    setContactSubmitting(true);
    setContactError(null);
    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contactName.trim(), email: contactEmail.trim(), category: contactCategory, message: contactMessage.trim(), website_url: honeypotWebsite }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) throw new Error(data?.error || 'Failed to submit inquiry.');
      setContactTicket({ ticketId: data.ticketId || 'ZENO-TICKET', acknowledgmentSla: data.acknowledgmentSla || '24 hours', resolutionSla: data.resolutionSla || '15 days' });
    } catch (err: any) {
      setContactError(err?.message || 'Unable to submit form right now. Please email us directly.');
    } finally { setContactSubmitting(false); }
  };

  const handleCopyAnchor = (anchorId: string) => {
    if (typeof window === 'undefined') return;
    window.history.replaceState({}, '', `${window.location.pathname}#${anchorId}`);
    navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#${anchorId}`).catch(() => {});
    setCopiedAnchor(anchorId);
    setTimeout(() => setCopiedAnchor(null), 1800);
  };

  const muted = isDark ? 'text-white/65' : 'text-black/65';
  const inputCls = `w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${isDark ? 'bg-white/[0.03] border-white/15 text-white focus:border-[#FC4C01]' : 'bg-neutral-50 border-black/15 text-black focus:border-[#FC4C01]'}`;
  const hubCards: Array<[string, string, string, string]> = [
    ['terms', 'Terms of Service', '/terms', '19 sections covering eligibility, AI disclaimers, Dodo Payments billing, IP ownership, and Indian jurisdiction.'],
    ['privacy', 'Privacy Policy', '/privacy', 'DPDP Act 2023 & GDPR-style notice covering data collection, retention schedule, and subprocessors.'],
    ['refund', 'Refund & Cancellation Policy', '/refund', `${REFUND_WINDOW_DAYS}-day refund window on first purchase, instant cancellation, and Dodo Payments Merchant of Record workflow.`],
    ['acceptable-use', 'Acceptable Use & Safety Policy', '/acceptable-use', 'Prohibited content (Categories A–E), upload guard rules, and graduated enforcement strikes.'],
    ['cookies', 'Cookie & Storage Notice', '/cookies', 'Complete inventory of browser cookies and localStorage keys with one-click preference controls.'],
    ['contact', 'Contact & Grievance Officer', '/contact', 'Support channels, DPDP/IT Rules Grievance Officer details, and rate-limited support ticket form.'],
  ];

  return (
    <div className={`min-h-[100dvh] w-full flex flex-col font-sans selection:bg-white/30 ${isDark ? 'bg-black text-white' : 'bg-[#fafafa] text-[#09090b]'}`}>
      <header className="z-30 px-4 sm:px-10 py-3.5 bg-transparent flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={() => onNavigate('/')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${isDark ? 'border-white/20 bg-white/5 hover:bg-white/10 text-white' : 'border-black/20 bg-black/5 hover:bg-black/10 text-black'}`}>
            <ArrowLeft className="w-3.5 h-3.5" /><span>{TRADE_NAME}</span>
          </button>
          <a href="/legal" onClick={(e) => { e.preventDefault(); onNavigate('/legal'); }} className="flex items-center gap-2 pl-1">
            <span className="font-bold tracking-tight text-base sm:text-lg">{TRADE_NAME}</span>
          </a>
        </div>
        <nav aria-label="Legal policies navigation" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full py-0.5">
          {NAV_TABS.map(([id, label, path]) => (
            <a key={id} href={path} onClick={(e) => { e.preventDefault(); onNavigate(path); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${route === id ? 'bg-white text-black font-semibold' : isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-black/70 hover:text-black hover:bg-black/10'}`}>
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </header>

      <main className="flex-1 w-full max-w-[1080px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {route !== '404' && !legalDocs ? (
          <RouteSkeleton isDark={isDark} />
        ) : route === '404' || !activeDoc ? (
          <div className={`max-w-[560px] mx-auto rounded-2xl border p-8 sm:p-10 text-center space-y-5 ${isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-sm'}`}>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto"><AlertTriangle className="w-6 h-6" /></div>
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#FC4C01]">HTTP 404 · Page Not Found</div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Page not found</h1>
              <p className={`text-sm leading-relaxed ${muted}`}>
                The route <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs">{typeof window !== 'undefined' ? window.location.pathname : '/404'}</code> does not exist on {TRADE_NAME}.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button type="button" onClick={() => onNavigate('/')} className="px-5 py-2.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors">Return to {TRADE_NAME} Home</button>
              <button type="button" onClick={() => onNavigate('/legal')} className={`px-4 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${isDark ? 'border-white/15 bg-white/5 hover:bg-white/10 text-white' : 'border-black/15 bg-black/5 hover:bg-black/10 text-black'}`}>Legal Hub</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,720px)] gap-8 lg:gap-12 justify-center items-start">
            <aside className="hidden lg:block sticky top-20 space-y-4">
              <div className="text-[11px] font-mono uppercase tracking-wider opacity-50">On this page</div>
              <nav aria-label="Table of contents" className="space-y-1 border-l border-current/10 pl-3">
                <a href="#short-version" className={`block py-1 text-xs transition-colors ${isDark ? 'text-white/65 hover:text-white' : 'text-black/65 hover:text-black'}`}>The short version</a>
                {activeDoc.sections.map((sec) => (
                  <a key={sec.id} href={`#${sec.id}`} className={`block py-1 text-xs leading-snug transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black'}`}>{sec.number}. {sec.title}</a>
                ))}
                <a href="#version-history" className={`block py-1 text-xs transition-colors ${isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'}`}>Version history</a>
              </nav>
              <div className={`rounded-xl border p-3 text-[11px] space-y-1.5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-black/10 bg-black/[0.02]'}`}>
                <div className="font-semibold">Need help or have a question?</div>
                <div className={isDark ? 'text-white/60' : 'text-black/60'}>Support: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a></div>
                <div className={isDark ? 'text-white/60' : 'text-black/60'}>Privacy / DPDP: <a href={`mailto:${PRIVACY_EMAIL}`} className="underline">{PRIVACY_EMAIL}</a></div>
              </div>
            </aside>

            <article className="w-full max-w-[720px] mx-auto space-y-8">
              <header className="space-y-3 border-b border-current/10 pb-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#FC4C01]">
                  <span>{TRADE_NAME} Legal &amp; Trust</span><span>·</span><span>Last updated: {activeDoc.lastUpdated}</span><span>·</span><span>Effective: {activeDoc.effectiveDate}</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight">{activeDoc.title}</h1>
                <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-white/70' : 'text-black/70'}`}>{activeDoc.subtitle}</p>
              </header>

              <section id="short-version" className={`rounded-2xl border p-5 sm:p-6 space-y-3 scroll-mt-24 ${isDark ? 'border-white/15 bg-white/[0.03]' : 'border-black/15 bg-white shadow-xs'}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-[#FC4C01] font-semibold">The short version (Plain-English Summary)</h2>
                  <span className={`text-[11px] ${isDark ? 'text-white/45' : 'text-black/45'}`}>Non-binding summary · Full terms below govern</span>
                </div>
                <ul className="space-y-2 text-xs sm:text-sm leading-relaxed">
                  {activeDoc.shortVersionBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5"><Check className="w-4 h-4 text-[#FC4C01] shrink-0 mt-0.5" /><span>{b}</span></li>
                  ))}
                </ul>
              </section>

              {route === 'legal' && (
                <section className="space-y-4">
                  <h2 className="text-base font-bold tracking-tight">All {TRADE_NAME} Policies &amp; Notices</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {hubCards.map(([id, title, path, desc]) => (
                      <a key={id} href={path} onClick={(e) => { e.preventDefault(); onNavigate(path); }} className={`group rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${isDark ? 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]' : 'border-black/10 bg-white hover:border-black/25 shadow-2xs'}`}>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm group-hover:text-[#FC4C01] transition-colors">{title}</span>
                            <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-[#FC4C01] transition-all" />
                          </div>
                          <p className={`text-xs leading-relaxed ${muted}`}>{desc}</p>
                        </div>
                        <div className="text-[11px] font-mono text-[#FC4C01]">{path}</div>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              <div className="space-y-10">
                {activeDoc.sections.map((sec) => (
                  <section key={sec.id} id={sec.id} className="space-y-3.5 scroll-mt-24 border-b border-white/10 pb-8 last:border-b-0">
                    <div className="flex items-center justify-between gap-2 group">
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                        <span className="font-mono text-xs sm:text-sm text-zinc-400 mr-2">{sec.number}.</span>{sec.title}
                      </h2>
                      <button type="button" onClick={() => handleCopyAnchor(sec.id)} title={`Copy link to #${sec.id}`} className="opacity-40 hover:opacity-100 p-1.5 rounded-lg border border-transparent hover:border-white/20 text-xs flex items-center gap-1 cursor-pointer transition-opacity">
                        <LinkIcon className="w-3.5 h-3.5" />
                        {copiedAnchor === sec.id && <span className="text-[10px] font-mono text-white">Copied</span>}
                      </button>
                    </div>
                    {(sec.paragraphs || []).map((p, i) => <p key={i} className="text-sm sm:text-[15px] leading-relaxed text-zinc-300 font-normal">{p}</p>)}
                    {!!sec.bullets?.length && (
                      <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed text-zinc-300 font-normal">
                        {sec.bullets.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                    {sec.table && (
                      <div className="overflow-x-auto rounded-xl border border-current/15 mt-3">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                          <thead>
                            <tr className={isDark ? 'bg-white/[0.04] border-b border-white/10' : 'bg-black/[0.04] border-b border-black/10'}>
                              {sec.table.headers.map((h, i) => <th key={i} className="py-2.5 px-3 font-semibold whitespace-nowrap">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-current/10">
                            {sec.table.rows.map((row, ri) => (
                              <tr key={ri}>
                                {row.map((cell, ci) => (
                                  <td key={ci} className={`py-2.5 px-3 align-top leading-relaxed ${ci === 0 ? 'font-medium' : isDark ? 'text-white/75' : 'text-black/75'}`}>{cell}</td>
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

              {route === 'contact' && (
                <section id="contact-form" className={`rounded-2xl border p-6 space-y-4 scroll-mt-24 ${isDark ? 'border-white/15 bg-white/[0.02]' : 'border-black/15 bg-white shadow-xs'}`}>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Submit a Support or Grievance Ticket</h2>
                    <p className={`text-xs mt-1 ${muted}`}>Protected by per-IP rate limiting (max 5 submissions/hour). Grievance &amp; privacy tickets are acknowledged within 24 hours.</p>
                  </div>
                  {contactTicket ? (
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold"><CheckCircle2 className="w-4 h-4 shrink-0" /><span>Ticket Logged — Reference #{contactTicket.ticketId}</span></div>
                      <p className="opacity-85 leading-relaxed">We have recorded your inquiry from <strong>{contactEmail}</strong> under <strong>{contactCategory}</strong>. Acknowledgment SLA: <strong>{contactTicket.acknowledgmentSla}</strong>; Resolution SLA: <strong>{contactTicket.resolutionSla}</strong>.</p>
                      <button type="button" onClick={() => { setContactTicket(null); setContactMessage(''); }} className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold cursor-pointer">Submit another inquiry</button>
                    </div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-3.5 text-xs sm:text-sm">
                      <div className="hidden" aria-hidden="true">
                        <label>Website URL<input type="text" tabIndex={-1} autoComplete="off" value={honeypotWebsite} onChange={(e) => setHoneypotWebsite(e.target.value)} /></label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-semibold mb-1.5">Your Name</label>
                          <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1.5">Email Address *</label>
                          <input type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Category</label>
                        <select value={contactCategory} onChange={(e) => setContactCategory(e.target.value)} className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${isDark ? 'bg-[#121215] border-white/15 text-white focus:border-[#FC4C01]' : 'bg-neutral-50 border-black/15 text-black focus:border-[#FC4C01]'}`}>
                          {CONTACT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Message / Order ID / Details *</label>
                        <textarea required rows={4} value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="Include your account email, Dodo Payments order/receipt ID (if billing-related), and full details..." className={`${inputCls} resize-y`} />
                      </div>
                      {contactError && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs">{contactError}</div>}
                      <button type="submit" disabled={contactSubmitting} className="px-5 py-2.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors">
                        {contactSubmitting ? 'Submitting Ticket…' : 'Submit Support / Grievance Ticket'}
                      </button>
                    </form>
                  )}
                </section>
              )}

              <section id="version-history" className={`rounded-2xl border p-5 space-y-2.5 text-xs scroll-mt-24 ${isDark ? 'border-white/10 bg-white/[0.015]' : 'border-black/10 bg-black/[0.02]'}`}>
                <div className="font-mono uppercase tracking-wider opacity-60">Version History</div>
                {activeDoc.versionHistory.map((vh, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{vh.version} — {vh.date}</span>
                    <span className={muted}>{vh.changes}</span>
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
      <SiteFooter isDark={isDark} onNavigate={onNavigate} />
    </div>
  );
};
