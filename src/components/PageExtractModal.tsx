import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileText, Globe, Loader2, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAuthHeaders } from '../lib/firebase';

interface PageExtractModalProps {
  url: string | null;
  onClose: () => void;
}

export const PageExtractModal: React.FC<PageExtractModalProps> = ({ url, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (!url) return;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      setContent('');
      setDuration(null);

      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch('/api/treg/extract', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ url }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to extract content');
        }

        setContent(data.markdown || 'No content could be extracted from this page.');
        setDuration(data.durationMs);
      } catch (err: any) {
        setError(err.message || 'Error communicating with Treg extract API');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [url]);

  if (!url) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-sm truncate">
                  Treg Web Extract
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/40 font-mono">
                  treg.web.extract
                </span>
                {duration && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {duration}ms
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate font-mono mt-0.5">
                {url}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setViewMode('rendered')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === 'rendered'
                    ? 'bg-sky-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rendered
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === 'raw'
                    ? 'bg-sky-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Raw MD
              </button>
            </div>

            <button
              onClick={copyToClipboard}
              disabled={!content || loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
              title="Copy Markdown"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Visit original URL"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 font-sans text-sm text-slate-300">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
              <p className="text-sm font-medium">Extracting clean markdown via Treg proxy...</p>
              <span className="text-xs text-slate-500 font-mono">X-Treg-Token authenticated (org: syntrofoi)</span>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-sm">
              <p className="font-semibold mb-1">Extraction Error</p>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            viewMode === 'rendered' ? (
              <div className="prose-custom max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="font-mono text-xs text-slate-300 bg-slate-950 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {content}
              </pre>
            )
          )}
        </div>
      </div>
    </div>
  );
};
