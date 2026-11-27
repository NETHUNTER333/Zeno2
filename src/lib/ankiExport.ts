import { apiFetch } from './apiBase';
import { getAuthHeaders } from './firebase';

export interface AnkiExportCard {
  front: string;
  back: string;
  hint?: string;
  tags?: string[];
}

function slugifyFilename(name: string): string {
  return (
    String(name || 'kinich-deck')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'kinich-deck'
  );
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function escapeAnkiTxtHtml(raw: string): string {
  const mathTokens: string[] = [];
  const stash = (val: string) => {
    const idx = mathTokens.push(val) - 1;
    return `@@MATH_${idx}@@`;
  };

  let out = String(raw || '')
    .trim()
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner) => stash(`\\[${inner.trim()}\\]`))
    .replace(/\$(?!\d+(?:[.,]\d+)?(?:\s|\/|$))([^\n$]+?)\$/g, (_m, inner) =>
      stash(`\\(${inner.trim()}\\)`)
    )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\t+/g, ' ')
    .replace(/\r?\n/g, '<br>');

  out = out.replace(/@@MATH_(\d+)@@/g, (_m, i) => mathTokens[Number(i)] || '');
  return out;
}

/**
 * Instant client-side Anki 2.1.54+ Tab-Separated Text Deck (.txt).
 * Includes official Anki import directives (#separator:tab, #html:true, #deck:, #tags column:3)
 * so Anki Desktop, AnkiDroid, and AnkiMobile auto-detect deck, HTML, MathJax, and tags.
 */
export function exportAnkiTxt(deckName: string, cards: AnkiExportCard[]): { ok: boolean; count: number } {
  const valid = cards.filter((c) => c.front?.trim() && c.back?.trim());
  if (valid.length === 0) return { ok: false, count: 0 };

  const cleanDeck = deckName.replace(/[\r\n\t#]+/g, ' ').trim() || 'Kinich Study Deck';
  const lines: string[] = [
    '#separator:tab',
    '#html:true',
    `#deck:${cleanDeck}`,
    '#notetype:Basic',
    '#tags column:3',
  ];

  for (const card of valid) {
    const frontBase = escapeAnkiTxtHtml(card.front);
    const frontWithHint = card.hint?.trim()
      ? `${frontBase}<br><small style="opacity:0.7">Hint: ${escapeAnkiTxtHtml(card.hint)}</small>`
      : frontBase;
    const backHtml = escapeAnkiTxtHtml(card.back);
    const tags = Array.from(
      new Set(
        ['kinich', ...(card.tags || [])]
          .map((t) =>
            String(t || '')
              .trim()
              .replace(/\s+/g, '_')
              .replace(/[^a-zA-Z0-9_\-:]/g, '')
          )
          .filter(Boolean)
      )
    ).join(' ');
    lines.push(`${frontWithHint}\t${backHtml}\t${tags}`);
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerBlobDownload(blob, `${slugifyFilename(cleanDeck)}-anki.txt`);
  return { ok: true, count: valid.length };
}

/**
 * Generates and downloads a genuine Anki .apkg package via /api/study/export-anki.
 * Falls back cleanly to Anki .txt if the server endpoint cannot be reached.
 */
export async function exportAnkiApkg(
  deckName: string,
  cards: AnkiExportCard[]
): Promise<{ ok: boolean; format: 'apkg' | 'txt'; count: number; error?: string }> {
  const valid = cards
    .filter((c) => c.front?.trim() && c.back?.trim())
    .map((c) => ({
      front: c.front.trim(),
      back: c.back.trim(),
      hint: c.hint?.trim() || undefined,
      tags: c.tags,
    }));

  if (valid.length === 0) {
    return { ok: false, format: 'apkg', count: 0, error: 'No flashcards available to export.' };
  }

  try {
    const headers = await getAuthHeaders();
    const res = await apiFetch('/api/study/export-anki', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        deckName: deckName.trim() || 'Kinich Study Deck',
        cards: valid,
      }),
    });

    if (!res.ok) {
      throw new Error(`Export failed (${res.status})`);
    }

    const blob = await res.blob();
    if (!blob || blob.size < 100) {
      throw new Error('Empty .apkg archive received');
    }

    triggerBlobDownload(blob, `${slugifyFilename(deckName)}.apkg`);
    return { ok: true, format: 'apkg', count: valid.length };
  } catch (err: any) {
    // Graceful fallback so students always walk away with an importable Anki deck
    const txtRes = exportAnkiTxt(deckName, valid);
    return {
      ok: txtRes.ok,
      format: 'txt',
      count: txtRes.count,
      error: err?.message,
    };
  }
}
