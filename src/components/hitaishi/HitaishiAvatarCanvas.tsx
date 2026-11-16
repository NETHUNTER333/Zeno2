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
  onTrackingStatusChange?: (
    uid: string,
    status: { active: boolean; mode: string; error?: string }
  ) => void;
}

type AnyLivLivPlayer = Player | BodyPlayer;

interface ExpressionPoseOffsets {
  browLY: number;
  browRY: number;
  angleY: number;
  angleZ: number;
  eyeBallX: number;
  eyeBallY: number;
  smile: number;
  bodyZ: number;
  blinkDip: number;
}

const EXPRESSION_POSE_TARGETS: Record<string, Omit<ExpressionPoseOffsets, 'blinkDip'>> = {
  neutral: {
    browLY: 0,
    browRY: 0,
    angleY: 0,
    angleZ: 0,
    eyeBallX: 0,
    eyeBallY: 0,
    smile: 0,
    bodyZ: 0,
  },
  smile: {
    browLY: 0.36,
    browRY: 0.36,
    angleY: 1.8,
    angleZ: 2.2,
    eyeBallX: 0,
    eyeBallY: 0.04,
    smile: 0.88,
    bodyZ: 0.75,
  },
  shy: {
    browLY: -0.24,
    browRY: -0.24,
    angleY: -4.2,
    angleZ: -3.4,
    eyeBallX: -0.22,
    eyeBallY: -0.18,
    smile: 0.25,
    bodyZ: -1.1,
  },
  angry: {
    browLY: -0.72,
    browRY: -0.72,
    angleY: -2.8,
    angleZ: 1.2,
    eyeBallX: 0,
    eyeBallY: 0.04,
    smile: 0,
    bodyZ: 1.35,
  },
  sad: {
    browLY: -0.48,
    browRY: -0.48,
    angleY: -5.5,
    angleZ: -2.4,
    eyeBallX: -0.08,
    eyeBallY: -0.22,
    smile: 0,
    bodyZ: -0.95,
  },
};

