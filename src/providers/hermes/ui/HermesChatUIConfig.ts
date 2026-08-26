// src/providers/hermes/ui/HermesChatUIConfig.ts
import type { ProviderChatUIConfig, ProviderReasoningOption, ProviderUIOption } from '../../../core/providers/types';

// All available free models from NVIDIA NIM and Nous Research
const HERMES_MODELS: ProviderUIOption[] = [
  { value: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Llama 3.1 Nemotron 70B', description: 'Best coding model' },
  { value: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', label: 'Llama 3.3 Nemotron Super 49B', description: 'Strong coding + UI' },
  { value: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'Nemotron 3 Ultra (550B)', description: 'Best reasoning' },
  { value: 'nvidia/nemotron-3-super-120b-a12b', label: 'Nemotron 3 Super (120B)', description: 'Strong reasoning' },
  { value: 'nvidia/llama-3.1-nemotron-51b-instruct', label: 'Llama 3.1 Nemotron 51B', description: 'Balanced' },
  { value: 'nvidia/nemotron-3-nano-30b-a3b', label: 'Nemotron 3 Nano (30B)', description: 'Fast' },
  { value: 'nvidia/nemotron-mini-4b-instruct', label: 'Nemotron Mini (4B)', description: 'Tiny, fast' },
  { value: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', label: 'Llama 3.1 Nemotron Ultra 253B', description: 'Largest' },
];

const EFFORT_LEVELS: ProviderReasoningOption[] = [
  { value: 'low', label: 'Low', tokens: 1000 },
  { value: 'medium', label: 'Medium', tokens: 5000 },
  { value: 'high', label: 'High', tokens: 20000 },
];

export const hermesChatUIConfig: ProviderChatUIConfig = {
  getModelOptions(_settings: Record<string, unknown>): ProviderUIOption[] {
    return HERMES_MODELS;
  },

  getDefaultModel(_settings: Record<string, unknown>): string | null {
    return 'nvidia/llama-3.1-nemotron-70b-instruct';
  },

  ownsModel(model: string, _settings: Record<string, unknown>): boolean {
    return HERMES_MODELS.some(m => m.value === model);
  },

  isAdaptiveReasoningModel(_model: string, _settings: Record<string, unknown>): boolean {
    return false;
  },

  getReasoningOptions(_model: string, _settings: Record<string, unknown>): ProviderReasoningOption[] {
    return EFFORT_LEVELS;
  },

  getDefaultReasoningValue(_model: string, _settings: Record<string, unknown>): string {
    return 'medium';
  },

  getContextWindowSize(_model: string): number {
    return 200000;
  },

  isDefaultModel(model: string): boolean {
    return HERMES_MODELS.some(m => m.value === model);
  },

  applyModelDefaults(model: string, settings: unknown): void {
    const s = settings as Record<string, unknown>;
    s.hermesModel = model;
  },

  normalizeModelVariant(model: string, _settings: Record<string, unknown>): string {
    return HERMES_MODELS.find(m => m.value === model)?.value ?? model;
  },

  getCustomModelIds(_envVars: Record<string, string>): Set<string> {
    return new Set();
  },
};