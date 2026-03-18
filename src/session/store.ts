/**
 * Session Store - Session persistence and management
 */

import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { SessionKey, SandboxId } from "../types/sandbox.js";

/**
 * Session Context
 */
export interface SessionContext {
  transcriptPath: string;
  inputTokens: number;
  outputTokens: number;
  model?: string;
}

/**
 * Session Statistics
 */
export interface SessionStats {
  messageCount: number;
  toolCallCount: number;
  errorCount: number;
  totalLatencyMs: number;
}

/**
 * Session
 */
export interface Session {
  key: SessionKey;
  sandboxId: SandboxId;
  status: "active" | "idle" | "closed";
  context: SessionContext;
  stats: SessionStats;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

/**
 * Session Filter
 */
export interface SessionFilter {
  sandboxId?: SandboxId;
  status?: "active" | "idle" | "closed";
  olderThan?: Date;
}

/**
 * Session Store Configuration
 */
export interface SessionStoreConfig {
  dataPath: string;
  maxSessions: number;
}

const DEFAULT_CONFIG: SessionStoreConfig = {
  dataPath: "./data/sessions",
  maxSessions: 1000,
};

/**
 * Session Store
 */
export class SessionStore {
  private sessions: Map<SessionKey, Session> = new Map();

  constructor(private readonly config: SessionStoreConfig = DEFAULT_CONFIG) {
    this.ensureDataDir();
  }

  private async ensureDataDir(): Promise<void> {
    if (!existsSync(this.config.dataPath)) {
      await mkdir(this.config.dataPath, { recursive: true });
    }
  }

  /**
   * Get a session
   */
  async get(key: SessionKey): Promise<Session | undefined> {
    return this.sessions.get(key);
  }

  /**
   * Create or update a session
   */
  async put(session: Session): Promise<void> {
    session.updatedAt = new Date();
    this.sessions.set(session.key, session);

    // Persist to disk
    await this.persist(session);
  }

  /**
   * Delete a session
   */
  async delete(key: SessionKey): Promise<void> {
    const session = this.sessions.get(key);
    if (session) {
      this.sessions.delete(key);

      // Remove from disk
      try {
        await unlink(this.getSessionPath(key));
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }

  /**
   * List sessions
   */
  async list(filter?: SessionFilter): Promise<Session[]> {
    let sessions = Array.from(this.sessions.values());

    if (filter) {
      if (filter.sandboxId) {
        sessions = sessions.filter((s) => s.sandboxId === filter.sandboxId);
      }
      if (filter.status) {
        sessions = sessions.filter((s) => s.status === filter.status);
      }
      if (filter.olderThan) {
        sessions = sessions.filter(
          (s) => s.lastActiveAt < filter.olderThan!
        );
      }
    }

    return sessions;
  }

  /**
   * Create a new session
   */
  async create(
    key: SessionKey,
    sandboxId: SandboxId
  ): Promise<Session> {
    const session: Session = {
      key,
      sandboxId,
      status: "active",
      context: {
        transcriptPath: this.getTranscriptPath(key),
        inputTokens: 0,
        outputTokens: 0,
      },
      stats: {
        messageCount: 0,
        toolCallCount: 0,
        errorCount: 0,
        totalLatencyMs: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: new Date(),
    };

    await this.put(session);
    return session;
  }

  /**
   * Update session stats
   */
  async updateStats(
    key: SessionKey,
    updates: Partial<SessionStats>
  ): Promise<void> {
    const session = this.sessions.get(key);
    if (session) {
      session.stats = { ...session.stats, ...updates };
      session.lastActiveAt = new Date();
      await this.put(session);
    }
  }

  /**
   * Update session context
   */
  async updateContext(
    key: SessionKey,
    updates: Partial<SessionContext>
  ): Promise<void> {
    const session = this.sessions.get(key);
    if (session) {
      session.context = { ...session.context, ...updates };
      await this.put(session);
    }
  }

  /**
   * Close a session
   */
  async close(key: SessionKey): Promise<void> {
    const session = this.sessions.get(key);
    if (session) {
      session.status = "closed";
      await this.put(session);
    }
  }

  /**
   * Get store statistics
   */
  getStats(): {
    total: number;
    active: number;
    idle: number;
    closed: number;
  } {
    const sessions = Array.from(this.sessions.values());
    return {
      total: sessions.length,
      active: sessions.filter((s) => s.status === "active").length,
      idle: sessions.filter((s) => s.status === "idle").length,
      closed: sessions.filter((s) => s.status === "closed").length,
    };
  }

  // ========== Private ==========

  private getSessionPath(key: SessionKey): string {
    // Replace : with _ for filename
    const filename = key.replace(/:/g, "_") + ".json";
    return join(this.config.dataPath, filename);
  }

  private getTranscriptPath(key: SessionKey): string {
    const filename = key.replace(/:/g, "_") + ".jsonl";
    return join(this.config.dataPath, "transcripts", filename);
  }

  private async persist(session: Session): Promise<void> {
    const path = this.getSessionPath(session.key);
    await this.ensureDataDir();
    await writeFile(path, JSON.stringify(session, null, 2), "utf-8");
  }
}