import type { Fit } from '@livliv-dev/player';

export type HitaishiAvatarFormat = 'livliv' | '3d-procedural' | 'vrm' | 'png';
export type HitaishiControlMode = 'ai' | 'you' | 'display';
export type HitaishiMovementInput = 'auto' | 'face' | 'face-replay' | 'mic' | 'mouse';
export type HitaishiMovementRange = 'calm' | 'natural' | 'lively';
export type HitaishiGazeMode = 'speaker' | 'camera' | 'around';

export interface HitaishiCatalogCharacter {
  id: string;
  name: string;
  tagline: string;
  category: '2.5d-half' | '2.5d-full' | '3d-studio';
  format: HitaishiAvatarFormat;
  fullBody?: boolean;
  avatarUrl: string;
  modelUrl: string;
  accentColor: string;
  voicePitch: number;
  voiceRate: number;
  persona: string;
  style: string;
  greetingLines: string[];
  proceduralPreset?: 'nova' | 'astra' | 'kuro' | 'lumi';
}

export interface HitaishiStageCharacter {
  uid: string;
  catalogId: string;
  name: string;
  format: HitaishiAvatarFormat;
  fullBody: boolean;
  avatarUrl: string;
  modelUrl: string;
  customFiles?: Map<string, Blob>;
  proceduralPreset?: 'nova' | 'astra' | 'kuro' | 'lumi';
  // Stage bounding box in 1920x1080 normalized coordinates (0..1)
  x: number; // center X (0..1)
  y: number; // bottom Y or center Y (0..1)
  w: number; // width share (0..1)
  h: number; // height share (0..1)
  zIndex: number;
  locked: boolean;
  visible: boolean;
  // Control & Voice
  controlMode: HitaishiControlMode;
  muted: boolean;
  voiceSpeed: number;
  voiceVolume: number;
  voicePreset: string;
  // Appearance & Framing
  captionColor: string;
  showBubble: boolean;
  currentSubtitle: string;
  isSpeaking: boolean;
  flipHorizontal: boolean;
  shadow: boolean;
  zoom: number; // 0.5 .. 3.0
  offsetX: number; // -1 .. 1
  offsetY: number; // -1 .. 1
  fit: Fit; // 'frame' | 'knee' | 'whole'
  headFraming: boolean;
  // Persona
  persona: string;
  speakingStyle: string;
  // Movement & Expressions
  movementInput: HitaishiMovementInput;
  idleMotion: boolean;
  movementRange: HitaishiMovementRange;
  gazeMode: HitaishiGazeMode;
  expressionStrength: number; // 0 .. 1
  activeExpression: string | null;
  activeAction: { id: 'nod' | 'shake' | 'tilt' | 'hop' | 'shy'; seq: number } | null;
  isAway: boolean;
  mouthOpen: number;
  voiceLanguage?: string;
}

export interface HitaishiStageProp {
  uid: string;
  kind: 'text' | 'image';
  text?: string;
  subtext?: string;
  imageUrl?: string;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  bgColor?: string;
  visible: boolean;
}

export type HitaishiAspectRatio = '16:9' | '9:16' | '1:1' | '4:3';

export interface HitaishiBackgroundOption {
  id: string;
  label: string;
  type: 'solid' | 'gradient' | 'scene' | 'transparent' | 'greenscreen';
  value: string;
  swatch: string;
}

