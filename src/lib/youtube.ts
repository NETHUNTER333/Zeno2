export function extractYouTubeIdFromInput(input?: string | null): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  // 1. YouTube URLs (watch?v=, shorts/, embed/, live/, v/, youtu.be/)
  const urlMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (urlMatch) return urlMatch[1];

  // 2. Direct 11-character video ID (YouTube IDs are exactly 11 chars: base64url charset)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
