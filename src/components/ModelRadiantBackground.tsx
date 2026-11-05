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

  // Kinich signature icon-inspired background:
  // Deep obsidian black on top-left sweeping left-to-right (135deg) into a bottom-right (down-right)
  // radiating solar orb mixing warm white, golden yellow (#FFC72C / #FFD86B), and Kinich orange (#FC4C01 / #FF8A2B).
  const darkBackground = isSubtle
    ? [
        'radial-gradient(circle 95% at 96% 96%, rgba(255, 248, 220, 0.20) 0%, rgba(255, 198, 58, 0.22) 16%, rgba(252, 76, 1, 0.24) 36%, rgba(252, 76, 1, 0.08) 58%, rgba(7, 7, 8, 0) 82%)',
        'linear-gradient(135deg, #050506 0%, #070708 52%, #140904 82%, #241005 100%)',
      ].join(', ')
    : [
        'radial-gradient(circle 105% at 96% 96%, rgba(255, 252, 235, 0.42) 0%, rgba(255, 212, 74, 0.38) 15%, rgba(255, 140, 36, 0.36) 32%, rgba(252, 76, 1, 0.28) 48%, rgba(252, 76, 1, 0.09) 68%, rgba(6, 6, 7, 0) 88%)',
        'radial-gradient(ellipse 90% 70% at 88% 100%, rgba(255, 184, 48, 0.18) 0%, rgba(252, 76, 1, 0.14) 45%, transparent 80%)',
        'linear-gradient(135deg, #050506 0%, #070607 46%, #130904 76%, #261004 100%)',
      ].join(', ');

  // Light mode: crisp white top-left sweeping left-to-right into a bottom-right radiating light orange, warm yellow, and white mix
  const lightBackground = isSubtle
    ? [
        'radial-gradient(circle 95% at 96% 96%, rgba(255, 255, 248, 0.92) 0%, rgba(255, 218, 106, 0.28) 18%, rgba(255, 154, 72, 0.22) 38%, rgba(252, 76, 1, 0.10) 58%, rgba(255, 255, 255, 0) 84%)',
        'linear-gradient(135deg, #ffffff 0%, #fffdf9 55%, #fff4e6 82%, #ffe8cf 100%)',
      ].join(', ')
    : [
        'radial-gradient(circle 110% at 96% 96%, rgba(255, 255, 250, 0.96) 0%, rgba(255, 220, 98, 0.46) 16%, rgba(255, 156, 64, 0.36) 34%, rgba(252, 76, 1, 0.22) 52%, rgba(255, 200, 140, 0.10) 72%, rgba(255, 255, 255, 0) 90%)',
        'radial-gradient(ellipse 95% 75% at 86% 100%, rgba(255, 206, 78, 0.26) 0%, rgba(255, 138, 52, 0.18) 48%, transparent 82%)',
        'linear-gradient(135deg, #ffffff 0%, #fffefa 48%, #fff6ea 76%, #ffebd4 100%)',
      ].join(', ');

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden select-none transition-colors duration-500 ${
        isDark ? 'bg-[#050506]' : 'bg-[#ffffff]'
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
