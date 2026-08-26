// src/providers/hermes/execution/HermesExecutionBackend.ts
import type { ProviderExecutionBackend, ProviderExecutionSession, ProviderSessionConfig } from '../../../core/execution/types';
import type { ProviderHost } from '../../../core/providers/ProviderHost';
import { HermesExecutionSession } from './HermesExecutionSession';

export class HermesExecutionBackend implements ProviderExecutionBackend {
  readonly providerId = 'hermes';

  constructor(private readonly host: ProviderHost) {}

  createSession(config: ProviderSessionConfig): ProviderExecutionSession {
    const sessionId = `hermes-${config.conversationId}-${Date.now()}`;
    return new HermesExecutionSession(sessionId, config);
  }
}