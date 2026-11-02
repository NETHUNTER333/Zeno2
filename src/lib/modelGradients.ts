/**
 * Signature Radiant Gradients for Zeno Models & Canvas Backgrounds
 * Inspired by high-saturation radiant sunlight, diffuse top dome spotlights,
 * and sunset orange/peach luminous warmth.
 */

export interface ModelGradientTheme {
  id: string;
  name: string;
  tagline: string;
  primary: string; // Vibrant accent
  secondary: string; // Ambient spread
  tertiary: string; // Highlight core
  glowRgba: string;
  swatchGradient: string;
  // CSS styles for canvas background
  lightBackgroundCss: string;
  darkBackgroundCss: string;
  // Static image backdrop option directly referencing the user's uploaded gradient
  backdropImage?: string;
  lightTopSpotlight: string;
  darkTopSpotlight: string;
}

export const EXACT_SUNSET_ORANGE_THEME: ModelGradientTheme = {
  id: 'sunset-orange',
  name: 'Sky Orange & White Mist',
  tagline: 'Airy pearl white, soft sky-apricot & gentle morning sunset',
  primary: '#ff944d',
  secondary: '#ffc299',
  tertiary: '#fff7f0',
  glowRgba: 'rgba(255, 158, 94, 0.32)',
  swatchGradient: 'linear-gradient(135deg, #ffffff 0%, #ffd1b0 45%, #ff8c42 100%)',
  backdropImage: '/assets/aistudio/IMG_b19e3948-9e9c-40a0-92b9-9924f87dff0f_d403c7fb.jpg',
  lightBackgroundCss:
    'linear-gradient(180deg, #fffaf5 0%, #ffe6d1 22%, #ffd2b0 42%, #ffefe0 68%, #fffdfb 88%, #ffffff 100%)',
  darkBackgroundCss:
    'linear-gradient(180deg, #17110e 0%, #100c0a 32%, #0a0807 65%, #060606 100%)',
  lightTopSpotlight:
    'radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255, 255, 255, 1) 0%, rgba(255, 250, 244, 0.94) 34%, rgba(255, 184, 130, 0.35) 68%, rgba(255, 255, 255, 0) 100%)',
  darkTopSpotlight:
    'radial-gradient(ellipse 100% 55% at 50% -10%, rgba(255, 248, 242, 0.24) 0%, rgba(255, 204, 166, 0.16) 34%, rgba(255, 150, 85, 0.07) 65%, transparent 100%)',
};

