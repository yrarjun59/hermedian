import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import type {
  ProviderCapabilities,
  ProviderChatUIConfig,
  ProviderConversationHistoryService,
  ProviderTaskResultInterpreter,
  ProviderSettingsReconciler,
} from '@/core/providers/types';

// Minimal mock registration factory — conforms to real ProviderRegistration shape
function makeRegistration(
  overrides: Partial<ReturnType<typeof makeRegistration>> = {}
): ReturnType<typeof makeRegistration> {
  const baseCaps: ProviderCapabilities = {
    providerId: 'test-provider',
    supportsNativeHistory: true,
    supportsPlanMode: true,
    supportsRewind: true,
    supportsFork: true,
    supportsProviderCommands: true,
    supportsImageAttachments: true,
    supportsInstructionMode: true,
    reasoningControl: 'effort',
  };
  const baseUI: ProviderChatUIConfig = {
    getModelOptions: () => [],
    ownsModel: () => false,
    isAdaptiveReasoningModel: () => false,
    getReasoningOptions: () => [],
    getDefaultReasoningValue: () => 'medium',
    getContextWindowSize: () => 128000,
    isDefaultModel: () => false,
    applyModelDefaults: () => {},
    normalizeModelVariant: (m: string) => m,
    getCustomModelIds: () => new Set(),
  };
  const baseHistory: ProviderConversationHistoryService = {
    hydrateConversationHistory: async () => {},
    resolveSessionIdForConversation: () => null,
  };
  const baseTask: ProviderTaskResultInterpreter = {
    hasAsyncLaunchMarker: () => false,
    extractAgentId: () => null,
    extractStructuredResult: () => null,
    resolveTerminalStatus: () => 'completed',
    extractTagValue: () => null,
  };
  const baseReconciler: ProviderSettingsReconciler = {
    invalidateConversationSessions: () => [],
    reconcileModelWithEnvironment: () => ({ changed: false, invalidatedConversations: [] }),
    normalizeModelVariantSettings: () => true,
  };

  return {
    displayName: 'Test Provider',
    blankTabOrder: 10,
    isEnabled: (_settings: Record<string, unknown>) => true,
    capabilities: { ...baseCaps, ...overrides.capabilities },
    chatUIConfig: { ...baseUI, ...overrides.chatUIConfig },
    settingsReconciler: { ...baseReconciler, ...overrides.settingsReconciler },
    createExecutionBackend: () => ({}),
    historyService: { ...baseHistory, ...overrides.historyService },
    taskResultInterpreter: { ...baseTask, ...overrides.taskResultInterpreter },
    ...overrides,
  };
}

