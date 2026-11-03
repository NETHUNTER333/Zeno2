import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
  preprocessMessageContent,
  renumberCitationsByFirstAppearance,
} from '../../lib/citationParser';
import { WebSearchCitation } from '../ui/web-search';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runCitationChipUnitTests(): void {
  const sampleSources = [
    {
      position: 1,
      title: 'OpenAI and Anthropic announce developer updates',
      url: 'https://www.theverge.com/2026/11/02/ai-news-updates',
      snippet:
        'Major AI labs released updated developer tooling, open-weight evaluation benchmarks, and safety guardrails this week across enterprise deployments.',
      domain: 'theverge.com',
    },
    {
      position: 2,
      title: 'Best Student Laptops Tested for 2026',
      url: 'https://arstechnica.com/gadgets/2026/10/best-laptops-students/',
      snippet:
        'Our hardware team tested battery life, keyboard comfort, and compile performance across MacBook Air M4, Lenovo ThinkPad, and Asus Zenbook models.',
      domain: 'arstechnica.com',
    },
  ];

  // Test 1: "Text [1]." must render one chip (<button type="button" aria-label="Source 1: ...">)
  const rawInput = 'Text [1].';
  const { content: renumbered, sources: ordered } = renumberCitationsByFirstAppearance(
    rawInput,
    sampleSources
  );
  const processed = preprocessMessageContent(renumbered);
  assert(
    processed.includes('[1](#cite-1)'),
    `Expected preprocessMessageContent("Text [1].") to contain [1](#cite-1), got: ${processed}`
  );

  const html = renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        a: ({ href, children }) => {
          const hrefMatch = href ? href.match(/^#cite-(\d+)$/) : null;
          if (hrefMatch) {
            const num = parseInt(hrefMatch[1], 10);
            const src = ordered.find((s, i) => (s.position || i + 1) === num) || ordered[num - 1];
            if (src) {
              return <WebSearchCitation source={src} index={num} />;
            }
          }
          return <a href={href}>{children}</a>;
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  );

  const chipCount = (html.match(/data-slot="web-search-citation"/g) || []).length;
  assert(chipCount === 1, `Expected "Text [1]." to render exactly 1 citation chip, got ${chipCount}`);
  assert(
    html.includes('<button type="button"') &&
      html.includes('aria-label="Source 1: OpenAI and Anthropic announce developer updates"'),
    `Expected chip to be a <button type="button" aria-label="Source 1: ...">, got: ${html}`
  );

  // Test 2: First-appearance renumbering ([2] then [1] -> renumbered to [1] then [2])
  const outOfOrder = 'First claim from second card [2]. Second claim from first card [1].';
  const renumResult = renumberCitationsByFirstAppearance(outOfOrder, sampleSources);
  assert(
    renumResult.content === 'First claim from second card [1]. Second claim from first card [2].',
    `Expected citations to renumber by first appearance, got: ${renumResult.content}`
  );
  assert(
    renumResult.sources[0].url === sampleSources[1].url && renumResult.sources[0].position === 1,
    'Expected first card to be reordered to match [1]'
  );
  assert(
    renumResult.sources[1].url === sampleSources[0].url && renumResult.sources[1].position === 2,
    'Expected second card to be reordered to match [2]'
  );

  // Test 3: Markdown bold bullets with inline citations render chips without stripping
  const bulletMarkdown =
    '- **Developer Tooling** (*theverge.com*): New SDKs launched this week [1].\n- **Hardware Benchmarks** (*arstechnica.com*): M4 leads battery tests [2].';
  const bulletHtml = renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        a: ({ href, children }) => {
          const hrefMatch = href ? href.match(/^#cite-(\d+)$/) : null;
          if (hrefMatch) {
            const num = parseInt(hrefMatch[1], 10);
            const src = sampleSources[num - 1];
            if (src) {
              return <WebSearchCitation source={src} index={num} />;
            }
          }
          return <a href={href}>{children}</a>;
        },
      }}
    >
      {preprocessMessageContent(bulletMarkdown)}
    </ReactMarkdown>
  );
  const bulletChips = (bulletHtml.match(/data-slot="web-search-citation"/g) || []).length;
  assert(bulletChips === 2, `Expected 2 citation chips in bullet markdown, got ${bulletChips}`);
}

runCitationChipUnitTests();
console.log('PASS: citationChipRender unit tests passed (Text [1]. renders 1 button chip, first-appearance renumbering, and markdown bullet chips).');
