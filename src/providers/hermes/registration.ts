// src/providers/hermes/registration.ts
import type { ProviderModule } from '../../core/providers/types';
import { HERMES_CAPABILITIES } from './capabilities';
import { HermesExecutionBackend } from './execution/HermesExecutionBackend';
import { HermesConversationHistoryService } from './history/HermesConversationHistoryService';
import { hermesChatUIConfig } from './ui/HermesChatUIConfig';
import { getHermesProviderSettings, updateHermesProviderSettings } from './settings';

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
  createExecutionBackend: (plugin) => new HermesExecutionBackend(plugin),
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