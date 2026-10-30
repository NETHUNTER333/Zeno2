import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { UserAccountStore } from '../lib/userAccountStore';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  geminiModel: string;
  supportsVision: boolean;
  contextLength?: string;
  requiredTier?: 'free' | 'spark' | 'fire';
}

export const GROK_MODELS: ModelOption[] = [
  {
    id: 'deepseek-v4.1-flash-free',
    name: 'DeepSeek V4.1',
    description: 'Instant reasoning',
    geminiModel: 'thk/deepseek-v4.1-flash:free',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'itera-qwen3.8-27b-free',
    name: 'Qwen 3.8 27B',
    description: 'Fast reply & vision',
    geminiModel: 'itera/qwen/qwen3.8-27b',
    supportsVision: true,
    contextLength: '256K',
  },
  {
    id: 'deepseek-v4-flash-0731-free',
    name: 'DeepSeek V4 Flash',
    description: 'Analytical reasoning',
    geminiModel: 'thk/deepseek-v4-flash:free',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'glm-5.3-flash-free',
    name: 'GLM 5.3 Flash',
    description: 'Low-latency vision',
    geminiModel: 'glm-5.3-flash-free',
    supportsVision: true,
    contextLength: '128K',
  },
  {
    id: 'mimo-v2.6-flash-free',
    name: 'MiMo V2.6',
    description: 'Fast thinking',
    geminiModel: 'thk/mimo-v2.6-flash:free',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'mimo-v2.5-free',
    name: 'MiMo V2.5',
    description: 'High-tier reasoning',
    geminiModel: 'thk/mimo-v2.5:free',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'agents-a1',
    name: 'Agents-A1',
    description: 'Scientific multimodal',
    geminiModel: 'intern/Agents-A1',
    supportsVision: true,
    contextLength: '256K',
  },
  {
    id: 'atria-dawn',
    name: 'Atria-Dawn',
    description: 'Scientific reasoning',
    geminiModel: 'intern/Atria-Dawn',
    supportsVision: false,
    contextLength: '512K',
  },
  {
    id: 'glm-5.3-free',
    name: 'GLM 5.3',
    description: 'Reasoning & vision',
    geminiModel: 'glm-5.3-free',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'flm-auto',
    name: 'Auto Router',
    description: 'Smart model router',
    geminiModel: 'flm/auto',
    supportsVision: false,
    contextLength: 'Auto',
  },
  {
    id: 'gpt-6-luna',
    name: 'GPT-6 Luna',
    description: 'Multimodal intelligence',
    geminiModel: 'thk/gpt-6-luna-fast',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'claude-sonnet-4.6',
    name: 'Claude 4.6 Sonnet',
    description: 'Coding & writing',
    geminiModel: 'thk/claude-sonnet-4.6',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'thk-gpt-6.1-sol-fast',
    name: 'GPT-6.1 Sol',
    description: 'Frontier speed',
    geminiModel: 'thk/gpt-6.1-sol-fast',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'thk-gpt-6-astra-fast',
    name: 'GPT-6 Astra',
    description: 'Flagship intelligence',
    geminiModel: 'thk/gpt-6-astra-fast',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'thk-kimi-k3-fast',
    name: 'Kimi K3 Fast',
    description: 'Long-context reasoning',
    geminiModel: 'thk/kimi-k3-fast',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'thk-claude-sonnet-5.5',
    name: 'Claude Sonnet 5.5',
    description: 'Balanced coding',
    geminiModel: 'thk/claude-sonnet-5.5',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'thk-claude-opus-5.5',
    name: 'Claude Opus 5.5',
    description: 'Deep reasoning & code',
    geminiModel: 'thk/claude-opus-5.5',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'thk-grok-4.7',
    name: 'Grok 4.7',
    description: 'Real-time synthesis',
    geminiModel: 'thk/grok-4.7',
    supportsVision: true,
    contextLength: '500K',
  },
  {
    id: 'thk-gemini-4-argon',
    name: 'Gemini 4 Argon',
    description: 'Multimodal frontier',
    geminiModel: 'thk/gemini-4-argon',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'thk-mistral-large-4',
    name: 'Mistral Large 4',
    description: 'Multilingual frontier',
    geminiModel: 'thk/mistral-large-4',
    supportsVision: true,
    contextLength: '512K',
  },
  {
    id: 'atria-dawn-preview',
    name: 'Atria-Dawn Preview',
    description: 'Frontier science',
    geminiModel: 'intern/Atria-Dawn-Preview',
    supportsVision: false,
    contextLength: '512K',
  },
  {
    id: 'deepseek-v4-flash-vision',
    name: 'DeepSeek V4 Vision',
    description: 'Multimodal thinking',
    geminiModel: 'intern/deepseek-v4-flash-vision',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'deepseek-v4-pro-0813',
    name: 'DeepSeek V4 Pro',
    description: 'Deep thinking & tools',
    geminiModel: 'intern/deepseek-v4-pro-0813',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'intern-decision-4b',
    name: 'Scholar 4B',
    description: 'Structured decision',
    geminiModel: 'intern/intern-decision-4b',
    supportsVision: false,
    contextLength: '8K',
  },
  {
    id: 'intern-s2',
    name: 'Scholar-S2',
    description: 'Scientific research',
    geminiModel: 'intern/intern-s2',
    supportsVision: true,
    contextLength: '256K',
  },
  {
    id: 'kimi-k2.6',
    name: 'Kimi K2.6',
    description: 'In-depth thinking',
    geminiModel: 'intern/kimi-k2.6',
    supportsVision: true,
    contextLength: '256K',
  },
  {
    id: 'minimax-m3',
    name: 'MiniMax-M3',
    description: 'Long-context thinking',
    geminiModel: 'intern/minimax-m3',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'qwen3.8-27b',
    name: 'Qwen 3.8 Pro',
    description: 'Multimodal & tools',
    geminiModel: 'itera/qwen/qwen3.8-27b',
    supportsVision: true,
    contextLength: '256K',
  },
  {
    id: 'larp-deepseek-v4',
    name: 'DeepSeek V4',
    description: 'Analytical reasoning',
    geminiModel: 'larp/deepseek-v4',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'larp-claude-sonnet',
    name: 'Claude Sonnet',
    description: 'Coding & writing',
    geminiModel: 'larp/claude-sonnet',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'larp-gpt-6',
    name: 'GPT-6 Frontier',
    description: 'High intelligence',
    geminiModel: 'larp/gpt-6',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'larp-glm-5',
    name: 'GLM-5',
    description: 'Vision & reasoning',
    geminiModel: 'larp/glm-5',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'larp-auto',
    name: 'Smart Router',
    description: 'Dynamic routing',
    geminiModel: 'larp/auto',
    supportsVision: false,
    contextLength: 'Auto',
  },
  {
    id: 'radox-gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    description: 'Fast multimodal',
    geminiModel: 'radox/gemini-3.7-flash',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'radox-claude-sonnet-5',
    name: 'Claude Sonnet 5',
    description: 'Fast coding',
    geminiModel: 'radox/claude-sonnet-5',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'radox-claude-opus-5.5',
    name: 'Claude Opus 5.5 Pro',
    description: 'Flagship reasoning',
    geminiModel: 'radox/claude-opus-5.5',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'radox-claude-mythos-preview',
    name: 'Claude Mythos',
    description: 'Next-gen intelligence',
    geminiModel: 'radox/claude-mythos-preview',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'radox-claude-fable-5.1',
    name: 'Claude Fable 5.1',
    description: 'Creative synthesis',
    geminiModel: 'radox/claude-fable-5.1',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'radox-gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    description: 'High-speed frontier',
    geminiModel: 'radox/gpt-5.6-sol',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'radox-gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    description: 'Deep analytical',
    geminiModel: 'radox/gpt-5.6-terra',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'radox-gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    description: 'Multimodal vision',
    geminiModel: 'radox/gpt-5.6-luna',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'radox-deepseek-v4-pro-max',
    name: 'DeepSeek V4 Max',
    description: 'Max reasoning & math',
    geminiModel: 'radox/deepseek-v4-pro-max',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'radox-gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    description: '2M pro reasoning',
    geminiModel: 'radox/gemini-3.1-pro',
    supportsVision: true,
    contextLength: '2M',
  },
  {
    id: 'radox-grok-4.6',
    name: 'Grok 4.6',
    description: 'Real-time intelligence',
    geminiModel: 'radox/grok-4.6',
    supportsVision: true,
    contextLength: '500K',
  },
  {
    id: 'radox-qwen3.8-max',
    name: 'Qwen 3.8 Max',
    description: 'Flagship coding',
    geminiModel: 'radox/qwen3.8-max',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'radox-kimi-k3',
    name: 'Kimi K3',
    description: 'Long-context synthesis',
    geminiModel: 'radox/kimi-k3',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'radox-seed-2.1-pro',
    name: 'Seed 2.1 Pro',
    description: 'High-precision pro',
    geminiModel: 'radox/seed-2.1-pro',
    supportsVision: true,
    contextLength: '512K',
  },
  {
    id: 'radox-muse-spark-1.1',
    name: 'Muse Spark 1.1',
    description: 'Fast creative',
    geminiModel: 'radox/muse-spark-1.1',
    supportsVision: false,
    contextLength: '256K',
  },
  {
    id: 'itera-claude-haiku-5.5',
    name: 'Claude Haiku 5.5',
    description: 'Low-latency speed',
    geminiModel: 'itera/anthropic/claude-haiku-5-5',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'itera-deepseek-v4.1-flash-1017',
    name: 'DeepSeek V4.1 (1017)',
    description: 'Latest fast reasoning',
    geminiModel: 'itera/deepseek/deepseek-v4.1-flash-1017',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'itera-claude-sonnet-5.5',
    name: 'Claude Sonnet 5.5 Fast',
    description: 'Fast coding & logic',
    geminiModel: 'itera/anthropic/claude-sonnet-5-5',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'itera-kimi-k3-free',
    name: 'Kimi K3 (1M)',
    description: '1M deep reasoning',
    geminiModel: 'itera/moonshotai/kimi-k3-free',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'itera-claude-opus-5.5',
    name: 'Claude Opus 5.5 Ultra',
    description: 'Flagship multimodal',
    geminiModel: 'itera/anthropic/claude-opus-5-5',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'itera-claude-fable-5.1',
    name: 'Claude Fable Ultra',
    description: 'Deep synthesis',
    geminiModel: 'itera/anthropic/claude-fable-5-1',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'itera-gpt-6.1-sol',
    name: 'GPT-6.1 Sol Pro',
    description: 'Frontier intelligence',
    geminiModel: 'itera/openai/gpt-6.1-sol',
    supportsVision: true,
    contextLength: '922K',
  },
  {
    id: 'itera-gpt-6-astra',
    name: 'GPT-6 Astra Pro',
    description: 'Deep analytical',
    geminiModel: 'itera/openai/gpt-6-astra',
    supportsVision: true,
    contextLength: '922K',
  },
  {
    id: 'itera-gpt-6-luna',
    name: 'GPT-6 Luna Pro',
    description: 'Vision & reasoning',
    geminiModel: 'itera/openai/gpt-6-luna',
    supportsVision: true,
    contextLength: '922K',
  },
  {
    id: 'itera-gemini-4-argon',
    name: 'Gemini 4 Argon Pro',
    description: 'Next-gen multimodal',
    geminiModel: 'itera/gemini/gemini-4-argon',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'itera-deepseek-v4-pro-0813',
    name: 'DeepSeek V4 Pro+',
    description: 'Analytical pro',
    geminiModel: 'itera/deepseek/deepseek-v4-pro-0813',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'itera-qwen3.8-2.4t',
    name: 'Qwen 3.8 2.4T',
    description: '2.4T MoE reasoning',
    geminiModel: 'itera/qwen/qwen3.8-2.4t-a95b',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'itera-kimi-k2.7-code',
    name: 'Kimi K2.7 Code',
    description: 'Software engineering',
    geminiModel: 'itera/moonshotai/kimi-k2.7-code',
    supportsVision: false,
    contextLength: '256K',
  },
  {
    id: 'itera-minimax-m3',
    name: 'MiniMax M3 Pro',
    description: '1M context flagship',
    geminiModel: 'itera/minimax/minimax-m3',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'itera-glm-5.3',
    name: 'GLM 5.3 Max',
    description: 'Max effort reasoning',
    geminiModel: 'itera/z-ai/glm-5.3',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'ar-anyrouter-free',
    name: 'Unified Free',
    description: 'Smart free router',
    geminiModel: 'ar/anyrouter/free',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'ar-anyrouter-auto',
    name: 'Auto Multimodal',
    description: 'Multimodal router',
    geminiModel: 'ar/anyrouter/auto',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'ar-anyrouter-latest',
    name: 'Frontier Router',
    description: 'Flagship router',
    geminiModel: 'ar/anyrouter/latest',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'ar-anyrouter-hermes',
    name: 'Hermes Router',
    description: 'Agentic & coding',
    geminiModel: 'ar/anyrouter/hermes',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'ar-anyrouter-cowork',
    name: 'Cowork Router',
    description: 'Collaborative vision',
    geminiModel: 'ar/anyrouter/cowork',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'ar-nemotron-3.5-super-vl-120b',
    name: 'Nemotron 3.5 120B',
    description: 'Multimodal & code',
    geminiModel: 'ar/nvidia/nemotron-3.5-super-vl-120b-a12b',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'ar-nemotron-3.5-lightning-30b',
    name: 'Nemotron 3.5 30B',
    description: 'Fast 30B MoE',
    geminiModel: 'ar/nvidia/nemotron-3.5-lightning-30b-a3b',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'ar-nemotron-3.5-bolt-e4b',
    name: 'Nemotron Bolt',
    description: 'Sub-second flash',
    geminiModel: 'ar/nvidia/nemotron-3.5-bolt-e4b',
    supportsVision: false,
    contextLength: '64K',
  },
  {
    id: 'ar-nemotron-3-ultra-550b',
    name: 'Nemotron Ultra 550B',
    description: '550B frontier MoE',
    geminiModel: 'ar/nvidia/nemotron-3-ultra-550b-a55b',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'ar-nemotron-3.5-content-safety',
    name: 'Nemotron Safety VL',
    description: 'Vision analysis',
    geminiModel: 'ar/nvidia/nemotron-3.5-content-safety',
    supportsVision: true,
    contextLength: '128K',
  },
  {
    id: 'ar-nemotron-parse-2.0',
    name: 'Nemotron Parse 2.0',
    description: 'Document parser',
    geminiModel: 'ar/nvidia/nemotron-parse-2.0',
    supportsVision: true,
    contextLength: '8K',
  },
  {
    id: 'ar-riva-translate-4b-v2',
    name: 'Riva Translate 4B',
    description: 'Neural translation',
    geminiModel: 'ar/nvidia/riva-translate-4b-instruct-v2',
    supportsVision: false,
    contextLength: '4K',
  },
  {
    id: 'ar-minimax-m3.1-flash',
    name: 'MiniMax M3.1',
    description: 'Multimodal & coding',
    geminiModel: 'ar/minimax/minimax-m3.1-flash',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'ar-longcat-2.5-preview',
    name: 'LongCat 2.5',
    description: 'Vision & code',
    geminiModel: 'ar/meituan/longcat-2.5-preview',
    supportsVision: true,
    contextLength: '1M',
  },
  {
    id: 'ar-meta-muse-glimmer-30b',
    name: 'Muse Glimmer 30B',
    description: 'Vision & code',
    geminiModel: 'ar/meta/muse-glimmer-30b',
    supportsVision: true,
    contextLength: '128K',
  },
  {
    id: 'ar-cohere-north-mini-code',
    name: 'North Mini Code',
    description: 'Code & reasoning',
    geminiModel: 'ar/cohere/north-mini-code',
    supportsVision: false,
    contextLength: '256K',
  },
  {
    id: 'ar-dots-3-note-preview',
    name: 'Dots 3 Note',
    description: 'Multimodal research',
    geminiModel: 'ar/dots-studio/dots-3-note-preview',
    supportsVision: true,
    contextLength: '512K',
  },
  {
    id: 'ar-liquid-lfm-2.5-2.6b',
    name: 'LFM 2.5',
    description: 'Fast foundation',
    geminiModel: 'ar/liquid/lfm-2.5-2.6b',
    supportsVision: false,
    contextLength: '128K',
  },
  {
    id: 'ar-liquid-d1',
    name: 'Liquid d1',
    description: 'Compact reasoning',
    geminiModel: 'ar/liquid/d1',
    supportsVision: false,
    contextLength: '32K',
  },
  {
    id: 'ar-openai-gpt-oss-20b',
    name: 'GPT-OSS 20B',
    description: 'Open-weights code',
    geminiModel: 'ar/openai/gpt-oss-20b',
    supportsVision: false,
    contextLength: '128K',
  },
  {
    id: 'ar-poolside-laguna-s-2.1',
    name: 'Laguna S 2.1',
    description: 'Software engineering',
    geminiModel: 'ar/poolside/laguna-s-2.1',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'ar-poolside-laguna-xs-2.1',
    name: 'Laguna XS 2.1',
    description: 'Fast code synthesis',
    geminiModel: 'ar/poolside/laguna-xs-2.1',
    supportsVision: false,
    contextLength: '256K',
  },
  {
    id: 'ar-recursive-flint-v1',
    name: 'Flint v1.0',
    description: 'Code & analysis',
    geminiModel: 'ar/recursive/flint-v1.0',
    supportsVision: false,
    contextLength: '256K',
  },
  {
    id: 'ar-reflection-beam-1.0',
    name: 'Beam 1.0',
    description: '1M code synthesis',
    geminiModel: 'ar/reflection/beam-1.0',
    supportsVision: false,
    contextLength: '1M',
  },
  {
    id: 'ar-stealth-glyph-cluster',
    name: 'Glyph Cluster',
    description: 'Cluster reasoning',
    geminiModel: 'ar/stealth/glyph-cluster',
    supportsVision: false,
    contextLength: '256K',
  },
  {
    id: 'ar-apple-foundation-model',
    name: 'Foundation 3B',
    description: 'Compact intelligence',
    geminiModel: 'ar/apple/foundation-model',
    supportsVision: false,
    contextLength: '4K',
  },
  {
    id: 'ar-glm-4.5-flash',
    name: 'GLM 4.5 Flash',
    description: 'Fast flash',
    geminiModel: 'ar/z-ai/glm-4.5-flash',
    supportsVision: false,
    contextLength: '128K',
  },
  {
    id: 'ar-glm-flash-latest',
    name: 'GLM Flash',
    description: 'High-speed flash',
    geminiModel: 'ar/z-ai/glm-flash-latest',
    supportsVision: false,
    contextLength: '128K',
  },
  {
    id: 'ar-pareto-code-router',
    name: 'Pareto Code',
    description: '2M code synthesis',
    geminiModel: 'ar/openrouter/pareto-code',
    supportsVision: true,
    contextLength: '2M',
  },
  {
    id: 'ar-bodybuilder-router',
    name: 'BodyBuilder',
    description: 'Structured output',
    geminiModel: 'ar/openrouter/bodybuilder',
    supportsVision: false,
    contextLength: '128K',
  },
  {
    id: 'ar-inception-mercury-decide',
    name: 'Mercury Decide',
    description: 'Ultra-fast diffusion',
    geminiModel: 'ar/inception/mercury-decide',
    supportsVision: false,
    contextLength: '32K',
  },
];

