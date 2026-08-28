// src/features/chat/HermedianView.ts
// Hermedian — Obsidian plugin embedding Hermes Agent
// Layout: [attach] [input] [model selector] [send/stop]
import type { WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, setIcon } from 'obsidian';

import { ConversationRepository } from '../../core/bootstrap/ConversationRepository';
import { resolveCliPath, getHermesProviderSettings } from '../../providers/hermes/settings';
import { VIEW_TYPE_HERMEDIAN } from '../../core/types/chat';

export class HermedianView extends ItemView {
  private plugin: any;
  private messagesEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private modelBtn: HTMLButtonElement | null = null;
  private modelPopup: HTMLElement | null = null;
  private repo: ConversationRepository;
  private cliPath: string;
  private isProcessing = false;
  private process: any = null;
  private currentConversationId: string | null = null;
  private currentFolder = '';

  // Model selector state
  private providerCache: Record<string, Array<{ id: string; name: string }>> = {};
  private selectedModel = 'nvidia/llama-3.1-nemotron-70b-instruct';
  private selectedProvider = 'nvidia-nim';
  private selectedReasoning = 'medium';

  constructor(leaf: WorkspaceLeaf, plugin: any) {
    super(leaf);
    this.plugin = plugin;
    this.repo = new ConversationRepository(plugin.app.vault.adapter);
    this.cliPath = plugin.settings?.hermes?.cliPath || '';
  }

  getViewType(): string { return VIEW_TYPE_HERMEDIAN; }
  getDisplayText(): string { return 'Hermedian'; }
  getIcon(): string { return 'bot'; }

  async onload(): Promise<void> {
    console.log('Hermedian view loaded');
    this.containerEl.empty();
    this.containerEl.addClass('hermedian-view');

    await this.repo.initialize();

    // Resolve CLI path
    try { this.cliPath = await resolveCliPath(this.plugin.settings.hermes.cliPath); } catch { /* will error on send */ }

    // Load settings
    const settings = getHermesProviderSettings(this.plugin.settings || {});
    this.selectedModel = settings.model || 'nvidia/llama-3.1-nemotron-70b-instruct';
    this.selectedProvider = settings.provider || 'nvidia-nim';
    this.selectedReasoning = settings.effortLevel || 'medium';

    // Vault path
    this.currentFolder = this.getVaultPath();

    // Load provider model cache
    await this.loadModelCache();

    // Build UI
    this.buildHeader();
    this.buildMessages();
    this.buildComposer();

    await this.loadMostRecent();
  }

  private getVaultPath(): string {
    return (this.app.vault.adapter as any).getBasePath?.()
      || (this.app.vault.adapter as any).basePath
      || (this.app.vault as any).getBasePath?.()
      || process.cwd();
  }

