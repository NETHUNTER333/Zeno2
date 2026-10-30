import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ArrowUp,
  Square,
  History,
  X,
  FileText,
  Globe,
  ImageIcon,
  Code2,
  Table,
  Music,
  Film,
  File,
  UploadCloud,
  FileSpreadsheet,
  Trash2,
  Sparkles,
  Compass,
  Link2,
  GraduationCap,
  Layers,
  Zap,
} from 'lucide-react';
import { ModelOption, GROK_MODELS, getDefaultVisionModel } from '../GrokModelPicker';
import { SearchMode, ChatAttachment, ChatMessage } from '../../types';
import { ChatHistory, ChatHistoryItem, ChatHistoryMessageItem } from './chat-history';
import { extractTextFromPdfFile } from '../../lib/pdfStudyEngine';
import { UserAccountStore } from '../../lib/userAccountStore';
import type { PdfStudioTab } from '../InbuiltPdfViewer';

export interface PdfStudioLaunchPayload {
  pdfUrl?: string;
  pdfName?: string;
  extractedText?: string;
  initialTab?: PdfStudioTab;
}

interface ChatInputProps {
  onSend: (message: string, searchMode: SearchMode, attachments?: ChatAttachment[]) => void;
  onCancel?: () => void;
  isRunning: boolean;
  searchMode: SearchMode;
  onToggleSearchMode: (mode: SearchMode) => void;
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  placeholder?: string;
  autoFocus?: boolean;
  theme?: 'dark' | 'light';
  recentPrompts?: string[];
  recentMessageItems?: ChatHistoryMessageItem[];
  historicalThreads?: ChatHistoryItem[];
  onSelectThread?: (threadId: string) => void;
  onSelectMessage?: (messageId: string, threadId: string, content: string) => void;
  lastAssistantResponse?: string;
  messages?: ChatMessage[];
  isResearchMode?: boolean;
  onToggleResearchMode?: (enabled: boolean) => void;
  onOpenDeepResearch?: (initialTopic?: string) => void;
  onOpenUrlReader?: (initialUrl?: string) => void;
  onOpenArxivReader?: (payload?: PdfStudioLaunchPayload) => void;
}

// Format file sizes into human-readable strings
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Detect file category and theme accent color
export function getFileCategory(name: string, type: string): {
  category: 'image' | 'pdf' | 'code' | 'data' | 'audio' | 'video' | 'document' | 'other';
  color: string;
} {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff'].includes(ext)) {
    return { category: 'image', color: 'text-blue-500' };
  }
  if (type.includes('pdf') || ext === 'pdf') {
    return { category: 'pdf', color: 'text-red-500' };
  }
  if (
    type.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'wma'].includes(ext)
  ) {
    return { category: 'audio', color: 'text-amber-500' };
  }
  if (
    type.startsWith('video/') ||
    ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'flv'].includes(ext)
  ) {
    return { category: 'video', color: 'text-purple-500' };
  }
  if (
    ['json', 'csv', 'tsv', 'xlsx', 'xls', 'parquet'].includes(ext) ||
    type.includes('csv') ||
    type.includes('json')
  ) {
    return { category: 'data', color: 'text-emerald-500' };
  }
  if (
    [
      'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs',
      'php', 'rb', 'swift', 'kt', 'sql', 'html', 'css', 'scss', 'xml', 'yaml', 'yml',
      'sh', 'bash', 'env', 'toml', 'ini', 'dockerfile', 'vue', 'svelte', 'r', 'm'
    ].includes(ext)
  ) {
    return { category: 'code', color: 'text-cyan-500' };
  }
  if (['doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'tex', 'log'].includes(ext)) {
    return { category: 'document', color: 'text-indigo-500' };
  }
  return { category: 'other', color: 'text-neutral-400' };
}

