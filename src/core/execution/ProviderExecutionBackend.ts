// src/core/execution/ProviderExecutionBackend.ts
import type { ProviderExecutionSession, ProviderNativeResumeSeed,ProviderSessionConfig } from './types';

export interface ProviderExecutionBackend {
  readonly providerId: string;
  createSession(config: ProviderSessionConfig, resumeSeed?: ProviderNativeResumeSeed): ProviderExecutionSession;
}