export const MODEL_GRADIENT_THEMES: Record<string, ModelGradientTheme> = {
  // DeepSeek Family (Whity Sky-Orange Morning Mist)
  deepseek: EXACT_SUNSET_ORANGE_THEME,

  // GLM Family (Soft Sky Lavender & Pearl White)
  glm: {
    id: 'amethyst-violet',
    name: 'Sky Lavender Mist',
    tagline: 'Airy pearl white, pastel lilac & soft lavender sky',
    primary: '#b779f7',
    secondary: '#dfc2ff',
    tertiary: '#faf5ff',
    glowRgba: 'rgba(183, 121, 247, 0.28)',
    swatchGradient: 'linear-gradient(135deg, #ffffff 0%, #e5d0ff 48%, #a855f7 100%)',
    lightBackgroundCss:
      'linear-gradient(180deg, #fcfaff 0%, #f1e4ff 22%, #e5d0ff 42%, #f6eeff 68%, #fdfbff 88%, #ffffff 100%)',
    darkBackgroundCss:
      'linear-gradient(180deg, #14101a 0%, #0e0b13 32%, #09070c 65%, #060606 100%)',
    lightTopSpotlight:
      'radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255, 255, 255, 1) 0%, rgba(251, 247, 255, 0.94) 34%, rgba(206, 166, 255, 0.32) 68%, rgba(255, 255, 255, 0) 100%)',
    darkTopSpotlight:
      'radial-gradient(ellipse 100% 55% at 50% -10%, rgba(250, 245, 255, 0.22) 0%, rgba(216, 180, 254, 0.14) 34%, rgba(168, 85, 247, 0.06) 65%, transparent 100%)',
  },

  // Qwen Family (Airy Sky Cyan & Cloud White)
  qwen: {
    id: 'ocean-cyan',
    name: 'Cloud Cyan Sky',
    tagline: 'Pure cloud white, soft ice-blue & pastel sky cyan',
    primary: '#38bdf8',
    secondary: '#bae6fd',
    tertiary: '#f0f9ff',
    glowRgba: 'rgba(56, 189, 248, 0.28)',
    swatchGradient: 'linear-gradient(135deg, #ffffff 0%, #bae6fd 48%, #38bdf8 100%)',
    lightBackgroundCss:
      'linear-gradient(180deg, #f7fcff 0%, #dff2fe 22%, #c8eafd 42%, #edf8ff 68%, #fafdff 88%, #ffffff 100%)',
    darkBackgroundCss:
      'linear-gradient(180deg, #0c1418 0%, #090f12 32%, #06090b 65%, #050505 100%)',
    lightTopSpotlight:
      'radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255, 255, 255, 1) 0%, rgba(244, 251, 255, 0.94) 34%, rgba(125, 211, 252, 0.32) 68%, rgba(255, 255, 255, 0) 100%)',
    darkTopSpotlight:
      'radial-gradient(ellipse 100% 55% at 50% -10%, rgba(240, 249, 255, 0.22) 0%, rgba(186, 230, 253, 0.14) 34%, rgba(56, 189, 248, 0.06) 65%, transparent 100%)',
  },

  // Claude Family (Soft Peach-Amber & Creamy White Sky)
  claude: {
    id: 'terracotta-amber',
    name: 'Creamy Peach & Honey Sky',
    tagline: 'Warm ivory white, soft apricot & sunlit honey mist',
    primary: '#f59e0b',
    secondary: '#fde68a',
    tertiary: '#fffbeb',
    glowRgba: 'rgba(245, 158, 11, 0.28)',
    swatchGradient: 'linear-gradient(135deg, #ffffff 0%, #fde68a 48%, #f59e0b 100%)',
    backdropImage: '/assets/aistudio/IMG_f15b9024-053c-4665-9ad8-fde18e6bca08_1a22887e.jpg',
    lightBackgroundCss:
      'linear-gradient(180deg, #fffdf7 0%, #ffefd1 22%, #ffe2b3 42%, #fff5e3 68%, #fffdf9 88%, #ffffff 100%)',
    darkBackgroundCss:
      'linear-gradient(180deg, #17120c 0%, #110d09 32%, #0a0806 65%, #060606 100%)',
    lightTopSpotlight:
      'radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255, 255, 255, 1) 0%, rgba(255, 251, 242, 0.94) 34%, rgba(252, 200, 125, 0.34) 68%, rgba(255, 255, 255, 0) 100%)',
    darkTopSpotlight:
      'radial-gradient(ellipse 100% 55% at 50% -10%, rgba(255, 251, 235, 0.23) 0%, rgba(253, 215, 155, 0.15) 34%, rgba(245, 158, 11, 0.06) 65%, transparent 100%)',
  },

  // GPT / OpenAI Family (Soft Mint Cloud & White Sky)
  gpt: {
    id: 'emerald-aurora',
    name: 'Mint Cloud Sky',
    tagline: 'Pure white mist, pastel seafoam & gentle mint breeze',
    primary: '#34d399',
    secondary: '#a7f3d0',
    tertiary: '#ecfdf5',
    glowRgba: 'rgba(52, 211, 153, 0.28)',
    swatchGradient: 'linear-gradient(135deg, #ffffff 0%, #a7f3d0 48%, #10b981 100%)',
    lightBackgroundCss:
      'linear-gradient(180deg, #f7fffc 0%, #defce9 22%, #c9f7dc 42%, #edfcf4 68%, #fafefc 88%, #ffffff 100%)',
    darkBackgroundCss:
      'linear-gradient(180deg, #0b1511 0%, #08100d 32%, #050a08 65%, #050505 100%)',
    lightTopSpotlight:
      'radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255, 255, 255, 1) 0%, rgba(242, 255, 249, 0.94) 34%, rgba(110, 231, 183, 0.3) 68%, rgba(255, 255, 255, 0) 100%)',
    darkTopSpotlight:
      'radial-gradient(ellipse 100% 55% at 50% -10%, rgba(236, 253, 245, 0.22) 0%, rgba(167, 243, 208, 0.14) 34%, rgba(52, 211, 153, 0.06) 65%, transparent 100%)',
  },

  // Grok Family (Soft Coral Blush & White Sky)
  grok: {
    id: 'crimson-nova',
    name: 'Coral Blush Sky',
    tagline: 'Crisp white horizon, warm pastel coral & sunset rose',
    primary: '#fb7185',
    secondary: '#fecdd3',
    tertiary: '#fff1f2',
    glowRgba: 'rgba(251, 113, 133, 0.28)',
    swatchGradient: 'linear-gradient(135deg, #ffffff 0%, #fecdd3 48%, #f43f5e 100%)',
    lightBackgroundCss:
      'linear-gradient(180deg, #fffafa 0%, #ffe4e6 22%, #ffd2d7 42%, #fff0f2 68%, #fffcfc 88%, #ffffff 100%)',
    darkBackgroundCss:
      'linear-gradient(180deg, #170e10 0%, #110a0b 32%, #0a0607 65%, #050505 100%)',
    lightTopSpotlight:
      'radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255, 255, 255, 1) 0%, rgba(255, 245, 246, 0.94) 34%, rgba(253, 164, 175, 0.32) 68%, rgba(255, 255, 255, 0) 100%)',
    darkTopSpotlight:
      'radial-gradient(ellipse 100% 55% at 50% -10%, rgba(255, 241, 242, 0.22) 0%, rgba(254, 205, 211, 0.14) 34%, rgba(251, 113, 133, 0.06) 65%, transparent 100%)',
  },

  // Gemini Family (Daylight Sky Blue & Cloud White)
  gemini: {
    id: 'celestial-sapphire',
    name: 'Daylight Sky Blue',
    tagline: 'Bright cloud white, airy periwinkle & soft azure sky',
    primary: '#60a5fa',
    secondary: '#bfdbfe',
    tertiary: '#eff6ff',
    glowRgba: 'rgba(96, 165, 250, 0.28)',
    swatchGradient: 'linear-gradient(135deg, #ffffff 0%, #bfdbfe 48%, #3b82f6 100%)',
    lightBackgroundCss:
      'linear-gradient(180deg, #f8fbff 0%, #e0eeff 22%, #cce3ff 42%, #eef6ff 68%, #fbfdff 88%, #ffffff 100%)',
    darkBackgroundCss:
      'linear-gradient(180deg, #0d121c 0%, #090d14 32%, #06080d 65%, #050505 100%)',
    lightTopSpotlight:
      'radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255, 255, 255, 1) 0%, rgba(243, 248, 255, 0.94) 34%, rgba(147, 197, 253, 0.32) 68%, rgba(255, 255, 255, 0) 100%)',
    darkTopSpotlight:
      'radial-gradient(ellipse 100% 55% at 50% -10%, rgba(239, 246, 255, 0.22) 0%, rgba(191, 219, 254, 0.14) 34%, rgba(96, 165, 250, 0.06) 65%, transparent 100%)',
  },

  // Kimi / MiMo Family (Peach Blossom & White Mist)
  kimi: {
    id: 'rose-coral',
    name: 'Peach Blossom Mist',
    tagline: 'Silky white cloud, soft pink-peach & warm dawn blush',
    primary: '#f472b6',
    secondary: '#fbcfe8',
    tertiary: '#fdf2f8',
    glowRgba: 'rgba(244, 114, 182, 0.28)',
    swatchGradient: 'linear-gradient(135deg, #ffffff 0%, #fbcfe8 48%, #ec4899 100%)',
    lightBackgroundCss:
      'linear-gradient(180deg, #fffafd 0%, #fce7f3 22%, #f9d5e9 42%, #fdf0f7 68%, #fffbfd 88%, #ffffff 100%)',
    darkBackgroundCss:
      'linear-gradient(180deg, #170e14 0%, #110a0f 32%, #0a0609 65%, #050505 100%)',
    lightTopSpotlight:
      'radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255, 255, 255, 1) 0%, rgba(255, 245, 251, 0.94) 34%, rgba(249, 168, 212, 0.32) 68%, rgba(255, 255, 255, 0) 100%)',
    darkTopSpotlight:
      'radial-gradient(ellipse 100% 55% at 50% -10%, rgba(253, 242, 248, 0.22) 0%, rgba(251, 207, 232, 0.14) 34%, rgba(244, 114, 182, 0.06) 65%, transparent 100%)',
  },

  // Atria / Intern / Scientific Multimodal
  atria: {
    id: 'cosmic-nebula',
    name: 'Soft Indigo Cloud',
    tagline: 'Porcelain white, airy periwinkle & soft twilight mist',
    primary: '#818cf8',
    secondary: '#c7d2fe',
    tertiary: '#eef2ff',
    glowRgba: 'rgba(129, 140, 248, 0.28)',
    swatchGradient: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 48%, #6366f1 100%)',
    lightBackgroundCss:
      'linear-gradient(180deg, #fafaff 0%, #e6ebff 22%, #d4ddff 42%, #f0f3ff 68%, #fcfdff 88%, #ffffff 100%)',
    darkBackgroundCss:
      'linear-gradient(180deg, #10111c 0%, #0b0c14 32%, #07070c 65%, #050505 100%)',
    lightTopSpotlight:
      'radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255, 255, 255, 1) 0%, rgba(245, 247, 255, 0.94) 34%, rgba(165, 180, 252, 0.32) 68%, rgba(255, 255, 255, 0) 100%)',
    darkTopSpotlight:
      'radial-gradient(ellipse 100% 55% at 50% -10%, rgba(238, 242, 255, 0.22) 0%, rgba(199, 210, 254, 0.14) 34%, rgba(129, 140, 248, 0.06) 65%, transparent 100%)',
  },

  // Auto Router (FLM Auto - Pastel Sky Sunset Horizon)
  auto: {
    id: 'prismatic-horizon',
    name: 'Pastel Sky Horizon',
    tagline: 'Whity sky-orange blending softly into morning pearl & azure',
    primary: '#ff9a52',
    secondary: '#ffd4b2',
    tertiary: '#fff9f4',
    glowRgba: 'rgba(255, 154, 82, 0.3)',
    swatchGradient:
      'linear-gradient(135deg, #ffffff 0%, #ffd4b2 50%, #ff8c3b 100%)',
    lightBackgroundCss:
      'linear-gradient(180deg, #fffaf6 0%, #ffe5cf 24%, #ffd9be 44%, #fff2e8 70%, #ffffff 100%)',
    darkBackgroundCss:
      'linear-gradient(180deg, #16110e 0%, #100c0a 32%, #090706 65%, #050505 100%)',
    lightTopSpotlight:
      'radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255, 255, 255, 1) 0%, rgba(255, 249, 242, 0.94) 35%, rgba(255, 186, 134, 0.32) 68%, rgba(255, 255, 255, 0) 100%)',
    darkTopSpotlight:
      'radial-gradient(ellipse 100% 55% at 50% -10%, rgba(255, 249, 242, 0.24) 0%, rgba(255, 206, 168, 0.15) 34%, rgba(255, 154, 82, 0.06) 65%, transparent 100%)',
  },
};

