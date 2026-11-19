import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Atom,
  BookOpen,
  Compass,
  CreditCard,
  Layers,
  MessageSquarePlus,
  Moon,
  Network,
  Pencil,
  Search,
  Settings,
  Sigma,
  Sparkles,
  Sun,
  Timer,
  X,
} from 'lucide-react';
import type { ChatThread } from './Sidebar';

export type CommandStudyLabMode =
  | 'sketch_tutor'
  | 'visualize'
  | 'diagram'
  | 'mastery_path'
  | 'deep_solve'
  | 'plotter';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  threads: ChatThread[];
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onOpenStudySpace: (labMode?: CommandStudyLabMode, title?: string) => void;
  onOpenHitaishi: () => void;
  onToggleSideChat: () => void;
  onOpenAccount: () => void;
  onOpenPricing: () => void;
  onToggleTheme: () => void;
  onOpenFormulaScratchpad: () => void;
}

interface PaletteItem {
  id: string;
  section: 'Study Labs' | 'Workspaces & Actions' | 'Recent Chats';
  title: string;
  subtitle?: string;
  shortcut?: string;
  keywords: string;
  icon: React.ReactNode;
  run: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  isDark,
  threads,
  onNewChat,
  onSelectThread,
  onOpenStudySpace,
  onOpenHitaishi,
  onToggleSideChat,
  onOpenAccount,
  onOpenPricing,
  onToggleTheme,
  onOpenFormulaScratchpad,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      {
        id: 'lab-whiteboard',
        section: 'Study Labs',
        title: 'Visual Whiteboard',
        subtitle: 'Animated drawn lessons, audio narration & freehand sketch',
        keywords: 'whiteboard sketch draw lesson geometry audio visual',
        icon: <Pencil className="w-4 h-4" />,
        run: () => onOpenStudySpace('sketch_tutor', 'Visual Whiteboard'),
      },
      {
        id: 'lab-physics',
        section: 'Study Labs',
        title: 'Physics Lab',
        subtitle: 'Interactive 2D mechanics, pendulum, spring & orbital sandbox',
        keywords: 'physics simulation projectile pendulum spring wave orbit energy',
        icon: <Atom className="w-4 h-4" />,
        run: () => onOpenStudySpace('visualize', 'Physics Lab'),
      },
      {
        id: 'lab-diagram',
        section: 'Study Labs',
        title: 'Concept Diagram',
        subtitle: 'Stage-by-stage architecture flows with SVG export',
        keywords: 'diagram architecture flowchart svg concept stages',
        icon: <Network className="w-4 h-4" />,
        run: () => onOpenStudySpace('diagram', 'Concept Diagram'),
      },
      {
        id: 'lab-mastery',
        section: 'Study Labs',
        title: 'Mastery Path',
        subtitle: 'Structured 5-stage prerequisite learning roadmap',
        keywords: 'mastery roadmap checkpoints syllabus plan progress',
        icon: <Compass className="w-4 h-4" />,
        run: () => onOpenStudySpace('mastery_path', 'Mastery Path'),
      },
      {
        id: 'lab-deep-solve',
        section: 'Study Labs',
        title: 'Deep Solve',
        subtitle: 'Rigorous step-by-step math and physics derivations',
        keywords: 'solve proof math calculus integral equation derivation',
        icon: <Sigma className="w-4 h-4" />,
        run: () => onOpenStudySpace('deep_solve', 'Deep Solve'),
      },
      {
        id: 'lab-plotter',
        section: 'Study Labs',
        title: 'Curve Plotter',
        subtitle: 'Plot y(x), derivatives y\'(x), roots & definite integrals',
        keywords: 'graph plot curve function derivative integral calculus desmos',
        icon: <Activity className="w-4 h-4" />,
        run: () => onOpenStudySpace('plotter', 'Curve Plotter'),
      },
      {
        id: 'action-new-chat',
        section: 'Workspaces & Actions',
        title: 'New Chat',
        subtitle: 'Start a fresh conversation thread',
        keywords: 'new chat conversation ask message',
        icon: <MessageSquarePlus className="w-4 h-4" />,
        run: onNewChat,
      },
      {
        id: 'action-study-home',
        section: 'Workspaces & Actions',
        title: 'Study Space Home',
        subtitle: 'Upload PDFs, YouTube lessons, notes & adaptive quizzes',
        keywords: 'study space pdf youtube quiz flashcards notes',
        icon: <BookOpen className="w-4 h-4" />,
        run: () => onOpenStudySpace(),
      },
      {
        id: 'action-formulas',
        section: 'Workspaces & Actions',
        title: 'Formulas & Scratchpad',
        subtitle: 'Open STEM equation reference sheet & persistent notes',
        keywords: 'formula equation sheet scratchpad notes latex math physics',
        icon: <Timer className="w-4 h-4" />,
        run: onOpenFormulaScratchpad,
      },
      {
        id: 'action-hitaishi',
        section: 'Workspaces & Actions',
        title: 'Hitaishi Companion Stage',
        subtitle: 'Interactive voice companion synced with your workspaces',
        keywords: 'hitaishi companion voice avatar stage nana ruri',
        icon: <Sparkles className="w-4 h-4" />,
        run: onOpenHitaishi,
      },
      {
        id: 'action-sidechat',
        section: 'Workspaces & Actions',
        title: 'Toggle SideChat',
        subtitle: 'Open parallel side-by-side task chat',
        keywords: 'sidechat parallel split panel multitasking',
        icon: <Layers className="w-4 h-4" />,
        run: onToggleSideChat,
      },
      {
        id: 'action-theme',
        section: 'Workspaces & Actions',
        title: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: 'Toggle interface appearance',
        keywords: 'theme dark light appearance mode',
        icon: isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
        run: onToggleTheme,
      },
      {
        id: 'action-account',
        section: 'Workspaces & Actions',
        title: 'Account & Settings',
        subtitle: 'Preferences, memory, export & profile',
        keywords: 'settings account profile memory preferences',
        icon: <Settings className="w-4 h-4" />,
        run: onOpenAccount,
      },
      {
        id: 'action-pricing',
        section: 'Workspaces & Actions',
        title: 'Plans & Quota',
        subtitle: 'Compare Free, Spark & Unlimited Fire plans',
        keywords: 'pricing plans billing upgrade quota spark fire',
        icon: <CreditCard className="w-4 h-4" />,
        run: onOpenPricing,
      },
    ];

    threads.slice(0, 14).forEach((t) => {
      items.push({
        id: `thread-${t.id}`,
        section: 'Recent Chats',
        title: t.title || 'Untitled conversation',
        subtitle: t.preview ? t.preview.slice(0, 80) : undefined,
        keywords: `${t.title || ''} ${t.preview || ''}`.toLowerCase(),
        icon: <ArrowRight className="w-4 h-4" />,
        run: () => onSelectThread(t.id),
      });
    });

    return items;
  }, [
    isDark,
    threads,
    onNewChat,
    onSelectThread,
    onOpenStudySpace,
    onOpenHitaishi,
    onToggleSideChat,
    onOpenAccount,
    onOpenPricing,
    onToggleTheme,
    onOpenFormulaScratchpad,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    const tokens = q.split(/\s+/).filter(Boolean);
    return allItems.filter((item) => {
      const hay = `${item.title} ${item.subtitle || ''} ${item.keywords} ${item.section}`.toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [allItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0
        );
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        const chosen = filtered[selectedIndex];
        onClose();
        chosen.run();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-palette-idx="${selectedIndex}"]`);
    if (el && 'scrollIntoView' in el) {
      (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const sections: Array<PaletteItem['section']> = [
    'Study Labs',
    'Workspaces & Actions',
    'Recent Chats',
  ];

  const divider = isDark ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-xs flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quick command palette"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl rounded-2xl border overflow-hidden shadow-2xl flex flex-col max-h-[74vh] ${
          isDark
            ? 'bg-[#121216] border-white/[0.12] text-neutral-100'
            : 'bg-white border-black/[0.12] text-neutral-900'
        }`}
      >
        <div className={`px-4 py-3.5 border-b ${divider} flex items-center gap-3`}>
          <Search className={`w-4 h-4 shrink-0 ${muted}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a Study Lab, action, or chat..."
            className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick switcher"
            className={`size-8 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors ${
              isDark ? 'hover:bg-white/[0.08] text-neutral-400' : 'hover:bg-black/[0.05] text-neutral-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={listRef} className="overflow-y-auto py-2 px-2 space-y-3">
          {filtered.length === 0 ? (
            <div className={`py-10 text-center text-sm ${muted}`}>
              No matching tools, actions, or conversations.
            </div>
          ) : (
            sections.map((sectionName) => {
              const sectionItems = filtered.filter((item) => item.section === sectionName);
              if (sectionItems.length === 0) return null;
              return (
                <div key={sectionName} className="space-y-0.5">
                  <div className={`px-3 py-1 text-xs font-medium ${muted}`}>
                    {sectionName}
                  </div>
                  {sectionItems.map((item) => {
                    const flatIdx = filtered.findIndex((f) => f.id === item.id);
                    const active = flatIdx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-palette-idx={flatIdx}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                        onClick={() => {
                          onClose();
                          item.run();
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer ${
                          active
                            ? isDark
                              ? 'bg-white/[0.1] text-white'
                              : 'bg-black/[0.06] text-black'
                            : isDark
                            ? 'text-neutral-200 hover:bg-white/[0.05]'
                            : 'text-neutral-800 hover:bg-black/[0.04]'
                        }`}
                      >
                        <span
                          className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                            active
                              ? isDark
                                ? 'bg-white text-black'
                                : 'bg-black text-white'
                              : isDark
                              ? 'bg-white/[0.06] text-neutral-300'
                              : 'bg-black/[0.05] text-neutral-700'
                          }`}
                        >
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate leading-snug">
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div className={`text-xs truncate mt-0.5 ${muted}`}>
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                        {item.shortcut && (
                          <span className={`text-xs font-mono shrink-0 ${muted}`}>
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className={`px-4 py-2.5 border-t ${divider} flex items-center justify-between text-xs ${muted}`}>
          <span>↑↓ Navigate · Enter Open · Esc Close</span>
          <span className="font-mono">⌘K</span>
        </div>
      </div>
    </div>
  );
};
