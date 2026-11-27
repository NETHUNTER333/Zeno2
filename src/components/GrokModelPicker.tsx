import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Lock } from 'lucide-react';
import { UserAccountStore } from '../lib/userAccountStore';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  geminiModel: string;
  supportsVision: boolean;
  contextLength?: string;
  requiredTier?: 'free' | 'spark' | 'fire';
  unlimited?: boolean;
}

// Ponytail compact model table: [id, name, description, geminiModel, vision(1|0), ctx, tier('free'|'spark'|'fire'), unlimited?]
type ModelTuple = [string, string, string, string, 0 | 1, string, 'free' | 'spark' | 'fire', 1?];

const MODEL_SPECS: ModelTuple[] = [
  ['fgw-qwen3-8-omni-flash-free', 'Qwen 3.8 Omni Flash', 'Fast Multimodal Omni · Unlimited', 'fgw/qwen3-8-omni-flash:free', 1, '256K', 'free', 1],
  ['zro-deepseek-v4.1-flash', 'DeepSeek V4.1 Flash', 'Zero-Latency Reasoning & Chat', 'zro/deepseek-v4.1-flash', 0, '1M', 'free'],
  ['zro-glm-5.3-flash', 'GLM 5.3 Flash', 'Fast Reasoning & Vision', 'zro/glm-5.3-flash', 1, '1M', 'free'],
  ['claude-sonnet-4.6', 'Claude 4.6 Sonnet', 'Advanced Coding & Nuanced Writing', 'thk/claude-sonnet-4.6', 1, '1M', 'spark'],
  ['flm-auto', 'FLM Auto', 'Adaptive Smart Model Router', 'flm/auto', 0, 'Auto', 'spark'],
  ['agents-a1', 'Agents-A1', 'Scientific Reasoning & Multimodal', 'intern/Agents-A1', 1, '256K', 'spark'],
  ['atria-dawn', 'Atria-Dawn', 'Deep Scientific Reasoning', 'intern/Atria-Dawn', 0, '512K', 'spark'],
  ['atria-dawn-preview', 'Atria-Dawn Preview', 'Frontier Scientific Reasoning', 'intern/Atria-Dawn-Preview', 0, '512K', 'spark'],
  ['deepseek-v4-flash-vision', 'DeepSeek V4 Flash Vision', 'Multimodal In-Depth Thinking', 'intern/deepseek-v4-flash-vision', 1, '1M', 'spark'],
  ['deepseek-v4-pro-0813', 'DeepSeek V4 Pro', 'Tool Usage & In-Depth Thinking', 'intern/deepseek-v4-pro-0813', 0, '1M', 'spark'],
  ['intern-decision-4b', 'Scholar Decision 4B', 'Structured Decision & Policy Engine', 'intern/intern-decision-4b', 0, '8K', 'spark'],
  ['intern-s2', 'Scholar-S2', 'Scientific Research & Multimodal', 'intern/intern-s2', 1, '256K', 'spark'],
  ['fgw-qwen-3.8-vl-72b-vision', 'Qwen 3.8 VL 72B Vision', 'High-Res Visual & OCR Analysis', 'fgw/qwen-3.8-max:free', 1, '1M', 'spark'],
  ['fgw-pixtral-large-2-vision', 'Pixtral Large 2 Vision', 'Frontier Multimodal Vision', 'fgw/nvidia/mistral-large-4-1t-a52b:free', 1, '512K', 'fire'],
  ['fgw-llama-4-maverick-vision', 'Llama 4 Maverick Vision', 'Native Multimodal MoE Vision', 'fgw/nemotron-3.5-super-vl:free', 1, '1M', 'spark'],
  ['radox-gpt-6-omni-vision', 'GPT-6 Omni Vision', 'Deep Visual & Diagram Reasoning', 'radox/gpt-5.6-luna', 1, '1M', 'fire'],
  ['itera-gemini-4-ultra-vision', 'Gemini 4 Ultra Vision', 'Long-Context Multimodal Vision', 'itera/gemini/gemini-4-argon', 1, '2M', 'fire'],
  ['intern-internvl-3.5-78b-vision', 'InternVL 3.5 78B Vision', 'Scientific & Document Vision', 'intern/deepseek-v4-flash-vision', 1, '1M', 'spark'],
  ['fgw-glm-5.3v-pro-vision', 'GLM 5.3V Pro Vision', 'Fast Visual Reasoning & UI', 'fgw/glm-5.3-flash:free', 1, '1M', 'spark'],
  ['fgw-deepseek-v4.1-flash-free', 'DeepSeek V4.1 Flash+', 'High-Speed Reasoning', 'fgw/deepseek-v4.1-flash:free', 0, '1M', 'spark'],
  ['fgw-deepseek-v4-flash-free', 'DeepSeek V4 Flash+', 'Fast Analytical Logic', 'fgw/deepseek-v4-flash:free', 0, '1M', 'spark'],
  ['fgw-deepseek-v4-flash-0731-free', 'DeepSeek V4 0731+', 'Coding & Math Logic', 'fgw/deepseek-v4-flash-0731:free', 0, '1M', 'spark'],
  ['fgw-deepseek-v4-flash-0731-thinking-free', 'DeepSeek V4 Thinking', 'Step-by-Step Chain of Thought', 'fgw/deepseek-v4-flash-0731-thinking:free', 0, '1M', 'fire'],
  ['fgw-gemini-3.8-flash-free', 'Gemini 3.8 Flash', 'Fast Multimodal Reasoning', 'fgw/gemini-3.8-flash:free', 1, '1M', 'spark'],
  ['fgw-gemini-3.7-flash-free', 'Gemini 3.7 Flash+', 'Low-Latency Multimodal', 'fgw/gemini-3.7-flash:free', 1, '1M', 'spark'],
  ['fgw-gemini-3.5-flash-free', 'Gemini 3.5 Flash', 'Balanced Multimodal Flash', 'fgw/gemini-3.5-flash:free', 1, '1M', 'spark'],
  ['fgw-gemini-3.1-pro-free', 'Gemini 3.1 Pro+', 'Deep Pro Reasoning', 'fgw/gemini-3.1-pro:free', 1, '2M', 'fire'],
  ['fgw-gemini-3-pro-free', 'Gemini 3 Pro', 'Frontier Multimodal Pro', 'fgw/gemini-3-pro:free', 1, '2M', 'fire'],
  ['fgw-gemini-3-flash-free', 'Gemini 3 Flash', 'High-Speed Multimodal', 'fgw/gemini-3-flash:free', 1, '1M', 'spark'],
  ['fgw-gemini-2.5-pro-free', 'Gemini 2.5 Pro', 'Analytical Pro Reasoning', 'fgw/gemini-2.5-pro:free', 1, '2M', 'fire'],
  ['fgw-gemini-2.0-flash-free', 'Gemini 2.0 Flash', 'Fast Everyday Multimodal', 'fgw/gemini-2.0-flash:free', 1, '1M', 'spark'],
  ['fgw-gemma-4-31b-it-free', 'Gemma 4 31B', 'Open-Weights Instruction', 'fgw/gemma-4-31b-it:free', 1, '128K', 'spark'],
  ['fgw-grok-4.7-free', 'Grok 4.7 Pro', 'Real-Time Frontier Synthesis', 'fgw/grok-4.7:free', 1, '500K', 'fire'],
  ['fgw-grok-4.7-fast-free', 'Grok 4.7 Fast', 'Low-Latency Synthesis', 'fgw/grok-4.7-fast:free', 1, '500K', 'spark'],
  ['fgw-gpt-5.6-sol-free', 'GPT-5.6 Sol+', 'High-Speed Frontier Logic', 'fgw/gpt-5.6-sol:free', 1, '1M', 'fire'],
  ['fgw-o3-free', 'o3 Reasoning', 'Deep STEM & Math Logic', 'fgw/o3:free', 1, '200K', 'fire'],
  ['fgw-o4-mini-free', 'o4-mini', 'Fast STEM & Code Reasoning', 'fgw/o4-mini:free', 1, '200K', 'spark'],
  ['fgw-gpt-4.1-mini-free', 'GPT-4.1 Mini', 'Fast Instruction & Coding', 'fgw/gpt-4.1-mini:free', 1, '1M', 'spark'],
  ['fgw-gpt-4o-free', 'GPT-4o', 'Omni Multimodal Intelligence', 'fgw/gpt-4o:free', 1, '128K', 'fire'],
  ['fgw-gpt-4o-mini-free', 'GPT-4o Mini', 'Lightweight Omni Speed', 'fgw/gpt-4o-mini:free', 1, '128K', 'spark'],
  ['fgw-gpt-oss-20b-free', 'GPT-OSS 20B+', 'Open-Weights Reasoning', 'fgw/openai/gpt-oss-20b:free', 0, '128K', 'spark'],
  ['fgw-qwen-3.8-max-free', 'Qwen 3.8 Max+', 'Flagship Coding & Math', 'fgw/qwen-3.8-max:free', 1, '1M', 'fire'],
  ['fgw-qwen-3.8-27b-free', 'Qwen 3.8 27B+', 'Dense 27B Reasoning', 'fgw/qwen-3.8-27b:free', 1, '256K', 'spark'],
  ['fgw-qwen-3.6-plus-free', 'Qwen 3.6 Plus', 'Balanced Coding & Analysis', 'fgw/qwen-3.6-plus:free', 1, '256K', 'spark'],
  ['fgw-qwen-3.6-27b-free', 'Qwen 3.6 27B', 'Fast 27B Synthesis', 'fgw/qwen-3.6-27b:free', 0, '256K', 'spark'],
  ['fgw-qwen-3.5-397b-a17b-free', 'Qwen 3.5 397B MoE', '397B Sparse MoE Reasoning', 'fgw/qwen-3.5-397b-a17b:free', 0, '256K', 'fire'],
  ['fgw-glm-5.3-flash-free', 'GLM 5.3 Flash+', 'Fast Reasoning & Synthesis', 'fgw/glm-5.3-flash:free', 1, '1M', 'spark'],
  ['fgw-caw-glm-5.3-flash-free', 'GLM 5.3 Flash Turbo', 'High-Throughput Flash', 'fgw/caw/glm-5.3-flash:free', 1, '1M', 'spark'],
  ['fgw-caw-glm-5.3-flash-thinking-free', 'GLM 5.3 Thinking', 'Reflective Chain of Thought', 'fgw/caw/glm-5.3-flash-thinking:free', 1, '1M', 'fire'],
  ['fgw-glm-4.7-flash-free', 'GLM 4.7 Flash', 'Low-Latency Reasoning', 'fgw/glm-4.7-flash:free', 0, '256K', 'spark'],
  ['fgw-glm-4.6v-flash-free', 'GLM 4.6V Flash', 'Multimodal Visual Analysis', 'fgw/glm-4.6v-flash:free', 1, '128K', 'spark'],
  ['fgw-llama-3.3-70b-instruct-free', 'Llama 3.3 70B Instruct', 'Open-Weights 70B Chat', 'fgw/llama-3.3-70b-instruct:free', 0, '128K', 'spark'],
  ['fgw-llama-3.3-70b-free', 'Llama 3.3 70B', '70B Foundation Model', 'fgw/llama-3.3-70b:free', 0, '128K', 'spark'],
  ['fgw-mistral-medium-3.5-free', 'Mistral Medium 3.5', 'Multilingual Logic & Code', 'fgw/mistral-medium-3.5:free', 1, '128K', 'spark'],
  ['fgw-nvidia-mistral-large-4-1t-free', 'Mistral Large 4 1T', '1T Sparse MoE Frontier', 'fgw/nvidia/mistral-large-4-1t-a52b:free', 1, '512K', 'fire'],
  ['fgw-nemotron-3-ultra-550b-free', 'Nemotron 3 Ultra 550B', '550B MoE Analytical', 'fgw/nemotron-3-ultra-550b-a55b:free', 0, '1M', 'fire'],
  ['fgw-nvidia-nemotron-3-ultra-550b-free', 'Nemotron 3 Ultra (Fast)', 'High-Throughput 550B MoE', 'fgw/nvidia/nemotron-3-ultra-550b-a55b:free', 0, '1M', 'fire'],
  ['fgw-nemotron-3.5-super-vl-free', 'Nemotron 3.5 Super VL', 'Vision-Language Reasoning', 'fgw/nemotron-3.5-super-vl:free', 1, '1M', 'fire'],
  ['fgw-nvidia-nemotron-3.5-super-vl-120b-free', 'Nemotron 3.5 VL 120B', '120B Multimodal MoE', 'fgw/nvidia/nemotron-3.5-super-vl-120b-a12b:free', 1, '1M', 'fire'],
  ['fgw-nvidia-nemotron-3.5-bolt-e4b-free', 'Nemotron 3.5 Bolt', 'Ultra-Fast Compact Flash', 'fgw/nvidia/nemotron-3.5-bolt-e4b:free', 0, '64K', 'spark'],
  ['fgw-minimax-m3.1-flash-free', 'MiniMax M3.1 Flash', 'Long-Context Fast Synthesis', 'fgw/minimax-m3.1-flash:free', 1, '1M', 'spark'],
  ['fgw-nvidia-minimax-m3.1-flash-free', 'MiniMax M3.1 Turbo', 'High-Speed Flash', 'fgw/nvidia/minimax-m3.1-flash:free', 1, '1M', 'spark'],
  ['fgw-minimax-m2.5-free', 'MiniMax M2.5', 'Balanced Long-Context Chat', 'fgw/minimax-m2.5:free', 0, '512K', 'spark'],
  ['fgw-agnes-3.0-flash-free', 'Agnes 3.0 Flash', 'Fast Structured Synthesis', 'fgw/agnes-3.0-flash:free', 0, '128K', 'spark'],
  ['fgw-ernie-5.5-flash-preview-free', 'Ernie 5.5 Flash', 'Knowledge-Enhanced Flash', 'fgw/ernie-5.5-flash-preview:free', 0, '256K', 'spark'],
  ['fgw-laguna-s-2.1-free', 'Laguna S 2.1+', 'Software Engineering & Code', 'fgw/laguna-s-2.1:free', 0, '1M', 'fire'],
  ['fgw-laguna-xs-2.1-free', 'Laguna XS 2.1+', 'Fast Code Completion', 'fgw/laguna-xs-2.1:free', 0, '256K', 'spark'],
  ['fgw-nvidia-laguna-xs-2.1-free', 'Laguna XS 2.1 Turbo', 'Accelerated Code Generation', 'fgw/nvidia/laguna-xs-2.1:free', 0, '256K', 'spark'],
  ['fgw-muse-spark-1.1-free', 'Muse Spark 1.1+', 'Creative Writing & Ideation', 'fgw/muse-spark-1.1:free', 0, '256K', 'spark'],
  ['fgw-mimo-v2.6-flash-free', 'MiMo V2.6 Flash+', 'Fast Mathematical Reasoning', 'fgw/mimo-v2.6-flash:free', 0, '1M', 'spark'],
  ['fgw-k2-horizon-375b-free', 'K2 Horizon 375B', '375B MoE Deep Synthesis', 'fgw/k2-horizon-375b-a23b:free', 0, '256K', 'fire'],
  ['fgw-jais-3-mova-36b-free', 'Jais 3 Mova 36B', 'Multilingual MoE Reasoning', 'fgw/jais-3-mova-36b-a4b:free', 0, '128K', 'spark'],
  ['fgw-xing4.0-29b-free', 'Xing 4.0 29B', 'Efficient MoE Logic', 'fgw/xing4.0-29b-a4b:free', 0, '128K', 'spark'],
  ['fgw-longcat-2.5-free', 'LongCat 2.5+', 'Long-Context Reasoning', 'fgw/longcat-2.5:free', 1, '1M', 'spark'],
  ['fgw-dots-3-note-preview-free', 'Dots 3 Note+', 'Research & Note Synthesis', 'fgw/dots-3-note-preview:free', 1, '512K', 'spark'],
  ['fgw-flint-v1.0-free', 'Flint v1.0+', 'Code & Analytical Logic', 'fgw/flint-v1.0:free', 0, '256K', 'spark'],
  ['fgw-liquid-lfm-2.5-2.6b-free', 'LFM 2.5 2.6B+', 'Liquid Foundation Speed', 'fgw/liquid/lfm-2.5-2.6b:free', 0, '128K', 'spark'],
  ['fgw-liquid-lfm-2.5-thinking-free', 'LFM 2.5 Thinking', 'Compact Chain of Thought', 'fgw/liquid/lfm-2.5-2.6b-thinking:free', 0, '128K', 'spark'],
  ['fgw-minicpm-v-4.7-35b-free', 'MiniCPM-V 4.7 35B', '35B Vision-Language MoE', 'fgw/openbmb/MiniCPM-V-4.7-35B-A3B:free', 1, '128K', 'spark'],
  ['fgw-minicpm-v-4.7-35b-thinking-free', 'MiniCPM-V 4.7 Thinking', 'Multimodal Visual Thinking', 'fgw/openbmb/MiniCPM-V-4.7-35B-A3B-thinking:free', 1, '128K', 'spark'],
  ['fgw-minicpm-v-4.7-1b-free', 'MiniCPM-V 4.7 1B', 'Ultra-Light Vision Model', 'fgw/MiniCPM-V-4.7-1B:free', 1, '64K', 'spark'],
  ['fgw-minicpm5-2b-free', 'MiniCPM 5 2B', 'Compact Edge Instruction', 'fgw/MiniCPM5-2B:free', 0, '64K', 'spark'],
  ['fgw-hy4-free', 'Hunyuan 4', 'Flagship Reasoning & Synthesis', 'fgw/hy4:free', 0, '256K', 'fire'],
  ['fgw-solar-mini4-free', 'Solar Mini 4', 'Compact High-Efficiency Pro', 'fgw/solar-mini4:free', 0, '128K', 'spark'],
  ['zro-deepseek-v4-flash-0731', 'DeepSeek V4 (0731)', 'Coding & Math Reasoning', 'zro/deepseek-v4-flash-0731', 0, '1M', 'spark'],
  ['deepseek-v4.1-flash-free', 'DeepSeek V4.1', 'Instant Reasoning', 'zro/deepseek-v4.1-flash', 0, '1M', 'spark'],
  ['itera-qwen3.8-27b-free', 'Qwen 3.8 27B', 'Fast Reply & Vision', 'itera/qwen/qwen3.8-27b', 1, '256K', 'spark'],
  ['deepseek-v4-flash-0731-free', 'DeepSeek V4 Flash', 'Analytical Reasoning', 'zro/deepseek-v4-flash-0731', 0, '1M', 'spark'],
  ['glm-5.3-flash-free', 'GLM 5.3 Flash (Alt)', 'Low-Latency Vision', 'zro/glm-5.3-flash', 1, '1M', 'spark'],
  ['mimo-v2.6-flash-free', 'MiMo V2.6', 'Fast Thinking', 'thk/mimo-v2.6-flash:free', 0, '1M', 'spark'],
  ['glm-5.3-free', 'GLM 5.3', 'Reasoning & Vision', 'glm-5.3-free', 1, '1M', 'spark'],
  ['gpt-6-luna', 'GPT-6 Luna', 'Multimodal Intelligence', 'thk/gpt-6-luna-fast', 1, '1M', 'spark'],
  ['thk-gpt-6.1-sol-fast', 'GPT-6.1 Sol', 'Frontier Speed', 'thk/gpt-6.1-sol-fast', 1, '1M', 'fire'],
  ['thk-gpt-6-astra-fast', 'GPT-6 Astra', 'Flagship Intelligence', 'thk/gpt-6-astra-fast', 1, '1M', 'fire'],
  ['thk-kimi-k3-fast', 'Kimi K3 Fast', 'Long-Context Reasoning', 'thk/kimi-k3-fast', 1, '1M', 'spark'],
  ['thk-claude-sonnet-5.5', 'Claude Sonnet 5.5', 'Balanced Coding', 'thk/claude-sonnet-5.5', 1, '1M', 'spark'],
  ['thk-claude-opus-5.5', 'Claude Opus 5.5', 'Deep Reasoning & Code', 'thk/claude-opus-5.5', 1, '1M', 'fire'],
  ['thk-grok-4.7', 'Grok 4.7', 'Real-Time Synthesis', 'thk/grok-4.7', 1, '500K', 'fire'],
  ['thk-gemini-4-argon', 'Gemini 4 Argon', 'Multimodal Frontier', 'thk/gemini-4-argon', 1, '1M', 'fire'],
  ['thk-mistral-large-4', 'Mistral Large 4', 'Multilingual Frontier', 'thk/mistral-large-4', 1, '512K', 'spark'],
  ['kimi-k2.6', 'Kimi K2.6', 'In-Depth Thinking', 'intern/kimi-k2.6', 1, '256K', 'spark'],
  ['minimax-m3', 'MiniMax-M3', 'Long-Context Thinking', 'intern/minimax-m3', 0, '1M', 'spark'],
  ['qwen3.8-27b', 'Qwen 3.8 Pro', 'Multimodal & Tools', 'itera/qwen/qwen3.8-27b', 1, '256K', 'spark'],
  ['larp-deepseek-v4', 'DeepSeek V4', 'Analytical Reasoning', 'larp/deepseek-v4', 0, '1M', 'spark'],
  ['larp-claude-sonnet', 'Claude Sonnet', 'Coding & Writing', 'larp/claude-sonnet', 1, '1M', 'spark'],
  ['larp-gpt-6', 'GPT-6 Frontier', 'High Intelligence', 'larp/gpt-6', 1, '1M', 'fire'],
  ['larp-glm-5', 'GLM-5', 'Vision & Reasoning', 'larp/glm-5', 1, '1M', 'spark'],
  ['larp-auto', 'Smart Router', 'Dynamic Routing', 'larp/auto', 0, 'Auto', 'spark'],
  ['radox-gemini-3.7-flash', 'Gemini 3.7 Flash', 'Fast Multimodal', 'radox/gemini-3.7-flash', 1, '1M', 'spark'],
  ['radox-claude-sonnet-5', 'Claude Sonnet 5', 'Fast Coding', 'radox/claude-sonnet-5', 1, '1M', 'spark'],
  ['radox-claude-opus-5.5', 'Claude Opus 5.5 Pro', 'Flagship Reasoning', 'radox/claude-opus-5.5', 1, '1M', 'fire'],
  ['radox-claude-fable-5.1', 'Claude Fable 5.1', 'Creative Synthesis', 'radox/claude-fable-5.1', 1, '1M', 'fire'],
  ['radox-gpt-5.6-sol', 'GPT-5.6 Sol', 'High-Speed Frontier', 'radox/gpt-5.6-sol', 1, '1M', 'fire'],
  ['radox-gpt-5.6-terra', 'GPT-5.6 Terra', 'Deep Analytical', 'radox/gpt-5.6-terra', 1, '1M', 'fire'],
  ['radox-gpt-5.6-luna', 'GPT-5.6 Luna', 'Multimodal Vision', 'radox/gpt-5.6-luna', 1, '1M', 'spark'],
  ['radox-deepseek-v4-pro-max', 'DeepSeek V4 Max', 'Max Reasoning & Math', 'radox/deepseek-v4-pro-max', 0, '1M', 'fire'],
  ['radox-gemini-3.1-pro', 'Gemini 3.1 Pro', 'Pro Reasoning', 'radox/gemini-3.1-pro', 1, '2M', 'fire'],
  ['radox-grok-4.6', 'Grok 4.6', 'Real-Time Intelligence', 'radox/grok-4.6', 1, '500K', 'spark'],
  ['radox-qwen3.8-max', 'Qwen 3.8 Max', 'Flagship Coding', 'radox/qwen3.8-max', 1, '1M', 'fire'],
  ['radox-kimi-k3', 'Kimi K3', 'Long-Context Synthesis', 'radox/kimi-k3', 1, '1M', 'spark'],
  ['radox-seed-2.1-pro', 'Seed 2.1 Pro', 'High-Precision Pro', 'radox/seed-2.1-pro', 1, '512K', 'fire'],
  ['radox-muse-spark-1.1', 'Muse Spark 1.1', 'Fast Creative', 'radox/muse-spark-1.1', 0, '256K', 'spark'],
  ['itera-claude-haiku-5.5', 'Claude Haiku 5.5', 'Low-Latency Speed', 'itera/anthropic/claude-haiku-5-5', 1, '1M', 'spark'],
  ['itera-deepseek-v4.1-flash-1017', 'DeepSeek V4.1 (1017)', 'Latest Fast Reasoning', 'itera/deepseek/deepseek-v4.1-flash-1017', 0, '1M', 'spark'],
  ['itera-claude-sonnet-5.5', 'Claude Sonnet 5.5 Fast', 'Fast Coding & Logic', 'itera/anthropic/claude-sonnet-5-5', 1, '1M', 'spark'],
  ['itera-kimi-k3-free', 'Kimi K3 (1M)', 'Deep Reasoning', 'itera/moonshotai/kimi-k3-free', 1, '1M', 'spark'],
  ['itera-claude-opus-5.5', 'Claude Opus 5.5 Ultra', 'Flagship Multimodal', 'itera/anthropic/claude-opus-5-5', 1, '1M', 'fire'],
  ['itera-claude-fable-5.1', 'Claude Fable Ultra', 'Deep Synthesis', 'itera/anthropic/claude-fable-5-1', 1, '1M', 'fire'],
  ['itera-gpt-6.1-sol', 'GPT-6.1 Sol Pro', 'Frontier Intelligence', 'itera/openai/gpt-6.1-sol', 1, '922K', 'fire'],
  ['itera-gpt-6-astra', 'GPT-6 Astra Pro', 'Deep Analytical', 'itera/openai/gpt-6-astra', 1, '922K', 'fire'],
  ['itera-gpt-6-luna', 'GPT-6 Luna Pro', 'Vision & Reasoning', 'itera/openai/gpt-6-luna', 1, '922K', 'fire'],
  ['itera-gemini-4-argon', 'Gemini 4 Argon Pro', 'Next-Gen Multimodal', 'itera/gemini/gemini-4-argon', 1, '1M', 'fire'],
  ['itera-deepseek-v4-pro-0813', 'DeepSeek V4 Pro+', 'Analytical Pro', 'itera/deepseek/deepseek-v4-pro-0813', 0, '1M', 'spark'],
  ['itera-qwen3.8-2.4t', 'Qwen 3.8 2.4T', '2.4T MoE Reasoning', 'itera/qwen/qwen3.8-2.4t-a95b', 1, '1M', 'fire'],
  ['itera-kimi-k2.7-code', 'Kimi K2.7 Code', 'Software Engineering', 'itera/moonshotai/kimi-k2.7-code', 0, '256K', 'spark'],
  ['itera-minimax-m3', 'MiniMax M3 Pro', 'Long-Context Flagship', 'itera/minimax/minimax-m3', 0, '1M', 'fire'],
  ['itera-glm-5.3', 'GLM 5.3 Max', 'Max Effort Reasoning', 'itera/z-ai/glm-5.3', 1, '1M', 'fire'],
  ['ar-anyrouter-free', 'Unified Router', 'Smart Routing Engine', 'ar/anyrouter/free', 0, '1M', 'spark'],
  ['ar-anyrouter-auto', 'Auto Multimodal', 'Multimodal Router', 'ar/anyrouter/auto', 1, '1M', 'spark'],
  ['ar-anyrouter-latest', 'Frontier Router', 'Flagship Router', 'ar/anyrouter/latest', 1, '1M', 'fire'],
  ['ar-anyrouter-hermes', 'Hermes Router', 'Agentic & Coding', 'ar/anyrouter/hermes', 0, '1M', 'spark'],
  ['ar-anyrouter-cowork', 'Cowork Router', 'Collaborative Vision', 'ar/anyrouter/cowork', 1, '1M', 'spark'],
  ['ar-nemotron-3.5-super-vl-120b', 'Nemotron 3.5 120B', 'Multimodal & Code', 'ar/nvidia/nemotron-3.5-super-vl-120b-a12b', 1, '1M', 'fire'],
  ['ar-nemotron-3.5-lightning-30b', 'Nemotron 3.5 30B', 'Fast 30B MoE', 'ar/nvidia/nemotron-3.5-lightning-30b-a3b', 0, '1M', 'spark'],
  ['ar-nemotron-3.5-bolt-e4b', 'Nemotron Bolt', 'Sub-Second Flash', 'ar/nvidia/nemotron-3.5-bolt-e4b', 0, '64K', 'spark'],
  ['ar-nemotron-3-ultra-550b', 'Nemotron Ultra 550B', '550B Frontier MoE', 'ar/nvidia/nemotron-3-ultra-550b-a55b', 0, '1M', 'fire'],
  ['ar-nemotron-parse-2.0', 'Nemotron Parse 2.0', 'Document Parser', 'ar/nvidia/nemotron-parse-2.0', 1, '8K', 'spark'],
  ['ar-riva-translate-4b-v2', 'Riva Translate 4B', 'Neural Translation', 'ar/nvidia/riva-translate-4b-instruct-v2', 0, '4K', 'spark'],
  ['ar-minimax-m3.1-flash', 'MiniMax M3.1', 'Multimodal & Coding', 'ar/minimax/minimax-m3.1-flash', 1, '1M', 'spark'],
  ['ar-longcat-2.5-preview', 'LongCat 2.5', 'Vision & Code', 'ar/meituan/longcat-2.5-preview', 1, '1M', 'spark'],
  ['ar-meta-muse-glimmer-30b', 'Muse Glimmer 30B', 'Vision & Code', 'ar/meta/muse-glimmer-30b', 1, '128K', 'spark'],
  ['ar-cohere-north-mini-code', 'North Mini Code', 'Code & Reasoning', 'ar/cohere/north-mini-code', 0, '256K', 'spark'],
  ['ar-dots-3-note-preview', 'Dots 3 Note', 'Multimodal Research', 'ar/dots-studio/dots-3-note-preview', 1, '512K', 'spark'],
  ['ar-liquid-lfm-2.5-2.6b', 'LFM 2.5', 'Fast Foundation', 'ar/liquid/lfm-2.5-2.6b', 0, '128K', 'spark'],
  ['ar-liquid-d1', 'Liquid d1', 'Compact Reasoning', 'ar/liquid/d1', 0, '32K', 'spark'],
  ['ar-openai-gpt-oss-20b', 'GPT-OSS 20B', 'Open-Weights Code', 'ar/openai/gpt-oss-20b', 0, '128K', 'spark'],
  ['ar-poolside-laguna-s-2.1', 'Laguna S 2.1', 'Software Engineering', 'ar/poolside/laguna-s-2.1', 0, '1M', 'fire'],
  ['ar-poolside-laguna-xs-2.1', 'Laguna XS 2.1', 'Fast Code Synthesis', 'ar/poolside/laguna-xs-2.1', 0, '256K', 'spark'],
  ['ar-recursive-flint-v1', 'Flint v1.0', 'Code & Analysis', 'ar/recursive/flint-v1.0', 0, '256K', 'spark'],
  ['ar-reflection-beam-1.0', 'Beam 1.0', 'Code Synthesis', 'ar/reflection/beam-1.0', 0, '1M', 'fire'],
  ['ar-stealth-glyph-cluster', 'Glyph Cluster', 'Cluster Reasoning', 'ar/stealth/glyph-cluster', 0, '256K', 'spark'],
  ['ar-glm-4.5-flash', 'GLM 4.5 Flash', 'Fast Flash', 'ar/z-ai/glm-4.5-flash', 0, '128K', 'spark'],
  ['ar-glm-flash-latest', 'GLM Flash', 'High-Speed Flash', 'ar/z-ai/glm-flash-latest', 0, '128K', 'spark'],
  ['ar-pareto-code-router', 'Pareto Code', 'Code Synthesis', 'ar/openrouter/pareto-code', 1, '2M', 'fire'],
  ['ar-inception-mercury-decide', 'Mercury Decide', 'Ultra-Fast Diffusion', 'ar/inception/mercury-decide', 0, '32K', 'spark'],
];

