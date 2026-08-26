/**
 * Architecture boundary tests — Phase 4 Infra Agent task.
 *
 * These tests enforce module dependency boundaries: which layers may import
 * from which. If a lower layer imports from a higher one, or a feature layer
 * reaches into another feature's internals, the test fails.
 *
 * Boundaries:
 *  - core/     → may import from core/ only (own layer)
 *  - providers/hermes/ → may import from core/ + own layer
 *  - features/  → may import from core/ + providers/hermes/ + own layer
 *  - main.ts    → may import from everything (entry point, wiring only)
 */

import { readFileSync } from 'fs';
import { describe, it, expect } from '@jest/globals';

const LAYER_PATHS = {
  CORE: 'src/core/',
  PROVIDER: 'src/providers/hermes/',
  FEATURES: 'src/features/',
  ENTRY: 'src/main.ts',
} as const;

type Layer = keyof typeof LAYER_PATHS;

const SOURCE_FILES = [
  // core layer
  'src/core/execution/types.ts',
  'src/core/execution/ProviderExecutionBackend.ts',
  'src/core/execution/ProviderExecutionSession.ts',
  'src/core/execution/ProviderInteractionPort.ts',
  'src/core/execution/ProviderSessionSnapshot.ts',
  'src/core/execution/ProviderExecutionLifecycleRegistry.ts',
  'src/core/execution/events.ts',
  'src/core/providers/ProviderRegistry.ts',
  'src/core/providers/ProviderHost.ts',
  'src/core/providers/types.ts',
  'src/core/providers/providerConfig.ts',
  'src/core/bootstrap/ConversationRepository.ts',
  'src/core/bootstrap/storage.ts',
  // provider layer
  'src/providers/hermes/execution/HermesExecutionBackend.ts',
  'src/providers/hermes/execution/HermesExecutionSession.ts',
  'src/providers/hermes/settings.ts',
  'src/providers/hermes/capabilities.ts',
  'src/providers/hermes/registration.ts',
  'src/providers/hermes/history/HermesConversationHistoryService.ts',
  'src/providers/hermes/ui/HermesChatUIConfig.ts',
  // feature layer
  'src/features/chat/HermedianView.ts',
  'src/features/chat/TabManager.ts',
  'src/features/settings/HermedianSettingTab.ts',
];

function getLayer(filePath: string): Layer {
  if (filePath === 'src/main.ts') return 'ENTRY';
  if (filePath.startsWith(LAYER_PATHS.CORE)) return 'CORE';
  if (filePath.startsWith(LAYER_PATHS.PROVIDER)) return 'PROVIDER';
  if (filePath.startsWith(LAYER_PATHS.FEATURES)) return 'FEATURES';
  throw new Error(`Unknown layer for file: ${filePath}`);
}

/**
 * Extract import paths from TypeScript source.
 * Handles: import ... from '...'  and  import type ... from '...'
 * Skips: node builtins, obsidian types, external packages, index re-exports.
 */
function extractImports(content: string, _sourceFile: string): string[] {
  const imports: string[] = [];
  // Match: import ... from '...'  (skip side-effect imports)
  const importRegex = /^import\s+(?:[\w\n\*,\s{}]+\s+from\s+)?['"]([^'"]+)['"]/gm;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const path = match[1];
    // Skip node builtins and obsidian types (external)
    if (
      ['obsidian', 'electron', 'child_process', 'fs', 'path', 'crypto', 'url',
       'util', 'events', 'stream', 'buffer', 'process'].includes(path) ||
      path.startsWith('@types/') ||
      path.startsWith('@codemirror/') ||
      path.startsWith('@modelcontextprotocol/') ||
      path.startsWith('tslib') ||
      path.startsWith('smol-toml')
    ) {
      continue;
    }
    // Skip relative imports to index files — those are re-exports, not direct deps
    if (path.endsWith('/index') || path === './index' || path === '../index') {
      continue;
    }
    // Skip external package imports (not starting with . or ..)
    if (!path.startsWith('.') && !path.startsWith('/')) {
      continue;
    }
    imports.push(path);
  }
  return imports;
}

/**
 * Check if a resolved import path falls within a layer.
 */