const FREE_MODEL_IDS = new Set([
  'deepseek-v4.1-flash-free',
  'itera-qwen3.8-27b-free',
  'deepseek-v4-flash-0731-free',
  'glm-5.3-flash-free',
  'mimo-v2.6-flash-free',
  'mimo-v2.5-free',
  'agents-a1',
  'atria-dawn',
  'glm-5.3-free',
  'flm-auto',
  'intern-decision-4b',
  'ar-anyrouter-free',
  'ar-nemotron-3.5-bolt-e4b',
  'ar-riva-translate-4b-v2',
  'ar-liquid-lfm-2.5-2.6b',
  'ar-liquid-d1',
  'ar-openai-gpt-oss-20b',
  'ar-apple-foundation-model',
  'ar-glm-4.5-flash',
]);

const FIRE_MODEL_IDS = new Set([
  'thk-gpt-6.1-sol-fast',
  'thk-gpt-6-astra-fast',
  'thk-claude-opus-5.5',
  'thk-grok-4.7',
  'thk-gemini-4-argon',
  'larp-gpt-6',
  'radox-claude-opus-5.5',
  'radox-claude-mythos-preview',
  'radox-claude-fable-5.1',
  'radox-gpt-5.6-sol',
  'radox-gpt-5.6-terra',
  'radox-deepseek-v4-pro-max',
  'radox-gemini-3.1-pro',
  'radox-qwen3.8-max',
  'radox-seed-2.1-pro',
  'itera-claude-opus-5.5',
  'itera-claude-fable-5.1',
  'itera-gpt-6.1-sol',
  'itera-gpt-6-astra',
  'itera-gpt-6-luna',
  'itera-gemini-4-argon',
  'itera-qwen3.8-2.4t',
  'itera-minimax-m3',
  'itera-glm-5.3',
  'ar-anyrouter-latest',
  'ar-nemotron-3.5-super-vl-120b',
  'ar-nemotron-3-ultra-550b',
  'ar-poolside-laguna-s-2.1',
  'ar-reflection-beam-1.0',
  'ar-pareto-code-router',
]);

