import { SERVER_LIMITS } from './config';

export interface ValidatedTtsRequest {
  text: string;
  voiceId: string;
  gender: 'female' | 'male';
  language: string;
  speed: number;
}

/**
 * Validates and bounds TTS synthesis requests.
 */
export function validateTtsRequestPayload(body: any): {
  valid: boolean;
  data?: ValidatedTtsRequest;
  error?: string;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const rawText = typeof body.text === 'string' ? body.text.trim() : '';
  if (!rawText) {
    return { valid: false, error: 'Text is required for speech synthesis' };
  }

  const text = rawText.slice(0, SERVER_LIMITS.MAX_TTS_CHARS);
  const gender: 'female' | 'male' = body.gender === 'male' ? 'male' : 'female';
  const language =
    typeof body.language === 'string' && body.language.trim()
      ? body.language.trim().slice(0, 40)
      : 'English';
  const voiceId =
    typeof body.voiceId === 'string' && body.voiceId.trim()
      ? body.voiceId.trim().slice(0, 64)
      : gender === 'male'
      ? 'arjun'
      : 'anya';
  const rawSpeed = Number(body.speed);
  const speed = !Number.isNaN(rawSpeed) ? Math.min(2.0, Math.max(0.5, rawSpeed)) : 1.0;

  return {
    valid: true,
    data: {
      text,
      voiceId,
      gender,
      language,
      speed,
    },
  };
}
