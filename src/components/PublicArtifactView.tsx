import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Bookmark,
  GitFork,
  Flag,
  Globe,
  Lock,
  Trash2,
  Pencil,
  ExternalLink,
  Download,
  User,
  Calendar,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-4xl max-h-[92vh] rounded-2xl border flex flex-col overflow-hidden shadow-2xl ${
          isDark
            ? 'bg-[#0b0c10] border-[#22252f] text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between gap-3 ${
            isDark ? 'border-[#1d2029] bg-[#101218]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider ${
                isDark ? 'bg-white/10 text-neutral-200' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {artifact?.category || 'Zeno Page'}
            </span>
            {artifact && (
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400">
                {artifact.visibility === 'public' ? (
                  <>
                    <Globe className="w-3 h-3 text-emerald-400" />
                    <span>Public Page</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Private Page</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {artifact && (
              <>
                <button
                  type="button"
                  onClick={handleToggleBookmark}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    isBookmarked
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : isDark
                      ? 'border-[#2a2e3b] hover:bg-white/5 text-neutral-300'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                  <span>{isBookmarked ? 'Saved in Vault' : 'Save to Vault'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'border-[#2a2e3b] hover:bg-white/5 text-neutral-300'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {copiedUrl ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedUrl ? 'Copied Link' : 'Share Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleFork}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Explore & Fork in Zeno</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'hover:bg-white/10 text-neutral-400 hover:text-white'
                  : 'hover:bg-slate-200 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-sm text-neutral-400">
              Loading Zeno page…
            </div>
          ) : error || !artifact ? (
            <div className="py-16 max-w-md mx-auto text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold">Page Unavailable</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {error || 'This resource does not exist or is currently private.'}
              </p>
            </div>
          ) : isEditing ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Edit Zeno Page</h3>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${
                    isDark
                      ? 'bg-[#14171f] border-[#282d3a] text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Summary</label>
                <input
                  type="text"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                    isDark
                      ? 'bg-[#14171f] border-[#282d3a] text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Content (Markdown)</label>
                <textarea
                  rows={12}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border font-mono text-xs outline-none ${
                    isDark
                      ? 'bg-[#090b0f] border-[#282d3a] text-neutral-200'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={handleSaveEdit}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                  }`}
                >
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Title & Meta Header */}
              <div className="space-y-3 border-b pb-5 border-white/10">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
                  {artifact.title}
                </h1>

                {artifact.summary && (
                  <p className="text-sm text-neutral-400 leading-relaxed">{artifact.summary}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-neutral-400">
                  <div className="flex flex-wrap items-center gap-3">
                    {artifact.showAuthorAttribution && artifact.authorName && (
                      <button
                        type="button"
                        onClick={handleOpenCreatorProfile}
                        className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>{artifact.authorName}</span>
                      </button>
                    )}

                    <span className="inline-flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {new Date(artifact.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </span>

                    <span className="inline-flex items-center gap-1 font-mono">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{artifact.viewsCount || 1} views</span>
                    </span>
                  </div>

                  {/* Owner Controls */}
                  {isOwner && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleVisibility}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-white/15 text-[11px] hover:bg-white/5 cursor-pointer"
                      >
                        {artifact.visibility === 'public' ? (
                          <>
                            <Lock className="w-3 h-3" />
                            <span>Make Private</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3" />
                            <span>Make Public</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-white/15 text-[11px] hover:bg-white/5 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-500/30 text-red-400 text-[11px] hover:bg-red-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
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
                        className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                          isDark
                            ? 'bg-white/[0.05] text-neutral-300 border border-white/10'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
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
                  className={`p-4 rounded-xl border space-y-2 ${
                    isDark ? 'bg-[#12151e] border-[#252a3a]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold">
                        Creator Profile: {creatorProfile.profile.displayName}
                      </div>
                      {creatorProfile.profile.bio && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {creatorProfile.profile.bio}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreatorProfile(null)}
                      className="text-[11px] text-neutral-400 hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono">
                    Published public resources: {creatorProfile.artifacts.length}
                  </div>
                </div>
              )}

              {/* Prompt Box if present */}
              {artifact.promptText && (
                <div
                  className={`p-3.5 rounded-xl border ${
                    isDark ? 'bg-[#12141c] border-[#232736]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                    Research Question
                  </div>
                  <div className="text-sm font-medium">{artifact.promptText}</div>
                </div>
              )}

              {/* Main Markdown Body */}
              <div className="prose-grok max-w-none text-sm sm:text-[15px] leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.content}</ReactMarkdown>
              </div>

              {/* Cited Sources */}
              {artifact.sources && artifact.sources.length > 0 && (
                <div
                  className={`pt-4 border-t space-y-2 ${
                    isDark ? 'border-white/10' : 'border-slate-200'
                  }`}
                >
                  <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                    Cited References ({artifact.sources.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {artifact.sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs transition-colors ${
                          isDark
                            ? 'bg-[#11131a] border-[#222634] hover:border-white/30'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span className="truncate font-medium">
                          [{idx + 1}] {src.title || src.domain || src.url}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Call To Action & Report */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isDark ? 'bg-[#11131a] border-[#222634]' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <div className="text-sm font-semibold">
                    Continue researching this topic in Zeno
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Fork this page into an interactive AI session, run deep web & ArXiv verification, or generate flashcards.
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
                        authorName: artifact.showAuthorAttribution ? artifact.authorName : undefined,
                        theme: 'carbon',
                      })
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                      isDark
                        ? 'border-[#2c3142] hover:bg-white/5 text-neutral-200'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Share Card PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFork}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                      isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                    }`}
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    <span>Open in Zeno</span>
                  </button>
                </div>
              </div>

              {/* Moderation / Report Footer */}
              <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2">
                <span>Published via Zeno · zeno0x.vercel.app</span>
                <button
                  type="button"
                  onClick={() => setShowReportForm((v) => !v)}
                  className="inline-flex items-center gap-1 hover:text-neutral-300 cursor-pointer"
                >
                  <Flag className="w-3 h-3" />
                  <span>Report inappropriate content</span>
                </button>
              </div>

              {showReportForm && (
                <div
                  className={`p-4 rounded-xl border space-y-3 text-xs ${
                    isDark ? 'bg-[#141218] border-[#2e2436]' : 'bg-red-50/40 border-red-200'
                  }`}
                >
                  {reportSubmitted ? (
                    <div className="text-emerald-400 font-medium">
                      Thank you. Your report has been recorded for moderation review.
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold">Report Public Resource</div>
                      <select
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                          isDark
                            ? 'bg-[#0e1015] border-[#282d3a] text-white'
                            : 'bg-white border-slate-300 text-slate-900'
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
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                          isDark
                            ? 'bg-[#0e1015] border-[#282d3a] text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReportForm(false)}
                          className="px-3 py-1.5 rounded-lg text-neutral-400 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitReport}
                          className="px-3.5 py-1.5 rounded-lg bg-red-500 text-white font-semibold cursor-pointer"
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
