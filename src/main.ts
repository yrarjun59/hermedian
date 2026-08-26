// src/main.ts - Hermedian Plugin Entry Point
import type { Editor, WorkspaceLeaf } from 'obsidian';
import { MarkdownView, Notice, Plugin, TFile, setIcon } from 'obsidian';

import type { HermedianSettings } from './core/types/settings';
import { DEFAULT_HERMEDIAN_SETTINGS } from './core/types/settings';
import { VIEW_TYPE_HERMEDIAN } from './core/types/chat';
import { HermedianSettingTab } from './features/settings/HermedianSettingTab';
import { HermedianView } from './features/chat/HermedianView';
import './providers'; // Register providers at import time

export default class HermedianPlugin extends Plugin {
  settings!: HermedianSettings;

  async onload() {
    await this.loadSettings();

    // Register the main chat view
    this.registerView(
      VIEW_TYPE_HERMEDIAN,
      (leaf: WorkspaceLeaf) => new HermedianView(leaf, this)
    );

    // Ribbon icon to open chat
    this.addRibbonIcon('bot', 'Open Hermedian', () => {
      this.activateView();
    });

    // Command palette commands
    this.addCommand({
      id: 'open-chat',
      name: 'Open chat view',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'inline-edit',
      name: 'Inline edit selection',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.openInlineEdit(editor, view);
      },
    });

    // Settings tab
    this.addSettingTab(new HermedianSettingTab(this.app, this));

    console.log('Hermedian loaded');
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_HERMEDIAN);
    console.log('Hermedian unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_HERMEDIAN_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_HERMEDIAN)[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_HERMEDIAN, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  private openInlineEdit(editor: Editor, view: MarkdownView) {
    const selection = editor.getSelection();
    if (!selection) {
      new Notice('Select some text first');
      return;
    }
    // TODO: Open InlineEditModal
    new Notice('Inline edit coming soon');
  }
}