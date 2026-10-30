import React, { useState, useMemo } from 'react';

export interface DocumentAgentSource {
  title: string;
  url: string;
  domain?: string;
  snippet?: string;
}

export interface DocumentAgentSection {
  id: string;
  heading: string;
  summary: string;
  bulletPoints?: string[];
}

export interface DocumentAgentProps {
  query?: string;
  title?: string;
  content?: string;
  sources?: DocumentAgentSource[];
  status?: 'searching' | 'synthesizing' | 'done';
  isDark?: boolean;
  onAskFollowUp?: (prompt: string) => void;
  onSelectSource?: (source: DocumentAgentSource) => void;
  defaultExpanded?: boolean;
}

function extractSectionsFromMarkdown(markdown: string, fallbackQuery?: string): {
  docTitle: string;
  executiveSummary: string;
  sections: DocumentAgentSection[];
  keyTakeaways: string[];
} {
  const clean = (markdown || '')
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .trim();

  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  let docTitle = fallbackQuery
    ? fallbackQuery.charAt(0).toUpperCase() + fallbackQuery.slice(1)
    : 'Research Brief';

  const firstH1 = lines.find((l) => /^#{1,2}\s+/.test(l));
  if (firstH1) {
    const candidate = firstH1.replace(/^#{1,3}\s+/, '').replace(/[*_`]/g, '').trim();
    if (candidate.length >= 6 && candidate.length <= 95) {
      docTitle = candidate;
    }
  }

  const paragraphs = clean
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .replace(/^[#>*-\d.]+\s*/gm, '')
        .replace(/\[\d+\](\(#cite-\d+\))?/g, '')
        .replace(/[*_`]/g, '')
        .trim()
    )
    .filter(
      (p) =>
        p.length > 45 &&
        !/^(hey\s+\w+|hello\s+\w+|hi\s+\w+|good\s+(morning|afternoon|evening)|it['’]s\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))/i.test(
          p
        )
    );

  const executiveSummary =
    paragraphs[0]?.slice(0, 260) ||
    (fallbackQuery
      ? `Synthesized findings and verified sources for "${fallbackQuery}".`
      : 'Synthesizing primary sources into a structured research brief.');

  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const matches = Array.from(clean.matchAll(headingRegex));
  const sections: DocumentAgentSection[] = [];

  if (matches.length > 0) {
    matches.slice(0, 5).forEach((m, idx) => {
      const heading = m[2].replace(/[*_`]/g, '').replace(/\[\d+\](\(#cite-\d+\))?/g, '').trim();
      const startIdx = (m.index || 0) + m[0].length;
      const nextIdx = matches[idx + 1]?.index ?? clean.length;
      const bodySlice = clean.slice(startIdx, nextIdx).trim();

      const bullets = bodySlice
        .split('\n')
        .filter((l) => /^[-*•]\s+/.test(l.trim()))
        .map((l) =>
          l
            .replace(/^[-*•]\s+/, '')
            .replace(/\[\d+\](\(#cite-\d+\))?/g, '')
            .replace(/[*_`]/g, '')
            .trim()
        )
        .filter((b) => b.length > 12)
        .slice(0, 3);

      const plainBody = bodySlice
        .replace(/^[-*•].*$/gm, '')
        .replace(/\[\d+\](\(#cite-\d+\))?/g, '')
        .replace(/[*_`#]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      sections.push({
        id: `sec-${idx}`,
        heading: heading.slice(0, 72),
        summary:
          plainBody.slice(0, 200) ||
          bullets[0] ||
          'Key analytical findings synthesized from verified web and academic sources.',
        bulletPoints: bullets,
      });
    });
  }

  const keyTakeaways = clean
    .split('\n')
    .filter((l) => /^[-*•]\s+/.test(l.trim()))
    .map((l) =>
      l
        .replace(/^[-*•]\s+/, '')
        .replace(/\[\d+\](\(#cite-\d+\))?/g, '')
        .replace(/[*_`]/g, '')
        .trim()
    )
    .filter((b) => b.length > 20 && b.length < 200)
    .slice(0, 4);

  return { docTitle, executiveSummary, sections, keyTakeaways };
}

export const DocumentAgent: React.FC<DocumentAgentProps> = ({
  query,
  title,
  content = '',
  sources = [],
  status = 'done',
  isDark = true,
  onAskFollowUp,
  onSelectSource,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'overview' | 'sections' | 'sources'>('overview');
  const [copied, setCopied] = useState(false);

  const isWorking = status === 'searching' || status === 'synthesizing';

  const parsed = useMemo(
    () => extractSectionsFromMarkdown(content, query || title),
    [content, query, title]
  );

  const wordCount = useMemo(() => {
    return (content || '').trim().split(/\s+/).filter(Boolean).length;
  }, [content]);

  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  const handleCopyBrief = () => {
    const textToCopy = `# ${title || parsed.docTitle}\n\n${parsed.executiveSummary}\n\n${
      content || ''
    }`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadBrief = () => {
    const blob = new Blob(
      [
        `# ${title || parsed.docTitle}\n\nSources: ${sources.length}\n\n${
          content || parsed.executiveSummary
        }`,
      ],
      { type: 'text/markdown;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(query || title || 'research-brief')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 48)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div
      data-slot="kobra-document-agent"
      className={`my-2.5 rounded-3xl border px-3.5 py-2.5 transition-all duration-200 text-[11px] font-normal ${
        isDark
          ? 'bg-[#141418] border-white/[0.1] text-white/90 shadow-xs'
          : 'bg-white border-black/[0.08] text-[#18181b] shadow-xs'
      }`}
    >
      {/* Compact Pill Header Row: No icons, no heavy text */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2 flex-1">
          <span className="text-xs font-normal truncate">{title || parsed.docTitle}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-normal shrink-0 border ${
              isDark
                ? 'bg-white/[0.04] border-white/10 text-white/60'
                : 'bg-[#f4f4f5] border-black/[0.06] text-black/60'
            }`}
          >
            {isWorking
              ? 'Synthesizing'
              : sources.length > 0
              ? `${sources.length} sources · ${readTimeMin}m`
              : `${readTimeMin}m brief`}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isWorking && (
            <>
              <button
                type="button"
                onClick={handleCopyBrief}
                className={`px-2.5 py-1 rounded-full border text-[10px] font-normal transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/10'
                    : 'bg-[#f4f4f5] border-black/[0.06] text-black/70 hover:bg-neutral-200/70'
                }`}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`px-2.5 py-1 rounded-full border text-[10px] font-normal transition-colors cursor-pointer ${
                  isExpanded
                    ? isDark
                      ? 'bg-white text-black border-white'
                      : 'bg-[#18181b] text-white border-[#18181b]'
                    : isDark
                    ? 'bg-white/[0.04] border-white/10 text-white/80 hover:bg-white/10'
                    : 'bg-[#f4f4f5] border-black/[0.06] text-[#18181b] hover:bg-neutral-200/70'
                }`}
              >
                {isExpanded ? 'Hide' : 'Summary'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapsed Pill Summary Preview */}
      {!isWorking && !isExpanded && (
        <div
          className={`mt-2 px-3 py-2 rounded-2xl border text-[11px] leading-relaxed line-clamp-2 ${
            isDark
              ? 'bg-white/[0.02] border-white/[0.06] text-white/70'
              : 'bg-[#fafafa] border-black/[0.05] text-black/70'
          }`}
        >
          {parsed.executiveSummary}
        </div>
      )}

      {/* Expanded Pill Internals (No divider lines, no icons, small font) */}
      {!isWorking && isExpanded && (
        <div className="mt-2.5 space-y-2">
          {/* Compact Pill Tabs */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div
              className={`inline-flex p-0.5 rounded-full border ${
                isDark ? 'bg-[#0b0b0e] border-white/10' : 'bg-[#f4f4f5] border-black/[0.08]'
              }`}
            >
              {(
                [
                  { id: 'overview', label: 'Summary' },
                  { id: 'sections', label: `Points (${Math.max(1, parsed.sections.length)})` },
                  { id: 'sources', label: `Sources (${sources.length})` },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-normal transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-[#18181b] text-white'
                        : 'opacity-65 hover:opacity-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleDownloadBrief}
              className={`px-2.5 py-0.5 rounded-full border text-[10px] font-normal transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/10'
                  : 'bg-[#f4f4f5] border-black/[0.06] text-black/70 hover:bg-neutral-200/70'
              }`}
            >
              Export .md
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-1.5">
              <div
                className={`px-3 py-2 rounded-2xl border text-[11px] leading-relaxed ${
                  isDark
                    ? 'bg-white/[0.02] border-white/[0.07] text-white/80'
                    : 'bg-[#fafafa] border-black/[0.06] text-black/80'
                }`}
              >
                {parsed.executiveSummary}
              </div>

              {parsed.keyTakeaways.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {parsed.keyTakeaways.map((item, idx) => (
                    <div
                      key={idx}
                      className={`px-3 py-1.5 rounded-2xl border text-[11px] leading-snug ${
                        isDark
                          ? 'bg-white/[0.02] border-white/[0.06] text-white/75'
                          : 'bg-[#fafafa] border-black/[0.05] text-black/75'
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              )}

              {onAskFollowUp && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[
                    `Compare key trade-offs in ${title || parsed.docTitle}`,
                    `Give me a concise table for ${title || parsed.docTitle}`,
                  ].map((promptText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onAskFollowUp(promptText)}
                      className={`px-2.5 py-1 rounded-full border text-[10px] font-normal transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-white/[0.03] border-white/10 text-white/75 hover:bg-white/10'
                          : 'bg-[#f4f4f5] border-black/[0.08] text-black/75 hover:bg-neutral-200/70'
                      }`}
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sections' && (
            <div className="space-y-1.5">
              {parsed.sections.length > 0 ? (
                parsed.sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className={`px-3 py-2 rounded-2xl border ${
                      isDark
                        ? 'bg-white/[0.02] border-white/[0.07]'
                        : 'bg-[#fafafa] border-black/[0.06]'
                    }`}
                  >
                    <div className="text-[11px] font-normal opacity-95 mb-0.5">
                      {idx + 1}. {sec.heading}
                    </div>
                    <p className="text-[10.5px] opacity-70 leading-relaxed">{sec.summary}</p>
                  </div>
                ))
              ) : (
                <div
                  className={`px-3 py-2 rounded-2xl border text-[11px] opacity-75 ${
                    isDark
                      ? 'bg-white/[0.02] border-white/[0.07]'
                      : 'bg-[#fafafa] border-black/[0.06]'
                  }`}
                >
                  {parsed.executiveSummary}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="grid grid-cols-2 gap-1.5">
              {sources.length > 0 ? (
                sources.map((src, idx) => (
                  <a
                    key={`${src.url}-${idx}`}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (onSelectSource) {
                        e.preventDefault();
                        onSelectSource(src);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full border flex items-center justify-between gap-2 text-[10.5px] font-normal transition-colors ${
                      isDark
                        ? 'bg-white/[0.02] border-white/[0.07] hover:bg-white/[0.07]'
                        : 'bg-[#fafafa] border-black/[0.06] hover:bg-neutral-100'
                    }`}
                  >
                    <span className="truncate">{src.title || src.domain || 'Source'}</span>
                    <span className="opacity-50 shrink-0">#{idx + 1}</span>
                  </a>
                ))
              ) : (
                <div className="col-span-2 text-[10.5px] opacity-60 py-1 px-2">
                  Synthesized from verified knowledge base.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentAgent;
