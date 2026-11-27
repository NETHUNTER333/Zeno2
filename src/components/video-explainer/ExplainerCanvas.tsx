import React, { useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import type { ExplainerProject, ExplainerScene, ExplainerStyle, ReviewComment } from './types';

interface ExplainerCanvasProps {
  project: ExplainerProject;
  currentTime: number;
  isPlaying: boolean;
  showCaptions: boolean;
  activeWordIndex?: number;
  comments: ReviewComment[];
  pinMode: boolean;
  selectedCommentId: string | null;
  onTogglePlay: () => void;
  onCanvasPin: (pin: { sceneId: string; sceneTitle: string; timeSec: number; xPct: number; yPct: number }) => void;
  onSelectComment: (id: string) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

const W = 1280;
const H = 720;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function getActiveSceneAt(project: ExplainerProject, timeSec: number): {
  scene: ExplainerScene;
  index: number;
  localTime: number;
  progress: number;
  startSec: number;
} {
  let acc = 0;
  for (let i = 0; i < project.scenes.length; i++) {
    const s = project.scenes[i];
    const dur = Math.max(1, s.durationSec);
    if (timeSec < acc + dur || i === project.scenes.length - 1) {
      const localTime = Math.max(0, Math.min(dur, timeSec - acc));
      return { scene: s, index: i, localTime, progress: Math.min(1, localTime / dur), startSec: acc };
    }
    acc += dur;
  }
  const fallback = project.scenes[0];
  return { scene: fallback, index: 0, localTime: 0, progress: 0, startSec: 0 };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  family: string,
  weight = 700
): number {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return minSize;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawBoilRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  boilFrame: number,
  seed: number,
  fill: string,
  stroke: string
) {
  const j = (k: number) => (hash01(boilFrame * 17.3 + seed * 31.1 + k * 7.7) - 0.5) * 4.0;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + j(1), y + j(2));
  ctx.lineTo(x + w + j(3), y + j(4));
  ctx.lineTo(x + w + j(5), y + h + j(6));
  ctx.lineTo(x + j(7), y + h + j(8));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

function drawIllustratedNarrator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  boilFrame: number,
  accent: string,
  isPlaying: boolean
) {
  const j = (k: number) => (hash01(boilFrame * 13.7 + k * 5.3) - 0.5) * 2.2;
  const bob = isPlaying ? Math.sin(t * 3.8) * 3.5 : 0;
  const mouthOpen = isPlaying ? Math.abs(Math.sin(t * 11)) * 6.5 + 2 : 2.5;

  ctx.save();
  ctx.translate(x + j(1), y + bob + j(2));

  ctx.beginPath();
  ctx.ellipse(0, 74, 44, 30, 0, Math.PI, 0);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#1f2937';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 12, 33, 0, Math.PI * 2);
  ctx.fillStyle = '#fde6c4';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-2, 4, 34, Math.PI * 1.05, Math.PI * 1.98);
  ctx.fillStyle = '#292524';
  ctx.fill();

  const blink = isPlaying && t % 3.6 > 3.45;
  ctx.fillStyle = '#1f2937';
  [-11, 11].forEach((ex) => {
    if (blink) {
      ctx.beginPath();
      ctx.moveTo(ex - 5, 11);
      ctx.lineTo(ex + 5, 11);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(ex, 11, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.fillStyle = 'rgba(244, 114, 182, 0.34)';
  ctx.beginPath(); ctx.arc(-18, 19, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(18, 19, 6, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#be123c';
  ctx.beginPath();
  ctx.ellipse(0, 24, 6, mouthOpen * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function draw3DStudioBackdrop(ctx: CanvasRenderingContext2D, t: number, sceneIdx: number, accent: string) {
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.36, 40, W * 0.5, H * 0.5, W * 0.78);
  bg.addColorStop(0, '#131b2e');
  bg.addColorStop(0.55, '#090d18');
  bg.addColorStop(1, '#04060c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.65, H * 0.35, 10, W * 0.65, H * 0.35, 420);
  glow.addColorStop(0, `${accent}30`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const horizonY = H * 0.64;
  const camX = Math.sin(t * 0.45 + sceneIdx * 1.1) * 90;
  ctx.save();
  ctx.strokeStyle = `${accent}26`;
  ctx.lineWidth = 1.2;

  for (let i = -10; i <= 10; i++) {
    const topX = W * 0.5 + i * 38 + camX * 0.22;
    const botX = W * 0.5 + i * 175 + camX;
    ctx.beginPath();
    ctx.moveTo(topX, horizonY);
    ctx.lineTo(botX, H + 40);
    ctx.stroke();
  }
  const scroll = (t * 0.55) % 1;
  for (let r = 0; r < 10; r++) {
    const p = (r + scroll) / 10;
    const y = horizonY + Math.pow(p, 1.9) * (H - horizonY + 20);
    ctx.globalAlpha = 0.08 + p * 0.32;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
}

function draw3DOrbitCenterpiece(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, accent: string, labels: string[]) {
  ctx.save();
  const radiusX = 225;
  const radiusY = 72;

  for (let r = 0; r < 2; r++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX * (1 - r * 0.24), radiusY * (1 - r * 0.24), r === 0 ? -0.16 : 0.2, 0, Math.PI * 2);
    ctx.strokeStyle = r === 0 ? `${accent}66` : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  const coreGrad = ctx.createRadialGradient(cx - 22, cy - 24, 8, cx, cy, 64);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.32, accent);
  coreGrad.addColorStop(1, '#0f172a');
  ctx.beginPath();
  ctx.arc(cx, cy, 56 + Math.sin(t * 2.5) * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();

  const count = Math.max(3, labels.length);
  const nodes = Array.from({ length: count }, (_, i) => {
    const angle = t * 0.65 + (i / count) * Math.PI * 2;
    const z = Math.sin(angle);
    const scale = 0.78 + (z + 1) * 0.16;
    return {
      x: cx + Math.cos(angle) * radiusX,
      y: cy + Math.sin(angle) * radiusY - 10,
      z,
      scale,
      label: labels[i % labels.length] || `Node ${i + 1}`,
    };
  }).sort((a, b) => a.z - b.z);

  for (const n of nodes) {
    const cw = 170 * n.scale;
    const ch = 48 * n.scale;
    ctx.save();
    ctx.globalAlpha = 0.56 + (n.z + 1) * 0.22;
    drawRoundedRect(ctx, n.x - cw / 2, n.y - ch / 2, cw, ch, 12 * n.scale);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    const fs = fitFontSize(ctx, n.label, cw - 20, Math.round(15 * n.scale), 11, '"Plus Jakarta Sans", system-ui, sans-serif', 600);
    ctx.font = `600 ${fs}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label, n.x, n.y);
    ctx.restore();
  }

  ctx.restore();
}

function renderExplainerFrame(
  ctx: CanvasRenderingContext2D,
  project: ExplainerProject,
  currentTime: number,
  isPlaying: boolean,
  showCaptions: boolean,
  activeWordIndex?: number
) {
  const style: ExplainerStyle = project.style;
  const { scene, index, localTime, progress } = getActiveSceneAt(project, currentTime);
  // Never render a blank frame at 00:00 — when paused at start, settle to hero resting pose
  const animTime = !isPlaying && localTime < 0.08 ? 1.2 : localTime;
  const enter = isPlaying ? 0.35 + 0.65 * easeOutCubic(Math.min(1, animTime / 0.42)) : 1;
  const accent = scene.accentColor || '#38bdf8';
  const isIllustrated = style === 'illustrated';
  const is3D = style === '3d';
  const boilFrame = Math.floor((isPlaying ? currentTime : 1) * 10);

  ctx.clearRect(0, 0, W, H);

  // 1. Style Backdrop
  if (isIllustrated) {
    ctx.fillStyle = '#f6efe2';
    ctx.fillRect(0, 0, W, H);
    const w1 = ctx.createRadialGradient(180, 140, 20, 180, 140, 380);
    w1.addColorStop(0, `${accent}26`);
    w1.addColorStop(1, 'rgba(246,239,226,0)');
    ctx.fillStyle = w1;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(120, 100, 75, 0.075)';
    for (let g = 0; g < 150; g++) {
      ctx.fillRect(hash01(g * 19.1) * W, hash01(g * 47.3) * H, 2, 2);
    }
    drawBoilRect(ctx, 28, 28, W - 56, H - 56, boilFrame, 99, 'rgba(255,255,255,0.22)', '#292524');
  } else if (is3D) {
    draw3DStudioBackdrop(ctx, isPlaying ? currentTime : 1.4, index, accent);
  } else {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#090b10');
    bg.addColorStop(1, '#10141f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.032)';
    ctx.lineWidth = 1;
    for (let x = 80; x < W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 80; y < H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const rad = ctx.createRadialGradient(W * 0.82, H * 0.18, 10, W * 0.82, H * 0.18, 420);
    rad.addColorStop(0, `${accent}22`);
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);
  }

  const fgPrimary = isIllustrated ? '#1c1917' : '#f8fafc';
  const fgMuted = isIllustrated ? '#57534e' : '#94a3b8';
  const cardBg = isIllustrated ? '#fffdf8' : is3D ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.045)';
  const cardBorder = isIllustrated ? '#292524' : 'rgba(255, 255, 255, 0.13)';

  // 2. Top Editorial Kicker & Scene Counter
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.font = '600 16px "JetBrains Mono", monospace';
  ctx.fillStyle = isIllustrated ? '#7c2d12' : accent;
  ctx.textAlign = 'left';
  ctx.fillText(scene.kicker || `Scene ${index + 1}`, 76, 84);

  ctx.textAlign = 'right';
  ctx.fillStyle = fgMuted;
  ctx.font = '500 15px "JetBrains Mono", monospace';
  ctx.fillText(
    `${String(index + 1).padStart(2, '0')} / ${String(project.scenes.length).padStart(2, '0')}`,
    W - 76,
    84
  );

  ctx.strokeStyle = isIllustrated ? 'rgba(41,37,36,0.16)' : 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(76, 102);
  ctx.lineTo(W - 76, 102);
  ctx.stroke();
  ctx.restore();

  // 3. Scene Visual Composition
  const slideY = (1 - enter) * 18;
  ctx.save();
  ctx.globalAlpha = enter;

  const isHeroCentered = scene.visualType === 'kinetic-title';
  if (!isHeroCentered) {
    ctx.fillStyle = fgPrimary;
    const titleFamily = isIllustrated ? '"Fraunces", Georgia, serif' : '"Plus Jakarta Sans", "Outfit", system-ui, sans-serif';
    ctx.font = `700 40px ${titleFamily}`;
    ctx.textAlign = 'left';
    const titleLines = wrapLines(ctx, scene.title, isIllustrated ? 860 : 1040, 2);
    titleLines.forEach((ln, i) => ctx.fillText(ln, 76, 160 + i * 48 + slideY * 0.4));

    if (scene.subtitle) {
      ctx.fillStyle = fgMuted;
      ctx.font = '400 20px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(scene.subtitle, 76, 160 + titleLines.length * 48 + 8 + slideY * 0.4);
    }
  }

  if (scene.visualType === 'kinetic-title') {
    ctx.textAlign = 'center';
    ctx.fillStyle = fgPrimary;
    const heroFamily = isIllustrated ? '"Fraunces", Georgia, serif' : '"Outfit", "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.font = `700 62px ${heroFamily}`;
    const lines = wrapLines(ctx, scene.title, 980, 3);
    const startY = 308 - ((lines.length - 1) * 74) / 2;
    lines.forEach((ln, i) => {
      const lineEnter = isPlaying ? 0.35 + 0.65 * easeOutCubic(Math.min(1, (animTime - i * 0.1) / 0.45)) : 1;
      ctx.save();
      ctx.globalAlpha = lineEnter;
      ctx.fillText(ln, W / 2, startY + i * 74 + (1 - lineEnter) * 20);
      ctx.restore();
    });

    const barW = 140 * (isPlaying ? easeOutCubic(Math.min(1, animTime / 0.65)) : 1);
    ctx.fillStyle = accent;
    drawRoundedRect(ctx, W / 2 - barW / 2, startY + lines.length * 74 - 26, barW, 5, 3);
    ctx.fill();

    if (scene.subtitle) {
      ctx.fillStyle = fgMuted;
      ctx.font = '400 25px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(scene.subtitle, W / 2, startY + lines.length * 74 + 22);
    }

    if (is3D) {
      draw3DOrbitCenterpiece(ctx, W / 2, 505, isPlaying ? currentTime : 1.4, accent, [scene.kicker, '3D', 'LIVE']);
    }
  } else if (scene.visualType === 'bar-chart') {
    const bars = scene.bars?.length
      ? scene.bars
      : [
          { label: 'Clarity', value: 94, displayValue: '94%' },
          { label: 'Speed', value: 86, displayValue: '4.2x' },
          { label: 'Retention', value: 91, displayValue: '91%' },
          { label: 'Accuracy', value: 96, displayValue: '96%' },
        ];
    const startX = 76;
    const baseY = 278;
    const rowH = 66;
    const maxBarW = isIllustrated ? 580 : 710;

    bars.forEach((bar, i) => {
      const p = isPlaying ? 0.2 + 0.8 * easeOutCubic(Math.min(1, (animTime - i * 0.12) / 0.7)) : 1;
      const y = baseY + i * rowH;

      ctx.fillStyle = fgPrimary;
      const lblSize = fitFontSize(ctx, bar.label, 196, 19, 14, '"Plus Jakarta Sans", system-ui, sans-serif', 600);
      ctx.font = `600 ${lblSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(bar.label, startX, y + 26);

      const trackX = startX + 216;
      const barW = Math.max(16, (bar.value / 100) * maxBarW * p);

      if (isIllustrated) {
        drawBoilRect(ctx, trackX, y + 4, maxBarW, 34, boilFrame, i + 10, 'rgba(41,37,36,0.06)', 'rgba(41,37,36,0.22)');
        drawBoilRect(ctx, trackX, y + 4, barW, 34, boilFrame, i + 40, accent, '#1c1917');
      } else {
        drawRoundedRect(ctx, trackX, y + 4, maxBarW, 34, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fill();
        drawRoundedRect(ctx, trackX, y + 4, barW, 34, 8);
        const grad = ctx.createLinearGradient(trackX, y, trackX + barW, y);
        grad.addColorStop(0, accent);
        grad.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.fillStyle = fgPrimary;
      ctx.font = '700 19px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(bar.displayValue, trackX + barW + 16, y + 27);
    });
  } else if (scene.visualType === 'flow-route') {
    const steps = scene.steps?.length
      ? scene.steps
      : [
          { label: 'Input', detail: 'Topic, doc, or live URL' },
          { label: 'Director', detail: 'Scene timing & narration' },
          { label: 'Renderer', detail: 'Deterministic HD canvas' },
          { label: 'Review', detail: 'Pin comments & revise' },
        ];
    const count = steps.length;
    const totalW = isIllustrated ? 930 : 1128;
    const gap = 34;
    const boxW = (totalW - gap * (count - 1)) / count;
    const startX = 76;
    const boxY = 296;
    const boxH = 205;

    steps.forEach((st, i) => {
      const p = isPlaying ? 0.55 + 0.45 * easeOutCubic(Math.min(1, (animTime - i * 0.14) / 0.48)) : 1;
      const x = startX + i * (boxW + gap);
      const y = boxY + (1 - p) * 14;
      const isActiveStep = !isPlaying ? i === 0 : progress >= i / count;

      ctx.save();
      ctx.globalAlpha = p;
      if (isIllustrated) {
        drawBoilRect(ctx, x, y, boxW, boxH, boilFrame, i + 20, isActiveStep ? '#fffbeb' : cardBg, isActiveStep ? '#1c1917' : '#78716c');
      } else {
        drawRoundedRect(ctx, x, y, boxW, boxH, 16);
        ctx.fillStyle = isActiveStep ? `${accent}18` : cardBg;
        ctx.fill();
        ctx.lineWidth = isActiveStep ? 2 : 1;
        ctx.strokeStyle = isActiveStep ? accent : cardBorder;
        ctx.stroke();
      }

      // Draw clean directional connector arrow strictly in the gap AFTER this card (never over text!)
      if (i < count - 1) {
        const ax1 = x + boxW + 6;
        const ax2 = x + boxW + gap - 6;
        const ay = boxY + boxH * 0.5;
        ctx.save();
        ctx.strokeStyle = isActiveStep ? accent : fgMuted;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(ax1, ay);
        ctx.lineTo(ax2, ay);
        ctx.moveTo(ax2 - 6, ay - 5);
        ctx.lineTo(ax2, ay);
        ctx.lineTo(ax2 - 6, ay + 5);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = isIllustrated ? '#9a3412' : accent;
      ctx.font = '700 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`0${i + 1}`, x + 22, y + 38);

      ctx.fillStyle = fgPrimary;
      const stepFs = fitFontSize(ctx, st.label, boxW - 44, 23, 16, '"Plus Jakarta Sans", system-ui, sans-serif', 700);
      ctx.font = `700 ${stepFs}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.fillText(st.label, x + 22, y + 82);

      ctx.fillStyle = fgMuted;
      ctx.font = '400 15.5px "Plus Jakarta Sans", system-ui, sans-serif';
      wrapLines(ctx, st.detail, boxW - 44, 3).forEach((ln, li) => {
        ctx.fillText(ln, x + 22, y + 118 + li * 23);
      });
      ctx.restore();
    });
  } else if (scene.visualType === 'quote-clipping') {
    const q = scene.quote || {
      text: scene.narration,
      author: scene.sourceAttribution || 'Editorial Source',
      publication: project.title,
    };
    const qx = 96;
    const qy = 285;
    const qw = isIllustrated ? 920 : 1080;
    const qh = 235;

    if (isIllustrated) {
      drawBoilRect(ctx, qx, qy, qw, qh, boilFrame, 77, '#fffdf8', '#1c1917');
    } else {
      drawRoundedRect(ctx, qx, qy, qw, qh, 20);
      ctx.fillStyle = cardBg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = cardBorder;
      ctx.stroke();
    }

    ctx.fillStyle = accent;
    ctx.font = '700 72px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('“', qx + 34, qy + 78);

    ctx.fillStyle = fgPrimary;
    ctx.font = '500 28px "Fraunces", Georgia, serif';
    const qLines = wrapLines(ctx, q.text, qw - 130, 3);
    qLines.forEach((ln, i) => ctx.fillText(ln, qx + 88, qy + 82 + i * 40));

    ctx.fillStyle = fgMuted;
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillText(`— ${q.author} · ${q.publication}`, qx + 88, qy + qh - 32);
  } else if (scene.visualType === 'device-card') {
    const lines = scene.deviceLines?.length
      ? scene.deviceLines
      : [
          `$ explainer direct "${project.title.slice(0, 34)}"`,
          `✓ Grounded ${project.sources.length || 3} sources · Style: ${project.style}`,
          `✓ Generated ${project.scenes.length} timed scenes`,
          `→ Ready for pinned review & export`,
        ];
    const cx = 130;
    const cy = 278;
    const cw = isIllustrated ? 860 : 1020;
    const ch = 260;

    ctx.save();
    if (!isIllustrated && isPlaying) {
      ctx.translate(W / 2, cy + ch / 2);
      ctx.rotate(Math.sin(currentTime * 0.8) * 0.008);
      ctx.translate(-W / 2, -(cy + ch / 2));
    }

    if (isIllustrated) {
      drawBoilRect(ctx, cx, cy, cw, ch, boilFrame, 55, '#1c1917', '#1c1917');
    } else {
      drawRoundedRect(ctx, cx, cy, cw, ch, 18);
      ctx.fillStyle = '#070a12';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `${accent}66`;
      ctx.stroke();
    }

    ['#f87171', '#fbbf24', '#34d399'].forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(cx + 28 + i * 20, cy + 26, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });

    ctx.textAlign = 'left';
    lines.forEach((line, i) => {
      const lp = isPlaying ? easeOutCubic(Math.min(1, (animTime - 0.1 - i * 0.28) / 0.45)) : 1;
      if (lp <= 0.02) return;
      ctx.save();
      ctx.globalAlpha = lp;
      ctx.fillStyle = line.startsWith('✓') ? '#34d399' : line.startsWith('→') ? accent : '#e2e8f0';
      const fs = fitFontSize(ctx, line, cw - 64, 19, 14, '"JetBrains Mono", monospace', 500);
      ctx.font = `500 ${fs}px "JetBrains Mono", monospace`;
      const visibleChars = isPlaying ? Math.max(1, Math.floor(line.length * Math.min(1, lp * 1.25))) : line.length;
      ctx.fillText(line.slice(0, visibleChars), cx + 32, cy + 82 + i * 44);
      ctx.restore();
    });
    ctx.restore();
  } else if (scene.visualType === '3d-orbit' || is3D) {
    const labels =
      scene.metrics?.map((m) => `${m.value} ${m.label}`) ||
      scene.steps?.map((s) => s.label) ||
      ['Grounded', 'Deterministic', 'Synced Audio', 'Reviewable'];
    draw3DOrbitCenterpiece(ctx, W * 0.5, 420, isPlaying ? currentTime : 1.4, accent, labels);
  } else {
    // metric-grid with automatic measureText font fitting (zero overflow!)
    const metrics = scene.metrics?.length
      ? scene.metrics
      : [
          { value: '60s', label: 'Tight editorial runtime' },
          { value: '3 Modes', label: 'Motion, Illustrated, 3D' },
          { value: '100%', label: 'Crisp vector typography' },
        ];
    const count = metrics.length;
    const totalW = isIllustrated ? 930 : 1128;
    const gap = 24;
    const cardW = (totalW - gap * (count - 1)) / count;
    const startX = 76;
    const cardY = 296;
    const cardH = 210;

    metrics.forEach((m, i) => {
      const p = isPlaying ? 0.5 + 0.5 * easeOutCubic(Math.min(1, (animTime - i * 0.12) / 0.5)) : 1;
      const x = startX + i * (cardW + gap);
      const y = cardY + (1 - p) * 16;
      ctx.save();
      ctx.globalAlpha = p;
      if (isIllustrated) {
        drawBoilRect(ctx, x, y, cardW, cardH, boilFrame, i + 66, '#fffdf8', '#1c1917');
      } else {
        drawRoundedRect(ctx, x, y, cardW, cardH, 18);
        ctx.fillStyle = cardBg;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = cardBorder;
        ctx.stroke();
      }

      ctx.fillStyle = isIllustrated ? '#9a3412' : accent;
      const valFs = fitFontSize(ctx, m.value, cardW - 48, 48, 22, '"JetBrains Mono", monospace', 700);
      ctx.font = `700 ${valFs}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(m.value, x + 24, y + 92);

      ctx.fillStyle = fgPrimary;
      ctx.font = '500 18px "Plus Jakarta Sans", system-ui, sans-serif';
      wrapLines(ctx, m.label, cardW - 48, 2).forEach((ln, li) => {
        ctx.fillText(ln, x + 24, y + 138 + li * 26);
      });
      ctx.restore();
    });
  }

  ctx.restore();

  if (isIllustrated) {
    drawIllustratedNarrator(ctx, W - 122, H - 188, isPlaying ? currentTime : 1, boilFrame, accent, isPlaying);
  }

  // 4. Source Attribution
  if (scene.sourceAttribution) {
    ctx.save();
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.fillStyle = fgMuted;
    ctx.textAlign = 'left';
    ctx.fillText(`Source: ${scene.sourceAttribution}`, 76, H - 24);
    ctx.restore();
  }

  // 5. Word-for-Word Synced Captions (driven by live TTS word index when available!)
  if (showCaptions && scene.narration) {
    const words = scene.narration.split(/\s+/).filter(Boolean);
    const activeIdx =
      typeof activeWordIndex === 'number' && activeWordIndex >= 0
        ? Math.min(words.length - 1, activeWordIndex)
        : Math.min(words.length - 1, Math.floor(progress * words.length));
    const windowSize = 9;
    const chunkStart = Math.floor(activeIdx / windowSize) * windowSize;
    const visibleWords = words.slice(chunkStart, chunkStart + windowSize);

    ctx.save();
    ctx.font = '600 23px "Plus Jakarta Sans", system-ui, sans-serif';
    const fullStr = visibleWords.join(' ');
    const pillW = Math.min(W - 180, ctx.measureText(fullStr).width + 52);
    const pillH = 52;
    const pillX = (W - pillW) / 2;
    const pillY = H - 100;

    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 13);
    ctx.fillStyle = isIllustrated ? 'rgba(28, 25, 23, 0.92)' : 'rgba(6, 8, 14, 0.86)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();

    let cursorX = pillX + 26;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    visibleWords.forEach((word, wi) => {
      const globalWordIdx = chunkStart + wi;
      const isCurrent = globalWordIdx === activeIdx;
      const isSpoken = globalWordIdx < activeIdx;
      ctx.fillStyle = isCurrent ? accent : isSpoken ? '#ffffff' : 'rgba(255,255,255,0.52)';
      ctx.fillText(word, cursorX, pillY + pillH / 2);
      cursorX += ctx.measureText(`${word} `).width;
    });
    ctx.restore();
  }

  // 6. Subtle bottom scene progress hairline
  ctx.fillStyle = isIllustrated ? 'rgba(28,25,23,0.12)' : 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, H - 4, W, 4);
  ctx.fillStyle = accent;
  ctx.fillRect(0, H - 4, W * progress, 4);
}

export const ExplainerCanvas: React.FC<ExplainerCanvasProps> = ({
  project,
  currentTime,
  isPlaying,
  showCaptions,
  activeWordIndex,
  comments,
  pinMode,
  selectedCommentId,
  onTogglePlay,
  onCanvasPin,
  onSelectComment,
  canvasRef: externalRef,
}) => {
  const internalRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = externalRef || internalRef;

  const active = getActiveSceneAt(project, currentTime);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderExplainerFrame(ctx, project, currentTime, isPlaying, showCaptions, activeWordIndex);
  }, [project, currentTime, isPlaying, showCaptions, activeWordIndex, canvasRef]);

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode) {
      onTogglePlay();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(6, Math.min(94, ((e.clientY - rect.top) / rect.height) * 100));
    onCanvasPin({
      sceneId: active.scene.id,
      sceneTitle: active.scene.title,
      timeSec: Number(currentTime.toFixed(1)),
      xPct: Number(xPct.toFixed(1)),
      yPct: Number(yPct.toFixed(1)),
    });
  };

  const sceneComments = comments.filter((c) => c.sceneId === active.scene.id);

  return (
    <div
      onClick={handleStageClick}
      className={`group relative w-full aspect-video rounded-xl overflow-hidden bg-[#090b10] border border-white/10 select-none ${
        pinMode ? 'cursor-crosshair ring-2 ring-sky-400/80' : 'cursor-pointer'
      }`}
    >
      <canvas ref={canvasRef} width={W} height={H} className="w-full h-full block" />

      {!isPlaying && !pinMode && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/15 opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="size-14 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </span>
        </div>
      )}

      {pinMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-black/85 text-white text-[11px] font-medium border border-white/15 pointer-events-none whitespace-nowrap">
          Tap anywhere on the frame to drop a review pin
        </div>
      )}

      {sceneComments.map((c, idx) => {
        const isSelected = c.id === selectedCommentId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectComment(c.id);
            }}
            style={{ left: `${c.xPct}%`, top: `${c.yPct}%` }}
            title={`${c.sceneTitle} @ ${c.timeSec}s: ${c.text}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 size-7 rounded-full text-[11px] font-mono font-bold flex items-center justify-center shadow-lg border-2 transition-transform cursor-pointer ${
              c.resolved
                ? 'bg-emerald-500 text-white border-white/80 opacity-80'
                : isSelected
                ? 'bg-sky-400 text-slate-950 border-white scale-115'
                : 'bg-amber-400 text-slate-950 border-white hover:scale-110'
            }`}
          >
            {idx + 1}
          </button>
        );
      })}
    </div>
  );
};
