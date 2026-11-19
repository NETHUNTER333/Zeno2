import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PHYSICS_PRESETS,
  buildFallbackPhysicsSimulation,
  createInitialCustomPhysicsState,
  createInitialPhysicsState,
  detectPhysicsPresetFromTopic,
  evaluateMathExpression,
  getDefaultCustomParams,
  getDefaultPresetParams,
  sanitizeCustomPhysicsSpec,
  stepCustomPhysicsState,
  stepPhysicsState,
  type CustomPhysicsSimSpec,
  type CustomPhysicsSimState,
  type PhysicsPresetId,
  type PhysicsSimulationState,
} from '../lib/physicsEngine';
import { apiFetch } from '../lib/apiBase';
import { getAuthHeaders } from '../lib/firebase';
import { MathMarkdown, MathText, MathFormula, SvgLatex } from './MathMarkdown';
import { expressionToLatex, formatCanvasMathText } from '../lib/latexEngine';

export type DeepTutorLabMode = 'physics' | 'diagram' | 'mastery' | 'deep_solve' | 'plotter';

interface DiagramNode {
  id: string;
  title: string;
  detail: string;
  tier: number;
}

interface MasteryCheckpoint {
  id: string;
  stage: string;
  title: string;
  prerequisite: string;
  objective: string;
  formula?: string;
}

interface StudyPhysicsVisualizeLabProps {
  topicTitle: string;
  topicContext?: string;
  lessonModules?: Array<{ title: string; summary: string }>;
  concepts?: Array<{ term: string; definition: string; mechanism: string }>;
  initialMode?: DeepTutorLabMode;
  standalone?: boolean;
  pageTitle?: string;
  isDark?: boolean;
  onBack?: () => void;
  onStartQuiz?: () => void;
  onAskTutor?: (prompt: string, topicOverride?: string) => void;
}

const STORAGE_MASTERY_KEY = 'kinich_deeptutor_mastery_v1';

const MODE_LABELS: Record<DeepTutorLabMode, string> = {
  physics: 'Physics Lab',
  diagram: 'Concept Diagram',
  mastery: 'Mastery Path',
  deep_solve: 'Deep Solve',
  plotter: 'Curve Plotter',
};

export function formatSvgMathText(raw: string): string {
  return formatCanvasMathText(raw);
}

function buildDefaultMasteryNodes(
  topicTitle: string,
  lessonModules: Array<{ title: string; summary: string }> = [],
  concepts: Array<{ term: string; definition: string; mechanism: string }> = []
): MasteryCheckpoint[] {
  const cleanTopic = topicTitle.trim() || 'Core Topic';
  const isGenericModuleTitle = (title: string) =>
    /^(overview|introduction|key concepts?|summary|core concepts?|conclusion)$/i.test(title.trim());

  const usableConcepts = concepts.filter(
    (c) => c.term && !isGenericModuleTitle(c.term) && c.definition
  );
  if (usableConcepts.length >= 3) {
    return usableConcepts.slice(0, 5).map((c, idx) => ({
      id: `mp-${idx}`,
      stage: `Stage ${idx + 1}`,
      title: c.term,
      prerequisite: idx === 0 ? 'Foundational intuition' : usableConcepts[idx - 1].term,
      objective: c.definition,
      formula: c.mechanism,
    }));
  }

  const usableModules = lessonModules.filter(
    (m) => m.title && !isGenericModuleTitle(m.title) && m.summary
  );
  if (usableModules.length >= 3) {
    return usableModules.slice(0, 5).map((m, idx) => ({
      id: `mp-${idx}`,
      stage: `Stage ${idx + 1}`,
      title: m.title,
      prerequisite: idx === 0 ? 'Core prerequisites' : usableModules[idx - 1].title,
      objective: m.summary,
    }));
  }

  return [
    {
      id: 'mp-0',
      stage: 'Stage 1',
      title: `${cleanTopic} Foundations`,
      prerequisite: 'Algebra & foundational intuition',
      objective: `Identify core variables, boundary conditions, and units governing ${cleanTopic}.`,
    },
    {
      id: 'mp-1',
      stage: 'Stage 2',
      title: 'Governing Equations & Laws',
      prerequisite: `${cleanTopic} Foundations`,
      objective: 'Formulate conservation principles and symbolic algebraic or differential relationships.',
    },
    {
      id: 'mp-2',
      stage: 'Stage 3',
      title: 'Parameter Sensitivity & Models',
      prerequisite: 'Governing Equations & Laws',
      objective: 'Perturb initial conditions and observe system response across regimes.',
    },
    {
      id: 'mp-3',
      stage: 'Stage 4',
      title: 'Multi-Step Problem Solving',
      prerequisite: 'Parameter Sensitivity & Models',
      objective: 'Complete numerical derivations and boundary checks without skipping intermediate proofs.',
    },
    {
      id: 'mp-4',
      stage: 'Stage 5',
      title: 'Mastery Verification',
      prerequisite: 'Multi-Step Problem Solving',
      objective: 'Verify retention through active recall questions and mechanism explanations.',
    },
  ];
}

