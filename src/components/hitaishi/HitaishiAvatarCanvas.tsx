import React, { useEffect, useRef, useState } from 'react';
import { animate, motion } from 'motion/react';
import { Player } from '@livliv-dev/player';
import { BodyPlayer } from '@livliv-dev/player/body';
import { VrmBody } from '@livliv-dev/player/vrm';
import { PngBody } from '@livliv-dev/player/png';
import { startFaceTracking } from '@livliv-dev/player/tracking';
import { createSpeech, startLipSync, type Speech } from '@livliv-dev/player/voice';
import type { HitaishiStageCharacter } from './hitaishiCatalog';
import { Procedural3dBody } from './Procedural3dBody';

export interface HitaishiSpeechClipRequest {
  seq: number;
  audioBlob?: Blob | null;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

interface HitaishiAvatarCanvasProps {
  character: HitaishiStageCharacter;
  speechClip?: HitaishiSpeechClipRequest | null;
  onTrackingStatusChange?: (uid: string, status: { active: boolean; mode: string; error?: string }) => void;
}

type AnyLivLivPlayer = Player | BodyPlayer;
interface ExpressionPoseOffsets {
  browLY: number; browRY: number; angleY: number; angleZ: number;
  eyeBallX: number; eyeBallY: number; smile: number; bodyZ: number; blinkDip: number;
}

const mkPose = (browLY: number, browRY: number, angleY: number, angleZ: number, eyeBallX: number, eyeBallY: number, smile: number, bodyZ: number): Omit<ExpressionPoseOffsets, 'blinkDip'> =>
  ({ browLY, browRY, angleY, angleZ, eyeBallX, eyeBallY, smile, bodyZ });

const EXPRESSION_POSE_TARGETS: Record<string, Omit<ExpressionPoseOffsets, 'blinkDip'>> = {
  neutral: mkPose(0, 0, 0, 0, 0, 0, 0, 0),
  smile: mkPose(0.36, 0.36, 1.8, 2.2, 0, 0.04, 0.88, 0.75),
  shy: mkPose(-0.24, -0.24, -4.2, -3.4, -0.22, -0.18, 0.25, -1.1),
  playful: mkPose(0.45, -0.15, 2.4, 5.2, 0.18, 0.08, 0.92, 1.4),
  angry: mkPose(-0.72, -0.72, -2.8, 1.2, 0, 0.04, 0, 1.35),
  sad: mkPose(-0.48, -0.48, -5.5, -2.4, -0.08, -0.22, 0, -0.95),
};

const safeCall = (fn?: (() => void) | null) => {
  try { fn?.(); } catch {}
};

export const HitaishiAvatarCanvas: React.FC<HitaishiAvatarCanvasProps> = ({ character, speechClip, onTrackingStatusChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<AnyLivLivPlayer | null>(null);
  const speechRef = useRef<Speech | null>(null);
  const trackingStopRef = useRef<(() => void) | null>(null);
  const exprDriverStopRef = useRef<(() => void) | null>(null);
  const exprAnimationRef = useRef<{ stop: () => void } | null>(null);
  const lastActionSeqRef = useRef(0);
  const lastSpeechSeqRef = useRef(0);
  const prevExpressionRef = useRef<string | null | undefined>(undefined);
  const exprPoseRef = useRef<ExpressionPoseOffsets>({ ...EXPRESSION_POSE_TARGETS.neutral, blinkDip: 0 });
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setLoadState('loading');
    setErrorMsg('');
    prevExpressionRef.current = undefined;
    safeCall(trackingStopRef.current); trackingStopRef.current = null;
    safeCall(exprDriverStopRef.current); exprDriverStopRef.current = null;
    safeCall(() => speechRef.current?.dispose()); speechRef.current = null;

    let player: AnyLivLivPlayer;
    try {
      player = character.format === '3d-procedural'
        ? new BodyPlayer(canvas, new Procedural3dBody(character.proceduralPreset || 'nova'))
        : character.format === 'vrm'
        ? new BodyPlayer(canvas, new VrmBody())
        : character.format === 'png'
        ? new BodyPlayer(canvas, new PngBody())
        : new Player(canvas);
      playerRef.current = player;

      try {
        exprDriverStopRef.current = player.use({
          order: 5,
          update(frame) {
            const p = exprPoseRef.current;
            frame.add({ browLY: p.browLY, browRY: p.browRY, angleY: p.angleY, angleZ: p.angleZ, eyeBallX: p.eyeBallX, eyeBallY: p.eyeBallY, eyeLOpen: -p.blinkDip, eyeROpen: -p.blinkDip, bodyZ: p.bodyZ });
            if (p.smile > 0.01) frame.params.smile = Math.max(frame.params.smile || 0, p.smile);
          },
        });
      } catch {}

      try { speechRef.current = createSpeech(player, { motion: 1.25 }); } catch {}
    } catch (err: any) {
      setLoadState('error');
      setErrorMsg(err?.message || 'WebGL initialization failed');
      return;
    }

    const source = character.customFiles?.size
      ? character.customFiles
      : character.format === '3d-procedural'
      ? new Map<string, Blob>([['model.json', new Blob([JSON.stringify({ preset: character.proceduralPreset || 'nova' })], { type: 'application/json' })]])
      : character.modelUrl;

    player.load(source as any).then(() => {
      if (cancelled) return;
      safeCall(() => {
        if ('watermark' in player) (player as any).watermark = null;
        (player as any).mark?.set?.('none', null, false);
      });
      setLoadState('ready');
    }).catch((err: any) => {
      if (cancelled) return;
      setLoadState('error');
      setErrorMsg(err?.message || 'Failed to load avatar rig');
    });

    return () => {
      cancelled = true;
      safeCall(() => exprAnimationRef.current?.stop()); exprAnimationRef.current = null;
      safeCall(exprDriverStopRef.current); exprDriverStopRef.current = null;
      safeCall(trackingStopRef.current); trackingStopRef.current = null;
      safeCall(() => speechRef.current?.dispose()); speechRef.current = null;
      safeCall(() => player.dispose({ release: true }));
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [character.uid, character.format, character.modelUrl, character.proceduralPreset, character.customFiles]);

  useEffect(() => {
    const sp = speechRef.current;
    if (!sp || loadState !== 'ready' || !speechClip || speechClip.seq === lastSpeechSeqRef.current) return;
    lastSpeechSeqRef.current = speechClip.seq;
    if (!speechClip.audioBlob) { safeCall(() => sp.stop()); return; }
    try {
      sp.unlock(); sp.volume = speechClip.volume ?? 1.0; sp.stop();
      sp.say(speechClip.audioBlob, { onStart: () => speechClip.onStart?.(), onEnd: () => speechClip.onEnd?.() });
    } catch { speechClip.onEnd?.(); }
  }, [loadState, speechClip]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || loadState !== 'ready') return;
    const nextExpr = character.activeExpression;
    const strength = Math.max(0, Math.min(1, character.expressionStrength ?? 1));
    const isExprChanged = prevExpressionRef.current !== undefined && prevExpressionRef.current !== nextExpr;
    prevExpressionRef.current = nextExpr;
    safeCall(() => exprAnimationRef.current?.stop());

    const startPose = { ...exprPoseRef.current };
    const raw = EXPRESSION_POSE_TARGETS[nextExpr && EXPRESSION_POSE_TARGETS[nextExpr] ? nextExpr : 'neutral'];
    const targetPose = {
      browLY: raw.browLY * strength, browRY: raw.browRY * strength, angleY: raw.angleY * strength, angleZ: raw.angleZ * strength,
      eyeBallX: raw.eyeBallX * strength, eyeBallY: raw.eyeBallY * strength, smile: raw.smile * strength, bodyZ: raw.bodyZ * strength,
    };

    if (isExprChanged) safeCall(() => player.blink());
    let swappedTexture = !isExprChanged;
    if (!isExprChanged) safeCall(() => player.setExpression(nextExpr, strength));

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const controls = animate(0, 1, {
      type: 'spring', stiffness: 175, damping: 20, mass: 0.85,
      onUpdate: (progress) => {
        const t = Math.max(0, Math.min(1, progress));
        if (!swappedTexture && t >= 0.22) { swappedTexture = true; safeCall(() => player.setExpression(nextExpr, Math.max(0.15, t * strength))); }
        else if (swappedTexture) safeCall(() => player.setExpression(nextExpr, Math.min(1, Math.max(0.15, t) * strength)));
        exprPoseRef.current = {
          browLY: lerp(startPose.browLY, targetPose.browLY, t), browRY: lerp(startPose.browRY, targetPose.browRY, t),
          angleY: lerp(startPose.angleY, targetPose.angleY, t), angleZ: lerp(startPose.angleZ, targetPose.angleZ, t),
          eyeBallX: lerp(startPose.eyeBallX, targetPose.eyeBallX, t), eyeBallY: lerp(startPose.eyeBallY, targetPose.eyeBallY, t),
          smile: lerp(startPose.smile, targetPose.smile, t), bodyZ: lerp(startPose.bodyZ, targetPose.bodyZ, t),
          blinkDip: isExprChanged && t < 0.55 ? Math.sin((t / 0.55) * Math.PI) * 0.38 : 0,
        };
      },
      onComplete: () => { exprPoseRef.current = { ...targetPose, blinkDip: 0 }; safeCall(() => player.setExpression(nextExpr, strength)); },
    });
    exprAnimationRef.current = controls;
    return () => controls.stop();
  }, [loadState, character.activeExpression, character.expressionStrength]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || loadState !== 'ready') return;
    safeCall(() => {
      Object.assign(player.view, { zoom: character.zoom, x: character.offsetX, y: character.offsetY, fit: character.fit, head: character.headFraming });
      player.idle = character.idleMotion;
      player.followPointer = character.movementInput === 'mouse' || character.gazeMode === 'camera' ? 'page' : false;
      player.bodyMotion = character.movementRange === 'calm' ? 0.45 : character.movementRange === 'lively' ? 1.0 : 0.8;
      player.setAway(character.isAway);
      if (!speechRef.current?.busy && character.movementInput !== 'mic' && character.movementInput !== 'face') {
        player.params.mouthOpen = character.mouthOpen;
      }
    });
  }, [loadState, character.zoom, character.offsetX, character.offsetY, character.fit, character.headFraming, character.idleMotion, character.movementRange, character.movementInput, character.gazeMode, character.isAway, character.mouthOpen]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || loadState !== 'ready' || !character.activeAction || character.activeAction.seq === lastActionSeqRef.current) return;
    lastActionSeqRef.current = character.activeAction.seq;
    safeCall(() => player.act(character.activeAction!.id));
  }, [loadState, character.activeAction]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || loadState !== 'ready') return;
    safeCall(trackingStopRef.current); trackingStopRef.current = null;
    let cancelled = false;

    const attachTracker = (promise: Promise<{ stop: () => void }>, mode: string, errorText?: string, onErr?: (err: any) => void) => {
      promise.then((tracker) => {
        if (cancelled) { tracker.stop(); return; }
        trackingStopRef.current = () => tracker.stop();
        onTrackingStatusChange?.(character.uid, { active: true, mode, ...(errorText ? { error: errorText } : {}) });
      }).catch((err) => onErr ? onErr(err) : onTrackingStatusChange?.(character.uid, { active: false, mode, error: err?.message }));
    };

    if (character.movementInput === 'face') {
      attachTracker(startFaceTracking(player, { mirror: true }), 'face', undefined, () => {
        if (!cancelled) attachTracker(startFaceTracking(player, { trace: 'synth' }), 'face-replay', 'Camera unavailable in preview — running live Face Replay trace', () => {});
      });
    } else if (character.movementInput === 'face-replay') {
      attachTracker(startFaceTracking(player, { trace: 'synth' }), 'face-replay');
    } else if (character.movementInput === 'mic') {
      attachTracker(startLipSync(player), 'mic', undefined, (err) => onTrackingStatusChange?.(character.uid, { active: false, mode: 'mic', error: err?.message || 'Microphone permission denied' }));
    } else {
      onTrackingStatusChange?.(character.uid, { active: false, mode: character.movementInput });
    }

    return () => { cancelled = true; safeCall(trackingStopRef.current); trackingStopRef.current = null; };
  }, [loadState, character.movementInput, character.uid]);

  return (
    <motion.div
      key={character.uid}
      initial={{ opacity: 0, scale: 0.97, scaleX: character.flipHorizontal ? -1 : 1 }}
      animate={{ opacity: 1, scale: 1, scaleX: character.flipHorizontal ? -1 : 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="relative w-full h-full select-none"
      style={{ filter: character.shadow ? 'drop-shadow(0 18px 26px rgba(15, 23, 42, 0.28))' : undefined }}
    >
      <canvas ref={canvasRef} className="w-full h-full block pointer-events-none" />
      {loadState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white/80 shadow-md bg-white/70 backdrop-blur-sm">
            <img src={character.avatarUrl} alt={character.name} className="w-full h-full object-cover animate-pulse" />
          </div>
          <span className="mt-2 px-2.5 py-0.5 rounded-full bg-zinc-900/75 text-white text-[11px] font-medium tracking-tight backdrop-blur-sm">
            Loading {character.name}…
          </span>
        </div>
      )}
      {loadState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center pointer-events-none">
          <img src={character.avatarUrl} alt={character.name} className="w-28 h-28 rounded-2xl object-cover border-2 border-white shadow-lg mb-2" />
          <span className="px-2.5 py-1 rounded-md bg-zinc-900/80 text-white text-[11px] font-medium">
            {character.name} ({errorMsg || 'Fallback Preview'})
          </span>
        </div>
      )}
    </motion.div>
  );
};
