import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  MoreVertical,
  MousePointer,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  X,
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
  SKETCH_PRESETS,
  buildFallbackSketchLesson,
  computeProjectileTrajectoryPoints,
  detectSketchPreset,
  getPresetSketchLesson,
  type FetchedLessonImage,
  type SketchDrawCmd,
  type SketchLesson,
  type SketchPresetKey,
} from '../lib/sketchTutorEngine';
import { apiFetch } from '../lib/apiBase';
import { getAuthHeaders } from '../lib/firebase';
import { MathMarkdown, MathText, MathFormula, SvgLatex } from './MathMarkdown';
import { formatCanvasMathText } from '../lib/latexEngine';

interface StudySketchTutorProps {
  topicTitle: string;
  topicContext?: string;
  isDark?: boolean;
  onStartQuiz?: () => void;
  onBack?: () => void;
  onAskTutor?: (prompt: string, topicOverride?: string) => void;
}

interface TutorTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface StudentStroke {
  tool: 'pen' | 'highlighter';
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

const LOGICAL_W = 800;
const LOGICAL_H = 450;

function adaptBoardColor(
  rawColor: string | undefined,
  isDark: boolean,
  role: 'stroke' | 'fill' = 'stroke'
): string {
  const defaultStroke = isDark ? '#f4f4f5' : '#0f172a';
  const defaultSecondary = isDark ? '#94a3b8' : '#475569';
  const defaultFill = isDark ? 'rgba(244,244,245,0.12)' : 'rgba(15,23,42,0.07)';

  if (!rawColor || !rawColor.trim()) {
    return role === 'fill' ? defaultFill : defaultStroke;
  }

  const low = rawColor.trim().toLowerCase();

  // Strip any orange/amber tones cleanly into monochrome ink
  if (
    low.includes('fc4c01') ||
    low.includes('e04300') ||
    low.includes('f97316') ||
    low.includes('ea580c') ||
    low.includes('f59e0b') ||
    low.includes('252,76,1') ||
    low.includes('252, 76, 1')
  ) {
    return role === 'fill' ? defaultFill : defaultStroke;
  }

  if (role === 'fill' || low.startsWith('rgba')) {
    if (!isDark && (low.includes('244,244,245') || low.includes('248,250,252') || low.includes('255,255,255'))) {
      return 'rgba(15,23,42,0.08)';
    }
    return rawColor;
  }

  // Ensure crisp contrast across light & dark themes
  if (
    low === '#f4f4f5' ||
    low === '#f8fafc' ||
    low === '#ffffff' ||
    low === '#fff' ||
    low === '#e4e4e7' ||
    low === '#e2e8f0'
  ) {
    return isDark ? '#f4f4f5' : '#0f172a';
  }
  if (
    low === '#09090b' ||
    low === '#0f172a' ||
    low === '#18181b' ||
    low === '#000000' ||
    low === '#000' ||
    low === '#111113'
  ) {
    return isDark ? '#f4f4f5' : '#0f172a';
  }
  if (low === '#94a3b8' || low === '#64748b' || low === '#71717a') {
    return defaultSecondary;
  }

  return rawColor;
}

function drawCommandProgress(
  ctx: CanvasRenderingContext2D,
  cmd: SketchDrawCmd,
  progress: number,
  isDark: boolean
): { penX?: number; penY?: number } {
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return {};

  const defaultInk = isDark ? '#f4f4f5' : '#0f172a';
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (cmd.type === 'highlight') {
    ctx.fillStyle = adaptBoardColor(cmd.color, isDark, 'fill');
    ctx.fillRect(cmd.x, cmd.y, cmd.w * p, cmd.h);
    ctx.restore();
    return { penX: cmd.x + cmd.w * p, penY: cmd.y + cmd.h * 0.5 };
  }

  if (cmd.type === 'line' || cmd.type === 'arrow') {
    const cx = cmd.x1 + (cmd.x2 - cmd.x1) * p;
    const cy = cmd.y1 + (cmd.y2 - cmd.y1) * p;
    const strokeCol = adaptBoardColor(cmd.color, isDark, 'stroke');
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = cmd.width || 2.5;
    if ('dashed' in cmd && cmd.dashed) {
      ctx.setLineDash([7, 5]);
    }
    ctx.beginPath();
    ctx.moveTo(cmd.x1, cmd.y1);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    if (cmd.type === 'arrow' && p > 0.72) {
      const angle = Math.atan2(cmd.y2 - cmd.y1, cmd.x2 - cmd.x1);
      const headLen = 10;
      ctx.fillStyle = strokeCol;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - headLen * Math.cos(angle - Math.PI / 6), cy - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(cx - headLen * Math.cos(angle + Math.PI / 6), cy - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    if (cmd.type === 'arrow' && cmd.label && p > 0.55) {
      ctx.globalAlpha = Math.min(1, (p - 0.55) * 2.5);
      ctx.font = '600 13px "DM Sans", sans-serif';
      ctx.fillStyle = defaultInk;
      const mx = (cmd.x1 + cmd.x2) / 2;
      const my = (cmd.y1 + cmd.y2) / 2 - 10;
      ctx.textAlign = 'center';
      ctx.fillText(formatCanvasMathText(cmd.label), mx, my);
    }

    ctx.restore();
    return { penX: cx, penY: cy };
  }

  if (cmd.type === 'rect') {
    const perim = 2 * (cmd.w + cmd.h);
    const drawn = perim * p;
    ctx.strokeStyle = adaptBoardColor(cmd.stroke, isDark, 'stroke');
    ctx.lineWidth = 2.2;
    if (cmd.fill && p > 0.35) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (p - 0.35) * 1.5);
      ctx.fillStyle = adaptBoardColor(cmd.fill, isDark, 'fill');
      ctx.beginPath();
      ctx.roundRect(cmd.x, cmd.y, cmd.w, cmd.h, 8);
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(cmd.x, cmd.y);
    let rem = drawn;
    let penX = cmd.x;
    let penY = cmd.y;

    const top = Math.min(rem, cmd.w);
    penX = cmd.x + top;
    ctx.lineTo(penX, cmd.y);
    rem -= top;

    if (rem > 0) {
      const right = Math.min(rem, cmd.h);
      penX = cmd.x + cmd.w;
      penY = cmd.y + right;
      ctx.lineTo(penX, penY);
      rem -= right;
    }
    if (rem > 0) {
      const bot = Math.min(rem, cmd.w);
      penX = cmd.x + cmd.w - bot;
      penY = cmd.y + cmd.h;
      ctx.lineTo(penX, penY);
      rem -= bot;
    }
    if (rem > 0) {
      const left = Math.min(rem, cmd.h);
      penX = cmd.x;
      penY = cmd.y + cmd.h - left;
      ctx.lineTo(penX, penY);
    }
    ctx.stroke();

    if (cmd.label && p > 0.65) {
      ctx.globalAlpha = Math.min(1, (p - 0.65) * 3);
      ctx.font = '600 14px "DM Sans", sans-serif';
      ctx.fillStyle = defaultInk;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatCanvasMathText(cmd.label), cmd.x + cmd.w / 2, cmd.y + cmd.h / 2);
    }
    ctx.restore();
    return { penX, penY };
  }

  if (cmd.type === 'circle') {
    const startA = -Math.PI / 2;
    const endA = startA + Math.PI * 2 * p;
    if (cmd.fill && p > 0.35) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (p - 0.35) * 1.5);
      ctx.fillStyle = adaptBoardColor(cmd.fill, isDark, 'fill');
      ctx.beginPath();
      ctx.arc(cmd.cx, cmd.cy, cmd.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = adaptBoardColor(cmd.stroke, isDark, 'stroke');
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cmd.cx, cmd.cy, cmd.r, startA, endA);
    ctx.stroke();

    if (cmd.label && p > 0.65) {
      ctx.globalAlpha = Math.min(1, (p - 0.65) * 3);
      ctx.font = '600 13.5px "DM Sans", sans-serif';
      ctx.fillStyle = defaultInk;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatCanvasMathText(cmd.label), cmd.cx, cmd.cy);
    }
    ctx.restore();
    return {
      penX: cmd.cx + Math.cos(endA) * cmd.r,
      penY: cmd.cy + Math.sin(endA) * cmd.r,
    };
  }

  if (cmd.type === 'curve' && cmd.points.length >= 2) {
    const totalSegs = cmd.points.length - 1;
    const target = totalSegs * p;
    const fullSegs = Math.floor(target);
    const frac = target - fullSegs;
    const curveCol = adaptBoardColor(cmd.color, isDark, 'stroke');
    ctx.strokeStyle = curveCol;
    ctx.lineWidth = cmd.width || 3;
    ctx.beginPath();
    ctx.moveTo(cmd.points[0][0], cmd.points[0][1]);
    let penX = cmd.points[0][0];
    let penY = cmd.points[0][1];
    for (let i = 0; i < fullSegs; i++) {
      penX = cmd.points[i + 1][0];
      penY = cmd.points[i + 1][1];
      ctx.lineTo(penX, penY);
    }
    if (fullSegs < totalSegs) {
      const a = cmd.points[fullSegs];
      const b = cmd.points[fullSegs + 1];
      penX = a[0] + (b[0] - a[0]) * frac;
      penY = a[1] + (b[1] - a[1]) * frac;
      ctx.lineTo(penX, penY);
    }
    ctx.stroke();

    if (cmd.label && p > 0.7) {
      ctx.globalAlpha = Math.min(1, (p - 0.7) * 3.3);
      ctx.font = '600 13px "DM Sans", sans-serif';
      ctx.fillStyle = defaultInk;
      ctx.fillText(formatCanvasMathText(cmd.label), cmd.points[0][0], Math.max(24, cmd.points[0][1] - 14));
    }
    ctx.restore();
    return { penX, penY };
  }

  if (cmd.type === 'text') {
    const safeText = formatCanvasMathText(String(cmd.text ?? ''));
    if (!safeText) {
      ctx.restore();
      return {};
    }
    const chars = Math.max(1, Math.ceil(safeText.length * p));
    const slice = safeText.slice(0, chars);
    const fontSize = Math.max(14, cmd.size || 18);
    ctx.font = `${cmd.bold ? '700' : '500'} ${fontSize}px "Plus Jakarta Sans", "DM Sans", sans-serif`;
    ctx.fillStyle = adaptBoardColor(cmd.color, isDark, 'stroke');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const maxTextWidth = Math.max(80, LOGICAL_W - cmd.x - 16);
    ctx.fillText(slice, cmd.x, cmd.y, maxTextWidth);
    const m = ctx.measureText(slice);
    ctx.restore();
    return { penX: Math.min(LOGICAL_W - 16, cmd.x + Math.min(m.width, maxTextWidth)), penY: cmd.y - 6 };
  }

  ctx.restore();
  return {};
}

