// src/core/providers/providerConfig.ts
export function getProviderConfig(settings: Record<string, unknown>, providerId: string): Record<string, unknown> {
  if (!settings.providerConfigs) return {} as Record<string, unknown>;
  const configs = settings.providerConfigs as Record<string, unknown>;
  const config = configs[providerId];
  return config && typeof config === 'object' ? config as Record<string, unknown> : {} as Record<string, unknown>;
}

export function setProviderConfig(
  settings: Record<string, unknown>,
  providerId: string,
  config: Record<string, unknown>
): void {
  if (!settings.providerConfigs) {
    settings.providerConfigs = {};
  }
  const configs = settings.providerConfigs as Record<string, unknown>;
  configs[providerId] = config;
}