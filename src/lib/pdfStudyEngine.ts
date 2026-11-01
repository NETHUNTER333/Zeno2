export interface DocumentSectionSummary {
  pageNumber: number;
  title: string;
  summary: string;
}

export interface DocumentConceptItem {
  term: string;
  definition: string;
  mechanism: string;
  pageRef?: number;
}

export interface DocumentFlashcardItem {
  id: string;
  front: string;
  back: string;
  category: string;
  pageRef?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface DocumentQuizItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  pageRef?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface DocumentFormulaOrRule {
  label: string;
  expression: string;
  meaning: string;
}

export interface DocumentStudyBundle {
  title: string;
  pageCount: number;
  wordCount: number;
  readTimeMin: number;
  summary: {
    overview: string;
    keyPoints: string[];
    sections: DocumentSectionSummary[];
  };
  explanation: {
    coreThesis: string;
    concepts: DocumentConceptItem[];
  };
  flashcards: DocumentFlashcardItem[];
  quiz: DocumentQuizItem[];
  cheatsheet: {
    formulasOrRules: DocumentFormulaOrRule[];
    examTips: string[];
  };
}

/**
 * Extracts readable text from raw PDF binary bytes as a zero-worker fallback
 * when pdfjs-dist worker is unavailable or restricted in sandboxed iframes.
 */
function extractPdfTextFallbackFromBytes(bytes: Uint8Array): string {
  try {
    const decoder = new TextDecoder('latin1');
    const raw = decoder.decode(bytes.subarray(0, Math.min(bytes.length, 4 * 1024 * 1024)));
    const chunks: string[] = [];

    const btMatches = raw.match(/BT[\s\S]{1,12000}?ET/g) || [];
    const targetPool = btMatches.length > 0 ? btMatches : [raw];

    for (const block of targetPool) {
      const parenRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
      let match: RegExpExecArray | null;
      while ((match = parenRegex.exec(block)) !== null) {
        const cleaned = match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, ' ')
          .replace(/\\t/g, ' ')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\')
          .replace(/[^\x20-\x7E\n]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleaned.length >= 2 && /[a-zA-Z]{2,}/.test(cleaned)) {
          chunks.push(cleaned);
        }
      }
    }

    const joined = chunks.join(' ').replace(/\s+/g, ' ').trim();
    return joined.slice(0, 180000);
  } catch {
    return '';
  }
}

/**
 * Extracts full page-by-page text and page count from a PDF File or Data URL in the browser.
 */
export async function extractTextFromPdfFile(
  fileOrDataUrl: File | string,
  fallbackName = 'Document.pdf'
): Promise<{ text: string; pageCount: number; pages: string[] }> {
  let arrayBuffer: ArrayBuffer | null = null;

  try {
    if (typeof fileOrDataUrl === 'string') {
      if (fileOrDataUrl.startsWith('data:')) {
        const base64Part = fileOrDataUrl.split(',')[1] || '';
        const binaryString = atob(base64Part);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        const resp = await fetch(fileOrDataUrl);
        if (resp.ok) {
          arrayBuffer = await resp.arrayBuffer();
        }
      }
    } else {
      arrayBuffer = await fileOrDataUrl.arrayBuffer();
    }
  } catch {}

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return {
      text: `Document: ${fallbackName}`,
      pageCount: 1,
      pages: [`Document: ${fallbackName}`],
    };
  }

  try {
    const pdfjsLib: any = await import('pdfjs-dist');
    if (pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${
        pdfjsLib.version || '4.4.168'
      }/pdf.worker.min.mjs`;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer.slice(0)),
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
    });

    const pdfDoc = await Promise.race([
      loadingTask.promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PDF load timeout')), 4500)
      ),
    ]);

    const numPages = Math.min(pdfDoc.numPages || 1, 80);
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = (textContent?.items || [])
          .map((item: any) => String(item?.str || ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (pageText) {
          pages.push(`[Page ${pageNum}]\n${pageText}`);
        }
      } catch {}
    }

    if (pages.length > 0) {
      return {
        text: pages.join('\n\n').slice(0, 180000),
        pageCount: pdfDoc.numPages || pages.length,
        pages,
      };
    }
  } catch {}

  const fallbackText = extractPdfTextFallbackFromBytes(new Uint8Array(arrayBuffer));
  if (fallbackText && fallbackText.length > 60) {
    const rawWords = fallbackText.split(/\s+/);
    const wordsPerPage = 320;
    const pages: string[] = [];
    for (let i = 0; i < rawWords.length; i += wordsPerPage) {
      const pageNum = Math.floor(i / wordsPerPage) + 1;
      pages.push(`[Page ${pageNum}]\n${rawWords.slice(i, i + wordsPerPage).join(' ')}`);
    }
    return {
      text: pages.join('\n\n'),
      pageCount: Math.max(1, pages.length),
      pages,
    };
  }

  return {
    text: `Uploaded Document: ${fallbackName}`,
    pageCount: 1,
    pages: [`[Page 1]\nUploaded Document: ${fallbackName}`],
  };
}
