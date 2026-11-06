import React, { useState } from 'react';
import { WebSearch } from './ui/web-search';
import { Copy, Check, Bot, User, Globe, Sparkles, RefreshCw, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ChatMessage as ChatMessageType } from '../types';
import { SourceCard } from './SourceCard';
import { ToolExecutionBadge } from './ToolExecutionBadge';
import { PeleDiagram } from './PeleDiagram';
import { PrismCodeBlock } from './PrismCodeBlock';
import { normalizeMathDelimiters } from './MathMarkdown';
import { LoadingBreadcrumb } from './ui/animated-loading-svg-text-shimmer';
import { ThinkingOrb } from 'thinking-orbs';

interface ChatMessageProps {
  message: ChatMessageType;
  onExtractUrl?: (url: string) => void;
  onRetry?: () => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onExtractUrl, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copyText = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`py-6 px-4 md:px-6 transition-colors ${isUser ? 'bg-transparent' : 'bg-slate-900/40 border-y border-slate-800/40'}`}>
      <div className="max-w-4xl mx-auto flex gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Message Content Container */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-slate-200">
                {isUser ? 'You' : 'Treg AI'}
              </span>
              {!isUser && message.modelUsed && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                  {message.modelUsed}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {!isUser && !message.isStreaming && (
                <>
                  <button
                    onClick={copyText}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Copy response"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Retry response"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tools executed badge */}
          {message.toolsUsed && message.toolsUsed.length > 0 && (
            <ToolExecutionBadge tools={message.toolsUsed} />
          )}

          {/* Sources list */}
          {message.sources && message.sources.length > 0 && (
            <div className="mb-4">
              <WebSearch
                sources={message.sources.map((s) => ({
                  title: s.title,
                  url: s.url,
                  snippet: s.snippet,
                  domain: s.domain,
                  date: s.date,
                  position: s.position,
                  socialMeta: s.socialMeta,
                }))}
                status={message.isStreaming ? 'searching' : 'done'}
                query={(message as any).searchQuery || message.searchQueries?.[0] || 'Web Search'}
                defaultOpen={true}
                isDark={true}
                onSelectCitation={(src) => {
                  if (src.url && onExtractUrl) {
                    onExtractUrl(src.url);
                  }
                }}
              />
            </div>
          )}

          {/* Body / Markdown */}
          {message.isStreaming ? (
            (!message.sources || message.sources.length === 0) && (
              <div className="py-2 flex items-center justify-start">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/90 border border-slate-700/80 text-slate-300 text-xs font-medium shadow-sm">
                  <ThinkingOrb state="working" size={20} />
                  <span>Thinking....</span>
                </div>
              </div>
            )
          ) : (
            <div className="prose-custom max-w-none text-slate-200 text-sm leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
                rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                components={{
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300 underline font-medium"
                    />
                  ),
                  pre: ({ node, children, ...props }) => {
                    const child = React.Children.toArray(children)[0] as React.ReactElement<any>;
                    const childClassName = child?.props?.className || '';
                    const childContent = String(child?.props?.children || '').trim();
                    if (
                      childClassName.includes('language-mermaid') ||
                      childClassName.includes('mermaid') ||
                      childContent.startsWith('graph ') ||
                      childContent.startsWith('flowchart ') ||
                      childContent.startsWith('sequenceDiagram')
                    ) {
                      return <PeleDiagram code={childContent} isDark={true} />;
                    }
                    const matchLang = /language-([\w+-]+)/.exec(childClassName || '');
                    const lang = matchLang ? matchLang[1] : '';
                    return <PrismCodeBlock language={lang} code={childContent} isDark={true} />;
                  },
                  code: ({ node, className, children, ...props }) => {
                    const isInline = !className && typeof children === 'string' && !children.includes('\n');
                    return isInline ? (
                      <code className="bg-slate-800 text-sky-300 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {normalizeMathDelimiters(message.content)}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
