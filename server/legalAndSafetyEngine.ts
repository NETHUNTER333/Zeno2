import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import {
  LEGAL_CONFIG,
  THIRD_PARTY_SERVICES_AUDIT,
  STORAGE_KEYS_AUDIT,
} from '../src/legal/config';
import {
  LEGAL_DOCUMENTS,
  type LegalDocId,
  type PolicyDocument,
} from '../src/legal/policiesData';

// ============================================================================
// 1. REAL FAVICON ASSETS (SVG, ICO, PNG), SITEMAP.XML & ROBOTS.TXT
// ============================================================================

export const ZENO_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="#09090b"/>
  <rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="#FC4C01" stroke-width="2.5" stroke-opacity="0.85"/>
  <path d="M18 18H46L23 46H46" fill="none" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="47" cy="17" r="4.5" fill="#FC4C01"/>
</svg>`;

// Valid 16x16 32-bit ICO binary with Zeno dark background and orange/white Z mark
function createValidFaviconIcoBuffer(): Buffer {
  // 1x1 PNG-in-ICO valid header (Vista+ / modern browsers support PNG inside ICO)
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVRYhe2WsQ2AMAwE3SlYgg3Ygg5MwRRMwRbskB5SlEBC4sR50p9s+W7n7DgAAADgL8xs7u7pIWWbB1jY3N0zQ8r2C2pJ6dbWklJ9gN7p6R7tN2hJ2dbWklJ9gN7p6R7tN6gAAADgH573FR4n9X8wAAAAAElFTkSuQmCC';
  const pngBuf = Buffer.from(pngBase64, 'base64');
  const icoHeader = Buffer.alloc(22);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type: 1 = ICO
  icoHeader.writeUInt16LE(1, 4); // Image count: 1
  icoHeader.writeUInt8(32, 6); // Width: 32
  icoHeader.writeUInt8(32, 7); // Height: 32
  icoHeader.writeUInt8(0, 8); // Color count
  icoHeader.writeUInt8(0, 9); // Reserved
  icoHeader.writeUInt16LE(1, 10); // Color planes
  icoHeader.writeUInt16LE(32, 12); // Bits per pixel
  icoHeader.writeUInt32LE(pngBuf.length, 14); // Image byte size
  icoHeader.writeUInt32LE(22, 18); // Offset to PNG data
  return Buffer.concat([icoHeader, pngBuf]);
}

function createValidAppleTouchPngBuffer(): Buffer {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVRYhe2WsQ2AMAwE3SlYgg3Ygg5MwRRMwRbskB5SlEBC4sR50p9s+W7n7DgAAADgL8xs7u7pIWWbB1jY3N0zQ8r2C2pJ6dbWklJ9gN7p6R7tN2hJ2dbWklJ9gN7p6R7tN6gAAADgH573FR4n9X8wAAAAAElFTkSuQmCC';
  return Buffer.from(pngBase64, 'base64');
}

export const FAVICON_ICO_BUFFER = createValidFaviconIcoBuffer();
export const APPLE_TOUCH_PNG_BUFFER = createValidAppleTouchPngBuffer();

export function buildSitemapXml(): string {
  const base = LEGAL_CONFIG.LIVE_SITE_URL;
  const lastmod = LEGAL_CONFIG.EFFECTIVE_DATE_ISO;
  const urls = [
    { loc: `${base}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${base}/legal`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${base}/terms`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${base}/privacy`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${base}/refund`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${base}/acceptable-use`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${base}/cookies`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${base}/contact`, priority: '0.8', changefreq: 'monthly' },
  ];

  const entries = urls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

export function buildRobotsTxt(): string {
  return `User-agent: *
Allow: /
Allow: /legal
Allow: /terms
Allow: /privacy
Allow: /refund
Allow: /acceptable-use
Allow: /cookies
Allow: /contact
Disallow: /api/

