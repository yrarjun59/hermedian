// src/providers/hermes/settings.ts
import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';
import type { HermesProviderSettings } from '../../core/types/settings';
import { DEFAULT_HERMEDIAN_SETTINGS } from '../../core/types/settings';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

export function getHermesProviderSettings(settings: Record<string, unknown>): HermesProviderSettings {
  const config = getProviderConfig(settings, 'hermes');
  return {
    enabled: typeof config.enabled === 'boolean' ? config.enabled : DEFAULT_HERMEDIAN_SETTINGS.hermes.enabled,
    cliPath: typeof config.cliPath === 'string' ? config.cliPath : DEFAULT_HERMEDIAN_SETTINGS.hermes.cliPath,
    model: typeof config.model === 'string' ? config.model : DEFAULT_HERMEDIAN_SETTINGS.hermes.model,
    provider: typeof config.provider === 'string' ? config.provider : 'nvidia-nim',
    effortLevel: typeof config.effortLevel === 'string' ? config.effortLevel as HermesProviderSettings['effortLevel'] : DEFAULT_HERMEDIAN_SETTINGS.hermes.effortLevel,
    safeMode: typeof config.safeMode === 'string' ? config.safeMode as HermesProviderSettings['safeMode'] : DEFAULT_HERMEDIAN_SETTINGS.hermes.safeMode,
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

/**
 * Resolves the Hermes CLI path from settings or PATH.
 * Returns the absolute path to the hermes executable.
 */
export async function resolveCliPath(cliPathSetting: string): Promise<string> {
  // If user specified a path, use it
  if (cliPathSetting && cliPathSetting.trim()) {
    const trimmed = cliPathSetting.trim();
    if (existsSync(trimmed)) {
      return trimmed;
    }
    // If it's just a command name (e.g., "hermes"), try to find it in PATH
  }

  // Try to find hermes in PATH using 'which' via execFile
  const execFileAsync = promisify(execFile);
  try {
    const { stdout } = await execFileAsync('which', ['hermes']);
    const path = stdout.trim();
    if (path) return path;
  } catch {
    // which failed, try common locations
  }

  // Fallback to common locations
  const commonPaths = [
    '/usr/local/bin/hermes',
    '/opt/homebrew/bin/hermes',
    '/usr/bin/hermes',
    process.env.HOME + '/.local/bin/hermes',
  ];
  for (const p of commonPaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  throw new Error('Hermes CLI not found. Please install Hermes Agent or set the CLI path in settings.');
}