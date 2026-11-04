import { jsPDF } from 'jspdf';
import { ChatMessage } from '../types';

export interface ExportableThread {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}

function sanitizeFilename(name: string): string {
  const cleaned = (name || 'kinich-conversation')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return cleaned || 'kinich-conversation';
}

function stripGenerativeUiBlocks(content: string): string {
  return (content || '')
    .replace(/```(?:html:generative-ui|generative-ui|open-generative-ui|a2ui)[\s\S]*?```/gi, '\n_[Interactive Simulation Module]_\n')
    .trim();
}

function stripMarkdownForPdf(markdown: string): string {
  return stripGenerativeUiBlocks(markdown)
    .replace(/```[\w-]*\n([\s\S]*?)```/g, '\n$1\n')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/<[^>]+>/g, '');
}

export function buildConversationMarkdown(thread: ExportableThread): string {
  const exportedDate = new Date().toLocaleString();
  const createdDate = new Date(thread.createdAt || Date.now()).toLocaleString();

  const lines: string[] = [
    `# ${thread.title || 'Kinich Conversation'}`,
    '',
    `- **Created**: ${createdDate}`,
    `- **Exported**: ${exportedDate}`,
    `- **Messages**: ${thread.messages.length}`,
    '',
    '---',
    '',
  ];

  thread.messages.forEach((msg, index) => {
    const isUser = msg.role === 'user';
    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
    const roleHeader = isUser
      ? `### User${timeStr ? ` _(${timeStr})_` : ''}`
      : `### Kinich${msg.modelUsed ? ` · \`${msg.modelUsed}\`` : ''}${
          msg.timing?.totalSec ? ` _(${msg.timing.totalSec}s)_` : ''
        }`;

    lines.push(roleHeader);
    lines.push('');

    if (msg.attachments && msg.attachments.length > 0) {
      lines.push('**Attachments:**');
      msg.attachments.forEach((att) => {
        const sizeKb = (att.size / 1024).toFixed(1);
        lines.push(`- \`${att.name}\` (${att.type}, ${sizeKb} KB)`);
      });
      lines.push('');
    }

    const body = stripGenerativeUiBlocks(msg.content);
    lines.push(body || '_(Empty message)_');
    lines.push('');

    if (msg.sources && msg.sources.length > 0) {
      lines.push('**Web Sources:**');
      msg.sources.forEach((src, sIdx) => {
        lines.push(`${sIdx + 1}. [${src.title || src.domain || src.url}](${src.url})`);
      });
      lines.push('');
    }

    if (msg.videos && msg.videos.length > 0) {
      lines.push('**Referenced Videos:**');
      msg.videos.forEach((vid, vIdx) => {
        lines.push(
          `${vIdx + 1}. [${vid.title}](${vid.link})${vid.author ? ` — ${vid.author}` : ''}${
            vid.length ? ` (${vid.length})` : ''
          }`
        );
      });
      lines.push('');
    }

    if (msg.arxivPapers && msg.arxivPapers.length > 0) {
      lines.push('**arXiv Papers:**');
      msg.arxivPapers.forEach((paper, pIdx) => {
        lines.push(
          `${pIdx + 1}. [${paper.title}](${paper.pdfUrl}) — ${paper.authors.slice(0, 3).join(', ')} (${paper.published})`
        );
      });
      lines.push('');
    }

    if (msg.githubRepos && msg.githubRepos.length > 0) {
      lines.push('**GitHub Repositories:**');
      msg.githubRepos.forEach((repo, rIdx) => {
        lines.push(
          `${rIdx + 1}. [${repo.name}](${repo.url}) — ${repo.stars ? `★ ${repo.stars} stars` : ''} | ${repo.description}`
        );
      });
      lines.push('');
    }

    if (index < thread.messages.length - 1) {
      lines.push('---');
      lines.push('');
    }
  });

  return lines.join('\n');
}

