// src/features/chat/ModelSelector.ts
import { Notice, setIcon } from 'obsidian';

import type { ProviderUIOption, ProviderReasoningOption, ProviderChatUIConfig } from '../../core/providers/types';
import { ProviderRegistry } from '../../core/providers/ProviderRegistry';

interface HermesProviderCache {
  [provider: string]: {
    fp: string;
    at: number;
    models: string[];
  };
}

interface ModelWithMetadata {
  id: string;
  name: string;
  provider: string;
  displayName: string;
  supportsThinking: boolean;
  defaultThinkingLevel?: string;
}

export class ModelSelector {
  private plugin: any;
  private modelSelectEl: HTMLSelectElement;
  private containerEl: HTMLElement;
  private resolvedCliPath: string | null = null;
  private hermesModelsCache: Map<string, any> = new Map();
  
  constructor(containerEl: HTMLElement, modelSelectEl: HTMLSelectElement, plugin: any, resolvedCliPath: string | null) {
    this.containerEl = containerEl;
    this.modelSelectEl = modelSelectEl;
    this.plugin = plugin;
    this.resolvedCliPath = resolvedCliPath;
  }

  async loadModels(): Promise<void> {
    // Try to load from Hermes cache first
    const success = await this.loadFromHermesCache();
    if (!success) {
      this.loadFallbackModels();
    }
  }

  private async loadFromHermesCache(): Promise<boolean> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      
      const { stdout: configDir } = await execFileAsync('bash', ['-c', 'echo ~/.hermes']);
      const hermesDir = configDir.trim();
      
      const fs = await import('fs');
      const path = await import('path');
      const cachePath = path.join(hermesDir, 'provider_models_cache.json');
      
      if (!require('fs').existsSync(cachePath)) return false;
      
      const cacheContent = require('fs').readFileSync(cachePath, 'utf-8');
      const cache = JSON.parse(cacheContent) as Record<string, { models: string[] }>;
      
