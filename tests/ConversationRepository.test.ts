import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ConversationRepository,
  InputLedgerEntry,
  ForkPoint,
  RewindPoint,
} from '@/core/bootstrap/ConversationRepository';
import { Conversation, ChatMessage } from '@/core/types/chat';
import { MockVaultAdapter, makeConversationFixture } from '@test/mocks/VaultAdapterMock';
import type { ConversationFixture } from '@test/mocks/VaultAdapterMock';

/** Build a Conversation that satisfies the ChatMessage[] type */
function makeConversation(
  base: ConversationFixture,
  messages: ChatMessage[] = []
): Conversation {
  return { ...base, messages } as Conversation;
}

describe('ConversationRepository', () => {
  let adapter: MockVaultAdapter;
  let repo: ConversationRepository;

  beforeEach(() => {
    adapter = new MockVaultAdapter();
    repo = new ConversationRepository(adapter, '.hermedian/conversations');
  });

  describe('initialize', () => {
    it('creates directory via .gitkeep file', async () => {
      await repo.initialize();
      const files = await adapter.list('.hermedian/conversations');
      expect(files).toContain('.gitkeep');
    });
  });

  describe('create / load', () => {
    it('creates a conversation and returns it on load', async () => {
      const fixture = makeConversationFixture();
      await repo.create(makeConversation(fixture));

      const loaded = await repo.load(fixture.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.conversation.id).toBe(fixture.id);
      expect(loaded!.conversation.title).toBe(fixture.title);
      expect(loaded!.ledger).toEqual([]);
    });

    it('returns null for non-existent conversation', async () => {
      const result = await repo.load('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('loadMeta / list', () => {
    it('lists conversations sorted by updatedAt descending', async () => {
      const a = makeConversationFixture({ id: 'a', updatedAt: 1000 });
      const b = makeConversationFixture({ id: 'b', updatedAt: 3000 });
      const c = makeConversationFixture({ id: 'c', updatedAt: 2000 });

      await repo.create(makeConversation(a));
      await repo.create(makeConversation(b));
      await repo.create(makeConversation(c));

      const metas = await repo.list();
      expect(metas).toHaveLength(3);
      expect(metas[0].id).toBe('b');
      expect(metas[1].id).toBe('c');
      expect(metas[2].id).toBe('a');
    });

    it('returns empty array when no conversations exist', async () => {
      const metas = await repo.list();
      expect(metas).toEqual([]);
    });

    it('loadMeta returns metadata without messages', async () => {
      const fixture = makeConversationFixture({ messages: [] });
      await repo.create(makeConversation(fixture));

      const meta = await repo.loadMeta(fixture.id);
      expect(meta).not.toBeNull();
      expect(meta!.id).toBe(fixture.id);
      expect('messages' in meta!).toBe(false);
    });

    it('loadMeta returns null for non-existent conversation', async () => {
      const meta = await repo.loadMeta('non-existent');
      expect(meta).toBeNull();
    });
  });

  describe('update', () => {
    it('persists conversation changes', async () => {
      const fixture = makeConversationFixture();
      await repo.create(makeConversation(fixture));

      const updated = makeConversation(fixture, [
        { id: 'm1', role: 'user', content: [{ type: 'text', text: 'hi' }], timestamp: 1000 } as ChatMessage,
      ]);
      updated.title = 'Updated Title';
      updated.messageCount = 5;
      await repo.update(updated);

      const loaded = await repo.load(fixture.id);
      expect(loaded!.conversation.title).toBe('Updated Title');
      expect(loaded!.conversation.messageCount).toBe(5);
    });
  });

  describe('appendToLedger', () => {
    it('appends an entry to an empty ledger', async () => {
      const fixture = makeConversationFixture();
      await repo.create(makeConversation(fixture));

      const entry: InputLedgerEntry = {
        messageId: 'msg-1',
        userMessage: 'Hello',
        timestamp: Date.now(),
        contextFiles: [],
      };
      await repo.appendToLedger(fixture.id, entry);

      const loaded = await repo.load(fixture.id);
      expect(loaded!.ledger).toHaveLength(1);
      expect(loaded!.ledger[0].messageId).toBe('msg-1');
      expect(loaded!.ledger[0].userMessage).toBe('Hello');
    });

    it('appends multiple entries in order', async () => {
      const fixture = makeConversationFixture();
      await repo.create(makeConversation(fixture));

      await repo.appendToLedger(fixture.id, {
        messageId: 'msg-1',
        userMessage: 'First',
        timestamp: 1000,
      });
      await repo.appendToLedger(fixture.id, {
        messageId: 'msg-2',
        userMessage: 'Second',
        timestamp: 2000,
      });
      await repo.appendToLedger(fixture.id, {
        messageId: 'msg-3',
        userMessage: 'Third',
        timestamp: 3000,
      });

      const loaded = await repo.load(fixture.id);
      expect(loaded!.ledger).toHaveLength(3);
      expect(loaded!.ledger.map(e => e.messageId)).toEqual(['msg-1', 'msg-2', 'msg-3']);
      expect(loaded!.ledger.map(e => e.userMessage)).toEqual(['First', 'Second', 'Third']);
    });

    it('appends to existing ledger', async () => {
      const fixture = makeConversationFixture();
      await repo.create(makeConversation(fixture));
      await repo.appendToLedger(fixture.id, {
        messageId: 'msg-1',
        userMessage: 'Existing',
        timestamp: 1000,
      });

      await repo.appendToLedger(fixture.id, {
        messageId: 'msg-2',
        userMessage: 'New',
        timestamp: 2000,
      });

      const loaded = await repo.load(fixture.id);
      expect(loaded!.ledger).toHaveLength(2);
      expect(loaded!.ledger[0].userMessage).toBe('Existing');
      expect(loaded!.ledger[1].userMessage).toBe('New');
    });
  });

  describe('fork', () => {
    it('creates a new conversation with ledger copied up to fork point', async () => {
      const source = makeConversationFixture({ id: 'source' });
      await repo.create(makeConversation(source));

      await repo.appendToLedger('source', {
        messageId: 'msg-1',
        userMessage: 'First',
        timestamp: 1000,
      });
      await repo.appendToLedger('source', {
        messageId: 'msg-2',
        userMessage: 'Second',
        timestamp: 2000,
      });
      await repo.appendToLedger('source', {
        messageId: 'msg-3',
        userMessage: 'Third',
        timestamp: 3000,
      });

      const forkPoint: ForkPoint = {
        conversationId: 'source',
        resumeAtMessageId: 'msg-2',
      };
      const newConv = makeConversation(makeConversationFixture({ id: 'forked' }));
      const result = await repo.fork(forkPoint, newConv);

      expect(result.conversation.id).toBe('forked');
      expect(result.ledger).toHaveLength(1);
      expect(result.ledger[0].messageId).toBe('msg-1');
      expect(result.ledger[0].userMessage).toBe('First');
    });

    it('throws when source conversation not found', async () => {
      const forkPoint: ForkPoint = {
        conversationId: 'non-existent',
        resumeAtMessageId: 'msg-1',
      };
      const newConv = makeConversation(makeConversationFixture());
      await expect(repo.fork(forkPoint, newConv))
        .rejects.toThrow('Source conversation non-existent not found');
    });

    it('throws when fork point message not found in ledger', async () => {
      const source = makeConversationFixture({ id: 'source' });
      await repo.create(makeConversation(source));
      await repo.appendToLedger('source', {
        messageId: 'msg-1',
        userMessage: 'Hello',
        timestamp: 1000,
      });

      const forkPoint: ForkPoint = {
        conversationId: 'source',
        resumeAtMessageId: 'msg-missing',
      };
      const newConv = makeConversation(makeConversationFixture());
      await expect(repo.fork(forkPoint, newConv))
        .rejects.toThrow('Fork point message msg-missing not found in ledger');
    });
  });

  describe('rewind', () => {
    it('truncates ledger and messages up to rewind point (inclusive)', async () => {
      const fixture = makeConversationFixture({ id: 'rewind-test' });
      await repo.create(makeConversation(fixture));

      await repo.appendToLedger('rewind-test', {
        messageId: 'msg-1',
        userMessage: 'First',
        timestamp: 1000,
      });
      await repo.appendToLedger('rewind-test', {
        messageId: 'msg-2',
        userMessage: 'Second',
        timestamp: 2000,
      });
      await repo.appendToLedger('rewind-test', {
        messageId: 'msg-3',
        userMessage: 'Third',
        timestamp: 3000,
      });

      // Also add messages to conversation
      const updated = await repo.load('rewind-test');
      if (updated) {
        updated.conversation.messages = [
          { id: 'm1', role: 'user', content: [{ type: 'text' }], timestamp: 1000 } as ChatMessage,
          { id: 'm2', role: 'user', content: [{ type: 'text' }], timestamp: 2000 } as ChatMessage,
          { id: 'm3', role: 'user', content: [{ type: 'text' }], timestamp: 3000 } as ChatMessage,
        ];
        await repo.update(updated.conversation);
      }

      const rewindPoint: RewindPoint = {
        conversationId: 'rewind-test',
        rewindToMessageId: 'msg-2',
      };

      const result = await repo.rewind(rewindPoint);

      expect(result.ledger).toHaveLength(2);
      expect(result.ledger.map(e => e.messageId)).toEqual(['msg-1', 'msg-2']);
      expect(result.conversation.messages).toHaveLength(2);
    });

    it('throws when conversation not found', async () => {
      const rewindPoint: RewindPoint = {
        conversationId: 'non-existent',
        rewindToMessageId: 'msg-1',
      };
      await expect(repo.rewind(rewindPoint))
        .rejects.toThrow('Conversation non-existent not found');
    });

    it('throws when rewind point message not found', async () => {
      const fixture = makeConversationFixture({ id: 'rewind-bad' });
      await repo.create(makeConversation(fixture));
      await repo.appendToLedger('rewind-bad', {
        messageId: 'msg-1',
        userMessage: 'Hello',
        timestamp: 1000,
      });

      const rewindPoint: RewindPoint = {
        conversationId: 'rewind-bad',
        rewindToMessageId: 'msg-missing',
      };
      await expect(repo.rewind(rewindPoint))
        .rejects.toThrow('Rewind point message msg-missing not found in ledger');
    });
  });

  describe('updateSessionMetadata', () => {
    it('sets sessionId and providerState', async () => {
      const fixture = makeConversationFixture();
      await repo.create(makeConversation(fixture));

      await repo.updateSessionMetadata(fixture.id, 'session-abc', { model: 'haiku' });

      const loaded = await repo.load(fixture.id);
      expect(loaded!.conversation.sessionId).toBe('session-abc');
      expect(loaded!.conversation.providerState).toEqual({ model: 'haiku' });
    });

    it('throws when conversation not found', async () => {
      await expect(repo.updateSessionMetadata('non-existent', 'session-1', {}))
        .rejects.toThrow('Conversation non-existent not found');
    });

    it('null sessionId clears the session', async () => {
      const fixture = makeConversationFixture({ sessionId: 'old-session' });
      await repo.create(makeConversation(fixture));

      await repo.updateSessionMetadata(fixture.id, null, {});

      const loaded = await repo.load(fixture.id);
      expect(loaded!.conversation.sessionId).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes conversation and ledger files', async () => {
      const fixture = makeConversationFixture();
      await repo.create(makeConversation(fixture));
      await repo.appendToLedger(fixture.id, {
        messageId: 'msg-1',
        userMessage: 'Hello',
        timestamp: 1000,
      });

      await repo.delete(fixture.id);

      await expect(repo.load(fixture.id)).resolves.toBeNull();
      const files = await adapter.list('.hermedian/conversations');
      expect(files).toHaveLength(0);
    });

    it('does not throw when deleting non-existent conversation', async () => {
      await expect(repo.delete('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('load with no ledger', () => {
    it('returns empty ledger when ledger file does not exist', async () => {
      const fixture = makeConversationFixture();
      await repo.create(makeConversation(fixture));

      // Delete the ledger manually
      await adapter.delete('.hermedian/conversations/conv-test-001.ledger.json');

      const loaded = await repo.load(fixture.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.ledger).toEqual([]);
    });
  });
});
