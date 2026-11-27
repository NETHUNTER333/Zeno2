export type ExplainerStyle = 'motion' | 'illustrated' | '3d';

export type ExplainerVisualType =
  | 'kinetic-title'
  | 'bar-chart'
  | 'flow-route'
  | 'metric-grid'
  | 'quote-clipping'
  | 'device-card'
  | '3d-orbit';

export interface ExplainerBarItem {
  label: string;
  value: number;
  displayValue: string;
}

export interface ExplainerFlowStep {
  label: string;
  detail: string;
}

export interface ExplainerMetricItem {
  value: string;
  label: string;
}

export interface ExplainerQuoteItem {
  text: string;
  author: string;
  publication: string;
}

export interface ExplainerScene {
  id: string;
  kicker: string;
  title: string;
  subtitle?: string;
  durationSec: number;
  narration: string;
  visualType: ExplainerVisualType;
  accentColor: string;
  sourceAttribution?: string;
  bars?: ExplainerBarItem[];
  steps?: ExplainerFlowStep[];
  metrics?: ExplainerMetricItem[];
  quote?: ExplainerQuoteItem;
  deviceLines?: string[];
}

export interface ExplainerSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export interface ExplainerProject {
  id: string;
  title: string;
  topic: string;
  style: ExplainerStyle;
  summary: string;
  musicMood: 'ambient' | 'upbeat' | 'editorial' | 'cinematic';
  scenes: ExplainerScene[];
  sources: ExplainerSource[];
  createdAt: number;
}

export interface ReviewComment {
  id: string;
  sceneId: string;
  sceneTitle: string;
  timeSec: number;
  xPct: number;
  yPct: number;
  text: string;
  resolved?: boolean;
  createdAt: number;
}

export const EXPLAINER_SAMPLE_TOPICS: ReadonlyArray<{
  label: string;
  topic: string;
  style: ExplainerStyle;
}> = [
  {
    label: 'How Transformer Attention Works',
    topic: 'How Transformer self-attention enables modern LLMs to reason across long context windows',
    style: 'motion',
  },
  {
    label: 'Why Sleep Locks In Memory',
    topic: 'How deep slow-wave sleep and REM cycles consolidate memories in the human brain',
    style: 'illustrated',
  },
  {
    label: 'How Satellite Mesh Internet Works',
    topic: 'How low-Earth orbit satellite constellations route laser-linked internet across the globe',
    style: '3d',
  },
];

export const STARTER_EXPLAINER_PROJECT: ExplainerProject = {
  id: 'starter-video-explainer',
  title: 'Code-Driven Video Explainers',
  topic: 'How code-driven AI video explainers turn any topic, doc, or codebase into a 60-second video',
  style: 'motion',
  summary: 'Deterministic motion graphics, live charts, synced narration, and pinned frame reviews.',
  musicMood: 'editorial',
  createdAt: Date.now(),
  sources: [
    {
      title: 'petergyang/video-explainer',
      url: 'https://github.com/petergyang/video-explainer',
      domain: 'github.com',
      snippet: 'Turn any topic, doc, codebase, or URL into a ~1-minute code-driven explainer video with Motion, Illustrated, and 3D styles.',
    },
  ],
  scenes: [
    {
      id: 'scene-1',
      kicker: '01 · Overview',
      title: 'Turn Any Idea Into a 60-Second Video',
      subtitle: 'Code-driven motion graphics, zero warped AI pixels',
      durationSec: 8,
      narration: 'Instead of generating blurry video pixels, a code-driven explainer directs real typography, charts, and 3D scenes deterministically.',
      visualType: 'kinetic-title',
      accentColor: '#38bdf8',
      sourceAttribution: 'github.com/petergyang/video-explainer',
    },
    {
      id: 'scene-2',
      kicker: '02 · Architecture',
      title: 'Four-Stage Director Pipeline',
      subtitle: 'From raw URL, doc, or codebase to finished video',
      durationSec: 9,
      narration: 'First it grounds facts from your link or web search, scripts tight scenes, renders crisp frames, and syncs narration with captions.',
      visualType: 'flow-route',
      accentColor: '#a78bfa',
      steps: [
        { label: 'Ground', detail: 'Read topic, docs, or live URL' },
        { label: 'Direct', detail: 'Script 5–6 timed visual scenes' },
        { label: 'Render', detail: 'Motion, Illustrated, or 3D canvas' },
        { label: 'Review', detail: 'Pin comments & revise live' },
      ],
      sourceAttribution: 'github.com/petergyang/video-explainer',
    },
    {
      id: 'scene-3',
      kicker: '03 · Benchmark',
      title: 'Crisp Signal Over Black-Box Video',
      subtitle: 'Why programmatic visuals excel for product & technical explainers',
      durationSec: 9,
      narration: 'Text stays razor sharp, numbers animate accurately, and editing a single chart takes seconds instead of re-rolling prompts.',
      visualType: 'bar-chart',
      accentColor: '#34d399',
      bars: [
        { label: 'Text Legibility', value: 98, displayValue: '98%' },
        { label: 'Data Accuracy', value: 96, displayValue: '96%' },
        { label: 'Iteration Speed', value: 91, displayValue: '8x' },
        { label: 'Style Control', value: 94, displayValue: '3 Modes' },
      ],
      sourceAttribution: 'Explainer Studio Benchmarks',
    },
    {
      id: 'scene-4',
      kicker: '04 · Review Loop',
      title: 'Click Any Frame to Pin Feedback',
      subtitle: 'Human-in-the-loop revisions without prompt guesswork',
      durationSec: 9,
      narration: 'Pause on any moment, click directly on the canvas to leave a pinned note, and let the AI director revise that exact scene.',
      visualType: 'device-card',
      accentColor: '#f59e0b',
      deviceLines: [
        'Pin #1 @ 00:18 · Scene 3 (62%, 44%)',
        '→ "Make the chart focus on latency vs cost"',
        'Applying targeted scene revision…',
        '✓ Updated bar-chart & synced voiceover',
      ],
      sourceAttribution: 'Interactive Review Workspace',
    },
    {
      id: 'scene-5',
      kicker: '05 · Ready to Ship',
      title: 'Export HD Video With Synced Audio',
      subtitle: 'Switch styles anytime between Motion, Illustrated, and 3D',
      durationSec: 8,
      narration: 'Toggle captions, voiceover, or synthesized music, switch between Motion, Illustrated, and 3D, and export straight from your browser.',
      visualType: '3d-orbit',
      accentColor: '#f472b6',
      metrics: [
        { value: '1080p/720p', label: 'Deterministic canvas' },
        { value: '3 Styles', label: 'Motion · Illustrated · 3D' },
        { value: 'Live TTS', label: 'Word-synced captions' },
      ],
      sourceAttribution: 'Zeno Video Explainer',
    },
  ],
};
