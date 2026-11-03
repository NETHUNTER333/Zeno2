import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// @ts-expect-error jsdom does not ship bundled types in this workspace
import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
  preprocessMessageContent,
  renumberCitationsByFirstAppearance,
} from '../src/components/GrokChatMessage';
import { WebSearch, WebSearchCitation } from '../src/components/ui/web-search';
import {
  buildDatedNewsSearchQuery,
  isFinanceOrStockPage,
  isNewsSearchQuery,
  isPreferredNewsOutlet,
  scoreSourceRelevanceToQuery,
} from '../server/searchProviders';

describe('Normal Search Fixes (FIX 1, FIX 2, FIX 3)', () => {
  it('FIX 2: A response containing "Text [1]." renders exactly one inline citation chip <button>', () => {
    const sources = [
      {
        position: 1,
        title: 'Reuters AI Weekly Briefing',
        url: 'https://www.reuters.com/technology/artificial-intelligence/ai-weekly-2026/',
        snippet:
          'Reuters coverage of artificial intelligence breakthroughs, frontier model releases, and enterprise developer adoption across the industry this week.',
        domain: 'reuters.com',
      },
    ];

    const { content: renumberedText, sources: orderedSources } =
      renumberCitationsByFirstAppearance('Text [1].', sources);
    const processed = preprocessMessageContent(renumberedText);

    const html = renderToStaticMarkup(
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a: ({ href, children }) => {
            const citeMatch = href?.match(/^#cite-(\d+)$/);
            if (citeMatch) {
              const num = parseInt(citeMatch[1], 10);
              const src = orderedSources[num - 1];
              return <WebSearchCitation source={src} index={num} />;
            }
            return <a href={href}>{children}</a>;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    );

    const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
    const buttons = dom.window.document.querySelectorAll('button.citation-badge');
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute('type')).toBe('button');
    expect(buttons[0].getAttribute('aria-label')).toBe(
      'Source 1: Reuters AI Weekly Briefing'
    );
    expect(buttons[0].textContent).toContain('1');
  });

  it('FIX 2: Numbers citations by first appearance (1, 2, 3...) and reorders source cards to match while allowing number reuse', () => {
    const rawSources = [
      { position: 1, title: 'First Card', url: 'https://theverge.com/1', snippet: 'A' },
      { position: 2, title: 'Second Card', url: 'https://techcrunch.com/2', snippet: 'B' },
      { position: 3, title: 'Third Card', url: 'https://arstechnica.com/3', snippet: 'C' },
    ];
    const input = 'Point from third [3]. Point from first [1]. Another from third [3]. Point from second [2].';
    const result = renumberCitationsByFirstAppearance(input, rawSources);

    expect(result.content).toBe(
      'Point from third [1]. Point from first [2]. Another from third [1]. Point from second [3].'
    );
    expect(result.sources.map((s) => s.title)).toEqual([
      'Third Card',
      'First Card',
      'Second Card',
    ]);
    expect(result.sources.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it('FIX 1: Clicking chip 2 targets src-{messageId}-2 in the same message, expands if collapsed, scrolls to center, and highlights for 2s', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost:3000/',
    });
    const prevWindow = globalThis.window;
    const prevDocument = globalThis.document;
    const prevCustomEvent = globalThis.CustomEvent;
    const prevHTMLElement = globalThis.HTMLElement;

    globalThis.window = dom.window as any;
    globalThis.document = dom.window.document;
    globalThis.CustomEvent = dom.window.CustomEvent as any;
    globalThis.HTMLElement = dom.window.HTMLElement as any;

    try {
      vi.useFakeTimers();
      const sources = [
        {
          id: 's1',
          position: 1,
          title: 'MacBook Air M4 Review for Students',
          url: 'https://www.theverge.com/laptops/macbook-air',
          domain: 'theverge.com',
          snippet: 'Comprehensive student laptop review covering battery life and M4 performance.',
        },
        {
          id: 's2',
          position: 2,
          title: 'Framework Laptop 13 Student Guide 2026',
          url: 'https://arstechnica.com/gadgets/framework-13',
          domain: 'arstechnica.com',
          snippet: 'Repairable, modular student laptop with Linux and Windows support.',
        },
        {
          id: 's3',
          position: 3,
          title: 'ASUS Zenbook 14 OLED Review',
          url: 'https://techcrunch.com/asus-zenbook-14',
          domain: 'techcrunch.com',
          snippet: 'Lightweight OLED laptop with all-day battery for college workloads.',
        },
        {
          id: 's4',
          position: 4,
          title: 'Dell XPS 13 Copilot+ PC Review',
          url: 'https://wired.com/dell-xps-13',
          domain: 'wired.com',
          snippet: 'Snapdragon X Elite laptop tested for student software and battery life.',
        },
      ];

      const container = dom.window.document.getElementById('root')!;
      const root = createRoot(container);
      const testMsgId = 'msg-qa-123';

      await act(async () => {
        root.render(
          <div>
            <WebSearch messageId={testMsgId} sources={sources} status="done" defaultOpen={true} />
            <p>
              Best laptops include MacBook Air <WebSearchCitation messageId={testMsgId} source={sources[0]} index={1} /> and
              Framework 13 <WebSearchCitation messageId={testMsgId} source={sources[1]} index={2} /> and
              Dell XPS 13 <WebSearchCitation messageId={testMsgId} source={sources[3]} index={4} />.
            </p>
          </div>
        );
      });

      // Card 2 must have id="src-{messageId}-2"
      const card2 = dom.window.document.getElementById(`src-${testMsgId}-2`) as HTMLAnchorElement;
      expect(card2).toBeTruthy();
      expect(card2.tagName).toBe('A');
      expect(card2.getAttribute('target')).toBe('_blank');

      const scrollSpy = vi.fn();
      card2.scrollIntoView = scrollSpy;

      const chipButtons = Array.from(
        dom.window.document.querySelectorAll('button.citation-badge')
      );
      expect(chipButtons.length).toBe(3);
      const chip2 = chipButtons[1] as HTMLButtonElement;
      expect(chip2.getAttribute('aria-label')).toBe(
        'Source 2: Framework Laptop 13 Student Guide 2026'
      );

      await act(async () => {
        chip2.click();
        vi.advanceTimersByTime(100);
      });

      expect(scrollSpy).toHaveBeenCalledWith(
        expect.objectContaining({ block: 'center' })
      );
      expect(card2.className).toContain('!border-[#FC4C01]');
      expect(card2.className).toContain('ring-[#FC4C01]');

      // After 2 seconds (2000ms), highlight ring clears automatically
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(card2.className).not.toContain('!border-[#FC4C01]');

      await act(async () => {
        root.unmount();
      });
    } finally {
      vi.useRealTimers();
      globalThis.window = prevWindow;
      globalThis.document = prevDocument;
      globalThis.CustomEvent = prevCustomEvent;
      globalThis.HTMLElement = prevHTMLElement;
    }
  });

  it('FIX 2: News queries rewrite query with current month/year and down-rank finance domains unless query mentions earnings/stocks', () => {
    expect(isNewsSearchQuery('AI news this week')).toBe(true);
    expect(isNewsSearchQuery('OpenAI announced new model')).toBe(true);
    const datedQuery = buildDatedNewsSearchQuery('AI news this week');
    expect(datedQuery).toContain('artificial intelligence news');
    expect(datedQuery).toMatch(/202\d/);

    const zacksCard = {
      title: 'Zacks Earnings Preview: Top AI Stocks to Buy Now (NVDA)',
      url: 'https://www.zacks.com/stock/news/23456/ai-stocks',
      snippet: 'Wall Street analysts raise price targets and EPS guidance ahead of Q3 earnings call.',
      domain: 'zacks.com',
    };
    const seekingAlphaCard = {
      title: 'Seeking Alpha: Why AI Semiconductor Valuations Are Surging',
      url: 'https://seekingalpha.com/article/470000-ai-stocks',
      snippet: 'Dividend yield and P/E ratio analysis for AI stock investors.',
      domain: 'seekingalpha.com',
    };
    const ibdCard = {
      title: 'Investor\'s Business Daily: Nvidia Stock Rallies as AI Demand Surges',
      url: 'https://www.investors.com/news/technology/nvidia-stock-ai-earnings/',
      snippet: 'IBD stock rating and price target analysis for semiconductor leaders.',
      domain: 'investors.com',
    };
    const vergeNewsCard = {
      title: 'OpenAI and Anthropic announce new developer tooling this week',
      url: 'https://www.theverge.com/ai-artificial-intelligence/2026/11/ai-news-roundup',
      snippet: 'Major AI news this week includes new open-source developer APIs and safety evaluations.',
      domain: 'theverge.com',
    };

    expect(isFinanceOrStockPage(zacksCard)).toBe(true);
    expect(isFinanceOrStockPage(seekingAlphaCard)).toBe(true);
    expect(isFinanceOrStockPage(ibdCard)).toBe(true);
    expect(isFinanceOrStockPage(vergeNewsCard)).toBe(false);
    expect(isPreferredNewsOutlet(vergeNewsCard)).toBe(true);

    // On non-finance query "AI news this week", finance domains are down-ranked
    expect(scoreSourceRelevanceToQuery(zacksCard, 'AI news this week')).toBeLessThan(0);
    expect(scoreSourceRelevanceToQuery(seekingAlphaCard, 'AI news this week')).toBeLessThan(0);
    expect(scoreSourceRelevanceToQuery(ibdCard, 'AI news this week')).toBeLessThan(0);
    expect(scoreSourceRelevanceToQuery(vergeNewsCard, 'AI news this week')).toBeGreaterThan(10);

    // On finance query "Nvidia earnings this week", finance sources are allowed (NOT down-ranked)
    expect(scoreSourceRelevanceToQuery(ibdCard, 'Nvidia earnings this week')).toBeGreaterThanOrEqual(1.0);
    expect(scoreSourceRelevanceToQuery(zacksCard, 'Nvidia earnings this week')).toBeGreaterThanOrEqual(1.0);
  });
});