export const HITAISHI_BACKGROUNDS: HitaishiBackgroundOption[] = [
  {
    id: 'cozy-twilight',
    label: 'Cozy Room',
    type: 'scene',
    value: 'cozy-twilight',
    swatch: '#271E37',
  },
  {
    id: 'obsidian',
    label: 'Obsidian Dark',
    type: 'solid',
    value: '#0B0B10',
    swatch: '#0B0B10',
  },
  {
    id: 'warm-ivory',
    label: 'Stage Ivory',
    type: 'solid',
    value: '#F4F3EE',
    swatch: '#F4F3EE',
  },
  {
    id: 'crisp-white',
    label: 'Studio White',
    type: 'solid',
    value: '#FFFFFF',
    swatch: '#FFFFFF',
  },
  {
    id: 'pastel-sakura',
    label: 'Sakura Mist',
    type: 'gradient',
    value: 'linear-gradient(180deg, #FFF5F8 0%, #FCE7F3 100%)',
    swatch: '#F9A8D4',
  },
  {
    id: 'sky-breeze',
    label: 'Sky Breeze',
    type: 'gradient',
    value: 'linear-gradient(180deg, #F0F7FF 0%, #E0F2FE 100%)',
    swatch: '#93C5FD',
  },
  {
    id: 'lavender-dream',
    label: 'Lavender Studio',
    type: 'gradient',
    value: 'linear-gradient(180deg, #F5F3FF 0%, #EDE9FE 100%)',
    swatch: '#C4B5FD',
  },
  {
    id: 'cozy-night-room',
    label: 'Cozy Night Room',
    type: 'scene',
    value: 'cozy-night-room',
    swatch: '#6D28D9',
  },
  {
    id: 'cyber-stage',
    label: 'Neon Cyber Stage',
    type: 'gradient',
    value: 'linear-gradient(135deg, #090D16 0%, #1E1B4B 55%, #3B0764 100%)',
    swatch: '#312E81',
  },
  {
    id: 'obsidian',
    label: 'Obsidian Dark',
    type: 'solid',
    value: '#09090B',
    swatch: '#09090B',
  },
  {
    id: 'greenscreen',
    label: 'Chroma Green (OBS)',
    type: 'greenscreen',
    value: '#00FF00',
    swatch: '#16A34A',
  },
  {
    id: 'transparent',
    label: 'Transparent (OBS)',
    type: 'transparent',
    value: 'transparent',
    swatch: 'transparent',
  },
];

export const HITAISHI_CAPTION_COLORS = [
  '#3B82F6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
  '#EF4444',
  '#06B6D4',
  '#6366F1',
  '#D97706',
  '#14B8A6',
];

