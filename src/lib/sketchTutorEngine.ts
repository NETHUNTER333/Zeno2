export type SketchModuleType =
  | 'whiteboard'
  | 'geometry'
  | 'graph'
  | 'vocab_match'
  | 'gallery';

export type SketchPresetKey =
  | 'pythagorean_proof'
  | 'projectile_motion'
  | 'ford_mustang_history'
  | 'romanian_vocab';

export type SketchDrawCmd =
  | {
      type: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color?: string;
      width?: number;
      dashed?: boolean;
    }
  | {
      type: 'arrow';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      label?: string;
      color?: string;
      width?: number;
    }
  | {
      type: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      label?: string;
      stroke?: string;
      fill?: string;
    }
  | {
      type: 'circle';
      cx: number;
      cy: number;
      r: number;
      label?: string;
      stroke?: string;
      fill?: string;
    }
  | {
      type: 'highlight';
      x: number;
      y: number;
      w: number;
      h: number;
      color?: string;
    }
  | {
      type: 'text';
      x: number;
      y: number;
      text: string;
      size?: number;
      bold?: boolean;
      color?: string;
    }
  | {
      type: 'curve';
      points: Array<[number, number]>;
      color?: string;
      width?: number;
      label?: string;
    };


export interface GeometryProofData {
  title: string;
  a: number;
  b: number;
  unit: string;
  formula: string;
}

export interface VocabMatchPair {
  id: string;
  source: string;
  target: string;
  phonetic?: string;
  example?: string;
}

export interface GraphPlotData {
  title: string;
  xLabel: string;
  yLabel: string;
  mode: 'projectile' | 'function';
  formula: string;
  expression?: string;
  initialSpeed?: number;
  launchAngle?: number;
  gravity?: number;
}

export interface FetchedLessonImage {
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  source?: string;
  link?: string;
}

export interface SketchLessonStep {
  id: string;
  title: string;
  explanation: string;
  highlights: string[];
  drawCommands: SketchDrawCmd[];
  keyFormula?: string;
}

export interface SketchLesson {
  id: string;
  title: string;
  subject: string;
  moduleType: SketchModuleType;
  summary: string;
  imageQuery?: string;
  steps: SketchLessonStep[];
  geometry?: GeometryProofData;
  vocabPairs?: VocabMatchPair[];
  graph?: GraphPlotData;
  images?: FetchedLessonImage[];
  followUpSuggestions: string[];
  generatedLatencyMs?: number;
}

// Monochrome palette tokens used across all procedural whiteboard diagrams
const INK_PRIMARY = '#f4f4f5';
const INK_SECONDARY = '#94a3b8';
const INK_MUTED = '#64748b';
const FILL_SOFT = 'rgba(148,163,184,0.12)';
const FILL_STRONG = 'rgba(148,163,184,0.24)';

export const SKETCH_PRESETS: Array<{
  key: SketchPresetKey;
  label: string;
  subject: string;
  prompt: string;
}> = [
  {
    key: 'pythagorean_proof',
    label: 'Pythagorean Theorem',
    subject: 'Geometry',
    prompt: 'Prove a squared plus b squared equals c squared visually step by step',
  },
  {
    key: 'ford_mustang_history',
    label: 'Ford Mustang',
    subject: 'Automotive History',
    prompt: 'History of the Ford Mustang from 1964 pony car to modern generations with photos',
  },
  {
    key: 'projectile_motion',
    label: 'Projectile Motion',
    subject: 'Physics',
    prompt: 'Explain 2D projectile motion with trajectory graph, vectors, and range formula',
  },
  {
    key: 'romanian_vocab',
    label: 'Romanian Vocab',
    subject: 'Languages',
    prompt: 'Teach essential Romanian travel vocabulary with interactive matching',
  },
];

