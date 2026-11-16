import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pause,
  Play,
  RotateCcw,
  Send,
  SkipForward,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const customSpecRef = useRef(customSpec);
  customSpecRef.current = customSpec;
  const isCustomActiveRef = useRef(isCustomActive);
  isCustomActiveRef.current = isCustomActive;

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
    const forceInk = isDark ? '#71717a' : '#71717a';

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
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + customState.vel.x * vScale, py - customState.vel.y * vScale);
        ctx.stroke();

        const aScale = Math.min(18, Math.max(1.2, 18 / Math.max(1, Math.hypot(customState.acc.x, customState.acc.y))));
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = forceInk;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + customState.acc.x * aScale, py - customState.acc.y * aScale);
        ctx.stroke();
        ctx.setLineDash([]);
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
        // Velocity vector (solid)
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + simState.vel.x * 2.2, by - simState.vel.y * 2.2);
        ctx.stroke();

        // Gravity force vector (dashed)
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = forceInk;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by + (params.gravity || 9.8) * 3.2);
        ctx.stroke();
        ctx.setLineDash([]);
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
        ctx.strokeStyle = secondaryInk;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + simState.vel.x * 12, by - simState.vel.y * 12);
        ctx.stroke();
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
        ctx.strokeStyle = secondaryInk;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(massX, midY);
        ctx.lineTo(massX + fx, midY);
        ctx.stroke();
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
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + simState.vel.x * 2.2, sy - simState.vel.y * 2.2);
        ctx.stroke();

        // Radial gravity pull arrow (dashed)
        const dirToStar = { x: cx - sx, y: cy - sy };
        const mag = Math.hypot(dirToStar.x, dirToStar.y) || 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = forceInk;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (dirToStar.x / mag) * 28, sy + (dirToStar.y / mag) * 28);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(sx, sy, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [simState, customState, isCustomActive, customSpec, params, showVectors, showTrail, isDark, labMode]);

  // -------------------------------------------------------------------------
  // 2. CONCEPT DIAGRAM GENERATOR STATE
  // -------------------------------------------------------------------------
  const [diagramPrompt, setDiagramPrompt] = useState(topicTitle || 'Physics & Systems Architecture');
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramNodes, setDiagramNodes] = useState<DiagramNode[]>(() => {
    if (lessonModules.length > 0) {
      return lessonModules.slice(0, 6).map((m, idx) => ({
        id: `dn-${idx}`,
        title: m.title,
        detail: m.summary,
        tier: idx,
      }));
    }
    return [
      { id: 'dn-0', title: `${topicTitle || 'System'} Input`, detail: 'Initial conditions & parameters', tier: 0 },
      { id: 'dn-1', title: 'Governing Principle', detail: 'Core transformation & laws', tier: 1 },
      { id: 'dn-2', title: 'Equilibrium & Bounds', detail: 'Constraints and limits', tier: 2 },
      { id: 'dn-3', title: 'Observable Output', detail: 'Measurable result & validation', tier: 3 },
    ];
  });
  const svgDiagramRef = useRef<SVGSVGElement | null>(null);

  const handleGenerateDiagram = async () => {
    if (!diagramPrompt.trim() || diagramLoading) return;
    setDiagramLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch('/api/study/visualize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: diagramPrompt.trim(),
          context: topicContext.slice(0, 4000),
          mode: 'diagram',
        }),
      });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.nodes) && data.nodes.length > 0) {
        setDiagramNodes(
          data.nodes.map((n: any, idx: number) => ({
            id: String(n.id || `dn-${idx}`),
            title: String(n.title || `Stage ${idx + 1}`),
            detail: String(n.detail || ''),
            tier: idx,
          }))
        );
      }
    } catch {
      // Keep local structured diagram fallback cleanly
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
    a.download = `${(topicTitle || 'diagram').replace(/[^a-z0-9_-]/gi, '_')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------------------
  // 3. MASTERY PATHS STATE
  // -------------------------------------------------------------------------
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [tutorDraft, setTutorDraft] = useState('');
  const [masteryPrompt, setMasteryPrompt] = useState('');
  const [customMasteryTopic, setCustomMasteryTopic] = useState('');
  const activeMasteryTopic = (customMasteryTopic || topicTitle || 'Current Topic').trim();

  const masteryNodes = useMemo(
    () => buildDefaultMasteryNodes(activeMasteryTopic, lessonModules, concepts),
    [activeMasteryTopic, lessonModules, concepts]
  );
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

  // -------------------------------------------------------------------------
  // 4. DEEP SOLVE (STEP-BY-STEP PROBLEM SOLVER) STATE
  // -------------------------------------------------------------------------
  const [solveInput, setSolveInput] = useState('');
  const [solveLoading, setSolveLoading] = useState(false);
  const [solveResult, setSolveResult] = useState<string>('');

  const handleRunDeepSolve = async (overrideProblem?: string) => {
    const q = (overrideProblem ?? solveInput).trim();
    if (!q || solveLoading) return;
    if (overrideProblem) setSolveInput(overrideProblem);
    setSolveLoading(true);
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
      const data = await res.json();
      setSolveResult(
        String(
          data?.solution ||
            'Verify knowns, unknowns, governing laws, and units step by step.'
        )
      );
    } catch {
      setSolveResult(
        `### Step-by-Step Derivation Framework for "${q}"\n\n1. **Given & Target**: List all known parameters and the unknown quantity in SI units.\n2. **Governing Law**: State the conservation law or equation connecting knowns and unknowns.\n3. **Symbolic Derivation**: Isolate the target variable algebraically before substituting numbers.\n4. **Substitution & Dimensional Check**: Substitute exact values and confirm units match.`
      );
    } finally {
      setSolveLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // 5. FUNCTION & DATA PLOTTER STATE
  // -------------------------------------------------------------------------
  const [mathExpr, setMathExpr] = useState('sin(x) * exp(-0.12 * abs(x))');
  const [xRange, setXRange] = useState(10);

  const plotData = useMemo(() => {
    const rows: Array<{ x: number; y: number }> = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const x = -xRange + (2 * xRange * i) / steps;
      const y = evaluateMathExpression(mathExpr, x);
      if (y !== null) {
        rows.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(4)) });
      }
    }
    return rows;
  }, [mathExpr, xRange]);

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

  return (
    <div
      className={
        standalone
          ? 'min-h-full w-full max-w-full overflow-x-hidden flex flex-col'
          : 'w-full max-w-full overflow-x-hidden'
      }
    >
      {standalone && (
        <header className="h-12 px-3 sm:px-5 bg-transparent flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                data-testid="study-feature-back-btn"
                className={`h-7 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${ghostBtn}`}
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Back</span>
              </button>
            )}
            <h1 className="text-sm font-semibold tracking-tight truncate">
              {resolvedPageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {topicTitle && (
              <span className={`text-xs truncate max-w-[180px] hidden sm:inline ${mutedClass}`}>
                {topicTitle}
              </span>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((v) => !v)}
                aria-label="Tool options"
                data-testid="lab-more-menu-btn"
                className={`size-7 rounded-lg border inline-flex items-center justify-center transition-colors cursor-pointer ${ghostBtn}`}
              >
                <MoreVertical className="w-3.5 h-3.5" />
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

      <div className="w-full min-w-0 px-3 sm:px-6 py-4 space-y-5 pb-20">
        {!standalone && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight truncate">
                {resolvedPageTitle}
              </h2>
              {topicTitle && <p className={`text-xs truncate ${mutedClass}`}>{topicTitle}</p>}
            </div>

            <div
              className={`inline-flex items-center gap-1 p-1 rounded-lg border overflow-x-auto max-w-full scrollbar-none ${
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
                    className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active ? activeTabClass : mutedClass
                    }`}
                  >
                    {MODE_LABELS[id]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MODE 1: INTERACTIVE 2D PHYSICS SANDBOX */}
        {labMode === 'physics' && (
          <div className="space-y-4 min-w-0">
            {/* Simulation Prompt Generator Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerateSimulation();
              }}
              className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0"
              data-testid="physics-sim-prompt-bar"
            >
              <input
                type="text"
                value={simPrompt}
                onChange={(e) => setSimPrompt(e.target.value)}
                placeholder="Describe a physics simulation to build (e.g. bouncing ball, cyclotron, Moon projectile)..."
                className={`w-full sm:flex-1 min-w-0 px-3.5 py-2 rounded-lg border text-xs outline-none ${inputClass}`}
              />
              <button
                type="submit"
                disabled={!simPrompt.trim() || simGenerating}
                className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0 ${primaryBtn}`}
              >
                {simGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{simGenerating ? 'Building...' : 'Generate Simulation'}</span>
              </button>
            </form>

            {/* Preset selector row (+ generated custom simulation if active) */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {customSpec && (
                <button
                  type="button"
                  onClick={selectCustomSim}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    isCustomActive
                      ? isDark
                        ? 'bg-white text-black border-white font-semibold'
                        : 'bg-black text-white border-black font-semibold'
                      : isDark
                      ? 'border-white/10 text-neutral-400 hover:text-white'
                      : 'border-black/10 text-neutral-600 hover:text-black'
                  }`}
                >
                  {customSpec.title}
                </button>
              )}
              {(Object.keys(PHYSICS_PRESETS) as PhysicsPresetId[]).map((pid) => {
                const active = !isCustomActive && preset === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => selectPreset(pid)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      active
                        ? isDark
                          ? 'bg-white text-black border-white font-semibold'
                          : 'bg-black text-white border-black font-semibold'
                        : isDark
                        ? 'border-white/10 text-neutral-400 hover:text-white'
                        : 'border-black/10 text-neutral-600 hover:text-black'
                    }`}
                  >
                    {PHYSICS_PRESETS[pid].title}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Interactive Stage */}
              <div className={`lg:col-span-8 min-w-0 border overflow-hidden rounded-xl flex flex-col ${subtleDivider}`}>
                <div className={`px-3 sm:px-4 py-2.5 border-b ${subtleDivider} flex flex-wrap items-center justify-between gap-2`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">
                      <MathText text={activeSimTitle} />
                    </div>
                    <div className={`text-[11px] overflow-x-auto scrollbar-none ${mutedClass}`}>
                      <MathFormula formula={activeSimFormula} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (isCustomActive && customSpec) {
                          setCustomState((s) => (s ? { ...s, paused: !s.paused } : s));
                        } else {
                          setSimState((s) => ({ ...s, paused: !s.paused }));
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${ghostBtn}`}
                    >
                      {activeSimSnapshot.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
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
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${ghostBtn}`}
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Step</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => resetSim()}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${ghostBtn}`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                <div className="relative w-full h-[300px] sm:h-[360px]">
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

                {/* Quantitative Telemetry Strip */}
                <div className={`px-3 sm:px-4 py-2 border-t ${subtleDivider} grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono tabular-nums`}>
                  <div>
                    <span className={mutedClass}>t = </span>
                    <span className="font-semibold">{activeSimSnapshot.time.toFixed(2)}s</span>
                  </div>
                  <div>
                    <span className={mutedClass}>KE = </span>
                    <span className="font-semibold">{activeSimSnapshot.kineticEnergy.toFixed(1)} J</span>
                  </div>
                  <div>
                    <span className={mutedClass}>PE = </span>
                    <span className="font-semibold">{activeSimSnapshot.potentialEnergy.toFixed(1)} J</span>
                  </div>
                  <div>
                    <span className={mutedClass}>Peak = </span>
                    <span className="font-semibold">{activeSimSnapshot.maxHeight.toFixed(2)} m</span>
                  </div>
                </div>
              </div>

              {/* Control & Concept Deck (Flat, No Double Padding) */}
              <div className="lg:col-span-4 min-w-0 flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  <div className={`text-xs font-semibold ${mutedClass}`}>
                    Parameters
                  </div>
                  {activeSimParams.map((spec) => {
                    const val = params[spec.key] ?? spec.defaultValue;
                    return (
                      <div key={spec.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
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
                          className="w-full accent-black dark:accent-white cursor-pointer"
                        />
                      </div>
                    );
                  })}

                  <div className={`pt-2 border-t ${subtleDivider} flex items-center justify-between text-xs`}>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showVectors}
                        onChange={(e) => setShowVectors(e.target.checked)}
                        className="accent-black dark:accent-white"
                      />
                      <span>Vectors</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTrail}
                        onChange={(e) => setShowTrail(e.target.checked)}
                        className="accent-black dark:accent-white"
                      />
                      <span>Trail</span>
                    </label>
                  </div>
                </div>

                <div className={`text-xs leading-relaxed pt-3 border-t ${subtleDivider} ${mutedClass}`}>
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
                      className={`mt-2 block hover:underline font-medium cursor-pointer ${
                        isDark ? 'text-white' : 'text-black'
                      }`}
                    >
                      Derive in Tutor Chat →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: INTERACTIVE CONCEPT & FLOW DIAGRAM GENERATOR (Flat & Mobile-Safe) */}
        {labMode === 'diagram' && (
          <div className="space-y-4 min-w-0 max-w-full">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
              <input
                type="text"
                value={diagramPrompt}
                onChange={(e) => setDiagramPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerateDiagram();
                }}
                placeholder="Enter a concept, mechanism, or system..."
                className={`w-full sm:flex-1 min-w-0 px-3.5 py-2 rounded-lg border text-xs outline-none ${inputClass}`}
              />
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={handleGenerateDiagram}
                  disabled={diagramLoading}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 ${primaryBtn}`}
                >
                  {diagramLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate</span>
                </button>
                {onAskTutor && (
                  <button
                    type="button"
                    onClick={() =>
                      onAskTutor(
                        `Explain this concept diagram step-by-step for "${diagramPrompt || topicTitle}": ${diagramNodes.map((n) => `${formatSvgMathText(n.title)} (${formatSvgMathText(n.detail)})`).join(' -> ')}.`,
                        diagramPrompt.trim() || topicTitle
                      )
                    }
                    className={`px-3 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${ghostBtn}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ask Tutor</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportSvg}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${ghostBtn}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export SVG</span>
                </button>
              </div>
            </div>

            <div className={`w-full max-w-full overflow-x-auto rounded-lg border p-3 sm:p-4 ${subtleDivider} bg-black/[0.015] dark:bg-black/30`}>
              <svg
                ref={svgDiagramRef}
                viewBox={`0 0 ${Math.max(760, diagramNodes.length * 195)} 236`}
                className="w-full min-w-[680px] h-60"
              >
                <defs>
                  <marker
                    id="kinich-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill={svgStroke} />
                  </marker>
                </defs>
                {diagramNodes.map((node, idx) => {
                  const x = 20 + idx * 190;
                  const y = 28;
                  const w = 166;
                  const h = 166;
                  return (
                    <g key={node.id}>
                      {idx < diagramNodes.length - 1 && (
                        <line
                          x1={x + w}
                          y1={y + h / 2}
                          x2={x + 190 - 4}
                          y2={y + h / 2}
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
                        rx={10}
                        fill={isDark ? '#18181b' : '#ffffff'}
                        stroke={
                          idx === 0
                            ? svgStroke
                            : isDark
                            ? 'rgba(255,255,255,0.2)'
                            : 'rgba(9,9,11,0.2)'
                        }
                        strokeWidth={idx === 0 ? '1.8' : '1.2'}
                      />
                      <text
                        x={x + 12}
                        y={y + 22}
                        fontSize="10"
                        fontFamily="monospace"
                        fill={isDark ? '#a1a1aa' : '#52525b'}
                      >
                        {`0${idx + 1}.`}
                      </text>
                      <foreignObject x={x + 12} y={y + 28} width={w - 24} height={h - 36}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            lineHeight: 1.32,
                            color: isDark ? '#f4f4f5' : '#09090b',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                        >
                          <SvgLatex text={node.title} />
                          <div
                            style={{
                              marginTop: '6px',
                              fontSize: '10.5px',
                              fontWeight: 400,
                              lineHeight: 1.38,
                              color: isDark ? '#a1a1aa' : '#52525b',
                            }}
                          >
                            <SvgLatex text={node.detail} />
                          </div>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* MODE 3: MASTERY PATHS (Flat, Zero Double Padding) */}
        {labMode === 'mastery' && (
          <div className="space-y-4 min-w-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!masteryPrompt.trim()) return;
                setCustomMasteryTopic(masteryPrompt.trim());
                setMasteryPrompt('');
              }}
              className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0"
            >
              <input
                type="text"
                value={masteryPrompt}
                onChange={(e) => setMasteryPrompt(e.target.value)}
                placeholder="Enter a topic to build its mastery roadmap..."
                className={`w-full sm:flex-1 min-w-0 px-3.5 py-2 rounded-lg border text-xs outline-none ${inputClass}`}
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  disabled={!masteryPrompt.trim()}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${primaryBtn}`}
                >
                  Build Path
                </button>
                {onAskTutor && masteryPrompt.trim() && (
                  <button
                    type="button"
                    onClick={() => onAskTutor(masteryPrompt.trim(), activeMasteryTopic)}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${ghostBtn}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ask Tutor</span>
                  </button>
                )}
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold min-w-0 truncate">
                Prerequisite Roadmap · {activeMasteryTopic}
              </div>
              <div className="text-xs font-mono font-semibold tabular-nums shrink-0">
                {masteredCount} / {masteryNodes.length} Mastered
              </div>
            </div>

            <div className={`divide-y border-t border-b ${isDark ? 'divide-white/[0.08]' : 'divide-black/[0.08]'} ${subtleDivider}`}>
              {masteryNodes.map((node) => {
                const status = masteredMap[`${activeMasteryTopic}:${node.id}`] || 'not_started';
                return (
                  <div
                    key={node.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className={`text-[11px] font-mono ${mutedClass}`}>
                        {node.stage} · Prereq: <MathText text={node.prerequisite} />
                      </div>
                      <div className="text-sm font-semibold">
                        <MathText text={node.title} />
                      </div>
                      <div className={`text-xs leading-relaxed ${mutedClass}`}>
                        <MathText text={node.objective} />
                      </div>
                      {node.formula && (
                        <div className="text-xs pt-0.5 overflow-x-auto scrollbar-none">
                          <MathText text={node.formula} />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {onAskTutor && (
                        <button
                          type="button"
                          onClick={() =>
                            onAskTutor(
                              `Teach me "${node.title}" (${node.stage}) for ${activeMasteryTopic}. Objective: ${node.objective}`,
                              activeMasteryTopic
                            )
                          }
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${ghostBtn}`}
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Tutor</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setLabMode('deep_solve');
                          handleRunDeepSolve(`Derive and walk through key problem patterns for: ${node.title}`);
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer whitespace-nowrap ${ghostBtn}`}
                      >
                        Practice Solve
                      </button>
                      <button
                        type="button"
                        onClick={() => cycleNodeMastery(node.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                          status === 'mastered'
                            ? primaryBtn
                            : status === 'in_progress'
                            ? isDark
                              ? 'bg-white/15 text-white border border-white/25'
                              : 'bg-black/10 text-black border border-black/25'
                            : isDark
                            ? 'bg-white/[0.05] text-neutral-300 border border-white/10'
                            : 'bg-black/[0.04] text-neutral-700 border border-black/10'
                        }`}
                      >
                        {status === 'mastered' && <Check className="w-3.5 h-3.5" />}
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
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={onStartQuiz}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${primaryBtn}`}
                >
                  <span>Verify with Adaptive Quiz</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* MODE 4: STEP-BY-STEP DEEP SOLVE (Flat, Zero Double Padding, Mobile-Safe) */}
        {labMode === 'deep_solve' && (
          <div className="space-y-4 min-w-0 max-w-full">
            <div className="flex flex-col sm:flex-row gap-2 min-w-0">
              <input
                type="text"
                value={solveInput}
                onChange={(e) => setSolveInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRunDeepSolve();
                }}
                placeholder="Enter a physics problem, integral, equation, or proof..."
                className={`w-full sm:flex-1 min-w-0 px-3.5 py-2 rounded-lg border text-xs sm:text-sm outline-none ${inputClass}`}
              />
              <button
                type="button"
                onClick={() => handleRunDeepSolve()}
                disabled={!solveInput.trim() || solveLoading}
                className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 ${primaryBtn}`}
              >
                {solveLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Solve Step-by-Step</span>
              </button>
            </div>

            {solveResult ? (
              <div className={`pt-4 border-t ${subtleDivider} space-y-3 min-w-0 max-w-full overflow-x-auto`}>
                <div className="text-xs sm:text-sm leading-relaxed min-w-0">
                  <MathMarkdown content={solveResult} isDark={isDark} autoDetectLatex />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  {onAskTutor && (
                    <button
                      type="button"
                      onClick={() =>
                        onAskTutor(
                          `Discuss and verify this Deep Solve problem "${solveInput.trim() || topicTitle}":\n\n${solveResult.slice(0, 1200)}`,
                          solveInput.trim().slice(0, 60) || topicTitle
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${primaryBtn}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Continue in Tutor</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSolveResult('');
                      setSolveInput('');
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${ghostBtn}`}
                  >
                    New Problem
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  `Derive total mechanical energy for ${topicTitle || 'simple harmonic motion'}`,
                  'Calculate projectile range at $45^\\circ$ with $v_0 = 24\\unit{m/s}$ and $g = 9.8\\unit{m/s^2}$',
                  'Prove Kepler Third Law $T^2 \\propto r^3$ from circular gravitational centripetal balance',
                ].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => handleRunDeepSolve(ex)}
                    className={`p-3 rounded-lg border text-left text-xs leading-relaxed transition-colors cursor-pointer ${
                      isDark ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'
                    }`}
                  >
                    <MathText text={ex} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODE 5: MATHEMATICAL FUNCTION & PHASE PLOTTER (Flat, Zero Double Padding) */}
        {labMode === 'plotter' && (
          <div className="space-y-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-mono font-semibold shrink-0">y(x) =</span>
                <input
                  type="text"
                  value={mathExpr}
                  onChange={(e) => setMathExpr(e.target.value)}
                  aria-label="Math Expression y(x)"
                  className={`flex-1 min-w-0 px-3 py-2 rounded-lg border font-mono text-xs outline-none ${inputClass}`}
                />
              </div>
              <div className="flex items-center gap-2 text-xs shrink-0">
                <span className={`font-mono tabular-nums ${mutedClass}`}>Range ±{xRange}</span>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={xRange}
                  onChange={(e) => setXRange(parseInt(e.target.value, 10))}
                  className="accent-black dark:accent-white cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Damped Sine', expr: 'sin(x) * exp(-0.12 * abs(x))' },
                { label: 'Gaussian Packet', expr: 'exp(-0.25 * x^2) * cos(3 * x)' },
                { label: 'Harmonic Parabola', expr: '0.2 * x^2 - 2' },
                { label: 'Sigmoid', expr: '1 / (1 + exp(-x))' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setMathExpr(item.expr)}
                  className={`px-3 py-1 rounded-lg border text-xs cursor-pointer whitespace-nowrap ${ghostBtn}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {mathExpr.trim() && (
              <div
                className={`px-3 py-2 rounded-lg border text-xs overflow-x-auto scrollbar-none ${subtleDivider} ${
                  isDark ? 'bg-white/[0.02]' : 'bg-black/[0.02]'
                }`}
                data-testid="curve-plotter-latex-preview"
              >
                <MathFormula formula={`y(x) = ${expressionToLatex(mathExpr)}`} displayMode />
              </div>
            )}

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={plotData}>
                  <CartesianGrid
                    stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(9,9,11,0.08)'}
                    strokeDasharray="3 3"
                  />
                  <XAxis dataKey="x" stroke={isDark ? '#71717a' : '#64748b'} fontSize={11} />
                  <YAxis stroke={isDark ? '#71717a' : '#64748b'} fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#18181b' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="y"
                    stroke={isDark ? '#f4f4f5' : '#09090b'}
                    strokeWidth={2.2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Unified Flat Prompt Input Bar Connected to Study Tutor */}
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
            className={`pt-4 border-t ${subtleDivider} flex items-center gap-2 min-w-0`}
            data-testid="lab-tutor-prompt-bar"
          >
            <input
              type="text"
              value={tutorDraft}
              onChange={(e) => setTutorDraft(e.target.value)}
              placeholder={
                labMode === 'physics'
                  ? `Ask Study Tutor about ${activeSimTitle}...`
                  : labMode === 'diagram'
                  ? `Ask Study Tutor about this diagram...`
                  : labMode === 'mastery'
                  ? `Ask Study Tutor about ${activeMasteryTopic}...`
                  : labMode === 'deep_solve'
                  ? `Ask Study Tutor a follow-up...`
                  : `Ask Study Tutor about y(x) = ${mathExpr}...`
              }
              className={`flex-1 min-w-0 px-3.5 py-2 rounded-lg border text-xs sm:text-sm outline-none ${inputClass}`}
            />
            <button
              type="submit"
              disabled={!tutorDraft.trim()}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${primaryBtn}`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask Tutor</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