// Convert an image File into a pristine high-resolution base64 data URL
async function readImageFileAsDataUrl(file: File): Promise<{ url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      // For images under 15MB or SVGs, preserve 100% native resolution and quality
      if (file.size < 15 * 1024 * 1024 || file.type.includes('svg')) {
        // Compress large images (>500KB) to max 1024px to avoid edge/proxy body limits
        if (file.size > 500 * 1024 && !file.type.includes('svg')) {
          const img = new Image();
          img.onerror = () => resolve({ url: rawDataUrl, width: 0, height: 0 });
          img.onload = () => {
            const maxDim = 1024;
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              if (width >= height) { height = Math.round((height * maxDim) / width); width = maxDim; }
              else { width = Math.round((width * maxDim) / height); height = maxDim; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.8);
            resolve({ url: compressed, width, height });
          };
          img.src = rawDataUrl;
          return;
        }
        const img = new Image();
        img.onerror = () => resolve({ url: rawDataUrl, width: 0, height: 0 });
        img.onload = () =>
          resolve({
            url: rawDataUrl,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
          });
        img.src = rawDataUrl;
        return;
      }

      // For massive images (>15MB), preserve high resolution up to 4096px
      const img = new Image();
      img.onerror = () => resolve({ url: rawDataUrl, width: 0, height: 0 });
      img.onload = () => {
        const maxDim = 4096;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL(file.type || 'image/jpeg', 0.94);
            resolve({ url: compressed, width, height });
            return;
          }
        } catch {}
        resolve({ url: rawDataUrl, width: img.width, height: img.height });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// Convert any text or code file into string (up to 200,000 characters)
async function readTextFileAsString(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve('');
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(0, 200000));
    };
    reader.readAsText(file);
  });
}

