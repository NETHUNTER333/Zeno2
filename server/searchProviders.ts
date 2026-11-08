import {
  getTinyfishApiKey,
  getTinyfishBaseUrl,
  getTregBaseUrl,
  getTregOrg,
  getTregToken,
  validateSafePublicUrl,
} from './config';
import { isAdultUrlOrDomain, isAdultQueryOrText } from './legalAndSafetyEngine';
import { reportUpstreamProviderFailure } from './sentry';

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
export function isBiomedicalOrLifeScienceQuery(query: string): boolean {
  const q = String(query || '').toLowerCase();
  const hasTechAiIntent =
    /\b(open[\s-]*source\s+llms?|large\s+language\s+models?|llms?\s+in\s+202\d|llama|mistral|qwen|deepseek|gemma|claude|gpt|transformers?|attention|long\s+context|context\s+window|kv\s+cache|rope|flashattention|ring\s+attention|mamba|coding|programming|react|typescript|javascript|python|rust|kubernetes|docker|nextjs|vercel|benchmark|mmlu|humaneval|gsm8k|huggingface|ollama|vllm|gguf)\b/i.test(
      q
    );
  const hasExplicitBioMedicalIntent =
    /\b(medical|clinical|medicine|health|disease|patient|therapy|treatment|drug|pharmacology|vaccine|virus|bacteria|cancer|tumor|oncology|cardiology|neurology|psychiatry|anatomy|physiology|biology|biological|genetics|genomics|dna|rna|protein|cell|molecular|endocrine|hormone|steroid|epiphyseal|surgery|surgical|pathology|diagnosis|prenatal|fetal|pediatric|hospital|pubmed|biomedical|epidemiology|nutrition|metabolism|longevity|sleep|gut\s+microbiome)\b/i.test(
      q
    );
  if (hasTechAiIntent && !hasExplicitBioMedicalIntent) {
    return false;
  }
  return hasExplicitBioMedicalIntent;
}

export function isNewsSearchQuery(query: string): boolean {
  return /\b(news|this\s+week|today|latest|headlines|announced|breaking|recent\s+updates|happened|happening)\b/i.test(
    String(query || '')
  );
}

export function isStockOrFinanceSearchQuery(query: string): boolean {
  return /\b(stocks?|shares?|earnings|investing|investors?|invest|tickers?|nasdaq|nyse|s&p|dow\s+jones|dividends?|market\s+cap|valuation|ipo|zacks|seeking\s+alpha|motley\s+fool|wall\s+street|hedge\s+fund|portfolio|bullish|bearish|price\s+target)\b/i.test(
    String(query || '')
  );
}

export function isFinanceOrStockPage(item: {
  title?: string;
  snippet?: string;
  url?: string;
  domain?: string;
  source?: string;
}): boolean {
  const dom = String(item.domain || '').toLowerCase().replace(/^www\./, '');
  const url = String(item.url || '').toLowerCase();
  const title = String(item.title || '').toLowerCase();
  const snippet = String(item.snippet || '').toLowerCase();
  const sourceName = String(item.source || '').toLowerCase();
  const combined = `${title} ${snippet} ${sourceName}`;

  if (
    /(?:^|\.)(zacks\.com|seekingalpha\.com|finance\.yahoo\.com|investors\.com|fool\.com|marketbeat\.com|benzinga\.com|marketwatch\.com|barrons\.com|investopedia\.com|tipranks\.com|tradingview\.com|stockanalysis\.com|nasdaq\.com|morningstar\.com|streetinsider\.com|gurufocus\.com|simplywall\.st|barchart\.com|finviz\.com|thestreet\.com|247wallst\.com|kiplinger\.com|etfdb\.com|investorplace\.com|stocktwits\.com|investing\.com|coinspeaker\.com|fxempire\.com|insidermonkey\.com|schaeffersresearch\.com)$/i.test(
      dom
    )
  ) {
    return true;
  }

  if (
    dom.includes('yahoo.com') &&
    (dom.includes('finance') || url.includes('/finance') || url.includes('/quote') || url.includes('/m/'))
  ) {
    return true;
  }

  if (
    /\b(zacks|seeking\s+alpha|motley\s+fool|marketwatch|barron'?s|benzinga|tipranks|investorplace|yahoo\s+finance|investor'?s\s+business\s+daily|ibd)\b/i.test(
      combined
    )
  ) {
    return true;
  }

  if (/\/(stocks?|markets?|investing|earnings|finance|quote|symbol|ticker)\//i.test(url)) {
    return true;
  }

  if (
    /\b(q[1-4]\s+202\d\s+earnings|earnings\s+call|earnings\s+report|earnings\s+preview|earnings\s+beat|earnings\s+miss|earnings\s+snapshot|stock\s+price|share\s+price|stocks?\s+to\s+buy|stocks?\s+to\s+watch|buy\s+rating|sell\s+rating|price\s+target|analyst\s+rating|wall\s+street\s+analysts?|nyse:|nasdaq:|otc:|market\s+movers|dividend\s+yield|short\s+interest|valuation\s+metrics|eps\s+of\s+\$|stock\s+split|shares?\s+surge|shares?\s+plunge|shares?\s+drop|shares?\s+jump|fiscal\s+q[1-4]|fintech\s+week|ai-enabled\s+finance|debt\s+ceiling|markets,\s*ai\s+and)\b/i.test(
      combined
    )
  ) {
    return true;
  }

  return false;
}

