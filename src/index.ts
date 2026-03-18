/**
 * AI OS - Entry point
 * 
 * Sandbox-centric AI Operating System
 */

// Types
export * from "./types/index.js";

// Sandbox
export { Sandbox } from "./sandbox/sandbox.js";
export { SandboxManager } from "./sandbox/manager.js";
export { WorkspaceManager } from "./sandbox/workspace.js";
export { SandboxPool } from "./sandbox/pool.js";
export { ProcessIsolator } from "./sandbox/isolation/process.js";

// Scheduler
export { Scheduler } from "./scheduler/scheduler.js";
export { TaskQueue } from "./scheduler/queue.js";
export * from "./scheduler/policy.js";

// Tools
export { ToolRegistry } from "./tools/registry.js";
export { ToolExecutor } from "./tools/executor.js";
export * from "./tools/builtins/index.js";

// Session
export * from "./session/key.js";
export { SessionStore } from "./session/store.js";

// Memory
export { MemoryManager } from "./memory/manager.js";

// Utils
export { logger } from "./utils/logger.js";
export * from "./utils/errors.js";

/**
 * Create an AI OS instance
 */
import { SandboxManager } from "./sandbox/manager.js";
import { Scheduler } from "./scheduler/scheduler.js";
import { ToolRegistry } from "./tools/registry.js";
import { SessionStore } from "./session/store.js";
import { MemoryManager } from "./memory/manager.js";
import { builtInTools } from "./tools/builtins/index.js";

export interface AIOSConfig {
  workspaceRoot: string;
  maxSandboxes: number;
  maxConcurrent: number;
}

export class AIOS {
  public readonly sandboxManager: SandboxManager;
  public readonly scheduler: Scheduler;
  public readonly toolRegistry: ToolRegistry;
  public readonly sessionStore: SessionStore;
  public readonly memoryManager: MemoryManager;

  constructor(config: AIOSConfig) {
    // Initialize components
    this.sandboxManager = new SandboxManager({
      workspaceRoot: config.workspaceRoot,
      maxSandboxes: config.maxSandboxes,
    });

    this.scheduler = new Scheduler(this.sandboxManager, {
      maxConcurrent: config.maxConcurrent,
    });

    this.toolRegistry = new ToolRegistry();
    this.sessionStore = new SessionStore({
      dataPath: `${config.workspaceRoot}/sessions`,
    });
    this.memoryManager = new MemoryManager({
      workspacePath: config.workspaceRoot,
    });

    // Register built-in tools
    for (const tool of builtInTools) {
      this.toolRegistry.register(tool);
    }
  }

  /**
   * Start the AI OS
   */
  async start(): Promise<void> {
    await this.scheduler.start();
  }

  /**
   * Stop the AI OS
   */
  async stop(): Promise<void> {
    await this.scheduler.stop();
  }
}

/**
 * Create an AI OS instance with default configuration
 */
export function createAIOS(
  workspaceRoot: string = "./workspace"
): AIOS {
  return new AIOS({
    workspaceRoot,
    maxSandboxes: 100,
    maxConcurrent: 10,
  });
}