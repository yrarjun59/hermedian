// src/providers/hermes/execution/HermesExecutionBackend.ts
import type { ProviderExecutionBackend, ProviderExecutionSession, ProviderNativeResumeSeed,ProviderSessionConfig } from '../../../core/execution/types';
import type { ProviderHost } from '../../../core/providers/ProviderHost';
import { HermesExecutionSession } from './HermesExecutionSession';

export class HermesExecutionBackend implements ProviderExecutionBackend {
  readonly providerId = 'hermes';

  constructor(private readonly host: ProviderHost) {}

  createSession(config: ProviderSessionConfig, resumeSeed?: ProviderNativeResumeSeed): ProviderExecutionSession {
    const sessionId = `hermes-${config.conversationId}-${Date.now()}`;
    const session = new HermesExecutionSession(sessionId, config);
    // Note: resumeSeed is used for native session resume
    // Hermes CLI handles resume via --resume flag or similar
    if (resumeSeed) {
      console.log(`[Hermes] Resuming session ${resumeSeed.sessionId} at message ${resumeSeed.resumeAtMessageId}`);
    }
    return session;
  }
}