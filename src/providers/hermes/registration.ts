// src/providers/hermes/registration.ts
import type { ProviderHost } from '../../core/providers/ProviderHost';
import type { ProviderModule } from '../../core/providers/types';
import { HERMES_CAPABILITIES } from './capabilities';
import { HermesExecutionBackend } from './execution/HermesExecutionBackend';
import { HermesConversationHistoryService } from './history/HermesConversationHistoryService';
import { getHermesProviderSettings, updateHermesProviderSettings, resolveCliPath } from './settings';
import { hermesChatUIConfig } from './ui/HermesChatUIConfig';

export const hermesProviderRegistration: ProviderModule = {
  id: 'hermes',
  displayName: 'Hermes Agent',
  blankTabOrder: 10,
  isEnabled: (settings) => getHermesProviderSettings(settings).enabled,
  setEnabled: (settings, enabled) => updateHermesProviderSettings(settings, { enabled }),
  capabilities: HERMES_CAPABILITIES,
  environmentKeyPatterns: [/^HERMES_/i, /^HERMES_AGENT_/i],
  chatUIConfig: hermesChatUIConfig,
  settingsReconciler: {
    invalidateConversationSessions: () => [],
    reconcileModelWithEnvironment: () => ({ changed: false, invalidatedConversations: [] }),
    normalizeModelVariantSettings: () => false,
  },
  settingsStorage: {
    hostScopedFields: ['cliPathsByHost'],
    legacyTopLevelFields: ['hermesCliPath', 'hermesSafeMode', 'hermesEnabled'],
    normalizeStored: () => false,
  },
  createExecutionBackend: (plugin: ProviderHost) => {
    const settings = getHermesProviderSettings(plugin.settings as unknown as Record<string, unknown>);
    // Resolve CLI path synchronously - fallback to default if not found
    const cliPath = settings.cliPath || 'hermes';
    return new HermesExecutionBackend(plugin, cliPath);
  },
  historyService: new HermesConversationHistoryService(),
  taskResultInterpreter: {
    hasAsyncLaunchMarker: () => false,
    extractAgentId: () => null,
    extractStructuredResult: () => null,
    resolveTerminalStatus: (_, fallback) => fallback,
    extractTagValue: () => null,
  },
  workspace: {
    initialize: async () => ({
      refreshAgentMentions: async () => {},
      dispose: async () => {},
    }),
  },
};