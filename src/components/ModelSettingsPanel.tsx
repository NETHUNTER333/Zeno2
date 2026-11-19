import React, { useState, useMemo } from 'react';
import {
  Check,
  Cpu,
  Eye,
  Lock,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { UserAccountStore } from '../lib/userAccountStore';
import {
  DEFAULT_MODEL_TEMPERATURE,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_REGULAR_MODEL_PROMPT,
  type ReasoningEffortLevel,
} from '../lib/modelPromptDefaults';
import {
  GROK_MODELS,
  getModelRequiredTier,
  type ModelOption,
} from './GrokModelPicker';
import type { ResponseLength, ResponseStyle, UserPersonalization } from '../types';

interface ModelSettingsPanelProps {
  isDark: boolean;
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  webSearchDefault: boolean;
  onToggleWebSearchDefault: (enabled: boolean) => void;
  onOpenPricing?: (highlightPlan?: 'spark' | 'fire', reason?: string) => void;
  onSaved?: (message: string) => void;
}

export const ModelSettingsPanel: React.FC<ModelSettingsPanelProps> = ({
  isDark,
  selectedModel,
  onSelectModel,
  webSearchDefault,
  onToggleWebSearchDefault,
  onOpenPricing,
  onSaved,
}) => {
  const [personalization, setPersonalization] = useState<UserPersonalization>(() =>
    UserAccountStore.getPersonalization()
  );
  const [modelSearch, setModelSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'spark' | 'fire'>('all');
  const [regularPromptDraft, setRegularPromptDraft] = useState<string>(
    () => UserAccountStore.getPersonalization().regularSystemPrompt?.trim() || DEFAULT_REGULAR_MODEL_PROMPT
  );

  const currentPlan = UserAccountStore.getNormalizedPlan();
  const visionModels = useMemo(() => GROK_MODELS.filter((m) => m.supportsVision), []);

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    return GROK_MODELS.filter((m) => {
      const tier = getModelRequiredTier(m);
      if ((tierFilter === 'free' || tierFilter === 'spark' || tierFilter === 'fire') && tier !== tierFilter) {
        return false;
      }
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
      );
    });
  }, [modelSearch, tierFilter]);

  const cardClass = isDark
    ? 'bg-[#121215] border-white/10 text-[#f4f4f5]'
    : 'bg-white border-black/10 text-[#09090b] shadow-xs';
  const inputClass = isDark
    ? 'bg-[#09090b] border-white/12 text-white placeholder-neutral-500 focus:border-[#FC4C01]'
    : 'bg-[#f8f8f9] border-black/12 text-black placeholder-neutral-400 focus:border-[#FC4C01]';
  const mutedText = isDark ? 'text-neutral-400' : 'text-neutral-500';

  const persistUpdate = (patch: Partial<UserPersonalization>, alertMessage?: string) => {
    const next: UserPersonalization = {
      ...personalization,
      ...patch,
    };
    setPersonalization(next);
    UserAccountStore.savePersonalization(next);
    UserAccountStore.syncProfileAndSettingsWithBackend({
      preferences: {
        selectedModelId: next.defaultModelId,
        defaultVisionModelId: next.defaultVisionModelId,
        temperature: next.temperature,
        reasoningEffort: next.reasoningEffort,
        responseStyle: next.responseStyle,
        responseLength: next.responseLength,
        maskProviderIdentity: next.maskProviderIdentity !== false,
        webSearchDefault,
      },
    }).catch(() => {});
    if (alertMessage) onSaved?.(alertMessage);
  };

  const temperatureVal =
    typeof personalization.temperature === 'number'
      ? personalization.temperature
      : DEFAULT_MODEL_TEMPERATURE;
  const reasoningEffortVal: ReasoningEffortLevel =
    personalization.reasoningEffort || DEFAULT_REASONING_EFFORT;
  const maskIdentityVal = personalization.maskProviderIdentity !== false;

  const handleSelectDefaultChatModel = (model: ModelOption) => {
    const reqTier = getModelRequiredTier(model);
    if (!UserAccountStore.canUseModel(reqTier)) {
      if (onOpenPricing) {
        onOpenPricing(reqTier === 'fire' ? 'fire' : 'spark', `${model.name} requires the ${reqTier === 'fire' ? 'Fire' : 'Spark'} plan.`);
      } else {
        window.dispatchEvent(
          new CustomEvent('kinich-navigate-route', { detail: { path: '/pricing' } })
        );
      }
      return;
    }
    onSelectModel(model);
    persistUpdate({ defaultModelId: model.id }, `Default chat model set to ${model.name}`);
  };

  const handleSelectDefaultVisionModel = (modelId: string) => {
    const found = visionModels.find((m) => m.id === modelId);
    if (!found) return;
    const reqTier = getModelRequiredTier(found);
    if (!UserAccountStore.canUseModel(reqTier)) {
      onOpenPricing?.(
        reqTier === 'fire' ? 'fire' : 'spark',
        `${found.name} requires the ${reqTier === 'fire' ? 'Fire' : 'Spark'} plan.`
      );
      return;
    }
    persistUpdate({ defaultVisionModelId: found.id }, `Default vision model set to ${found.name}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Model Settings</h2>
          <p className={`text-xs sm:text-sm mt-1 ${mutedText}`}>
            Configure default models, reasoning depth, temperature, and your default system prompt.
          </p>
        </div>
        <div className={`text-xs font-mono tabular-nums ${mutedText}`}>
          Plan: {currentPlan.toUpperCase()} · Active: {selectedModel.name}
        </div>
      </div>

      {/* Section 1: Inference Parameters */}
      <div className={`p-5 rounded-2xl border space-y-5 ${cardClass}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#FC4C01]" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Inference &amp; Behavior
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              persistUpdate(
                {
                  temperature: DEFAULT_MODEL_TEMPERATURE,
                  reasoningEffort: DEFAULT_REASONING_EFFORT,
                  responseLength: 'balanced',
                  responseStyle: 'technical',
                },
                'Inference parameters reset to balanced defaults'
              )
            }
            className={`inline-flex items-center gap-1 text-xs font-medium hover:text-[#FC4C01] transition-colors cursor-pointer ${mutedText}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset tuning</span>
          </button>
        </div>

        {/* Temperature */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold">Temperature (Creativity vs. Precision)</div>
              <div className={`text-[11px] ${mutedText}`}>
                Lower values favor deterministic code &amp; facts; higher values enrich creative prose.
              </div>
            </div>
            <span className="font-mono font-semibold text-sm tabular-nums text-[#FC4C01]">
              {temperatureVal.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1.2}
            step={0.05}
            value={temperatureVal}
            aria-label="Model Temperature"
            onChange={(e) => persistUpdate({ temperature: parseFloat(e.target.value) })}
            className="w-full accent-[#FC4C01] cursor-pointer"
          />
          <div className="flex items-center justify-between gap-2">
            {[
              { label: 'Exact · 0.2', value: 0.2 },
              { label: 'Balanced · 0.5', value: 0.5 },
              { label: 'Expressive · 0.8', value: 0.8 },
              { label: 'Unfiltered · 1.0', value: 1.0 },
            ].map((preset) => {
              const active = Math.abs(temperatureVal - preset.value) < 0.04;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    persistUpdate({ temperature: preset.value }, `Temperature set to ${preset.value.toFixed(2)}`)
                  }
                  className={`flex-1 py-1.5 px-2 rounded-lg border text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? isDark
                        ? 'bg-white text-black border-white font-semibold'
                        : 'bg-black text-white border-black font-semibold'
                      : isDark
                      ? 'border-white/10 text-neutral-400 hover:text-white'
                      : 'border-black/10 text-neutral-600 hover:text-black'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reasoning Depth & Response Length */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-500/10">
          <div className="space-y-2">
            <label className="block text-xs font-semibold">Reasoning Depth</label>
            <div
              className={`grid grid-cols-3 p-1 rounded-xl border ${
                isDark ? 'bg-[#09090b] border-white/10' : 'bg-neutral-100 border-black/10'
              }`}
            >
              {(
                [
                  { id: 'low', label: 'Fast' },
                  { id: 'medium', label: 'Balanced' },
                  { id: 'high', label: 'Deep' },
                ] as { id: ReasoningEffortLevel; label: string }[]
              ).map((opt) => {
                const active = reasoningEffortVal === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      persistUpdate(
                        { reasoningEffort: opt.id },
                        `Reasoning depth set to ${opt.label}`
                      )
                    }
                    className={`py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? isDark
                          ? 'bg-white text-black font-semibold'
                          : 'bg-black text-white font-semibold'
                        : mutedText
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold">Response Length</label>
            <div
              className={`grid grid-cols-3 p-1 rounded-xl border ${
                isDark ? 'bg-[#09090b] border-white/10' : 'bg-neutral-100 border-black/10'
              }`}
            >
              {(
                [
                  { id: 'concise', label: 'Concise' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'detailed', label: 'Detailed' },
                ] as { id: ResponseLength; label: string }[]
              ).map((opt) => {
                const active = personalization.responseLength === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      persistUpdate(
                        { responseLength: opt.id },
                        `Response length set to ${opt.label}`
                      )
                    }
                    className={`py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? isDark
                          ? 'bg-white text-black font-semibold'
                          : 'bg-black text-white font-semibold'
                        : mutedText
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tone / Style */}
        <div className="space-y-2 pt-2 border-t border-neutral-500/10">
          <label className="block text-xs font-semibold">Response Tone</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: 'technical', label: 'Technical' },
                { id: 'professional', label: 'Professional' },
                { id: 'casual', label: 'Conversational' },
                { id: 'creative', label: 'Creative' },
              ] as { id: ResponseStyle; label: string }[]
            ).map((opt) => {
              const active = personalization.responseStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    persistUpdate({ responseStyle: opt.id }, `Response tone set to ${opt.label}`)
                  }
                  className={`py-2 px-3 rounded-xl border text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'border-[#FC4C01] bg-[#FC4C01]/10 text-[#FC4C01] font-semibold'
                      : isDark
                      ? 'border-white/10 text-neutral-300 hover:border-white/25'
                      : 'border-black/10 text-neutral-700 hover:border-black/25'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Identity & Search Guardrails */}
        <div className="space-y-3 pt-2 border-t border-neutral-500/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FC4C01]" />
                <span>Strict Kinich Identity Lock</span>
              </div>
              <div className={`text-[11px] mt-0.5 ${mutedText}`}>
                Prevents upstream model gateways from leaking third-party vendor names (e.g. Sapiens AI, Mistral, DeepSeek).
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={maskIdentityVal}
              aria-label="Strict Kinich Identity Lock"
              onClick={() =>
                persistUpdate(
                  { maskProviderIdentity: !maskIdentityVal },
                  !maskIdentityVal ? 'Kinich identity lock enabled' : 'Kinich identity lock disabled'
                )
              }
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                maskIdentityVal
                  ? isDark
                    ? 'bg-white'
                    : 'bg-black'
                  : isDark
                  ? 'bg-neutral-700'
                  : 'bg-neutral-300'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${
                  maskIdentityVal
                    ? isDark
                      ? 'translate-x-5 bg-black'
                      : 'translate-x-5 bg-white'
                    : 'bg-white'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold">Default Web Search Grounding</div>
              <div className={`text-[11px] mt-0.5 ${mutedText}`}>
                Automatically ground regular chat turns with live citations and real-time sources.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={webSearchDefault}
              aria-label="Default Web Search Grounding"
              onClick={() => onToggleWebSearchDefault(!webSearchDefault)}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                webSearchDefault
                  ? isDark
                    ? 'bg-white'
                    : 'bg-black'
                  : isDark
                  ? 'bg-neutral-700'
                  : 'bg-neutral-300'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${
                  webSearchDefault
                    ? isDark
                      ? 'translate-x-5 bg-black'
                      : 'translate-x-5 bg-white'
                    : 'bg-white'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: System Prompt */}
      <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-3 ${cardClass}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                System Prompt
              </div>
              <div className={`text-[11px] mt-0.5 ${mutedText}`}>
                Applies across reasoning, coding, search, vision, and study models.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setRegularPromptDraft(DEFAULT_REGULAR_MODEL_PROMPT);
                persistUpdate({ regularSystemPrompt: '' }, 'System prompt reset to Kinich default');
              }}
              className={`inline-flex items-center gap-1 text-[11px] font-medium hover:text-[#FC4C01] cursor-pointer ${mutedText}`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Default</span>
            </button>
          </div>
          <textarea
            rows={5}
            value={regularPromptDraft}
            onChange={(e) => setRegularPromptDraft(e.target.value)}
            aria-label="System Prompt"
            className={`w-full p-3 rounded-xl border text-xs leading-relaxed outline-none resize-y ${inputClass}`}
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
            {regularPromptDraft.length} chars
          </span>
          <button
            type="button"
            onClick={() =>
              persistUpdate(
                {
                  regularSystemPrompt:
                    regularPromptDraft.trim() === DEFAULT_REGULAR_MODEL_PROMPT
                      ? ''
                      : regularPromptDraft.trim(),
                },
                'System prompt saved'
              )
            }
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              isDark
                ? 'bg-white text-black hover:bg-neutral-200'
                : 'bg-black text-white hover:bg-neutral-800'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Prompt</span>
          </button>
        </div>
      </div>

      {/* Section 3: Default Vision & Chat Models */}
      <div className={`p-5 rounded-2xl border space-y-4 ${cardClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#FC4C01]" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Default Vision Routing Model
              </div>
              <div className={`text-[11px] ${mutedText}`}>
                Used automatically when you attach screenshots or diagrams while a text-only model is active.
              </div>
            </div>
          </div>
          <select
            value={personalization.defaultVisionModelId || 'zro-glm-5.3-flash'}
            onChange={(e) => handleSelectDefaultVisionModel(e.target.value)}
            aria-label="Default Vision Model"
            className={`px-3 py-2 rounded-xl border text-xs font-medium outline-none cursor-pointer ${inputClass}`}
          >
            {visionModels.map((vm) => {
              const tier = getModelRequiredTier(vm);
              const unlocked = UserAccountStore.canUseModel(tier);
              return (
                <option key={vm.id} value={vm.id}>
                  {vm.name} ({vm.contextLength || '1M'} · {tier.toUpperCase()})
                  {!unlocked ? ' — Upgrade required' : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Section 4: Default Chat Model Selector */}
      <div className={`p-5 rounded-2xl border space-y-4 ${cardClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#FC4C01]" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Model Catalog &amp; Active Default
              </div>
              <div className={`text-[11px] ${mutedText}`}>
                Pick the active model for new chats. Locked models show their required plan tier.
              </div>
            </div>
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              placeholder="Filter models..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs outline-none ${inputClass}`}
            />
          </div>
        </div>

        {/* Clean single-line filter row */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {[
            { id: 'all', label: 'All Models' },
            { id: 'free', label: 'Free Tier' },
            { id: 'spark', label: 'Spark ($3)' },
            { id: 'fire', label: 'Fire ($9)' },
          ].map((tab) => {
            const active = tierFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTierFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? isDark
                      ? 'bg-white text-black font-semibold'
                      : 'bg-black text-white font-semibold'
                    : isDark
                    ? 'bg-white/5 text-neutral-400 hover:text-white'
                    : 'bg-black/5 text-neutral-600 hover:text-black'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Clean single-elevation scrollable model table */}
        <div
          className={`rounded-xl border divide-y max-h-[340px] overflow-y-auto slim-scrollbar ${
            isDark
              ? 'border-white/10 divide-white/[0.06]'
              : 'border-black/10 divide-black/[0.06]'
          }`}
        >
          {filteredModels.length === 0 ? (
            <div className={`p-6 text-center text-xs ${mutedText}`}>
              No models match "{modelSearch}".
            </div>
          ) : (
            filteredModels.slice(0, 40).map((m) => {
              const tier = getModelRequiredTier(m);
              const unlocked = UserAccountStore.canUseModel(tier);
              const isSelected = selectedModel.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectDefaultChatModel(m)}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-white/[0.08]'
                        : 'bg-black/[0.05]'
                      : isDark
                      ? 'hover:bg-white/[0.04]'
                      : 'hover:bg-black/[0.03]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{m.name}</div>
                    <div className={`text-[11px] truncate ${mutedText}`}>
                      {m.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
                      {m.contextLength || '128K'} · {m.supportsVision ? 'Vision · ' : ''}
                      {tier === 'free' ? 'Free' : tier === 'spark' ? 'Spark' : 'Fire'}
                    </span>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-[#FC4C01]" />
                    ) : !unlocked ? (
                      <Lock className="w-3.5 h-3.5 text-neutral-500" />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
