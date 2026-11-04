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
      <img
        src="/assets/aistudio/kinich-icon-1024_544040c6.png"
        alt="Kinich Logo"
        className={`${iconSize} rounded-xl object-cover shrink-0`}
      />

      {showText && (
        <span className={`${textSize} font-bold tracking-tight font-sans`}>
          Kinich
        </span>
      )}
    </div>
  );
};
