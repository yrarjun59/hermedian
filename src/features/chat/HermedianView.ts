// src/features/chat/HermedianView.ts
import type { WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, setIcon } from 'obsidian';

import type { InputLedgerEntry } from '../../core/bootstrap/ConversationRepository';
import { ConversationRepository } from '../../core/bootstrap/ConversationRepository';
import { ProviderRegistry } from '../../core/providers/ProviderRegistry';
import type { Conversation } from '../../core/types/chat';
import { VIEW_TYPE_HERMEDIAN } from '../../core/types/chat';
import { TabManager } from './TabManager';
import { resolveCliPath } from '../../providers/hermes/settings';
import { createModelSelector, ModelSelector } from './ModelSelector';
import type { ProviderExecutionBackend, ProviderExecutionEvent, ProviderSessionConfig } from '../../core/execution/types';

// Define ConversationWithLedger since it's not exported from core/types/chat
interface ConversationWithLedger {
  conversation: Conversation;
  ledger: InputLedgerEntry[];
}

export class HermedianView extends ItemView {
  private plugin: any;
  private messageContainer: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private modelSelectEl: HTMLSelectElement | null = null;
  private providerSelectEl: HTMLSelectElement | null = null;
  private reasoningSelectEl: HTMLSelectElement | null = null;
  private conversationRepo: ConversationRepository;
  private tabManager: TabManager;
  private providerRegistry: typeof ProviderRegistry;
  private currentConversationId: string | null = null;
  private historySidebarEl: HTMLElement | null = null;
  private isHistorySidebarOpen: boolean = false;
  private hermesStatusEl: HTMLElement | null = null;
  private hermesAvailable = false;
  private resolvedCliPath: string | null = null;
  private modelSelector: ModelSelector | null = null;
  private isProcessing = false;

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

    // Initialize model selector
    this.modelSelector = createModelSelector(
      this.containerEl,
      this.modelSelectEl!,
      this.plugin,
      this.resolvedCliPath
    );
    await this.modelSelector.loadModels();

