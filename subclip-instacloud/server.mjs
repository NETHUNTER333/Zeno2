import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8080);
const PROJECT_ID = process.env.INSTACLOUD_PROJECT_ID || '0d8d285e-6ac2-4b38-b313-449dc5694cc2';
const PHONE_TUNNEL_FILE = path.resolve(process.cwd(), '.insta', 'phone_tunnel.json');

let registeredPhoneTunnel = {
  url: process.env.PHONE_TUNNEL_URL || '',
  updatedAt: 0,
};

try {
  if (fs.existsSync(PHONE_TUNNEL_FILE)) {
    const saved = JSON.parse(fs.readFileSync(PHONE_TUNNEL_FILE, 'utf8'));
    if (saved?.url) {
      registeredPhoneTunnel = {
        url: String(saved.url).replace(/\/+$/, ''),
        updatedAt: Number(saved.updatedAt || Date.now()),
      };
    }
  }
} catch {}

function savePhoneTunnelUrl(rawUrl) {
  const clean = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return registeredPhoneTunnel;
  registeredPhoneTunnel = { url: clean, updatedAt: Date.now() };
  try {
    fs.mkdirSync(path.dirname(PHONE_TUNNEL_FILE), { recursive: true });
    fs.writeFileSync(PHONE_TUNNEL_FILE, JSON.stringify(registeredPhoneTunnel, null, 2), 'utf8');
  } catch {}
  return registeredPhoneTunnel;
}

function getActivePhoneTunnelUrl() {
  return (registeredPhoneTunnel.url || process.env.PHONE_TUNNEL_URL || '').replace(/\/+$/, '');
}

function extractYouTubeId(input = '') {
  const trimmed = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : '';
}

function decodeXmlEntities(str = '') {
  return String(str)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTimedTranscriptXmlOrJson(bodyText = '') {
  const segments = [];
  if (!bodyText) return segments;
  const trimmed = bodyText.trim();

  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed);
      if (Array.isArray(json.events)) {
        for (const ev of json.events) {
          if (!Array.isArray(ev.segs)) continue;
          const combined = decodeXmlEntities(ev.segs.map((s) => s.utf8 || '').join(''));
          if (!combined) continue;
          const start_s = Math.max(0, Number(ev.tStartMs || 0) / 1000);
          const duration_s = Math.max(0.5, Number(ev.dDurationMs || 2500) / 1000);
          segments.push({
            start_s: Number(start_s.toFixed(2)),
            duration_s: Number(duration_s.toFixed(2)),
            text: combined,
          });
        }
        if (segments.length > 0) return segments;
      }
    } catch {}
  }

  const pMatches = bodyText.matchAll(/<p\s+[^>]*?\bt="(\d+)"[^>]*?(?:\bd="(\d+)")?[^>]*>([\s\S]*?)<\/p>/gi);
  for (const m of pMatches) {
    const start_s = Number(m[1]) / 1000;
    const duration_s = m[2] ? Number(m[2]) / 1000 : 2.5;
    const text = decodeXmlEntities(m[3]);
    if (text) {
      segments.push({
        start_s: Number(start_s.toFixed(2)),
        duration_s: Number(duration_s.toFixed(2)),
        text,
      });
    }
  }
  if (segments.length > 0) return segments;

  const textMatches = bodyText.matchAll(/<text\s+[^>]*?\bstart="([\d.]+)"[^>]*?(?:\bdur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi);
  for (const m of textMatches) {
    const start_s = Number(m[1]);
    const duration_s = m[2] ? Number(m[2]) : 2.5;
    const text = decodeXmlEntities(m[3]);
    if (text) {
      segments.push({
        start_s: Number(start_s.toFixed(2)),
        duration_s: Number(duration_s.toFixed(2)),
        text,
      });
    }
  }

  return segments;
}

async function fetchVideoMetadata(videoId) {
  let title = '';
  let author = '';
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let lengthSeconds = 0;
  let description = '';

  try {
    const oRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (oRes.ok) {
      const oData = await oRes.json();
      if (oData?.title) title = oData.title;
      if (oData?.author_name) author = oData.author_name;
      if (oData?.thumbnail_url) thumbnail = oData.thumbnail_url;
    }
  } catch {}

  return { title, author, thumbnail, lengthSeconds, description };
}

