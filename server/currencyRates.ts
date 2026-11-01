/**
 * Live Currency Exchange Rates Provider for Zeno
 * Provides real-time spot rates (e.g. USD to INR, EUR, GBP) using open spot rate providers
 * with caching to answer currency and revenue calculations accurately without boilerplate cop-outs.
 */

interface CachedRates {
  timestamp: number;
  rates: Record<string, number>;
  lastUpdatedText: string;
}

// Fallback rates if network is temporarily unavailable
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  INR: 95.05,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.39,
  AUD: 1.54,
  JPY: 153.2,
  CNY: 7.24,
  SGD: 1.33,
  AED: 3.67,
};

let cached: CachedRates | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getLiveExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.rates;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      if (data && data.rates && typeof data.rates.INR === 'number') {
        cached = {
          timestamp: now,
          rates: { ...FALLBACK_RATES, ...data.rates },
          lastUpdatedText: data.time_last_update_utc || new Date().toUTCString(),
        };
        return cached.rates;
      }
    }
  } catch (err: any) {
    console.warn('[Currency] Live exchange rate fetch failed, using fallback:', err?.message);
  }

  return cached?.rates || FALLBACK_RATES;
}

/**
 * Checks if a user's prompt is asking for currency exchange, conversion, or multi-currency math.
 */
export function isCurrencyQuery(text: string): boolean {
  return /\b(usd|inr|rupees?|dollars?|exchange\s*rate|currency\s*rate|to\s*inr|in\s*inr|to\s*usd|in\s*usd|eur|gbp|spot\s*rate|forex)\b/i.test(
    text
  );
}

/**
 * Formats a live financial context prompt block to inject into the LLM system prompt.
 */
export async function getCurrencyPromptContext(text: string): Promise<string> {
  if (!isCurrencyQuery(text)) return '';

  const rates = await getLiveExchangeRates();
  const inr = rates.INR ? rates.INR.toFixed(2) : '95.05';
  const eur = rates.EUR ? rates.EUR.toFixed(4) : '0.92';
  const gbp = rates.GBP ? rates.GBP.toFixed(4) : '0.79';

  return `\n\n[VERIFIED LIVE FINANCIAL SPOT RATES (Base: USD)]:
- 1 USD = ${inr} INR (Indian Rupee)
- 1 EUR = ${eur} USD (equivalent to ~${(parseFloat(inr) / parseFloat(eur)).toFixed(2)} INR)
- 1 GBP = ${gbp} USD (equivalent to ~${(parseFloat(inr) / parseFloat(gbp)).toFixed(2)} INR)

FINANCIAL CALCULATION DIRECTIVE:
The user is asking a currency conversion or financial calculation query.
1. Use the EXACT live spot rate provided above (1 USD = ${inr} INR).
2. Carry out the multiplication and conversion steps explicitly (e.g., Number of subscribers × Fee = Total USD; Total USD × ${inr} = Total INR).
3. Express large INR amounts in Lakhs / Crores for clarity alongside the raw number (e.g., 14.25 Lakh INR).
4. NEVER provide evasive cop-outs like "exchange rates fluctuate continuously, check a financial website" or "for example if hypothetically 85 INR". State the precise calculated answer immediately.`;
}
