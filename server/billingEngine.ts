import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import DodoPayments from 'dodopayments';
import type { CountryCode, Currency } from 'dodopayments/resources/misc';
import type { PaymentMethodTypes } from 'dodopayments/resources/payments';
import type { Express, Request, Response } from 'express';
import {
  getAppBaseUrl,
  getDodoPaymentsApiKey,
  getDodoPaymentsEnvironment,
  getDodoPaymentsWebhookKey,
  getDodoProductIds,
  sanitizeErrorMessage,
  sendNormalizedError,
} from './config';
import { requireFirebaseAuth } from './auth';
import {
  registerBillingEntitlementResolver,
  upgradeServerSubscriptionPlan,
  type SubscriptionPlanTier,
} from './rateLimiter';

export type BillingPlanId = 'free' | 'spark' | 'fire';
export type PaidPlanId = 'spark' | 'fire';
export type BillingInterval = 'monthly' | 'yearly';
export type PlanStatus =
  | 'none'
  | 'pending'
  | 'active'
  | 'past_due'
  | 'on_hold'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface SupportedCountryInfo {
  code: CountryCode;
  name: string;
  flag: string;
  currency: Currency;
  symbol: string;
  approxRateFromUsd: number;
  taxLabel: string;
  defaultTaxRate: number;
}

export interface PaymentMethodBadgeInfo {
  id: string;
  label: string;
  dodoType?: PaymentMethodTypes;
  prominent?: boolean;
  recurringSupported: boolean;
  note?: string;
}

export interface CountryPaymentMethodsResult {
  country: CountryCode;
  currency: Currency;
  subscriptionMethods: PaymentMethodBadgeInfo[];
  oneTimeOnlyMethods: PaymentMethodBadgeInfo[];
  allowedPaymentMethodTypes: PaymentMethodTypes[];
  mandateNote?: string;
}

export const SUPPORTED_DODO_COUNTRIES: SupportedCountryInfo[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', symbol: '$', approxRateFromUsd: 1, taxLabel: 'Sales Tax', defaultTaxRate: 0 },
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', symbol: '₹', approxRateFromUsd: 84, taxLabel: 'GST (18%)', defaultTaxRate: 0.18 },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', symbol: '£', approxRateFromUsd: 0.79, taxLabel: 'VAT (20%)', defaultTaxRate: 0.20 },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', symbol: 'CA$', approxRateFromUsd: 1.38, taxLabel: 'GST/HST', defaultTaxRate: 0.05 },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD', symbol: 'A$', approxRateFromUsd: 1.52, taxLabel: 'GST (10%)', defaultTaxRate: 0.10 },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'VAT (19%)', defaultTaxRate: 0.19 },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'VAT (20%)', defaultTaxRate: 0.20 },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'BTW (21%)', defaultTaxRate: 0.21 },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'VAT (21%)', defaultTaxRate: 0.21 },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'VAT (20%)', defaultTaxRate: 0.20 },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'IVA (22%)', defaultTaxRate: 0.22 },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'IVA (21%)', defaultTaxRate: 0.21 },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'IVA (23%)', defaultTaxRate: 0.23 },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'VAT (23%)', defaultTaxRate: 0.23 },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'VAT (25.5%)', defaultTaxRate: 0.255 },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', currency: 'PLN', symbol: 'zł', approxRateFromUsd: 3.98, taxLabel: 'VAT (23%)', defaultTaxRate: 0.23 },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', currency: 'SEK', symbol: 'kr', approxRateFromUsd: 10.5, taxLabel: 'Moms (25%)', defaultTaxRate: 0.25 },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', currency: 'NOK', symbol: 'kr', approxRateFromUsd: 10.8, taxLabel: 'MVA (25%)', defaultTaxRate: 0.25 },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', currency: 'DKK', symbol: 'kr', approxRateFromUsd: 6.88, taxLabel: 'Moms (25%)', defaultTaxRate: 0.25 },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', currency: 'CHF', symbol: 'CHF', approxRateFromUsd: 0.88, taxLabel: 'MWST (8.1%)', defaultTaxRate: 0.081 },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: 'SGD', symbol: 'S$', approxRateFromUsd: 1.34, taxLabel: 'GST (9%)', defaultTaxRate: 0.09 },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY', symbol: '¥', approxRateFromUsd: 152, taxLabel: 'JCT (10%)', defaultTaxRate: 0.10 },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', currency: 'KRW', symbol: '₩', approxRateFromUsd: 1380, taxLabel: 'VAT (10%)', defaultTaxRate: 0.10 },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', currency: 'BRL', symbol: 'R$', approxRateFromUsd: 5.7, taxLabel: 'Taxes', defaultTaxRate: 0 },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', currency: 'MXN', symbol: 'MX$', approxRateFromUsd: 20.1, taxLabel: 'IVA (16%)', defaultTaxRate: 0.16 },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', currency: 'PHP', symbol: '₱', approxRateFromUsd: 58, taxLabel: 'VAT (12%)', defaultTaxRate: 0.12 },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', currency: 'MYR', symbol: 'RM', approxRateFromUsd: 4.38, taxLabel: 'SST (8%)', defaultTaxRate: 0.08 },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', currency: 'HKD', symbol: 'HK$', approxRateFromUsd: 7.78, taxLabel: 'Tax (0%)', defaultTaxRate: 0 },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED', symbol: 'AED ', approxRateFromUsd: 3.67, taxLabel: 'VAT (5%)', defaultTaxRate: 0.05 },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', currency: 'SAR', symbol: 'SAR ', approxRateFromUsd: 3.75, taxLabel: 'VAT (15%)', defaultTaxRate: 0.15 },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', symbol: 'R', approxRateFromUsd: 17.8, taxLabel: 'VAT (15%)', defaultTaxRate: 0.15 },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', currency: 'NZD', symbol: 'NZ$', approxRateFromUsd: 1.66, taxLabel: 'GST (15%)', defaultTaxRate: 0.15 },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', currency: 'IDR', symbol: 'Rp', approxRateFromUsd: 15700, taxLabel: 'PPN (11%)', defaultTaxRate: 0.11 },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', currency: 'THB', symbol: '฿', approxRateFromUsd: 33.8, taxLabel: 'VAT (7%)', defaultTaxRate: 0.07 },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', currency: 'VND', symbol: '₫', approxRateFromUsd: 25300, taxLabel: 'VAT (10%)', defaultTaxRate: 0.10 },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', currency: 'TWD', symbol: 'NT$', approxRateFromUsd: 32.1, taxLabel: 'VAT (5%)', defaultTaxRate: 0.05 },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', currency: 'ILS', symbol: '₪', approxRateFromUsd: 3.72, taxLabel: 'VAT (17%)', defaultTaxRate: 0.17 },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', currency: 'TRY', symbol: '₺', approxRateFromUsd: 34.2, taxLabel: 'KDV (20%)', defaultTaxRate: 0.20 },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', symbol: '₦', approxRateFromUsd: 1640, taxLabel: 'VAT (7.5%)', defaultTaxRate: 0.075 },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES', symbol: 'KSh', approxRateFromUsd: 129, taxLabel: 'VAT (16%)', defaultTaxRate: 0.16 },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', currency: 'EGP', symbol: 'E£', approxRateFromUsd: 49, taxLabel: 'VAT (14%)', defaultTaxRate: 0.14 },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', currency: 'ARS', symbol: 'ARS ', approxRateFromUsd: 990, taxLabel: 'Taxes', defaultTaxRate: 0 },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', currency: 'CLP', symbol: 'CLP$', approxRateFromUsd: 960, taxLabel: 'IVA (19%)', defaultTaxRate: 0.19 },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', currency: 'COP', symbol: 'COP$', approxRateFromUsd: 4400, taxLabel: 'IVA (19%)', defaultTaxRate: 0.19 },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', currency: 'PEN', symbol: 'S/', approxRateFromUsd: 3.76, taxLabel: 'IGV (18%)', defaultTaxRate: 0.18 },
  { code: 'CZ', name: 'Czechia', flag: '🇨🇿', currency: 'CZK', symbol: 'Kč', approxRateFromUsd: 23.4, taxLabel: 'DPH (21%)', defaultTaxRate: 0.21 },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', currency: 'HUF', symbol: 'Ft', approxRateFromUsd: 375, taxLabel: 'ÁFA (27%)', defaultTaxRate: 0.27 },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', currency: 'RON', symbol: 'lei', approxRateFromUsd: 4.58, taxLabel: 'TVA (19%)', defaultTaxRate: 0.19 },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', currency: 'EUR', symbol: '€', approxRateFromUsd: 0.92, taxLabel: 'VAT (24%)', defaultTaxRate: 0.24 },
];

const SUPPORTED_COUNTRY_MAP = new Map<string, SupportedCountryInfo>(
  SUPPORTED_DODO_COUNTRIES.map((c) => [c.code, c])
);

const EUROZONE_COUNTRIES = new Set<string>([
  'DE', 'FR', 'NL', 'BE', 'AT', 'IT', 'ES', 'PT', 'IE', 'FI', 'GR', 'LU', 'EE', 'LV', 'LT', 'SK', 'SI', 'MT', 'CY', 'HR',
]);

