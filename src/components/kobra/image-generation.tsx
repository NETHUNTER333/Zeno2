import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, RefreshCw, X } from 'lucide-react';

export interface ImageGenerationProps {
  src?: string;
  alt?: string;
  prompt?: string;
  resolution?: string;
  progress?: number;
  step?: string;
  className?: string;
  initialAspectRatio?: '1:1' | '16:9' | '9:16' | '3:2';
  isDark?: boolean;
  fallbackImages?: { imageUrl: string; title?: string }[];
}

export type ImageGenerationCardProps = ImageGenerationProps;

/**
 * Detects when a user prompt is asking to generate/create/draw an AI image
 * rather than searching the web.
 */
export function detectImageGenerationIntent(query: string): string | null {
  if (!query) return null;
  const cleanQ = query.trim();

  // Explicit creation / generation / drawing patterns
  const patterns: RegExp[] = [
    /^(?:please\s+|can\s+you\s+|could\s+you\s+|yo\s+|hey\s+|bro\s+)*(?:generate|create|make|render|design|paint|illustrate|produce|craft)\s+(?:me\s+)?(?:an?\s+|some\s+|the\s+)?(?:ai\s+|new\s+|cool\s+|realistic\s+|hd\s+|4k\s+|cinematic\s+)?(?:image|picture|photo|photograph|illustration|artwork|art|wallpaper|poster|logo|avatar|icon|drawing|sketch|painting|portrait|concept\s+art|scene|visual|graphic|banner|thumbnail)s?\s*(?:of|for|showing|with|featuring|depicting|about|:|-)?\s*(.+)/i,
    /^(?:please\s+|can\s+you\s+|could\s+you\s+|yo\s+|hey\s+|bro\s+)*(?:draw|paint|sketch|illustrate|imagine)\s+(?:me\s+)?(?:an?\s+)?(.+)/i,
    /\b(?:generate|create|make)\s+(?:me\s+)?(?:an?\s+)(?:ai\s+)?(?:image|picture|photo|wallpaper|illustration|artwork|poster|logo)\s+(?:of|for|showing|with|depicting)\s+(.+)/i,
  ];

  for (const regex of patterns) {
    const match = cleanQ.match(regex);
    if (match && match[1]) {
      const extracted = match[1]
        .replace(/\b(?:please|pls|plz|bro|broo+|ok|okay|right\s+now|for\s+me)\s*$/i, '')
        .trim();
      if (extracted.length >= 2) {
        return extracted;
      }
    }
  }

  return null;
}

function getStepLabel(progress: number, customStep?: string): string {
  if (customStep) return customStep;
  if (progress < 28) return 'Composing scene';
  if (progress < 62) return 'Shaping forms';
  if (progress < 88) return 'Refining details';
  return 'Finishing image';
}

const DOT_DELAYS = [
  '-1.2s',
  '-0.96s',
  '-0.72s',
  '-0.96s',
  '-0.72s',
  '-0.48s',
  '-0.72s',
  '-0.48s',
  '-0.24s',
];

/**
 * @kobra/image-generation
 * A canvas forming dynamically while an AI image is generated.
 */
