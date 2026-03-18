/**
 * Sandbox Pool - Pre-created sandbox management
 */

import { Sandbox } from "./sandbox.js";
import { SandboxManager } from "./manager.js";
import { SandboxId, SandboxStatus, IsolationLevel, SandboxSpec, DEFAULT_QUOTA } from "../types/sandbox.js";

/**
 * Pool Configuration
 */
export interface SandboxPoolConfig {
  minSize: number;
  maxSize: number;
  warmCount: number;
  defaultSpec: Partial<SandboxSpec>;
}

const DEFAULT_POOL_CONFIG: SandboxPoolConfig = {
  minSize: 0,
  maxSize: 100,
  warmCount: 5,
  defaultSpec: {
    isolationLevel: IsolationLevel.L1,
    capabilities: ["file_read", "file_write", "exec"],
    quota: DEFAULT_QUOTA,
  },
};

/**
 * Sandbox Pool
 */
export class SandboxPool {
  private pool: Sandbox[] = [];
  private inUse: Set<SandboxId> = new Set();

  constructor(
    private readonly manager: SandboxManager,
    private readonly config: SandboxPoolConfig = DEFAULT_POOL_CONFIG
  ) {}

  /**
   * Initialize the pool with warm sandboxes
   */
  async initialize(): Promise<void> {
    for (let i = 0; i < this.config.warmCount; i++) {
      const sandbox = await this.createSandbox();
      this.pool.push(sandbox);
    }
  }

  /**
   * Get an idle sandbox from the pool
   */
  async getIdle(): Promise<Sandbox[]> {
    const all = await this.manager.list({ status: SandboxStatus.IDLE });
    return all.filter((s) => !this.inUse.has(s.id));
  }

  /**
   * Acquire a sandbox from the pool
   */
  async acquire(spec?: Partial<SandboxSpec>): Promise<Sandbox> {
    // Try to get from pool
    const idle = this.pool.find(
      (s) => s.status === SandboxStatus.IDLE && !this.inUse.has(s.id)
    );

    if (idle) {
      this.inUse.add(idle.id);
      return idle;
    }

    // Create new if possible
    if (this.canCreate()) {
      const sandbox = await this.createSandbox(spec);
      this.inUse.add(sandbox.id);
      return sandbox;
    }

    throw new Error("No available sandboxes in pool");
  }

  /**
   * Release a sandbox back to the pool
   */
  async release(sandboxId: SandboxId): Promise<void> {
    this.inUse.delete(sandboxId);

    const sandbox = await this.manager.get(sandboxId);
    if (!sandbox) return;

    // Reset sandbox state if needed
    if (sandbox.status !== SandboxStatus.IDLE) {
      // In production, would reset the sandbox
    }

    // Add back to pool if under max
    if (!this.pool.includes(sandbox) && this.pool.length < this.config.maxSize) {
      this.pool.push(sandbox);
    }
  }

  /**
   * Check if we can create more sandboxes
   */
  canCreate(): boolean {
    const total = this.pool.length + this.inUse.size;
    return total < this.config.maxSize;
  }

  /**
   * Create a new sandbox
   */
  async createSandbox(spec?: Partial<SandboxSpec>): Promise<Sandbox> {
    const fullSpec: SandboxSpec = {
      name: spec?.name ?? `pool-${Date.now()}`,
      isolationLevel: spec?.isolationLevel ?? this.config.defaultSpec.isolationLevel!,
      capabilities: spec?.capabilities ?? this.config.defaultSpec.capabilities!,
      quota: { ...DEFAULT_QUOTA, ...spec?.quota },
      ...spec,
    };

    return this.manager.create(fullSpec);
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: number;
    inUse: number;
    available: number;
    maxSize: number;
  } {
    return {
      poolSize: this.pool.length,
      inUse: this.inUse.size,
      available: this.pool.filter((s) => !this.inUse.has(s.id)).length,
      maxSize: this.config.maxSize,
    };
  }

  /**
   * Cleanup the pool
   */
  async cleanup(): Promise<void> {
    for (const sandbox of this.pool) {
      try {
        await this.manager.destroy(sandbox.id, true);
      } catch (error) {
        console.error(`Failed to destroy sandbox ${sandbox.id}:`, error);
      }
    }
    this.pool = [];
    this.inUse.clear();
  }
}