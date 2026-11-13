import React, { Suspense, lazy } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CodeBlockSkeleton } from './Skeleton';

const PeleDiagram = lazy(() =>
  import('./PeleDiagram').then((m) => ({ default: m.PeleDiagram }))
);
const PrismCodeBlock = lazy(() =>
  import('./PrismCodeBlock').then((m) => ({ default: m.PrismCodeBlock }))
);

const NAMED_OR_NUMERIC_ENTITY_RE =
  /&(?:amp|apos|quot|nbsp|rsquo|lsquo|ldquo|rdquo|ndash|mdash|#0*(?:34|38|39|160|8211|8212|8216|8217|8220|8221)|#x0*(?:22|26|27|a0|2013|2014|2018|2019|201c|201d)|#(\d+)|#x([0-9a-fA-F]+));/gi;

function decodeSafeEntitiesOnce(text: string): string {
  return text.replace(NAMED_OR_NUMERIC_ENTITY_RE, (full, decGroup, hexGroup) => {
    const lower = full.toLowerCase();
    if (lower === '&amp;' || lower === '&#38;' || lower === '&#x26;') return '&';
    if (
      lower === '&apos;' ||
      lower === '&rsquo;' ||
      lower === '&lsquo;' ||
      lower === '&#39;' ||
      lower === '&#039;' ||
      lower === '&#x27;' ||
      lower === '&#8216;' ||
      lower === '&#8217;' ||
      lower === '&#x2018;' ||
      lower === '&#x2019;'
    ) {
      return "'";
    }
    if (
      lower === '&quot;' ||
      lower === '&ldquo;' ||
      lower === '&rdquo;' ||
      lower === '&#34;' ||
      lower === '&#x22;' ||
      lower === '&#8220;' ||
      lower === '&#8221;' ||
      lower === '&#x201c;' ||
      lower === '&#x201d;'
    ) {
      return '"';
    }
    if (lower === '&nbsp;' || lower === '&#160;' || lower === '&#xa0;') return ' ';
    if (lower === '&ndash;' || lower === '&#8211;' || lower === '&#x2013;') return '–';
    if (lower === '&mdash;' || lower === '&#8212;' || lower === '&#x2014;') return '—';

    const code = decGroup
      ? parseInt(decGroup, 10)
      : hexGroup
      ? parseInt(hexGroup, 16)
      : NaN;
    // Never decode < (60) or > (62) in markdown prose so rehypeRaw cannot interpret literal escaped tags as HTML
    if (!Number.isFinite(code) || code === 60 || code === 62 || code < 32 || code > 0x10ffff) {
      return full;
    }
    try {
      return String.fromCodePoint(code);
    } catch {
      return full;
    }
  });
}

/**
 * Single canonical render-layer normalizer for HTML entities, escaped Unicode quotes,
 * and apostrophes outside fenced/inline code blocks.
 */
export function normalizeDisplayText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  const segments = raw.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return segments
    .map((segment) => {
      if (segment.startsWith('```') || segment.startsWith('`')) {
        return segment;
      }

      let s = segment
        .replace(/\\u0027/gi, "'")
        .replace(/\\u0026/gi, '&')
        .replace(/\\u0022/gi, '"')
        .replace(/\\u2018|\\u2019/gi, "'")
        .replace(/\\u201c|\\u201d/gi, '"');

      // Up to 3 bounded passes unwind double-escaped entities like &amp;#39; -> &#39; -> '
      for (let pass = 0; pass < 3; pass++) {
        const next = decodeSafeEntitiesOnce(s);
        if (next === s) break;
        s = next;
      }

      return s
        .replace(/[\u2018\u2019\u02BC]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .normalize('NFC');
    })
    .join('');
}

/**
 * Normalizes LaTeX / KaTeX math delimiters in AI responses and study documents
 * so that remark-math + rehype-katex reliably parse both inline ($...$) and
 * block ($$...$$) equations without corrupting fenced or inline code blocks.
 */
export function normalizeMathDelimiters(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  const cleanRaw = normalizeDisplayText(raw);

  // Split by fenced code blocks (```...```) and inline code (`...`) so code is never touched
  const segments = cleanRaw.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  return segments
    .map((segment) => {
      if (segment.startsWith('```') || segment.startsWith('`')) {
        return segment;
      }

      let s = segment;

      // 1. Convert \[ ... \] display math to $$ ... $$
      s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `\n$$\n${inner.trim()}\n$$\n`);

      // 2. Convert \( ... \) inline math to $ ... $
      s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner.trim()}$`);

      // 3. Wrap standalone \begin{equation|align|aligned|gather|pmatrix|bmatrix|matrix|cases}...\end{...}
      // blocks that are not already inside $$...$$
      s = s.replace(
        /(^|[^$])\\begin\{(equation\*?|align\*?|aligned|gather\*?|cases|pmatrix|bmatrix|vmatrix|matrix)\}([\s\S]*?)\\end\{\2\}(?!\$)/gm,
        (_, prefix, env, body) => `${prefix}\n$$\n\\begin{${env}}${body}\\end{${env}}\n$$\n`
      );

      return s;
    })
    .join('');
}

export interface MathMarkdownProps {
  content: string;
  isDark?: boolean;
  inline?: boolean;
  className?: string;
}

/**
 * Reusable KaTeX + Markdown renderer with clean typography, horizontal overflow protection
 * for wide equations, and support for both block and inline rendering.
 */
export const MathMarkdown: React.FC<MathMarkdownProps> = ({
  content,
  isDark = false,
  inline = false,
  className = '',
}) => {
  const normalized = React.useMemo(() => normalizeMathDelimiters(content), [content]);

  if (!normalized) return null;

  if (inline) {
    return (
      <span className={`katex-markdown-body inline [&>p]:inline [&>p]:m-0 ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, output: 'htmlAndMathml' }]]}
          components={{
            p: ({ children }) => <span className="leading-relaxed">{children}</span>,
            pre: ({ children }) => {
              const childArray = React.Children.toArray(children);
              const codeChild = childArray[0] as React.ReactElement<{
                className?: string;
                children?: React.ReactNode;
              }>;
              const rawClass = codeChild?.props?.className || '';
              const langMatch = /language-([\w-]+)/.exec(rawClass);
              const lang = (langMatch ? langMatch[1] : '').toLowerCase();
              const codeText = String(codeChild?.props?.children || '').replace(/\n$/, '');
              return (
                <Suspense fallback={<CodeBlockSkeleton isDark={isDark} />}>
                  <PrismCodeBlock code={codeText} language={lang || 'text'} isDark={isDark} />
                </Suspense>
              );
            },
            code: ({ className: codeClassName, children, ...props }) => {
              const isBlock = Boolean(codeClassName && /language-/.test(codeClassName));
              if (isBlock) {
                return <code className={codeClassName} {...props}>{children}</code>;
              }
              return (
                <code
                  className={`px-1.5 py-0.5 rounded-md font-mono text-[0.86em] transition-colors ${
                    isDark
                      ? 'bg-white/[0.07] text-[#ececf1] border border-white/[0.08]'
                      : 'bg-black/[0.045] text-[#141416] border border-black/[0.07]'
                  }`}
                  {...props}
                >
                  {children}
                </code>
              );
            },
          }}
        >
          {normalized}
        </ReactMarkdown>
      </span>
    );
  }

  return (
    <div
      className={`katex-markdown-body space-y-2.5 ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, output: 'htmlAndMathml' }]]}
        components={{
          p: ({ children }) => <p className="leading-[1.68] last:mb-0">{children}</p>,
          pre: ({ children }) => {
            const childArray = React.Children.toArray(children);
            const codeChild = childArray[0] as React.ReactElement<{
              className?: string;
              children?: React.ReactNode;
            }>;
            const rawClass = codeChild?.props?.className || '';
            const langMatch = /language-([\w-]+)/.exec(rawClass);
            const lang = (langMatch ? langMatch[1] : '').toLowerCase();
            const codeText = String(codeChild?.props?.children || '').replace(/\n$/, '');

            if (
              lang === 'diagram' ||
              lang === 'pele-diagram' ||
              lang === 'mermaid' ||
              lang === 'flowchart'
            ) {
              return (
                <Suspense fallback={<CodeBlockSkeleton isDark={isDark} />}>
                  <PeleDiagram code={codeText} isDark={isDark} />
                </Suspense>
              );
            }

            return (
              <Suspense fallback={<CodeBlockSkeleton isDark={isDark} />}>
                <PrismCodeBlock code={codeText} language={lang || 'text'} isDark={isDark} />
              </Suspense>
            );
          },
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock = Boolean(codeClassName && /language-/.test(codeClassName));
            if (isBlock) {
              return (
                <code className={codeClassName} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`px-1.5 py-0.5 rounded-md font-mono text-[0.86em] transition-colors ${
                  isDark
                    ? 'bg-white/[0.07] text-[#ececf1] border border-white/[0.08]'
                    : 'bg-black/[0.045] text-[#141416] border border-black/[0.07]'
                }`}
                {...props}
              >
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div
              className={`my-3 w-full overflow-x-auto rounded-xl border ${
                isDark ? 'border-white/[0.08] bg-[#141416]' : 'border-black/[0.07] bg-white'
              }`}
            >
              <table className="w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th
              className={`px-3 py-2 font-semibold border-b text-[12px] ${
                isDark
                  ? 'border-white/[0.08] bg-white/[0.03] text-[#ececf1]'
                  : 'border-black/[0.07] bg-[#f7f7f8] text-[#111111]'
              }`}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className={`px-3 py-2 border-b text-[12.5px] ${
                isDark ? 'border-white/[0.05] text-[#d1d1d6]' : 'border-black/[0.05] text-[#2c2c30]'
              }`}
            >
              {children}
            </td>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
};

export default MathMarkdown;