    // Check Hermes availability and resolve CLI path
    await this.checkHermesAvailability();
  }

  async onunload(): Promise<void> {
    console.log('Hermedian view unloaded');
  }

  private async checkHermesAvailability(): Promise<void> {
    try {
      const cliPath = await resolveCliPath(this.plugin.settings.hermes.cliPath);
      this.resolvedCliPath = cliPath;
      
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      
      try {
        const { stdout } = await execFileAsync(cliPath, ['--version'], { timeout: 5000 });
        this.hermesAvailable = true;
        this.updateHermesStatus(`Connected • ${stdout.trim()}`, 'connected');
      } catch {
        this.hermesAvailable = false;
        this.updateHermesStatus('Not installed • Click to install', 'disconnected');
      }
    } catch (error) {
      this.hermesAvailable = false;
      this.updateHermesStatus('Not installed • Click to install', 'disconnected');
    }
  }

  private updateHermesStatus(text: string, status: 'connected' | 'disconnected' | 'connecting'): void {
    if (!this.hermesStatusEl) return;
    this.hermesStatusEl.empty();
    this.hermesStatusEl.createSpan({ 
      cls: `hermedian-status ${status}`, 
      text 
    });
    this.hermesStatusEl.onclick = () => {
      if (this.hermesStatusEl?.classList.contains('disconnected')) {
        this.openHermesInstallGuide();
      }
    };
    this.hermesStatusEl.style.cursor = this.hermesAvailable ? 'default' : 'pointer';
  }

  private openHermesInstallGuide(): void {
    new Notice('Opening Hermes Agent install guide...');
    window.open('https://github.com/hermes-agent/hermes-agent#installation', '_blank');
  }

  private createHeader(): void {
    const header = this.containerEl.createDiv({ cls: 'hermedian-header' });

    // Left: Title + Status
    const left = header.createDiv({ cls: 'hermedian-header-left' });
    left.createSpan({ cls: 'hermedian-title', text: 'Hermedian' });
    this.hermesStatusEl = left.createSpan({ cls: 'hermedian-status disconnected', text: 'Checking...' });

    // Right: Action buttons
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

  private createInputArea(): void {
    // Composer container - single row with all elements
    const composer = this.containerEl.createDiv({ cls: 'hermedian-composer' });

    // 1. Attach button (far left)
    const attachBtn = composer.createEl('button', { cls: 'hermedian-attach-btn', title: 'Attach files' });
    setIcon(attachBtn, 'plus');
    attachBtn.addEventListener('click', () => this.openFilePicker());

    // 2. Input field (center, flex)
    this.inputEl = composer.createEl('textarea', {
      cls: 'hermedian-input',
      attr: { placeholder: 'Ask Hermes... (Shift+Enter for newline)' }
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // 3. Model selector (right of input)
    this.modelSelectEl = composer.createEl('select', { cls: 'hermedian-model-select' });

    this.modelSelectEl.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      if (this.modelSelector) {
        await this.modelSelector.handleModelChange(target.value);
        if (target.value.startsWith('__')) {
          target.value = this.plugin.settings?.hermes?.model || '';
        }
      }
    });

    // 4. Provider selector (dynamic)
    this.providerSelectEl = composer.createEl('select', { cls: 'hermedian-provider-select' });
    this.populateProviderSelector();

    this.providerSelectEl.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      this.plugin.settings.hermes.provider = target.value;
      await this.plugin.saveSettings();
    });

    // 5. Reasoning selector (dynamic)
    this.reasoningSelectEl = composer.createEl('select', { cls: 'hermedian-reasoning-select' });
    this.populateReasoningSelector();

    this.reasoningSelectEl.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      this.plugin.settings.hermes.effortLevel = target.value as 'low' | 'medium' | 'high';
      await this.plugin.saveSettings();
    });

    // 6. Send button (far right, white circular with up arrow)
    const sendBtn = composer.createEl('button', { 
      cls: 'hermedian-send-btn',
      attr: { title: 'Send' }
    });
    setIcon(sendBtn, 'chevron-up');
    sendBtn.addEventListener('click', () => this.sendMessage());

    // Store reference for state changes
    this.sendBtn = sendBtn;
  }

  private sendBtn: HTMLButtonElement | null = null;

  private populateProviderSelector(): void {
    if (!this.providerSelectEl) return;
    this.providerSelectEl.empty();

    // Get providers from Hermes cache
    const providers = this.getAvailableProviders();
    
    for (const provider of providers) {
      const option = document.createElement('option');
      option.value = provider.id;
      option.textContent = provider.label;
      this.providerSelectEl.appendChild(option);
    }

    // Default to nous (since it's always available)
    const savedProvider = this.plugin.settings.hermes?.provider || 'nous';
    this.providerSelectEl.value = savedProvider;
  }

  private getAvailableProviders(): { id: string; label: string }[] {
    // Read from cache or use defaults
    try {
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const execFileAsync = require('util').promisify(execFile);
      const { stdout: configDir } = execFileAsync('bash', ['-c', 'echo ~/.hermes']);
      // This is sync-ish, so we'll use defaults for now
    } catch {}

    return [
      { id: 'nvidia-nim', label: 'NVIDIA NIM' },
      { id: 'nous', label: 'Nous Research' },
      { id: 'opencode-free', label: 'OpenCode Free' },
      { id: 'xai', label: 'xAI Grok' },
      { id: 'google', label: 'Google Gemini' },
      { id: 'openai', label: 'OpenAI' },
      { id: 'anthropic', label: 'Anthropic' },
    ];
  }

  private populateReasoningSelector(): void {
    if (!this.reasoningSelectEl) return;
    this.reasoningSelectEl.empty();

    const levels = [
      { value: 'none', label: 'None' },
      { value: 'minimal', label: 'Minimal' },
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'xhigh', label: 'High+' },
      { value: 'max', label: 'Max' },
      { value: 'ultra', label: 'Ultra' },
    ];

    for (const level of levels) {
      const option = document.createElement('option');
      option.value = level.value;
      option.textContent = level.label;
      this.reasoningSelectEl!.appendChild(option);
    }

    const savedReasoning = this.plugin.settings.hermes?.effortLevel || 'medium';
    this.reasoningSelectEl!.value = savedReasoning;
  }

  private openFilePicker(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '*/*';
    input.style.display = 'none';
    input.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const files = Array.from(target.files);
        new Notice(`Attached ${files.length} file(s) - context attachment coming soon`);
      }
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  private createHistorySidebar(): void {
    if (this.historySidebarEl) return;

    this.historySidebarEl = this.containerEl.createDiv({ cls: 'hermedian-history-sidebar' });
    this.historySidebarEl.createDiv({ cls: 'hermedian-history-sidebar-header', text: 'Conversation History' });

    const historyList = this.historySidebarEl.createDiv({ cls: 'hermedian-history-list' });
    this.historySidebarEl.appendChild(historyList);

    this.loadConversationHistory(historyList);
  }

  private async loadConversationHistory(container: HTMLElement): Promise<void> {
    container.empty();
    const conversations = await this.conversationRepo.list();

    for (const meta of conversations) {
      const item = container.createDiv({ cls: 'hermedian-history-item' });
      item.createSpan({ text: meta.title || `Conversation ${meta.id.substring(0, 8)}` });
      item.addEventListener('click', () => this.loadConversation(meta.id));

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

    const welcome = this.messageContainer.createDiv({ cls: 'hermedian-message assistant' });
    const welcomeContent = welcome.createDiv({ cls: 'hermedian-message-content' });
    welcomeContent.createEl('p', {
      text: 'Hello! I\'m Hermes Agent, your AI coding assistant. I can read, write, and edit files in your vault. How can I help?'
    });
  }

  private buildEnvironment(): Record<string, string> {
    const settings = this.plugin.settings || {};
    const env: Record<string, string> = {};

    if (settings.sharedEnvironmentVariables) {
      for (const line of settings.sharedEnvironmentVariables.split('\n')) {
        const [key, ...val] = line.split('=');
        if (key && val.length) env[key.trim()] = val.join('=').trim();
      }
    }

    if (settings.hermes?.environmentVariables) {
      for (const line of settings.hermes.environmentVariables.split('\n')) {
        const [key, ...val] = line.split('=');
        if (key && val.length) env[key.trim()] = val.join('=').trim();
      }
    }

    return env;
  }

  private async sendMessage(): Promise<void> {
    if (!this.inputEl || this.isProcessing) return;

    const text = this.inputEl.value.trim();
    if (!text) return;

    // Ensure CLI path is resolved
    if (!this.resolvedCliPath) {
      try {
        this.resolvedCliPath = await resolveCliPath(this.plugin.settings.hermes.cliPath);
      } catch (err) {
        this.addMessage('assistant', `Error: ${err instanceof Error ? err.message : 'Hermes CLI not found'}`);
        return;
      }
    }

    this.isProcessing = true;
    this.updateSendButtonState();

    this.addMessage('user', text);
    this.inputEl.value = '';
    this.inputEl.disabled = true;

    const assistantMsg = this.addMessage('assistant', '');

    try {
      let conversation: any;
      if (this.currentConversationId) {
        const loaded = await this.conversationRepo.load(this.currentConversationId);
        if (!loaded) {
          conversation = {
            id: this.currentConversationId,
            title: `Conversation ${this.currentConversationId.substring(0, 8)}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            providerId: 'hermes',
            model: this.modelSelectEl?.value || 'nvidia/llama-3.1-nemotron-70b-instruct',
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
        conversation = {
          id: crypto.randomUUID(),
          title: 'New Conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          providerId: 'hermes',
          model: this.modelSelectEl?.value || 'nvidia/llama-3.1-nemotron-70b-instruct',
          messageCount: 0,
          providerState: {},
          sessionId: null,
          messages: []
        };
        await this.conversationRepo.create(conversation);
        this.currentConversationId = conversation.id;
      }

      await this.conversationRepo.appendToLedger(this.currentConversationId!, {
        messageId: crypto.randomUUID(),
        userMessage: text,
        timestamp: Date.now(),
        contextFiles: []
      });

      // Get execution backend and update CLI path
      const backend = this.providerRegistry.getExecutionBackend('hermes', this.plugin) as any;
      if (backend.setCliPath && this.resolvedCliPath) {
        backend.setCliPath(this.resolvedCliPath);
      }

      const vaultPath = (this.app.vault.adapter as any).getBasePath?.()
        || (this.app.vault.adapter as any).basePath
        || (this.app.vault as any).getBasePath?.()
        || process.cwd();

      const session = backend.createSession({
        providerId: 'hermes',
        conversationId: this.currentConversationId,
        workingDirectory: vaultPath,
        environment: this.buildEnvironment(),
        model: this.modelSelectEl?.value || 'nvidia/llama-3.1-nemotron-70b-instruct',
        effortLevel: this.reasoningSelectEl?.value || 'medium',
      });

      const run = await session.execute({
        userMessage: text,
        conversationHistory: [],
        contextFiles: [],
      });

      let fullResponse = '';
      for await (const event of run.stream) {
        if (event.type === 'text_delta') {
          fullResponse += event.content;
          this.updateMessage(assistantMsg, fullResponse);
        } else if (event.type === 'tool_start') {
          this.updateMessage(assistantMsg, fullResponse + `\n\n🔧 ${event.toolName}...`);
        } else if (event.type === 'tool_output') {
          this.updateMessage(assistantMsg, fullResponse + `\n\n✅ ${event.toolName} done`);
        } else if (event.type === 'completed') {
          await this.conversationRepo.updateSessionMetadata(
            this.currentConversationId!,
            `hermes-session-${Date.now()}`,
            {}
          );
          break;
        } else if (event.type === 'error') {
          this.updateMessage(assistantMsg, `Error: ${event.error}`);
          break;
        }
      }

      conversation.messages.push(
        { id: crypto.randomUUID(), role: 'user', content: [{ type: 'text', text }], timestamp: Date.now() },
        { id: crypto.randomUUID(), role: 'assistant', content: [{ type: 'text', text: fullResponse }], timestamp: Date.now() }
      );
      await this.conversationRepo.update(conversation);

    } catch (error) {
      this.updateMessage(assistantMsg, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error in sendMessage:', error);
    } finally {
      this.isProcessing = false;
      this.updateSendButtonState();
      this.inputEl.disabled = false;
      this.inputEl.focus();
    }
  }

  private updateSendButtonState(): void {
    if (!this.sendBtn) return;
    
    if (this.isProcessing) {
      this.sendBtn.empty();
      setIcon(this.sendBtn, 'x'); // Stop icon (x)
      this.sendBtn.classList.add('hermedian-send-btn-processing');
      this.sendBtn.title = 'Stop generation';
    } else {
      this.sendBtn.empty();
      setIcon(this.sendBtn, 'chevron-up');
      this.sendBtn.classList.remove('hermedian-send-btn-processing');
      this.sendBtn.title = 'Send';
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

    const conversationId = await this.tabManager.createTab();
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
    new Notice('Conversation loaded');
  }

  private loadConversationIntoView(loaded: any): void {
    if (!this.messageContainer) return;

    this.messageContainer.empty();

    for (const entry of loaded.ledger) {
      this.addMessage('user', entry.userMessage);
    }

    if (loaded.ledger.length === 0) {
      const welcome = this.messageContainer.createDiv({ cls: 'hermedian-message assistant' });
      const welcomeContent = welcome.createDiv({ cls: 'hermedian-message-content' });
      welcomeContent.createEl('p', { text: 'Hello! I\'m Hermes Agent, your AI coding assistant. I can read, write, and edit files in your vault. How can I help?' });
    }
  }

  private async loadOrCreateConversation(): Promise<void> {
    const conversations = await this.conversationRepo.list();
    if (conversations.length > 0) {
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