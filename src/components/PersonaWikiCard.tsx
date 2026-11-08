import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PersonaWiki } from '../types';

interface PersonaWikiCardProps {
  persona: PersonaWiki;
  isDark?: boolean;
  onAskKinich?: (prompt: string) => void;
}

interface VitalItem {
  label: string;
  value: string;
}

export const PersonaWikiCard: React.FC<PersonaWikiCardProps> = ({
  persona,
  isDark = true,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Portrait image URL
  const portraitUrl =
    persona.primaryImage ||
    (persona.images && persona.images.length > 0
      ? persona.images[0].imageUrl || persona.images[0].thumbnailUrl
      : undefined);

  // Subtitle: Role / Organization
  const subtitle = [persona.occupation, persona.organizationOrTeam || persona.positionOrRole]
    .filter(Boolean)
    .join(' · ');

  // Clean key vitals: Natural casing, no icons, no uppercase mono
  const vitals = React.useMemo(() => {
    const list: VitalItem[] = [];

    // Born / Age
    if (persona.birthDate || persona.age) {
      const parts = [
        persona.age ? `${persona.age}${persona.age.includes('year') ? '' : ' years'}` : null,
        persona.birthDate,
      ].filter(Boolean);
      list.push({
        label: 'Born',
        value: parts.join(' · '),
      });
    }

    // Height & Weight
    if (persona.height || persona.weight) {
      list.push({
        label: persona.height && persona.weight ? 'Height & Weight' : persona.height ? 'Height' : 'Weight',
        value: [persona.height, persona.weight].filter(Boolean).join(' · '),
      });
    }

    // Nationality
    if (persona.nationality) {
      list.push({
        label: 'Nationality',
        value: persona.nationality,
      });
    }

    // Role / Craft
    if (persona.positionOrRole || persona.occupation) {
      list.push({
        label: 'Role',
        value: persona.positionOrRole || persona.occupation || '—',
      });
    }

    // Birthplace
    if (persona.birthPlace) {
      list.push({
        label: 'Birthplace',
        value: persona.birthPlace,
      });
    }

    // Team / Affiliation
    if (persona.organizationOrTeam) {
      list.push({
        label: 'Team',
        value: persona.organizationOrTeam,
      });
    }

    // Net worth / value (if available and room in 6-grid)
    if (persona.netWorthOrValue && list.length < 6) {
      list.push({
        label: 'Net Worth',
        value: persona.netWorthOrValue,
      });
    }

    // Education (if available and room)
    if (persona.education && list.length < 6) {
      list.push({
        label: 'Education',
        value: persona.education,
      });
    }

    return list.slice(0, 6);
  }, [persona]);

  return (
    <>
      <div
        className={`my-3 rounded-xl border transition-all ${
          isDark
            ? 'bg-neutral-900/40 border-white/[0.08] text-zinc-100'
            : 'bg-zinc-50/80 border-black/[0.06] text-zinc-900'
        } p-3.5 sm:p-4`}
      >
        {/* Profile Identity */}
        <div className="flex items-start gap-3.5 sm:gap-4">
          {portraitUrl && (
            <div
              onClick={() => setLightboxOpen(true)}
              className={`relative w-20 h-24 sm:w-24 sm:h-28 rounded-lg overflow-hidden border shrink-0 cursor-pointer transition-opacity hover:opacity-90 ${
                isDark ? 'bg-neutral-950 border-white/10' : 'bg-zinc-100 border-black/10'
              }`}
              title="Click to view portrait"
            >
              <img
                src={portraitUrl}
                alt={persona.name}
                className="w-full h-full object-cover object-top"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (persona.primaryImage && target.src !== persona.primaryImage) {
                    target.src = persona.primaryImage;
                  }
                }}
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3
                className={`text-base sm:text-lg font-semibold tracking-tight ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}
              >
                {persona.name}
              </h3>
              {persona.moniker && (
                <span
                  className={`text-xs italic ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  "{persona.moniker}"
                </span>
              )}
            </div>

            {subtitle && (
              <p
                className={`text-xs mt-0.5 font-medium truncate ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                {subtitle}
              </p>
            )}

            {persona.summary && (
              <p
                className={`mt-2 text-xs sm:text-[13px] leading-relaxed line-clamp-3 sm:line-clamp-4 ${
                  isDark ? 'text-zinc-300' : 'text-zinc-700'
                }`}
              >
                {persona.summary}
              </p>
            )}
          </div>
        </div>

        {/* Clean Vitals Grid (No nested boxes, no icons, natural typography) */}
        {vitals.length > 0 && (
          <div
            className={`mt-3.5 pt-3 border-t grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-xs ${
              isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'
            }`}
          >
            {vitals.map((v, i) => (
              <div key={i} className="min-w-0">
                <span
                  className={`text-[11px] font-medium block ${
                    isDark ? 'text-zinc-500' : 'text-zinc-400'
                  }`}
                >
                  {v.label}
                </span>
                <span
                  className={`font-medium block truncate mt-0.5 ${
                    isDark ? 'text-zinc-200' : 'text-zinc-800'
                  }`}
                  title={v.value}
                >
                  {v.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Minimal Lightbox */}
      {lightboxOpen && portraitUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-lg w-full flex flex-col items-center cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white truncate">{persona.name}</span>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={portraitUrl}
              alt={persona.name}
              className="max-h-[80vh] max-w-full rounded-xl object-contain border border-white/10"
            />
          </div>
        </div>
      )}
    </>
  );
};
