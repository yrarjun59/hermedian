// src/providers/hermes/history/HermesConversationHistoryService.ts
import type { ProviderConversationHistoryService } from '../../../core/providers/types';

export class HermesConversationHistoryService implements ProviderConversationHistoryService {
  async hydrateConversationHistory(conversation: unknown, vaultPath: string | null): Promise<void> {
    // TODO: Implement history hydration from Hermes native storage
  }

  resolveSessionIdForConversation(conversation: unknown): string | null {
    // TODO: Extract session ID from conversation metadata
    return null;
  }
}