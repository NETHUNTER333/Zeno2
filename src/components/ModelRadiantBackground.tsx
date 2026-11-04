import React from 'react';
import { BackgroundGradientMode } from '../lib/modelGradients';

interface ModelRadiantBackgroundProps {
  modelId?: string;
  theme: 'dark' | 'light';
  mode?: BackgroundGradientMode;
}

export const ModelRadiantBackground: React.FC<ModelRadiantBackgroundProps> = ({
  theme,
  mode = 'dynamic-model',
}) => {
  if (mode === 'off') {
    return null;
  }

  const isDark = theme === 'dark';
  const isSubtle = mode === 'subtle';

  // Seamless, full-viewport top-centre warm amber (#FC4C01) glow fading smoothly to near-black (#070708)
  // in dark mode and warm ivory to pure white (#ffffff) in light mode — zero seams or gaps.
  const darkBackground = isSubtle
    ? 'radial-gradient(circle 120% at 92% 98%, rgba(252, 76, 1, 0.16) 0%, rgba(252, 76, 1, 0.05) 40%, rgba(7, 7, 8, 0.96) 80%, #070708 100%)'
    : 'radial-gradient(circle 140% at 95% 98%, rgba(255, 168, 120, 0.24) 0%, rgba(252, 76, 1, 0.26) 30%, rgba(252, 76, 1, 0.07) 60%, rgba(10, 9, 10, 0.95) 85%, #070708 100%)';

  const lightBackground = isSubtle
    ? 'radial-gradient(circle 120% at 92% 98%, rgba(252, 76, 1, 0.10) 0%, rgba(255, 168, 120, 0.05) 42%, rgba(255, 255, 255, 0.98) 78%, #ffffff 100%)'
    : 'radial-gradient(circle 140% at 95% 98%, rgba(252, 76, 1, 0.16) 0%, rgba(255, 158, 94, 0.09) 34%, rgba(255, 245, 238, 0.65) 62%, #ffffff 92%)';

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden select-none transition-colors duration-500 ${
        isDark ? 'bg-[#070708]' : 'bg-[#ffffff]'
      }`}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: isDark ? darkBackground : lightBackground,
        }}
      />
    </div>
  );
};

