import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { zipSync, strToU8 } from 'fflate';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';

const ANKI_CARD_SCHEMA = z.object({
  front: z.string().min(1).max(6000),
  back: z.string().min(1).max(12000),
  hint: z.string().max(2000).optional(),
  tags: z.array(z.string().max(64)).max(12).optional(),
});

const ANKI_EXPORT_SCHEMA = z.object({
  deckName: z.string().min(1).max(180).default('Kinich Study Deck'),
  cards: z.array(ANKI_CARD_SCHEMA).min(1).max(500),
});

const PODCAST_REQUEST_SCHEMA = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10).max(28000),
  style: z.enum(['deep_dive', 'exam_cram', 'debate', 'story']).optional().default('deep_dive'),
  length: z.enum(['short', 'standard', 'extended']).optional().default('standard'),
  language: z.string().max(60).optional().default('English'),
  focusPrompt: z.string().max(400).optional().default(''),
  hostAName: z.string().max(32).optional().default('Alex'),
  hostBName: z.string().max(32).optional().default('Maya'),
});

function getServerGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converts Markdown + $...$ / $$...$$ math into clean Anki HTML + MathJax (\(...\) and \[...\]),
 * which Anki Desktop, AnkiDroid, and AnkiMobile render natively out of the box.
 */
function formatFieldForAnkiHtml(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return '';

  // Protect math blocks first so HTML escaping doesn't corrupt LaTeX commands
  const mathPlaceholders: string[] = [];
  const stash = (converted: string) => {
    const idx = mathPlaceholders.push(converted) - 1;
    return `@@ANKIMATH_${idx}@@`;
  };

  let working = text
    // Display math $$...$$ -> \[...\]
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner) => stash(`\\[${escapeHtml(inner.trim())}\\]`))
    // Display math \[...\] -> preserve
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => stash(`\\[${escapeHtml(inner.trim())}\\]`))
    // Inline math \(...\) -> preserve
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => stash(`\\(${escapeHtml(inner.trim())}\\)`))
    // Inline math $...$ (avoid matching currency like $5 or $10/mo)
    .replace(/\$(?!\d+(?:[.,]\d+)?(?:\s|\/|$))([^\n$]+?)\$/g, (_m, inner) =>
      stash(`\\(${escapeHtml(inner.trim())}\\)`)
    );

  // Escape remaining prose safely
  working = escapeHtml(working);

  // Lightweight inline Markdown formatting
  working = working
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*\n]+)\*/g, '<i>$1</i>')
    .replace(/\r?\n/g, '<br>');

  // Restore MathJax tokens
  working = working.replace(/@@ANKIMATH_(\d+)@@/g, (_m, idxStr) => {
    const idx = Number(idxStr);
    return mathPlaceholders[idx] ?? '';
  });

  return working;
}

