// src/features/chat/HermedianView.ts
import { WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, setIcon } from 'obsidian';

import type { InputLedgerEntry } from '../../core/bootstrap/ConversationRepository';
import { ConversationRepository } from '../../core/bootstrap/ConversationRepository';
import type { ProviderExecutionEvent,ProviderExecutionSession } from '../../core/execution/types';
import { ProviderRegistry } from '../../core/providers/ProviderRegistry';
import type { Conversation } from '../../core/types/chat';
import { VIEW_TYPE_HERMEDIAN } from '../../core/types/chat';
import { resolveCliPath } from '../../providers/hermes/settings';
import { ModelSelectorPopup } from './ModelSelectorPopup';
import { TabManager } from './TabManager';

export class HermedianView extends ItemView {
  private plugin: any;
  private messageContainer: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private conversationRepo: ConversationRepository;
  private tabManager: TabManager;
  private providerRegistry: typeof ProviderRegistry;
  private currentConversationId: string | null = null;
  private historySidebarEl: HTMLElement | null = null;
  private isHistorySidebarOpen: boolean = false;
  private hermesStatusEl: HTMLElement | null = null;
  private hermesAvailable = false;
  private resolvedCliPath: string | null = null;
  private isProcessing = false;
  private sendBtn: HTMLButtonElement | null = null;
  private modelSelector: ModelSelectorPopup | null = null;
  private currentSession: ProviderExecutionSession | null = null; // for stop/cancel support

  // P0: auto-grow limits
  private static INPUT_MAX_HEIGHT = 160;

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

    this.createHeader();
    this.createMessageArea();
    this.createInputArea();

