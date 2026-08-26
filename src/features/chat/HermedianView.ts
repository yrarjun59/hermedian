// src/features/chat/HermedianView.ts
import type { ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, setIcon } from 'obsidian';

import { VIEW_TYPE_HERMEDIAN } from '../../core/types/chat';
import type { HermedianSettings } from '../../core/types/settings';

export class HermedianView extends ItemView {
  private plugin: any;
  private messageContainer: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: any) {
    super(leaf);
    this.plugin = plugin;
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
    this.containerEl.empty();
    this.containerEl.addClass('hermedian-view');

    // Build UI
    this.createHeader();
    this.createMessageArea();
    this.createInputArea();
  }

  async onunload(): Promise<void> {
    console.log('Hermedian view unloaded');
  }

  private createHeader(): void {
    const header = this.containerEl.createDiv({ cls: 'hermedian-header' });
    
    const title = header.createSpan({ cls: 'hermedian-title', text: 'Hermes Agent' });
    
    const actions = header.createDiv({ cls: 'hermedian-actions' });

    // New conversation button
    const newBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'New conversation' });
    setIcon(newBtn, 'plus');
    newBtn.addEventListener('click', () => this.createNewConversation());

    // Settings button
    const settingsBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'Settings' });
    setIcon(settingsBtn, 'settings');
    settingsBtn.addEventListener('click', () => {
      (this.app as any).setting?.openTabById?.('hermedian');
    });
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
      // TODO: Implement actual agent communication
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.updateMessage(assistantMsg, 'Hermes Agent is ready. Full integration coming soon.');
    } catch (error) {
      this.updateMessage(assistantMsg, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  private createNewConversation(): void {
    if (this.messageContainer) {
      this.messageContainer.empty();
      const welcome = this.messageContainer.createDiv({ cls: 'hermedian-message assistant' });
      const welcomeContent = welcome.createDiv({ cls: 'hermedian-message-content' });
      welcomeContent.createEl('p', { text: 'New conversation started. How can I help?' });
    }
    new Notice('New conversation started');
  }
}