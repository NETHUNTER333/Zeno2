export interface ModelGradientTheme {
  id: string;
  name: string;
  tagline: string;
  primary: string;
  secondary: string;
  tertiary: string;
  glowRgba: string;
  swatchGradient: string;
  lightBackgroundCss: string;
  darkBackgroundCss: string;
  backdropImage?: string;
  lightTopSpotlight: string;
  darkTopSpotlight: string;
}

const makeSkyTheme = (
  id: string,
  name: string,
  tagline: string,
  [primary, secondary, tertiary, deep]: [string, string, string, string],
  [l0, l1, l2, l3, l4]: [string, string, string, string, string],
  [d0, d1, d2]: [string, string, string],
  [rgbGlow, rgbSpotL, rgbSpotD]: [string, string, string],
  backdropImage?: string
): ModelGradientTheme => ({
  id,
  name,
  tagline,
  primary,
  secondary,
  tertiary,
  glowRgba: `rgba(${rgbGlow}, 0.28)`,
  swatchGradient: `linear-gradient(135deg, #ffffff 0%, ${secondary} 48%, ${deep} 100%)`,
  ...(backdropImage ? { backdropImage } : {}),
  lightBackgroundCss: `linear-gradient(180deg, ${l0} 0%, ${l1} 22%, ${l2} 42%, ${l3} 68%, ${l4} 88%, #ffffff 100%)`,
  darkBackgroundCss: `linear-gradient(180deg, ${d0} 0%, ${d1} 32%, ${d2} 65%, #050505 100%)`,
  lightTopSpotlight: `radial-gradient(ellipse 105% 65% at 50% -8%, rgba(255,255,255,1) 0%, rgba(255,250,245,0.94) 34%, rgba(${rgbSpotL},0.32) 68%, rgba(255,255,255,0) 100%)`,
  darkTopSpotlight: `radial-gradient(ellipse 100% 55% at 50% -10%, rgba(255,250,245,0.22) 0%, rgba(${rgbSpotD},0.14) 34%, rgba(${rgbGlow},0.06) 65%, transparent 100%)`,
});

export const EXACT_SUNSET_ORANGE_THEME: ModelGradientTheme = makeSkyTheme(
  'sunset-orange', 'Sky Orange & White Mist', 'Airy pearl white, soft sky-apricot & gentle morning sunset',
  ['#ff944d', '#ffc299', '#fff7f0', '#ff8c42'],
  ['#fffaf5', '#ffe6d1', '#ffd2b0', '#ffefe0', '#fffdfb'],
  ['#17110e', '#100c0a', '#0a0807'],
  ['255,158,94', '255,184,130', '255,204,166'],
  '/assets/aistudio/IMG_b19e3948-9e9c-40a0-92b9-9924f87dff0f_d403c7fb.jpg'
);

