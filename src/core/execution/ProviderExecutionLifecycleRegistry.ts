// src/core/execution/ProviderExecutionLifecycleRegistry.ts
import type {
  ProviderExecutionBackend,
  ProviderExecutionInvalidationReason,
  ProviderExecutionSession,
  ProviderExecutionSessionLease,
  ProviderExecutionTransitionHook,
  ProviderExecutionTransitionScope,
} from './types';

export class ProviderExecutionLifecycleRegistry {
  private generation = 0;
  private transitionHooks: Map<string, ProviderExecutionTransitionHook> = new Map();
  private activeSessions: Map<string, ProviderExecutionSessionLease> = new Map();
  private disposed = false;

  acquire(
    backend: ProviderExecutionBackend,
    config: { providerId: string; conversationId: string },
    ownerKind: string
  ): ProviderExecutionSessionLease {
    if (this.disposed) {
      throw new Error('Registry disposed');
    }

    const existing = this.activeSessions.get(config.providerId);
    if (existing) {
      return existing;
    }

    const generation = ++this.generation;
    const session = backend.createSession(config as any);
    
    const lease: ProviderExecutionSessionLease = {
      generation,
      session,
      isCurrent: () => {
        const current = this.activeSessions.get(config.providerId);
        return current === lease;
      },
      release: async () => {
        await session.stop();
        this.activeSessions.delete(config.providerId);
      },
      onInvalidated: () => {},
    };

    this.activeSessions.set(config.providerId, lease);
    return lease;
  }

  registerTransitionHook(providerId: string, hook: ProviderExecutionTransitionHook): () => void {
    this.transitionHooks.set(providerId, hook);
    return () => this.transitionHooks.delete(providerId);
  }

  dispose(): void {
    this.disposed = true;
    for (const lease of this.activeSessions.values()) {
      lease.release().catch(() => {});
    }
    this.activeSessions.clear();
  }
}