import React from 'react';
import { ModelOption } from './GrokModelPicker';
import { SearchMode, ChatAttachment } from '../types';
import { ChatInput } from './kobra/chat-input';
import { ChatHistoryItem } from './kobra/chat-history';

export interface GrokComposerProps {
  onSend: (message: string, searchMode: SearchMode, attachments?: ChatAttachment[]) => void;
  onCancel?: () => void;
  isRunning: boolean;
  searchMode: SearchMode;
  onToggleSearchMode: (mode: SearchMode) => void;
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  placeholder?: string;
  autoFocus?: boolean;
  theme?: 'dark' | 'light';
  recentPrompts?: string[];
  historicalThreads?: ChatHistoryItem[];
  onSelectThread?: (threadId: string) => void;
}

export const GrokComposer: React.FC<GrokComposerProps> = (props) => {
  return <ChatInput {...props} />;
};

export default GrokComposer;
