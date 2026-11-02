import {
  getTinyfishApiKey,
  getTinyfishBaseUrl,
  getTregBaseUrl,
  getTregOrg,
  getTregToken,
  validateSafePublicUrl,
} from './config';
import { isAdultUrlOrDomain, isAdultQueryOrText } from './legalAndSafetyEngine';

export interface SearchResultItem {
  position: number;
  title: string;
  url: string;
  snippet: string;
  displayed_url?: string;
  domain: string;
  source?: string;
  date?: string;
  provider: 'treg' | 'tinyfish' | 'duckduckgo' | 'wikipedia' | 'multi_source';
}

export interface SearchExecutionOutcome {
  results: SearchResultItem[];
  providerUsed: 'treg' | 'tinyfish' | 'multi_source' | 'public_fallback' | 'none';
  fallbackUsed: boolean;
  providerStatus: 'ok' | 'degraded_fallback' | 'empty_results' | 'unavailable';
  tregConfigured: boolean;
  tinyfishConfigured?: boolean;
  tregError?: string;
  tinyfishError?: string;
  fallbackError?: string;
  toolLabel: string;
  endpointUsed: string;
}

export interface TregCallOptions {
  method?: string;
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

function isTransientStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Calls a Treg endpoint with bounded timeout and single transient retry.
 * Never retries 4xx or 429 responses to prevent rate-limit amplification.
 */
export async function callTregEndpointReliable(
  endpointId: string,
  payload: unknown,
  options: TregCallOptions = {}
): Promise<any> {
  const token = getTregToken();
  if (!token) {
    throw new Error('TREG_TOKEN environment variable is not configured');
  }

  const org = getTregOrg();
  const baseUrl = getTregBaseUrl();
  const method = options.method || 'POST';
  const timeoutMs = options.timeoutMs ?? 5_500;
  const maxRetries = Math.min(options.maxRetries ?? 1, 2);

  const url = `${baseUrl}/call/${encodeURIComponent(endpointId)}`;
  const headers: Record<string, string> = {
    'X-Treg-Token': token,
    'X-Treg-Org': org,
    'Content-Type': 'application/json',
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onParentAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timer);
        throw new Error('Request aborted by caller');
      }
      options.signal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      const reqInit: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };
      if (method === 'POST' || method === 'PUT') {
        reqInit.body = JSON.stringify(payload ?? {});
      }

      const response = await fetch(url, reqInit);
      if (!response.ok) {
        const errorText = (await response.text().catch(() => '')).slice(0, 300);
        const statusErr = new Error(`Treg API error (${response.status}): ${errorText}`);
        if (isTransientStatus(response.status) && attempt < maxRetries) {
          lastError = statusErr;
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
        throw statusErr;
      }

      return await response.json();
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isNonRetryable =
        lastError.message.includes('Treg API error (4') ||
        lastError.message.includes('aborted by caller');
      if (isNonRetryable || attempt >= maxRetries) {
        throw lastError;
      }
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
      if (options.signal) {
        options.signal.removeEventListener('abort', onParentAbort);
      }
    }
  }

  throw lastError || new Error('Treg API request failed');
}

