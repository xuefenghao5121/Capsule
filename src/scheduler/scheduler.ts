/**
 * Scheduler - Task scheduling and resource allocation
 * 
 * Analogous to Process Scheduler in traditional OS
 */

import { Task, TaskStatus, TaskType } from "../types/task.js";
import {
  SandboxId,
  SandboxStatus,
  Priority,
  ResourceRequest,
  PreemptReason,
} from "../types/sandbox.js";
import { Sandbox } from "../sandbox/sandbox.js";
import { SandboxManager } from "../sandbox/manager.js";
import { SandboxPool } from "../sandbox/pool.js";
import { TaskQueue } from "./queue.js";
import { SchedulePolicy, DEFAULT_POLICY } from "./policy.js";

/**
 * Scheduler Configuration
 */
export interface SchedulerConfig {
  policy: SchedulePolicy;
  maxConcurrent: number;
  pollIntervalMs: number;
}

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  policy: DEFAULT_POLICY,
  maxConcurrent: 10,
  pollIntervalMs: 100,
};

/**
 * Schedule Entry
 */
export interface ScheduleEntry {
  sandboxId: SandboxId;
  taskId: TaskId;
  priority: Priority;
  startedAt: Date;
}

/**
 * Resource Grant
 */
export interface ResourceGrant {
  granted: boolean;
  resources: Partial<ResourceRequest>;
  reason?: string;
}

/**
 * Scheduler
 */
export class Scheduler {
  private queue: TaskQueue;
  private pool: SandboxPool;
  private running: Map<TaskId, Sandbox> = new Map();
  private entries: Map<SandboxId, ScheduleEntry> = new Map();
  private isRunning = false;
  private config: SchedulerConfig;

  constructor(
    private readonly manager: SandboxManager,
    config: Partial<SchedulerConfig> = {}
  ) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.queue = new TaskQueue();
    this.pool = new SandboxPool(manager);
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    await this.pool.initialize();

    // Start scheduling loop
    this.scheduleLoop();
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    await this.pool.cleanup();
  }

  /**
   * Submit a task
   */
  async submit(task: Task): Promise<void> {
    task.status = TaskStatus.QUEUED;
    this.queue.enqueue(task);
  }

  /**
   * Schedule a task to a sandbox
   */
  async schedule(task: Task): Promise<Sandbox> {
    // Select sandbox
    const sandbox = await this.selectSandbox(task);
    if (!sandbox) {
      throw new Error("No available sandbox for task");
    }

    // Allocate resources
    const grant = await this.allocate(sandbox, {
      inference: 1,
      tokens: task.input.prompt?.length ?? 0,
    });

    if (!grant.granted) {
      throw new Error(`Resource allocation failed: ${grant.reason}`);
    }

    // Mark as running
    sandbox.transition(SandboxStatus.RUNNING);
    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();

    // Track
    this.running.set(task.id, sandbox);
    this.entries.set(sandbox.id, {
      sandboxId: sandbox.id,
      taskId: task.id,
      priority: task.priority as Priority,
      startedAt: new Date(),
    });

    return sandbox;
  }

  /**
   * Preempt a sandbox
   */
  async preempt(sandbox: Sandbox, reason: PreemptReason): Promise<void> {
    const entry = this.entries.get(sandbox.id);
    if (!entry) return;

    // Find the task
    const task = this.running.get(entry.taskId);
    if (task) {
      task.status = TaskStatus.PENDING;
      this.running.delete(entry.taskId);
    }

    // Release sandbox
    sandbox.transition(SandboxStatus.IDLE);
    this.entries.delete(sandbox.id);

    // Re-queue task if appropriate
    if (reason === PreemptReason.HIGHER_PRIORITY && task) {
      this.queue.enqueue(task);
    }
  }

  /**
   * Yield resources
   */
  async yield(sandbox: Sandbox): Promise<void> {
    await this.reclaim(sandbox);
  }

  /**
   * Allocate resources to a sandbox
   */
  async allocate(
    sandbox: Sandbox,
    request: ResourceRequest
  ): Promise<ResourceGrant> {
    if (!sandbox.checkQuota(request)) {
      return {
        granted: false,
        resources: {},
        reason: "Quota exceeded",
      };
    }

    sandbox.consumeResources(request);

    return {
      granted: true,
      resources: request,
    };
  }

  /**
   * Reclaim resources from a sandbox
   */
  async reclaim(sandbox: Sandbox): Promise<void> {
    const entry = this.entries.get(sandbox.id);
    if (!entry) return;

    // Complete the task
    this.queue.complete(entry.taskId);
    this.running.delete(entry.taskId);
    this.entries.delete(sandbox.id);

    // Release sandbox
    await this.pool.release(sandbox.id);
    sandbox.transition(SandboxStatus.IDLE);
  }

  /**
   * Set task priority
   */
  async setPriority(sandbox: Sandbox, priority: Priority): Promise<void> {
    sandbox.setPriority(priority);

    // If preemptive, check if we should preempt
    if (this.config.policy.preemptive) {
      // Check for lower priority running tasks
      for (const [taskId, runningSandbox] of this.running) {
        if (runningSandbox.priority < priority) {
          await this.preempt(runningSandbox, PreemptReason.HIGHER_PRIORITY);
        }
      }
    }
  }

  /**
   * Get schedule queue
   */
  async getQueue(): Promise<ScheduleEntry[]> {
    return Array.from(this.entries.values());
  }

  // ========== Private Methods ==========

  private async scheduleLoop(): Promise<void> {
    while (this.isRunning) {
      // Apply aging
      if (this.config.policy.aging) {
        this.queue.applyAging();
      }

      // Check if we can schedule more
      if (this.running.size >= this.config.maxConcurrent) {
        await this.sleep(this.config.pollIntervalMs);
        continue;
      }

      // Get next task
      const task = this.queue.dequeue();
      if (!task) {
        await this.sleep(this.config.pollIntervalMs);
        continue;
      }

      // Schedule
      try {
        await this.schedule(task);
      } catch (error) {
        console.error("Schedule error:", error);
        task.status = TaskStatus.FAILED;
      }

      await this.sleep(this.config.pollIntervalMs);
    }
  }

  private async selectSandbox(task: Task): Promise<Sandbox | undefined> {
    // If task specifies a sandbox
    if (task.sandboxId) {
      const sandbox = await this.manager.get(task.sandboxId);
      if (sandbox && sandbox.status === SandboxStatus.IDLE) {
        return sandbox;
      }
    }

    // Get from pool
    const idle = await this.pool.getIdle();
    if (idle.length > 0) {
      // Select least loaded
      return idle.sort((a, b) => {
        const aLoad = a.metrics.totalInferences;
        const bLoad = b.metrics.totalInferences;
        return aLoad - bLoad;
      })[0];
    }

    // Create new if possible
    if (this.pool.canCreate()) {
      return this.pool.createSandbox({
        name: `task-${task.id}`,
        capabilities: task.requiredCapabilities as any[],
      });
    }

    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}