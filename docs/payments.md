# Kinich × Dodo Payments (Merchant of Record) Integration Reference

This document summarises the verified Dodo Payments TypeScript SDK (`dodopayments` v2.27+) API methods, enums, webhook event schemas, localized payment method configurations, test credentials, and the Go-Live Checklist for **Kinich** (`https://kinich.app`).

---

## 1. Documentation & Reference Links Verified

- **Documentation Index (LLMs Index)**: <https://docs.dodopayments.com/llms.txt>
- **Integration Guide**: <https://docs.dodopayments.com/developer-resources/integration-guide>
- **Subscription Integration Guide**: <https://docs.dodopayments.com/developer-resources/subscription-integration-guide>
- **Checkout Sessions API Reference**: <https://docs.dodopayments.com/api-reference/checkout-sessions/create>
- **Checkout Sessions Preview Reference**: <https://docs.dodopayments.com/api-reference/checkout-sessions/preview>
- **Subscriptions API Reference**: <https://docs.dodopayments.com/api-reference/subscriptions>
- **Change Plan API Reference**: <https://docs.dodopayments.com/api-reference/subscriptions/change-plan>
- **Update Payment Method Reference**: <https://docs.dodopayments.com/api-reference/subscriptions/update-payment-method>
- **Customer Portal Sessions Reference**: <https://docs.dodopayments.com/api-reference/customers/customer-portal/create>
- **Webhooks & Standard Webhooks Verification**: <https://docs.dodopayments.com/developer-resources/webhooks>
- **Payment Methods (Global, India, Europe, Asia-Pacific)**: <https://docs.dodopayments.com/features/payment-methods>
- **Adaptive Currency, Localized Pricing & PPP**: <https://docs.dodopayments.com/features/adaptive-currency>
- **Supported Countries**: <https://docs.dodopayments.com/features/supported-countries>
- **Testing Process (Test Cards & UPI IDs)**: <https://docs.dodopayments.com/developer-resources/testing-process>

---

## 2. Verified TypeScript SDK (`dodopayments`) Methods, Enums & Fields

All backend calls use the official `dodopayments` npm package (`server/billingEngine.ts`), verified directly against `node_modules/dodopayments/resources/*.d.ts`:

### 2.1 SDK Client Initialisation
```ts
import DodoPayments from 'dodopayments';

const client = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
});
```

### 2.2 Products (`client.products.create`)
For recurring subscriptions (`type: 'recurring_price'`), both `payment_frequency_*` and `subscription_period_*` are required:
- `price.type`: `'recurring_price'`
- `price.currency`: `'USD'` (`Currency` enum)
- `price.price`: integer minor units (`300` = $3.00, `2900` = $29.00, `700` = $7.00, `6700` = $67.00)
- `price.payment_frequency_count`: `1`
- `price.payment_frequency_interval`: `'Month'` | `'Year'` (`TimeInterval` enum: `'Day' | 'Week' | 'Month' | 'Year'`)
- `price.subscription_period_count`: `20` (for ongoing 20-year subscription horizon)
- `price.subscription_period_interval`: `'Year'`
- `tax_category`: `'saas'` (`TaxCategory` enum: `'digital_products' | 'saas' | 'e_book' | 'edtech'`)