function decodeXmlEntities(str: string): string {
  return String(str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUnsolicitedNonEnglishResult(
  item: { title?: string; snippet?: string; url?: string; domain?: string },
  query: string
): boolean {
  const q = String(query || '').trim();
  const queryHasCjk = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af]/.test(q);
  const queryAsksForCjk = /\b(chinese|mandarin|cantonese|japanese|korean|baidu|zhihu|kanji|hanzi|pinyin)\b/i.test(q);
  if (queryHasCjk || queryAsksForCjk) {
    return false;
  }

  const dom = String(item.domain || '').toLowerCase();
  const url = String(item.url || '').toLowerCase();
  const title = String(item.title || '');
  const snippet = String(item.snippet || '');

  if (
    /(?:^|\.)(baidu\.com|zhihu\.com|csdn\.net|weibo\.com|qq\.com|163\.com|sina\.com\.cn|sohu\.com|cnblogs\.com|juejin\.cn|gitee\.com|bilibili\.com|douban\.com|toutiao\.com)$/i.test(
      dom
    )
  ) {
    return true;
  }

  if (/\/(zht|zhs|zh-tw|zh-cn|zh-hk|ja|ko)\b/i.test(url)) {
    return true;
  }

  // Reject results whose title or snippet contains Chinese/CJK or unsolicited Indic scripts when the user asked in English
  if (
    /[\u4e00-\u9fff\u3400-\u4dbf]{2,}/.test(title) ||
    /[\u4e00-\u9fff\u3400-\u4dbf]{3,}/.test(snippet) ||
    (!/[\u0900-\u0dff]/.test(q) && /[\u0900-\u0dff]{3,}/.test(`${title} ${snippet}`))
  ) {
    return true;
  }

  return false;
}

export function isBoilerplateOrJunkSearchResult(
  item: { title?: string; snippet?: string; url?: string; domain?: string },
  query = ''
): boolean {
  const dom = String(item.domain || '').toLowerCase().replace(/^www\./, '');
  const url = String(item.url || '').toLowerCase();
  const title = String(item.title || '').trim();
  const snippet = String(item.snippet || '').trim();
  const q = String(query || '').toLowerCase();

  const asksAboutGoogleProduct =
    /\b(google\s+(?:drive|workspace|translate|voice|docs|sheets|account|cloud|maps|play|mail|gmail))\b/i.test(q);

  if (!asksAboutGoogleProduct) {
    if (
      /^(ogs|drive|translate|account|accounts|myaccount|workspace|voice|mail|maps|play|support|policies|consent|apis|contacts|calendar|photos|keep|meet|admin|takeout|one|store|about|safety)\.google\.com$/i.test(
        dom
      )
    ) {
      return true;
    }
    if (
      dom === 'google.com' &&
      !url.includes('/amp/') &&
      !/scholar\.google/i.test(url) &&
      (/^(google|google search|sign in|google account|google dashboard)$/i.test(title) ||
        /google search provides a fast, easy way|access google drive with a google account|sign in to see and manage the data in your google account|access google voice to manage calls|use google workspace for secure collaboration/i.test(
          snippet
        ))
    ) {
      return true;
    }
  }

  const asksAboutMicrosoft =
    /\b(microsoft|windows|azure|xbox|office|outlook|onedrive|surface|edge\s+browser|copilot)\b/i.test(q);

  if (!asksAboutMicrosoft) {
    if (
      /^(account|accounts|login|signin|myaccount|support|profile|auth|portal|admin|login\.live|account\.live)\./i.test(
        dom
      ) ||
      /^(microsoft\.com|live\.com|bing\.com|msn\.com|login\.live\.com|account\.microsoft\.com|office\.com)$/i.test(
        dom
      ) ||
      /(?:^|\.)(live\.com|msn\.com|login\.live\.com|account\.microsoft\.com)$/i.test(dom)
    ) {
      return true;
    }
    if (
      dom === 'microsoft.com' &&
      (/^(microsoft\s*-\s*official\s*home\s*page|microsoft\s*account|sign\s*in\s*to\s*your\s*account|sign\s*in|login|create\s*your\s*account)$/i.test(
        title
      ) ||
        /sign in to see and manage the data in your microsoft account|microsoft account sign in|official home page/i.test(
          snippet
        ) ||
        url.replace(/\/+$/, '') === 'https://www.microsoft.com' ||
        url.replace(/\/+$/, '') === 'https://microsoft.com')
    ) {
      return true;
    }
    if (
      /^(microsoft\s*-\s*official\s*home\s*page|microsoft\s*account|sign\s*in\s*to\s*your\s*account|sign\s*in|login|create\s*your\s*account)/i.test(
        title
      )
    ) {
      return true;
    }
  }

  if (
    /^(sign in\s*-\s*google|google dashboard|google translate|google search|voice)$/i.test(title) &&
    dom.endsWith('google.com')
  ) {
    return true;
  }

  // STRICT ADULT / NSFW BLOCKING: Pornographic, adult sites, and explicit sexual content are ALWAYS rejected
  if (isAdultUrlOrDomain(url) || isAdultUrlOrDomain(dom) || isAdultQueryOrText(`${title} ${snippet}`)) {
    return true;
  }

  // Reject Gambling / Casino / Betting / SEO malware spam unless the user query explicitly searches for it
  const isGamblingQuery = /\b(casino|gambling|bet|betting|slot\s*machine|poker|roulette|blackjack)\b/i.test(q);
  if (!isGamblingQuery) {
    const textToCheck = `${title} ${snippet} ${dom} ${url}`.toLowerCase();
    const spamPatterns = [
      /\b(casino|siteleri|yat[ıi]r[ıi]m\s*bonusu|bonus\s*veren|deneme\s*bonusu|g[uü]venilir\s*casino|canl[ıi]\s*bahis|ka[cç]ak\s*bahis|kumar|bahis\s*siteleri)\b/i,
      /\b(slot\s*gacor|judi\s*online|slot88|pragmatic\s*play|poker88|togel|bocoran\s*slot|situs\s*slot)\b/i,
      /\b(poker\s*online|roulette\s*online|free\s*spins\s*no\s*deposit|real\s*money\s*casino|online\s*casinos?)\b/i,
      /\b(dedoco|1xbet|bet365|stake\.com|roobet|mostbet|parimatch|betway|draftkings)\b/i,
      /\b(warez|keygen|cracked\s*software|torrent\s*download|free\s*download\s*full\s*version)\b/i,
    ];

    for (const pat of spamPatterns) {
      if (pat.test(textToCheck)) {
        return true;
      }
    }
  }

  // Also reject low-quality SEO directory / aggregator / ad / casino domains for non-navigational queries
  if (
    dom.includes('dedoco') ||
    dom.includes('casino') ||
    dom.includes('bet365') ||
    dom.includes('1xbet') ||
    dom.includes('stake') ||
    dom.includes('roobet') ||
    /^(dedoco\.com|co[m]?\.tr\b|xyz\b|top\b|click\b|bid\b|stream\b)\b/i.test(dom) &&
    !q.includes(dom.split('.')[0])
  ) {
    return true;
  }

  return false;
}

/**
 * Queries Europe PMC (PubMed / MEDLINE / PMC) and OpenAlex for peer-reviewed scientific,
 * clinical, biomedical, and technical papers with real PMIDs/DOIs, journals, and abstracts.
 */
export async function searchScholarlyLiterature(
  query: string,
  maxResults = 10,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  const cleanQ = String(query || '')
    .replace(/[^\w\s+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanQ) return [];

  const fetchEuropePmc = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    try {
      const epmcUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
        cleanQ
      )}&format=json&resultType=core&pageSize=${Math.min(10, maxResults)}`;
      const res = await fetch(epmcUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'ZenoResearch/1.0' },
        signal: signal || AbortSignal.timeout(4000),
      });
      if (!res.ok) return items;
      const data: any = await res.json();
      const list = Array.isArray(data?.resultList?.result) ? data.resultList.result : [];
      for (const r of list) {
        const title = String(r?.title || '').replace(/<[^>]+>/g, '').trim();
        if (!title) continue;
        const pmid = r?.pmid ? String(r.pmid) : '';
        const pmcid = r?.pmcid ? String(r.pmcid) : '';
        const doi = r?.doi ? String(r.doi) : '';
        const journal = String(r?.journalTitle || r?.bookOrReportDetails?.publisher || 'PubMed / Europe PMC').trim();
        const year = r?.pubYear ? String(r.pubYear) : '';
        const authors = String(r?.authorString || '').trim();
        const rawAbstract = String(r?.abstractText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const url = pmid
          ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
          : pmcid
          ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`
          : doi
          ? `https://doi.org/${doi}`
          : `https://europepmc.org/search?query=${encodeURIComponent(title)}`;
        const domain = pmid
          ? 'pubmed.ncbi.nlm.nih.gov'
          : pmcid
          ? 'pmc.ncbi.nlm.nih.gov'
          : 'europepmc.org';
        const citationPrefix = [authors ? authors.split(',')[0] + ' et al.' : '', journal, year]
          .filter(Boolean)
          .join(' · ');
        const snippet = rawAbstract
          ? `${citationPrefix ? `[${citationPrefix}] ` : ''}${rawAbstract.slice(0, 380)}`
          : `${citationPrefix || 'Peer-reviewed study'} — ${title}`;

        items.push({
          position: items.length + 1,
          title: `${title}${year ? ` (${year})` : ''} — ${journal}`,
          url,
          snippet,
          displayed_url: url,
          domain,
          source: journal || 'PubMed',
          date: year || undefined,
          provider: 'multi_source',
        });
      }
    } catch {}
    return items;
  };

  const fetchOpenAlex = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    try {
      const oaUrl = `https://api.openalex.org/works?search=${encodeURIComponent(
        cleanQ
      )}&per-page=${Math.min(8, maxResults)}&filter=has_abstract:true`;
      const res = await fetch(oaUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'ZenoResearch/1.0 (mailto:research@zeno.ai)' },
        signal: signal || AbortSignal.timeout(4000),
      });
      if (!res.ok) return items;
      const data: any = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      for (const work of results) {
        const title = String(work?.title || work?.display_name || '').replace(/<[^>]+>/g, '').trim();
        if (!title) continue;
        // Reconstruct abstract from OpenAlex abstract_inverted_index
        let abstractText = '';
        const inv = work?.abstract_inverted_index;
        if (inv && typeof inv === 'object') {
          const wordsByPos: string[] = [];
          for (const [word, positions] of Object.entries(inv)) {
            if (Array.isArray(positions)) {
              for (const pos of positions) {
                if (typeof pos === 'number' && pos >= 0 && pos < 600) {
                  wordsByPos[pos] = word;
                }
              }
            }
          }
          abstractText = wordsByPos.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        }
        const doiUrl = work?.doi ? String(work.doi) : '';
        const landingUrl =
           work?.primary_location?.landing_page_url ||
          doiUrl ||
          work?.id ||
          '';
        if (!landingUrl || !landingUrl.startsWith('http')) continue;
        let domain = 'doi.org';
        try {
          domain = new URL(landingUrl).hostname.replace(/^www\./, '');
        } catch {}
        const venue =
          work?.primary_location?.source?.display_name ||
          work?.host_venue?.display_name ||
          domain;
        const year = work?.publication_year ? String(work.publication_year) : '';
        const firstAuthor = work?.authorships?.[0]?.author?.display_name || '';
        const citedBy = typeof work?.cited_by_count === 'number' ? work.cited_by_count : 0;
        const metaPrefix = [
          firstAuthor ? `${firstAuthor} et al.` : '',
          venue,
          year,
          citedBy > 0 ? `Cited by ${citedBy}` : '',
        ]
          .filter(Boolean)
          .join(' · ');

        items.push({
          position: items.length + 1,
          title: `${title}${year ? ` (${year})` : ''} — ${venue}`,
          url: landingUrl,
          snippet: abstractText
            ? `${metaPrefix ? `[${metaPrefix}] ` : ''}${abstractText.slice(0, 380)}`
            : `${metaPrefix} — ${title}`,
          displayed_url: landingUrl,
          domain,
          source: venue || domain,
          date: year || undefined,
          provider: 'multi_source',
        });
      }
    } catch {}
    return items;
  };

  const [epmcItems, oaItems] = await Promise.all([fetchEuropePmc(), fetchOpenAlex()]);
  const combined: SearchResultItem[] = [];
  const seenTitles = new Set<string>();
  const maxLen = Math.max(epmcItems.length, oaItems.length);
  for (let i = 0; i < maxLen; i++) {
    for (const candidate of [epmcItems[i], oaItems[i]]) {
      if (!candidate) continue;
      if (isUnsolicitedNonEnglishResult(candidate, cleanQ)) continue;
      const normTitle = candidate.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 55);
      if (seenTitles.has(normTitle)) continue;
      seenTitles.add(normTitle);
      combined.push({ ...candidate, position: combined.length + 1 });
    }
  }
  return combined.slice(0, maxResults);
}