describe('ProviderRegistry', () => {
  beforeEach(() => {
    // Reset static state between tests by clearing registrations
    ProviderRegistry['registrations'] = {};
  });

  describe('register / getRegistration', () => {
    it('registers and retrieves a provider', () => {
      const reg = makeRegistration();
      ProviderRegistry.register('test-provider', reg);

      // Access private static field for test isolation
      const stored = (ProviderRegistry as any).registrations['test-provider'];
      expect(stored).toBe(reg);
    });

    it('throws when retrieving via public API for unregistered provider', () => {
      expect(() => ProviderRegistry.getCapabilities('non-existent'))
        .toThrow('Provider "non-existent" is not registered.');
    });
  });

  describe('getCapabilities', () => {
    it('returns provider capabilities', () => {
      const caps: ProviderCapabilities = {
        providerId: 'caps-provider',
        supportsNativeHistory: true,
        supportsPlanMode: false,
        supportsRewind: true,
        supportsFork: false,
        supportsProviderCommands: true,
        supportsImageAttachments: false,
        supportsInstructionMode: true,
        reasoningControl: 'effort',
        planPathPrefix: '/plans',
      };
      ProviderRegistry.register('caps-provider', makeRegistration({ capabilities: caps }));

      const result = ProviderRegistry.getCapabilities('caps-provider');
      expect(result.supportsNativeHistory).toBe(true);
      expect(result.supportsPlanMode).toBe(false);
      expect(result.supportsRewind).toBe(true);
    });

    it('throws for unregistered provider', () => {
      expect(() => ProviderRegistry.getCapabilities('ghost'))
        .toThrow('Provider "ghost" is not registered.');
    });
  });

  describe('getChatUIConfig', () => {
    it('returns chat UI configuration', () => {
      const config: ProviderChatUIConfig = {
        getModelOptions: () => [{ value: 'test', label: 'Test' }],
        ownsModel: () => false,
        isAdaptiveReasoningModel: () => false,
        getReasoningOptions: () => [],
        getDefaultReasoningValue: () => 'medium',
        getContextWindowSize: () => 128000,
        isDefaultModel: () => false,
        applyModelDefaults: () => {},
        normalizeModelVariant: (m) => m,
        getCustomModelIds: () => new Set(),
      };
      ProviderRegistry.register('ui-provider', makeRegistration({ chatUIConfig: config }));

      const result = ProviderRegistry.getChatUIConfig('ui-provider');
      expect(result.getModelOptions({}).length).toBe(1);
    });

    it('throws for unregistered provider', () => {
      expect(() => ProviderRegistry.getChatUIConfig('ghost'))
        .toThrow('Provider "ghost" is not registered.');
    });
  });

  describe('getConversationHistoryService', () => {
    it('returns history service', () => {
      const service: ProviderConversationHistoryService = {
        hydrateConversationHistory: jest.fn().mockResolvedValue(undefined),
        resolveSessionIdForConversation: jest.fn().mockReturnValue('sess-1'),
      };
      ProviderRegistry.register('hist-provider', makeRegistration({ historyService: service }));

      const result = ProviderRegistry.getConversationHistoryService('hist-provider');
      expect(result).toBe(service);
    });

    it('throws for unregistered provider', () => {
      expect(() => ProviderRegistry.getConversationHistoryService('ghost'))
        .toThrow('Provider "ghost" is not registered.');
    });
  });

  describe('getTaskResultInterpreter', () => {
    it('returns task result interpreter', () => {
      const interpreter: ProviderTaskResultInterpreter = {
        hasAsyncLaunchMarker: () => false,
        extractAgentId: () => null,
        extractStructuredResult: () => null,
        resolveTerminalStatus: () => 'completed',
        extractTagValue: () => null,
      };
      ProviderRegistry.register('task-provider', makeRegistration({ taskResultInterpreter: interpreter }));

      const result = ProviderRegistry.getTaskResultInterpreter('task-provider');
      expect(result.hasAsyncLaunchMarker('test')).toBe(false);
    });

    it('throws for unregistered provider', () => {
      expect(() => ProviderRegistry.getTaskResultInterpreter('ghost'))
        .toThrow('Provider "ghost" is not registered.');
    });
  });

  describe('getSettingsReconciler', () => {
    it('returns settings reconciler', () => {
      const reconciler: ProviderSettingsReconciler = {
        invalidateConversationSessions: () => [],
        reconcileModelWithEnvironment: () => ({ changed: false, invalidatedConversations: [] }),
        normalizeModelVariantSettings: () => true,
      };
      ProviderRegistry.register('set-provider', makeRegistration({ settingsReconciler: reconciler }));

      const result = ProviderRegistry.getSettingsReconciler('set-provider');
      expect(result.normalizeModelVariantSettings({})).toBe(true);
    });

    it('throws for unregistered provider', () => {
      expect(() => ProviderRegistry.getSettingsReconciler('ghost'))
        .toThrow('Provider "ghost" is not registered.');
    });
  });

  describe('getSettingsStorageAdapter', () => {
    it('throws when provider does not own settings storage', () => {
      ProviderRegistry.register('no-storage-provider', makeRegistration());

      expect(() => ProviderRegistry.getSettingsStorageAdapter('no-storage-provider'))
        .toThrow('Provider "no-storage-provider" does not own settings storage.');
    });

    it('throws for unregistered provider', () => {
      expect(() => ProviderRegistry.getSettingsStorageAdapter('ghost'))
        .toThrow('Provider "ghost" is not registered.');
    });

    it('avoids calling when storage is absent', () => {
      ProviderRegistry.register('plain', makeRegistration());
      expect(() => ProviderRegistry.getSettingsStorageAdapter('plain'))
        .toThrow(/does not own settings storage/);
    });
  });

  describe('getRegisteredProviderIds', () => {
    it('returns all registered provider IDs', () => {
      ProviderRegistry.register('p1', makeRegistration());
      ProviderRegistry.register('p2', makeRegistration());
      ProviderRegistry.register('p3', makeRegistration());

      const ids = ProviderRegistry.getRegisteredProviderIds();
      expect(ids).toContain('p1');
      expect(ids).toContain('p2');
      expect(ids).toContain('p3');
      expect(ids).toHaveLength(3);
    });

    it('returns empty array when no providers registered', () => {
      const ids = ProviderRegistry.getRegisteredProviderIds();
      expect(ids).toEqual([]);
    });
  });

  describe('getProviderDisplayName', () => {
    it('returns display name', () => {
      ProviderRegistry.register('display-provider', makeRegistration({ displayName: 'My Custom Provider' }));

      expect(ProviderRegistry.getProviderDisplayName('display-provider')).toBe('My Custom Provider');
    });

    it('throws for unregistered provider', () => {
      expect(() => ProviderRegistry.getProviderDisplayName('ghost'))
        .toThrow('Provider "ghost" is not registered.');
    });
  });

  describe('isEnabled', () => {
    it('returns true when provider is enabled', () => {
      ProviderRegistry.register('enabled-provider', makeRegistration({
        isEnabled: () => true,
      }));
      expect(ProviderRegistry.isEnabled('enabled-provider', {})).toBe(true);
    });

    it('returns false when provider is disabled', () => {
      ProviderRegistry.register('disabled-provider', makeRegistration({
        isEnabled: () => false,
      }));
      expect(ProviderRegistry.isEnabled('disabled-provider', {})).toBe(false);
    });

    it('throws for unregistered provider', () => {
      expect(() => ProviderRegistry.isEnabled('ghost', {}))
        .toThrow('Provider "ghost" is not registered.');
    });
  });

  describe('getEnabledProviderIds', () => {
    it('returns only enabled providers sorted by blankTabOrder', () => {
      ProviderRegistry.register('late', makeRegistration({
        isEnabled: () => true,
        blankTabOrder: 30,
      }));
      ProviderRegistry.register('early', makeRegistration({
        isEnabled: () => true,
        blankTabOrder: 10,
      }));
      ProviderRegistry.register('disabled-one', makeRegistration({
        isEnabled: () => false,
        blankTabOrder: 5,
      }));
      ProviderRegistry.register('mid', makeRegistration({
        isEnabled: () => true,
        blankTabOrder: 20,
      }));

      const enabled = ProviderRegistry.getEnabledProviderIds({});
      expect(enabled).toEqual(['early', 'mid', 'late']);
    });

    it('returns empty when all disabled', () => {
      ProviderRegistry.register('off1', makeRegistration({ isEnabled: () => false }));
      ProviderRegistry.register('off2', makeRegistration({ isEnabled: () => false }));

      const enabled = ProviderRegistry.getEnabledProviderIds({});
      expect(enabled).toEqual([]);
    });
  });

  describe('registration immutability / overwrites', () => {
    it('allows overwriting a registration', () => {
      const v1 = makeRegistration({ displayName: 'Version 1' });
      ProviderRegistry.register('overwrite', v1);
      expect(ProviderRegistry.getProviderDisplayName('overwrite')).toBe('Version 1');

      const v2 = makeRegistration({ displayName: 'Version 2' });
      ProviderRegistry.register('overwrite', v2);
      expect(ProviderRegistry.getProviderDisplayName('overwrite')).toBe('Version 2');
    });
  });
});
