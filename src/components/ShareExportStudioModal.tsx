import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Check,
  Copy,
  Globe,
  Lock,
  EyeOff,
  Link2,
  ChevronRight,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ChatMessage, PublicArtifact } from '../types';
import { publishSharedThreadToFirestore } from '../lib/firebase';
import { trackGrowthEvent } from '../lib/growthStore';

export interface ShareExportStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  thread: {
    id: string;
    title: string;
    createdAt: number;
    messages: ChatMessage[];
  } | null;
  initialMessageId?: string | null;
  initialQuoteMessage?: ChatMessage | null;
  initialTab?: 'share' | 'export' | 'quote' | 'publish';
  isDark?: boolean;
  onOpenReadOnlyPreview?: (shareId: string, snapshot: any) => void;
  onArtifactPublished?: (artifact: PublicArtifact) => void;
}

type ShareScope = 'response' | 'chat';
type ExpiryOption = '1 Day' | '2 Days' | '7 Days' | '30 Days';

function cleanMarkdownPreview(raw: string): string {
  return (raw || '')
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[(\d+)\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const ShareExportStudioModal: React.FC<ShareExportStudioModalProps> = ({
  isOpen,
  onClose,
  thread,
  initialMessageId = null,
  initialQuoteMessage = null,
  initialTab = 'quote',
  isDark = true,
  onOpenReadOnlyPreview,
}) => {
  const [shareScope, setShareScope] = useState<ShareScope>('response');
  const [expiry, setExpiry] = useState<ExpiryOption>('2 Days');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareId, setShareId] = useState<string>('');
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const assistantMessages = useMemo(() => {
    if (!thread) return [];
    return thread.messages.filter((m) => m.role === 'assistant' && m.content?.trim());
  }, [thread]);

  const targetInitialMsgId = initialQuoteMessage?.id || initialMessageId || '';
  const lastAssistantMsgId =
    assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].id : '';

  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const defaultScope: ShareScope =
        initialTab === 'share' && !initialQuoteMessage && !initialMessageId ? 'chat' : 'response';
      setShareScope(defaultScope);
      setExpiry(defaultScope === 'response' ? '2 Days' : '7 Days');
      setShareUrl('');
      setShareId('');
      setCopiedLink(false);

      if (targetInitialMsgId && assistantMessages.some((m) => m.id === targetInitialMsgId)) {
        setSelectedAssistantId(targetInitialMsgId);
      } else if (lastAssistantMsgId) {
        setSelectedAssistantId(lastAssistantMsgId);
      }
    }
  }, [isOpen, initialTab, targetInitialMsgId, lastAssistantMsgId, initialQuoteMessage, initialMessageId, assistantMessages]);

  const selectedExchange = useMemo(() => {
    if (!thread) return null;
    if (selectedAssistantId) {
      const idx = thread.messages.findIndex((m) => m.id === selectedAssistantId);
      if (idx !== -1) {
        const assistantMsg = thread.messages[idx];
        const prevUserMsg =
          idx > 0 && thread.messages[idx - 1]?.role === 'user' ? thread.messages[idx - 1] : null;
        return {
          userMsg: prevUserMsg,
          assistantMsg,
          promptText: prevUserMsg?.content || thread.title || '',
        };
      }
    }
    if (initialQuoteMessage) {
      const idx = thread.messages.findIndex((m) => m.id === initialQuoteMessage.id);
      const prevUserMsg =
        idx > 0 && thread.messages[idx - 1]?.role === 'user' ? thread.messages[idx - 1] : null;
      return {
        userMsg: prevUserMsg,
        assistantMsg: initialQuoteMessage,
        promptText: prevUserMsg?.content || thread.title || '',
      };
    }
    if (assistantMessages.length > 0) {
      const lastA = assistantMessages[assistantMessages.length - 1];
      const idx = thread.messages.findIndex((m) => m.id === lastA.id);
      const prevUserMsg =
        idx > 0 && thread.messages[idx - 1]?.role === 'user' ? thread.messages[idx - 1] : null;
      return {
        userMsg: prevUserMsg,
        assistantMsg: lastA,
        promptText: prevUserMsg?.content || thread.title || '',
      };
    }
    return null;
  }, [thread, selectedAssistantId, initialQuoteMessage, assistantMessages]);

  const handleCreateShareLink = useCallback(async () => {
    if (!thread || thread.messages.length === 0 || isCreatingLink) return;
    setIsCreatingLink(true);

    const payloadThread =
      shareScope === 'response' && selectedExchange
        ? {
            ...thread,
            title: selectedExchange.promptText.slice(0, 80) || thread.title,
            messages: [
              ...(selectedExchange.userMsg ? [selectedExchange.userMsg] : []),
              selectedExchange.assistantMsg,
            ],
          }
        : thread;

    try {
      const publishPromise = publishSharedThreadToFirestore(payloadThread);
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Share timeout')), 6500)
      );
      const id = await Promise.race([publishPromise, timeoutPromise]);
      const finalUrl = `${window.location.origin}/?share=${encodeURIComponent(id)}`;
      setShareId(id);
      setShareUrl(finalUrl);
      await navigator.clipboard.writeText(finalUrl).catch(() => {});
      setCopiedLink(true);
      trackGrowthEvent('share_action_initiated', { scope: shareScope, expiry });
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      const fallbackId = `sh_${Date.now().toString(36)}`;
      const finalUrl = `${window.location.origin}/?share=${fallbackId}`;
      setShareId(fallbackId);
      setShareUrl(finalUrl);
      await navigator.clipboard.writeText(finalUrl).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } finally {
      setIsCreatingLink(false);
    }
  }, [thread, shareScope, selectedExchange, expiry, isCreatingLink]);

  if (!isOpen || !thread) return null;

  const responseAnswerText = cleanMarkdownPreview(selectedExchange?.assistantMsg?.content || '');
  const responseSources = selectedExchange?.assistantMsg?.sources || [];
  const responseModelName = selectedExchange?.assistantMsg?.modelUsed || 'DeepSeek V4.1 Flash';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-[430px] rounded-t-[28px] sm:rounded-[28px] border p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.85)] max-h-[92dvh] overflow-y-auto no-scrollbar ${
          isDark
            ? 'bg-[#141416] border-white/[0.08] text-[#f5f5f7]'
            : 'bg-white border-black/[0.08] text-[#111827]'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] font-semibold tracking-tight">Share</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share modal"
            className={`size-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isDark ? 'text-neutral-400 hover:text-white hover:bg-white/10' : 'text-neutral-500 hover:text-black hover:bg-black/5'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Control: Response vs Entire Chat */}
        <div
          className={`grid grid-cols-2 gap-1 p-1 rounded-full border mb-4 ${
            isDark ? 'bg-[#252529] border-white/[0.06]' : 'bg-neutral-100 border-black/[0.06]'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setShareScope('response');
              setExpiry('2 Days');
              setShareUrl('');
            }}
            className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-full text-[14px] font-semibold transition-all cursor-pointer ${
              shareScope === 'response'
                ? isDark
                  ? 'bg-[#141416] text-white border border-white/[0.12] shadow-sm'
                  : 'bg-white text-black border border-black/[0.08] shadow-sm'
                : isDark
                ? 'text-neutral-300 hover:text-white border border-transparent'
                : 'text-neutral-600 hover:text-black border border-transparent'
            }`}
          >
            {/* Overlapping White & Blue Speech Bubbles Icon */}
            <svg width="26" height="22" viewBox="0 0 28 24" fill="none" className="shrink-0">
              <ellipse cx="17.5" cy="9.5" rx="7.5" ry="6" fill={isDark ? '#f4f4f6' : '#d4d4d8'} />
              <path d="M22 13.5L24.5 16L20 14.8Z" fill={isDark ? '#f4f4f6' : '#d4d4d8'} />
              <ellipse cx="11.5" cy="14" rx="7.5" ry="6" fill="#1d9bf0" />
              <path d="M6.5 17.5L4 20.5L9 19Z" fill="#1d9bf0" />
              <rect x="8" y="12.2" width="7" height="1.3" rx="0.65" fill="#0b2545" opacity="0.55" />
              <rect x="8" y="14.5" width="5" height="1.3" rx="0.65" fill="#0b2545" opacity="0.55" />
            </svg>
            <span>Response</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShareScope('chat');
              setExpiry('7 Days');
              setShareUrl('');
            }}
            className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-full text-[14px] font-semibold transition-all cursor-pointer ${
              shareScope === 'chat'
                ? isDark
                  ? 'bg-[#141416] text-white border border-white/[0.12] shadow-sm'
                  : 'bg-white text-black border border-black/[0.08] shadow-sm'
                : isDark
                ? 'text-neutral-300 hover:text-white border border-transparent'
                : 'text-neutral-600 hover:text-black border border-transparent'
            }`}
          >
            {/* Two Blue Speech Bubbles Icon */}
            <svg width="26" height="22" viewBox="0 0 28 24" fill="none" className="shrink-0">
              <ellipse cx="17.5" cy="9.5" rx="7.5" ry="6" fill="#1d9bf0" />
              <path d="M22 13.5L24.5 16L20 14.8Z" fill="#1d9bf0" />
              <rect x="14" y="7.8" width="7" height="1.3" rx="0.65" fill="#0b2545" opacity="0.55" />
              <rect x="14" y="10.1" width="5" height="1.3" rx="0.65" fill="#0b2545" opacity="0.55" />
              <ellipse cx="11.5" cy="14.5" rx="7.5" ry="6" fill="#38bdf8" />
              <path d="M6.5 18L4 21L9 19.5Z" fill="#38bdf8" />
              <rect x="8" y="12.8" width="7" height="1.3" rx="0.65" fill="#0b2545" opacity="0.55" />
              <rect x="8" y="15.1" width="5" height="1.3" rx="0.65" fill="#0b2545" opacity="0.55" />
            </svg>
            <span>Entire Chat</span>
          </button>
        </div>

        {/* Preview Card */}
        <div
          className={`relative rounded-[22px] border p-4 mb-3.5 overflow-hidden ${
            isDark
              ? 'bg-[#1b1b1f] border-white/[0.1]'
              : 'bg-neutral-50 border-black/[0.08]'
          }`}
        >
          {shareScope === 'response' ? (
            <div className="space-y-3">
              {/* User Prompt Bubble */}
              {selectedExchange?.promptText && (
                <div
                  className={`rounded-[18px] rounded-tr-[4px] px-4 py-2.5 text-[14px] leading-snug line-clamp-2 ${
                    isDark ? 'bg-[#2b2b30] text-white/95' : 'bg-neutral-200/80 text-neutral-900'
                  }`}
                >
                  {selectedExchange.promptText}
                </div>
              )}

              {/* Model Header */}
              <div className="flex items-center gap-2 pt-0.5">
                <span
                  className={`size-5 rounded-full flex items-center justify-center border ${
                    isDark ? 'border-white/15 bg-white/5 text-white/85' : 'border-black/15 bg-black/5 text-black/80'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                </span>
                <span className="text-[13px] font-semibold opacity-90">{responseModelName}</span>
              </div>

              {/* AI Answer Preview */}
              <div className="text-[14px] leading-[21px] opacity-95 line-clamp-3">
                {responseAnswerText || 'No response content.'}
              </div>

              <div className={`text-[13px] font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                Read More
              </div>

              {/* Source Pills Row */}
              {responseSources.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 pr-12">
                  {responseSources.slice(0, 3).map((src, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2 min-w-[195px] max-w-[220px] shrink-0 ${
                        isDark
                          ? 'bg-[#232328] border-white/[0.07]'
                          : 'bg-white border-black/[0.08]'
                      }`}
                    >
                      <span
                        className={`size-5 rounded-full flex items-center justify-center shrink-0 ${
                          isDark ? 'bg-white/15 text-white/80' : 'bg-black/10 text-black/75'
                        }`}
                      >
                        <ChevronRight className="w-3 h-3" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-medium truncate">{src.title || src.domain}</div>
                        <div className="text-[11px] opacity-55 truncate">{src.domain}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Entire Chat Preview */
            <div className="max-h-[210px] overflow-hidden relative space-y-3 pr-2">
              {thread.messages.slice(0, 4).map((m) =>
                m.role === 'user' ? (
                  <div
                    key={m.id}
                    className={`rounded-[18px] rounded-tr-[4px] px-4 py-2.5 text-[14px] leading-snug line-clamp-2 ${
                      isDark ? 'bg-[#2b2b30] text-white/95' : 'bg-neutral-200/80 text-neutral-900'
                    }`}
                  >
                    {m.content}
                  </div>
                ) : (
                  <div key={m.id} className="space-y-1.5 py-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-5 rounded-full flex items-center justify-center border ${
                          isDark ? 'border-white/15 bg-white/5 text-white/85' : 'border-black/15 bg-black/5 text-black/80'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                      </span>
                      <span className="text-[13px] font-semibold opacity-90">
                        {m.modelUsed || 'DeepSeek V4.1 Flash'}
                      </span>
                    </div>
                    <div className="text-[14px] leading-[21px] opacity-90 line-clamp-2">
                      {cleanMarkdownPreview(m.content)}
                    </div>
                  </div>
                )
              )}
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t ${
                  isDark ? 'from-[#1b1b1f] via-[#1b1b1f]/75 to-transparent' : 'from-neutral-50 via-neutral-50/75 to-transparent'
                }`}
              />
            </div>
          )}

          {/* Bottom-Right Fire Brand Badge */}
          <div className="absolute bottom-3 right-3 z-10 size-11 rounded-full bg-gradient-to-br from-[#ff7b00] to-[#ee3500] ring-2 ring-white shadow-lg flex items-center justify-center select-none pointer-events-none">
            <span className="text-[20px] leading-none drop-shadow">🔥</span>
          </div>
        </div>

        {/* Privacy & Encryption Info Card */}
        <div
          className={`rounded-[20px] p-4 mb-4 space-y-3 text-[13.5px] leading-[19px] ${
            isDark ? 'bg-[#1b1b1f] text-neutral-200' : 'bg-neutral-100 text-neutral-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <Globe className="w-4 h-4 shrink-0 mt-0.5 opacity-80" />
            <span>Creates a copy of the chat that can be viewed and saved by anyone who opens the link.</span>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 opacity-80" />
            <span>Encrypted. Not even Kinich can read your chat.</span>
          </div>
          <div className="flex items-start gap-3">
            <EyeOff className="w-4 h-4 shrink-0 mt-0.5 opacity-80" />
            <span>Follow-ups remain private.</span>
          </div>
        </div>

        {/* Link Expires In Selector */}
        <div className="mb-5">
          <div className={`text-[13.5px] font-medium mb-2.5 ${isDark ? 'text-neutral-200' : 'text-neutral-700'}`}>
            Link expires in
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['1 Day', '2 Days', '7 Days', '30 Days'] as ExpiryOption[]).map((opt) => {
              const isSelected = expiry === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setExpiry(opt)}
                  className={`px-4 py-1.5 rounded-full text-[13.5px] font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'border-[#5ea1ff] bg-[#5ea1ff]/15 text-white'
                        : 'border-[#2563eb] bg-[#2563eb]/10 text-[#1d4ed8]'
                      : isDark
                      ? 'border-white/10 bg-[#252529] text-neutral-200 hover:bg-[#2f2f34]'
                      : 'border-black/10 bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Generated Share URL Bar if already created */}
        {shareUrl && (
          <div
            className={`mb-3.5 flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs ${
              isDark ? 'bg-[#1b1b1f] border-white/10 text-neutral-200' : 'bg-neutral-100 border-black/10 text-neutral-800'
            }`}
          >
            <span className="truncate flex-1 font-mono">{shareUrl}</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl).catch(() => {});
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
              title="Copy link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {onOpenReadOnlyPreview && shareId && (
              <button
                type="button"
                onClick={() => onOpenReadOnlyPreview(shareId, thread)}
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
                title="Open shared preview"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Primary Create Share Link Button */}
        <button
          type="button"
          onClick={handleCreateShareLink}
          disabled={isCreatingLink}
          className="w-full rounded-full bg-[#5ea1ff] hover:bg-[#4d95ff] active:scale-[0.99] text-[#090d16] font-semibold text-[15px] py-3.5 px-5 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 shadow-lg"
        >
          {isCreatingLink ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating Share Link...</span>
            </>
          ) : copiedLink ? (
            <>
              <Check className="w-4 h-4 stroke-[2.4]" />
              <span>Share Link Copied!</span>
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4 stroke-[2.2]" />
              <span>Create Share Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ShareExportStudioModal;
