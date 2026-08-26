// src/providers/hermes/execution/HermesExecutionSession.ts
import { spawn, ChildProcess } from 'child_process';
import { createInterface, Interface as ReadLineInterface } from 'readline';
import type { ProviderExecutionSession, ProviderExecutionRequest, ProviderExecutionRun, ProviderSessionEvent, ProviderSessionConfig } from '../../../core/execution/types';

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
  private eventHandlers: Set<(event: ProviderSessionEvent) => void> = new Set();
  private currentRunId: string | null = null;

  constructor(public id: string, public config: ProviderSessionConfig) {}

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionRun> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.currentRunId = runId;
    this.status = 'running';

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
  }

  onEvent(handler: (event: ProviderSessionEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: ProviderSessionEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  private spawnProcess(request: ProviderExecutionRequest, runId: string, abortController: AbortController): void {
    const { spawn } = require('child_process') as typeof import('child_process');
    const { createInterface } = require('readline') as typeof import('readline');

    const args = [
      'chat',
      '--json',
      '--model', this.config.model,
      '--effort', this.config.effortLevel,
    ];

    if (request.contextFiles?.length) {
      for (const file of request.contextFiles) {
        args.push('--context', file);
      }
    }

    this.process = spawn('hermes', args, {
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
          this.handleHermesEvent(event);
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
        this.emit({ type: 'completed', usage: { inputTokens: 0, outputTokens: 0 } });
        this.status = 'completed';
      } else {
        this.emit({ type: 'error', error: `Process exited with code ${code}` });
        this.status = 'error';
      }
    });

    this.process.on('error', (err) => {
      this.emit({ type: 'error', error: err.message });
      this.status = 'error';
    });

    // Send user message
    if (this.process.stdin) {
      const payload = {
        role: 'user',
        content: request.userMessage,
      };
      this.process.stdin.write(JSON.stringify(payload) + '\n');
    }

    abortController.signal.addEventListener('abort', () => {
      this.stop();
    });
  }

  private handleHermesEvent(event: HermesEvent): void {
    switch (event.type) {
      case 'text_delta':
        this.emit({ type: 'text_delta', content: event.content ?? '' });
        break;
      case 'thinking_delta':
        this.emit({ type: 'thinking_delta', content: event.content ?? '' });
        break;
      case 'tool_start':
        this.emit({
          type: 'tool_start',
          toolName: event.toolName ?? 'unknown',
          toolId: event.toolId ?? '',
          input: event.input,
        });
        break;
      case 'tool_output':
        this.emit({
          type: 'tool_output',
          toolId: event.toolId ?? '',
          output: event.output,
        });
        break;
      case 'completed':
        this.status = 'completed';
        this.emit({
          type: 'completed',
          usage: event.usage ?? { inputTokens: 0, outputTokens: 0 },
        });
        break;
      case 'error':
        this.status = 'error';
        this.emit({ type: 'error', error: event.error ?? 'Unknown error' });
        break;
    }
  }

  private async *createStream(runId: string, abortController: AbortController): AsyncGenerator<HermesEvent> {
    // Stream is handled via events in this implementation
    // Yield is for compatibility with the interface
  }
}