    await this.loadOrCreateConversation();
    await this.checkHermesAvailability();
  }

  async onunload(): Promise<void> {
    this.modelSelector?.destroy();
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
    } catch {
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

    const left = header.createDiv({ cls: 'hermedian-header-left' });
    left.createSpan({ cls: 'hermedian-title', text: 'Hermedian' });
    this.hermesStatusEl = left.createSpan({ cls: 'hermedian-status disconnected', text: 'Checking...' });

    const actions = header.createDiv({ cls: 'hermedian-actions' });

    const newBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'New conversation' });
    setIcon(newBtn, 'plus');
    newBtn.addEventListener('click', () => this.createNewConversation());

    const historyBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'History' });
    setIcon(historyBtn, 'clock');
    historyBtn.addEventListener('click', () => this.toggleHistorySidebar());

    const settingsBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'Settings' });
    setIcon(settingsBtn, 'settings');
    settingsBtn.addEventListener('click', () => {
      (this.app as unknown as { setting?: { openTabById?: (id: string) => void } }).setting?.openTabById?.('hermedian');
    });
  }

  private createInputArea(): void {
    // Composer container - matches Hermes Desktop: [+] [textarea] [model pill] [send]
    const composer = this.containerEl.createDiv({ cls: 'hermedian-composer' });

    // Attach button (far left)
    const attachBtn = composer.createEl('button', { cls: 'hermedian-attach-btn', title: 'Attach files' });
    setIcon(attachBtn, 'plus');
    attachBtn.addEventListener('click', () => this.openFilePicker());

    // Auto-growing textarea (center, flex)
    this.inputEl = composer.createEl('textarea', {
      cls: 'hermedian-input',
      attr: { placeholder: 'Ask Hermes... (Shift+Enter for newline)', rows: '1' }
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // P0: auto-grow with internal scroll cap
    this.inputEl.addEventListener('input', () => this.autoGrowInput());

    // Model selector popup pill (replaces model/provider/reasoning <select>s)
    this.modelSelector = new ModelSelectorPopup(composer, {
      onModelChange: (modelId) => {
        this.plugin.settings.hermes.model = modelId;
        this.plugin.saveSettings();
      },
      onOptionsChange: (state) => {
        this.plugin.settings.hermes.model = state.selectedModel;
        this.plugin.settings.hermes.effortLevel = state.effortLevel as any;
        this.plugin.settings.hermes.thinkingEnabled = state.thinkingEnabled;
        this.plugin.saveSettings();
      },
      onRefresh: async () => {
        await this.refreshHermesModels();
      },
      onEdit: () => {
        (this.app as any)?.setting?.openTabById?.('hermedian');
      },
    }, this.plugin);

    this.modelSelector.initFromSettings();
    this.modelSelector.renderButton(composer);
    // Load models dynamically (async, updates list when done)
    void this.modelSelector.loadModels();

    // Send/Stop button (far right)
    this.sendBtn = composer.createEl('button', {
      cls: 'hermedian-send-btn',
      attr: { title: 'Send' }
    });
    setIcon(this.sendBtn, 'arrow-up');
    this.sendBtn.addEventListener('click', () => {
      if (this.isProcessing) {
        this.stopCurrentRun();
      } else {
        this.sendMessage();
      }
    });

    this.updateSendButtonState();
  }

  /* P0: Auto-growing textarea — grows with content up to max, then scrolls internally */
  private autoGrowInput(): void {
    if (!this.inputEl) return;
    const el = this.inputEl;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, HermedianView.INPUT_MAX_HEIGHT);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > HermedianView.INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }

  private resetInputHeight(): void {
    if (!this.inputEl) return;
    this.inputEl.style.height = 'auto';
    this.inputEl.style.overflowY = 'hidden';
  }

  private async refreshHermesModels(): Promise<void> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      const cliPath = this.resolvedCliPath || 'hermes';
      await execFileAsync(cliPath, ['model', 'list', '--refresh'], { timeout: 30000 });
      new Notice('Models refreshed from Hermes');
    } catch (error) {
      new Notice('Model refresh failed: ' + (error instanceof Error ? error.message : 'Unknown'));
    }
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
    if (!this.historySidebarEl) {
      this.createHistorySidebar();
      this.isHistorySidebarOpen = true;
      (this.historySidebarEl as HTMLElement | null)?.classList.add('hermedian-history-sidebar-open');
      return;
    }
    this.isHistorySidebarOpen = !this.isHistorySidebarOpen;
    this.historySidebarEl.toggleClass('hermedian-history-sidebar-open', this.isHistorySidebarOpen);
    if (this.isHistorySidebarOpen) {
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

  private stopCurrentRun(): void {
    if (this.currentSession && typeof this.currentSession.stop === 'function') {
      this.currentSession.stop();
    }
    this.isProcessing = false;
    this.updateSendButtonState();
    new Notice('Generation stopped');
  }

  private async sendMessage(): Promise<void> {
    if (!this.inputEl || this.isProcessing) return;

    const text = this.inputEl.value.trim();
    if (!text) return;

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
    this.resetInputHeight();
    this.inputEl.disabled = true;

    const assistantMsg = this.addMessage('assistant', '');

    try {
      const selectorState = this.modelSelector?.getState() ?? {
        selectedModel: this.plugin.settings.hermes.model || 'nvidia/llama-3.1-nemotron-70b-instruct',
        thinkingEnabled: false,
        effortLevel: this.plugin.settings.hermes.effortLevel || 'medium',
      };

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
            model: selectorState.selectedModel,
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
          model: selectorState.selectedModel,
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

      const backend = this.providerRegistry.getExecutionBackend('hermes', this.plugin) as any;
      if (backend.setCliPath && this.resolvedCliPath) {
        backend.setCliPath(this.resolvedCliPath);
      }

      const vaultPath = (this.app.vault.adapter as any).getBasePath?.()
        || (this.app.vault.adapter as any).basePath
        || process.cwd();

      const session = backend.createSession({
        providerId: 'hermes',
        conversationId: this.currentConversationId!,
        workingDirectory: vaultPath,
        environment: this.buildEnvironment(),
        model: selectorState.selectedModel,
        effortLevel: selectorState.effortLevel,
      });

      const run = await session.execute({
        userMessage: text,
        conversationHistory: [],
        contextFiles: [],
      });
      this.currentSession = session;

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
      this.currentSession = null;
      this.updateSendButtonState();
      this.inputEl!.disabled = false;
      this.inputEl!.focus();
    }
  }

  private updateSendButtonState(): void {
    if (!this.sendBtn) return;
    if (this.isProcessing) {
      this.sendBtn.empty();
      setIcon(this.sendBtn, 'square'); // stop icon
      this.sendBtn.classList.add('hermedian-send-btn-processing');
      this.sendBtn.title = 'Stop generation';
    } else {
      this.sendBtn.empty();
      setIcon(this.sendBtn, 'arrow-up');
      this.sendBtn.classList.remove('hermedian-send-btn-processing');
      this.sendBtn.title = 'Send';
    }
  }

  private addMessage(role: 'user' | 'assistant', text: string): HTMLElement {
    if (!this.messageContainer) return document.createElement('div');
    const msg = this.messageContainer.createDiv({ cls: `hermedian-message ${role}` });
    const content = msg.createDiv({ cls: 'hermedian-message-content' });
    content.createEl('p', { text });
    this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    return content;
  }

  private updateMessage(contentEl: HTMLElement, text: string): void {
    contentEl.empty();
    contentEl.createEl('p', { text });
    if (this.messageContainer) {
      this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }
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
      welcomeContent.createEl('p', { text: 'Hello! I\'m Hermes Agent, your AI coding assistant. How can I help?' });
    }
  }

  private async loadOrCreateConversation(): Promise<void> {
    const conversations = await this.conversationRepo.list();
    if (conversations.length > 0) {
      const sorted = [...conversations].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      await this.loadConversation(sorted[0].id);
    } else {
      await this.createNewConversation();
    }
  }
}
