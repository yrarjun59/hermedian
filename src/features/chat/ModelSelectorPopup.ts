// src/features/chat/ModelSelectorPopup.ts
// Custom model selector popup matching Hermes Agent Desktop:
// click pill -> popup with provider groups -> hover model -> submenu with thinking/effort options

import { setIcon } from 'obsidian';

export interface ModelOption {
  id: string;        // e.g. 'nvidia/llama-3.1-nemotron-70b-instruct'
  name: string;      // short display name
  provider: string;  // provider id
}

export interface ReasoningLevel {
  value: string;
  label: string;
}

export interface ModelSelectorState {
  selectedModel: string;
  thinkingEnabled: boolean;
  effortLevel: string;
}

export interface ModelSelectorCallbacks {
  onModelChange: (modelId: string) => void;
  onOptionsChange: (state: ModelSelectorState) => void;
  onRefresh: () => Promise<void>;
  onEdit: () => void;
}

const REASONING_LEVELS: ReasoningLevel[] = [
  { value: 'none', label: 'None' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'High+' },
  { value: 'max', label: 'Max' },
];

const PROVIDER_LABELS: Record<string, string> = {
  'nvidia': 'NVIDIA NIM',
  'nvidia-nim': 'NVIDIA NIM',
  'nous': 'Nous Research',
  'nous-research': 'Nous Research',
  'openrouter': 'OpenRouter',
  'opencode': 'OpenCode',
  'opencode-go': 'OpenCode Go',
  'github-copilot': 'GitHub Copilot',
  'zai-coding-plan': 'Z.AI Coding',
  'xai': 'xAI Grok',
  'google': 'Google Gemini',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'mistral': 'Mistral',
  'ollama-cloud': 'Ollama Cloud',
  'ollama': 'Ollama',
  'kimi-coding': 'Kimi Coding',
  'minimax': 'MiniMax',
  'minimax-cn': 'MiniMax CN',
  'huggingface': 'Hugging Face',
  'deepseek': 'DeepSeek',
  'groq': 'Groq',
  'together': 'Together AI',
  'cohere': 'Cohere',
  'meta': 'Meta',
  'custom': 'Custom',
};

// Models known to support thinking/reasoning (subset that expose thinking blocks)
const THINKING_MODEL_PATTERNS = [
  'nemotron', 'deepseek', 'qwq', 'r1', 'reasoning', 'think',
  'claude-3-7', 'claude-sonnet-4', 'o1', 'o3', 'gpt-5',
];

function supportsThinking(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return THINKING_MODEL_PATTERNS.some(p => lower.includes(p));
}

function providerLabel(id: string): string {
  return PROVIDER_LABELS[id.toLowerCase()] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function shortModelName(modelId: string): string {
  // "nvidia/llama-3.1-nemotron-70b-instruct" -> "Llama 3.1 Nemotron 70b Instruct"
  const base = modelId.includes('/') ? modelId.split('/').pop()! : modelId;
  return base
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/V(\d)/g, 'v$1');
}

export class ModelSelectorPopup {
  private containerEl: HTMLElement;
  private callbacks: ModelSelectorCallbacks;
  private plugin: any;

  private buttonEl: HTMLElement | null = null;
  private popupEl: HTMLElement | null = null;
  private submenuEl: HTMLElement | null = null;
  private popupOpen = false;

  private state: ModelSelectorState = {
    selectedModel: '',
    thinkingEnabled: false,
    effortLevel: 'medium',
  };

  // Provider groups: providerId -> models
  private providerGroups: Map<string, ModelOption[]> = new Map();

  private outsideClickHandler: (e: MouseEvent) => void;
  private submenuCloseTimeout: number | null = null;

  constructor(containerEl: HTMLElement, callbacks: ModelSelectorCallbacks, plugin: any) {
    this.containerEl = containerEl;
    this.callbacks = callbacks;
    this.plugin = plugin;

    this.outsideClickHandler = (e: MouseEvent) => {
      if (!this.popupEl) return;
      const target = e.target as Node;
      if (this.popupEl.contains(target) || this.buttonEl?.contains(target) || this.submenuEl?.contains(target)) {
        return;
      }
      this.closePopup();
    };
  }

  /** Initialize from plugin settings */
  initFromSettings(): void {
    const hermes = this.plugin?.settings?.hermes ?? {};
    this.state.selectedModel = hermes.model || '';
    this.state.effortLevel = hermes.effortLevel || 'medium';
    this.state.thinkingEnabled = hermes.thinkingEnabled ?? this.state.effortLevel !== 'none';
  }

