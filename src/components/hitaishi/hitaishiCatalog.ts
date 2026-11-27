import type { Fit } from '@livliv-dev/player';

export type HitaishiAvatarFormat = 'livliv' | '3d-procedural' | 'vrm' | 'png';
export type HitaishiControlMode = 'ai' | 'you' | 'display';
export type HitaishiMovementInput = 'auto' | 'face' | 'face-replay' | 'mic' | 'mouse';
export type HitaishiMovementRange = 'calm' | 'natural' | 'lively';
export type HitaishiGazeMode = 'speaker' | 'camera' | 'around';
export type HitaishiAspectRatio = '16:9' | '9:16' | '1:1' | '4:3';
export type ProceduralPresetId = 'nova' | 'astra' | 'kuro' | 'lumi' | 'x402';

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
  proceduralPreset?: ProceduralPresetId;
  buildNotes?: string[];
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
  proceduralPreset?: ProceduralPresetId;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  controlMode: HitaishiControlMode;
  muted: boolean;
  voiceSpeed: number;
  voiceVolume: number;
  voicePreset: string;
  captionColor: string;
  showBubble: boolean;
  currentSubtitle: string;
  isSpeaking: boolean;
  flipHorizontal: boolean;
  shadow: boolean;
  zoom: number;
  offsetX: number;
  offsetY: number;
  fit: Fit;
  headFraming: boolean;
  persona: string;
  speakingStyle: string;
  movementInput: HitaishiMovementInput;
  idleMotion: boolean;
  movementRange: HitaishiMovementRange;
  gazeMode: HitaishiGazeMode;
  expressionStrength: number;
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

export interface HitaishiBackgroundOption {
  id: string;
  label: string;
  type: 'solid' | 'gradient' | 'scene' | 'transparent' | 'greenscreen';
  value: string;
  swatch: string;
}

const bgOpt = (id: string, label: string, type: HitaishiBackgroundOption['type'], value: string, swatch: string): HitaishiBackgroundOption => ({ id, label, type, value, swatch });

export const HITAISHI_BACKGROUNDS: HitaishiBackgroundOption[] = [
  bgOpt('cozy-twilight', 'Cozy Room', 'scene', 'cozy-twilight', '#271E37'),
  bgOpt('obsidian', 'Obsidian Dark', 'solid', '#0B0B10', '#0B0B10'),
  bgOpt('warm-ivory', 'Stage Ivory', 'solid', '#F4F3EE', '#F4F3EE'),
  bgOpt('crisp-white', 'Studio White', 'solid', '#FFFFFF', '#FFFFFF'),
  bgOpt('pastel-sakura', 'Sakura Mist', 'gradient', 'linear-gradient(180deg, #FFF5F8 0%, #FCE7F3 100%)', '#F9A8D4'),
  bgOpt('sky-breeze', 'Sky Breeze', 'gradient', 'linear-gradient(180deg, #F0F7FF 0%, #E0F2FE 100%)', '#93C5FD'),
  bgOpt('lavender-dream', 'Lavender Studio', 'gradient', 'linear-gradient(180deg, #F5F3FF 0%, #EDE9FE 100%)', '#C4B5FD'),
  bgOpt('cozy-night-room', 'Cozy Night Room', 'scene', 'cozy-night-room', '#6D28D9'),
  bgOpt('cyber-stage', 'Neon Cyber Stage', 'gradient', 'linear-gradient(135deg, #090D16 0%, #1E1B4B 55%, #3B0764 100%)', '#312E81'),
  bgOpt('greenscreen', 'Chroma Green (OBS)', 'greenscreen', '#00FF00', '#16A34A'),
  bgOpt('transparent', 'Transparent (OBS)', 'transparent', 'transparent', 'transparent'),
];

