/**
 * Scheduler Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Scheduler } from "../src/scheduler/scheduler.js";
import { TaskQueue } from "../src/scheduler/queue.js";
import { SandboxManager } from "../src/sandbox/manager.js";
import { createTask, TaskStatus, TaskType } from "../src/types/task.js";
import { Priority, DEFAULT_QUOTA, IsolationLevel } from "../src/types/sandbox.js";
import { mkdir, rm } from "fs/promises";

const TEST_WORKSPACE = "./test-workspace-scheduler";

describe("TaskQueue", () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  it("should enqueue and dequeue tasks", () => {
    const task = createTask(TaskType.INFERENCE, { prompt: "test" });

    queue.enqueue(task);
    expect(queue.size()).toBe(1);

    const dequeued = queue.dequeue();
    expect(dequeued).toBeDefined();
    expect(dequeued?.id).toBe(task.id);
    expect(queue.size()).toBe(0);
  });

  it("should respect priority order", () => {
    const lowTask = createTask(
      TaskType.INFERENCE,
      { prompt: "low" },
      { priority: Priority.LOW }
    );
    const highTask = createTask(
      TaskType.INFERENCE,
      { prompt: "high" },
      { priority: Priority.HIGH }
    );
    const normalTask = createTask(
      TaskType.INFERENCE,
      { prompt: "normal" },
      { priority: Priority.NORMAL }
    );

    queue.enqueue(lowTask);
    queue.enqueue(normalTask);
    queue.enqueue(highTask);

    const first = queue.dequeue();
    expect(first?.priority).toBe(Priority.HIGH);

    const second = queue.dequeue();
    expect(second?.priority).toBe(Priority.NORMAL);

    const third = queue.dequeue();
    expect(third?.priority).toBe(Priority.LOW);
  });

  it("should handle dependencies", () => {
    const depTask = createTask(
      TaskType.INFERENCE,
      { prompt: "dependency" },
      { priority: Priority.NORMAL }
    );
    depTask.id = "dep-1";

    const mainTask = createTask(
      TaskType.INFERENCE,
      { prompt: "main" },
      { priority: Priority.NORMAL, dependencies: ["dep-1"] }
    );

    queue.enqueue(mainTask);
    // Task with unmet dependencies goes to pending, not counted in size()
    const sizeAfterEnqueue = queue.size();
    
    queue.complete("dep-1");
    // After dependency is completed, task should be moved to queue
    const sizeAfterComplete = queue.size();
    expect(sizeAfterComplete).toBeGreaterThanOrEqual(1);
  });

  it("should apply aging", () => {
    const oldTask = createTask(
      TaskType.INFERENCE,
      { prompt: "old" },
      { priority: Priority.LOW }
    );
    // Simulate old task
    oldTask.createdAt = new Date(Date.now() - 120000); // 2 minutes ago

    queue.enqueue(oldTask);
    queue.applyAging();

    // Priority should have been boosted
    expect(oldTask.priority).toBeLessThan(Priority.LOW);
  });
});

describe("Scheduler", () => {
  let manager: SandboxManager;
  let scheduler: Scheduler;

  beforeEach(async () => {
    await mkdir(TEST_WORKSPACE, { recursive: true });
    manager = new SandboxManager({
      workspaceRoot: TEST_WORKSPACE,
      maxSandboxes: 10,
    });
    scheduler = new Scheduler(manager, { maxConcurrent: 5 });
  });

  afterEach(async () => {
    await scheduler.stop();
    await rm(TEST_WORKSPACE, { recursive: true, force: true });
  });

  it("should submit and schedule tasks", async () => {
    const task = createTask(TaskType.INFERENCE, { prompt: "test" });

    await scheduler.submit(task);
    expect(task.status).toBe(TaskStatus.QUEUED);
  });

  it("should get queue", async () => {
    const queue = await scheduler.getQueue();
    expect(Array.isArray(queue)).toBe(true);
  });
});