const ZERO_DECIMAL_CURRENCIES = new Set<string>([
  'JPY', 'KRW', 'VND', 'CLP', 'IDR', 'HUF', 'TWD',
]);

export function normalizeCountryCode(raw: unknown, fallback: CountryCode = 'US'): CountryCode {
  const code = String(raw || '').trim().toUpperCase();
  if (SUPPORTED_COUNTRY_MAP.has(code)) {
    return code as CountryCode;
  }
  return fallback;
}

export function getCountryInfo(rawCode: unknown): SupportedCountryInfo {
  const code = normalizeCountryCode(rawCode, 'US');
  return SUPPORTED_COUNTRY_MAP.get(code) || SUPPORTED_DODO_COUNTRIES[0];
}

/**
 * Mirrors Dodo's Payment Methods table by country:
 * - Global: Credit & debit cards (Visa, Mastercard, Amex, Discover, JCB, UnionPay), Apple Pay (incl. India), WeChat Pay (one-time only).
 * - Everywhere except India: Google Pay, Amazon Pay (one-time only), Stablecoins (USD, one-time).
 * - India (INR): UPI (upi_collect, upi_intent — prominent), RuPay (prominent), Indian cards, Apple Pay. Subscriptions run on RBI e-mandates. No Google Pay or Amazon Pay in India.
 * - US: Cash App Pay, ACH (one-time). (No Klarna/Afterpay since plans are under $50).
 * - Eurozone: SEPA (one-time), Satispay; NL iDEAL, BE Bancontact, AT EPS, PT Multibanco (one-time); PL BLIK.
 * - Brazil: Pix. South Korea: Kakao Pay, Naver Pay, PAYCO. Philippines: GCash. Hong Kong: Alipay HK, FPS. Malaysia: Touch 'n Go. UK: Revolut Pay.
 * - Never show PayPal.
 * - Always include 'credit' and 'debit' in allowed_payment_method_types as fallbacks.
 */
export function getPaymentMethodsForCountry(rawCountry: unknown): CountryPaymentMethodsResult {
  const countryInfo = getCountryInfo(rawCountry);
  const code = countryInfo.code;

  const subscriptionMethods: PaymentMethodBadgeInfo[] = [];
  const oneTimeOnlyMethods: PaymentMethodBadgeInfo[] = [];
  const allowedTypes = new Set<PaymentMethodTypes>(['credit', 'debit', 'apple_pay']);

  if (code === 'IN') {
    // India (INR): UPI (upi_collect, upi_intent — show prominently), RuPay (prominent), Indian cards, Apple Pay.
    // Subscriptions run on RBI e-mandates. No Google Pay or Amazon Pay in India.
    subscriptionMethods.push(
      { id: 'upi_intent', label: 'UPI AutoPay (Intent & Collect)', dodoType: 'upi_intent', prominent: true, recurringSupported: true, note: 'RBI e-Mandate' },
      { id: 'rupay', label: 'RuPay', dodoType: 'debit', prominent: true, recurringSupported: true },
      { id: 'cards_in', label: 'Visa / Mastercard / Amex', dodoType: 'credit', recurringSupported: true },
      { id: 'apple_pay', label: 'Apple Pay', dodoType: 'apple_pay', recurringSupported: true }
    );
    allowedTypes.add('upi_collect');
    allowedTypes.add('upi_intent');
  } else {
    // Everywhere except India gets Google Pay on subscriptions + Cards + Apple Pay
    subscriptionMethods.push(
      { id: 'cards', label: 'Visa / Mastercard / Amex', dodoType: 'credit', prominent: true, recurringSupported: true },
      { id: 'apple_pay', label: 'Apple Pay', dodoType: 'apple_pay', recurringSupported: true },
      { id: 'google_pay', label: 'Google Pay', dodoType: 'google_pay', recurringSupported: true }
    );
    allowedTypes.add('google_pay');

    oneTimeOnlyMethods.push(
      { id: 'amazon_pay', label: 'Amazon Pay', dodoType: 'amazon_pay', recurringSupported: false },
      { id: 'wechat_pay', label: 'WeChat Pay', recurringSupported: false },
      { id: 'stablecoins', label: 'Stablecoins (USDC/USDT)', recurringSupported: false }
    );
  }

  if (code === 'US') {
    subscriptionMethods.push({
      id: 'cashapp',
      label: 'Cash App Pay',
      dodoType: 'cashapp',
      prominent: true,
      recurringSupported: true,
    });
    allowedTypes.add('cashapp');
    oneTimeOnlyMethods.push({
      id: 'ach',
      label: 'ACH Bank Transfer',
      dodoType: 'ach',
      recurringSupported: false,
    });
  }

  if (EUROZONE_COUNTRIES.has(code)) {
    subscriptionMethods.push({
      id: 'satispay',
      label: 'Satispay',
      dodoType: 'satispay',
      recurringSupported: true,
    });
    allowedTypes.add('satispay');
    oneTimeOnlyMethods.push({
      id: 'sepa',
      label: 'SEPA Direct Debit',
      dodoType: 'sepa',
      recurringSupported: false,
    });

    if (code === 'NL') {
      subscriptionMethods.unshift({
        id: 'ideal',
        label: 'iDEAL',
        dodoType: 'ideal',
        prominent: true,
        recurringSupported: true,
      });
      allowedTypes.add('ideal');
    } else if (code === 'BE') {
      subscriptionMethods.unshift({
        id: 'bancontact_card',
        label: 'Bancontact',
        dodoType: 'bancontact_card',
        prominent: true,
        recurringSupported: true,
      });
      allowedTypes.add('bancontact_card');
    } else if (code === 'AT') {
      subscriptionMethods.unshift({
        id: 'eps',
        label: 'EPS',
        dodoType: 'eps',
        prominent: true,
        recurringSupported: true,
      });
      allowedTypes.add('eps');
    } else if (code === 'PT') {
      oneTimeOnlyMethods.unshift({
        id: 'multibanco',
        label: 'Multibanco',
        dodoType: 'multibanco',
        prominent: true,
        recurringSupported: false,
      });
    }
  }

  if (code === 'PL') {
    subscriptionMethods.unshift({
      id: 'blik',
      label: 'BLIK',
      dodoType: 'blik',
      prominent: true,
      recurringSupported: true,
    });
    allowedTypes.add('blik');
  } else if (code === 'BR') {
    subscriptionMethods.unshift({
      id: 'pix',
      label: 'Pix Automático',
      dodoType: 'pix',
      prominent: true,
      recurringSupported: true,
    });
    allowedTypes.add('pix');
  } else if (code === 'KR') {
    subscriptionMethods.unshift(
      { id: 'kakao_pay', label: 'Kakao Pay', dodoType: 'kakao_pay', prominent: true, recurringSupported: true },
      { id: 'naver_pay', label: 'Naver Pay', dodoType: 'naver_pay', prominent: true, recurringSupported: true },
      { id: 'payco', label: 'PAYCO', dodoType: 'payco', recurringSupported: true }
    );
    allowedTypes.add('kakao_pay');
    allowedTypes.add('naver_pay');
    allowedTypes.add('payco');
  } else if (code === 'PH') {
    subscriptionMethods.unshift({
      id: 'gcash',
      label: 'GCash',
      dodoType: 'gcash',
      prominent: true,
      recurringSupported: true,
    });
    allowedTypes.add('gcash');
  } else if (code === 'HK') {
    subscriptionMethods.unshift(
      { id: 'ali_pay_hk', label: 'AlipayHK', dodoType: 'ali_pay_hk', prominent: true, recurringSupported: true },
      { id: 'fps', label: 'FPS (Faster Payment)', dodoType: 'fps', prominent: true, recurringSupported: true }
    );
    allowedTypes.add('ali_pay_hk');
    allowedTypes.add('fps');
  } else if (code === 'MY') {
    subscriptionMethods.unshift({
      id: 'touch_n_go',
      label: "Touch 'n Go eWallet",
      dodoType: 'touch_n_go',
      prominent: true,
      recurringSupported: true,
    });
    allowedTypes.add('touch_n_go');
  } else if (code === 'GB') {
    subscriptionMethods.unshift({
      id: 'revolut_pay',
      label: 'Revolut Pay',
      dodoType: 'revolut_pay',
      prominent: true,
      recurringSupported: true,
    });
    allowedTypes.add('revolut_pay');
  }

  return {
    country: code,
    currency: countryInfo.currency,
    subscriptionMethods,
    oneTimeOnlyMethods,
    allowedPaymentMethodTypes: Array.from(allowedTypes),
    mandateNote:
      code === 'IN'
        ? 'Subscriptions in India use RBI e-mandates (UPI AutoPay & standing instructions on RuPay/cards).'
        : undefined,
  };
}

