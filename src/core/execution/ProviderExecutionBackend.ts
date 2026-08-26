// src/core/execution/ProviderExecutionBackend.ts
import type { ProviderSessionConfig, ProviderExecutionSession } from './types';

export interface ProviderExecutionBackend {
  readonly providerId: string;
  createSession(config: ProviderSessionConfig): ProviderExecutionSession;
}