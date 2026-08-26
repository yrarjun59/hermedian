// src/features/chat/TabManager.ts
import { Conversation } from '@/core/types/chat';
import { ConversationRepository } from '@/core/bootstrap/ConversationRepository';

export class TabManager {
  private tabs: Map<string, Conversation> = new Map();
  private activeTabId: string | null = null;

  constructor(private repo: ConversationRepository) {}

  async createTab(): Promise<string> {
    const conversation = {
      id: crypto.randomUUID(),
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      providerId: 'hermes',
      model: 'nvidia/nemotron-3-super-120b-a12b',
      messageCount: 0,
      providerState: {},
      sessionId: null,
      messages: []
    };
    await this.repo.create(conversation);
    this.tabs.set(conversation.id, conversation);
    this.setActiveTab(conversation.id);
    return conversation.id;
  }

  setActiveTab(tabId: string): void {
    if (!this.tabs.has(tabId)) {
      throw new Error(`Tab ${tabId} does not exist`);
    }
    this.activeTabId = tabId;
  }

  getActiveTab(): Conversation | null {
    return this.activeTabId ? this.tabs.get(this.activeTabId) ?? null : null;
  }

  getTab(tabId: string): Conversation | null {
    return this.tabs.get(tabId) ?? null;
  }

  closeTab(tabId: string): void {
    this.tabs.delete(tabId);
    if (this.activeTabId === tabId) {
      // Activate another tab if available
      const firstTab = this.tabs.keys().next().value;
      this.activeTabId = firstTab ?? null;
    }
  }

  listTabs(): string[] {
    return Array.from(this.tabs.keys());
  }
}