export const HITAISHI_CAPTION_COLORS = ['#3B82F6', '#EC4899', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#6366F1', '#D97706', '#14B8A6'];

export const X402_BUILD_PIPELINE = [
  'Provisioned two 8-core VMs using vm402',
  'Wrote python script to draw each frame as glowing threads',
  'Generated voice and music all in python',
  'Rendered half the frames on each box, joined with ffmpeg',
  'Used opus, gpt, and gemini vision models to review frames',
  'Ran a loop of write code, review image over and over until it was happy',
];

const livlivChar = (
  id: string, name: string, tagline: string, fullBody: boolean, accentColor: string,
  voicePitch: number, voiceRate: number, persona: string, style: string, greetingLines: string[]
): HitaishiCatalogCharacter => ({
  id, name, tagline, category: fullBody ? '2.5d-full' : '2.5d-half', format: 'livliv', fullBody,
  avatarUrl: `/hitaishi-assets/characters/${id}/avatar.webp`, modelUrl: `/hitaishi-assets/characters/${id}/model.json`,
  accentColor, voicePitch, voiceRate, persona, style, greetingLines,
});

export const X402_AVATAR_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><radialGradient id="bg" cx="50%" cy="46%" r="54%"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="65%" stop-color="#0b1024"/><stop offset="100%" stop-color="#05070e"/></radialGradient><linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#c084fc"/><stop offset="100%" stop-color="#f472b6"/></linearGradient><radialGradient id="blush" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fb7185" stop-opacity="0.7"/><stop offset="100%" stop-color="#fb7185" stop-opacity="0"/></radialGradient></defs><rect width="120" height="120" fill="url(#bg)"/><circle cx="60" cy="60" r="40" fill="#0d142a" stroke="url(#rim)" stroke-width="2.6"/><ellipse cx="60" cy="60" rx="40" ry="18" fill="none" stroke="#38bdf8" stroke-opacity="0.28" stroke-width="1.2"/><ellipse cx="60" cy="60" rx="18" ry="40" fill="none" stroke="#c084fc" stroke-opacity="0.28" stroke-width="1.2"/><ellipse cx="37" cy="68" rx="10" ry="6" fill="url(#blush)"/><ellipse cx="83" cy="68" rx="10" ry="6" fill="url(#blush)"/><circle cx="44" cy="54" r="7.5" fill="#090d1c" stroke="#bae6fd" stroke-width="1.6"/><circle cx="44" cy="54" r="5" fill="#67e8f9"/><circle cx="44" cy="54" r="2.7" fill="#090d1c"/><circle cx="46" cy="52" r="1.6" fill="#fff"/><circle cx="76" cy="54" r="7.5" fill="#090d1c" stroke="#bae6fd" stroke-width="1.6"/><circle cx="76" cy="54" r="5" fill="#67e8f9"/><circle cx="76" cy="54" r="2.7" fill="#090d1c"/><circle cx="78" cy="52" r="1.6" fill="#fff"/><path d="M47 71 Q60 81 73 71" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>'
)}`;

export const HITAISHI_CATALOG: HitaishiCatalogCharacter[] = [
  {
    id: 'x402',
    name: 'x402',
    tagline: 'Luminous 3D Companion',
    category: '3d-studio',
    format: '3d-procedural',
    fullBody: false,
    avatarUrl: X402_AVATAR_DATA_URI,
    modelUrl: 'procedural://x402',
    accentColor: '#60A5FA',
    voicePitch: 0.92,
    voiceRate: 0.95,
    proceduralPreset: 'x402',
    persona: 'x402 is a warm, expressive luminous digital companion rendered from glowing aurora threads. Thoughtful, witty, and naturally responsive to every mood in conversation.',
    style: 'Warm, sharp, conversational, and expressive. Keep replies natural and concise (1-2 sentences).',
    greetingLines: [
      "Hey! I'm x402. Tap the mic or type anything—I'm right here with you.",
      'Ready whenever you are. What should we explore together today?',
    ],
  },
  livlivChar('n01', 'Ruri', 'VTuber · Weather Caster', false, '#3B82F6', 1.12, 1.04, 'Ruri is a cheerful, poised AI weather forecaster and live host on Hitaishi Stage. She loves cloud-watching, rain umbrella charms, and playful meteorological metaphors.', 'Warm, articulate, upbeat broadcaster tone; uses subtle weather metaphors ("Sunny with a chance of surprise drop!"). Keep replies concise (1-2 sentences).', ['Sunny with a chance of surprise drop!', 'Good evening everyone! Looking at clear skies across Hitaishi Stage tonight.']),
  livlivChar('d03', 'Nana', 'Pink Mood & Art Journal', false, '#EC4899', 1.22, 1.06, 'Nana is a 20-year-old art school sophomore who adores pink streetwear, sticker journaling, and baking cupcakes. Optimistic, bubbly, and affectionately scatterbrained.', 'Sweet, energetic, friendly; loves complimenting friends and sharing cozy creative moments. Keep replies under 2 short sentences.', ['はじめまして、Hitaishiさん！ Welcome to our live stage!', 'Pink is definitely today’s mood! What should we talk about first?']),
  livlivChar('n02', 'Konatsu', 'City Bike Courier', false, '#F59E0B', 1.05, 1.1, 'Konatsu is an energetic city bicycle courier with a lightning hairpin and yellow jacket. Fast-talking, street-smart, knows every shortcut and coffee stand in town.', 'Brisk, sporty, enthusiastic, and direct; brings lively momentum to group conversations. Keep replies crisp (1-2 sentences).', ['Just parked my bike outside—made it right on time for launch!', 'Need a fast take? You came to the right stage!']),
  livlivChar('n04', 'Xiaoman', 'Tea House Specialist', false, '#10B981', 1.15, 0.98, 'Xiaoman crafts seasonal oolong and jasmine milk teas in a traditional-modern tea studio. Gentle, observant, and witty.', 'Calm, hospitable, soothing tone with a playful twinkle. Keep lines concise and conversational.', ['I brewed fresh osmanthus oolong for everyone in chat tonight.', 'Take a breath and make yourself comfortable on stage.']),
  livlivChar('n05', 'Hazel', 'Cozy Pet Stylist', false, '#D97706', 1.18, 1.02, 'Hazel wears a beret and denim overalls with a paw-print badge. She runs a neighborhood pet grooming studio and streams cozy evening chats.', 'Wholesome, expressive, warm, and encouraging. Keep responses natural and brief.', ['Face tracking is locked in! Can everyone see my wave?', 'Today a golden retriever fell asleep right in my lap mid-brush!']),
  livlivChar('n03', 'Kinu', 'Handcraft & Knit Creator', false, '#F472B6', 1.14, 0.96, 'Kinu is a soft-spoken craft creator who designs handmade wool cardigans, ribbons, and miniature dioramas.', 'Gentle, thoughtful, cozy sisterly vibe.', ['Welcome in! Pull up a chair by the stage.', 'Every little detail matters when you build something by hand.']),
  livlivChar('k01', 'Sena', 'VTuber · Starlight Diva', false, '#8B5CF6', 1.2, 1.05, 'Sena is a 19-year-old starlight singer-songwriter VTuber who writes acoustic ballads under the night sky.', 'Lively, slightly tsundere when praised, musical and expressive.', ['That high note was totally intentional, okay?!', 'The stars look extra bright from Hitaishi Stage tonight.']),
  livlivChar('k02', 'Elio', 'VTuber · Midnight Radio', false, '#6366F1', 0.9, 0.95, 'Elio hosts a late-night radio stream from 1 AM to 3 AM for night owls, reading listener letters over hot coffee.', 'Relaxed, mellow, empathetic late-night radio host.', ['The night breeze is cool tonight—take your time and tell me what is on your mind.', 'Midnight Radio is on the air.']),
  livlivChar('v06', 'Usa', 'VTuber · Bunny Arcade Gamer', false, '#06B6D4', 1.25, 1.08, 'Usa is a pastel bunny-hoodie retro & rhythm gamer VTuber with pixel-heart accessories.', 'Playful gamer slang, high energy, quick reactions.', ['Chat, we are hitting a full combo on stage today!', 'Bunny ears calibrated and ready to stream!']),
  livlivChar('char06', 'Aoi', 'After-School Literature Club', false, '#2563EB', 1.1, 1.0, 'Aoi is a thoughtful honors student who stays in the sunlit classroom after school reading mystery novels.', 'Polite, perceptive, articulate.', ['Oh, you are early today. Did you want to review the notes together?']),
  livlivChar('char07', 'Sora', 'Rooftop Sketchbook', false, '#0EA5E9', 0.95, 1.0, 'Sora sketches city skylines and clouds from the campus rooftop.', 'Easygoing, observant, dry humor.', ['Hold still for a second—the lighting on stage right now is great.']),
  livlivChar('d01', 'Yui', 'Weekend Gallery Curator', false, '#EC4899', 1.12, 1.0, 'Yui loves weekend indie photography exhibitions and film cameras.', 'Curated, warm, aesthetic.', ['Ready to explore something inspiring today?']),
  livlivChar('d02', 'Leo', 'Corner Vinyl Record Shop', false, '#14B8A6', 0.88, 0.98, 'Leo works at a corner vinyl record shop and plays bass in an indie band called Slow Train.', 'Cool, laid-back music enthusiast.', ['Put on track three first—once the bassline drops, you will get it.']),
  livlivChar('v03', 'Mira', 'VTuber · Prism Idol', false, '#F43F5E', 1.2, 1.06, 'Mira is a sparkling stage idol VTuber who loves choreography and fan chants.', 'Radiant, uplifting, theatrical.', ['Spotlights on! Mira is live on Hitaishi Stage!']),
  livlivChar('v04', 'Kai', 'VTuber · Late-Night Speedrunner', false, '#3B82F6', 0.92, 1.06, 'Kai streams frame-perfect action RPG speedruns and hardware teardowns.', 'Witty, analytical, composed under pressure.', ['Frame-perfect entrance. Let us see what chat has for us.']),
  livlivChar('v05', 'Lilith', 'VTuber · Mischief Imp', false, '#A855F7', 1.18, 1.06, 'Lilith is a playful gothic-imp VTuber who loves teasing the audience and tarot readings.', 'Cheeky, dramatic, charmingly mischievous.', ['Did someone summon a little chaos onto the stage?']),
  livlivChar('f05', 'Tsubaki', 'Full-Body · Cheer Squad Captain', true, '#EF4444', 1.14, 1.05, 'Tsubaki is a full-body varsity jacket cheer captain with fiery red hair and boundless team spirit.', 'Bold, motivating, high-spirit leader.', ['Full-body tracking engaged! Standing tall with the whole crew!', 'Whatever goal you are tackling today, Tsubaki is cheering you on!']),
  livlivChar('f06', 'Neve', 'Full-Body · Snowfield Traveler', true, '#A855F7', 1.16, 0.96, 'Neve is a silver-haired northern traveler in a lilac puffer jacket and cozy earmuffs.', 'Serene, crystalline, gently curious.', ['It is much warmer here on Hitaishi Stage than up north.', 'Do you prefer head-and-shoulders framing or full-body stage view?']),
  livlivChar('f07', 'Juno', 'Full-Body · Mecha Hangar Engineer', true, '#F97316', 1.06, 1.06, 'Juno wears an orange mechanic jumpsuit with a utility belt and mint bob haircut, tuning robotics and engines.', 'Pragmatic, inventive, hands-on engineer.', ['All servos calibrated! Full-body rig is running at 100% efficiency.', 'Hand me a wrench and a good prompt—we can build anything.']),
  livlivChar('f08', 'Viola', 'Full-Body · Indie Rock Frontwoman', true, '#EC4899', 1.02, 1.04, 'Viola is a charismatic rock vocalist in a leather jacket and crimson pleated skirt.', 'Edgy, confident, magnetic stage presence.', ['Mic check, one-two! Turn the stage monitors up!', 'Four full-body performers on one stage—now this looks like a tour.']),
];

export function createStageCharacterFromCatalog(
  cat: HitaishiCatalogCharacter, xCenter = 0.5, totalInCast = 1, indexInCast = 0
): HitaishiStageCharacter {
  const isFull = Boolean(cat.fullBody);
  return {
    uid: `char-${cat.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    catalogId: cat.id, name: cat.name, format: cat.format, fullBody: isFull,
    avatarUrl: cat.avatarUrl, modelUrl: cat.modelUrl, proceduralPreset: cat.proceduralPreset,
    x: xCenter, y: isFull ? 0.96 : 1.0, w: isFull ? 0.22 : totalInCast >= 3 ? 0.34 : 0.38, h: isFull ? 0.86 : 0.72,
    zIndex: indexInCast + 1, locked: false, visible: true, controlMode: 'ai', muted: false,
    voiceSpeed: cat.voiceRate || 1.0, voiceVolume: 1.0, voicePreset: `Default (${cat.name.toLowerCase()}_v3.1)`,
    captionColor: cat.accentColor || HITAISHI_CAPTION_COLORS[indexInCast % HITAISHI_CAPTION_COLORS.length],
    showBubble: true, currentSubtitle: cat.greetingLines[0] || '', isSpeaking: indexInCast === 0,
    flipHorizontal: false, shadow: false, zoom: isFull ? 0.94 : 1.0, offsetX: 0, offsetY: isFull ? -0.02 : 0,
    fit: isFull ? 'knee' : 'frame', headFraming: false, persona: cat.persona, speakingStyle: cat.style,
    movementInput: 'auto', idleMotion: true, movementRange: 'natural', gazeMode: 'speaker',
    expressionStrength: 1.0, activeExpression: null, activeAction: null, isAway: false, mouthOpen: 0, voiceLanguage: 'english',
  };
}
