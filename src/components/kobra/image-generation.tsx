import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Download,
  RefreshCw,
  Maximize2,
  X,
  Check,
  Copy,
  Sliders,
} from 'lucide-react';

export interface ImageGenerationCardProps {
  prompt: string;
  initialAspectRatio?: '1:1' | '16:9' | '9:16';
  isDark?: boolean;
  fallbackImages?: { imageUrl: string; title?: string }[];
}

export function detectImageGenerationIntent(query: string): string | null {
  if (!query) return null;
  const cleanQ = query.trim();
  // Never trigger AI image generation when the user is asking to fetch/show/find real web images
  if (/\b(fetch|fentch|featch|fetech|search|find|show|get|lookup|browse)\b/i.test(cleanQ)) {
    return null;
  }
  const match = cleanQ.match(
    /\b(?:generate|create|draw|render|design|paint|illustrate)\s+(?:an?\s+)?(?:ai\s+)?(?:image|picture|photo|illustration|artwork|wallpaper|poster|logo|concept art)\s+(?:of\s+|showing\s+|for\s+)?(.+)/i
  );
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

export const ImageGenerationCard: React.FC<ImageGenerationCardProps> = ({
  prompt: initialPrompt,
  initialAspectRatio = '16:9',
  isDark = true,
  fallbackImages = [],
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>(initialAspectRatio);
  const [stylePreset, setStylePreset] = useState<'Photorealistic' | 'Monochrome Editorial' | 'Cinematic' | 'Architectural'>('Photorealistic');
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 9000) + 1000);
  const [isLoading, setIsLoading] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [imgError, setImgError] = useState(false);

  const dimensions =
    aspectRatio === '1:1'
      ? { w: 1024, h: 1024 }
      : aspectRatio === '9:16'
      ? { w: 768, h: 1344 }
      : { w: 1280, h: 720 };

  const fullPrompt = `${prompt}, ${stylePreset.toLowerCase()} style, high detail, masterpiece`;
  const generatedUrl =
    !imgError
      ? `https://image.pollinations.ai/prompt/${encodeURIComponent(
          fullPrompt
        )}?width=${dimensions.w}&height=${dimensions.h}&seed=${seed}&nologo=true`
      : fallbackImages[0]?.imageUrl || '';

  const handleRegenerate = () => {
    setImgError(false);
    setIsLoading(true);
    setSeed((prev) => prev + 137);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(fullPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div
      data-slot="kobra-image-generation"
      className={`my-3.5 rounded-3xl border p-4 sm:p-5 transition-all ${
        isDark
          ? 'bg-[#141418] border-white/[0.12] text-white shadow-[0_16px_40px_rgba(0,0,0,0.55)]'
          : 'bg-white border-black/[0.1] text-[#18181b] shadow-[0_12px_32px_rgba(0,0,0,0.07)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`size-10 rounded-2xl border flex items-center justify-center shrink-0 ${
              isDark
                ? 'bg-white/[0.06] border-white/15 text-white'
                : 'bg-[#f4f4f5] border-black/10 text-[#18181b]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base">Image Generation Studio</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase border ${
                  isDark
                    ? 'bg-white/[0.06] border-white/15 text-white/80'
                    : 'bg-[#f4f4f5] border-black/10 text-[#18181b]'
                }`}
              >
                {aspectRatio}
              </span>
            </div>
            <p className="text-xs opacity-65 truncate mt-0.5">{prompt}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyPrompt}
            className={`size-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'bg-white/[0.05] border-white/10 hover:bg-white/12'
                : 'bg-[#f4f4f5] border-black/10 hover:bg-neutral-200'
            }`}
            title="Copy prompt"
          >
            {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              isDark
                ? 'bg-white text-black border-white hover:bg-neutral-200'
                : 'bg-[#18181b] text-white border-[#18181b] hover:bg-neutral-800'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Aspect Ratio & Style Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Sliders className="w-3.5 h-3.5 opacity-60 mr-1" />
          {(['Photorealistic', 'Monochrome Editorial', 'Cinematic', 'Architectural'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStylePreset(st);
                  setIsLoading(true);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                  stylePreset === st
                    ? isDark
                      ? 'bg-white text-black border-white'
                      : 'bg-[#18181b] text-white border-[#18181b]'
                    : isDark
                    ? 'bg-white/[0.04] border-white/10 text-neutral-300 hover:bg-white/10'
                    : 'bg-[#f4f4f5] border-black/10 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {st}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-1">
          {(['16:9', '1:1', '9:16'] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => {
                setAspectRatio(ratio);
                setIsLoading(true);
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all cursor-pointer ${
                aspectRatio === ratio
                  ? isDark
                    ? 'bg-white text-black border-white font-bold'
                    : 'bg-[#18181b] text-white border-[#18181b] font-bold'
                  : isDark
                  ? 'bg-white/[0.04] border-white/10 text-neutral-400'
                  : 'bg-[#f4f4f5] border-black/10 text-neutral-600'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Image Viewport */}
      {generatedUrl && (
        <div
          className={`relative rounded-2xl overflow-hidden border flex items-center justify-center ${
            aspectRatio === '1:1'
              ? 'aspect-square max-h-[420px]'
              : aspectRatio === '9:16'
              ? 'aspect-[9/16] max-h-[460px]'
              : 'aspect-video max-h-[400px]'
          } w-full mx-auto ${
            isDark ? 'bg-[#0b0b0e] border-white/10' : 'bg-[#f4f4f5] border-black/10'
          }`}
        >
          <img
            src={generatedUrl}
            alt={prompt}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setImgError(true);
            }}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => setIsLightboxOpen(true)}
          />

          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              className="px-3 py-1.5 rounded-full bg-black/80 hover:bg-black text-white border border-white/15 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Inspect</span>
            </button>
            <a
              href={generatedUrl}
              target="_blank"
              rel="noopener noreferrer"
              download="zeno-generated.jpg"
              className="px-3 py-1.5 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-semibold inline-flex items-center gap-1.5 !no-underline cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>
        </div>
      )}

      {isLightboxOpen && generatedUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="fixed top-5 right-5 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={generatedUrl}
            alt={prompt}
            className="max-w-full max-h-[88vh] rounded-2xl object-contain border border-white/15"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default ImageGenerationCard;
