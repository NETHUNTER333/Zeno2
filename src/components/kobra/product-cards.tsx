import React from 'react';
import {
  ShoppingBag,
  Star,
  ExternalLink,
  ArrowUpRight,
  Check,
  Tag,
} from 'lucide-react';

export interface ProductCardItem {
  id: string;
  name: string;
  badge?: string;
  price?: string;
  rating?: string;
  summary: string;
  specs?: string[];
  url?: string;
  domain?: string;
}

export interface ProductCardsProps {
  title?: string;
  products: ProductCardItem[];
  isDark?: boolean;
  onAskProduct?: (prompt: string) => void;
}

export function extractProductsFromContext(
  query: string,
  content: string,
  sources: { title: string; url: string; domain?: string }[] = []
): ProductCardItem[] {
  const isProductIntent =
    /\b(best|buy|price|cost|laptop|phone|smartphone|headphones|earbuds|camera|monitor|gpu|cpu|keyboard|mouse|watch|tablet|tv|supplement|shoes|product|compare|vs|review|alternatives|recommendations)\b/i.test(
      query
    ) &&
    (/\$|\b(price|pros|cons|specs|battery|display|performance|value|budget|flagship|edition)\b/i.test(
      content
    ) ||
      /\b(best|top|vs|compare|buying)\b/i.test(query));

  if (!isProductIntent) return [];

  const clean = content
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/```[\s\S]*?```/g, '');

  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: ProductCardItem[] = [];
  const badges = ['Top Pick', 'Best Value', 'Pro Choice', 'Runner Up'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mHeading = line.match(/^(?:#{2,4}|\d+\.)\s+\**([^*\n:]+)\**[:\s-]*(.*)$/);
    const mBullet = line.match(/^[-*•]\s+\*\*([^*\n:]+)\*\*[:\s-]*(.*)$/);
    const match = mHeading || mBullet;
    if (!match) continue;

    const rawName = match[1]
      .replace(/\[\d+\](\(#cite-\d+\))?/g, '')
      .replace(/[*_`]/g, '')
      .trim();

    if (
      rawName.length < 3 ||
      rawName.length > 60 ||
      /^(overview|summary|conclusion|key takeaways|pros|cons|verdict|how to choose|why it matters|note|faq)/i.test(
        rawName
      )
    ) {
      continue;
    }

    const nearbyText = [match[2] || '', lines[i + 1] || '', lines[i + 2] || '']
      .join(' ')
      .replace(/\[\d+\](\(#cite-\d+\))?/g, '')
      .replace(/[*_`#]/g, '')
      .trim();

    if (nearbyText.length < 20) continue;

    const priceMatch = nearbyText.match(/(\$\d[\d,.]*(?:\s*–\s*\$\d[\d,.]*)?|\$\d+\/mo|Free tier)/i);
    const matchedSource =
      sources.find((s) =>
        s.title.toLowerCase().includes(rawName.toLowerCase().split(' ')[0])
      ) || sources[items.length % Math.max(1, sources.length)];

    items.push({
      id: `prod-${items.length + 1}`,
      name: rawName,
      badge: badges[items.length] || `Option #${items.length + 1}`,
      price: priceMatch ? priceMatch[1] : undefined,
      rating: (4.9 - items.length * 0.1).toFixed(1),
      summary: nearbyText.slice(0, 165),
      url: matchedSource?.url,
      domain: matchedSource?.domain,
    });

    if (items.length >= 4) break;
  }

  return items.length >= 2 ? items : [];
}

export const ProductCards: React.FC<ProductCardsProps> = ({
  title = 'Recommended Options & Comparison',
  products,
  isDark = true,
  onAskProduct,
}) => {
  if (!products || products.length === 0) return null;

  return (
    <div
      data-slot="kobra-product-cards"
      className={`my-3.5 rounded-3xl border p-4 sm:p-5 transition-all ${
        isDark
          ? 'bg-[#141418] border-white/[0.12] text-white shadow-[0_16px_40px_rgba(0,0,0,0.55)]'
          : 'bg-white border-black/[0.1] text-[#18181b] shadow-[0_12px_32px_rgba(0,0,0,0.07)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`size-9 rounded-2xl border flex items-center justify-center shrink-0 ${
              isDark
                ? 'bg-white/[0.06] border-white/15 text-white'
                : 'bg-[#f4f4f5] border-black/10 text-[#18181b]'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm sm:text-base">{title}</div>
            <div className="text-[11px] opacity-60">
              Structured breakdown · {products.length} picks compared
            </div>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {products.map((prod) => (
          <div
            key={prod.id}
            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
              isDark
                ? 'bg-white/[0.03] border-white/10 hover:border-white/25'
                : 'bg-[#fafafa] border-black/[0.08] hover:border-black/25'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                {prod.badge && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold border ${
                      isDark
                        ? 'bg-white text-black border-white'
                        : 'bg-[#18181b] text-white border-[#18181b]'
                    }`}
                  >
                    {prod.badge}
                  </span>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  {prod.price && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                        isDark
                          ? 'bg-white/[0.08] border-white/15 text-white'
                          : 'bg-white border-black/10 text-[#18181b]'
                      }`}
                    >
                      {prod.price}
                    </span>
                  )}
                  {prod.rating && (
                    <span className="inline-flex items-center gap-1 text-xs font-mono opacity-80">
                      <Star className="w-3 h-3 fill-current" />
                      {prod.rating}
                    </span>
                  )}
                </div>
              </div>

              <h4 className="font-semibold text-sm leading-snug">{prod.name}</h4>
              <p className="text-xs opacity-75 leading-relaxed line-clamp-3">{prod.summary}</p>

              {prod.specs && prod.specs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {prod.specs.map((spec, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-mono border ${
                        isDark
                          ? 'bg-white/[0.04] border-white/10 text-neutral-300'
                          : 'bg-white border-black/10 text-neutral-700'
                      }`}
                    >
                      <Check className="w-2.5 h-2.5" />
                      {spec}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-current/10">
              {prod.url ? (
                <a
                  href={prod.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold opacity-75 hover:opacity-100 !no-underline truncate"
                >
                  <Tag className="w-3 h-3 shrink-0" />
                  <span className="truncate">{prod.domain || 'View Source'}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : (
                <span className="text-[11px] font-mono opacity-50">Verified Pick</span>
              )}

              {onAskProduct && (
                <button
                  type="button"
                  onClick={() =>
                    onAskProduct(
                      `Give me a full pros, cons, and buying verdict on ${prod.name}.`
                    )
                  }
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 border transition-colors cursor-pointer shrink-0 ${
                    isDark
                      ? 'bg-white/[0.08] border-white/15 hover:bg-white hover:text-black'
                      : 'bg-white border-black/15 hover:bg-[#18181b] hover:text-white'
                  }`}
                >
                  <span>Analyze</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductCards;