const PRESET_LESSONS: Record<SketchPresetKey, SketchLesson> = {
  pythagorean_proof: {
    id: 'preset_pythagorean_proof',
    title: 'Pythagorean Theorem: Area Proof',
    subject: 'Geometry',
    moduleType: 'geometry',
    summary:
      'Geometric proof demonstrating why the areas built on the two perpendicular legs sum to the square area on the hypotenuse.',
    steps: [
      {
        id: 'py_1',
        title: '1. Construct the Right Triangle (3 – 4 – 5)',
        explanation:
          'Start with perpendicular legs a = 3 and b = 4 meeting at a 90° right angle. Connecting their endpoints forms hypotenuse c = 5.',
        highlights: ['Right angle sits opposite hypotenuse c', 'Legs a and b meet at 90°'],
        keyFormula: 'c = sqrt(a² + b²)',
        drawCommands: [
          { type: 'line', x1: 260, y1: 105, x2: 260, y2: 315, color: INK_PRIMARY, width: 3.5 },
          { type: 'line', x1: 260, y1: 315, x2: 540, y2: 315, color: INK_SECONDARY, width: 3.5 },
          { type: 'line', x1: 260, y1: 105, x2: 540, y2: 315, color: INK_PRIMARY, width: 4 },
          { type: 'rect', x: 260, y: 291, w: 24, h: 24, stroke: INK_SECONDARY, fill: FILL_SOFT },
          { type: 'text', x: 210, y: 215, text: 'a = 3', size: 19, bold: true, color: INK_PRIMARY },
          { type: 'text', x: 385, y: 348, text: 'b = 4', size: 19, bold: true, color: INK_SECONDARY },
          { type: 'text', x: 420, y: 192, text: 'c = 5', size: 21, bold: true, color: INK_PRIMARY },
        ],
      },
      {
        id: 'py_2',
        title: '2. Attach Geometric Squares to Each Side',
        explanation:
          'Construct square regions on each edge: a² = 9 square units along the vertical leg, b² = 16 units along the base, and c² = 25 units along the hypotenuse.',
        highlights: ['Area(a) = 3² = 9', 'Area(b) = 4² = 16', 'Area(c) = 9 + 16 = 25'],
        keyFormula: '9 + 16 = 25  →  a² + b² = c²',
        drawCommands: [
          { type: 'rect', x: 150, y: 145, w: 120, h: 120, stroke: INK_SECONDARY, fill: FILL_SOFT, label: 'a² = 9' },
          { type: 'rect', x: 270, y: 265, w: 165, h: 150, stroke: INK_SECONDARY, fill: FILL_STRONG, label: 'b² = 16' },
          { type: 'line', x1: 270, y1: 145, x2: 270, y2: 265, color: INK_PRIMARY, width: 3 },
          { type: 'line', x1: 270, y1: 265, x2: 435, y2: 265, color: INK_PRIMARY, width: 3 },
          { type: 'line', x1: 270, y1: 145, x2: 435, y2: 265, color: INK_PRIMARY, width: 4 },
          { type: 'highlight', x: 475, y: 115, w: 250, h: 112, color: FILL_SOFT },
          { type: 'text', x: 498, y: 162, text: 'a² + b² = c²', size: 25, bold: true, color: INK_PRIMARY },
          { type: 'text', x: 498, y: 202, text: '9 + 16 = 25', size: 19, color: INK_SECONDARY },
        ],
      },
      {
        id: 'py_3',
        title: '3. Rearrangement Area Proof',
        explanation:
          'In an outer square of side (a+b), four congruent right triangles leave c² in the center—identical to the unoccupied a² and b² squares after sliding the triangles.',
        highlights: ['(a + b)² = c² + 4·(½ab)', 'Canceling 2ab on both sides leaves a² + b² = c²'],
        drawCommands: [
          { type: 'rect', x: 130, y: 75, w: 280, h: 280, stroke: INK_MUTED, fill: FILL_SOFT },
          { type: 'rect', x: 130, y: 75, w: 112, h: 112, stroke: INK_PRIMARY, fill: FILL_STRONG, label: 'a²' },
          { type: 'rect', x: 242, y: 187, w: 168, h: 168, stroke: INK_SECONDARY, fill: FILL_STRONG, label: 'b²' },
          { type: 'text', x: 455, y: 165, text: 'Outer Area = (a + b)²', size: 19, bold: true, color: INK_PRIMARY },
          { type: 'text', x: 455, y: 210, text: 'Remaining Area:', size: 17, color: INK_SECONDARY },
          { type: 'text', x: 455, y: 250, text: 'a² + b²  ≡  c²', size: 25, bold: true, color: INK_PRIMARY },
        ],
      },
    ],
    geometry: {
      title: 'Interactive Right Triangle Explorer',
      a: 3,
      b: 4,
      unit: 'u',
      formula: 'a² + b² = c²',
    },
    followUpSuggestions: [
      'Show the 5 – 12 – 13 Pythagorean triple',
      'What is the Law of Cosines when angle ≠ 90°?',
      'Solve a ladder leaning against a 12 ft wall problem',
    ],
  },

  ford_mustang_history: {
    id: 'preset_ford_mustang_history',
    title: 'Ford Mustang: Evolution (1964–Present)',
    subject: 'Automotive History',
    moduleType: 'gallery',
    imageQuery: 'classic 1965 Ford Mustang fastback and modern Ford Mustang GT',
    summary:
      'Visual timeline from the 1964 World’s Fair pony car debut through the Fastback era, Fox-body 5.0 revival, and modern Coyote V8.',
    steps: [
      {
        id: 'fm_1',
        title: '1. April 17, 1964: Birth of the Pony Car',
        explanation:
          'Unveiled at the New York World’s Fair at $2,368, the original 1964½ Mustang paired long-hood/short-deck proportions with Falcon underpinnings—selling 418,812 units in year one.',
        highlights: ['Base launch price: $2,368 USD', '1 million sold in 18 months'],
        drawCommands: [
          { type: 'highlight', x: 60, y: 50, w: 680, h: 60, color: FILL_SOFT },
          { type: 'text', x: 90, y: 88, text: '1964  →  1969  →  1979  →  2005  →  2024', size: 21, bold: true, color: INK_PRIMARY },
          { type: 'rect', x: 75, y: 165, w: 185, h: 120, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1964½ Pony Car' },
          { type: 'arrow', x1: 266, y1: 225, x2: 326, y2: 225, color: INK_SECONDARY },
          { type: 'rect', x: 332, y: 165, w: 185, h: 120, stroke: INK_SECONDARY, fill: FILL_SOFT, label: '1968 Bullitt GT' },
          { type: 'arrow', x1: 523, y1: 225, x2: 583, y2: 225, color: INK_SECONDARY },
          { type: 'rect', x: 588, y: 165, w: 145, h: 120, stroke: INK_PRIMARY, fill: FILL_SOFT, label: 'Boss 429' },
        ],
      },
      {
        id: 'fm_2',
        title: '2. Fox-Body Revival & Retro S197',
        explanation:
          'Following the 1973 oil crisis, the 1979–1993 Fox-body platform restored light 5.0L V8 performance, followed by the 2005 retro S197 generation.',
        highlights: ['1979–1993: Lightweight Fox-Body 5.0L HO', '2005 S197 revived 1967 fastback styling'],
        drawCommands: [
          { type: 'line', x1: 90, y1: 310, x2: 710, y2: 310, color: INK_MUTED, width: 2.5 },
          { type: 'curve', points: [[110, 290], [220, 150], [340, 275], [480, 195], [680, 115]], color: INK_PRIMARY, width: 3.5, label: 'Output Trajectory' },
          { type: 'text', x: 110, y: 345, text: '1969 Peak', size: 14, color: INK_SECONDARY },
          { type: 'text', x: 295, y: 345, text: '1974 Oil Crisis', size: 14, color: INK_MUTED },
          { type: 'text', x: 455, y: 345, text: '1987 Fox 5.0', size: 14, color: INK_PRIMARY },
          { type: 'text', x: 615, y: 345, text: 'S550 / S650', size: 14, color: INK_PRIMARY },
        ],
      },
      {
        id: 'fm_3',
        title: '3. Modern Era: S550 & S650 Coyote V8',
        explanation:
          'The 2015 S550 introduced independent rear suspension worldwide, while the 2024 S650 Dark Horse pushes the 5.0L Gen-4 Coyote V8 to 500 hp.',
        highlights: ['2015: First global Mustang with IRS', '2024 Dark Horse: 500 hp 5.0L V8'],
        drawCommands: [
          { type: 'circle', cx: 230, cy: 225, r: 78, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '5.0L Coyote V8' },
          { type: 'circle', cx: 560, cy: 225, r: 78, stroke: INK_SECONDARY, fill: FILL_SOFT, label: 'Global S550/S650' },
          { type: 'arrow', x1: 315, y1: 225, x2: 475, y2: 225, label: '60 Years', color: INK_PRIMARY },
        ],
      },
    ],
    followUpSuggestions: [
      'Compare 1965 Shelby GT350 vs 2024 Dark Horse specs',
      'Explain the Fox-body 5.0 platform appeal',
      'Quiz me on Mustang generations',
    ],
  },

  projectile_motion: {
    id: 'preset_projectile_motion',
    title: '2D Projectile Motion & Trajectory',
    subject: 'Physics',
    moduleType: 'graph',
    summary:
      'Analyze independent horizontal velocity (constant vx) and vertical acceleration (-g), plus live range vs launch-angle plotting.',
    steps: [
      {
        id: 'pm_1',
        title: '1. Decompose Initial Velocity (vx, vy)',
        explanation:
          'Split launch speed v₀ at angle θ into perpendicular components: horizontal vx = v₀·cos(θ) remains constant (ignoring drag), while vertical vy = v₀·sin(θ) decelerates at -g.',
        highlights: ['vx = v₀·cos(θ) (zero horizontal acceleration)', 'vy(t) = v₀·sin(θ) − g·t'],
        keyFormula: 'R = (v₀² · sin(2θ)) / g',
        drawCommands: [
          { type: 'line', x1: 110, y1: 350, x2: 700, y2: 350, color: INK_MUTED, width: 2.5 },
          { type: 'line', x1: 110, y1: 350, x2: 110, y2: 75, color: INK_MUTED, width: 2.5 },
          { type: 'arrow', x1: 110, y1: 350, x2: 245, y2: 215, label: 'v₀', color: INK_PRIMARY, width: 3.5 },
          { type: 'arrow', x1: 110, y1: 350, x2: 245, y2: 350, label: 'vx = v₀cosθ', color: INK_SECONDARY, width: 2.8 },
          { type: 'arrow', x1: 245, y1: 350, x2: 245, y2: 215, label: 'vy = v₀sinθ', color: INK_SECONDARY, width: 2.8 },
          { type: 'text', x: 165, y: 332, text: 'θ', size: 20, bold: true, color: INK_PRIMARY },
        ],
      },
      {
        id: 'pm_2',
        title: '2. Parabolic Apex & 45° Optimal Range',
        explanation:
          'At peak height H, vertical velocity vy drops to zero while vx continues moving horizontally. Because sin(2θ) peaks at 2θ = 90°, θ = 45° achieves maximum level range.',
        highlights: ['Peak height: H = (v₀·sin θ)² / (2g)', 'Flight time: T = 2·v₀·sin(θ) / g'],
        drawCommands: [
          { type: 'line', x1: 100, y1: 340, x2: 700, y2: 340, color: INK_MUTED, width: 2 },
          {
            type: 'curve',
            points: [
              [110, 340],
              [210, 210],
              [310, 130],
              [400, 105],
              [490, 130],
              [590, 210],
              [685, 340],
            ],
            color: INK_PRIMARY,
            width: 3.5,
            label: 'y(x) Parabola',
          },
          { type: 'circle', cx: 400, cy: 105, r: 8, stroke: INK_PRIMARY, fill: INK_PRIMARY },
          { type: 'arrow', x1: 400, y1: 105, x2: 495, y2: 105, label: 'vy = 0, vx only', color: INK_SECONDARY },
          { type: 'arrow', x1: 400, y1: 105, x2: 400, y2: 195, label: 'g = 9.8 m/s²', color: INK_PRIMARY },
        ],
      },
    ],
    graph: {
      title: 'Projectile Trajectory y(x)',
      xLabel: 'Horizontal Distance x (m)',
      yLabel: 'Altitude y (m)',
      mode: 'projectile',
      formula: 'y(x) = x·tan(θ) − (g·x²) / (2·v₀²·cos²(θ))',
      initialSpeed: 24,
      launchAngle: 45,
      gravity: 9.8,
    },
    followUpSuggestions: [
      'Compare 30° vs 60° complementary trajectories',
      'How does air resistance change the arc?',
      'Solve a cliff-launch projectile problem',
    ],
  },

  romanian_vocab: {
    id: 'preset_romanian_vocab',
    title: 'Romanian Travel Vocabulary',
    subject: 'Languages',
    moduleType: 'vocab_match',
    summary:
      'High-frequency Romanian travel phrases with phonetic pronunciation guides and an interactive matching board.',
    steps: [
      {
        id: 'ro_1',
        title: '1. Romance Roots & Special Letters',
        explanation:
          'Romanian is a Romance language closely related to Italian and Latin. Notice diacritics: "ă" sounds like the "a" in "about", "ț" sounds like "ts", and "ș" sounds like "sh".',
        highlights: ['ș = "sh" (as in shoe)', 'ț = "ts" (as in cats)', 'ă = schwa "uh" (as in sofa)'],
        keyFormula: 'Mulțumesc (mool-tsoo-MESK) = Thank you',
        drawCommands: [
          { type: 'highlight', x: 80, y: 60, w: 640, h: 64, color: FILL_SOFT },
          { type: 'text', x: 110, y: 102, text: 'Mulțumesc  =  mool - tsoo - MESK', size: 23, bold: true, color: INK_PRIMARY },
          { type: 'rect', x: 95, y: 175, w: 180, h: 120, stroke: INK_PRIMARY, fill: FILL_STRONG, label: 'ș  →  "sh"' },
          { type: 'rect', x: 310, y: 175, w: 180, h: 120, stroke: INK_SECONDARY, fill: FILL_SOFT, label: 'ț  →  "ts"' },
          { type: 'rect', x: 525, y: 175, w: 180, h: 120, stroke: INK_SECONDARY, fill: FILL_SOFT, label: 'ă  →  "uh"' },
        ],
      },
      {
        id: 'ro_2',
        title: '2. Essential Travel Phrases',
        explanation:
          'Match each Romanian phrase on the left with its English translation below. Tap any speaker icon to hear spoken pronunciation.',
        highlights: ['Match all 6 pairs below', 'Listen and repeat each phrase aloud'],
        drawCommands: [
          { type: 'rect', x: 85, y: 80, w: 630, h: 270, stroke: INK_MUTED, fill: FILL_SOFT },
          { type: 'text', x: 120, y: 130, text: 'Bună ziua  ↔  Good day / Hello', size: 20, bold: true, color: INK_PRIMARY },
          { type: 'text', x: 120, y: 185, text: 'Unde este...?  ↔  Where is...?', size: 20, bold: true, color: INK_SECONDARY },
          { type: 'text', x: 120, y: 240, text: 'Cât costă?  ↔  How much does it cost?', size: 20, bold: true, color: INK_PRIMARY },
          { type: 'text', x: 120, y: 295, text: 'Apă, vă rog  ↔  Water, please', size: 20, bold: true, color: INK_SECONDARY },
        ],
      },
    ],
    vocabPairs: [
      { id: 'ro_p1', source: 'Mulțumesc', target: 'Thank you', phonetic: 'mool-tsoo-MESK', example: 'Mulțumesc mult!' },
      { id: 'ro_p2', source: 'Bună ziua', target: 'Good day / Hello', phonetic: 'BOO-nuh ZEE-wah', example: 'Bună ziua, ce mai faceți?' },
      { id: 'ro_p3', source: 'Vă rog', target: 'Please', phonetic: 'vuh ROG', example: 'O cafea, vă rog.' },
      { id: 'ro_p4', source: 'Cât costă?', target: 'How much does it cost?', phonetic: 'kuht KOS-tuh', example: 'Cât costă biletul?' },
      { id: 'ro_p5', source: 'Apă plată', target: 'Still water', phonetic: 'AH-puh PLAH-tuh', example: 'O sticlă de apă plată.' },
      { id: 'ro_p6', source: 'Unde este gara?', target: 'Where is the train station?', phonetic: 'OON-deh YES-teh GAH-rah', example: 'Scuzați-mă, unde este gara?' },
    ],
    followUpSuggestions: [
      'Teach 6 restaurant phrases in Romanian',
      'Show Romanian numbers 1 through 10',
      'Compare Romanian words to Italian and Spanish',
    ],
  },
};

export function detectSketchPreset(topic: string): SketchPresetKey | null {
  const lower = String(topic || '').toLowerCase();
  if (/\b(pythagor|a\^2|a squared|hypotenuse|right triangle)\b/.test(lower)) {
    return 'pythagorean_proof';
  }
  if (/\b(mustang|pony car|shelby|ford)\b/.test(lower)) {
    return 'ford_mustang_history';
  }
  if (/\b(projectile|parabola|trajectory|range formula|launch angle)\b/.test(lower)) {
    return 'projectile_motion';
  }
  if (/\b(romanian|vocab|vocabulary match|mulțumesc|multumesc|buna ziua)\b/.test(lower)) {
    return 'romanian_vocab';
  }
  return null;
}

export function getPresetSketchLesson(key: SketchPresetKey): SketchLesson {
  return PRESET_LESSONS[key];
}

function buildFractionVisualLesson(clean: string): SketchLesson {
  return {
    id: `fraction_${Date.now()}`,
    title: 'Visualizing Fractions & Equivalence',
    subject: 'Mathematics',
    moduleType: 'whiteboard',
    summary:
      'Step-by-step visual breakdown of fractions as equal parts of a whole, number-line placement, and equivalent fractions.',
    steps: [
      {
        id: 'fr_1',
        title: '1. Equal Parts of a Whole (3/4)',
        explanation:
          'A fraction compares shaded parts (numerator, top) to total equal parts making one whole (denominator, bottom). Splitting one unit bar into 4 equal quarters and shading 3 gives 3/4.',
        highlights: ['Numerator (3) = shaded equal pieces', 'Denominator (4) = total equal divisions per whole', 'All divisions must have equal size'],
        keyFormula: '3/4 = 3 × (1/4)',
        drawCommands: [
          { type: 'highlight', x: 65, y: 38, w: 670, h: 52, color: FILL_SOFT },
          { type: 'text', x: 90, y: 71, text: 'Numerator (3 parts shaded)  /  Denominator (4 equal parts)', size: 19, bold: true, color: INK_PRIMARY },
          { type: 'rect', x: 90, y: 128, w: 620, h: 68, stroke: INK_MUTED, fill: FILL_SOFT, label: '1 Whole = 4/4' },
          { type: 'rect', x: 90, y: 222, w: 155, h: 86, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1/4' },
          { type: 'rect', x: 245, y: 222, w: 155, h: 86, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1/4' },
          { type: 'rect', x: 400, y: 222, w: 155, h: 86, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1/4' },
          { type: 'rect', x: 555, y: 222, w: 155, h: 86, stroke: INK_MUTED, fill: 'transparent', label: '1/4 (open)' },
          { type: 'arrow', x1: 95, y1: 345, x2: 550, y2: 345, label: '3 shaded quarters = 3/4', color: INK_PRIMARY, width: 2.5 },
        ],
      },
      {
        id: 'fr_2',
        title: '2. Equivalent Fractions (1/2 = 2/4 = 4/8)',
        explanation:
          'Multiplying both numerator and denominator by the same nonzero integer subdivides each bar finer without changing the total shaded length: 1/2 covers the exact same length as 2/4 and 4/8.',
        highlights: ['Multiplying top and bottom by k scales pieces without changing value', '1/2 = 2/4 = 4/8 = 50%'],
        keyFormula: 'a/b = (k·a)/(k·b)   for k ≠ 0',
        drawCommands: [
          { type: 'text', x: 90, y: 68, text: 'Equivalent Lengths:  1/2  =  2/4  =  4/8', size: 21, bold: true, color: INK_PRIMARY },
          { type: 'rect', x: 150, y: 105, w: 280, h: 58, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1/2' },
          { type: 'rect', x: 430, y: 105, w: 280, h: 58, stroke: INK_MUTED, fill: 'transparent', label: '1/2' },
          { type: 'rect', x: 150, y: 185, w: 140, h: 58, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1/4' },
          { type: 'rect', x: 290, y: 185, w: 140, h: 58, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1/4' },
          { type: 'rect', x: 430, y: 185, w: 280, h: 58, stroke: INK_MUTED, fill: 'transparent', label: '2/4 remaining' },
          { type: 'rect', x: 150, y: 265, w: 70, h: 58, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1/8' },
          { type: 'rect', x: 220, y: 265, w: 70, h: 58, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1/8' },
          { type: 'rect', x: 290, y: 265, w: 70, h: 58, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1/8' },
          { type: 'rect', x: 360, y: 265, w: 70, h: 58, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '1/8' },
          { type: 'line', x1: 430, y1: 95, x2: 430, y2: 345, color: INK_SECONDARY, width: 2.5, dashed: true },
        ],
      },
      {
        id: 'fr_3',
        title: '3. Fractions on the Number Line & Common Denominators',
        explanation:
          'To add fractions like 1/2 + 1/3, rewrite both over a common denominator (6) so every step along the number line shares equal spacing: 3/6 + 2/6 = 5/6.',
        highlights: ['Fractions live as exact points between 0 and 1', 'Common denominator aligns unit step size'],
        keyFormula: '1/2 + 1/3 = 3/6 + 2/6 = 5/6',
        drawCommands: [
          { type: 'text', x: 90, y: 74, text: 'Number Line & Addition:  1/2 + 1/3 = 5/6', size: 21, bold: true, color: INK_PRIMARY },
          { type: 'line', x1: 90, y1: 215, x2: 690, y2: 215, color: INK_PRIMARY, width: 3 },
          { type: 'circle', cx: 90, cy: 215, r: 7, stroke: INK_PRIMARY, fill: INK_PRIMARY },
          { type: 'circle', cx: 390, cy: 215, r: 8, stroke: INK_SECONDARY, fill: FILL_STRONG },
          { type: 'circle', cx: 590, cy: 215, r: 10, stroke: INK_PRIMARY, fill: INK_PRIMARY },
          { type: 'circle', cx: 690, cy: 215, r: 7, stroke: INK_PRIMARY, fill: INK_PRIMARY },
          { type: 'text', x: 84, y: 252, text: '0', size: 16, bold: true, color: INK_SECONDARY },
          { type: 'text', x: 372, y: 252, text: '3/6 (1/2)', size: 15, color: INK_SECONDARY },
          { type: 'text', x: 565, y: 252, text: '5/6', size: 17, bold: true, color: INK_PRIMARY },
          { type: 'text', x: 684, y: 252, text: '1', size: 16, bold: true, color: INK_SECONDARY },
          { type: 'arrow', x1: 95, y1: 165, x2: 386, y2: 165, label: '+ 3/6', color: INK_SECONDARY, width: 2.5 },
          { type: 'arrow', x1: 394, y1: 165, x2: 585, y2: 165, label: '+ 2/6', color: INK_PRIMARY, width: 2.5 },
        ],
      },
    ],
    followUpSuggestions: [
      `Compare improper fractions vs mixed numbers for ${clean}`,
      'Explain how to divide fractions step by step',
      'Draw a visual comparison of 2/3 vs 3/5',
    ],
  };
}

function buildCalculusVisualLesson(clean: string): SketchLesson {
  return {
    id: `calculus_${Date.now()}`,
    title: clean,
    subject: 'Calculus',
    moduleType: 'whiteboard',
    summary: `Geometric slope, tangent approximation, and Riemann area accumulation behind ${clean}.`,
    steps: [
      {
        id: 'calc_1',
        title: '1. Secant Slope Converging to Tangent',
        explanation:
          'As step width Δx shrinks toward zero, the secant line joining two points on the curve rotates into the instantaneous tangent line—defining the derivative f\'(x).',
        highlights: ['Average rate: (f(x+h) − f(x)) / h', 'Instantaneous rate takes limit as h → 0'],
        keyFormula: "f'(x) = lim(h→0) [f(x+h) - f(x)] / h",
        drawCommands: [
          { type: 'line', x1: 100, y1: 350, x2: 700, y2: 350, color: INK_MUTED, width: 2 },
          { type: 'line', x1: 100, y1: 350, x2: 100, y2: 70, color: INK_MUTED, width: 2 },
          {
            type: 'curve',
            points: [[130, 320], [230, 295], [340, 240], [460, 165], [600, 90]],
            color: INK_PRIMARY,
            width: 3.5,
            label: 'y = f(x)',
          },
          { type: 'line', x1: 210, y1: 330, x2: 540, y2: 115, color: INK_SECONDARY, width: 2, dashed: true },
          { type: 'circle', cx: 340, cy: 240, r: 8, stroke: INK_PRIMARY, fill: INK_PRIMARY },
          { type: 'circle', cx: 460, cy: 165, r: 7, stroke: INK_SECONDARY, fill: INK_SECONDARY },
          { type: 'text', x: 355, y: 268, text: 'Δx → 0', size: 16, bold: true, color: INK_PRIMARY },
        ],
      },
      {
        id: 'calc_2',
        title: '2. Area Accumulation Under the Curve',
        explanation:
          'Summing narrow rectangular strips f(xi)·Δx approximates total area under the curve; as strip count approaches infinity, the sum becomes the definite integral.',
        highlights: ['Each strip adds area f(xi)·Δx', 'Fundamental Theorem connects slope and area'],
        keyFormula: '∫ f(x) dx = F(b) - F(a)',
        drawCommands: [
          { type: 'line', x1: 100, y1: 350, x2: 700, y2: 350, color: INK_MUTED, width: 2 },
          { type: 'rect', x: 180, y: 260, w: 80, h: 90, stroke: INK_SECONDARY, fill: FILL_SOFT, label: 'A₁' },
          { type: 'rect', x: 260, y: 215, w: 80, h: 135, stroke: INK_SECONDARY, fill: FILL_STRONG, label: 'A₂' },
          { type: 'rect', x: 340, y: 170, w: 80, h: 180, stroke: INK_SECONDARY, fill: FILL_SOFT, label: 'A₃' },
          { type: 'rect', x: 420, y: 130, w: 80, h: 220, stroke: INK_SECONDARY, fill: FILL_STRONG, label: 'A₄' },
          { type: 'curve', points: [[150, 290], [260, 225], [380, 158], [530, 95]], color: INK_PRIMARY, width: 3.5 },
          { type: 'text', x: 535, y: 195, text: 'Σ f(xᵢ)·Δx', size: 20, bold: true, color: INK_PRIMARY },
        ],
      },
    ],
    followUpSuggestions: [
      `Compute a worked example for ${clean}`,
      'Show why the derivative of x^n is n·x^(n-1)',
      'Relate velocity and acceleration curves visually',
    ],
  };
}

export function buildFallbackSketchLesson(topic: string): SketchLesson {
  const presetKey = detectSketchPreset(topic);
  if (presetKey) {
    return PRESET_LESSONS[presetKey];
  }
  const clean = String(topic || 'Visual Concept Breakdown').trim().slice(0, 120);
  const lower = clean.toLowerCase();

  if (/\b(fraction|fractions|numerator|denominator|ratio|percent)\b/.test(lower)) {
    return buildFractionVisualLesson(clean);
  }
  if (/\b(calculus|derivative|integral|riemann|slope|tangent|limit)\b/.test(lower)) {
    return buildCalculusVisualLesson(clean);
  }

  return {
    id: `fallback_${Date.now()}`,
    title: clean,
    subject: 'Visual Tutor',
    moduleType: 'whiteboard',
    imageQuery: clean,
    summary: `Structured multi-stage visual breakdown and mechanism map for ${clean}.`,
    steps: [
      {
        id: 'fb_1',
        title: `1. Core Architecture of ${clean}`,
        explanation: `Break ${clean} into three connected pieces: starting inputs/axioms, the governing transformation rule, and the resulting observable output.`,
        highlights: [
          'Identify foundational variables and units',
          'Map how inputs drive internal state transitions',
          'Verify the measurable output or conclusion',
        ],
        drawCommands: [
          { type: 'highlight', x: 65, y: 40, w: 670, h: 54, color: FILL_SOFT },
          { type: 'text', x: 90, y: 74, text: clean.slice(0, 44), size: 21, bold: true, color: INK_PRIMARY },
          { type: 'rect', x: 75, y: 145, w: 185, h: 120, stroke: INK_SECONDARY, fill: FILL_SOFT, label: '1. Inputs & Rules' },
          { type: 'arrow', x1: 266, y1: 205, x2: 316, y2: 205, label: 'drives', color: INK_PRIMARY },
          { type: 'rect', x: 322, y: 145, w: 185, h: 120, stroke: INK_PRIMARY, fill: FILL_STRONG, label: '2. Mechanism' },
          { type: 'arrow', x1: 513, y1: 205, x2: 563, y2: 205, label: 'yields', color: INK_PRIMARY },
          { type: 'rect', x: 569, y: 145, w: 160, h: 120, stroke: INK_SECONDARY, fill: FILL_SOFT, label: '3. Outcome' },
          { type: 'line', x1: 165, y1: 280, x2: 650, y2: 280, color: INK_MUTED, width: 1.5, dashed: true },
          { type: 'text', x: 255, y: 318, text: 'Feedback & Boundary Constraints', size: 14, color: INK_SECONDARY },
        ],
      },
      {
        id: 'fb_2',
        title: `2. Compare Cases & Verify Intuition`,
        explanation: `Compare typical vs limiting cases for ${clean} so you can predict how outputs scale when an input doubles or drops to zero.`,
        highlights: ['Test boundary and limiting cases', 'Distinguish cause from secondary effects'],
        drawCommands: [
          { type: 'circle', cx: 235, cy: 215, r: 82, stroke: INK_PRIMARY, fill: FILL_STRONG, label: 'Core Principle' },
          { type: 'circle', cx: 555, cy: 215, r: 82, stroke: INK_SECONDARY, fill: FILL_SOFT, label: 'Edge Cases' },
          { type: 'arrow', x1: 324, y1: 215, x2: 466, y2: 215, label: 'verify', color: INK_PRIMARY },
          { type: 'text', x: 215, y: 345, text: 'Ask a specific follow-up below for a deeper custom drawing', size: 14, color: INK_SECONDARY },
        ],
      },
    ],
    followUpSuggestions: [
      `Show a concrete numerical example for ${clean}`,
      `Compare common mistakes in ${clean}`,
      `Draw a labeled graph or workflow for ${clean}`,
    ],
  };
}

export function computeProjectileTrajectoryPoints(
  v0: number,
  angleDeg: number,
  g: number
): Array<{ x: number; y: number }> {
  const rad = (angleDeg * Math.PI) / 180;
  const vx = v0 * Math.cos(rad);
  const vy = v0 * Math.sin(rad);
  const totalT = Math.max(0.2, (2 * vy) / Math.max(1, g));
  const samples = 40;
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * totalT;
    const x = Number((vx * t).toFixed(2));
    const y = Math.max(0, Number((vy * t - 0.5 * g * t * t).toFixed(2)));
    out.push({ x, y });
  }
  return out;
}