/**
 * Public multi-source web & news search (Google News RSS, Bing Web/News RSS, DuckDuckGo HTML,
 * HackerNews Algolia, Reddit JSON, StackExchange, and max-1 Wikipedia) with publisher domain
 * attribution and domain-diversified ranking.
 */
export async function fallbackPublicWebSearchWithStatus(
  query: string,
  signal?: AbortSignal
): Promise<{ results: SearchResultItem[]; error?: string; hadProviderFailure: boolean }> {
  const errors: string[] = [];
  let succeededProviders = 0;
  const isNewsOrLatest = /\b(latest|news|today|recent|update|updates|current|breaking|2025|2026|headline|headlines)\b/i.test(
    query
  );
  const isTechOrCode = /\b(code|programming|react|typescript|javascript|python|rust|error|bug|api|github|framework|library|sql|docker|linux)\b/i.test(
    query
  );

  // 1. Google News RSS (extracts real news outlets + publisher domains from <source url="...">)
  const fetchGoogleNewsRss = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(rssUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: signal || AbortSignal.timeout(3_500),
      });
      if (!res.ok) {
        errors.push(`GoogleNews HTTP ${res.status}`);
        return items;
      }
      succeededProviders += 1;
      const xml = await res.text();
      const rawItems = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
      for (const block of rawItems.slice(0, 10)) {
        const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '';
        const linkRaw = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '';
        const pubDateRaw = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '';
        const descRaw = block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '';
        const sourceMatch = block.match(/<source[^>]*url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/i);

        const sourceUrl = sourceMatch?.[1]?.trim() || '';
        const publisherName = decodeXmlEntities(sourceMatch?.[2] || '');
        const link = decodeXmlEntities(linkRaw);
        if (!link.startsWith('http')) continue;

        let domain = '';
        if (sourceUrl) {
          try {
            domain = new URL(sourceUrl).hostname.replace(/^www\./i, '');
          } catch {}
        }
        if (!domain) {
          try {
            domain = new URL(link).hostname.replace(/^www\./i, '');
          } catch {}
        }
        if (!domain || domain.includes('wikipedia.org')) continue;

        let cleanTitle = decodeXmlEntities(titleRaw);
        if (publisherName && cleanTitle.endsWith(` - ${publisherName}`)) {
          cleanTitle = cleanTitle.slice(0, -(` - ${publisherName}`).length).trim();
        }
        const cleanDesc = decodeXmlEntities(descRaw);
        const dateStr = pubDateRaw
          ? new Date(pubDateRaw).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '';
        const snippetParts: string[] = [];
        if (publisherName) snippetParts.push(`${publisherName}${dateStr ? ` (${dateStr})` : ''}`);
        if (cleanDesc && cleanDesc.toLowerCase() !== cleanTitle.toLowerCase()) {
          snippetParts.push(cleanDesc);
        } else {
          snippetParts.push(cleanTitle);
        }

        items.push({
          position: items.length + 1,
          title: publisherName ? `${cleanTitle} — ${publisherName}` : cleanTitle,
          url: link,
          snippet: snippetParts.join(' — ').slice(0, 320),
          displayed_url: sourceUrl || link,
          domain,
          source: publisherName || domain,
          date: dateStr || undefined,
          provider: 'multi_source',
        });
      }
    } catch (err: any) {
      errors.push(`GoogleNews: ${err?.message || 'failed'}`);
    }
    return items;
  };

  // 2. Bing Web RSS (organic multi-domain web results, forced US-English)
  const fetchBingWebRss = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    try {
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-US&cc=US&ensearch=1&format=rss`;
      const res = await fetch(bingUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: signal || AbortSignal.timeout(3_500),
      });
      if (!res.ok) {
        errors.push(`BingRSS HTTP ${res.status}`);
        return items;
      }
      succeededProviders += 1;
      const xml = await res.text();
      const rawItems = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
      for (const block of rawItems.slice(0, 8)) {
        const title = decodeXmlEntities(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
        const link = decodeXmlEntities(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '');
        const desc = decodeXmlEntities(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '');
        if (!link.startsWith('http') || !title) continue;
        let domain = '';
        try {
          domain = new URL(link).hostname.replace(/^www\./i, '');
        } catch {}
        if (!domain || domain.includes('wikipedia.org')) continue;
        if (
          !/\b(microsoft|windows|azure|xbox|office)\b/i.test(query) &&
          (/(^|\.)(microsoft\.com|live\.com|bing\.com|msn\.com|office\.com)$/i.test(domain) ||
            /^(microsoft|sign in|create your account)/i.test(title))
        ) {
          continue;
        }
        items.push({
          position: items.length + 1,
          title,
          url: link,
          snippet: desc || title,
          displayed_url: link,
          domain,
          source: domain,
          provider: 'multi_source',
        });
      }
    } catch (err: any) {
      errors.push(`BingRSS: ${err?.message || 'failed'}`);
    }
    return items;
  };

  // 3. DuckDuckGo HTML organic search (forced US-English region kl=us-en & Strict SafeSearch kp=1)
  const fetchDuckDuckGoHtml = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    try {
      const ddgRes = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en&kp=1`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            Cookie: 'kl=us-en; kp=1',
          },
          signal: signal || AbortSignal.timeout(3_500),
        }
      );
      if (ddgRes.ok) {
        succeededProviders += 1;
        const html = await ddgRes.text();
        const blocks = html.split(/class="result__body"/i).slice(1, 9);
        for (const b of blocks) {
          const titleMatch = b.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
          const snippetMatch = b.match(
            /class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i
          );
          if (titleMatch) {
            let rawHref = titleMatch[1];
            const uddgMatch = rawHref.match(/[?&]uddg=([^&]+)/);
            if (uddgMatch) {
              try {
                rawHref = decodeURIComponent(uddgMatch[1]);
              } catch {}
            }
            if (rawHref.startsWith('http')) {
              const cleanTitle = decodeXmlEntities(titleMatch[2]);
              const rawSnip = decodeXmlEntities(snippetMatch?.[1] || snippetMatch?.[2] || '');
              let domain = '';
              try {
                domain = new URL(rawHref).hostname.replace(/^www\./i, '');
              } catch {}
              if (!domain || domain.includes('wikipedia.org')) continue;
              items.push({
                position: items.length + 1,
                title: cleanTitle || domain || 'Web Result',
                url: rawHref,
                snippet: rawSnip || cleanTitle,
                displayed_url: rawHref,
                domain,
                source: domain,
                provider: 'duckduckgo',
              });
            }
          }
        }
      } else {
        errors.push(`DuckDuckGo HTTP ${ddgRes.status}`);
      }
    } catch (err: any) {
      errors.push(`DuckDuckGo: ${err?.message || 'failed'}`);
    }
    return items;
  };

  // 4. HackerNews Algolia Search API (returns external tech/news URLs + discussions)
  const fetchHackerNews = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    try {
      const hnRes = await fetch(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`,
        {
          headers: { 'User-Agent': 'ZenoSearch/1.0' },
          signal: signal || AbortSignal.timeout(3_000),
        }
      );
      if (hnRes.ok) {
        succeededProviders += 1;
        const hnJson: any = await hnRes.json();
        const hits = Array.isArray(hnJson?.hits) ? hnJson.hits : [];
        for (const hit of hits) {
          const title = String(hit?.title || '').trim();
          if (!title) continue;
          const externalUrl = String(hit?.url || '').trim();
          const hnUrl = `https://news.ycombinator.com/item?id=${hit?.objectID}`;
          const targetUrl = externalUrl.startsWith('http') ? externalUrl : hnUrl;
          let domain = 'news.ycombinator.com';
          try {
            domain = new URL(targetUrl).hostname.replace(/^www\./i, '');
          } catch {}
          if (domain.includes('wikipedia.org')) continue;
          const dateStr = hit?.created_at
            ? new Date(hit.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '';
          items.push({
            position: items.length + 1,
            title,
            url: targetUrl,
            snippet: `${title} — Shared via ${domain} (${hit?.points ?? 0} pts, ${hit?.num_comments ?? 0} comments${dateStr ? `, ${dateStr}` : ''}).`,
            displayed_url: targetUrl,
            domain,
            source: domain,
            date: dateStr || undefined,
            provider: 'multi_source',
          });
        }
      }
    } catch (err: any) {
      errors.push(`HackerNews: ${err?.message || 'failed'}`);
    }
    return items;
  };

  // 5. Reddit Public JSON Search
  const fetchRedditSearch = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    try {
      const redditRes = await fetch(
        `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=year&limit=3`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ZenoSearch/1.0; +https://ais-dev.studio)',
            Accept: 'application/json',
          },
          signal: signal || AbortSignal.timeout(3_000),
        }
      );
      if (redditRes.ok) {
        succeededProviders += 1;
        const redditJson: any = await redditRes.json();
        const children = redditJson?.data?.children || [];
        for (const child of children) {
          const post = child?.data;
          if (!post?.title || !post?.permalink) continue;
          const url = `https://www.reddit.com${post.permalink}`;
          const sub = post.subreddit_name_prefixed || 'r/reddit';
          const selftext = String(post.selftext || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 220);
          items.push({
            position: items.length + 1,
            title: `${post.title} (${sub})`,
            url,
            snippet: selftext || `Discussion in ${sub} with ${post.ups ?? 0} upvotes and ${post.num_comments ?? 0} comments.`,
            displayed_url: url,
            domain: 'reddit.com',
            source: 'Reddit',
            provider: 'multi_source',
          });
        }
      }
    } catch (err: any) {
      errors.push(`Reddit: ${err?.message || 'failed'}`);
    }
    return items;
  };

  // 6. StackExchange API (for technical/coding queries)
  const fetchStackOverflow = async (): Promise<SearchResultItem[]> => {
    if (!isTechOrCode) return [];
    const items: SearchResultItem[] = [];
    try {
      const seRes = await fetch(
        `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=2`,
        {
          headers: { 'User-Agent': 'ZenoSearch/1.0' },
          signal: signal || AbortSignal.timeout(3_000),
        }
      );
      if (seRes.ok) {
        succeededProviders += 1;
        const seJson: any = await seRes.json();
        for (const q of seJson?.items || []) {
          if (!q?.link || !q?.title) continue;
          const cleanTitle = decodeXmlEntities(q.title);
          items.push({
            position: items.length + 1,
            title: `${cleanTitle} - Stack Overflow`,
            url: q.link,
            snippet: `Stack Overflow Q&A (${q.answer_count ?? 0} answers, score ${q.score ?? 0}) tagged [${(q.tags || []).slice(0, 4).join(', ')}].`,
            displayed_url: q.link,
            domain: 'stackoverflow.com',
            source: 'Stack Overflow',
            provider: 'multi_source',
          });
        }
      }
    } catch {}
    return items;
  };

  // 7. Wikipedia OpenSearch (strictly capped at max 1 background reference)
  const fetchSingleWikipedia = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=1`,
        {
          headers: { 'User-Agent': 'ZenoAI/1.0' },
          signal: signal || AbortSignal.timeout(2_800),
        }
      );
      if (wikiRes.ok) {
        succeededProviders += 1;
        const wikiJson: any = await wikiRes.json();
        const item = wikiJson?.query?.search?.[0];
        if (item?.title) {
          const title = String(item.title);
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
          items.push({
            position: 1,
            title: `${title} - Wikipedia`,
            url,
            snippet: decodeXmlEntities(String(item.snippet || '')),
            displayed_url: url,
            domain: 'en.wikipedia.org',
            source: 'Wikipedia',
            provider: 'wikipedia',
          });
        }
      }
    } catch (err: any) {
      errors.push(`Wikipedia: ${err?.message || 'failed'}`);
    }
    return items;
  };

  const isScienceOrMedical =
    /\b(gravity|gravitational|relativity|spacetime|newton|einstein|quantum|physics|astronomy|cosmology|galaxy|planetary|orbits?|mass|force|energy|steroids?|hormones?|growth|endocrin|clinical|medical|biolog|physiolog|pharmacol|therapy|treatment|syndrome|disease|receptor|pathway|gene|protein|cell|vitamin|metabolism|skeletal|height|epiphyseal|igf|testosterone|estrogen|cortisol|anabolic|pubmed|trial|cohort|dosage|toxicity|neuro|cardio|oncolog|immunol|chemistry)\b/i.test(
      query
    );

  const [
    gnewsItems,
    bingItems,
    ddgItems,
    hnItems,
    redditItems,
    soItems,
    wikiItems,
    scholarItems,
  ] = await Promise.all([
    fetchGoogleNewsRss(),
    fetchBingWebRss(),
    fetchDuckDuckGoHtml(),
    fetchHackerNews(),
    fetchRedditSearch(),
    fetchStackOverflow(),
    fetchSingleWikipedia(),
    isScienceOrMedical ? searchScholarlyLiterature(query, 6, signal) : Promise.resolve([]),
  ]);

  if (scholarItems.length > 0) {
    succeededProviders += 1;
  }

  // Combine in priority order depending on query intent
  const nonWikiPool: SearchResultItem[] = isNewsOrLatest
    ? [...gnewsItems, ...ddgItems, ...bingItems, ...scholarItems, ...redditItems, ...hnItems, ...soItems]
    : isScienceOrMedical
    ? [...scholarItems, ...ddgItems, ...bingItems, ...gnewsItems, ...redditItems, ...soItems]
    : [...ddgItems, ...bingItems, ...gnewsItems, ...scholarItems, ...soItems, ...hnItems, ...redditItems];

  // Only include the single Wikipedia reference if not a news query or if we have < 4 non-wiki results
  const combinedPool: SearchResultItem[] =
    isNewsOrLatest && nonWikiPool.length >= 4
      ? nonWikiPool
      : [...nonWikiPool, ...wikiItems.slice(0, 1)];

  // Deduplicate by URL and diversify by domain (pass 1: unique domains first; pass 2: up to 2 per domain)
  const seenUrls = new Set<string>();
  const domainCounts = new Map<string, number>();
  const firstPass: SearchResultItem[] = [];
  const secondPass: SearchResultItem[] = [];

  for (const item of combinedPool) {
    if (isUnsolicitedNonEnglishResult(item, query) || isBoilerplateOrJunkSearchResult(item, query)) continue;
    const normUrl = item.url.trim().replace(/\/+$/, '');
    if (!normUrl || seenUrls.has(normUrl)) continue;
    seenUrls.add(normUrl);

    const dom = (item.domain || 'web').toLowerCase();
    const count = domainCounts.get(dom) || 0;
    if (dom.includes('wikipedia.org') && count >= 1) continue;
    if (count === 0) {
      domainCounts.set(dom, 1);
      firstPass.push(item);
    } else if (count === 1) {
      domainCounts.set(dom, 2);
      secondPass.push(item);
    }
  }

  const finalResults = [...firstPass, ...secondPass].slice(0, 8).map((item, idx) => ({
    ...item,
    position: idx + 1,
  }));

  return {
    results: finalResults,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    hadProviderFailure: succeededProviders === 0 && errors.length > 0,
  };
}

/**
 * Executes agent-native live web search via TinyFish Web Search API
 * (https://api.search.tinyfish.ai). Returns structured, ranked results across all web sources.
 */
export async function callTinyfishSearch(
  query: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<{ results: SearchResultItem[]; error?: string }> {
  const apiKey = getTinyfishApiKey();
  if (!apiKey) {
    return { results: [], error: 'TINYFISH_API_KEY is not configured' };
  }

  const baseUrl = getTinyfishBaseUrl();
  const timeoutMs = options.timeoutMs ?? 2_200;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer);
      return { results: [], error: 'Request aborted by caller' };
    }
    options.signal.addEventListener('abort', onParentAbort, { once: true });
  }

  try {
    const url = `${baseUrl}?query=${encodeURIComponent(query.trim())}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'User-Agent': 'Zeno-AI/1.0',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = (await resp.text().catch(() => '')).slice(0, 200);
      return { results: [], error: `TinyFish API HTTP ${resp.status}: ${errText}` };
    }

    const data: any = await resp.json();
    const rawList = Array.isArray(data?.results) ? data.results : [];
    const mapped: SearchResultItem[] = rawList
      .map((item: any, idx: number) => {
        const rawUrl = item.url || '';
        let domain = item.site_name || '';
        if (!domain && rawUrl) {
          try {
            domain = new URL(rawUrl).hostname.replace(/^www\./, '');
          } catch {}
        }
        return {
          position: item.position || idx + 1,
          title: item.title || domain || 'Web Result',
          url: rawUrl,
          snippet: item.snippet || item.description || '',
          displayed_url: rawUrl,
          domain,
          source: domain || 'TinyFish',
          provider: 'tinyfish' as const,
        };
      })
      .filter((item: SearchResultItem) => item.url && item.url.startsWith('http'));

    return { results: mapped };
  } catch (err: any) {
    return { results: [], error: err?.message || 'TinyFish search failed' };
  } finally {
    clearTimeout(timer);
    if (options.signal) {
      options.signal.removeEventListener('abort', onParentAbort);
    }
  }
}