export const HitaishiAvatarCanvas: React.FC<HitaishiAvatarCanvasProps> = ({
  character,
  speechClip,
  onTrackingStatusChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<AnyLivLivPlayer | null>(null);
  const speechRef = useRef<Speech | null>(null);
  const trackingStopRef = useRef<(() => void) | null>(null);
  const exprDriverStopRef = useRef<(() => void) | null>(null);
  const exprAnimationRef = useRef<{ stop: () => void } | null>(null);
  const lastActionSeqRef = useRef<number>(0);
  const lastSpeechSeqRef = useRef<number>(0);
  const prevExpressionRef = useRef<string | null | undefined>(undefined);

  // Live interpolated expression pose values fed into @livliv-dev/player's per-frame driver
  const exprPoseRef = useRef<ExpressionPoseOffsets>({
    ...EXPRESSION_POSE_TARGETS.neutral,
    blinkDip: 0,
  });

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Instantiate and load the underlying @livliv-dev/player instance
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setLoadState('loading');
    setErrorMsg('');
    prevExpressionRef.current = undefined;

    if (trackingStopRef.current) {
      try {
        trackingStopRef.current();
      } catch {
        // ignore
      }
      trackingStopRef.current = null;
    }

    if (exprDriverStopRef.current) {
      try {
        exprDriverStopRef.current();
      } catch {
        // ignore
      }
      exprDriverStopRef.current = null;
    }

    if (speechRef.current) {
      try {
        speechRef.current.dispose();
      } catch {
        // ignore
      }
      speechRef.current = null;
    }

    let player: AnyLivLivPlayer;
    try {
      if (character.format === '3d-procedural') {
        player = new BodyPlayer(
          canvas,
          new Procedural3dBody(character.proceduralPreset || 'nova')
        );
      } else if (character.format === 'vrm') {
        player = new BodyPlayer(canvas, new VrmBody());
      } else if (character.format === 'png') {
        player = new BodyPlayer(canvas, new PngBody());
      } else {
        player = new Player(canvas);
      }
      playerRef.current = player;

      // Register custom Framer Motion expression-interpolation driver on the player loop
      try {
        const removeDriver = player.use({
          order: 5,
          update(frame) {
            const p = exprPoseRef.current;
            frame.add({
              browLY: p.browLY,
              browRY: p.browRY,
              angleY: p.angleY,
              angleZ: p.angleZ,
              eyeBallX: p.eyeBallX,
              eyeBallY: p.eyeBallY,
              eyeLOpen: -p.blinkDip,
              eyeROpen: -p.blinkDip,
              bodyZ: p.bodyZ,
            });
            if (p.smile > 0.01) {
              frame.params.smile = Math.max(frame.params.smile || 0, p.smile);
            }
          },
        });
        exprDriverStopRef.current = removeDriver;
      } catch {
        // ignore if custom driver registration unsupported
      }

      // Attach @livliv-dev/player/voice speech driver for real neural audio lip-sync + vowel visemes
      try {
        const sp = createSpeech(player, { motion: 1.25 });
        speechRef.current = sp;
      } catch {
        // ignore if Web Audio unavailable
      }
    } catch (err: any) {
      console.error('[HitaishiAvatarCanvas] Failed to create player:', err);
      setLoadState('error');
      setErrorMsg(err?.message || 'WebGL initialization failed');
      return;
    }

    const source =
      character.customFiles && character.customFiles.size > 0
        ? character.customFiles
        : character.format === '3d-procedural'
          ? new Map<string, Blob>([
              [
                'model.json',
                new Blob(
                  [JSON.stringify({ preset: character.proceduralPreset || 'nova' })],
                  { type: 'application/json' }
                ),
              ],
            ])
          : character.modelUrl;

    player
      .load(source as any)
      .then(() => {
        if (cancelled) return;
        try {
          if ('watermark' in player) {
            (player as any).watermark = null;
          }
          (player as any).mark?.set?.('none', null, false);
        } catch {
          // ignore
        }
        setLoadState('ready');
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error(`[HitaishiAvatarCanvas] Failed to load model for ${character.name}:`, err);
        setLoadState('error');
        setErrorMsg(err?.message || 'Failed to load avatar rig');
      });

    return () => {
      cancelled = true;
      if (exprAnimationRef.current) {
        exprAnimationRef.current.stop();
        exprAnimationRef.current = null;
      }
      if (exprDriverStopRef.current) {
        try {
          exprDriverStopRef.current();
        } catch {
          // ignore
        }
        exprDriverStopRef.current = null;
      }
      if (trackingStopRef.current) {
        try {
          trackingStopRef.current();
        } catch {
          // ignore
        }
        trackingStopRef.current = null;
      }
      if (speechRef.current) {
        try {
          speechRef.current.dispose();
        } catch {
          // ignore
        }
        speechRef.current = null;
      }
      try {
        player.dispose({ release: true });
      } catch {
        // ignore
      }
      if (playerRef.current === player) {
        playerRef.current = null;
      }
    };
  }, [
    character.uid,
    character.format,
    character.modelUrl,
    character.proceduralPreset,
    character.customFiles,
  ]);

  // Play incoming neural TTS audio clips through @livliv-dev/player/voice createSpeech
  useEffect(() => {
    const sp = speechRef.current;
    if (!sp || loadState !== 'ready' || !speechClip) return;
    if (speechClip.seq === lastSpeechSeqRef.current) return;
    lastSpeechSeqRef.current = speechClip.seq;

    if (!speechClip.audioBlob) {
      try {
        sp.stop();
      } catch {
        // ignore
      }
      return;
    }

    try {
      sp.unlock();
      sp.volume = speechClip.volume ?? 1.0;
      sp.stop();
      sp.say(speechClip.audioBlob, {
        onStart: () => {
          speechClip.onStart?.();
        },
        onEnd: () => {
          speechClip.onEnd?.();
        },
      });
    } catch {
      speechClip.onEnd?.();
    }
  }, [loadState, speechClip]);

  // Framer Motion spring interpolation for facial expressions + @livliv-dev/player native expression weights
  useEffect(() => {
    const player = playerRef.current;
    if (!player || loadState !== 'ready') return;

    const nextExpr = character.activeExpression;
    const strength = Math.max(0, Math.min(1, character.expressionStrength ?? 1));
    const prevExpr = prevExpressionRef.current;
    const isExprChanged = prevExpr !== undefined && prevExpr !== nextExpr;
    prevExpressionRef.current = nextExpr;

    if (exprAnimationRef.current) {
      exprAnimationRef.current.stop();
      exprAnimationRef.current = null;
    }

    const startPose = { ...exprPoseRef.current };
    const targetKey = nextExpr && EXPRESSION_POSE_TARGETS[nextExpr] ? nextExpr : 'neutral';
    const rawTarget = EXPRESSION_POSE_TARGETS[targetKey];
    const targetPose = {
      browLY: rawTarget.browLY * strength,
      browRY: rawTarget.browRY * strength,
      angleY: rawTarget.angleY * strength,
      angleZ: rawTarget.angleZ * strength,
      eyeBallX: rawTarget.eyeBallX * strength,
      eyeBallY: rawTarget.eyeBallY * strength,
      smile: rawTarget.smile * strength,
      bodyZ: rawTarget.bodyZ * strength,
    };

    // Trigger a natural micro-blink on the player when switching between two expressions
    // so discrete eye/brow layer swaps occur seamlessly behind closing eyelids
    if (isExprChanged) {
      try {
        player.blink();
      } catch {
        // ignore
      }
    }

    let swappedTexture = !isExprChanged;
    if (!isExprChanged) {
      try {
        player.setExpression(nextExpr, strength);
      } catch {
        // ignore
      }
    }

    const controls = animate(0, 1, {
      type: 'spring',
      stiffness: 175,
      damping: 20,
      mass: 0.85,
      onUpdate: (progress) => {
        const t = Math.max(0, Math.min(1, progress));

        // Swap the underlying LivLiv expression ID right as the eyelid cushion peaks (t >= 0.22)
        if (!swappedTexture && t >= 0.22) {
          swappedTexture = true;
          try {
            player.setExpression(nextExpr, Math.max(0.15, t * strength));
          } catch {
            // ignore
          }
        } else if (swappedTexture) {
          try {
            player.setExpression(nextExpr, Math.min(1, Math.max(0.15, t) * strength));
          } catch {
            // ignore
          }
        }

        // Smooth eyelid cushion curve during the first half of an expression change
        const blinkCushion =
          isExprChanged && t < 0.55 ? Math.sin((t / 0.55) * Math.PI) * 0.38 : 0;

        exprPoseRef.current = {
          browLY: startPose.browLY + (targetPose.browLY - startPose.browLY) * t,
          browRY: startPose.browRY + (targetPose.browRY - startPose.browRY) * t,
          angleY: startPose.angleY + (targetPose.angleY - startPose.angleY) * t,
          angleZ: startPose.angleZ + (targetPose.angleZ - startPose.angleZ) * t,
          eyeBallX: startPose.eyeBallX + (targetPose.eyeBallX - startPose.eyeBallX) * t,
          eyeBallY: startPose.eyeBallY + (targetPose.eyeBallY - startPose.eyeBallY) * t,
          smile: startPose.smile + (targetPose.smile - startPose.smile) * t,
          bodyZ: startPose.bodyZ + (targetPose.bodyZ - startPose.bodyZ) * t,
          blinkDip: blinkCushion,
        };
      },
      onComplete: () => {
        exprPoseRef.current = {
          ...targetPose,
          blinkDip: 0,
        };
        try {
          player.setExpression(nextExpr, strength);
        } catch {
          // ignore
        }
      },
    });

    exprAnimationRef.current = controls;

    return () => {
      controls.stop();
    };
  }, [loadState, character.activeExpression, character.expressionStrength]);

  // Sync live view framing, idle, gaze, away state, and manual mouthOpen
  useEffect(() => {
    const player = playerRef.current;
    if (!player || loadState !== 'ready') return;

    try {
      player.view.zoom = character.zoom;
      player.view.x = character.offsetX;
      player.view.y = character.offsetY;
      player.view.fit = character.fit;
      player.view.head = character.headFraming;

      player.idle = character.idleMotion;
      player.followPointer =
        character.movementInput === 'mouse' || character.gazeMode === 'camera'
          ? 'page'
          : false;

      player.bodyMotion =
        character.movementRange === 'calm'
          ? 0.45
          : character.movementRange === 'lively'
            ? 1.0
            : 0.8;

      player.setAway(character.isAway);

      // Sync manual syllable mouthOpen when not driven by @livliv-dev/player/voice createSpeech or mic
      const speechBusy = Boolean(speechRef.current?.busy);
      if (
        !speechBusy &&
        character.movementInput !== 'mic' &&
        character.movementInput !== 'face'
      ) {
        player.params.mouthOpen = character.mouthOpen;
      }
    } catch {
      // ignore transient sync errors
    }
  }, [
    loadState,
    character.zoom,
    character.offsetX,
    character.offsetY,
    character.fit,
    character.headFraming,
    character.idleMotion,
    character.movementRange,
    character.movementInput,
    character.gazeMode,
    character.isAway,
    character.mouthOpen,
  ]);

  // Trigger discrete physical actions (nod, shake, tilt, hop, shy)
  useEffect(() => {
    const player = playerRef.current;
    if (!player || loadState !== 'ready' || !character.activeAction) return;
    if (character.activeAction.seq !== lastActionSeqRef.current) {
      lastActionSeqRef.current = character.activeAction.seq;
      try {
        player.act(character.activeAction.id);
      } catch {
        // ignore
      }
    }
  }, [loadState, character.activeAction]);

  // Manage live input trackers: 'face' (webcam), 'face-replay' (built-in 24s trace), 'mic' (microphone)
  useEffect(() => {
    const player = playerRef.current;
    if (!player || loadState !== 'ready') return;

    if (trackingStopRef.current) {
      try {
        trackingStopRef.current();
      } catch {
        // ignore
      }
      trackingStopRef.current = null;
    }

    let cancelled = false;

    if (character.movementInput === 'face') {
      startFaceTracking(player, { mirror: true })
        .then((tracker) => {
          if (cancelled) {
            tracker.stop();
            return;
          }
          trackingStopRef.current = () => tracker.stop();
          onTrackingStatusChange?.(character.uid, { active: true, mode: 'face' });
        })
        .catch((err: any) => {
          if (cancelled) return;
          console.warn(
            '[HitaishiAvatarCanvas] Webcam face tracking fallback to synth replay:',
            err
          );
          startFaceTracking(player, { trace: 'synth' })
            .then((tracker) => {
              if (cancelled) {
                tracker.stop();
                return;
              }
              trackingStopRef.current = () => tracker.stop();
              onTrackingStatusChange?.(character.uid, {
                active: true,
                mode: 'face-replay',
                error: 'Camera unavailable in preview — running live Face Replay trace',
              });
            })
            .catch(() => {});
        });
    } else if (character.movementInput === 'face-replay') {
      startFaceTracking(player, { trace: 'synth' })
        .then((tracker) => {
          if (cancelled) {
            tracker.stop();
            return;
          }
          trackingStopRef.current = () => tracker.stop();
          onTrackingStatusChange?.(character.uid, { active: true, mode: 'face-replay' });
        })
        .catch((err: any) => {
          onTrackingStatusChange?.(character.uid, {
            active: false,
            mode: 'face-replay',
            error: err?.message,
          });
        });
    } else if (character.movementInput === 'mic') {
      startLipSync(player)
        .then((handle) => {
          if (cancelled) {
            handle.stop();
            return;
          }
          trackingStopRef.current = () => handle.stop();
          onTrackingStatusChange?.(character.uid, { active: true, mode: 'mic' });
        })
        .catch((err: any) => {
          onTrackingStatusChange?.(character.uid, {
            active: false,
            mode: 'mic',
            error: err?.message || 'Microphone permission denied',
          });
        });
    } else {
      onTrackingStatusChange?.(character.uid, {
        active: false,
        mode: character.movementInput,
      });
    }

    return () => {
      cancelled = true;
      if (trackingStopRef.current) {
        try {
          trackingStopRef.current();
        } catch {
          // ignore
        }
        trackingStopRef.current = null;
      }
    };
  }, [loadState, character.movementInput, character.uid]);

  return (
    <motion.div
      key={character.uid}
      initial={{ opacity: 0, scale: 0.97, scaleX: character.flipHorizontal ? -1 : 1 }}
      animate={{ opacity: 1, scale: 1, scaleX: character.flipHorizontal ? -1 : 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="relative w-full h-full select-none"
      style={{
        filter: character.shadow
          ? 'drop-shadow(0 18px 26px rgba(15, 23, 42, 0.28))'
          : undefined,
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full block pointer-events-none" />
      {loadState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white/80 shadow-md bg-white/70 backdrop-blur-sm">
            <img
              src={character.avatarUrl}
              alt={character.name}
              className="w-full h-full object-cover animate-pulse"
            />
          </div>
          <span className="mt-2 px-2.5 py-0.5 rounded-full bg-zinc-900/75 text-white text-[11px] font-medium tracking-tight backdrop-blur-sm">
            Loading {character.name}…
          </span>
        </div>
      )}
      {loadState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center pointer-events-none">
          <img
            src={character.avatarUrl}
            alt={character.name}
            className="w-28 h-28 rounded-2xl object-cover border-2 border-white shadow-lg mb-2"
          />
          <span className="px-2.5 py-1 rounded-md bg-zinc-900/80 text-white text-[11px] font-medium">
            {character.name} ({errorMsg || 'Fallback Preview'})
          </span>
        </div>
      )}
    </motion.div>
  );
};