async function fetchSubclipTranscript(videoId, preferredLang = 'en') {
  const meta = await fetchVideoMetadata(videoId);
  let title = meta.title;
  let author = meta.author;
  let thumbnail = meta.thumbnail;
  let lengthSeconds = meta.lengthSeconds;
  let description = meta.description;
  let segments = [];
  let language = preferredLang;
  let provider = 'instacloud-subclip-ytp';

  // Tier 1: youtube-transcript-plus (handles visitorData, session cookies & multi-language tracks)
  try {
    const ytpMod = await import('youtube-transcript-plus');
    const fetchFn =
      ytpMod.fetchTranscript ||
      ytpMod.YoutubeTranscript?.fetchTranscript ||
      ytpMod.default?.fetchTranscript;
    if (typeof fetchFn === 'function') {
      let rawSegs = null;
      try {
        rawSegs = await fetchFn(videoId, { lang: preferredLang });
      } catch {
        rawSegs = await fetchFn(videoId);
      }
      if (Array.isArray(rawSegs) && rawSegs.length > 0) {
        segments = rawSegs
          .map((s) => {
            const rawOffset = Number(s.offset ?? s.start ?? 0);
            const rawDur = Number(s.duration ?? s.dur ?? 2.5);
            // youtube-transcript-plus returns offset & duration in seconds (float)
            const start_s = rawOffset > 36000 ? rawOffset / 1000 : rawOffset;
            const duration_s = rawDur > 600 ? rawDur / 1000 : rawDur;
            return {
              start_s: Number(Math.max(0, start_s).toFixed(2)),
              duration_s: Number(Math.max(0.4, duration_s).toFixed(2)),
              text: decodeXmlEntities(s.text || ''),
            };
          })
          .filter((s) => Boolean(s.text));
        if (rawSegs[0]?.lang) language = rawSegs[0].lang;
        provider = `instacloud-subclip-ytp (${language})`;
      }
    }
  } catch (err) {
    console.warn('Tier 1 youtube-transcript-plus warning:', err?.message);
  }

  // Tier 2: youtube-transcript package
  if (segments.length === 0) {
    try {
      const ytMod = await import('youtube-transcript');
      const fetchFn =
        ytMod.YoutubeTranscript?.fetchTranscript ||
        ytMod.default?.YoutubeTranscript?.fetchTranscript ||
        ytMod.fetchTranscript;
      if (typeof fetchFn === 'function') {
        const rawSegs = await fetchFn(videoId);
        if (Array.isArray(rawSegs) && rawSegs.length > 0) {
          segments = rawSegs
            .map((s) => {
              const rawOffset = Number(s.offset ?? s.start ?? 0);
              const rawDur = Number(s.duration ?? s.dur ?? 2.5);
              const start_s = rawOffset > 36000 ? rawOffset / 1000 : rawOffset;
              const duration_s = rawDur > 600 ? rawDur / 1000 : rawDur;
              return {
                start_s: Number(Math.max(0, start_s).toFixed(2)),
                duration_s: Number(Math.max(0.4, duration_s).toFixed(2)),
                text: decodeXmlEntities(s.text || ''),
              };
            })
            .filter((s) => Boolean(s.text));
          provider = 'instacloud-subclip-yt';
        }
      }
    } catch {}
  }

  // Tier 3: Innertube Player & Webpage Caption Track Extraction
  if (segments.length === 0) {
    try {
      const innertubeRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'IOS',
              clientVersion: '19.29.1',
              deviceMake: 'Apple',
              deviceModel: 'iPhone16,2',
              hl: preferredLang,
              gl: 'US',
            },
          },
          videoId,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (innertubeRes.ok) {
        const playerJson = await innertubeRes.json();
        if (playerJson?.videoDetails?.title && !title) title = playerJson.videoDetails.title;
        if (playerJson?.videoDetails?.author && !author) author = playerJson.videoDetails.author;
        if (playerJson?.videoDetails?.lengthSeconds) {
          lengthSeconds = Number(playerJson.videoDetails.lengthSeconds);
        }
        if (playerJson?.videoDetails?.shortDescription) {
          description = playerJson.videoDetails.shortDescription;
        }
        const tracks = playerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        if (Array.isArray(tracks) && tracks.length > 0) {
          const chosenTrack =
            tracks.find((t) => t.languageCode === preferredLang && t.kind !== 'asr') ||
            tracks.find((t) => t.languageCode?.startsWith(preferredLang)) ||
            tracks.find((t) => t.languageCode?.startsWith('en')) ||
            tracks[0];
          if (chosenTrack?.baseUrl) {
            for (const fmt of ['&fmt=json3', '&fmt=srv3', '']) {
              const trackRes = await fetch(chosenTrack.baseUrl + fmt, {
                signal: AbortSignal.timeout(3500),
              });
              if (trackRes.ok) {
                const body = await trackRes.text();
                const parsed = parseTimedTranscriptXmlOrJson(body);
                if (parsed.length > 0) {
                  segments = parsed;
                  language = chosenTrack.languageCode || preferredLang;
                  provider = `instacloud-subclip-innertube (${language})`;
                  break;
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  if (!lengthSeconds && segments.length > 0) {
    const last = segments[segments.length - 1];
    lengthSeconds = Math.ceil(last.start_s + (last.duration_s || 5));
  }

  return {
    videoId,
    title: title || `YouTube Video (${videoId})`,
    author: author || 'YouTube Creator',
    thumbnail,
    lengthSeconds,
    durationSec: lengthSeconds,
    description,
    language,
    provider,
    segments,
    project: PROJECT_ID,
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-InstaCloud-Project');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/health' || pathname === '/') {
    res.writeHead(200);
    return res.end(
      JSON.stringify({
        status: 'ok',
        service: 'subclip-instacloud-backend',
        projectId: PROJECT_ID,
        phoneTunnelUrl: getActivePhoneTunnelUrl() || null,
        phoneUpdatedAt: registeredPhoneTunnel.updatedAt || null,
        endpoints: ['/api/transcript', '/api/phone/register', '/api/phone/status', '/api/chat', '/health'],
      })
    );
  }

  if (pathname === '/api/phone/register' && req.method === 'POST') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body || '{}');
      const incomingUrl = String(payload.url || payload.tunnelUrl || '').trim();
      if (!incomingUrl || !/^https?:\/\//i.test(incomingUrl)) {
        res.writeHead(400);
        return res.end(JSON.stringify({ success: false, error: 'Valid https tunnel url is required' }));
      }
      const saved = savePhoneTunnelUrl(incomingUrl);
      res.writeHead(200);
      return res.end(JSON.stringify({ success: true, ...saved }));
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  if (pathname === '/api/phone/status' && req.method === 'GET') {
    const activeUrl = getActivePhoneTunnelUrl();
    res.writeHead(200);
    return res.end(
      JSON.stringify({
        success: true,
        online: Boolean(activeUrl),
        url: activeUrl || null,
        updatedAt: registeredPhoneTunnel.updatedAt || null,
      })
    );
  }

  if (pathname.startsWith('/api/transcript') && (req.method === 'POST' || req.method === 'GET')) {
    try {
      let payload = {};
      if (req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        payload = JSON.parse(body || '{}');
      } else {
        payload = {
          videoId: parsedUrl.searchParams.get('videoId') || parsedUrl.searchParams.get('v') || '',
          url: parsedUrl.searchParams.get('url') || '',
          lang: parsedUrl.searchParams.get('lang') || 'en',
        };
      }

      const vidId = extractYouTubeId(payload.videoId || payload.url || '');
      if (!vidId) {
        res.writeHead(400);
        return res.end(JSON.stringify({ success: false, error: 'Invalid YouTube URL or videoId' }));
      }
      const data = await fetchSubclipTranscript(vidId, payload.lang || 'en');
      res.writeHead(200);
      return res.end(JSON.stringify({ success: true, ...data }));
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  if (pathname.startsWith('/api/chat') && req.method === 'POST') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body || '{}');
      const question = String(payload.question || payload.prompt || '').trim();
      const segments = Array.isArray(payload.segments) ? payload.segments : [];
      const title = payload.title || 'YouTube Video';

      const qWords = question
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      const scored = segments.map((s) => {
        const lower = String(s.text || '').toLowerCase();
        let score = 0;
        for (const w of qWords) {
          if (lower.includes(w)) score += 2;
        }
        return { seg: s, score };
      });
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, 5).map((x) => x.seg);
      const chosen = top.length > 0 ? top : segments.slice(0, 5);
      const citations = chosen
        .map((s) => {
          const m = Math.floor(Number(s.start_s || 0) / 60);
          const sec = String(Math.floor(Number(s.start_s || 0) % 60)).padStart(2, '0');
          return `- **[${m}:${sec}]**: "${s.text}"`;
        })
        .join('\n');

      res.writeHead(200);
      return res.end(
        JSON.stringify({
          success: true,
          answer: `Based on the transcript of **${title}**:\n\n${citations}`,
          project: PROJECT_ID,
        })
      );
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Subclip InstaCloud service (${PROJECT_ID}) listening on :${PORT}`);
});
