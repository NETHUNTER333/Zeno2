import katex from 'katex';
import 'katex/contrib/mhchem';

/**
 * Shared STEM KaTeX macro dictionary covering physics, chemistry, calculus,
 * linear algebra, quantum mechanics, probability, and SI units.
 */
export const STEM_KATEX_MACROS: Record<string, string> = {
  '\\dd': '\\mathrm{d}',
  '\\dv': '\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}',
  '\\pdv': '\\frac{\\partial #1}{\\partial #2}',
  '\\grad': '\\nabla',
  '\\divg': '\\nabla\\cdot',
  '\\curl': '\\nabla\\times',
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\E': '\\mathbb{E}',
  '\\Var': '\\operatorname{Var}',
  '\\Cov': '\\operatorname{Cov}',
  '\\argmax': '\\operatorname*{argmax}',
  '\\argmin': '\\operatorname*{argmin}',
  '\\abs': '\\left|#1\\right|',
  '\\norm': '\\left\\|#1\\right\\|',
  '\\bra': '\\langle #1|',
  '\\ket': '|#1\\rangle',
  '\\braket': '\\langle #1|#2\\rangle',
  '\\degree': '^{\\circ}',
  '\\degC': '^{\\circ}\\mathrm{C}',
  '\\angstrom': '\\text{\\AA}',
  '\\vecbf': '\\mathbf{#1}',
  '\\unit': '\\,\\mathrm{#1}',
};