export const MODEL_GRADIENT_THEMES: Record<string, ModelGradientTheme> = {
  deepseek: EXACT_SUNSET_ORANGE_THEME,
  glm: makeSkyTheme('amethyst-violet', 'Sky Lavender Mist', 'Airy pearl white, pastel lilac & soft lavender sky', ['#b779f7', '#dfc2ff', '#faf5ff', '#a855f7'], ['#fcfaff', '#f1e4ff', '#e5d0ff', '#f6eeff', '#fdfbff'], ['#14101a', '#0e0b13', '#09070c'], ['183,121,247', '206,166,255', '216,180,254']),
  qwen: makeSkyTheme('ocean-cyan', 'Cloud Cyan Sky', 'Pure cloud white, soft ice-blue & pastel sky cyan', ['#38bdf8', '#bae6fd', '#f0f9ff', '#38bdf8'], ['#f7fcff', '#dff2fe', '#c8eafd', '#edf8ff', '#fafdff'], ['#0c1418', '#090f12', '#06090b'], ['56,189,248', '125,211,252', '186,230,253']),
  claude: makeSkyTheme('terracotta-amber', 'Creamy Peach & Honey Sky', 'Warm ivory white, soft apricot & sunlit honey mist', ['#f59e0b', '#fde68a', '#fffbeb', '#f59e0b'], ['#fffdf7', '#ffefd1', '#ffe2b3', '#fff5e3', '#fffdf9'], ['#17120c', '#110d09', '#0a0806'], ['245,158,11', '252,200,125', '253,215,155'], '/assets/aistudio/IMG_f15b9024-053c-4665-9ad8-fde18e6bca08_1a22887e.jpg'),
  gpt: makeSkyTheme('emerald-aurora', 'Mint Cloud Sky', 'Pure white mist, pastel seafoam & gentle mint breeze', ['#34d399', '#a7f3d0', '#ecfdf5', '#10b981'], ['#f7fffc', '#defce9', '#c9f7dc', '#edfcf4', '#fafefc'], ['#0b1511', '#08100d', '#050a08'], ['52,211,153', '110,231,183', '167,243,208']),
  grok: makeSkyTheme('crimson-nova', 'Coral Blush Sky', 'Crisp white horizon, warm pastel coral & sunset rose', ['#fb7185', '#fecdd3', '#fff1f2', '#f43f5e'], ['#fffafa', '#ffe4e6', '#ffd2d7', '#fff0f2', '#fffcfc'], ['#170e10', '#110a0b', '#0a0607'], ['251,113,133', '253,164,175', '254,205,211']),
  gemini: makeSkyTheme('celestial-sapphire', 'Daylight Sky Blue', 'Bright cloud white, airy periwinkle & soft azure sky', ['#60a5fa', '#bfdbfe', '#eff6ff', '#3b82f6'], ['#f8fbff', '#e0eeff', '#cce3ff', '#eef6ff', '#fbfdff'], ['#0d121c', '#090d14', '#06080d'], ['96,165,250', '147,197,253', '191,219,254']),
  kimi: makeSkyTheme('rose-coral', 'Peach Blossom Mist', 'Silky white cloud, soft pink-peach & warm dawn blush', ['#f472b6', '#fbcfe8', '#fdf2f8', '#ec4899'], ['#fffafd', '#fce7f3', '#f9d5e9', '#fdf0f7', '#fffbfd'], ['#170e14', '#110a0f', '#0a0609'], ['244,114,182', '249,168,212', '251,207,232']),
  atria: makeSkyTheme('cosmic-nebula', 'Soft Indigo Cloud', 'Porcelain white, airy periwinkle & soft twilight mist', ['#818cf8', '#c7d2fe', '#eef2ff', '#6366f1'], ['#fafaff', '#e6ebff', '#d4ddff', '#f0f3ff', '#fcfdff'], ['#10111c', '#0b0c14', '#07070c'], ['129,140,248', '165,180,252', '199,210,254']),
  auto: makeSkyTheme('prismatic-horizon', 'Pastel Sky Horizon', 'Whity sky-orange blending softly into morning pearl & azure', ['#ff9a52', '#ffd4b2', '#fff9f4', '#ff8c3b'], ['#fffaf6', '#ffe5cf', '#ffd9be', '#fff2e8', '#ffffff'], ['#16110e', '#100c0a', '#090706'], ['255,154,82', '255,186,134', '255,206,168']),
};

const FAMILY_RULES: Array<[RegExp, string]> = [
  [/deepseek/, 'deepseek'],
  [/glm/, 'glm'],
  [/qwen/, 'qwen'],
  [/claude|sonnet|opus/, 'claude'],
  [/gpt|luna|sol|astra|o3|o4/, 'gpt'],
  [/grok|uncensored|limitless/, 'grok'],
  [/gemini|argon|gemma/, 'gemini'],
  [/kimi|mimo|minimax|muse|agnes|ernie|minicpm|hy3|hy4/, 'kimi'],
  [/atria|agents|llama|mistral|nemotron|laguna|flint/, 'atria'],
  [/auto|flm/, 'auto'],
];

export function getModelGradientTheme(modelIdOrName?: string): ModelGradientTheme {
  const raw = String(modelIdOrName || '').toLowerCase().trim();
  const match = FAMILY_RULES.find(([re]) => re.test(raw));
  return match ? MODEL_GRADIENT_THEMES[match[1]] : EXACT_SUNSET_ORANGE_THEME;
}

export type BackgroundGradientMode = 'dynamic-model' | 'exact-sunset' | 'subtle' | 'off';

export function getStoredBackgroundGradientMode(): BackgroundGradientMode {
  try {
    const val = typeof window !== 'undefined' ? localStorage.getItem('kinich_bg_gradient_mode') : null;
    if (val === 'exact-sunset' || val === 'subtle' || val === 'off') return val;
  } catch {}
  return 'dynamic-model';
}

export function setStoredBackgroundGradientMode(mode: BackgroundGradientMode): void {
  try {
    if (typeof window !== 'undefined') localStorage.setItem('kinich_bg_gradient_mode', mode);
  } catch {}
}
