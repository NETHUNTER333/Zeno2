import React, { useState, useEffect } from 'react';
import { X, Search, Terminal, Zap, ShieldCheck, Play, Loader2, CheckCircle2, ChevronRight, Layers, ExternalLink } from 'lucide-react';
import { CatalogEndpoint, TregStatus } from '../types';
import { getAuthHeaders } from '../lib/firebase';

interface TregCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: TregStatus | null;
}

export const TregCatalogModal: React.FC<TregCatalogModalProps> = ({ isOpen, onClose, status }) => {
  const [searchTerm, setSearchTerm] = useState('google');
  const [results, setResults] = useState<CatalogEndpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<CatalogEndpoint | null>(null);
  const [testPayload, setTestPayload] = useState('{"q": "artificial intelligence 2026"}');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [executing, setExecuting] = useState(false);

  // Search catalog
  const handleSearch = async (term: string) => {
    setLoading(true);
    setTestResponse(null);
    try {
      const res = await fetch(`/api/treg/catalog?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        if (data.results.length > 0) {
          setSelectedEndpoint(data.results[0]);
          // Default test payload based on endpoint
          if (data.results[0].id.includes('serp') || data.results[0].id.includes('search')) {
            setTestPayload('{"q": "latest AI news 2026"}');
          } else if (data.results[0].id.includes('extract') || data.results[0].id.includes('scrape')) {
            setTestPayload('{"url": "https://example.com"}');
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleSearch(searchTerm);
    }
  }, [isOpen]);

  // Execute endpoint test
  const handleExecuteTool = async () => {
    if (!selectedEndpoint) return;
    setExecuting(true);
    setTestResponse(null);
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(testPayload);
      } catch {
        parsedPayload = { q: testPayload };
      }

      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/treg/call', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          endpointId: selectedEndpoint.id,
          data: parsedPayload,
          method: selectedEndpoint.method || 'POST',
        }),
      });

      const data = await res.json();
      setTestResponse(data);
    } catch (err: any) {
      setTestResponse({ error: err.message });
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-base">Treg Tool Catalog & Explorer</h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Live (team: syntrofoi)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                4,000+ catalogued endpoints across 113 providers • Search, test, and audit live agent tools
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Filter Badges & Search */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
              placeholder="Search 4,000+ tools (e.g. google, news, tiktok)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 text-xs text-slate-400">
            <span className="text-[11px] text-slate-500 mr-1 flex-shrink-0">Presets:</span>
            {[
              { label: 'Google SERP', query: 'google serp' },
              { label: 'Google News', query: 'google news' },
              { label: 'Web Scrape', query: 'web extract' },
              { label: 'DuckDuckGo', query: 'duckduckgo' },
              { label: 'Bing SERP', query: 'bing serp' },
              { label: 'TikTok', query: 'tiktok' },
              { label: 'Apollo Contacts', query: 'apollo' },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setSearchTerm(p.query);
                  handleSearch(p.query);
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                  searchTerm === p.query
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Columns: Results on Left, Details & Tester on Right */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Results List */}
          <div className="md:col-span-5 border-r border-slate-800 overflow-y-auto p-3 space-y-2 bg-slate-950/40">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                <p className="text-xs">Searching Treg catalog...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                No tools found for "{searchTerm}". Try another search term.
              </div>
            ) : (
              results.map((tool) => (
                <div
                  key={tool.id}
                  onClick={() => {
                    setSelectedEndpoint(tool);
                    if (tool.id.includes('serp') || tool.id.includes('search')) {
                      setTestPayload('{"q": "artificial intelligence 2026"}');
                    } else if (tool.id.includes('extract') || tool.id.includes('scrape')) {
                      setTestPayload('{"url": "https://example.com"}');
                    } else {
                      setTestPayload('{}');
                    }
                    setTestResponse(null);
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedEndpoint?.id === tool.id
                      ? 'bg-sky-950/40 border-sky-500/50 shadow-md'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-200 truncate">{tool.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {tool.method || 'POST'}
                    </span>
                  </div>
                  <div className="text-[11px] text-sky-400 font-mono truncate mb-1">
                    {tool.id}
                  </div>
                  {tool.summary && (
                    <p className="text-slate-400 line-clamp-2 text-[11px] leading-relaxed">
                      {tool.summary}
                    </p>
                  )}
                  <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Provider: {tool.provider_display || tool.provider}</span>
                    <span className="text-emerald-400">
                      {tool.cost?.usd !== undefined
                        ? tool.cost.usd === 0
                          ? 'Free'
                          : `$${tool.cost.usd}/call`
                        : 'Catalog metered'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Details & Runner */}
          <div className="md:col-span-7 overflow-y-auto p-4 flex flex-col justify-between bg-slate-900/30">
            {selectedEndpoint ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-sky-400">{selectedEndpoint.provider_display || selectedEndpoint.provider}</span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Authenticated: syntrofoi</span>
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-slate-100 mt-1">{selectedEndpoint.name}</h4>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-xs bg-slate-950 px-2 py-0.5 rounded text-sky-300 border border-slate-800 font-mono">
                      https://treg.to/call/{selectedEndpoint.id}
                    </code>
                  </div>
                  {selectedEndpoint.summary && (
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {selectedEndpoint.summary}
                    </p>
                  )}
                </div>

                {/* Call template preview */}
                {selectedEndpoint.call_template && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 mb-1 font-semibold flex items-center gap-1">
                      <Terminal className="w-3 h-3 text-sky-400" />
                      CLI / Raw Command
                    </div>
                    <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                      {selectedEndpoint.call_template}
                    </pre>
                  </div>
                )}

                {/* Interactive Test Runner */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">
                      Request Payload (JSON)
                    </label>
                    <button
                      onClick={handleExecuteTool}
                      disabled={executing}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {executing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Executing...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Run via Treg</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={testPayload}
                    onChange={(e) => setTestPayload(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                    placeholder='{"q": "search term"}'
                  />
                </div>

                {/* Response Preview */}
                {testResponse && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Live Execution Result
                      </span>
                      {testResponse.durationMs && (
                        <span className="text-slate-400 font-mono text-[11px]">
                          {testResponse.durationMs}ms
                        </span>
                      )}
                    </div>
                    <pre className="max-h-56 overflow-y-auto text-[11px] font-mono text-slate-300 bg-slate-900/90 p-3 rounded-lg overflow-x-auto">
                      {JSON.stringify(testResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                Select an endpoint from the left to inspect and test
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