export const GROK_MODELS: ModelOption[] = MODEL_SPECS.map(
  ([id, name, description, geminiModel, vision, contextLength, requiredTier, unlimited]) => ({
    id,
    name,
    description,
    geminiModel,
    supportsVision: Boolean(vision),
    contextLength,
    requiredTier,
    ...(unlimited ? { unlimited: true } : {}),
  })
);

export const FREE_MODEL_IDS = new Set(
  GROK_MODELS.filter((m) => m.requiredTier === 'free').map((m) => m.id)
);

export const getModelRequiredTier = (model: ModelOption): 'free' | 'spark' | 'fire' =>
  model.unlimited ? 'free' : model.requiredTier || 'spark';

export function getPreferredDefaultModel(): ModelOption {
  const prefId = UserAccountStore.getPersonalization().defaultModelId;
  const found = prefId ? GROK_MODELS.find((m) => m.id === prefId) : undefined;
  return found && (found.unlimited || UserAccountStore.canUseModel(getModelRequiredTier(found)))
    ? found
    : GROK_MODELS[0];
}

export function getDefaultVisionModel(): ModelOption {
  const prefId = UserAccountStore.getPersonalization().defaultVisionModelId;
  const pref = prefId ? GROK_MODELS.find((m) => m.id === prefId && m.supportsVision) : undefined;
  if (pref && (pref.unlimited || UserAccountStore.canUseModel(getModelRequiredTier(pref)))) return pref;
  return (
    GROK_MODELS.find((m) => m.supportsVision && (m.unlimited || UserAccountStore.canUseModel(getModelRequiredTier(m)))) ||
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
  const [, setPlanTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = GROK_MODELS.find((m) => m.id === selectedModelId) || GROK_MODELS[0];

  useEffect(() => {
    const sync = () => setPlanTick((n) => n + 1);
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('kinich-account-updated', sync);
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('kinich-account-updated', sync);
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const openUpgrade = (tier: 'spark' | 'fire', modelName: string) => {
    const reason = `${modelName} requires the ${tier === 'spark' ? 'Spark ($3/mo)' : 'Fire ($9/mo Unlimited)'} plan. Upgrade now to unlock it.`;
    if (onOpenPricing) onOpenPricing(tier, reason);
    else window.dispatchEvent(new CustomEvent('kinich-open-pricing', { detail: { highlightPlan: tier, reason } }));
  };

  const triggerCls =
    variant === 'header'
      ? `flex items-center gap-1 h-7 sm:h-8 px-2.5 sm:px-3 rounded-full border transition-all cursor-pointer font-medium text-[11px] sm:text-xs select-none ${
          isDark
            ? 'bg-[#141416]/95 hover:bg-white/[0.08] border-white/[0.12] text-white'
            : 'bg-white/95 hover:bg-black/[0.03] border-black/[0.08] text-[#111111] shadow-[0_1px_4px_rgba(0,0,0,0.05)]'
        }`
      : `flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
          isDark ? 'text-white/85 hover:text-white' : 'text-black/80 hover:text-black'
        }`;

  const posCls =
    dropdownDirection === 'down'
      ? 'top-full left-1/2 -translate-x-1/2 mt-2'
      : 'bottom-full right-0 mb-2';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`${triggerCls} max-w-[155px] sm:max-w-[205px]`}
        title={current.name}
      >
        <span className="tracking-[-0.01em] truncate">{current.name}</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform duration-150 opacity-65 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`absolute ${posCls} w-[268px] sm:w-[304px] max-w-[calc(100vw-1.5rem)] rounded-[22px] border overflow-hidden z-50 backdrop-blur-2xl backdrop-saturate-150 animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? 'bg-[#151517]/94 border-white/[0.1] text-white shadow-[0_20px_50px_rgba(0,0,0,0.78)]'
              : 'bg-white/95 border-black/[0.07] text-[#111111] shadow-[0_16px_42px_rgba(0,0,0,0.12)]'
          }`}
        >
          <div className="max-h-[min(440px,66dvh)] overflow-y-auto ultra-slim-scrollbar p-1.5 pr-1 flex flex-col gap-0.5">
            {GROK_MODELS.map((m) => {
              const isSelected = m.id === current.id;
              const reqTier = getModelRequiredTier(m);
              const isLocked = !m.unlimited && !UserAccountStore.canUseModel(reqTier);
              const showCtx = m.contextLength && m.contextLength !== 'Auto' && !m.description.includes(m.contextLength);
              const subtitle = showCtx ? `${m.description} (${m.contextLength})` : m.description;

              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setIsOpen(false);
                    if (isLocked && reqTier !== 'free') {
                      openUpgrade(reqTier, m.name);
                      return;
                    }
                    UserAccountStore.recordModelExplored(m.id);
                    onSelectModel(m);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-[14px] text-left transition-colors cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-white/[0.08]'
                        : 'bg-black/[0.045]'
                      : isDark
                      ? 'hover:bg-white/[0.05]'
                      : 'hover:bg-black/[0.03]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-[12px] sm:text-[12.5px] font-semibold leading-tight tracking-[-0.01em] truncate ${
                        isLocked
                          ? isDark
                            ? 'text-white/60'
                            : 'text-[#111111]/60'
                          : isDark
                          ? 'text-white'
                          : 'text-[#111111]'
                      }`}
                    >
                      {m.name}
                    </div>
                    <div
                      className={`text-[10px] sm:text-[10.5px] leading-snug truncate mt-0.5 ${
                        isDark ? 'text-white/50' : 'text-[#6e6e73]'
                      }`}
                    >
                      {subtitle}
                    </div>
                  </div>
                  {isSelected ? (
                    <Check className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-white/85' : 'text-[#111111]'}`} />
                  ) : isLocked ? (
                    <Lock className={`w-3 h-3 shrink-0 ${isDark ? 'text-white/30' : 'text-black/30'}`} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
