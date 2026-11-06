import { beforeEach, describe, expect, it } from 'vitest';
import {
  getBillingDb,
  getEffectiveServerUserPlan,
  getOrCreateBillingUser,
  getPaymentMethodsForCountry,
  previewPlanPriceForCountry,
  processVerifiedDodoWebhookEvent,
  resetBillingDbForTests,
} from '../server/billingEngine';

describe('Dodo Payments Billing Engine & Webhook State Machine', () => {
  beforeEach(() => {
    resetBillingDbForTests();
  });

  it('returns accurate country-specific subscription and one-time payment methods', () => {
    const inMethods = getPaymentMethodsForCountry('IN');
    expect(inMethods.currency).toBe('INR');
    expect(inMethods.allowedPaymentMethodTypes).toContain('upi_collect');
    expect(inMethods.allowedPaymentMethodTypes).toContain('upi_intent');
    expect(inMethods.allowedPaymentMethodTypes).toContain('credit');
    expect(inMethods.mandateNote).toContain('RBI e-mandates');

    const nlMethods = getPaymentMethodsForCountry('NL');
    expect(nlMethods.currency).toBe('EUR');
    expect(nlMethods.allowedPaymentMethodTypes).toContain('ideal');
    expect(nlMethods.oneTimeOnlyMethods.some((m) => m.id === 'sepa')).toBe(true);

    const brMethods = getPaymentMethodsForCountry('BR');
    expect(brMethods.currency).toBe('BRL');
    expect(brMethods.allowedPaymentMethodTypes).toContain('pix');
  });

  it('generates localized pricing previews with tax breakdown and USD reference price', async () => {
    const inSpark = await previewPlanPriceForCountry('spark', 'monthly', 'IN');
    expect(inSpark.currency).toBe('INR');
    expect(inSpark.usdReferencePrice).toBe(3);
    expect(inSpark.totalMinor).toBe(9900);
    expect(inSpark.formattedTotal).toBe('₹99');
    expect(inSpark.totalMinor).toBeGreaterThan(inSpark.subtotalMinor);
    expect(inSpark.taxLabel).toContain('GST');

    const inSparkYearly = await previewPlanPriceForCountry('spark', 'yearly', 'IN');
    expect(inSparkYearly.currency).toBe('INR');
    expect(inSparkYearly.totalMinor).toBe(94900);
    expect(inSparkYearly.formattedTotal).toBe('₹949');

    const inFireMonthly = await previewPlanPriceForCountry('fire', 'monthly', 'IN');
    expect(inFireMonthly.currency).toBe('INR');
    expect(inFireMonthly.totalMinor).toBe(24900);
    expect(inFireMonthly.formattedTotal).toBe('₹249');

    const inFireYearly = await previewPlanPriceForCountry('fire', 'yearly', 'IN');
    expect(inFireYearly.currency).toBe('INR');
    expect(inFireYearly.totalMinor).toBe(239900);
    expect(inFireYearly.formattedTotal).toBe('₹2,399');

    const usFireYearly = await previewPlanPriceForCountry('fire', 'yearly', 'US');
    expect(usFireYearly.currency).toBe('USD');
    expect(usFireYearly.usdReferencePrice).toBe(67);
    expect(usFireYearly.formattedSubtotal).toContain('$67');
  });

  it('transitions user entitlement across subscription.active, cancelled, refund, and dispute', () => {
    const uid = 'user_dodo_lifecycle_1';
    getOrCreateBillingUser(uid, { email: 'test@kinich.app', country: 'IN' });

    const futureIso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const t1 = '2026-11-04T10:00:00.000Z';

    // 1. Activate Spark Monthly
    const res1 = processVerifiedDodoWebhookEvent('wh_1', {
      type: 'subscription.active',
      timestamp: t1,
      data: {
        payload_type: 'Subscription',
        subscription_id: 'sub_test_1',
        product_id: 'pdt_kinich_spark_monthly',
        status: 'active',
        currency: 'INR',
        recurring_pre_tax_amount: 25200,
        payment_frequency_interval: 'Month',
        next_billing_date: futureIso,
        previous_billing_date: t1,
        cancel_at_next_billing_date: false,
        customer: {
          customer_id: 'cus_test_1',
          email: 'test@kinich.app',
          name: 'Test User',
        },
        metadata: {
          firebase_uid: uid,
          plan: 'spark',
          interval: 'monthly',
        },
      },
    });
    expect(res1.duplicate).toBe(false);
    expect(getEffectiveServerUserPlan(uid).plan).toBe('spark');
    expect(getEffectiveServerUserPlan(uid).status).toBe('active');

    // 2. Idempotency: re-delivering same webhook_id is a no-op
    const resDup = processVerifiedDodoWebhookEvent('wh_1', {
      type: 'subscription.active',
      timestamp: t1,
      data: { subscription_id: 'sub_test_1' },
    });
    expect(resDup.duplicate).toBe(true);

    // 3. Out-of-order protection: older timestamp does not overwrite active subscription
    const olderT = '2026-11-04T09:00:00.000Z';
    const resStale = processVerifiedDodoWebhookEvent('wh_stale', {
      type: 'subscription.on_hold',
      timestamp: olderT,
      data: {
        payload_type: 'Subscription',
        subscription_id: 'sub_test_1',
        product_id: 'pdt_kinich_spark_monthly',
        status: 'on_hold',
        metadata: { firebase_uid: uid, plan: 'spark', interval: 'monthly' },
      },
    });
    expect(resStale.outOfOrder).toBe(true);
    expect(getEffectiveServerUserPlan(uid).plan).toBe('spark');

    // 4. Cancel at period end: user retains Spark access until current_period_end
    const t2 = '2026-11-04T11:00:00.000Z';
    processVerifiedDodoWebhookEvent('wh_2', {
      type: 'subscription.cancelled',
      timestamp: t2,
      data: {
        payload_type: 'Subscription',
        subscription_id: 'sub_test_1',
        product_id: 'pdt_kinich_spark_monthly',
        status: 'cancelled',
        next_billing_date: futureIso,
        cancel_at_next_billing_date: true,
        metadata: { firebase_uid: uid, plan: 'spark', interval: 'monthly' },
      },
    });
    expect(getEffectiveServerUserPlan(uid).plan).toBe('spark');
    expect(getEffectiveServerUserPlan(uid).status).toBe('cancelled');

    // 5. Partial refund keeps paid plan; full refund revokes paid plan
    processVerifiedDodoWebhookEvent('wh_3_pay', {
      type: 'payment.succeeded',
      timestamp: '2026-11-04T11:05:00.000Z',
      data: {
        payload_type: 'Payment',
        payment_id: 'pay_test_1',
        subscription_id: 'sub_test_1',
        total_amount: 29736,
        tax: 4536,
        currency: 'INR',
        payment_method: 'upi_intent',
        metadata: { firebase_uid: uid },
      },
    });

    processVerifiedDodoWebhookEvent('wh_4_partial_refund', {
      type: 'refund.succeeded',
      timestamp: '2026-11-04T11:10:00.000Z',
      data: {
        payload_type: 'Refund',
        refund_id: 'ref_partial',
        payment_id: 'pay_test_1',
        is_partial: true,
        amount: 5000,
        currency: 'INR',
        status: 'succeeded',
        reason: 'requested_by_customer',
      },
    });
    expect(getEffectiveServerUserPlan(uid).plan).toBe('spark');
    const refundRow = getBillingDb()
      .prepare('SELECT dodo_refund_id, amount, currency, reason, status FROM refunds WHERE dodo_refund_id = ?')
      .get('ref_partial') as {
      dodo_refund_id: string;
      amount: number;
      currency: string;
      reason: string;
      status: string;
    };
    expect(refundRow?.dodo_refund_id).toBe('ref_partial');
    expect(refundRow?.amount).toBe(5000);
    expect(refundRow?.currency).toBe('INR');
    expect(refundRow?.status).toBe('succeeded');

    // 6. Full refund (with only payment_id, no metadata.firebase_uid) finds user from payment and drops Spark back to Free
    const fullRefundOutcome = processVerifiedDodoWebhookEvent('wh_5_full_refund', {
      type: 'refund.succeeded',
      timestamp: '2026-11-04T11:12:00.000Z',
      data: {
        payload_type: 'Refund',
        refund_id: 'ref_full_1',
        payment_id: 'pay_test_1',
        is_partial: false,
        amount: 29736,
        currency: 'INR',
        status: 'succeeded',
        reason: 'requested_by_customer',
      },
    });
    expect(fullRefundOutcome.uid).toBe(uid);
    expect(getEffectiveServerUserPlan(uid).plan).toBe('free');

    // 7. Dispute opened immediately revokes paid access and flags user
    processVerifiedDodoWebhookEvent('wh_6_dispute', {
      type: 'dispute.opened',
      timestamp: '2026-11-04T11:15:00.000Z',
      data: {
        payload_type: 'Dispute',
        dispute_id: 'dp_1',
        payment_id: 'pay_test_1',
        dispute_status: 'dispute_opened',
      },
    });
    expect(getEffectiveServerUserPlan(uid).plan).toBe('free');
    const userRow = getBillingDb()
      .prepare('SELECT dispute_flagged FROM users WHERE firebase_uid = ?')
      .get(uid) as { dispute_flagged: number };
    expect(userRow.dispute_flagged).toBe(1);
  });
});