  // ===== MODEL CACHE =====
  private async loadModelCache(): Promise<void> {
    try {
      const nodeRequire = (window as any).require as (id: string) => any;
      const fs = nodeRequire('fs');
      const os = nodeRequire('os');
      const path = nodeRequire('path');
      const cachePath = path.join(os.homedir(), '.hermes', 'provider_models_cache.json');
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, 'utf-8');
        this.providerCache = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not load model cache:', e);
    }
  }

  // ===== HEADER =====
  private buildHeader(): void {
    const header = this.containerEl.createDiv({ cls: 'hermedian-header' });
    header.createSpan({ cls: 'hermedian-title', text: 'Hermedian' });
    const actions = header.createDiv({ cls: 'hermedian-actions' });

    const newBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'New conversation' });
    setIcon(newBtn, 'plus');
    newBtn.addEventListener('click', () => this.newConversation());

    const historyBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'History' });
    setIcon(historyBtn, 'clock');
    historyBtn.addEventListener('click', () => this.showHistory());
  }

  // ===== MESSAGES =====
  private buildMessages(): void {
    this.messagesEl = this.containerEl.createDiv({ cls: 'hermedian-messages' });
    const welcome = this.messagesEl.createDiv({ cls: 'hermedian-message assistant' });
    welcome.createDiv({ cls: 'hermedian-message-content' })
      .createEl('p', { text: 'Hello! I\'m Hermes Agent. Ask me anything about this vault.' });
  }

  // ===== COMPOSER (matches Hermes Agent desktop) =====
  private buildComposer(): void {
    const composer = this.containerEl.createDiv({ cls: 'hermedian-composer' });

    // 1. Attach button (left)
    const attachBtn = composer.createEl('button', { cls: 'hermedian-attach-btn', title: 'Add context' });
    setIcon(attachBtn, 'plus');
    attachBtn.addEventListener('click', () => {
      new Notice('Vault is already the working context. All files are accessible.');
    });

    // 2. Input (center)
    this.inputEl = composer.createEl('textarea', {
      cls: 'hermedian-input',
      attr: { placeholder: 'Ask Hermes... (Shift+Enter for newline)' }
    });
    this.inputEl.addEventListener('input', () => {
      this.inputEl!.style.height = 'auto';
      this.inputEl!.style.height = Math.min(this.inputEl!.scrollHeight, 150) + 'px';
    });
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });

    // 3. Model selector button
    this.modelBtn = composer.createEl('button', { cls: 'hermedian-model-btn', title: 'Select model' });
    this.renderModelLabel();
    this.modelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleModelPopup();
    });

    // 4. Send/Stop button (right)
    this.sendBtn = composer.createEl('button', { cls: 'hermedian-send-btn', attr: { title: 'Send' } });
    setIcon(this.sendBtn, 'chevron-up');
    this.sendBtn.addEventListener('click', () => {
      if (this.isProcessing) this.stop();
      else this.send();
    });

    // Close popup on outside click
    document.addEventListener('click', () => this.closeModelPopup());
  }

  private renderModelLabel(): void {
    if (!this.modelBtn) return;
    this.modelBtn.empty();
    const name = this.selectedModel.includes('/')
      ? this.selectedModel.split('/').pop()!
      : this.selectedModel;
    this.modelBtn.createSpan({ cls: 'hermedian-model-name', text: name });
    const chevron = this.modelBtn.createSpan({ cls: 'hermedian-model-chevron' });
    setIcon(chevron, 'chevron-down');
  }

  // ===== MODEL POPUP (Hermes Agent style) =====
  private toggleModelPopup(): void {
    if (this.modelPopup) { this.closeModelPopup(); return; }
    if (!this.modelBtn) return;

    const rect = this.modelBtn.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'hermedian-model-popup';
    popup.style.position = 'fixed';
    popup.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    popup.style.left = rect.left + 'px';
    popup.style.minWidth = '240px';
    popup.style.zIndex = '1000';

    // Provider sections
    const list = popup.createDiv({ cls: 'hermedian-model-popup-list' });
    for (const [provider, models] of Object.entries(this.providerCache)) {
      const header = list.createDiv({ cls: 'hermedian-model-group-header' });
      header.textContent = provider === 'nvidia' ? 'NVIDIA NIM' : provider.toUpperCase();

      for (const model of models) {
        const item = list.createDiv({
          cls: 'hermedian-model-item' + (model.id === this.selectedModel ? ' selected' : '')
        });
        item.createSpan({ cls: 'hermedian-model-item-name', text: model.id });
        const check = item.createSpan({ cls: 'hermedian-model-item-check' });
        setIcon(check, 'check');

        item.addEventListener('click', () => {
          this.selectedModel = model.id;
          this.selectedProvider = this.providerFromModel(model.id);
          this.renderModelLabel();
          this.closeModelPopup();
          this.saveModelSelection();
        });
      }
    }

    if (Object.keys(this.providerCache).length === 0) {
      list.createDiv({ cls: 'hermedian-model-empty', text: 'No models found. Open Hermes Agent first to populate cache.' });
    }

    document.body.appendChild(popup);
    this.modelPopup = popup;
  }

  private closeModelPopup(): void {
    if (this.modelPopup) {
      this.modelPopup.remove();
      this.modelPopup = null;
    }
  }

  private saveModelSelection(): void {
    if (!this.plugin.settings) return;
    this.plugin.settings.hermes.model = this.selectedModel;
    this.plugin.settings.hermes.provider = this.selectedProvider;
    this.plugin.saveSettings();
  }

  // ===== HISTORY =====
  private async loadMostRecent(): Promise<void> {
    try {
      const convos = await this.repo.list();
      if (convos.length === 0) { this.currentConversationId = crypto.randomUUID(); return; }
      const mostRecent = [...convos].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
      this.currentConversationId = mostRecent.id;
      const loaded = await this.repo.load(mostRecent.id);
      if (loaded && this.messagesEl) {
        this.messagesEl.empty();
        for (const msg of loaded.conversation.messages) {
          this.addMessage(msg.role as 'user' | 'assistant', msg.content.map((c: any) => c.text).join(''));
        }
      }
    } catch (e) {
      console.warn('loadMostRecent failed:', e);
      this.currentConversationId = crypto.randomUUID();
    }
  }

  private async newConversation(): Promise<void> {
    this.currentConversationId = crypto.randomUUID();
    if (this.messagesEl) {
      this.messagesEl.empty();
      const welcome = this.messagesEl.createDiv({ cls: 'hermedian-message assistant' });
      welcome.createDiv({ cls: 'hermedian-message-content' }).createEl('p', { text: 'New conversation started.' });
    }
  }

  private async showHistory(): Promise<void> {
    let convos: any[] = [];
    try { convos = await this.repo.list(); }
    catch { new Notice('Could not load history'); return; }
    if (convos.length === 0) { new Notice('No conversations yet'); return; }

    const { Modal } = await import('obsidian');
    const modal = new Modal(this.app);
    modal.titleEl.setText('Conversation History');
    for (const c of convos) {
      const row = modal.contentEl.createDiv({ cls: 'hermedian-history-modal-item' });
      row.textContent = c.title || c.id.substring(0, 8);
      row.addEventListener('click', async () => {
        modal.close();
        this.currentConversationId = c.id;
        const loaded = await this.repo.load(c.id);
        if (loaded && this.messagesEl) {
          this.messagesEl.empty();
          for (const msg of loaded.conversation.messages) {
            this.addMessage(msg.role as 'user' | 'assistant', msg.content.map((x: any) => x.text).join(''));
          }
        }
      });
    }
    modal.open();
  }

  // ===== MESSAGES =====
  private addMessage(role: 'user' | 'assistant', text: string): HTMLElement {
    if (!this.messagesEl) return document.createElement('div');
    const msg = this.messagesEl.createDiv({ cls: `hermedian-message ${role}` });
    const content = msg.createDiv({ cls: 'hermedian-message-content' });
    if (role === 'assistant' && !text) {
      // Loading indicator
      const loader = content.createDiv({ cls: 'hermedian-loading' });
      loader.createSpan({ cls: 'hermedian-loading-dot' });
      loader.createSpan({ cls: 'hermedian-loading-dot' });
      loader.createSpan({ cls: 'hermedian-loading-dot' });
    } else {
      content.createEl('p', { text: text || '…' });
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return content;
  }

  private updateMessage(el: HTMLElement, text: string): void {
    el.empty();
    el.createEl('p', { text: text || '…' });
  }

  // ===== SEND =====
  async send(): Promise<void> {
    if (!this.inputEl || this.isProcessing) return;
    const text = this.inputEl.value.trim();
    if (!text) return;

    if (this.currentConversationId) await this.appendToConversation('user', text);

    this.addMessage('user', text);
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';
    this.inputEl.disabled = true;
    this.setProcessing(true);

    const assistantEl = this.addMessage('assistant', '');

    const nodeRequire = (window as any).require as (id: string) => any;
    const { spawn } = nodeRequire('child_process');
    const args = ['chat', '-q', text, '-m', this.selectedModel, '--provider', this.selectedProvider, '--reasoning', this.selectedReasoning, '--in', this.currentFolder];

    console.log(`[Hermedian] ${this.cliPath} ${args.join(' ')}`);

    let buffer = '';
    this.process = spawn(this.cliPath, args, { cwd: this.currentFolder });

    const { createInterface } = nodeRequire('readline');

    if (this.process.stdout) {
      const rl = createInterface({ input: this.process.stdout });
      rl.on('line', (line: string) => {
        buffer += line + '\n';
        const m = buffer.match(/╭─ ⚕ Hermes[\s\S]*?╮\n([\s\S]*?)\n╰─/);
        if (m) {
          this.updateMessage(assistantEl, m[1].trim());
          buffer = '';
        }
      });
    }

    if (this.process.stderr) {
      const rlErr = createInterface({ input: this.process.stderr });
      rlErr.on('line', (line: string) => console.error('[hermes stderr]:', line));
    }

    this.process.on('close', async (code: number) => {
      if (code === 0 && buffer.trim()) {
        const m = buffer.match(/╭─ ⚕ Hermes[\s\S]*?╮\n([\s\S]*?)\n╰─/);
        const out = m ? m[1].trim() : buffer.trim();
        if (out) this.updateMessage(assistantEl, out);
      } else if (code !== 0 && code !== null) {
        this.updateMessage(assistantEl, `Error: process exited (${code}). Check console for details.`);
      }
      const finalText = assistantEl.textContent || '';
      if (finalText && this.currentConversationId) await this.appendToConversation('assistant', finalText);
      this.setProcessing(false);
      if (this.inputEl) { this.inputEl.disabled = false; this.inputEl.focus(); }
    });

    this.process.on('error', (err: Error) => {
      this.updateMessage(assistantEl, `Error: ${err.message}`);
      this.setProcessing(false);
      if (this.inputEl) { this.inputEl.disabled = false; this.inputEl.focus(); }
    });
  }

  private async appendToConversation(role: 'user' | 'assistant', text: string): Promise<void> {
    if (!this.currentConversationId) return;
    try {
      const existing = await this.repo.load(this.currentConversationId);
      let conversation: any;
      if (existing) {
        conversation = existing.conversation;
      } else {
        conversation = {
          id: this.currentConversationId,
          title: text.substring(0, 40),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          providerId: 'hermes',
          model: this.selectedModel,
          messages: [],
          providerState: {},
          sessionId: null,
          messageCount: 0,
        };
        await this.repo.create(conversation);
      }
      conversation.messages.push({
        id: crypto.randomUUID(),
        role,
        content: [{ type: 'text', text }],
        timestamp: Date.now(),
      });
      if (role === 'user') conversation.title = text.substring(0, 40);
      conversation.updatedAt = Date.now();
      await this.repo.update(conversation);
    } catch (e) { console.error('Failed to save conversation:', e); }
  }

  private providerFromModel(model: string): string {
    if (model.startsWith('nvidia/')) return 'nvidia-nim';
    if (model.startsWith('hermes-') || model.startsWith('nemotron-')) return 'nous';
    return 'nvidia-nim';
  }

  private setProcessing(processing: boolean): void {
    this.isProcessing = processing;
    if (!this.sendBtn) return;
    this.sendBtn.empty();
    if (processing) {
      setIcon(this.sendBtn, 'x');
      this.sendBtn.classList.add('processing');
      this.sendBtn.title = 'Stop';
    } else {
      setIcon(this.sendBtn, 'chevron-up');
      this.sendBtn.classList.remove('processing');
      this.sendBtn.title = 'Send';
    }
  }

  private stop(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.setProcessing(false);
    if (this.inputEl) { this.inputEl.disabled = false; this.inputEl.focus(); }
    new Notice('Stopped');
  }

  async onunload(): Promise<void> {
    if (this.process && !this.process.killed) this.process.kill('SIGTERM');
    this.closeModelPopup();
  }
}
