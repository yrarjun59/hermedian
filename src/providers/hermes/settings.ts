// src/providers/hermes/settings.ts
import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';
import type { HermesProviderSettings } from '../../core/types/settings';
import { DEFAULT_HERMEDIAN_SETTINGS } from '../../core/types/settings';

export function getHermesProviderSettings(settings: Record<string, unknown>): HermesProviderSettings {
  const config = getProviderConfig(settings, 'hermes');
  return {
    enabled: typeof config.enabled === 'boolean' ? config.enabled : DEFAULT_HERMEDIAN_SETTINGS.hermes.enabled,
    cliPath: typeof config.cliPath === 'string' ? config.cliPath : DEFAULT_HERMEDIAN_SETTINGS.hermes.cliPath,
    model: typeof config.model === 'string' ? config.model : DEFAULT_HERMEDIAN_SETTINGS.hermes.model,
    effortLevel: typeof config.effortLevel === 'string' ? config.effortLevel as any : DEFAULT_HERMEDIAN_SETTINGS.hermes.effortLevel,
    safeMode: typeof config.safeMode === 'string' ? config.safeMode as any : DEFAULT_HERMEDIAN_SETTINGS.hermes.safeMode,
    environmentVariables: typeof config.environmentVariables === 'string' ? config.environmentVariables : DEFAULT_HERMEDIAN_SETTINGS.hermes.environmentVariables,
    enableMcp: typeof config.enableMcp === 'boolean' ? config.enableMcp : DEFAULT_HERMEDIAN_SETTINGS.hermes.enableMcp,
    enableBangBash: typeof config.enableBangBash === 'boolean' ? config.enableBangBash : DEFAULT_HERMEDIAN_SETTINGS.hermes.enableBangBash,
    customModels: typeof config.customModels === 'string' ? config.customModels : DEFAULT_HERMEDIAN_SETTINGS.hermes.customModels,
  };
}

export function updateHermesProviderSettings(
  settings: Record<string, unknown>,
  partial: Partial<HermesProviderSettings>
): void {
  const current = getHermesProviderSettings(settings);
  setProviderConfig(settings, 'hermes', { ...current, ...partial });
}