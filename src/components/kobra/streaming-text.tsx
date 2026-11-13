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
    <div className={`relative ds-assistant-message-main-content transition-opacity duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${className}`}>
      {children ? children : <span className="whitespace-pre-wrap break-words">{text}</span>}
    </div>
  );
};

export default StreamingText;
