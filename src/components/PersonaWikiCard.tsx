import React, { useState } from 'react';
import {
  User,
  Globe,
  Ruler,
  Calendar,
  Briefcase,
  Award,
  ExternalLink,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  MapPin,
  Shield,
  TrendingUp,
  GraduationCap,
} from 'lucide-react';
import { PersonaWiki } from '../types';

interface PersonaWikiCardProps {
  persona: PersonaWiki;
  isDark?: boolean;
  onAskZeno?: (prompt: string) => void;
}

export const PersonaWikiCard: React.FC<PersonaWikiCardProps> = ({
  persona,
  isDark = true,
  onAskZeno,
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

  // Build top highlight specs (always prioritizing Age, Height, Nationality, Occupation/Role, Team/Org, Status/Scale)
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
        label: 'Role / Position',
        value: persona.positionOrRole || persona.occupation || '—',
        icon: <Briefcase className="w-3.5 h-3.5" />,
      });
    }
    if (persona.organizationOrTeam) {
      items.push({
        label: 'Team / Affiliation',
        value: persona.organizationOrTeam,
        icon: <Shield className="w-3.5 h-3.5" />,
      });
    }
    if (persona.birthPlace) {
      items.push({
        label: 'Birthplace',
        value: persona.birthPlace,
        icon: <MapPin className="w-3.5 h-3.5" />,
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
        label: 'Education / Alma Mater',
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
    if (persona.moniker) addSpec('Nickname / Moniker', persona.moniker);
    addSpec('Age', persona.age);
    addSpec('Born', persona.birthDate);
    addSpec('Birthplace', persona.birthPlace);
    addSpec('Nationality', persona.nationality);
    addSpec('Height', persona.height);
    addSpec('Weight', persona.weight);
    addSpec('Occupation / Craft', persona.occupation);
    addSpec('Position / Role', persona.positionOrRole);
    addSpec('Team / Organization', persona.organizationOrTeam);
    addSpec('Scale / Career Tier', persona.scaleTier);
    addSpec('Status / Ranking', persona.statusOrRank);
    addSpec('Net Worth / Market Value', persona.netWorthOrValue);
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
      className={`my-4 rounded-2xl border overflow-hidden transition-all duration-300 ease-out hover:scale-[1.01] hover:-translate-y-0.5 ${
        isDark
          ? 'bg-[#0b0b0c] border-[#1f1f22] hover:border-[#323238] text-[#ededed] shadow-lg shadow-black/40 hover:shadow-2xl hover:shadow-black/70'
          : 'bg-[#ffffff] border-[#e4e4e7] hover:border-[#d1d1d6] text-[#111111] shadow-sm hover:shadow-xl hover:shadow-black/10'
      }`}
    >
      {/* Top Persona Wiki Identity Header Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b text-xs ${
          isDark ? 'bg-[#111113] border-[#1f1f22]' : 'bg-[#f8f8fa] border-[#e4e4e7]'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-wider uppercase border ${
              isDark
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <User className="w-3 h-3" />
            PERSONA WIKI
          </span>

          {persona.category && (
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                isDark
                  ? 'bg-[#18181b] border-[#27272a] text-[#d4d4d8]'
                  : 'bg-white border-[#e4e4e7] text-[#3f3f46]'
              }`}
            >
              {persona.category}
            </span>
          )}

          {persona.scaleTier && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wide border ${
                persona.scaleTier.toLowerCase().includes('elite') ||
                persona.scaleTier.toLowerCase().includes('icon')
                  ? isDark
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                  : persona.scaleTier.toLowerCase().includes('upcoming') ||
                    persona.scaleTier.toLowerCase().includes('rising')
                  ? isDark
                    ? 'bg-sky-500/10 text-sky-300 border-sky-500/25'
                    : 'bg-sky-50 text-sky-800 border-sky-200'
                  : isDark
                  ? 'bg-white/5 text-[#a1a1aa] border-white/10'
                  : 'bg-black/5 text-[#52525b] border-black/10'
              }`}
            >
              <Award className="w-2.5 h-2.5" />
              {persona.scaleTier}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Tab Switcher */}
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
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors cursor-pointer ${
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
              title="Open Source / Wiki Page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-5">
        {activeTab === 'overview' && (
          <div className="flex flex-col md:flex-row gap-4 sm:gap-5">
            {/* Left Column: Portrait + Fetched Images Strip */}
            {galleryImages.length > 0 && (
              <div className="w-full md:w-44 lg:w-48 flex-shrink-0 flex flex-col gap-2">
                <div
                  onClick={() => setLightboxOpen(true)}
                  className={`group/portrait relative aspect-[4/5] w-full rounded-xl overflow-hidden border cursor-pointer ${
                    isDark ? 'bg-[#141417] border-[#27272a]' : 'bg-[#f4f4f5] border-[#e4e4e7]'
                  }`}
                >
                  {activePhoto && (
                    <img
                      src={activePhoto.imageUrl || activePhoto.thumbnailUrl}
                      alt={persona.name}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (activePhoto.thumbnailUrl && target.src !== activePhoto.thumbnailUrl) {
                          target.src = activePhoto.thumbnailUrl;
                        }
                      }}
                      className="w-full h-full object-cover object-top group-hover/portrait:scale-105 transition-transform duration-300"
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activePhoto) {
                        handleDownloadImage(
                          activePhoto.imageUrl || activePhoto.thumbnailUrl,
                          persona.name
                        );
                      }
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/75 hover:bg-black text-white border border-white/15 opacity-90 sm:opacity-0 sm:group-hover/portrait:opacity-100 transition-opacity cursor-pointer"
                    title="Download portrait"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent px-2.5 py-2">
                    <div className="text-[10px] font-mono text-white/85 flex items-center justify-between">
                      <span>
                        Photo {selectedImageIdx + 1}/{galleryImages.length}
                      </span>
                      <span className="underline">Expand</span>
                    </div>
                  </div>
                </div>

                {/* Mini Thumbnail Strip to switch portrait */}
                {galleryImages.length > 1 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {galleryImages.slice(0, 4).map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImageIdx(idx)}
                        className={`relative aspect-square rounded-lg overflow-hidden border transition-all cursor-pointer ${
                          selectedImageIdx === idx
                            ? isDark
                              ? 'border-emerald-400 ring-1 ring-emerald-400/40'
                              : 'border-emerald-600 ring-1 ring-emerald-600/40'
                            : isDark
                            ? 'border-[#27272a] opacity-70 hover:opacity-100'
                            : 'border-[#e4e4e7] opacity-75 hover:opacity-100'
                        }`}
                        title={img.title}
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
              </div>
            )}

            {/* Right Column: Name, Bio, and Key Specs Grid */}
            <div className="flex-1 min-w-0 flex flex-col justify-between gap-3.5">
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3
                    className={`text-lg sm:text-xl font-bold tracking-tight ${
                      isDark ? 'text-white' : 'text-black'
                    }`}
                  >
                    {persona.name}
                  </h3>
                  {persona.moniker && (
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded border ${
                        isDark
                          ? 'bg-[#141417] border-[#27272a] text-[#a1a1aa]'
                          : 'bg-[#f4f4f5] border-[#e4e4e7] text-[#52525b]'
                      }`}
                    >
                      “{persona.moniker}”
                    </span>
                  )}
                </div>

                {(persona.occupation || persona.organizationOrTeam || persona.statusOrRank) && (
                  <div
                    className={`text-xs mt-0.5 flex flex-wrap items-center gap-1.5 ${
                      isDark ? 'text-[#a1a1aa]' : 'text-[#52525b]'
                    }`}
                  >
                    {persona.occupation && <span className="font-medium">{persona.occupation}</span>}
                    {persona.organizationOrTeam && (
                      <>
                        <span>·</span>
                        <span>{persona.organizationOrTeam}</span>
                      </>
                    )}
                    {persona.statusOrRank && (
                      <>
                        <span>·</span>
                        <span className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>
                          {persona.statusOrRank}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {persona.summary && (
                  <p
                    className={`mt-2.5 text-xs sm:text-[13px] leading-relaxed ${
                      isDark ? 'text-[#d4d4d8]' : 'text-[#27272a]'
                    }`}
                  >
                    {persona.summary}
                  </p>
                )}
              </div>

              {/* Key Vitals & Specs Bento Grid (Age, Height, Nationality, Role, Team, etc.) */}
              {primarySpecs.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {primarySpecs.slice(0, 6).map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                        isDark
                          ? 'bg-[#111114] border-[#1f1f24]'
                          : 'bg-[#f9f9fb] border-[#e4e4e7]'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono ${
                          isDark ? 'text-[#71717a]' : 'text-[#71717a]'
                        }`}
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </div>
                      <div
                        className={`mt-1 text-xs sm:text-[13px] font-semibold font-mono leading-snug break-words ${
                          isDark ? 'text-[#f4f4f5]' : 'text-[#111111]'
                        }`}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Extra Specs Pills if more than 6 exist */}
              {allDetailedSpecs.length > primarySpecs.length && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {allDetailedSpecs
                    .filter(
                      (s) =>
                        !primarySpecs.some(
                          (p) =>
                            p.label.toLowerCase().includes(s.label.toLowerCase()) ||
                            s.label.toLowerCase().includes(p.label.toLowerCase())
                        )
                    )
                    .slice(0, 5)
                    .map((spec, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border ${
                          isDark
                            ? 'bg-[#121215] border-[#232329] text-[#d4d4d8]'
                            : 'bg-[#f4f4f6] border-[#e4e4e7] text-[#3f3f46]'
                        }`}
                      >
                        <span className={isDark ? 'text-[#71717a]' : 'text-[#71717a]'}>
                          {spec.label}:
                        </span>
                        <span className="font-mono font-medium">{spec.value}</span>
                      </span>
                    ))}
                  {allDetailedSpecs.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('specs')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                        isDark
                          ? 'border-[#27272a] text-emerald-400 hover:bg-[#18181b]'
                          : 'border-[#e4e4e7] text-emerald-700 hover:bg-[#f4f4f5]'
                      }`}
                    >
                      View all {allDetailedSpecs.length} specs →
                    </button>
                  )}
                </div>
              )}

              {/* Career Highlights & Milestones */}
              {persona.careerHighlights && persona.careerHighlights.length > 0 && (
                <div
                  className={`pt-2.5 border-t ${
                    isDark ? 'border-[#1f1f24]' : 'border-[#e4e4e7]'
                  }`}
                >
                  <div
                    className={`text-[10px] font-mono uppercase tracking-wider mb-1.5 ${
                      isDark ? 'text-[#71717a]' : 'text-[#71717a]'
                    }`}
                  >
                    Key Career Highlights & Records
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {persona.careerHighlights.slice(0, 5).map((hl, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border ${
                          isDark
                            ? 'bg-white/[0.03] border-[#27272a] text-[#e4e4e7]'
                            : 'bg-black/[0.02] border-[#e4e4e7] text-[#27272a]'
                        }`}
                      >
                        <Award className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        <span>{hl}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full Specs Table Tab */}
        {activeTab === 'specs' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allDetailedSpecs.map((spec, idx) => (
                <div
                  key={idx}
                  className={`flex items-baseline justify-between gap-3 px-3 py-2 rounded-xl border ${
                    isDark
                      ? 'bg-[#111114] border-[#1f1f24]'
                      : 'bg-[#f9f9fb] border-[#e4e4e7]'
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
                    className={`text-xs font-mono font-semibold text-right ${
                      isDark ? 'text-white' : 'text-black'
                    }`}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/75 hover:bg-black text-white border border-white/15 opacity-90 sm:opacity-0 sm:group-hover/gimg:opacity-100 transition-opacity cursor-pointer"
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

        {/* Quick Persona Wiki Follow-up Action Bar */}
        {onAskZeno && (
          <div
            className={`mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2 ${
              isDark ? 'border-[#1f1f24]' : 'border-[#e4e4e7]'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onAskZeno(
                    `Give me a complete career timeline, records, and statistical breakdown for ${persona.name}.`
                  )
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#141417] border-[#27272a] text-[#d4d4d8] hover:text-white hover:border-[#3f3f46]'
                    : 'bg-[#f4f4f5] border-[#e4e4e7] text-[#27272a] hover:text-black hover:border-[#d4d4d8]'
                }`}
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Career Stats & Records</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onAskZeno(`What is the latest 2026 news, form, and updates on ${persona.name}?`)
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#141417] border-[#27272a] text-[#d4d4d8] hover:text-white hover:border-[#3f3f46]'
                    : 'bg-[#f4f4f5] border-[#e4e4e7] text-[#27272a] hover:text-black hover:border-[#d4d4d8]'
                }`}
              >
                <span>Latest 2026 Updates</span>
              </button>
            </div>
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
                  {persona.name} · Persona Wiki Gallery ({selectedImageIdx + 1} of{' '}
                  {galleryImages.length})
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
