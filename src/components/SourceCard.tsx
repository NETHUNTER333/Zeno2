import React, { useState } from 'react';
import { ExternalLink, Globe, FileText, Heart, BarChart2, Bookmark, Repeat2, MessageCircle, ChevronDown } from 'lucide-react';
import { SearchSource } from '../types';
import { extractSocialMeta, formatSocialMetric } from '../lib/socialEnricher';

interface SourceCardProps {
  source: SearchSource;
  onExtract?: (url: string) => void;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source, onExtract }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getDomain = (url: string) => {
    try {
      const u = new URL(url);
      return u.hostname.replace('www.', '');
    } catch {
      return source.domain || 'web';
    }
  };

  const domain = getDomain(source.url);
  const social = source.socialMeta || extractSocialMeta(source.url, source.title, source.snippet);

  return (
    <div className="flex flex-col justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 transition-all text-xs group relative hover:shadow-lg hover:shadow-sky-500/5 w-full">
      <div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 border border-sky-500/30">
              {source.position}
            </span>
            <div className="flex items-center gap-1 text-slate-400 truncate font-mono text-[11px]">
              <Globe className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <span className="truncate">{social ? `${social.platform.toUpperCase()} · @${social.authorUsername}` : domain}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {source.date && (
              <span className="text-[10px] text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
                {source.date}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand source card' : 'Collapse source card'}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-200 line-clamp-2 hover:text-sky-400 transition-colors leading-snug mb-1"
              title={source.title}
            >
              {source.title}
            </a>

            {source.snippet && (
              <p className="text-slate-400 line-clamp-2 text-[11px] leading-relaxed mb-2">
                {source.snippet}
              </p>
            )}

            {/* Social Metrics Bar */}
            {social && (
              <div className="grid grid-cols-5 gap-1 py-1 px-1 bg-slate-950/60 rounded-lg border border-slate-800/80 text-[10px] font-mono text-slate-400 text-center my-1.5">
                <div title="Views" className="flex flex-col items-center">
                  <BarChart2 className="w-2.5 h-2.5 text-sky-400" />
                  <span>{formatSocialMetric(social.viewCount)}</span>
                </div>
                <div title="Likes" className="flex flex-col items-center">
                  <Heart className="w-2.5 h-2.5 text-rose-400" />
                  <span>{formatSocialMetric(social.likeCount)}</span>
                </div>
                <div title="Bookmarks" className="flex flex-col items-center">
                  <Bookmark className="w-2.5 h-2.5 text-amber-400" />
                  <span>{formatSocialMetric(social.bookmarkCount)}</span>
                </div>
                <div title="Reposts" className="flex flex-col items-center">
                  <Repeat2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>{formatSocialMetric(social.retweetCount)}</span>
                </div>
                <div title="Replies" className="flex flex-col items-center">
                  <MessageCircle className="w-2.5 h-2.5 text-cyan-400" />
                  <span>{formatSocialMetric(social.replyCount)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!isCollapsed && (
        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          {onExtract && source.url && (
            <button
              onClick={() => onExtract(source.url)}
              className="flex items-center gap-1 text-slate-400 hover:text-sky-400 transition-colors font-medium cursor-pointer"
              title="Extract page Markdown via Treg"
            >
              <FileText className="w-3 h-3" />
              <span>Extract</span>
            </button>
          )}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-slate-400 hover:text-sky-400 transition-colors ml-auto font-medium"
          >
            <span>{social ? `View on ${social.platform.toUpperCase()}` : 'Visit'}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
