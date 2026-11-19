import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, FileText, Search, Sigma, Trash2, X } from 'lucide-react';
import { MathFormula } from './MathMarkdown';

interface StudyFormulaScratchpadProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onDeriveFormula?: (prompt: string) => void;
}

interface FormulaEntry {
  id: string;
  category: 'Mechanics' | 'Waves & Optics' | 'Electromagnetism' | 'Thermodynamics' | 'Calculus' | 'Linear Algebra';
  name: string;
  latex: string;
  note: string;
}

const FORMULA_LIBRARY: FormulaEntry[] = [
  {
    id: 'kin-1',
    category: 'Mechanics',
    name: 'Kinematics Displacement',
    latex: 'x(t) = x_0 + v_0 t + \\frac{1}{2} a t^2',
    note: 'Constant acceleration position over time',
  },
  {
    id: 'kin-2',
    category: 'Mechanics',
    name: 'Projectile Range',
    latex: 'R = \\frac{v_0^2 \\sin(2\\theta)}{g}',
    note: 'Level-ground horizontal range without air drag',
  },
  {
    id: 'kin-3',
    category: 'Mechanics',
    name: 'Kinetic & Potential Energy',
    latex: 'E = \\frac{1}{2} m v^2 + m g h',
    note: 'Total mechanical energy in uniform gravity',
  },
  {
    id: 'kin-4',
    category: 'Mechanics',
    name: 'Simple Pendulum Period',
    latex: 'T = 2\\pi \\sqrt{\\frac{L}{g}}',
    note: 'Small-angle harmonic period',
  },
  {
    id: 'kin-5',
    category: 'Mechanics',
    name: 'Universal Gravitation',
    latex: 'F = G \\frac{m_1 m_2}{r^2}',
    note: 'Inverse-square gravitational force between masses',
  },
  {
    id: 'wav-1',
    category: 'Waves & Optics',
    name: 'Wave Speed Relation',
    latex: 'v = f \\lambda',
    note: 'Wave velocity from frequency and wavelength',
  },
  {
    id: 'wav-2',
    category: 'Waves & Optics',
    name: "Snell's Law of Refraction",
    latex: 'n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2',
    note: 'Refraction across optical media boundaries',
  },
  {
    id: 'em-1',
    category: 'Electromagnetism',
    name: "Coulomb's Law",
    latex: 'F = k_e \\frac{|q_1 q_2|}{r^2}',
    note: 'Electrostatic force between point charges',
  },
  {
    id: 'em-2',
    category: 'Electromagnetism',
    name: 'Lorentz Force',
    latex: '\\vec{F} = q(\\vec{E} + \\vec{v} \\times \\vec{B})',
    note: 'Force on charge moving through E and B fields',
  },
  {
    id: 'th-1',
    category: 'Thermodynamics',
    name: 'Ideal Gas Law',
    latex: 'P V = n R T',
    note: 'Pressure, volume, moles, and absolute temperature',
  },
  {
    id: 'th-2',
    category: 'Thermodynamics',
    name: 'Carnot Efficiency',
    latex: '\\eta = 1 - \\frac{T_C}{T_H}',
    note: 'Maximum theoretical heat engine efficiency',
  },
  {
    id: 'calc-1',
    category: 'Calculus',
    name: 'Derivative Definition',
    latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
    note: 'Instantaneous rate of change',
  },
  {
    id: 'calc-2',
    category: 'Calculus',
    name: 'Integration by Parts',
    latex: '\\int u\\,dv = u v - \\int v\\,du',
    note: 'Product rule inverse for integration',
  },
  {
    id: 'calc-3',
    category: 'Calculus',
    name: "Euler's Identity",
    latex: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta',
    note: 'Complex exponential and trigonometric form',
  },
  {
    id: 'la-1',
    category: 'Linear Algebra',
    name: 'Eigenvalue Equation',
    latex: 'A \\vec{v} = \\lambda \\vec{v}',
    note: 'Invariant direction scaled by eigenvalue',
  },
  {
    id: 'la-2',
    category: 'Linear Algebra',
    name: 'Scaled Dot-Product Attention',
    latex: '\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V',
    note: 'Core Transformer sequence aggregation formula',
  },
];

