// src/core/execution/WarmExecutionPool.ts
export const DEFAULT_MAX_WARM_PROCESSES = 5;
export const MIN_WARM_PROCESSES = 3;
export const MAX_WARM_PROCESSES = 10;

export function normalizeWarmLimit(configured: unknown): number {
  const finite = typeof configured === 'number' && Number.isFinite(configured)
    ? Math.trunc(configured)
    : DEFAULT_MAX_WARM_PROCESSES;
  return Math.max(MIN_WARM_PROCESSES, Math.min(MAX_WARM_PROCESSES, finite));
}

export interface WarmOwner {
  readonly id: string;
  canCool(): boolean;
  cool(): Promise<void>;
}

interface WarmEntry {
  owner: WarmOwner;
  lastUsed: number;
}

export class WarmExecutionCapacityError extends Error {
  constructor(readonly limit: number) {
    super(`Warm process limit (${limit}) reached. Finish a session first.`);
    this.name = 'WarmExecutionCapacityError';
  }
}

export class WarmExecutionPool {
  private entries = new Map<string, WarmEntry>();
  private operationTail: Promise<void> = Promise.resolve();
  private usageSequence = 0;

  constructor(private readonly getLimit: () => number) {}

  acquire(owner: WarmOwner): Promise<void> {
    return this.enqueue(async () => {
      const existing = this.entries.get(owner.id);
      if (existing) {
        existing.owner = owner;
        existing.lastUsed = this.nextUsageSequence();
        await this.coolExcess(this.getLimit());
        return;
      }

      const limit = this.getLimit();
      while (this.entries.size >= limit) {
        const victim = this.findCoolingCandidate();
        if (!victim) throw new WarmExecutionCapacityError(limit);
        await victim.owner.cool();
        this.entries.delete(victim.owner.id);
      }

      this.entries.set(owner.id, { owner, lastUsed: this.nextUsageSequence() });
    });
  }

  release(ownerId: string): void {
    this.entries.delete(ownerId);
  }

  has(ownerId: string): boolean {
    return this.entries.has(ownerId);
  }

  getWarmCount(): number {
    return this.entries.size;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.operationTail.catch(() => undefined).then(operation);
    this.operationTail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  private findCoolingCandidate(): WarmEntry | null {
    let candidate: WarmEntry | null = null;
    for (const entry of this.entries.values()) {
      if (!entry.owner.canCool()) continue;
      if (!candidate || entry.lastUsed < candidate.lastUsed) {
        candidate = entry;
      }
    }
    return candidate;
  }

  private async coolExcess(limit: number): Promise<void> {
    while (this.entries.size > limit) {
      const victim = this.findCoolingCandidate();
      if (!victim) return;
      await victim.owner.cool();
      this.entries.delete(victim.owner.id);
    }
  }

  private getLimit(): number {
    return normalizeWarmLimit(this.getLimit());
  }

  private nextUsageSequence(): number {
    return ++this.usageSequence;
  }
}