import React from 'react';
import { ChatInput } from './chat-input';

export type KobraComposerProps = React.ComponentProps<typeof ChatInput>;

export const Composer: React.FC<KobraComposerProps> = (props) => {
  return <ChatInput {...props} />;
};

export default Composer;
