// src/core/providers/ProviderRegistry.ts
import type { ProviderCapabilities, ProviderChatUIConfig, ProviderConversationHistoryService, ProviderId, ProviderRegistration, ProviderSettingsReconciler, ProviderSettingsStorageAdapter,ProviderTaskResultInterpreter } from './types';

export class ProviderRegistry {
  private static registrations: Partial<Record<ProviderId, ProviderRegistration>> = {};

  static register(providerId: ProviderId, registration: ProviderRegistration): void {
    this.registrations[providerId] = registration;
  }

  private static getRegistration(providerId: ProviderId): ProviderRegistration {
    const registration = this.registrations[providerId];
    if (!registration) {
      throw new Error(`Provider "${providerId}" is not registered.`);
    }
    return registration;
  }

  static getCapabilities(providerId: ProviderId): ProviderCapabilities {
    return this.getRegistration(providerId).capabilities;
  }

  static getChatUIConfig(providerId: ProviderId): ProviderChatUIConfig {
    return this.getRegistration(providerId).chatUIConfig;
  }

  static getConversationHistoryService(providerId: ProviderId): ProviderConversationHistoryService {
    return this.getRegistration(providerId).historyService;
  }

  static getTaskResultInterpreter(providerId: ProviderId): ProviderTaskResultInterpreter {
    return this.getRegistration(providerId).taskResultInterpreter;
  }

  static getSettingsReconciler(providerId: ProviderId): ProviderSettingsReconciler {
    return this.getRegistration(providerId).settingsReconciler;
  }

  static getSettingsStorageAdapter(providerId: ProviderId): ProviderSettingsStorageAdapter {
    const registration = this.getRegistration(providerId);
    if (!('settingsStorage' in registration)) {
      throw new Error(`Provider "${providerId}" does not own settings storage.`);
    }
    return registration.settingsStorage as ProviderSettingsStorageAdapter;
  }

  static getRegisteredProviderIds(): ProviderId[] {
    return Object.keys(this.registrations);
  }

  static getProviderDisplayName(providerId: ProviderId): string {
    return this.getRegistration(providerId).displayName;
  }

  static isEnabled(providerId: ProviderId, settings: Record<string, unknown>): boolean {
    return this.getRegistration(providerId).isEnabled(settings);
  }

  static getEnabledProviderIds(settings: Record<string, unknown>): ProviderId[] {
    return this.getRegisteredProviderIds()
      .filter(id => this.getRegistration(id).isEnabled(settings))
      .sort((a, b) => this.getRegistration(a).blankTabOrder - this.getRegistration(b).blankTabOrder);
  }
}