// src/core/types/index.ts
export * from './chat';
export * from './settings';

export interface ToolCallInfo {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

export interface SlashCommand {
  name: string;
  description: string;
  content: string;
  source: 'user' | 'vault' | 'builtin';
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  source: 'user' | 'vault' | 'builtin';
}

export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version: string;
}