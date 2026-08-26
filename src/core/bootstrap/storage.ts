// src/core/bootstrap/storage.ts
import type { AppTabManagerState } from '../providers/types';

/**
 * Minimal shared app storage contract.
 *
 * This interface covers only the storage concerns that are shared across
 * all providers: Hermedian settings, legacy tab state migration, and session metadata.
 *
 * Provider-specific storage surfaces live behind provider-owned modules.
 */
export interface SessionMetadataReader {
  load(id: string): Promise<unknown>;
  list(): Promise<unknown[]>;
}

export interface VaultFileAdapter {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  delete(path: string): Promise<void>;
  list(path: string): Promise<string[]>;
}

export interface SharedAppStorage {
  initialize(): Promise<{ hermedian: Record<string, unknown> }>;
  saveHermedianSettings(settings: Record<string, unknown>): Promise<void>;
  getTabManagerState(): Promise<AppTabManagerState | null>;
  clearTabManagerState(): Promise<void>;
  /** Read-only startup metadata access; conversation writers stay repository-private. */
  sessions: SessionMetadataReader;
  getAdapter(): VaultFileAdapter;
}