  getState(): ModelSelectorState {
    return { ...this.state };
  }

  /** Load models dynamically from ~/.hermes/provider_models_cache.json */
  async loadModels(): Promise<void> {
    this.providerGroups.clear();

    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const cachePath = path.join(os.homedir(), '.hermes', 'provider_models_cache.json');

      if (!fs.existsSync(cachePath)) {
        this.loadFallbackModels();
        return;
      }

      const content = fs.readFileSync(cachePath, 'utf-8');
      const cache = JSON.parse(content) as Record<string, { models: string[]; fp: string; at: number }>;

      for (const [providerId, data] of Object.entries(cache)) {
        if (!data.models || data.models.length === 0) continue;
        const options: ModelOption[] = data.models.map(m => ({
          id: m,
          name: shortModelName(m),
          provider: providerId,
        }));
        this.providerGroups.set(providerId, options);
      }

      // Sort providers alphabetically by label
      this.providerGroups = new Map(
        [...this.providerGroups.entries()].sort((a, b) =>
          providerLabel(a[0]).localeCompare(providerLabel(b[0]))
        )
      );

      // Set default selected model if none set
      if (!this.state.selectedModel) {
        const first = this.providerGroups.values().next().value;
        if (first && first.length > 0) {
          this.state.selectedModel = first[0].id;
        }
      }
    } catch (error) {
      console.warn('ModelSelectorPopup: failed to load cache:', error);
      this.loadFallbackModels();
    }
  }

  private loadFallbackModels(): void {
    // Minimal free-model fallback derived from ~/.hermes/config.json defaults
    const freeFallback: Record<string, string[]> = {
      'nvidia': [
        'nvidia/llama-3.1-nemotron-70b-instruct',
        'nvidia/llama-3.3-nemotron-super-49b-v1.5',
        'nvidia/nemotron-3-super-120b-a12b',
        'nvidia/nemotron-3-nano-30b-a3b',
        'nvidia/nemotron-mini-4b-instruct',
      ],
      'nous': ['hermes-3-70b', 'hermes-3-8b'],
      'openrouter': ['meta-llama/llama-3.3-70b:free'],
    };
    for (const [providerId, models] of Object.entries(freeFallback)) {
      this.providerGroups.set(providerId, models.map(m => ({
        id: m,
        name: shortModelName(m),
        provider: providerId,
      })));
    }
    if (!this.state.selectedModel) {
      this.state.selectedModel = 'nvidia/llama-3.1-nemotron-70b-instruct';
    }
  }

  /** Render the trigger button (pill) into the composer */
  renderButton(parentEl: HTMLElement): HTMLElement {
    this.buttonEl = parentEl.createDiv({ cls: 'hermedian-model-pill' });
    this.buttonEl.setAttribute('role', 'button');
    this.buttonEl.setAttribute('tabindex', '0');
    this.updateButtonLabel();
    this.buttonEl.addEventListener('click', () => this.togglePopup());
    this.buttonEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.togglePopup();
      }
    });
    return this.buttonEl;
  }

  private updateButtonLabel(): void {
    if (!this.buttonEl) return;
    this.buttonEl.empty();
    const name = this.state.selectedModel ? shortModelName(this.state.selectedModel) : 'Select model';
    this.buttonEl.createSpan({ cls: 'hermedian-model-pill-name', text: name });
    const chevron = this.buttonEl.createSpan({ cls: 'hermedian-model-pill-chevron' });
    setIcon(chevron, 'chevron-down');
  }

  setSelectedModel(modelId: string): void {
    this.state.selectedModel = modelId;
    this.updateButtonLabel();
  }

  private togglePopup(): void {
    if (this.popupOpen) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  }

  private openPopup(): void {
    if (!this.buttonEl) return;
    this.closePopup(); // ensure clean state

    this.popupEl = document.createElement('div');
    this.popupEl.className = 'hermedian-model-popup';
    this.renderPopupContent();
    document.body.appendChild(this.popupEl);

    // Position above the button
    const rect = this.buttonEl.getBoundingClientRect();
    this.popupEl.style.position = 'fixed';
    this.popupEl.style.minWidth = '260px';
    // Place so popup bottom sits 8px above button top
    // Do after it's in DOM so we can measure
    requestAnimationFrame(() => {
      if (!this.popupEl || !this.buttonEl) return;
      const popupRect = this.popupEl.getBoundingClientRect();
      const btnRect = this.buttonEl.getBoundingClientRect();
      const left = Math.max(8, Math.min(btnRect.left, window.innerWidth - popupRect.width - 8));
      const top = Math.max(8, btnRect.top - popupRect.height - 8);
      this.popupEl.style.left = `${left}px`;
      this.popupEl.style.top = `${top}px`;
    });

    this.popupOpen = true;
    document.addEventListener('mousedown', this.outsideClickHandler, true);
  }

  private closePopup(): void {
    this.closeSubmenu();
    if (this.popupEl) {
      this.popupEl.remove();
      this.popupEl = null;
    }
    this.popupOpen = false;
    document.removeEventListener('mousedown', this.outsideClickHandler, true);
  }

  private renderPopupContent(): void {
    if (!this.popupEl) return;
    this.popupEl.empty();

    // Header
    const header = this.popupEl.createDiv({ cls: 'hermedian-model-popup-header' });
    header.createSpan({ text: 'Select Model' });
    const refreshBtn = header.createEl('button', { cls: 'hermedian-model-popup-refresh', title: 'Refresh models from Hermes' });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      refreshBtn.classList.add('hermedian-spinning');
      await this.callbacks.onRefresh();
      await this.loadModels();
      refreshBtn.classList.remove('hermedian-spinning');
      this.renderPopupContent();
    });

    // Search filter
    const searchWrap = this.popupEl.createDiv({ cls: 'hermedian-model-popup-search' });
    const searchInput = searchWrap.createEl('input', {
      attr: { type: 'text', placeholder: 'Search models...' },
    });
    searchInput.addEventListener('input', () => this.renderModelList(searchInput.value.toLowerCase()));
    searchInput.addEventListener('mousedown', (e) => e.stopPropagation()); // keep popup open

    // List container
    const list = this.popupEl.createDiv({ cls: 'hermedian-model-popup-list' });
    this.renderModelListInto(list, '');

    // Footer actions
    const footer = this.popupEl.createDiv({ cls: 'hermedian-model-popup-footer' });
    const editBtn = footer.createEl('button', { cls: 'hermedian-model-popup-action' });
    const editIcon = editBtn.createSpan();
    setIcon(editIcon, 'pencil');
    editBtn.createSpan({ text: 'Edit models / preferences...' });
    editBtn.addEventListener('click', () => {
      this.closePopup();
      this.callbacks.onEdit();
    });
  }

  private renderModelList(filter: string): void {
    const list = this.popupEl?.querySelector('.hermedian-model-popup-list') as HTMLElement | null;
    if (!list) return;
    this.renderModelListInto(list, filter);
  }

  private renderModelListInto(list: HTMLElement, filter: string): void {
    list.empty();

    let visibleCount = 0;

    for (const [providerId, models] of this.providerGroups.entries()) {
      const filtered = filter
        ? models.filter(m => m.id.toLowerCase().includes(filter) || m.name.toLowerCase().includes(filter))
        : models;
      if (filtered.length === 0) continue;

      const group = list.createDiv({ cls: 'hermedian-model-group-header' });
      group.setText(`── ${providerLabel(providerId)} ──`);

      for (const model of filtered) {
        visibleCount++;
        const item = list.createDiv({ cls: 'hermedian-model-item' });
        if (model.id === this.state.selectedModel) item.classList.add('selected');

        const labelSpan = item.createSpan({ cls: 'hermedian-model-item-name', text: model.name });
        const checkSpan = item.createSpan({ cls: 'hermedian-model-item-check' });
        setIcon(checkSpan, 'check');
        const arrowSpan = item.createSpan({ cls: 'hermedian-model-item-arrow' });
        setIcon(arrowSpan, 'chevron-right');

        item.addEventListener('click', () => {
          this.selectModel(model.id);
        });

        // Hover -> open submenu with thinking/effort options
        item.addEventListener('mouseenter', () => {
          if (this.submenuCloseTimeout !== null) {
            window.clearTimeout(this.submenuCloseTimeout);
            this.submenuCloseTimeout = null;
          }
          this.openSubmenu(item, model);
        });
        item.addEventListener('mouseleave', () => {
          this.scheduleSubmenuClose();
        });
      }
    }

    if (visibleCount === 0) {
      const empty = list.createDiv({ cls: 'hermedian-model-empty' });
      empty.setText(filter ? 'No models match your search.' : 'No models found. Click the refresh button to fetch models from Hermes.');
    }
  }

  private selectModel(modelId: string): void {
    this.state.selectedModel = modelId;
    this.updateButtonLabel();
    this.callbacks.onModelChange(modelId);
    this.callbacks.onOptionsChange(this.getState());
    this.closePopup();
  }

  private openSubmenu(anchorEl: HTMLElement, model: ModelOption): void {
    this.closeSubmenu();

    const submenu = document.createElement('div');
    submenu.className = 'hermedian-model-submenu';
    this.submenuEl = submenu;

    const title = submenu.createDiv({ cls: 'hermedian-model-submenu-title' });
    title.setText(model.name);

    const hasThinking = supportsThinking(model.id);

    // Thinking toggle
    const thinkingRow = submenu.createDiv({ cls: 'hermedian-submenu-row' });
    thinkingRow.createSpan({ cls: 'hermedian-submenu-label', text: 'Thinking' });
    const toggle = thinkingRow.createDiv({ cls: 'hermedian-toggle' });
    if (this.state.thinkingEnabled) toggle.classList.add('on');
    if (!hasThinking) toggle.classList.add('disabled');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!hasThinking) return;
      this.state.thinkingEnabled = !this.state.thinkingEnabled;
      toggle.toggleClass('on', this.state.thinkingEnabled);
      if (!this.state.thinkingEnabled) {
        this.state.effortLevel = 'none';
        this.syncEffortPills(submenu);
      } else if (this.state.effortLevel === 'none') {
        this.state.effortLevel = 'medium';
        this.syncEffortPills(submenu);
      }
      this.callbacks.onOptionsChange(this.getState());
    });

    // Effort pills
    const effortRow = submenu.createDiv({ cls: 'hermedian-submenu-row hermedian-submenu-effort' });
    effortRow.createSpan({ cls: 'hermedian-submenu-label', text: 'Effort' });
    const pillsWrap = effortRow.createDiv({ cls: 'hermedian-effort-pills' });

    for (const level of REASONING_LEVELS) {
      const pill = pillsWrap.createEl('button', { cls: 'hermedian-effort-pill' });
      pill.setText(level.label);
      pill.dataset.value = level.value;
      if (level.value === this.state.effortLevel) pill.classList.add('active');
      if (!hasThinking && level.value !== 'none') pill.classList.add('disabled');

      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!hasThinking && level.value !== 'none') return;
        this.state.effortLevel = level.value;
        this.state.thinkingEnabled = level.value !== 'none';
        const toggleEl = submenu.querySelector('.hermedian-toggle');
        toggleEl?.classList.toggle('on', this.state.thinkingEnabled);
        this.syncEffortPills(submenu);
        this.callbacks.onOptionsChange(this.getState());
      });
    }

    // Provider + model id detail
    const detail = submenu.createDiv({ cls: 'hermedian-model-submenu-detail' });
    detail.createSpan({ text: `Provider: ${providerLabel(model.provider)}` });
    detail.createEl('br');
    const idSpan = detail.createSpan({ cls: 'hermedian-model-submenu-id', text: model.id });

    document.body.appendChild(submenu);

    // Position to the right of the anchor item
    requestAnimationFrame(() => {
      if (!this.submenuEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const subRect = this.submenuEl.getBoundingClientRect();
      let left = rect.right + 8;
      let top = rect.top;

      // Flip left if no room on right
      if (left + subRect.width > window.innerWidth - 8) {
        const popupRect = this.popupEl?.getBoundingClientRect();
        left = (popupRect ? popupRect.left : rect.left) - subRect.width - 8;
      }
      // Clamp vertically
      if (top + subRect.height > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - subRect.height - 8);
      }
      this.submenuEl.style.left = `${left}px`;
      this.submenuEl.style.top = `${top}px`;
    });

    // Keep submenu open when hovering into it
    submenu.addEventListener('mouseenter', () => {
      if (this.submenuCloseTimeout !== null) {
        window.clearTimeout(this.submenuCloseTimeout);
        this.submenuCloseTimeout = null;
      }
    });
    submenu.addEventListener('mouseleave', () => {
      this.scheduleSubmenuClose();
    });
  }

  private syncEffortPills(submenu: HTMLElement): void {
    const pills = submenu.querySelectorAll('.hermedian-effort-pill');
    pills.forEach((pill) => {
      const p = pill as HTMLElement;
      p.classList.toggle('active', p.dataset.value === this.state.effortLevel);
    });
  }

  private scheduleSubmenuClose(): void {
    if (this.submenuCloseTimeout !== null) {
      window.clearTimeout(this.submenuCloseTimeout);
    }
    this.submenuCloseTimeout = window.setTimeout(() => {
      this.closeSubmenu();
    }, 250);
  }

  private closeSubmenu(): void {
    if (this.submenuEl) {
      this.submenuEl.remove();
      this.submenuEl = null;
    }
  }

  destroy(): void {
    this.closePopup();
  }
}
