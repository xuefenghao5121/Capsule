/**
 * Workspace Manager - File system isolation
 */

import { mkdir, rm, writeFile, stat, readdir, copyFile } from "fs/promises";
import { join, resolve, relative, isAbsolute } from "path";
import { existsSync } from "fs";
import { v4 as uuid } from "uuid";
import { WorkspaceRef, WorkspaceId, IsolationLevel } from "../types/sandbox.js";

/**
 * Workspace Snapshot
 */
export interface WorkspaceSnapshot {
  path: string;
  sizeMB: number;
  files: number;
}

/**
 * Default files to create in workspace
 */
const DEFAULT_FILES: Record<string, string> = {
  "AGENTS.md": `# Agent Instructions

This is the agent's workspace. Add instructions here.
`,
  "MEMORY.md": `# Long-term Memory

Store important information here.
`,
  "memory/.gitkeep": "",
};

/**
 * Workspace Manager
 */
export class WorkspaceManager {
  constructor(private readonly rootPath: string) {
    // Ensure root exists
    this.ensureRoot();
  }

  private async ensureRoot(): Promise<void> {
    if (!existsSync(this.rootPath)) {
      await mkdir(this.rootPath, { recursive: true });
    }
  }

  /**
   * Create a new workspace
   */
  async create(name: string): Promise<WorkspaceRef> {
    const id = this.generateId();
    const path = join(this.rootPath, id);

    // Create directory structure
    await mkdir(path, { recursive: true });
    await mkdir(join(path, "workspace"), { recursive: true });
    await mkdir(join(path, "workspace", "memory"), { recursive: true });
    await mkdir(join(path, "workspace", "skills"), { recursive: true });
    await mkdir(join(path, "context"), { recursive: true });
    await mkdir(join(path, "logs"), { recursive: true });

    // Create default files
    await this.createDefaultFiles(path);

    return {
      id,
      path,
      createdAt: new Date(),
    };
  }

  /**
   * Create default files in workspace
   */
  private async createDefaultFiles(workspacePath: string): Promise<void> {
    const workspaceDir = join(workspacePath, "workspace");

    for (const [filePath, content] of Object.entries(DEFAULT_FILES)) {
      const fullPath = join(workspaceDir, filePath);
      const dir = join(fullPath, "..");
      
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      
      await writeFile(fullPath, content, "utf-8");
    }
  }

  /**
   * Isolate workspace based on level
   */
  async isolate(ref: WorkspaceRef, level: IsolationLevel): Promise<void> {
    switch (level) {
      case IsolationLevel.L0:
        // No isolation
        break;
      case IsolationLevel.L1:
        // Set directory permissions (Unix only)
        // In production, would use chmod
        break;
      case IsolationLevel.L2:
        // Container isolation handled elsewhere
        break;
    }
  }

  /**
   * Create a snapshot of the workspace
   */
  async snapshot(ref: WorkspaceRef): Promise<WorkspaceSnapshot> {
    const workspacePath = join(ref.path, "workspace");
    
    // Calculate size
    const sizeMB = await this.calculateSize(workspacePath);
    
    // Count files
    const files = await this.countFiles(workspacePath);

    return {
      path: workspacePath,
      sizeMB,
      files,
    };
  }

  /**
   * Restore workspace from snapshot
   */
  async restore(ref: WorkspaceRef, snapshot: WorkspaceSnapshot): Promise<void> {
    // In production, would restore from backup
    // For now, just verify the workspace exists
    if (!existsSync(ref.path)) {
      throw new Error(`Workspace not found: ${ref.path}`);
    }
  }

  /**
   * Cleanup workspace
   */
  async cleanup(ref: WorkspaceRef): Promise<void> {
    if (existsSync(ref.path)) {
      await rm(ref.path, { recursive: true, force: true });
    }
  }

  /**
   * Check if a path is within the workspace
   */
  contains(ref: WorkspaceRef, path: string): boolean {
    const resolved = resolve(path);
    const workspacePath = join(ref.path, "workspace");
    const relativePath = relative(workspacePath, resolved);
    return !relativePath.startsWith("..") && !isAbsolute(relativePath);
  }

  /**
   * Resolve a path relative to workspace
   */
  resolve(ref: WorkspaceRef, path: string): string {
    const workspacePath = join(ref.path, "workspace");
    if (isAbsolute(path)) {
      return resolve(path);
    }
    return resolve(workspacePath, path);
  }

  /**
   * Get workspace size in MB
   */
  async getSize(ref: WorkspaceRef): Promise<number> {
    return this.calculateSize(join(ref.path, "workspace"));
  }

  // ========== Private Methods ==========

  private generateId(): WorkspaceId {
    return `ws-${uuid().slice(0, 8)}`;
  }

  private async calculateSize(path: string): Promise<number> {
    let totalSize = 0;

    const calculate = async (dir: string): Promise<void> => {
      if (!existsSync(dir)) return;

      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await calculate(fullPath);
        } else if (entry.isFile()) {
          try {
            const stats = await stat(fullPath);
            totalSize += stats.size;
          } catch {
            // Ignore errors
          }
        }
      }
    };

    await calculate(path);
    return totalSize / (1024 * 1024); // Convert to MB
  }

  private async countFiles(path: string): Promise<number> {
    let count = 0;

    const countRecursive = async (dir: string): Promise<void> => {
      if (!existsSync(dir)) return;

      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await countRecursive(fullPath);
        } else if (entry.isFile()) {
          count++;
        }
      }
    };

    await countRecursive(path);
    return count;
  }
}