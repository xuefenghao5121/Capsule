/**
 * Checkpoint Manager - Sandbox state persistence
 */

import { mkdir, writeFile, readFile, unlink, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { SandboxId, Snapshot, SnapshotId } from "../../types/sandbox.js";
import { Sandbox } from "../sandbox.js";

/**
 * Checkpoint Configuration
 */
export interface CheckpointConfig {
  checkpointDir: string;
  maxCheckpoints: number;
  compress: boolean;
}

const DEFAULT_CONFIG: CheckpointConfig = {
  checkpointDir: "./checkpoints",
  maxCheckpoints: 10,
  compress: false,
};

/**
 * Checkpoint Metadata
 */
export interface CheckpointMeta {
  id: SnapshotId;
  sandboxId: SandboxId;
  createdAt: Date;
  sizeMB: number;
  type: "manual" | "auto" | "suspend";
}

/**
 * Checkpoint Manager
 * 
 * Manages sandbox state snapshots for persistence and recovery
 */
export class CheckpointManager {
  private config: CheckpointConfig;
  private checkpoints: Map<SandboxId, CheckpointMeta[]> = new Map();

  constructor(config: Partial<CheckpointConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureCheckpointDir();
  }

  private async ensureCheckpointDir(): Promise<void> {
    if (!existsSync(this.config.checkpointDir)) {
      await mkdir(this.config.checkpointDir, { recursive: true });
    }
  }

  /**
   * Create a checkpoint
   */
  async create(
    sandbox: Sandbox,
    type: "manual" | "auto" | "suspend" = "manual"
  ): Promise<Snapshot> {
    await this.ensureCheckpointDir();

    const checkpointId = this.generateId();
    const checkpointDir = this.getCheckpointDir(sandbox.id, checkpointId);

    // Create checkpoint directory
    await mkdir(checkpointDir, { recursive: true });

    // Save sandbox metadata
    const meta: CheckpointMeta = {
      id: checkpointId,
      sandboxId: sandbox.id,
      createdAt: new Date(),
      sizeMB: 0,
      type,
    };

    // Save sandbox state
    await this.saveSandboxState(sandbox, checkpointDir);

    // Save memory state
    await this.saveMemoryState(sandbox, checkpointDir);

    // Save context state
    await this.saveContextState(sandbox, checkpointDir);

    // Calculate size
    meta.sizeMB = await this.calculateSize(checkpointDir);

    // Save metadata
    await writeFile(
      join(checkpointDir, "meta.json"),
      JSON.stringify(meta, null, 2)
    );

    // Track checkpoint
    if (!this.checkpoints.has(sandbox.id)) {
      this.checkpoints.set(sandbox.id, []);
    }
    this.checkpoints.get(sandbox.id)!.push(meta);

    // Cleanup old checkpoints
    await this.cleanupOldCheckpoints(sandbox.id);

    return {
      id: checkpointId,
      sandboxId: sandbox.id,
      createdAt: meta.createdAt,
      workspaceSnapshot: { path: checkpointDir, sizeMB: 0 },
      memorySnapshot: { entries: 0, sizeMB: 0 },
      contextSnapshot: {
        id: checkpointId,
        sandboxId: sandbox.id,
        createdAt: meta.createdAt,
        sizeMB: 0,
      },
      sizeMB: meta.sizeMB,
      checksum: "",
    };
  }

  /**
   * Restore from a checkpoint
   */
  async restore(sandbox: Sandbox, checkpointId?: SnapshotId): Promise<void> {
    const checkpoints = this.checkpoints.get(sandbox.id);
    if (!checkpoints || checkpoints.length === 0) {
      throw new Error(`No checkpoints found for sandbox ${sandbox.id}`);
    }

    // Use latest checkpoint if not specified
    const targetId = checkpointId || checkpoints[checkpoints.length - 1].id;
    const checkpointDir = this.getCheckpointDir(sandbox.id, targetId);

    if (!existsSync(checkpointDir)) {
      throw new Error(`Checkpoint ${targetId} not found`);
    }

    // Restore sandbox state
    await this.restoreSandboxState(sandbox, checkpointDir);

    // Restore memory state
    await this.restoreMemoryState(sandbox, checkpointDir);

    // Restore context state
    await this.restoreContextState(sandbox, checkpointDir);
  }

  /**
   * List checkpoints for a sandbox
   */
  async list(sandboxId: SandboxId): Promise<CheckpointMeta[]> {
    return this.checkpoints.get(sandboxId) || [];
  }

  /**
   * Delete a checkpoint
   */
  async delete(sandboxId: SandboxId, checkpointId: SnapshotId): Promise<void> {
    const checkpointDir = this.getCheckpointDir(sandboxId, checkpointId);

    if (existsSync(checkpointDir)) {
      await unlink(checkpointDir);
    }

    // Remove from tracking
    const checkpoints = this.checkpoints.get(sandboxId);
    if (checkpoints) {
      const index = checkpoints.findIndex((c) => c.id === checkpointId);
      if (index >= 0) {
        checkpoints.splice(index, 1);
      }
    }
  }

  /**
   * Delete all checkpoints for a sandbox
   */
  async deleteAll(sandboxId: SandboxId): Promise<void> {
    const checkpoints = this.checkpoints.get(sandboxId);
    if (!checkpoints) return;

    for (const checkpoint of checkpoints) {
      await this.delete(sandboxId, checkpoint.id);
    }

    this.checkpoints.delete(sandboxId);
  }

  // ========== Private Methods ==========

  private generateId(): SnapshotId {
    return `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getCheckpointDir(sandboxId: SandboxId, checkpointId: SnapshotId): string {
    return join(this.config.checkpointDir, sandboxId, checkpointId);
  }

  private async saveSandboxState(
    sandbox: Sandbox,
    checkpointDir: string
  ): Promise<void> {
    const state = sandbox.toJSON();
    await writeFile(
      join(checkpointDir, "sandbox.json"),
      JSON.stringify(state, null, 2)
    );
  }

  private async saveMemoryState(
    sandbox: Sandbox,
    checkpointDir: string
  ): Promise<void> {
    // Copy memory directory
    const memoryDir = join(checkpointDir, "memory");
    await mkdir(memoryDir, { recursive: true });

    // In production, would copy actual memory files
    await writeFile(join(memoryDir, ".checkpoint"), "");
  }

  private async saveContextState(
    sandbox: Sandbox,
    checkpointDir: string
  ): Promise<void> {
    const context = sandbox.getContext();
    if (context) {
      await writeFile(
        join(checkpointDir, "context.json"),
        JSON.stringify(context, null, 2)
      );
    }
  }

  private async restoreSandboxState(
    sandbox: Sandbox,
    checkpointDir: string
  ): Promise<void> {
    const statePath = join(checkpointDir, "sandbox.json");
    if (existsSync(statePath)) {
      const content = await readFile(statePath, "utf-8");
      const state = JSON.parse(content);
      // In production, would restore state to sandbox
    }
  }

  private async restoreMemoryState(
    sandbox: Sandbox,
    checkpointDir: string
  ): Promise<void> {
    // In production, would restore memory files
  }

  private async restoreContextState(
    sandbox: Sandbox,
    checkpointDir: string
  ): Promise<void> {
    const contextPath = join(checkpointDir, "context.json");
    if (existsSync(contextPath)) {
      const content = await readFile(contextPath, "utf-8");
      const context = JSON.parse(content);
      sandbox.setContext(context);
    }
  }

  private async calculateSize(dir: string): Promise<number> {
    // Simplified size calculation
    return 0;
  }

  private async cleanupOldCheckpoints(sandboxId: SandboxId): Promise<void> {
    const checkpoints = this.checkpoints.get(sandboxId);
    if (!checkpoints) return;

    while (checkpoints.length > this.config.maxCheckpoints) {
      const oldest = checkpoints.shift();
      if (oldest) {
        await this.delete(sandboxId, oldest.id);
      }
    }
  }
}