import { SERVER_LIMITS } from './config';
import { validateMessageAttachments } from './uploadProcessor';

export interface ValidatedChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: any[];
  sources?: any[];
}

export function validateChatRequestPayload(body: any): {
  valid: boolean;
  messages?: ValidatedChatMessage[];
  error?: string;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object' };
  }

  const rawMessages = body.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return { valid: false, error: 'Valid messages array is required' };
  }

  if (rawMessages.length > SERVER_LIMITS.MAX_CHAT_MESSAGES) {
    return {
      valid: false,
      error: `Messages array exceeds maximum length of ${SERVER_LIMITS.MAX_CHAT_MESSAGES}`,
    };
  }

  const sanitized: ValidatedChatMessage[] = [];
  for (const msg of rawMessages) {
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: 'Each message must be an object' };
    }
    const role =
      msg.role === 'assistant' || msg.role === 'system' ? msg.role : 'user';
    const content =
      typeof msg.content === 'string'
        ? msg.content.slice(0, SERVER_LIMITS.MAX_MESSAGE_CHARS)
        : String(msg.content ?? '').slice(0, SERVER_LIMITS.MAX_MESSAGE_CHARS);

    const safeSources = Array.isArray(msg.sources)
      ? msg.sources
          .filter((s: any) => s && typeof s === 'object' && typeof s.url === 'string')
          .slice(0, 10)
      : undefined;

    if (msg.attachments !== undefined) {
      const attCheck = validateMessageAttachments(msg.attachments);
      if (!attCheck.valid) {
        return { valid: false, error: attCheck.error };
      }
      sanitized.push({ role, content, attachments: attCheck.attachments, ...(safeSources ? { sources: safeSources } : {}) });
    } else {
      sanitized.push({ role, content, ...(safeSources ? { sources: safeSources } : {}) });
    }
  }

  return { valid: true, messages: sanitized };
}