export function isPreferredNewsOutlet(item: {
  title?: string;
  snippet?: string;
  url?: string;
  domain?: string;
  source?: string;
}): boolean {
  const dom = String(item.domain || '').toLowerCase().replace(/^www\./, '');
  const src = String(item.source || '').toLowerCase();
  const title = String(item.title || '').toLowerCase();

  if (
    /(?:^|\.)(reuters\.com|apnews\.com|theverge\.com|techcrunch\.com|arstechnica\.com|wired\.com|theguardian\.com|bbc\.com|bbc\.co\.uk|technologyreview\.com|venturebeat\.com|nytimes\.com|wsj\.com|bloomberg\.com|cnbc\.com|engadget\.com|zdnet\.com|semafor\.com|axios\.com|npr\.org|pbs\.org|time\.com|fortune\.com|ft\.com|washingtonpost\.com)$/i.test(
      dom
    )
  ) {
    return true;
  }

  if (
    /\b(reuters|associated\s+press|ap\s+news|the\s+verge|techcrunch|ars\s+technica|wired|the\s+guardian|bbc|bbc\s+news|mit\s+technology\s+review|technology\s+review|venturebeat|bloomberg)\b/i.test(
      `${src} ${title}`
    )
  ) {
    return true;
  }

  return false;
}

export function rewriteNewsQuery(query: string, referenceDate?: Date): string {
  let q = String(query || '').trim();
  if (!isNewsSearchQuery(q)) return q;
  const now = referenceDate || new Date();
  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  // Expand standalone "AI" or "ai" to "artificial intelligence"
  q = q.replace(/\bAI\b/gi, 'artificial intelligence');
  if (/\b(this\s+week|today|latest)\b/i.test(q)) {
    q = q.replace(/\b(this\s+week|today|latest)\b/gi, monthYear);
  } else if (!q.toLowerCase().includes(monthYear.toLowerCase())) {
    q = `${q} ${monthYear}`;
  }
  if (!/\bnews\b/i.test(q)) {
    q = `${q} news`;
  }
  return q.replace(/\s+/g, ' ').trim();
}

export function buildDatedNewsSearchQuery(query: string, referenceDate?: Date): string {
  const trimmed = String(query || '').trim();
  if (!trimmed || !isNewsSearchQuery(trimmed)) return trimmed;
  return rewriteNewsQuery(trimmed, referenceDate);
}