export const StudySketchTutor: React.FC<StudySketchTutorProps> = ({
  topicTitle,
  topicContext = '',
  isDark = true,
  onStartQuiz,
  onBack,
  onAskTutor,
}) => {
  const initialLesson = useMemo(() => buildFallbackSketchLesson(topicTitle), [topicTitle]);
  const [lesson, setLesson] = useState<SketchLesson>(initialLesson);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [animProgress, setAnimProgress] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playSpeed, setPlaySpeed] = useState<1 | 1.5 | 2>(1);
  const [speakEnabled, setSpeakEnabled] = useState<boolean>(false);

  const [promptInput, setPromptInput] = useState<string>('');
  const [followUpInput, setFollowUpInput] = useState<string>('');
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);
  const [loadingLesson, setLoadingLesson] = useState<boolean>(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [turns, setTurns] = useState<TutorTurn[]>([
    {
      id: 'init',
      role: 'assistant',
      text: `Ready to walk through **${initialLesson.title}**. Step through the board, draw directly on the canvas, or ask a follow-up question.`,
    },
  ]);

  const [drawTool, setDrawTool] = useState<'cursor' | 'pen' | 'highlighter' | 'eraser'>('cursor');
  const [studentStrokes, setStudentStrokes] = useState<StudentStroke[]>([]);
  const activeStrokeRef = useRef<StudentStroke | null>(null);

  const [geoA, setGeoA] = useState<number>(initialLesson.geometry?.a ?? 3);
  const [geoB, setGeoB] = useState<number>(initialLesson.geometry?.b ?? 4);
  const [projSpeed, setProjSpeed] = useState<number>(initialLesson.graph?.initialSpeed ?? 24);
  const [projAngle, setProjAngle] = useState<number>(initialLesson.graph?.launchAngle ?? 45);
  const [projGravity, setProjGravity] = useState<number>(initialLesson.graph?.gravity ?? 9.8);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Record<string, boolean>>({});
  const [wrongPairFlash, setWrongPairFlash] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [lightboxImage, setLightboxImage] = useState<FetchedLessonImage | null>(null);
  const [canvasViewport, setCanvasViewport] = useState<{ w: number; h: number }>({ w: 800, h: 450 });

  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const boardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardTransformRef = useRef<{ scale: number; offsetX: number; offsetY: number }>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const activeStep = lesson.steps[stepIdx] || lesson.steps[0];

  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasViewport({ w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setStepIdx(0);
    setAnimProgress(0);
    setIsPlaying(true);
    setMatchedIds({});
    setSelectedSourceId(null);
    setBrokenImages({});
    if (lesson.geometry) {
      setGeoA(lesson.geometry.a || 3);
      setGeoB(lesson.geometry.b || 4);
    }
    if (lesson.graph) {
      setProjSpeed(lesson.graph.initialSpeed ?? 24);
      setProjAngle(lesson.graph.launchAngle ?? 45);
      setProjGravity(lesson.graph.gravity ?? 9.8);
    }
  }, [lesson]);

  useEffect(() => {
    if (!isPlaying) return;
    if (animProgress >= 1) return;
    let rafId = 0;
    let lastTs = performance.now();
    const stepDurationMs = 1750 / playSpeed;

    const tick = (now: number) => {
      const dt = now - lastTs;
      lastTs = now;
      setAnimProgress((prev) => {
        const next = Math.min(1, prev + dt / stepDurationMs);
        if (next >= 1) return 1;
        rafId = requestAnimationFrame(tick);
        return next;
      });
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, stepIdx, animProgress, playSpeed]);

  useEffect(() => {
    if (!speakEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!activeStep) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(`${activeStep.title}. ${activeStep.explanation}`);
      utter.rate = playSpeed === 2 ? 1.25 : playSpeed === 1.5 ? 1.12 : 1.0;
      window.speechSynthesis.speak(utter);
    } catch {}
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    };
  }, [speakEnabled, stepIdx, activeStep, playSpeed]);

  useEffect(() => {
    const canvas = boardCanvasRef.current;
    if (!canvas || !activeStep) return;
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const cssW = Math.max(240, canvas.clientWidth || canvasViewport.w || LOGICAL_W);
    const cssH = Math.max(180, canvas.clientHeight || canvasViewport.h || LOGICAL_H);
    const targetW = Math.floor(cssW * dpr);
    const targetH = Math.floor(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Uniform aspect-preserving fit so diagrams & text never stretch on mobile or ultrawide screens
    const scale = Math.min(cssW / LOGICAL_W, cssH / LOGICAL_H);
    const offsetX = (cssW - LOGICAL_W * scale) / 2;
    const offsetY = (cssH - LOGICAL_H * scale) / 2;
    boardTransformRef.current = { scale, offsetX, offsetY };

    ctx.save();
    ctx.scale(dpr, dpr);

    // Full-viewport clean board surface & subtle uniform grid
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.032)' : 'rgba(15,23,42,0.04)';
    ctx.lineWidth = 1;
    const gridStep = Math.max(24, Math.round(40 * scale));
    for (let x = offsetX % gridStep; x < cssW; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }
    for (let y = offsetY % gridStep; y < cssH; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    }

    // Enter uniform logical 800x450 coordinate space
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const cmds = activeStep.drawCommands || [];
    const total = Math.max(1, cmds.length);
    let penPos: { penX?: number; penY?: number } = {};
    for (let i = 0; i < cmds.length; i++) {
      const cmdStart = i / total;
      const cmdSpan = 1 / total;
      const localP = Math.min(1, Math.max(0, (animProgress - cmdStart) / cmdSpan));
      if (localP > 0) {
        const res = drawCommandProgress(ctx, cmds[i], localP, isDark);
        if (localP < 1 && res.penX !== undefined && res.penY !== undefined) {
          penPos = res;
        }
      }
    }

    if (animProgress > 0 && animProgress < 1 && penPos.penX !== undefined && penPos.penY !== undefined) {
      ctx.fillStyle = isDark ? '#ffffff' : '#09090b';
      ctx.beginPath();
      ctx.arc(penPos.penX, penPos.penY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(9,9,11,0.22)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    for (const s of studentStrokes) {
      if (s.points.length < 2) continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = adaptBoardColor(s.color, isDark, s.tool === 'highlighter' ? 'fill' : 'stroke');
      ctx.lineWidth = s.width;
      ctx.globalAlpha = s.tool === 'highlighter' ? 0.3 : 0.95;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let k = 1; k < s.points.length; k++) {
        ctx.lineTo(s.points[k].x, s.points[k].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [activeStep, animProgress, isDark, studentStrokes, canvasViewport]);

  const toLogicalCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { scale, offsetX, offsetY } = boardTransformRef.current;
    const safeScale = Math.max(0.05, scale);
    return {
      x: (e.clientX - rect.left - offsetX) / safeScale,
      y: (e.clientY - rect.top - offsetY) / safeScale,
    };
  };

  const handleBoardPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawTool === 'cursor') return;
    const pt = toLogicalCoords(e);
    if (drawTool === 'eraser') {
      setStudentStrokes((prev) =>
        prev.filter((s) => !s.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 18))
      );
      return;
    }
    const newStroke: StudentStroke = {
      tool: drawTool,
      color:
        drawTool === 'highlighter'
          ? 'rgba(113,113,122,0.38)'
          : isDark
          ? '#f4f4f5'
          : '#09090b',
      width: drawTool === 'highlighter' ? 16 : 3,
      points: [pt],
    };
    activeStrokeRef.current = newStroke;
    setStudentStrokes((prev) => [...prev, newStroke]);
  };

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawTool === 'eraser' && e.buttons === 1) {
      const pt = toLogicalCoords(e);
      setStudentStrokes((prev) =>
        prev.filter((s) => !s.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 18))
      );
      return;
    }
    if (!activeStrokeRef.current) return;
    const pt = toLogicalCoords(e);
    activeStrokeRef.current.points.push(pt);
    setStudentStrokes((prev) => [...prev.slice(0, -1), { ...activeStrokeRef.current! }]);
  };

  const handleBoardPointerUp = () => {
    activeStrokeRef.current = null;
  };

  const handleUndoStroke = useCallback(() => {
    setStudentStrokes((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  const handleExportBoardPng = useCallback(() => {
    const canvas = boardCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const slug = (lesson.title || 'whiteboard')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${slug || 'whiteboard'}-step-${stepIdx + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {}
  }, [lesson.title, stepIdx]);

  const loadPreset = useCallback(async (key: SketchPresetKey) => {
    const presetLesson = getPresetSketchLesson(key);
    setLesson(presetLesson);
    setLessonError(null);
    setStudentStrokes([]);
    setTurns([
      {
        id: `preset_${key}_${Date.now()}`,
        role: 'assistant',
        text: `Loaded **${presetLesson.title}**. Step through the board or ask a follow-up question anytime.`,
      },
    ]);

    if (presetLesson.imageQuery) {
      try {
        const res = await apiFetch(
          `/api/media/more-images?q=${encodeURIComponent(presetLesson.imageQuery)}&limit=4`
        );
        if (res.ok) {
          const data = await res.json();
          const imgs: FetchedLessonImage[] = Array.isArray(data?.images) ? data.images : [];
          if (imgs.length > 0) {
            setLesson((curr) =>
              curr.id === presetLesson.id ? { ...curr, images: imgs.slice(0, 4) } : curr
            );
          }
        }
      } catch {}
    }
  }, []);

  const requestVisualLesson = async (
    queryText: string,
    opts?: { isFollowUp?: boolean; withSketchNote?: boolean }
  ) => {
    const q = queryText.trim();
    if (!q || loadingLesson) return;

    const presetHit = !opts?.isFollowUp ? detectSketchPreset(q) : null;
    if (presetHit && !opts?.withSketchNote) {
      await loadPreset(presetHit);
      setPromptInput('');
      return;
    }

    setLessonError(null);
    setLoadingLesson(true);
    const userTurn: TutorTurn = { id: `u_${Date.now()}`, role: 'user', text: q };

    if (opts?.isFollowUp) {
      setTurns((prev) => [...prev, userTurn]);
      setFollowUpInput('');
    } else {
      setStudentStrokes([]);
      setTurns([userTurn]);
      setPromptInput('');
    }

    try {
      const authHeaders = await getAuthHeaders();
      const sketchSummary = opts?.withSketchNote
        ? `Student drew ${studentStrokes.length} freehand annotations on step "${activeStep?.title}" at board areas covering (${studentStrokes
            .slice(0, 3)
            .map((s) => {
              const p0 = s.points[0];
              return p0 ? `${Math.round(p0.x)},${Math.round(p0.y)}` : '';
            })
            .filter(Boolean)
            .join('; ')}).`
        : undefined;

      const res = await apiFetch('/api/study/sketch-lesson', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          prompt: q,
          topic: opts?.isFollowUp ? lesson.title : q,
          history: opts?.isFollowUp ? turns.slice(-5).map((t) => ({ role: t.role, content: t.text })) : [],
          sketchNote: sketchSummary,
          includeImages: true,
        }),
      });
      const data = await res.json();
      if (data?.ok && data?.lesson) {
        const rawLesson = data.lesson as SketchLesson;
        const normalizedPairs = Array.isArray(rawLesson.vocabPairs)
          ? rawLesson.vocabPairs
              .map((p: any, idx: number) => {
                if (!p || typeof p !== 'object') return null;
                const source = String(p.source ?? p.term ?? p.word ?? p.front ?? p.question ?? '').trim();
                const target = String(p.target ?? p.translation ?? p.meaning ?? p.definition ?? p.back ?? p.answer ?? '').trim();
                if (!source || !target) return null;
                return {
                  id: String(p.id || `vp_${idx + 1}`),
                  source,
                  target,
                  phonetic: typeof p.phonetic === 'string' && p.phonetic.trim() ? p.phonetic.trim() : undefined,
                  example: typeof p.example === 'string' && p.example.trim() ? p.example.trim() : undefined,
                };
              })
              .filter((p): p is NonNullable<typeof p> => Boolean(p))
          : undefined;
        const nextLesson: SketchLesson = {
          ...rawLesson,
          steps: Array.isArray(rawLesson.steps) && rawLesson.steps.length > 0 ? rawLesson.steps : buildFallbackSketchLesson(q).steps,
          vocabPairs: normalizedPairs && normalizedPairs.length > 0 ? normalizedPairs : undefined,
        };
        if (opts?.isFollowUp) {
          if (!nextLesson.geometry && lesson.geometry) nextLesson.geometry = lesson.geometry;
          if (!nextLesson.graph && lesson.graph) nextLesson.graph = lesson.graph;
          if (!nextLesson.vocabPairs && lesson.vocabPairs) nextLesson.vocabPairs = lesson.vocabPairs;
          if ((!nextLesson.images || nextLesson.images.length === 0) && lesson.images) {
            nextLesson.images = lesson.images;
          }
        }
        setLesson(nextLesson);
        const assistantTurn: TutorTurn = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: nextLesson.summary,
        };
        setTurns((prev) => (opts?.isFollowUp ? [...prev, assistantTurn] : [userTurn, assistantTurn]));
      } else {
        const fallback = buildFallbackSketchLesson(q);
        setLesson(fallback);
        const assistantTurn: TutorTurn = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: fallback.summary,
        };
        setTurns((prev) => (opts?.isFollowUp ? [...prev, assistantTurn] : [userTurn, assistantTurn]));
      }
    } catch {
      const fallback = buildFallbackSketchLesson(q);
      setLesson(fallback);
      const assistantTurn: TutorTurn = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: fallback.summary,
      };
      setTurns((prev) => (opts?.isFollowUp ? [...prev, assistantTurn] : [userTurn, assistantTurn]));
      setLessonError('Loaded structured visual board.');
    } finally {
      setLoadingLesson(false);
    }
  };

  useEffect(() => {
    if (initialLesson.imageQuery && (!initialLesson.images || initialLesson.images.length === 0)) {
      apiFetch(`/api/media/more-images?q=${encodeURIComponent(initialLesson.imageQuery)}&limit=4`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.images?.length) {
            setLesson((curr) => ({ ...curr, images: data.images.slice(0, 4) }));
          }
        })
        .catch(() => {});
    }
  }, [initialLesson]);

  const safeVocabPairs = useMemo(() => {
    if (!Array.isArray(lesson.vocabPairs)) return [];
    return lesson.vocabPairs
      .map((p: any, idx: number) => {
        if (!p || typeof p !== 'object') return null;
        const source = String(p.source ?? p.term ?? p.word ?? p.front ?? '').trim();
        const target = String(p.target ?? p.translation ?? p.meaning ?? p.definition ?? p.back ?? '').trim();
        if (!source || !target) return null;
        return {
          id: String(p.id || `vp_${idx + 1}`),
          source,
          target,
          phonetic: typeof p.phonetic === 'string' ? p.phonetic : undefined,
          example: typeof p.example === 'string' ? p.example : undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [lesson.vocabPairs]);

  const shuffledTargets = useMemo(() => {
    const arr = [...safeVocabPairs];
    return arr.sort((a, b) => String(a.target || '').localeCompare(String(b.target || '')));
  }, [safeVocabPairs]);

  const handleMatchTarget = (targetPairId: string) => {
    if (!selectedSourceId) return;
    if (selectedSourceId === targetPairId) {
      setMatchedIds((prev) => ({ ...prev, [targetPairId]: true }));
      setSelectedSourceId(null);
    } else {
      setWrongPairFlash(targetPairId);
      setTimeout(() => setWrongPairFlash(null), 500);
    }
  };

  const speakPhrase = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (/romanian/i.test(lesson.title)) u.lang = 'ro-RO';
      window.speechSynthesis.speak(u);
    } catch {}
  };

  const pageBg = isDark ? 'bg-[#09090b] text-neutral-100' : 'bg-[#ffffff] text-neutral-900';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const subtleDivider = isDark ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const primaryBtn = isDark
    ? 'bg-white text-black hover:bg-neutral-200'
    : 'bg-black text-white hover:bg-neutral-800';
  const ghostBtn = isDark
    ? 'border-white/12 text-neutral-300 hover:bg-white/[0.06] hover:text-white'
    : 'border-black/12 text-neutral-700 hover:bg-black/[0.05] hover:text-black';

  const geoC = Number(Math.hypot(geoA, geoB).toFixed(2));
  const projectilePoints = useMemo(
    () => computeProjectileTrajectoryPoints(projSpeed, projAngle, projGravity),
    [projSpeed, projAngle, projGravity]
  );

  const activePresetKey = SKETCH_PRESETS.find((p) => lesson.id === `preset_${p.key}`)?.key || '';
  const composerSurface = isDark
    ? 'bg-[#121216] border-white/[0.12] focus-within:border-white/30 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
    : 'bg-white border-black/[0.12] focus-within:border-black/30 shadow-[0_8px_28px_rgba(0,0,0,0.06)]';
  const stageSurface = isDark
    ? 'bg-[#101013] border-white/[0.09]'
    : 'bg-[#fafafa] border-black/[0.09]';

  return (
    <div className={`w-full min-h-full flex flex-col max-w-full overflow-x-hidden ${pageBg}`}>
      {/* Clean Top Bar */}
      <header className={`h-14 px-4 sm:px-6 border-b ${subtleDivider} flex items-center justify-between gap-3 shrink-0`}>
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              data-testid="sketch-back-btn"
              className={`h-9 px-3 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${ghostBtn}`}
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Back</span>
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">
              {lesson.title || 'Visual Whiteboard'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Clean Lesson Preset Selector */}
          <div className="relative">
            <select
              aria-label="Choose visual lesson preset"
              value={activePresetKey}
              onChange={(e) => {
                const key = e.target.value as SketchPresetKey;
                if (key) void loadPreset(key);
              }}
              className={`h-9 pl-3 pr-8 rounded-xl border text-[13px] font-medium appearance-none outline-none cursor-pointer transition-colors max-w-[165px] sm:max-w-[220px] ${
                isDark
                  ? 'bg-[#141418] border-white/[0.12] text-neutral-200 hover:border-white/25'
                  : 'bg-white border-black/[0.12] text-neutral-800 hover:border-black/25'
              }`}
            >
              <option value="" disabled>
                Example lessons
              </option>
              {SKETCH_PRESETS.map((p) => (
                <option key={p.key} value={p.key} className={isDark ? 'bg-[#141418] text-white' : 'bg-white text-black'}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className={`w-4 h-4 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${muted}`} />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen((v) => !v)}
              aria-label="Whiteboard options"
              data-testid="sketch-more-menu-btn"
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
                      onAskTutor(
                        `Walk me step-by-step through "${lesson.title}" (${lesson.subject}). Current step: ${activeStep?.title || ''} — ${activeStep?.explanation || lesson.summary}`,
                        lesson.title
                      );
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

      {/* Main Content Container */}
      <div className="w-full max-w-[1380px] mx-auto px-4 sm:px-6 py-5 space-y-6 pb-20">
        {/* Dominant Flagship Whiteboard Stage */}
        <section className={`rounded-2xl border overflow-hidden flex flex-col ${stageSurface}`}>
          {/* Clean Stage Toolbar */}
          <div className={`px-4 py-2.5 border-b ${subtleDivider} flex flex-wrap items-center justify-between gap-3`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (animProgress >= 1) {
                    setAnimProgress(0);
                    setIsPlaying(true);
                  } else {
                    setIsPlaying((p) => !p);
                  }
                }}
                className={`h-8 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${primaryBtn}`}
              >
                {isPlaying && animProgress < 1 ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{animProgress >= 1 ? 'Replay' : isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <div className={`inline-flex items-center rounded-xl border p-0.5 ${subtleDivider}`}>
                <button
                  type="button"
                  disabled={stepIdx <= 0}
                  onClick={() => {
                    setStepIdx((i) => Math.max(0, i - 1));
                    setAnimProgress(0);
                    setIsPlaying(true);
                  }}
                  className="size-7 rounded-lg inline-flex items-center justify-center disabled:opacity-30 hover:bg-current/5 cursor-pointer transition-colors"
                  aria-label="Previous step"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <span className={`px-2.5 text-xs font-mono tabular-nums ${muted}`}>
                  {stepIdx + 1} / {lesson.steps.length}
                </span>
                <button
                  type="button"
                  disabled={stepIdx >= lesson.steps.length - 1}
                  onClick={() => {
                    setStepIdx((i) => Math.min(lesson.steps.length - 1, i + 1));
                    setAnimProgress(0);
                    setIsPlaying(true);
                  }}
                  className="size-7 rounded-lg inline-flex items-center justify-center disabled:opacity-30 hover:bg-current/5 cursor-pointer transition-colors"
                  aria-label="Next step"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPlaySpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))}
                className={`h-8 px-2.5 rounded-xl border text-xs font-mono tabular-nums cursor-pointer transition-colors ${ghostBtn}`}
              >
                {playSpeed}x
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className={`inline-flex items-center gap-0.5 p-0.5 rounded-xl border ${subtleDivider}`}>
                {(['cursor', 'pen', 'highlighter', 'eraser'] as const).map((tool) => {
                  const active = drawTool === tool;
                  const Icon =
                    tool === 'cursor'
                      ? MousePointer
                      : tool === 'pen'
                      ? Pencil
                      : tool === 'highlighter'
                      ? Highlighter
                      : Eraser;
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => setDrawTool(tool)}
                      title={`Tool: ${tool}`}
                      aria-label={`Tool: ${tool}`}
                      className={`size-7 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors ${
                        active
                          ? isDark
                            ? 'bg-white text-black'
                            : 'bg-black text-white'
                          : muted
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>

              {studentStrokes.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleUndoStroke}
                    title="Undo last stroke"
                    aria-label="Undo last stroke"
                    className={`size-8 rounded-xl border inline-flex items-center justify-center cursor-pointer ${ghostBtn}`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentStrokes([])}
                    title="Clear annotations"
                    aria-label="Clear annotations"
                    className={`size-8 rounded-xl border inline-flex items-center justify-center cursor-pointer ${ghostBtn}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void requestVisualLesson('Check my annotation on the whiteboard and guide the next step', {
                        isFollowUp: true,
                        withSketchNote: true,
                      })
                    }
                    className={`h-8 px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${primaryBtn}`}
                  >
                    Check Sketch
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleExportBoardPng}
                title="Save whiteboard snapshot (PNG)"
                aria-label="Save whiteboard snapshot"
                className={`size-8 rounded-xl border inline-flex items-center justify-center cursor-pointer transition-colors ${ghostBtn}`}
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setSpeakEnabled((s) => !s)}
                title={speakEnabled ? 'Mute narration' : 'Read step aloud'}
                aria-label={speakEnabled ? 'Mute narration' : 'Read step aloud'}
                className={`size-8 rounded-xl border inline-flex items-center justify-center cursor-pointer transition-colors ${
                  speakEnabled
                    ? isDark
                      ? 'bg-white text-black border-white'
                      : 'bg-black text-white border-black'
                    : ghostBtn
                }`}
              >
                {speakEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Large Aspect-Preserving Interactive Drawing Canvas */}
          <div ref={boardWrapRef} className="relative w-full h-[270px] sm:h-[440px] lg:h-[580px]">
            <canvas
              ref={boardCanvasRef}
              onPointerDown={handleBoardPointerDown}
              onPointerMove={handleBoardPointerMove}
              onPointerUp={handleBoardPointerUp}
              onPointerLeave={handleBoardPointerUp}
              className={`w-full h-full block touch-none ${
                drawTool === 'cursor' ? 'cursor-default' : 'cursor-crosshair'
              }`}
            />
          </div>

          {/* Interactive Step Progress Rail (Zero Horizontal Scrollbar) */}
          <div className={`px-4 sm:px-5 py-3.5 border-t ${subtleDivider} space-y-2.5`}>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, lesson.steps.length)}, minmax(0, 1fr))` }}>
              {lesson.steps.map((s, idx) => {
                const isCurrent = idx === stepIdx;
                const isPast = idx < stepIdx;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStepIdx(idx);
                      setAnimProgress(0);
                      setIsPlaying(true);
                    }}
                    title={`Step ${idx + 1}: ${s.title}`}
                    aria-label={`Go to step ${idx + 1}`}
                    className="group py-1.5 cursor-pointer flex items-center"
                  >
                    <span
                      className={`h-1.5 w-full rounded-full transition-colors ${
                        isCurrent
                          ? isDark
                            ? 'bg-white'
                            : 'bg-black'
                          : isPast
                          ? isDark
                            ? 'bg-white/40 group-hover:bg-white/60'
                            : 'bg-black/35 group-hover:bg-black/55'
                          : isDark
                          ? 'bg-white/12 group-hover:bg-white/25'
                          : 'bg-black/12 group-hover:bg-black/25'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[15px] sm:text-base font-semibold tracking-tight min-w-0">
                <span className={`font-mono tabular-nums mr-2 text-[13px] ${muted}`}>
                  {String(stepIdx + 1).padStart(2, '0')}.
                </span>
                <MathText text={activeStep?.title || lesson.title} />
              </div>
              {activeStep?.keyFormula && (
                <div className="text-[13px] sm:text-sm font-semibold shrink-0">
                  <MathFormula formula={activeStep.keyFormula} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Signature Modern Prompt Composer (Generate New Board) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void requestVisualLesson(promptInput);
          }}
          className={`rounded-2xl border p-2 pl-4 flex items-center gap-2.5 transition-all ${composerSurface}`}
        >
          <Pencil className={`w-4 h-4 shrink-0 ${muted}`} />
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="Teach any topic visually..."
            className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={loadingLesson || !promptInput.trim()}
            aria-label="Generate visual lesson"
            className={`size-9 rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-35 transition-colors ${primaryBtn}`}
          >
            {loadingLesson ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </form>

        {lessonError && (
          <div className={`text-[13px] ${muted}`}>{lessonError}</div>
        )}

        {/* Step Explanation & Highlights */}
        {activeStep && (
          <div className="space-y-3 max-w-4xl">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[13px] font-medium ${muted}`}>
                {lesson.subject} · Step {stepIdx + 1} of {lesson.steps.length}
              </span>
              {onStartQuiz && (
                <button
                  type="button"
                  onClick={onStartQuiz}
                  className={`text-[13px] font-medium hover:underline cursor-pointer ${muted}`}
                >
                  Practice Quiz →
                </button>
              )}
            </div>

            <div className={`text-sm sm:text-[15px] leading-7 ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
              <MathMarkdown content={activeStep.explanation} isDark={isDark} autoDetectLatex />
            </div>

            {activeStep.highlights && activeStep.highlights.length > 0 && (
              <ul className="space-y-2 text-sm sm:text-[15px] leading-relaxed pt-1">
                {activeStep.highlights.map((h, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className={muted}>·</span>
                    <span><MathText text={h} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {lesson.geometry && (
          <div className={`pt-6 border-t space-y-4 ${subtleDivider}`} data-testid="sketch-geometry-widget">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight">{lesson.geometry.title}</h3>
              <span className="text-sm font-semibold">
                <MathFormula
                  formula={`${geoA}^2 + ${geoB}^2 = ${(geoA * geoA + geoB * geoB).toFixed(1)} \\implies c = ${geoC}\\,\\text{${lesson.geometry.unit}}`}
                />
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5 space-y-4">
                <label className="block space-y-1.5 text-[13px]">
                  <div className="flex justify-between font-mono tabular-nums">
                    <span>Leg a (Vertical)</span>
                    <span className="font-semibold">{geoA} {lesson.geometry.unit}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={0.5}
                    value={geoA}
                    onChange={(e) => setGeoA(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full accent-black dark:accent-white cursor-pointer"
                  />
                </label>
                <label className="block space-y-1.5 text-[13px]">
                  <div className="flex justify-between font-mono tabular-nums">
                    <span>Leg b (Horizontal)</span>
                    <span className="font-semibold">{geoB} {lesson.geometry.unit}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={0.5}
                    value={geoB}
                    onChange={(e) => setGeoB(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full accent-black dark:accent-white cursor-pointer"
                  />
                </label>
                <div className={`grid grid-cols-3 gap-2 pt-2 text-[13px] font-mono tabular-nums ${muted}`}>
                  <div>a² = {(geoA * geoA).toFixed(1)}</div>
                  <div>b² = {(geoB * geoB).toFixed(1)}</div>
                  <div className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                    c² = {(geoA * geoA + geoB * geoB).toFixed(1)}
                  </div>
                </div>
              </div>

              <div className={`lg:col-span-7 rounded-2xl border p-4 ${stageSurface}`}>
                <svg viewBox="0 0 360 240" className="w-full h-60 sm:h-64" role="img" aria-label="Dynamic right triangle">
                  {(() => {
                    const scale = 148 / Math.max(geoA, geoB, 5);
                    const px = 84;
                    const py = 192;
                    const w = Math.max(24, geoB * scale);
                    const h = Math.max(24, geoA * scale);
                    const inkCol = isDark ? '#f4f4f5' : '#0f172a';
                    const secCol = isDark ? '#94a3b8' : '#475569';
                    const hypX = Math.min(200, px + w / 2 + 10);
                    const hypY = Math.max(16, Math.min(py - 44, py - h / 2 - 22));
                    return (
                      <>
                        <polygon
                          points={`${px},${py - h} ${px},${py} ${px + w},${py}`}
                          fill={isDark ? 'rgba(244,244,245,0.1)' : 'rgba(15,23,42,0.06)'}
                          stroke={inkCol}
                          strokeWidth="2.4"
                          strokeLinejoin="round"
                        />
                        <rect x={px} y={py - 14} width={14} height={14} fill="none" stroke={secCol} strokeWidth="1.5" />
                        <foreignObject x={6} y={Math.max(10, py - h / 2 - 14)} width={70} height={30}>
                          <div
                            style={{ textAlign: 'right', color: secCol, fontSize: '13px', fontWeight: 700 }}
                          >
                            <SvgLatex text={`$a = ${geoA}$`} />
                          </div>
                        </foreignObject>
                        <foreignObject x={Math.max(40, px + w / 2 - 42)} y={py + 8} width={88} height={30}>
                          <div
                            style={{ textAlign: 'center', color: secCol, fontSize: '13px', fontWeight: 700 }}
                          >
                            <SvgLatex text={`$b = ${geoB}$`} />
                          </div>
                        </foreignObject>
                        <foreignObject x={hypX} y={hypY} width={152} height={34}>
                          <div
                            style={{ color: inkCol, fontSize: '13px', fontWeight: 700 }}
                          >
                            <SvgLatex text={`$c = ${geoC}$`} />
                          </div>
                        </foreignObject>
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          </div>
        )}

        {lesson.graph && (
          <div className={`pt-6 border-t space-y-4 ${subtleDivider}`} data-testid="sketch-graph-widget">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold tracking-tight">{lesson.graph.title}</h3>
                <p className={`text-[13px] ${muted}`}>
                  <MathFormula formula={lesson.graph.formula} />
                </p>
              </div>
              <span className="text-[13px] font-mono tabular-nums font-semibold">
                Range {(projectilePoints[projectilePoints.length - 1]?.x || 0).toFixed(1)} m · Peak{' '}
                {Math.max(...projectilePoints.map((p) => p.y)).toFixed(1)} m
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
              <label className="space-y-1.5">
                <div className="flex justify-between font-mono tabular-nums">
                  <span>Speed v₀</span>
                  <span className="font-semibold">{projSpeed} m/s</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={45}
                  step={1}
                  value={projSpeed}
                  onChange={(e) => setProjSpeed(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full accent-black dark:accent-white cursor-pointer"
                />
              </label>
              <label className="space-y-1.5">
                <div className="flex justify-between font-mono tabular-nums">
                  <span>Angle θ</span>
                  <span className="font-semibold">{projAngle}°</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={1}
                  value={projAngle}
                  onChange={(e) => setProjAngle(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full accent-black dark:accent-white cursor-pointer"
                />
              </label>
              <label className="space-y-1.5">
                <div className="flex justify-between font-mono tabular-nums">
                  <span>Gravity g</span>
                  <span className="font-semibold">{projGravity} m/s²</span>
                </div>
                <input
                  type="range"
                  min={1.6}
                  max={24}
                  step={0.2}
                  value={projGravity}
                  onChange={(e) => setProjGravity(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full accent-black dark:accent-white cursor-pointer"
                />
              </label>
            </div>

            <div className={`rounded-2xl border p-4 ${stageSurface}`}>
              <div className="h-72 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projectilePoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
                    <XAxis dataKey="x" stroke="#71717a" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 12 }} />
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
                      stroke={isDark ? '#f4f4f5' : '#09090b'}
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {safeVocabPairs.length > 0 && (
          <div className={`pt-6 border-t space-y-3.5 ${subtleDivider}`} data-testid="sketch-vocab-widget">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Vocabulary Matching</h3>
                <p className={`text-[13px] ${muted}`}>
                  Pair each term with its translation.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-mono tabular-nums font-semibold">
                  {Object.keys(matchedIds).length}/{safeVocabPairs.length} Matched
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMatchedIds({});
                    setSelectedSourceId(null);
                  }}
                  className={`size-9 rounded-xl border inline-flex items-center justify-center cursor-pointer ${ghostBtn}`}
                  title="Reset matching drill"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2.5">
                {safeVocabPairs.map((pair) => {
                  const matched = Boolean(matchedIds[pair.id]);
                  const selected = selectedSourceId === pair.id;
                  return (
                    <div
                      key={pair.id}
                      className={`flex items-center justify-between gap-2 p-3.5 rounded-xl border text-sm transition-colors ${
                        matched
                          ? isDark
                            ? 'border-white/25 bg-white/[0.08] text-white'
                            : 'border-black/25 bg-black/[0.06] text-black'
                          : selected
                          ? isDark
                            ? 'border-white bg-white/15'
                            : 'border-black bg-black/10'
                          : isDark
                          ? 'border-white/10 hover:border-white/25'
                          : 'border-black/10 hover:border-black/25'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={matched}
                        onClick={() => setSelectedSourceId(pair.id)}
                        className="flex-1 text-left cursor-pointer disabled:cursor-default"
                      >
                        <div className="font-semibold">{pair.source}</div>
                        {pair.phonetic && <div className={`text-xs font-mono mt-0.5 ${muted}`}>{pair.phonetic}</div>}
                      </button>
                      <button
                        type="button"
                        onClick={() => speakPhrase(pair.source)}
                        className={`p-1.5 rounded-lg cursor-pointer ${muted} hover:opacity-100`}
                        title={`Pronounce ${pair.source}`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2.5">
                {shuffledTargets.map((pair) => {
                  const matched = Boolean(matchedIds[pair.id]);
                  const isWrong = wrongPairFlash === pair.id;
                  return (
                    <button
                      key={`t_${pair.id}`}
                      type="button"
                      disabled={matched}
                      onClick={() => handleMatchTarget(pair.id)}
                      className={`w-full p-3.5 rounded-xl border text-left text-sm transition-colors flex items-center justify-between cursor-pointer disabled:cursor-default ${
                        matched
                          ? isDark
                            ? 'border-white/25 bg-white/[0.08] text-white font-semibold'
                            : 'border-black/25 bg-black/[0.06] text-black font-semibold'
                          : isWrong
                          ? 'border-red-500/60 bg-red-500/10 text-red-500'
                          : isDark
                          ? 'border-white/10 hover:border-white/25'
                          : 'border-black/10 hover:border-black/25'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{pair.target}</div>
                        {matched && pair.example && (
                          <div className={`text-xs font-normal mt-0.5 ${muted}`}>{pair.example}</div>
                        )}
                      </div>
                      {matched && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {lesson.images && lesson.images.length > 0 && (
          <div className={`pt-6 border-t space-y-3.5 ${subtleDivider}`} data-testid="sketch-images-widget">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight">Reference Diagrams</h3>
              <span className={`text-[13px] ${muted}`}>{lesson.images.length} visual references</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {lesson.images.map((img, i) => {
                const key = `${img.imageUrl}_${i}`;
                const failed = Boolean(brokenImages[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => !failed && setLightboxImage(img)}
                    className={`group rounded-2xl border overflow-hidden flex flex-col text-left transition-all cursor-pointer ${subtleDivider} ${
                      isDark
                        ? 'bg-[#121216] hover:border-white/25'
                        : 'bg-white hover:border-black/25 shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
                    }`}
                  >
                    <div
                      className={`aspect-[16/10] w-full p-2.5 overflow-hidden flex items-center justify-center ${
                        isDark ? 'bg-white/[0.96]' : 'bg-[#f8f8f9]'
                      }`}
                    >
                      {!failed ? (
                        <img
                          src={img.thumbnailUrl || img.imageUrl}
                          alt={img.title}
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenImages((prev) => ({ ...prev, [key]: true }))}
                          className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className={`flex flex-col items-center justify-center p-3 text-center gap-1.5 ${muted}`}>
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-xs line-clamp-2">{img.title}</span>
                        </div>
                      )}
                    </div>
                    <div className={`px-3.5 py-2.5 border-t ${subtleDivider}`}>
                      <p className="text-[13px] leading-snug font-medium line-clamp-2">
                        {img.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Follow-Up Conversation & Elevated Composer */}
        <div className={`pt-6 border-t space-y-4 ${subtleDivider}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold tracking-tight">Continue Exploring</h3>
            {onAskTutor && (
              <button
                type="button"
                onClick={() =>
                  onAskTutor(
                    `Explain "${lesson.title}" in depth (${activeStep?.title || ''}). ${activeStep?.explanation || lesson.summary}`,
                    lesson.title
                  )
                }
                className={`text-[13px] font-medium hover:underline inline-flex items-center gap-1 cursor-pointer ${muted}`}
              >
                <span>Open in Study Tutor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {turns.length > 0 && (
            <div className={`divide-y ${isDark ? 'divide-white/[0.08]' : 'divide-black/[0.08]'}`}>
              {turns.map((t) => (
                <div key={t.id} className="py-3.5 text-sm sm:text-[15px] leading-relaxed space-y-1.5">
                  <div className={`text-xs font-semibold tracking-tight ${t.role === 'user' ? muted : ''}`}>
                    {t.role === 'user' ? 'You' : 'Whiteboard Tutor'}
                  </div>
                  <MathMarkdown content={t.text} isDark={isDark} autoDetectLatex />
                </div>
              ))}
            </div>
          )}

          {lesson.followUpSuggestions && lesson.followUpSuggestions.length > 0 && (
            <div className={`divide-y border-t border-b ${isDark ? 'divide-white/[0.07]' : 'divide-black/[0.07]'} ${subtleDivider}`}>
              {lesson.followUpSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loadingLesson}
                  onClick={() => void requestVisualLesson(s, { isFollowUp: true })}
                  className="w-full py-3 px-1 text-left text-sm sm:text-[15px] flex items-center justify-between gap-3 hover:opacity-75 transition-opacity cursor-pointer disabled:opacity-40"
                >
                  <span className="min-w-0 leading-snug"><MathText text={s} /></span>
                  <ArrowRight className={`w-4 h-4 shrink-0 ${muted}`} />
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void requestVisualLesson(followUpInput, { isFollowUp: true });
            }}
            className={`rounded-2xl border p-2 pl-4 flex items-center gap-2.5 transition-all ${composerSurface}`}
          >
            <input
              type="text"
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              placeholder="Ask a follow-up or redraw..."
              className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
            <button
              type="submit"
              disabled={loadingLesson || !followUpInput.trim()}
              className={`size-9 rounded-full inline-flex items-center justify-center disabled:opacity-35 cursor-pointer shrink-0 transition-colors ${primaryBtn}`}
              aria-label="Send follow-up"
            >
              {loadingLesson ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>

      {/* Reference Diagram Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.title}
        >
          <div
            className={`w-full max-w-3xl rounded-2xl border overflow-hidden shadow-2xl ${
              isDark ? 'bg-[#121216] border-white/15 text-white' : 'bg-white border-black/15 text-black'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-4 py-3 border-b ${subtleDivider} flex items-center justify-between gap-3`}>
              <p className="text-sm font-semibold truncate">{lightboxImage.title}</p>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                aria-label="Close diagram preview"
                className={`size-8 rounded-lg border inline-flex items-center justify-center cursor-pointer shrink-0 ${ghostBtn}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-white flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={lightboxImage.imageUrl || lightboxImage.thumbnailUrl}
                alt={lightboxImage.title}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[68vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
