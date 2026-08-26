// src/core/execution/ProviderSessionSnapshot.ts
import type { ProviderSessionStatus } from './types';

export interface ProviderSessionSnapshot {
  sessionId: string;
  providerId: string;
  conversationId: string;
  status: ProviderSessionStatus;
  lastActivityAt: number;
  providerState?: Record<string, unknown>;
}