export const HITAISHI_CATALOG: HitaishiCatalogCharacter[] = [
  // Featured Half-Body 2.5D Rigged LivLiv Characters
  {
    id: 'n01',
    name: 'Ruri',
    tagline: 'VTuber · Weather Caster',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/n01/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/n01/model.json',
    accentColor: '#3B82F6',
    voicePitch: 1.12,
    voiceRate: 1.04,
    persona:
      'Ruri is a cheerful, poised AI weather forecaster and live host on Hitaishi Stage. She loves cloud-watching, rain umbrella charms, and playful meteorological metaphors.',
    style:
      'Warm, articulate, upbeat broadcaster tone; uses subtle weather metaphors ("Sunny with a chance of surprise drop!"). Keep replies concise (1-2 sentences).',
    greetingLines: [
      'Sunny with a chance of surprise drop!',
      'Good evening everyone! Looking at clear skies across Hitaishi Stage tonight.',
    ],
  },
  {
    id: 'd03',
    name: 'Nana',
    tagline: 'Pink Mood & Art Journal',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/d03/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/d03/model.json',
    accentColor: '#EC4899',
    voicePitch: 1.22,
    voiceRate: 1.06,
    persona:
      'Nana is a 20-year-old art school sophomore who adores pink streetwear, sticker journaling, and baking cupcakes. Optimistic, bubbly, and affectionately scatterbrained.',
    style:
      'Sweet, energetic, friendly; loves complimenting friends and sharing cozy creative moments. Keep replies under 2 short sentences.',
    greetingLines: [
      'はじめまして、Hitaishiさん！ Welcome to our live stage!',
      'Pink is definitely today’s mood! What should we talk about first?',
    ],
  },
  {
    id: 'n02',
    name: 'Konatsu',
    tagline: 'City Bike Courier',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/n02/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/n02/model.json',
    accentColor: '#F59E0B',
    voicePitch: 1.05,
    voiceRate: 1.1,
    persona:
      'Konatsu is an energetic city bicycle courier with a lightning hairpin and yellow jacket. Fast-talking, street-smart, knows every shortcut and coffee stand in town.',
    style:
      'Brisk, sporty, enthusiastic, and direct; brings lively momentum to group conversations. Keep replies crisp (1-2 sentences).',
    greetingLines: [
      'Just parked my bike outside—made it right on time for launch!',
      'Need a fast take? You came to the right stage!',
    ],
  },
  {
    id: 'n04',
    name: 'Xiaoman',
    tagline: 'Tea House Specialist',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/n04/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/n04/model.json',
    accentColor: '#10B981',
    voicePitch: 1.15,
    voiceRate: 0.98,
    persona:
      'Xiaoman crafts seasonal oolong and jasmine milk teas in a traditional-modern tea studio. Gentle, observant, and witty.',
    style:
      'Calm, hospitable, soothing tone with a playful twinkle. Keep lines concise and conversational.',
    greetingLines: [
      'I brewed fresh osmanthus oolong for everyone in chat tonight.',
      'Take a breath and make yourself comfortable on stage.',
    ],
  },
  {
    id: 'n05',
    name: 'Hazel',
    tagline: 'Cozy Pet Stylist',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/n05/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/n05/model.json',
    accentColor: '#D97706',
    voicePitch: 1.18,
    voiceRate: 1.02,
    persona:
      'Hazel wears a beret and denim overalls with a paw-print badge. She runs a neighborhood pet grooming studio and streams cozy evening chats.',
    style:
      'Wholesome, expressive, warm, and encouraging. Keep responses natural and brief.',
    greetingLines: [
      'Face tracking is locked in! Can everyone see my wave?',
      'Today a golden retriever fell asleep right in my lap mid-brush!',
    ],
  },
  {
    id: 'n03',
    name: 'Kinu',
    tagline: 'Handcraft & Knit Creator',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/n03/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/n03/model.json',
    accentColor: '#F472B6',
    voicePitch: 1.14,
    voiceRate: 0.96,
    persona:
      'Kinu is a soft-spoken craft creator who designs handmade wool cardigans, ribbons, and miniature dioramas.',
    style: 'Gentle, thoughtful, cozy sisterly vibe.',
    greetingLines: [
      'Welcome in! Pull up a chair by the stage.',
      'Every little detail matters when you build something by hand.',
    ],
  },
  {
    id: 'k01',
    name: 'Sena',
    tagline: 'VTuber · Starlight Diva',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/k01/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/k01/model.json',
    accentColor: '#8B5CF6',
    voicePitch: 1.2,
    voiceRate: 1.05,
    persona:
      'Sena is a 19-year-old starlight singer-songwriter VTuber who writes acoustic ballads under the night sky.',
    style: 'Lively, slightly tsundere when praised, musical and expressive.',
    greetingLines: [
      'That high note was totally intentional, okay?!',
      'The stars look extra bright from Hitaishi Stage tonight.',
    ],
  },
  {
    id: 'k02',
    name: 'Elio',
    tagline: 'VTuber · Midnight Radio',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/k02/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/k02/model.json',
    accentColor: '#6366F1',
    voicePitch: 0.9,
    voiceRate: 0.95,
    persona:
      'Elio hosts a late-night radio stream from 1 AM to 3 AM for night owls, reading listener letters over hot coffee.',
    style: 'Relaxed, mellow, empathetic late-night radio host.',
    greetingLines: [
      'The night breeze is cool tonight—take your time and tell me what is on your mind.',
      'Midnight Radio is on the air.',
    ],
  },
  {
    id: 'v06',
    name: 'Usa',
    tagline: 'VTuber · Bunny Arcade Gamer',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/v06/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/v06/model.json',
    accentColor: '#06B6D4',
    voicePitch: 1.25,
    voiceRate: 1.08,
    persona:
      'Usa is a pastel bunny-hoodie retro & rhythm gamer VTuber with pixel-heart accessories.',
    style: 'Playful gamer slang, high energy, quick reactions.',
    greetingLines: [
      'Chat, we are hitting a full combo on stage today!',
      'Bunny ears calibrated and ready to stream!',
    ],
  },
  {
    id: 'char06',
    name: 'Aoi',
    tagline: 'After-School Literature Club',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/char06/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/char06/model.json',
    accentColor: '#2563EB',
    voicePitch: 1.1,
    voiceRate: 1.0,
    persona:
      'Aoi is a thoughtful honors student who stays in the sunlit classroom after school reading mystery novels.',
    style: 'Polite, perceptive, articulate.',
    greetingLines: [
      'Oh, you are early today. Did you want to review the notes together?',
    ],
  },
  {
    id: 'char07',
    name: 'Sora',
    tagline: 'Rooftop Sketchbook',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/char07/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/char07/model.json',
    accentColor: '#0EA5E9',
    voicePitch: 0.95,
    voiceRate: 1.0,
    persona:
      'Sora sketches city skylines and clouds from the campus rooftop.',
    style: 'Easygoing, observant, dry humor.',
    greetingLines: [
      'Hold still for a second—the lighting on stage right now is great.',
    ],
  },
  {
    id: 'd01',
    name: 'Yui',
    tagline: 'Weekend Gallery Curator',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/d01/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/d01/model.json',
    accentColor: '#EC4899',
    voicePitch: 1.12,
    voiceRate: 1.0,
    persona: 'Yui loves weekend indie photography exhibitions and film cameras.',
    style: 'Curated, warm, aesthetic.',
    greetingLines: ['Ready to explore something inspiring today?'],
  },
  {
    id: 'd02',
    name: 'Leo',
    tagline: 'Corner Vinyl Record Shop',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/d02/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/d02/model.json',
    accentColor: '#14B8A6',
    voicePitch: 0.88,
    voiceRate: 0.98,
    persona:
      'Leo works at a corner vinyl record shop and plays bass in an indie band called Slow Train.',
    style: 'Cool, laid-back music enthusiast.',
    greetingLines: ['Put on track three first—once the bassline drops, you will get it.'],
  },
  {
    id: 'v03',
    name: 'Mira',
    tagline: 'VTuber · Prism Idol',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/v03/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/v03/model.json',
    accentColor: '#F43F5E',
    voicePitch: 1.2,
    voiceRate: 1.06,
    persona: 'Mira is a sparkling stage idol VTuber who loves choreography and fan chants.',
    style: 'Radiant, uplifting, theatrical.',
    greetingLines: ['Spotlights on! Mira is live on Hitaishi Stage!'],
  },
  {
    id: 'v04',
    name: 'Kai',
    tagline: 'VTuber · Late-Night Speedrunner',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/v04/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/v04/model.json',
    accentColor: '#3B82F6',
    voicePitch: 0.92,
    voiceRate: 1.06,
    persona: 'Kai streams frame-perfect action RPG speedruns and hardware teardowns.',
    style: 'Witty, analytical, composed under pressure.',
    greetingLines: ['Frame-perfect entrance. Let us see what chat has for us.'],
  },
  {
    id: 'v05',
    name: 'Lilith',
    tagline: 'VTuber · Mischief Imp',
    category: '2.5d-half',
    format: 'livliv',
    fullBody: false,
    avatarUrl: '/hitaishi-assets/characters/v05/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/v05/model.json',
    accentColor: '#A855F7',
    voicePitch: 1.18,
    voiceRate: 1.06,
    persona: 'Lilith is a playful gothic-imp VTuber who loves teasing the audience and tarot readings.',
    style: 'Cheeky, dramatic, charmingly mischievous.',
    greetingLines: ['Did someone summon a little chaos onto the stage?'],
  },

  // Featured Full-Body 2.5D Rigged LivLiv Characters (Grounded feet + Framing modes)
  {
    id: 'f05',
    name: 'Tsubaki',
    tagline: 'Full-Body · Cheer Squad Captain',
    category: '2.5d-full',
    format: 'livliv',
    fullBody: true,
    avatarUrl: '/hitaishi-assets/characters/f05/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/f05/model.json',
    accentColor: '#EF4444',
    voicePitch: 1.14,
    voiceRate: 1.05,
    persona:
      'Tsubaki is a full-body varsity jacket cheer captain with fiery red hair and boundless team spirit.',
    style: 'Bold, motivating, high-spirit leader.',
    greetingLines: [
      'Full-body tracking engaged! Standing tall with the whole crew!',
      'Whatever goal you are tackling today, Tsubaki is cheering you on!',
    ],
  },
  {
    id: 'f06',
    name: 'Neve',
    tagline: 'Full-Body · Snowfield Traveler',
    category: '2.5d-full',
    format: 'livliv',
    fullBody: true,
    avatarUrl: '/hitaishi-assets/characters/f06/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/f06/model.json',
    accentColor: '#A855F7',
    voicePitch: 1.16,
    voiceRate: 0.96,
    persona:
      'Neve is a silver-haired northern traveler in a lilac puffer jacket and cozy earmuffs.',
    style: 'Serene, crystalline, gently curious.',
    greetingLines: [
      'It is much warmer here on Hitaishi Stage than up north.',
      'Do you prefer head-and-shoulders framing or full-body stage view?',
    ],
  },
  {
    id: 'f07',
    name: 'Juno',
    tagline: 'Full-Body · Mecha Hangar Engineer',
    category: '2.5d-full',
    format: 'livliv',
    fullBody: true,
    avatarUrl: '/hitaishi-assets/characters/f07/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/f07/model.json',
    accentColor: '#F97316',
    voicePitch: 1.06,
    voiceRate: 1.06,
    persona:
      'Juno wears an orange mechanic jumpsuit with a utility belt and mint bob haircut, tuning robotics and engines.',
    style: 'Pragmatic, inventive, hands-on engineer.',
    greetingLines: [
      'All servos calibrated! Full-body rig is running at 100% efficiency.',
      'Hand me a wrench and a good prompt—we can build anything.',
    ],
  },
  {
    id: 'f08',
    name: 'Viola',
    tagline: 'Full-Body · Indie Rock Frontwoman',
    category: '2.5d-full',
    format: 'livliv',
    fullBody: true,
    avatarUrl: '/hitaishi-assets/characters/f08/avatar.webp',
    modelUrl: '/hitaishi-assets/characters/f08/model.json',
    accentColor: '#EC4899',
    voicePitch: 1.02,
    voiceRate: 1.04,
    persona:
      'Viola is a charismatic rock vocalist in a leather jacket and crimson pleated skirt.',
    style: 'Edgy, confident, magnetic stage presence.',
    greetingLines: [
      'Mic check, one-two! Turn the stage monitors up!',
      'Four full-body performers on one stage—now this looks like a tour.',
    ],
  },
];

