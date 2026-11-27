import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Camera, Zap, ZapOff, SwitchCamera, Image as ImageIcon, RotateCw, Check, Copy,
  Loader2, RefreshCw, BookOpen, MessageSquare, AlertCircle, Type, Maximize2, ArrowLeft,
} from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';
import { StudyLoopStore, type SnapSolveResult } from '../lib/studyLoopStore';

export interface InstantSnapSolveModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  onAskFollowUp?: (prompt: string) => void;
  onOpenPricing?: (highlightPlan?: 'spark' | 'fire', reason?: string) => void;
}

type SnapStage = 'camera' | 'type' | 'crop' | 'solving' | 'result';
type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';
interface CropRect { x: number; y: number; w: number; h: number; }

const DEFAULT_CROP: CropRect = { x: 0.06, y: 0.16, w: 0.88, h: 0.56 };
const FULL_CROP: CropRect = { x: 0.02, y: 0.02, w: 0.96, h: 0.96 };
const MIN_CROP_W = 0.16;
const MIN_CROP_H = 0.12;
const MAX_EXPORT_DIM = 1600;

const loadImageElement = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Could not decode photo'));
  img.src = src;
});

async function rotateDataUrl90(dataUrl: string): Promise<string> {
  const img = await loadImageElement(dataUrl);
  const scale = Math.min(1, 2000 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas'); c.width = h; c.height = w;
  const ctx = c.getContext('2d'); if (!ctx) return dataUrl;
  ctx.translate(h / 2, w / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return c.toDataURL('image/jpeg', 0.9);
}

async function cropImageDataUrl(dataUrl: string, rect: CropRect): Promise<string> {
  const img = await loadImageElement(dataUrl);
  const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
  const sx = Math.max(0, Math.min(nw - 1, Math.round(rect.x * nw)));
  const sy = Math.max(0, Math.min(nh - 1, Math.round(rect.y * nh)));
  const sw = Math.max(16, Math.min(nw - sx, Math.round(rect.w * nw)));
  const sh = Math.max(16, Math.min(nh - sy, Math.round(rect.h * nh)));
  const scale = Math.min(1, MAX_EXPORT_DIM / Math.max(sw, sh));
  const dw = Math.max(16, Math.round(sw * scale)), dh = Math.max(16, Math.round(sh * scale));
  const c = document.createElement('canvas'); c.width = dw; c.height = dh;
  const ctx = c.getContext('2d'); if (!ctx) return dataUrl;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, dw, dh); ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  return c.toDataURL('image/jpeg', 0.88);
}

async function readFileAsResizedDataUrl(file: File): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = () => reject(new Error('Failed to read image file')); r.readAsDataURL(file);
  });
  const img = await loadImageElement(rawUrl);
  const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1, scale = Math.min(1, 2000 / Math.max(nw, nh));
  if (scale >= 0.99 && file.type === 'image/jpeg' && rawUrl.length < 3_500_000) return rawUrl;
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(nw * scale)); c.height = Math.max(1, Math.round(nh * scale));
  const ctx = c.getContext('2d'); if (!ctx) return rawUrl;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

