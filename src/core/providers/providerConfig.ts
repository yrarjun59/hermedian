// src/core/providers/providerConfig.ts
export function getProviderConfig(settings: Record<string, unknown>, providerId: string): Record<string, unknown> {
  if (!settings.providerConfigs) return {};
  const config = settings.providerConfigs[providerId];
  return config && typeof config === 'object' ? config : {};
}

export function setProviderConfig(
  settings: Record<string, unknown>,
  providerId: string,
  config: Record<string, unknown>
): void {
  if (!settings.providerConfigs) {
    settings.providerConfigs = {};
  }
  (settings.providerConfigs as Record<string, unknown>)[providerId] = config;
}