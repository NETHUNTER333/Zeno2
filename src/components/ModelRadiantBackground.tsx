import React from 'react';
import {
  ModelGradientTheme,
  getModelGradientTheme,
  EXACT_SUNSET_ORANGE_THEME,
  BackgroundGradientMode,
} from '../lib/modelGradients';

interface ModelRadiantBackgroundProps {
  modelId?: string;
  theme: 'dark' | 'light';
  mode?: BackgroundGradientMode;
}

export const ModelRadiantBackground: React.FC<ModelRadiantBackgroundProps> = ({
  modelId,
  theme,
  mode = 'dynamic-model',
}) => {
  if (mode === 'off') {
    return null;
  }

  const isDark = theme === 'dark';

  // Determine active gradient theme based on user mode
  const activeTheme: ModelGradientTheme =
    mode === 'exact-sunset'
      ? EXACT_SUNSET_ORANGE_THEME
      : getModelGradientTheme(modelId);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none transition-colors duration-700"
      aria-hidden="true"
    >
      {/* 1. Underlying Pure Canvas Base */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          isDark ? 'bg-[#070708]' : 'bg-[#ffffff]'
        }`}
      />

      {/* 2. Soft Airy Sky-Tint Wash (Whity Sky-Orange / Pastel Cloud Horizon) */}
      <div
        className="absolute inset-0 transition-all duration-700 ease-out"
        style={{
          background: isDark
            ? activeTheme.darkBackgroundCss
            : activeTheme.lightBackgroundCss,
          opacity: isDark
            ? mode === 'subtle'
              ? 0.4
              : 0.7
            : mode === 'subtle'
            ? 0.45
            : 0.8,
        }}
      />

      {/* 3. Luminous White-to-Sky Spotlight Dome at Top Center */}
      <div
        className="absolute -top-[18%] left-1/2 -translate-x-1/2 w-[145vw] sm:w-[125vw] h-[62vh] sm:h-[70vh] transition-all duration-700 ease-out blur-[28px]"
        style={{
          background: isDark
            ? activeTheme.darkTopSpotlight
            : activeTheme.lightTopSpotlight,
          opacity: isDark
            ? mode === 'subtle'
              ? 0.5
              : 0.88
            : mode === 'subtle'
            ? 0.65
            : 0.96,
        }}
      />

      {/* 4. Feathery Pearl-White & Sky-Pastel Mist Orb (Never thick or muddy) */}
      <div
        className="absolute -top-[12%] left-1/2 -translate-x-1/2 w-[85vw] max-w-[920px] h-[380px] rounded-full transition-all duration-1000 ease-out blur-[95px]"
        style={{
          background: isDark
            ? `radial-gradient(circle, rgba(255, 252, 248, 0.55) 0%, ${activeTheme.secondary} 36%, ${activeTheme.primary} 62%, transparent 82%)`
            : `radial-gradient(circle, rgba(255, 255, 255, 0.98) 0%, ${activeTheme.tertiary} 35%, ${activeTheme.secondary} 65%, transparent 85%)`,
          opacity: isDark
            ? mode === 'subtle'
              ? 0.08
              : 0.15
            : mode === 'subtle'
            ? 0.28
            : 0.5,
        }}
      />

      {/* 5. Breathable White / Dark Bottom Fade for Clean Content Readability */}
      <div
        className={`absolute inset-0 transition-colors duration-500 pointer-events-none ${
          isDark
            ? 'bg-gradient-to-b from-transparent via-[#070708]/25 to-[#070708]/80'
            : 'bg-gradient-to-b from-white/25 via-white/35 to-white/85'
        }`}
      />
    </div>
  );
};
