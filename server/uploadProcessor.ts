import { SERVER_LIMITS } from './config';

export interface ValidatedAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  textContent?: string;
}

const ALLOWED_ATTACHMENT_MIME_PREFIXES = [
  'image/',
  'text/',
  'application/pdf',
  'application/json',
  'application/xml',
  'application/javascript',
  'application/typescript',
  'application/x-yaml',
  'application/csv',
];

export function isAllowedAttachmentType(mimeType: string, fileName: string): boolean {
  const cleanMime = (mimeType || '').toLowerCase().trim();
  if (ALLOWED_ATTACHMENT_MIME_PREFIXES.some((prefix) => cleanMime.startsWith(prefix))) {
    return true;
  }
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  return [
    'txt',
    'md',
    'markdown',
    'json',
    'csv',
    'ts',
    'tsx',
    'js',
    'jsx',
    'py',
    'rs',
    'go',
    'java',
    'c',
    'cpp',
    'h',
    'html',
    'css',
    'sql',
    'yaml',
    'yml',
    'xml',
    'pdf',
    'png',
    'jpg',
    'jpeg',
    'webp',
    'gif',
  ].includes(ext);
}

/**
 * Validates and bounds incoming message attachments to prevent oversized payload abuse.
 */
export function validateMessageAttachments(rawAttachments: unknown): {
  valid: boolean;
  attachments: ValidatedAttachment[];
  error?: string;
} {
  if (!rawAttachments) {
    return { valid: true, attachments: [] };
  }
  if (!Array.isArray(rawAttachments)) {
    return { valid: false, attachments: [], error: 'attachments must be an array' };
  }
  if (rawAttachments.length > SERVER_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE) {
    return {
      valid: false,
      attachments: [],
      error: `Maximum ${SERVER_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE} attachments allowed per message`,
    };
  }

  const sanitized: ValidatedAttachment[] = [];
  for (const item of rawAttachments) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = String((item as any).name || 'upload')
      .replace(/[^\w.\- ()]/g, '_')
      .slice(0, 200);
    const type = String((item as any).type || 'application/octet-stream').slice(0, 100);
    const size = Number((item as any).size) || 0;

    if (size > SERVER_LIMITS.MAX_ATTACHMENT_BYTES) {
      return {
        valid: false,
        attachments: [],
        error: `Attachment "${name}" exceeds the 10 MB size limit`,
      };
    }

    if (!isAllowedAttachmentType(type, name)) {
      return {
        valid: false,
        attachments: [],
        error: `Unsupported attachment file type for "${name}"`,
      };
    }

    const dataUrl =
      typeof (item as any).dataUrl === 'string'
        ? (item as any).dataUrl.slice(0, 14_000_000)
        : undefined;
    const textContent =
      typeof (item as any).textContent === 'string'
        ? (item as any).textContent.slice(0, 100_000)
        : undefined;

    sanitized.push({
      name,
      type,
      size,
      dataUrl,
      textContent,
    });
  }

  return { valid: true, attachments: sanitized };
}
