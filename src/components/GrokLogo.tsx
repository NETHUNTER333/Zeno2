import React from 'react';

interface GrokLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isDark?: boolean;
  showText?: boolean;
}

export const GrokLogo: React.FC<GrokLogoProps> = ({
  className = '',
  size = 'md',
  isDark = true,
  showText = true,
}) => {
  const iconSize =
    size === 'sm'
      ? 'w-6 h-6'
      : size === 'lg'
      ? 'w-12 h-12'
      : size === 'xl'
      ? 'w-16 h-16'
      : 'w-9 h-9';

  const textSize =
    size === 'sm'
      ? 'text-lg'
      : size === 'lg'
      ? 'text-3xl'
      : size === 'xl'
      ? 'text-4xl font-extrabold'
      : 'text-2xl font-bold';

  return (
    <div
      className={`flex items-center gap-2.5 select-none ${
        isDark ? 'text-white' : 'text-[#0d0d0d]'
      } ${className}`}
    >
      <svg
        viewBox="0 0 200 200"
        className={`${iconSize} shrink-0 fill-current`}
        aria-hidden="true"
      >
        <path d="M 52 26 H 148 C 166 26 176 36 176 54 V 66 C 176 74 172 80 165 86 L 142 107 C 135 113 128 114 120 111 C 107 106 101 92 100 50 C 98 82 84 98 52 100 H 42 C 30 100 24 93 24 80 V 54 C 24 36 34 26 52 26 Z" />
        <path d="M 99 62 C 97 89 83 102 53 105 C 78 106 94 96 99 62 Z" />
        <path d="M 148 174 H 52 C 34 174 24 164 24 146 V 134 C 24 126 28 120 35 114 L 58 93 C 65 87 72 86 80 89 C 93 94 99 108 100 150 C 102 118 116 102 148 100 H 158 C 170 100 176 107 176 120 V 146 C 176 164 166 174 148 174 Z" />
        <path d="M 101 138 C 103 111 117 98 147 95 C 122 94 106 104 101 138 Z" />
      </svg>

      {showText && (
        <span className={`${textSize} font-bold tracking-tight font-sans`}>
          Zeno
        </span>
      )}
    </div>
  );
};
