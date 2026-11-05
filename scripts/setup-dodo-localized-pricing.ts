/**
 * One-time setup script: enables Dodo Localized Pricing for India on the 4 Kinich products.
 *
 * Usage: npx tsx scripts/setup-dodo-localized-pricing.ts
 *
 * Idempotent: lists existing localized price rules first and skips if IN/INR rule exists.
 */
import { getDodoClient } from '../server/billingEngine';
import { getDodoProductIds } from '../server/config';

const INR_PRICES: Record<string, number> = {
  spark_monthly: 9900,   // ₹99.00
  spark_yearly: 94900,   // ₹949.00
  fire_monthly: 24900,   // ₹249.00
  fire_yearly: 239900,   // ₹2,399.00
};

async function main() {
  const client = getDodoClient();
  if (!client) {
    console.error('Dodo client not configured. Set DODO_PAYMENTS_API_KEY.');
    process.exit(1);
  }

  const envIds = getDodoProductIds();
  const productKeys = ['spark_monthly', 'spark_yearly', 'fire_monthly', 'fire_yearly'] as const;

  for (const key of productKeys) {
    const productId = envIds[key];
    if (!productId) {
      console.warn(`[skip] ${key}: no product ID configured`);
      continue;
    }

    console.log(`\n=== ${key} (${productId}) ===`);

    // 1. Check if localized pricing is already enabled
    try {
      const product = await client.products.retrieve(productId);
      const pricingMode = (product as any)?.price?.pricing_mode;
      if (pricingMode !== 'by_country') {
        console.log(`  Setting pricing_mode to by_country...`);
        await client.products.update(productId, {
          price: { ...(product as any).price, pricing_mode: 'by_country' },
        } as any);
        console.log(`  ✓ pricing_mode set to by_country`);
      } else {
        console.log(`  ✓ pricing_mode already by_country`);
      }
    } catch (err: any) {
      console.warn(`  ⚠ Could not check/update pricing_mode: ${err?.message}`);
    }

    // 2. List existing localized price rules
    let existingRules: any[] = [];
    try {
      const rules = await (client.products as any).localizedPrices.list(productId);
      existingRules = Array.isArray(rules?.items) ? rules.items : Array.isArray(rules) ? rules : [];
    } catch (err: any) {
      console.warn(`  ⚠ Could not list localized prices: ${err?.message}`);
    }

    const hasIndiaRule = existingRules.some(
      (r: any) => r?.country_code === 'IN' && r?.currency === 'INR'
    );

    if (hasIndiaRule) {
      console.log(`  ✓ India INR rule already exists (skipping)`);
      continue;
    }

    // 3. Create India localized price rule
    try {
      await (client.products as any).localizedPrices.create(productId, {
        currency: 'INR',
        country_code: 'IN',
        amount: INR_PRICES[key],
      });
      console.log(`  ✓ Created India rule: INR ${INR_PRICES[key] / 100}`);
    } catch (err: any) {
      console.error(`  ✗ Failed to create India rule: ${err?.message}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
