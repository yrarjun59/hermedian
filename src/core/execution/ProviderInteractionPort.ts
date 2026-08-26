// src/core/execution/ProviderInteractionPort.ts
import type { ProviderApprovalInteractionRequest, ProviderApprovalInteractionResponse } from './types';

export interface ProviderInteractionPort {
  requestApproval(request: ProviderApprovalInteractionRequest): Promise<ProviderApprovalInteractionResponse>;
  dismissInteraction(interactionId: string): void;
}