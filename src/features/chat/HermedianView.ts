// src/features/chat/HermedianView.ts
// Clean minimal chatbar: vault as context + history + send/stop
import type { WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, setIcon } from 'obsidian';

import { ConversationRepository } from '../../core/bootstrap/ConversationRepository';
import { resolveCliPath, getHermesProviderSettings } from '../../providers/hermes/settings';
import { ProviderRegistry } from '../../core/providers/ProviderRegistry';
import { VIEW_TYPE_HERMEDIAN } from '../../core/types/chat';

export class HermedianView extends ItemView {
  private plugin: any;
  private messagesEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private repo: ConversationRepository;
  private cliPath: string;
  private isProcessing = false;
  private process: import('child_process').ChildProcess | null = null;
  private currentConversationId: string | null = null;
  private currentFolder = '';

  constructor(leaf: WorkspaceLeaf, plugin: any) {
    super(leaf);
    this.plugin = plugin;
    this.repo = new ConversationRepository(plugin.app.vault.adapter);
    this.cliPath = plugin.settings?.hermes?.cliPath || '';
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

    await this.repo.initialize();

    // Resolve CLI path
    try {
      this.cliPath = await resolveCliPath(this.plugin.settings.hermes.cliPath);
    } catch {
      // No CLI — will show error on first send
    }

    // The whole vault is the working directory (context)
    this.currentFolder = this.getVaultPath();

    // Build UI
    this.buildHeader();
    this.buildMessages();
    this.buildComposer();

    // Load most recent conversation (history)
    await this.loadMostRecent();
  }

  private getVaultPath(): string {
    return (this.app.vault.adapter as any).getBasePath?.()
      || (this.app.vault.adapter as any).basePath
      || (this.app.vault as any).getBasePath?.()
      || process.cwd();
  }

