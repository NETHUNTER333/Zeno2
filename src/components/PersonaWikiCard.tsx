import React, { useState } from 'react';
import {
  Globe,
  Ruler,
  Calendar,
  Briefcase,
  ExternalLink,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Shield,
  TrendingUp,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { PersonaWiki } from '../types';

interface PersonaWikiCardProps {
  persona: PersonaWiki;
  isDark?: boolean;
  onAskKinich?: (prompt: string) => void;
}

export const PersonaWikiCard: React.FC<PersonaWikiCardProps> = ({
  persona,
  isDark = true,
  onAskKinich,
}) => {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'gallery'>('overview');

  const galleryImages = React.useMemo(() => {
    const list = [...(persona.images || [])];
    if (
      persona.primaryImage &&
      !list.some((img) => img.imageUrl === persona.primaryImage || img.thumbnailUrl === persona.primaryImage)
    ) {
      list.unshift({
        title: `${persona.name} — Portrait`,
        imageUrl: persona.primaryImage,
        thumbnailUrl: persona.primaryImage,
        source: 'Wikipedia / Official',
        domain: 'wikipedia.org',
        link: persona.wikiUrl || persona.primaryImage,
      });
    }
    return list;
  }, [persona]);

  const activePhoto = galleryImages[selectedImageIdx] || galleryImages[0] || null;

  // Build top highlight specs (Age, Height, Nationality, Role, Birthplace, Team, etc.)
  const primarySpecs = React.useMemo(() => {
    const items: Array<{ label: string; value: string; icon: React.ReactNode }> = [];
    if (persona.age || persona.birthDate) {
      items.push({
        label: 'Age / Born',
        value:
          persona.age && persona.birthDate && !persona.age.includes(persona.birthDate)
            ? `${persona.age} (${persona.birthDate})`
            : persona.age || persona.birthDate || '—',
        icon: <Calendar className="w-3.5 h-3.5" />,
      });
    }
    if (persona.height) {
      items.push({
        label: persona.weight ? 'Height · Weight' : 'Height',
        value: persona.weight ? `${persona.height} · ${persona.weight}` : persona.height,
        icon: <Ruler className="w-3.5 h-3.5" />,
      });
    } else if (persona.weight) {
      items.push({
        label: 'Weight',
        value: persona.weight,
        icon: <Ruler className="w-3.5 h-3.5" />,
      });
    }
    if (persona.nationality) {
      items.push({
        label: 'Nationality',
        value: persona.nationality,
        icon: <Globe className="w-3.5 h-3.5" />,
      });
    }
    if (persona.positionOrRole || persona.occupation) {
      items.push({
        label: 'Role / Craft',
        value: persona.positionOrRole || persona.occupation || '—',
        icon: <Briefcase className="w-3.5 h-3.5" />,
      });
    }
    if (persona.birthPlace) {
      items.push({
        label: 'Birthplace',
        value: persona.birthPlace,
        icon: <MapPin className="w-3.5 h-3.5" />,
      });
    }
    if (persona.organizationOrTeam) {
      items.push({
        label: 'Team / Affiliation',
        value: persona.organizationOrTeam,
        icon: <Shield className="w-3.5 h-3.5" />,
      });
    }
    if (persona.netWorthOrValue) {
      items.push({
        label: 'Net Worth / Value',
        value: persona.netWorthOrValue,
        icon: <TrendingUp className="w-3.5 h-3.5" />,
      });
    }
    if (persona.education) {
      items.push({
        label: 'Education',
        value: persona.education,
        icon: <GraduationCap className="w-3.5 h-3.5" />,
      });
    }
    return items;
  }, [persona]);

  // Combine all extra specs without duplicating primary labels
  const allDetailedSpecs = React.useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ label: string; value: string }> = [];

    const addSpec = (label?: string, value?: string) => {
      if (!label || !value) return;
      const cleanLabel = label.trim();
      const cleanVal = value.trim();
      if (!cleanLabel || !cleanVal || cleanVal === 'N/A' || cleanVal === 'Unknown') return;
      const key = cleanLabel.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ label: cleanLabel, value: cleanVal });
    };

    if (persona.fullName && persona.fullName.toLowerCase() !== persona.name.toLowerCase()) {
      addSpec('Full Name', persona.fullName);
    }
    if (persona.moniker) addSpec('Moniker', persona.moniker);
    addSpec('Age', persona.age);
    addSpec('Born', persona.birthDate);
    addSpec('Birthplace', persona.birthPlace);
    addSpec('Nationality', persona.nationality);
    addSpec('Height', persona.height);
    addSpec('Weight', persona.weight);
    addSpec('Occupation', persona.occupation);
    addSpec('Position / Role', persona.positionOrRole);
    addSpec('Team / Org', persona.organizationOrTeam);
    addSpec('Scale / Status', persona.scaleTier || persona.statusOrRank);
    addSpec('Net Worth', persona.netWorthOrValue);
    addSpec('Education', persona.education);

    if (Array.isArray(persona.specs)) {
      for (const s of persona.specs) {
        addSpec(s.label, s.value);
      }
    }

    return list;
  }, [persona]);

  const handleDownloadImage = (url: string, title: string) => {
    if (!url) return;
    const proxyUrl = `/api/media/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(
      (title || persona.name).replace(/[^a-zA-Z0-9_-]/g, '_')
    )}`;
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = `${(title || persona.name).replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={`my-3 rounded-2xl border overflow-hidden transition-all ${
        isDark
          ? 'bg-[#0f0f12] border-[#222227] text-[#ededed] shadow-lg shadow-black/40'
          : 'bg-[#ffffff] border-[#e4e4e7] text-[#111111] shadow-xs'
      }`}
    >
      {/* Sleek Understated Header Bar */}
      <div
        className={`flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2 border-b text-xs ${
          isDark ? 'bg-[#141418] border-[#222227]' : 'bg-[#fafafa] border-[#e4e4e7]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`font-mono text-[10px] tracking-wider uppercase font-semibold ${
              isDark ? 'text-neutral-400' : 'text-neutral-500'
            }`}
          >
            Persona Profile
          </span>
          {persona.category && (
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium border truncate max-w-[140px] sm:max-w-[200px] ${
                isDark
                  ? 'bg-[#1a1a20] border-[#2c2c34] text-[#a1a1aa]'
                  : 'bg-white border-[#e4e4e7] text-[#52525b]'
              }`}
            >
              {persona.category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Minimal Tab Switcher */}
          <div
            className={`inline-flex items-center rounded-lg p-0.5 border ${
              isDark ? 'bg-[#09090b] border-[#27272a]' : 'bg-[#f1f1f4] border-[#e4e4e7]'
            }`}
          >
            {(['overview', 'specs', 'gallery'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeTab === tab
                    ? isDark
                      ? 'bg-[#27272a] text-white'
                      : 'bg-white text-black shadow-2xs'
                    : isDark
                    ? 'text-[#71717a] hover:text-[#d4d4d8]'
                    : 'text-[#71717a] hover:text-black'
                }`}
              >
                {tab === 'specs'
                  ? `Specs (${allDetailedSpecs.length})`
                  : tab === 'gallery'
                  ? `Photos (${galleryImages.length})`
                  : 'Profile'}
              </button>
            ))}
          </div>

          {persona.wikiUrl && (
            <a
              href={persona.wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-1.5 rounded-lg border transition-colors ${
                isDark
                  ? 'border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
                  : 'border-[#e4e4e7] text-[#52525b] hover:text-black hover:bg-[#f4f4f5]'
              }`}
              title="Open Source / Wiki"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-3.5 sm:p-4">
        {activeTab === 'overview' && (
          <div className="space-y-3.5">
            {/* Top Identity Block: Compact side-by-side Portrait + Info */}
            <div className="flex items-start gap-3.5 sm:gap-4">
              {/* Compact, non-stretched Portrait */}
              {activePhoto && (
                <div
                  onClick={() => setLightboxOpen(true)}
                  className={`group/portrait relative w-24 h-28 sm:w-28 sm:h-32 rounded-xl overflow-hidden border shrink-0 cursor-pointer shadow-sm ${
                    isDark ? 'bg-[#18181c] border-[#2c2c34]' : 'bg-[#f4f4f5] border-[#e4e4e7]'
                  }`}
                  title="Click to expand photo"
                >
                  <img
                    src={activePhoto.imageUrl || activePhoto.thumbnailUrl}
                    alt={persona.name}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (activePhoto.thumbnailUrl && target.src !== activePhoto.thumbnailUrl) {
                        target.src = activePhoto.thumbnailUrl;
                      }
                    }}
                    className="w-full h-full object-cover object-top group-hover/portrait:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent py-1 px-1.5 flex items-center justify-between text-[9px] text-white/90 font-mono">
                    <span>{selectedImageIdx + 1}/{galleryImages.length}</span>
                    <span className="opacity-80">Zoom</span>
                  </div>
                </div>
              )}

              {/* Title & Quick Vitals beside photo */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                  <h3
                    className={`text-base sm:text-lg font-bold tracking-tight truncate ${
                      isDark ? 'text-white' : 'text-black'
                    }`}
                  >
                    {persona.name}
                  </h3>
                  {persona.moniker && (
                    <span
                      className={`text-xs italic truncate ${
                        isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]'
                      }`}
                    >
                      “{persona.moniker}”
                    </span>
                  )}
                </div>

                {(persona.occupation || persona.organizationOrTeam) && (
                  <div
                    className={`text-xs mt-0.5 truncate ${
                      isDark ? 'text-[#a1a1aa]' : 'text-[#52525b]'
                    }`}
                  >
                    {[persona.occupation, persona.organizationOrTeam].filter(Boolean).join(' · ')}
                  </div>
                )}

                {persona.summary && (
                  <p
                    className={`mt-1.5 text-xs sm:text-[13px] leading-relaxed line-clamp-3 sm:line-clamp-4 ${
                      isDark ? 'text-[#d4d4d8]' : 'text-[#3f3f46]'
                    }`}
                  >
                    {persona.summary}
                  </p>
                )}
              </div>
            </div>

            {/* Photo selector thumbnails (if multiple photos available) */}
            {galleryImages.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {galleryImages.slice(0, 6).map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`relative w-11 h-11 rounded-lg overflow-hidden border shrink-0 cursor-pointer transition-all ${
                      selectedImageIdx === idx
                        ? isDark
                          ? 'border-emerald-400 ring-1 ring-emerald-400/40'
                          : 'border-emerald-600 ring-1 ring-emerald-600/40'
                        : isDark
                        ? 'border-[#27272a] opacity-60 hover:opacity-100'
                        : 'border-[#e4e4e7] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img.thumbnailUrl || img.imageUrl}
                      alt={img.title}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Compact Key Vitals Grid (Age, Height, Nationality, Role, etc.) */}
            {primarySpecs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {primarySpecs.slice(0, 6).map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-xl border flex flex-col justify-between ${
                      isDark
                        ? 'bg-[#131317] border-[#222228]'
                        : 'bg-[#fafafa] border-[#e8e8ed]'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider ${
                        isDark ? 'text-[#71717a]' : 'text-[#71717a]'
                      }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </div>
                    <div
                      className={`mt-0.5 text-xs sm:text-[13px] font-semibold font-mono truncate ${
                        isDark ? 'text-[#f4f4f5]' : 'text-[#111111]'
                      }`}
                      title={item.value}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick link to see more specs if present */}
            {allDetailedSpecs.length > 6 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('specs')}
                  className={`text-xs font-medium cursor-pointer transition-colors ${
                    isDark
                      ? 'text-neutral-400 hover:text-white'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  View full specifications ({allDetailedSpecs.length} items) →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Full Specifications Tab */}
        {activeTab === 'specs' && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allDetailedSpecs.map((spec, idx) => (
                <div
                  key={idx}
                  className={`flex items-baseline justify-between gap-3 px-3 py-2 rounded-xl border ${
                    isDark
                      ? 'bg-[#131317] border-[#222228]'
                      : 'bg-[#fafafa] border-[#e8e8ed]'
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${
                      isDark ? 'text-[#a1a1aa]' : 'text-[#52525b]'
                    }`}
                  >
                    {spec.label}
                  </span>
                  <span
                    className={`text-xs font-mono font-semibold text-right truncate max-w-[60%] ${
                      isDark ? 'text-white' : 'text-black'
                    }`}
                    title={spec.value}
                  >
                    {spec.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos Gallery Tab */}
        {activeTab === 'gallery' && (
          <div>
            {galleryImages.length === 0 ? (
              <div className="text-xs text-center py-6 opacity-60">No photos available.</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {galleryImages.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedImageIdx(idx);
                      setLightboxOpen(true);
                    }}
                    className={`group/gimg relative aspect-square rounded-xl overflow-hidden border cursor-pointer ${
                      isDark
                        ? 'bg-[#141417] border-[#27272a] hover:border-[#52525b]'
                        : 'bg-[#f4f4f5] border-[#e4e4e7] hover:border-[#a1a1aa]'
                    }`}
                  >
                    <img
                      src={img.imageUrl || img.thumbnailUrl}
                      alt={img.title}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (img.thumbnailUrl && target.src !== img.thumbnailUrl) {
                          target.src = img.thumbnailUrl;
                        }
                      }}
                      className="w-full h-full object-cover group-hover/gimg:scale-105 transition-transform duration-200"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadImage(img.imageUrl || img.thumbnailUrl, img.title);
                      }}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/75 hover:bg-black text-white border border-white/15 opacity-0 group-hover/gimg:opacity-100 transition-opacity cursor-pointer"
                      title="Download image"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subtle career follow-up suggestions */}
        {onAskKinich && activeTab === 'overview' && (
          <div
            className={`mt-3 pt-2.5 border-t flex flex-wrap items-center gap-1.5 ${
              isDark ? 'border-[#222227]' : 'border-[#e4e4e7]'
            }`}
          >
            <button
              type="button"
              onClick={() =>
                onAskKinich(
                  `Give me a complete career timeline, records, and filmography/highlights for ${persona.name}.`
                )
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#141418] border-[#27272a] text-[#a1a1aa] hover:text-white'
                  : 'bg-[#f8f8fa] border-[#e4e4e7] text-[#52525b] hover:text-black'
              }`}
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Career Highlights</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onAskKinich(`What are the latest verified 2026 updates and projects for ${persona.name}?`)
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#141418] border-[#27272a] text-[#a1a1aa] hover:text-white'
                  : 'bg-[#f8f8fa] border-[#e4e4e7] text-[#52525b] hover:text-black'
              }`}
            >
              <span>Recent Updates</span>
            </button>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Persona Photos */}
      {lightboxOpen && activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between mb-3 px-1">
              <div className="min-w-0 pr-4">
                <div className="text-sm font-medium text-white truncate">
                  {activePhoto.title || persona.name}
                </div>
                <div className="text-xs text-[#a1a1aa]">
                  {persona.name} ({selectedImageIdx + 1} of {galleryImages.length})
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadImage(
                      activePhoto.imageUrl || activePhoto.thumbnailUrl,
                      activePhoto.title || persona.name
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black hover:bg-[#e5e5e5] text-xs font-medium cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative w-full flex items-center justify-center">
              {galleryImages.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedImageIdx(
                      (selectedImageIdx - 1 + galleryImages.length) % galleryImages.length
                    )
                  }
                  className="absolute left-2 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/15 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              <img
                src={activePhoto.imageUrl || activePhoto.thumbnailUrl}
                alt={activePhoto.title || persona.name}
                className="max-h-[75vh] max-w-full rounded-2xl object-contain border border-white/10"
              />

              {galleryImages.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedImageIdx((selectedImageIdx + 1) % galleryImages.length)
                  }
                  className="absolute right-2 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/15 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