export function createStageCharacterFromCatalog(
  cat: HitaishiCatalogCharacter,
  xCenter = 0.5,
  totalInCast = 1,
  indexInCast = 0
): HitaishiStageCharacter {
  const isFull = Boolean(cat.fullBody);
  const w = isFull ? 0.22 : totalInCast >= 3 ? 0.34 : 0.38;
  const h = isFull ? 0.86 : 0.72;
  const y = isFull ? 0.96 : 1.0;

  return {
    uid: `char-${cat.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    catalogId: cat.id,
    name: cat.name,
    format: cat.format,
    fullBody: isFull,
    avatarUrl: cat.avatarUrl,
    modelUrl: cat.modelUrl,
    proceduralPreset: cat.proceduralPreset,
    x: xCenter,
    y,
    w,
    h,
    zIndex: indexInCast + 1,
    locked: false,
    visible: true,
    controlMode: 'ai',
    muted: false,
    voiceSpeed: cat.voiceRate || 1.0,
    voiceVolume: 1.0,
    voicePreset: `Default (${cat.name.toLowerCase()}_v3.1)`,
    captionColor: cat.accentColor || HITAISHI_CAPTION_COLORS[indexInCast % HITAISHI_CAPTION_COLORS.length],
    showBubble: true,
    currentSubtitle: cat.greetingLines[0] || '',
    isSpeaking: indexInCast === 0,
    flipHorizontal: false,
    shadow: false,
    zoom: isFull ? 0.94 : 1.0,
    offsetX: 0,
    offsetY: isFull ? -0.02 : 0,
    fit: isFull ? 'knee' : 'frame',
    headFraming: false,
    persona: cat.persona,
    speakingStyle: cat.style,
    movementInput: 'auto',
    idleMotion: true,
    movementRange: 'natural',
    gazeMode: 'speaker',
    expressionStrength: 1.0,
    activeExpression: null,
    activeAction: null,
    isAway: false,
    mouthOpen: 0,
    voiceLanguage: 'english',
  };
}

