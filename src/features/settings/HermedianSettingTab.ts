// src/features/settings/HermedianSettingTab.ts
import type { App } from 'obsidian';
import { DropdownComponent, PluginSettingTab, Setting, TextComponent, ToggleComponent } from 'obsidian';

import type { HermedianSettings } from '../../core/types/settings';
import type HermedianPlugin from '../../main';

export class HermedianSettingTab extends PluginSettingTab {
  plugin: HermedianPlugin;

  constructor(app: App, plugin: HermedianPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Hermedian Settings' });

    // Hermes Agent section
    containerEl.createEl('h3', { text: 'Hermes Agent' });

    this.addCliPathSetting(containerEl);
    this.addModelSetting(containerEl);
    this.addEffortSetting(containerEl);
    this.addSafeModeSetting(containerEl);
    this.addMcpToggle(containerEl);
    this.addBangBashToggle(containerEl);

    // Environment section
    containerEl.createEl('h3', { text: 'Environment' });
    this.addEnvironmentVariables(containerEl);

    // Performance section
    containerEl.createEl('h3', { text: 'Performance' });
    this.addMaxWarmProcesses(containerEl);
  }

  private addCliPathSetting(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName('Hermes CLI path')
      .setDesc('Path to the hermes executable (leave empty for auto-detection)');

    const textComp = new TextComponent(setting.controlEl)
      .setPlaceholder('/usr/local/bin/hermes')
      .setValue(this.plugin.settings.hermes.cliPath)
      .onChange(async (value) => {
        this.plugin.settings.hermes.cliPath = value;
        await this.plugin.saveSettings();
      });
  }

  private addModelSetting(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName('Default model')
      .setDesc('Model to use for conversations');

    const models = [
      { value: 'sonnet', label: 'Sonnet (balanced)' },
      { value: 'opus', label: 'Opus (most capable)' },
      { value: 'haiku', label: 'Haiku (fastest)' },
    ];

    const dropdown = new DropdownComponent(setting.controlEl);
    for (const model of models) {
      dropdown.addOption(model.value, model.label);
    }
    dropdown.setValue(this.plugin.settings.hermes.model);
    dropdown.onChange(async (value) => {
      this.plugin.settings.hermes.model = value;
      await this.plugin.saveSettings();
    });
  }

  private addEffortSetting(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName('Reasoning effort')
      .setDesc('How much effort the agent puts into reasoning');

    const efforts = [
      { value: 'low', label: 'Low (fast)' },
      { value: 'medium', label: 'Medium (balanced)' },
      { value: 'high', label: 'High (thorough)' },
    ];

    const dropdown = new DropdownComponent(setting.controlEl);
    for (const effort of efforts) {
      dropdown.addOption(effort.value, effort.label);
    }
    dropdown.setValue(this.plugin.settings.hermes.effortLevel);
    dropdown.onChange(async (value) => {
      this.plugin.settings.hermes.effortLevel = value as any;
      await this.plugin.saveSettings();
    });
  }

  private addSafeModeSetting(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName('Safe mode')
      .setDesc('When to ask for approval before executing actions');

    const modes = [
      { value: 'auto', label: 'Auto (ask for dangerous actions)' },
      { value: 'ask', label: 'Always ask' },
      { value: 'yolo', label: 'YOLO (never ask)' },
    ];

    const dropdown = new DropdownComponent(setting.controlEl);
    for (const mode of modes) {
      dropdown.addOption(mode.value, mode.label);
    }
    dropdown.setValue(this.plugin.settings.hermes.safeMode);
    dropdown.onChange(async (value) => {
      this.plugin.settings.hermes.safeMode = value as any;
      await this.plugin.saveSettings();
    });
  }

  private addMcpToggle(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName('Enable MCP servers')
      .setDesc('Allow Hermes to connect to external MCP servers');

    const toggle = new ToggleComponent(setting.controlEl)
      .setValue(this.plugin.settings.hermes.enableMcp)
      .onChange(async (value) => {
        this.plugin.settings.hermes.enableMcp = value;
        await this.plugin.saveSettings();
      });
  }

  private addBangBashToggle(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName('Enable bang-bash mode')
      .setDesc('Type ! to execute shell commands directly');

    const toggle = new ToggleComponent(setting.controlEl)
      .setValue(this.plugin.settings.hermes.enableBangBash)
      .onChange(async (value) => {
        this.plugin.settings.hermes.enableBangBash = value;
        await this.plugin.saveSettings();
      });
  }

  private addEnvironmentVariables(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName('Environment variables')
      .setDesc('Additional environment variables (KEY=VALUE, one per line)');

    const textArea = setting.controlEl.createEl('textarea', {
      cls: 'hermedian-env-variables',
      attr: {
        rows: '5',
        placeholder: 'HERMES_API_KEY=your-key\nHERMES_BASE_URL=https://...',
      }
    });
    textArea.value = this.plugin.settings.sharedEnvironmentVariables;
    textArea.addEventListener('change', async () => {
      this.plugin.settings.sharedEnvironmentVariables = textArea.value;
      await this.plugin.saveSettings();
    });
  }

  private addMaxWarmProcesses(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName('Max warm processes')
      .setDesc('Maximum number of concurrent agent processes (3-10)');

    const slider = setting.controlEl.createEl('input', {
      type: 'range',
      attr: { min: '3', max: '10', step: '1' }
    });
    slider.value = String(this.plugin.settings.maxWarmProcesses);
    
    const valueLabel = setting.controlEl.createSpan({ 
      text: String(this.plugin.settings.maxWarmProcesses) 
    });
    
    slider.addEventListener('input', async () => {
      const value = parseInt(slider.value, 10);
      this.plugin.settings.maxWarmProcesses = value;
      valueLabel.textContent = String(value);
      await this.plugin.saveSettings();
    });
  }
}