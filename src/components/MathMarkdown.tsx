import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PrismCodeBlock } from './PrismCodeBlock';
import { PeleDiagram } from './PeleDiagram';

/**
 * Normalizes LaTeX / KaTeX math delimiters in AI responses and study documents
 * so that remark-math + rehype-katex reliably parse both inline ($...$) and
 * block ($$...$$) equations without corrupting fenced or inline code blocks.
 */
export function normalizeMathDelimiters(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  // Split by fenced code blocks (```...```) and inline code (`...`) so code is never touched
  const segments = raw.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  return segments
    .map((segment) => {
      if (segment.startsWith('```') || segment.startsWith('`')) {
        return segment;
      }

      let s = segment;

      // 1. Convert \[ ... \] display math to $$ ... $$
      s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `\n$$\n${inner.trim()}\n$$\n`);

      // 2. Convert \( ... \) inline math to $$ ... $$ (since singleDollarTextMath is disabled)
      s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$$${inner.trim()}$$`);

      // 3. Wrap standalone \begin{equation|align|aligned|gather|pmatrix|bmatrix|matrix|cases}...\end{...}
      // blocks that are not already inside $$...$$
      s = s.replace(
        /(^|[^$])\\begin\{(equation\*?|align\*?|aligned|gather\*?|cases|pmatrix|bmatrix|vmatrix|matrix)\}([\s\S]*?)\\end\{\2\}(?!\$)/gm,
        (_, prefix, env, body) => `${prefix}\n$$\n\\begin{${env}}${body}\\end{${env}}\n$$\n`
      );

      // 4. Upgrade unambiguous single-$ LaTeX expressions (containing \command, ^, or _) to $$...$$
      // while NEVER matching currency amounts like "$20 per month. Claude Pro costs $20"
      s = s.replace(/(?<!\$)\$(?!\$)([^\$\n]{1,120}?)\$(?!\$)/g, (full, inner) => {
        const trimmed = inner.trim();
        // Never treat currency/price spans starting with a digit followed by space/words or ending with a digit as math
        if (/^\d+(?:[.,]\d+)?(?:\s|$|[a-zA-Z]{2,})/.test(trimmed)) {
          return full;
        }
        // Only upgrade if it contains explicit LaTeX commands (\frac, \alpha, etc.) or math scripts (^, _) without prose sentences
        const hasLatexCommand = /\\[a-zA-Z]{2,}/.test(trimmed);
        const hasMathScript = /[\^_]/.test(trimmed) && !/\s{1}[a-zA-Z]{4,}\s+[a-zA-Z]{4,}/.test(trimmed);
        if (hasLatexCommand || hasMathScript) {
          return `$$${trimmed}$$`;
        }
        return full;
      });

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
          remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
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
              return <PrismCodeBlock code={codeText} language={lang || 'text'} isDark={isDark} />;
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
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
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
              return <PeleDiagram code={codeText} isDark={isDark} />;
            }

            return <PrismCodeBlock code={codeText} language={lang || 'text'} isDark={isDark} />;
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
