// src/core/execution/types.ts
export type ProviderId = string;

export interface ProviderSessionConfig {
  providerId: ProviderId;
  conversationId: string;
  workingDirectory: string;
  environment: Record<string, string>;
  model: string;
  effortLevel: string;
}

export interface ProviderExecutionSession {
  id: string;
  config: ProviderSessionConfig;
  status: 'idle' | 'running' | 'waiting' | 'completed' | 'error';
  
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
  | { type: 'tool_output'; toolId: string; output: unknown }
  | { type: 'completed'; usage?: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; error: string }
  | { type: 'cancelled' };

export type ProviderExecutionEvent = ProviderSessionEvent & {
  runId: string;
  timestamp: number;
};

export type ProviderExecutionInvalidationReason =
  | 'environment_changed'
  | 'cli_path_changed'
  | 'settings_changed'
  | 'session_timeout'
  | 'user_requested';

export interface ProviderExecutionBackend {
  readonly providerId: ProviderId;
  createSession(config: ProviderSessionConfig): ProviderExecutionSession;
}

export interface ProviderInteractionPort {
  requestApproval(request: ProviderApprovalInteractionRequest): Promise<ProviderApprovalInteractionResponse>;
  dismissInteraction(interactionId: string): void;
}

export interface ProviderApprovalInteractionRequest {
  interactionId: string;
  toolName: string;
  toolInput: unknown;
  description?: string;
}

export interface ProviderApprovalInteractionResponse {
  approved: boolean;
  alwaysAllow?: boolean;
}

export interface ProviderSessionSnapshot {
  sessionId: string;
  providerId: ProviderId;
  conversationId: string;
  status: ProviderSessionStatus;
  lastActivityAt: number;
  providerState?: Record<string, unknown>;
}

export type ProviderSessionStatus = 'active' | 'idle' | 'waiting_approval' | 'error' | 'disposed';

export interface ProviderSessionInvalidation {
  reason: ProviderExecutionInvalidationReason;
  timestamp: number;
}

export interface ProviderNativeResumeSeed {
  sessionId: string;
  conversationId: string;
  resumeAtMessageId?: string;
}

export interface ProviderNativePersistence {
  saveSession(snapshot: ProviderSessionSnapshot): Promise<void>;
  loadSession(sessionId: string): Promise<ProviderSessionSnapshot | null>;
  deleteSession(sessionId: string): Promise<void>;
}

export interface ProviderExecutionTransitionScope {
  providerIds: string[];
  generation: number;
  onInvalidated(handler: (reason: ProviderExecutionInvalidationReason) => void): void;
  isDisposed(): boolean;
}

export interface ProviderExecutionTransitionHook {
  beforeTransition?(): void | Promise<void>;
  afterTransition?(): void | Promise<void>;
}

export interface ProviderExecutionSessionLease {
  generation: number;
  session: ProviderExecutionSession;
  isCurrent(): boolean;
  release(): Promise<void>;
  onInvalidated(handler: (reason: ProviderExecutionInvalidationReason) => void): void;
}

export interface WarmExecutionOwner {
  id: string;
  canCool(): boolean;
  cool(): Promise<void>;
}

export class ProviderExecutionRegistryDisposedError extends Error {
  constructor(message = 'Provider execution registry has been disposed') {
    super(message);
    this.name = 'ProviderExecutionRegistryDisposedError';
  }
}

export class ProviderExecutionTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderExecutionTransitionError';
  }
}

export type ProviderExecutionInvalidationReason_union = ProviderExecutionInvalidationReason;