### 2.3 Checkout Sessions (`client.checkoutSessions.create` & `client.checkoutSessions.preview`)
- **`client.checkoutSessions.create(params)`**:
  - `product_cart`: `[{ product_id, quantity: 1 }]`
  - `customer`: `{ customer_id }` (when `dodo_customer_id` exists on user) OR `{ email, name }`
  - `billing_address`: `{ country: CountryCode }` (ISO-2 uppercase code)
  - `return_url`: `'https://kinich.app/billing/return'`
  - `allowed_payment_method_types`: always includes `'credit'` and `'debit'` as fallbacks (`PaymentMethodTypes` enum). Note: the API enum uses `'upi_collect'` and `'upi_intent'` (not generic `upi`), `'apple_pay'`, `'google_pay'`, `'cashapp'`, `'revolut_pay'`, `'bancontact_card'`, `'eps'`, `'ideal'`, `'satispay'`, `'blik'`, `'pix'`, `'kakao_pay'`, `'naver_pay'`, `'payco'`, `'gcash'`, `'ali_pay_hk'`, `'fps'`, `'touch_n_go'`.
  - `customization`: `{ theme: 'dark' }`
  - `feature_flags`: `{ allow_currency_selection: true, allow_discount_code: true, allow_tax_id: true }`
  - `metadata`: `{ user_id, plan, interval, app: 'kinich' }` (all values must be strings)
  - Returns `{ session_id: string, checkout_url: string | null }`
- **`client.checkoutSessions.preview(params)`**:
  - Accepts the same `CheckoutSessionRequest` payload and returns localized `total_price`, `total_tax`, `billing_country`, `currency`, and `product_cart` breakdown in minor units.

### 2.4 Subscriptions (`client.subscriptions.*`)
- **Retrieve**: `client.subscriptions.retrieve(subscriptionId)`
- **Change Plan**: `client.subscriptions.changePlan(subscriptionId, { product_id, quantity: 1, proration_billing_mode: 'difference_immediately', on_payment_failure: 'prevent_change' })`
  - Verified `proration_billing_mode` enum values: `'prorated_immediately' | 'full_immediately' | 'difference_immediately' | 'do_nothing'`.
- **Update Payment Method**: `client.subscriptions.updatePaymentMethod(subscriptionId, { type: 'new', return_url: 'https://kinich.app/settings/billing' })`
- **Cancel at Period End / Resume**: `client.subscriptions.update(subscriptionId, { cancel_at_next_billing_date: true | false })`

### 2.5 Customer Portal (`client.customers.customerPortal.create`)
- `client.customers.customerPortal.create(customerId, { send_email: false })` -> returns `{ link: string }`.

### 2.6 Webhook Verification (`client.webhooks.unwrap`)
- `client.webhooks.unwrap(rawBodyString, { headers: { 'webhook-id', 'webhook-signature', 'webhook-timestamp' }, key: webhookSecret })`
- Uses the Standard Webhooks specification (`webhook-id`, `webhook-signature`, `webhook-timestamp`).
- Throws an error on invalid or missing signature -> backend returns `401 Unauthorized`.

---

## 3. Payment Methods Matrix by Country

- **Global**: Credit & Debit Cards (`credit`, `debit`), Apple Pay (`apple_pay`, including India).
- **Everywhere except India**: Google Pay (`google_pay`), Amazon Pay (`amazon_pay`, one-time only), Stablecoins (USD, one-time).
- **India (`IN`, INR)**:
  - Prominent: **UPI AutoPay** (`upi_collect`, `upi_intent`) and **RuPay Cards** (`credit`, `debit`), plus Visa/Mastercard/Amex Indian cards and **Apple Pay** (`apple_pay`).
  - Subscriptions run on RBI e-Mandates / UPI AutoPay (pre-debit notifications sent 24–48h before renewal).
  - Google Pay and Amazon Pay are **not** shown for India.
- **United States (`US`, USD)**: Cash App Pay (`cashapp`), ACH (`ach`, one-time only). Klarna & Afterpay are excluded since Kinich plans ($3–$67) are under the threshold / recurring.
- **Eurozone / UK / Poland**: SEPA (`sepa`, one-time), Satispay (`satispay`), NL iDEAL (`ideal`), BE Bancontact (`bancontact_card`), AT EPS (`eps`), PT Multibanco (`multibanco`, one-time), PL BLIK (`blik`), UK Revolut Pay (`revolut_pay`).
- **LATAM & APAC**: Brazil Pix (`pix`), South Korea (`kakao_pay`, `naver_pay`, `payco`), Philippines (`gcash`), Hong Kong (`ali_pay_hk`, `fps`), Malaysia (`touch_n_go`).
- **PayPal**: Never shown or enabled.

