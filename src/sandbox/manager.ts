/**
 * Sandbox Manager - Lifecycle management
 * 
 * Analogous to Process Manager in traditional OS
 */

import { mkdir, rm, stat, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { v4 as uuid } from "uuid";
import {
  SandboxId,
  SandboxStatus,
  IsolationLevel,
  SandboxSpec,
  Snapshot,
  SnapshotId,
  WorkspaceRef,
  MemoryRef,
  SandboxNotFoundError,
  SandboxBusyError,
} from "../types/sandbox.js";
import { Sandbox } from "./sandbox.js";
import { WorkspaceManager } from "./workspace.js";

/**
 * Sandbox Manager Configuration
 */
export interface SandboxManagerConfig {
  workspaceRoot: string;
  maxSandboxes: number;
  defaultQuota?: Partial<import("../types/sandbox.js").ResourceQuota>;
}

/**
 * Sandbox Filter
 */
export interface SandboxFilter {
  status?: SandboxStatus;
  isolationLevel?: IsolationLevel;
  tenantId?: string;
  labels?: Record<string, string>;
}

/**
 * Sandbox Manager
 */
export class SandboxManager {
  private sandboxes: Map<SandboxId, Sandbox> = new Map();
  private workspaceManager: WorkspaceManager;
  private snapshots: Map<SnapshotId, Snapshot> = new Map();

  constructor(private readonly config: SandboxManagerConfig) {
    this.workspaceManager = new WorkspaceManager(config.workspaceRoot);
  }

  // ========== Lifecycle ==========

  /**
   * Create a new sandbox
   */
  async create(spec: SandboxSpec): Promise<Sandbox> {
    // Check limit
    if (this.sandboxes.size >= this.config.maxSandboxes) {
      throw new Error("Maximum number of sandboxes reached");
    }

    // Validate spec
    this.validateSpec(spec);

    // Create workspace
    const workspace = await this.workspaceManager.create(spec.name);

    // Create memory reference
    const memory: MemoryRef = {
      path: join(workspace.path, "memory"),
      sizeMB: 0,
    };

    // Create sandbox instance
    const sandbox = new Sandbox(spec, workspace, memory);

    // Initialize isolation
    await this.initializeIsolation(sandbox, spec.isolationLevel);

    // Register
    this.sandboxes.set(sandbox.id, sandbox);

    // Transition to IDLE
    sandbox.transition(SandboxStatus.IDLE);

    return sandbox;
  }

  /**
   * Destroy a sandbox
   */
  async destroy(sandboxId: SandboxId, force = false): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new SandboxNotFoundError(sandboxId);
    }

    // Check if can destroy
    if (sandbox.status === SandboxStatus.RUNNING && !force) {
      throw new SandboxBusyError(sandboxId);
    }

    // Transition to TERMINATING
    sandbox.transition(SandboxStatus.TERMINATING);

    // Cleanup isolation
    await this.cleanupIsolation(sandbox);

    // Cleanup workspace
    await this.workspaceManager.cleanup(sandbox.workspace);

    // Transition to TERMINATED
    sandbox.transition(SandboxStatus.TERMINATED);

    // Remove from registry
    this.sandboxes.delete(sandboxId);
  }

  /**
   * Suspend a sandbox
   */
  async suspend(sandboxId: SandboxId): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new SandboxNotFoundError(sandboxId);
    }

    if (!sandbox.canTransition(SandboxStatus.SUSPENDED)) {
      throw new Error(
        `Cannot suspend sandbox in status ${sandbox.status}`
      );
    }

    // Create checkpoint
    await this.checkpoint(sandbox);

    // Transition
    sandbox.transition(SandboxStatus.SUSPENDED);
  }

  /**
   * Resume a sandbox
   */
  async resume(sandboxId: SandboxId): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new SandboxNotFoundError(sandboxId);
    }

    if (sandbox.status !== SandboxStatus.SUSPENDED) {
      throw new Error(
        `Cannot resume sandbox in status ${sandbox.status}`
      );
    }

    // Restore from checkpoint
    await this.restore(sandbox);

    // Transition
    sandbox.transition(SandboxStatus.IDLE);
  }

  // ========== Query ==========

  /**
   * Get a sandbox by ID
   */
  async get(sandboxId: SandboxId): Promise<Sandbox | undefined> {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * List sandboxes
   */
  async list(filter?: SandboxFilter): Promise<Sandbox[]> {
    let result = Array.from(this.sandboxes.values());

    if (filter) {
      if (filter.status) {
        result = result.filter((s) => s.status === filter.status);
      }
      if (filter.isolationLevel) {
        result = result.filter((s) => s.isolationLevel === filter.isolationLevel);
      }
      if (filter.tenantId) {
        result = result.filter((s) => s.tenantId === filter.tenantId);
      }
      if (filter.labels) {
        result = result.filter((s) => {
          for (const [key, value] of Object.entries(filter.labels!)) {
            if (s.labels[key] !== value) return false;
          }
          return true;
        });
      }
    }

    return result;
  }

  /**
   * Get metrics for a sandbox
   */
  async getMetrics(sandboxId: SandboxId): Promise<import("../types/sandbox.js").SandboxMetrics> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new SandboxNotFoundError(sandboxId);
    }
    return sandbox.metrics;
  }

  // ========== Checkpoint & Restore ==========

  /**
   * Create a checkpoint
   */
  async checkpoint(sandbox: Sandbox): Promise<Snapshot> {
    const snapshotId = `snap-${uuid().slice(0, 8)}`;

    // Create workspace snapshot
    const workspaceSnapshot = await this.workspaceManager.snapshot(
      sandbox.workspace
    );

    // Create memory snapshot
    const memorySnapshot = {
      entries: 0,
      sizeMB: 0,
    };

    // Create context snapshot
    const contextSnapshot = {
      id: `ctx-${uuid().slice(0, 8)}`,
      sandboxId: sandbox.id,
      createdAt: new Date(),
      sizeMB: 0,
    };

    const snapshot: Snapshot = {
      id: snapshotId,
      sandboxId: sandbox.id,
      createdAt: new Date(),
      workspaceSnapshot,
      memorySnapshot,
      contextSnapshot,
      sizeMB: workspaceSnapshot.sizeMB,
      checksum: "",
    };

    this.snapshots.set(snapshotId, snapshot);
    return snapshot;
  }

  /**
   * Restore from a snapshot
   */
  async restore(snapshotId: SnapshotId): Promise<Sandbox>;
  async restore(sandbox: Sandbox): Promise<void>;
  async restore(sandboxOrId: Sandbox | SnapshotId): Promise<Sandbox | void> {
    if (typeof sandboxOrId === "string") {
      const snapshot = this.snapshots.get(sandboxOrId);
      if (!snapshot) {
        throw new Error(`Snapshot not found: ${sandboxOrId}`);
      }

      const sandbox = this.sandboxes.get(snapshot.sandboxId);
      if (!sandbox) {
        throw new SandboxNotFoundError(snapshot.sandboxId);
      }

      await this.restoreFromSnapshot(sandbox, snapshot);
      return sandbox;
    } else {
      const sandbox = sandboxOrId;
      const snapshots = Array.from(this.snapshots.values()).filter(
        (s) => s.sandboxId === sandbox.id
      );
      if (snapshots.length === 0) return;

      const latest = snapshots.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];
      await this.restoreFromSnapshot(sandbox, latest);
    }
  }

  private async restoreFromSnapshot(
    sandbox: Sandbox,
    snapshot: Snapshot
  ): Promise<void> {
    // Restore workspace
    await this.workspaceManager.restore(
      sandbox.workspace,
      snapshot.workspaceSnapshot
    );
  }

  // ========== Isolation ==========

  /**
   * Initialize isolation for a sandbox
   */
  private async initializeIsolation(
    sandbox: Sandbox,
    level: IsolationLevel
  ): Promise<void> {
    switch (level) {
      case IsolationLevel.L0:
        // No isolation
        break;
      case IsolationLevel.L1:
        // Process-level isolation (implemented in isolation/process.ts)
        await this.workspaceManager.isolate(sandbox.workspace, level);
        break;
      case IsolationLevel.L2:
        // Container isolation (to be implemented in Phase 2)
        await this.workspaceManager.isolate(sandbox.workspace, level);
        break;
    }
  }

  /**
   * Cleanup isolation for a sandbox
   */
  private async cleanupIsolation(sandbox: Sandbox): Promise<void> {
    // Cleanup is handled by workspace cleanup
  }

  // ========== Validation ==========

  /**
   * Validate sandbox spec
   */
  private validateSpec(spec: SandboxSpec): void {
    if (!spec.name || spec.name.trim() === "") {
      throw new Error("Sandbox name is required");
    }

    if (!spec.capabilities || spec.capabilities.length === 0) {
      throw new Error("At least one capability is required");
    }

    if (!Object.values(IsolationLevel).includes(spec.isolationLevel)) {
      throw new Error(`Invalid isolation level: ${spec.isolationLevel}`);
    }
  }

  // ========== Statistics ==========

  /**
   * Get manager statistics
   */
  getStats(): {
    totalSandboxes: number;
    byStatus: Record<SandboxStatus, number>;
    byIsolationLevel: Record<IsolationLevel, number>;
  } {
    const byStatus: Record<SandboxStatus, number> = {} as any;
    const byIsolationLevel: Record<IsolationLevel, number> = {} as any;

    for (const sandbox of this.sandboxes.values()) {
      byStatus[sandbox.status] = (byStatus[sandbox.status] || 0) + 1;
      byIsolationLevel[sandbox.isolationLevel] =
        (byIsolationLevel[sandbox.isolationLevel] || 0) + 1;
    }

    return {
      totalSandboxes: this.sandboxes.size,
      byStatus,
      byIsolationLevel,
    };
  }
}