// Process any uploaded file with support for unlimited formats and large sizes
async function processUploadedFile(file: File): Promise<ChatAttachment> {
  const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg|bmp|ico|tiff)$/i.test(file.name);
  const isPdf = file.type.includes('pdf') || /\.pdf$/i.test(file.name);
  const isTextLike =
    file.type.startsWith('text/') ||
    /\.(md|txt|json|csv|tsv|ts|tsx|js|jsx|py|c|cpp|h|hpp|cs|go|rs|java|kt|swift|sql|html|css|scss|xml|yaml|yml|sh|bash|log|env|ini|conf|toml|diff|patch|vue|svelte|rb|php|r|m|scala)$/i.test(
      file.name
    );

  let dataUrl: string | undefined;
  let textContent: string | undefined;
  let width: number | undefined;
  let height: number | undefined;

  if (isImage) {
    try {
      const res = await readImageFileAsDataUrl(file);
      dataUrl = res.url;
      width = res.width;
      height = res.height;
    } catch {}
  } else if (isPdf) {
    try {
      const [readDataUrl, extractedPdf] = await Promise.all([
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Read error'));
          reader.readAsDataURL(file);
        }),
        extractTextFromPdfFile(file, file.name),
      ]);
      dataUrl = readDataUrl;
      textContent = extractedPdf.text;
    } catch {}
  } else if (isTextLike) {
    try {
      textContent = await readTextFileAsString(file);
    } catch {}
  } else {
    // Audio, Video, Datasets, Archives, Binaries
    try {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Read error'));
        reader.readAsDataURL(file);
      });
    } catch {}
  }

  return {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    url: dataUrl,
    dataUrl: dataUrl,
    textContent,
    width,
    height,
  };
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onCancel,
  isRunning,
  searchMode,
  onToggleSearchMode,
  selectedModel,
  onSelectModel,
  placeholder = 'What do you want to know?',
  autoFocus = false,
  theme = 'dark',
  recentPrompts = [],
  recentMessageItems = [],
  onSelectMessage,
  messages = [],
  isResearchMode = false,
  onToggleResearchMode,
  onOpenDeepResearch,
  onOpenUrlReader,
  onOpenArxivReader,
}) => {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [readingFileProgress, setReadingFileProgress] = useState<string>('');
  const [uploadLimitWarning, setUploadLimitWarning] = useState<string | null>(null);
  const [usageQuota, setUsageQuota] = useState(() => UserAccountStore.getUsage());
  const [currentPlan, setCurrentPlan] = useState(() => UserAccountStore.getNormalizedPlan());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';
  const isEmpty = !value.trim() && attachments.length === 0;

  useEffect(() => {
    const syncQuota = () => {
      setUsageQuota(UserAccountStore.getUsage());
      setCurrentPlan(UserAccountStore.getNormalizedPlan());
    };
    window.addEventListener('zeno-account-updated', syncQuota);
    return () => window.removeEventListener('zeno-account-updated', syncQuota);
  }, []);

  const openPricingModal = (highlightPlan: 'spark' | 'fire' = 'spark', reason?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('zeno-open-pricing', {
          detail: { highlightPlan, reason },
        })
      );
    }
  };

  // Detect if user typed or pasted a standalone or inline URL
  const detectedUrl = React.useMemo(() => {
    const match = value.match(/https?:\/\/[^\s"'<>]+/i);
    return match ? match[0].replace(/[.,;:!?)]$/, '') : null;
  }, [value]);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-expanding textarea up to 120px max
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 24), 120)}px`;
    }
  }, [value]);

  // Click outside listener for dropups
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = () => {
    if (isRunning) {
      onCancel?.();
      return;
    }
    if (isEmpty) return;
    onSend(value.trim(), searchMode, attachments.length > 0 ? attachments : undefined);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp' && isEmpty && !e.shiftKey) {
      e.preventDefault();
      setIsHistoryOpen(true);
    }
  };

  const addFilesList = async (fileList: File[]) => {
    if (fileList.length === 0) return;

    const latestUsage = UserAccountStore.getUsage();
    const totalUsedAfterCurrent = latestUsage.filesUploaded + attachments.length;
    const remainingDailySlots = Math.max(0, latestUsage.fileUploadLimit - totalUsedAfterCurrent);
    const remainingPerMessageSlots = Math.max(0, latestUsage.maxFilesPerMessage - attachments.length);
    const allowedSlots = Math.min(remainingDailySlots, remainingPerMessageSlots);

    if (allowedSlots <= 0) {
      const msg =
        currentPlan === 'spark'
          ? `Daily file upload limit reached (${latestUsage.fileUploadLimit}/250 files used on Spark). Upgrade to Fire ($5/mo) for unlimited file uploads.`
          : `Please choose a plan to upload files — Spark ($1/mo for 250 uploads/day) or Fire ($5/mo for unlimited uploads).`;
      setUploadLimitWarning(msg);
      openPricingModal(currentPlan === 'spark' ? 'fire' : 'spark', msg);
      return;
    }

    let filesToProcess = fileList;
    if (fileList.length > allowedSlots) {
      filesToProcess = fileList.slice(0, allowedSlots);
      const msg =
        currentPlan === 'spark'
          ? `Attached ${allowedSlots} file(s) up to your Spark plan limit (250 uploads/day). Upgrade to Fire ($5/mo) for unlimited uploads.`
          : `Select Spark ($1/mo) or Fire ($5/mo) to upload more files.`;
      setUploadLimitWarning(msg);
    } else {
      setUploadLimitWarning(null);
    }

    setIsReadingFiles(true);
    setReadingFileProgress(
      `Reading ${filesToProcess.length} ${filesToProcess.length === 1 ? 'file' : 'files'}...`
    );
    try {
      const processed = await Promise.all(filesToProcess.map((f) => processUploadedFile(f)));
      setAttachments((prev) => [...prev, ...processed]);
      const defaultVision = getDefaultVisionModel();
      if (!selectedModel.supportsVision) {
        onSelectModel(defaultVision);
      }
    } finally {
      setIsReadingFiles(false);
      setReadingFileProgress('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await addFilesList(fileArray);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) pastedFiles.push(f);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      await addFilesList(pastedFiles);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const totalAttachmentBytes = attachments.reduce((acc, att) => acc + (att.size || 0), 0);

  return (
    <div
      className="relative mx-auto w-full max-w-3xl"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          await addFilesList(Array.from(e.dataTransfer.files));
        }
      }}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 rounded-3xl border-2 border-dashed border-[#007aff] bg-[#007aff]/10 backdrop-blur-md flex flex-col items-center justify-center gap-2 pointer-events-none animate-in fade-in duration-100 shadow-[0_0_30px_rgba(0,122,255,0.3)]">
          <UploadCloud className="w-8 h-8 text-[#007aff] animate-bounce" />
          <span className="text-xs font-semibold text-white drop-shadow-md">
            Drop any files, photos, code, or documents to upload
          </span>
          <span className="text-[10px] text-white/70">
            Multi-file upload • Unlimited formats & sizes
          </span>
        </div>
      )}

      {/* In-Chat History Popover (@kobra/chat-history strictly isolated to current active session) */}
      <ChatHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        recentPrompts={recentPrompts}
        recentMessageItems={recentMessageItems}
        onSelectPrompt={(prompt) => {
          setValue(prompt);
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
          }
        }}
        onSelectMessage={(msgId, thrId, prompt) => {
          setValue(prompt);
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
          }
          onSelectMessage?.(msgId, thrId, prompt);
        }}
        isDark={isDark}
      />

      {/* Hidden Universal Multi-File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="*/*"
        className="hidden"
        multiple
      />

      {/* File Upload Limit Warning Banner */}
      {uploadLimitWarning && (
        <div className="px-3 pb-2.5 animate-in fade-in duration-150">
          <div
            className={`p-3.5 sm:px-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
              isDark
                ? 'bg-[#141418] border-white/15 text-white shadow-lg'
                : 'bg-white border-black/12 text-[#18181b] shadow-md'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <span>{uploadLimitWarning}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  openPricingModal(
                    currentPlan === 'free' ? 'spark' : 'fire',
                    uploadLimitWarning
                  )
                }
                className={`px-3.5 py-1.5 rounded-full font-semibold text-[11px] cursor-pointer whitespace-nowrap transition-colors ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-[#18181b] text-white hover:bg-neutral-800'
                }`}
              >
                Upgrade ($1 Spark / $5 Fire)
              </button>
              <button
                type="button"
                onClick={() => setUploadLimitWarning(null)}
                className="p-1 opacity-60 hover:opacity-100 cursor-pointer"
                aria-label="Dismiss limit alert"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Container & Cumulative Size Summary */}
      {(attachments.length > 0 || isReadingFiles) && (
        <div className="px-3 pb-2 flex flex-col gap-1.5 animate-in fade-in duration-150">
          {/* Header Summary Row */}
          <div className="flex items-center justify-between text-[11px] px-1 select-none">
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                {attachments.length} {attachments.length === 1 ? 'file attached' : 'files attached'}
              </span>
              <span className="text-[10px] font-mono opacity-65">
                ({usageQuota.filesUploaded + attachments.length}/
                {usageQuota.fileUploadLimit >= 999999 ? '∞' : usageQuota.fileUploadLimit} plan limit)
              </span>
              {totalAttachmentBytes > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  isDark ? 'bg-white/10 text-white/70' : 'bg-black/5 text-black/70'
                }`}>
                  {formatFileSize(totalAttachmentBytes)} total
                </span>
              )}
            </div>

            {attachments.length > 1 && (
              <button
                type="button"
                onClick={() => setAttachments([])}
                className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity text-[10px] font-medium cursor-pointer"
                title="Remove all attachments"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear all</span>
              </button>
            )}
          </div>

          {/* Scrollable / Wrapping Chip List */}
          <div className="flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto scrollbar-thin">
            {attachments.map((file, idx) => {
              const { category } = getFileCategory(file.name, file.type);
              const isImg = category === 'image' && file.url;
              const isStudylike = category === 'pdf' || category === 'document';
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (isStudylike && onOpenArxivReader) {
                      onOpenArxivReader({
                        pdfUrl: file.url || file.dataUrl,
                        pdfName: file.name,
                        extractedText: file.textContent || '',
                        initialTab: 'quiz',
                      });
                    }
                  }}
                  className={`group/chip flex items-center gap-2 pl-2.5 pr-2.5 py-1.5 rounded-2xl border text-xs font-medium shadow-xs transition-all ${
                    isStudylike ? 'cursor-pointer' : ''
                  } ${
                    isDark
                      ? 'bg-[#18181b] border-white/15 text-white hover:border-white/30'
                      : 'bg-white border-[#e4e4e7] text-neutral-900 shadow-xs hover:border-neutral-400'
                  }`}
                  title={
                    isStudylike
                      ? `Click to open ${file.name} in PDF Quiz & Flashcards Studio`
                      : `${file.name} (${formatFileSize(file.size)})`
                  }
                >
                  {isImg ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-5 h-5 rounded-lg object-cover shrink-0 border border-black/10"
                    />
                  ) : category === 'pdf' ? (
                    <FileText className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  ) : category === 'code' ? (
                    <Code2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  ) : category === 'data' ? (
                    <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  ) : category === 'audio' ? (
                    <Music className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  ) : category === 'video' ? (
                    <Film className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  ) : (
                    <File className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  )}

                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="truncate max-w-[140px] text-[11px] font-medium leading-none">
                      {file.name}
                    </span>
                    <span className="text-[9px] font-mono shrink-0 opacity-60">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttachment(idx);
                    }}
                    className="p-0.5 rounded-full hover:opacity-100 opacity-50 transition-opacity cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
                    title={`Remove ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {isReadingFiles && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium border ${
                  isDark
                    ? 'bg-[#18181b] border-white/15 text-white'
                    : 'bg-white border-black/10 text-[#18181b]'
                }`}
              >
                <span className="size-2 rounded-full bg-current animate-ping" />
                <span>{readingFileProgress || 'Processing files...'}</span>
              </div>
            )}
          </div>

          {/* Padded PDF Study Studio Instant Pop-up Bar when a PDF or Document is uploaded */}
          {onOpenArxivReader &&
            attachments.some((a) => {
              const cat = getFileCategory(a.name, a.type).category;
              return cat === 'pdf' || cat === 'document';
            }) && (() => {
              const targetDoc =
                attachments.find((a) => getFileCategory(a.name, a.type).category === 'pdf') ||
                attachments.find((a) => getFileCategory(a.name, a.type).category === 'document');
              if (!targetDoc) return null;
              return (
                <div
                  className={`mt-1 p-3 sm:px-4 sm:py-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2 transition-all ${
                    isDark
                      ? 'bg-[#141418] border-white/[0.14] text-white shadow-lg'
                      : 'bg-white border-black/[0.1] text-neutral-900 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`size-8 rounded-xl border flex items-center justify-center shrink-0 ${
                        isDark
                          ? 'bg-white/[0.06] border-white/15 text-white'
                          : 'bg-[#f4f4f5] border-black/10 text-[#18181b]'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-semibold truncate">
                        PDF Study & Assessment Studio Ready
                      </div>
                      <div className="text-[10px] opacity-60 truncate">
                        Launch study workspace for {targetDoc.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {(
                      [
                        { tab: 'quiz', label: 'Quiz' },
                        { tab: 'flashcards', label: 'Flashcards' },
                        { tab: 'summary', label: 'Summary' },
                        { tab: 'cheatsheet', label: 'Cheatsheet' },
                      ] as const
                    ).map((btn) => (
                      <button
                        key={btn.tab}
                        type="button"
                        onClick={() =>
                          onOpenArxivReader({
                            pdfUrl: targetDoc.url || targetDoc.dataUrl,
                            pdfName: targetDoc.name,
                            extractedText: targetDoc.textContent || '',
                            initialTab: btn.tab,
                          })
                        }
                        className={`px-3 py-1 rounded-full border text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          btn.tab === 'quiz'
                            ? isDark
                              ? 'bg-white text-black border-white hover:bg-neutral-200'
                              : 'bg-black text-white border-black hover:bg-neutral-800'
                            : isDark
                            ? 'bg-white/[0.06] border-white/[0.12] text-neutral-200 hover:bg-white/[0.14]'
                            : 'bg-black/[0.04] border-black/[0.1] text-neutral-800 hover:bg-black/[0.08]'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {/* Detected URL Instant Action Bar */}
      {detectedUrl && onOpenUrlReader && (
        <div className="px-2 pb-2.5 animate-in fade-in duration-150">
          <div
            className={`flex items-center justify-between gap-3 pl-4 pr-2 py-2 rounded-full border text-xs ${
              isDark
                ? 'bg-[#141418] border-white/15 text-white shadow-lg'
                : 'bg-white border-black/10 text-[#18181b] shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Link2 className="w-3.5 h-3.5 opacity-70 shrink-0" />
              <span className="truncate font-mono text-[11px] opacity-80">{detectedUrl}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onOpenUrlReader(detectedUrl);
                }}
                className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isDark
                    ? 'bg-white text-[#18181b] hover:bg-neutral-200'
                    : 'bg-[#18181b] text-white hover:bg-neutral-800'
                }`}
              >
                Open in URL Reader & Summarizer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Solid Padded Monochrome Pill Chat Input Shell */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className={`group/composer relative rounded-full border transition-all duration-200 pl-2.5 sm:pl-3.5 pr-2 py-1.5 sm:py-2 flex items-center gap-2 ${
          isDark
            ? 'bg-[#141418] border-white/[0.15] focus-within:border-white/[0.3] shadow-[0_12px_36px_rgba(0,0,0,0.65)]'
            : 'bg-white border-black/[0.12] focus-within:border-black/[0.25] shadow-[0_8px_28px_rgba(0,0,0,0.08)]'
        }`}
      >
        {/* Left Plus Button with Solid Padded Monochrome Upward Dropup Menu */}
        <div className="relative flex items-center shrink-0" ref={plusMenuRef}>
          <button
            type="button"
            onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
            className={`relative size-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isPlusMenuOpen
                ? isDark
                  ? 'bg-white text-black'
                  : 'bg-[#18181b] text-white'
                : isDark
                ? 'bg-white/[0.06] text-[#d4d4d8] hover:text-white hover:bg-white/[0.12]'
                : 'bg-[#f4f4f5] text-[#52525b] hover:text-[#18181b] hover:bg-neutral-200/80'
            }`}
            title="Attach files, images, code, or toggle Research mode"
            aria-label="Add files or options"
          >
            <Plus className="w-4 h-4 stroke-[2.2]" />
            {isResearchMode && (
              <span
                className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ${
                  isDark ? 'bg-white ring-[#141418]' : 'bg-[#18181b] ring-white'
                }`}
                title="Research mode is active"
              />
            )}
          </button>

          {/* Ultra-Compact Monochrome Pill Plus Menu Dropup (No icons, no lines, small font) */}
          {isPlusMenuOpen && (
            <div
              className={`absolute bottom-full left-0 mb-2.5 w-48 rounded-2xl border p-1.5 z-50 text-[11px] font-normal animate-in fade-in zoom-in-95 duration-150 ${
                isDark
                  ? 'bg-[#141418] border-white/[0.12] text-white/90 shadow-[0_16px_40px_rgba(0,0,0,0.85)]'
                  : 'bg-white border-black/[0.1] text-[#18181b] shadow-[0_16px_40px_rgba(0,0,0,0.14)]'
              }`}
            >
              {/* Compact Pill Quota Row */}
              <div
                className={`mb-1 px-2.5 py-1 rounded-full border flex items-center justify-between text-[10px] font-normal ${
                  isDark
                    ? 'bg-[#1c1c22] border-white/[0.08] text-white/80'
                    : 'bg-[#f4f4f5] border-black/[0.06] text-[#18181b]/80'
                }`}
              >
                <span>
                  Uploads {usageQuota.filesUploaded + attachments.length}/
                  {usageQuota.fileUploadLimit >= 999999 ? '∞' : usageQuota.fileUploadLimit}
                </span>
                {currentPlan !== 'fire' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      openPricingModal(currentPlan === 'free' ? 'spark' : 'fire');
                    }}
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-normal transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-[#18181b] text-white hover:bg-neutral-800'
                    }`}
                  >
                    {currentPlan === 'free' ? 'Spark $1' : 'Fire $5'}
                  </button>
                )}
              </div>

              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = '*/*';
                      fileInputRef.current.click();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-full text-left text-[11px] font-normal transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-[#f4f4f5]'
                  }`}
                >
                  <span className="truncate">Attach Files</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'image/*';
                      fileInputRef.current.click();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-full text-left text-[11px] font-normal transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-[#f4f4f5]'
                  }`}
                >
                  <span className="truncate">Photos & Images</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = '.pdf,application/pdf';
                      fileInputRef.current.click();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-full text-left text-[11px] font-normal transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-[#f4f4f5]'
                  }`}
                >
                  <span className="truncate">PDF Document</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    if (fileInputRef.current) {
                      fileInputRef.current.accept =
                        '.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.csv,.sql,.md,.txt,.log,.xml,.yaml,.yml,.sh,.env,.tsv,.c,.cpp';
                      fileInputRef.current.click();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-full text-left text-[11px] font-normal transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-[#f4f4f5]'
                  }`}
                >
                  <span className="truncate">Code & Data</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    onToggleSearchMode(searchMode === 'off' ? 'organic' : 'off');
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-full text-left text-[11px] font-normal transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-[#f4f4f5]'
                  }`}
                >
                  <span className="truncate">Web Search</span>
                  <span
                    className={`text-[9.5px] px-2 py-0.5 rounded-full font-normal border ${
                      searchMode !== 'off'
                        ? isDark
                          ? 'bg-white text-black border-white'
                          : 'bg-[#18181b] text-white border-[#18181b]'
                        : isDark
                        ? 'bg-white/[0.04] border-white/10 text-white/50'
                        : 'bg-[#f4f4f5] border-black/10 text-black/50'
                    }`}
                  >
                    {searchMode === 'off' ? 'Off' : 'On'}
                  </span>
                </button>

                {onOpenDeepResearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenDeepResearch(value.trim() || undefined);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-full text-left text-[11px] font-normal transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-[#f4f4f5]'
                    }`}
                  >
                    <span className="truncate">Deep Research</span>
                  </button>
                )}

                {onOpenUrlReader && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenUrlReader(detectedUrl || undefined);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-full text-left text-[11px] font-normal transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-[#f4f4f5]'
                    }`}
                  >
                    <span className="truncate">URL Reader</span>
                  </button>
                )}

                {onOpenArxivReader && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      const attachedPdf = attachments.find(
                        (a) => getFileCategory(a.name, a.type).category === 'pdf'
                      );
                      if (attachedPdf) {
                        onOpenArxivReader({
                          pdfUrl: attachedPdf.url || attachedPdf.dataUrl,
                          pdfName: attachedPdf.name,
                          extractedText: attachedPdf.textContent || '',
                          initialTab: 'quiz',
                        });
                      } else {
                        onOpenArxivReader({ initialTab: 'quiz' });
                      }
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-full text-left text-[11px] font-normal transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-[#f4f4f5]'
                    }`}
                  >
                    <span className="truncate">PDF Study Studio</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Text Input Field */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            attachments.length > 0
              ? `Ask about your ${attachments.length} ${attachments.length === 1 ? 'upload' : 'uploads'}...`
              : placeholder
          }
          rows={1}
          dir="auto"
          className={`flex-1 min-h-[24px] max-h-32 resize-none bg-transparent py-0.5 text-[14px] leading-5 outline-none font-sans font-normal ${
            isDark ? 'text-white placeholder-[#71717a]' : 'text-neutral-900 placeholder-[#71717a]'
          }`}
        />

        {/* Right Action Cluster (History + Send/Stop) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 select-none">

          {/* In-Chat History Trigger Button */}
          <button
            type="button"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`size-7 sm:size-7.5 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isHistoryOpen
                ? isDark
                  ? 'bg-white/15 text-white'
                  : 'bg-black/10 text-neutral-900'
                : isDark
                ? 'text-[#a1a1aa] hover:text-white hover:bg-white/[0.08]'
                : 'text-[#71717a] hover:text-[#18181b] hover:bg-black/[0.05]'
            }`}
            title="In-chat history (or press ↑)"
            aria-label="In-chat prompt history"
          >
            <History className="w-3.5 h-3.5" />
          </button>

          {/* Clean Send / Stop Button */}
          {isRunning ? (
            <button
              type="button"
              onClick={handleSubmit}
              className={`size-8 sm:size-8.5 rounded-full flex items-center justify-center shadow-xs cursor-pointer shrink-0 transition-transform active:scale-95 ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-white/20'
                  : 'bg-neutral-900 hover:bg-black text-white'
              }`}
              title="Stop generation"
              aria-label="Stop generation"
            >
              <Square className="w-3 h-3 fill-current text-current" />
            </button>
          ) : !isEmpty ? (
            <button
              type="button"
              onClick={handleSubmit}
              className={`size-8 sm:size-8.5 rounded-full flex items-center justify-center shadow-md cursor-pointer shrink-0 transition-transform active:scale-95 ${
                isDark
                  ? 'bg-white hover:bg-neutral-200 text-black'
                  : 'bg-black hover:bg-neutral-800 text-white'
              }`}
              title="Send message"
              aria-label="Send message"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          ) : (
            <div
              className={`size-8 sm:size-8.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                isDark ? 'bg-white/[0.06] text-neutral-600' : 'bg-black/[0.05] text-neutral-400'
              }`}
              aria-hidden="true"
            >
              <ArrowUp className="w-4 h-4 stroke-[2]" />
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
