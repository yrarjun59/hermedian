// src/core/bootstrap/ConversationRepository.ts
import type { Conversation, ConversationMeta } from '../types/chat';
import type { VaultFileAdapter } from './storage';

/**
 * Input ledger entry — append-only log of user turns.
 * Never modified after creation; fork/rewind operate by copying/truncating.
 */
export interface InputLedgerEntry {
  messageId: string;
  userMessage: string;
  timestamp: number;
  contextFiles?: string[];
  toolPolicy?: {
    allowedTools?: string[];
    blockedTools?: string[];
    requireApproval?: string[];
  };
  images?: unknown[];
  systemInstructions?: string;
}

/**
 * Conversation with its input ledger.
 */
export interface ConversationWithLedger {
  conversation: Conversation;
  ledger: InputLedgerEntry[];
}

/**
 * Fork point for creating a new conversation from an existing one.
 */
export interface ForkPoint {
  conversationId: string;
  resumeAtMessageId: string; // The message ID to resume from (exclusive - this message and after are forked)
}

/**
 * Rewind point for truncating conversation history.
 */
export interface RewindPoint {
  conversationId: string;
  rewindToMessageId: string; // Keep messages up to and including this one
}

/**
 * ConversationRepository — CRUD for conversations with input ledger support.
 * 
 * Responsibilities:
 * - Persist conversations to vault
 * - Maintain append-only input ledger of user turns
 * - Support forking: copy ledger up to fork point
 * - Support rewinding: truncate ledger from rewind point
 * - Session metadata persistence (sessionId, providerState)
 * - Model recovery from native history
 */
export class ConversationRepository {
  private adapter: VaultFileAdapter;
  private basePath: string;

  constructor(adapter: VaultFileAdapter, basePath = '.hermedian/conversations') {
    this.adapter = adapter;
    this.basePath = basePath;
  }

  /**
   * Initialize the repository (create directory structure).
   */
  async initialize(): Promise<void> {
    await this.adapter.write(`${this.basePath}/.gitkeep`, '');
  }

  /**
   * Create a new empty conversation.
   */
  async create(conversation: Conversation): Promise<void> {
    await this.saveConversation(conversation);
    await this.saveLedger(conversation.id, []);
  }

  /**
   * Load a conversation with its input ledger.
   */
  async load(conversationId: string): Promise<ConversationWithLedger | null> {
    const conversation = await this.loadConversation(conversationId);
    if (!conversation) return null;

    const ledger = await this.loadLedger(conversationId);
    return { conversation, ledger };
  }

  /**
   * Load conversation metadata only (for listing).
   */
  async loadMeta(conversationId: string): Promise<ConversationMeta | null> {
    const conversation = await this.loadConversation(conversationId);
    if (!conversation) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { messages, ...meta } = conversation;
    return meta as ConversationMeta;
  }