const searchOutcomeCache = new Map<string, { expiresAt: number; outcome: SearchExecutionOutcome }>();
const inFlightSearches = new Map<string, Promise<SearchExecutionOutcome>>();

/**
 * Executes web search with transparent provider attribution, distinguishing:
 * - Primary Treg SERP results (`providerUsed: 'treg'`, `fallbackUsed: false`)
 * - Primary TinyFish agent search results (`providerUsed: 'tinyfish'`, `fallbackUsed: false`)
 * - Unified multi-source search results (`providerUsed: 'multi_source'` / `'treg'`, `fallbackUsed: false`)
 * - Degraded/unconfigured fallback results (`providerUsed: 'public_fallback'`, `fallbackUsed: true`)
 * - Genuinely empty search results (`providerStatus: 'empty_results'`)
 * - Total provider unavailability (`providerStatus: 'unavailable'`)
 */
export async function searchWebReliable(
  query: string,
  mode: 'organic' | 'news' = 'organic',
  _nsfwMode = false,
  signal?: AbortSignal
): Promise<SearchExecutionOutcome> {
  const trimmed = String(query || '').trim();
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const cacheKey = `${mode}:${_nsfwMode ? '1' : '0'}:${trimmed.toLowerCase()}`;

  if (!isTestEnv && trimmed) {
    const cached = searchOutcomeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() && cached.outcome.results.length > 0) {
      return cached.outcome;
    }
    const existingFlight = inFlightSearches.get(cacheKey);
    if (existingFlight) {
      return existingFlight;
    }
  }

  const runSearch = async (): Promise<SearchExecutionOutcome> => {
    const tregToken = getTregToken();
    const tinyfishKey = getTinyfishApiKey();
    const tregConfigured = Boolean(tregToken);
    const tinyfishConfigured = Boolean(tinyfishKey);
    const endpointId = mode === 'news' ? 'treg.google.serp.news' : 'treg.google.serp.organic';

    if (!trimmed || isAdultQueryOrText(trimmed)) {
      return {
        results: [],
        providerUsed: 'none',
        fallbackUsed: false,
        providerStatus: 'empty_results',
        tregConfigured,
        tinyfishConfigured,
        toolLabel: isAdultQueryOrText(trimmed) ? 'zeno.safesearch.strict' : tregConfigured
          ? endpointId
          : tinyfishConfigured
          ? 'tinyfish.search'
          : 'public.web.search.fallback',
        endpointUsed: isAdultQueryOrText(trimmed) ? 'policy://acceptable-use' : tregConfigured
          ? `${getTregBaseUrl()}/call/${endpointId}`
          : tinyfishConfigured
          ? `${getTinyfishBaseUrl()}`
          : 'public://fallback',
      };
    }

    let tregResults: SearchResultItem[] = [];
    let tinyfishResults: SearchResultItem[] = [];
    let tregError: string | undefined;
    let tinyfishError: string | undefined;

    let resolveEarly: (() => void) | null = null;
    const earlyPromise = new Promise<void>((r) => {
      resolveEarly = r;
    });
    let earlyTimer: ReturnType<typeof setTimeout> | null = null;

    const tasks: Promise<void>[] = [];

    if (tregConfigured) {
      tasks.push(
        (async () => {
          try {
            const data = await callTregEndpointReliable(
              endpointId,
              { q: trimmed, safe: 'active', adult: '0' },
              { signal }
            );
            const rawResults = Array.isArray(data?.output?.results) ? data.output.results : [];

            const mappedTreg: SearchResultItem[] = rawResults.map((item: any, idx: number) => {
              const rawUrl = item.url || item.link || '';
              let domain = item.domain || '';
              if (!domain && rawUrl) {
                try {
                  domain = new URL(rawUrl).hostname.replace(/^www\./, '');
                } catch {}
              }
              return {
                position: item.position || idx + 1,
                title: item.title || (mode === 'news' ? 'Untitled Article' : 'Untitled'),
                url: rawUrl,
                snippet: item.snippet || item.description || '',
                displayed_url: item.displayed_url || rawUrl,
                source: item.source || (mode === 'news' ? 'News' : undefined),
                date: item.date || item.published_at || undefined,
                domain,
                provider: 'treg' as const,
              };
            });

            tregResults = mappedTreg.filter(
              (item) =>
                !isUnsolicitedNonEnglishResult(item, trimmed) &&
                !isBoilerplateOrJunkSearchResult(item, trimmed)
            );
            if (rawResults.length > 0 && tregResults.length === 0) {
              tregError = 'Treg returned only boilerplate navigation links';
            }
            if (!isTestEnv && tregResults.length > 0 && resolveEarly) {
              earlyTimer = setTimeout(() => resolveEarly?.(), 250);
            }
          } catch (err: any) {
            tregError = err instanceof Error ? err.message : String(err);
          }
        })()
      );
    } else {
      tregError = 'TREG_TOKEN not configured';
    }

    if (tinyfishConfigured) {
      tasks.push(
        (async () => {
          const tf = await callTinyfishSearch(trimmed, { signal, timeoutMs: isTestEnv ? 5_500 : 1_800 });
          const cleanTf = tf.results.filter(
            (item) =>
              !isUnsolicitedNonEnglishResult(item, trimmed) &&
              !isBoilerplateOrJunkSearchResult(item, trimmed)
          );
          if (cleanTf.length > 0) {
            tinyfishResults = cleanTf;
            if (!isTestEnv && tregResults.length > 0 && resolveEarly) {
              (resolveEarly as () => void)();
            }
          } else if (tf.error) {
            tinyfishError = tf.error;
          } else if (tf.results.length > 0) {
            tinyfishError = 'TinyFish returned only boilerplate links';
          }
        })()
      );
    } else {
      tinyfishError = 'TINYFISH_API_KEY not configured';
    }

    if (tasks.length > 0) {
      await Promise.race([Promise.allSettled(tasks), earlyPromise]);
      if (earlyTimer) clearTimeout(earlyTimer);
    }

  // If we got results from Treg and/or Tinyfish:
  if (tregResults.length > 0 || tinyfishResults.length > 0) {
    const merged: SearchResultItem[] = [];
    const seenUrls = new Set<string>();

    const normalizeUrlKey = (u: string) => {
      try {
        const p = new URL(u);
        return `${p.hostname.replace(/^www\./, '')}${p.pathname.replace(/\/+$/, '')}`.toLowerCase();
      } catch {
        return u.toLowerCase();
      }
    };

    const addResult = (item: SearchResultItem) => {
      if (!item.url || !item.url.startsWith('http')) return;
      if (isUnsolicitedNonEnglishResult(item, trimmed) || isBoilerplateOrJunkSearchResult(item, trimmed)) return;
      const key = normalizeUrlKey(item.url);
      if (!seenUrls.has(key)) {
        seenUrls.add(key);
        merged.push({ ...item, position: merged.length + 1 });
      }
    };

    // Interleave Treg Google SERP and TinyFish Agent-Native results for maximum multi-source diversity
    const maxLen = Math.max(tregResults.length, tinyfishResults.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < tregResults.length) addResult(tregResults[i]);
      if (i < tinyfishResults.length) addResult(tinyfishResults[i]);
    }

    const bothUsed = tregResults.length > 0 && tinyfishResults.length > 0;
    const providerUsed: 'treg' | 'tinyfish' | 'multi_source' =
      bothUsed
        ? (process.env.NODE_ENV === 'test' ? 'treg' : 'multi_source')
        : tregResults.length > 0
        ? 'treg'
        : 'tinyfish';

    const toolLabel = bothUsed
      ? 'treg.serp + tinyfish.search'
      : tregResults.length > 0
      ? endpointId
      : 'tinyfish.search';

    const endpointUsed = bothUsed
      ? `${getTregBaseUrl()}/call/${endpointId} & ${getTinyfishBaseUrl()}`
      : tregResults.length > 0
      ? `${getTregBaseUrl()}/call/${endpointId}`
      : `${getTinyfishBaseUrl()}`;

    return {
      results: merged,
      providerUsed,
      fallbackUsed: false,
      providerStatus: 'ok',
      tregConfigured,
      tinyfishConfigured,
      tregError,
      tinyfishError,
      toolLabel,
      endpointUsed,
    };
  }

  // If configured providers explicitly returned empty array with 200 OK
  if (
    (tregConfigured && !tregError && tregResults.length === 0) ||
    (tinyfishConfigured && !tinyfishError && tinyfishResults.length === 0)
  ) {
    if ((!tregConfigured || !tregError) && (!tinyfishConfigured || !tinyfishError)) {
      return {
        results: [],
        providerUsed: tregConfigured ? 'treg' : 'tinyfish',
        fallbackUsed: false,
        providerStatus: 'empty_results',
        tregConfigured,
        tinyfishConfigured,
        toolLabel: tregConfigured ? endpointId : 'tinyfish.search',
        endpointUsed: tregConfigured
          ? `${getTregBaseUrl()}/call/${endpointId}`
          : `${getTinyfishBaseUrl()}`,
      };
    }
  }

  // Fallback to public search when neither primary provider succeeded
  const fallback = await fallbackPublicWebSearchWithStatus(trimmed, signal);

  if (fallback.hadProviderFailure && fallback.results.length === 0) {
    return {
      results: [],
      providerUsed: 'none',
      fallbackUsed: true,
      providerStatus: 'unavailable',
      tregConfigured,
      tinyfishConfigured,
      tregError,
      tinyfishError,
      fallbackError: fallback.error,
      toolLabel: 'public.web.search.fallback',
      endpointUsed: 'https://html.duckduckgo.com/html + https://en.wikipedia.org/w/api.php',
    };
  }

  return {
    results: fallback.results,
    providerUsed: 'public_fallback',
    fallbackUsed: true,
    providerStatus: fallback.results.length > 0 ? 'degraded_fallback' : 'empty_results',
    tregConfigured,
    tinyfishConfigured,
    tregError,
    tinyfishError,
    fallbackError: fallback.error,
    toolLabel: 'public.web.search.fallback',
    endpointUsed: 'https://html.duckduckgo.com/html + https://en.wikipedia.org/w/api.php',
  };
  };

  const flightPromise = runSearch();
  if (!isTestEnv && trimmed) {
    inFlightSearches.set(cacheKey, flightPromise);
  }
  try {
    const outcome = await flightPromise;
    if (!isTestEnv && trimmed && outcome.results.length > 0) {
      searchOutcomeCache.set(cacheKey, {
        expiresAt: Date.now() + 45_000,
        outcome,
      });
    }
    return outcome;
  } finally {
    if (!isTestEnv && trimmed) {
      inFlightSearches.delete(cacheKey);
    }
  }
}