export const StudyPhysicsVisualizeLab: React.FC<StudyPhysicsVisualizeLabProps> = ({
  topicTitle,
  topicContext = '',
  lessonModules = [],
  concepts = [],
  initialMode = 'physics',
  standalone = false,
  pageTitle,
  isDark = true,
  onBack,
  onStartQuiz,
  onAskTutor,
}) => {
  const [labMode, setLabMode] = useState<DeepTutorLabMode>(initialMode);
  useEffect(() => {
    setLabMode(initialMode);
  }, [initialMode]);

  // -------------------------------------------------------------------------
  // 1. INTERACTIVE 2D PHYSICS ENGINE STATE
  // -------------------------------------------------------------------------
  const [preset, setPreset] = useState<PhysicsPresetId>(() =>
    detectPhysicsPresetFromTopic(topicTitle)
  );
  const [params, setParams] = useState<Record<string, number>>(() =>
    getDefaultPresetParams(detectPhysicsPresetFromTopic(topicTitle))
  );
  const [simState, setSimState] = useState<PhysicsSimulationState>(() => {
    const initialPreset = detectPhysicsPresetFromTopic(topicTitle);
    return createInitialPhysicsState(initialPreset, getDefaultPresetParams(initialPreset));
  });
  const [simPrompt, setSimPrompt] = useState('');
  const [simGenerating, setSimGenerating] = useState(false);
  const [customSpec, setCustomSpec] = useState<CustomPhysicsSimSpec | null>(null);
  const [customState, setCustomState] = useState<CustomPhysicsSimState | null>(null);
  const [isCustomActive, setIsCustomActive] = useState(false);
  const [showVectors, setShowVectors] = useState(true);
  const [showTrail, setShowTrail] = useState(true);

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [physicsViewport, setPhysicsViewport] = useState<{ w: number; h: number }>({ w: 640, h: 420 });
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const customSpecRef = useRef(customSpec);
  customSpecRef.current = customSpec;
  const isCustomActiveRef = useRef(isCustomActive);
  isCustomActiveRef.current = isCustomActive;

  useEffect(() => {
    if (labMode !== 'physics') return;
    const el = canvasWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPhysicsViewport({ w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [labMode]);

  const selectPreset = (nextPreset: PhysicsPresetId) => {
    const defaults = getDefaultPresetParams(nextPreset);
    setIsCustomActive(false);
    setPreset(nextPreset);
    setParams(defaults);
    setSimState(createInitialPhysicsState(nextPreset, defaults));
  };

  const selectCustomSim = () => {
    if (!customSpec) return;
    const defaults = getDefaultCustomParams(customSpec);
    setIsCustomActive(true);
    setParams(defaults);
    setCustomState(createInitialCustomPhysicsState(customSpec, defaults));
  };

  const resetSim = (customParams?: Record<string, number>) => {
    const p = customParams || paramsRef.current;
    if (isCustomActiveRef.current && customSpecRef.current) {
      setCustomState(createInitialCustomPhysicsState(customSpecRef.current, p));
    } else {
      setSimState(createInitialPhysicsState(preset, p));
    }
  };

  const handleGenerateSimulation = async (overridePrompt?: string) => {
    const q = (overridePrompt ?? simPrompt).trim();
    if (!q || simGenerating) return;
    if (overridePrompt !== undefined) setSimPrompt(overridePrompt);
    setSimGenerating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch('/api/study/physics-sim', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: q,
          topic: topicTitle,
          context: topicContext.slice(0, 3000),
        }),
      });
      const data = await res.json().catch(() => null);
      const spec =
        sanitizeCustomPhysicsSpec(data?.spec, q) || buildFallbackPhysicsSimulation(q);
      const defaults = getDefaultCustomParams(spec);
      setCustomSpec(spec);
      setParams(defaults);
      setCustomState(createInitialCustomPhysicsState(spec, defaults));
      setIsCustomActive(true);
    } catch {
      const fallback = buildFallbackPhysicsSimulation(q);
      const defaults = getDefaultCustomParams(fallback);
      setCustomSpec(fallback);
      setParams(defaults);
      setCustomState(createInitialCustomPhysicsState(fallback, defaults));
      setIsCustomActive(true);
    } finally {
      setSimGenerating(false);
    }
  };

  useEffect(() => {
    if (labMode !== 'physics') return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - lastTs) / 1000);
      lastTs = now;
      if (isCustomActiveRef.current && customSpecRef.current) {
        const spec = customSpecRef.current;
        setCustomState((prev) => (prev ? stepCustomPhysicsState(prev, dt, spec, paramsRef.current) : prev));
      } else {
        setSimState((prev) => stepPhysicsState(prev, dt, paramsRef.current));
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [labMode, preset, isCustomActive, customSpec?.id]);

  // Draw current simulation frame on HTML5 Canvas (monochrome high-contrast ink)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || labMode !== 'physics') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 340;
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background & hairline grid
    ctx.fillStyle = isDark ? '#09090b' : '#fafafa';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(9,9,11,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const ink = isDark ? '#f4f4f5' : '#09090b';
    const secondaryInk = isDark ? '#a1a1aa' : '#52525b';
    const trailInk = isDark ? 'rgba(244,244,245,0.42)' : 'rgba(9,9,11,0.38)';
    const velInk = isDark ? '#38bdf8' : '#0284c7';
    const forceInk = isDark ? '#fbbf24' : '#d97706';

    const drawVectorArrow = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string,
      dashed = false
    ) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 3) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      if (dashed) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      const angle = Math.atan2(dy, dx);
      const headLen = 7;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    if (isCustomActive && customSpec && customState) {
      const hasFloor = customSpec.floorY !== null && customSpec.floorY !== undefined;
      const floorWorldY = customSpec.floorY ?? 0;

      // Compute balanced viewport mapping for arbitrary custom trajectories
      let maxAbsX = customSpec.scaleHint ? customSpec.scaleHint * 0.65 : 6;
      let maxAbsY = customSpec.scaleHint ? customSpec.scaleHint * 0.65 : 6;
      for (const pt of customState.trail) {
        maxAbsX = Math.max(maxAbsX, Math.abs(pt.x));
        maxAbsY = Math.max(maxAbsY, hasFloor ? pt.y - floorWorldY : Math.abs(pt.y));
      }
      maxAbsX = Math.max(maxAbsX, Math.abs(customState.pos.x));
      maxAbsY = Math.max(maxAbsY, hasFloor ? customState.pos.y - floorWorldY : Math.abs(customState.pos.y));

      const originX = width / 2;
      const originY = hasFloor ? height - 44 : height / 2;
      const scaleX = (width - 80) / Math.max(4, maxAbsX * 2.3);
      const scaleY = hasFloor
        ? (height - 84) / Math.max(4, maxAbsY * 1.25)
        : (height - 72) / Math.max(4, maxAbsY * 2.3);
      const scale = Math.min(scaleX, scaleY);

      const toScreenX = (wx: number) => originX + wx * scale;
      const toScreenY = (wy: number) => originY - (hasFloor ? wy - floorWorldY : wy) * scale;

      // Floor / Ground line
      if (hasFloor) {
        const fy = toScreenY(floorWorldY);
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.24)' : 'rgba(9,9,11,0.26)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(20, fy);
        ctx.lineTo(width - 20, fy);
        ctx.stroke();
      }

      // Ramp visual for inclined plane style
      if (customSpec.renderStyle === 'incline') {
        const thetaRad = ((params.theta ?? customSpec.inclineAngleDeg ?? 30) * Math.PI) / 180;
        const startPt = customState.trail[0] || customState.pos;
        const topX = toScreenX(startPt.x - 1.5);
        const topY = toScreenY(startPt.y + 1.5 * Math.tan(thetaRad));
        const runToFloor = Math.max(1, (startPt.y + 1.5 * Math.tan(thetaRad) - floorWorldY) / Math.max(0.1, Math.tan(thetaRad)));
        const baseRightX = toScreenX(startPt.x - 1.5 + runToFloor);
        const baseY = toScreenY(floorWorldY);

        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(9,9,11,0.35)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(baseRightX, baseY);
        ctx.lineTo(topX, baseY);
        ctx.closePath();
        ctx.stroke();
      }

      // Central star/attractor for orbit style
      if (customSpec.renderStyle === 'orbit') {
        const cx = toScreenX(0);
        const cy = toScreenY(0);
        ctx.strokeStyle = secondaryInk;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tether / rod for pendulum style
      if (customSpec.renderStyle === 'pendulum_rod') {
        const cx = toScreenX(0);
        const cy = toScreenY(0);
        const bx = toScreenX(customState.pos.x);
        const by = toScreenY(customState.pos.y);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Coil tether from origin for spring_block style
      if (customSpec.renderStyle === 'spring_block') {
        const cx = toScreenX(0);
        const cy = toScreenY(0);
        const bx = toScreenX(customState.pos.x);
        const by = toScreenY(customState.pos.y);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = secondaryInk;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = secondaryInk;
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Trajectory trail
      if (showTrail && customState.trail.length > 1) {
        ctx.strokeStyle = trailInk;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        customState.trail.forEach((pt, idx) => {
          const sx = toScreenX(pt.x);
          const sy = toScreenY(pt.y);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      }

      const px = toScreenX(customState.pos.x);
      const py = toScreenY(customState.pos.y);

      if (showVectors) {
        const vScale = Math.min(28, Math.max(2, 24 / Math.max(1, Math.hypot(customState.vel.x, customState.vel.y))));
        drawVectorArrow(px, py, px + customState.vel.x * vScale, py - customState.vel.y * vScale, velInk, false);

        const aScale = Math.min(18, Math.max(1.2, 18 / Math.max(1, Math.hypot(customState.acc.x, customState.acc.y))));
        drawVectorArrow(px, py, px + customState.acc.x * aScale, py - customState.acc.y * aScale, forceInk, true);
      }

      // Moving body
      ctx.fillStyle = ink;
      if (customSpec.renderStyle === 'spring_block' || customSpec.renderStyle === 'incline') {
        ctx.fillRect(px - 8, py - 8, 16, 16);
      } else {
        ctx.beginPath();
        ctx.arc(px, py, 7.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (simState.preset === 'projectile') {
      const groundY = height - 40;
      const originX = 48;
      const maxExpectedRange = Math.max(40, (params.speed || 24) ** 2 / Math.max(2, params.gravity || 9.8));
      const scale = Math.min(
        (width - 96) / Math.max(30, maxExpectedRange),
        (height - 90) / Math.max(20, maxExpectedRange * 0.45)
      );

      // Ground plane
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(9,9,11,0.24)';
      ctx.beginPath();
      ctx.moveTo(20, groundY);
      ctx.lineTo(width - 20, groundY);
      ctx.stroke();

      // Trail
      if (showTrail && simState.trail.length > 1) {
        ctx.strokeStyle = trailInk;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        simState.trail.forEach((pt, idx) => {
          const sx = originX + pt.x * scale;
          const sy = groundY - pt.y * scale;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      }

      const bx = originX + simState.pos.x * scale;
      const by = groundY - simState.pos.y * scale;

      if (showVectors) {
        drawVectorArrow(bx, by, bx + simState.vel.x * 2.2, by - simState.vel.y * 2.2, velInk, false);
        drawVectorArrow(bx, by, bx, by + (params.gravity || 9.8) * 3.2, forceInk, true);
      }

      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(bx, by, 7.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (simState.preset === 'pendulum') {
      const pivotX = width / 2;
      const pivotY = 42;
      const L = params.length || 2.0;
      const scale = Math.min((height - 95) / Math.max(1.2, L), 110);
      const bx = pivotX + simState.pos.x * scale;
      const by = pivotY - simState.pos.y * scale;

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(9,9,11,0.18)';
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(pivotX, pivotY + L * scale + 18);
      ctx.stroke();
      ctx.setLineDash([]);

      if (showTrail && simState.trail.length > 1) {
        ctx.strokeStyle = trailInk;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        simState.trail.forEach((pt, idx) => {
          const sx = pivotX + pt.x * scale;
          const sy = pivotY - pt.y * scale;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      }

      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
      ctx.fill();

      if (showVectors) {
        drawVectorArrow(bx, by, bx + simState.vel.x * 12, by - simState.vel.y * 12, velInk, false);
      }

      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(bx, by, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (simState.preset === 'spring') {
      const anchorX = 48;
      const midY = height * 0.42;
      const eqX = width * 0.48;
      const massX = eqX + simState.pos.x * 65;

      // Wall
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(9,9,11,0.2)';
      ctx.fillRect(anchorX - 8, midY - 46, 8, 92);

      // Coils
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(anchorX, midY);
      const coils = 12;
      const span = Math.max(24, massX - 20 - anchorX);
      for (let i = 1; i <= coils; i++) {
        const cx = anchorX + (span * i) / (coils + 1);
        const cy = midY + (i % 2 === 0 ? -14 : 14);
        ctx.lineTo(cx, cy);
      }
      ctx.lineTo(massX - 20, midY);
      ctx.stroke();

      // Equilibrium line
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = secondaryInk;
      ctx.beginPath();
      ctx.moveTo(eqX, midY - 48);
      ctx.lineTo(eqX, midY + 58);
      ctx.stroke();
      ctx.setLineDash([]);

      // Mass block
      ctx.fillStyle = ink;
      ctx.fillRect(massX - 20, midY - 20, 40, 40);

      if (showVectors) {
        const fx = -(params.stiffness || 28) * simState.pos.x * 1.1;
        drawVectorArrow(massX, midY, massX + fx, midY, forceInk, false);
      }

      if (showTrail && simState.trail.length > 1) {
        const graphTop = height - 70;
        ctx.strokeStyle = trailInk;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const slice = simState.trail.slice(-140);
        slice.forEach((pt, idx) => {
          const gx = 48 + (idx / Math.max(1, slice.length - 1)) * (width - 96);
          const gy = graphTop - pt.y * 16;
          if (idx === 0) ctx.moveTo(gx, gy);
          else ctx.lineTo(gx, gy);
        });
        ctx.stroke();
      }
    } else if (simState.preset === 'wave') {
      const midY = height / 2;
      const f1 = params.freq1 || 2.0;
      const f2 = params.freq2 || 2.4;
      const amp = params.amp1 || 1.0;
      const dir = params.counter ?? 1;
      const t = simState.time;

      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(9,9,11,0.14)';
      ctx.beginPath();
      ctx.moveTo(20, midY);
      ctx.lineTo(width - 20, midY);
      ctx.stroke();

      // Wave 1 (dashed component)
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = secondaryInk;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let px = 20; px <= width - 20; px += 4) {
        const xNorm = ((px - 20) / (width - 40)) * 4 * Math.PI;
        const y1 = Math.sin(xNorm * f1 - 4 * t) * amp * 36;
        if (px === 20) ctx.moveTo(px, midY - y1);
        else ctx.lineTo(px, midY - y1);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Superposition result (bold ink)
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let px = 20; px <= width - 20; px += 3) {
        const xNorm = ((px - 20) / (width - 40)) * 4 * Math.PI;
        const y1 = Math.sin(xNorm * f1 - 4 * t) * amp * 36;
        const y2 = Math.sin(xNorm * f2 - dir * 4 * t) * amp * 0.85 * 36;
        const y = midY - (y1 + y2);
        if (px === 20) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    } else if (simState.preset === 'orbital') {
      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height) / 360;

      // Central star/mass (ring + core)
      ctx.strokeStyle = secondaryInk;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 17, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();

      if (showTrail && simState.trail.length > 1) {
        ctx.strokeStyle = trailInk;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        simState.trail.forEach((pt, idx) => {
          const sx = cx + pt.x * scale;
          const sy = cy - pt.y * scale;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      }

      const sx = cx + simState.pos.x * scale;
      const sy = cy - simState.pos.y * scale;

      if (showVectors) {
        drawVectorArrow(sx, sy, sx + simState.vel.x * 2.2, sy - simState.vel.y * 2.2, velInk, false);
        const dirToStar = { x: cx - sx, y: cy - sy };
        const mag = Math.hypot(dirToStar.x, dirToStar.y) || 1;
        drawVectorArrow(sx, sy, sx + (dirToStar.x / mag) * 30, sy + (dirToStar.y / mag) * 30, forceInk, true);
      }

      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(sx, sy, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [simState, customState, isCustomActive, customSpec, params, showVectors, showTrail, isDark, labMode, physicsViewport]);

  // -------------------------------------------------------------------------
  // 2. CONCEPT DIAGRAM GENERATOR STATE
  // -------------------------------------------------------------------------
  const [diagramPrompt, setDiagramPrompt] = useState(topicTitle || '');
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [selectedDiagramNodeId, setSelectedDiagramNodeId] = useState<string | null>(null);
  const [diagramNodes, setDiagramNodes] = useState<DiagramNode[]>(() => {
    if (lessonModules.length > 0) {
      return lessonModules.slice(0, 6).map((m, idx) => ({
        id: `dn-${idx}`,
        title: m.title,
        detail: m.summary,
        tier: idx,
      }));
    }
    return [];
  });
  const svgDiagramRef = useRef<SVGSVGElement | null>(null);

  const handleGenerateDiagram = async (overrideTopic?: string) => {
    const queryTopic = (overrideTopic ?? diagramPrompt).trim();
    if (!queryTopic || diagramLoading) return;
    if (overrideTopic !== undefined) setDiagramPrompt(overrideTopic);
    setDiagramLoading(true);
    setDiagramError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch('/api/study/visualize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: queryTopic,
          context: topicContext.slice(0, 4000),
          mode: 'diagram',
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && Array.isArray(data.nodes) && data.nodes.length > 0) {
        const nextNodes: DiagramNode[] = data.nodes.map((n: any, idx: number) => ({
          id: String(n.id || `dn-${idx}`),
          title: String(n.title || `Stage ${idx + 1}`),
          detail: String(n.detail || ''),
          tier: idx,
        }));
        setDiagramNodes(nextNodes);
        setSelectedDiagramNodeId(nextNodes[0]?.id || null);
      } else {
        setDiagramError(data?.error || 'Could not generate a concept diagram right now. Please try again.');
      }
    } catch {
      setDiagramError('Network error while generating diagram. Please try again.');
    } finally {
      setDiagramLoading(false);
    }
  };

  const handleExportSvg = () => {
    const svg = svgDiagramRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent =
      '.katex-svg-node{font-family:"DM Sans",system-ui,sans-serif}.katex-html{display:none}.katex-mathml math{font-size:1.05em}';
    clone.insertBefore(styleEl, clone.firstChild);
    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(diagramPrompt || topicTitle || 'diagram').replace(/[^a-z0-9_-]/gi, '_')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------------------
  // 3. MASTERY PATHS STATE (REAL AI-GENERATED CHECKPOINTS)
  // -------------------------------------------------------------------------
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [tutorDraft, setTutorDraft] = useState('');
  const [masteryPrompt, setMasteryPrompt] = useState('');
  const [customMasteryTopic, setCustomMasteryTopic] = useState('');
  const [generatedMasteryNodes, setGeneratedMasteryNodes] = useState<MasteryCheckpoint[] | null>(null);
  const [masteryLoading, setMasteryLoading] = useState(false);
  const [masteryError, setMasteryError] = useState<string | null>(null);
  const activeMasteryTopic = (customMasteryTopic || topicTitle || 'Current Topic').trim();

  const defaultLessonMasteryNodes = useMemo(() => {
    if (concepts.length >= 3 || lessonModules.length >= 3) {
      return buildDefaultMasteryNodes(activeMasteryTopic, lessonModules, concepts);
    }
    return [];
  }, [activeMasteryTopic, lessonModules, concepts]);

  const masteryNodes = generatedMasteryNodes ?? defaultLessonMasteryNodes;

  const handleGenerateMasteryPath = async (overrideTopic?: string) => {
    const q = (overrideTopic ?? masteryPrompt).trim();
    if (!q || masteryLoading) return;
    setMasteryLoading(true);
    setMasteryError(null);
    setCustomMasteryTopic(q);
    if (overrideTopic === undefined) setMasteryPrompt('');
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch('/api/study/visualize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: q,
          context: topicContext.slice(0, 4000),
          mode: 'mastery',
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && Array.isArray(data.checkpoints) && data.checkpoints.length > 0) {
        setGeneratedMasteryNodes(
          data.checkpoints.map((c: any, idx: number) => ({
            id: String(c.id || `mp-${idx}`),
            stage: String(c.stage || `Stage ${idx + 1}`),
            title: String(c.title || `Stage ${idx + 1}`),
            prerequisite: String(c.prerequisite || 'Foundational intuition'),
            objective: String(c.objective || ''),
            formula: c.formula ? String(c.formula) : undefined,
          }))
        );
      } else {
        setMasteryError(data?.error || `Could not build a mastery path for "${q}". Please try again.`);
      }
    } catch {
      setMasteryError('Network error while generating mastery roadmap. Please try again.');
    } finally {
      setMasteryLoading(false);
    }
  };

  const [masteredMap, setMasteredMap] = useState<
    Record<string, 'not_started' | 'in_progress' | 'mastered'>
  >(() => {
    try {
      const raw = localStorage.getItem(STORAGE_MASTERY_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const cycleNodeMastery = (nodeId: string) => {
    const key = `${activeMasteryTopic}:${nodeId}`;
    const curr = masteredMap[key] || 'not_started';
    const next: 'not_started' | 'in_progress' | 'mastered' =
      curr === 'not_started' ? 'in_progress' : curr === 'in_progress' ? 'mastered' : 'not_started';
    const updated: Record<string, 'not_started' | 'in_progress' | 'mastered'> = {
      ...masteredMap,
      [key]: next,
    };
    setMasteredMap(updated);
    try {
      localStorage.setItem(STORAGE_MASTERY_KEY, JSON.stringify(updated));
    } catch {}
  };

  const masteredCount = masteryNodes.filter(
    (n) => masteredMap[`${activeMasteryTopic}:${n.id}`] === 'mastered'
  ).length;
  const masteryPct =
    masteryNodes.length > 0 ? Math.round((masteredCount / masteryNodes.length) * 100) : 0;

  // -------------------------------------------------------------------------
  // 4. DEEP SOLVE (STEP-BY-STEP PROBLEM SOLVER) STATE
  // -------------------------------------------------------------------------
  const [solveInput, setSolveInput] = useState('');
  const [solveLoading, setSolveLoading] = useState(false);
  const [solveResult, setSolveResult] = useState<string>('');
  const [solveError, setSolveError] = useState<string | null>(null);
  const [solveCopied, setSolveCopied] = useState(false);

  const handleRunDeepSolve = async (overrideProblem?: string) => {
    const q = (overrideProblem ?? solveInput).trim();
    if (!q || solveLoading) return;
    if (overrideProblem) setSolveInput(overrideProblem);
    setSolveLoading(true);
    setSolveError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch('/api/study/deep-solve', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          problem: q,
          topic: topicTitle,
          context: topicContext.slice(0, 5000),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data?.solution) {
        setSolveResult(String(data.solution));
      } else {
        setSolveError(data?.error || 'Could not solve this problem right now. Please try again.');
      }
    } catch {
      setSolveError('Network error while contacting Deep Solve. Please try again.');
    } finally {
      setSolveLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // 5. FUNCTION & DATA PLOTTER STATE (WITH DERIVATIVE & REAL ANALYTICS)
  // -------------------------------------------------------------------------
  const [mathExpr, setMathExpr] = useState('sin(x) * exp(-0.12 * abs(x))');
  const [compareExpr, setCompareExpr] = useState('');
  const [showDerivative, setShowDerivative] = useState(false);
  const [xRange, setXRange] = useState(10);

  const { plotData, plotStats } = useMemo(() => {
    const rows: Array<{ x: number; y: number; dy?: number; g?: number }> = [];
    const steps = 120;
    const h = 0.001;
    let minY = Infinity;
    let maxY = -Infinity;
    let integral = 0;
    let roots = 0;
    let prevX: number | null = null;
    let prevY: number | null = null;

    for (let i = 0; i <= steps; i++) {
      const x = -xRange + (2 * xRange * i) / steps;
      const y = evaluateMathExpression(mathExpr, x);
      if (y !== null && Number.isFinite(y)) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (prevX !== null && prevY !== null) {
          integral += ((prevY + y) / 2) * (x - prevX);
          if ((prevY < 0 && y >= 0) || (prevY > 0 && y <= 0)) {
            roots += 1;
          }
        }
        prevX = x;
        prevY = y;

        const row: { x: number; y: number; dy?: number; g?: number } = {
          x: Number(x.toFixed(2)),
          y: Number(y.toFixed(4)),
        };

        if (showDerivative) {
          const yPlus = evaluateMathExpression(mathExpr, x + h);
          const yMinus = evaluateMathExpression(mathExpr, x - h);
          if (yPlus !== null && yMinus !== null) {
            const dyVal = (yPlus - yMinus) / (2 * h);
            if (Number.isFinite(dyVal) && Math.abs(dyVal) < 1e4) {
              row.dy = Number(dyVal.toFixed(4));
            }
          }
        }

        if (compareExpr.trim()) {
          const gVal = evaluateMathExpression(compareExpr, x);
          if (gVal !== null && Number.isFinite(gVal)) {
            row.g = Number(gVal.toFixed(4));
          }
        }

        rows.push(row);
      } else {
        prevX = null;
        prevY = null;
      }
    }

    return {
      plotData: rows,
      plotStats: {
        valid: rows.length > 0,
        minY: Number.isFinite(minY) ? minY : 0,
        maxY: Number.isFinite(maxY) ? maxY : 0,
        integral,
        roots,
      },
    };
  }, [mathExpr, compareExpr, showDerivative, xRange]);

  const subtleDivider = isDark ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const mutedClass = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const inputClass = isDark
    ? 'bg-[#121215] border-white/[0.12] text-white placeholder-neutral-500 focus:border-white/35'
    : 'bg-white border-black/[0.12] text-black placeholder-neutral-400 focus:border-black/35';
  const primaryBtn = isDark
    ? 'bg-white text-black hover:bg-neutral-200'
    : 'bg-black text-white hover:bg-neutral-800';
  const ghostBtn = isDark
    ? 'border-white/[0.12] text-neutral-200 hover:bg-white/[0.06]'
    : 'border-black/[0.12] text-neutral-800 hover:bg-black/[0.04]';
  const activeTabClass = isDark
    ? 'bg-white text-black font-semibold'
    : 'bg-black text-white font-semibold';

  const activePresetDef = PHYSICS_PRESETS[preset];
  const activeSimTitle = isCustomActive && customSpec ? customSpec.title : activePresetDef.title;
  const activeSimFormula = isCustomActive && customSpec ? customSpec.formula : activePresetDef.formula;
  const activeSimDescription = isCustomActive && customSpec ? customSpec.description : activePresetDef.description;
  const activeSimParams = isCustomActive && customSpec ? customSpec.params : activePresetDef.params;
  const activeSimSnapshot = isCustomActive && customState ? customState : simState;
  const resolvedPageTitle = pageTitle || MODE_LABELS[labMode];
  const svgStroke = isDark ? '#e4e4e7' : '#09090b';
  const stageSurface = isDark
    ? 'bg-[#101013] border-white/[0.09]'
    : 'bg-[#fafafa] border-black/[0.09]';
  const composerSurface = isDark
    ? 'bg-[#121216] border-white/[0.12] focus-within:border-white/30 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
    : 'bg-white border-black/[0.12] focus-within:border-black/30 shadow-[0_8px_28px_rgba(0,0,0,0.06)]';
  const selectClass = isDark
    ? 'bg-[#141418] border-white/[0.12] text-neutral-200 hover:border-white/25'
    : 'bg-white border-black/[0.12] text-neutral-800 hover:border-black/25';

  const PLOTTER_PRESETS = [
    { label: 'Damped Sine', expr: 'sin(x) * exp(-0.12 * abs(x))' },
    { label: 'Gaussian Wave Packet', expr: 'exp(-0.25 * x^2) * cos(3 * x)' },
    { label: 'Harmonic Parabola', expr: '0.2 * x^2 - 2' },
    { label: 'Logistic Sigmoid', expr: '1 / (1 + exp(-x))' },
    { label: 'Sinc Diffraction', expr: 'sin(2 * x) / (x + 0.0001)' },
    { label: 'Cubic Inflection', expr: '0.06 * x^3 - 0.8 * x' },
  ];

  return (
    <div
      className={
        standalone
          ? 'min-h-full w-full max-w-full overflow-x-hidden flex flex-col'
          : 'w-full max-w-full overflow-x-hidden'
      }
    >
      {standalone && (
        <header className={`h-14 px-4 sm:px-6 border-b ${subtleDivider} flex items-center justify-between gap-3 shrink-0`}>
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                data-testid="study-feature-back-btn"
                className={`h-9 px-3 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${ghostBtn}`}
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Back</span>
              </button>
            )}
            <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">
              {resolvedPageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Contextual Preset Dropdown in Header (Zero Horizontal Chip Bars) */}
            {labMode === 'physics' && (
              <div className="relative">
                <select
                  aria-label="Select physics experiment"
                  value={isCustomActive && customSpec ? '__custom__' : preset}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      selectCustomSim();
                    } else {
                      selectPreset(e.target.value as PhysicsPresetId);
                    }
                  }}
                  className={`h-9 pl-3 pr-8 rounded-xl border text-[13px] font-medium appearance-none outline-none cursor-pointer transition-colors max-w-[165px] sm:max-w-[230px] ${selectClass}`}
                >
                  {customSpec && (
                    <option value="__custom__" className={isDark ? 'bg-[#141418] text-white' : 'bg-white text-black'}>
                      {customSpec.title} (Custom)
                    </option>
                  )}
                  {(Object.keys(PHYSICS_PRESETS) as PhysicsPresetId[]).map((pid) => (
                    <option key={pid} value={pid} className={isDark ? 'bg-[#141418] text-white' : 'bg-white text-black'}>
                      {PHYSICS_PRESETS[pid].title}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`w-4 h-4 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${mutedClass}`} />
              </div>
            )}

            {labMode === 'plotter' && (
              <div className="relative">
                <select
                  aria-label="Choose example function"
                  value={PLOTTER_PRESETS.find((p) => p.expr === mathExpr)?.expr || ''}
                  onChange={(e) => {
                    if (e.target.value) setMathExpr(e.target.value);
                  }}
                  className={`h-9 pl-3 pr-8 rounded-xl border text-[13px] font-medium appearance-none outline-none cursor-pointer transition-colors max-w-[165px] sm:max-w-[220px] ${selectClass}`}
                >
                  <option value="" disabled>
                    Function library
                  </option>
                  {PLOTTER_PRESETS.map((item) => (
                    <option key={item.label} value={item.expr} className={isDark ? 'bg-[#141418] text-white' : 'bg-white text-black'}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`w-4 h-4 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${mutedClass}`} />
              </div>
            )}

            {labMode === 'diagram' && diagramNodes.length > 0 && (
              <button
                type="button"
                onClick={handleExportSvg}
                className={`h-9 px-3 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${ghostBtn}`}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export SVG</span>
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((v) => !v)}
                aria-label="Tool options"
                data-testid="lab-more-menu-btn"
                className={`size-9 rounded-xl border inline-flex items-center justify-center transition-colors cursor-pointer ${ghostBtn}`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {moreMenuOpen && (
                <div
                  className={`absolute right-0 top-full mt-1.5 w-48 rounded-xl border p-1.5 z-40 shadow-2xl ${
                    isDark ? 'bg-[#18181b] border-white/[0.12] text-white' : 'bg-white border-black/[0.1] text-black'
                  }`}
                >
                  {onAskTutor && (
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        const ctxPrompt =
                          labMode === 'physics'
                            ? `Explain the governing equations and energy conservation in ${activeSimTitle} (${activeSimFormula}).`
                            : labMode === 'diagram'
                            ? `Explain the concept flow and stages of "${diagramPrompt || topicTitle}": ${diagramNodes.map((n) => n.title).join(' -> ')}.`
                            : labMode === 'mastery'
                            ? `Walk me step-by-step through the mastery roadmap for "${activeMasteryTopic}".`
                            : labMode === 'deep_solve'
                            ? solveInput.trim()
                              ? `Explain and verify this problem step by step: ${solveInput.trim()}`
                              : `Walk me through problem-solving strategies for ${topicTitle}.`
                            : `Analyze the function y(x) = ${mathExpr} over x in [-${xRange}, ${xRange}] (roots, extrema, derivative, and behavior).`;
                        const topicForTutor =
                          labMode === 'physics'
                            ? activeSimTitle
                            : labMode === 'diagram'
                            ? diagramPrompt.trim() || topicTitle
                            : labMode === 'mastery'
                            ? activeMasteryTopic
                            : labMode === 'plotter'
                            ? `y(x) = ${mathExpr}`
                            : topicTitle;
                        onAskTutor(ctxPrompt, topicForTutor);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs font-medium text-left flex items-center gap-2 hover:bg-current/5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Study Tutor</span>
                    </button>
                  )}
                  {onStartQuiz && (
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onStartQuiz();
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs text-left flex items-center gap-2 hover:bg-current/5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Practice Quiz</span>
                    </button>
                  )}
                  {onBack && (
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onBack();
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs text-left flex items-center gap-2 hover:bg-current/5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Study Space</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <div className="w-full max-w-[1400px] mx-auto min-w-0 px-4 sm:px-6 py-5 space-y-6 pb-20">
        {!standalone && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight truncate">
                {resolvedPageTitle}
              </h2>
              {topicTitle && <p className={`text-xs truncate ${mutedClass}`}>{topicTitle}</p>}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <select
                  aria-label="Switch lab mode"
                  value={labMode}
                  onChange={(e) => setLabMode(e.target.value as DeepTutorLabMode)}
                  className={`h-9 pl-3 pr-8 rounded-xl border text-xs font-semibold appearance-none outline-none cursor-pointer sm:hidden ${selectClass}`}
                >
                  {(['physics', 'diagram', 'mastery', 'deep_solve', 'plotter'] as const).map((id) => (
                    <option key={id} value={id} className={isDark ? 'bg-[#141418] text-white' : 'bg-white text-black'}>
                      {MODE_LABELS[id]}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`w-3.5 h-3.5 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 sm:hidden ${mutedClass}`} />
              </div>

              <div
                className={`hidden sm:grid grid-cols-5 gap-1 p-1 rounded-xl border ${
                  isDark ? 'bg-[#0c0c0f] border-white/10' : 'bg-neutral-100 border-black/10'
                }`}
              >
                {(['physics', 'diagram', 'mastery', 'deep_solve', 'plotter'] as const).map((id) => {
                  const active = labMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLabMode(id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        active ? activeTabClass : mutedClass
                      }`}
                    >
                      {MODE_LABELS[id]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= MODE 1: INTERACTIVE 2D PHYSICS SANDBOX ================= */}
        {labMode === 'physics' && (
          <div className="space-y-5 min-w-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Dominant Flagship Simulation Canvas */}
              <div className={`lg:col-span-9 min-w-0 border overflow-hidden rounded-2xl flex flex-col ${stageSurface}`}>
                <div className={`px-4 sm:px-5 py-3.5 border-b ${subtleDivider} flex flex-wrap items-center justify-between gap-3`}>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-[15px] sm:text-base font-semibold tracking-tight truncate">
                      <MathText text={activeSimTitle} />
                    </div>
                    <div className={`text-[13px] ${mutedClass}`}>
                      <MathFormula formula={activeSimFormula} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!standalone && (
                      <div className="relative">
                        <select
                          aria-label="Select physics experiment"
                          value={isCustomActive && customSpec ? '__custom__' : preset}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              selectCustomSim();
                            } else {
                              selectPreset(e.target.value as PhysicsPresetId);
                            }
                          }}
                          className={`h-9 pl-3 pr-8 rounded-xl border text-[13px] font-medium appearance-none outline-none cursor-pointer ${selectClass}`}
                        >
                          {customSpec && (
                            <option value="__custom__" className={isDark ? 'bg-[#141418] text-white' : 'bg-white text-black'}>
                              {customSpec.title} (Custom)
                            </option>
                          )}
                          {(Object.keys(PHYSICS_PRESETS) as PhysicsPresetId[]).map((pid) => (
                            <option key={pid} value={pid} className={isDark ? 'bg-[#141418] text-white' : 'bg-white text-black'}>
                              {PHYSICS_PRESETS[pid].title}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className={`w-4 h-4 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${mutedClass}`} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (isCustomActive && customSpec) {
                          setCustomState((s) => (s ? { ...s, paused: !s.paused } : s));
                        } else {
                          setSimState((s) => ({ ...s, paused: !s.paused }));
                        }
                      }}
                      className={`h-9 px-3.5 rounded-xl text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${primaryBtn}`}
                    >
                      {activeSimSnapshot.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      <span>{activeSimSnapshot.paused ? 'Play' : 'Pause'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isCustomActive && customSpec) {
                          setCustomState((s) =>
                            s ? stepCustomPhysicsState({ ...s, paused: false }, 0.02, customSpec, params) : s
                          );
                        } else {
                          setSimState((s) => stepPhysicsState({ ...s, paused: false }, 0.02, params));
                        }
                      }}
                      className={`h-9 px-3 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${ghostBtn}`}
                    >
                      <SkipForward className="w-4 h-4" />
                      <span className="hidden sm:inline">Step</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => resetSim()}
                      className={`h-9 px-3 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${ghostBtn}`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  </div>
                </div>

                {/* Large Interactive 2D Physics Viewport */}
                <div ref={canvasWrapRef} className="relative w-full h-[340px] sm:h-[480px] lg:h-[580px]">
                  <canvas
                    ref={canvasRef}
                    onClick={() => {
                      if (activeSimSnapshot.paused) {
                        resetSim();
                      } else if (isCustomActive && customSpec) {
                        setCustomState((s) => (s ? { ...s, paused: true } : s));
                      } else {
                        setSimState((s) => ({ ...s, paused: true }));
                      }
                    }}
                    className="w-full h-full block cursor-pointer"
                  />
                </div>

                {/* Quantitative Telemetry & Energy Conservation Bar */}
                {(() => {
                  const ke = Math.max(0, activeSimSnapshot.kineticEnergy);
                  const pe = Math.max(0, activeSimSnapshot.potentialEnergy);
                  const totalE = ke + pe;
                  const kePct = totalE > 0.0001 ? Math.round((ke / totalE) * 100) : 50;
                  const pePct = totalE > 0.0001 ? 100 - kePct : 50;
                  return (
                    <div className={`px-4 sm:px-5 py-3.5 border-t ${subtleDivider} space-y-2.5`}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px] font-mono tabular-nums">
                        <div>
                          <span className={mutedClass}>t = </span>
                          <span className="font-semibold">{activeSimSnapshot.time.toFixed(2)}s</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                          <span className={mutedClass}>KE</span>
                          <span className="font-semibold">{ke.toFixed(1)} J</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span className={mutedClass}>PE</span>
                          <span className="font-semibold">{pe.toFixed(1)} J</span>
                        </div>
                        <div>
                          <span className={mutedClass}>Peak = </span>
                          <span className="font-semibold">{activeSimSnapshot.maxHeight.toFixed(2)} m</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                        <span className={`${mutedClass} whitespace-nowrap shrink-0`}>
                          Total E = {totalE.toFixed(1)} J
                        </span>
                        <div
                          className={`flex-1 h-1.5 rounded-full overflow-hidden flex ${
                            isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'
                          }`}
                          aria-label={`Energy split: ${kePct}% Kinetic, ${pePct}% Potential`}
                        >
                          <div
                            className="h-full bg-sky-500 transition-[width] duration-75"
                            style={{ width: `${kePct}%` }}
                          />
                          <div
                            className="h-full bg-amber-500 transition-[width] duration-75"
                            style={{ width: `${pePct}%` }}
                          />
                        </div>
                        <span className={`${mutedClass} whitespace-nowrap shrink-0`}>
                          {kePct}% / {pePct}%
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Refined Control & Parameter Rail */}
              <div className={`lg:col-span-3 min-w-0 rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-5 ${stageSurface}`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${mutedClass}`}>Controls</span>
                    {showVectors && (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-0.5 bg-sky-500 rounded-full" />
                          <span className={mutedClass}>v</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-0.5 bg-amber-500 rounded-full" />
                          <span className={mutedClass}>a</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {activeSimParams.map((spec) => {
                    const val = params[spec.key] ?? spec.defaultValue;
                    return (
                      <div key={spec.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="font-medium">{spec.label}</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {val} {spec.unit}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={spec.min}
                          max={spec.max}
                          step={spec.step}
                          value={val}
                          aria-label={spec.label}
                          onChange={(e) => {
                            const nextVal = parseFloat(e.target.value);
                            const updated = { ...params, [spec.key]: nextVal };
                            setParams(updated);
                            resetSim(updated);
                          }}
                          className="w-full h-1.5 rounded-full accent-black dark:accent-white cursor-pointer"
                        />
                      </div>
                    );
                  })}

                  <div className={`pt-4 border-t ${subtleDivider} space-y-3.5 text-[13px]`}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showVectors}
                      onClick={() => setShowVectors((v) => !v)}
                      className="w-full flex items-center justify-between py-0.5 cursor-pointer"
                    >
                      <span className="font-medium">Force &amp; Velocity Vectors</span>
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          showVectors
                            ? isDark
                              ? 'bg-white'
                              : 'bg-black'
                            : isDark
                            ? 'bg-white/15'
                            : 'bg-black/15'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                            showVectors
                              ? isDark
                                ? 'translate-x-[18px] bg-black'
                                : 'translate-x-[18px] bg-white'
                              : isDark
                              ? 'translate-x-1 bg-white/70'
                              : 'translate-x-1 bg-white'
                          }`}
                        />
                      </span>
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showTrail}
                      onClick={() => setShowTrail((v) => !v)}
                      className="w-full flex items-center justify-between py-0.5 cursor-pointer"
                    >
                      <span className="font-medium">Trajectory Trail</span>
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          showTrail
                            ? isDark
                              ? 'bg-white'
                              : 'bg-black'
                            : isDark
                            ? 'bg-white/15'
                            : 'bg-black/15'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                            showTrail
                              ? isDark
                                ? 'translate-x-[18px] bg-black'
                                : 'translate-x-[18px] bg-white'
                              : isDark
                              ? 'translate-x-1 bg-white/70'
                              : 'translate-x-1 bg-white'
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                </div>

                <div className={`text-[13px] leading-relaxed pt-4 border-t ${subtleDivider} ${mutedClass}`}>
                  <MathText text={activeSimDescription} />
                  {onAskTutor && (
                    <button
                      type="button"
                      onClick={() =>
                        onAskTutor(
                          `Explain the governing equations and energy conservation in ${activeSimTitle} (${activeSimFormula}).`,
                          activeSimTitle
                        )
                      }
                      className={`mt-2.5 block hover:underline font-medium cursor-pointer ${
                        isDark ? 'text-white' : 'text-black'
                      }`}
                    >
                      Derive in Tutor Chat →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Signature Elevated Simulation Builder Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerateSimulation();
              }}
              className={`rounded-2xl border p-2 pl-4 flex items-center gap-2.5 transition-all ${composerSurface}`}
              data-testid="physics-sim-prompt-bar"
            >
              <input
                type="text"
                value={simPrompt}
                onChange={(e) => setSimPrompt(e.target.value)}
                placeholder="Describe a custom physics simulation..."
                className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              />
              <button
                type="submit"
                disabled={!simPrompt.trim() || simGenerating}
                aria-label="Generate simulation"
                className={`size-9 rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-35 transition-colors ${primaryBtn}`}
              >
                {simGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </form>
          </div>
        )}

        {/* ================= MODE 2: INTERACTIVE CONCEPT & FLOW DIAGRAM ================= */}
        {labMode === 'diagram' && (
          <div className="space-y-5 min-w-0 max-w-full">
            {/* Hidden Scalable Vector SVG strictly for clean Export SVG downloads (Zero UI Horizontal Scrollbar) */}
            {diagramNodes.length > 0 && (
              <svg
                ref={svgDiagramRef}
                viewBox={`0 0 ${Math.max(760, diagramNodes.length * 198 + 20)} 236`}
                className="sr-only"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="kinich-arrow"
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill={svgStroke} />
                  </marker>
                </defs>
                {diagramNodes.map((node, idx) => {
                  const x = 20 + idx * 196;
                  const y = 26;
                  const w = 166;
                  const h = 176;
                  const startX = x + w;
                  const endX = x + 196 - 4;
                  const midY = y + h / 2;
                  return (
                    <g key={node.id}>
                      {idx < diagramNodes.length - 1 && (
                        <path
                          d={`M ${startX} ${midY} C ${startX + 12} ${midY}, ${endX - 12} ${midY}, ${endX} ${midY}`}
                          fill="none"
                          stroke={svgStroke}
                          strokeWidth="1.5"
                          markerEnd="url(#kinich-arrow)"
                        />
                      )}
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx={12}
                        fill={isDark ? '#141417' : '#ffffff'}
                        stroke={svgStroke}
                        strokeOpacity={0.35}
                        strokeWidth="1.2"
                      />
                      <text x={x + 12} y={y + 22} fontSize="11" fontFamily="monospace" fill={svgStroke}>
                        {`${String(idx + 1).padStart(2, '0')}.`}
                      </text>
                      <foreignObject x={x + 12} y={y + 28} width={w - 24} height={h - 36}>
                        <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.32, color: svgStroke, overflow: 'hidden', height: '100%' }}>
                          <SvgLatex text={node.title} />
                          <div style={{ marginTop: '6px', fontSize: '10.5px', fontWeight: 400 }}>
                            <SvgLatex text={node.detail} />
                          </div>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Signature Elevated Diagram Prompt Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerateDiagram();
              }}
              className={`rounded-2xl border p-2 pl-4 flex items-center gap-2.5 transition-all ${composerSurface}`}
            >
              <input
                type="text"
                value={diagramPrompt}
                onChange={(e) => setDiagramPrompt(e.target.value)}
                placeholder="Enter a system or process to map..."
                className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              />
              {!standalone && diagramNodes.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportSvg}
                  className={`h-9 px-3 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${ghostBtn}`}
                >
                  <Download className="w-4 h-4" />
                  <span>SVG</span>
                </button>
              )}
              <button
                type="submit"
                disabled={!diagramPrompt.trim() || diagramLoading}
                aria-label="Generate concept diagram"
                className={`size-9 rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-35 transition-colors ${primaryBtn}`}
              >
                {diagramLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </form>

            {diagramError && (
              <div
                className={`px-4 py-3 rounded-xl border text-[13px] ${
                  isDark
                    ? 'border-red-500/30 bg-red-500/10 text-red-200'
                    : 'border-red-500/30 bg-red-50 text-red-700'
                }`}
              >
                {diagramError}
              </div>
            )}

            {/* Large Main Diagram Stage (Responsive Multi-Column Flow — ZERO Horizontal Scrollbar) */}
            {diagramNodes.length === 0 ? (
              <div className={`rounded-2xl border p-6 sm:p-12 min-h-[420px] flex flex-col items-center justify-center text-center space-y-6 ${stageSurface}`}>
                <div className="space-y-2 max-w-lg">
                  <h3 className="text-lg font-semibold tracking-tight">Interactive Concept Architecture</h3>
                  <p className={`text-sm sm:text-[15px] leading-relaxed ${mutedClass}`}>
                    Enter any scientific process, algorithm, or engineering system above to generate an interactive stage-by-stage architecture map.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-2xl">
                  {[
                    { title: 'Transformer Attention', desc: 'Q/K/V projections, scaled dot-product, softmax & context aggregation' },
                    { title: 'Carnot Heat Engine', desc: 'Isothermal expansion, adiabatic cooling, compression & efficiency' },
                    { title: 'Krebs Cycle', desc: 'Acetyl-CoA entry, citrate oxidation, NADH/FADH2 & ATP yield' },
                    { title: 'TCP 3-Way Handshake', desc: 'SYN, SYN-ACK, ACK sequence synchronization & established state' },
                  ].map((sample) => (
                    <button
                      key={sample.title}
                      type="button"
                      disabled={diagramLoading}
                      onClick={() => handleGenerateDiagram(sample.title)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-45 ${
                        isDark
                          ? 'bg-[#141418] border-white/[0.09] hover:border-white/25'
                          : 'bg-white border-black/[0.09] hover:border-black/25'
                      }`}
                    >
                      <div className="text-[15px] font-semibold">{sample.title}</div>
                      <div className={`text-[13px] mt-1 leading-relaxed ${mutedClass}`}>{sample.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl border overflow-hidden ${stageSurface}`}>
                <div className="p-4 sm:p-7 min-h-[380px] flex flex-col justify-center">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {diagramNodes.map((node, idx) => {
                      const isSelected = selectedDiagramNodeId
                        ? selectedDiagramNodeId === node.id
                        : idx === 0;
                      const stepNum = String(idx + 1).padStart(2, '0');
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => setSelectedDiagramNodeId(node.id)}
                          className={`group relative p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[168px] ${
                            isSelected
                              ? isDark
                                ? 'bg-[#1b1b20] border-white text-white shadow-[0_12px_32px_rgba(0,0,0,0.4)]'
                                : 'bg-white border-black text-black shadow-[0_12px_32px_rgba(0,0,0,0.08)]'
                              : isDark
                              ? 'bg-[#141417] border-white/[0.09] hover:border-white/25 text-neutral-200'
                              : 'bg-white border-black/[0.09] hover:border-black/25 text-neutral-800'
                          }`}
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[13px] font-mono font-semibold tabular-nums ${isSelected ? '' : mutedClass}`}>
                                {stepNum}
                              </span>
                              {idx < diagramNodes.length - 1 && (
                                <>
                                  <ArrowDown className={`w-4 h-4 md:hidden ${mutedClass}`} />
                                  <ArrowRight className={`w-4 h-4 hidden md:block ${mutedClass}`} />
                                </>
                              )}
                            </div>
                            <div className="text-[15px] sm:text-base font-semibold leading-snug">
                              <MathText text={node.title} />
                            </div>
                            <div className={`text-sm leading-relaxed ${mutedClass}`}>
                              <MathText text={node.detail} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Integrated Stage Inspector Dock */}
                {(() => {
                  const selectedIdx = Math.max(
                    0,
                    diagramNodes.findIndex((n) => n.id === selectedDiagramNodeId)
                  );
                  const activeNode = diagramNodes[selectedIdx] || diagramNodes[0];
                  if (!activeNode) return null;
                  const stageNum = String(selectedIdx + 1).padStart(2, '0');
                  const totalNum = String(diagramNodes.length).padStart(2, '0');
                  return (
                    <div
                      className={`px-5 sm:px-7 py-4 border-t ${subtleDivider} flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isDark ? 'bg-white/[0.02]' : 'bg-white'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className={`text-[13px] font-mono tabular-nums ${mutedClass}`}>
                          Selected Stage · {stageNum} / {totalNum}
                        </div>
                        <div className="text-[15px] sm:text-base font-semibold">
                          <MathText text={activeNode.title} />
                        </div>
                        <div className={`text-sm leading-relaxed ${mutedClass}`}>
                          <MathText text={activeNode.detail} />
                        </div>
                      </div>
                      {onAskTutor && (
                        <button
                          type="button"
                          onClick={() =>
                            onAskTutor(
                              `Explain Stage ${stageNum} ("${formatSvgMathText(activeNode.title)}") in "${diagramPrompt || topicTitle}": ${formatSvgMathText(activeNode.detail)}`,
                              diagramPrompt.trim() || topicTitle
                            )
                          }
                          className={`h-9 px-4 rounded-xl text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${primaryBtn}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Explain in Tutor</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ================= MODE 3: MASTERY PATHS ================= */}
        {labMode === 'mastery' && (
          <div className="space-y-5 min-w-0">
            {/* Elevated Roadmap Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerateMasteryPath();
              }}
              className={`rounded-2xl border p-2 pl-4 flex items-center gap-2.5 transition-all ${composerSurface}`}
            >
              <input
                type="text"
                value={masteryPrompt}
                onChange={(e) => setMasteryPrompt(e.target.value)}
                placeholder="Enter a topic for a 5-stage roadmap..."
                className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              />
              <button
                type="submit"
                disabled={!masteryPrompt.trim() || masteryLoading}
                aria-label="Build mastery path"
                className={`size-9 rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-35 transition-colors ${primaryBtn}`}
              >
                {masteryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </form>

            {masteryError && (
              <div
                className={`px-4 py-3 rounded-xl border text-[13px] ${
                  isDark
                    ? 'border-red-500/30 bg-red-500/10 text-red-200'
                    : 'border-red-500/30 bg-red-50 text-red-700'
                }`}
              >
                {masteryError}
              </div>
            )}

            {masteryNodes.length === 0 ? (
              <div className={`rounded-2xl border p-6 sm:p-12 min-h-[420px] flex flex-col items-center justify-center text-center space-y-6 ${stageSurface}`}>
                <div className="space-y-2 max-w-lg">
                  <h3 className="text-lg font-semibold tracking-tight">Structured Mastery Roadmap</h3>
                  <p className={`text-sm sm:text-[15px] leading-relaxed ${mutedClass}`}>
                    Build a real prerequisite sequence with measurable milestones, core equations, and direct practice derivations for any topic.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-2xl">
                  {[
                    { title: 'Quantum Mechanics', desc: 'Wave-particle duality, Schrödinger equation, operators & entanglement' },
                    { title: 'Transformer Architecture', desc: 'Embeddings, self-attention, residual layers & autoregressive decoding' },
                    { title: 'Organic Reaction Mechanisms', desc: 'Nucleophiles, SN1/SN2 pathways, elimination & stereochemistry' },
                    { title: 'Linear Algebra', desc: 'Vector spaces, linear maps, eigenvalues, SVD & orthogonality' },
                  ].map((sample) => (
                    <button
                      key={sample.title}
                      type="button"
                      disabled={masteryLoading}
                      onClick={() => handleGenerateMasteryPath(sample.title)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-45 ${
                        isDark
                          ? 'bg-[#141418] border-white/[0.09] hover:border-white/25'
                          : 'bg-white border-black/[0.09] hover:border-black/25'
                      }`}
                    >
                      <div className="text-[15px] font-semibold">{sample.title}</div>
                      <div className={`text-[13px] mt-1 leading-relaxed ${mutedClass}`}>{sample.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl border overflow-hidden ${stageSurface}`}>
                {/* Spacious Progress Header */}
                <div className={`px-5 sm:px-7 py-5 border-b ${subtleDivider} space-y-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base sm:text-lg font-semibold tracking-tight truncate">
                      {activeMasteryTopic}
                    </h3>
                    <div className="text-[13px] sm:text-sm font-mono font-semibold tabular-nums shrink-0">
                      {masteredCount} / {masteryNodes.length} Mastered · {masteryPct}%
                    </div>
                  </div>
                  <div
                    className={`w-full h-2 rounded-full overflow-hidden ${
                      isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'
                    }`}
                  >
                    <div
                      className={`h-full transition-[width] duration-300 ${
                        isDark ? 'bg-white' : 'bg-black'
                      }`}
                      style={{ width: `${masteryPct}%` }}
                    />
                  </div>
                </div>

                {/* Editorial Checkpoint Timeline */}
                <div className={`divide-y ${isDark ? 'divide-white/[0.08]' : 'divide-black/[0.08]'}`}>
                  {masteryNodes.map((node, idx) => {
                    const status = masteredMap[`${activeMasteryTopic}:${node.id}`] || 'not_started';
                    return (
                      <div
                        key={node.id}
                        className="px-5 sm:px-7 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-4 min-w-0 flex-1">
                          <div
                            className={`size-9 rounded-xl border flex items-center justify-center text-[13px] font-mono font-semibold tabular-nums shrink-0 mt-0.5 ${
                              status === 'mastered'
                                ? isDark
                                  ? 'bg-white text-black border-white'
                                  : 'bg-black text-white border-black'
                                : isDark
                                ? 'bg-white/[0.04] border-white/15 text-neutral-300'
                                : 'bg-white border-black/15 text-neutral-700'
                            }`}
                          >
                            {status === 'mastered' ? <Check className="w-4 h-4" /> : String(idx + 1).padStart(2, '0')}
                          </div>
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className={`text-[13px] ${mutedClass}`}>
                              {node.stage} · Prereq: <MathText text={node.prerequisite} />
                            </div>
                            <div className="text-[15px] sm:text-base font-semibold tracking-tight">
                              <MathText text={node.title} />
                            </div>
                            <div className={`text-sm sm:text-[15px] leading-relaxed ${mutedClass}`}>
                              <MathText text={node.objective} />
                            </div>
                            {node.formula && (
                              <div className="text-sm pt-1">
                                <MathText text={node.formula} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0 pl-13 lg:pl-0">
                          {onAskTutor && (
                            <button
                              type="button"
                              onClick={() =>
                                onAskTutor(
                                  `Teach me "${node.title}" (${node.stage}) for ${activeMasteryTopic}. Objective: ${node.objective}`,
                                  activeMasteryTopic
                                )
                              }
                              className={`h-9 px-3 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${ghostBtn}`}
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>Tutor</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setLabMode('deep_solve');
                              handleRunDeepSolve(`Derive and walk through key problem patterns for: ${node.title} (${activeMasteryTopic})`);
                            }}
                            className={`h-9 px-3 rounded-xl border text-[13px] font-medium cursor-pointer whitespace-nowrap ${ghostBtn}`}
                          >
                            Practice Solve
                          </button>
                          <button
                            type="button"
                            onClick={() => cycleNodeMastery(node.id)}
                            className={`h-9 px-3.5 rounded-xl text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                              status === 'mastered'
                                ? primaryBtn
                                : status === 'in_progress'
                                ? isDark
                                  ? 'bg-white/15 text-white border border-white/25'
                                  : 'bg-black/10 text-black border border-black/25'
                                : isDark
                                ? 'bg-white/[0.05] text-neutral-300 border border-white/12'
                                : 'bg-white text-neutral-700 border border-black/12'
                            }`}
                          >
                            {status === 'mastered' && <Check className="w-4 h-4" />}
                            <span>
                              {status === 'mastered'
                                ? 'Mastered'
                                : status === 'in_progress'
                                ? 'In Progress'
                                : 'Mark Progress'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {onStartQuiz && (
                  <div className={`px-5 sm:px-7 py-4 border-t ${subtleDivider} flex justify-end`}>
                    <button
                      type="button"
                      onClick={onStartQuiz}
                      className={`h-9 px-4 rounded-xl text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer ${primaryBtn}`}
                    >
                      <span>Verify with Adaptive Quiz</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= MODE 4: STEP-BY-STEP DEEP SOLVE ================= */}
        {labMode === 'deep_solve' && (
          <div className="space-y-5 min-w-0 max-w-full">
            {/* Flagship Multi-Line Problem Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRunDeepSolve();
              }}
              className={`rounded-2xl border p-3 pl-4 flex items-end gap-3 transition-all ${composerSurface}`}
            >
              <textarea
                rows={2}
                value={solveInput}
                onChange={(e) => setSolveInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleRunDeepSolve();
                  }
                }}
                placeholder="Enter an equation, derivation, or proof..."
                className="flex-1 min-w-0 bg-transparent text-[15px] leading-relaxed outline-none resize-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              />
              <button
                type="submit"
                disabled={!solveInput.trim() || solveLoading}
                aria-label="Solve step-by-step"
                className={`size-10 rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-35 transition-colors ${primaryBtn}`}
              >
                {solveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </form>

            {solveError && (
              <div
                className={`px-4 py-3 rounded-xl border text-[13px] ${
                  isDark
                    ? 'border-red-500/30 bg-red-500/10 text-red-200'
                    : 'border-red-500/30 bg-red-50 text-red-700'
                }`}
              >
                {solveError}
              </div>
            )}

            {/* Large Flagship Solution & Proof Reader */}
            {solveResult ? (
              <div className={`rounded-2xl border overflow-hidden min-h-[420px] flex flex-col ${stageSurface}`}>
                <div className={`px-5 sm:px-7 py-3.5 border-b ${subtleDivider} flex flex-wrap items-center justify-between gap-2`}>
                  <div className="text-sm sm:text-[15px] font-semibold truncate min-w-0 flex-1">
                    {solveInput.trim() || 'Step-by-Step Derivation'}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(solveResult).catch(() => {});
                        setSolveCopied(true);
                        window.setTimeout(() => setSolveCopied(false), 1800);
                      }}
                      className={`h-9 px-3 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer ${ghostBtn}`}
                    >
                      {solveCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{solveCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                    {onAskTutor && (
                      <button
                        type="button"
                        onClick={() =>
                          onAskTutor(
                            `Discuss and verify this Deep Solve problem "${solveInput.trim() || topicTitle}":\n\n${solveResult.slice(0, 1200)}`,
                            solveInput.trim().slice(0, 60) || topicTitle
                          )
                        }
                        className={`h-9 px-3.5 rounded-xl text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer ${primaryBtn}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Tutor</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSolveResult('');
                        setSolveError(null);
                        setSolveInput('');
                      }}
                      className={`h-9 px-3 rounded-xl border text-[13px] font-medium cursor-pointer ${ghostBtn}`}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="px-5 sm:px-8 py-6 text-sm sm:text-[15px] leading-7 min-w-0 max-w-4xl">
                  <MathMarkdown content={solveResult} isDark={isDark} autoDetectLatex />
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl border p-6 sm:p-12 min-h-[420px] flex flex-col items-center justify-center text-center space-y-6 ${stageSurface}`}>
                <div className="space-y-2 max-w-lg">
                  <h3 className="text-lg font-semibold tracking-tight">Rigorous Step-by-Step Solver</h3>
                  <p className={`text-sm sm:text-[15px] leading-relaxed ${mutedClass}`}>
                    Work through symbolic proofs, numerical physics problems, and calculus derivations with full intermediate reasoning and LaTeX formatting.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full max-w-4xl">
                  {[
                    `Derive total mechanical energy for ${topicTitle || 'simple harmonic motion'}`,
                    'Calculate projectile range at $45^\\circ$ with $v_0 = 24\\unit{m/s}$ and $g = 9.8\\unit{m/s^2}$',
                    'Prove Kepler Third Law $T^2 \\propto r^3$ from circular gravitational centripetal balance',
                  ].map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      disabled={solveLoading}
                      onClick={() => handleRunDeepSolve(ex)}
                      className={`p-4 rounded-xl border text-left text-sm leading-relaxed transition-all cursor-pointer disabled:opacity-45 ${
                        isDark
                          ? 'bg-[#141418] border-white/[0.09] hover:border-white/25'
                          : 'bg-white border-black/[0.09] hover:border-black/25'
                      }`}
                    >
                      <MathText text={ex} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= MODE 5: MATHEMATICAL FUNCTION & DERIVATIVE PLOTTER ================= */}
        {labMode === 'plotter' && (
          <div className="space-y-5 min-w-0">
            {/* Flagship Coordinate Plane Stage (Dominant Component First) */}
            <div className={`rounded-2xl border overflow-hidden ${stageSurface}`}>
              {/* Clean Expression & Control Dock */}
              <div className={`p-4 sm:p-5 border-b ${subtleDivider} space-y-3.5`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className={`rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 ${inputClass}`}>
                    <span className="text-[13px] font-mono font-semibold shrink-0">y(x) =</span>
                    <input
                      type="text"
                      value={mathExpr}
                      onChange={(e) => setMathExpr(e.target.value)}
                      aria-label="Math Expression y(x)"
                      placeholder="sin(x) * exp(-0.12 * abs(x))"
                      className="flex-1 min-w-0 bg-transparent font-mono text-sm outline-none"
                    />
                  </div>
                  <div className={`rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 ${inputClass}`}>
                    <span className="text-[13px] font-mono font-semibold text-amber-500 shrink-0">g(x) =</span>
                    <input
                      type="text"
                      value={compareExpr}
                      onChange={(e) => setCompareExpr(e.target.value)}
                      aria-label="Comparison Expression g(x)"
                      placeholder="Optional curve (e.g. cos(x))"
                      className="flex-1 min-w-0 bg-transparent font-mono text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 text-[13px]">
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showDerivative}
                      onClick={() => setShowDerivative((v) => !v)}
                      className="inline-flex items-center gap-2.5 cursor-pointer whitespace-nowrap"
                    >
                      <span className="inline-block w-3 h-0.5 bg-sky-500 rounded-full" />
                      <span className="font-medium">Derivative y&apos;(x)</span>
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          showDerivative
                            ? isDark
                              ? 'bg-white'
                              : 'bg-black'
                            : isDark
                            ? 'bg-white/15'
                            : 'bg-black/15'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                            showDerivative
                              ? isDark
                                ? 'translate-x-[18px] bg-black'
                                : 'translate-x-[18px] bg-white'
                              : isDark
                              ? 'translate-x-1 bg-white/70'
                              : 'translate-x-1 bg-white'
                          }`}
                        />
                      </span>
                    </button>

                    {!standalone && (
                      <div className="relative">
                        <select
                          aria-label="Choose example function"
                          value={PLOTTER_PRESETS.find((p) => p.expr === mathExpr)?.expr || ''}
                          onChange={(e) => {
                            if (e.target.value) setMathExpr(e.target.value);
                          }}
                          className={`h-9 pl-3 pr-8 rounded-xl border text-[13px] font-medium appearance-none outline-none cursor-pointer ${selectClass}`}
                        >
                          <option value="" disabled>
                            Function library
                          </option>
                          {PLOTTER_PRESETS.map((item) => (
                            <option key={item.label} value={item.expr} className={isDark ? 'bg-[#141418] text-white' : 'bg-white text-black'}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className={`w-4 h-4 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${mutedClass}`} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`font-mono tabular-nums ${mutedClass}`}>
                      Domain [-{xRange}, {xRange}]
                    </span>
                    <input
                      type="range"
                      min={2}
                      max={20}
                      step={1}
                      value={xRange}
                      aria-label="X Axis Range"
                      onChange={(e) => setXRange(parseInt(e.target.value, 10))}
                      className="w-28 sm:w-36 h-1.5 rounded-full accent-black dark:accent-white cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {!plotStats.valid ? (
                <div className="p-10 text-center text-sm text-amber-600 dark:text-amber-300">
                  Expression could not be evaluated. Try standard syntax like <code className="font-mono">sin(x)</code>, <code className="font-mono">exp(-x^2)</code>, or <code className="font-mono">sqrt(abs(x))</code>.
                </div>
              ) : (
                <>
                  {/* Large Flagship Graph Canvas */}
                  <div className="p-4 sm:p-6">
                    {mathExpr.trim() && (
                      <div
                        className="mb-3 text-center text-sm sm:text-base"
                        data-testid="curve-plotter-latex-preview"
                      >
                        <MathFormula formula={`y(x) = ${expressionToLatex(mathExpr)}`} displayMode />
                      </div>
                    )}
                    <div className="h-[340px] sm:h-[480px] lg:h-[560px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={plotData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                          <CartesianGrid
                            stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(9,9,11,0.08)'}
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            dataKey="x"
                            type="number"
                            domain={[-xRange, xRange]}
                            stroke={isDark ? '#71717a' : '#64748b'}
                            fontSize={12}
                          />
                          <YAxis stroke={isDark ? '#71717a' : '#64748b'} fontSize={12} />
                          <ReferenceLine
                            x={0}
                            stroke={isDark ? 'rgba(255,255,255,0.22)' : 'rgba(9,9,11,0.22)'}
                          />
                          <ReferenceLine
                            y={0}
                            stroke={isDark ? 'rgba(255,255,255,0.22)' : 'rgba(9,9,11,0.22)'}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDark ? '#18181b' : '#ffffff',
                              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                              borderRadius: '12px',
                              fontSize: '13px',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="y"
                            name="y(x)"
                            stroke={isDark ? '#f4f4f5' : '#09090b'}
                            strokeWidth={2.4}
                            dot={false}
                            isAnimationActive={false}
                          />
                          {showDerivative && (
                            <Line
                              type="monotone"
                              dataKey="dy"
                              name="y'(x)"
                              stroke={isDark ? '#38bdf8' : '#0284c7'}
                              strokeWidth={1.8}
                              strokeDasharray="5 3"
                              dot={false}
                              isAnimationActive={false}
                            />
                          )}
                          {compareExpr.trim() && (
                            <Line
                              type="monotone"
                              dataKey="g"
                              name="g(x)"
                              stroke={isDark ? '#fbbf24' : '#d97706'}
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Real Computed Math Analysis Strip */}
                  <div className={`px-5 py-3.5 border-t ${subtleDivider} grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px] font-mono tabular-nums`}>
                    <div>
                      <span className={mutedClass}>Min y = </span>
                      <span className="font-semibold">{plotStats.minY.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className={mutedClass}>Max y = </span>
                      <span className="font-semibold">{plotStats.maxY.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className={mutedClass}>∫ y dx ≈ </span>
                      <span className="font-semibold">{plotStats.integral.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className={mutedClass}>Roots ≈ </span>
                      <span className="font-semibold">{plotStats.roots}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Unified Elevated Tutor Follow-Up Composer */}
        {onAskTutor && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = tutorDraft.trim();
              if (!q) return;
              const contextNote =
                labMode === 'physics'
                  ? `[Physics Lab: ${activeSimTitle} | Formula: ${activeSimFormula} | KE=${activeSimSnapshot.kineticEnergy.toFixed(1)} J, PE=${activeSimSnapshot.potentialEnergy.toFixed(1)} J]\n\n${q}`
                  : labMode === 'diagram'
                  ? `[Concept Diagram: ${diagramPrompt || topicTitle} | Stages: ${diagramNodes.map((n) => formatSvgMathText(n.title)).join(' -> ')}]\n\n${q}`
                  : labMode === 'mastery'
                  ? `[Mastery Path: ${activeMasteryTopic}]\n\n${q}`
                  : labMode === 'deep_solve'
                  ? `[Deep Solve: ${solveInput.trim() || topicTitle}]\n\n${q}`
                  : `[Curve Plotter: y(x) = ${mathExpr} on [-${xRange}, ${xRange}]]\n\n${q}`;
              const topicForTutor =
                labMode === 'physics'
                  ? activeSimTitle
                  : labMode === 'diagram'
                  ? diagramPrompt.trim() || topicTitle
                  : labMode === 'mastery'
                  ? activeMasteryTopic
                  : labMode === 'plotter'
                  ? `y(x) = ${mathExpr}`
                  : solveInput.trim().slice(0, 60) || topicTitle;
              setTutorDraft('');
              onAskTutor(contextNote, topicForTutor);
            }}
            className={`rounded-2xl border p-2 pl-4 flex items-center gap-2.5 transition-all ${composerSurface}`}
            data-testid="lab-tutor-prompt-bar"
          >
            <MessageSquare className={`w-4 h-4 shrink-0 ${mutedClass}`} />
            <input
              type="text"
              value={tutorDraft}
              onChange={(e) => setTutorDraft(e.target.value)}
              placeholder="Ask Study Tutor about this..."
              className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
            <button
              type="submit"
              disabled={!tutorDraft.trim()}
              aria-label="Ask Study Tutor"
              className={`size-9 rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-35 transition-colors ${primaryBtn}`}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
