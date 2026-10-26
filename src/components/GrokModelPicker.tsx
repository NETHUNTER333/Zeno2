import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  geminiModel: string;
  supportsVision: boolean;
  contextLength?: string;
  category?: 'core' | 'tokenharbor' | 'intern' | 'larp' | 'radox' | 'itera' | 'anyrouter';
}

export const GROK_MODELS: ModelOption[] = [
  // --- Fastest Default Reply Models ---
  {
    id: 'deepseek-v4.1-flash-free',
    name: 'DeepSeek V4.1 Flash',
    description: 'Ultra-Fast Instant Reply & Reasoning',
    geminiModel: 'thk/deepseek-v4.1-flash:free',
    supportsVision: false,
    contextLength: '1M',
    category: 'core',
  },
  {
    id: 'itera-qwen3.8-27b-free',
    name: 'Qwen 3.8 27B Flash',
    description: 'Sub-Second Reply & Vision',
    geminiModel: 'itera/qwen/qwen3.8-27b',
    supportsVision: true,
    contextLength: '256K',
    category: 'core',
  },
  {
    id: 'deepseek-v4-flash-0731-free',
    name: 'DeepSeek V4 Flash',
    description: 'Fast Analytical Reasoning',
    geminiModel: 'thk/deepseek-v4-flash:free',
    supportsVision: false,
    contextLength: '1M',
    category: 'core',
  },
  {
    id: 'glm-5.3-flash-free',
    name: 'GLM 5.3 Flash',
    description: 'Ultra-Low-Latency & Vision',
    geminiModel: 'glm-5.3-flash-free',
    supportsVision: true,
    contextLength: '128K',
    category: 'core',
  },
  {
    id: 'mimo-v2.6-flash-free',
    name: 'MiMo V2.6 Flash',
    description: 'Low-Latency Fast Thinking',
    geminiModel: 'thk/mimo-v2.6-flash:free',
    supportsVision: false,
    contextLength: '1M',
    category: 'core',
  },
  {
    id: 'mimo-v2.5-free',
    name: 'MiMo V2.5 High-Tier',
    description: 'Fast High-Tier Reasoning',
    geminiModel: 'thk/mimo-v2.5:free',
    supportsVision: false,
    contextLength: '1M',
    category: 'core',
  },
  {
    id: 'agents-a1',
    name: 'Agents-A1',
    description: 'Fast Scientific & Multimodal',
    geminiModel: 'intern/Agents-A1',
    supportsVision: true,
    contextLength: '256K',
    category: 'core',
  },
  {
    id: 'atria-dawn',
    name: 'Atria-Dawn',
    description: 'Fast Scientific Reasoning',
    geminiModel: 'intern/Atria-Dawn',
    supportsVision: false,
    contextLength: '512K',
    category: 'core',
  },
  {
    id: 'glm-5.3-free',
    name: 'GLM 5.3',
    description: 'High Performance Reasoning & Vision',
    geminiModel: 'glm-5.3-free',
    supportsVision: true,
    contextLength: '1M',
    category: 'core',
  },
  {
    id: 'flm-auto',
    name: 'Auto Router',
    description: 'Fastest Adaptive Smart Router',
    geminiModel: 'flm/auto',
    supportsVision: false,
    contextLength: 'Auto',
    category: 'core',
  },
  {
    id: 'gpt-6-luna',
    name: 'GPT-6 Luna Vision',
    description: 'Multimodal Vision & Intelligence',
    geminiModel: 'thk/gpt-6-luna-fast',
    supportsVision: true,
    contextLength: '1.05M',
    category: 'core',
  },
  {
    id: 'claude-sonnet-4.6',
    name: 'Claude 4.6 Sonnet',
    description: 'Advanced Coding & Nuanced Writing',
    geminiModel: 'thk/claude-sonnet-4.6',
    supportsVision: true,
    contextLength: '1M',
    category: 'core',
  },
  // --- Frontier Models ---
  {
    id: 'thk-gpt-6.1-sol-fast',
    name: 'GPT-6.1 Sol Fast',
    description: 'High-Speed Frontier Intelligence',
    geminiModel: 'thk/gpt-6.1-sol-fast',
    supportsVision: true,
    contextLength: '1.05M',
    category: 'tokenharbor',
  },
  {
    id: 'thk-gpt-6-astra-fast',
    name: 'GPT-6 Astra Fast',
    description: 'Flagship Deep Intelligence',
    geminiModel: 'thk/gpt-6-astra-fast',
    supportsVision: true,
    contextLength: '1.05M',
    category: 'tokenharbor',
  },
  {
    id: 'thk-kimi-k3-fast',
    name: 'Kimi K3 Fast',
    description: 'Long-Context Fast Reasoning',
    geminiModel: 'thk/kimi-k3-fast',
    supportsVision: true,
    contextLength: '1M',
    category: 'tokenharbor',
  },
  {
    id: 'thk-claude-sonnet-5.5',
    name: 'Claude Sonnet 5.5',
    description: 'Balanced Coding & Analysis',
    geminiModel: 'thk/claude-sonnet-5.5',
    supportsVision: true,
    contextLength: '1M',
    category: 'tokenharbor',
  },
  {
    id: 'thk-claude-opus-5.5',
    name: 'Claude Opus 5.5',
    description: 'Flagship Deep Reasoning & Coding',
    geminiModel: 'thk/claude-opus-5.5',
    supportsVision: true,
    contextLength: '1M',
    category: 'tokenharbor',
  },
  {
    id: 'thk-grok-4.7',
    name: 'Grok 4.7',
    description: 'Real-Time Synthesis & Reasoning',
    geminiModel: 'thk/grok-4.7',
    supportsVision: true,
    contextLength: '500K',
    category: 'tokenharbor',
  },
  {
    id: 'thk-gemini-4-argon',
    name: 'Gemini 4 Argon',
    description: 'Next-Gen Multimodal Intelligence',
    geminiModel: 'thk/gemini-4-argon',
    supportsVision: true,
    contextLength: '1M',
    category: 'tokenharbor',
  },
  {
    id: 'thk-mistral-large-4',
    name: 'Mistral Large 4',
    description: 'Multilingual Frontier Model',
    geminiModel: 'thk/mistral-large-4',
    supportsVision: true,
    contextLength: '512K',
    category: 'tokenharbor',
  },
  // --- Scientific & Research Models ---
  {
    id: 'atria-dawn-preview',
    name: 'Atria-Dawn Preview',
    description: 'Frontier Scientific Reasoning',
    geminiModel: 'intern/Atria-Dawn-Preview',
    supportsVision: false,
    contextLength: '512K',
    category: 'intern',
  },
  {
    id: 'deepseek-v4-flash-vision',
    name: 'DeepSeek V4 Flash Vision',
    description: 'Multimodal In-Depth Thinking',
    geminiModel: 'intern/deepseek-v4-flash-vision',
    supportsVision: true,
    contextLength: '1M',
    category: 'intern',
  },
  {
    id: 'deepseek-v4-pro-0813',
    name: 'DeepSeek V4 Pro',
    description: 'Tool Usage & In-Depth Thinking',
    geminiModel: 'intern/deepseek-v4-pro-0813',
    supportsVision: false,
    contextLength: '1M',
    category: 'intern',
  },
  {
    id: 'intern-decision-4b',
    name: 'Scholar Decision 4B',
    description: 'Structured Decision & Policy Engine',
    geminiModel: 'intern/intern-decision-4b',
    supportsVision: false,
    contextLength: '8K',
    category: 'intern',
  },
  {
    id: 'intern-s2',
    name: 'Scholar-S2',
    description: 'Multimodal Scientific Research',
    geminiModel: 'intern/intern-s2',
    supportsVision: true,
    contextLength: '256K',
    category: 'intern',
  },
  {
    id: 'kimi-k2.6',
    name: 'Kimi K2.6',
    description: 'Multimodal In-Depth Thinking',
    geminiModel: 'intern/kimi-k2.6',
    supportsVision: true,
    contextLength: '256K',
    category: 'intern',
  },
  {
    id: 'minimax-m3',
    name: 'MiniMax-M3',
    description: 'Long-Context In-Depth Thinking',
    geminiModel: 'intern/minimax-m3',
    supportsVision: false,
    contextLength: '1M',
    category: 'intern',
  },
  {
    id: 'qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    description: 'Multimodal Tool & Thinking',
    geminiModel: 'itera/qwen/qwen3.8-27b',
    supportsVision: true,
    contextLength: '256K',
    category: 'intern',
  },
  // --- Extended Models ---
  {
    id: 'larp-deepseek-v4',
    name: 'DeepSeek V4',
    description: 'Advanced Analytical Reasoning',
    geminiModel: 'larp/deepseek-v4',
    supportsVision: false,
    contextLength: '1M',
    category: 'larp',
  },
  {
    id: 'larp-claude-sonnet',
    name: 'Claude Sonnet',
    description: 'Frontier Coding & Writing',
    geminiModel: 'larp/claude-sonnet',
    supportsVision: true,
    contextLength: '1M',
    category: 'larp',
  },
  {
    id: 'larp-gpt-6',
    name: 'GPT-6 Frontier',
    description: 'High-Intelligence Multimodal',
    geminiModel: 'larp/gpt-6',
    supportsVision: true,
    contextLength: '1.05M',
    category: 'larp',
  },
  {
    id: 'larp-glm-5',
    name: 'GLM-5',
    description: 'Vision & Deep Reasoning',
    geminiModel: 'larp/glm-5',
    supportsVision: true,
    contextLength: '1M',
    category: 'larp',
  },
  {
    id: 'larp-auto',
    name: 'Smart Auto Router',
    description: 'Dynamic Smart Model Routing',
    geminiModel: 'larp/auto',
    supportsVision: false,
    contextLength: 'Auto',
    category: 'larp',
  },
  // --- Pro & Next-Gen Models ---
  {
    id: 'radox-gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    description: 'Ultra-Fast Multimodal',
    geminiModel: 'radox/gemini-3.7-flash',
    supportsVision: true,
    contextLength: '1M',
    category: 'radox',
  },
  {
    id: 'radox-claude-sonnet-5',
    name: 'Claude Sonnet 5',
    description: 'Fast Coding & Reasoning',
    geminiModel: 'radox/claude-sonnet-5',
    supportsVision: true,
    contextLength: '1M',
    category: 'radox',
  },
  {
    id: 'radox-claude-opus-5.5',
    name: 'Claude Opus 5.5 Pro',
    description: 'Flagship Deep Reasoning',
    geminiModel: 'radox/claude-opus-5.5',
    supportsVision: true,
    contextLength: '1M',
    category: 'radox',
  },
  {
    id: 'radox-claude-mythos-preview',
    name: 'Claude Mythos Preview',
    description: 'Next-Gen Frontier Intelligence',
    geminiModel: 'radox/claude-mythos-preview',
    supportsVision: true,
    contextLength: '1M',
    category: 'radox',
  },
  {
    id: 'radox-claude-fable-5.1',
    name: 'Claude Fable 5.1',
    description: 'Creative & Deep Synthesis',
    geminiModel: 'radox/claude-fable-5.1',
    supportsVision: true,
    contextLength: '1M',
    category: 'radox',
  },
  {
    id: 'radox-gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    description: 'High-Speed Frontier Intelligence',
    geminiModel: 'radox/gpt-5.6-sol',
    supportsVision: true,
    contextLength: '1.05M',
    category: 'radox',
  },
  {
    id: 'radox-gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    description: 'Deep Analytical Reasoning',
    geminiModel: 'radox/gpt-5.6-terra',
    supportsVision: true,
    contextLength: '1.05M',
    category: 'radox',
  },
  {
    id: 'radox-gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    description: 'Multimodal Vision & Reasoning',
    geminiModel: 'radox/gpt-5.6-luna',
    supportsVision: true,
    contextLength: '1.05M',
    category: 'radox',
  },
  {
    id: 'radox-deepseek-v4-pro-max',
    name: 'DeepSeek V4 Pro Max',
    description: 'Maximum Reasoning & Math',
    geminiModel: 'radox/deepseek-v4-pro-max',
    supportsVision: false,
    contextLength: '1M',
    category: 'radox',
  },
  {
    id: 'radox-gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    description: 'Long-Context Pro Reasoning',
    geminiModel: 'radox/gemini-3.1-pro',
    supportsVision: true,
    contextLength: '2M',
    category: 'radox',
  },
  {
    id: 'radox-grok-4.6',
    name: 'Grok 4.6',
    description: 'Real-Time Intelligence',
    geminiModel: 'radox/grok-4.6',
    supportsVision: true,
    contextLength: '500K',
    category: 'radox',
  },
  {
    id: 'radox-qwen3.8-max',
    name: 'Qwen 3.8 Max',
    description: 'Flagship Coding & Logic',
    geminiModel: 'radox/qwen3.8-max',
    supportsVision: true,
    contextLength: '1M',
    category: 'radox',
  },
  {
    id: 'radox-kimi-k3',
    name: 'Kimi K3',
    description: 'Long-Context Synthesis',
    geminiModel: 'radox/kimi-k3',
    supportsVision: true,
    contextLength: '1M',
    category: 'radox',
  },
  {
    id: 'radox-seed-2.1-pro',
    name: 'Seed 2.1 Pro',
    description: 'High-Precision Pro Model',
    geminiModel: 'radox/seed-2.1-pro',
    supportsVision: true,
    contextLength: '512K',
    category: 'radox',
  },
  {
    id: 'radox-muse-spark-1.1',
    name: 'Muse Spark 1.1',
    description: 'Fast Creative & Analytical',
    geminiModel: 'radox/muse-spark-1.1',
    supportsVision: false,
    contextLength: '256K',
    category: 'radox',
  },
  // --- Compute & High-Effort Models ---
  {
    id: 'itera-claude-haiku-5.5',
    name: 'Claude Haiku 5.5',
    description: 'Ultra-Low-Latency Intelligence',
    geminiModel: 'itera/anthropic/claude-haiku-5-5',
    supportsVision: true,
    contextLength: '1M',
    category: 'itera',
  },
  {
    id: 'itera-deepseek-v4.1-flash-1017',
    name: 'DeepSeek V4.1 Flash (1017)',
    description: 'Latest Fast Reasoning',
    geminiModel: 'itera/deepseek/deepseek-v4.1-flash-1017',
    supportsVision: false,
    contextLength: '1M',
    category: 'itera',
  },
  {
    id: 'itera-claude-sonnet-5.5',
    name: 'Claude Sonnet 5.5 Fast',
    description: 'Fast Coding & Reasoning',
    geminiModel: 'itera/anthropic/claude-sonnet-5-5',
    supportsVision: true,
    contextLength: '1M',
    category: 'itera',
  },
  {
    id: 'itera-kimi-k3-free',
    name: 'Kimi K3 (1M)',
    description: '1M Context Deep Reasoning',
    geminiModel: 'itera/moonshotai/kimi-k3-free',
    supportsVision: true,
    contextLength: '1M',
    category: 'itera',
  },
  {
    id: 'itera-claude-opus-5.5',
    name: 'Claude Opus 5.5 Ultra',
    description: 'Flagship Multimodal Intelligence',
    geminiModel: 'itera/anthropic/claude-opus-5-5',
    supportsVision: true,
    contextLength: '1M',
    category: 'itera',
  },
  {
    id: 'itera-claude-fable-5.1',
    name: 'Claude Fable 5.1 Ultra',
    description: 'Deep Synthesis & Reasoning',
    geminiModel: 'itera/anthropic/claude-fable-5-1',
    supportsVision: true,
    contextLength: '1M',
    category: 'itera',
  },
  {
    id: 'itera-gpt-6.1-sol',
    name: 'GPT-6.1 Sol',
    description: 'Frontier High-Speed Intelligence',
    geminiModel: 'itera/openai/gpt-6.1-sol',
    supportsVision: true,
    contextLength: '922K',
    category: 'itera',
  },
  {
    id: 'itera-gpt-6-astra',
    name: 'GPT-6 Astra',
    description: 'Deep Analytical Intelligence',
    geminiModel: 'itera/openai/gpt-6-astra',
    supportsVision: true,
    contextLength: '922K',
    category: 'itera',
  },
  {
    id: 'itera-gpt-6-luna',
    name: 'GPT-6 Luna',
    description: 'Multimodal Vision & Reasoning',
    geminiModel: 'itera/openai/gpt-6-luna',
    supportsVision: true,
    contextLength: '922K',
    category: 'itera',
  },
  {
    id: 'itera-gemini-4-argon',
    name: 'Gemini 4 Argon Pro',
    description: 'Next-Gen Multimodal Intelligence',
    geminiModel: 'itera/gemini/gemini-4-argon',
    supportsVision: true,
    contextLength: '1M',
    category: 'itera',
  },
  {
    id: 'itera-deepseek-v4-pro-0813',
    name: 'DeepSeek V4 Pro (0813)',
    description: 'Deep Analytical Pro',
    geminiModel: 'itera/deepseek/deepseek-v4-pro-0813',
    supportsVision: false,
    contextLength: '1M',
    category: 'itera',
  },
  {
    id: 'itera-qwen3.8-2.4t',
    name: 'Qwen 3.8 2.4T MoE',
    description: 'Massive 2.4T Parameter Reasoning',
    geminiModel: 'itera/qwen/qwen3.8-2.4t-a95b',
    supportsVision: true,
    contextLength: '1M',
    category: 'itera',
  },
  {
    id: 'itera-kimi-k2.7-code',
    name: 'Kimi K2.7 Code',
    description: 'Specialized Software Engineering',
    geminiModel: 'itera/moonshotai/kimi-k2.7-code',
    supportsVision: false,
    contextLength: '256K',
    category: 'itera',
  },
  {
    id: 'itera-minimax-m3',
    name: 'MiniMax M3 (1M)',
    description: '1M Context Flagship',
    geminiModel: 'itera/minimax/minimax-m3',
    supportsVision: false,
    contextLength: '1M',
    category: 'itera',
  },
  {
    id: 'itera-glm-5.3',
    name: 'GLM 5.3 Max Reasoning',
    description: 'Max Effort Reasoning & Vision',
    geminiModel: 'itera/z-ai/glm-5.3',
    supportsVision: true,
    contextLength: '1M',
    category: 'itera',
  },

  // --- AnyRouter Free Models (anyrouter.dev) ---
  {
    id: 'ar-anyrouter-free',
    name: 'AnyRouter Free',
    description: 'AnyRouter Zero-Cost Unified Router',
    geminiModel: 'ar/anyrouter/free',
    supportsVision: false,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-anyrouter-auto',
    name: 'AnyRouter Auto',
    description: 'AnyRouter Multimodal & Coding Auto-Router',
    geminiModel: 'ar/anyrouter/auto',
    supportsVision: true,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-anyrouter-latest',
    name: 'AnyRouter Latest',
    description: 'AnyRouter Frontier Flagship Router',
    geminiModel: 'ar/anyrouter/latest',
    supportsVision: true,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-anyrouter-hermes',
    name: 'AnyRouter Hermes',
    description: 'AnyRouter Agentic & Coding Router',
    geminiModel: 'ar/anyrouter/hermes',
    supportsVision: false,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-anyrouter-cowork',
    name: 'AnyRouter Cowork',
    description: 'AnyRouter Collaborative Vision Router',
    geminiModel: 'ar/anyrouter/cowork',
    supportsVision: true,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-nemotron-3.5-super-vl-120b',
    name: 'Nemotron 3.5 Super VL 120B',
    description: 'NVIDIA 120B A12B Multimodal & Code (Free)',
    geminiModel: 'ar/nvidia/nemotron-3.5-super-vl-120b-a12b',
    supportsVision: true,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-nemotron-3.5-lightning-30b',
    name: 'Nemotron 3.5 Lightning 30B',
    description: 'NVIDIA Ultra-Fast 30B A3B MoE (Free)',
    geminiModel: 'ar/nvidia/nemotron-3.5-lightning-30b-a3b',
    supportsVision: false,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-nemotron-3.5-bolt-e4b',
    name: 'Nemotron 3.5 Bolt E4B',
    description: 'NVIDIA Instant Sub-Second Flash (Free)',
    geminiModel: 'ar/nvidia/nemotron-3.5-bolt-e4b',
    supportsVision: false,
    contextLength: '64K',
    category: 'anyrouter',
  },
  {
    id: 'ar-nemotron-3-ultra-550b',
    name: 'Nemotron 3 Ultra 550B',
    description: 'NVIDIA 550B A55B Frontier MoE (Free)',
    geminiModel: 'ar/nvidia/nemotron-3-ultra-550b-a55b',
    supportsVision: false,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-nemotron-3.5-content-safety',
    name: 'Nemotron 3.5 Content Safety VL',
    description: 'NVIDIA Vision & Guardrail Analysis (Free)',
    geminiModel: 'ar/nvidia/nemotron-3.5-content-safety',
    supportsVision: true,
    contextLength: '128K',
    category: 'anyrouter',
  },
  {
    id: 'ar-nemotron-parse-2.0',
    name: 'Nemotron Parse 2.0',
    description: 'NVIDIA Document & Vision Parser (Free)',
    geminiModel: 'ar/nvidia/nemotron-parse-2.0',
    supportsVision: true,
    contextLength: '8K',
    category: 'anyrouter',
  },
  {
    id: 'ar-riva-translate-4b-v2',
    name: 'Riva Translate 4B v2',
    description: 'NVIDIA Fast Neural Translation (Free)',
    geminiModel: 'ar/nvidia/riva-translate-4b-instruct-v2',
    supportsVision: false,
    contextLength: '4K',
    category: 'anyrouter',
  },
  {
    id: 'ar-minimax-m3.1-flash',
    name: 'MiniMax M3.1 Flash',
    description: '1M Context Multimodal & Coding (Free)',
    geminiModel: 'ar/minimax/minimax-m3.1-flash',
    supportsVision: true,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-longcat-2.5-preview',
    name: 'LongCat 2.5 Preview',
    description: 'Meituan 1M Vision & Code Synthesis (Free)',
    geminiModel: 'ar/meituan/longcat-2.5-preview',
    supportsVision: true,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-meta-muse-glimmer-30b',
    name: 'Meta Muse Glimmer 30B',
    description: 'Meta Multimodal Vision & Code (Free)',
    geminiModel: 'ar/meta/muse-glimmer-30b',
    supportsVision: true,
    contextLength: '128K',
    category: 'anyrouter',
  },
  {
    id: 'ar-cohere-north-mini-code',
    name: 'Cohere North Mini Code',
    description: 'Cohere Specialized Code & Reasoning (Free)',
    geminiModel: 'ar/cohere/north-mini-code',
    supportsVision: false,
    contextLength: '256K',
    category: 'anyrouter',
  },
  {
    id: 'ar-dots-3-note-preview',
    name: 'Dots 3 Note Preview',
    description: 'Dots Studio Multimodal Research (Free)',
    geminiModel: 'ar/dots-studio/dots-3-note-preview',
    supportsVision: true,
    contextLength: '512K',
    category: 'anyrouter',
  },
  {
    id: 'ar-liquid-lfm-2.5-2.6b',
    name: 'Liquid LFM 2.5 2.6B',
    description: 'Liquid AI Fast Foundation Model (Free)',
    geminiModel: 'ar/liquid/lfm-2.5-2.6b',
    supportsVision: false,
    contextLength: '128K',
    category: 'anyrouter',
  },
  {
    id: 'ar-liquid-d1',
    name: 'Liquid d1',
    description: 'Liquid AI Reasoning Architecture (Free)',
    geminiModel: 'ar/liquid/d1',
    supportsVision: false,
    contextLength: '32K',
    category: 'anyrouter',
  },
  {
    id: 'ar-openai-gpt-oss-20b',
    name: 'GPT-OSS 20B',
    description: 'OpenAI Open-Weights Code & Chat (Free)',
    geminiModel: 'ar/openai/gpt-oss-20b',
    supportsVision: false,
    contextLength: '128K',
    category: 'anyrouter',
  },
  {
    id: 'ar-poolside-laguna-s-2.1',
    name: 'Poolside Laguna S 2.1',
    description: 'Poolside 1M Software Engineering (Free)',
    geminiModel: 'ar/poolside/laguna-s-2.1',
    supportsVision: false,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-poolside-laguna-xs-2.1',
    name: 'Poolside Laguna XS 2.1',
    description: 'Poolside Fast Code Synthesis (Free)',
    geminiModel: 'ar/poolside/laguna-xs-2.1',
    supportsVision: false,
    contextLength: '256K',
    category: 'anyrouter',
  },
  {
    id: 'ar-recursive-flint-v1',
    name: 'Recursive Flint v1.0',
    description: 'Recursive Code & Analytical Engine (Free)',
    geminiModel: 'ar/recursive/flint-v1.0',
    supportsVision: false,
    contextLength: '256K',
    category: 'anyrouter',
  },
  {
    id: 'ar-reflection-beam-1.0',
    name: 'Reflection Beam 1.0',
    description: 'Reflection AI 1M Code & Synthesis (Free)',
    geminiModel: 'ar/reflection/beam-1.0',
    supportsVision: false,
    contextLength: '1M',
    category: 'anyrouter',
  },
  {
    id: 'ar-stealth-glyph-cluster',
    name: 'Stealth Glyph Cluster',
    description: 'Stealth Cluster Reasoning Model (Free)',
    geminiModel: 'ar/stealth/glyph-cluster',
    supportsVision: false,
    contextLength: '256K',
    category: 'anyrouter',
  },
  {
    id: 'ar-apple-foundation-model',
    name: 'Apple Foundation Model',
    description: 'Apple Compact Intelligence (Free)',
    geminiModel: 'ar/apple/foundation-model',
    supportsVision: false,
    contextLength: '4K',
    category: 'anyrouter',
  },
  {
    id: 'ar-glm-4.5-flash',
    name: 'GLM 4.5 Flash (AnyRouter)',
    description: 'Zhipu Fast Flash Intelligence (Free)',
    geminiModel: 'ar/z-ai/glm-4.5-flash',
    supportsVision: false,
    contextLength: '128K',
    category: 'anyrouter',
  },
  {
    id: 'ar-glm-flash-latest',
    name: 'GLM Flash Latest (AnyRouter)',
    description: 'Zhipu Latest High-Speed Flash (Free)',
    geminiModel: 'ar/z-ai/glm-flash-latest',
    supportsVision: false,
    contextLength: '128K',
    category: 'anyrouter',
  },
  {
    id: 'ar-pareto-code-router',
    name: 'Pareto Code Router (2M)',
    description: '2M Context Code Router (Free)',
    geminiModel: 'ar/openrouter/pareto-code',
    supportsVision: true,
    contextLength: '2M',
    category: 'anyrouter',
  },
  {
    id: 'ar-bodybuilder-router',
    name: 'BodyBuilder Agent Router',
    description: 'Structured Output & Tool Router (Free)',
    geminiModel: 'ar/openrouter/bodybuilder',
    supportsVision: false,
    contextLength: '128K',
    category: 'anyrouter',
  },
  {
    id: 'ar-inception-mercury-decide',
    name: 'Inception Mercury Decide',
    description: 'Diffusion LLM Ultra-Fast Generation (Free)',
    geminiModel: 'ar/inception/mercury-decide',
    supportsVision: false,
    contextLength: '32K',
    category: 'anyrouter',
  },
];

