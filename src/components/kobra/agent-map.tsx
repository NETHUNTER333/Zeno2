import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Compass,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  GitBranch,
  Globe,
  ExternalLink,
} from 'lucide-react';

export interface AgentMapNode {
  id: string;
  label: string;
  subtitle?: string;
  coordinates?: string;
  category?: string;
  description?: string;
  status?: 'completed' | 'active' | 'pending';
  x: number; // percentage 10-90
  y: number; // percentage 15-85
}

export interface AgentMapProps {
  title?: string;
  subtitle?: string;
  mode?: 'spatial' | 'workflow';
  nodes?: AgentMapNode[];
  isDark?: boolean;
  onSelectNodePrompt?: (prompt: string) => void;
}

export function extractAgentMapFromContext(
  query: string,
  content: string
): { title: string; subtitle: string; mode: 'spatial' | 'workflow'; nodes: AgentMapNode[] } | null {
  const combined = `${query} ${content}`.trim();
  const isSpatialQuery =
    /\b(map|route|itinerary|travel|places to visit|cities|landmarks|neighborhoods|where is|locations in|trip to|guide to|coordinates|latitude|longitude)\b/i.test(
      query
    ) ||
    /\b(itinerary|day 1|day 2|landmarks|destinations|coordinates|neighborhoods)\b/i.test(
      content.slice(0, 800)
    );

  const isWorkflowQuery =
    /\b(agent workflow|pipeline architecture|execution graph|multi-agent|orchestration|roadmap steps)\b/i.test(
      query
    );

  if (!isSpatialQuery && !isWorkflowQuery) return null;

  // Extract headings or bulleted items as map nodes
  const clean = content
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/```[\s\S]*?```/g, '');

  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  const extractedItems: { title: string; desc: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const headingMatch = l.match(/^#{2,4}\s+(.+)$/);
    const boldBulletMatch = l.match(/^[-*•\d.]+\s+\*\*(.+?)\*\*[:\s-]*(.*)$/);
    if (headingMatch) {
      const h = headingMatch[1].replace(/[*_`]/g, '').replace(/\[\d+\](\(#cite-\d+\))?/g, '').trim();
      if (h.length > 2 && h.length < 55 && !/^(summary|conclusion|overview|references|sources)/i.test(h)) {
        const nextLine = (lines[i + 1] || '').replace(/\[\d+\](\(#cite-\d+\))?/g, '').replace(/[*_`#]/g, '').trim();
        extractedItems.push({ title: h, desc: nextLine.slice(0, 140) });
      }
    } else if (boldBulletMatch) {
      const bTitle = boldBulletMatch[1].replace(/[*_`]/g, '').trim();
      const bDesc = boldBulletMatch[2].replace(/\[\d+\](\(#cite-\d+\))?/g, '').replace(/[*_`]/g, '').trim();
      if (bTitle.length > 2 && bTitle.length < 55) {
        extractedItems.push({ title: bTitle, desc: bDesc.slice(0, 140) });
      }
    }
    if (extractedItems.length >= 5) break;
  }

  if (extractedItems.length < 2) return null;

  const positions = [
    { x: 20, y: 30 },
    { x: 48, y: 24 },
    { x: 76, y: 38 },
    { x: 34, y: 68 },
    { x: 66, y: 72 },
  ];

  const nodes: AgentMapNode[] = extractedItems.slice(0, 5).map((item, idx) => ({
    id: `node-${idx + 1}`,
    label: item.title,
    subtitle: isSpatialQuery ? `Stop #${idx + 1}` : `Stage ${idx + 1}`,
    description: item.desc || `Key ${isSpatialQuery ? 'location' : 'node'} in "${query || 'analysis'}".`,
    status: 'completed',
    x: positions[idx % positions.length].x,
    y: positions[idx % positions.length].y,
  }));

  return {
    title: isSpatialQuery ? 'Interactive Spatial & Location Map' : 'Agent Execution Topology Map',
    subtitle: query ? `Mapped ${nodes.length} nodes for "${query}"` : `${nodes.length} active nodes`,
    mode: isSpatialQuery ? 'spatial' : 'workflow',
    nodes,
  };
}

export const AgentMap: React.FC<AgentMapProps> = ({
  title = 'Agent Spatial & Topology Map',
  subtitle = 'Interactive multi-node exploration',
  mode = 'spatial',
  nodes = [],
  isDark = true,
  onSelectNodePrompt,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id || '');
  const activeNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  if (!nodes || nodes.length === 0) return null;

  return (
    <div
      data-slot="kobra-agent-map"
      className={`my-3.5 rounded-3xl border p-4 sm:p-5 transition-all ${
        isDark
          ? 'bg-[#141418] border-white/[0.12] text-white shadow-[0_16px_40px_rgba(0,0,0,0.55)]'
          : 'bg-white border-black/[0.1] text-[#18181b] shadow-[0_12px_32px_rgba(0,0,0,0.07)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`size-10 rounded-2xl border flex items-center justify-center shrink-0 ${
              isDark
                ? 'bg-white/[0.06] border-white/15 text-white'
                : 'bg-[#f4f4f5] border-black/10 text-[#18181b]'
            }`}
          >
            {mode === 'spatial' ? (
              <Compass className="w-4 h-4" />
            ) : (
              <GitBranch className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base truncate">{title}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase border ${
                  isDark
                    ? 'bg-white/[0.06] border-white/15 text-white/80'
                    : 'bg-[#f4f4f5] border-black/10 text-[#18181b]'
                }`}
              >
                {mode === 'spatial' ? 'Geo Map' : 'Agent Graph'}
              </span>
            </div>
            <p className="text-xs opacity-65 truncate mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Interactive Monochrome Radar / Vector Canvas */}
      <div
        className={`relative w-full h-52 sm:h-60 rounded-2xl border overflow-hidden select-none ${
          isDark ? 'bg-[#0b0b0e] border-white/10' : 'bg-[#f8f8fa] border-black/10'
        }`}
      >
        {/* Subtle Monochrome Grid & Connecting Paths */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <pattern id="kobra-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#kobra-map-grid)" />

          {/* Connecting lines between sequential nodes */}
          {nodes.map((node, idx) => {
            if (idx === nodes.length - 1) return null;
            const next = nodes[idx + 1];
            return (
              <line
                key={`edge-${node.id}-${next.id}`}
                x1={`${node.x}%`}
                y1={`${node.y}%`}
                x2={`${next.x}%`}
                y2={`${next.y}%`}
                stroke={isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)'}
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            );
          })}
        </svg>

        {/* Interactive Pins / Nodes */}
        {nodes.map((node, idx) => {
          const isSelected = activeNode?.id === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedNodeId(node.id)}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 group/pin flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? isDark
                    ? 'bg-white text-black border-white scale-105 shadow-[0_8px_24px_rgba(255,255,255,0.2)] z-20'
                    : 'bg-[#18181b] text-white border-[#18181b] scale-105 shadow-[0_8px_24px_rgba(0,0,0,0.2)] z-20'
                  : isDark
                  ? 'bg-[#18181b]/95 text-white border-white/20 hover:border-white/50 z-10'
                  : 'bg-white/95 text-[#18181b] border-black/15 hover:border-black/40 z-10'
              }`}
            >
              <span
                className={`size-4 rounded-full text-[10px] font-mono flex items-center justify-center shrink-0 ${
                  isSelected
                    ? isDark
                      ? 'bg-black text-white'
                      : 'bg-white text-black'
                    : isDark
                    ? 'bg-white/15 text-white'
                    : 'bg-black/10 text-black'
                }`}
              >
                {idx + 1}
              </span>
              <span className="truncate max-w-[120px] sm:max-w-[150px]">{node.label}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Node Inspector Bar */}
      {activeNode && (
        <div
          className={`mt-3.5 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isDark ? 'bg-white/[0.03] border-white/10' : 'bg-[#fafafa] border-black/[0.08]'
          }`}
        >
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 shrink-0 opacity-75" />
              <span className="font-semibold text-xs sm:text-sm truncate">
                {activeNode.label}
              </span>
              {activeNode.subtitle && (
                <span className="text-[11px] font-mono opacity-60">· {activeNode.subtitle}</span>
              )}
            </div>
            {activeNode.description && (
              <p className="text-xs opacity-75 leading-relaxed line-clamp-2">
                {activeNode.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {mode === 'spatial' && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  activeNode.label
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 !no-underline transition-colors ${
                  isDark
                    ? 'bg-white/[0.06] border-white/15 text-white hover:bg-white/12'
                    : 'bg-white border-black/10 text-[#18181b] hover:bg-neutral-100'
                }`}
              >
                <Navigation className="w-3 h-3" />
                <span>Open Map</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}
            {onSelectNodePrompt && (
              <button
                type="button"
                onClick={() =>
                  onSelectNodePrompt(
                    `Tell me more about ${activeNode.label} including key details and recommendations.`
                  )
                }
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-[#18181b] text-white hover:bg-neutral-800'
                }`}
              >
                <span>Explore Node</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentMap;
