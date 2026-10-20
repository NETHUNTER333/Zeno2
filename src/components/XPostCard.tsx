import React, { useState } from 'react';
import {
  MessageCircle,
  Repeat2,
  Heart,
  BarChart2,
  Bookmark,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Share2,
  Check,
  Loader2,
} from 'lucide-react';
import { XPost, SocialThreadItem } from '../types';

interface XPostCardProps {
  post: XPost;
  isDark?: boolean;
}

export const XPostCard: React.FC<XPostCardProps> = ({ post, isDark = true }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [expandedText, setExpandedText] = useState(false);
  const [threadReplies, setThreadReplies] = useState<SocialThreadItem[]>(post.thread || []);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [copied, setCopied] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const formatNumber = (num?: number | null) => {
    if (num === undefined || num === null || Number.isNaN(num)) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  };

  const formatDate = (utc?: number) => {
    if (!utc) return '';
    const date = new Date(utc * 1000);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    if (diffMins >= 0 && diffMins < 60) return `${Math.max(1, diffMins)}m`;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours >= 1 && diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays >= 1 && diffDays <= 6) return `${diffDays}d`;
    const sameYear = date.getFullYear() === new Date(now).getFullYear();
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(post.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleThread = async () => {
    if (showThread) {
      setShowThread(false);
      return;
    }
    setShowThread(true);
    if (threadReplies.length === 0 && post.id && /^\d+$/.test(post.id)) {
      setLoadingReplies(true);
      try {
        const res = await fetch(`/api/social/post-comments?tweetId=${encodeURIComponent(post.id)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.comments)) {
          setThreadReplies(data.comments);
        }
      } catch {
        // Ignore network errors
      } finally {
        setLoadingReplies(false);
      }
    }
  };

  const canLoadThread =
    threadReplies.length > 0 || (Boolean(post.id && /^\d+$/.test(post.id)) && (post.replyCount || 0) > 0);

  const isLongText = (post.text || '').length > 180;

  return (
    <div
      className={`p-2.5 rounded-xl border transition-all duration-150 select-text flex flex-col justify-between ${
        isDark
          ? 'bg-[#121212] border-[#232323] hover:border-[#343434] text-white'
          : 'bg-white border-[#e5e5e5] hover:border-[#cccccc] text-[#0d0d0d]'
      }`}
    >
      <div>
        {/* Compact Header: Avatar, Name, Verified, Handle, Followers, Relative Date, Collapse Toggle */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            {post.authorImage && !avatarFailed ? (
              <img
                src={post.authorImage}
                alt={post.authorName}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-black/10 dark:border-white/10"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
                  isDark ? 'bg-[#262626] text-white' : 'bg-[#eaeaea] text-[#0d0d0d]'
                }`}
              >
                {(post.authorName || post.authorUsername || 'X').charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-1 truncate">
                <span className={`font-semibold text-[12px] leading-tight truncate ${isDark ? 'text-white' : 'text-[#0d0d0d]'}`}>
                  {post.authorName}
                </span>
                {post.authorVerified && (
                  <svg
                    viewBox="0 0 24 24"
                    aria-label="Verified account"
                    className="w-3.5 h-3.5 text-[#1d9bf0] fill-current flex-shrink-0"
                  >
                    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
                  </svg>
                )}
              </div>

              <div className={`flex items-center gap-1 text-[10.5px] leading-tight truncate ${isDark ? 'text-[#8a8a8a]' : 'text-[#536471]'}`}>
                <span className="truncate">@{post.authorUsername}</span>
                {post.authorFollowers !== undefined && post.authorFollowers > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex-shrink-0">{formatNumber(post.authorFollowers)}</span>
                  </>
                )}
                {post.createdUtc && (
                  <>
                    <span>·</span>
                    <span className="flex-shrink-0 font-medium">{formatDate(post.createdUtc)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Compact Action icons & Collapse toggle */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isDark
                  ? 'text-[#7a7a7a] hover:text-white hover:bg-white/10'
                  : 'text-[#536471] hover:text-black hover:bg-black/5'
              }`}
              title="Copy link to post"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Share2 className="w-3 h-3" />}
            </button>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-1 rounded-full transition-colors ${
                isDark
                  ? 'text-[#7a7a7a] hover:text-white hover:bg-white/10'
                  : 'text-[#536471] hover:text-black hover:bg-black/5'
              }`}
              title="Open original post on X"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isDark
                  ? 'text-[#7a7a7a] hover:text-white hover:bg-white/10'
                  : 'text-[#536471] hover:text-black hover:bg-black/5'
              }`}
              title={isCollapsed ? 'Expand post card' : 'Collapse post card'}
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="space-y-2 mt-1.5">
            {/* Compact Post Text */}
            <div
              onClick={() => isLongText && setExpandedText(!expandedText)}
              className={`text-[12px] leading-snug whitespace-pre-wrap font-normal ${
                !expandedText && isLongText ? 'line-clamp-3 cursor-pointer' : ''
              } ${isDark ? 'text-[#e8e8e8]' : 'text-[#0f1419]'}`}
            >
              {post.text}
            </div>

            {/* Compact Attached Post Media */}
            {post.media && post.media.length > 0 && (
              <div
                className={`grid gap-1.5 rounded-lg overflow-hidden ${
                  post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {post.media.slice(0, 2).map((m, idx) =>
                  m.type === 'video' && m.videoUrl ? (
                    <video
                      key={idx}
                      src={m.videoUrl}
                      poster={m.url}
                      controls
                      playsInline
                      className="w-full max-h-36 object-cover rounded-lg bg-black border border-black/10 dark:border-white/10"
                    />
                  ) : (
                    <a
                      key={idx}
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
                    >
                      <img
                        src={m.url}
                        alt="Post attachment"
                        loading="lazy"
                        className="w-full max-h-36 object-cover hover:scale-[1.01] transition-transform"
                      />
                    </a>
                  )
                )}
              </div>
            )}

            {/* Compact Footer Real Metrics: Replies, Reposts, Likes, Views, Bookmarks */}
            <div
              className={`pt-1.5 border-t flex items-center justify-between text-[10.5px] select-none ${
                isDark ? 'border-[#222222] text-[#8a8a8a]' : 'border-[#eeeeee] text-[#536471]'
              }`}
            >
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-[#1d9bf0] transition-colors"
                title="Replies"
              >
                <MessageCircle className="w-3 h-3 text-sky-500/80" />
                <span>{formatNumber(post.replyCount)}</span>
              </a>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-emerald-500 transition-colors"
                title="Reposts"
              >
                <Repeat2 className="w-3 h-3 text-emerald-500/80" />
                <span>{formatNumber(post.retweetCount)}</span>
              </a>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-rose-500 transition-colors"
                title="Likes"
              >
                <Heart className="w-3 h-3 text-rose-500/80" />
                <span>{formatNumber(post.likeCount)}</span>
              </a>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                title="Views"
              >
                <BarChart2 className="w-3 h-3 text-emerald-400/80" />
                <span>{formatNumber(post.viewCount)}</span>
              </a>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-amber-400 transition-colors"
                title="Bookmarks"
              >
                <Bookmark className="w-3 h-3 text-amber-400/80" />
                <span>{formatNumber(post.bookmarkCount)}</span>
              </a>
            </div>

            {/* Thread / Replies toggle if available */}
            {canLoadThread && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleToggleThread}
                  className={`w-full py-1 px-2 rounded-lg text-[11px] font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    isDark ? 'bg-white/5 hover:bg-white/10 text-neutral-300' : 'bg-black/5 hover:bg-black/10 text-neutral-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="w-3 h-3 text-[#1d9bf0]" />
                    <span>{showThread ? 'Hide replies' : `View replies (${formatNumber(post.replyCount)})`}</span>
                  </span>
                  {showThread ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showThread && (
                  <div className={`mt-2 p-2 rounded-lg border space-y-2 ${isDark ? 'bg-black/40 border-[#262626]' : 'bg-neutral-50 border-neutral-200'}`}>
                    {loadingReplies ? (
                      <div className="flex items-center justify-center py-2 text-neutral-400 gap-1.5 text-[11px]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading replies via Treg...</span>
                      </div>
                    ) : threadReplies.length > 0 ? (
                      threadReplies.map((item, idx) => (
                        <div key={item.id || idx} className="text-[11px] space-y-0.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1 min-w-0 truncate">
                              <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-[#0f1419]'}`}>
                                {item.authorName}
                              </span>
                              <span className={`truncate text-[10px] ${isDark ? 'text-[#8a8a8a]' : 'text-[#536471]'}`}>
                                @{item.authorUsername}
                              </span>
                              {item.createdUtc && (
                                <span className={`flex-shrink-0 text-[10px] ${isDark ? 'text-[#8a8a8a]' : 'text-[#536471]'}`}>
                                  · {formatDate(item.createdUtc)}
                                </span>
                              )}
                            </div>
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`p-0.5 rounded ${
                                  isDark ? 'text-[#8a8a8a] hover:text-white' : 'text-[#536471] hover:text-black'
                                }`}
                                title="Open reply on X"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          <p className={`text-[11px] leading-snug whitespace-pre-wrap line-clamp-2 ${isDark ? 'text-neutral-200' : 'text-[#0f1419]'}`}>
                            {item.text}
                          </p>
                          <div className={`flex items-center gap-3 text-[10px] ${isDark ? 'text-[#8a8a8a]' : 'text-[#536471]'}`}>
                            {item.likeCount !== undefined && (
                              <span className="flex items-center gap-0.5" title="Likes">
                                <Heart className="w-2.5 h-2.5 text-rose-500/80" /> {formatNumber(item.likeCount)}
                              </span>
                            )}
                            {item.replyCount !== undefined && (
                              <span className="flex items-center gap-0.5" title="Replies">
                                <MessageCircle className="w-2.5 h-2.5 text-sky-500/80" /> {formatNumber(item.replyCount)}
                              </span>
                            )}
                            {item.viewCount !== undefined && (
                              <span className="flex items-center gap-0.5" title="Views">
                                <BarChart2 className="w-2.5 h-2.5 text-emerald-500/80" /> {formatNumber(item.viewCount)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={`text-[10.5px] py-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        No public replies returned.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