export function getModelRequiredTier(model: ModelOption): 'free' | 'spark' | 'fire' {
  if (model.requiredTier) return model.requiredTier;
  if (FREE_MODEL_IDS.has(model.id)) return 'free';
  if (FIRE_MODEL_IDS.has(model.id)) return 'fire';
  return 'spark';
}

export function getDefaultVisionModel(): ModelOption {
  return (
    GROK_MODELS.find((m) => m.supportsVision && UserAccountStore.canUseModel(getModelRequiredTier(m))) ||
    GROK_MODELS.find((m) => m.supportsVision) ||
    GROK_MODELS[0]
  );
}

interface GrokModelPickerProps {
  selectedModelId: string;
  onSelectModel: (model: ModelOption) => void;
  onOpenPricing?: (highlightPlan?: 'free' | 'spark' | 'fire', reason?: string) => void;
  isEmpty?: boolean;
  isDark?: boolean;
  dropdownDirection?: 'down' | 'up';
  variant?: 'header' | 'pill';
}

export const GrokModelPicker: React.FC<GrokModelPickerProps> = ({
  selectedModelId,
  onSelectModel,
  onOpenPricing,
  isDark = true,
  dropdownDirection = 'down',
  variant = 'header',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'spark' | 'fire'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [, setCurrentPlan] = useState<'free' | 'spark' | 'fire'>(() =>
    UserAccountStore.getNormalizedPlan()
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const current = GROK_MODELS.find((m) => m.id === selectedModelId) || GROK_MODELS[0];

  useEffect(() => {
    const syncPlan = () => setCurrentPlan(UserAccountStore.getNormalizedPlan());
    window.addEventListener('zeno-account-updated', syncPlan);
    return () => window.removeEventListener('zeno-account-updated', syncPlan);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = GROK_MODELS.filter((m) => {
    if (tierFilter !== 'all' && getModelRequiredTier(m) !== tierFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const triggerPricingPopup = (tier: 'spark' | 'fire', modelName: string) => {
    const planLabel = tier === 'spark' ? 'Spark ($1/mo)' : 'Fire ($5/mo)';
    const reason = `${modelName} requires the ${planLabel} plan. Upgrade now to unlock it.`;
    if (onOpenPricing) {
      onOpenPricing(tier, reason);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('zeno-open-pricing', {
          detail: { highlightPlan: tier, reason },
        })
      );
    }
  };

  const triggerClasses =
    variant === 'header'
      ? `flex items-center gap-1 px-2.5 py-1.5 rounded-full border backdrop-blur-2xl backdrop-saturate-150 transition-all cursor-pointer font-medium text-[11px] select-none ${
          isDark
            ? 'bg-neutral-900/55 hover:bg-neutral-800/65 border-white/[0.16] text-white shadow-[0_8px_32px_rgba(0,0,0,0.55)]'
            : 'bg-white/65 hover:bg-white/85 border-black/[0.1] text-black shadow-[0_8px_32px_rgba(0,0,0,0.1)]'
        }`
      : `flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-colors cursor-pointer ${
          isDark ? 'text-white/80 hover:text-white' : 'text-black/75 hover:text-black'
        }`;

  const dropdownPositionClasses =
    dropdownDirection === 'down'
      ? 'top-full left-0 mt-1.5'
      : 'bottom-full right-0 mb-2';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${triggerClasses} max-w-[140px] sm:max-w-[200px]`}
        title={current.name}
      >
        <span className="font-medium text-[11px] tracking-tight truncate">{current.name}</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          } opacity-60`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${dropdownPositionClasses} w-56 sm:w-64 max-w-[calc(100vw-1.5rem)] max-h-[min(360px,65dvh)] flex flex-col rounded-xl border p-1.5 z-50 text-[11px] backdrop-blur-2xl backdrop-saturate-150 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? 'bg-neutral-900/75 border-white/[0.16] text-white shadow-[0_16px_48px_rgba(0,0,0,0.85)]'
              : 'bg-white/80 border-black/[0.1] text-[#0d0d0d] shadow-[0_16px_48px_rgba(0,0,0,0.16)]'
          }`}
        >
          {/* Compact Search + Tier Filter */}
          <div className="space-y-1 pb-1.5 mb-1 border-b border-black/10 dark:border-white/10 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className={`w-full px-2 py-1 rounded-lg text-[10px] outline-none border ${
                isDark
                  ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/35 focus:border-white/20'
                  : 'bg-black/[0.03] border-black/[0.08] text-black placeholder:text-black/40 focus:border-black/20'
              }`}
            />
            <div className="flex items-center gap-0.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'free', label: 'Free' },
                  { id: 'spark', label: 'Spark' },
                  { id: 'fire', label: 'Fire' },
                ] as const
              ).map((tab) => {
                const active = tierFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTierFilter(tab.id)}
                    className={`flex-1 py-0.5 px-1.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-black text-white'
                        : isDark
                        ? 'text-white/55 hover:bg-white/5 hover:text-white'
                        : 'text-black/55 hover:bg-black/5 hover:text-black'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compact Models List */}
          <div className="space-y-0.5 overflow-y-auto scrollbar-thin pr-0.5">
            {filteredModels.length === 0 ? (
              <div className="py-4 text-center text-[10px] opacity-50">No models found</div>
            ) : (
              filteredModels.map((m) => {
                const isSelected = m.id === current.id;
                const reqTier = getModelRequiredTier(m);
                const isLocked = !UserAccountStore.canUseModel(reqTier);

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (isLocked && (reqTier === 'spark' || reqTier === 'fire')) {
                        setIsOpen(false);
                        triggerPricingPopup(reqTier, m.name);
                        return;
                      }
                      onSelectModel(m);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-white/10 text-white'
                          : 'bg-black/5 text-[#0d0d0d]'
                        : isDark
                        ? 'hover:bg-white/[0.05] text-white/85'
                        : 'hover:bg-black/[0.04] text-black/85'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`font-medium text-[11px] leading-tight truncate ${
                            isLocked ? 'opacity-70' : ''
                          }`}
                        >
                          {m.name}
                        </span>
                        {m.contextLength && (
                          <span
                            className={`text-[9px] font-mono shrink-0 ${
                              isDark ? 'text-white/35' : 'text-black/40'
                            }`}
                          >
                            {m.contextLength}
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-[9.5px] leading-tight truncate mt-0.5 ${
                          isDark ? 'text-white/45' : 'text-black/45'
                        }`}
                      >
                        {m.description}
                        {m.supportsVision ? ' · Vision' : ''}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      {isSelected ? (
                        <Check
                          className={`w-3 h-3 ${isDark ? 'text-white' : 'text-black'}`}
                        />
                      ) : reqTier !== 'free' ? (
                        <span
                          className={`text-[9px] font-medium ${
                            reqTier === 'fire'
                              ? 'text-orange-400/80'
                              : 'text-amber-400/80'
                          }`}
                        >
                          {reqTier === 'fire' ? '$5' : '$1'}
                        </span>
                      ) : null}
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

