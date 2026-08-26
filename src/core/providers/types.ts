// src/core/providers/types.ts
export type ProviderId = string;

export type EnvironmentScope = 'shared' | `provider:${string}`;

export interface AppTabManagerState {
  openTabs: Array<{ tabId: string; conversationId: string | null; draftModel?: string }>;
  activeTabId: string | null;
}

export interface ProviderCapabilities {
  providerId: ProviderId;
  supportsNativeHistory: boolean;
  supportsPlanMode: boolean;
  supportsRewind: boolean;
  supportsFork: boolean;
  supportsProviderCommands: boolean;
  supportsImageAttachments: boolean;
  supportsInstructionMode: boolean;
  supportsTurnSteer?: boolean;
  reasoningControl: 'effort' | 'token-budget' | 'none';
  planPathPrefix?: string;
}

export interface ProviderChatUIConfig {
  getModelOptions(settings: Record<string, unknown>): ProviderUIOption[];
  getDefaultModel?(settings: Record<string, unknown>): string | null;
  ownsModel(model: string, settings: Record<string, unknown>): boolean;
  isAdaptiveReasoningModel(model: string, settings: Record<string, unknown>): boolean;
  getReasoningOptions(model: string, settings: Record<string, unknown>): ProviderReasoningOption[];
  getDefaultReasoningValue(model: string, settings: Record<string, unknown>): string;
  getContextWindowSize(model: string): number;
  isDefaultModel(model: string): boolean;
  applyModelDefaults(model: string, settings: unknown): void;
  normalizeModelVariant(model: string, settings: Record<string, unknown>): string;
  getCustomModelIds(envVars: Record<string, string>): Set<string>;
  getProviderIcon?(): string | null;
}

export interface ProviderUIOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
}

export interface ProviderReasoningOption extends ProviderUIOption {
  tokens?: number;
}

export interface ProviderSettingsReconciler {
  invalidateConversationSessions(conversations: unknown[]): unknown[];
  reconcileModelWithEnvironment(settings: Record<string, unknown>, conversations: unknown[]): { changed: boolean; invalidatedConversations: unknown[] };
  normalizeModelVariantSettings(settings: Record<string, unknown>): boolean;
}

export interface ProviderSettingsStorageAdapter {
  hostScopedFields?: string[];
  legacyTopLevelFields?: string[];
  normalizeStored(target: Record<string, unknown>, stored: Record<string, unknown>): boolean;
}

export interface ProviderConversationHistoryService {
  hydrateConversationHistory(conversation: unknown, vaultPath: string | null): Promise<void>;
  resolveSessionIdForConversation(conversation: unknown): string | null;
}

export interface ProviderTaskResultInterpreter {
  hasAsyncLaunchMarker(toolUseResult: unknown): boolean;
  extractAgentId(toolUseResult: unknown): string | null;
  extractStructuredResult(toolUseResult: unknown): string | null;
  resolveTerminalStatus(toolUseResult: unknown, fallbackStatus: 'completed' | 'error'): 'completed' | 'error';
  extractTagValue(payload: string, tagName: string): string | null;
}

export interface ProviderExecutionBackend {
  readonly providerId: string;
  createSession(config: ProviderSessionConfig): ProviderExecutionSession;
}

export interface ProviderSessionConfig {
  providerId: string;
  conversationId: string;
  workingDirectory: string;
  environment: Record<string, string>;
  model: string;
  effortLevel: string;
}

export interface ProviderExecutionSession {
  id: string;
  execute(request: ProviderExecutionRequest): Promise<ProviderExecutionRun>;
  stop(): Promise<void>;
  onEvent(handler: (event: ProviderSessionEvent) => void): () => void;
}

export interface ProviderExecutionRun {
  id: string;
  abortController: AbortController;
  stream: AsyncIterable<ProviderExecutionEvent>;
}

export interface ProviderExecutionRequest {
  userMessage: string;
  conversationHistory?: unknown[];
  contextFiles?: string[];
  toolPolicy?: ProviderToolPolicy;
  images?: unknown[];
  systemInstructions?: string;
}

export interface ProviderToolPolicy {
  allowedTools?: string[];
  blockedTools?: string[];
  requireApproval?: string[];
}

export type ProviderSessionEvent =
  | { type: 'started' }
  | { type: 'text_delta'; content: string }
  | { type: 'thinking_delta'; content: string }
  | { type: 'tool_start'; toolName: string; toolId: string; input: unknown }
  | { type: 'tool_output'; toolName: string; toolId: string; output: unknown }
  | { type: 'completed'; usage?: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; error: string }
  | { type: 'cancelled' };

export type ProviderExecutionEvent = ProviderSessionEvent & {
  runId: string;
  timestamp: number;
};

export interface ProviderModule extends ProviderRegistration {
  id: ProviderId;
  settingsStorage: ProviderSettingsStorageAdapter;
  workspace: {
    initialize(context: unknown): Promise<ProviderWorkspaceServices>;
  };
}

export interface ProviderRegistration {
  displayName: string;
  blankTabOrder: number;
  isEnabled: (settings: Record<string, unknown>) => boolean;
  setEnabled?: (settings: Record<string, unknown>, enabled: boolean) => void;
  capabilities: ProviderCapabilities;
  environmentKeyPatterns?: RegExp[];
  chatUIConfig: ProviderChatUIConfig;
  settingsReconciler: ProviderSettingsReconciler;
  createExecutionBackend: (plugin: unknown) => ProviderExecutionBackend;
  historyService: ProviderConversationHistoryService;
  taskResultInterpreter: ProviderTaskResultInterpreter;
}

export interface ProviderWorkspaceServices {
  refreshAgentMentions?(): Promise<void>;
  dispose?(): Promise<void>;
}