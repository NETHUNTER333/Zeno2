import React from 'react';
import { YouTubeTranscriptSegment } from '../types';
import { StudyWorkspace, extractYouTubeIdFromInput } from './StudyWorkspace';

export { extractYouTubeIdFromInput };

export interface YouTubeTranscriptModalProps {
  videoId?: string | null;
  videoTitle?: string;
  videoAuthor?: string;
  isOpen?: boolean;
  onClose: () => void;
  onSummarize?: (transcript: string) => void;
  isDark?: boolean;
  onAskZeno?: (prompt: string) => void;
  video?: {
    videoId?: string;
    title?: string;
    author?: string;
    videoUrl?: string;
    thumbnail?: string;
    link?: string;
    transcript?: YouTubeTranscriptSegment[];
  } | null;
}

export const YouTubeTranscriptModal: React.FC<YouTubeTranscriptModalProps> = ({
  videoId,
  videoTitle,
  videoAuthor,
  isOpen = true,
  onClose,
  isDark = true,
  onAskZeno,
  video,
}) => {
  if (!isOpen) return null;

  const resolvedVideo = {
    videoId:
      videoId ||
      video?.videoId ||
      (video?.videoUrl ? extractYouTubeIdFromInput(video.videoUrl) || undefined : undefined) ||
      (video?.link ? extractYouTubeIdFromInput(video.link) || undefined : undefined),
    title: video?.title || videoTitle || 'Study Space',
    author: video?.author || videoAuthor || 'YouTube',
    videoUrl: video?.videoUrl,
    thumbnail: video?.thumbnail,
    link: video?.link,
    transcript: video?.transcript,
  };

  return (
    <div className="fixed inset-0 z-50 w-full h-[100dvh] overflow-hidden">
      <StudyWorkspace
        initialVideo={resolvedVideo}
        onBackToChat={onClose}
        isDark={isDark}
        onAskZeno={onAskZeno}
      />
    </div>
  );
};
