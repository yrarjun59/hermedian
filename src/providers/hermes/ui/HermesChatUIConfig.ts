// src/providers/hermes/ui/HermesChatUIConfig.ts
import type { ProviderChatUIConfig, ProviderReasoningOption,ProviderUIOption } from '../../../core/providers/types';
import type { HermesProviderSettings } from '../../../core/types/settings';

const HERMES_MODELS: ProviderUIOption[] = [
  { value: 'sonnet', label: 'Sonnet', description: 'Balanced speed and capability' },
  { value: 'opus', label: 'Opus', description: 'Most capable, slower' },
  { value: 'haiku', label: 'Haiku', description: 'Fastest, good for simple tasks' },
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
    return 'sonnet';
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