/**
 * Memory Manager - Memory storage and retrieval
 */

import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * Memory Entry
 */
export interface MemoryEntry {
  id: string;
  content: string;
  path: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Search Options
 */
export interface SearchOptions {
  query: string;
  limit?: number;
  minScore?: number;
  temporalDecay?: boolean;
  halfLifeDays?: number;
}

/**
 * Search Result
 */
export interface SearchResult {
  content: string;
  path: string;
  lineStart: number;
  lineEnd: number;
  score: number;
  timestamp: Date;
}

/**
 * Memory Manager Configuration
 */
export interface MemoryManagerConfig {
  workspacePath: string;
  maxEntries: number;
}

const DEFAULT_CONFIG: MemoryManagerConfig = {
  workspacePath: "./memory",
  maxEntries: 10000,
};

/**
 * Memory Manager
 */
export class MemoryManager {
  private entries: Map<string, MemoryEntry> = new Map();

  constructor(private readonly config: MemoryManagerConfig = DEFAULT_CONFIG) {
    this.ensureMemoryDir();
  }

  private async ensureMemoryDir(): Promise<void> {
    if (!existsSync(this.config.workspacePath)) {
      await mkdir(this.config.workspacePath, { recursive: true });
    }
  }

  /**
   * Add a memory entry
   */
  async add(content: string, path?: string): Promise<MemoryEntry> {
    const id = this.generateId();
    const entry: MemoryEntry = {
      id,
      content,
      path: path ?? `memory/${id}.md`,
      timestamp: new Date(),
    };

    this.entries.set(id, entry);

    // Persist
    await this.persist(entry);

    return entry;
  }

  /**
   * Get a memory entry
   */
  async get(id: string): Promise<MemoryEntry | undefined> {
    return this.entries.get(id);
  }

  /**
   * Update a memory entry
   */
  async update(id: string, content: string): Promise<void> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.content = content;
      entry.timestamp = new Date();
      await this.persist(entry);
    }
  }

  /**
   * Delete a memory entry
   */
  async delete(id: string): Promise<void> {
    this.entries.delete(id);
  }

  /**
   * Search memory entries
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const query = options.query.toLowerCase();
    const limit = options.limit ?? 10;

    for (const entry of this.entries.values()) {
      const content = entry.content.toLowerCase();
      const index = content.indexOf(query);

      if (index >= 0) {
        // Calculate simple relevance score
        let score = 1.0;

        // Apply temporal decay
        if (options.temporalDecay) {
          const ageDays =
            (Date.now() - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
          const halfLife = options.halfLifeDays ?? 30;
          score *= Math.pow(0.5, ageDays / halfLife);
        }

        if (options.minScore && score < options.minScore) {
          continue;
        }

        results.push({
          content: entry.content,
          path: entry.path,
          lineStart: 0,
          lineEnd: entry.content.split("\n").length,
          score,
          timestamp: entry.timestamp,
        });
      }
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * List all entries
   */
  async list(): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values());
  }

  /**
   * Load memories from disk
   */
  async load(): Promise<void> {
    const memoryDir = join(this.config.workspacePath, "memory");

    if (!existsSync(memoryDir)) {
      return;
    }

    const files = await readdir(memoryDir);

    for (const file of files) {
      if (file.endsWith(".md")) {
        const path = join(memoryDir, file);
        const content = await readFile(path, "utf-8");

        const id = file.replace(".md", "");
        this.entries.set(id, {
          id,
          content,
          path: `memory/${file}`,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEntries: number;
    totalSizeKB: number;
  } {
    let totalSize = 0;
    for (const entry of this.entries.values()) {
      totalSize += Buffer.byteLength(entry.content, "utf-8");
    }

    return {
      totalEntries: this.entries.size,
      totalSizeKB: totalSize / 1024,
    };
  }

  // ========== Private ==========

  private generateId(): string {
    return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private async persist(entry: MemoryEntry): Promise<void> {
    const path = join(this.config.workspacePath, entry.path);
    const dir = join(path, "..");

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(path, entry.content, "utf-8");
  }
}