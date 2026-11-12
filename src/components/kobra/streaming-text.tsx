import React from 'react';

export interface StreamingTextProps {
  text?: string;
  isStreaming?: boolean;
  durationSec?: number;
  className?: string;
  isDark?: boolean;
  children?: React.ReactNode;
}

/**
 * @kobra/streaming-text
 * Clean, direct answer streaming component.
 * Renders the pure response text/markdown without blue spinners, time readouts, or typer cursors.
 */
export const StreamingText: React.FC<StreamingTextProps> = ({
  text = '',
  className = '',
  children,
}) => {
  return (
    <div className={`relative ${className}`}>
      {children ? children : <span className="whitespace-pre-wrap break-words">{text}</span>}
    </div>
  );
};

export default StreamingText;
