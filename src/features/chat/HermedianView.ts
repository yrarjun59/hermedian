// src/features/chat/HermedianView.ts
import type { WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, setIcon } from 'obsidian';

import { ProviderRegistry } from '../../core/providers/ProviderRegistry';
import { VIEW_TYPE_HERMEDIAN } from '../../core/types/chat';
import type { Conversation } from '../../core/types/chat';
import type { InputLedgerEntry } from '../../core/bootstrap/ConversationRepository';
import { ConversationRepository } from '../../core/bootstrap/ConversationRepository';
import { TabManager } from './TabManager';

// Define ConversationWithLedger since it's not exported from core/types/chat
interface ConversationWithLedger {
  conversation: Conversation;
  ledger: InputLedgerEntry[];
}

export class HermedianView extends ItemView {
  private plugin: any;
  private messageContainer: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private conversationRepo: ConversationRepository;
  private tabManager: TabManager;
  private providerRegistry: ProviderRegistry;
  private currentConversationId: string | null = null;
  private historySidebarEl: HTMLElement | null = null;
  private isHistorySidebarOpen: boolean = false;

  constructor(leaf: WorkspaceLeaf, plugin: any) {
    super(leaf);
    this.plugin = plugin;
    this.conversationRepo = new ConversationRepository(plugin.app.vault.adapter);
    this.providerRegistry = ProviderRegistry;
    this.tabManager = new TabManager(this.conversationRepo);
  }

  getViewType(): string {
    return VIEW_TYPE_HERMEDIAN;
  }

  getDisplayText(): string {
    return 'Hermedian';
  }

  getIcon(): string {
    return 'bot';
  }

  async onload(): Promise<void> {
    console.log('Hermedian view loaded');
    await this.conversationRepo.initialize();
    this.containerEl.empty();
    this.containerEl.addClass('hermedian-view');

    // Build UI
    this.createHeader();
    this.createMessageArea();
    this.createInputArea();
    
    // Load last conversation or create new one
    await this.loadOrCreateConversation();
  }

  async onunload(): Promise<void> {
    console.log('Hermedian view unloaded');
  }