export function exportConversationAsMarkdown(thread: ExportableThread): void {
  const markdown = buildConversationMarkdown(thread);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(thread.title)}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportConversationAsPdf(thread: ExportableThread): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
  };

  // Document Title Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 15, 15);
  const titleLines = doc.splitTextToSize(thread.title || 'Kinich Conversation', contentWidth);
  doc.text(titleLines, margin, cursorY);
  cursorY += titleLines.length * 22 + 4;

  // Metadata subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 100, 100);
  const metaText = `Exported ${new Date().toLocaleString()}  •  ${thread.messages.length} ${
    thread.messages.length === 1 ? 'message' : 'messages'
  }`;
  doc.text(metaText, margin, cursorY);
  cursorY += 16;

  // Divider line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.75);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 20;

  thread.messages.forEach((msg, idx) => {
    const isUser = msg.role === 'user';
    ensureSpace(48);

    // Role badge / header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    if (isUser) {
      doc.setTextColor(20, 20, 20);
      doc.text('USER', margin, cursorY);
    } else {
      doc.setTextColor(40, 40, 40);
      const suffix = [
        msg.modelUsed ? msg.modelUsed : null,
        msg.timing?.totalSec ? `${msg.timing.totalSec}s` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      doc.text(`ZENO${suffix ? `  (${suffix})` : ''}`, margin, cursorY);
    }
    cursorY += 15;

    // Attachments note if any
    if (msg.attachments && msg.attachments.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
      const attLine = `Attached: ${msg.attachments
        .map((a) => `${a.name} (${(a.size / 1024).toFixed(1)} KB)`)
        .join(', ')}`;
      const wrappedAtt = doc.splitTextToSize(attLine, contentWidth);
      wrappedAtt.forEach((line: string) => {
        ensureSpace(13);
        doc.text(line, margin, cursorY);
        cursorY += 13;
      });
      cursorY += 4;
    }

    // Message content paragraphs
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 30, 30);

    const cleanedText = stripMarkdownForPdf(msg.content || '');
    const paragraphs = cleanedText.split('\n');

    paragraphs.forEach((para) => {
      const trimmed = para.trimEnd();
      if (!trimmed) {
        cursorY += 6;
        return;
      }
      const wrappedLines = doc.splitTextToSize(trimmed, contentWidth);
      wrappedLines.forEach((line: string) => {
        ensureSpace(15);
        doc.text(line, margin, cursorY);
        cursorY += 14.5;
      });
    });

    // Sources block
    if (msg.sources && msg.sources.length > 0) {
      cursorY += 6;
      ensureSpace(24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text('Sources:', margin, cursorY);
      cursorY += 12;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      msg.sources.slice(0, 6).forEach((src, sIdx) => {
        const srcLine = `[${sIdx + 1}] ${src.title || src.domain || 'Source'} — ${src.url}`;
        const wrappedSrc = doc.splitTextToSize(srcLine, contentWidth);
        wrappedSrc.forEach((line: string) => {
          ensureSpace(12);
          doc.text(line, margin, cursorY);
          cursorY += 11.5;
        });
      });
    }

    // Separator between messages
    if (idx < thread.messages.length - 1) {
      cursorY += 10;
      ensureSpace(20);
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.5);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 16;
    }
  });

  // Page numbers in footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 22,
      { align: 'right' }
    );
  }

  doc.save(`${sanitizeFilename(thread.title)}.pdf`);
}