function stripHtmlForChecksum(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function ankiFieldChecksum(fieldHtml: string): number {
  const stripped = stripHtmlForChecksum(fieldHtml);
  const hash = crypto.createHash('sha1').update(stripped, 'utf8').digest('hex');
  return parseInt(hash.slice(0, 8), 16);
}

function generateAnkiGuid(seed: string): string {
  const alphabet =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_`{|}~';
  const digest = crypto.createHash('sha256').update(seed).digest();
  let num = digest.readBigUInt64BE(0);
  let out = '';
  const base = BigInt(alphabet.length);
  while (num > 0n && out.length < 10) {
    out += alphabet[Number(num % base)];
    num /= base;
  }
  return out.padEnd(10, '0');
}

function sanitizeAnkiTag(tag: string): string {
  return String(tag || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-:]/g, '')
    .slice(0, 48);
}

function buildAnkiApkgBuffer(
  deckName: string,
  cards: Array<{ front: string; back: string; hint?: string; tags?: string[] }>
): Uint8Array {
  const db = new Database(':memory:');
  try {
    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const deckId = nowMs;
    const modelId = nowMs - 1000;
    const cleanDeckName = deckName.replace(/[\r\n\t]+/g, ' ').trim() || 'Kinich Study Deck';

    db.exec(`
      CREATE TABLE col (
        id integer primary key,
        crt integer not null,
        mod integer not null,
        scm integer not null,
        ver integer not null,
        dty integer not null,
        usn integer not null,
        ls integer not null,
        conf text not null,
        models text not null,
        decks text not null,
        dconf text not null,
        tags text not null
      );
      CREATE TABLE notes (
        id integer primary key,
        guid text not null,
        mid integer not null,
        mod integer not null,
        usn integer not null,
        tags text not null,
        flds text not null,
        sfld integer not null,
        csum integer not null,
        flags integer not null,
        data text not null
      );
      CREATE TABLE cards (
        id integer primary key,
        nid integer not null,
        did integer not null,
        ord integer not null,
        mod integer not null,
        usn integer not null,
        type integer not null,
        queue integer not null,
        due integer not null,
        ivl integer not null,
        factor integer not null,
        reps integer not null,
        lapses integer not null,
        left integer not null,
        odue integer not null,
        odid integer not null,
        flags integer not null,
        data text not null
      );
      CREATE TABLE revlog (
        id integer primary key,
        cid integer not null,
        usn integer not null,
        ease integer not null,
        ivl integer not null,
        lastIvl integer not null,
        factor integer not null,
        time integer not null,
        type integer not null
      );
      CREATE TABLE graves (
        usn integer not null,
        oid integer not null,
        type integer not null
      );
      CREATE INDEX ix_notes_usn ON notes (usn);
      CREATE INDEX ix_cards_usn ON cards (usn);
      CREATE INDEX ix_revlog_usn ON revlog (usn);
      CREATE INDEX ix_cards_nid ON cards (nid);
      CREATE INDEX ix_cards_sched ON cards (did, queue, due);
      CREATE INDEX ix_revlog_cid ON revlog (cid);
      CREATE INDEX ix_notes_csum ON notes (csum);
    `);

    const conf = {
      nextPos: 1,
      estTimes: true,
      activeDecks: [deckId],
      sortType: 'noteFld',
      timeLim: 0,
      sortBackwards: false,
      addToCur: true,
      curDeck: deckId,
      newBury: true,
      newSpread: 0,
      dueCounts: true,
      curModel: String(modelId),
      collapseTime: 1200,
    };

    const models: Record<string, any> = {
      [String(modelId)]: {
        id: modelId,
        name: 'Kinich Basic (with Hint)',
        type: 0,
        mod: nowSec,
        usn: -1,
        sortf: 0,
        did: deckId,
        tmpls: [
          {
            name: 'Card 1',
            ord: 0,
            qfmt:
              '<div class="front">{{Front}}</div>{{#Hint}}<details class="hint"><summary>Show hint</summary><div>{{Hint}}</div></details>{{/Hint}}',
            afmt:
              '{{FrontSide}}<hr id="answer"><div class="back">{{Back}}</div>',
            bqfmt: '',
            bafmt: '',
            did: null,
            bfont: '',
            bsize: 0,
          },
        ],
        flds: [
          { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
          { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
          { name: 'Hint', ord: 2, sticky: false, rtl: false, font: 'Arial', size: 16, media: [] },
        ],
        css: `.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 18px;
  line-height: 1.6;
  text-align: left;
  color: #111827;
  background-color: #ffffff;
  max-width: 680px;
  margin: 0 auto;
  padding: 20px;
}
.nightMode .card {
  color: #f4f4f5;
  background-color: #09090b;
}
.front { font-weight: 600; }
.back { margin-top: 12px; }
.hint { margin-top: 14px; font-size: 14px; opacity: 0.78; }
.hint summary { cursor: pointer; font-weight: 500; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; padding: 1px 4px; border-radius: 4px; background: rgba(127,127,127,0.15); }`,
        latexPre:
          '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
        latexPost: '\\end{document}',
        latexsvg: false,
        req: [[0, 'any', [0]]],
        tags: [],
        vers: [],
      },
    };

    const decks: Record<string, any> = {
      '1': {
        id: 1,
        mod: nowSec,
        name: 'Default',
        usn: 0,
        lrnToday: [0, 0],
        revToday: [0, 0],
        newToday: [0, 0],
        timeToday: [0, 0],
        collapsed: false,
        browserCollapsed: false,
        desc: '',
        dyn: 0,
        conf: 1,
        extendNew: 10,
        extendRev: 50,
      },
      [String(deckId)]: {
        id: deckId,
        mod: nowSec,
        name: cleanDeckName,
        usn: -1,
        lrnToday: [0, 0],
        revToday: [0, 0],
        newToday: [0, 0],
        timeToday: [0, 0],
        collapsed: false,
        browserCollapsed: false,
        desc: 'Exported from Kinich Study Space',
        dyn: 0,
        conf: 1,
        extendNew: 10,
        extendRev: 50,
      },
    };

    const dconf: Record<string, any> = {
      '1': {
        id: 1,
        mod: 0,
        name: 'Default',
        usn: 0,
        maxTaken: 60,
        autoplay: true,
        timer: 0,
        replayq: true,
        new: {
          bury: false,
          delays: [1, 10],
          initialFactor: 2500,
          ints: [1, 4, 7],
          order: 1,
          perDay: 20,
        },
        rev: {
          bury: false,
          ease4: 1.3,
          ivlFct: 1,
          maxIvl: 36500,
          perDay: 200,
          hardFactor: 1.2,
        },
        lapse: {
          delays: [10],
          leechAction: 0,
          leechFails: 8,
          minInt: 1,
          mult: 0,
        },
      },
    };

    db.prepare(
      `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
       VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')`
    ).run(
      nowSec,
      nowMs,
      nowMs,
      JSON.stringify(conf),
      JSON.stringify(models),
      JSON.stringify(decks),
      JSON.stringify(dconf)
    );

    const insertNote = db.prepare(
      `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
       VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')`
    );
    const insertCard = db.prepare(
      `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
       VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')`
    );

    const insertAll = db.transaction(() => {
      cards.forEach((card, idx) => {
        const noteId = nowMs + idx + 1;
        const cardId = nowMs + 10000 + idx + 1;
        const frontHtml = formatFieldForAnkiHtml(card.front);
        const backHtml = formatFieldForAnkiHtml(card.back);
        const hintHtml = card.hint ? formatFieldForAnkiHtml(card.hint) : '';
        const flds = `${frontHtml}\x1f${backHtml}\x1f${hintHtml}`;
        const sfld = stripHtmlForChecksum(frontHtml);
        const csum = ankiFieldChecksum(frontHtml);
        const cleanTags = ['kinich', ...(card.tags || [])]
          .map(sanitizeAnkiTag)
          .filter(Boolean);
        const uniqueTags = Array.from(new Set(cleanTags));
        const tagsStr = uniqueTags.length > 0 ? ` ${uniqueTags.join(' ')} ` : '';
        const guid = generateAnkiGuid(`${cleanDeckName}:${idx}:${card.front}:${nowMs}`);

        insertNote.run(noteId, guid, modelId, nowSec, tagsStr, flds, sfld, csum);
        insertCard.run(cardId, noteId, deckId, nowSec, idx + 1);
      });
    });

    insertAll();

    const sqliteBytes = new Uint8Array(db.serialize());
    return zipSync(
      {
        'collection.anki2': sqliteBytes,
        media: strToU8('{}'),
      },
      { level: 6 }
    );
  } finally {
    db.close();
  }
}