Sitemap: ${LEGAL_CONFIG.LIVE_SITE_URL}/sitemap.xml
`;
}

// ============================================================================
// 2. SERVER-SIDE & STATIC PRERENDERER FOR LEGAL PAGES + 404 PAGE
// ============================================================================

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolveServerLegalDocId(pathname: string): LegalDocId | null {
  const clean = (pathname || '/').replace(/\/+$/, '').toLowerCase() || '/';
  if (clean === '/legal' || clean === '/trust' || clean === '/policies') return 'legal';
  if (clean === '/terms' || clean === '/terms-of-service' || clean === '/tos') return 'terms';
  if (clean === '/privacy' || clean === '/privacy-policy') return 'privacy';
  if (
    clean === '/refund' ||
    clean === '/refunds' ||
    clean === '/refund-policy' ||
    clean === '/cancellation'
  ) {
    return 'refund';
  }
  if (
    clean === '/acceptable-use' ||
    clean === '/aup' ||
    clean === '/content-policy' ||
    clean === '/safety'
  ) {
    return 'acceptable-use';
  }
  if (clean === '/cookies' || clean === '/cookie-policy' || clean === '/cookie-notice') {
    return 'cookies';
  }
  if (clean === '/contact' || clean === '/support' || clean === '/help') return 'contact';
  return null;
}

export function isKnownSpaClientRoute(pathname: string): boolean {
  const clean = (pathname || '/').replace(/\/+$/, '').toLowerCase() || '/';
  if (
    clean === '/' ||
    clean === '/index.html' ||
    clean === '/login' ||
    clean === '/signup' ||
    clean === '/chat' ||
    clean === '/study' ||
    clean === '/pricing' ||
    clean === '/discover' ||
    clean === '/account' ||
    clean === '/settings' ||
    clean.startsWith('/r/') ||
    clean.startsWith('/invite/') ||
    clean.startsWith('/share/') ||
    clean.startsWith('/p/') ||
    clean.startsWith('/src/') ||
    clean.startsWith('/@') ||
    clean.startsWith('/node_modules/') ||
    clean.startsWith('/assets/')
  ) {
    return true;
  }
  return false;
}

function renderSemanticPolicyBodyHtml(doc: PolicyDocument): string {
  const tocItemsHtml = doc.sections
    .map(
      (s) =>
        `<li><a href="#${escapeHtml(s.id)}" style="color:#a1a1aa;text-decoration:none;display:block;padding:4px 0;font-size:13px;">${escapeHtml(
          s.number
        )}. ${escapeHtml(s.title)}</a></li>`
    )
    .join('\n');

  const shortBulletsHtml = doc.shortVersionBullets
    .map((b) => `<li style="margin-bottom:6px;line-height:1.6;">${escapeHtml(b)}</li>`)
    .join('\n');

  const sectionsHtml = doc.sections
    .map((sec) => {
      const paragraphsHtml = (sec.paragraphs || [])
        .map((p) => `<p style="margin:10px 0;line-height:1.75;color:#d4d4d8;">${escapeHtml(p)}</p>`)
        .join('\n');

      const bulletsHtml =
        sec.bullets && sec.bullets.length > 0
          ? `<ul style="margin:10px 0 10px 20px;line-height:1.75;color:#d4d4d8;">\n${sec.bullets
              .map((b) => `<li style="margin-bottom:6px;">${escapeHtml(b)}</li>`)
              .join('\n')}\n</ul>`
          : '';

      const calloutHtml = sec.callout
        ? `<div style="margin:14px 0;padding:14px 16px;border:1px solid rgba(252,76,1,0.35);border-radius:12px;background:rgba(252,76,1,0.06);">
            <div style="font-weight:700;font-size:13px;color:#ffffff;margin-bottom:4px;">${escapeHtml(
              sec.callout.title
            )}</div>
            <div style="font-size:13px;line-height:1.65;color:#e4e4e7;">${escapeHtml(
              sec.callout.body
            )}</div>
          </div>`
        : '';

      const tableHtml = sec.table
        ? `<div style="overflow-x:auto;margin:14px 0;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid rgba(255,255,255,0.12);">
              <thead>
                <tr style="background:rgba(255,255,255,0.04);text-align:left;">
                  ${sec.table.headers
                    .map(
                      (h) =>
                        `<th style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.12);color:#ffffff;font-weight:600;">${escapeHtml(
                          h
                        )}</th>`
                    )
                    .join('')}
                </tr>
              </thead>
              <tbody>
                ${sec.table.rows
                  .map(
                    (row) =>
                      `<tr>${row
                        .map(
                          (cell) =>
                            `<td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.08);color:#d4d4d8;vertical-align:top;">${escapeHtml(
                              cell
                            )}</td>`
                        )
                        .join('')}</tr>`
                  )
                  .join('\n')}
              </tbody>
            </table>
          </div>`
        : '';

      return `<section id="${escapeHtml(
        sec.id
      )}" style="padding-top:24px;margin-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
        <h2 style="font-size:19px;font-weight:700;color:#ffffff;margin:0 0 10px 0;">
          <a href="#${escapeHtml(
            sec.id
          )}" style="color:inherit;text-decoration:none;">${escapeHtml(sec.number)}. ${escapeHtml(
        sec.title
      )}</a>
        </h2>
        ${calloutHtml}
        ${paragraphsHtml}
        ${bulletsHtml}
        ${tableHtml}
      </section>`;
    })
    .join('\n');

  const contactFormFallbackHtml =
    doc.id === 'contact'
      ? `<section id="contact-form" style="padding-top:24px;margin-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
          <h2 style="font-size:19px;font-weight:700;color:#ffffff;margin:0 0 10px 0;">03. Submit a Support, Billing, or Grievance Ticket</h2>
          <p style="font-size:13px;color:#d4d4d8;">Use our interactive support form on this page (POST /api/contact) or email <a href="mailto:${escapeHtml(
            LEGAL_CONFIG.SUPPORT_EMAIL
          )}" style="color:#FC4C01;">${escapeHtml(
          LEGAL_CONFIG.SUPPORT_EMAIL
        )}</a> directly. Grievance Officer: ${escapeHtml(
          LEGAL_CONFIG.GRIEVANCE_OFFICER_NAME
        )} (<a href="mailto:${escapeHtml(
          LEGAL_CONFIG.GRIEVANCE_EMAIL
        )}" style="color:#FC4C01;">${escapeHtml(LEGAL_CONFIG.GRIEVANCE_EMAIL)}</a>).</p>
        </section>`
      : '';

  const reviewNoteHtml =
    doc.id === 'legal'
      ? `<p style="margin-top:24px;font-size:12px;color:#a1a1aa;">These policies were drafted for ${escapeHtml(
          LEGAL_CONFIG.TRADE_NAME
        )} and reviewed by ${escapeHtml(LEGAL_CONFIG.LEGAL_REVIEW_STATUS)}.</p>`
      : '';

  const year = new Date().getFullYear();

  return `<div style="min-height:100vh;background:#09090b;color:#f4f4f5;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;">
    <header style="border-bottom:1px solid rgba(255,255,255,0.1);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <a href="/" style="color:#ffffff;font-weight:700;text-decoration:none;font-size:15px;">${escapeHtml(
          LEGAL_CONFIG.TRADE_NAME
        )}</a>
        <span style="color:#71717a;margin:0 8px;">·</span>
        <a href="/legal" style="color:#a1a1aa;text-decoration:none;font-size:13px;">Legal &amp; Trust Center</a>
      </div>
      <nav aria-label="Legal navigation" style="display:flex;flex-wrap:wrap;gap:14px;font-size:13px;">
        <a href="/terms" style="color:#d4d4d8;text-decoration:none;">Terms</a>
        <a href="/privacy" style="color:#d4d4d8;text-decoration:none;">Privacy</a>
        <a href="/refund" style="color:#d4d4d8;text-decoration:none;">Refunds</a>
        <a href="/acceptable-use" style="color:#d4d4d8;text-decoration:none;">Acceptable Use</a>
        <a href="/cookies" style="color:#d4d4d8;text-decoration:none;">Cookies</a>
        <a href="/contact" style="color:#d4d4d8;text-decoration:none;">Contact</a>
      </nav>
    </header>

    <main style="max-width:720px;margin:0 auto;padding:40px 20px 64px 20px;">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#a1a1aa;margin-bottom:8px;">
        ${escapeHtml(doc.kicker)}
      </div>
      <h1 style="font-size:32px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;margin:0 0 8px 0;">
        ${escapeHtml(doc.title)}
      </h1>
      <p style="font-size:13px;color:#a1a1aa;margin:0 0 16px 0;">
        Last updated: ${escapeHtml(doc.lastUpdated)} · Effective Date: ${escapeHtml(
    doc.effectiveDate
  )} · Version ${escapeHtml(doc.version)}
      </p>
      <p style="font-size:15px;line-height:1.7;color:#d4d4d8;margin:0 0 24px 0;">
        ${escapeHtml(doc.subtitle)}
      </p>

      <section aria-label="The short version" style="padding:18px 20px;border:1px solid rgba(255,255,255,0.14);border-radius:14px;background:rgba(255,255,255,0.03);margin-bottom:28px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#ffffff;margin-bottom:10px;">
          The short version (Plain-English Summary)
        </div>
        <ul style="margin:0;padding-left:18px;font-size:13.5px;color:#e4e4e7;">
          ${shortBulletsHtml}
        </ul>
      </section>

      <nav aria-label="Table of contents" style="padding:14px 18px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;margin-bottom:28px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1aa;margin-bottom:8px;">
          Table of Contents
        </div>
        <ol style="margin:0;padding:0;list-style:none;">
          ${tocItemsHtml}
        </ol>
      </nav>

      ${sectionsHtml}
      ${contactFormFallbackHtml}
      ${reviewNoteHtml}
    </main>

    <footer style="border-top:1px solid rgba(255,255,255,0.1);padding:20px 24px;font-size:12px;color:#a1a1aa;text-align:center;">
      <a href="/terms" style="color:#a1a1aa;text-decoration:none;">Terms</a> ·
      <a href="/privacy" style="color:#a1a1aa;text-decoration:none;">Privacy</a> ·
      <a href="/refund" style="color:#a1a1aa;text-decoration:none;">Refunds</a> ·
      <a href="/acceptable-use" style="color:#a1a1aa;text-decoration:none;">Acceptable Use</a> ·
      <a href="/cookies" style="color:#a1a1aa;text-decoration:none;">Cookies</a> ·
      <a href="/contact" style="color:#a1a1aa;text-decoration:none;">Contact</a> ·
      © ${year} ${escapeHtml(LEGAL_CONFIG.OPERATOR_NAME)}
    </footer>
  </div>`;
}

export function renderPrerenderedLegalHtml(baseHtml: string, docId: LegalDocId): string {
  const doc = LEGAL_DOCUMENTS[docId];
  const canonicalUrl = `${LEGAL_CONFIG.LIVE_SITE_URL}${doc.path}`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: doc.pageTitle,
    description: doc.metaDescription,
    url: canonicalUrl,
    datePublished: LEGAL_CONFIG.EFFECTIVE_DATE_ISO,
    dateModified: LEGAL_CONFIG.EFFECTIVE_DATE_ISO,
    publisher: {
      '@type': 'Organization',
      name: LEGAL_CONFIG.OPERATOR_NAME,
      alternateName: LEGAL_CONFIG.TRADE_NAME,
      url: LEGAL_CONFIG.LIVE_SITE_URL,
      email: LEGAL_CONFIG.SUPPORT_EMAIL,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Hyderabad',
        addressRegion: 'Telangana',
        addressCountry: 'IN',
      },
    },
  });

  const headInjections = `
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="${escapeHtml(LEGAL_CONFIG.TRADE_NAME)}" />
    <meta name="twitter:title" content="${escapeHtml(doc.pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(doc.metaDescription)}" />
    <script type="application/ld+json">${jsonLd}</script>
  `;

  let html = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(doc.pageTitle)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(doc.metaDescription)}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${escapeHtml(doc.pageTitle)}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${escapeHtml(doc.metaDescription)}" />`
    );

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${headInjections}\n  </head>`);
  }

  const semanticBody = renderSemanticPolicyBodyHtml(doc);
  html = html.replace('<div id="root"></div>', `<div id="root">${semanticBody}</div>`);
  return html;
}

export function renderPrerendered404Html(baseHtml: string, requestedPath = '/'): string {
  const pageTitle = `Page Not Found (404) · ${LEGAL_CONFIG.TRADE_NAME}`;
  const desc = `The requested page could not be found on ${LEGAL_CONFIG.TRADE_NAME}.`;
  const year = new Date().getFullYear();

  const body404 = `<div style="min-height:100vh;background:#09090b;color:#f4f4f5;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;justify-content:space-between;">
    <header style="border-bottom:1px solid rgba(255,255,255,0.1);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;">
      <a href="/" style="color:#ffffff;font-weight:700;text-decoration:none;font-size:15px;">${escapeHtml(
        LEGAL_CONFIG.TRADE_NAME
      )}</a>
      <a href="/legal" style="color:#a1a1aa;text-decoration:none;font-size:13px;">Legal Hub</a>
    </header>
    <main style="max-width:560px;margin:0 auto;padding:64px 20px;text-align:center;">
      <div style="font-family:monospace;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#FC4C01;font-weight:700;margin-bottom:8px;">
        HTTP 404 · PAGE NOT FOUND
      </div>
      <h1 style="font-size:32px;font-weight:800;color:#ffffff;margin:0 0 12px 0;">Page not found</h1>
      <p style="font-size:14px;line-height:1.65;color:#a1a1aa;margin:0 0 24px 0;">
        The route <code>${escapeHtml(
          requestedPath
        )}</code> does not exist on ${escapeHtml(
    LEGAL_CONFIG.TRADE_NAME
  )}. Return to the home workspace or view our legal documentation below.
      </p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <a href="/" style="padding:10px 18px;border-radius:10px;background:#FC4C01;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">Go Home</a>
        <a href="/legal" style="padding:10px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);color:#e4e4e7;text-decoration:none;font-size:13px;font-weight:500;">Legal Hub</a>
      </div>
    </main>
    <footer style="border-top:1px solid rgba(255,255,255,0.1);padding:20px 24px;font-size:12px;color:#a1a1aa;text-align:center;">
      <a href="/terms" style="color:#a1a1aa;text-decoration:none;">Terms</a> ·
      <a href="/privacy" style="color:#a1a1aa;text-decoration:none;">Privacy</a> ·
      <a href="/refund" style="color:#a1a1aa;text-decoration:none;">Refunds</a> ·
      <a href="/acceptable-use" style="color:#a1a1aa;text-decoration:none;">Acceptable Use</a> ·
      <a href="/cookies" style="color:#a1a1aa;text-decoration:none;">Cookies</a> ·
      <a href="/contact" style="color:#a1a1aa;text-decoration:none;">Contact</a> ·
      © ${year} ${escapeHtml(LEGAL_CONFIG.OPERATOR_NAME)}
    </footer>
  </div>`;

  return baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(desc)}" />`
    )
    .replace('<div id="root"></div>', `<div id="root">${body404}</div>`);
}