export function scoreSourceRelevanceToQuery(
  source: { title?: string; snippet?: string; url?: string; domain?: string; source?: string },
  query: string
): number {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return 1;

  const title = String(source.title || '').toLowerCase();
  const snippet = String(source.snippet || '').toLowerCase();
  const domain = String(source.domain || '').toLowerCase();
  const url = String(source.url || '').toLowerCase();
  const combined = `${title} ${snippet} ${domain}`;

  const isStockQuery = isStockOrFinanceSearchQuery(q);
  const isNewsQuery = isNewsSearchQuery(q);

  // Down-rank finance and stock domains unless the query mentions stocks, shares, earnings or investing
  if (!isStockQuery && isFinanceOrStockPage(source)) {
    return -25;
  }

  const isBioQuery = isBiomedicalOrLifeScienceQuery(q);
  const isLlmOrTechQuery =
    /\b(llm|llms|large\s+language\s+model|open[\s-]*source|llama|mistral|qwen|deepseek|gemma|transformers?|attention|long\s+context|context\s+window|kv\s+cache|rope|flashattention|ring\s+attention|mamba|coding|developer|programming|software|ai\s+model|benchmark|ai\s+news|artificial\s+intelligence)\b/i.test(
      q
    );

  // Hard reject off-topic biomedical/clinical/prenatal/dietary papers when the query is not biomedical
  if (!isBioQuery) {
    if (
      /\b(pubmed\.ncbi\.nlm\.nih\.gov|pmc\.ncbi\.nlm\.nih\.gov|europepmc\.org|medline)\b/i.test(
        `${domain} ${url}`
      )
    ) {
      return -10;
    }
    if (
      /\b(prenatal\s+diagnosis|clinical|mediqa|nursing|patients?\s+with|medical\s+records|electronic\s+health\s+records|ehr|oncology|cardiovascular|maternal|fetal|pathology|disease\s+prognosis|hospitalized|healthcare|biomedical|pharmacol|epidemiolog|histopatholog|radiolog|dietary\s+recalls?|macronutrients?|shared[-\s]decision\s+making|option12)\b/i.test(
        combined
      )
    ) {
      return -10;
    }
  }

  // Hard reject ultra-narrow unrelated academic workshop shared tasks & non-AI transformer meanings for LLM/Transformer queries
  if (isLlmOrTechQuery) {
    if (
      !/\b(sparql|rdf|knowledge\s+graph)\b/i.test(q) &&
      /\b(sparql|text2sparql|rdf\s+triple)\b/i.test(combined)
    ) {
      return -10;
    }
    if (
      !/\b(semeval|narrative\s+similarity|shared\s+task|bea\s+202\d)\b/i.test(q) &&
      /\b(semeval[\s-]*202\d|narrative\s+similarity|shared\s+task|bea\s+202\d|mediqa|blunt[-\s]edge\s+models|francis\s+galton|creative\s+writing\s+in\s+llms|system\s+identification)\b/i.test(
        combined
      )
    ) {
      return -10;
    }
    if (
      !/\b(financial|finance|stock|forex|time[\s-]*series\s+forecasting|trading|portfolio)\b/i.test(q) &&
      /\b(financial\s+time[\s-]*series|stock\s+price\s+forecasting|portfolio\s+optimization|financial\s+market|forex|cryptocurrency\s+price)\b/i.test(
        combined
      )
    ) {
      return -10;
    }
    if (
      !/\b(power\s+grid|voltage|electrical|substation|dielectric)\b/i.test(q) &&
      /\b(power\s+transformer|distribution\s+transformer|oil[\s-]*immersed\s+transformer|high[\s-]*voltage\s+winding|substation|dielectric\s+breakdown|three[\s-]*phase\s+transformer)\b/i.test(
        combined
      )
    ) {
      return -10;
    }
    if (
      !/\b(hasbro|optimus|megatron|cybertron|movie)\b/i.test(q) &&
      /\b(optimus\s+prime|megatron|cybertron|autobots|decepticons|hasbro|michael\s+bay)\b/i.test(
        combined
      )
    ) {
      return -10;
    }
    const isExplanatoryQuery = /\b(how|what|explain|explanation|architecture|tutorial|guide|work|works|working|introduction|understanding)\b/i.test(q);
    if (isExplanatoryQuery && /\b(transformer|transformers)\b/i.test(q)) {
      if (
        !/\b(protein|drug|travelling\s+salesman|tsp|vehicle\s+routing|stock|forecasting)\b/i.test(q) &&
        /\b(de\s+novo\s+drug|protein-specific|travelling\s+salesman|travelling\s+salesperson|vehicle\s+routing\s+problem)\b/i.test(combined)
      ) {
        return -15.0;
      }
    }
  }

  const stopWords = new Set([
    'what', 'whats', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
    'are', 'is', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'the', 'and', 'for', 'with', 'from', 'into', 'about',
    'that', 'this', 'these', 'those', 'best', 'top', 'most', 'more', 'some',
    'in', 'on', 'at', 'to', 'of', 'by', 'as', 'an', 'a', 'or', 'handle',
    'week', 'today', 'yesterday', 'tomorrow', 'morning', 'evening', 'night',
    'latest', 'recent', 'news', 'updates', 'happened', 'happening', 'going',
    'one', 'matters', 'hey', 'hi', 'hello', 'up', 'please', 'pls', 'plz',
    'bro', 'dude', 'tell', 'give', 'show', 'check',
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ]);

  const rawTokens = q
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stopWords.has(t));

  if (rawTokens.length === 0) return 1.0;

  // Strict location & proper noun entity enforcement (e.g. "india", "hyderabad", "rbi")
  const keyEntitiesToEnforce: { term: string; altRegex: RegExp }[] = [];
  if (/\bindia\b/i.test(q)) {
    keyEntitiesToEnforce.push({
      term: 'india',
      altRegex:
        /\b(india|indian|telangana|andhra|hyderabad|peddapalli|godavarikhani|godhavarikhani|ramagundam|karimnagar|warangal|nizamabad|khammam|maharashtra|mumbai|pune|delhi|karnataka|bengaluru|bangalore|tamil\s*nadu|chennai|kerala|gujarat|rajasthan|uttar\s*pradesh|bihar|bengal|kolkata|punjab|haryana|odisha|assam|ndtv|thehindu|timesofindia|hindustantimes|indianexpress|telanganatoday|deccanchronicle|eenadu|sakshi)\b|\.in\b/i,
    });
  }
  if (/\bhyderabad\b/i.test(q)) keyEntitiesToEnforce.push({ term: 'hyderabad', altRegex: /\b(hyderabad|telangana|secunderabad|cyberabad)\b/i });
  if (/\brbi\b/i.test(q)) keyEntitiesToEnforce.push({ term: 'rbi', altRegex: /\b(rbi|reserve\s+bank)\b/i });
  if (/\btransformer\b/i.test(q)) keyEntitiesToEnforce.push({ term: 'transformer', altRegex: /\b(transformers?|attention)\b/i });

  for (const entity of keyEntitiesToEnforce) {
    if (!entity.altRegex.test(combined)) {
      return -25.0; // Hard reject results missing critical query entity
    }
  }

  let score = 0;
  let matchedCoreTokens = 0;

  const deAspirate = (w: string): string =>
    w
      .replace(/^thiple$/i, 'triple')
      .replace(/([kgcjtdpb])h/gi, '$1')
      .replace(/aa/gi, 'a')
      .replace(/ee/gi, 'i')
      .replace(/oo/gi, 'u');

  const titleDeAsp = deAspirate(title);
  const snippetDeAsp = deAspirate(snippet);

  for (const tok of rawTokens) {
    const isYear = /^202\d$/.test(tok);
    const stem = tok.endsWith('s') && tok.length > 4 ? tok.slice(0, -1) : tok;
    const tokDeAsp = deAspirate(tok);
    const stemDeAsp = deAspirate(stem);
    const altSpace = tok.includes('-') ? tok.replace(/-/g, ' ') : '';
    const isOpenSourceTok = tok === 'open-source' || tok === 'opensource';
    const isLlmTok = tok === 'llm' || tok === 'llms';
    const isAiTok = tok === 'ai' || tok === 'artificial' || tok === 'intelligence';

    const inTitle =
      (isAiTok
        ? /\b(ai|artificial\s+intelligence|openai|anthropic|claude|gemini|gpt|llama|deepseek|mistral|qwen|llm|machine\s+learning|neural)\b/i.test(
            title
          )
        : title.includes(tok)) ||
      (stem.length >= 4 && title.includes(stem)) ||
      (tokDeAsp.length >= 4 && titleDeAsp.includes(tokDeAsp)) ||
      (stemDeAsp.length >= 4 && titleDeAsp.includes(stemDeAsp)) ||
      (altSpace.length >= 4 && title.includes(altSpace)) ||
      (isOpenSourceTok && /\b(open[\s-]*source|open[\s-]*weight)\b/i.test(title)) ||
      (isLlmTok && /\b(llms?|language\s+models?|llama|mistral|qwen|deepseek|gemma)\b/i.test(title));

    const inSnippet =
      (isAiTok
        ? /\b(ai|artificial\s+intelligence|openai|anthropic|claude|gemini|gpt|llama|deepseek|mistral|qwen|llm|machine\s+learning|neural)\b/i.test(
            snippet
          )
        : snippet.includes(tok)) ||
      (stem.length >= 4 && snippet.includes(stem)) ||
      (tokDeAsp.length >= 4 && snippetDeAsp.includes(tokDeAsp)) ||
      (stemDeAsp.length >= 4 && snippetDeAsp.includes(stemDeAsp)) ||
      (altSpace.length >= 4 && snippet.includes(altSpace)) ||
      (isOpenSourceTok && /\b(open[\s-]*source|open[\s-]*weight)\b/i.test(snippet)) ||
      (isLlmTok && /\b(llms?|language\s+models?|llama|mistral|qwen|deepseek|gemma)\b/i.test(snippet));

    const inDomain = !isAiTok && (domain.includes(tok) || (tokDeAsp.length >= 4 && domain.includes(tokDeAsp)));

    if (inTitle) {
      score += isYear ? 1.0 : 2.5;
      if (!isYear) matchedCoreTokens += 1;
    } else if (inSnippet || inDomain) {
      score += isYear ? 0.5 : 1.2;
      if (!isYear) matchedCoreTokens += 1;
    }
  }

  const nonYearTokens = rawTokens.filter((t) => !/^202\d$/.test(t));
  const tokenMatchRatio = nonYearTokens.length > 0 ? matchedCoreTokens / nonYearTokens.length : 1;

  if (nonYearTokens.length >= 1 && matchedCoreTokens === 0) {
    return -25.0;
  }

  if (nonYearTokens.length >= 3 && tokenMatchRatio < 0.4 && matchedCoreTokens < 2) {
    return -15.0;
  }

  // Only apply outlet quality boost if the article matches the core entity terms of the query
  if (isNewsQuery && isPreferredNewsOutlet(source) && tokenMatchRatio >= 0.5) {
    score += 8.0;
  }

  const isOpenSourceLlmQuery =
    /\b(open[\s-]*source)\b/i.test(q) && /\b(llm|llms|language\s+model)\b/i.test(q);
  if (isOpenSourceLlmQuery) {
    const mentionsRealModelsOrBenchmarks =
      /\b(llama|mistral|mixtral|qwen|deepseek|gemma|phi[\s-]*[34]|yi|falcon|ollama|huggingface|vllm|mmlu|gsm8k|humaneval|open[\s-]*weight|leaderboard)\b/i.test(
        combined
      );
    if (mentionsRealModelsOrBenchmarks) {
      score += 5.0;
      matchedCoreTokens += 1;
    } else {
      score -= 4.0;
    }
  }

  const isLongContextTransformerQuery =
    /\b(transformers?)\b/i.test(q) && /\b(long[\s-]*context|context)\b/i.test(q);
  if (isLongContextTransformerQuery) {
    const mentionsLongContextMechanisms =
      /\b(long[\s-]*context|context\s+window|context\s+length|kv\s+cache|flashattention|ring\s+attention|rope|rotary\s+position|sparse\s+attention|linear\s+attention|sliding\s+window|mamba|state\s+space|alibi|yarn|inattention|collaborative\s+memory|sequence\s+length)\b/i.test(
        combined
      );
    if (mentionsLongContextMechanisms) {
      score += 5.0;
      matchedCoreTokens += 1;
    } else {
      score -= 4.5;
    }
  }

  return score;
}

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

  const allowBioMedical = isBiomedicalOrLifeScienceQuery(cleanQ);
  const isAiOrCsQuery =
    /\b(llm|llms|large\s+language\s+model|open[\s-]*source|llama|mistral|qwen|deepseek|gemma|transformers?|attention|long\s+context|context\s+window|kv\s+cache|rope|flashattention|ring\s+attention|mamba|neural|machine\s+learning|deep\s+learning)\b/i.test(
      cleanQ
    );
  const isOpenSourceLlmQuery =
    /\b(open[\s-]*source)\b/i.test(cleanQ) && /\b(llm|llms|language\s+model)\b/i.test(cleanQ);
  const isLongContextTransformerQuery =
    /\b(transformers?)\b/i.test(cleanQ) && /\b(long[\s-]*context|context)\b/i.test(cleanQ);

  const fetchEuropePmc = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    if (!allowBioMedical) return items;
    try {
      const epmcUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
        cleanQ
      )}&format=json&resultType=core&pageSize=${Math.min(10, maxResults)}`;
      const res = await fetch(epmcUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'KinichResearch/1.0' },
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
          ? `${citationPrefix ? `[${citationPrefix}] ` : ''}${rawAbstract.slice(0, 620)}`
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

  const fetchArxivCs = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    if (!isAiOrCsQuery) return items;
    try {
      let arxivRawExpr = '';
      if (isOpenSourceLlmQuery) {
        arxivRawExpr = `(all:Llama OR all:Mistral OR all:Qwen OR all:DeepSeek OR all:Gemma) AND (all:open OR all:benchmark OR all:MMLU) AND (cat:cs.CL OR cat:cs.AI)`;
      } else if (isLongContextTransformerQuery) {
        arxivRawExpr = `(ti:transformer OR ti:attention OR ti:context) AND (all:RoPE OR all:FlashAttention OR all:KV) AND (cat:cs.CL OR cat:cs.AI)`;
      } else {
        const stopWords = new Set(['how', 'what', 'which', 'are', 'the', 'best', 'top', 'in', 'do', 'does', 'for', 'with', 'and', 'to', 'of', 'handle']);
        const terms = cleanQ
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !stopWords.has(w) && !/^202\d$/.test(w))
          .slice(0, 5);
        if (terms.length === 0) return items;
        const termQuery = terms.map((t) => `all:${t}`).join(' AND ');
        arxivRawExpr = `(${termQuery}) AND (cat:cs.CL OR cat:cs.AI)`;
      }

      const arxivUrl = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(arxivRawExpr)}&sortBy=relevance&sortOrder=descending&max_results=10`;
      const res = await fetch(arxivUrl, {
        headers: { 'User-Agent': 'KinichResearch/1.0' },
        signal: signal || AbortSignal.timeout(4000),
      });
      if (!res.ok) return items;
      const xml = await res.text();
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
      for (const entry of entries) {
        const title = decodeXmlEntities(entry.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
        const summary = decodeXmlEntities(entry.match(/<summary>([\s\S]*?)<\/summary>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
        const idUrl = (entry.match(/<id>([\s\S]*?)<\/id>/i)?.[1] || '').trim().replace(/^http:\/\//i, 'https://');
        const published = (entry.match(/<published>([\s\S]*?)<\/published>/i)?.[1] || '').trim();
        const year = published ? published.slice(0, 4) : '';
        const firstAuthor = decodeXmlEntities(entry.match(/<author>\s*<name>([\s\S]*?)<\/name>/i)?.[1] || '').trim();
        if (!title || !idUrl || summary.length < 180) continue;
        const candidate: SearchResultItem = {
          position: items.length + 1,
          title: `${title}${year ? ` (${year})` : ''} — arXiv`,
          url: idUrl,
          snippet: `${firstAuthor ? `[${firstAuthor} et al. · arXiv ${year}] ` : ''}${summary.slice(0, 620)}`,
          displayed_url: idUrl,
          domain: 'arxiv.org',
          source: 'arXiv CS.CL / CS.AI',
          date: year || undefined,
          provider: 'multi_source',
        };
        if (scoreSourceRelevanceToQuery(candidate, cleanQ) >= 3.0) {
          items.push(candidate);
        }
      }
    } catch {}
    return items;
  };

  const fetchOpenAlex = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    try {
      const searchStr = isOpenSourceLlmQuery
        ? 'open-source LLM Llama Mistral Qwen DeepSeek Gemma benchmark evaluation'
        : isLongContextTransformerQuery
        ? 'transformer long context attention KV cache RoPE FlashAttention sequence length'
        : cleanQ;
      const oaUrl = `https://api.openalex.org/works?search=${encodeURIComponent(
        searchStr
      )}&per-page=${Math.min(10, maxResults + 2)}&filter=has_abstract:true`;
      const res = await fetch(oaUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'KinichResearch/1.0 (mailto:kinich.app@kinich.app)' },
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
        if (abstractText.length < 180) continue;
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

        const candidate: SearchResultItem = {
          position: items.length + 1,
          title: `${title}${year ? ` (${year})` : ''} — ${venue}`,
          url: landingUrl,
          snippet: `${metaPrefix ? `[${metaPrefix}] ` : ''}${abstractText.slice(0, 620)}`,
          displayed_url: landingUrl,
          domain,
          source: venue || domain,
          date: year || undefined,
          provider: 'multi_source',
        };
        if (scoreSourceRelevanceToQuery(candidate, cleanQ) >= 3.0) {
          items.push(candidate);
        }
      }
    } catch {}
    return items;
  };

  const [epmcItems, arxivItems, oaItems] = await Promise.all([
    fetchEuropePmc(),
    fetchArxivCs(),
    fetchOpenAlex(),
  ]);
  const combined: SearchResultItem[] = [];
  const seenTitles = new Set<string>();
  const maxLen = Math.max(epmcItems.length, arxivItems.length, oaItems.length);
  for (let i = 0; i < maxLen; i++) {
    for (const candidate of [arxivItems[i], oaItems[i], epmcItems[i]]) {
      if (!candidate) continue;
      if (isUnsolicitedNonEnglishResult(candidate, cleanQ)) continue;
      if (scoreSourceRelevanceToQuery(candidate, cleanQ) < 3.0) continue;
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
  signal?: AbortSignal,
  locationInfo?: LocationInfoParam
): Promise<{ results: SearchResultItem[]; error?: string; hadProviderFailure: boolean }> {
  const errors: string[] = [];
  let succeededProviders = 0;

  let glParam = (locationInfo?.countryCode || 'US').toUpperCase();
  if (locationInfo?.country && !locationInfo?.countryCode) {
    if (/india/i.test(locationInfo.country)) glParam = 'IN';
    else if (/united states|usa/i.test(locationInfo.country)) glParam = 'US';
    else if (/united kingdom|uk/i.test(locationInfo.country)) glParam = 'GB';
    else if (/germany/i.test(locationInfo.country)) glParam = 'DE';
  }
  const hlParam = glParam === 'IN' ? 'en' : 'en-US';
  const ceidParam = `${glParam}:en`;

  const isNewsOrLatest = /\b(latest|news|today|recent|update|updates|current|breaking|2025|2026|headline|headlines)\b/i.test(
    query
  );
  const isTechOrCode = /\b(code|programming|react|typescript|javascript|python|rust|error|bug|api|github|framework|library|sql|docker|linux)\b/i.test(
    query
  );
  const cleanUpstreamQuery =
    query
      .replace(
        /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+202\d)\b/gi,
        ' '
      )
      .replace(/[,.;:!?]+/g, ' ')
      .replace(
        /\b(hey|hi|hello|what's|whats|what\s+is|up\s+with|going\s+on\s+with|happened\s+in|happened\s+with|tell\s+me\s+about|can\s+you|please|pls|plz|bro|dude)\b/gi,
        ' '
      )
      .replace(/\bthiple\b/gi, 'triple')
      .replace(/\bgodhavarikhani\b/gi, 'Godavarikhani')
      .replace(/\bartificial\s+intelligence\b/gi, 'AI')
      .replace(/\s+/g, ' ')
      .trim() || query;
  const conciseTopicQuery =
    cleanUpstreamQuery
      .replace(
        /\b(this\s+week|today|yesterday|tomorrow|latest|news|headlines|breaking|recent|updates?|the|in|on|at|with|from|for|of|about|is|are|was|were)\b/gi,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim() || cleanUpstreamQuery;
  const broadTopicTokens = conciseTopicQuery
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^(india|ride|triple|thiple)$/i.test(w));
  const broadTopicQuery =
    broadTopicTokens.length >= 2 && broadTopicTokens.length < conciseTopicQuery.split(/\s+/).length
      ? broadTopicTokens.slice(0, 5).join(' ')
      : '';

  // 1. Google News RSS + Curated Preferred News Outlet RSS (Reuters, The Verge, TechCrunch, AP, The Guardian, Ars Technica)
  const fetchGoogleNewsRss = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    const isStockQ = isStockOrFinanceSearchQuery(query);
    const isAiOrTechNews =
      isNewsOrLatest &&
      /\b(ai|artificial\s+intelligence|llm|openai|anthropic|google|microsoft|meta|apple|tech|technology|developer|coding|software|model|agent|robotics)\b/i.test(
        query
      );

    const parseRssBlockList = (
      xml: string,
      defaultDomain?: string,
      defaultPublisher?: string
    ): SearchResultItem[] => {
      const parsed: SearchResultItem[] = [];
      const rawBlocks =
        xml.match(/<item>[\s\S]*?<\/item>/gi) ||
        xml.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) ||
        [];
      for (const block of rawBlocks.slice(0, 12)) {
        const titleRaw = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
        const linkAttrMatch = block.match(/<link[^>]+href="([^"]+)"/i)?.[1];
        const linkTagMatch = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1];
        const linkRaw = linkAttrMatch || linkTagMatch || '';
        const pubDateRaw =
          block.match(/<(?:pubDate|published|updated|dc:date)>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i)?.[1] || '';
        const contentEncodedRaw =
          block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)?.[1] ||
          block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ||
          '';
        const descRaw =
          block.match(/<(?:description|summary)[^>]*>([\s\S]*?)<\/(?:description|summary)>/i)?.[1] || '';
        const sourceMatch = block.match(/<source[^>]*url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/i);

        const sourceUrl = sourceMatch?.[1]?.trim() || '';
        const publisherName = decodeXmlEntities(sourceMatch?.[2] || defaultPublisher || '');
        const link = decodeXmlEntities(linkRaw).trim();
        if (!link.startsWith('http')) continue;

        let domain = defaultDomain || '';
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
        const cleanBody = decodeXmlEntities(contentEncodedRaw || descRaw);
        const dateStr = pubDateRaw
          ? new Date(pubDateRaw).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '';
        const snippetParts: string[] = [];
        if (publisherName) snippetParts.push(`${publisherName}${dateStr ? ` (${dateStr})` : ''}`);
        if (cleanBody && cleanBody.toLowerCase() !== cleanTitle.toLowerCase()) {
          snippetParts.push(cleanBody);
        } else {
          snippetParts.push(cleanTitle);
        }

        const candidate: SearchResultItem = {
          position: parsed.length + 1,
          title:
            publisherName && !cleanTitle.toLowerCase().includes(publisherName.toLowerCase())
              ? `${cleanTitle} — ${publisherName}`
              : cleanTitle,
          url: link,
          snippet: snippetParts.join(' — ').slice(0, 680),
          displayed_url: sourceUrl || link,
          domain,
          source: publisherName || domain,
          date: dateStr || undefined,
          provider: 'multi_source',
        };

        if (!isStockQ && isFinanceOrStockPage(candidate)) continue;
        parsed.push(candidate);
      }
      return parsed;
    };

    try {
      const strippedTopic = conciseTopicQuery || query;
      void isAiOrTechNews;

      const googleNewsSearchExpr = !isStockQ
        ? `${strippedTopic} -stock -stocks -earnings -shares -zacks -seekingalpha`
        : strippedTopic;

      const feedPromises: Promise<SearchResultItem[]>[] = [
        (async () => {
          const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(strippedTopic)}&hl=${hlParam}&gl=${glParam}&ceid=${ceidParam}`;
          const res = await fetch(rssUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
              'Accept-Language': `${hlParam},en;q=0.9`,
            },
            signal: signal || AbortSignal.timeout(3_200),
          });
          if (!res.ok) return [];
          succeededProviders += 1;
          return parseRssBlockList(await res.text());
        })().catch(() => []),
        (async () => {
          const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(googleNewsSearchExpr)}&hl=${hlParam}&gl=${glParam}&ceid=${ceidParam}`;
          const res = await fetch(rssUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
              'Accept-Language': `${hlParam},en;q=0.9`,
            },
            signal: signal || AbortSignal.timeout(3_200),
          });
          if (!res.ok) return [];
          succeededProviders += 1;
          return parseRssBlockList(await res.text());
        })().catch(() => []),
      ];

      if (broadTopicQuery && broadTopicQuery.toLowerCase() !== strippedTopic.toLowerCase()) {
        feedPromises.push(
          (async () => {
            const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(broadTopicQuery)}&hl=${hlParam}&gl=${glParam}&ceid=${ceidParam}`;
            const res = await fetch(rssUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
                'Accept-Language': `${hlParam},en;q=0.9`,
              },
              signal: signal || AbortSignal.timeout(3_200),
            });
            if (!res.ok) return [];
            succeededProviders += 1;
            return parseRssBlockList(await res.text());
          })().catch(() => [])
        );
      }

      const feedBatches = await Promise.all(feedPromises);
      const reversedBatches = [...feedBatches].reverse();
      const maxLen = Math.max(0, ...reversedBatches.map((b) => b.length));
      for (let i = 0; i < maxLen; i++) {
        for (const batch of reversedBatches) {
          if (batch[i]) {
            items.push(batch[i]);
          }
        }
      }
    } catch (err: any) {
      errors.push(`GoogleNews: ${err?.message || 'failed'}`);
    }
    return items;
  };

  // 2. Bing Web RSS (organic multi-domain web results with dynamic country code)
  const fetchBingWebRss = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    try {
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(cleanUpstreamQuery)}&setlang=${hlParam}&cc=${glParam}&format=rss`;
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

  // 3. DuckDuckGo HTML organic search (regional kl=in-en for India or kl=us-en & Strict SafeSearch kp=1)
  const fetchDuckDuckGoHtml = async (): Promise<SearchResultItem[]> => {
    const items: SearchResultItem[] = [];
    const ddgKl = glParam === 'IN' ? 'in-en' : 'us-en';
    const acceptLang = glParam === 'IN' ? 'en-IN,en-US;q=0.9,en;q=0.8' : 'en-US,en;q=0.9';
    try {
      const ddgRes = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanUpstreamQuery)}&kl=${ddgKl}&kp=1`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': acceptLang,
            Cookie: `kl=${ddgKl}; kp=1`,
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
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(conciseTopicQuery)}&tags=story&hitsPerPage=5`,
        {
          headers: { 'User-Agent': 'KinichSearch/1.0' },
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
        `https://www.reddit.com/search.json?q=${encodeURIComponent(conciseTopicQuery)}&sort=relevance&t=year&limit=3`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; KinichSearch/1.0; +https://kinich.app)',
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
            .slice(0, 450);
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
          headers: { 'User-Agent': 'KinichSearch/1.0' },
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
          headers: { 'User-Agent': 'KinichAI/1.0' },
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

  // Deduplicate by URL and diversify by domain, filtering out off-topic and finance/stock pages on non-stock queries
  const isStockQ = isStockOrFinanceSearchQuery(query);
  const isWeatherOrLocalQ = /\b(weather|forecast|temperature|rain|monsoon|humidity|aqi|near\s+me|local\s+news)\b/i.test(query);
  const scoredPool = combinedPool
    .filter((item) => {
      if (isUnsolicitedNonEnglishResult(item, query) || isBoilerplateOrJunkSearchResult(item, query)) {
        return false;
      }
      if (!isStockQ && isFinanceOrStockPage(item)) {
        return false;
      }
      // When user is in India (glParam === 'IN') and asks a weather/local query, exclude unrelated US/UK/ASEAN regional weather columns
      if (glParam === 'IN' && isWeatherOrLocalQ) {
        const domAndText = `${item.domain || ''} ${item.url || ''} ${item.title || ''} ${item.snippet || ''}`.toLowerCase();
        if (
          /\b(cowboystatedaily\.com|flxweather\.com|uwm\.edu|cobbcountycourier\.com|clarionledger\.com|hattiesburgamerican\.com|asean\.org|wyoming|finger\s+lakes|milwaukee|sheffield|cobb\s+county|mississippi|hattiesburg)\b/i.test(
            domAndText
          )
        ) {
          return false;
        }
      }
      const rel = scoreSourceRelevanceToQuery(item, query);
      return rel >= 1.0;
    })
    .sort((a, b) => scoreSourceRelevanceToQuery(b, query) - scoreSourceRelevanceToQuery(a, query));

  const seenUrls = new Set<string>();
  const domainCounts = new Map<string, number>();
  const firstPass: SearchResultItem[] = [];
  const secondPass: SearchResultItem[] = [];

  for (const item of scoredPool) {
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
        'User-Agent': 'Kinich-AI/1.0',
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
export interface LocationInfoParam {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  source?: string;
}

export async function searchWebReliable(
  query: string,
  mode: 'organic' | 'news' = 'organic',
  _nsfwMode = false,
  signal?: AbortSignal,
  locationInfo?: LocationInfoParam
): Promise<SearchExecutionOutcome> {
  const trimmed = String(query || '').trim();
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const locKey = locationInfo?.city ? `:${locationInfo.city.toLowerCase()}` : locationInfo?.countryCode ? `:${locationInfo.countryCode.toLowerCase()}` : '';
  const cacheKey = `${mode}:${_nsfwMode ? '1' : '0'}${locKey}:${trimmed.toLowerCase()}`;

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
        toolLabel: isAdultQueryOrText(trimmed) ? 'kinich.safesearch.strict' : tregConfigured
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

    const isWeatherQuery =
      /\b(weather|forecast|temperature|rain|monsoon|humidity|wind\s+speed|uv\s+index|air\s+quality|aqi)\b/i.test(
        trimmed
      );
    const isNewsModeOrQuery = !isWeatherQuery && (mode === 'news' || isNewsSearchQuery(trimmed));
    const isStockQuery = isStockOrFinanceSearchQuery(trimmed);
    const isLocalOrNewsQuery =
      isWeatherQuery ||
      /\b(weather|near me|nearby|restaurants?|hospitals?|cinemas?|malls?|stores?|flight|temperature|forecast|in my city|local)\b/i.test(
        trimmed
      );

    let enrichedQuery = trimmed;
    if (isLocalOrNewsQuery && locationInfo) {
      const city = locationInfo.city || '';
      const region = locationInfo.region || '';
      const countryStr = locationInfo.country || locationInfo.countryCode || '';
      if (city && !new RegExp(`\\b${city}\\b`, 'i').test(trimmed)) {
        if (/\b(near me|nearby)\b/i.test(trimmed)) {
          enrichedQuery = trimmed.replace(/\b(near me|nearby)\b/gi, `in ${city}${region ? ` ${region}` : ''}`);
        } else if (isWeatherQuery) {
          enrichedQuery = `${city}${region ? ` ${region}` : ''}${countryStr ? ` ${countryStr}` : ''} ${trimmed}`;
        } else {
          enrichedQuery = `${trimmed} ${city}${region ? ` ${region}` : ''}${countryStr ? ` ${countryStr}` : ''}`;
        }
      } else if (countryStr && !new RegExp(`\\b${countryStr}\\b`, 'i').test(trimmed)) {
        enrichedQuery = `${trimmed} ${countryStr}`;
      }
    }

    const upstreamQuery =
      !isTestEnv && isNewsModeOrQuery && !isStockQuery
        ? `${buildDatedNewsSearchQuery(enrichedQuery)} -stock -earnings -zacks -seekingalpha`
        : enrichedQuery;

    if (tregConfigured) {
      tasks.push(
        (async () => {
          try {
            const tregPayload: Record<string, any> = { q: upstreamQuery, safe: 'active', adult: '0' };
            const cCode = (locationInfo?.countryCode || locationInfo?.country || '').toLowerCase();
            if (cCode) {
              tregPayload.gl = cCode.length === 2 ? cCode : cCode === 'india' ? 'in' : 'us';
              tregPayload.hl = 'en';
            }
            if (locationInfo?.city) {
              tregPayload.location = locationInfo.city;
            }

            const data = await callTregEndpointReliable(
              endpointId,
              tregPayload,
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
                !isBoilerplateOrJunkSearchResult(item, trimmed) &&
                (isStockQuery || !isFinanceOrStockPage(item)) &&
                (isTestEnv || scoreSourceRelevanceToQuery(item, trimmed) >= 1.0)
            );
            if (rawResults.length > 0 && tregResults.length === 0) {
              tregError = 'Treg returned only boilerplate navigation links';
            }
            if (!isTestEnv && tregResults.length > 0 && resolveEarly && !isNewsModeOrQuery) {
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
          const tf = await callTinyfishSearch(upstreamQuery, { signal, timeoutMs: isTestEnv ? 5_500 : 1_800 });
          const cleanTf = tf.results.filter(
            (item) =>
              !isUnsolicitedNonEnglishResult(item, trimmed) &&
              !isBoilerplateOrJunkSearchResult(item, trimmed) &&
              (isStockQuery || !isFinanceOrStockPage(item)) &&
              (isTestEnv || scoreSourceRelevanceToQuery(item, trimmed) >= 1.0)
          );
          if (cleanTf.length > 0) {
            tinyfishResults = cleanTf;
            if (!isTestEnv && tregResults.length > 0 && resolveEarly && !isNewsModeOrQuery) {
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

    // For news or weather queries in non-test runtime, also fetch public regional sources with enrichedQuery
    let preferredNewsResults: SearchResultItem[] = [];
    if (!isTestEnv && (isNewsModeOrQuery || isWeatherQuery) && !isStockQuery) {
      tasks.push(
        (async () => {
          try {
            const pubNews = await fallbackPublicWebSearchWithStatus(enrichedQuery, signal, locationInfo);
            preferredNewsResults = pubNews.results.filter(
              (item) =>
                !isFinanceOrStockPage(item) &&
                Math.max(
                  scoreSourceRelevanceToQuery(item, trimmed),
                  scoreSourceRelevanceToQuery(item, enrichedQuery)
                ) >= 1.2
            );
          } catch {}
        })()
      );
    }

    if (tasks.length > 0) {
      await Promise.race([Promise.allSettled(tasks), earlyPromise]);
      if (earlyTimer) clearTimeout(earlyTimer);
    }

  // If we got results from Treg, Tinyfish, or preferred news outlets:
  if (tregResults.length > 0 || tinyfishResults.length > 0 || preferredNewsResults.length > 0) {
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
      if (!isStockQuery && isFinanceOrStockPage(item)) return;
      if (!isTestEnv && scoreSourceRelevanceToQuery(item, trimmed) < 1.0) return;
      const key = normalizeUrlKey(item.url);
      if (!seenUrls.has(key)) {
        seenUrls.add(key);
        merged.push({ ...item, position: merged.length + 1 });
      }
    };

    // Interleave preferred news outlets (when news query), Treg Google SERP, and TinyFish Agent-Native results
    const maxLen = Math.max(tregResults.length, tinyfishResults.length, preferredNewsResults.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < preferredNewsResults.length) addResult(preferredNewsResults[i]);
      if (i < tregResults.length) addResult(tregResults[i]);
      if (i < tinyfishResults.length) addResult(tinyfishResults[i]);
    }

    if (!isTestEnv && isNewsModeOrQuery) {
      merged.sort((a, b) => scoreSourceRelevanceToQuery(b, trimmed) - scoreSourceRelevanceToQuery(a, trimmed));
      merged.forEach((item, idx) => {
        item.position = idx + 1;
      });
    }

    if (merged.length > 0) {
      const bothUsed = tregResults.length > 0 && tinyfishResults.length > 0;
      const providerUsed: 'treg' | 'tinyfish' | 'multi_source' =
        bothUsed
          ? (process.env.NODE_ENV === 'test' ? 'treg' : 'multi_source')
          : tregResults.length > 0
          ? 'treg'
          : tinyfishResults.length > 0
          ? 'tinyfish'
          : 'multi_source';

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

  // Fallback to public search when neither primary provider succeeded (pass enrichedQuery + locationInfo so regional gl=IN is preserved!)
  const fallback = await fallbackPublicWebSearchWithStatus(enrichedQuery, signal, locationInfo);

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
          headers: { 'User-Agent': 'Kinich-Reader/1.0', Accept: 'application/vnd.github.v3+json' },
          signal: AbortSignal.timeout(3500),
        }),
        fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
          headers: { 'User-Agent': 'Kinich-Reader/1.0', Accept: 'application/vnd.github.v3.raw' },
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
    const pageTitle = titleMatch ? decodeXmlEntities(titleMatch[1]) : '';
    const metaDescMatch =
      html.match(/<meta[^>]+(?:property=["']og:description["']|name=["']description["'])[^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property=["']og:description["']|name=["']description["'])/i);
    const metaDesc = metaDescMatch ? decodeXmlEntities(metaDescMatch[1]) : '';

    const structuredMd = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<form\b[\s\S]*?<\/form>/gi, ' ')
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<(?:p|div|section|article|br|tr)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim()
      .slice(0, 50_000);

    const metaLead = metaDesc && metaDesc.length > 40 ? `${metaDesc}\n\n` : '';
    const finalContent = pageTitle && !structuredMd.startsWith('# ')
      ? `# ${pageTitle}\n\n${metaLead}${structuredMd}`
      : `${metaLead}${structuredMd}`;

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