/**
 * Strips the 44-byte RIFF WAV header from clips after the first and updates RIFF/data sizes
 * so multiple unary Gemini 3.8 TTS WAV clips join into a single seamless 24kHz mono 16-bit WAV.
 */
function concatWavClips(wavBuffers: Buffer[]): { wav: Buffer; durationSec: number } {
  const pcmParts: Buffer[] = [];
  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;

  for (const buf of wavBuffers) {
    if (!buf || buf.length < 16) continue;
    const isRiff = buf.subarray(0, 4).toString('ascii') === 'RIFF';
    if (isRiff && buf.length > 44) {
      // Read actual header fields from the first valid WAV clip
      if (pcmParts.length === 0) {
        numChannels = buf.readUInt16LE(22) || 1;
        sampleRate = buf.readUInt32LE(24) || 24000;
        bitsPerSample = buf.readUInt16LE(34) || 16;
      }
      // Find the "data" subchunk cleanly (usually at byte 36, but scan safely)
      let offset = 12;
      let foundData = false;
      while (offset + 8 <= buf.length) {
        const chunkId = buf.subarray(offset, offset + 4).toString('ascii');
        const chunkSize = buf.readUInt32LE(offset + 4);
        if (chunkId === 'data') {
          const dataStart = offset + 8;
          const dataEnd = Math.min(buf.length, dataStart + chunkSize);
          pcmParts.push(buf.subarray(dataStart, dataEnd));
          foundData = true;
          break;
        }
        offset += 8 + chunkSize + (chunkSize % 2);
      }
      if (!foundData) {
        pcmParts.push(buf.subarray(44));
      }
    } else {
      // Headerless raw PCM fallback
      pcmParts.push(buf);
    }
  }

  const combinedPcm = Buffer.concat(pcmParts);
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + combinedPcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(combinedPcm.length, 40);

  const wav = Buffer.concat([header, combinedPcm]);
  const durationSec = byteRate > 0 ? combinedPcm.length / byteRate : 0;
  return { wav, durationSec };
}

interface PodcastTurnRaw {
  speaker: 'Alex' | 'Maya';
  text: string;
  cue?: string;
}

interface PodcastChapterRaw {
  title: string;
  turnIndex: number;
}

function estimateWordCount(text: string): number {
  return Math.max(3, String(text || '').trim().split(/\s+/).filter(Boolean).length);
}

