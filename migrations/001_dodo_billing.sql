-- Kinich Dodo Payments (Merchant of Record) Billing Schema Migration
-- Supports SQLite / PostgreSQL compatible DDL for users, subscriptions, payments, and webhook idempotency.

CREATE TABLE IF NOT EXISTS users (
  firebase_uid TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  plan TEXT NOT NULL DEFAULT 'free', -- 'free' | 'spark' | 'fire'
  plan_interval TEXT,                -- 'monthly' | 'yearly' | NULL
  plan_status TEXT NOT NULL DEFAULT 'none', -- 'none' | 'pending' | 'active' | 'past_due' | 'on_hold' | 'cancelled' | 'expired' | 'failed'
  dodo_customer_id TEXT,
  dodo_subscription_id TEXT,
  current_period_end TEXT,
  cancel_at_next_billing_date INTEGER NOT NULL DEFAULT 0,
  billing_country TEXT DEFAULT 'US',
  billing_currency TEXT DEFAULT 'USD',
  dispute_flagged INTEGER NOT NULL DEFAULT 0,
  first_purchase_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_dodo_customer ON users(dodo_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_dodo_subscription ON users(dodo_subscription_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  dodo_subscription_id TEXT PRIMARY KEY,
  firebase_uid TEXT NOT NULL,
  dodo_customer_id TEXT,
  product_id TEXT NOT NULL,
  plan TEXT NOT NULL,               -- 'spark' | 'fire'
  interval TEXT NOT NULL,           -- 'monthly' | 'yearly'
  status TEXT NOT NULL,             -- 'pending' | 'active' | 'past_due' | 'on_hold' | 'cancelled' | 'expired' | 'failed'
  currency TEXT NOT NULL DEFAULT 'USD',
  amount INTEGER NOT NULL DEFAULT 0,
  next_billing_date TEXT,
  previous_billing_date TEXT,
  cancel_at_next_billing_date INTEGER NOT NULL DEFAULT 0,
  cancelled_at TEXT,
  last_event_timestamp TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_uid ON subscriptions(firebase_uid);

CREATE TABLE IF NOT EXISTS payments (
  dodo_payment_id TEXT PRIMARY KEY,
  dodo_subscription_id TEXT,
  firebase_uid TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,             -- 'succeeded' | 'failed' | 'refunded' | 'disputed'
  payment_method TEXT,
  payment_method_type TEXT,
  card_network TEXT,
  card_last_four TEXT,
  invoice_id TEXT,
  invoice_url TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_uid ON payments(firebase_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS processed_webhooks (
  webhook_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL
);