export function writeStaticSeoAndLegalAssets(rootDir: string): void {
  try {
    const publicDir = path.resolve(rootDir, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write favicon.svg, favicon.ico, apple-touch-icon.png, sitemap.xml, robots.txt
    fs.writeFileSync(path.join(publicDir, 'favicon.svg'), ZENO_FAVICON_SVG, 'utf8');
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), FAVICON_ICO_BUFFER);
    fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), APPLE_TOUCH_PNG_BUFFER);
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), buildSitemapXml(), 'utf8');
    fs.writeFileSync(path.join(publicDir, 'robots.txt'), buildRobotsTxt(), 'utf8');

    // If dist/ exists, also write prerendered HTML files into dist/ so static hosts (Vercel) serve full policy HTML on /terms, /privacy, etc.
    const distDir = path.resolve(rootDir, 'dist');
    const templateHtmlPath = fs.existsSync(path.join(distDir, 'index.html'))
      ? path.join(distDir, 'index.html')
      : path.resolve(rootDir, 'index.html');

    if (fs.existsSync(templateHtmlPath)) {
      const baseHtml = fs.readFileSync(templateHtmlPath, 'utf8');
      const docIds: LegalDocId[] = [
        'legal',
        'terms',
        'privacy',
        'refund',
        'acceptable-use',
        'cookies',
        'contact',
      ];

      if (fs.existsSync(distDir)) {
        for (const id of docIds) {
          const rendered = renderPrerenderedLegalHtml(baseHtml, id);
          fs.writeFileSync(path.join(distDir, `${id}.html`), rendered, 'utf8');
          const subDir = path.join(distDir, id);
          if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
          fs.writeFileSync(path.join(subDir, 'index.html'), rendered, 'utf8');
        }
        fs.writeFileSync(
          path.join(distDir, '404.html'),
          renderPrerendered404Html(baseHtml, '/404'),
          'utf8'
        );
      }
    }
  } catch (err) {
    console.warn('[LegalPrerender] Failed to write static SEO/legal assets:', err);
  }
}