  private buildHeader(): void {
    const header = this.containerEl.createDiv({ cls: 'hermedian-header' });
    const left = header.createDiv({ cls: 'hermedian-header-left' });

    left.createSpan({ cls: 'hermedian-title', text: 'Hermedian' });

    // Folder context indicator
    const folder = left.createSpan({ cls: 'hermedian-folder-chip' });
    folder.textContent = `📁 ${this.currentFolder}`;
    folder.title = this.currentFolder;
    folder.addEventListener('click', () => {
      new Notice(`Working directory: ${this.currentFolder}`);
    });

    // Actions
    const actions = header.createDiv({ cls: 'hermedian-actions' });

    const newBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'New conversation' });
    setIcon(newBtn, 'plus');
    newBtn.addEventListener('click', () => this.newConversation());

    const historyBtn = actions.createEl('button', { cls: 'hermedian-btn-icon', title: 'History' });
    setIcon(historyBtn, 'clock');
    historyBtn.addEventListener('click', () => this.showHistory());
  }

  private buildMessages(): void {
    this.messagesEl = this.containerEl.createDiv({ cls: 'hermedian-messages' });

    const welcome = this.messagesEl.createDiv({ cls: 'hermedian-message assistant' });
    welcome.createDiv({ cls: 'hermedian-message-content' })
      .createEl('p', { text: `Hello! I'm Hermes Agent. I'm working in: ${this.currentFolder}\nAsk me anything about this vault.` });
  }

  private buildComposer(): void {
    const composer = this.containerEl.createDiv({ cls: 'hermedian-composer' });

    // + Add context button (like Hermes Agent)
    const addBtn = composer.createEl('button', { cls: 'hermedian-attach-btn', title: 'Add context files' });
    setIcon(addBtn, 'plus');
    addBtn.addEventListener('click', () => this.addContext());

    // Input
    this.inputEl = composer.createEl('textarea', {
      cls: 'hermedian-input',
      attr: { placeholder: 'Ask Hermes about this vault... (Shift+Enter for newline)' }
    });

    // Auto-resize
    this.inputEl.addEventListener('input', () => {
      this.inputEl!.style.height = 'auto';
      this.inputEl!.style.height = Math.min(this.inputEl!.scrollHeight, 150) + 'px';
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    // Send/Stop button
    this.sendBtn = composer.createEl('button', { cls: 'hermedian-send-btn', attr: { title: 'Send' } });
    setIcon(this.sendBtn, 'chevron-up');
    this.sendBtn.addEventListener('click', () => {
      if (this.isProcessing) {
        this.stop();
      } else {
        this.send();
      }
    });
  }

  private async loadMostRecent(): Promise<void> {
    const convos = await this.repo.list();
    if (convos.length === 0) {
      this.currentConversationId = crypto.randomUUID();
      return;
    }
    const mostRecent = [...convos].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    this.currentConversationId = mostRecent.id;
    const loaded = await this.repo.load(mostRecent.id);
    if (loaded && this.messagesEl) {
      this.messagesEl.empty();
      for (const msg of loaded.conversation.messages) {
        this.addMessage(msg.role as 'user' | 'assistant', msg.content.map((c: any) => c.text).join(''));
      }
    }
  }

  private async newConversation(): Promise<void> {
    this.currentConversationId = crypto.randomUUID();
    if (this.messagesEl) {
      this.messagesEl.empty();
      const welcome = this.messagesEl.createDiv({ cls: 'hermedian-message assistant' });
      welcome.createDiv({ cls: 'hermedian-message-content' })
        .createEl('p', { text: 'New conversation started.' });
    }
  }

  private async showHistory(): Promise<void> {
    const convos = await this.repo.list();
    if (convos.length === 0) {
      new Notice('No conversations yet');
      return;
    }
    const items = convos.map(c => c.title || c.id.substring(0, 8));
    new Notice(`History (${convos.length} conversations) — click a title to load.`);
    // Simple menu via Modal
    const { Modal } = await import('obsidian');
    const modal = new Modal(this.app);
    modal.titleEl.setText('Conversation History');
    let last = '';
    for (const c of convos) {
      last = c.id;
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

  private addContext(): void {
    new Notice('Context: vault is already the working directory. Files within it are accessible.');
  }

  private addMessage(role: 'user' | 'assistant', text: string): HTMLElement {
    if (!this.messagesEl) return document.createElement('div');
    const msg = this.messagesEl.createDiv({ cls: `hermedian-message ${role}` });
    const content = msg.createDiv({ cls: 'hermedian-message-content' });
    content.createEl('p', { text: text || '…' });
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return content;
  }

  private updateMessage(el: HTMLElement, text: string): void {
    el.empty();
    el.createEl('p', { text: text || '…' });
  }

  async send(): Promise<void> {
    if (!this.inputEl || this.isProcessing) return;
    const text = this.inputEl.value.trim();
    if (!text) return;

    // Save user message to conversation
    if (this.currentConversationId) {
      await this.appendToConversation('user', text);
    }

    this.addMessage('user', text);
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';
    this.inputEl.disabled = true;
    this.setProcessing(true);

    const assistantEl = this.addMessage('assistant', '');

    const settings = getHermesProviderSettings(this.plugin.settings || {});
    const model = settings.model || 'nvidia/llama-3.1-nemotron-70b-instruct';
    const provider = settings.provider || this.providerFromModel(model);
    const reasoning = settings.effortLevel || 'medium';

    const { spawn } = await import('child_process');
    const args = ['chat', '-q', text, '-m', model, '--provider', provider, '--reasoning', reasoning, '--in', this.currentFolder];

    console.log(`[Hermedian] ${this.cliPath} ${args.join(' ')}`);

    let buffer = '';
    this.process = spawn(this.cliPath, args, { cwd: this.currentFolder });

    const { createInterface } = await import('readline');

    if (this.process.stdout) {
      const rl = createInterface({ input: this.process.stdout });
      rl.on('line', (line: string) => {
        buffer += line + '\n';
        // Parse TUI box: extract text between ╭─ ⚕ Hermes and ╰─...╯
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

    this.process.on('close', async (code) => {
      if (code === 0 && buffer.trim()) {
        // Fallback: emit remaining buffer
        const m = buffer.match(/╭─ ⚕ Hermes[\s\S]*?╮\n([\s\S]*?)\n╰─/);
        const out = m ? m[1].trim() : buffer.trim();
        if (out) this.updateMessage(assistantEl, out);
      } else if (code !== 0 && code !== null) {
        this.updateMessage(assistantEl, `Error: process exited (${code}). Check console for details.`);
      }
      // Save assistant message
      const finalText = assistantEl.textContent || '';
      if (finalText && this.currentConversationId) {
        await this.appendToConversation('assistant', finalText);
      }
      this.setProcessing(false);
      if (this.inputEl) {
        this.inputEl.disabled = false;
        this.inputEl.focus();
      }
    });

    this.process.on('error', (err) => {
      this.updateMessage(assistantEl, `Error: ${err.message}`);
      this.setProcessing(false);
      if (this.inputEl) {
        this.inputEl.disabled = false;
        this.inputEl.focus();
      }
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
          model: getHermesProviderSettings(this.plugin.settings || {}).model,
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
    } catch (e) {
      console.error('Failed to save conversation:', e);
    }
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
    if (this.inputEl) {
      this.inputEl.disabled = false;
      this.inputEl.focus();
    }
    new Notice('Stopped');
  }

  async onunload(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
    }
  }
}