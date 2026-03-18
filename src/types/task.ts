/**
 * Task Types - Work unit for sandbox execution
 */

import { SandboxId, TaskId } from "./sandbox.js";

/**
 * Task Type
 */
export enum TaskType {
  INFERENCE = "inference",
  TOOL_CALL = "tool_call",
  AGENT_SPAWN = "agent_spawn",
  MEMORY_OP = "memory_op",
  FILE_OP = "file_op",
  SCHEDULED = "scheduled",
}

/**
 * Task Interface
 */
export interface Task {
  id: TaskId;
  type: TaskType;

  // Task content
  input: TaskInput;
  expectedOutput?: TaskOutputSpec;

  // Scheduling
  priority: number;
  deadline?: Date;
  timeoutMs: number;

  // Associations
  sandboxId?: SandboxId;
  parentId?: TaskId;
  dependencies?: TaskId[];

  // Required capabilities
  requiredCapabilities?: string[];

  // State
  status: TaskStatus;
  result?: TaskResult;
  error?: TaskError;

  // Timing
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Task Input
 */
export interface TaskInput {
  prompt?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  data?: unknown;
}

/**
 * Task Output Specification
 */
export interface TaskOutputSpec {
  type: "text" | "json" | "file" | "stream";
  schema?: Record<string, unknown>;
}

/**
 * Task Result
 */
export interface TaskResult {
  output: unknown;
  metrics: TaskMetrics;
}

/**
 * Task Metrics
 */
export interface TaskMetrics {
  latencyMs: number;
  tokensUsed: number;
  toolCalls: number;
  memoryMB: number;
}

/**
 * Task Error
 */
export interface TaskError {
  code: string;
  message: string;
  details?: unknown;
  retryable: boolean;
}

/**
 * Task Status
 */
export enum TaskStatus {
  PENDING = "pending",
  QUEUED = "queued",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  TIMEOUT = "timeout",
}

/**
 * Create a new task
 */
export function createTask(
  type: TaskType,
  input: TaskInput,
  options: Partial<Task> = {}
): Task {
  return {
    id: generateTaskId(),
    type,
    input,
    priority: options.priority ?? 2,
    timeoutMs: options.timeoutMs ?? 60000,
    status: TaskStatus.PENDING,
    createdAt: new Date(),
    ...options,
  };
}

/**
 * Generate task ID
 */
let taskCounter = 0;
export function generateTaskId(): TaskId {
  return `task-${Date.now()}-${++taskCounter}`;
}