import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { UserAccountStore } from '../lib/userAccountStore';
import { getModelGradientTheme } from '../lib/modelGradients';

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
    id: 'zro-deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    description: '1M zero-latency (Default · Free)',
    geminiModel: 'zro/deepseek-v4.1-flash',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'free',
  },
  {
    id: 'zro-glm-5.3-flash',
    name: 'GLM 5.3 Flash (1M)',
    description: 'Fast reasoning & vision (Free Vision)',
    geminiModel: 'zro/glm-5.3-flash',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'free',
  },
  {
    id: 'fgw-uncensored-free',
    name: 'Uncensored Pro',
    description: 'Unfiltered reasoning & chat (Free)',
    geminiModel: 'fgw/uncensored:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'free',
  },
  {
    id: 'fgw-limitless-free',
    name: 'Limitless Pro',
    description: 'Unrestricted deep reasoning',
    geminiModel: 'fgw/limitless:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-code-limitless-free',
    name: 'Code Limitless',
    description: 'Unrestricted code synthesis',
    geminiModel: 'fgw/code-limitless:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-deepseek-v4.1-flash-uncensored-free',
    name: 'DeepSeek V4.1 Uncensored',
    description: 'Unfiltered fast reasoning',
    geminiModel: 'fgw/deepseek-v4.1-flash-uncensored:free',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-deepseek-v4-flash-uncensored-free',
    name: 'DeepSeek V4 Uncensored',
    description: 'Unfiltered analytical logic',
    geminiModel: 'fgw/deepseek-v4-flash-uncensored:free',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-qwen3.8-27b-uncensored-free',
    name: 'Qwen 3.8 27B Uncensored',
    description: 'Unfiltered 27B instruction',
    geminiModel: 'fgw/qwen3.8-27b-uncensored:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-deepseek-v4.1-flash-free',
    name: 'DeepSeek V4.1 Flash+',
    description: 'High-speed reasoning',
    geminiModel: 'fgw/deepseek-v4.1-flash:free',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-deepseek-v4-flash-free',
    name: 'DeepSeek V4 Flash+',
    description: 'Fast analytical logic',
    geminiModel: 'fgw/deepseek-v4-flash:free',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-deepseek-v4-flash-0731-free',
    name: 'DeepSeek V4 0731+',
    description: 'Coding & math logic',
    geminiModel: 'fgw/deepseek-v4-flash-0731:free',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-deepseek-v4-flash-0731-thinking-free',
    name: 'DeepSeek V4 Thinking',
    description: 'Step-by-step chain of thought',
    geminiModel: 'fgw/deepseek-v4-flash-0731-thinking:free',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-gemini-3.8-flash-free',
    name: 'Gemini 3.8 Flash',
    description: 'Fast multimodal reasoning',
    geminiModel: 'fgw/gemini-3.8-flash:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-gemini-3.7-flash-free',
    name: 'Gemini 3.7 Flash+',
    description: 'Low-latency multimodal',
    geminiModel: 'fgw/gemini-3.7-flash:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-gemini-3.5-flash-free',
    name: 'Gemini 3.5 Flash',
    description: 'Balanced multimodal flash',
    geminiModel: 'fgw/gemini-3.5-flash:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-gemini-3.1-pro-free',
    name: 'Gemini 3.1 Pro+',
    description: 'Deep pro reasoning',
    geminiModel: 'fgw/gemini-3.1-pro:free',
    supportsVision: true,
    contextLength: '2M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-gemini-3-pro-free',
    name: 'Gemini 3 Pro',
    description: 'Frontier multimodal pro',
    geminiModel: 'fgw/gemini-3-pro:free',
    supportsVision: true,
    contextLength: '2M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-gemini-3-flash-free',
    name: 'Gemini 3 Flash',
    description: 'High-speed multimodal',
    geminiModel: 'fgw/gemini-3-flash:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-gemini-2.5-pro-free',
    name: 'Gemini 2.5 Pro',
    description: 'Analytical pro reasoning',
    geminiModel: 'fgw/gemini-2.5-pro:free',
    supportsVision: true,
    contextLength: '2M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-gemini-2.0-flash-free',
    name: 'Gemini 2.0 Flash',
    description: 'Fast everyday multimodal',
    geminiModel: 'fgw/gemini-2.0-flash:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-gemma-4-31b-it-free',
    name: 'Gemma 4 31B',
    description: 'Open-weights instruction',
    geminiModel: 'fgw/gemma-4-31b-it:free',
    supportsVision: true,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-grok-4.7-free',
    name: 'Grok 4.7 Pro',
    description: 'Real-time frontier synthesis',
    geminiModel: 'fgw/grok-4.7:free',
    supportsVision: true,
    contextLength: '500K',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-grok-4.7-fast-free',
    name: 'Grok 4.7 Fast',
    description: 'Low-latency synthesis',
    geminiModel: 'fgw/grok-4.7-fast:free',
    supportsVision: true,
    contextLength: '500K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-gpt-5.6-sol-free',
    name: 'GPT-5.6 Sol+',
    description: 'High-speed frontier logic',
    geminiModel: 'fgw/gpt-5.6-sol:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-o3-free',
    name: 'o3 Reasoning',
    description: 'Deep STEM & math logic',
    geminiModel: 'fgw/o3:free',
    supportsVision: true,
    contextLength: '200K',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-o4-mini-free',
    name: 'o4-mini',
    description: 'Fast STEM & code reasoning',
    geminiModel: 'fgw/o4-mini:free',
    supportsVision: true,
    contextLength: '200K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-gpt-4.1-mini-free',
    name: 'GPT-4.1 Mini',
    description: 'Fast instruction & coding',
    geminiModel: 'fgw/gpt-4.1-mini:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-gpt-4o-free',
    name: 'GPT-4o',
    description: 'Omni multimodal intelligence',
    geminiModel: 'fgw/gpt-4o:free',
    supportsVision: true,
    contextLength: '128K',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-gpt-4o-mini-free',
    name: 'GPT-4o Mini',
    description: 'Lightweight omni speed',
    geminiModel: 'fgw/gpt-4o-mini:free',
    supportsVision: true,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-gpt-oss-20b-free',
    name: 'GPT-OSS 20B+',
    description: 'Open-weights reasoning',
    geminiModel: 'fgw/openai/gpt-oss-20b:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-gpt-oss-safeguard-20b-free',
    name: 'GPT-OSS Safeguard 20B',
    description: 'Aligned 20B synthesis',
    geminiModel: 'fgw/openai/gpt-oss-safeguard-20b:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-qwen-3.8-max-free',
    name: 'Qwen 3.8 Max+',
    description: 'Flagship coding & math',
    geminiModel: 'fgw/qwen-3.8-max:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-qwen-3.8-27b-free',
    name: 'Qwen 3.8 27B+',
    description: 'Dense 27B reasoning',
    geminiModel: 'fgw/qwen-3.8-27b:free',
    supportsVision: true,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-qwen3-8-omni-flash-free',
    name: 'Qwen 3.8 Omni Flash',
    description: 'Multimodal omni flash',
    geminiModel: 'fgw/qwen3-8-omni-flash:free',
    supportsVision: true,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-qwen-3.6-plus-free',
    name: 'Qwen 3.6 Plus',
    description: 'Balanced coding & analysis',
    geminiModel: 'fgw/qwen-3.6-plus:free',
    supportsVision: true,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-qwen-3.6-27b-free',
    name: 'Qwen 3.6 27B',
    description: 'Fast 27B synthesis',
    geminiModel: 'fgw/qwen-3.6-27b:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-qwen-3.5-397b-a17b-free',
    name: 'Qwen 3.5 397B MoE',
    description: '397B sparse MoE reasoning',
    geminiModel: 'fgw/qwen-3.5-397b-a17b:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-glm-5.3-flash-free',
    name: 'GLM 5.3 Flash+',
    description: 'Fast reasoning & synthesis',
    geminiModel: 'fgw/glm-5.3-flash:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-caw-glm-5.3-flash-free',
    name: 'GLM 5.3 Flash Turbo',
    description: 'High-throughput flash',
    geminiModel: 'fgw/caw/glm-5.3-flash:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-caw-glm-5.3-flash-thinking-free',
    name: 'GLM 5.3 Thinking',
    description: 'Reflective chain of thought',
    geminiModel: 'fgw/caw/glm-5.3-flash-thinking:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-glm-4.7-flash-free',
    name: 'GLM 4.7 Flash',
    description: 'Low-latency reasoning',
    geminiModel: 'fgw/glm-4.7-flash:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-glm-4.6v-flash-free',
    name: 'GLM 4.6V Flash',
    description: 'Multimodal visual analysis',
    geminiModel: 'fgw/glm-4.6v-flash:free',
    supportsVision: true,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-llama-3.3-70b-instruct-free',
    name: 'Llama 3.3 70B Instruct',
    description: 'Open-weights 70B chat',
    geminiModel: 'fgw/llama-3.3-70b-instruct:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-llama-3.3-70b-free',
    name: 'Llama 3.3 70B',
    description: '70B foundation model',
    geminiModel: 'fgw/llama-3.3-70b:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-mistral-medium-3.5-free',
    name: 'Mistral Medium 3.5',
    description: 'Multilingual logic & code',
    geminiModel: 'fgw/mistral-medium-3.5:free',
    supportsVision: true,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-nvidia-mistral-large-4-1t-free',
    name: 'Mistral Large 4 1T',
    description: '1T sparse MoE frontier',
    geminiModel: 'fgw/nvidia/mistral-large-4-1t-a52b:free',
    supportsVision: true,
    contextLength: '512K',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-nemotron-3-ultra-550b-free',
    name: 'Nemotron 3 Ultra 550B',
    description: '550B MoE analytical',
    geminiModel: 'fgw/nemotron-3-ultra-550b-a55b:free',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-nvidia-nemotron-3-ultra-550b-free',
    name: 'Nemotron 3 Ultra (Fast)',
    description: 'High-throughput 550B MoE',
    geminiModel: 'fgw/nvidia/nemotron-3-ultra-550b-a55b:free',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-nemotron-3.5-super-vl-free',
    name: 'Nemotron 3.5 Super VL',
    description: 'Vision-language reasoning',
    geminiModel: 'fgw/nemotron-3.5-super-vl:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-nvidia-nemotron-3.5-super-vl-120b-free',
    name: 'Nemotron 3.5 VL 120B',
    description: '120B multimodal MoE',
    geminiModel: 'fgw/nvidia/nemotron-3.5-super-vl-120b-a12b:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-nvidia-nemotron-3.5-bolt-e4b-free',
    name: 'Nemotron 3.5 Bolt',
    description: 'Ultra-fast compact flash',
    geminiModel: 'fgw/nvidia/nemotron-3.5-bolt-e4b:free',
    supportsVision: false,
    contextLength: '64K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-minimax-m3.1-flash-free',
    name: 'MiniMax M3.1 Flash',
    description: 'Long-context fast synthesis',
    geminiModel: 'fgw/minimax-m3.1-flash:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-nvidia-minimax-m3.1-flash-free',
    name: 'MiniMax M3.1 Turbo',
    description: 'High-speed 1M flash',
    geminiModel: 'fgw/nvidia/minimax-m3.1-flash:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-minimax-m2.5-free',
    name: 'MiniMax M2.5',
    description: 'Balanced long-context chat',
    geminiModel: 'fgw/minimax-m2.5:free',
    supportsVision: false,
    contextLength: '512K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-agnes-3.0-flash-free',
    name: 'Agnes 3.0 Flash',
    description: 'Fast structured synthesis',
    geminiModel: 'fgw/agnes-3.0-flash:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-agnes-2.5-flash-free',
    name: 'Agnes 2.5 Flash',
    description: 'Lightweight fast chat',
    geminiModel: 'fgw/agnes-2.5-flash:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-ernie-5.5-flash-preview-free',
    name: 'Ernie 5.5 Flash',
    description: 'Knowledge-enhanced flash',
    geminiModel: 'fgw/ernie-5.5-flash-preview:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-laguna-s-2.1-free',
    name: 'Laguna S 2.1+',
    description: 'Software engineering & code',
    geminiModel: 'fgw/laguna-s-2.1:free',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-laguna-xs-2.1-free',
    name: 'Laguna XS 2.1+',
    description: 'Fast code completion',
    geminiModel: 'fgw/laguna-xs-2.1:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-nvidia-laguna-xs-2.1-free',
    name: 'Laguna XS 2.1 Turbo',
    description: 'Accelerated code generation',
    geminiModel: 'fgw/nvidia/laguna-xs-2.1:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-muse-spark-1.1-free',
    name: 'Muse Spark 1.1+',
    description: 'Creative writing & ideation',
    geminiModel: 'fgw/muse-spark-1.1:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-mimo-v2.6-flash-free',
    name: 'MiMo V2.6 Flash+',
    description: 'Fast mathematical reasoning',
    geminiModel: 'fgw/mimo-v2.6-flash:free',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-k2-horizon-375b-free',
    name: 'K2 Horizon 375B',
    description: '375B MoE deep synthesis',
    geminiModel: 'fgw/k2-horizon-375b-a23b:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-jais-3-mova-36b-free',
    name: 'Jais 3 Mova 36B',
    description: 'Multilingual MoE reasoning',
    geminiModel: 'fgw/jais-3-mova-36b-a4b:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-xing4.0-29b-free',
    name: 'Xing 4.0 29B',
    description: 'Efficient MoE logic',
    geminiModel: 'fgw/xing4.0-29b-a4b:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-longcat-2.5-free',
    name: 'LongCat 2.5+',
    description: 'Long-context reasoning',
    geminiModel: 'fgw/longcat-2.5:free',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-dots-3-note-preview-free',
    name: 'Dots 3 Note+',
    description: 'Research & note synthesis',
    geminiModel: 'fgw/dots-3-note-preview:free',
    supportsVision: true,
    contextLength: '512K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-flint-v1.0-free',
    name: 'Flint v1.0+',
    description: 'Code & analytical logic',
    geminiModel: 'fgw/flint-v1.0:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-crouton-alpha-free',
    name: 'Crouton Alpha',
    description: 'Experimental fast reasoning',
    geminiModel: 'fgw/crouton-alpha:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-liquid-lfm-2.5-2.6b-free',
    name: 'LFM 2.5 2.6B+',
    description: 'Liquid foundation speed',
    geminiModel: 'fgw/liquid/lfm-2.5-2.6b:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-liquid-lfm-2.5-thinking-free',
    name: 'LFM 2.5 Thinking',
    description: 'Compact chain of thought',
    geminiModel: 'fgw/liquid/lfm-2.5-2.6b-thinking:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-minicpm-v-4.7-35b-free',
    name: 'MiniCPM-V 4.7 35B',
    description: '35B vision-language MoE',
    geminiModel: 'fgw/openbmb/MiniCPM-V-4.7-35B-A3B:free',
    supportsVision: true,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-minicpm-v-4.7-35b-thinking-free',
    name: 'MiniCPM-V 4.7 Thinking',
    description: 'Multimodal visual thinking',
    geminiModel: 'fgw/openbmb/MiniCPM-V-4.7-35B-A3B-thinking:free',
    supportsVision: true,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-minicpm-v-4.7-1b-free',
    name: 'MiniCPM-V 4.7 1B',
    description: 'Ultra-light vision model',
    geminiModel: 'fgw/MiniCPM-V-4.7-1B:free',
    supportsVision: true,
    contextLength: '64K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-minicpm5-2b-free',
    name: 'MiniCPM 5 2B',
    description: 'Compact edge instruction',
    geminiModel: 'fgw/MiniCPM5-2B:free',
    supportsVision: false,
    contextLength: '64K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-hy4-free',
    name: 'Hunyuan 4',
    description: 'Flagship reasoning & synthesis',
    geminiModel: 'fgw/hy4:free',
    supportsVision: false,
    contextLength: '256K',
    requiredTier: 'fire',
  },
  {
    id: 'fgw-hy3-free',
    name: 'Hunyuan 3',
    description: 'Fast conversational logic',
    geminiModel: 'fgw/hy3:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'fgw-solar-mini4-free',
    name: 'Solar Mini 4',
    description: 'Compact high-efficiency pro',
    geminiModel: 'fgw/solar-mini4:free',
    supportsVision: false,
    contextLength: '128K',
    requiredTier: 'spark',
  },
  {
    id: 'zro-deepseek-v4-flash-0731',
    name: 'DeepSeek V4 (0731)',
    description: 'Coding & math ($3 Spark)',
    geminiModel: 'zro/deepseek-v4-flash-0731',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'deepseek-v4.1-flash-free',
    name: 'DeepSeek V4.1',
    description: 'Instant reasoning ($3 Spark)',
    geminiModel: 'zro/deepseek-v4.1-flash',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'itera-qwen3.8-27b-free',
    name: 'Qwen 3.8 27B',
    description: 'Fast reply & vision ($3 Spark)',
    geminiModel: 'itera/qwen/qwen3.8-27b',
    supportsVision: true,
    contextLength: '256K',
    requiredTier: 'spark',
  },
  {
    id: 'deepseek-v4-flash-0731-free',
    name: 'DeepSeek V4 Flash',
    description: 'Analytical reasoning ($3 Spark)',
    geminiModel: 'zro/deepseek-v4-flash-0731',
    supportsVision: false,
    contextLength: '1M',
    requiredTier: 'spark',
  },
  {
    id: 'glm-5.3-flash-free',
    name: 'GLM 5.3 Flash',
    description: 'Low-latency vision ($3 Spark)',
    geminiModel: 'zro/glm-5.3-flash',
    supportsVision: true,
    contextLength: '1M',
    requiredTier: 'spark',
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
    name: 'Unified Router',
    description: 'Smart routing engine',
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

const FIRE_MODEL_IDS = new Set([
  'thk-gpt-6.1-sol-fast',
  'thk-gpt-6-astra-fast',
  'thk-claude-opus-5.5',
  'thk-grok-4.7',
  'thk-gemini-4-argon',
  'larp-gpt-6',
  'radox-claude-opus-5.5',
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
  'fgw-limitless-free',
  'fgw-code-limitless-free',
  'fgw-deepseek-v4.1-flash-uncensored-free',
  'fgw-deepseek-v4-flash-uncensored-free',
  'fgw-qwen3.8-27b-uncensored-free',
  'fgw-deepseek-v4-flash-0731-thinking-free',
  'fgw-gemini-3.1-pro-free',
  'fgw-gemini-3-pro-free',
  'fgw-gemini-2.5-pro-free',
  'fgw-grok-4.7-free',
  'fgw-gpt-5.6-sol-free',
  'fgw-o3-free',
  'fgw-gpt-4o-free',
  'fgw-qwen-3.8-max-free',
  'fgw-qwen-3.5-397b-a17b-free',
  'fgw-caw-glm-5.3-flash-thinking-free',
  'fgw-nvidia-mistral-large-4-1t-free',
  'fgw-nemotron-3-ultra-550b-free',
  'fgw-nvidia-nemotron-3-ultra-550b-free',
  'fgw-nemotron-3.5-super-vl-free',
  'fgw-nvidia-nemotron-3.5-super-vl-120b-free',
  'fgw-laguna-s-2.1-free',
  'fgw-k2-horizon-375b-free',
  'fgw-hy4-free',
]);

export const FREE_MODEL_IDS = new Set<string>([
  'zro-deepseek-v4.1-flash',
  'zro-glm-5.3-flash',
  'fgw-uncensored-free',
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
  onOpenPricing?: (highlightPlan?: 'spark' | 'fire', reason?: string) => void;
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
  const [, setCurrentPlan] = useState<'free' | 'spark' | 'fire'>(() =>
    UserAccountStore.getNormalizedPlan()
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const current = GROK_MODELS.find((m) => m.id === selectedModelId) || GROK_MODELS[0];
  const currentTheme = getModelGradientTheme(current.id);

  useEffect(() => {
    const syncPlan = () => setCurrentPlan(UserAccountStore.getNormalizedPlan());
    window.addEventListener('kinich-account-updated', syncPlan);
    return () => window.removeEventListener('kinich-account-updated', syncPlan);
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
    return true;
  });

  const triggerPricingPopup = (tier: 'free' | 'spark' | 'fire', modelName: string) => {
    if (tier === 'free') return;
    const planLabel = tier === 'spark' ? 'Spark ($3/mo)' : 'Fire ($7/mo)';
    const reason = `${modelName} requires the ${planLabel} plan. Upgrade now to unlock it.`;
    if (onOpenPricing) {
      onOpenPricing(tier, reason);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('kinich-open-pricing', {
          detail: { highlightPlan: tier, reason },
        })
      );
    }
  };

  const triggerClasses =
    variant === 'header'
      ? `flex items-center gap-1.5 h-7.5 sm:h-8 px-2.5 sm:px-3 rounded-full border backdrop-blur-xl transition-all cursor-pointer font-medium text-xs sm:text-[13px] select-none ${
          isDark
            ? 'bg-neutral-900/60 hover:bg-neutral-800/75 border-white/[0.12] text-white shadow-xs'
            : 'bg-white/80 hover:bg-white border-black/[0.1] text-zinc-900 shadow-xs'
        }`
      : `flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer ${
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
        className={`${triggerClasses} max-w-[150px] sm:max-w-[200px]`}
        title={current.name}
      >
        <span className="font-medium text-xs sm:text-[13px] tracking-tight truncate">{current.name}</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          } opacity-70`}
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
          {/* Tier Filter */}
          <div className="pb-1.5 mb-1 border-b border-black/10 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-0.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'free', label: 'Free' },
                  { id: 'spark', label: 'Spark ($3)' },
                  { id: 'fire', label: 'Fire ($7)' },
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
          <div className="space-y-0.5 overflow-y-auto slim-scrollbar pr-0.5">
            {filteredModels.length === 0 ? (
              <div className="py-4 text-center text-[10px] opacity-50">No models found</div>
            ) : (
              filteredModels.map((m) => {
                const isSelected = m.id === current.id;
                const reqTier = getModelRequiredTier(m);
                const isLocked = !UserAccountStore.canUseModel(reqTier);

                const itemTheme = getModelGradientTheme(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        setIsOpen(false);
                        triggerPricingPopup(reqTier, m.name);
                        return;
                      }
                      UserAccountStore.recordModelExplored(m.id);
                      onSelectModel(m);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer group ${
                      isSelected
                        ? isDark
                          ? 'bg-white/10 text-white'
                          : 'bg-black/5 text-[#0d0d0d]'
                        : isDark
                        ? 'hover:bg-white/[0.05] text-white/85'
                        : 'hover:bg-black/[0.04] text-black/85'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
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
                    </div>

                    <div className="shrink-0 flex items-center">
                      {isSelected ? (
                        <Check
                          className={`w-3 h-3 ${isDark ? 'text-white' : 'text-black'}`}
                        />
                      ) : (
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            reqTier === 'free'
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                              : reqTier === 'fire'
                              ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20'
                              : 'text-sky-400 bg-sky-500/10 border border-sky-500/20'
                          }`}
                        >
                          {reqTier === 'free' ? 'Free' : reqTier === 'fire' ? '$7' : '$3'}
                        </span>
                      )}
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

