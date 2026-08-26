// src/providers/hermes/execution/HermesExecutionBackend.ts
import type { ProviderExecutionBackend, ProviderExecutionSession, ProviderNativeResumeSeed, ProviderSessionConfig } from '../../../core/execution/types';
import type { ProviderHost } from '../../../core/providers/ProviderHost';
import { HermesExecutionSession } from './HermesExecutionSession';

export class HermesExecutionBackend implements ProviderExecutionBackend {
  readonly providerId = 'hermes';
  private cliPath: string;

  constructor(
    private readonly host: ProviderHost,
    cliPath: string,
  ) {
    this.cliPath = cliPath;
  }

  /**
   * Sets the CLI path for this backend (useful when path is resolved asynchronously)
   */
  setCliPath(cliPath: string): void {
    this.cliPath = cliPath;
  }

  /**
   * Gets the current CLI path
   */
  getCliPath(): string {
    return this.cliPath;
  }

  createSession(config: ProviderSessionConfig, resumeSeed?: ProviderNativeResumeSeed): ProviderExecutionSession {
    const sessionId = `hermes-${config.conversationId}-${Date.now()}`;
    const session = new HermesExecutionSession(sessionId, config, this.cliPath);
    if (resumeSeed) {
      console.log(`[Hermes] Resuming session ${resumeSeed.sessionId} at message ${resumeSeed.resumeAtMessageId}`);
    }
    return session;
  }
}