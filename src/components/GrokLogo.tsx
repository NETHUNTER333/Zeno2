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
      <div
        className={`${iconSize} relative rounded-xl overflow-hidden shrink-0 border ${
          isDark
            ? 'border-white/15 shadow-[0_0_18px_rgba(252,76,1,0.35)]'
            : 'border-black/10 shadow-[0_4px_14px_rgba(252,76,1,0.22)]'
        }`}
        style={{
          background:
            'radial-gradient(circle 85% at 92% 92%, #fffbe6 0%, #ffd447 22%, #ff8826 48%, #fc4c01 66%, #120905 78%, #070606 100%)',
        }}
      >
        <img
          src="/assets/aistudio/kinich-icon-1024_544040c6.png"
          alt="Kinich Logo"
          className="w-full h-full object-cover mix-blend-screen opacity-95"
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