export const InstantSnapSolveModal: React.FC<InstantSnapSolveModalProps> = ({ isOpen, onClose, isDark = false, onAskFollowUp, onOpenPricing }) => {
  const [stage, setStage] = useState<SnapStage>('camera');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraState, setCameraState] = useState<'starting' | 'ready' | 'fallback'>('starting');
  const [cameraFallbackReason, setCameraFallbackReason] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flashPulse, setFlashPulse] = useState(false);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<CropRect>(DEFAULT_CROP);
  const [hintText, setHintText] = useState('');
  const [typedQuestion, setTypedQuestion] = useState('');
  const [solveError, setSolveError] = useState<string | null>(null);
  const [result, setResult] = useState<SnapSolveResult | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [selectedPracticeOption, setSelectedPracticeOption] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const cropStageImgRef = useRef<HTMLImageElement | null>(null);
  const solveRunIdRef = useRef(0);
  const dragRef = useRef<{ handle: DragHandle; startX: number; startY: number; startRect: CropRect; boxWidth: number; boxHeight: number } | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch {} });
    streamRef.current = null;
    if (videoRef.current) { try { videoRef.current.pause(); videoRef.current.srcObject = null; } catch {} }
    setTorchOn(false); setTorchSupported(false);
  }, []);

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    stopCamera(); setCameraState('starting'); setCameraFallbackReason('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('fallback');
      setCameraFallbackReason('Live viewfinder is unavailable on this browser. Use Native Camera or Gallery below.');
      return;
    }
    try {
      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); }
      catch { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      try { setTorchSupported(Boolean((track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean })?.torch)); } catch { setTorchSupported(false); }
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setCameraState('ready');
    } catch (err: any) {
      stopCamera(); setCameraState('fallback');
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setCameraFallbackReason(denied ? 'Camera permission was blocked. Tap Take Photo below to use your device camera or choose from Gallery.' : 'Could not start live camera preview. Tap Take Photo below to capture with your native camera.');
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen) { stopCamera(); return; }
    if (stage === 'camera') void startCamera(facingMode); else stopCamera();
    return () => stopCamera();
  }, [isOpen, stage, facingMode, startCamera, stopCamera]);

  useEffect(() => {
    if (!isOpen) return;
    setStage('camera'); setCapturedImage(null); setCroppedPreview(null); setCropRect(DEFAULT_CROP);
    setHintText(''); setTypedQuestion(''); setSolveError(null); setResult(null); setSelectedPracticeOption(null); setCopiedAnswer(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onVis = () => { if (document.hidden) stopCamera(); else if (stage === 'camera') void startCamera(facingMode); };
    const onHide = () => stopCamera();
    document.addEventListener('visibilitychange', onVis); window.addEventListener('pagehide', onHide);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', onHide); };
  }, [isOpen, stage, facingMode, startCamera, stopCamera]);

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try { await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] }); setTorchOn(next); }
    catch { setTorchSupported(false); setTorchOn(false); }
  };

  const handleShutterCapture = () => {
    const v = videoRef.current;
    if (!v?.videoWidth || !v.videoHeight) { nativeCameraInputRef.current?.click(); return; }
    setFlashPulse(true); setTimeout(() => setFlashPulse(false), 140);
    const scale = Math.min(1, 2000 / Math.max(v.videoWidth, v.videoHeight));
    const cw = Math.max(1, Math.round(v.videoWidth * scale)), ch = Math.max(1, Math.round(v.videoHeight * scale));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const ctx = c.getContext('2d'); if (!ctx) return;
    if (facingMode === 'user') { ctx.translate(cw, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, cw, ch);
    stopCamera(); setCapturedImage(c.toDataURL('image/jpeg', 0.92)); setCropRect(DEFAULT_CROP); setSolveError(null); setStage('crop');
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    try { const url = await readFileAsResizedDataUrl(file); stopCamera(); setCapturedImage(url); setCropRect(FULL_CROP); setSolveError(null); setStage('crop'); }
    catch { setSolveError('Could not read that photo. Please try another image.'); }
  };

  const handleRotate = async () => {
    if (!capturedImage) return;
    try { setCapturedImage(await rotateDataUrl90(capturedImage)); setCropRect(FULL_CROP); } catch {}
  };

  const beginCropDrag = (handle: DragHandle, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const bounds = cropStageImgRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startRect: { ...cropRect }, boxWidth: bounds.width, boxHeight: bounds.height };
  };

  const moveCropDrag = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    e.preventDefault();
    const dx = (e.clientX - d.startX) / d.boxWidth, dy = (e.clientY - d.startY) / d.boxHeight, s = d.startRect;
    let { x, y, w, h } = s;
    if (d.handle === 'move') { x = Math.max(0, Math.min(1 - s.w, s.x + dx)); y = Math.max(0, Math.min(1 - s.h, s.y + dy)); }
    else {
      if (d.handle.includes('w')) { x = Math.max(0, Math.min(s.x + s.w - MIN_CROP_W, s.x + dx)); w = s.x + s.w - x; }
      if (d.handle.includes('e')) { w = Math.max(MIN_CROP_W, Math.min(1 - s.x, s.w + dx)); }
      if (d.handle.includes('n')) { y = Math.max(0, Math.min(s.y + s.h - MIN_CROP_H, s.y + dy)); h = s.y + s.h - y; }
      if (d.handle.includes('s')) { h = Math.max(MIN_CROP_H, Math.min(1 - s.y, s.h + dy)); }
    }
    setCropRect({ x, y, w, h });
  };

  const endCropDrag = () => { dragRef.current = null; };

  const executeSolve = async (payload: { imageDataUrl?: string; questionText?: string }) => {
    const runId = ++solveRunIdRef.current;
    setSolveError(null); setSelectedPracticeOption(null); setCopiedAnswer(false); setStage('solving');
    const res = await StudyLoopStore.runSnapAndSolve(payload);
    if (solveRunIdRef.current !== runId) return;
    if (!res.ok || !res.result) {
      if (res.status === 429 && onOpenPricing) {
        setSolveError(res.error || 'Daily Snap & Solve limit reached.');
        setStage(payload.imageDataUrl ? 'crop' : 'type');
        onOpenPricing('spark', res.error || 'Upgrade for unlimited Instant Snap & Solve.');
        return;
      }
      setSolveError(res.error || 'Could not solve this question. Try cropping closer and retry.');
      setStage(payload.imageDataUrl ? 'crop' : 'type');
      return;
    }
    setResult(res.result); setStage('result');
  };

  const handleSolveCroppedPhoto = async () => {
    if (!capturedImage) return;
    try { const cropped = await cropImageDataUrl(capturedImage, cropRect); setCroppedPreview(cropped); await executeSolve({ imageDataUrl: cropped, questionText: hintText.trim() || undefined }); }
    catch { setSolveError('Failed to prepare cropped photo. Please try again.'); }
  };

  const handleSolveTypedQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = typedQuestion.trim(); if (!q) return;
    setCroppedPreview(null); await executeSolve({ questionText: q });
  };

  const handleResetToCamera = () => {
    solveRunIdRef.current += 1;
    setCapturedImage(null); setCroppedPreview(null); setCropRect(DEFAULT_CROP); setHintText('');
    setSolveError(null); setResult(null); setSelectedPracticeOption(null); setStage('camera');
  };

  const handleCopyAnswer = async () => {
    const text = result?.finalAnswer || result?.answer || '';
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setCopiedAnswer(true); setTimeout(() => setCopiedAnswer(false), 1800); } catch {}
  };

  const handleFollowUp = () => {
    if (!result || !onAskFollowUp) return;
    stopCamera();
    onAskFollowUp([
      'Follow up on this Snap & Solve question:',
      `Question: ${result.questionExtracted}`,
      `Final Answer: ${result.finalAnswer || result.answer}`,
      'Please explain the trickiest step more clearly and show me how to check my answer.',
    ].join('\n'));
  };

  if (!isOpen) return null;

  const surfaceBtn = isDark ? 'border-white/12 bg-white/[0.04] text-white' : 'border-black/10 bg-black/[0.03] text-black';
  const solidBtn = isDark ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-neutral-800';
  const panelCls = isDark ? 'bg-[#121215] border-white/10' : 'bg-neutral-50 border-black/10';

  return (
    <div className="fixed inset-0 z-[120] flex flex-col md:items-center md:justify-center bg-black md:bg-black/80 md:backdrop-blur-md md:p-6 lg:p-10 text-white select-none overflow-hidden" role="dialog" aria-modal="true" aria-label="Instant Camera Snap and Solve">
      <div className="relative flex-1 md:flex-none w-full h-full md:h-[min(88dvh,820px)] md:max-w-3xl lg:max-w-4xl flex flex-col bg-black md:rounded-3xl md:border md:border-white/15 md:shadow-2xl overflow-hidden">
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFilePicked} />
        <input ref={nativeCameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilePicked} />

        {stage === 'camera' && (
          <div className="relative flex-1 flex flex-col bg-black overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${cameraState === 'ready' ? 'opacity-100' : 'opacity-0'} ${facingMode === 'user' ? '-scale-x-100' : ''}`} />
            {flashPulse && <div className="pointer-events-none absolute inset-0 z-30 bg-white/70 transition-opacity" />}

            {cameraState === 'ready' && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-5">
                <div className="relative w-full max-w-md aspect-[16/10] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.48)]">
                  <span className="absolute -top-0.5 -left-0.5 w-7 h-7 border-t-[3px] border-l-[3px] border-white rounded-tl-xl" />
                  <span className="absolute -top-0.5 -right-0.5 w-7 h-7 border-t-[3px] border-r-[3px] border-white rounded-tr-xl" />
                  <span className="absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-[3px] border-l-[3px] border-white rounded-bl-xl" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-[3px] border-r-[3px] border-white rounded-br-xl" />
                </div>
                <p className="mt-4 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-xs font-medium text-white/90 tracking-tight">Align one question inside the frame</p>
              </div>
            )}

            {cameraState === 'starting' && (
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <Loader2 className="w-7 h-7 animate-spin text-white/80" /><p className="text-sm text-white/75">Opening camera…</p>
              </div>
            )}

            {cameraState === 'fallback' && (
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto">
                <div className="size-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-4"><Camera className="w-7 h-7 text-white" /></div>
                <h2 className="text-lg font-semibold tracking-tight text-white">Snap &amp; Solve</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-white/70">{cameraFallbackReason || 'Capture a photo of your question to get an instant step-by-step solution.'}</p>
                <div className="mt-6 w-full space-y-2.5">
                  <button type="button" onClick={() => nativeCameraInputRef.current?.click()} className="w-full h-12 rounded-2xl bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"><Camera className="w-4 h-4" /><span>Take Photo</span></button>
                  <button type="button" onClick={() => galleryInputRef.current?.click()} className="w-full h-11 rounded-2xl bg-white/10 border border-white/15 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/15 active:scale-[0.98] transition-colors cursor-pointer"><ImageIcon className="w-4 h-4" /><span>Choose from Gallery</span></button>
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <button type="button" onClick={() => void startCamera(facingMode)} className="text-xs text-white/70 hover:text-white underline underline-offset-4 cursor-pointer">Retry live camera</button>
                    <span className="text-white/25">·</span>
                    <button type="button" onClick={() => setStage('type')} className="text-xs text-white/70 hover:text-white underline underline-offset-4 cursor-pointer">Type question</button>
                  </div>
                </div>
              </div>
            )}

            <div className="relative z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/75 via-black/35 to-transparent">
              <button type="button" onClick={() => { stopCamera(); onClose(); }} className="size-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white active:scale-95 transition-transform cursor-pointer" aria-label="Close camera"><X className="w-5 h-5" /></button>
              <div className="text-sm font-semibold tracking-tight text-white">Snap &amp; Solve</div>
              <div className="flex items-center gap-2">
                {torchSupported && cameraState === 'ready' && (
                  <button type="button" onClick={handleToggleTorch} className={`size-11 rounded-full backdrop-blur-md border flex items-center justify-center active:scale-95 transition-colors cursor-pointer ${torchOn ? 'bg-white text-black border-white' : 'bg-black/50 text-white border-white/15'}`} aria-label={torchOn ? 'Turn flash off' : 'Turn flash on'}>
                    {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                  </button>
                )}
                {cameraState === 'ready' ? (
                  <button type="button" onClick={() => setFacingMode((p) => (p === 'environment' ? 'user' : 'environment'))} className="size-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white active:scale-95 transition-transform cursor-pointer" aria-label="Switch camera"><SwitchCamera className="w-4 h-4" /></button>
                ) : <div className="size-11" />}
              </div>
            </div>

            {cameraState === 'ready' && <div className="flex-1" />}

            <div className="relative z-20 px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/60 to-transparent">
              <div className="max-w-sm mx-auto flex items-center justify-between">
                <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center gap-1 text-white/85 hover:text-white active:scale-95 transition-transform cursor-pointer" aria-label="Upload from gallery">
                  <span className="size-12 rounded-2xl bg-white/12 backdrop-blur-md border border-white/15 flex items-center justify-center"><ImageIcon className="w-5 h-5" /></span>
                  <span className="text-[11px] font-medium">Gallery</span>
                </button>
                <button type="button" onClick={handleShutterCapture} className="size-[76px] rounded-full border-[4px] border-white flex items-center justify-center p-1 active:scale-95 transition-transform cursor-pointer" aria-label="Take photo">
                  <span className="w-full h-full rounded-full bg-white block" />
                </button>
                <button type="button" onClick={() => { stopCamera(); setStage('type'); }} className="flex flex-col items-center gap-1 text-white/85 hover:text-white active:scale-95 transition-transform cursor-pointer" aria-label="Type a question">
                  <span className="size-12 rounded-2xl bg-white/12 backdrop-blur-md border border-white/15 flex items-center justify-center"><Type className="w-5 h-5" /></span>
                  <span className="text-[11px] font-medium">Type</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {stage === 'type' && (
          <div className={`flex-1 flex flex-col ${isDark ? 'bg-[#09090b] text-white' : 'bg-white text-[#0d0d0d]'}`}>
            <div className={`flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
              <button type="button" onClick={() => setStage('camera')} className={`h-10 px-3 rounded-xl border inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer ${surfaceBtn}`}><ArrowLeft className="w-4 h-4" /><span>Camera</span></button>
              <span className="text-sm font-semibold">Type Question</span>
              <button type="button" onClick={onClose} className="size-10 rounded-xl flex items-center justify-center opacity-70 hover:opacity-100 cursor-pointer" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSolveTypedQuestion} className="flex-1 flex flex-col max-w-xl w-full mx-auto p-4 gap-3">
              <label className="text-xs font-medium opacity-70">Enter or paste any math, physics, chemistry, or textbook problem:</label>
              <textarea value={typedQuestion} onChange={(e) => setTypedQuestion(e.target.value)} rows={6} placeholder="e.g. Solve 2x^2 - 7x + 3 = 0, or find the velocity of a 4 kg block sliding down a 30° frictionless incline..." autoFocus className={`w-full rounded-2xl border p-3.5 text-sm leading-relaxed outline-none resize-none ${isDark ? 'bg-[#121215] border-white/12 text-white placeholder:text-neutral-500 focus:border-white/30' : 'bg-neutral-50 border-black/12 text-black placeholder:text-neutral-400 focus:border-black/30'}`} />
              {solveError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{solveError}</span></div>}
              <div className="mt-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button type="submit" disabled={!typedQuestion.trim()} className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all cursor-pointer disabled:opacity-40 ${solidBtn}`}>Solve Step-by-Step</button>
              </div>
            </form>
          </div>
        )}

        {stage === 'crop' && capturedImage && (
          <div className="flex-1 flex flex-col bg-[#09090b] text-white overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-white/10">
              <button type="button" onClick={handleResetToCamera} className="h-10 px-3 rounded-xl bg-white/[0.06] border border-white/12 inline-flex items-center gap-1.5 text-xs font-medium text-white active:scale-95 transition-transform cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /><span>Retake</span></button>
              <span className="text-xs font-medium text-white/75">Crop one question</span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={handleRotate} className="size-10 rounded-xl bg-white/[0.06] border border-white/12 flex items-center justify-center text-white active:scale-95 transition-transform cursor-pointer" aria-label="Rotate 90 degrees" title="Rotate 90°"><RotateCw className="w-4 h-4" /></button>
                <button type="button" onClick={() => setCropRect(FULL_CROP)} className="size-10 rounded-xl bg-white/[0.06] border border-white/12 flex items-center justify-center text-white active:scale-95 transition-transform cursor-pointer" aria-label="Use full photo" title="Full photo"><Maximize2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
              <div className="relative inline-block max-w-full max-h-full select-none touch-none">
                <img ref={cropStageImgRef} src={capturedImage} alt="Captured problem" draggable={false} className="block max-w-full max-h-[58dvh] w-auto h-auto rounded-xl object-contain pointer-events-none" />
                <div className="absolute inset-0 overflow-hidden rounded-xl">
                  <div onPointerDown={(e) => beginCropDrag('move', e)} onPointerMove={moveCropDrag} onPointerUp={endCropDrag} onPointerCancel={endCropDrag}
                    style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%`, boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.58)' }}
                    className="absolute border-2 border-white/95 cursor-move touch-none">
                    <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25">
                      {Array.from({ length: 9 }, (_, i) => <div key={i} className={`${i % 3 < 2 ? 'border-r' : ''} ${i < 6 ? 'border-b' : ''} border-white`} />)}
                    </div>
                    {([
                      ['nw', '-top-5 -left-5', 'top-4 left-4 border-t-[3px] border-l-[3px]'],
                      ['ne', '-top-5 -right-5', 'top-4 right-4 border-t-[3px] border-r-[3px]'],
                      ['sw', '-bottom-5 -left-5', 'bottom-4 left-4 border-b-[3px] border-l-[3px]'],
                      ['se', '-bottom-5 -right-5', 'bottom-4 right-4 border-b-[3px] border-r-[3px]'],
                    ] as const).map(([id, pos, visual]) => (
                      <div key={id} onPointerDown={(e) => beginCropDrag(id, e)} onPointerMove={moveCropDrag} onPointerUp={endCropDrag} onPointerCancel={endCropDrag} className={`absolute ${pos} w-11 h-11 z-10 touch-none`}>
                        <span className={`pointer-events-none absolute ${visual} w-5 h-5 border-white`} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-[#09090b] space-y-2.5 max-w-lg w-full mx-auto">
              {solveError && <div className="rounded-xl border border-red-500/35 bg-red-500/12 px-3 py-2 text-xs text-red-300 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{solveError}</span></div>}
              <input type="text" value={hintText} onChange={(e) => setHintText(e.target.value)} placeholder="Optional note (e.g. Solve part (b) only)" className="w-full h-10 px-3.5 rounded-xl bg-white/[0.06] border border-white/12 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/30" />
              <button type="button" onClick={handleSolveCroppedPhoto} className="w-full h-12 rounded-2xl bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-200 active:scale-[0.98] transition-all cursor-pointer"><Check className="w-4 h-4" /><span>Solve Question</span></button>
            </div>
          </div>
        )}

        {stage === 'solving' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 bg-[#09090b] text-white text-center">
            <div className="w-full max-w-xs space-y-5">
              {croppedPreview && (
                <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-black/50 max-h-48 flex items-center justify-center">
                  <img src={croppedPreview} alt="Analyzing question" className="max-h-48 w-auto object-contain opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/15 to-transparent animate-pulse" />
                </div>
              )}
              <div className="flex flex-col items-center gap-2.5">
                <Loader2 className="w-7 h-7 animate-spin text-white" />
                <div className="text-sm font-semibold tracking-tight">Reading &amp; solving step-by-step…</div>
                <p className="text-xs text-white/55">Extracting notation, verifying algebra, and building your explanation</p>
              </div>
              <button type="button" onClick={() => { solveRunIdRef.current += 1; setStage(capturedImage ? 'crop' : 'type'); }} className="h-10 px-5 rounded-xl border border-white/15 bg-white/[0.05] text-xs font-medium text-white/80 hover:text-white cursor-pointer">Cancel</button>
            </div>
          </div>
        )}

        {stage === 'result' && result && (
          <div className={`flex-1 flex flex-col min-h-0 select-text ${isDark ? 'bg-[#09090b] text-neutral-100' : 'bg-white text-neutral-900'}`}>
            <div className={`shrink-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b ${isDark ? 'border-white/10 bg-[#09090b]' : 'border-black/10 bg-white'}`}>
              <button type="button" onClick={onClose} className={`size-10 rounded-xl border flex items-center justify-center cursor-pointer ${surfaceBtn}`} aria-label="Close solution"><X className="w-5 h-5" /></button>
              <span className="text-sm font-semibold tracking-tight">Step-by-Step Solution</span>
              <button type="button" onClick={handleResetToCamera} className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform ${surfaceBtn}`}><Camera className="w-3.5 h-3.5" /><span>Snap</span></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="max-w-2xl mx-auto space-y-4 pb-6">
                <div className={`rounded-2xl border p-3.5 space-y-2.5 ${panelCls}`}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider opacity-55">Question</div>
                  {croppedPreview && <img src={croppedPreview} alt="Cropped question" className={`max-h-36 rounded-xl border object-contain ${isDark ? 'border-white/10 bg-black/40' : 'border-black/10 bg-white'}`} />}
                  <div className="text-sm leading-relaxed"><MathMarkdown content={result.questionExtracted} isDark={isDark} autoDetectLatex /></div>
                </div>

                <div className={`rounded-2xl border-2 p-4 space-y-2 ${isDark ? 'bg-[#141418] border-white/25' : 'bg-neutral-50 border-black/25'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">Final Answer</span>
                    <button type="button" onClick={handleCopyAnswer} className={`h-8 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer ${isDark ? 'border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1]' : 'border-black/12 bg-white text-black hover:bg-neutral-100'}`}>
                      {copiedAnswer ? <><Check className="w-3.5 h-3.5" /><span>Copied</span></> : <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>}
                    </button>
                  </div>
                  <div className="text-base font-semibold leading-relaxed"><MathMarkdown content={result.finalAnswer || result.answer} isDark={isDark} autoDetectLatex /></div>
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-60 px-0.5">Steps ({result.steps.length})</div>
                  {result.steps.map((step, i) => (
                    <div key={i} className={`rounded-2xl border p-3.5 flex items-start gap-3 ${isDark ? 'bg-[#121215] border-white/10' : 'bg-white border-black/10'}`}>
                      <span className={`size-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${isDark ? 'bg-white text-black' : 'bg-black text-white'}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1 text-sm leading-relaxed overflow-x-auto"><MathMarkdown content={step} isDark={isDark} autoDetectLatex /></div>
                    </div>
                  ))}
                </div>

                {result.conceptBehindIt && (
                  <div className={`rounded-2xl border p-4 space-y-1.5 ${panelCls}`}>
                    <div className="flex items-center gap-2 text-xs font-semibold opacity-75">
                      <BookOpen className="w-3.5 h-3.5" /><span>Concept Behind It</span>
                      {result.conceptBehindIt.subject && <span className="opacity-60">· {result.conceptBehindIt.subject}{result.conceptBehindIt.chapter ? ` / ${result.conceptBehindIt.chapter}` : ''}</span>}
                    </div>
                    <div className="text-sm font-semibold">{result.conceptBehindIt.title}</div>
                    <div className="text-xs leading-relaxed opacity-85"><MathMarkdown content={result.conceptBehindIt.explanation} isDark={isDark} autoDetectLatex /></div>
                  </div>
                )}

                {!!result.similarPracticeQuestion?.options?.length && (
                  <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'bg-[#121215] border-white/10' : 'bg-white border-black/10'}`}>
                    <div className="text-[11px] font-semibold uppercase tracking-wider opacity-60">Try a Similar Question</div>
                    <div className="text-sm font-medium leading-relaxed"><MathMarkdown content={result.similarPracticeQuestion.question} isDark={isDark} autoDetectLatex /></div>
                    <div className="space-y-2">
                      {result.similarPracticeQuestion.options.map((opt, idx) => {
                        const revealed = selectedPracticeOption !== null;
                        const isCorrect = idx === result.similarPracticeQuestion!.correctIndex;
                        const styleClass = revealed && isCorrect ? (isDark ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200' : 'border-emerald-600/60 bg-emerald-50 text-emerald-900')
                          : revealed && selectedPracticeOption === idx ? (isDark ? 'border-red-400/60 bg-red-500/15 text-red-200' : 'border-red-600/60 bg-red-50 text-red-900')
                          : isDark ? 'border-white/12 bg-white/[0.03] hover:bg-white/[0.07]' : 'border-black/10 bg-neutral-50 hover:bg-neutral-100';
                        return (
                          <button key={idx} type="button" onClick={() => setSelectedPracticeOption(idx)} className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 transition-colors cursor-pointer ${styleClass}`}>
                            <span className="font-bold opacity-60 shrink-0">{String.fromCharCode(65 + idx)}.</span>
                            <span className="min-w-0 flex-1"><MathMarkdown content={opt} isDark={isDark} inline autoDetectLatex /></span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedPracticeOption !== null && result.similarPracticeQuestion.explanation && (
                      <div className={`rounded-xl p-3 text-xs leading-relaxed border ${isDark ? 'bg-white/[0.04] border-white/10 text-neutral-200' : 'bg-neutral-50 border-black/10 text-neutral-800'}`}>
                        <MathMarkdown content={result.similarPracticeQuestion.explanation} isDark={isDark} autoDetectLatex />
                      </div>
                    )}
                  </div>
                )}

                {result.checkWithTextbook && <p className="text-[11px] opacity-55 text-center px-2">Photo clarity was moderate — double-check the extracted numbers against your page.</p>}
              </div>
            </div>

            <div className={`shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t ${isDark ? 'border-white/10 bg-[#09090b]' : 'border-black/10 bg-white'}`}>
              <div className="max-w-2xl mx-auto flex items-center gap-2.5">
                <button type="button" onClick={handleResetToCamera} className={`flex-1 h-12 rounded-2xl border font-semibold text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer ${isDark ? 'border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1]' : 'border-black/12 bg-neutral-100 text-black hover:bg-neutral-200'}`}><Camera className="w-4 h-4" /><span>Snap Another</span></button>
                {onAskFollowUp && <button type="button" onClick={handleFollowUp} className={`flex-1 h-12 rounded-2xl font-semibold text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer ${solidBtn}`}><MessageSquare className="w-4 h-4" /><span>Ask Follow-Up</span></button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