export const ImageGeneration: React.FC<ImageGenerationProps> = ({
  src,
  alt,
  prompt: initialPrompt = '',
  resolution = '1536 × 1024',
  progress: controlledProgress,
  step: controlledStep,
  className = '',
  initialAspectRatio = '3:2',
  isDark = true,
}) => {
  const effectivePrompt = (initialPrompt || alt || 'Cinematic landscape at golden hour').trim();
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 89999) + 10000);
  const [phase, setPhase] = useState<'forming' | 'revealing' | 'ready'>('forming');
  const [internalProgress, setInternalProgress] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [fallbackAttempt, setFallbackAttempt] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dimensions =
    initialAspectRatio === '1:1'
      ? { w: 1024, h: 1024, ratio: 1, label: '1024 × 1024' }
      : initialAspectRatio === '9:16'
      ? { w: 768, h: 1152, ratio: 2 / 3, label: '1024 × 1536' }
      : initialAspectRatio === '16:9'
      ? { w: 1280, h: 720, ratio: 16 / 9, label: '1536 × 864' }
      : { w: 1152, h: 768, ratio: 1.5, label: resolution || '1536 × 1024' };

  const buildImageUrl = () => {
    if (src) return src;
    return `/api/media/generate-image?prompt=${encodeURIComponent(
      effectivePrompt
    )}&width=${dimensions.w}&height=${dimensions.h}&seed=${seed}${
      fallbackAttempt > 0 ? '&fallback=1' : ''
    }`;
  };

  const imageUrl = buildImageUrl();
  const displayProgress =
    typeof controlledProgress === 'number' ? controlledProgress : internalProgress;
  const currentStepText = getStepLabel(displayProgress, controlledStep);

  // Smooth autonomous progress counter while in forming phase
  useEffect(() => {
    if (phase === 'ready') {
      setInternalProgress(100);
      return;
    }
    setInternalProgress(6);
    const interval = window.setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 92) return prev;
        const stepInc = prev < 40 ? 4.5 : prev < 75 ? 2.4 : 0.8;
        return Math.min(92, Number((prev + stepInc).toFixed(1)));
      });
    }, 180);
    return () => window.clearInterval(interval);
  }, [phase, seed, fallbackAttempt]);

  // Subtle ambient generative canvas trails while forming
  useEffect(() => {
    if (phase === 'ready') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let t = 0;
    const w = (canvas.width = 320);
    const h = (canvas.height = 214);

    const blobs = [
      { x: w * 0.3, y: h * 0.4, r: 72, vx: 0.45, vy: 0.32, hue: 215 },
      { x: w * 0.7, y: h * 0.6, r: 84, vx: -0.38, vy: 0.41, hue: 265 },
      { x: w * 0.5, y: h * 0.5, r: 64, vx: 0.3, vy: -0.35, hue: 190 },
    ];

    const render = () => {
      t += 0.02;
      ctx.clearRect(0, 0, w, h);
      for (const b of blobs) {
        b.x += Math.sin(t + b.hue) * b.vx;
        b.y += Math.cos(t + b.hue) * b.vy;
        const grad = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.r);
        if (isDark) {
          grad.addColorStop(0, `hsla(${b.hue}, 70%, 65%, 0.16)`);
          grad.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
        } else {
          grad.addColorStop(0, `hsla(${b.hue}, 65%, 55%, 0.14)`);
          grad.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      animId = window.requestAnimationFrame(render);
    };

    animId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animId);
  }, [phase, isDark]);

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Verify the loaded image is not a yellow Pollinations rate-limit banner
    if (fallbackAttempt === 0) {
      try {
        const imgEl = e.currentTarget;
        const off = document.createElement('canvas');
        off.width = 16;
        off.height = 16;
        const c = off.getContext('2d');
        if (c) {
          c.drawImage(imgEl, 0, 0, 16, 16);
          const d = c.getImageData(0, 0, 16, 16).data;
          let yellowCount = 0;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            if (r > 218 && g > 178 && g < 225 && b > 40 && b < 110) {
              yellowCount++;
            }
          }
          if (yellowCount > 150) {
            setFallbackAttempt(1);
            return;
          }
        }
      } catch {
        // Proceed if canvas read is restricted
      }
    }

    setInternalProgress(100);
    setPhase('revealing');
    window.setTimeout(() => {
      setPhase('ready');
    }, 320);
  };

  const handleImageError = () => {
    if (fallbackAttempt < 1) {
      setFallbackAttempt((prev) => prev + 1);
    } else {
      setPhase('ready');
    }
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhase('forming');
    setInternalProgress(0);
    setFallbackAttempt(0);
    setSeed((prev) => prev + Math.floor(Math.random() * 900) + 101);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const fullUrl = imageUrl.startsWith('/') ? `${window.location.origin}${imageUrl}` : imageUrl;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const isReady = phase === 'ready';
  const cloudGrow = Math.min(1, 0.65 + (displayProgress / 100) * 0.35);

  return (
    <>
      <div
        data-slot="image-generation"
        data-phase={phase}
        style={
          {
            aspectRatio: String(dimensions.ratio),
            '--cloud-grow': cloudGrow,
            '--image-progress': displayProgress / 100,
          } as React.CSSProperties
        }
        className={`group/image-generation relative my-2.5 w-full max-w-md min-w-0 overflow-hidden rounded-2xl outline-1 -outline-offset-1 transition-all duration-500 ease-out select-none ${
          isDark
            ? 'bg-[#141416] outline-white/10 shadow-[0_12px_34px_rgba(0,0,0,0.5)]'
            : 'bg-[#f4f4f5] outline-black/10 shadow-[0_10px_28px_rgba(0,0,0,0.08)]'
        } ${className}`}
      >
        <button
          type="button"
          data-slot="lightbox-photo"
          aria-label={`Open ${alt || effectivePrompt}`}
          disabled={!isReady}
          onClick={() => isReady && setIsLightboxOpen(true)}
          className={`block rounded-[inherit] outline-none absolute inset-0 size-full overflow-hidden ${
            isReady ? 'cursor-zoom-in' : 'cursor-default'
          }`}
        >
          {/* Forming generative canvas trails */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`image-generation-trails absolute inset-0 size-full transition-opacity duration-700 ${
              isReady ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Kobra radial dot matrix & forming cloud layers */}
          <div
            style={{ opacity: isReady ? 0 : 1 }}
            className="absolute inset-0 transition-opacity duration-500 ease-out pointer-events-none"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0.5 bg-[radial-gradient(circle,currentColor_0.75px,transparent_1.2px)] bg-[length:8px_8px] opacity-10"
            />
            <span
              aria-hidden="true"
              style={{
                backgroundImage:
                  'radial-gradient(circle, currentColor 1px, transparent 1.5px)',
                backgroundSize: '8px 8px',
                maskImage:
                  'radial-gradient(ellipse at center, #000 22%, rgba(0,0,0,0.8) 34%, rgba(0,0,0,0.45) 46%, rgba(0,0,0,0.15) 56%, transparent 68%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse at center, #000 22%, rgba(0,0,0,0.8) 34%, rgba(0,0,0,0.45) 46%, rgba(0,0,0,0.15) 56%, transparent 68%)',
              }}
              className={`image-generation-cloud absolute inset-0.5 animate-pulse ${
                isDark ? 'text-white/35' : 'text-black/30'
              }`}
            />
            <span
              aria-hidden="true"
              style={{
                backgroundImage:
                  'radial-gradient(circle, currentColor 1.45px, transparent 2px)',
                backgroundSize: '8px 8px',
                maskImage:
                  'radial-gradient(ellipse at center, #000 15%, rgba(0,0,0,0.78) 24%, rgba(0,0,0,0.42) 33%, transparent 48%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse at center, #000 15%, rgba(0,0,0,0.78) 24%, rgba(0,0,0,0.42) 33%, transparent 48%)',
              }}
              className={`image-generation-cloud absolute inset-0.5 ${
                isDark ? 'text-white/50' : 'text-black/45'
              }`}
            />
          </div>

          {/* Single generated picture element (prevents double-request rate limiting) */}
          <img
            key={`${imageUrl}-${seed}-${fallbackAttempt}`}
            src={imageUrl}
            alt={alt || effectivePrompt}
            crossOrigin="anonymous"
            onLoad={handleImageLoaded}
            onError={handleImageError}
            className={`image-generation-picture absolute inset-0 size-full object-cover transition-all duration-700 ease-out ${
              phase === 'forming'
                ? 'opacity-0 scale-[1.04] blur-xl'
                : phase === 'revealing'
                ? 'opacity-90 scale-[1.01] blur-xs'
                : 'opacity-100 scale-100 blur-0'
            }`}
          />
        </button>

        {/* Centered Kobra 3x3 Dot Matrix + Step Pill while forming */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-300 ${
            isReady ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <span
            className={`image-generation-chrome flex items-center gap-2 rounded-full py-1.5 ps-2.5 pe-3 text-xs font-medium backdrop-blur-[6px] border ${
              isDark
                ? 'bg-black/65 text-white/90 border-white/10'
                : 'bg-white/75 text-zinc-900 border-black/10'
            }`}
          >
            <span aria-hidden="true" className="grid grid-cols-3 gap-[2px]">
              {DOT_DELAYS.map((delay, idx) => (
                <span
                  key={idx}
                  style={{ animationDelay: delay }}
                  className="image-generation-dot size-[3px] rounded-full bg-current animate-ping"
                />
              ))}
            </span>
            <span dir="auto" className="flex">
              <span>{currentStepText}</span>
            </span>
          </span>
        </div>

        {/* Bottom Progress Bar while forming */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(displayProgress)}
          aria-valuetext={currentStepText}
          aria-label="Generation progress"
          className={`image-generation-chrome pointer-events-none absolute inset-x-3 bottom-3 h-1 overflow-hidden rounded-full backdrop-blur-[4px] transition-opacity duration-300 ${
            isDark ? 'bg-white/15' : 'bg-black/15'
          } ${isReady ? 'opacity-0' : 'opacity-100'}`}
        >
          <span
            style={{ width: `${Math.max(4, Math.min(100, displayProgress))}%` }}
            className={`image-generation-progress block h-full rounded-full transition-[width] duration-200 ease-out ${
              isDark ? 'bg-white/80' : 'bg-zinc-900/80'
            }`}
          />
        </div>

        {/* Top-left Resolution Badge (shown on hover/ready) */}
        <span
          className={`image-generation-badge pointer-events-none absolute start-2.5 top-2.5 transition-opacity duration-200 ${
            isReady
              ? 'opacity-0 group-hover/image-generation:opacity-100'
              : 'opacity-0'
          }`}
        >
          <span
            className={`flex h-7 items-center rounded-full text-[11px] backdrop-blur-[6px] px-2.5 font-mono border ${
              isDark
                ? 'bg-black/65 text-neutral-300 border-white/10'
                : 'bg-white/75 text-neutral-700 border-black/10'
            }`}
          >
            {dimensions.label}
          </span>
        </span>

        {/* Top-right Action Buttons (Copy, Regenerate, Download) */}
        <div
          className={`image-generation-actions absolute end-2.5 top-2.5 flex gap-1.5 transition-opacity duration-200 ${
            isReady
              ? 'opacity-100 sm:opacity-0 sm:group-hover/image-generation:opacity-100'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            aria-label="Copy the image link"
            onClick={handleCopy}
            className={`flex items-center rounded-full text-xs backdrop-blur-[6px] relative size-7 justify-center outline-none transition-all duration-150 cursor-pointer border active:scale-95 ${
              isDark
                ? 'bg-black/65 text-neutral-300 hover:text-white border-white/10'
                : 'bg-white/75 text-neutral-700 hover:text-black border-black/10'
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            aria-label="Regenerate image"
            onClick={handleRegenerate}
            className={`flex items-center rounded-full text-xs backdrop-blur-[6px] relative size-7 justify-center outline-none transition-all duration-150 cursor-pointer border active:scale-95 ${
              isDark
                ? 'bg-black/65 text-neutral-300 hover:text-white border-white/10'
                : 'bg-white/75 text-neutral-700 hover:text-black border-black/10'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            download="generated-image.jpg"
            aria-label="Download the image"
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center rounded-full text-xs backdrop-blur-[6px] relative size-7 justify-center outline-none transition-all duration-150 cursor-pointer border active:scale-95 !no-underline ${
              isDark
                ? 'bg-black/65 text-neutral-300 hover:text-white border-white/10'
                : 'bg-white/75 text-neutral-700 hover:text-black border-black/10'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      {isLightboxOpen && isReady && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="fixed top-5 right-5 size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <img
            src={imageUrl}
            alt={alt || effectivePrompt}
            className="max-w-full max-h-[88vh] rounded-2xl object-contain border border-white/15 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export const ImageGenerationCard = ImageGeneration;
export default ImageGeneration;
