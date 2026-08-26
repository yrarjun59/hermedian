// src/core/execution/events.ts
import type { ProviderExecutionEvent, ProviderSessionEvent } from './types';

export type {
  ProviderExecutionEvent,
  ProviderSessionEvent,
};

export function createExecutionEvent(
  runId: string,
  sessionEvent: ProviderSessionEvent
): ProviderExecutionEvent {
  return {
    ...sessionEvent,
    runId,
    timestamp: Date.now(),
  };
}