const NAMED_OR_NUMERIC_ENTITY_RE =
  /&(?:amp|apos|quot|nbsp|rsquo|lsquo|ldquo|rdquo|ndash|mdash|#0*(?:34|38|39|160|8211|8212|8216|8217|8220|8221)|#x0*(?:22|26|27|a0|2013|2014|2018|2019|201c|201d)|#(\d+)|#x([0-9a-fA-F]+));/gi;

function decodeSafeEntitiesOnce(text: string): string {
  return text.replace(NAMED_OR_NUMERIC_ENTITY_RE, (full, decGroup, hexGroup) => {
    const lower = full.toLowerCase();
    if (lower === '&amp;' || lower === '&#38;' || lower === '&#x26;') return '&';
    if (
      lower === '&apos;' ||
      lower === '&rsquo;' ||
      lower === '&lsquo;' ||
      lower === '&#39;' ||
      lower === '&#039;' ||
      lower === '&#x27;' ||
      lower === '&#8216;' ||
      lower === '&#8217;' ||
      lower === '&#x2018;' ||
      lower === '&#x2019;'
    ) {
      return "'";
    }
    if (
      lower === '&quot;' ||
      lower === '&ldquo;' ||
      lower === '&rdquo;' ||
      lower === '&#34;' ||
      lower === '&#x22;' ||
      lower === '&#8220;' ||
      lower === '&#8221;' ||
      lower === '&#x201c;' ||
      lower === '&#x201d;'
    ) {
      return '"';
    }
    if (lower === '&nbsp;' || lower === '&#160;' || lower === '&#xa0;') return ' ';
    if (lower === '&ndash;' || lower === '&#8211;' || lower === '&#x2013;') return '–';
    if (lower === '&mdash;' || lower === '&#8212;' || lower === '&#x2014;') return '—';

    const code = decGroup
      ? parseInt(decGroup, 10)
      : hexGroup
      ? parseInt(hexGroup, 16)
      : NaN;
    // Never decode < (60) or > (62) in markdown prose so HTML parsers cannot interpret escaped tags
    if (!Number.isFinite(code) || code === 60 || code === 62 || code < 32 || code > 0x10ffff) {
      return full;
    }
    try {
      return String.fromCodePoint(code);
    } catch {
      return full;
    }
  });
}

/**
 * Single canonical render-layer normalizer for HTML entities, escaped Unicode quotes,
 * and apostrophes outside fenced/inline code blocks.
 */
export function normalizeDisplayText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  const segments = raw.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return segments
    .map((segment) => {
      if (segment.startsWith('```') || segment.startsWith('`')) {
        return segment;
      }

      let s = segment
        .replace(/\\u0027/gi, "'")
        .replace(/\\u0026/gi, '&')
        .replace(/\\u0022/gi, '"')
        .replace(/\\u2018|\\u2019/gi, "'")
        .replace(/\\u201c|\\u201d/gi, '"');

      for (let pass = 0; pass < 3; pass++) {
        const next = decodeSafeEntitiesOnce(s);
        if (next === s) break;
        s = next;
      }

      return s
        .replace(/[\u2018\u2019\u02BC]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .normalize('NFC');
    })
    .join('');
}

const LATEX_COMMAND_SIGNAL_RE =
  /\\(?:frac|dfrac|tfrac|cfrac|sqrt|sum|prod|int|iint|iiint|oint|lim|infty|partial|nabla|cdot|times|div|pm|mp|approx|neq|leq|le|geq|ge|equiv|propto|sim|simeq|cong|rightarrow|leftarrow|leftrightarrow|Rightarrow|Leftarrow|Leftrightarrow|to|mapsto|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|hbar|ell|vec|vecbf|hat|bar|tilde|dot|ddot|overline|underline|text|mathrm|mathbf|mathbb|mathcal|operatorname|ce|pu|dd|dv|pdv|grad|divg|curl|bra|ket|braket|abs|norm|degree|degC|angstrom|unit|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp|det|binom|left|right)\b/;

const LATEX_ENV_SIGNAL_RE =
  /\\begin\{(?:equation\*?|align\*?|aligned|gather\*?|cases|pmatrix|bmatrix|vmatrix|matrix|smallmatrix)\}/;

/**
 * Escapes literal currency dollar signs (e.g. "$5", "$12.50", "$5 to $10", "$2.4B")
 * outside $$...$$ display math so remark-math does not mistake prices for inline math delimiters.
 */
export function escapeCurrencyDollars(text: string): string {
  if (!text || !text.includes('$')) return text;

  // Preserve $$...$$ display math blocks intact
  const parts = text.split(/(\$\$[\s\S]*?\$\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$')) return part;

      // Replace unescaped $ before digits when it clearly represents currency rather than math
      let out = '';
      let i = 0;
      while (i < part.length) {
        const ch = part[i];
        if (ch === '\\' && i + 1 < part.length) {
          out += ch + part[i + 1];
          i += 2;
          continue;
        }
        if (ch === '$') {
          const rest = part.slice(i + 1);
          const currencyLead = rest.match(/^(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/);
          if (currencyLead) {
            const afterNum = rest.slice(currencyLead[0].length);
            // If immediately followed by an alphabetic variable (e.g. $2x$) or caret/subscript ($2^3$), treat as math
            const isTightAlgebra = /^[a-zA-Z_^{\\]/.test(afterNum) && !/^(?:k|m|b|t|usd)\b/i.test(afterNum);
            if (!isTightAlgebra) {
              // Check if there is a closing $ later on the same line with explicit math operators between them
              const lineEnd = rest.indexOf('\n');
              const sameLine = lineEnd === -1 ? rest : rest.slice(0, lineEnd);
              const nextDollar = sameLine.indexOf('$');
              const insidePair = nextDollar !== -1 ? sameLine.slice(0, nextDollar) : '';
              const looksLikeMathPair =
                nextDollar !== -1 &&
                nextDollar > 0 &&
                (/[=+*<>^_\\|]/.test(insidePair) || /[\d)]\s*-\s*[\d(a-zA-Z\\]/.test(insidePair)) &&
                !/^\d[\d,.]*\s+(?:to|and|or|vs|per|for|-|–|—)\s*$/i.test(insidePair.trim());

              if (!looksLikeMathPair) {
                out += '\\$';
                i += 1;
                continue;
              }
            }
          }
        }
        out += ch;
        i += 1;
      }
      return out;
    })
    .join('');
}

/**
 * Returns true if the input contains unwrapped LaTeX commands, environments,
 * or braced LaTeX sub/superscripts.
 */
export function hasBareLatexSignals(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  if (LATEX_ENV_SIGNAL_RE.test(raw)) return true;
  if (LATEX_COMMAND_SIGNAL_RE.test(raw)) return true;
  if (/[A-Za-z0-9)\]][_^]\{[^{}\n]+\}/.test(raw)) return true;
  return false;
}

function findMatchingBraceEnd(str: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '{' && str[i - 1] !== '\\') depth++;
    else if (str[i] === '}' && str[i - 1] !== '\\') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Wraps bare LaTeX expressions or chemistry formulas when they lack $...$ / $$...$$ delimiters.
 */
export function wrapBareLatexIfNeeded(raw: string, preferDisplay = false): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  // Already delimited
  if (/(?:^|[^\\])\$[\s\S]+\$/.test(trimmed) || /\\\[[\s\S]+\\\]/.test(trimmed) || /\\\([\s\S]+\\\)/.test(trimmed)) {
    return raw;
  }

  if (!hasBareLatexSignals(trimmed)) {
    return raw;
  }

  // Detect whether the whole string is primarily a standalone equation / chemistry expression
  const strippedCmds = trimmed
    .replace(/\\(?:text|mathrm|mathbf|mathbb|mathcal|operatorname|ce|pu)\{[^{}]*\}/g, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ');
  const multiWordProse = /\b[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i.test(
    strippedCmds.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  );

  if (!multiWordProse) {
    return preferDisplay ? `$$\n${trimmed}\n$$` : `$${trimmed}$`;
  }

  // Mixed prose + bare LaTeX spans: wrap \ce{...}, \pu{...}, and contiguous math spans safely
  let result = '';
  let i = 0;
  while (i < raw.length) {
    // Match \ce{...} or \pu{...}
    if ((raw.startsWith('\\ce{', i) || raw.startsWith('\\pu{', i)) && (i === 0 || raw[i - 1] !== '\\')) {
      const braceOpen = i + 3;
      const braceClose = findMatchingBraceEnd(raw, braceOpen);
      if (braceClose !== -1) {
        const span = raw.slice(i, braceClose + 1);
        result += `$${span}$`;
        i = braceClose + 1;
        continue;
      }
    }

    // Match bare inline math equation segments starting with \command or var= / var_{...} / var^{...}
    const rest = raw.slice(i);
    const bareEqMatch = rest.match(
      /^((?:[A-Za-z0-9()\[\]]+(?:_\{[^{}]+\}|\^\{[^{}]+\}|_[A-Za-z0-9]|\^[A-Za-z0-9+\-]+)*|\\[a-zA-Z]+(?:\{[^{}]*\})*)(?:\s*(?:=|\+|-|\*|\/|\\cdot|\\times|\\approx|\\neq|\\leq|\\le|\\geq|\\ge|\\propto|\\rightarrow|\\to|\\rightleftharpoons)\s*(?:[A-Za-z0-9()\[\].]+(?:_\{[^{}]+\}|\^\{[^{}]+\}|_[A-Za-z0-9]|\^[A-Za-z0-9+\-]+)*|\\[a-zA-Z]+(?:\{[^{}]*\})*))+)/
    );
    if (bareEqMatch && hasBareLatexSignals(bareEqMatch[1]) && (i === 0 || /[\s(:;,]/.test(raw[i - 1]))) {
      result += `$${bareEqMatch[1].trim()}$`;
      i += bareEqMatch[1].length;
      continue;
    }

    // Match standalone LaTeX command with up to two brace groups (e.g. \frac{a}{b}, \Delta E, \hbar)
    if (raw[i] === '\\' && /^[a-zA-Z]+/.test(raw.slice(i + 1))) {
      const cmdMatch = raw.slice(i).match(/^\\[a-zA-Z]+/);
      if (cmdMatch && LATEX_COMMAND_SIGNAL_RE.test(cmdMatch[0])) {
        let end = i + cmdMatch[0].length;
        for (let g = 0; g < 2; g++) {
          if (raw[end] === '{') {
            const closeIdx = findMatchingBraceEnd(raw, end);
            if (closeIdx !== -1) {
              end = closeIdx + 1;
              continue;
            }
          }
          break;
        }
        // Attach optional immediate subscript/superscript or variable letter after Greek prefix
        const tailMatch = raw.slice(end).match(/^(?:(?:_\{[^{}]+\}|\^\{[^{}]+\}|_[A-Za-z0-9]|\^[A-Za-z0-9+\-]+)+|\s*[A-Za-z0-9]{1,3}(?![a-z]{3,}))/);
        if (tailMatch && !/^\s+[a-z]{3,}/i.test(tailMatch[0])) {
          end += tailMatch[0].length;
        }
        const token = raw.slice(i, end).trim();
        result += `$${token}$`;
        i = end;
        continue;
      }
    }

    result += raw[i];
    i += 1;
  }

  return result;
}

/**
 * Normalizes LaTeX / KaTeX math delimiters in AI responses and study documents
 * so that remark-math + rehype-katex + direct KaTeX renderers reliably parse
 * both inline ($...$) and block ($$...$$) equations without corrupting code blocks or prices.
 */
export function normalizeMathDelimiters(
  raw: string,
  options?: { autoDetectLatex?: boolean; preferDisplay?: boolean }
): string {
  if (!raw || typeof raw !== 'string') return '';

  const cleanRaw = normalizeDisplayText(raw);
  const segments = cleanRaw.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  return segments
    .map((segment) => {
      if (segment.startsWith('```') || segment.startsWith('`')) {
        return segment;
      }

      let s = segment;

      // 1. Convert \[ ... \] display math to $$ ... $$
      s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `\n$$\n${inner.trim()}\n$$\n`);

      // 2. Convert \( ... \) inline math to $ ... $
      s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner.trim()}$`);

      // 3. Wrap standalone LaTeX math environments in $$...$$ when not already inside math delimiters
      s = s.replace(
        /(^|[^$])\\begin\{(equation\*?|align\*?|aligned|gather\*?|cases|pmatrix|bmatrix|vmatrix|matrix|smallmatrix)\}([\s\S]*?)\\end\{\2\}(?!\$)/gm,
        (_, prefix, env, body) => {
          const normalizedEnv = /^align\*?$/.test(env)
            ? 'aligned'
            : /^gather\*?$/.test(env)
            ? 'gathered'
            : /^equation\*?$/.test(env)
            ? 'aligned'
            : env;
          return `${prefix}\n$$\n\\begin{${normalizedEnv}}${body}\\end{${normalizedEnv}}\n$$\n`;
        }
      );

      // 4. Protect currency dollar amounts ($5, $10.99, $5 to $10) from being mistaken for math delimiters
      s = escapeCurrencyDollars(s);

      // 5. Optionally auto-wrap bare LaTeX / mhchem snippets lacking $...$
      if (options?.autoDetectLatex) {
        s = wrapBareLatexIfNeeded(s, Boolean(options?.preferDisplay));
      }

      return s;
    })
    .join('');
}

function stripOuterMathDelimiters(expr: string): { latex: string; inferredDisplay: boolean } {
  const trimmed = expr.trim();
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4) {
    return { latex: trimmed.slice(2, -2).trim(), inferredDisplay: true };
  }
  if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]') && trimmed.length >= 4) {
    return { latex: trimmed.slice(2, -2).trim(), inferredDisplay: true };
  }
  if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)') && trimmed.length >= 4) {
    return { latex: trimmed.slice(2, -2).trim(), inferredDisplay: false };
  }
  if (trimmed.startsWith('$') && trimmed.endsWith('$') && trimmed.length >= 2) {
    return { latex: trimmed.slice(1, -1).trim(), inferredDisplay: false };
  }
  return { latex: trimmed, inferredDisplay: false };
}

/**
 * Renders a pure LaTeX / mhchem formula directly into KaTeX HTML + MathML.
 */
export function renderLatexToHtml(
  formula: string,
  displayModeOrOptions?: boolean | { displayMode?: boolean }
): string {
  if (!formula || typeof formula !== 'string') return '';
  const clean = normalizeDisplayText(formula);
  const { latex, inferredDisplay } = stripOuterMathDelimiters(clean);
  if (!latex) return '';

  const explicitDisplay =
    typeof displayModeOrOptions === 'boolean'
      ? displayModeOrOptions
      : displayModeOrOptions?.displayMode;

  try {
    return katex.renderToString(latex, {
      displayMode: explicitDisplay ?? inferredDisplay,
      throwOnError: false,
      strict: false,
      trust: false,
      output: 'htmlAndMathml',
      macros: STEM_KATEX_MACROS,
    });
  } catch {
    return escapeHtml(latex);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders mixed prose + LaTeX math ($...$ and $$...$$) to HTML using KaTeX.
 * Ideal for compact headings, quiz options, labels, and SVG <foreignObject> containers.
 */
export function renderMixedTextWithKatexHtml(
  raw: string,
  options?: { autoDetectLatex?: boolean }
): string {
  if (!raw || typeof raw !== 'string') return '';
  const normalized = normalizeMathDelimiters(raw, {
    autoDetectLatex: options?.autoDetectLatex ?? true,
  });

  // Tokenize $$...$$, $...$, `code`, and escaped \$
  const tokenRe = /(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n\\])+\$|`[^`\n]+`|\\\$)/g;
  let html = '';
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      html += escapeHtml(normalized.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token === '\\$') {
      html += '$';
    } else if (token.startsWith('$$') && token.endsWith('$$')) {
      html += renderLatexToHtml(token.slice(2, -2), true);
    } else if (token.startsWith('$') && token.endsWith('$')) {
      html += renderLatexToHtml(token.slice(1, -1), false);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      html += `<code class="font-mono text-[0.9em] px-1 py-0.5 rounded bg-current/10">${escapeHtml(
        token.slice(1, -1)
      )}</code>`;
    } else {
      html += escapeHtml(token);
    }

    lastIndex = tokenRe.lastIndex;
  }

  if (lastIndex < normalized.length) {
    html += escapeHtml(normalized.slice(lastIndex));
  }

  return html;
}

/**
 * Replaces balanced `funcName(inner)` calls from innermost out so nested math functions
 * like `exp(-0.12 * abs(x))` transform cleanly without breaking parenthesis pairing.
 */
function replaceBalancedFunc(
  input: string,
  funcName: string,
  formatter: (inner: string) => string
): string {
  let current = input;
  const re = new RegExp(`\\b${funcName}\\(`, 'g');

  for (let pass = 0; pass < 12; pass++) {
    re.lastIndex = 0;
    let changed = false;
    let match: RegExpExecArray | null;

    // Find a call whose inner argument has no further nested call to funcName,
    // or match from left-to-right scanning balanced parens.
    while ((match = re.exec(current)) !== null) {
      const prevChar = match.index > 0 ? current[match.index - 1] : '';
      if (prevChar === '\\') continue;

      const openParen = match.index + funcName.length;
      let depth = 0;
      let closeParen = -1;
      for (let i = openParen; i < current.length; i++) {
        if (current[i] === '(') depth++;
        else if (current[i] === ')') {
          depth--;
          if (depth === 0) {
            closeParen = i;
            break;
          }
        }
      }
      if (closeParen === -1) continue;

      const inner = current.slice(openParen + 1, closeParen);
      // Wait if inner still has the same funcName so innermost transforms first
      if (new RegExp(`\\b${funcName}\\(`).test(inner)) continue;

      const replacement = formatter(inner);
      current = current.slice(0, match.index) + replacement + current.slice(closeParen + 1);
      changed = true;
      break;
    }

    if (!changed) break;
  }

  return current;
}

/**
 * Converts balanced `numerator / (denominator)` patterns into `\frac{numerator}{denominator}`
 * cleanly preserving nested braces from earlier conversions like `e^{-x}`.
 */
function replaceDivisionsWithFractions(input: string): string {
  let current = input;

  for (let pass = 0; pass < 8; pass++) {
    const parenDivMatch = current.match(/\s*\/\s*\(/);
    if (!parenDivMatch || parenDivMatch.index === undefined) break;

    const slashPos = current.indexOf('/', parenDivMatch.index);
    const openParen = current.indexOf('(', slashPos);

    // Find matching closing paren for openParen
    let depth = 0;
    let closeParen = -1;
    for (let i = openParen; i < current.length; i++) {
      if (current[i] === '(') depth++;
      else if (current[i] === ')') {
        depth--;
        if (depth === 0) {
          closeParen = i;
          break;
        }
      }
    }
    if (closeParen === -1) break;

    // Extract numerator immediately left of slash
    const leftSide = current.slice(0, slashPos).trimEnd();
    let numStart = leftSide.length;
    if (leftSide.endsWith(')')) {
      let d = 0;
      for (let i = leftSide.length - 1; i >= 0; i--) {
        if (leftSide[i] === ')') d++;
        else if (leftSide[i] === '(') {
          d--;
          if (d === 0) {
            numStart = i;
            break;
          }
        }
      }
    } else if (leftSide.endsWith('}')) {
      let d = 0;
      for (let i = leftSide.length - 1; i >= 0; i--) {
        if (leftSide[i] === '}') d++;
        else if (leftSide[i] === '{') {
          d--;
          if (d === 0) {
            // Include preceding command/base token
            const pre = leftSide.slice(0, i).match(/[a-zA-Z0-9\\^_]+$/);
            numStart = pre ? i - pre[0].length : i;
            break;
          }
        }
      }
    } else {
      const tokMatch = leftSide.match(/[A-Za-z0-9_.]+$/);
      if (tokMatch) {
        numStart = leftSide.length - tokMatch[0].length;
      }
    }

    let numerator = leftSide.slice(numStart).trim();
    if (numerator.startsWith('(') && numerator.endsWith(')')) {
      numerator = numerator.slice(1, -1).trim();
    }
    const denominator = current.slice(openParen + 1, closeParen).trim();
    if (!numerator || !denominator) break;

    current =
      current.slice(0, numStart) +
      `\\frac{${numerator}}{${denominator}}` +
      current.slice(closeParen + 1);
  }

  // Handle simple scalar fractions a / b
  current = current.replace(
    /\b([A-Za-z0-9_.]+)\s*\/\s*([A-Za-z0-9_.]+)\b/g,
    '\\frac{$1}{$2}'
  );

  return current;
}

/**
 * Converts a Curve Plotter ASCII math expression (e.g. `sin(x) * exp(-0.12 * abs(x))`)
 * into clean LaTeX for live KaTeX preview (`\sin(x) \cdot e^{-0.12 \cdot |x|}`).
 */
export function expressionToLatex(expr: string): string {
  if (!expr || typeof expr !== 'string') return '';
  let s = expr.trim();
  if (!s) return '';

  // 1. Convert abs(), sqrt(), and exp() using balanced parens first
  s = replaceBalancedFunc(s, 'abs', (inner) => `|${inner.trim()}|`);
  s = replaceBalancedFunc(s, 'sqrt', (inner) => `\\sqrt{${inner.trim()}}`);
  s = replaceBalancedFunc(s, 'exp', (inner) => `e^{${inner.trim()}}`);

  // 2. Convert divisions into \frac{...}{...}
  s = replaceDivisionsWithFractions(s);

  // 3. Convert trig/log/hyperbolic function names and constants
  s = s.replace(
    /\b(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|log|ln)\b(?=\s*\()/g,
    '\\$1'
  );
  s = s.replace(/\bpi\b/gi, '\\pi');

  // 4. Exponents: x^(a+b) -> x^{a+b}, x^-2 -> x^{-2}
  s = s.replace(/\^\(([^()]+)\)/g, '^{$1}');
  s = s.replace(/\^(-?[A-Za-z0-9.]+)(?![{])/g, '^{$1}');

  // 5. Multiplication dots
  s = s.replace(/\s*\*\s*/g, ' \\cdot ');

  return s.replace(/\s+/g, ' ').trim();
}

const SUB_DIGITS: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  n: 'ₙ',
  i: 'ᵢ',
  k: 'ₖ',
};

const SUP_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  n: 'ⁿ',
  i: 'ⁱ',
};

/**
 * Formats LaTeX text into crisp Unicode math symbols for plain-text targets
 * such as HTML5 2D Canvas `ctx.fillText` or fallback SVG `<text>` nodes.
 */
export function formatCanvasMathText(raw: string): string {
  if (!raw) return '';
  let text = normalizeDisplayText(String(raw));
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, '$1').replace(/\$([^$\n]+)\$/g, '$1');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, '$1').replace(/\\\[([\s\S]*?)\\\]/g, '$1');

  // Unwrap \ce{...} and \pu{...}
  text = text.replace(/\\(?:ce|pu)\{([^{}]+)\}/g, '$1');
  // Replace fractions & roots
  text = text.replace(/\\(?:d|t)?frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  text = text.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  const replacements: Array<[RegExp, string]> = [
    [/\\Delta(?![a-zA-Z])/g, 'Δ'],
    [/\\delta(?![a-zA-Z])/g, 'δ'],
    [/\\Psi(?![a-zA-Z])/g, 'Ψ'],
    [/\\psi(?![a-zA-Z])/g, 'ψ'],
    [/\\nu(?![a-zA-Z])/g, 'ν'],
    [/\\mu(?![a-zA-Z])/g, 'μ'],
    [/\\lambda(?![a-zA-Z])/g, 'λ'],
    [/\\Lambda(?![a-zA-Z])/g, 'Λ'],
    [/\\omega(?![a-zA-Z])/g, 'ω'],
    [/\\Omega(?![a-zA-Z])/g, 'Ω'],
    [/\\theta(?![a-zA-Z])/g, 'θ'],
    [/\\Theta(?![a-zA-Z])/g, 'Θ'],
    [/\\alpha(?![a-zA-Z])/g, 'α'],
    [/\\beta(?![a-zA-Z])/g, 'β'],
    [/\\gamma(?![a-zA-Z])/g, 'γ'],
    [/\\Gamma(?![a-zA-Z])/g, 'Γ'],
    [/\\sigma(?![a-zA-Z])/g, 'σ'],
    [/\\Sigma(?![a-zA-Z])/g, 'Σ'],
    [/\\phi(?![a-zA-Z])/g, 'φ'],
    [/\\Phi(?![a-zA-Z])/g, 'Φ'],
    [/\\pi(?![a-zA-Z])/g, 'π'],
    [/\\Pi(?![a-zA-Z])/g, 'Π'],
    [/\\tau(?![a-zA-Z])/g, 'τ'],
    [/\\rho(?![a-zA-Z])/g, 'ρ'],
    [/\\(?:epsilon|varepsilon)(?![a-zA-Z])/g, 'ε'],
    [/\\eta(?![a-zA-Z])/g, 'η'],
    [/\\kappa(?![a-zA-Z])/g, 'κ'],
    [/\\xi(?![a-zA-Z])/g, 'ξ'],
    [/\\chi(?![a-zA-Z])/g, 'χ'],
    [/\\partial(?![a-zA-Z])/g, '∂'],
    [/\\(?:nabla|grad)(?![a-zA-Z])/g, '∇'],
    [/\\int(?![a-zA-Z])/g, '∫'],
    [/\\sum(?![a-zA-Z])/g, '∑'],
    [/\\prod(?![a-zA-Z])/g, '∏'],
    [/\\hbar(?![a-zA-Z])/g, 'ℏ'],
    [/\\(?:rightarrow|to)(?![a-zA-Z])/g, '→'],
    [/\\leftarrow(?![a-zA-Z])/g, '←'],
    [/\\leftrightarrow(?![a-zA-Z])/g, '↔'],
    [/\\Rightarrow(?![a-zA-Z])/g, '⇒'],
    [/\\rightleftharpoons(?![a-zA-Z])/g, '⇌'],
    [/\\approx(?![a-zA-Z])/g, '≈'],
    [/\\(?:leq|le)(?![a-zA-Z])/g, '≤'],
    [/\\(?:geq|ge)(?![a-zA-Z])/g, '≥'],
    [/\\neq(?![a-zA-Z])/g, '≠'],
    [/\\equiv(?![a-zA-Z])/g, '≡'],
    [/\\times(?![a-zA-Z])/g, '×'],
    [/\\cdot(?![a-zA-Z])/g, '·'],
    [/\\propto(?![a-zA-Z])/g, '∝'],
    [/\\infty(?![a-zA-Z])/g, '∞'],
    [/\\pm(?![a-zA-Z])/g, '±'],
    [/\\(?:degree|circ)(?![a-zA-Z])/g, '°'],
    [/\\text\{([^{}]+)\}/g, '$1'],
    [/\\mathrm\{([^{}]+)\}/g, '$1'],
    [/\\mathbf\{([^{}]+)\}/g, '$1'],
  ];
  for (const [re, sym] of replacements) {
    text = text.replace(re, sym);
  }

  // Subscripts _{...} or _d
  text = text.replace(/_\{([0-9+\-nik]+)\}/g, (_, d: string) =>
    d
      .split('')
      .map((c) => SUB_DIGITS[c] || c)
      .join('')
  );
  text = text.replace(/_([0-9])(?![0-9])/g, (_, c: string) => SUB_DIGITS[c] || `_${c}`);

  // Superscripts ^{...} or ^d
  text = text.replace(/\^\{([0-9+\-ni]+)\}/g, (_, d: string) =>
    d
      .split('')
      .map((c) => SUP_DIGITS[c] || c)
      .join('')
  );
  text = text.replace(/\^([0-9+\-])(?![0-9])/g, (_, c: string) => SUP_DIGITS[c] || `^${c}`);

  // Strip spacing between Δ and variable/pH (e.g. \Delta E -> ΔE, \Delta pH -> ΔpH)
  text = text.replace(/Δ\s+(?=[A-Z]|pH\b)/g, 'Δ');
  text = text.replace(/[{}]/g, '').replace(/\\([a-zA-Z]+)/g, '$1').replace(/\s+/g, ' ').trim();
  return text;
}