export function getDefaultVisionModel(): ModelOption {
  return GROK_MODELS.find((m) => m.supportsVision) || GROK_MODELS[0];
}

interface GrokModelPickerProps {
  selectedModelId: string;
  onSelectModel: (model: ModelOption) => void;
  isEmpty?: boolean;
  isDark?: boolean;
  dropdownDirection?: 'down' | 'up';
  variant?: 'header' | 'pill';
}

export const GrokModelPicker: React.FC<GrokModelPickerProps> = ({
  selectedModelId,
  onSelectModel,
  isDark = true,
  dropdownDirection = 'down',
  variant = 'header',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = GROK_MODELS.find((m) => m.id === selectedModelId) || GROK_MODELS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerClasses =
    variant === 'header'
      ? `flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-2xl transition-all cursor-pointer font-medium text-xs select-none ${
          isDark
            ? 'bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.15] text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
            : 'bg-white/70 hover:bg-white/90 border-black/[0.08] text-black shadow-[0_8px_32px_rgba(0,0,0,0.08)]'
        }`
      : `flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors cursor-pointer ${
          isDark ? 'text-white/80 hover:text-white' : 'text-black/75 hover:text-black'
        }`;

  const dropdownPositionClasses =
    dropdownDirection === 'down'
      ? 'top-full left-1/2 -translate-x-1/2 mt-2'
      : 'bottom-full right-0 mb-3';

  return (
    <div className="relative" ref={containerRef}>
      {/* Dynamic Island Header Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${triggerClasses} max-w-[60vw] sm:max-w-[320px]`}
        title={current.name}
      >
        <span className="font-semibold text-[12px] tracking-tight truncate">{current.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          } opacity-60`}
        />
      </button>

      {/* Downward opening Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute ${dropdownPositionClasses} w-72 max-w-[calc(100vw-1.5rem)] max-h-[min(460px,68dvh)] overflow-y-auto scrollbar-thin rounded-2xl border p-2 z-50 text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? 'bg-[#141414]/98 border-[#2e2e2e] text-white shadow-[0_20px_60px_rgba(0,0,0,0.95)]'
              : 'bg-[#ffffff]/98 border-[#dcdcdc] text-[#0d0d0d] shadow-[0_20px_60px_rgba(0,0,0,0.18)]'
          }`}
        >
          <div className="space-y-0.5">
            {GROK_MODELS.map((m) => {
              const isSelected = m.id === current.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelectModel(m);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-white/10 text-white font-medium'
                        : 'bg-black/5 text-[#0d0d0d] font-medium'
                      : isDark
                      ? 'hover:bg-white/[0.05] text-white/80'
                      : 'hover:bg-black/[0.04] text-black/80'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs truncate">{m.name}</span>
                      {m.contextLength && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${
                            isDark
                              ? 'bg-white/[0.08] text-white/60'
                              : 'bg-black/[0.06] text-black/60'
                          }`}
                        >
                          {m.contextLength}
                        </span>
                      )}
                      {m.supportsVision && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${
                            isDark
                              ? 'bg-emerald-500/10 text-emerald-400/90'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          Vision
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 truncate ${
                        isDark ? 'text-white/50' : 'text-black/50'
                      }`}
                    >
                      {m.description}
                    </div>
                  </div>
                  {isSelected && (
                    <Check
                      className={`w-4 h-4 flex-shrink-0 ${
                        isDark ? 'text-white' : 'text-black'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
