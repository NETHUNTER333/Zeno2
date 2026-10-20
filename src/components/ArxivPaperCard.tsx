import React, { useState } from 'react';
import { ChevronDown, Code2, ExternalLink, Star, GitFork } from 'lucide-react';
import { ArxivPaper } from '../types';
import { InbuiltPdfViewer } from './InbuiltPdfViewer';
import GitHubActivity, { extractGitHubUsername } from './ui/github-activity';

interface ArxivPaperCardProps {
  paper: ArxivPaper;
  isDark?: boolean;
  onAskZeno?: (prompt: string) => void;
}

export const ArxivPaperCard: React.FC<ArxivPaperCardProps> = ({
  paper,
  isDark = true,
  onAskZeno,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReposOpen, setIsReposOpen] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  const formatNumber = (num?: number | string) => {
    if (num === undefined || num === null) return '0';
    if (typeof num === 'string') return num;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const authorSummary =
    paper.authors.slice(0, 3).join(', ') +
    (paper.authors.length > 3 ? ` et al.` : '');

  const hasRepos = paper.githubRepos && paper.githubRepos.length > 0;

  return (
    <div
      className={`py-3.5 border-b last:border-b-0 text-xs ${
        isDark ? 'border-[#242424] text-[#e5e5e5]' : 'border-[#e5e5e5] text-[#1a1a1a]'
      }`}
    >
      {/* Unboxed quiet metadata line with collapse toggle */}
      <div className="flex items-center justify-between mb-1">
        <div
          className={`flex flex-wrap items-center gap-1.5 text-[11px] font-mono ${
            isDark ? 'text-[#7a7a7a]' : 'text-[#666666]'
          }`}
        >
          <span>arXiv:{paper.id}</span>
          {paper.categories.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{paper.categories.slice(0, 2).join(', ')}</span>
            </>
          )}
          {paper.published && (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatDate(paper.published)}</span>
            </>
          )}
          {authorSummary && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-sans">{authorSummary}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1 rounded-full transition-colors cursor-pointer ${
            isDark ? 'text-neutral-400 hover:text-white hover:bg-white/10' : 'text-neutral-600 hover:text-black hover:bg-black/5'
          }`}
          title={isCollapsed ? 'Expand arXiv card' : 'Collapse arXiv card'}
        >
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 rotate-180" />}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Title - Click opens Inbuilt Online Reader */}
          <button
            type="button"
            onClick={() => setIsPdfViewerOpen(true)}
            className={`font-semibold text-sm leading-snug hover:underline text-left block mb-1.5 cursor-pointer ${
              isDark ? 'text-white' : 'text-[#0d0d0d]'
            }`}
          >
            {paper.title}
          </button>

          {/* Abstract */}
          <p
            className={`text-xs leading-relaxed mb-2.5 ${
              isDark ? 'text-[#a3a3a3]' : 'text-[#525252]'
            } ${isExpanded ? '' : 'line-clamp-2'}`}
          >
            {paper.summary}
          </p>

          {/* Clean inline actions */}
          <div
            className={`flex flex-wrap items-center gap-3 text-[11px] font-medium ${
              isDark ? 'text-[#888888]' : 'text-[#666666]'
            }`}
          >
        {paper.summary.length > 160 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`hover:underline cursor-pointer ${
              isDark ? 'hover:text-white' : 'hover:text-black'
            }`}
          >
            {isExpanded ? 'Less' : 'Abstract'}
          </button>
        )}

        {/* Read Online in Inbuilt Viewer */}
        <button
          type="button"
          onClick={() => setIsPdfViewerOpen(true)}
          className={`hover:underline cursor-pointer font-medium ${
            isDark ? 'text-neutral-300 hover:text-white' : 'text-neutral-700 hover:text-black'
          }`}
          title="Open in Inbuilt PDF & Readability Reader"
        >
          <span>Read PDF Online</span>
        </button>

        {hasRepos && (
          <button
            type="button"
            onClick={() => setIsReposOpen(!isReposOpen)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all cursor-pointer font-sans ${
              isDark
                ? 'bg-[#007aff]/10 hover:bg-[#007aff]/20 border-[#007aff]/30 text-[#38bdf8]'
                : 'bg-[#007aff]/10 hover:bg-[#007aff]/20 border-[#007aff]/20 text-[#0284c7]'
            }`}
            title="Connected GitHub repositories"
          >
            <Code2 className="w-3 h-3 shrink-0" />
            <span>Connected Code ({paper.githubRepos!.length})</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-150 ${
                isReposOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        )}

        {onAskZeno && (
          <button
            type="button"
            onClick={() =>
              onAskZeno(`Analyze arXiv:${paper.id} ("${paper.title}") and summarize its methodology, findings, and code implementations.`)
            }
            className={`hover:underline cursor-pointer ${
              isDark ? 'hover:text-white' : 'hover:text-black'
            }`}
          >
            Ask Zeno
          </button>
        )}

        <a
          href={paper.absUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-50 hover:opacity-100 hover:underline flex items-center gap-0.5 ml-auto"
          title="Open raw arXiv web page"
        >
          <span>arXiv Site</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {/* Citation Pop-up / Dropdown of Connected Repositories with Rare UI GitHubActivity */}
      {isReposOpen && hasRepos && (
        <div
          className={`mt-3 p-3 rounded-2xl border text-xs animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? 'bg-[#141414] border-[#292929] text-white shadow-xl'
              : 'bg-[#fafafa] border-[#e2e2e2] text-black shadow-md'
          }`}
        >
          <div className="mb-3 flex justify-center overflow-x-auto">
            <GitHubActivity
              username={extractGitHubUsername(paper.githubRepos![0]?.url) || 'swamimalode07'}
              accent={['#0e4429', '#006d32', '#26a641', '#39d353']}
              repos={paper.githubRepos!.map((r) => ({
                name: r.name.split('/').pop() || r.name,
                count: typeof r.stars === 'number' ? r.stars : Number(r.stars) || 1,
                href: r.url,
              }))}
            />
          </div>

          <div className="space-y-2">
            {paper.githubRepos!.map((repo, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-colors ${
                  isDark
                    ? 'bg-[#1c1c1c] border-[#2f2f2f] hover:border-[#444]'
                    : 'bg-white border-[#e5e5e5] hover:border-[#ccc]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-xs hover:underline truncate text-[#007aff]"
                  >
                    {repo.name}
                  </a>

                  <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                    {repo.stars !== undefined && (
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <Star className="w-2.5 h-2.5 fill-amber-400" />
                        <span>{formatNumber(repo.stars)}</span>
                      </span>
                    )}
                    {repo.forks !== undefined && (
                      <span className="flex items-center gap-0.5 opacity-60">
                        <GitFork className="w-2.5 h-2.5" />
                        <span>{formatNumber(repo.forks)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {repo.description && (
                  <p className={`text-[11px] leading-relaxed line-clamp-2 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    {repo.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 text-[10px]">
                  <span className={`font-mono ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                    {repo.language || 'Code'}
                  </span>

                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:underline text-[#007aff]"
                  >
                    <span>View Repository</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
    )}

      {/* Inbuilt Online PDF & Readability Reader Modal */}
      {isPdfViewerOpen && (
        <InbuiltPdfViewer
          isOpen={isPdfViewerOpen}
          onClose={() => setIsPdfViewerOpen(false)}
          pdfUrl={paper.pdfUrl}
          pdfName={paper.title}
          extractedText={`Paper Title: ${paper.title}\n\nAuthors: ${paper.authors.join(', ')}\nPublished: ${formatDate(paper.published)}\nCategories: ${paper.categories.join(', ')}\n\nABSTRACT:\n${paper.summary}`}
          isDark={isDark}
          onAskZeno={onAskZeno}
        />
      )}
    </div>
  );
};