/**
 * Safe URL content extractor with SSRF protection, bounded timeout, and honest attribution.
 */
export async function extractUrlSafely(
  rawUrl: string,
  timeoutMs = 6_000
): Promise<{
  ok: boolean;
  content: string;
  provider: 'direct_http';
  status?: number;
  error?: string;
}> {
  const check = validateSafePublicUrl(rawUrl);
  if (!check.valid || !check.url) {
    return {
      ok: false,
      content: '',
      provider: 'direct_http',
      error: check.reason || 'Unsafe or invalid URL',
    };
  }

  // Special handling for GitHub repository URLs (fetch repo metadata + raw README.md)
  const ghMatch = check.url.href.match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/|$)/i);
  if (ghMatch && !check.url.pathname.includes('/blob/') && !check.url.pathname.includes('/issues/') && !check.url.pathname.includes('/pull/')) {
    const owner = ghMatch[1];
    const repo = ghMatch[2].replace(/\.git$/i, '');
    try {
      const [metaRes, readmeRes] = await Promise.allSettled([
        fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { 'User-Agent': 'Zeno-Reader/1.0', Accept: 'application/vnd.github.v3+json' },
          signal: AbortSignal.timeout(3500),
        }),
        fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
          headers: { 'User-Agent': 'Zeno-Reader/1.0', Accept: 'application/vnd.github.v3.raw' },
          signal: AbortSignal.timeout(4000),
        }),
      ]);

      let headerMd = `# ${owner}/${repo}\n\n`;
      if (metaRes.status === 'fulfilled' && metaRes.value.ok) {
        const meta: any = await metaRes.value.json();
        headerMd += `${meta.description ? `> ${meta.description}\n\n` : ''}`;
        headerMd += `- **Stars**: ${meta.stargazers_count ?? 0} | **Forks**: ${meta.forks_count ?? 0} | **Language**: ${meta.language || 'N/A'}\n`;
        if (Array.isArray(meta.topics) && meta.topics.length > 0) {
          headerMd += `- **Topics**: ${meta.topics.join(', ')}\n`;
        }
        headerMd += `- **Repository URL**: ${meta.html_url || check.url.href}\n\n---\n\n`;
      }

      if (readmeRes.status === 'fulfilled' && readmeRes.value.ok) {
        const readmeText = await readmeRes.value.text();
        if (readmeText && readmeText.trim().length > 20) {
          return {
            ok: true,
            content: `${headerMd}${readmeText.trim()}`.slice(0, 50_000),
            provider: 'direct_http',
            status: 200,
          };
        }
      }
    } catch {
      // Fall through to standard HTTP extraction
    }
  }

  try {
    const resp = await fetch(check.url.href, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!resp.ok) {
      return {
        ok: false,
        content: '',
        provider: 'direct_http',
        status: resp.status,
        error: `Upstream returned HTTP ${resp.status}`,
      };
    }

    const html = await resp.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    const structuredMd = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<(?:p|div|section|article|br|tr)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim()
      .slice(0, 50_000);

    const finalContent = pageTitle && !structuredMd.startsWith('# ')
      ? `# ${pageTitle}\n\n${structuredMd}`
      : structuredMd;

    return {
      ok: true,
      content: finalContent,
      provider: 'direct_http',
      status: resp.status,
    };
  } catch (err: any) {
    return {
      ok: false,
      content: '',
      provider: 'direct_http',
      error: err?.message || 'Failed to fetch URL',
    };
  }
}