---

## 4. Test Credentials (Test Mode)

When `DODO_PAYMENTS_ENVIRONMENT=test_mode`:

### Test Cards
| Scenario | Card Number | Expiry | CVV | OTP (if prompted) |
| :--- | :--- | :--- | :--- | :--- |
| **Standard Success (Visa)** | `4242 4242 4242 4242` | Any future date (e.g. `12/29`) | `123` | `123456` |
| **3DS Authentication Success** | `4000 0027 6000 3184` | Any future date | `123` | Complete 3DS modal |
| **Generic Decline** | `4000 0000 0000 0002` | Any future date | `123` | — |
| **Insufficient Funds** | `4000 0000 0000 9995` | Any future date | `123` | — |

### Test UPI IDs (India / INR)
- **Success UPI VPA**: `success@razorpay` (or `success@upi`)
- **Pending / Delayed UPI VPA**: `pending@razorpay`
- **Failed UPI VPA**: `failure@razorpay`

---

## 5. Go-Live Checklist (Switching from Test Mode to Live Mode)

Because Dodo LIVE payments are already approved for the business, switching Kinich from `test_mode` to `live_mode` requires **zero code changes** — only these 5 configuration steps:

1. **Create the 4 Live Subscription Products in the Dodo Live Dashboard** (`https://app.dodopayments.com` in **Live** mode):
   - **Kinich Spark — Monthly**: Recurring, `$3.00 USD`, billed every `1 Month`, subscription period `20 Years`, Tax Category `saas`, Adaptive Currency / Localized Pricing enabled.
   - **Kinich Spark — Yearly**: Recurring, `$29.00 USD`, billed every `1 Year`, subscription period `20 Years`, Tax Category `saas`, Adaptive Currency / Localized Pricing enabled.
   - **Kinich Fire — Monthly**: Recurring, `$7.00 USD`, billed every `1 Month`, subscription period `20 Years`, Tax Category `saas`, Adaptive Currency / Localized Pricing enabled.
   - **Kinich Fire — Yearly**: Recurring, `$67.00 USD`, billed every `1 Year`, subscription period `20 Years`, Tax Category `saas`, Adaptive Currency / Localized Pricing enabled.
2. **Copy the 4 Live `pdt_...` Product IDs into Server Environment Variables**:
   - `DODO_PRODUCT_SPARK_MONTHLY=pdt_...`
   - `DODO_PRODUCT_SPARK_YEARLY=pdt_...`
   - `DODO_PRODUCT_FIRE_MONTHLY=pdt_...`
   - `DODO_PRODUCT_FIRE_YEARLY=pdt_...`
3. **Register the Live Webhook Endpoint in Dodo Dashboard → Developer → Webhooks**:
   - Endpoint URL: `https://kinich.app/api/webhooks/dodo`
   - Subscribe to events: `subscription.active`, `subscription.renewed`, `subscription.updated`, `subscription.plan_changed`, `subscription.on_hold`, `subscription.cancelled`, `subscription.failed`, `subscription.expired`, `payment.succeeded`, `payment.failed`, `payment.processing`, `payment.cancelled`, `refund.succeeded`, `refund.failed`, `dispute.opened`, `dispute.won`, `dispute.lost`, `dispute.accepted`, `dispute.cancelled`, `dispute.challenged`, `dispute.expired`.
   - Copy the Live signing secret (`whsec_...`) into `DODO_PAYMENTS_WEBHOOK_KEY`.
4. **Set the Live API Key**:
   - Create a Live API key in Dodo Dashboard → Developer → API Keys and set `DODO_PAYMENTS_API_KEY` on the server.
5. **Flip the Environment Variable to `live_mode`**:
   - Set `DODO_PAYMENTS_ENVIRONMENT=live_mode` and `APP_URL=https://kinich.app`, then redeploy/restart the backend.
