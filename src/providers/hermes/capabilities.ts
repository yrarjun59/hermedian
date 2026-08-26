// src/providers/hermes/capabilities.ts
import type { ProviderCapabilities } from '../../core/providers/types';

export const HERMES_CAPABILITIES: Readonly<ProviderCapabilities> = Object.freeze({
  providerId: 'hermes',
  supportsNativeHistory: true,
  supportsPlanMode: true,
  supportsRewind: true,
  supportsFork: true,
  supportsProviderCommands: true,
  supportsImageAttachments: true,
  supportsInstructionMode: true,
  supportsTurnSteer: true,
  reasoningControl: 'effort',
  planPathPrefix: '/.hermes/plans/',
});