// src/core/execution/ProviderExecutionSession.ts
import type { ProviderExecutionRequest, ProviderExecutionRun, ProviderSessionConfig, ProviderSessionEvent } from './types';

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