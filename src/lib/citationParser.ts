import { normalizeMathDelimiters } from '../components/MathMarkdown';

export function renumberCitationsByFirstAppearance<
  T extends { position?: number; url?: string; title?: string }
>(rawContent: string, rawSources: T[]): { content: string; sources: T[] } {
  if (!rawContent || !rawSources || rawSources.length === 0) {
    return { content: rawContent, sources: rawSources || [] };
  }

  const oldToNew = new Map<number, number>();
  const reordered: T[] = [];
  const usedIndices = new Set<number>();

  const resolveOldSourceIndex = (oldNum: number): number => {
    const byPos = rawSources.findIndex((s, i) => (s.position ?? i + 1) === oldNum);
    if (byPos !== -1) return byPos;
    if (oldNum >= 1 && oldNum <= rawSources.length) return oldNum - 1;
    return -1;
  };

  const registerOldNum = (oldNum: number): number | null => {
    if (isNaN(oldNum) || oldNum < 1) return null;
    const existing = oldToNew.get(oldNum);
    if (existing) return existing;
    const srcIdx = resolveOldSourceIndex(oldNum);
    if (srcIdx === -1) return null;
    const newNum = reordered.length + 1;
    oldToNew.set(oldNum, newNum);
    usedIndices.add(srcIdx);
    reordered.push({ ...rawSources[srcIdx], position: newNum });
    return newNum;
  };

  // Scan outside fenced code blocks in order of first appearance
  const segments = rawContent.split(/(```[\s\S]*?```)/g);
  for (const seg of segments) {
    if (seg.startsWith('```')) continue;
    const citeRegex = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?:\(#cite-\d+\))?(?!\()/g;
    let match: RegExpExecArray | null;
    while ((match = citeRegex.exec(seg)) !== null) {
      const nums = match[1].split(',').map((n) => parseInt(n.trim(), 10));
      for (const n of nums) {
        registerOldNum(n);
      }
    }
  }

  if (oldToNew.size === 0) {
    return {
      content: rawContent,
      sources: rawSources.map((s, idx) => ({ ...s, position: idx + 1 })),
    };
  }

  // Append any uncited sources after the cited ones so source count stays consistent
  rawSources.forEach((s, idx) => {
    if (!usedIndices.has(idx)) {
      const nextPos = reordered.length + 1;
      reordered.push({ ...s, position: nextPos });
    }
  });

  // Rewrite citations in non-code segments to their new sequential numbers
  const rewrittenContent = segments
    .map((seg) => {
      if (seg.startsWith('```')) return seg;
      return seg.replace(
        /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?:\(#cite-\d+\))?(?!\()/g,
        (full, numListStr: string) => {
          const mappedNums: number[] = [];
          for (const part of numListStr.split(',')) {
            const oldNum = parseInt(part.trim(), 10);
            const newNum = oldToNew.get(oldNum) ?? oldNum;
            if (!mappedNums.includes(newNum)) {
              mappedNums.push(newNum);
            }
          }
          if (mappedNums.length === 0) return full;
          return mappedNums.map((n) => `[${n}]`).join('');
        }
      );
    })
    .join('');

  return { content: rewrittenContent, sources: reordered };
}

export const preprocessMessageContent = (content: string): string => {
  if (!content) return '';
  const normalizedMath = normalizeMathDelimiters(content);
  const parts = normalizedMath.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part) => {
      if (part.startsWith('```')) {
        return part;
      }
      let processed = part;
      // Close any unclosed <svg> tag at the end of the text
      const openSvgCount = (processed.match(/<svg\b/gi) || []).length;
      const closeSvgCount = (processed.match(/<\/svg>/gi) || []).length;
      if (openSvgCount > closeSvgCount) {
        processed += '</svg>';
      }
      // Convert raw <svg>...</svg> blocks into fenced svg-render blocks so CommonMark doesn't split them across <p> tags
      processed = processed.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svgMatch) => {
        return `\n\n\`\`\`svg-render\n${svgMatch.trim()}\n\`\`\`\n\n`;
      });

      // Prevent runaway markdown headings (#, ##, ###, ####) if a heading line exceeds 100 characters
      processed = processed.replace(/^(#{1,6})\s+(.+)$/gm, (fullMatch, hashes, headingText) => {
        const cleanHeading = headingText.trim();
        if (cleanHeading.length > 100) {
          // Split at the first em-dash, colon, or 75-char boundary so a full paragraph never becomes a giant bold heading
          const dashSplit = cleanHeading.match(/^(.{3,75}?)\s+(?:—|--|:)\s+(.+)$/);
          if (dashSplit) {
            return `${hashes} ${dashSplit[1].trim()}\n\n${dashSplit[2].trim()}`;
          }
          const shortTitle = cleanHeading.split(/\s+/).slice(0, 8).join(' ');
          return `${hashes} ${shortTitle}…\n\n${cleanHeading}`;
        }
        return fullMatch;
      });

      // Strip any hallucinated [FETCHED LIVE IMAGES]: placeholder lists if an upstream model emits them
      processed = processed.replace(
        /\[FETCHED LIVE IMAGES[^\]]*\]:?\s*(?:\n+(?:\d+\.|[-*])\s*[^\n]*\[Images?\s+of[^\n]*)+/gi,
        ''
      );
      processed = processed.replace(/\[FETCHED LIVE IMAGES[^\]]*\]:?/gi, '');

      // Normalize [Source 1], (Source 1), 【1】 into standard [1]
      processed = processed
        .replace(/\[(?:source|src|ref)\s*(\d{1,2})\]/gi, '[$1]')
        .replace(/\((?:source|src|ref)\s*(\d{1,2})\)/gi, '[$1]')
        .replace(/【(\d{1,2})】/g, '[$1]');

      // Normalize comma-separated citations [1, 2] into consecutive [1][2]
      processed = processed.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})+)\](?!\()/g, (_, nums) =>
        nums
          .split(',')
          .map((n: string) => `[${n.trim()}]`)
          .join('')
      );
      // Normalize whitespace or commas between adjacent citations [1], [2] or [1] [2] -> [1][2]
      processed = processed.replace(/\[(\d{1,2})\](?:,\s*|\s+)(?=\[\d{1,2}\](?!\())/g, '[$1]');

      // Use non-breaking space before inline citation markers so a chip doesn't wrap onto its own line,
      // without wrapping in raw HTML <span> tags that prevent CommonMark from parsing [n](#cite-n) links
      processed = processed.replace(/([^\s\n])[ \t]+(?=\[\d{1,2}\](?!\())/g, '$1\u00A0');

      // Convert all [1] markers into markdown citation links [1](#cite-1)
      processed = processed.replace(/\[(\d{1,2})\](?!\()/g, '[$1](#cite-$1)');
      return processed;
    })
    .join('');
};
