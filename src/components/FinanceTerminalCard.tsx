import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, BarChart3 } from 'lucide-react';
import { FinanceQuote } from '../types';
import { generateDeterministicSparkline, fetchLiveFinanceQuoteClient } from '../lib/financeMarket';

interface FinanceTerminalCardProps {
  quote: FinanceQuote;
  isDark?: boolean;
  onAskZeno?: (prompt: string) => void;
}

export const FinanceTerminalCard: React.FC<FinanceTerminalCardProps> = ({
  quote: initialQuote,
  isDark = true,
  onAskZeno,
}) => {
  const [quote, setQuote] = useState<FinanceQuote>(initialQuote);
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1D');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const series = useMemo(() => {
    if (timeframe === '1D' && quote.sparkline && quote.sparkline.length > 4) {
      return quote.sparkline;
    }
    return generateDeterministicSparkline(
      quote.symbol,
      quote.price,
      quote.changePercent,
      36,
      timeframe
    );
  }, [quote, timeframe]);

  const firstPrice = series[0]?.price || quote.price;
  const lastPrice = series[series.length - 1]?.price || quote.price;
  const activePoint = hoverIndex !== null && series[hoverIndex] ? series[hoverIndex] : null;
  const displayedPrice = activePoint ? activePoint.price : quote.price;

  const periodDelta = displayedPrice - firstPrice;
  const periodPct = firstPrice > 0 ? (periodDelta / firstPrice) * 100 : quote.changePercent;
  const isPositive = timeframe === '1D' && !activePoint ? quote.change >= 0 : periodDelta >= 0;

  const formatUsd = (val: number) => {
    if (val < 1) return `$${val.toFixed(4)}`;
    if (val >= 1000) return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${val.toFixed(2)}`;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated = await fetchLiveFinanceQuoteClient(quote.symbol);
      setQuote(updated);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Compute SVG path coordinates
  const svgWidth = 600;
  const svgHeight = 148;
  const padX = 8;
  const padY = 14;

  const prices = series.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceSpan = Math.max(maxPrice - minPrice, maxPrice * 0.005, 0.0001);

  const coords = series.map((pt, idx) => {
    const x = padX + (idx / Math.max(1, series.length - 1)) * (svgWidth - padX * 2);
    const y =
      svgHeight -
      padY -
      ((pt.price - minPrice) / priceSpan) * (svgHeight - padY * 2);
    return { x, y, ...pt };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length > 1
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${svgHeight} L${coords[0].x.toFixed(1)},${svgHeight} Z`
      : '';

  const strokeColor = isPositive ? '#16A34A' : '#DC2626';
  const gradientId = `grad-${quote.symbol}-${timeframe}`;

  return (
    <div
      className={`my-3 rounded-xl border p-4 transition-colors select-none ${
        isDark
          ? 'bg-[#0b0d11] border-[#1f242d] text-[#f1f5f9]'
          : 'bg-[#ffffff] border-[#e2e8f0] text-[#0f172a]'
      }`}
    >
      {/* Top Row: Asset Identity + Timeframe Segmented Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
            <span className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>
              {quote.assetType === 'stock' ? `$${quote.symbol}` : quote.symbol}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-sans">{quote.name}</span>
            <span aria-hidden="true">·</span>
            <span>{quote.exchange || (quote.assetType === 'crypto' ? 'CRYPTO' : 'NASDAQ')}</span>
          </div>

          {/* Price & Change Display */}
          <div className="mt-1.5 flex items-baseline gap-3 font-mono tabular-nums">
            <span className="text-2xl font-bold tracking-tight">
              {formatUsd(displayedPrice)}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                isPositive ? 'text-[#16A34A]' : 'text-[#DC2626]'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {isPositive ? '+' : ''}
                {timeframe === '1D' && !activePoint
                  ? quote.change.toFixed(quote.price < 1 ? 4 : 2)
                  : periodDelta.toFixed(quote.price < 1 ? 4 : 2)}{' '}
                ({isPositive ? '+' : ''}
                {(timeframe === '1D' && !activePoint ? quote.changePercent : periodPct).toFixed(2)}%)
              </span>
            </span>
            {activePoint && (
              <span className="text-[11px] text-neutral-500 font-mono">
                {activePoint.time}
              </span>
            )}
          </div>
        </div>

        {/* Interactive Timeframe Filter Controls + Refresh */}
        <div className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-0.5 p-1 rounded-lg border ${
              isDark ? 'bg-[#131720] border-[#222834]' : 'bg-slate-100 border-slate-200'
            }`}
          >
            {(['1D', '1W', '1M', '1Y'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => {
                  setTimeframe(tf);
                  setHoverIndex(null);
                }}
                className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  timeframe === tf
                    ? isDark
                      ? 'bg-white text-black'
                      : 'bg-slate-900 text-white'
                    : isDark
                    ? 'text-neutral-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#131720] border-[#222834] text-neutral-400 hover:text-white'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="Refresh live quote"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Interactive SVG Price Chart */}
      <div
        className="relative w-full h-36 mt-3 cursor-crosshair"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const idx = Math.round(relX * (series.length - 1));
          setHoverIndex(idx);
        }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.26" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Subtle horizontal reference lines */}
          {[0.25, 0.5, 0.75].map((ratio, i) => (
            <line
              key={i}
              x1={padX}
              x2={svgWidth - padX}
              y1={svgHeight * ratio}
              y2={svgHeight * ratio}
              stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          ))}

          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Active hover crosshair & point */}
          {hoverIndex !== null && coords[hoverIndex] && (
            <>
              <line
                x1={coords[hoverIndex].x}
                x2={coords[hoverIndex].x}
                y1={0}
                y2={svgHeight}
                stroke={isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.28)'}
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <circle
                cx={coords[hoverIndex].x}
                cy={coords[hoverIndex].y}
                r="4.5"
                fill={strokeColor}
                stroke={isDark ? '#0b0d11' : '#ffffff'}
                strokeWidth="2"
              />
            </>
          )}
        </svg>

        {/* High / Low Chart Labels */}
        <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-neutral-500 mt-0.5">
          <span>Low: {formatUsd(minPrice)}</span>
          <span>{timeframe} Range</span>
          <span>High: {formatUsd(maxPrice)}</span>
        </div>
      </div>

      {/* 4-Column Tabular Key Stats Strip */}
      <div
        className={`mt-4 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs ${
          isDark ? 'border-[#1f242d]' : 'border-slate-200'
        }`}
      >
        <div>
          <div className="text-[11px] text-neutral-500">Market Cap</div>
          <div className="font-mono tabular-nums font-semibold mt-0.5">
            {quote.marketCap || '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-neutral-500">24h Volume</div>
          <div className="font-mono tabular-nums font-semibold mt-0.5">
            {quote.volume24h || '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-neutral-500">24h High / Low</div>
          <div className="font-mono tabular-nums font-semibold mt-0.5">
            {formatUsd(quote.high24h)} / {formatUsd(quote.low24h)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-neutral-500">52W High / Low</div>
          <div className="font-mono tabular-nums font-semibold mt-0.5">
            {quote.high52w ? formatUsd(quote.high52w) : '—'} /{' '}
            {quote.low52w ? formatUsd(quote.low52w) : '—'}
          </div>
        </div>
      </div>

      {/* Footer Action Bar */}
      {onAskZeno && (
        <div
          className={`mt-3 pt-2.5 border-t flex items-center justify-between gap-2 text-xs ${
            isDark ? 'border-[#1f242d]' : 'border-slate-200'
          }`}
        >
          <span className="text-[11px] text-neutral-500 font-mono">
            Updated {new Date(quote.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onAskZeno(
                  `Provide a deep fundamental, technical, and catalyst analysis for ${quote.name} (${quote.symbol}) currently trading around ${formatUsd(quote.price)}.`
                )
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isDark
                  ? 'bg-white/10 hover:bg-white/15 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analyze Fundamentals & Catalysts</span>
              <ArrowUpRight className="w-3 h-3 opacity-70" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