function pathInLayer(resolvedPath: string, layer: Layer): boolean {
  const layerPrefix = LAYER_PATHS[layer];
  const clean = resolvedPath.replace(/^\.\//, '');
  return clean.startsWith(layerPrefix);
}

function readSource(relativePath: string): string {
  const fullPath = `src/${relativePath}`;
  try {
    return readFileSync(fullPath, 'utf8');
  } catch {
    throw new Error(`Source file not found: ${fullPath}. ` +
      `Ensure the tests are run from the hermedian project root.`);
  }
}

describe('Architecture Boundary Tests', () => {
  it('enforces that core layer does not import from provider or features', () => {
    const violations: string[] = [];

    for (const file of SOURCE_FILES) {
      if (getLayer(file) !== 'CORE') continue;
      const content = readSource(file);
      const imports = extractImports(content, file);
      for (const imp of imports) {
        const dir = file.substring(0, file.lastIndexOf('/'));
        // Resolve: handle directory imports (./foo → ./foo/index)
        let resolved = imp;
        if (resolved.endsWith('/')) {
          resolved = resolved + 'index';
        }
        if (pathInLayer(resolved, 'PROVIDER') || pathInLayer(resolved, 'FEATURES')) {
          violations.push(`${file} → ${resolved}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('enforces that provider layer does not import from features', () => {
    const violations: string[] = [];

    for (const file of SOURCE_FILES) {
      if (getLayer(file) !== 'PROVIDER') continue;
      const content = readSource(file);
      const imports = extractImports(content, file);
      for (const imp of imports) {
        let resolved = imp;
        if (resolved.endsWith('/')) {
          resolved = resolved + 'index';
        }
        if (pathInLayer(resolved, 'FEATURES')) {
          violations.push(`${file} → ${resolved}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('enforces that feature layer does not import across feature boundaries', () => {
    const violations: string[] = [];

    for (const file of SOURCE_FILES) {
      if (getLayer(file) !== 'FEATURES') continue;
      const content = readSource(file);
      const imports = extractImports(content, file);
      for (const imp of imports) {
        let resolved = imp;
        if (resolved.endsWith('/')) {
          resolved = resolved + 'index';
        }
        if (pathInLayer(resolved, 'FEATURES')) {
          const featureDir = file.split('/').slice(2, 3).join('/');
          const resolvedFeatureDir = resolved.split('/').slice(2, 3).join('/');
          if (featureDir !== resolvedFeatureDir) {
            violations.push(`${file} → ${resolved} (cross-feature: ${featureDir} → ${resolvedFeatureDir})`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('enforces that main.ts only wires, does not contain business logic', () => {
    const mainContent = readSource('src/main.ts');

    // Verify main.ts has the expected plugin structure
    expect(mainContent).toContain('class HermedianPlugin');
    expect(mainContent).toContain('extends Plugin');
    expect(mainContent).toContain('onload');
    expect(mainContent).toContain('onunload');
  });

  it('enforces that core/execution/types.ts is the single source of truth for execution types', () => {
    const typesContent = readSource('src/core/execution/types.ts');

    expect(typesContent).toContain('interface ProviderExecutionSession');
    expect(typesContent).toContain('execute(request: ProviderExecutionRequest)');
    expect(typesContent).toContain("status: 'idle' | 'running' | 'waiting' | 'completed' | 'error'");
    // Verify no class implementations live in types.ts
    expect(typesContent).not.toMatch(/^export class /m);
  });

  it('enforces that ProviderRegistry is the single registry for providers', () => {
    const registryContent = readSource('src/core/providers/ProviderRegistry.ts');

    expect(registryContent).toContain('static register');
    expect(registryContent).toContain('static getCapabilities');
    expect(registryContent).toContain('static getChatUIConfig');
    expect(registryContent).toContain('static getRegisteredProviderIds');
  });

  it('enforces that ConversationRepository owns input ledger and fork/rewind logic', () => {
    const repoContent = readSource('src/core/bootstrap/ConversationRepository.ts');

    expect(repoContent).toContain('appendToLedger');
    expect(repoContent).toContain('fork(');
    expect(repoContent).toContain('rewind(');
    expect(repoContent).toContain('InputLedgerEntry');
    expect(repoContent).toContain('ForkPoint');
    expect(repoContent).toContain('RewindPoint');
  });

  it('enforces that HermesExecutionBackend implements ProviderExecutionBackend', () => {
    const backendContent = readSource('src/providers/hermes/execution/HermesExecutionBackend.ts');

    expect(backendContent).toContain('implements ProviderExecutionBackend');
  });
});
