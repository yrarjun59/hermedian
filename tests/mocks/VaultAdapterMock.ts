import type { VaultFileAdapter } from '@/core/bootstrap/storage';
import { describe, it, expect } from '@jest/globals';

/** In-memory mock of VaultFileAdapter for testing ConversationRepository */
export class MockVaultAdapter implements VaultFileAdapter {
  private store: Map<string, string> = new Map();

  async read(filePath: string): Promise<string> {
    const normalized = normalizePath(filePath);
    const content = this.store.get(normalized);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file: ${filePath}`);
    }
    return content;
  }

  async write(filePath: string, content: string): Promise<void> {
    this.store.set(normalizePath(filePath), content);
  }

  async delete(filePath: string): Promise<void> {
    this.store.delete(normalizePath(filePath));
  }

  async list(dirPath: string): Promise<string[]> {
    const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';
    const matches = Array.from(this.store.keys())
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
    return matches;
  }

  clear(): void {
    this.store.clear();
  }

  /** Reset to a known fixture state */
  loadFixture(files: Record<string, string>): void {
    this.store.clear();
    for (const [filePath, content] of Object.entries(files)) {
      this.store.set(normalizePath(filePath), content);
    }
  }
}

function normalizePath(p: string): string {
  return p.split('\\').join('/').replace(/\/+/g, '/').replace(/\/$/, '');
}

export interface ConversationFixture {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  providerId: string;
  model: string;
  messageCount: number;
  providerState: Record<string, unknown>;
  sessionId: string | null;
  messages: unknown[];
}

export function makeConversationFixture(
  overrides: Partial<ConversationFixture> = {}
): ConversationFixture {
  return {
    id: 'conv-test-001',
    title: 'Test Conversation',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    providerId: 'hermes',
    model: 'nvidia/nemotron-3-super-120b-a12b',
    messageCount: 0,
    providerState: {},
    sessionId: null,
    messages: [],
    ...overrides,
  };
}

describe('MockVaultAdapter', () => {
  it('stores and retrieves files', async () => {
    const adapter = new MockVaultAdapter();
    await adapter.write('test/path.json', '{"key":"value"}');
    const content = await adapter.read('test/path.json');
    expect(content).toBe('{"key":"value"}');
  });

  it('throws on read of non-existent file', async () => {
    const adapter = new MockVaultAdapter();
    await expect(adapter.read('missing.json')).rejects.toThrow('ENOENT');
  });

  it('deletes files', async () => {
    const adapter = new MockVaultAdapter();
    await adapter.write('to-delete.json', 'data');
    await adapter.delete('to-delete.json');
    await expect(adapter.read('to-delete.json')).rejects.toThrow('ENOENT');
  });

  it('lists files in a directory', async () => {
    const adapter = new MockVaultAdapter();
    await adapter.write('.hermedian/conversations/a.json', '{}');
    await adapter.write('.hermedian/conversations/b.json', '{}');
    await adapter.write('.hermedian/conversations/b.ledger.json', '[]');

    const files = await adapter.list('.hermedian/conversations');
    expect(files.sort()).toEqual(['a.json', 'b.json', 'b.ledger.json'].sort());
  });

  it('normalizes Windows-style paths', async () => {
    const adapter = new MockVaultAdapter();
    await adapter.write('foo\\bar.json', 'content');
    const content = await adapter.read('foo/bar.json');
    expect(content).toBe('content');
  });

  it('loadFixture populates store from record', async () => {
    const adapter = new MockVaultAdapter();
    adapter.loadFixture({
      'a.json': '{"id":"a"}',
      'b.json': '{"id":"b"}',
    });
    expect(await adapter.read('a.json')).toBe('{"id":"a"}');
    expect(await adapter.read('b.json')).toBe('{"id":"b"}');
  });
});
