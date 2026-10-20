import React, { useState, useRef, useEffect } from 'react';
import { Play, Code, Maximize2, Minimize2, RotateCcw, Copy, Check } from 'lucide-react';

interface GenerativeUiViewerProps {
  code: string;
  title?: string;
}

export const GenerativeUiViewer: React.FC<GenerativeUiViewerProps> = ({
  code,
  title = 'Interactive Simulation & Explorer',
}) => {
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeHeight, setIframeHeight] = useState<number>(480);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const instanceId = useRef(`genui-${Math.random().toString(36).slice(2, 9)}`).current;

  const cleanCode = code.trim();
  const isDark =
    document.documentElement.classList.contains('dark') ||
    !document.documentElement.classList.contains('light');

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'GENUI_HEIGHT' && e.data.id === instanceId) {
        const nextHeight = Math.min(Math.max(Number(e.data.height) || 440, 320), 920);
        setIframeHeight(nextHeight);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [instanceId]);

  const getSanitizedDoc = () => {
    const heightReporterScript = `
      <script>
        (function() {
          function reportHeight() {
            var h = Math.max(
              document.body ? document.body.scrollHeight : 0,
              document.documentElement ? document.documentElement.scrollHeight : 0
            );
            if (h > 50) {
              window.parent.postMessage({ type: 'GENUI_HEIGHT', id: '${instanceId}', height: h + 4 }, '*');
            }
          }
          window.addEventListener('load', function() {
            reportHeight();
            setTimeout(reportHeight, 150);
            setTimeout(reportHeight, 500);
          });
          if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(reportHeight).observe(document.documentElement);
          }
          document.addEventListener('click', function() { setTimeout(reportHeight, 60); });
        })();
      </script>
    `;

    const isFullDoc =
      cleanCode.toLowerCase().includes('<!doctype') || cleanCode.toLowerCase().includes('<html');

    if (isFullDoc) {
      if (cleanCode.includes('</body>')) {
        return cleanCode.replace('</body>', `${heightReporterScript}</body>`);
      }
      return cleanCode + heightReporterScript;
    }

    return `<!DOCTYPE html>
<html lang="en" class="${isDark ? 'dark' : 'light'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            grok: {
              bg: '${isDark ? '#0a0a0a' : '#ffffff'}',
              surface: '${isDark ? '#111111' : '#f7f7f7'}',
              ring: '${isDark ? '#1f1f1f' : '#e5e5e5'}'
            }
          }
        }
      }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background-color: ${isDark ? '#0a0a0a' : '#ffffff'};
      color: ${isDark ? '#ededed' : '#111111'};
      margin: 0;
      padding: 0;
      overflow-x: hidden;
      font-variant-numeric: tabular-nums;
    }
    input[type="range"] {
      accent-color: ${isDark ? '#ffffff' : '#111111'};
    }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${isDark ? '#262626' : '#d4d4d4'}; border-radius: 9999px; }
  </style>
</head>
<body>
  ${cleanCode}
  ${heightReporterScript}
</body>
</html>`;
  };

  const copyCode = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div
      className={`my-5 rounded-xl border overflow-hidden transition-all duration-200 ${
        isDark ? 'bg-[#0a0a0a] border-[#1f1f1f]' : 'bg-[#ffffff] border-[#e5e5e5]'
      } ${
        isFullscreen
          ? `fixed inset-3 z-50 flex flex-col shadow-2xl ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#ffffff]'}`
          : 'w-full'
      }`}
    >
      {/* Clean Structural Toolbar Header (No Floating Glass Pill Slop Covering Content) */}
      <div
        className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b text-xs ${
          isDark ? 'bg-[#0f0f0f] border-[#1f1f1f] text-[#ededed]' : 'bg-[#fafafa] border-[#e5e5e5] text-[#111111]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold truncate">{title}</span>
          <span aria-hidden="true" className={isDark ? 'text-[#444444]' : 'text-[#cccccc]'}>
            ·
          </span>
          <span className={`text-[11px] truncate ${isDark ? 'text-[#737373]' : 'text-[#666666]'}`}>
            Interactive Module
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div
            className={`flex items-center rounded-lg p-0.5 border ${
              isDark ? 'bg-[#0a0a0a] border-[#222222]' : 'bg-[#f0f0f0] border-[#e0e0e0]'
            }`}
          >
            <button
              type="button"
              onClick={() => setView('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                view === 'preview'
                  ? isDark
                    ? 'bg-white text-black'
                    : 'bg-black text-white'
                  : isDark
                  ? 'text-[#8a8a8a] hover:text-white'
                  : 'text-[#666666] hover:text-black'
              }`}
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Interactive</span>
            </button>
            <button
              type="button"
              onClick={() => setView('code')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                view === 'code'
                  ? isDark
                    ? 'bg-white text-black'
                    : 'bg-black text-white'
                  : isDark
                  ? 'text-[#8a8a8a] hover:text-white'
                  : 'text-[#666666] hover:text-black'
              }`}
            >
              <Code className="w-3 h-3" />
              <span>Code</span>
            </button>
          </div>

          {view === 'preview' && (
            <button
              type="button"
              onClick={handleReset}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#222222] text-[#8a8a8a] hover:text-white hover:bg-[#161616]'
                  : 'border-[#e0e0e0] text-[#666666] hover:text-black hover:bg-[#f0f0f0]'
              }`}
              title="Reset simulation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {view === 'code' && (
            <button
              type="button"
              onClick={copyCode}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#222222] text-[#8a8a8a] hover:text-white hover:bg-[#161616]'
                  : 'border-[#e0e0e0] text-[#666666] hover:text-black hover:bg-[#f0f0f0]'
              }`}
              title="Copy source code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'border-[#222222] text-[#8a8a8a] hover:text-white hover:bg-[#161616]'
                : 'border-[#e0e0e0] text-[#666666] hover:text-black hover:bg-[#f0f0f0]'
            }`}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Component Viewport */}
      <div
        className={`relative ${isFullscreen ? 'flex-1' : ''} ${
          isDark ? 'bg-[#0a0a0a]' : 'bg-[#ffffff]'
        } overflow-hidden`}
        style={!isFullscreen && view === 'preview' ? { height: `${iframeHeight}px` } : undefined}
      >
        {view === 'preview' ? (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            srcDoc={getSanitizedDoc()}
            sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
            className="w-full h-full border-0 block"
            title={title}
          />
        ) : (
          <div className="max-h-[520px] overflow-y-auto p-4">
            <pre
              className={`font-mono text-xs whitespace-pre-wrap leading-relaxed select-text ${
                isDark ? 'text-[#ededed]' : 'text-[#111111]'
              }`}
            >
              {cleanCode}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

