import React, { useState } from 'react';
import { Star, GitFork, ExternalLink, Code2, Download, Copy, Check, Terminal, Shield, Sparkles, ChevronDown } from 'lucide-react';
import { GithubRepo } from '../types';
import GitHubActivity, { extractGitHubUsername } from './ui/github-activity';

interface GithubRepoCardProps {
  repo: GithubRepo;
  isDark?: boolean;
  onAskZeno?: (prompt: string) => void;
}

export const GithubRepoCard: React.FC<GithubRepoCardProps> = ({
  repo,
  isDark = true,
  onAskZeno,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const ghUsername =
    extractGitHubUsername(repo.url) ||
    (repo.name.includes('/') ? repo.name.split('/')[0] : 'swamimalode07');
  const shortRepoName = repo.name.split('/').pop() || repo.name;

  const formatNumber = (num?: number | string) => {
    if (num === undefined || num === null) return '0';
    if (typeof num === 'string') return num;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  const cloneCommand = `git clone ${repo.url}.git`;
  const zipDownloadUrl = `${repo.url}/archive/refs/heads/main.zip`;

  const handleCopyClone = () => {
    navigator.clipboard.writeText(cloneCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-200 group relative ${
        isDark
          ? 'bg-[#121212]/90 hover:bg-[#181818] border-[#262626] hover:border-[#3b3b3b] text-white shadow-lg shadow-black/40'
          : 'bg-white hover:bg-[#fbfbfb] border-[#e5e5e5] hover:border-[#cccccc] text-[#0d0d0d] shadow-md shadow-black/5'
      }`}
    >
      {/* Top Header Row: Owner Avatar, Repo Full Name, Stars & Forks, Collapse Toggle */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {repo.ownerAvatar ? (
            <img
              src={repo.ownerAvatar}
              alt={repo.name}
              className="size-7 rounded-lg border border-black/10 dark:border-white/10 shrink-0 object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className={`size-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-black'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
            </div>
          )}

          <a
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sm leading-tight hover:underline truncate group-hover:text-[#007aff] transition-colors"
            title={repo.name}
          >
            {repo.name}
          </a>
        </div>

        {/* Stars, Forks & Collapse Toggle */}
        <div className="flex items-center gap-2 text-xs font-medium shrink-0">
          {repo.stars !== undefined && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${
                isDark
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-700'
              }`}
              title={`${repo.stars} stars`}
            >
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{formatNumber(repo.stars)}</span>
            </span>
          )}

          {repo.forks !== undefined && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${
                isDark
                  ? 'bg-white/[0.05] border-white/10 text-neutral-300'
                  : 'bg-black/[0.04] border-black/10 text-neutral-700'
              }`}
              title={`${repo.forks} forks`}
            >
              <GitFork className="w-3 h-3 opacity-70" />
              <span>{formatNumber(repo.forks)}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-1 rounded-full transition-colors cursor-pointer ${
              isDark ? 'text-neutral-400 hover:text-white hover:bg-white/10' : 'text-neutral-600 hover:text-black hover:bg-black/5'
            }`}
            title={isCollapsed ? 'Expand GitHub repo card' : 'Collapse GitHub repo card'}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-3 pt-1">
          {/* Description */}
          {repo.description && (
            <p
              className={`text-xs leading-relaxed line-clamp-2 ${
                isDark ? 'text-[#a3a3a3]' : 'text-[#525252]'
              }`}
            >
              {repo.description}
            </p>
          )}

          {/* Meta Row: Language, License, Topics */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {repo.language && (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium ${
                  isDark ? 'bg-white/5 text-neutral-300' : 'bg-black/5 text-neutral-700'
                }`}
              >
                <span className="size-2 rounded-full bg-[#007aff]" />
                <span>{repo.language}</span>
              </span>
            )}

            {repo.license && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                  isDark ? 'text-neutral-400' : 'text-neutral-600'
                }`}
              >
                <Shield className="w-3 h-3 opacity-60" />
                <span>{repo.license}</span>
              </span>
            )}

            {repo.topics && repo.topics.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {repo.topics.slice(0, 3).map((topic, idx) => (
                  <span
                    key={idx}
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      isDark
                        ? 'bg-white/[0.04] text-neutral-400 border border-white/5'
                        : 'bg-black/[0.03] text-neutral-600 border border-black/5'
                    }`}
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-black/10 dark:border-white/10 text-xs font-medium">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsActivityOpen(!isActivityOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                  isActivityOpen
                    ? 'bg-[#26a641]/20 border-[#39d353]/50 text-[#39d353]'
                    : isDark
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    : 'bg-black/5 hover:bg-black/10 border-black/10 text-black'
                }`}
              >
                <span>Activity</span>
              </button>

              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors ${
                  isDark
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    : 'bg-black/5 hover:bg-black/10 border-black/10 text-black'
                }`}
              >
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>

            <button
              type="button"
              onClick={() => setIsCloneModalOpen(!isCloneModalOpen)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                isCloneModalOpen
                  ? 'bg-[#007aff]/20 border-[#007aff]/50 text-[#38bdf8]'
                  : isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                  : 'bg-black/5 hover:bg-black/10 border-black/10 text-black'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Clone</span>
            </button>
          </div>

          {/* Activity Dropdown / Modal view */}
          {isActivityOpen && (
            <div className={`mt-3 p-3 rounded-xl border text-xs animate-in fade-in duration-150 ${
              isDark ? 'bg-black/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
            }`}>
              <div className="mb-2 text-[11px] font-semibold text-neutral-400">
                GitHub Contribution Activity ({ghUsername})
              </div>
              <div className="overflow-x-auto flex justify-center py-1">
                <GitHubActivity
                  username={ghUsername}
                  accent={['#0e4429', '#006d32', '#26a641', '#39d353']}
                  repos={[{ name: shortRepoName, count: Number(repo.stars) || 1, href: repo.url }]}
                />
              </div>
            </div>
          )}

          {/* Clone Modal / Drawer */}
          {isCloneModalOpen && (
            <div className={`mt-3 p-3 rounded-xl border space-y-2 text-xs animate-in fade-in duration-150 ${
              isDark ? 'bg-black/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
            }`}>
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400">
                <span>Clone via Command Line</span>
                <span className="font-mono text-[10px]">git</span>
              </div>

              <div
                className={`flex items-center justify-between p-2 rounded-lg font-mono text-[11px] border ${
                  isDark ? 'bg-black border-neutral-800 text-emerald-400' : 'bg-white border-neutral-300 text-emerald-700'
                }`}
              >
                <span className="truncate mr-2">{cloneCommand}</span>
                <button
                  type="button"
                  onClick={handleCopyClone}
                  className="p-1 hover:opacity-100 opacity-70 cursor-pointer shrink-0"
                  title="Copy command"
                >
                  {copiedCommand ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Direct ZIP Download Link */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] opacity-80">Source Code ZIP:</span>
                <a
                  href={zipDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#007aff] hover:bg-[#0062cc] text-white text-[11px] font-medium transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>Download .ZIP</span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
