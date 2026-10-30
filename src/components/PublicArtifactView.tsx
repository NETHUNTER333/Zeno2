import React, { useState, useEffect, useMemo } from 'react';
import { X, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PublicArtifact, CreatorPublicProfile } from '../types';
import {
  fetchPublicArtifactById,
  recordArtifactInteraction,
  updatePublicArtifact,
  deletePublicArtifact,
  reportPublicArtifact,
  fetchCreatorPublicProfile,
  KnowledgeVaultStore,
  trackGrowthEvent,
} from '../lib/growthStore';
import { downloadQuoteCardPng } from '../lib/exportChat';
import { auth } from '../lib/firebase';

export interface PublicArtifactViewProps {
  artifactId: string | null;
  initialArtifact?: PublicArtifact | null;
  isOpen: boolean;
  onClose: () => void;
  onForkIntoChat: (artifact: PublicArtifact) => void;
  isDark?: boolean;
}

function normalizeLatexDelimiters(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n$$${inner.trim()}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner.trim()}$`);
}

export const PublicArtifactView: React.FC<PublicArtifactViewProps> = ({
  artifactId,
  initialArtifact = null,
  isOpen,
  onClose,
  onForkIntoChat,
  isDark = true,
}) => {
  const [artifact, setArtifact] = useState<PublicArtifact | null>(initialArtifact);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  // Owner edit state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editSummary, setEditSummary] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Report modal state
  const [showReportForm, setShowReportForm] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>('Inaccurate or misleading content');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);

  // Creator public profile drawer state
  const [creatorProfile, setCreatorProfile] = useState<{
    profile: CreatorPublicProfile;
    artifacts: PublicArtifact[];
  } | null>(null);
  const [loadingCreator, setLoadingCreator] = useState<boolean>(false);

  const currentUid = auth.currentUser?.uid || '';
  const isOwner = Boolean(artifact && currentUid && artifact.ownerId === currentUid);

  useEffect(() => {
    if (!isOpen) return;
    setCreatorProfile(null);
    setShowReportForm(false);
    setReportSubmitted(false);
    setIsEditing(false);

    const targetId = artifactId || initialArtifact?.id;
    if (!targetId) {
      setError('Invalid resource identifier.');
      return;
    }

    if (initialArtifact && initialArtifact.id === targetId) {
      setArtifact(initialArtifact);
      setIsBookmarked(KnowledgeVaultStore.isArtifactBookmarked(initialArtifact.id));
      setError(null);
      recordArtifactInteraction(targetId, 'view');
      trackGrowthEvent('public_artifact_opened', { artifactId: targetId });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublicArtifactById(targetId)
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded) {
          setArtifact(null);
          setError(
            'This Zeno page is unavailable, has been set to private by its creator, or does not exist.'
          );
        } else {
          setArtifact(loaded);
          setIsBookmarked(KnowledgeVaultStore.isArtifactBookmarked(loaded.id));
          recordArtifactInteraction(loaded.id, 'view');
          trackGrowthEvent('public_artifact_opened', { artifactId: loaded.id });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load this Zeno page.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, artifactId, initialArtifact]);

  const formattedMarkdown = useMemo(
    () => normalizeLatexDelimiters(artifact?.content || ''),
    [artifact?.content]
  );

  if (!isOpen) return null;

  const pageUrl = (() => {
    const u = new URL(window.location.origin + window.location.pathname);
    if (artifact?.id) u.searchParams.set('artifact', artifact.id);
    return u.toString();
  })();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(pageUrl);
    setCopiedUrl(true);
    if (artifact) {
      recordArtifactInteraction(artifact.id, 'share');
      trackGrowthEvent('share_action_initiated', {
        surface: 'public_artifact_page',
        artifactId: artifact.id,
      });
    }
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleToggleBookmark = () => {
    if (!artifact) return;
    const saved = KnowledgeVaultStore.toggleBookmarkFromArtifact(artifact);
    setIsBookmarked(saved);
    if (saved) {
      recordArtifactInteraction(artifact.id, 'save');
    }
  };

  const handleFork = () => {
    if (!artifact) return;
    recordArtifactInteraction(artifact.id, 'cta');
    onForkIntoChat(artifact);
    onClose();
  };

  const handleToggleVisibility = async () => {
    if (!artifact || !isOwner) return;
    const nextVis = artifact.visibility === 'public' ? 'private' : 'public';
    const updated = await updatePublicArtifact(artifact.id, { visibility: nextVis });
    if (updated) {
      setArtifact(updated);
    }
  };

  const handleStartEdit = () => {
    if (!artifact) return;
    setEditTitle(artifact.title);
    setEditSummary(artifact.summary);
    setEditContent(artifact.content);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!artifact || !editTitle.trim() || !editContent.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await updatePublicArtifact(artifact.id, {
        title: editTitle.trim(),
        summary: editSummary.trim(),
        content: editContent.trim(),
      });
      if (updated) {
        setArtifact(updated);
        setIsEditing(false);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!artifact || !isOwner) return;
    const ok = await deletePublicArtifact(artifact.id);
    if (ok) {
      onClose();
    }
  };

  const handleSubmitReport = async () => {
    if (!artifact) return;
    const ok = await reportPublicArtifact(artifact.id, reportReason, reportDetails);
    if (ok) {
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportForm(false);
        setReportSubmitted(false);
        setReportDetails('');
      }, 1800);
    }
  };

  const handleOpenCreatorProfile = async () => {
    if (!artifact || !artifact.ownerId || artifact.ownerId === 'system_zeno') return;
    setLoadingCreator(true);
    try {
      const data = await fetchCreatorPublicProfile(artifact.ownerId);
      setCreatorProfile(data);
    } finally {
      setLoadingCreator(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden animate-in fade-in duration-150 ${
        isDark ? 'bg-[#09090b] text-white' : 'bg-white text-[#09090b]'
      }`}
    >
      {/* Top Bar — clean, non-overlapping on mobile and desktop */}
      <div
        className={`px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-2.5 shrink-0 ${
          isDark ? 'border-white/[0.08] bg-[#09090b]' : 'border-black/[0.08] bg-white'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              isDark
                ? 'border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200'
                : 'border-black/[0.12] bg-black/[0.03] hover:bg-black/[0.06] text-neutral-800'
            }`}
          >
            Back
          </button>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium truncate ${
              isDark
                ? 'bg-white/[0.06] text-neutral-300 border border-white/[0.08]'
                : 'bg-neutral-100 text-neutral-700 border border-black/[0.08]'
            }`}
          >
            {artifact?.category || 'Zeno Page'}
          </span>

          {artifact && (
            <span
              className={`hidden sm:inline-block text-[11px] ${
                isDark ? 'text-neutral-500' : 'text-neutral-500'
              }`}
            >
              {artifact.visibility === 'public' ? 'Public Page' : 'Private Page'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {artifact && (
            <>
              <button
                type="button"
                onClick={handleToggleBookmark}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isBookmarked
                    ? isDark
                      ? 'bg-white text-black border-white font-semibold'
                      : 'bg-neutral-900 text-white border-neutral-900 font-semibold'
                    : isDark
                    ? 'border-white/[0.12] hover:bg-white/[0.06] text-neutral-300'
                    : 'border-black/[0.12] hover:bg-black/[0.04] text-neutral-700'
                }`}
              >
                {isBookmarked ? 'Saved' : 'Save'}
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isDark
                    ? 'border-white/[0.12] hover:bg-white/[0.06] text-neutral-300'
                    : 'border-black/[0.12] hover:bg-black/[0.04] text-neutral-700'
                }`}
              >
                {copiedUrl ? 'Copied' : 'Share'}
              </button>

              <button
                type="button"
                onClick={handleFork}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-neutral-900 text-white hover:bg-neutral-800'
                }`}
              >
                Fork in Zeno
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-white/[0.08] text-neutral-400 hover:text-white'
                : 'hover:bg-black/[0.06] text-neutral-500 hover:text-black'
            }`}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center text-sm text-neutral-500">Loading page…</div>
          ) : error || !artifact ? (
            <div className="py-16 max-w-md mx-auto text-center space-y-2">
              <h3 className="text-base font-semibold">Page Unavailable</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {error || 'This resource does not exist or is currently private.'}
              </p>
            </div>
          ) : isEditing ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Edit Zeno Page</h3>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl border text-sm outline-none ${
                    isDark
                      ? 'bg-[#121215] border-white/[0.1] text-white'
                      : 'bg-[#f8f8fa] border-black/[0.1] text-neutral-900'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Summary</label>
                <input
                  type="text"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${
                    isDark
                      ? 'bg-[#121215] border-white/[0.1] text-white'
                      : 'bg-[#f8f8fa] border-black/[0.1] text-neutral-900'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  Content (Markdown & LaTeX)
                </label>
                <textarea
                  rows={14}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs outline-none ${
                    isDark
                      ? 'bg-[#121215] border-white/[0.1] text-neutral-200'
                      : 'bg-[#f8f8fa] border-black/[0.1] text-neutral-900'
                  }`}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 rounded-full text-xs text-neutral-500 hover:text-current cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={handleSaveEdit}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                    isDark ? 'bg-white text-black' : 'bg-neutral-900 text-white'
                  }`}
                >
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Title & Meta Header */}
              <div
                className={`space-y-3 border-b pb-5 ${
                  isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                }`}
              >
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
                  {artifact.title}
                </h1>

                {artifact.summary && (
                  <p
                    className={`text-sm leading-relaxed ${
                      isDark ? 'text-neutral-400' : 'text-neutral-600'
                    }`}
                  >
                    {artifact.summary}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-neutral-500">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {artifact.showAuthorAttribution && artifact.authorName && (
                      <>
                        <button
                          type="button"
                          onClick={handleOpenCreatorProfile}
                          className="hover:underline transition-colors cursor-pointer font-medium"
                        >
                          {artifact.authorName}
                        </button>
                        <span>·</span>
                      </>
                    )}

                    <span>
                      {new Date(artifact.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>

                    <span>·</span>
                    <span>{artifact.viewsCount || 1} views</span>
                  </div>

                  {/* Owner Controls */}
                  {isOwner && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleToggleVisibility}
                        className={`px-2.5 py-1 rounded-full border text-[11px] cursor-pointer ${
                          isDark
                            ? 'border-white/[0.12] hover:bg-white/[0.05]'
                            : 'border-black/[0.12] hover:bg-black/[0.04]'
                        }`}
                      >
                        {artifact.visibility === 'public' ? 'Make Private' : 'Make Public'}
                      </button>
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className={`px-2.5 py-1 rounded-full border text-[11px] cursor-pointer ${
                          isDark
                            ? 'border-white/[0.12] hover:bg-white/[0.05]'
                            : 'border-black/[0.12] hover:bg-black/[0.04]'
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className={`px-2.5 py-1 rounded-full border text-[11px] cursor-pointer ${
                          isDark
                            ? 'border-white/[0.12] text-neutral-400 hover:text-white'
                            : 'border-black/[0.12] text-neutral-600 hover:text-black'
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {artifact.tags && artifact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {artifact.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] ${
                          isDark
                            ? 'bg-white/[0.05] text-neutral-300 border border-white/[0.08]'
                            : 'bg-neutral-100 text-neutral-700 border border-black/[0.08]'
                        }`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Creator Profile Drawer */}
              {loadingCreator && (
                <div className="text-xs text-neutral-500">Loading creator profile…</div>
              )}
              {creatorProfile && (
                <div
                  className={`p-4 rounded-2xl border space-y-1.5 ${
                    isDark
                      ? 'bg-[#121215] border-white/[0.08]'
                      : 'bg-[#f8f8fa] border-black/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold">
                      {creatorProfile.profile.displayName}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreatorProfile(null)}
                      className="text-[11px] text-neutral-500 hover:text-current cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  {creatorProfile.profile.bio && (
                    <p className="text-xs text-neutral-500">{creatorProfile.profile.bio}</p>
                  )}
                  <div className="text-[11px] text-neutral-500">
                    Published public resources: {creatorProfile.artifacts.length}
                  </div>
                </div>
              )}

              {/* Prompt Box if present */}
              {artifact.promptText && (
                <div
                  className={`p-4 rounded-2xl border ${
                    isDark
                      ? 'bg-[#121215] border-white/[0.08]'
                      : 'bg-[#f8f8fa] border-black/[0.08]'
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                    Research Question
                  </div>
                  <div className="text-sm font-medium">{artifact.promptText}</div>
                </div>
              )}

              {/* Main Markdown + LaTeX + Responsive Table Body */}
              <div className="prose-grok max-w-none text-sm sm:text-[15px] leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    table: ({ children }) => (
                      <div
                        className={`w-full overflow-x-auto my-4 rounded-xl border ${
                          isDark ? 'border-white/[0.1]' : 'border-black/[0.1]'
                        }`}
                      >
                        <table className="!m-0 !display-table w-full min-w-[540px] border-collapse text-xs sm:text-sm">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th
                        className={`px-3.5 py-2.5 text-left font-semibold whitespace-nowrap border-b ${
                          isDark
                            ? 'bg-[#141418] text-white border-white/[0.1]'
                            : 'bg-[#f4f4f6] text-neutral-900 border-black/[0.1]'
                        }`}
                      >
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td
                        className={`px-3.5 py-2.5 align-top border-b ${
                          isDark
                            ? 'border-white/[0.06] text-neutral-200'
                            : 'border-black/[0.06] text-neutral-800'
                        }`}
                      >
                        {children}
                      </td>
                    ),
                  }}
                >
                  {formattedMarkdown}
                </ReactMarkdown>
              </div>

              {/* Cited Sources */}
              {artifact.sources && artifact.sources.length > 0 && (
                <div
                  className={`pt-5 border-t space-y-2.5 ${
                    isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                  }`}
                >
                  <h4 className="text-xs uppercase tracking-wider text-neutral-500 font-medium">
                    Cited References ({artifact.sources.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {artifact.sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                          isDark
                            ? 'bg-[#121215] border-white/[0.08] hover:border-white/[0.22]'
                            : 'bg-[#f8f8fa] border-black/[0.08] hover:border-black/[0.22]'
                        }`}
                      >
                        <span className="truncate font-medium">
                          [{idx + 1}] {src.title || src.domain || src.url}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Call To Action */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isDark
                    ? 'bg-[#121215] border-white/[0.08]'
                    : 'bg-[#f8f8fa] border-black/[0.08]'
                }`}
              >
                <div>
                  <div className="text-sm font-semibold">
                    Continue researching this topic in Zeno
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Fork this page into an interactive session, run deep verification, or generate study cards.
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      downloadQuoteCardPng({
                        title: artifact.title,
                        promptText: artifact.promptText,
                        answerText: artifact.summary || artifact.content,
                        modelName: artifact.modelUsed || 'Zeno Synthesis',
                        sourcesCount: artifact.sources?.length || 0,
                        authorName: artifact.showAuthorAttribution
                          ? artifact.authorName
                          : undefined,
                        theme: 'carbon',
                      })
                    }
                    className={`px-3.5 py-2 rounded-full border text-xs font-medium cursor-pointer ${
                      isDark
                        ? 'border-white/[0.12] hover:bg-white/[0.06] text-neutral-200'
                        : 'border-black/[0.12] hover:bg-black/[0.04] text-neutral-800'
                    }`}
                  >
                    Share Card PNG
                  </button>

                  <button
                    type="button"
                    onClick={handleFork}
                    className={`px-4 py-2 rounded-full text-xs font-semibold cursor-pointer ${
                      isDark ? 'bg-white text-black' : 'bg-neutral-900 text-white'
                    }`}
                  >
                    Open in Zeno
                  </button>
                </div>
              </div>

              {/* Moderation / Report Footer */}
              <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                <span>Published via Zeno</span>
                <button
                  type="button"
                  onClick={() => setShowReportForm((v) => !v)}
                  className="hover:underline cursor-pointer"
                >
                  Report content
                </button>
              </div>

              {showReportForm && (
                <div
                  className={`p-4 rounded-2xl border space-y-3 text-xs ${
                    isDark
                      ? 'bg-[#121215] border-white/[0.08]'
                      : 'bg-[#f8f8fa] border-black/[0.08]'
                  }`}
                >
                  {reportSubmitted ? (
                    <div className="font-medium">
                      Thank you. Your report has been recorded for moderation review.
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold">Report Public Resource</div>
                      <select
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                          isDark
                            ? 'bg-[#09090b] border-white/[0.12] text-white'
                            : 'bg-white border-black/[0.12] text-neutral-900'
                        }`}
                      >
                        <option value="Inaccurate or misleading content">
                          Inaccurate or misleading content
                        </option>
                        <option value="Spam or promotional abuse">Spam or promotional abuse</option>
                        <option value="Exposes private or personal information">
                          Exposes private or personal information
                        </option>
                        <option value="Harmful or inappropriate material">
                          Harmful or inappropriate material
                        </option>
                      </select>
                      <input
                        type="text"
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        placeholder="Optional additional context…"
                        className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                          isDark
                            ? 'bg-[#09090b] border-white/[0.12] text-white'
                            : 'bg-white border-black/[0.12] text-neutral-900'
                        }`}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReportForm(false)}
                          className="px-3 py-1.5 rounded-full text-neutral-500 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitReport}
                          className={`px-4 py-1.5 rounded-full font-semibold cursor-pointer ${
                            isDark ? 'bg-white text-black' : 'bg-neutral-900 text-white'
                          }`}
                        >
                          Submit Report
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
