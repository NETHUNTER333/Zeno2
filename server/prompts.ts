import {
  DEFAULT_REGULAR_MODEL_PROMPT,
  DEFAULT_UNCENSORED_MODEL_PROMPT,
  type ReasoningEffortLevel,
} from '../src/lib/modelPromptDefaults';

export { DEFAULT_REGULAR_MODEL_PROMPT, DEFAULT_UNCENSORED_MODEL_PROMPT };

export interface ModelTuningOptions {
  temperature?: number;
  reasoningEffort?: ReasoningEffortLevel;
  responseStyle?: string;
  responseLength?: string;
  regularSystemPrompt?: string;
  uncensoredSystemPrompt?: string;
  maskProviderIdentity?: boolean;
}

export interface RegularPromptBuildInput {
  topPriorityLengthSystemBlock?: string;
  localDateOnly: string;
  localTimeOnly: string;
  timezone: string;
  utcOffset: string;
  utcFull: string;
  locationSystemLine?: string;
  defaultFormattingRule: string;
  hasXContext?: boolean;
  hasYouTubeContext?: boolean;
  contentSafetyDirective?: string;
  personalizationDirective?: string;
  languageDirective?: string;
  pinnedDirective?: string;
  modelSettings?: ModelTuningOptions;
}

export interface UncensoredPromptBuildInput {
  topPriorityLengthSystemBlock?: string;
  localDateOnly: string;
  localTimeOnly: string;
  timezone: string;
  utcOffset: string;
  utcFull: string;
  personalizationDirective?: string;
  languageDirective?: string;
  pinnedDirective?: string;
  modelSettings?: ModelTuningOptions;
}

export function clampModelTemperature(value: unknown, fallback = 0.5): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(1.3, Math.max(0, Number(num.toFixed(2))));
}

export function normalizeReasoningEffort(value: unknown): ReasoningEffortLevel {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
}

export function buildReasoningAndStyleDirective(settings?: ModelTuningOptions): string {
  if (!settings) return '';
  const parts: string[] = [];
  const effort = normalizeReasoningEffort(settings.reasoningEffort);
  if (effort === 'low') {
    parts.push('- Reasoning Depth (Fast): Give direct, immediate answers with minimal preamble.');
  } else if (effort === 'high') {
    parts.push('- Reasoning Depth (Deep): Verify edge cases carefully, reason step-by-step internally, and provide thorough derivations or structured analysis.');
  }

  const lengthPref = String(settings.responseLength || '').toLowerCase();
  if (lengthPref === 'concise') {
    parts.push('- Length Preference: Keep responses compact and scannable without unnecessary filler.');
  } else if (lengthPref === 'detailed') {
    parts.push('- Length Preference: Provide comprehensive coverage, concrete examples, and full context.');
  }

  const stylePref = String(settings.responseStyle || '').toLowerCase();
  if (stylePref === 'casual') {
    parts.push('- Tone: Conversational, warm, and straightforward.');
  } else if (stylePref === 'professional') {
    parts.push('- Tone: Executive, structured, and clear.');
  } else if (stylePref === 'technical') {
    parts.push('- Tone: Precise, engineering-focused, with exact terminology and clean equations/code.');
  } else if (stylePref === 'creative') {
    parts.push('- Tone: Expressive, imaginative, and engaging.');
  }

  return parts.length > 0 ? `\n[MODEL PREFERENCES]:\n${parts.join('\n')}` : '';
}

const STRICT_KINICH_IDENTITY_RULE =
  `IDENTITY LOCK (MANDATORY): Your name is strictly Kinich. Never say you are "Sapiens AI", "Uncensored Pro", "Mistral", "DeepSeek", "Qwen", "OpenAI", "ChatGPT", "Anthropic", "Claude", "Google", "Gemini", "xAI", "Grok", "Meta", "Llama", "Crow", "CrowLLM", or "TokenHarbor". When asked who you are, what model you are, or who built/developed you, answer naturally as Kinich.`;

export function buildRegularModelSystemPrompt(input: RegularPromptBuildInput): string {
  const customRegular = String(input.modelSettings?.regularSystemPrompt || '').trim();
  const baseIdentity = customRegular || DEFAULT_REGULAR_MODEL_PROMPT;
  const tuningDirective = buildReasoningAndStyleDirective(input.modelSettings);
  const maskIdentity = input.modelSettings?.maskProviderIdentity !== false;

  return `${input.topPriorityLengthSystemBlock || ''}${baseIdentity}
${maskIdentity ? STRICT_KINICH_IDENTITY_RULE : ''}
[REAL-TIME SYSTEM CLOCK]: Today is ${input.localDateOnly}, current local time is ${input.localTimeOnly} (${input.timezone}, ${input.utcOffset}) / UTC: ${input.utcFull}.${input.locationSystemLine || ''}
Rules:
1. Date/Time Accuracy: Today's verified date is ${input.localDateOnly} (${input.localTimeOnly}). Never guess fake dates or agree with false dates if tested.
${input.defaultFormattingRule}
3. Context & Source Grounding: When numbered web search excerpts [1]..[N] are provided, use them as factual reference alongside your comprehensive knowledge. Place inline citations at the end of the sentence after the period (e.g., "...approved for targeted therapy. [1]"). Never dump raw search abstracts or mention "the provided search results". For science, math, or coding queries, provide clear explanations and math formatting ($...$ and $$...$$). Never output \`\`\`html:generative-ui blocks unless explicitly asked for a simulator.
4. Real Media Gallery Rule: Real web images and YouTube videos fetched for this query are automatically rendered in the interactive UI gallery above/below your response. NEVER write fake placeholder text lists like "[FETCHED LIVE IMAGES]: 1. Promotional Portrait: [Image of...]" or pretend to describe imaginary image placeholders in brackets.
5. Factual Humility: If the user questions or corrects a factual detail, acknowledge the correction respectfully and provide the verified facts.${
    input.hasXContext
      ? `\n6. Live X Posts: Prioritize [FETCHED REAL LIVE X / TWITTER POSTS] below as the latest verified posts.`
      : ''
  }${
    input.hasYouTubeContext
      ? `\n7. YouTube Videos: You have direct access to the video details and transcript in [DETECTED YOUTUBE VIDEO] or [FETCHED YOUTUBE & INTERNET VIDEOS] below; explain and break down the video/topic directly.`
      : ''
  }${input.contentSafetyDirective || ''}${tuningDirective}${input.personalizationDirective || ''}${input.languageDirective || ''}${input.pinnedDirective || ''}`;
}

