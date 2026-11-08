import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { SUPPORTED_STUDY_LANGUAGES } from '../lib/studyLoopStore';

export interface SelectOptionItem {
  value: string;
  label: string;
  sublabel?: string;
  flag?: string;
  badge?: string;
  searchKeywords?: string;
}

interface CustomSearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOptionItem[];
  isDark?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  testId?: string;
  ariaLabel?: string;
  align?: 'left' | 'right';
  compact?: boolean;
}

export const CustomSearchSelect: React.FC<CustomSearchSelectProps> = ({
  value,
  onChange,
  options,
  isDark = true,
  disabled = false,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  testId,
  ariaLabel,
  align = 'right',
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () =>
      options.find((o) => o.value.toLowerCase() === String(value || '').toLowerCase()) ||
      options[0],
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
        (o.badge && o.badge.toLowerCase().includes(q)) ||
        (o.searchKeywords && o.searchKeywords.toLowerCase().includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        data-testid={testId}
        aria-label={ariaLabel || placeholder}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center justify-between gap-2 border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
          compact ? 'h-8 px-3 rounded-full' : 'h-9 px-3.5 rounded-xl'
        } ${
          isDark
            ? 'bg-zinc-900 hover:bg-zinc-800/90 border-white/15 text-white'
            : 'bg-white hover:bg-zinc-50 border-black/15 text-zinc-900 shadow-2xs'
        }`}
      >
        <span className="inline-flex items-center gap-1.5 truncate max-w-[165px] sm:max-w-[210px]">
          {selectedOption?.flag && <span className="shrink-0">{selectedOption.flag}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          {selectedOption?.badge && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 ${
                isDark ? 'bg-white/10 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          } ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } top-full mt-1.5 w-64 sm:w-72 rounded-2xl border p-1.5 z-[90] shadow-2xl ${
            isDark
              ? 'bg-[#141418] border-white/15 text-white shadow-black/80'
              : 'bg-white border-zinc-200 text-zinc-900 shadow-zinc-950/15'
          }`}
        >
          {options.length > 5 && (
            <div
              className={`flex items-center gap-2 px-2.5 py-2 mb-1 border-b ${
                isDark ? 'border-white/10' : 'border-zinc-100'
              }`}
            >
              <Search className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent border-0 text-xs outline-none placeholder:opacity-50"
              />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className={`px-3 py-4 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                No matches found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const active =
                  opt.value.toLowerCase() === String(selectedOption?.value || '').toLowerCase();
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                      active
                        ? isDark
                          ? 'bg-white/10 text-white font-semibold'
                          : 'bg-zinc-100 text-zinc-900 font-semibold'
                        : isDark
                        ? 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                        : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {opt.flag && <span className="text-sm shrink-0">{opt.flag}</span>}
                      <div className="min-w-0">
                        <div className="truncate">{opt.label}</div>
                        {opt.sublabel && (
                          <div
                            className={`text-[10px] truncate ${
                              isDark ? 'text-zinc-500' : 'text-zinc-400'
                            }`}
                          >
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                            isDark ? 'bg-white/[0.07] text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {active && <Check className="w-3.5 h-3.5 text-[#FC4C01]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const StudyLanguageDropdown: React.FC<{
  value: string;
  onChange: (langId: string) => void;
  isDark?: boolean;
  disabled?: boolean;
  testId?: string;
  compact?: boolean;
  align?: 'left' | 'right';
}> = ({ value, onChange, isDark = true, disabled = false, testId, compact = true, align = 'right' }) => {
  const options = useMemo<SelectOptionItem[]>(
    () =>
      SUPPORTED_STUDY_LANGUAGES.map((lang) => ({
        value: lang.id,
        label: lang.nativeLabel,
        sublabel: lang.countries,
        flag: lang.flag,
        badge: lang.code.toUpperCase(),
        searchKeywords: `${lang.label} ${lang.nativeLabel} ${lang.countries} ${lang.code}`,
      })),
    []
  );

  return (
    <CustomSearchSelect
      value={value}
      onChange={onChange}
      options={options}
      isDark={isDark}
      disabled={disabled}
      testId={testId}
      ariaLabel="Select language"
      searchPlaceholder="Search language or country..."
      compact={compact}
      align={align}
    />
  );
};