export function buildNotionReadyMarkdown(thread: ExportableThread): string {
  const exportedDate = new Date().toISOString().split('T')[0];
  const createdDate = new Date(thread.createdAt || Date.now()).toLocaleString();

  const lines: string[] = [
    `# ${thread.title || 'Kinich Research Thread'}`,
    '',
    `> **Workspace Export** · Created ${createdDate} · Exported ${exportedDate} · ${thread.messages.length} messages`,
    '',
    '---',
    '',
  ];

  thread.messages.forEach((msg, index) => {
    const isUser = msg.role === 'user';
    if (isUser) {
      lines.push(`## Prompt ${(index / 2 + 1) | 0}`);
      lines.push(`> **Question:** ${msg.content.replace(/\n/g, '\n> ')}`);
      lines.push('');
    } else {
      const metaParts = [
        msg.modelUsed ? `Model: \`${msg.modelUsed}\`` : null,
        msg.timing?.totalSec ? `Latency: \`${msg.timing.totalSec}s\`` : null,
        msg.sources?.length ? `Sources: \`${msg.sources.length}\`` : null,
      ].filter(Boolean);

      if (metaParts.length > 0) {
        lines.push(`_${metaParts.join(' · ')}_`);
        lines.push('');
      }

      lines.push(stripGenerativeUiBlocks(msg.content) || '_(No content)_');
      lines.push('');

      if (msg.sources && msg.sources.length > 0) {
        lines.push('#### Citations & Web Sources');
        msg.sources.forEach((src, sIdx) => {
          lines.push(`- **[${sIdx + 1}]** [${src.title || src.domain || src.url}](${src.url}) — _${src.domain || 'web'}_`);
        });
        lines.push('');
      }

      if (msg.arxivPapers && msg.arxivPapers.length > 0) {
        lines.push('#### Academic ArXiv Papers');
        msg.arxivPapers.forEach((paper) => {
          lines.push(`- **arXiv:${paper.id}** [${paper.title}](${paper.absUrl}) — ${paper.authors.slice(0, 3).join(', ')}`);
        });
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  });

  return lines.join('\n');
}

export type ShareCardTheme =
  | 'carbon'
  | 'ivory'
  | 'slate'
  | 'obsidian-gold'
  | 'emerald-terminal';

export type ShareCardAspectRatio = 'landscape' | 'square' | 'story';

export interface QuoteCardConfig {
  title: string;
  promptText?: string;
  answerText: string;
  modelName?: string;
  sourcesCount?: number;
  dateStr?: string;
  authorName?: string;
  publicUrl?: string;
  aspectRatio?: ShareCardAspectRatio;
  theme: ShareCardTheme;
}

function getSharePalette(theme: ShareCardTheme) {
  switch (theme) {
    case 'ivory':
      return {
        bg: '#FAF8F5',
        surface: '#F1EDE6',
        border: '#E2DDD5',
        textPrimary: '#141413',
        textSecondary: '#3E3C38',
        textMuted: '#78756F',
        accent: '#0F172A',
        badgeBg: '#E6E1D8',
      };
    case 'slate':
      return {
        bg: '#0F172A',
        surface: '#1E293B',
        border: '#334155',
        textPrimary: '#F8FAFC',
        textSecondary: '#CBD5E1',
        textMuted: '#64748B',
        accent: '#38BDF8',
        badgeBg: '#1E293B',
      };
    case 'obsidian-gold':
      return {
        bg: '#09090B',
        surface: '#141311',
        border: '#3A3120',
        textPrimary: '#FAF5E8',
        textSecondary: '#E4DBC5',
        textMuted: '#9A8B6D',
        accent: '#F59E0B',
        badgeBg: '#1F1B12',
      };
    case 'emerald-terminal':
      return {
        bg: '#06110D',
        surface: '#0C1F17',
        border: '#193D2E',
        textPrimary: '#ECFDF5',
        textSecondary: '#A7F3D0',
        textMuted: '#528E74',
        accent: '#10B981',
        badgeBg: '#0F291E',
      };
    case 'carbon':
    default:
      return {
        bg: '#0A0A0C',
        surface: '#141418',
        border: '#26262E',
        textPrimary: '#F4F4F6',
        textSecondary: '#D4D4D8',
        textMuted: '#71717A',
        accent: '#FFFFFF',
        badgeBg: '#18181D',
      };
  }
}

export function renderQuoteCardToCanvas(
  canvas: HTMLCanvasElement,
  config: QuoteCardConfig
): void {
  const scale = 2; // 2x Retina High-Res PNG
  const ratio: ShareCardAspectRatio = config.aspectRatio || 'landscape';
  const width = ratio === 'story' ? 760 : ratio === 'square' ? 880 : 920;
  const padding = ratio === 'story' ? 54 : 56;
  const contentWidth = width - padding * 2;

  const palette = getSharePalette(config.theme);

  const tempCtx = canvas.getContext('2d');
  if (!tempCtx) return;

  const wrapCanvasText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number
  ): string[] => {
    const clean = stripMarkdownForPdf(text).replace(/\s+/g, ' ').trim();
    const words = clean.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
        if (lines.length >= maxLines - 1) break;
      }
    }
    if (current && lines.length < maxLines) {
      lines.push(current);
    }
    if (lines.length === maxLines && words.length > lines.join(' ').split(' ').length) {
      lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:!?]?$/, '…');
    }
    return lines;
  };

  const maxAnswerLines = ratio === 'story' ? 20 : ratio === 'square' ? 14 : 11;

  tempCtx.font = '600 22px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  const promptLines = config.promptText
    ? wrapCanvasText(tempCtx, config.promptText, contentWidth - 36, ratio === 'story' ? 4 : 3)
    : [];

  tempCtx.font = '400 21px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  const answerLines = wrapCanvasText(
    tempCtx,
    config.answerText || '',
    contentWidth,
    maxAnswerLines
  );

  const promptBlockHeight = promptLines.length > 0 ? promptLines.length * 32 + 44 : 0;
  const answerBlockHeight = Math.max(1, answerLines.length) * 34 + 28;
  const computedHeight = padding * 2 + 86 + promptBlockHeight + answerBlockHeight + 82;

  const height =
    ratio === 'story'
      ? Math.max(1280, computedHeight)
      : ratio === 'square'
      ? Math.max(880, computedHeight)
      : Math.max(520, computedHeight);

  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);

  // Outer background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle 1.5px frame border
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  let y = padding;

  // Header brand + metadata
  ctx.fillStyle = palette.textPrimary;
  ctx.font = '700 20px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('ZENO', padding, y + 18);

  ctx.fillStyle = palette.textMuted;
  ctx.font = '500 13px "JetBrains Mono", monospace';
  const headerMeta = [
    config.modelName || 'Kinich Synthesis',
    config.sourcesCount ? `${config.sourcesCount} cited sources` : null,
    config.dateStr ||
      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  ]
    .filter(Boolean)
    .join('  ·  ');
  const metaWidth = ctx.measureText(headerMeta).width;
  ctx.fillText(headerMeta, width - padding - metaWidth, y + 17);

  y += 40;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += 28;

  // Card Title
  if (config.title) {
    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 24px "Plus Jakarta Sans", -apple-system, sans-serif';
    const titleLines = wrapCanvasText(ctx, config.title, contentWidth, 2);
    titleLines.forEach((line, idx) => {
      ctx.fillText(line, padding, y + 24 + idx * 32);
    });
    y += titleLines.length * 32 + 20;
  }

  // Optional Prompt Box
  if (promptLines.length > 0) {
    const boxH = promptLines.length * 31 + 24;
    ctx.fillStyle = palette.surface;
    ctx.beginPath();
    ctx.roundRect(padding, y, contentWidth, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.stroke();

    ctx.fillStyle = palette.textPrimary;
    ctx.font = '600 19px "Plus Jakarta Sans", -apple-system, sans-serif';
    promptLines.forEach((line, idx) => {
      ctx.fillText(line, padding + 18, y + 29 + idx * 31);
    });
    y += boxH + 26;
  }

  // Answer Prose
  ctx.fillStyle = palette.textSecondary;
  ctx.font = '400 20.5px "Plus Jakarta Sans", -apple-system, sans-serif';
  answerLines.forEach((line, idx) => {
    ctx.fillText(line, padding, y + 22 + idx * 34);
  });

  // Footer
  const footerY = height - padding + 6;
  ctx.strokeStyle = palette.border;
  ctx.beginPath();
  ctx.moveTo(padding, footerY - 28);
  ctx.lineTo(width - padding, footerY - 28);
  ctx.stroke();

  ctx.fillStyle = palette.textMuted;
  ctx.font = '500 13px "Plus Jakarta Sans", -apple-system, sans-serif';
  const leftFooter = config.authorName
    ? `Shared by ${config.authorName.slice(0, 32)}  ·  Explore with Kinich`
    : 'Explore with Kinich  →  kinich.app';
  ctx.fillText(leftFooter, padding, footerY);

  const rightWatermark = 'kinich.app';
  ctx.font = '500 12px "JetBrains Mono", monospace';
  const rwWidth = ctx.measureText(rightWatermark).width;
  ctx.fillText(rightWatermark, width - padding - rwWidth, footerY);
}