export function registerStudyMediaRoutes(app: Express) {
  /**
   * POST /api/study/export-anki
   * Generates a real, spec-compliant Anki .apkg deck (SQLite collection.anki2 + media JSON).
   */
  app.post('/api/study/export-anki', (req: Request, res: Response) => {
    try {
      const parsed = ANKI_EXPORT_SCHEMA.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid flashcards payload. Provide at least 1 card with front and back text.',
        });
      }

      const { deckName, cards } = parsed.data;
      const apkgBytes = buildAnkiApkgBuffer(deckName, cards);
      const safeSlug = deckName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'kinich-deck';

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeSlug}.apkg"`);
      res.setHeader('X-Anki-Card-Count', String(cards.length));
      res.setHeader('Cache-Control', 'no-store');
      return res.send(Buffer.from(apkgBytes));
    } catch (err: any) {
      console.error('[Anki Export] Failed to build .apkg:', err?.message || err);
      return res.status(500).json({
        ok: false,
        error: 'Could not generate Anki .apkg package right now.',
      });
    }
  });

  /**
   * POST /api/study/podcast
   * Generates a 2-host conversational study podcast script (gemini-4-hydrogen)
   * and synthesizes real multi-speaker studio audio (gemini-3.8-flash-tts).
   */
  app.post('/api/study/podcast', async (req: Request, res: Response) => {
    try {
      const parsed = PODCAST_REQUEST_SCHEMA.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Please provide a study title and at least a short summary or notes to generate a 2-host podcast.',
        });
      }

      const { title, content, style, length, language, focusPrompt, hostAName, hostBName } =
        parsed.data;

      const ai = getServerGeminiClient();
      if (!ai) {
        return res.status(503).json({
          ok: false,
          error: 'Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const hostA = hostAName.trim() || 'Alex';
      const hostB = hostBName.trim() || 'Maya';

      const styleGuidance: Record<string, string> = {
        deep_dive:
          'A NotebookLM-style deep dive: unpack intuition, real-world analogies, why concepts work, and surprising connections.',
        exam_cram:
          'A crisp, high-yield exam cram session: call out definitions, formulas spoken naturally, common exam traps, and memory hooks.',
        debate:
          'A lively, friendly intellectual debate where Alex and Maya test competing angles, challenge assumptions, and synthesize the strongest conclusion.',
        story:
          'A narrative-driven explanation weaving the ideas into a vivid story and real historical or practical scenario.',
      };

      const lengthGuidance: Record<string, { turns: string; words: string }> = {
        short: { turns: '8 to 10 turns', words: '200 to 260 total words (~1.5 minutes)' },
        standard: { turns: '12 to 16 turns', words: '380 to 480 total words (~3 minutes)' },
        extended: { turns: '18 to 22 turns', words: '580 to 720 total words (~4.5 minutes)' },
      };

      const langDirective =
        language && language.toLowerCase() !== 'english'
          ? `Write all dialogue naturally in conversational ${language} while keeping standard technical terms clear and accurately pronounced.`
          : 'Write all dialogue in crisp, natural spoken English.';

      const scriptPrompt = `Create a vivid, natural 2-host educational podcast episode about: "${title}".

Hosts:
- Alex (${hostA}): Energetic, curious host who asks sharp questions, introduces analogies, and keeps momentum flowing.
- Maya (${hostB}): Analytical, articulate co-host who explains core mechanisms cleanly and catches subtle mistakes.

Format & Style:
- ${styleGuidance[style]}
- Length: ${lengthGuidance[length].turns}, around ${lengthGuidance[length].words}.
- ${langDirective}
${focusPrompt ? `- Special user focus: ${focusPrompt}` : ''}
- STRICT RULES FOR SPOKEN AUDIO:
  1. Write pure spoken dialogue—NO markdown asterisks, NO bullet lists, NO LaTeX backslashes, NO URLs. Spell formulas how a smart human actually says them aloud (e.g., "E equals m c squared", "f of x").
  2. Alternate naturally between speaker "Alex" and speaker "Maya". Keep each turn punchy (1 to 3 sentences) so the back-and-forth feels genuinely alive.
  3. Include occasional natural conversational flow ("Wait, hold on—", "Exactly, and here's the catch...") without overdoing filler words.
  4. Provide 3 to 4 short chapter markers mapping to turn indices (0-based).

Source Study Material:
${content.slice(0, 14000)}`;

      // Step 1: Structured 2-host script via gemini-4-hydrogen
      const scriptRes = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: scriptPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              episodeTitle: {
                type: Type.STRING,
                description: 'Catchy, clear podcast episode title.',
              },
              summary: {
                type: Type.STRING,
                description: 'One-sentence description of what listeners will learn.',
              },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    turnIndex: { type: Type.INTEGER },
                  },
                  required: ['title', 'turnIndex'],
                },
              },
              turns: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: {
                      type: Type.STRING,
                      description: 'Must be exactly "Alex" or "Maya".',
                    },
                    text: {
                      type: Type.STRING,
                      description: 'Clean spoken dialogue with no markdown symbols.',
                    },
                    cue: {
                      type: Type.STRING,
                      description: 'Short vocal delivery style, e.g. enthusiastic, curious, thoughtful.',
                    },
                  },
                  required: ['speaker', 'text'],
                },
              },
            },
            required: ['episodeTitle', 'summary', 'turns'],
          },
        },
      });

      const rawJson = (scriptRes.text ?? '').trim();
      let scriptData: {
        episodeTitle?: string;
        summary?: string;
        chapters?: PodcastChapterRaw[];
        turns?: PodcastTurnRaw[];
      } = {};

      try {
        scriptData = JSON.parse(rawJson);
      } catch {
        const match = rawJson.match(/\{[\s\S]*\}/);
        if (match) {
          scriptData = JSON.parse(match[0]);
        }
      }

      const cleanedTurns: PodcastTurnRaw[] = Array.isArray(scriptData.turns)
        ? scriptData.turns
            .map((t, idx) => {
              const spRaw = String(t?.speaker || '').toLowerCase();
              const speaker: 'Alex' | 'Maya' =
                spRaw.includes('maya') || spRaw.includes('b') || spRaw.includes('host 2')
                  ? 'Maya'
                  : spRaw.includes('alex') || spRaw.includes('a') || spRaw.includes('host 1')
                  ? 'Alex'
                  : idx % 2 === 0
                  ? 'Alex'
                  : 'Maya';
              const cleanedText = String(t?.text || '')
                .replace(/[*#_`~]+/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              return {
                speaker,
                text: cleanedText,
                cue: String(t?.cue || '').trim().slice(0, 80) || undefined,
              };
            })
            .filter((t) => t.text.length > 0)
        : [];

      if (cleanedTurns.length < 2) {
        return res.status(502).json({
          ok: false,
          error: 'Could not generate a 2-host dialogue script from this material. Please try again.',
        });
      }

      const episodeTitle = String(scriptData.episodeTitle || title).trim().slice(0, 160);
      const summary = String(scriptData.summary || `A 2-host discussion exploring ${title}.`)
        .trim()
        .slice(0, 320);
      const chapters: PodcastChapterRaw[] = Array.isArray(scriptData.chapters)
        ? scriptData.chapters
            .filter((c) => c && typeof c.title === 'string')
            .map((c) => ({
              title: c.title.trim().slice(0, 80),
              turnIndex: Math.max(0, Math.min(cleanedTurns.length - 1, Number(c.turnIndex) || 0)),
            }))
        : [{ title: 'Introduction', turnIndex: 0 }];

      // Step 2: Real Multi-Speaker Studio Audio via gemini-3.8-flash-tts
      // Chunk turns into 6-turn batches so longer episodes synthesize reliably & cleanly.
      const BATCH_SIZE = 6;
      const wavClips: Buffer[] = [];
      let audioError: string | null = null;
      let audioEngine = 'gemini-3.8-flash-tts';

      try {
        for (let i = 0; i < cleanedTurns.length; i += BATCH_SIZE) {
          const batch = cleanedTurns.slice(i, i + BATCH_SIZE);
          const parts = batch.map((turn) => ({
            text: `${turn.speaker}: ${turn.text}`,
            speechMetadata: {
              speaker: turn.speaker,
              style:
                turn.cue ||
                (turn.speaker === 'Alex'
                  ? 'Enthusiastic, warm podcast host'
                  : 'Articulate, curious co-host'),
            },
          }));

          const ttsRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [{ role: 'user', parts }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                    {
                      speaker: 'Alex',
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Puck' },
                      },
                    },
                    {
                      speaker: 'Maya',
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                      },
                    },
                  ],
                },
              },
            },
          });

          const inlineAudio = ttsRes?.candidates?.[0]?.content?.parts?.find(
            (p: any) => p?.inlineData?.data
          )?.inlineData;

          if (!inlineAudio?.data) {
            throw new Error('Empty audio payload returned by Gemini multi-speaker TTS');
          }

          wavClips.push(Buffer.from(inlineAudio.data, 'base64'));
        }
      } catch (ttsErr: any) {
        console.warn('[2-Host Podcast] Multi-speaker TTS failed:', ttsErr?.message || ttsErr);
        audioError =
          ttsErr?.message ||
          'Multi-speaker studio audio could not be synthesized right now. Browser dual-voice playback is ready.';
        audioEngine = 'browser-dual-voice-fallback';
      }

      let audioBase64: string | null = null;
      let durationSec = 0;

      if (wavClips.length > 0 && !audioError) {
        const merged = concatWavClips(wavClips);
        audioBase64 = merged.wav.toString('base64');
        durationSec = Math.max(1, Math.round(merged.durationSec * 10) / 10);
      } else {
        // Estimate duration from total word count (~2.5 words/sec) for fallback browser playback
        const totalWords = cleanedTurns.reduce((sum, t) => sum + estimateWordCount(t.text), 0);
        durationSec = Math.max(15, Math.round(totalWords / 2.5));
      }

      // Compute proportional startSec / endSec per turn for live transcript highlighting & tap-to-seek
      const totalWeights = cleanedTurns.reduce((sum, t) => sum + estimateWordCount(t.text), 0);
      let cursor = 0;
      const timedTurns = cleanedTurns.map((turn, idx) => {
        const weight = estimateWordCount(turn.text);
        const turnDur = totalWeights > 0 ? (weight / totalWeights) * durationSec : durationSec / cleanedTurns.length;
        const startSec = Math.round(cursor * 10) / 10;
        cursor += turnDur;
        const endSec = idx === cleanedTurns.length - 1 ? durationSec : Math.round(cursor * 10) / 10;
        return {
          index: idx,
          speaker: turn.speaker,
          speakerDisplayName: turn.speaker === 'Alex' ? hostA : hostB,
          text: turn.text,
          cue: turn.cue,
          startSec,
          endSec,
        };
      });

      return res.json({
        ok: true,
        episodeTitle,
        summary,
        style,
        length,
        language,
        hosts: {
          Alex: { name: hostA, voice: 'Puck', role: 'Host' },
          Maya: { name: hostB, voice: 'Kore', role: 'Co-Host' },
        },
        chapters,
        turns: timedTurns,
        durationSec,
        audioBase64,
        audioMimeType: audioBase64 ? 'audio/wav' : null,
        engine: audioEngine,
        audioError,
      });
    } catch (err: any) {
      console.error('[2-Host Podcast] Route failed:', err?.message || err);
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Could not generate the 2-host podcast right now. Please retry.',
      });
    }
  });

  /**
   * POST /api/arxiv/article
   * Fetches the COMPLETE full-text HTML paper from arxiv.org/html/{id} (or ar5iv.labs.arxiv.org/html/{id}
   * fallback for older papers) along with official Atom metadata, returning the entire paper in English by default.
   */
  const ARXIV_ARTICLE_SCHEMA = z.object({
    arxivId: z.string().min(4).max(120),
    language: z.enum(['en', 'zh']).optional().default('en'),
    paperMeta: z
      .object({
        title: z.string().optional(),
        authors: z.array(z.string()).optional(),
        summary: z.string().optional(),
        published: z.string().optional(),
        categories: z.array(z.string()).optional(),
      })
      .optional(),
  });

  function decodeXmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripHtmlTagsClean(html: string): string {
    return decodeXmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<math[\s\S]*?<\/math>/gi, (m) => {
          const alt = m.match(/alttext="([^"]+)"/i);
          if (!alt) return ' ';
          return ` ${alt[1].replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^}]*)\}/g, '$1')} `;
        })
        .replace(/<cite[^>]*>([\s\S]*?)<\/cite>/gi, ' $1 ')
        .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
        .replace(/<[^>]+>/g, ' ')
    );
  }

  /**
   * Extracts ALL sections, subsections, paragraphs, and figure captions from an arXiv / ar5iv LaTeXML HTML document.
   * Preserves the complete full paper without truncating to a summary.
   */
  function extractFullPaperFromArxivHtml(
    html: string
  ): Array<{ id: string; title: string; level?: number; paragraphs: string[] }> {
    const sections: Array<{ id: string; title: string; level?: number; paragraphs: string[] }> = [];

    // 1. Extract Abstract block if present in HTML
    const absMatch = html.match(/<div\b[^>]*class="[^"]*ltx_abstract[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (absMatch) {
      const absParas = Array.from(absMatch[1].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
        .map((m) => stripHtmlTagsClean(m[1]))
        .filter((p) => p.length >= 25);
      if (absParas.length > 0) {
        sections.push({
          id: 'sec-abstract',
          title: 'Abstract',
          level: 1,
          paragraphs: absParas,
        });
      }
    }

    // 2. Walk every ltx_section / ltx_appendix / ltx_subsection heading in document order
    // Strip heavy bibliography / nav / footer containers first so we don't pollute prose with 500 BibTeX entries
    const bodyOnly = html
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<section\b[^>]*class="[^"]*ltx_bibliography[^"]*"[^>]*>[\s\S]*?<\/section>/gi, ' ');

    // Split by top-level headings (<h2 ... ltx_title_section|ltx_title_appendix> and <h3 ... ltx_title_subsection>)
    const headingRe =
      /<(h[234])\b[^>]*class="[^"]*ltx_title_(section|subsection|subsubsection|appendix|paragraph)[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;

    const matches: Array<{ index: number; endIndex: number; tag: string; kind: string; title: string }> = [];
    let hm: RegExpExecArray | null;
    while ((hm = headingRe.exec(bodyOnly)) !== null) {
      const cleanTitle = stripHtmlTagsClean(hm[3]);
      if (!cleanTitle) continue;
      if (/^(references|bibliography)$/i.test(cleanTitle.replace(/^[\d.\s]+/, '').trim())) {
        // Stop before raw reference list while keeping everything prior (including Appendices if before refs)
        matches.push({
          index: hm.index,
          endIndex: hm.index + hm[0].length,
          tag: hm[1].toLowerCase(),
          kind: 'references_marker',
          title: cleanTitle,
        });
        continue;
      }
      matches.push({
        index: hm.index,
        endIndex: hm.index + hm[0].length,
        tag: hm[1].toLowerCase(),
        kind: hm[2].toLowerCase(),
        title: cleanTitle.slice(0, 140),
      });
    }

    let secCounter = 1;
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      if (cur.kind === 'references_marker') continue;

      const sliceEnd = i + 1 < matches.length ? matches[i + 1].index : bodyOnly.length;
      const chunk = bodyOnly.slice(cur.endIndex, sliceEnd);

      // Extract paragraphs, display equations, list items, and figure captions in order
      const blockParas: string[] = [];
      const blockRe =
        /<(?:p\b[^>]*class="[^"]*ltx_p[^"]*"[^>]*|figcaption\b[^>]*|li\b[^>]*class="[^"]*ltx_item[^"]*"[^>]*|table\b[^>]*class="[^"]*ltx_equation[^"]*"[^>]*)>([\s\S]*?)<\/(?:p|figcaption|li|table)>/gi;
      let bm: RegExpExecArray | null;
      while ((bm = blockRe.exec(chunk)) !== null) {
        const cleaned = stripHtmlTagsClean(bm[1]);
        if (cleaned.length >= 20) {
          // Deduplicate nested <p> inside <li> or <figcaption>
          if (blockParas.length > 0 && blockParas[blockParas.length - 1].includes(cleaned)) {
            continue;
          }
          blockParas.push(cleaned);
        }
      }

      // Fallback if chunk uses plain <p> tags without ltx_p class
      if (blockParas.length === 0) {
        const plainPRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
        let pm: RegExpExecArray | null;
        while ((pm = plainPRe.exec(chunk)) !== null) {
          const cleaned = stripHtmlTagsClean(pm[1]);
          if (cleaned.length >= 20) {
            blockParas.push(cleaned);
          }
        }
      }

      if (blockParas.length > 0) {
        sections.push({
          id: `sec-${secCounter}`,
          title: cur.title,
          level: cur.kind === 'subsection' ? 2 : cur.kind === 'subsubsection' ? 3 : 1,
          paragraphs: blockParas,
        });
        secCounter += 1;
      }
    }

    // Fallback: if no LaTeXML section headings matched, extract all <p> tags across the article body
    if (sections.length <= 1) {
      const allP = Array.from(bodyOnly.matchAll(/<p\b[^>]*class="[^"]*ltx_p[^"]*"[^>]*>([\s\S]*?)<\/p>/gi))
        .map((m) => stripHtmlTagsClean(m[1]))
        .filter((p) => p.length >= 35);
      if (allP.length > 2) {
        const chunkSize = 8;
        for (let i = 0; i < allP.length; i += chunkSize) {
          sections.push({
            id: `sec-body-${Math.floor(i / chunkSize) + 1}`,
            title: `Part ${Math.floor(i / chunkSize) + 1}`,
            level: 1,
            paragraphs: allP.slice(i, i + chunkSize),
          });
        }
      }
    }

    return sections;
  }

  app.post('/api/arxiv/article', async (req: Request, res: Response) => {
    try {
      const parsed = ARXIV_ARTICLE_SCHEMA.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'Invalid arXiv paper ID.' });
      }

      const rawId = parsed.data.arxivId
        .trim()
        .replace(/^https?:\/\/(?:ar5iv\.labs\.)?arxiv\.org\/(?:abs|pdf|html)\//i, '')
        .replace(/\.pdf$/i, '')
        .replace(/v\d+$/i, '');

      if (!/^[a-z\-]+\/\d{7}$|^\d{4}\.\d{4,5}$/i.test(rawId)) {
        return res.status(400).json({
          ok: false,
          error: 'Please enter a valid arXiv ID (for example 1706.03762 or 2501.12948).',
        });
      }

      let title = parsed.data.paperMeta?.title?.trim() || '';
      let authors = parsed.data.paperMeta?.authors || [];
      let summary = parsed.data.paperMeta?.summary?.trim() || '';
      let published = parsed.data.paperMeta?.published || '';
      let categories = parsed.data.paperMeta?.categories || [];

      // 1. Fetch official Atom metadata from export.arxiv.org
      if (!title || !summary) {
        try {
          const atomRes = await fetch(
            `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(rawId)}`,
            {
              headers: { 'User-Agent': 'KinichAcademicReader/1.0' },
              signal: AbortSignal.timeout(9000),
            }
          );
          if (atomRes.ok) {
            const xml = await atomRes.text();
            const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1] || '';
            if (entry) {
              const tMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
              const sMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
              const pMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
              const aMatches = [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g)];
              const cMatches = [...entry.matchAll(/<category[^>]*term="([^"]+)"/g)];
              if (tMatch && !title) title = decodeXmlEntities(tMatch[1]);
              if (sMatch && !summary) summary = decodeXmlEntities(sMatch[1]);
              if (pMatch && !published) published = pMatch[1].trim();
              if (aMatches.length > 0 && authors.length === 0) {
                authors = aMatches.map((m) => decodeXmlEntities(m[1])).filter(Boolean);
              }
              if (cMatches.length > 0 && categories.length === 0) {
                categories = cMatches.map((m) => m[1]).slice(0, 5);
              }
            }
          }
        } catch (metaErr: any) {
          console.warn('[arXiv Article] Atom metadata fetch failed:', metaErr?.message || metaErr);
        }
      }

      // 2. Fetch COMPLETE full-paper HTML from arxiv.org/html first, then ar5iv.labs.arxiv.org/html fallback
      let fullSections: Array<{ id: string; title: string; level?: number; paragraphs: string[] }> = [];
      let sourceKind: 'arxiv-html' | 'ar5iv-html' | 'arxiv-abstract' = 'arxiv-abstract';
      let htmlUrl: string | null = null;

      const htmlCandidates: Array<{ url: string; kind: 'arxiv-html' | 'ar5iv-html' }> = [
        { url: `https://arxiv.org/html/${encodeURIComponent(rawId)}`, kind: 'arxiv-html' },
        { url: `https://ar5iv.labs.arxiv.org/html/${encodeURIComponent(rawId)}`, kind: 'ar5iv-html' },
      ];

      for (const candidate of htmlCandidates) {
        try {
          const htmlRes = await fetch(candidate.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; KinichAcademicReader/1.0)',
              Accept: 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(14000),
          });
          if (!htmlRes.ok) continue;
          const contentType = htmlRes.headers.get('content-type') || '';
          if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            continue;
          }
          const html = await htmlRes.text();
          // Ensure it's an actual LaTeXML paper HTML and not an "HTML unavailable" page
          if (html.length < 4000 || !/ltx_document|ltx_section|ltx_p/i.test(html)) {
            continue;
          }

          if (!title) {
            const h1 = html.match(/<h1\b[^>]*class="[^"]*ltx_title_document[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1) title = stripHtmlTagsClean(h1[1]);
          }

          const extracted = extractFullPaperFromArxivHtml(html);
          if (extracted.length >= 2) {
            // Ensure Abstract is first if Atom had it and HTML didn't include an ltx_abstract block
            const hasAbs = extracted.some((s) => /^abstract$/i.test(s.title));
            fullSections =
              !hasAbs && summary
                ? [{ id: 'sec-abstract', title: 'Abstract', level: 1, paragraphs: [summary] }, ...extracted]
                : extracted;
            sourceKind = candidate.kind;
            htmlUrl = candidate.url;
            break;
          }
        } catch (htmlErr: any) {
          console.warn(`[arXiv Article] ${candidate.kind} fetch skipped:`, htmlErr?.message || htmlErr);
        }
      }

      if (!title) {
        return res.status(404).json({
          ok: false,
          error: `Could not find arXiv paper ${rawId}. Check the ID or search by topic.`,
        });
      }

      // 3. Return the COMPLETE full-paper HTML sections directly (never summarize away the paper!)
      if (fullSections.length > 0) {
        return res.json({
          ok: true,
          paper: {
            id: rawId,
            arxivId: rawId,
            title,
            subtitle: authors.slice(0, 5).join(', ') + (authors.length > 5 ? ' et al.' : ''),
            authors,
            published,
            categories,
            primaryCategory: categories[0] || 'arXiv',
            language: 'en',
            sourceKind,
            htmlUrl,
            absUrl: `https://arxiv.org/abs/${rawId}`,
            pdfUrl: `https://arxiv.org/pdf/${rawId}.pdf`,
            sections: fullSections,
          },
        });
      }

      // 4. Only if neither arxiv.org/html nor ar5iv has an HTML version, return Atom abstract cleanly
      return res.json({
        ok: true,
        paper: {
          id: rawId,
          arxivId: rawId,
          title,
          subtitle: authors.slice(0, 5).join(', ') + (authors.length > 5 ? ' et al.' : ''),
          authors,
          published,
          categories,
          primaryCategory: categories[0] || 'arXiv',
          language: 'en',
          sourceKind: 'arxiv-abstract',
          htmlUrl: null,
          absUrl: `https://arxiv.org/abs/${rawId}`,
          pdfUrl: `https://arxiv.org/pdf/${rawId}.pdf`,
          sections: [
            {
              id: 'sec-abstract',
              title: 'Abstract',
              level: 1,
              paragraphs: [
                summary || 'Full HTML version is not available for this paper on arXiv/ar5iv. Use the PDF link above to view the original manuscript.',
              ],
            },
          ],
        },
      });
    } catch (err: any) {
      console.error('[arXiv Article] Route error:', err?.message || err);
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Could not load arXiv paper right now.',
      });
    }
  });
}