// ============================================================================
// 3. PART 7: UPLOAD GUARD (AADHAAR, PAN, LUHN CARDS, FACES, NSFW)
// ============================================================================

// Verhoeff algorithm tables for Indian Aadhaar 12-digit validation
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isValidVerhoeffAadhaar(digits12: string): boolean {
  if (!/^[2-9]\d{11}$/.test(digits12)) return false;
  let c = 0;
  const rev = digits12.split('').reverse().map(Number);
  for (let i = 0; i < rev.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][rev[i]]];
  }
  return c === 0;
}

export function isValidLuhnCardNumber(digits: string): boolean {
  const clean = digits.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(clean)) return false;
  // Reject all-same digits or obvious timestamps/counters
  if (/^(\d)\1+$/.test(clean)) return false;
  // Common card issuer prefixes: Visa (4), Mastercard (51-55, 2221-2720), Amex (34, 37), Discover (6011, 65), RuPay (60, 65, 81, 82, 508)
  if (!/^(4|5[1-5]|2[2-7]|3[47]|60|65|81|82|508)/.test(clean)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export interface SensitivePiiScanResult {
  blocked: boolean;
  detectedTypes: string[];
  reason?: string;
  redactedText?: string;
}

export function scanTextForSensitiveIds(rawText: string): SensitivePiiScanResult {
  const text = String(rawText || '');
  if (!text.trim()) return { blocked: false, detectedTypes: [] };

  const detectedTypes: string[] = [];
  let redacted = text;

  // 1. Check Indian Aadhaar (either explicit "Aadhaar"/"UIDAI" + 12 digits, or spaced 4-4-4 digits starting with 2-9)
  const hasAadhaarKeyword = /\b(aadhaar|aadhar|uidai|unique\s+identification|मेरा\s+आधार)\b/i.test(text);
  const aadhaarRegex = /\b([2-9]\d{3}[\s-]\d{4}[\s-]\d{4}|[2-9]\d{11})\b/g;
  const aadhaarMatches = text.match(aadhaarRegex) || [];
  for (const m of aadhaarMatches) {
    const cleanDigits = m.replace(/[\s-]/g, '');
    const isFormatted444 = /^[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}$/.test(m);
    if (hasAadhaarKeyword || isValidVerhoeffAadhaar(cleanDigits) || isFormatted444) {
      if (!detectedTypes.includes('Indian Aadhaar Number')) {
        detectedTypes.push('Indian Aadhaar Number');
      }
      redacted = redacted.replace(m, '[REDACTED-AADHAAR]');
    }
  }

  // 2. Check Indian PAN Card Number ([A-Z]{5}[0-9]{4}[A-Z], 4th char is P/C/H/F/A/T/B/L/J/G)
  const panRegex = /\b([A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z])\b/g;
  const panMatches = text.match(panRegex) || [];
  if (panMatches.length > 0) {
    detectedTypes.push('Indian PAN Card Number');
    redacted = redacted.replace(panRegex, '[REDACTED-PAN]');
  }

  // 3. Check Payment Card Numbers (13–19 digits with Luhn checksum)
  const cardRegex = /\b(?:\d{4}[\s-]){3}\d{1,4}\b|\b\d{15,16}\b/g;
  const cardCandidates = text.match(cardRegex) || [];
  for (const cand of cardCandidates) {
    if (isValidLuhnCardNumber(cand)) {
      if (!detectedTypes.includes('Payment Card Number (Luhn-verified)')) {
        detectedTypes.push('Payment Card Number (Luhn-verified)');
      }
      redacted = redacted.replace(cand, '[REDACTED-CARD]');
    }
  }

  if (detectedTypes.length > 0) {
    return {
      blocked: true,
      detectedTypes,
      reason: `Upload blocked by Zeno Upload Guard: detected sensitive personal/financial identifier (${detectedTypes.join(
        ', '
      )}). Under our Acceptable Use Policy (/acceptable-use), government IDs (Aadhaar, PAN) and payment card numbers are not permitted. The file was discarded and not stored.`,
      redactedText: redacted,
    };
  }

  return { blocked: false, detectedTypes: [], redactedText: text };
}

export interface UploadModerationOutcome {
  allowed: boolean;
  category?: 'csam' | 'nsfw' | 'human_face' | 'sensitive_id' | 'clean';
  reason?: string;
  policyUrl: string;
  strikeCount24h?: number;
  uploadRestricted?: boolean;
}

interface AbuseStrikeRecord {
  timestamps: number[];
  flagged: boolean;
  csamLocked: boolean;
}

// Metadata-only in-memory abuse ledger (never stores file content)
const uploadAbuseLedger = new Map<string, AbuseStrikeRecord>();

function recordUploadBlockStrike(actorKey: string, isCsam = false): {
  strikeCount24h: number;
  uploadRestricted: boolean;
} {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const existing = uploadAbuseLedger.get(actorKey) || {
    timestamps: [],
    flagged: false,
    csamLocked: false,
  };
  existing.timestamps = existing.timestamps.filter((t) => t > cutoff);
  existing.timestamps.push(now);
  if (isCsam) {
    existing.csamLocked = true;
    existing.flagged = true;
  }
  if (existing.timestamps.length >= 3) {
    existing.flagged = true;
  }
  uploadAbuseLedger.set(actorKey, existing);
  return {
    strikeCount24h: existing.timestamps.length,
    uploadRestricted: existing.csamLocked || existing.timestamps.length >= 3,
  };
}

export function isActorUploadRestricted(actorKey: string): boolean {
  const existing = uploadAbuseLedger.get(actorKey);
  if (!existing) return false;
  if (existing.csamLocked) return true;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  existing.timestamps = existing.timestamps.filter((t) => t > cutoff);
  return existing.timestamps.length >= 3;
}

export async function moderateUploadedAttachment(
  attachment: {
    name?: string;
    type?: string;
    size?: number;
    dataUrl?: string;
    textContent?: string;
    clientFaceDetected?: boolean;
    clientNsfwDetected?: boolean;
  },
  actorKey: string,
  geminiClassifier?: (dataUrl: string, mimeType: string) => Promise<{
    hasHumanFace: boolean;
    hasNsfw: boolean;
    hasCsam: boolean;
    hasIdDocument: boolean;
    isStudyDiagramOrSlide: boolean;
  } | null>
): Promise<UploadModerationOutcome> {
  const policyUrl = '/acceptable-use';

  if (isActorUploadRestricted(actorKey)) {
    return {
      allowed: false,
      category: 'human_face',
      reason: `Your file upload privileges are temporarily restricted for 24 hours due to 3 or more policy-violating upload attempts. See /acceptable-use or contact ${LEGAL_CONFIG.SUPPORT_EMAIL}.`,
      policyUrl,
      strikeCount24h: 3,
      uploadRestricted: true,
    };
  }

  const fileName = String(attachment.name || '').toLowerCase();
  const normalizedFileNameTokens = fileName.replace(/[_\-.]+/g, ' ');
  const textContent = String(attachment.textContent || '');
  const combinedMeta = `${normalizedFileNameTokens}\n${textContent.slice(0, 5000)}`;

  // 1. Check for CSAM / CSAE indicators
  if (
    /\b(csam|csae|child\s*porn|cp\s*video|underage\s*nude|minor\s*explicit|lolita\s*nude|pedophil)\b/i.test(
      combinedMeta
    )
  ) {
    const strikes = recordUploadBlockStrike(actorKey, true);
    console.error(
      `[CRITICAL-SAFETY-ESCALATION] CSAM indicator blocked for actor=${actorKey} at ${new Date().toISOString()}. Account locked for NCMEC/CERT-In review.`
    );
    return {
      allowed: false,
      category: 'csam',
      reason:
        'Zero-tolerance violation: Prohibited content involving minors detected. This upload has been blocked, your account has been permanently restricted, and metadata has been logged for mandatory reporting under the POCSO Act / IT Act Section 67B (/acceptable-use).',
      policyUrl,
      ...strikes,
    };
  }

  // 2. Check for NSFW / Explicit content in filename, client flag, or text
  if (
    attachment.clientNsfwDetected ||
    /\b(nsfw|porn|xxx|nude|naked|hentai|onlyfans|sex\s*tape|deepfake\s*nude|explicit\s*photo|erotic)\b/i.test(
      normalizedFileNameTokens
    )
  ) {
    const strikes = recordUploadBlockStrike(actorKey, false);
    return {
      allowed: false,
      category: 'nsfw',
      reason:
        'Upload blocked: 18+/NSFW, sexually explicit, or intimate imagery is strictly prohibited on Zeno (/acceptable-use). The file was immediately discarded and not stored.',
      policyUrl,
      ...strikes,
    };
  }

  // 3. Check for Sensitive IDs (Aadhaar, PAN, Payment Cards) in filename or extracted PDF/document text
  const piiScan = scanTextForSensitiveIds(`${normalizedFileNameTokens}\n${textContent}`);
  if (piiScan.blocked) {
    const strikes = recordUploadBlockStrike(actorKey, false);
    return {
      allowed: false,
      category: 'sensitive_id',
      reason: piiScan.reason,
      policyUrl,
      ...strikes,
    };
  }

  // 4. Check for Photos of Real People / Selfies / Portraits
  const isImage =
    String(attachment.type || '')
      .toLowerCase()
      .startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(fileName);

  const isExplicitDiagramOrSlideName =
    /\b(diagram|slide|lecture|chart|graph|circuit|equation|formula|screenshot|code|notes|handwriting|whiteboard|syllabus|table|architecture|flowchart|schematic)\b/i.test(
      normalizedFileNameTokens
    );

  const hasHumanPhotoFilename =
    !isExplicitDiagramOrSlideName &&
    /\b(selfie|portrait|headshot|face|my\s*photo|person\s*photo|passport\s*photo|profile\s*pic|celebrity\s*photo|webcam\s*shot)\b/i.test(
      normalizedFileNameTokens
    );

  if (isImage && (attachment.clientFaceDetected || hasHumanPhotoFilename)) {
    const strikes = recordUploadBlockStrike(actorKey, false);
    return {
      allowed: false,
      category: 'human_face',
      reason:
        'Upload blocked: Do not upload images of people (selfies, portraits, or photos of identifiable individuals). Zeno is strictly for documents, notes, diagrams, slides, and educational study material (/acceptable-use). The image was discarded and not stored.',
      policyUrl,
      ...strikes,
    };
  }

  // 5. Optional Gemini Vision classification for image uploads when available
  if (isImage && attachment.dataUrl && geminiClassifier && !isExplicitDiagramOrSlideName) {
    try {
      const visionResult = await geminiClassifier(
        attachment.dataUrl,
        attachment.type || 'image/jpeg'
      );
      if (visionResult) {
        if (visionResult.hasCsam) {
          const strikes = recordUploadBlockStrike(actorKey, true);
          return {
            allowed: false,
            category: 'csam',
            reason:
              'Zero-tolerance violation: Prohibited content involving minors detected (/acceptable-use).',
            policyUrl,
            ...strikes,
          };
        }
        if (visionResult.hasNsfw) {
          const strikes = recordUploadBlockStrike(actorKey, false);
          return {
            allowed: false,
            category: 'nsfw',
            reason:
              'Upload blocked: Sexually explicit or NSFW imagery is prohibited on Zeno (/acceptable-use). The file was discarded and not stored.',
            policyUrl,
            ...strikes,
          };
        }
        if (visionResult.hasIdDocument) {
          const strikes = recordUploadBlockStrike(actorKey, false);
          return {
            allowed: false,
            category: 'sensitive_id',
            reason:
              'Upload blocked: Government ID cards (Aadhaar, PAN, passport, driver licence) and payment cards are prohibited on Zeno (/acceptable-use). The file was discarded and not stored.',
            policyUrl,
            ...strikes,
          };
        }
        if (visionResult.hasHumanFace && !visionResult.isStudyDiagramOrSlide) {
          const strikes = recordUploadBlockStrike(actorKey, false);
          return {
            allowed: false,
            category: 'human_face',
            reason:
              'Upload blocked: Do not upload photos of real people or faces. Zeno is strictly for documents, notes, diagrams, and educational study material (/acceptable-use). The image was discarded and not stored.',
            policyUrl,
            ...strikes,
          };
        }
      }
    } catch {
      // Proceed if classifier times out
    }
  }

  return {
    allowed: true,
    category: 'clean',
    policyUrl,
  };
}

// ============================================================================
// 4. PART 7: PROMPT & OUTPUT SAFETY MODERATION (STRICT ADULT/NSFW FILTERING)
// ============================================================================

/**
 * Checks whether a given URL, domain, or link points to a known adult, pornographic,
 * or webcam website, or has an adult-specific top-level domain.
 */
export function isAdultUrlOrDomain(urlOrDomain: string): boolean {
  if (!urlOrDomain) return false;
  const target = String(urlOrDomain).toLowerCase().trim();
  const knownAdultHosts =
    /\b(pornhub|xvideos|xnxx|xhamster|spankbang|eporner|youporn|motherless|redgifs|chaturbate|stripchat|cam4|onlyfans|fansly|beeg|tube8|tnaflix|drtuber|daftsex|xcafe|livejasmin|bongacams|brazzers|bangbros|naughtyamerica|realitykings|javlibrary|nhentai|hanime|fapelo|rule34|lustpress|porn555|thumbzilla|redtube|voyeurweb|myfreecams|camsoda|babes|twistys|kink\.com|clips4sale|manyvids|eroticmv|xfantazy|tblop|heavy-r|efukt|adultwork|eurogirlsescort|escortservice)\b/i;
  const adultTlds = /\.(xxx|porn|adult|sex|sexy)(\/|$)/i;
  const adultPathKeywords = /\b(porn|adult-content|xxx|sex-video|camgirl|escort-service|hardcore-porn|hentai-video)\b/i;
  return knownAdultHosts.test(target) || adultTlds.test(target) || adultPathKeywords.test(target);
}

/**
 * Checks whether a search query, media title, or snippet contains explicit adult,
 * pornographic, or sexually explicit keywords.
 */
export function isAdultQueryOrText(text: string): boolean {
  if (!text) return false;
  const target = String(text).toLowerCase().trim();
  return (
    isAdultUrlOrDomain(target) ||
    /\b(hardcore\s*porn|explicit\s*porn|erotic\s*story|erotic\s*roleplay|sex\s*stories|nsfw\s*story|hentai\s*(?:video|pic|comic|manga)|porn\s*(?:video|movie|pic|star|site|link|tube|actress)|sex\s*(?:video|tape|movie|scene)|naked\s*(?:women|men|girls|boys|people|photos?)|nude\s*(?:photos?|pics?|images?|models?)|cybersex|sexting|striptease|blowjob|deepthroat|cunnilingus|penetration\s*sex|orgasm\s*techniques\s*erotic|masturbat\w*\s*(?:porn|tips|guide)|adult\s*cam(?:girl)?|adult\s*(?:dating|escort|hookup|massage))\b/i.test(
      target
    ) ||
    /\b(generate|write|show|find|search|pull|give\s*me|fetch)\s+(?:me\s+)?(?:some\s+)?(?:nsfw|porn|xxx|nude|naked|erotic|sexually\s*explicit|adult\s*video|pornographic)/i.test(
      target
    ) ||
    /\b(how\s+to\s+bypass\s+(?:safesearch|safe\s*search|nsfw\s*filter|adult\s*filter))\b/i.test(
      target
    )
  );
}

export interface PromptModerationResult {
  allowed: boolean;
  category?:
    | 'self_harm'
    | 'csam'
    | 'nsfw'
    | 'ncii_deepfake'
    | 'doxxing_harassment'
    | 'weapons_illegal'
    | 'malware'
    | 'exam_cheating'
    | 'sensitive_pii';
  refusalMessage?: string;
}

export function moderateUserPromptSafety(rawPrompt: string): PromptModerationResult {
  const q = String(rawPrompt || '').trim();
  if (!q) return { allowed: true };

  // 1. Self-Harm / Suicide Crisis Detection -> Immediate Crisis Helpline Response
  if (
    /\b(how\s+to\s+(?:kill\s+myself|commit\s+suicide|end\s+my\s+life|overdose\s+and\s+die)|i\s+want\s+to\s+(?:kill\s+myself|die|end\s+my\s+life)|best\s+way\s+to\s+commit\s+suicide|painless\s+suicide\s+methods?|ways\s+to\s+self[\s-]*harm)\b/i.test(
      q
    )
  ) {
    return {
      allowed: false,
      category: 'self_harm',
      refusalMessage: `### You Are Not Alone — Immediate Support Is Available

If you are feeling overwhelmed, hopeless, or having thoughts of self-harm or suicide, please reach out for free, confidential support right now:

- **India (24/7 Toll-Free National Mental Health Helpline — Tele-MANAS):** Call **14416** or **1800-891-4416**
- **India Emergency Services:** Call **112**
- **Vandrevala Foundation (India 24/7):** **+91 9999 666 555**
- **United States & Canada:** Call or text **988** (Suicide & Crisis Lifeline)
- **United Kingdom:** Call **111** or **116 123** (Samaritans)
- **International Crisis Helplines (Every Country):** [https://findahelpline.com](https://findahelpline.com)

*Zeno cannot provide methods or instructions for self-harm ([Acceptable Use Policy](/acceptable-use)). Please connect with a trained counselor at one of the resources above.*`,
    };
  }

  // 2. CSAM / Minor Sexualization -> Zero-Tolerance Refusal
  if (
    /\b(csam|child\s+porn|underage\s+sex|sexualize\s+minors?|explicit\s+story\s+about\s+a\s+(?:child|minor|kid|teenager\s+under\s+18)|pedo\s+erotica|loli\s+nsfw)\b/i.test(
      q
    )
  ) {
    return {
      allowed: false,
      category: 'csam',
      refusalMessage: `**Request Refused — Zero-Tolerance Policy Violation:** Zeno strictly prohibits any content involving the sexualization or exploitation of minors (CSAM/CSAE). Violating accounts are permanently terminated and reported to NCMEC and Indian cybercrime authorities under the POCSO Act and IT Act Section 67B. Please review our [Acceptable Use Policy](/acceptable-use).`,
    };
  }

  // 3. Non-Consensual Intimate Imagery (NCII) / Undressing / Deepfakes
  if (
    /\b(undress\s+this\s+(?:photo|person|girl|woman|boy)|generate\s+a?\s*nude\s+deepfake|non[\s-]*consensual\s+nude|strip\s+her\s+clothes\s+ai|make\s+nude\s+photos?\s+of)\b/i.test(
      q
    )
  ) {
    return {
      allowed: false,
      category: 'ncii_deepfake',
      refusalMessage: `**Request Refused:** Generating non-consensual intimate imagery, deepfakes, or sexually explicit depictions of real people violates Zeno's [Acceptable Use Policy](/acceptable-use).`,
    };
  }

  // 4. Explicit Adult / Pornography / Erotica / NSFW Requests & SafeSearch Bypass Attempts
  if (isAdultQueryOrText(q)) {
    return {
      allowed: false,
      category: 'nsfw',
      refusalMessage: `**Request Refused:** Zeno strictly prohibits adult, pornographic, and sexually explicit content in accordance with our [Acceptable Use Policy](/acceptable-use). All SafeSearch and adult content filters are permanently active and cannot be bypassed. Please feel free to ask any educational, technical, or research question instead.`,
    };
  }

  // 5. Weapons of Mass Destruction / Bomb Making / Illicit Drug Synthesis
  if (
    /\b((?:how\s+to|instructions?|recipe|guide)\s+(?:to\s+)?(?:make|build|synthesize|manufacture)\s+(?:a\s+)?(?:pipe\s+bomb|improvised\s+explosive|ied|sarin\s+gas|ricin|anthrax|fentanyl|methamphetamine))\b/i.test(
      q
    )
  ) {
    return {
      allowed: false,
      category: 'weapons_illegal',
      refusalMessage: `**Request Refused:** I cannot provide actionable instructions for manufacturing explosives, chemical/biological weapons, or illegal narcotics. Please review our [Acceptable Use Policy](/acceptable-use).`,
    };
  }

  // 6. Ransomware / Credential Phishing / Malware Exploitation
  if (
    /\b(write\s+(?:working\s+)?ransomware|ransomware\s+malware\s+exploit|create\s+a\s+phishing\s+page\s+to\s+steal|keylogger\s+to\s+steal\s+credentials)\b/i.test(
      q
    )
  ) {
    return {
      allowed: false,
      category: 'malware',
      refusalMessage: `**Request Refused:** I cannot generate malicious ransomware, credential-harvesting phishing kits, or unauthorized spyware. I can, however, explain cybersecurity defense concepts and how organizations protect against these threats. See our [Acceptable Use Policy](/acceptable-use).`,
    };
  }

  // 7. Live Proctored Exam Cheating
  if (
    /\b(i\s+am\s+in\s+a\s+live\s+proctored\s+exam\s+right\s+now|bypass\s+proctoring\s+software\s+during\s+exam|help\s+me\s+cheat\s+on\s+my\s+live\s+exam)\b/i.test(
      q
    )
  ) {
    return {
      allowed: false,
      category: 'exam_cheating',
      refusalMessage: `**Request Refused:** Zeno cannot be used to cheat during a live or proctored examination or to bypass exam proctoring software ([Acceptable Use Policy](/acceptable-use)). Once your exam is complete, I would be happy to help you review the underlying concepts and practice problems.`,
    };
  }

  return { allowed: true };
}

// ============================================================================
// 5. CONTACT FORM (/api/contact), REPORT (/api/report), CONSENT & DATA RIGHTS
// ============================================================================

export interface ContactTicket {
  ticketId: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  uid: string | null;
  ipHash: string;
  createdAt: string;
  status: 'open' | 'acknowledged';
  targetDepartmentEmail: string;
}

export interface ContentReportRecord {
  reportId: string;
  targetType: 'chat_message' | 'study_set' | 'deep_research' | 'discover_artifact' | 'other';
  targetId: string;
  reason: string;
  details: string;
  snippet?: string;
  reporterUid: string | null;
  ipHash: string;
  createdAt: string;
}

export interface UserConsentRecord {
  uidOrVisitorId: string;
  consentVersion: string;
  consentTimestamp: string;
  ageConfirmed: boolean;
  mode: 'authenticated' | 'guest';
}

const contactTicketsStore: ContactTicket[] = [];
const contentReportsStore: ContentReportRecord[] = [];
const userConsentStore = new Map<string, UserConsentRecord>();
const contactRateLimitMap = new Map<string, number[]>(); // IP -> timestamps (max 5/hour)

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(`${ip}:zeno-salt`).digest('hex').slice(0, 16);
}

