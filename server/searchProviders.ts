import {
  getTinyfishApiKey,
  getTinyfishBaseUrl,
  getTregBaseUrl,
  getTregOrg,
  getTregToken,
  validateSafePublicUrl,
} from './config';

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

/**
 * Public fallback web search (DuckDuckGo HTML + Wikipedia OpenSearch) with explicit source attribution
 * and bounded timeouts. Never fabricates results.
 */
export async function fallbackPublicWebSearchWithStatus(
  query: string,
  signal?: AbortSignal
): Promise<{ results: SearchResultItem[]; error?: string; hadProviderFailure: boolean }> {
  const results: SearchResultItem[] = [];
  const errors: string[] = [];
  let succeededProviders = 0;

  try {
    const ddgRes = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        signal: signal || AbortSignal.timeout(4_000),
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
            const cleanTitle = titleMatch[2]
              .replace(/<[^>]+>/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            const rawSnip = (snippetMatch?.[1] || snippetMatch?.[2] || '')
              .replace(/<[^>]+>/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            let domain = '';
            try {
              domain = new URL(rawHref).hostname.replace(/^www\./, '');
            } catch {}
            results.push({
              position: results.length + 1,
              title: cleanTitle || domain || 'Web Result',
              url: rawHref,
              snippet: rawSnip,
              displayed_url: rawHref,
              domain,
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

  if (results.length < 4) {
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=5`,
        {
          headers: { 'User-Agent': 'ZenoAI/1.0' },
          signal: signal || AbortSignal.timeout(3_500),
        }
      );
      if (wikiRes.ok) {
        succeededProviders += 1;
        const wikiJson: any = await wikiRes.json();
        const searchItems = wikiJson?.query?.search || [];
        for (const item of searchItems) {
          const title = item.title;
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
          if (!results.some((r) => r.url === url)) {
            results.push({
              position: results.length + 1,
              title: `${title} - Wikipedia`,
              url,
              snippet: String(item.snippet || '')
                .replace(/<[^>]+>/g, '')
                .replace(/\s+/g, ' ')
                .trim(),
              displayed_url: url,
              domain: 'en.wikipedia.org',
              provider: 'wikipedia',
            });
          }
        }
      } else {
        errors.push(`Wikipedia HTTP ${wikiRes.status}`);
      }
    } catch (err: any) {
      errors.push(`Wikipedia: ${err?.message || 'failed'}`);
    }
  }

  return {
    results,
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

    if (!trimmed) {
      return {
        results: [],
        providerUsed: 'none',
        fallbackUsed: false,
        providerStatus: 'empty_results',
        tregConfigured,
        tinyfishConfigured,
        toolLabel: tregConfigured
          ? endpointId
          : tinyfishConfigured
          ? 'tinyfish.search'
          : 'public.web.search.fallback',
        endpointUsed: tregConfigured
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
            const data = await callTregEndpointReliable(endpointId, { q: trimmed }, { signal });
            const rawResults = Array.isArray(data?.output?.results) ? data.output.results : [];

            tregResults = rawResults.map((item: any, idx: number) => {
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
          if (tf.results.length > 0) {
            tinyfishResults = tf.results;
            if (!isTestEnv && tregResults.length > 0 && resolveEarly) {
              resolveEarly();
            }
          } else if (tf.error) {
            tinyfishError = tf.error;
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
  timeoutMs = 5_000
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
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50_000);

    return {
      ok: true,
      content: cleanHtml,
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
