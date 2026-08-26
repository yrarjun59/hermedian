// src/core/types/chat.ts
export const VIEW_TYPE_HERMEDIAN = 'hermedian-chat';

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'image';
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  imageUrl?: string;
  mimeType?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: ContentBlock[];
  timestamp: number;
  usage?: UsageInfo;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  providerId: string;
  model: string;
  messageCount: number;
  pinned?: boolean;
  archived?: boolean;
}

export interface Conversation extends ConversationMeta {
  messages: ChatMessage[];
  providerState?: Record<string, unknown>;
  sessionId?: string | null;
  linkedContentPath?: string;
}

export interface ImageAttachment {
  id: string;
  url: string;
  mimeType: string;
  data?: string; // base64
}

export interface StreamChunk {
  type: 'text' | 'thinking' | 'tool_start' | 'tool_output' | 'done' | 'error';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  error?: string;
}