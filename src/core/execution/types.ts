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
  
  // Fork/rewind support
  forkFrom(sessionId: string, resumeAtMessageId: string): Promise<ProviderExecutionSession>;
  rewindTo(messageId: string): Promise<void>;
}

export interface ProviderExecutionRun {
  id: string;
  abortController: AbortController;
  stream: AsyncIterable<ProviderExecutionEvent>;
  forkedFrom?: { sessionId: string; messageId: string };
  rewoundFrom?: { sessionId: string; messageId: string };
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

export class WarmExecutionPool {
  private entries: Map<string, WarmEntry>;
  private operationTail: Promise<void>;
  private usageSequence: number;
  private getLimitFn: () => number;

  constructor(getLimitFn: () => number) {
    this.entries = new Map();
    this.operationTail = Promise.resolve();
    this.usageSequence = 0;
    this.getLimitFn = getLimitFn;
  }

  acquire(owner: WarmExecutionOwner): Promise<void> {
    return this.enqueue(async () => {
      const existing = this.entries.get(owner.id);
      if (existing) {
        existing.owner = owner;
        existing.lastUsed = this.nextUsageSequence();
        await this.coolExcess(this.getLimit());
        return;
      }

      const limit = this.getLimit();
      while (this.entries.size >= limit) {
        const victim = this.findCoolingCandidate();
        if (!victim) throw new WarmExecutionCapacityError(limit);
        await victim.owner.cool();
        this.entries.delete(victim.owner.id);
      }

      this.entries.set(owner.id, { owner, lastUsed: this.nextUsageSequence() });
    });
  }

  release(ownerId: string): void {
    this.entries.delete(ownerId);
  }

  has(ownerId: string): boolean {
    return this.entries.has(ownerId);
  }

  getWarmCount(): number {
    return this.entries.size;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.operationTail.catch(() => undefined).then(operation);
    this.operationTail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  private findCoolingCandidate(): WarmEntry | null {
    let candidate: WarmEntry | null = null;
    for (const entry of this.entries.values()) {
      if (!entry.owner.canCool()) continue;
      if (!candidate || entry.lastUsed < candidate.lastUsed) {
        candidate = entry;
      }
    }
    return candidate;
  }

  private async coolExcess(limit: number): Promise<void> {
    while (this.entries.size > limit) {
      const victim = this.findCoolingCandidate();
      if (!victim) return;
      await victim.owner.cool();
      this.entries.delete(victim.owner.id);
    }
  }

  private getLimit(): number {
    return normalizeWarmLimit(this.getLimitFn());
  }

  private nextUsageSequence(): number {
    return ++this.usageSequence;
  }
}

interface WarmEntry {
  owner: WarmExecutionOwner;
  lastUsed: number;
}

export class WarmExecutionCapacityError extends Error {
  constructor(readonly limit: number) {
    super(`Warm process limit (${limit}) reached. Finish a session first.`);
    this.name = 'WarmExecutionCapacityError';
  }
}

export function normalizeWarmLimit(configured: unknown): number {
  const finite = typeof configured === 'number' && Number.isFinite(configured)
    ? Math.trunc(configured)
    : 5;
  return Math.max(3, Math.min(10, finite));
}