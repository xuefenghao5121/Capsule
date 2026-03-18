/**
 * Capsule - Entry point
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
export { DockerIsolator } from "./sandbox/isolation/docker.js";
export { CheckpointManager } from "./sandbox/checkpoint.js";

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

// Telemetry
export { TelemetryManager } from "./telemetry/index.js";

// Gateway
export { Gateway } from "./gateway/index.js";

// Tenant
export { TenantManager } from "./tenant/manager.js";
export type { TenantConfig, TenantQuota, TenantUsage, TenantId } from "./tenant/manager.js";

// Health
export { HealthChecker, createLivenessProbe, createReadinessProbe } from "./health/index.js";
export type { HealthStatus, ComponentHealth, SystemHealth } from "./health/index.js";

// Performance
export { Cache, RateLimiter, ObjectPool, debounce, throttle } from "./perf/index.js";

// Utils
export { logger } from "./utils/logger.js";
export * from "./utils/errors.js";

/**
 * Create a Capsule instance
 */
import { SandboxManager } from "./sandbox/manager.js";
import { Scheduler } from "./scheduler/scheduler.js";
import { ToolRegistry } from "./tools/registry.js";
import { SessionStore } from "./session/store.js";
import { MemoryManager } from "./memory/manager.js";
import { TelemetryManager } from "./telemetry/index.js";
import { Gateway } from "./gateway/index.js";
import { builtInTools } from "./tools/builtins/index.js";

export interface CapsuleConfig {
  workspaceRoot: string;
  maxSandboxes: number;
  maxConcurrent: number;
  gatewayPort?: number;
}

export class Capsule {
  public readonly sandboxManager: SandboxManager;
  public readonly scheduler: Scheduler;
  public readonly toolRegistry: ToolRegistry;
  public readonly sessionStore: SessionStore;
  public readonly memoryManager: MemoryManager;
  public readonly telemetry: TelemetryManager;
  public readonly gateway?: Gateway;

  constructor(config: CapsuleConfig) {
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
    this.telemetry = new TelemetryManager();

    // Initialize gateway if port is specified
    if (config.gatewayPort) {
      this.gateway = new Gateway(
        this.sandboxManager,
        this.scheduler,
        this.toolRegistry,
        this.sessionStore,
        this.telemetry,
        { port: config.gatewayPort }
      );
    }

    // Register built-in tools
    for (const tool of builtInTools) {
      this.toolRegistry.register(tool);
    }
  }

  /**
   * Start Capsule
   */
  async start(): Promise<void> {
    await this.scheduler.start();
    await this.gateway?.start();
  }

  /**
   * Stop Capsule
   */
  async stop(): Promise<void> {
    await this.gateway?.stop();
    await this.scheduler.stop();
  }
}

/**
 * Create a Capsule instance with default configuration
 */
export function createCapsule(
  workspaceRoot: string = "./workspace",
  options: Partial<CapsuleConfig> = {}
): Capsule {
  return new Capsule({
    workspaceRoot,
    maxSandboxes: 100,
    maxConcurrent: 10,
    gatewayPort: 18789,
    ...options,
  });
}