  private createHeader(): void {
    const header = this.containerEl.createDiv({ cls: 'hermedian-header' });
    
    header.createSpan({ cls: 'hermedian-title', text: 'Hermes Agent' });
    
    const actions = header.createDiv({ cls: 'hermedian-actions' });

    // New conversation button
    const newBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'New conversation' });
    setIcon(newBtn, 'plus');
    newBtn.addEventListener('click', () => this.createNewConversation());

    // History sidebar button
    const historyBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'History' });
    setIcon(historyBtn, 'clock');
    historyBtn.addEventListener('click', () => this.toggleHistorySidebar());

    // Settings button
    const settingsBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'Settings' });
    setIcon(settingsBtn, 'settings');
    settingsBtn.addEventListener('click', () => {
      (this.app as unknown as { setting?: { openTabById?: (id: string) => void } }).setting?.openTabById?.('hermedian');
    });
  }

  private createHistorySidebar(): void {
    if (this.historySidebarEl) return;
    
    this.historySidebarEl = this.containerEl.createDiv({ cls: 'hermedian-history-sidebar' });
    this.historySidebarEl.createDiv({ cls: 'hermedian-history-sidebar-header', text: 'Conversation History' });
    
    const historyList = this.historySidebarEl.createDiv({ cls: 'hermedian-history-list' });
    this.historySidebarEl.appendChild(historyList);
    
    // Load conversations
    this.loadConversationHistory(historyList);
  }

  private async loadConversationHistory(container: HTMLElement): Promise<void> {
    container.empty();
    const conversations = await this.conversationRepo.list();
    
    for (const meta of conversations) {
      const item = container.createDiv({ cls: 'hermedian-history-item' });
      item.createSpan({ text: meta.title || `Conversation ${meta.id.substring(0, 8)}` });
      item.addEventListener('click', () => this.loadConversation(meta.id));
      
      // Highlight current conversation
      if (meta.id === this.currentConversationId) {
        item.addClass('hermedian-history-item-active');
      }
    }
  }

  private toggleHistorySidebar(): void {
    this.isHistorySidebarOpen = !this.isHistorySidebarOpen;
    if (this.historySidebarEl) {
      this.historySidebarEl.toggleClass('hermedian-history-sidebar-open', this.isHistorySidebarOpen);
    }
    if (this.isHistorySidebarOpen && this.historySidebarEl) {
      const listEl = this.historySidebarEl.querySelector('.hermedian-history-list') as HTMLElement;
      this.loadConversationHistory(listEl);
    }
  }

  private createMessageArea(): void {
    this.messageContainer = this.containerEl.createDiv({ cls: 'hermedian-messages' });
    
    // Welcome message
    const welcome = this.messageContainer.createDiv({ cls: 'hermedian-message assistant' });
    const welcomeContent = welcome.createDiv({ cls: 'hermedian-message-content' });
    welcomeContent.createEl('p', { 
      text: 'Hello! I\'m Hermes Agent, your AI coding assistant. I can read, write, and edit files in your vault. How can I help?'
    });
  }

  private createInputArea(): void {
    const inputArea = this.containerEl.createDiv({ cls: 'hermedian-input-area' });
    
    this.inputEl = inputArea.createEl('textarea', {
      cls: 'hermedian-input',
      attr: { placeholder: 'Ask Hermes... (Shift+Enter for newline)' }
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    const sendBtn = inputArea.createEl('button', { 
      cls: 'hermedian-send-btn',
      text: 'Send'
    });
    sendBtn.addEventListener('click', () => this.sendMessage());
  }

  private async sendMessage(): Promise<void> {
    if (!this.inputEl) return;
    
    const text = this.inputEl.value.trim();
    if (!text) return;

    // Add user message to chat
    this.addMessage('user', text);
    this.inputEl.value = '';
    this.inputEl.disabled = true;

    // Add assistant placeholder
    const assistantMsg = this.addMessage('assistant', 'Thinking...');

    try {
      // Get or create conversation
      let conversation: Conversation;
      if (this.currentConversationId) {
        const loaded = await this.conversationRepo.load(this.currentConversationId);
        if (!loaded) {
          // Create new conversation if not found
          conversation = {
            id: this.currentConversationId,
            title: `Conversation ${this.currentConversationId.substring(0, 8)}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            providerId: 'hermes',
            model: 'nvidia/nemotron-3-super-120b-a12b',
            messageCount: 0,
            providerState: {},
            sessionId: null,
            messages: []
          };
          await this.conversationRepo.create(conversation);
        } else {
          conversation = loaded.conversation;
        }
      } else {
        // Create new conversation
        conversation = {
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
        await this.conversationRepo.create(conversation);
        this.currentConversationId = conversation.id;
      }

      // Append user message to ledger
      await this.conversationRepo.appendToLedger(this.currentConversationId, {
        messageId: crypto.randomUUID(),
        userMessage: text,
        timestamp: Date.now(),
        contextFiles: [] // TODO: Get from UI state
      });

      // For now, we'll simulate the backend interaction since we don't have direct access to HermesExecutionBackend
      // In a full implementation, this would use the HermesExecutionBackend from ProviderRegistry
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate streaming response
      const fullResponse = `I received your message: "${text}". This is a simulated response while we work on the full Hermes integration.`;
      
      // Simulate streaming by updating every few characters
      for (let i = 0; i < fullResponse.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 20)); // 20ms delay per character
        this.updateMessage(assistantMsg, fullResponse.substring(0, i + 1));
      }

      // Update conversation metadata - correct signature
      await this.conversationRepo.updateSessionMetadata(this.currentConversationId, `simulated-session-${Date.now()}`, {});
      
      // Update conversation with latest message count
      const updatedConversation = await this.conversationRepo.load(this.currentConversationId);
      if (updatedConversation) {
        updatedConversation.conversation.messageCount += 2; // User + assistant
        await this.conversationRepo.update(updatedConversation.conversation);
      }

    } catch (error) {
      this.updateMessage(assistantMsg, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error in sendMessage:', error);
    } finally {
      this.inputEl.disabled = false;
      this.inputEl.focus();
    }
  }

  private addMessage(role: 'user' | 'assistant', text: string): HTMLElement {
    if (!this.messageContainer) return document.createElement('div');
    
    const msg = this.messageContainer.createDiv({ 
      cls: `hermedian-message ${role}` 
    });
    const content = msg.createDiv({ cls: 'hermedian-message-content' });
    content.createEl('p', { text });
    
    this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    
    return content;
  }

  private updateMessage(contentEl: HTMLElement, text: string): void {
    contentEl.empty();
    contentEl.createEl('p', { text });
  }

  private async createNewConversation(): Promise<void> {
    if (this.messageContainer) {
      this.messageContainer.empty();
      const welcome = this.messageContainer.createDiv({ cls: 'hermedian-message assistant' });
      const welcomeContent = welcome.createDiv({ cls: 'hermedian-message-content' });
      welcomeContent.createEl('p', { text: 'New conversation started. How can I help?' });
    }
    
    const conversationId = await this.tabManager.createTab(); // Create new tab and get conversation ID
    this.currentConversationId = conversationId;
    
    new Notice('New conversation started');
  }

  private async loadConversation(conversationId: string): Promise<void> {
    const loaded = await this.conversationRepo.load(conversationId);
    if (!loaded) {
      new Notice('Conversation not found');
      return;
    }
    
    this.currentConversationId = conversationId;
    this.loadConversationIntoView(loaded);
    
    // Resume session via resumeSeed would go here
    // For now, we just load the conversation
    
    new Notice('Conversation loaded');
  }

  private loadConversationIntoView(loaded: ConversationWithLedger): void {
    if (!this.messageContainer) return;
    
    this.messageContainer.empty();
    
    // Load messages from ledger
    for (const entry of loaded.ledger) {
      this.addMessage('user', entry.userMessage);
      // In a full implementation, we would also load assistant messages from session history
    }
    
    // Add welcome if no messages
    if (loaded.ledger.length === 0) {
      const welcome = this.messageContainer.createDiv({ cls: 'hermedian-message assistant' });
      const welcomeContent = welcome.createDiv({ cls: 'hermedian-message-content' });
      welcomeContent.createEl('p', { text: 'Hello! I\'m Hermes Agent, your AI coding assistant. How can I help?' });
    }
  }

  private async loadOrCreateConversation(): Promise<void> {
    // Try to load most recent conversation
    const conversations = await this.conversationRepo.list();
    if (conversations.length > 0) {
      // Sort by updatedAt descending
      const sorted = [...conversations].sort((a, b) => 
        (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
      );
      const mostRecent = sorted[0];
      await this.loadConversation(mostRecent.id);
    } else {
      await this.createNewConversation();
    }
  }
}
