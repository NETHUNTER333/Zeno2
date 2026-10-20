import { SocialMeta, XPost, SearchSource } from '../types';

// Format real metric numbers into "12.4K", "1.2M", "450"
export function formatSocialMetric(num?: number | null): string {
  if (num === undefined || num === null || Number.isNaN(num)) return '—';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

/**
 * Returns only verified, real social metadata fetched from live APIs on the server.
 * Never invents or fabricates metrics, avatars, or replies.
 */
export function extractSocialMeta(
  _url: string = '',
  _title: string = '',
  _snippet: string = '',
  existingMeta?: SocialMeta
): SocialMeta | undefined {
  if (existingMeta) return existingMeta;
  return undefined;
}

/**
 * Converts a SearchSource that has real server-fetched socialMeta into an XPost.
 */
export function sourceToXPost(source: SearchSource): XPost | null {
  const meta = source.socialMeta;
  if (!meta) return null;

  return {
    id: meta.postId || source.url,
    authorName: meta.authorName,
    authorUsername: meta.authorUsername,
    authorImage: meta.authorImage,
    authorVerified: meta.authorVerified,
    authorFollowers: meta.authorFollowers,
    text: meta.text || source.snippet || source.title,
    url: source.url,
    likeCount: meta.likeCount,
    retweetCount: meta.retweetCount,
    replyCount: meta.replyCount,
    viewCount: meta.viewCount,
    bookmarkCount: meta.bookmarkCount,
    quoteCount: meta.quoteCount,
    createdUtc: meta.createdUtc,
    platform: meta.platform || 'x',
    media: meta.media,
    thread: meta.thread,
  };
}