/**
 * Maps any model ID or name to its signature gradient theme.
 */
export function getModelGradientTheme(modelIdOrName?: string): ModelGradientTheme {
  const raw = String(modelIdOrName || '').toLowerCase().trim();

  if (raw.includes('deepseek')) {
    return MODEL_GRADIENT_THEMES.deepseek;
  }
  if (raw.includes('glm')) {
    return MODEL_GRADIENT_THEMES.glm;
  }
  if (raw.includes('qwen')) {
    return MODEL_GRADIENT_THEMES.qwen;
  }
  if (raw.includes('claude') || raw.includes('sonnet') || raw.includes('opus')) {
    return MODEL_GRADIENT_THEMES.claude;
  }
  if (raw.includes('gpt') || raw.includes('luna') || raw.includes('sol') || raw.includes('astra')) {
    return MODEL_GRADIENT_THEMES.gpt;
  }
  if (raw.includes('grok')) {
    return MODEL_GRADIENT_THEMES.grok;
  }
  if (raw.includes('gemini') || raw.includes('argon')) {
    return MODEL_GRADIENT_THEMES.gemini;
  }
  if (raw.includes('kimi') || raw.includes('mimo')) {
    return MODEL_GRADIENT_THEMES.kimi;
  }
  if (raw.includes('atria') || raw.includes('agents')) {
    return MODEL_GRADIENT_THEMES.atria;
  }
  if (raw.includes('auto') || raw.includes('flm')) {
    return MODEL_GRADIENT_THEMES.auto;
  }

  // Default to the exact sunset orange theme from the user's uploaded images
  return EXACT_SUNSET_ORANGE_THEME;
}

/**
 * LocalStorage preference for user-selected background gradient mode
 */
export type BackgroundGradientMode = 'dynamic-model' | 'exact-sunset' | 'subtle' | 'off';

export function getStoredBackgroundGradientMode(): BackgroundGradientMode {
  if (typeof window === 'undefined') return 'dynamic-model';
  try {
    const val = localStorage.getItem('zeno_bg_gradient_mode');
    if (val === 'exact-sunset' || val === 'subtle' || val === 'off') {
      return val;
    }
  } catch {}
  return 'dynamic-model';
}

export function setStoredBackgroundGradientMode(mode: BackgroundGradientMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('zeno_bg_gradient_mode', mode);
  } catch {}
}