  /**
   * List all conversations (metadata only).
   */
  async list(): Promise<ConversationMeta[]> {
    const items = await this.adapter.list(this.basePath);
    const metas: ConversationMeta[] = [];

    for (const item of items) {
      const path = (item as any).path ?? item;
      if (typeof path === 'string' && path.endsWith('.json') && !path.endsWith('.ledger.json')) {
        try {
          const content = await this.adapter.read(path);
          const conversation = JSON.parse(content) as Conversation;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { messages, ...meta } = conversation;
          metas.push(meta as ConversationMeta);
        } catch {
          // Skip invalid files
        }
      }
    }

    return metas.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Update a conversation (messages, metadata, providerState, sessionId).
   */
  async update(conversation: Conversation): Promise<void> {
    await this.saveConversation(conversation);
  }

  /**
   * Append a user turn to the input ledger.
   * This is called when the user sends a message — before execution.
   */
  async appendToLedger(conversationId: string, entry: InputLedgerEntry): Promise<void> {
    const ledger = await this.loadLedger(conversationId);
    ledger.push(entry);
    await this.saveLedger(conversationId, ledger);
  }

  /**
   * Fork a conversation at a specific message.
   * Creates a new conversation with the ledger copied up to (but not including) the fork point.
   */
  async fork(forkPoint: ForkPoint, newConversation: Conversation): Promise<ConversationWithLedger> {
    const source = await this.load(forkPoint.conversationId);
    if (!source) {
      throw new Error(`Source conversation ${forkPoint.conversationId} not found`);
    }

    // Find the index of the resumeAtMessageId
    const forkIndex = source.ledger.findIndex(e => e.messageId === forkPoint.resumeAtMessageId);
    if (forkIndex === -1) {
      throw new Error(`Fork point message ${forkPoint.resumeAtMessageId} not found in ledger`);
    }

    // Copy ledger up to fork point (exclusive)
    const forkedLedger = source.ledger.slice(0, forkIndex);

    // Create new conversation with forked ledger
    await this.create(newConversation);
    await this.saveLedger(newConversation.id, forkedLedger);

    // Also copy messages up to fork point
    const forkedMessages = source.conversation.messages.slice(0, forkIndex + 1); // Include the fork point message
    const forkedConversation: Conversation = {
      ...newConversation,
      messages: forkedMessages,
      providerState: source.conversation.providerState,
      sessionId: null, // New session for fork
    };

    await this.saveConversation(forkedConversation);

    return {
      conversation: forkedConversation,
      ledger: forkedLedger,
    };
  }

  /**
   * Rewind a conversation to a specific message.
   * Truncates both messages and ledger from the rewind point (exclusive).
   */
  async rewind(rewindPoint: RewindPoint): Promise<ConversationWithLedger> {
    const source = await this.load(rewindPoint.conversationId);
    if (!source) {
      throw new Error(`Conversation ${rewindPoint.conversationId} not found`);
    }

    // Find the index of the rewindToMessageId
    const rewindIndex = source.ledger.findIndex(e => e.messageId === rewindPoint.rewindToMessageId);
    if (rewindIndex === -1) {
      throw new Error(`Rewind point message ${rewindPoint.rewindToMessageId} not found in ledger`);
    }

    // Truncate ledger (keep up to and including rewind point)
    const rewoundLedger = source.ledger.slice(0, rewindIndex + 1);

    // Truncate messages (keep up to and including rewind point message)
    const rewoundMessages = source.conversation.messages.slice(0, rewindIndex + 1);

    const rewoundConversation: Conversation = {
      ...source.conversation,
      messages: rewoundMessages,
      providerState: source.conversation.providerState,
      sessionId: source.conversation.sessionId, // Keep session ID for resume
      updatedAt: Date.now(),
    };

    await this.saveConversation(rewoundConversation);
    await this.saveLedger(rewindPoint.conversationId, rewoundLedger);

    return {
      conversation: rewoundConversation,
      ledger: rewoundLedger,
    };
  }

  /**
   * Update session metadata (sessionId, providerState).
   */
  async updateSessionMetadata(
    conversationId: string,
    sessionId: string | null,
    providerState?: Record<string, unknown>
  ): Promise<void> {
    const conversation = await this.loadConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.sessionId = sessionId;
    if (providerState) {
      conversation.providerState = providerState;
    }
    conversation.updatedAt = Date.now();

    await this.saveConversation(conversation);
  }

  /**
   * Delete a conversation and its ledger.
   */
  async delete(conversationId: string): Promise<void> {
    await this.adapter.delete(`${this.basePath}/${conversationId}.json`);
    await this.adapter.delete(`${this.basePath}/${conversationId}.ledger.json`);
  }

  // Private helpers

  private async saveConversation(conversation: Conversation): Promise<void> {
    await this.adapter.write(
      `${this.basePath}/${conversation.id}.json`,
      JSON.stringify(conversation, null, 2)
    );
  }

  private async loadConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const content = await this.adapter.read(`${this.basePath}/${conversationId}.json`);
      return JSON.parse(content) as Conversation;
    } catch {
      return null;
    }
  }

  private async saveLedger(conversationId: string, ledger: InputLedgerEntry[]): Promise<void> {
    await this.adapter.write(
      `${this.basePath}/${conversationId}.ledger.json`,
      JSON.stringify(ledger, null, 2)
    );
  }

  private async loadLedger(conversationId: string): Promise<InputLedgerEntry[]> {
    try {
      const content = await this.adapter.read(`${this.basePath}/${conversationId}.ledger.json`);
      return JSON.parse(content) as InputLedgerEntry[];
    } catch {
      return [];
    }
  }
}