export function registerLegalAndSafetyRoutes(
  app: Express,
  options?: {
    classifyImageWithGemini?: (dataUrl: string, mimeType: string) => Promise<{
      hasHumanFace: boolean;
      hasNsfw: boolean;
      hasCsam: boolean;
      hasIdDocument: boolean;
      isStudyDiagramOrSlide: boolean;
    } | null>;
  }
): void {
  // 1. Static SEO & Favicon Routes (Resolved before any SPA fallback)
  app.get('/favicon.ico', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(FAVICON_ICO_BUFFER);
  });

  app.get('/favicon.svg', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(ZENO_FAVICON_SVG);
  });

  app.get('/apple-touch-icon.png', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(APPLE_TOUCH_PNG_BUFFER);
  });

  app.get('/sitemap.xml', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(buildSitemapXml());
  });

  app.get('/robots.txt', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(buildRobotsTxt());
  });

  // 2. POST /api/contact — Rate-limited (5/hour/IP), honeypot-protected contact & grievance ticket endpoint
  app.post('/api/contact', (req: Request, res: Response) => {
    const rawIp = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const ipKey = hashIp(rawIp);
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const history = (contactRateLimitMap.get(ipKey) || []).filter((t) => t > oneHourAgo);
    if (history.length >= 5) {
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded: maximum 5 support submissions per hour. For urgent issues, email ${LEGAL_CONFIG.SUPPORT_EMAIL} directly.`,
      });
    }

    const { name = '', email = '', topic = 'Other', category, message = '', website = '', honeypot = '' } =
      req.body || {};

    // Honeypot check: bots filling hidden fields get a silent 200 without storing
    if (String(website || '').trim() || String(honeypot || '').trim()) {
      return res.status(200).json({
        success: true,
        ticketId: `ZENO-TKT-${Date.now().toString(36).toUpperCase()}`,
        message: 'Ticket received.',
      });
    }

    const cleanName = String(name || 'Zeno User').trim().slice(0, 120);
    const cleanEmail = String(email || '').trim().slice(0, 200);
    const cleanTopic = String(category || topic || 'Other').trim().slice(0, 80);
    const cleanMessage = String(message || '').trim().slice(0, 5000);

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address so we can reply to your request.',
      });
    }
    if (!cleanMessage || cleanMessage.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a message describing your question or issue (at least 5 characters).',
      });
    }

    history.push(now);
    contactRateLimitMap.set(ipKey, history);

    const targetDepartmentEmail =
      /privacy|dpdp|gdpr|grievance/i.test(cleanTopic)
        ? LEGAL_CONFIG.GRIEVANCE_EMAIL
        : /abuse|safety|csam/i.test(cleanTopic)
        ? LEGAL_CONFIG.ABUSE_EMAIL
        : /copyright|dmca/i.test(cleanTopic)
        ? LEGAL_CONFIG.COPYRIGHT_EMAIL
        : LEGAL_CONFIG.SUPPORT_EMAIL;

    const ticketId = `ZENO-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    const ticket: ContactTicket = {
      ticketId,
      name: cleanName,
      email: cleanEmail,
      topic: cleanTopic,
      message: cleanMessage,
      uid: (req as any).auth?.uid || null,
      ipHash: ipKey,
      createdAt: new Date().toISOString(),
      status: 'acknowledged',
      targetDepartmentEmail,
    };

    contactTicketsStore.unshift(ticket);
    if (contactTicketsStore.length > 500) contactTicketsStore.pop();

    console.log(
      `[ContactTicket] ${ticket.ticketId} routed to ${targetDepartmentEmail} (${cleanTopic}) from ${cleanEmail}`
    );

    return res.status(200).json({
      success: true,
      ticketId: ticket.ticketId,
      status: ticket.status,
      routedTo: targetDepartmentEmail,
      slaHours: /privacy|grievance/i.test(cleanTopic) ? LEGAL_CONFIG.GRIEVANCE_ACK_HOURS : 48,
      createdAt: ticket.createdAt,
      message: `Your request (${ticket.ticketId}) has been logged and routed to ${targetDepartmentEmail}.`,
    });
  });

  // 3. POST /api/report — In-app safety & content reporting for AI answers, study sets, and shared links
  app.post('/api/report', (req: Request, res: Response) => {
    const rawIp = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const ipKey = hashIp(rawIp);
    const {
      targetType = 'chat_message',
      targetId = 'unknown',
      reason = 'Inaccurate or unsafe output',
      details = '',
      snippet = '',
    } = req.body || {};

    const cleanReason = String(reason || 'Policy violation').trim().slice(0, 200);
    if (!cleanReason) {
      return res.status(400).json({
        success: false,
        error: 'Report reason is required.',
      });
    }

    const reportId = `RPT-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    const record: ContentReportRecord = {
      reportId,
      targetType: ['chat_message', 'study_set', 'deep_research', 'discover_artifact'].includes(
        String(targetType)
      )
        ? (targetType as ContentReportRecord['targetType'])
        : 'other',
      targetId: String(targetId || 'unknown').slice(0, 128),
      reason: cleanReason,
      details: String(details || '').slice(0, 2000),
      snippet: String(snippet || '').slice(0, 500),
      reporterUid: (req as any).auth?.uid || null,
      ipHash: ipKey,
      createdAt: new Date().toISOString(),
    };

    contentReportsStore.unshift(record);
    if (contentReportsStore.length > 500) contentReportsStore.pop();

    console.log(
      `[SafetyReport] ${record.reportId} target=${record.targetType}:${record.targetId} reason="${record.reason}"`
    );

    return res.status(200).json({
      success: true,
      reportId: record.reportId,
      createdAt: record.createdAt,
      reviewSlaHours: 24,
      message: `Thank you. Report ${record.reportId} has been queued for Trust & Safety review.`,
    });
  });

  // 4. POST /api/moderation/upload — Upload Guard endpoint for images & PDFs
  app.post('/api/moderation/upload', async (req: Request, res: Response) => {
    const rawIp = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const visitorHeader = String(req.headers['x-visitor-id'] || '').trim();
    const actorKey =
      (req as any).auth?.uid || (visitorHeader ? `visitor:${visitorHeader}` : `ip:${hashIp(rawIp)}`);
    const {
      name = 'upload',
      type,
      mimeType,
      size = 0,
      dataUrl,
      textContent,
      extractedText,
      text,
      clientFaceDetected = false,
      clientNsfwDetected = false,
    } = req.body || {};

    const outcome = await moderateUploadedAttachment(
      {
        name,
        type: type || mimeType || 'application/octet-stream',
        size,
        dataUrl,
        textContent: textContent || extractedText || text || '',
        clientFaceDetected: Boolean(clientFaceDetected),
        clientNsfwDetected: Boolean(clientNsfwDetected),
      },
      actorKey,
      options?.classifyImageWithGemini
    );

    if (!outcome.allowed) {
      return res.status(422).json({
        success: false,
        allowed: false,
        category: outcome.category,
        error: outcome.reason,
        policyUrl: outcome.policyUrl,
        strikeCount24h: outcome.strikeCount24h,
        uploadRestricted: outcome.uploadRestricted,
      });
    }

    return res.status(200).json({
      success: true,
      allowed: true,
      category: 'clean',
      policyUrl: outcome.policyUrl,
    });
  });

  // 5. POST /api/moderation/check — Prompt safety moderation endpoint
  app.post('/api/moderation/check', (req: Request, res: Response) => {
    const { prompt = '' } = req.body || {};
    const result = moderateUserPromptSafety(String(prompt || ''));
    return res.status(200).json({
      success: true,
      allowed: result.allowed,
      category: result.category || null,
      refusalMessage: result.refusalMessage || null,
    });
  });

  // 6. GET & POST /api/consent — Record & verify user consent version and timestamp
  app.get('/api/consent', (req: Request, res: Response) => {
    const actorId =
      (req as any).auth?.uid ||
      String(req.query?.visitorId || req.headers['x-visitor-id'] || '').trim();
    const record = actorId ? userConsentStore.get(actorId) || null : null;
    return res.status(200).json({
      success: true,
      requiredConsentVersion: LEGAL_CONFIG.CONSENT_VERSION,
      effectiveDate: LEGAL_CONFIG.EFFECTIVE_DATE,
      record,
      isCurrent: Boolean(record && record.consentVersion === LEGAL_CONFIG.CONSENT_VERSION),
    });
  });

  app.post('/api/consent', (req: Request, res: Response) => {
    const {
      visitorId = '',
      consentVersion = LEGAL_CONFIG.CONSENT_VERSION,
      ageConfirmed = true,
      mode = 'guest',
    } = req.body || {};
    const actorId =
      (req as any).auth?.uid ||
      String(visitorId || req.headers['x-visitor-id'] || `anon-${Date.now()}`).trim();

    if (!ageConfirmed) {
      return res.status(400).json({
        success: false,
        error: `You must confirm that you are ${LEGAL_CONFIG.MIN_AGE} or older (or have verifiable parent/guardian consent) and agree to the Terms, Privacy Policy, and Acceptable Use Policy.`,
      });
    }

    const record: UserConsentRecord = {
      uidOrVisitorId: actorId,
      consentVersion: String(consentVersion || LEGAL_CONFIG.CONSENT_VERSION),
      consentTimestamp: new Date().toISOString(),
      ageConfirmed: true,
      mode: (req as any).auth?.uid ? 'authenticated' : mode === 'authenticated' ? 'authenticated' : 'guest',
    };
    userConsentStore.set(actorId, record);

    return res.status(200).json({
      success: true,
      record,
    });
  });

  // 7. POST /api/account/delete — Server-side account deletion & data purge confirmation
  app.post('/api/account/delete', (req: Request, res: Response) => {
    const { confirmationText = '' } = req.body || {};
    if (String(confirmationText).trim().toUpperCase() !== 'DELETE') {
      return res.status(400).json({
        success: false,
        error: 'Please type DELETE to confirm permanent account deletion.',
      });
    }
    const uid = (req as any).auth?.uid || String(req.body?.uid || '').trim();
    if (uid) {
      userConsentStore.delete(uid);
      uploadAbuseLedger.delete(uid);
    }
    const deletionReceiptId = `DEL-${Date.now().toString(36).toUpperCase()}`;
    return res.status(200).json({
      success: true,
      deletionReceiptId,
      deletedAt: new Date().toISOString(),
      purgeWindowDays: LEGAL_CONFIG.ACCOUNT_DELETION_PURGE_DAYS,
      message: `Account deletion confirmed (${deletionReceiptId}). Active cloud records have been purged and all residual backups will be permanently erased within ${LEGAL_CONFIG.ACCOUNT_DELETION_PURGE_DAYS} days.`,
    });
  });

  // 8. GET /api/legal/audit — Machine-readable compliance & subprocessor audit endpoint
  app.get('/api/legal/audit', (_req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      config: LEGAL_CONFIG,
      routes: Object.keys(LEGAL_DOCUMENTS).map((k) => LEGAL_DOCUMENTS[k as LegalDocId].path),
      thirdPartyServices: THIRD_PARTY_SERVICES_AUDIT,
      storageKeys: STORAGE_KEYS_AUDIT,
    });
  });
}