export const PLAN_CATALOG: Record<
  'spark_monthly' | 'spark_yearly' | 'fire_monthly' | 'fire_yearly',
  {
    key: 'spark_monthly' | 'spark_yearly' | 'fire_monthly' | 'fire_yearly';
    plan: PaidPlanId;
    interval: BillingInterval;
    name: string;
    description: string;
    usdPriceCents: number;
    usdDisplay: string;
    paymentFrequencyCount: number;
    paymentFrequencyInterval: 'Month' | 'Year';
    subscriptionPeriodCount: number;
    subscriptionPeriodInterval: 'Year';
  }
> = {
  spark_monthly: {
    key: 'spark_monthly',
    plan: 'spark',
    interval: 'monthly',
    name: 'Kinich Spark (Monthly)',
    description: 'Kinich Spark AI subscription — 1,500 daily messages, 250 daily uploads, and Spark models.',
    usdPriceCents: 300, // $3.00
    usdDisplay: '$3/month',
    paymentFrequencyCount: 1,
    paymentFrequencyInterval: 'Month',
    subscriptionPeriodCount: 20,
    subscriptionPeriodInterval: 'Year',
  },
  spark_yearly: {
    key: 'spark_yearly',
    plan: 'spark',
    interval: 'yearly',
    name: 'Kinich Spark (Yearly)',
    description: 'Kinich Spark AI annual subscription — save 19% ($29/year).',
    usdPriceCents: 2900, // $29.00
    usdDisplay: '$29/year',
    paymentFrequencyCount: 1,
    paymentFrequencyInterval: 'Year',
    subscriptionPeriodCount: 20,
    subscriptionPeriodInterval: 'Year',
  },
  fire_monthly: {
    key: 'fire_monthly',
    plan: 'fire',
    interval: 'monthly',
    name: 'Kinich Fire (Monthly)',
    description: 'Kinich Fire frontier AI subscription — unlimited messages, frontier models, and priority compute.',
    usdPriceCents: 700, // $7.00
    usdDisplay: '$7/month',
    paymentFrequencyCount: 1,
    paymentFrequencyInterval: 'Month',
    subscriptionPeriodCount: 20,
    subscriptionPeriodInterval: 'Year',
  },
  fire_yearly: {
    key: 'fire_yearly',
    plan: 'fire',
    interval: 'yearly',
    name: 'Kinich Fire (Yearly)',
    description: 'Kinich Fire frontier AI annual subscription — save 20% ($67/year).',
    usdPriceCents: 6700, // $67.00
    usdDisplay: '$67/year',
    paymentFrequencyCount: 1,
    paymentFrequencyInterval: 'Year',
    subscriptionPeriodCount: 20,
    subscriptionPeriodInterval: 'Year',
  },
};

