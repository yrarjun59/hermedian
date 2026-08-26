// src/core/execution/index.ts
// Re-export from modules that don't overlap with types.ts
export * from './events';
export * from './ProviderInteractionPort';
export * from './ProviderSessionSnapshot';

// Re-export interfaces from their defining modules (these are the single source of truth)
export type {
  ProviderExecutionBackend,
} from './ProviderExecutionBackend';
export type {
  ProviderExecutionLifecycleRegistry,
} from './ProviderExecutionLifecycleRegistry';
export type {
  ProviderExecutionSession,
} from './ProviderExecutionSession';

// Re-export types from types.ts (excluding classes)
export type {
  ProviderApprovalInteractionRequest,
  ProviderApprovalInteractionResponse,
  ProviderExecutionInvalidationReason,
  ProviderExecutionRun,
  ProviderExecutionSessionLease,
  ProviderExecutionTransitionHook,
  ProviderExecutionTransitionScope,
  ProviderNativePersistence,
  ProviderNativeResumeSeed,
  ProviderSessionConfig,
  ProviderSessionInvalidation,
  ProviderSessionSnapshot,
  ProviderSessionStatus,
  ProviderToolPolicy,
  WarmExecutionOwner,
} from './types';

// Re-export classes (values) from types.ts - these also export their types
export {
  normalizeWarmLimit,
  WarmExecutionCapacityError,
  WarmExecutionPool,
} from './types';