      if (this.modelSelectEl) {
        this.modelSelectEl.empty();
        
        const providers = Object.keys(cache).sort();
        let modelCount = 0;
        
        for (const provider of providers) {
          const data = cache[provider];
          if (!data.models || data.models.length === 0) continue;
          
          // Create optgroup
          const optgroup = document.createElement('optgroup');
          optgroup.label = `── ${provider.toUpperCase()} ──`;
          this.modelSelectEl.appendChild(optgroup);
          
          for (const model of data.models) {
            const option = document.createElement('option');
            option.value = model;
            const shortName = model.split('/').pop() || model;
            option.textContent = shortName.length > 50 ? shortName.substring(0, 50) + '...' : shortName;
            optgroup.appendChild(option);
            modelCount++;
          }
        }
        
        // Add refresh and edit options at the bottom
        const separator = document.createElement('optgroup');
        separator.label = '──────────';
        this.modelSelectEl.appendChild(separator);
        
        const refreshOption = document.createElement('option');
        refreshOption.value = '__REFRESH_MODELS__';
        refreshOption.textContent = '🔄 Refresh models from Hermes...';
        this.modelSelectEl.appendChild(refreshOption);
        
        const editOption = document.createElement('option');
        editOption.value = '__EDIT_MODELS__';
        editOption.textContent = '✏️ Edit models / preferences...';
        this.modelSelectEl.appendChild(editOption);
        
        const savedModel = this.plugin.settings?.hermes?.model;
        if (savedModel) {
          this.modelSelectEl.value = savedModel;
        } else {
          // Find first valid model
          const firstOption = this.modelSelectEl.querySelector('option[value]:not([value^="__"])');
          if (firstOption) this.modelSelectEl.value = (firstOption as HTMLOptionElement).value;
        }
        
        return true;
      }
    } catch (error) {
      console.warn('Failed to load from Hermes cache:', error);
      return false;
    }
    return false;
  }

  private loadFallbackModels(): void {
    if (!this.modelSelectEl) return;
    this.modelSelectEl.empty();
    
    // NVIDIA NIM group
    const nvidiaGroup = document.createElement('optgroup');
    nvidiaGroup.label = '── NVIDIA NIM ──';
    this.modelSelectEl.appendChild(nvidiaGroup);
    
    const nvidiaModels = [
      { value: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Llama 3.1 Nemotron 70B' },
      { value: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', label: 'Llama 3.3 Nemotron Super 49B' },
      { value: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'Nemotron 3 Ultra (550B)' },
      { value: 'nvidia/nemotron-3-super-120b-a12b', label: 'Nemotron 3 Super (120B)' },
      { value: 'nvidia/llama-3.1-nemotron-51b-instruct', label: 'Llama 3.1 Nemotron 51B' },
      { value: 'nvidia/nemotron-3-nano-30b-a3b', label: 'Nemotron 3 Nano (30B)' },
      { value: 'nvidia/nemotron-mini-4b-instruct', label: 'Nemotron Mini (4B)' },
      { value: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', label: 'Llama 3.1 Nemotron Ultra 253B' },
    ];
    
    for (const model of nvidiaModels) {
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.label;
      nvidiaGroup.appendChild(option);
    }
    
    // Nous Research group
    const nousGroup = document.createElement('optgroup');
    nousGroup.label = '── NOUS RESEARCH ──';
    this.modelSelectEl.appendChild(nousGroup);
    
    const nousModels = [
      { value: 'hermes-3-70b', label: 'Hermes 3 70B' },
      { value: 'hermes-3-8b', label: 'Hermes 3 8B' },
      { value: 'nemotron-3-ultra', label: 'Nemotron 3 Ultra (Nous)' },
    ];
    
    for (const model of nousModels) {
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.label;
      nousGroup.appendChild(option);
    }
    
    // Action options
    const actionsGroup = document.createElement('optgroup');
    actionsGroup.label = '──────────';
    this.modelSelectEl.appendChild(actionsGroup);
    
    const refreshOption = document.createElement('option');
    refreshOption.value = '__REFRESH_MODELS__';
    refreshOption.textContent = '🔄 Refresh models from Hermes...';
    this.modelSelectEl.appendChild(refreshOption);
    
    const editOption = document.createElement('option');
    editOption.value = '__EDIT_MODELS__';
    editOption.textContent = '✏️ Edit models / preferences...';
    this.modelSelectEl.appendChild(editOption);
    
    this.modelSelectEl.value = this.plugin.settings?.hermes?.model || 'nvidia/llama-3.1-nemotron-70b-instruct';
  }

  async handleModelChange(value: string): Promise<void> {
    if (value === '__REFRESH_MODELS__') {
      await this.refreshModels();
      return;
    }
    
    if (value === '__EDIT_MODELS__') {
      await this.openEditModels();
      return;
    }
    
    // Normal model selection
    this.plugin.settings.hermes.model = value;
    await this.plugin.saveSettings();
  }

  private async refreshModels(): Promise<void> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      
      const { stdout: configDir } = await execFileAsync('bash', ['-c', 'echo ~/.hermes']);
      const hermesDir = configDir.trim();
      
      // Trigger hermes to refresh model cache
      const cliPath = this.resolvedCliPath || 'hermes';
      await execFileAsync(cliPath, ['model', '--refresh'], { 
        timeout: 30000,
        cwd: hermesDir 
      });
      
      new Notice('Models refreshed from Hermes');
      await this.loadFromHermesCache();
    } catch (error) {
      console.error('Failed to refresh models:', error);
      new Notice('Failed to refresh models: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async openEditModels(): Promise<void> {
    // Open a modal for editing model preferences
    // This would show a list of models with checkboxes for thinking/reasoning
    const modal = document.createElement('div');
    modal.className = 'hermedian-model-edit-modal';
    modal.innerHTML = `
      <div class="hermedian-modal-overlay"></div>
      <div class="hermedian-modal-content">
        <div class="hermedian-modal-header">
          <h3>Edit Model Preferences</h3>
          <button class="hermedian-modal-close">×</button>
        </div>
        <div class="hermedian-modal-body">
          <p class="hermedian-modal-hint">Configure thinking/reasoning preferences per model</p>
          <div class="hermedian-model-list" id="model-edit-list"></div>
        </div>
        <div class="hermedian-modal-footer">
          <button class="hermedian-btn-primary" id="save-model-prefs">Save</button>
          <button class="hermedian-btn-secondary" id="cancel-model-prefs">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Populate model list with thinking options
    const modelList = modal.querySelector('#model-edit-list');
    if (modelList) {
      // This would show each model with checkboxes for thinking levels
      // For now, show a placeholder
      modelList.innerHTML = '<p>Model preferences editor coming soon. Currently uses global reasoning effort setting.</p>';
    }
    
    modal.querySelector('.hermedian-modal-close')?.addEventListener('click', () => modal.remove());
    modal.querySelector('.hermedian-modal-overlay')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#cancel-model-prefs')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#save-model-prefs')?.addEventListener('click', () => {
      new Notice('Model preferences saved');
      modal.remove();
    });
  }
}

export function createModelSelector(
  containerEl: HTMLElement,
  modelSelectEl: HTMLSelectElement,
  plugin: any,
  resolvedCliPath: string | null
): ModelSelector {
  return new ModelSelector(containerEl, modelSelectEl, plugin, resolvedCliPath);
}