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
      ? 'w-7 h-7 rounded-[8px]'
      : size === 'lg'
      ? 'w-12 h-12 rounded-xl'
      : size === 'xl'
      ? 'w-16 h-16 rounded-2xl'
      : 'w-9 h-9 rounded-[10px]';

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
      <div
        className={`${iconSize} relative overflow-hidden shrink-0 isolate bg-[#140c06] border ${
          isDark
            ? 'border-white/15 shadow-[0_0_16px_rgba(252,76,1,0.3)]'
            : 'border-black/15 shadow-[0_2px_8px_rgba(20,12,6,0.18)]'
        }`}
      >
        <img
          src="/assets/aistudio/kinich-icon-1024_544040c6.png"
          alt="Kinich Logo"
          className="w-full h-full object-cover block"
        />
      </div>

      {showText && (
        <span className={`${textSize} font-bold tracking-tight font-sans`}>
          Kinich
        </span>
      )}
    </div>
  );
};