const SCRATCHPAD_STORAGE_KEY = 'kinich_study_scratchpad_v1';

export const StudyFormulaScratchpad: React.FC<StudyFormulaScratchpadProps> = ({
  isOpen,
  onClose,
  isDark,
  onDeriveFormula,
}) => {
  const [activeTab, setActiveTab] = useState<'formulas' | 'scratchpad'>('formulas');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>(() => {
    try {
      return localStorage.getItem(SCRATCHPAD_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [notesCopied, setNotesCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SCRATCHPAD_STORAGE_KEY, notes);
    } catch {}
  }, [notes]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const categories = ['All', 'Mechanics', 'Waves & Optics', 'Electromagnetism', 'Thermodynamics', 'Calculus', 'Linear Algebra'];

  const filteredFormulas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FORMULA_LIBRARY.filter((f) => {
      if (categoryFilter !== 'All' && f.category !== categoryFilter) return false;
      if (!q) return true;
      return `${f.name} ${f.category} ${f.note} ${f.latex}`.toLowerCase().includes(q);
    });
  }, [search, categoryFilter]);

  if (!isOpen) return null;

  const divider = isDark ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const primaryBtn = isDark
    ? 'bg-white text-black hover:bg-neutral-200'
    : 'bg-black text-white hover:bg-neutral-800';
  const ghostBtn = isDark
    ? 'border-white/[0.12] text-neutral-200 hover:bg-white/[0.06]'
    : 'border-black/[0.12] text-neutral-800 hover:bg-black/[0.05]';

  const handleCopyLatex = (entry: FormulaEntry) => {
    navigator.clipboard?.writeText(entry.latex).catch(() => {});
    setCopiedId(entry.id);
    window.setTimeout(() => setCopiedId((curr) => (curr === entry.id ? null : curr)), 1600);
  };

  const handleInsertToScratchpad = (entry: FormulaEntry) => {
    const snippet = `\n### ${entry.name}\n$$${entry.latex}$$\n${entry.note}\n`;
    setNotes((prev) => (prev.trim() ? `${prev.trimEnd()}\n${snippet}` : snippet.trimStart()));
    setActiveTab('scratchpad');
  };

  const handleDownloadNotes = () => {
    const content = notes.trim() || '# Study Notes\n';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-scratchpad-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const wordCount = notes.trim() ? notes.trim().split(/\s+/).length : 0;

  return (
    <div
      className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-xs flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Formulas and Study Scratchpad"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md h-full border-l flex flex-col shadow-2xl ${
          isDark
            ? 'bg-[#101014] border-white/[0.1] text-neutral-100'
            : 'bg-white border-black/[0.1] text-neutral-900'
        }`}
      >
        <div className={`px-5 h-14 border-b ${divider} flex items-center justify-between gap-3 shrink-0`}>
          <h2 className="text-base font-semibold tracking-tight">Formulas &amp; Notes</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Formulas and Notes"
            className={`size-8 rounded-xl border inline-flex items-center justify-center cursor-pointer ${ghostBtn}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean 2-Tab Segmented Switch */}
        <div className={`px-5 py-3 border-b ${divider} shrink-0`}>
          <div
            className={`grid grid-cols-2 gap-1 p-1 rounded-xl border ${
              isDark ? 'bg-[#16161b] border-white/[0.08]' : 'bg-neutral-100 border-black/[0.08]'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab('formulas')}
              className={`h-8 rounded-lg text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'formulas'
                  ? isDark
                    ? 'bg-white text-black font-semibold'
                    : 'bg-black text-white font-semibold'
                  : muted
              }`}
            >
              <Sigma className="w-3.5 h-3.5" />
              <span>Formula Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scratchpad')}
              className={`h-8 rounded-lg text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'scratchpad'
                  ? isDark
                    ? 'bg-white text-black font-semibold'
                    : 'bg-black text-white font-semibold'
                  : muted
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Scratchpad</span>
            </button>
          </div>
        </div>

        {activeTab === 'formulas' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className={`px-5 py-3 border-b ${divider} space-y-2.5 shrink-0`}>
              <div
                className={`rounded-xl border px-3 h-9 flex items-center gap-2 ${
                  isDark ? 'bg-[#16161b] border-white/[0.12]' : 'bg-neutral-50 border-black/[0.12]'
                }`}
              >
                <Search className={`w-4 h-4 shrink-0 ${muted}`} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search equations..."
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-neutral-400"
                />
              </div>
              <select
                aria-label="Filter formula category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`w-full h-9 px-3 rounded-xl border text-[13px] font-medium outline-none cursor-pointer ${
                  isDark
                    ? 'bg-[#16161b] border-white/[0.12] text-neutral-200'
                    : 'bg-white border-black/[0.12] text-neutral-800'
                }`}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className={isDark ? 'bg-[#16161b] text-white' : 'bg-white text-black'}>
                    {cat === 'All' ? 'All subjects' : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className={`flex-1 overflow-y-auto divide-y ${isDark ? 'divide-white/[0.08]' : 'divide-black/[0.08]'}`}>
              {filteredFormulas.length === 0 ? (
                <div className={`py-12 text-center text-sm ${muted}`}>No matching equations found.</div>
              ) : (
                filteredFormulas.map((entry) => (
                  <div key={entry.id} className="px-5 py-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{entry.name}</div>
                        <div className={`text-xs ${muted}`}>{entry.category} · {entry.note}</div>
                      </div>
                    </div>
                    <div
                      className={`rounded-xl border px-3 py-2.5 overflow-x-auto ${
                        isDark ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-neutral-50 border-black/[0.07]'
                      }`}
                    >
                      <MathFormula formula={entry.latex} displayMode />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLatex(entry)}
                        className={`h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${ghostBtn}`}
                      >
                        {copiedId === entry.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === entry.id ? 'Copied' : 'Copy LaTeX'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertToScratchpad(entry)}
                        className={`h-8 px-2.5 rounded-lg border text-xs font-medium cursor-pointer ${ghostBtn}`}
                      >
                        Save to Notes
                      </button>
                      {onDeriveFormula && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onDeriveFormula(`Derive and explain "${entry.name}" ($${entry.latex}$) with a worked example.`);
                          }}
                          className={`h-8 px-2.5 rounded-lg text-xs font-semibold cursor-pointer ${primaryBtn}`}
                        >
                          Derive
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 p-5 gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-mono tabular-nums ${muted}`}>
                {wordCount} {wordCount === 1 ? 'word' : 'words'} · Auto-saved locally
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(notes).catch(() => {});
                    setNotesCopied(true);
                    window.setTimeout(() => setNotesCopied(false), 1600);
                  }}
                  disabled={!notes.trim()}
                  className={`h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 ${ghostBtn}`}
                >
                  {notesCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{notesCopied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadNotes}
                  disabled={!notes.trim()}
                  className={`h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 ${ghostBtn}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.md</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotes('')}
                  disabled={!notes.trim()}
                  aria-label="Clear notes"
                  className={`size-8 rounded-lg border inline-flex items-center justify-center cursor-pointer disabled:opacity-40 ${ghostBtn}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write derivations, key equations, or session notes here. Everything saves automatically on this device..."
              className={`flex-1 w-full rounded-2xl border p-4 text-sm leading-relaxed font-mono outline-none resize-none ${
                isDark
                  ? 'bg-[#16161b] border-white/[0.1] text-neutral-100 placeholder:text-neutral-500 focus:border-white/25'
                  : 'bg-neutral-50 border-black/[0.1] text-neutral-900 placeholder:text-neutral-400 focus:border-black/25'
              }`}
            />
          </div>
        )}
      </aside>
    </div>
  );
};
