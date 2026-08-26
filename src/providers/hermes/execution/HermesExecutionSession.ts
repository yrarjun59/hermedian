// src/providers/hermes/execution/HermesExecutionSession.ts
import { ChildProcess, spawn } from 'child_process';
import { createInterface } from 'readline';

import type { ProviderExecutionEvent, ProviderExecutionRequest, ProviderExecutionRun, ProviderExecutionSession, ProviderSessionConfig, ProviderSessionEvent } from '../../../core/execution/types';

interface HermesEvent {
  type: 'text_delta' | 'tool_start' | 'tool_output' | 'completed' | 'error' | 'thinking_delta';
  content?: string;
  toolName?: string;
  toolId?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export class HermesExecutionSession implements ProviderExecutionSession {
  status: 'idle' | 'running' | 'waiting' | 'completed' | 'error' = 'idle';
  private process: ChildProcess | null = null;
  private eventQueue: ProviderExecutionEvent[] = [];
  private waiters: Array<(value: ProviderExecutionEvent) => void> = [];
  private currentRunId: string | null = null;
  private ended = false;
  private sessionEventHandlers: Set<(event: ProviderSessionEvent) => void> = new Set();
  private cliPath: string;

  constructor(public id: string, public config: ProviderSessionConfig, cliPath: string) {
    this.cliPath = cliPath;
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionRun> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.currentRunId = runId;
    this.status = 'running';
    this.ended = false;
    this.eventQueue = [];
    this.waiters = [];

    const abortController = new AbortController();
    const stream = this.createStream(runId, abortController);

    this.spawnProcess(request, runId, abortController);

    return {
      id: runId,
      abortController,
      stream,
    };
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.status = 'idle';
    this.currentRunId = null;
    this.ended = true;
    for (const resolve of this.waiters) {
      resolve({ type: 'cancelled', runId: '', timestamp: Date.now() });
    }
    this.waiters = [];
  }

  onEvent(handler: (event: ProviderSessionEvent) => void): () => void {
    this.sessionEventHandlers.add(handler);
    return () => this.sessionEventHandlers.delete(handler);
  }

  async forkFrom(_sessionId: string, _resumeAtMessageId: string): Promise<ProviderExecutionSession> {
    const newSessionId = `hermes-${this.config.conversationId}-${Date.now()}-fork`;
    return new HermesExecutionSession(newSessionId, this.config, this.cliPath);
  }

  async rewindTo(_messageId: string): Promise<void> {
    await this.stop();
    this.status = 'idle';
  }

  private createStream(runId: string, abortController: AbortController): AsyncIterable<ProviderExecutionEvent> {
    return {
      [Symbol.asyncIterator]: () => ({
        next: async (): Promise<IteratorResult<ProviderExecutionEvent>> => {
          if (this.ended && this.eventQueue.length === 0) {
            return { done: true, value: undefined };
          }

          if (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift()!;
            return { done: false, value: event };
          }

          return new Promise<IteratorResult<ProviderExecutionEvent>>((resolve) => {
            this.waiters.push((event) => {
              resolve({ done: false, value: event });
            });

            abortController.signal.addEventListener('abort', () => {
              this.ended = true;
              const idx = this.waiters.indexOf((_w) => true);
              if (idx >= 0) {
                this.waiters.splice(idx, 1);
              }
              resolve({ done: true, value: undefined });
            });
          });
        },
        return: async () => {
          this.ended = true;
          return { done: true, value: undefined };
        },
      }),
    };
  }

  private spawnProcess(request: ProviderExecutionRequest, runId: string, abortController: AbortController): void {
    // Hermes CLI chat command syntax (verified from hermes chat --help):
    // hermes chat -q QUERY -m MODEL --provider PROVIDER --reasoning LEVEL --in DIR
    const args: string[] = ['chat'];

    // Query (user message)
    args.push('-q', request.userMessage);

    // Model
    if (this.config.model) {
      args.push('-m', this.config.model);
    }

    // Provider (auto-detect from model name)
    const provider = this.getProviderForModel(this.config.model);
    args.push('--provider', provider);

    // Reasoning effort
    if (this.config.effortLevel) {
      args.push('--reasoning', this.config.effortLevel);
    }

    // Working directory
    if (this.config.workingDirectory) {
      args.push('--in', this.config.workingDirectory);
    }

    console.log(`[Hermes] Spawning: ${this.cliPath} ${args.join(' ')}`);

    this.process = spawn(this.cliPath, args, {
      cwd: this.config.workingDirectory,
      env: { ...process.env, ...this.config.environment },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (this.process.stdout) {
      const rl = createInterface({ input: this.process.stdout });
      rl.on('line', (line: string) => {
        if (abortController.signal.aborted) return;
        try {
          const event = JSON.parse(line) as HermesEvent;
          this.handleHermesEvent(event, runId);
        } catch {
          // Skip non-JSON lines
        }
      });
    }

    if (this.process.stderr) {
      const rlErr = createInterface({ input: this.process.stderr });
      rlErr.on('line', (line: string) => {
        console.error('[hermes stderr]:', line);
      });
    }

    this.process.on('exit', (code) => {
      if (code === 0) {
        this.enqueueEvent({ type: 'completed', runId, timestamp: Date.now(), usage: { inputTokens: 0, outputTokens: 0 } });
        this.status = 'completed';
      } else {
        this.enqueueEvent({ type: 'error', runId, timestamp: Date.now(), error: `Process exited with code ${code}` });
        this.status = 'error';
      }
      this.ended = true;
    });

    this.process.on('error', (err) => {
      this.enqueueEvent({ type: 'error', runId, timestamp: Date.now(), error: err.message });
      this.status = 'error';
      this.ended = true;
    });

    abortController.signal.addEventListener('abort', () => {
      this.stop();
    });
  }

  private getProviderForModel(model: string): string {
    if (model.startsWith('nvidia/')) return 'nvidia-nim';
    if (model.startsWith('hermes-')) return 'nous';
    if (model.startsWith('nemotron-')) return 'nous';
    return 'nvidia-nim';
  }

  private handleHermesEvent(event: HermesEvent, runId: string): void {
    const baseEvent = { runId, timestamp: Date.now() };

    switch (event.type) {
      case 'text_delta':
        this.enqueueEvent({ ...baseEvent, type: 'text_delta', content: event.content ?? '' });
        break;
      case 'thinking_delta':
        this.enqueueEvent({ ...baseEvent, type: 'thinking_delta', content: event.content ?? '' });
        break;
      case 'tool_start':
        this.enqueueEvent({
          ...baseEvent,
          type: 'tool_start',
          toolName: event.toolName ?? 'unknown',
          toolId: event.toolId ?? '',
          input: event.input,
        });
        break;
      case 'tool_output':
        this.enqueueEvent({
          ...baseEvent,
          type: 'tool_output',
          toolName: event.toolName ?? 'unknown',
          toolId: event.toolId ?? '',
          output: event.output,
        });
        break;
      case 'completed':
        this.status = 'completed';
        this.enqueueEvent({
          ...baseEvent,
          type: 'completed',
          usage: event.usage ?? { inputTokens: 0, outputTokens: 0 },
        });
        break;
      case 'error':
        this.status = 'error';
        this.enqueueEvent({ ...baseEvent, type: 'error', error: event.error ?? 'Unknown error' });
        break;
    }
  }

  private enqueueEvent(event: ProviderExecutionEvent): void {
    this.eventQueue.push(event);
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(event);
    }
    const sessionEvent: ProviderSessionEvent = event as ProviderSessionEvent;
    for (const handler of this.sessionEventHandlers) {
      handler(sessionEvent);
    }
  }
}