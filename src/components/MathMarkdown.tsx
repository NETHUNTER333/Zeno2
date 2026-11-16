import React, { Suspense, lazy } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CodeBlockSkeleton } from './Skeleton';
import {
  STEM_KATEX_MACROS,
  normalizeDisplayText,
  normalizeMathDelimiters,
  renderLatexToHtml,
  renderMixedTextWithKatexHtml,
} from '../lib/latexEngine';

export { normalizeDisplayText, normalizeMathDelimiters };

const PeleDiagram = lazy(() =>
  import('./PeleDiagram').then((m) => ({ default: m.PeleDiagram }))
);
const PrismCodeBlock = lazy(() =>
  import('./PrismCodeBlock').then((m) => ({ default: m.PrismCodeBlock }))
);

export interface MathMarkdownProps {
  content: string;
  isDark?: boolean;
  inline?: boolean;
  autoDetectLatex?: boolean;
  className?: string;
}

const KATEX_PLUGIN_OPTIONS = {
  throwOnError: false,
  strict: false,
  trust: false,
  output: 'htmlAndMathml' as const,
  macros: STEM_KATEX_MACROS,
};

/**
 * Reusable KaTeX + mhchem + Markdown renderer with clean typography,
 * STEM macros, currency protection, and horizontal overflow scrolling for equations.
 */
export const MathMarkdown: React.FC<MathMarkdownProps> = ({
  content,
  isDark = false,
  inline = false,
  autoDetectLatex = false,
  className = '',
}) => {
  const normalized = React.useMemo(
    () => normalizeMathDelimiters(content, { autoDetectLatex }),
    [content, autoDetectLatex]
  );

  if (!normalized) return null;

  if (inline) {
    return (
      <span className={`katex-markdown-body inline [&>p]:inline [&>p]:m-0 ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
          rehypePlugins={[[rehypeKatex, KATEX_PLUGIN_OPTIONS]]}
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
          }}
        >
          {normalized}
        </ReactMarkdown>
      </span>
    );
  }

  return (
    <div className={`katex-markdown-body space-y-2.5 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, KATEX_PLUGIN_OPTIONS]]}
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

export interface MathTextProps {
  text: string;
  className?: string;
  autoDetectLatex?: boolean;
}

/**
 * Lightweight synchronous inline KaTeX + prose renderer for quiz options, flashcards,
 * headings, rubrics, and tooltips without full Markdown block overhead.
 */
export const MathText: React.FC<MathTextProps> = ({
  text,
  className = '',
  autoDetectLatex = true,
}) => {
  const html = React.useMemo(
    () => renderMixedTextWithKatexHtml(text, { autoDetectLatex }),
    [text, autoDetectLatex]
  );
  if (!html) return null;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

export interface MathFormulaProps {
  formula: string;
  displayMode?: boolean;
  className?: string;
}

/**
 * Direct KaTeX + mhchem renderer for standalone formula strings (with or without $ delimiters).
 */
export const MathFormula: React.FC<MathFormulaProps> = ({
  formula,
  displayMode = false,
  className = '',
}) => {
  const html = React.useMemo(
    () => renderLatexToHtml(formula, displayMode),
    [formula, displayMode]
  );
  if (!html) return null;
  if (displayMode) {
    return (
      <div
        className={`katex-formula-strip ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

export interface SvgLatexProps {
  text: string;
  autoDetectLatex?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders rich KaTeX / mhchem notation inside SVG <foreignObject xmlns="http://www.w3.org/1999/xhtml">.
 */
export const SvgLatex: React.FC<SvgLatexProps> = ({
  text,
  autoDetectLatex = true,
  className = '',
  style,
}) => {
  const html = React.useMemo(
    () => renderMixedTextWithKatexHtml(text, { autoDetectLatex }),
    [text, autoDetectLatex]
  );
  if (!html) return null;
  return (
    <div
      className={`katex-svg-node ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MathMarkdown;
