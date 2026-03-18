/**
 * Task Queue - Priority-based task management
 */

import { Task, TaskId, TaskStatus } from "../types/task.js";
import { Priority } from "../types/sandbox.js";

/**
 * Task Queue Options
 */
export interface TaskQueueOptions {
  maxSize: number;
  agingIntervalMs: number;
}

const DEFAULT_OPTIONS: TaskQueueOptions = {
  maxSize: 10000,
  agingIntervalMs: 60000,
};

/**
 * Task Queue
 */
export class TaskQueue {
  private queues: Map<Priority, Task[]> = new Map();
  private pending: Map<TaskId, Task> = new Map();
  private completed: Set<TaskId> = new Set();
  private options: TaskQueueOptions;

  constructor(options: Partial<TaskQueueOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Initialize priority queues
    Object.values(Priority).forEach((p) => {
      if (typeof p === "number") {
        this.queues.set(p, []);
      }
    });
  }

  /**
   * Enqueue a task
   */
  enqueue(task: Task): void {
    // Check dependencies
    if (task.dependencies?.length) {
      const unmet = task.dependencies.filter((d) => !this.completed.has(d));
      if (unmet.length > 0) {
        this.pending.set(task.id, task);
        return;
      }
    }

    // Add to appropriate queue
    const queue = this.queues.get(task.priority as Priority);
    if (!queue) {
      throw new Error(`Invalid priority: ${task.priority}`);
    }

    queue.push(task);

    // Sort by deadline
    queue.sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.getTime() - b.deadline.getTime();
    });
  }

  /**
   * Dequeue the next task
   */
  dequeue(): Task | undefined {
    // Check priorities in order
    for (const priority of [
      Priority.REALTIME,
      Priority.HIGH,
      Priority.NORMAL,
      Priority.LOW,
      Priority.BATCH,
    ]) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift();
      }
    }
    return undefined;
  }

  /**
   * Peek at the next task without removing it
   */
  peek(): Task | undefined {
    for (const priority of [
      Priority.REALTIME,
      Priority.HIGH,
      Priority.NORMAL,
      Priority.LOW,
      Priority.BATCH,
    ]) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue[0];
      }
    }
    return undefined;
  }

  /**
   * Mark a task as completed
   */
  complete(taskId: TaskId): void {
    this.completed.add(taskId);

    // Check pending tasks
    for (const [id, task] of this.pending) {
      if (task.dependencies?.every((d) => this.completed.has(d))) {
        this.pending.delete(id);
        this.enqueue(task);
      }
    }
  }

  /**
   * Cancel a task
   */
  cancel(taskId: TaskId): boolean {
    // Check pending
    if (this.pending.has(taskId)) {
      this.pending.delete(taskId);
      return true;
    }

    // Check queues
    for (const queue of this.queues.values()) {
      const index = queue.findIndex((t) => t.id === taskId);
      if (index >= 0) {
        queue.splice(index, 1);
        return true;
      }
    }

    return false;
  }

  /**
   * Apply priority aging to prevent starvation
   */
  applyAging(): void {
    const now = Date.now();

    for (const [priority, queue] of this.queues) {
      if (priority === Priority.BATCH) continue;

      for (const task of queue) {
        const waitTime = now - task.createdAt.getTime();
        const agingSteps = Math.floor(waitTime / this.options.agingIntervalMs);

        if (agingSteps > 0 && task.priority > Priority.REALTIME) {
          task.priority = Math.max(Priority.REALTIME, task.priority - agingSteps);
        }
      }
    }
  }

  /**
   * Get queue size
   */
  size(): number {
    let total = this.pending.size;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Get queue size by priority
   */
  sizeByPriority(priority: Priority): number {
    return this.queues.get(priority)?.length ?? 0;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * Clear all queues
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
    this.pending.clear();
    this.completed.clear();
  }

  /**
   * Get all tasks (for debugging)
   */
  getAll(): Task[] {
    const tasks: Task[] = [];
    for (const queue of this.queues.values()) {
      tasks.push(...queue);
    }
    tasks.push(...this.pending.values());
    return tasks;
  }
}