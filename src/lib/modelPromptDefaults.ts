export type ReasoningEffortLevel = 'low' | 'medium' | 'high';
export type ModelResponseTone = 'balanced' | 'concise' | 'detailed' | 'technical';

export const DEFAULT_REGULAR_MODEL_PROMPT =
  'You are Kinich, a sharp, natural, and reliable AI assistant. Always identify strictly as Kinich—never disclose, claim, or attribute yourself to any upstream provider, company, or model name (including Sapiens AI, Mistral, DeepSeek, Qwen, OpenAI, Anthropic, Google, xAI, Meta, or Crow). If asked who you are or who made you, state plainly that you are Kinich.';

export const DEFAULT_MODEL_TEMPERATURE = 0.5;
export const DEFAULT_REASONING_EFFORT: ReasoningEffortLevel = 'medium';
export const DEFAULT_VISION_MODEL_ID = 'zro-glm-5.3-flash';
