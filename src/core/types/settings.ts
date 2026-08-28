// src/core/types/settings.ts
export interface HermedianSettings {
  // Hermes Agent settings
  hermes: HermesProviderSettings;
  // Environment
  sharedEnvironmentVariables: string;
  providerConfigs: Record<string, Record<string, unknown>>;
  // UI
  theme: 'system' | 'light' | 'dark';
  fontSize: number;
  // Performance
  maxWarmProcesses: number;
}

export interface HermesProviderSettings {
  enabled: boolean;
  cliPath: string;
  model: string;
  provider: string;
  effortLevel: 'low' | 'medium' | 'high';
  safeMode: 'auto' | 'ask' | 'yolo';
  environmentVariables: string;
  enableMcp: boolean;
  enableBangBash: boolean;
  customModels: string;
}

export const DEFAULT_HERMEDIAN_SETTINGS: HermedianSettings = {
  hermes: {
    enabled: true,
    cliPath: '',
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    provider: 'nvidia-nim',
    effortLevel: 'medium',
    safeMode: 'auto',
    environmentVariables: '',
    enableMcp: true,
    enableBangBash: false,
    customModels: '',
  },
  sharedEnvironmentVariables: '',
  providerConfigs: {
    hermes: {
      model: 'nvidia/llama-3.1-nemotron-70b-instruct',
      provider: 'nvidia-nim',
      effortLevel: 'medium',
      safeMode: 'auto',
    },
  },
  theme: 'system',
  fontSize: 14,
  maxWarmProcesses: 5,
};

export type PermissionMode = 'safe' | 'auto' | 'yolo';
export type EffortLevel = 'low' | 'medium' | 'high';