export function downloadQuoteCardPng(config: QuoteCardConfig): void {
  const canvas = document.createElement('canvas');
  renderQuoteCardToCanvas(canvas, config);
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${sanitizeFilename(config.title)}-kinich-card.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

export interface WeeklyReportCardConfig {
  periodLabel: string;
  conversationsCount: number;
  researchSessionsCount: number;
  savedVaultItemsCount: number;
  studyGuidesCount: number;
  publishedArtifactsCount: number;
  activeDaysCount: number;
  levelName: string;
  topTopics: string[];
  includeTopics: boolean;
  theme: ShareCardTheme;
}

export function renderWeeklyReportCardToCanvas(
  canvas: HTMLCanvasElement,
  config: WeeklyReportCardConfig
): void {
  const scale = 2;
  const width = 880;
  const height = 880;
  const padding = 56;
  const contentWidth = width - padding * 2;
  const palette = getSharePalette(config.theme);

  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  let y = padding;

  // Brand + Period
  ctx.fillStyle = palette.textPrimary;
  ctx.font = '700 18px "JetBrains Mono", monospace';
  ctx.fillText('KINICH // WEEKLY INTELLIGENCE BRIEF', padding, y + 16);

  ctx.fillStyle = palette.textMuted;
  ctx.font = '500 13px "JetBrains Mono", monospace';
  const periodW = ctx.measureText(config.periodLabel).width;
  ctx.fillText(config.periodLabel, width - padding - periodW, y + 16);

  y += 38;
  ctx.strokeStyle = palette.border;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();

  y += 48;

  // Headline
  ctx.fillStyle = palette.textPrimary;
  ctx.font = '700 34px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('Your Week with Kinich', padding, y);

  y += 30;
  ctx.fillStyle = palette.textMuted;
  ctx.font = '500 16px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText(
    `Intelligence Tier: ${config.levelName}  ·  ${config.activeDaysCount} active research days`,
    padding,
    y
  );

  y += 42;

  // 2x2 Metrics Grid
  const metrics = [
    {
      label: 'RESEARCH SESSIONS',
      value: String(config.researchSessionsCount),
      sub: `${config.conversationsCount} total threads`,
    },
    {
      label: 'KNOWLEDGE VAULT',
      value: String(config.savedVaultItemsCount),
      sub: 'Saved insights & notes',
    },
    {
      label: 'STUDY & DOCUMENTS',
      value: String(config.studyGuidesCount),
      sub: 'Study guides & PDFs analyzed',
    },
    {
      label: 'PUBLISHED PAGES',
      value: String(config.publishedArtifactsCount),
      sub: 'Community resources shared',
    },
  ];

  const cardW = (contentWidth - 24) / 2;
  const cardH = 148;

  metrics.forEach((m, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = padding + col * (cardW + 24);
    const cy = y + row * (cardH + 20);

    ctx.fillStyle = palette.surface;
    ctx.beginPath();
    ctx.roundRect(x, cy, cardW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.stroke();

    ctx.fillStyle = palette.textMuted;
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillText(m.label, x + 24, cy + 34);

    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 44px "JetBrains Mono", monospace';
    ctx.fillText(m.value, x + 24, cy + 90);

    ctx.fillStyle = palette.textSecondary;
    ctx.font = '400 14px "Plus Jakarta Sans", -apple-system, sans-serif';
    ctx.fillText(m.sub, x + 24, cy + 122);
  });

  y += cardH * 2 + 54;

  // Domains explored (only if user opted to include them)
  if (config.includeTopics && config.topTopics.length > 0) {
    ctx.fillStyle = palette.textMuted;
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillText('DOMAINS EXPLORED THIS WEEK', padding, y);
    y += 26;

    ctx.fillStyle = palette.textSecondary;
    ctx.font = '500 17px "Plus Jakarta Sans", -apple-system, sans-serif';
    const topicsLine = config.topTopics.slice(0, 5).join('   ·   ');
    ctx.fillText(topicsLine.slice(0, 74), padding, y);
  } else {
    ctx.fillStyle = palette.textSecondary;
    ctx.font = '500 17px "Plus Jakarta Sans", -apple-system, sans-serif';
    ctx.fillText('Your curiosity is compounding into structured knowledge.', padding, y + 12);
  }

  // Footer
  const footerY = height - padding + 6;
  ctx.strokeStyle = palette.border;
  ctx.beginPath();
  ctx.moveTo(padding, footerY - 28);
  ctx.lineTo(width - padding, footerY - 28);
  ctx.stroke();

  ctx.fillStyle = palette.textMuted;
  ctx.font = '500 13px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('Private conversation contents excluded by default', padding, footerY);

  const rightWatermark = 'Explore with Kinich → kinich.app';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  const rwW = ctx.measureText(rightWatermark).width;
  ctx.fillText(rightWatermark, width - padding - rwW, footerY);
}

export function downloadWeeklyReportCardPng(config: WeeklyReportCardConfig): void {
  const canvas = document.createElement('canvas');
  renderWeeklyReportCardToCanvas(canvas, config);
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `kinich-weekly-brief.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


