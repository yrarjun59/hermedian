// src/core/providers/ProviderHost.ts
import type { App } from 'obsidian';

import type { SharedAppStorage } from '../bootstrap/storage';
import type { ProviderExecutionLifecycleRegistry } from '../execution';
import type { HermedianSettings } from '../types/settings';
import type { EnvironmentScope,ProviderId } from './types';

/**
 * Application capabilities available to provider adapters.
 * 
 * The host deliberately excludes plugin lifecycle, command registration, and
 * conversation ownership. Providers receive only the settings, environment,
 * path, CLI, storage, and interaction capabilities they currently consume.
 */
export interface ProviderHost {
  readonly app: App;
  readonly executionLifecycleRegistry: ProviderExecutionLifecycleRegistry;
  readonly settings: HermedianSettings;
  readonly storage: SharedAppStorage;
  readonly manifest?: { version?: string };

  saveSettings(): Promise<void>;
  mutateSettings(
    mutation: (settings: HermedianSettings) => void | Promise<void>,
  ): Promise<void>;
  mutateSettingsConditionally(
    mutation: (settings: HermedianSettings) => boolean | Promise<boolean>,
  ): Promise<void>;
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
  normalizeModelVariantSettings(): boolean;

  getActiveEnvironmentVariables(providerId: ProviderId): string;
  getEnvironmentVariablesForScope(scope: EnvironmentScope): string;
  applyEnvironmentVariables(scope: EnvironmentScope, envText: string): Promise<void>;
  applyEnvironmentVariablesBatch(
    updates: Array<{ scope: EnvironmentScope; envText: string }>,
  ): Promise<void>;
  /**
   * Persists runtime inputs, their reconciled fingerprints, and any durable
   * session-invalidation marker in one settings transaction.
   */
  applyProviderRuntimeSettings(
    providerIds: ProviderId[],
    mutation: (settings: HermedianSettings) => void | Promise<void>,
    onApplied?: () => void | Promise<void>,
  ): Promise<void>;
  getResolvedProviderCliPath(
    providerId: ProviderId,
    context?: { executionTarget?: unknown },
  ): Promise<string | null>;
  runProviderExecutionTransition<T>(
    providerIds: ProviderId[],
    mutation: (scope: { providerIds: string[]; generation: number }) => Promise<T>,
    parentScope?: { providerIds: string[]; generation: number },
  ): Promise<T>;

  notifyProviderChatOptionsChanged(providerId: ProviderId): void;
}