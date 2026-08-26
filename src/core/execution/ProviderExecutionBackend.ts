// src/core/execution/ProviderExecutionBackend.ts
import type { ProviderExecutionSession,ProviderSessionConfig } from './types';

export interface ProviderExecutionBackend {
  readonly providerId: string;
  createSession(config: ProviderSessionConfig): ProviderExecutionSession;
}