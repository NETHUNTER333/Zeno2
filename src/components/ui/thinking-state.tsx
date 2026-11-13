import React from 'react';

/**
 * Kokonut UI — ShimmerText Component
 * Smooth metallic gradient sweep across active status labels and thinking steps.
 */
export interface ShimmerTextProps {
  text: string;
  className?: string;
  isDark?: boolean;
  as?: 'span' | 'div' | 'p';
}

export const ShimmerText: React.FC<ShimmerTextProps> = ({
  text,
  className = '',
  isDark = true,
  as: Component = 'span',
}) => {
  return (
    <Component
      className={`inline-block bg-clip-text text-transparent animate-kokonut-shimmer select-none ${
        isDark
          ? 'bg-[linear-gradient(110deg,#71717a_0%,#a1a1aa_35%,#ffffff_50%,#a1a1aa_65%,#71717a_100%)]'
          : 'bg-[linear-gradient(110deg,#71717a_0%,#52525b_35%,#09090b_50%,#52525b_65%,#71717a_100%)]'
      } ${className}`}
    >
      {text}
    </Component>
  );
};

/**
 * affectUI — ThinkingState Types & Component
 * AI working panel with a live timer, twinkling 3x3 pixel matrix, searched sources with domain tooltips,
 * and sequential thinking steps that appear one by one.
 */
export interface ThinkingSource {
  label: string;
  href?: string;
  domain?: string;
  icon?: React.ReactNode;
}

export type ThinkingStep =
  | {
      type: 'search';
      label?: string;
      sources: ThinkingSource[];
    }
  | {
      type: 'thought';
      text: string;
    };