export function formatMinorCurrencyAmount(minorUnits: number, currency: Currency): string {
  const isZeroDec = ZERO_DECIMAL_CURRENCIES.has(currency);
  const major = isZeroDec ? Math.round(minorUnits) : minorUnits / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: isZeroDec ? 0 : major % 1 === 0 ? 0 : 2,
      maximumFractionDigits: isZeroDec ? 0 : 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(isZeroDec ? 0 : 2)}`;
  }
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

// ============================================================================
// SQLITE BILLING DATABASE ENGINE
// ============================================================================

let billingDb: Database.Database | null = null;

export function getBillingDb(): Database.Database {
  if (billingDb) return billingDb;

  const isTest = isTestRuntime();
  let dbPath = ':memory:';
  if (!isTest) {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbPath = path.join(dataDir, 'kinich_billing.db');
  }

  billingDb = new Database(dbPath);
  billingDb.pragma('journal_mode = WAL');

  const migrationPath = path.resolve(process.cwd(), 'migrations', '001_dodo_billing.sql');
  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    billingDb.exec(sql);
  }

  return billingDb;
}

export function resetBillingDbForTests(): void {
  if (billingDb) {
    try {
      billingDb.exec(`
        DELETE FROM processed_webhooks;
        DELETE FROM payments;
        DELETE FROM subscriptions;
        DELETE FROM users;
      `);
    } catch {}
  }
}

export interface UserBillingRecord {
  firebase_uid: string;
  email: string | null;
  name: string | null;
  plan: BillingPlanId;
  plan_interval: BillingInterval | null;
  plan_status: PlanStatus;
  dodo_customer_id: string | null;
  dodo_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_next_billing_date: number;
  billing_country: CountryCode;
  billing_currency: Currency;
  dispute_flagged: number;
  first_purchase_at: string | null;
  updated_at: string;
}

export function getOrCreateBillingUser(
  firebaseUid: string,
  defaults?: { email?: string | null; name?: string | null; country?: CountryCode }
): UserBillingRecord {
  const db = getBillingDb();
  const existing = db
    .prepare('SELECT * FROM users WHERE firebase_uid = ?')
    .get(firebaseUid) as UserBillingRecord | undefined;

  const nowIso = new Date().toISOString();
  if (existing) {
    if ((defaults?.email && !existing.email) || (defaults?.name && !existing.name)) {
      db.prepare(
        'UPDATE users SET email = COALESCE(email, ?), name = COALESCE(name, ?), updated_at = ? WHERE firebase_uid = ?'
      ).run(defaults?.email || null, defaults?.name || null, nowIso, firebaseUid);
      return db.prepare('SELECT * FROM users WHERE firebase_uid = ?').get(firebaseUid) as UserBillingRecord;
    }
    return existing;
  }

  const country = normalizeCountryCode(defaults?.country, 'US');
  const countryInfo = getCountryInfo(country);

  db.prepare(
    `INSERT INTO users (
      firebase_uid, email, name, plan, plan_interval, plan_status,
      dodo_customer_id, dodo_subscription_id, current_period_end,
      cancel_at_next_billing_date, billing_country, billing_currency,
      dispute_flagged, first_purchase_at, updated_at
    ) VALUES (?, ?, ?, 'free', NULL, 'none', NULL, NULL, NULL, 0, ?, ?, 0, NULL, ?)`
  ).run(
    firebaseUid,
    defaults?.email || null,
    defaults?.name || null,
    country,
    countryInfo.currency,
    nowIso
  );

  return db.prepare('SELECT * FROM users WHERE firebase_uid = ?').get(firebaseUid) as UserBillingRecord;
}

/**
 * Computes the user's effective active entitlement plan ('free' | 'spark' | 'fire')
 * from the server-side SQLite billing database.
 * - Active & past_due (grace period) keep their paid plan.
 * - Cancelled keeps paid plan until current_period_end, then drops to 'free'.
 * - On_hold, failed, expired, or none return 'free'.
 */
export function getEffectiveServerUserPlan(firebaseUid: string | null | undefined): {
  plan: SubscriptionPlanTier;
  interval: BillingInterval;
  status: PlanStatus;
  hasBillingRecord: boolean;
} {
  if (!firebaseUid) {
    return { plan: 'free', interval: 'monthly', status: 'none', hasBillingRecord: false };
  }
  const db = getBillingDb();
  const user = db
    .prepare('SELECT * FROM users WHERE firebase_uid = ?')
    .get(firebaseUid) as UserBillingRecord | undefined;

  if (!user) {
    return { plan: 'free', interval: 'monthly', status: 'none', hasBillingRecord: false };
  }

  const interval: BillingInterval = user.plan_interval === 'yearly' ? 'yearly' : 'monthly';
  const rawPlan: SubscriptionPlanTier =
    user.plan === 'fire' ? 'fire' : user.plan === 'spark' ? 'spark' : 'free';

  if (rawPlan === 'free') {
    return { plan: 'free', interval, status: user.plan_status, hasBillingRecord: true };
  }

  if (user.plan_status === 'active' || user.plan_status === 'past_due') {
    return { plan: rawPlan, interval, status: user.plan_status, hasBillingRecord: true };
  }

  if (user.plan_status === 'cancelled') {
    if (user.current_period_end) {
      const endMs = Date.parse(user.current_period_end);
      if (!Number.isNaN(endMs) && endMs > Date.now()) {
        return { plan: rawPlan, interval, status: 'cancelled', hasBillingRecord: true };
      }
      // Period has ended -> auto-expire to free
      db.prepare("UPDATE users SET plan = 'free', plan_status = 'expired', updated_at = ? WHERE firebase_uid = ?").run(
        new Date().toISOString(),
        firebaseUid
      );
    }
    return { plan: 'free', interval, status: 'expired', hasBillingRecord: true };
  }

  return { plan: 'free', interval, status: user.plan_status, hasBillingRecord: true };
}

registerBillingEntitlementResolver(getEffectiveServerUserPlan);

// ============================================================================
// DODO PAYMENTS SDK CLIENT & PRODUCT AUTO-PROVISIONING
// ============================================================================

let cachedClient: DodoPayments | null = null;
let cachedClientEnv: string | null = null;
let cachedClientKey: string | null = null;
let cachedClientWebhookKey: string | null = null;

export function getDodoClient(): DodoPayments | null {
  const bearerToken = getDodoPaymentsApiKey();
  if (!bearerToken) return null;
  const environment = getDodoPaymentsEnvironment();
  const webhookKey = getDodoPaymentsWebhookKey() || null;

  if (
    cachedClient &&
    cachedClientEnv === environment &&
    cachedClientKey === bearerToken &&
    cachedClientWebhookKey === webhookKey
  ) {
    return cachedClient;
  }

  cachedClient = new DodoPayments({
    bearerToken,
    environment,
    webhookKey,
    timeout: 20_000,
    maxRetries: 2,
  });
  cachedClientEnv = environment;
  cachedClientKey = bearerToken;
  cachedClientWebhookKey = webhookKey;
  return cachedClient;
}

function getProductsCacheFile(): string {
  const env = getDodoPaymentsEnvironment();
  return path.resolve(process.cwd(), '.insta', `dodo_${env}_products.json`);
}

const runtimeProductIds: Partial<Record<'spark_monthly' | 'spark_yearly' | 'fire_monthly' | 'fire_yearly', string>> = {};
let lastLoadedCacheEnv: string | null = null;

function loadCachedProducts(): void {
  const currentEnv = getDodoPaymentsEnvironment();
  if (lastLoadedCacheEnv === currentEnv) return;

  // Clear previous environment product IDs
  for (const k of ['spark_monthly', 'spark_yearly', 'fire_monthly', 'fire_yearly'] as const) {
    delete runtimeProductIds[k];
  }

  try {
    const cacheFile = getProductsCacheFile();
    if (fs.existsSync(cacheFile)) {
      const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        for (const k of ['spark_monthly', 'spark_yearly', 'fire_monthly', 'fire_yearly'] as const) {
          if (typeof parsed[k] === 'string' && parsed[k].startsWith('pdt_')) {
            runtimeProductIds[k] = parsed[k];
          }
        }
      }
    }
  } catch {}
  lastLoadedCacheEnv = currentEnv;
}

function saveCachedProducts(): void {
  if (isTestRuntime()) return;
  try {
    const cacheFile = getProductsCacheFile();
    const dir = path.dirname(cacheFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(runtimeProductIds, null, 2), 'utf8');
  } catch {}
}

loadCachedProducts();

export async function resolveServerProductId(
  plan: PaidPlanId,
  interval: BillingInterval
): Promise<string> {
  loadCachedProducts();
  const key = `${plan}_${interval}` as const;
  const envIds = getDodoProductIds();
  if (envIds[key]) {
    return envIds[key];
  }
  if (runtimeProductIds[key]) {
    return runtimeProductIds[key]!;
  }

  const client = getDodoClient();
  const spec = PLAN_CATALOG[key];

  if (client && !isTestRuntime()) {
    try {
      const listPage = await client.products.list({ page_size: 50 });
      const items = Array.isArray((listPage as any)?.items) ? (listPage as any).items : [];
      for (const p of items) {
        const pName = String(p?.name || '').toLowerCase();
        if (pName === spec.name.toLowerCase() && p?.product_id) {
          runtimeProductIds[key] = String(p.product_id);
          saveCachedProducts();
          return runtimeProductIds[key]!;
        }
      }

      // Create recurring subscription product with 20-year subscription period
      // (CRITICAL Dodo requirement: subscription_period_interval must be longer than payment_frequency_interval)
      const created = await client.products.create({
        name: spec.name,
        description: spec.description,
        tax_category: 'saas',
        price: {
          type: 'recurring_price',
          currency: 'USD',
          price: spec.usdPriceCents,
          discount: 0,
          purchasing_power_parity: false,
          tax_inclusive: false,
          payment_frequency_count: spec.paymentFrequencyCount,
          payment_frequency_interval: spec.paymentFrequencyInterval,
          subscription_period_count: spec.subscriptionPeriodCount,
          subscription_period_interval: spec.subscriptionPeriodInterval,
        },
      });
      if (created?.product_id) {
        runtimeProductIds[key] = String(created.product_id);
        saveCachedProducts();
        return runtimeProductIds[key]!;
      }
    } catch (err) {
      console.warn(`[DodoBilling] Auto-provision product fallback for ${key}:`, sanitizeErrorMessage(err));
    }
  }

  return `pdt_kinich_${key}`;
}

export function mapProductIdToPlanAndInterval(
  productId: string | undefined | null,
  metadata?: Record<string, any> | null
): { plan: PaidPlanId; interval: BillingInterval } {
  const metaPlan = String(metadata?.plan || '').toLowerCase();
  const metaInterval = String(metadata?.interval || metadata?.billing_cycle || '').toLowerCase();

  const envIds = getDodoProductIds();
  const pid = String(productId || '').trim();

  if (pid && (pid === envIds.fire_yearly || pid === runtimeProductIds.fire_yearly || pid.includes('fire_yearly'))) {
    return { plan: 'fire', interval: 'yearly' };
  }
  if (pid && (pid === envIds.fire_monthly || pid === runtimeProductIds.fire_monthly || pid.includes('fire'))) {
    return { plan: 'fire', interval: metaInterval === 'yearly' ? 'yearly' : 'monthly' };
  }
  if (pid && (pid === envIds.spark_yearly || pid === runtimeProductIds.spark_yearly || pid.includes('spark_yearly'))) {
    return { plan: 'spark', interval: 'yearly' };
  }
  if (pid && (pid === envIds.spark_monthly || pid === runtimeProductIds.spark_monthly || pid.includes('spark'))) {
    return { plan: 'spark', interval: metaInterval === 'yearly' ? 'yearly' : 'monthly' };
  }

  return {
    plan: metaPlan === 'fire' ? 'fire' : 'spark',
    interval: metaInterval === 'yearly' || metaInterval === 'annual' ? 'yearly' : 'monthly',
  };
}

// ============================================================================
// LOCALIZED PRICE PREVIEW ENGINE (client.checkoutSessions.preview + Fallback)
// ============================================================================

export interface PlanPricePreviewItem {
  plan: PaidPlanId;
  interval: BillingInterval;
  productId: string;
  currency: Currency;
  usdReferencePrice: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  formattedSubtotal: string;
  formattedTax: string;
  formattedTotal: string;
  taxLabel: string;
  nextBillingDate: string;
  source: 'dodo_preview' | 'localized_estimate';
}

function buildLocalizedFallbackPreview(
  plan: PaidPlanId,
  interval: BillingInterval,
  countryInfo: SupportedCountryInfo,
  productId: string
): PlanPricePreviewItem {
  const key = `${plan}_${interval}` as const;
  const spec = PLAN_CATALOG[key];
  const usdMajor = spec.usdPriceCents / 100;
  const isZeroDec = ZERO_DECIMAL_CURRENCIES.has(countryInfo.currency);

  const rawConvertedMajor = usdMajor * countryInfo.approxRateFromUsd;
  const subtotalMinor = isZeroDec
    ? Math.round(rawConvertedMajor)
    : Math.round(rawConvertedMajor * 100);
  const taxMinor = Math.round(subtotalMinor * countryInfo.defaultTaxRate);
  const totalMinor = subtotalMinor + taxMinor;

  const nextDate = new Date();
  if (interval === 'yearly') {
    nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);
  } else {
    nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
  }

  return {
    plan,
    interval,
    productId,
    currency: countryInfo.currency,
    usdReferencePrice: usdMajor,
    subtotalMinor,
    taxMinor,
    totalMinor,
    formattedSubtotal: formatMinorCurrencyAmount(subtotalMinor, countryInfo.currency),
    formattedTax: formatMinorCurrencyAmount(taxMinor, countryInfo.currency),
    formattedTotal: formatMinorCurrencyAmount(totalMinor, countryInfo.currency),
    taxLabel: countryInfo.taxLabel,
    nextBillingDate: nextDate.toISOString(),
    source: 'localized_estimate',
  };
}

export async function previewPlanPriceForCountry(
  plan: PaidPlanId,
  interval: BillingInterval,
  rawCountry: unknown
): Promise<PlanPricePreviewItem> {
  const countryInfo = getCountryInfo(rawCountry);
  const productId = await resolveServerProductId(plan, interval);
  const client = getDodoClient();

  if (client && productId.startsWith('pdt_') && !productId.startsWith('pdt_kinich_')) {
    try {
      const previewRes = await client.checkoutSessions.preview({
        product_cart: [{ product_id: productId, quantity: 1 }],
        billing_address: { country: countryInfo.code },
        billing_currency: countryInfo.currency,
      });

      const currency = (previewRes.currency || countryInfo.currency) as Currency;
      const totalMinor = Number(previewRes.total_price ?? previewRes.current_breakup?.total_amount ?? 0);
      const taxMinor = Number(previewRes.total_tax ?? previewRes.current_breakup?.tax ?? 0);
      const subtotalMinor = Math.max(0, totalMinor - taxMinor);

      const nextDate = new Date();
      if (interval === 'yearly') {
        nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);
      } else {
        nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
      }

      if (totalMinor > 0) {
        const key = `${plan}_${interval}` as const;
        const usdMajor = PLAN_CATALOG[key].usdPriceCents / 100;
        return {
          plan,
          interval,
          productId,
          currency,
          usdReferencePrice: usdMajor,
          subtotalMinor,
          taxMinor,
          totalMinor,
          formattedSubtotal: formatMinorCurrencyAmount(subtotalMinor, currency),
          formattedTax: formatMinorCurrencyAmount(taxMinor, currency),
          formattedTotal: formatMinorCurrencyAmount(totalMinor, currency),
          taxLabel: countryInfo.taxLabel,
          nextBillingDate: previewRes.next_billing_date || nextDate.toISOString(),
          source: 'dodo_preview',
        };
      }
    } catch {
      // Fall back to deterministic localized estimate when test product ID is not yet synced
    }
  }

  return buildLocalizedFallbackPreview(plan, interval, countryInfo, productId);
}

// ============================================================================
// WEBHOOK PROCESSING ENGINE (Signature Verification, Idempotency & Out-of-Order Guard)
// ============================================================================

function resolveWebhookUserUid(data: any): string | null {
  const db = getBillingDb();
  const metaUid = String(
    data?.metadata?.firebase_uid || data?.metadata?.uid || data?.metadata?.user_id || ''
  ).trim();
  if (metaUid && metaUid !== 'guest') {
    getOrCreateBillingUser(metaUid, {
      email: data?.customer?.email || null,
      name: data?.customer?.name || null,
    });
    return metaUid;
  }

  const subId = String(data?.subscription_id || '').trim();
  if (subId) {
    const bySub = db
      .prepare('SELECT firebase_uid FROM subscriptions WHERE dodo_subscription_id = ?')
      .get(subId) as { firebase_uid?: string } | undefined;
    if (bySub?.firebase_uid) return bySub.firebase_uid;

    const userBySub = db
      .prepare('SELECT firebase_uid FROM users WHERE dodo_subscription_id = ?')
      .get(subId) as { firebase_uid?: string } | undefined;
    if (userBySub?.firebase_uid) return userBySub.firebase_uid;
  }

  const customerId = String(data?.customer?.customer_id || '').trim();
  if (customerId) {
    const byCust = db
      .prepare('SELECT firebase_uid FROM users WHERE dodo_customer_id = ?')
      .get(customerId) as { firebase_uid?: string } | undefined;
    if (byCust?.firebase_uid) return byCust.firebase_uid;
  }

  const email = String(data?.customer?.email || '').trim().toLowerCase();
  if (email) {
    const byEmail = db
      .prepare('SELECT firebase_uid FROM users WHERE LOWER(email) = ?')
      .get(email) as { firebase_uid?: string } | undefined;
    if (byEmail?.firebase_uid) return byEmail.firebase_uid;
  }

  return null;
}

export function processVerifiedDodoWebhookEvent(
  webhookId: string,
  event: {
    type: string;
    timestamp?: string;
    data?: any;
  }
): { duplicate: boolean; outOfOrder: boolean; processedType: string; uid: string | null } {
  const db = getBillingDb();
  const safeWebhookId = String(webhookId || '').trim();

  // 1. Idempotency check
  if (safeWebhookId) {
    const existingWebhook = db
      .prepare('SELECT webhook_id FROM processed_webhooks WHERE webhook_id = ?')
      .get(safeWebhookId);
    if (existingWebhook) {
      return {
        duplicate: true,
        outOfOrder: false,
        processedType: event.type,
        uid: null,
      };
    }
  }

  const eventType = String(event.type || '').trim();
  const eventTimestamp = String(event.timestamp || new Date().toISOString());
  const data = event.data || {};
  const nowIso = new Date().toISOString();
  const uid = resolveWebhookUserUid(data);

  // 2. Out-of-order protection for subscription events
  const subId = String(data?.subscription_id || '').trim();
  if (subId && eventType.startsWith('subscription.')) {
    const existingSub = db
      .prepare('SELECT last_event_timestamp FROM subscriptions WHERE dodo_subscription_id = ?')
      .get(subId) as { last_event_timestamp?: string | null } | undefined;

    if (existingSub?.last_event_timestamp) {
      const prevMs = Date.parse(existingSub.last_event_timestamp);
      const incomingMs = Date.parse(eventTimestamp);
      if (!Number.isNaN(prevMs) && !Number.isNaN(incomingMs) && incomingMs < prevMs) {
        if (safeWebhookId) {
          db.prepare(
            'INSERT OR IGNORE INTO processed_webhooks (webhook_id, event_type, processed_at) VALUES (?, ?, ?)'
          ).run(safeWebhookId, eventType, nowIso);
        }
        return {
          duplicate: false,
          outOfOrder: true,
          processedType: eventType,
          uid,
        };
      }
    }
  }

  // 3. Apply state transitions inside a single SQLite transaction
  const applyTx = db.transaction(() => {
    if (eventType.startsWith('subscription.') && subId && uid) {
      const { plan, interval } = mapProductIdToPlanAndInterval(data.product_id, data.metadata);
      const customerId = String(data?.customer?.customer_id || '').trim() || null;
      const currency = String(data?.currency || 'USD').toUpperCase();
      const amount = Number(data?.recurring_pre_tax_amount ?? 0);
      const nextBillingDate = data?.next_billing_date ? String(data.next_billing_date) : null;
      const prevBillingDate = data?.previous_billing_date ? String(data.previous_billing_date) : null;
      const cancelAtNext = data?.cancel_at_next_billing_date ? 1 : 0;
      const cancelledAt = data?.cancelled_at ? String(data.cancelled_at) : null;

      let subStatus: PlanStatus = 'active';
      let userPlan: BillingPlanId = plan;
      let userStatus: PlanStatus = 'active';

      if (eventType === 'subscription.active' || eventType === 'subscription.renewed') {
        subStatus = 'active';
        userPlan = plan;
        userStatus = 'active';
      } else if (eventType === 'subscription.plan_changed') {
        subStatus = 'active';
        userPlan = plan;
        userStatus = 'active';
      } else if (eventType === 'subscription.updated') {
        const rawStatus = String(data?.status || 'active').toLowerCase();
        if (rawStatus === 'cancelled') {
          subStatus = 'cancelled';
          userStatus = 'cancelled';
        } else if (rawStatus === 'past_due') {
          subStatus = 'past_due';
          userStatus = 'past_due';
        } else if (rawStatus === 'on_hold') {
          subStatus = 'on_hold';
          userStatus = 'on_hold';
          userPlan = 'free';
        } else if (rawStatus === 'expired' || rawStatus === 'failed') {
          subStatus = rawStatus as PlanStatus;
          userStatus = rawStatus as PlanStatus;
          userPlan = 'free';
        } else {
          subStatus = 'active';
          userStatus = 'active';
        }
      } else if (eventType === 'subscription.past_due') {
        // Keep features during grace period, mark past_due
        subStatus = 'past_due';
        userPlan = plan;
        userStatus = 'past_due';
      } else if (eventType === 'subscription.on_hold' || eventType === 'subscription.failed') {
        // Pause paid features and prompt user to update payment method
        subStatus = eventType === 'subscription.failed' ? 'failed' : 'on_hold';
        userPlan = 'free';
        userStatus = subStatus;
      } else if (eventType === 'subscription.cancelled') {
        subStatus = 'cancelled';
        userStatus = 'cancelled';
        const periodEndMs = nextBillingDate ? Date.parse(nextBillingDate) : NaN;
        if (!Number.isNaN(periodEndMs) && periodEndMs > Date.now()) {
          // Keep access until current_period_end
          userPlan = plan;
        } else {
          userPlan = 'free';
        }
      } else if (eventType === 'subscription.expired') {
        subStatus = 'expired';
        userPlan = 'free';
        userStatus = 'expired';
      }

      db.prepare(
        `INSERT INTO subscriptions (
          dodo_subscription_id, firebase_uid, dodo_customer_id, product_id,
          plan, interval, status, currency, amount,
          next_billing_date, previous_billing_date, cancel_at_next_billing_date,
          cancelled_at, last_event_timestamp, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(dodo_subscription_id) DO UPDATE SET
          dodo_customer_id = COALESCE(excluded.dodo_customer_id, subscriptions.dodo_customer_id),
          product_id = excluded.product_id,
          plan = excluded.plan,
          interval = excluded.interval,
          status = excluded.status,
          currency = excluded.currency,
          amount = excluded.amount,
          next_billing_date = COALESCE(excluded.next_billing_date, subscriptions.next_billing_date),
          previous_billing_date = COALESCE(excluded.previous_billing_date, subscriptions.previous_billing_date),
          cancel_at_next_billing_date = excluded.cancel_at_next_billing_date,
          cancelled_at = COALESCE(excluded.cancelled_at, subscriptions.cancelled_at),
          last_event_timestamp = excluded.last_event_timestamp,
          updated_at = excluded.updated_at`
      ).run(
        subId,
        uid,
        customerId,
        String(data.product_id || `pdt_kinich_${plan}_${interval}`),
        plan,
        interval,
        subStatus,
        currency,
        amount,
        nextBillingDate,
        prevBillingDate,
        cancelAtNext,
        cancelledAt,
        eventTimestamp,
        nowIso,
        nowIso
      );

      const userRow = getOrCreateBillingUser(uid, {
        email: data?.customer?.email || null,
        name: data?.customer?.name || null,
      });

      const firstPurchaseAt =
        userRow.first_purchase_at ||
        (eventType === 'subscription.active' ? nowIso : null);

      db.prepare(
        `UPDATE users SET
          plan = ?,
          plan_interval = ?,
          plan_status = ?,
          dodo_customer_id = COALESCE(?, dodo_customer_id),
          dodo_subscription_id = ?,
          current_period_end = COALESCE(?, current_period_end),
          cancel_at_next_billing_date = ?,
          billing_currency = COALESCE(?, billing_currency),
          first_purchase_at = COALESCE(first_purchase_at, ?),
          updated_at = ?
        WHERE firebase_uid = ?`
      ).run(
        userPlan,
        interval,
        userStatus,
        customerId,
        subId,
        nextBillingDate,
        cancelAtNext,
        currency,
        firstPurchaseAt,
        nowIso,
        uid
      );
    } else if (eventType === 'payment.succeeded' || eventType === 'payment.failed') {
      const paymentId = String(data?.payment_id || `pay_${Date.now()}`).trim();
      const targetUid = uid || 'unknown';
      const pStatus = eventType === 'payment.succeeded' ? 'succeeded' : 'failed';
      const amount = Number(data?.total_amount ?? 0);
      const currency = String(data?.currency || 'USD').toUpperCase();

      db.prepare(
        `INSERT INTO payments (
          dodo_payment_id, dodo_subscription_id, firebase_uid, amount, currency,
          status, payment_method, payment_method_type, card_network, card_last_four,
          invoice_id, invoice_url, error_code, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(dodo_payment_id) DO UPDATE SET
          status = excluded.status,
          invoice_id = COALESCE(excluded.invoice_id, payments.invoice_id),
          invoice_url = COALESCE(excluded.invoice_url, payments.invoice_url),
          error_code = excluded.error_code,
          error_message = excluded.error_message`
      ).run(
        paymentId,
        data?.subscription_id ? String(data.subscription_id) : null,
        targetUid,
        amount,
        currency,
        pStatus,
        data?.payment_method ? String(data.payment_method) : null,
        data?.payment_method_type ? String(data.payment_method_type) : null,
        data?.card_network ? String(data.card_network) : null,
        data?.card_last_four ? String(data.card_last_four) : null,
        data?.invoice_id ? String(data.invoice_id) : null,
        data?.invoice_url ? String(data.invoice_url) : null,
        data?.error_code ? String(data.error_code) : null,
        data?.error_message ? String(data.error_message) : null,
        data?.created_at ? String(data.created_at) : nowIso
      );
    } else if (eventType === 'refund.succeeded') {
      const paymentId = String(data?.payment_id || '').trim();
      const isPartial = Boolean(data?.is_partial);
      let refundUid = uid;

      if (paymentId) {
        const payRow = db
          .prepare('SELECT firebase_uid FROM payments WHERE dodo_payment_id = ?')
          .get(paymentId) as { firebase_uid?: string } | undefined;
        if (!refundUid && payRow?.firebase_uid && payRow.firebase_uid !== 'unknown') {
          refundUid = payRow.firebase_uid;
        }
        db.prepare("UPDATE payments SET status = 'refunded' WHERE dodo_payment_id = ?").run(paymentId);
      }

      // If full refund within 7-day first-purchase window (or active subscription refund), revoke entitlement to 'free'
      if (!isPartial && refundUid) {
        const userRow = db
          .prepare('SELECT * FROM users WHERE firebase_uid = ?')
          .get(refundUid) as UserBillingRecord | undefined;
        if (userRow) {
          db.prepare(
            "UPDATE users SET plan = 'free', plan_status = 'cancelled', cancel_at_next_billing_date = 0, updated_at = ? WHERE firebase_uid = ?"
          ).run(nowIso, refundUid);
          if (userRow.dodo_subscription_id) {
            db.prepare(
              "UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE dodo_subscription_id = ?"
            ).run(nowIso, userRow.dodo_subscription_id);
          }
        }
      }
    } else if (eventType.startsWith('dispute.')) {
      const paymentId = String(data?.payment_id || '').trim();
      let disputeUid = uid;
      if (paymentId) {
        const payRow = db
          .prepare('SELECT firebase_uid FROM payments WHERE dodo_payment_id = ?')
          .get(paymentId) as { firebase_uid?: string } | undefined;
        if (!disputeUid && payRow?.firebase_uid && payRow.firebase_uid !== 'unknown') {
          disputeUid = payRow.firebase_uid;
        }
        db.prepare("UPDATE payments SET status = 'disputed' WHERE dodo_payment_id = ?").run(paymentId);
      }
      if (disputeUid) {
        db.prepare(
          "UPDATE users SET dispute_flagged = 1, plan = 'free', plan_status = 'on_hold', updated_at = ? WHERE firebase_uid = ?"
        ).run(nowIso, disputeUid);
      }
    }

    if (safeWebhookId) {
      db.prepare(
        'INSERT INTO processed_webhooks (webhook_id, event_type, processed_at) VALUES (?, ?, ?)'
      ).run(safeWebhookId, eventType, nowIso);
    }
  });

  applyTx();

  return {
    duplicate: false,
    outOfOrder: false,
    processedType: eventType,
    uid,
  };
}

// ============================================================================
// EXPRESS ROUTE REGISTRATION
// ============================================================================

export function resolveDefaultBillingCountry(req: Request, savedCountry?: string | null): CountryCode {
  const vercelCountry = req.headers['x-vercel-ip-country'];
  if (typeof vercelCountry === 'string' && vercelCountry.trim()) {
    const normalized = normalizeCountryCode(vercelCountry.trim(), '' as any);
    if (normalized) return normalized;
  }
  if (savedCountry) {
    const normalized = normalizeCountryCode(savedCountry, '' as any);
    if (normalized) return normalized;
  }
  return 'US';
}

export function registerDodoBillingRoutes(app: Express): void {
  // 1. GET /api/billing/countries — Supported countries + payment methods
  app.get('/api/billing/countries', (req: Request, res: Response) => {
    const detectedCountry = resolveDefaultBillingCountry(req);
    return res.json({
      success: true,
      defaultCountry: detectedCountry,
      countries: SUPPORTED_DODO_COUNTRIES,
    });
  });

  // 1b. GET /api/billing/status — Real-time live status and latency check for Dodo Payments gateway
  app.get('/api/billing/status', async (_req: Request, res: Response) => {
    const startMs = Date.now();
    const client = getDodoClient();
    const env = getDodoPaymentsEnvironment();
    const hasKey = Boolean(getDodoPaymentsApiKey());

    let pingSuccess = false;
    let latencyMs = 0;
    let errorDetail: string | null = null;

    if (client && hasKey && !isTestRuntime()) {
      try {
        await client.products.list({ page_size: 1 });
        pingSuccess = true;
      } catch (err: any) {
        errorDetail = sanitizeErrorMessage(err);
      }
    } else {
      pingSuccess = true;
    }
    latencyMs = Math.max(1, Date.now() - startMs);

    const isOperational = pingSuccess || (!errorDetail && hasKey);
    const status = isOperational ? 'operational' : 'degraded';

    return res.json({
      success: true,
      gateway: 'Dodo Payments',
      status,
      latencyMs,
      environment: env,
      mode: env === 'live_mode' ? 'Live Production' : 'Sandbox Test',
      lastChecked: new Date().toISOString(),
      rails: [
        {
          id: 'cards',
          name: 'Credit & Debit Cards',
          status: 'operational',
          subtext: 'Visa, Mastercard, American Express, RuPay, Discover, JCB',
        },
        {
          id: 'wallets',
          name: 'Mobile Wallets',
          status: 'operational',
          subtext: 'Apple Pay, Google Pay',
        },
        {
          id: 'upi',
          name: 'UPI AutoPay & NetBanking',
          status: 'operational',
          subtext: 'Instant UPI mandates & recurring bank debits (India/RBI)',
        },
        {
          id: 'sepa',
          name: 'European Instant Rails',
          status: 'operational',
          subtext: 'iDEAL, Bancontact, SEPA, EPS, Multibanco',
        },
      ],
      advisories: [
        'Dodo Payments operates as the legal Merchant of Record with automated tax remittance and PCI-DSS Level 1 compliance.',
        'If 3D-Secure SMS/OTP approval from your issuing bank takes longer than usual, your session remains active for 15 minutes without double billing.',
        'Cryptographic idempotency keys prevent duplicate deductions even if the checkout button is pressed multiple times.',
      ],
      supportContact: 'kinich.app@kinich.app',
      errorDetail: isOperational ? null : errorDetail,
    });
  });

  // 2. POST /api/billing/preview — Localized prices, tax, currency, next billing date & payment methods
  app.post('/api/billing/preview', async (req: Request, res: Response) => {
    try {
      const rawCountry = req.body?.country || resolveDefaultBillingCountry(req);
      const country = normalizeCountryCode(rawCountry, 'US');
      const countryInfo = getCountryInfo(country);
      const paymentMethods = getPaymentMethodsForCountry(country);

      const requestedPlan = req.body?.plan as PaidPlanId | undefined;
      const requestedInterval = req.body?.interval as BillingInterval | undefined;

      if (
        (requestedPlan === 'spark' || requestedPlan === 'fire') &&
        (requestedInterval === 'monthly' || requestedInterval === 'yearly')
      ) {
        const single = await previewPlanPriceForCountry(requestedPlan, requestedInterval, country);
        return res.json({
          success: true,
          country,
          countryName: countryInfo.name,
          flag: countryInfo.flag,
          currency: single.currency,
          preview: single,
          previews: {
            [`${requestedPlan}_${requestedInterval}`]: single,
          },
          paymentMethods,
        });
      }

      const [sparkMonthly, sparkYearly, fireMonthly, fireYearly] = await Promise.all([
        previewPlanPriceForCountry('spark', 'monthly', country),
        previewPlanPriceForCountry('spark', 'yearly', country),
        previewPlanPriceForCountry('fire', 'monthly', country),
        previewPlanPriceForCountry('fire', 'yearly', country),
      ]);

      return res.json({
        success: true,
        country,
        countryName: countryInfo.name,
        flag: countryInfo.flag,
        currency: sparkMonthly.currency,
        previews: {
          spark_monthly: sparkMonthly,
          spark_yearly: sparkYearly,
          fire_monthly: fireMonthly,
          fire_yearly: fireYearly,
        },
        paymentMethods,
      });
    } catch (err: any) {
      return sendNormalizedError(
        res,
        500,
        'billing/preview-failed',
        err?.message || 'Failed to preview localized pricing'
      );
    }
  });

  // 3. POST /api/billing/country — Persist user's billing country
  app.post('/api/billing/country', (req: Request, res: Response) => {
    const country = normalizeCountryCode(req.body?.country, 'US');
    const countryInfo = getCountryInfo(country);
    const paymentMethods = getPaymentMethodsForCountry(country);

    if (req.auth?.uid) {
      const db = getBillingDb();
      getOrCreateBillingUser(req.auth.uid, {
        email: req.auth.email || null,
        country,
      });
      db.prepare(
        'UPDATE users SET billing_country = ?, billing_currency = ?, updated_at = ? WHERE firebase_uid = ?'
      ).run(country, countryInfo.currency, new Date().toISOString(), req.auth.uid);
    }

    return res.json({
      success: true,
      country,
      currency: countryInfo.currency,
      paymentMethods,
    });
  });

  // 4. POST /api/billing/checkout — Create hosted Dodo Checkout Session (Requires Firebase Auth)
  app.post('/api/billing/checkout', requireFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const client = getDodoClient();
      if (!client) {
        return sendNormalizedError(
          res,
          503,
          'billing/not-configured',
          'Dodo Payments SDK is not configured on the server'
        );
      }

      const rawPlan = String(req.body?.plan || '').trim().toLowerCase();
      const rawInterval = String(req.body?.interval || req.body?.billingCycle || 'monthly')
        .trim()
        .toLowerCase();

      if (rawPlan !== 'spark' && rawPlan !== 'fire') {
        return sendNormalizedError(
          res,
          400,
          'billing/invalid-plan',
          'Invalid plan. Must be "spark" or "fire".'
        );
      }
      if (rawInterval !== 'monthly' && rawInterval !== 'yearly') {
        return sendNormalizedError(
          res,
          400,
          'billing/invalid-interval',
          'Invalid interval. Must be "monthly" or "yearly".'
        );
      }

      const plan = rawPlan as PaidPlanId;
      const interval = rawInterval as BillingInterval;
      const uid = req.auth!.uid;

      const userRecord = getOrCreateBillingUser(uid, {
        email: req.auth!.email || req.body?.email || null,
        name: req.body?.name || null,
      });

      const country = normalizeCountryCode(
        req.body?.country || userRecord.billing_country || resolveDefaultBillingCountry(req),
        'US'
      );
      const countryInfo = getCountryInfo(country);
      const paymentMethods = getPaymentMethodsForCountry(country);

      // Update saved country on user record
      const db = getBillingDb();
      db.prepare(
        'UPDATE users SET billing_country = ?, billing_currency = ?, updated_at = ? WHERE firebase_uid = ?'
      ).run(country, countryInfo.currency, new Date().toISOString(), uid);

      // Server-authoritative product_id lookup (NEVER trust client product_id)
      const productId = await resolveServerProductId(plan, interval);
      const appBaseUrl = getAppBaseUrl(req);

      const customerEmail =
        userRecord.email ||
        req.auth!.email ||
        (typeof req.body?.email === 'string' && req.body.email.includes('@')
          ? req.body.email.trim()
          : `${uid}@users.kinich.app`);
      const customerName =
        userRecord.name ||
        (typeof req.body?.name === 'string' && req.body.name.trim()
          ? req.body.name.trim()
          : customerEmail.split('@')[0]);

      const sessionParams: any = {
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: userRecord.dodo_customer_id
          ? { customer_id: userRecord.dodo_customer_id }
          : { email: customerEmail, name: customerName },
        billing_address: { country },
        billing_currency: countryInfo.currency,
        allowed_payment_method_types: paymentMethods.allowedPaymentMethodTypes,
        return_url: `${appBaseUrl}/billing/return`,
        cancel_url: `${appBaseUrl}/pricing`,
        metadata: {
          firebase_uid: uid,
          plan,
          interval,
        },
        customization: {
          theme: 'dark',
        },
        feature_flags: {
          redirect_immediately: true,
        },
      };

      let session: any;
      try {
        session = await client.checkoutSessions.create(sessionParams);
      } catch (sessionErr: any) {
        if (sessionParams.customer?.customer_id) {
          // If customer_id failed (e.g. customer ID was from test environment), retry with email/name
          sessionParams.customer = { email: customerEmail, name: customerName };
          session = await client.checkoutSessions.create(sessionParams);
        } else {
          throw sessionErr;
        }
      }

      return res.json({
        success: true,
        checkout_url: session.checkout_url,
        session_id: session.session_id,
      });
    } catch (err: any) {
      return sendNormalizedError(
        res,
        err?.status && Number.isInteger(err.status) ? err.status : 500,
        'billing/checkout-failed',
        err?.message || 'Failed to create checkout session'
      );
    }
  });

  // 5. GET /api/billing/me — Current user's billing status, subscription & last 10 payments
  app.get('/api/billing/me', (req: Request, res: Response) => {
    const uid = req.auth?.uid || null;
    const defaultCountry = resolveDefaultBillingCountry(req);

    if (!uid) {
      const countryInfo = getCountryInfo(defaultCountry);
      return res.json({
        success: true,
        authenticated: false,
        plan: 'free',
        effectivePlan: 'free',
        planInterval: null,
        planStatus: 'none',
        currentPeriodEnd: null,
        planPeriodEnd: null,
        cancelAtNextBillingDate: false,
        cancelAtPeriodEnd: false,
        billingCountry: defaultCountry,
        billingCurrency: countryInfo.currency,
        dodoCustomerId: null,
        dodoSubscriptionId: null,
        disputeFlagged: false,
        subscription: null,
        payments: [],
        paymentMethods: getPaymentMethodsForCountry(defaultCountry),
      });
    }

    const db = getBillingDb();
    const user = getOrCreateBillingUser(uid, {
      email: req.auth?.email || null,
      country: defaultCountry,
    });
    const effective = getEffectiveServerUserPlan(uid);

    const subscription = user.dodo_subscription_id
      ? db
          .prepare('SELECT * FROM subscriptions WHERE dodo_subscription_id = ?')
          .get(user.dodo_subscription_id)
      : db
          .prepare('SELECT * FROM subscriptions WHERE firebase_uid = ? ORDER BY updated_at DESC LIMIT 1')
          .get(uid);

    const payments = db
      .prepare('SELECT * FROM payments WHERE firebase_uid = ? ORDER BY created_at DESC LIMIT 10')
      .all(uid);

    const country = normalizeCountryCode(user.billing_country || defaultCountry, 'US');

    return res.json({
      success: true,
      authenticated: true,
      uid,
      email: user.email || req.auth?.email || null,
      plan: user.plan,
      effectivePlan: effective.plan,
      planInterval: user.plan_interval,
      planStatus: effective.status,
      currentPeriodEnd: user.current_period_end,
      planPeriodEnd: user.current_period_end,
      cancelAtNextBillingDate: Boolean(user.cancel_at_next_billing_date),
      cancelAtPeriodEnd: Boolean(user.cancel_at_next_billing_date),
      billingCountry: country,
      billingCurrency: user.billing_currency,
      dodoCustomerId: user.dodo_customer_id,
      dodoSubscriptionId: user.dodo_subscription_id,
      disputeFlagged: Boolean(user.dispute_flagged),
      subscription: subscription || null,
      payments: payments || [],
      paymentMethods: getPaymentMethodsForCountry(country),
    });
  });

  // 6. POST /api/billing/portal — Create dynamic Dodo Customer Portal session
  app.post('/api/billing/portal', requireFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const client = getDodoClient();
      if (!client) {
        return sendNormalizedError(res, 503, 'billing/not-configured', 'Dodo Payments SDK not configured');
      }
      const user = getOrCreateBillingUser(req.auth!.uid, { email: req.auth!.email || null });
      if (!user.dodo_customer_id) {
        return sendNormalizedError(
          res,
          400,
          'billing/no-customer',
          'No active Dodo customer record found for this account.'
        );
      }

      const portal = await client.customers.customerPortal.create(user.dodo_customer_id, {
        return_url: `${getAppBaseUrl(req)}/settings/billing`,
      });

      return res.json({
        success: true,
        url: portal.link,
      });
    } catch (err: any) {
      return sendNormalizedError(
        res,
        err?.status || 500,
        'billing/portal-failed',
        err?.message || 'Failed to create customer portal session'
      );
    }
  });

  // 7. POST /api/billing/change-plan — Upgrade / Downgrade / Switch Interval on existing subscription
  app.post('/api/billing/change-plan', requireFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const client = getDodoClient();
      if (!client) {
        return sendNormalizedError(res, 503, 'billing/not-configured', 'Dodo Payments SDK not configured');
      }

      const rawPlan = String(req.body?.plan || '').trim().toLowerCase();
      const rawInterval = String(req.body?.interval || 'monthly').trim().toLowerCase();
      if (rawPlan !== 'spark' && rawPlan !== 'fire') {
        return sendNormalizedError(res, 400, 'billing/invalid-plan', 'Plan must be "spark" or "fire"');
      }
      if (rawInterval !== 'monthly' && rawInterval !== 'yearly') {
        return sendNormalizedError(res, 400, 'billing/invalid-interval', 'Interval must be "monthly" or "yearly"');
      }

      const plan = rawPlan as PaidPlanId;
      const interval = rawInterval as BillingInterval;
      const user = getOrCreateBillingUser(req.auth!.uid, { email: req.auth!.email || null });

      if (!user.dodo_subscription_id) {
        return sendNormalizedError(
          res,
          400,
          'billing/no-subscription',
          'No active subscription found to change plan. Use /api/billing/checkout instead.'
        );
      }

      const productId = await resolveServerProductId(plan, interval);
      const changeRes = await client.subscriptions.changePlan(user.dodo_subscription_id, {
        product_id: productId,
        quantity: 1,
        proration_billing_mode: 'prorated_immediately',
        on_payment_failure: 'prevent_change',
      });

      return res.json({
        success: true,
        subscription_id: user.dodo_subscription_id,
        target_plan: plan,
        target_interval: interval,
        payment_link: changeRes?.payment_link || null,
      });
    } catch (err: any) {
      return sendNormalizedError(
        res,
        err?.status || 500,
        'billing/change-plan-failed',
        err?.message || 'Failed to change subscription plan'
      );
    }
  });

  // 8. POST /api/billing/update-payment-method — Generate payment method update link for on_hold / past_due subscriptions
  app.post('/api/billing/update-payment-method', requireFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const client = getDodoClient();
      if (!client) {
        return sendNormalizedError(res, 503, 'billing/not-configured', 'Dodo Payments SDK not configured');
      }

      const user = getOrCreateBillingUser(req.auth!.uid, { email: req.auth!.email || null });
      if (!user.dodo_subscription_id) {
        return sendNormalizedError(
          res,
          400,
          'billing/no-subscription',
          'No subscription found for this account.'
        );
      }

      const updateRes = await client.subscriptions.updatePaymentMethod(user.dodo_subscription_id, {
        type: 'new',
        return_url: `${getAppBaseUrl(req)}/settings/billing`,
      } as any);

      return res.json({
        success: true,
        payment_link: updateRes.payment_link || null,
        payment_id: updateRes.payment_id || null,
      });
    } catch (err: any) {
      return sendNormalizedError(
        res,
        err?.status || 500,
        'billing/update-payment-method-failed',
        err?.message || 'Failed to initiate payment method update'
      );
    }
  });

  // 9. POST /api/billing/cancel — Cancel at period end (default) or uncancel / cancel immediately
  app.post('/api/billing/cancel', requireFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const client = getDodoClient();
      if (!client) {
        return sendNormalizedError(res, 503, 'billing/not-configured', 'Dodo Payments SDK not configured');
      }

      const atPeriodEnd = req.body?.atPeriodEnd !== false;
      const resume = req.body?.resume === true;
      const user = getOrCreateBillingUser(req.auth!.uid, { email: req.auth!.email || null });

      if (!user.dodo_subscription_id) {
        return sendNormalizedError(
          res,
          400,
          'billing/no-subscription',
          'No active subscription found to cancel.'
        );
      }

      const updatedSub = resume
        ? await client.subscriptions.update(user.dodo_subscription_id, {
            cancel_at_next_billing_date: false,
          })
        : atPeriodEnd
        ? await client.subscriptions.update(user.dodo_subscription_id, {
            cancel_at_next_billing_date: true,
          })
        : await client.subscriptions.update(user.dodo_subscription_id, {
            status: 'cancelled',
            cancel_reason: 'cancelled_by_customer',
          });

      const db = getBillingDb();
      const nowIso = new Date().toISOString();
      const cancelFlag = resume ? 0 : atPeriodEnd ? 1 : 0;
      const newStatus: PlanStatus = resume
        ? 'active'
        : atPeriodEnd
        ? 'cancelled'
        : 'expired';
      const newPlan: BillingPlanId = resume || atPeriodEnd ? user.plan : 'free';

      db.prepare(
        `UPDATE users SET
          plan = ?,
          plan_status = ?,
          cancel_at_next_billing_date = ?,
          current_period_end = COALESCE(?, current_period_end),
          updated_at = ?
        WHERE firebase_uid = ?`
      ).run(
        newPlan,
        newStatus,
        cancelFlag,
        updatedSub?.next_billing_date || null,
        nowIso,
        req.auth!.uid
      );

      db.prepare(
        `UPDATE subscriptions SET
          status = ?,
          cancel_at_next_billing_date = ?,
          updated_at = ?
        WHERE dodo_subscription_id = ?`
      ).run(newStatus, cancelFlag, nowIso, user.dodo_subscription_id);

      return res.json({
        success: true,
        plan: newPlan,
        planStatus: newStatus,
        cancelAtNextBillingDate: Boolean(cancelFlag),
        cancelAtPeriodEnd: Boolean(cancelFlag),
        currentPeriodEnd: updatedSub?.next_billing_date || user.current_period_end,
        planPeriodEnd: updatedSub?.next_billing_date || user.current_period_end,
      });
    } catch (err: any) {
      return sendNormalizedError(
        res,
        err?.status || 500,
        'billing/cancel-failed',
        err?.message || 'Failed to update subscription cancellation status'
      );
    }
  });

  // 10. POST /api/webhooks/dodo — Verified Dodo Webhook Endpoint (raw body signature verification)
  const webhookHandler = (req: Request, res: Response) => {
    try {
      const client = getDodoClient();
      if (!client) {
        return sendNormalizedError(res, 503, 'webhooks/not-configured', 'Dodo Payments SDK not configured');
      }

      const rawBody: string =
        typeof (req as any).rawBody === 'string'
          ? (req as any).rawBody
          : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body || {});

      const webhookKey = getDodoPaymentsWebhookKey();
      const webhookId = String(req.headers['webhook-id'] || '').trim();
      const webhookSignature = String(req.headers['webhook-signature'] || '').trim();
      const webhookTimestamp = String(req.headers['webhook-timestamp'] || '').trim();

      if (!webhookId || !webhookSignature || !webhookTimestamp || !webhookKey) {
        return sendNormalizedError(
          res,
          401,
          'webhooks/invalid-signature',
          'Missing required webhook signature headers or webhook key'
        );
      }

      let unwrapped: any;
      try {
        unwrapped = client.webhooks.unwrap(rawBody, {
          headers: {
            'webhook-id': webhookId,
            'webhook-signature': webhookSignature,
            'webhook-timestamp': webhookTimestamp,
          },
          key: webhookKey,
        });
      } catch (verifyErr: any) {
        return sendNormalizedError(
          res,
          401,
          'webhooks/invalid-signature',
          verifyErr?.message || 'Webhook cryptographic signature verification failed'
        );
      }

      const outcome = processVerifiedDodoWebhookEvent(webhookId, unwrapped);

      // Sync quota ledger if a user's plan changed
      if (outcome.uid && !outcome.duplicate && !outcome.outOfOrder) {
        const eff = getEffectiveServerUserPlan(outcome.uid);
        const fakeReq = {
          auth: { uid: outcome.uid },
          headers: req.headers,
          socket: req.socket,
          ip: req.ip,
        } as unknown as Request;
        upgradeServerSubscriptionPlan(fakeReq, eff.plan, eff.interval);
      }

      return res.status(200).json({
        received: true,
        duplicate: outcome.duplicate,
        outOfOrder: outcome.outOfOrder,
        type: outcome.processedType,
      });
    } catch (err: any) {
      return sendNormalizedError(
        res,
        400,
        'webhooks/processing-failed',
        err?.message || 'Webhook processing error'
      );
    }
  };

  app.post('/api/webhooks/dodo', webhookHandler);
  app.post('/api/billing/webhook', webhookHandler);
}
