import { jsPDF } from 'jspdf';
import { ChatMessage } from '../types';

export interface ExportableThread {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}

function sanitizeFilename(name: string): string {
  const cleaned = (name || 'zeno-conversation')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return cleaned || 'zeno-conversation';
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
    `# ${thread.title || 'Zeno Conversation'}`,
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
      : `### Zeno${msg.modelUsed ? ` · \`${msg.modelUsed}\`` : ''}${
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
  const titleLines = doc.splitTextToSize(thread.title || 'Zeno Conversation', contentWidth);
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
