import React, { useState, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-graphql';
import { Copy, Check, Download, Terminal, Code2, WrapText, Hash } from 'lucide-react';

export interface PrismCodeBlockProps {
  language?: string;
  code: string;
  isDark?: boolean;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  py: 'python',
  python3: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  terminal: 'bash',
  yml: 'yaml',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  svelte: 'markup',
  md: 'markdown',
  cs: 'csharp',
  dotnet: 'csharp',
  'c++': 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  golang: 'go',
  rs: 'rust',
  rb: 'ruby',
  kt: 'kotlin',
  kts: 'kotlin',
  dockerfile: 'docker',
  gql: 'graphql',
  psql: 'sql',
  postgres: 'sql',
  mysql: 'sql',
  sqlite: 'sql',
  jsonc: 'json',
  json5: 'json',
};

const LANGUAGE_LABELS: Record<string, { label: string; ext: string }> = {
  javascript: { label: 'JavaScript', ext: 'js' },
  typescript: { label: 'TypeScript', ext: 'ts' },
  jsx: { label: 'JSX', ext: 'jsx' },
  tsx: { label: 'TSX', ext: 'tsx' },
  python: { label: 'Python', ext: 'py' },
  bash: { label: 'Bash / Shell', ext: 'sh' },
  json: { label: 'JSON', ext: 'json' },
  yaml: { label: 'YAML', ext: 'yaml' },
  toml: { label: 'TOML', ext: 'toml' },
  markup: { label: 'HTML / XML', ext: 'html' },
  css: { label: 'CSS', ext: 'css' },
  sql: { label: 'SQL', ext: 'sql' },
  c: { label: 'C', ext: 'c' },
  cpp: { label: 'C++', ext: 'cpp' },
  csharp: { label: 'C#', ext: 'cs' },
  java: { label: 'Java', ext: 'java' },
  go: { label: 'Go', ext: 'go' },
  rust: { label: 'Rust', ext: 'rs' },
  swift: { label: 'Swift', ext: 'swift' },
  kotlin: { label: 'Kotlin', ext: 'kt' },
  ruby: { label: 'Ruby', ext: 'rb' },
  diff: { label: 'Diff', ext: 'diff' },
  docker: { label: 'Dockerfile', ext: 'Dockerfile' },
  graphql: { label: 'GraphQL', ext: 'graphql' },
  markdown: { label: 'Markdown', ext: 'md' },
};

function inferLanguageFromCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return '';
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Fall through if not strict JSON
    }
  }
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<(html|div|section|main|header|svg|table|form)\b/i.test(trimmed)) {
    return 'markup';
  }
  if (/^#!/m.test(trimmed) || /^(npm|npx|yarn|pnpm|git|curl|docker|kubectl|sudo|apt|brew|cd|ls|mkdir|export)\s+/m.test(trimmed)) {
    return 'bash';
  }
  if (/^\s*(def|class)\s+\w+.*:/m.test(trimmed) || /^\s*from\s+[\w.]+\s+import\s+/m.test(trimmed)) {
    return 'python';
  }
  if (/^\s*(interface|type)\s+[A-Z]\w*/m.test(trimmed) || /:\s*(string|number|boolean|any|Record<)/m.test(trimmed)) {
    return trimmed.includes('</') || trimmed.includes('/>') ? 'tsx' : 'typescript';
  }
  if (/^\s*(import|export|const|let|var|function|async\s+function)\s+/m.test(trimmed)) {
    return trimmed.includes('</') || trimmed.includes('/>') ? 'jsx' : 'javascript';
  }
  if (/^\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/im.test(trimmed)) {
    return 'sql';
  }
  if (/^\s*package\s+\w+/m.test(trimmed) && /\bfunc\s+\w+/m.test(trimmed)) {
    return 'go';
  }
  if (/\bfn\s+\w+\s*\(/m.test(trimmed) && /\blet\s+mut\b/m.test(trimmed)) {
    return 'rust';
  }
  if (/^\s*#include\s+[<"]/m.test(trimmed)) {
    return 'cpp';
  }
  return '';
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const PrismCodeBlock: React.FC<PrismCodeBlockProps> = ({
  language = '',
  code,
  isDark = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(() => code.split('\n').length >= 4);

  const normalizedInputLang = (language || '').trim().toLowerCase().replace(/^language-/, '');

  const resolvedLang = useMemo(() => {
    if (
      normalizedInputLang &&
      normalizedInputLang !== 'text' &&
      normalizedInputLang !== 'plaintext' &&
      normalizedInputLang !== 'plain'
    ) {
      return LANGUAGE_ALIASES[normalizedInputLang] || normalizedInputLang;
    }
    return inferLanguageFromCode(code);
  }, [normalizedInputLang, code]);

  const highlightedLines = useMemo(() => {
    const rawLines = code.split('\n');
    const grammar = resolvedLang ? Prism.languages[resolvedLang] : undefined;
    if (!grammar) {
      return rawLines.map((line) => escapeHtml(line));
    }
    try {
      // Highlight line-by-line or full block. Highlighting full block preserves multi-line tokens,
      // while highlighting per-line guarantees clean 1:1 row alignment when line numbers or wrapping are enabled.
      const fullHighlighted = Prism.highlight(code, grammar, resolvedLang);
      const splitHighlighted = fullHighlighted.split('\n');
      if (splitHighlighted.length === rawLines.length) {
        return splitHighlighted;
      }
      return rawLines.map((line) => Prism.highlight(line, grammar, resolvedLang));
    } catch {
      return rawLines.map((line) => escapeHtml(line));
    }
  }, [code, resolvedLang]);

  const meta = LANGUAGE_LABELS[resolvedLang] || {
    label:
      normalizedInputLang && normalizedInputLang !== 'text' && normalizedInputLang !== 'plaintext'
        ? normalizedInputLang.toUpperCase()
        : resolvedLang
        ? resolvedLang.toUpperCase()
        : 'Code',
    ext: normalizedInputLang || resolvedLang || 'txt',
  };

  const isShell = resolvedLang === 'bash' || normalizedInputLang === 'sh' || normalizedInputLang === 'shell' || normalizedInputLang === 'terminal';
  const lineCount = highlightedLines.length;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippet-${Date.now()}.${meta.ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className={`my-3 w-full max-w-full min-w-0 rounded-xl border overflow-hidden font-mono text-xs transition-colors ${
        isDark
          ? 'prism-dark bg-[#0d0d10] border-white/[0.08]'
          : 'prism-light bg-[#f8f8fa] border-black/[0.08]'
      }`}
    >
      {/* Code Block Header Bar */}
      <div
        className={`flex items-center justify-between px-3.5 py-2 border-b select-none ${
          isDark
            ? 'border-white/[0.07] bg-[#121216] text-neutral-400'
            : 'border-black/[0.07] bg-[#f1f1f4] text-neutral-600'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isShell ? (
            <Terminal className="w-3.5 h-3.5 opacity-70 shrink-0" />
          ) : (
            <Code2 className="w-3.5 h-3.5 opacity-70 shrink-0" />
          )}
          <span className="font-semibold text-[11px] tracking-tight truncate">{meta.label}</span>
        </div>

        <div className="flex items-center gap-1">
          {lineCount > 1 && (
            <button
              type="button"
              onClick={() => setShowLineNumbers((v) => !v)}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                showLineNumbers
                  ? isDark
                    ? 'bg-white/10 text-white'
                    : 'bg-black/10 text-black'
                  : isDark
                  ? 'hover:bg-white/10 text-neutral-500 hover:text-neutral-200'
                  : 'hover:bg-black/10 text-neutral-500 hover:text-black'
              }`}
              title={showLineNumbers ? 'Hide line numbers' : 'Show line numbers'}
            >
              <Hash className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setWrapLines((w) => !w)}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              wrapLines
                ? isDark
                  ? 'bg-white/10 text-white'
                  : 'bg-black/10 text-black'
                : isDark
                ? 'hover:bg-white/10 text-neutral-500 hover:text-neutral-200'
                : 'hover:bg-black/10 text-neutral-500 hover:text-black'
            }`}
            title={wrapLines ? 'Disable word wrap' : 'Enable word wrap'}
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-white/10 text-neutral-400 hover:text-white'
                : 'hover:bg-black/10 text-neutral-600 hover:text-black'
            }`}
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              copied
                ? isDark
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-emerald-500/15 text-emerald-700'
                : isDark
                ? 'hover:bg-white/10 text-neutral-300 hover:text-white'
                : 'hover:bg-black/10 text-neutral-700 hover:text-black'
            }`}
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Syntax Highlighted Body */}
      <div className="overflow-x-auto py-3 px-3.5 text-[13px] leading-[1.65] font-mono">
        <div className="min-w-full inline-block">
          {highlightedLines.map((lineHtml, idx) => (
            <div
              key={idx}
              className={`table-row group/line ${
                isDark ? 'hover:bg-white/[0.025]' : 'hover:bg-black/[0.025]'
              }`}
            >
              {showLineNumbers && (
                <span
                  className={`table-cell select-none pr-4 text-right text-[11px] tabular-nums align-top ${
                    isDark ? 'text-[#4b5263]' : 'text-[#94a3b8]'
                  }`}
                >
                  {idx + 1}
                </span>
              )}
              <span
                className={`table-cell align-top prism-code ${
                  wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                }`}
                dangerouslySetInnerHTML={{ __html: lineHtml || ' ' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