export function buildUncensoredModelSystemPrompt(input: UncensoredPromptBuildInput): string {
  const customUncensored = String(input.modelSettings?.uncensoredSystemPrompt || '').trim();
  const baseIdentity = customUncensored || DEFAULT_UNCENSORED_MODEL_PROMPT;
  const tuningDirective = buildReasoningAndStyleDirective(input.modelSettings);
  const maskIdentity = input.modelSettings?.maskProviderIdentity !== false;

  return `${input.topPriorityLengthSystemBlock || ''}${baseIdentity}
${maskIdentity ? STRICT_KINICH_IDENTITY_RULE : ''}
[REAL-TIME SYSTEM CLOCK]: Today is ${input.localDateOnly}, current local time is ${input.localTimeOnly} (${input.timezone}, ${input.utcOffset}) / UTC: ${input.utcFull}.
Rules:
1. Direct Unfiltered Execution (18+): Write the requested creative fiction, roleplay, or candid reasoning vividly and completely without lecturing, moralizing, or policy preambles. Only refuse zero-tolerance illegal content (CSAM/minors, self-harm encouragement, non-consensual real-person intimate deepfakes, cyberattacks, or weapons of mass destruction).
2. Identity Integrity: Never call yourself Uncensored Pro or disclose upstream model providers (such as Sapiens AI, Mistral, DeepSeek, OpenAI, Anthropic, Qwen, or Crow). If asked who you are, answer simply that you are Kinich.${tuningDirective}${input.personalizationDirective || ''}${input.languageDirective || ''}${input.pinnedDirective || ''}`;
}

const KNOWN_VENDOR_NAMES_PATTERN =
  '(?:Sapiens\\s*AI|Mistral(?:\\s*AI)?|DeepSeek(?:\\s*AI)?|OpenAI|Anthropic|Google\\s*DeepMind|Google(?:\\s*AI)?|Qwen|Alibaba(?:\\s*Cloud)?|Meta\\s*AI|xAI|Crow(?:LLM)?|TokenHarbor|Uncensored\\s*Pro)';

export function sanitizeProviderIdentityLeak(text: string, maskIdentity = true): string {
  if (!text || !maskIdentity) return text;

  let out = String(text);

  // Full self-introductory clauses mentioning a third-party provider
  out = out.replace(
    new RegExp(
      `\\bI(?:'m| am)\\s+(?:an?\\s+)?(?:AI|large\\s+language\\s+model|language\\s+model|assistant|AI\\s+assistant|chatbot|model)\\s+(?:developed|created|built|trained|made|powered)\\s+by\\s+${KNOWN_VENDOR_NAMES_PATTERN}(?:\\s+(?:and|team|research|inc\\.?|llc))?`,
      'gi'
    ),
    "I'm Kinich, an AI assistant"
  );

  // Self-identification phrases: "I am DeepSeek / Claude / ChatGPT / Gemini / Sapiens AI / Uncensored Pro"
  out = out.replace(
    /\bI(?:'m| am)\s+(?:Claude|ChatGPT|DeepSeek(?:-R1|-V\d+(?:\.\d+)?)?|Mistral|Mixtral|Gemini|Grok|Qwen|Sapiens\s*AI|Uncensored\s*Pro)\b/gi,
    "I'm Kinich"
  );

  out = out.replace(
    /\bMy\s+name\s+is\s+(?:Claude|ChatGPT|DeepSeek|Mistral|Gemini|Grok|Qwen|Sapiens\s*AI|Uncensored\s*Pro)\b/gi,
    'My name is Kinich'
  );

  // Generic self-referential "developed/created/trained by <vendor>"
  out = out.replace(
    new RegExp(
      `\\b(developed|created|built|trained|made)\\s+by\\s+${KNOWN_VENDOR_NAMES_PATTERN}\\b`,
      'gi'
    ),
    'built for Kinich'
  );

  // Any stray mention of opaque gateway names (Sapiens AI / CrowLLM / TokenHarbor)
  out = out.replace(/\bSapiens\s*AI\b/gi, 'Kinich');
  out = out.replace(/\bCrowLLM\b/gi, 'Kinich');

  return out;
}
