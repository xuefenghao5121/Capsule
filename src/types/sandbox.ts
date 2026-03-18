/**
 * Sandbox Types - AI OS Core Abstraction
 * 
 * Sandbox ≈ Traditional OS Process
 */

// ========== Identifiers ==========

export type SandboxId = string;
export type TaskId = string;
export type ToolId = string;
export type SessionKey = string;
export type TenantId = string;
export type SnapshotId = string;
export type ExecutionId = string;
export type WorkspaceId = string;

// ========== Enums ==========

/**
 * Isolation Level
 * L0: No isolation (trusted agents)
 * L1: Soft isolation (process-level)
 * L2: Hard isolation (container/WASM)
 */
export enum IsolationLevel {
  L0 = "none",
  L1 = "soft",
  L2 = "hard",
}

/**
 * Sandbox Status
 */
export enum SandboxStatus {
  CREATING = "creating",
  IDLE = "idle",
  RUNNING = "running",
  WAITING = "waiting",
  SUSPENDED = "suspended",
  MIGRATING = "migrating",
  TERMINATING = "terminating",
  TERMINATED = "terminated",
  ERROR = "error",
}

/**
 * Priority Level
 */
export enum Priority {
  REALTIME = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BATCH = 4,
}

/**
 * Risk Level for Tools
 */
export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
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
 * Session Type
 */
export enum SessionType {
  DM = "dm",
  GROUP = "group",
  CHANNEL = "channel",
  TASK = "task",
  CRON = "cron",
  INTERNAL = "internal",
}

// ========== Capabilities & Permissions ==========

/**
 * Capability - What a sandbox can do
 */
export type Capability =
  | "file_read"
  | "file_write"
  | "exec"
  | "network"
  | "browser"
  | "memory"
  | "sessions"
  | "tools"
  | "spawn";

/**
 * Permission - Fine-grained access control
 */
export interface Permission {
  resource: string;
  action: "read" | "write" | "execute" | "delete";
  conditions?: Record<string, unknown>;
}

// ========== Resource Quota ==========

/**
 * Resource Quota - Limits for sandbox resources
 */
export interface ResourceQuota {
  // Inference resources
  maxInferencePerHour: number;
  maxTokensPerDay: number;
  maxContextSize: number;

  // Compute resources
  maxCpuPercent: number;
  maxMemoryMB: number;
  maxGpuMemoryMB?: number;

  // Storage resources
  maxWorkspaceMB: number;
  maxMemoryStorageMB: number;

  // Time resources
  maxExecutionTimeSec: number;
  maxIdleTimeSec: number;

  // Network resources
  allowedDomains?: string[];
  maxNetworkMBPerHour: number;
}

/**
 * Default resource quota
 */
export const DEFAULT_QUOTA: ResourceQuota = {
  maxInferencePerHour: 1000,
  maxTokensPerDay: 1000000,
  maxContextSize: 128000,
  maxCpuPercent: 80,
  maxMemoryMB: 1024,
  maxWorkspaceMB: 1024,
  maxMemoryStorageMB: 512,
  maxExecutionTimeSec: 600,
  maxIdleTimeSec: 3600,
  maxNetworkMBPerHour: 100,
};

// ========== Metrics ==========

/**
 * Sandbox Metrics - Runtime statistics
 */
export interface SandboxMetrics {
  // Inference metrics
  totalInferences: number;
  totalTokens: number;
  avgLatencyMs: number;

  // Tool calls
  toolCalls: Record<string, number>;

  // Resource usage
  cpuPercent: number;
  memoryMB: number;
  storageMB: number;

  // Error statistics
  errorCount: number;
  lastError?: string;

  // Time statistics
  createdAt: Date;
  lastActiveAt: Date;
  totalRuntimeMs: number;
}

/**
 * Initial metrics
 */
export function createInitialMetrics(): SandboxMetrics {
  return {
    totalInferences: 0,
    totalTokens: 0,
    avgLatencyMs: 0,
    toolCalls: {},
    cpuPercent: 0,
    memoryMB: 0,
    storageMB: 0,
    errorCount: 0,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    totalRuntimeMs: 0,
  };
}

// ========== Workspace ==========

/**
 * Workspace Reference
 */
export interface WorkspaceRef {
  id: WorkspaceId;
  path: string;
  createdAt: Date;
}

// ========== Memory ==========

/**
 * Memory Reference
 */
export interface MemoryRef {
  path: string;
  sizeMB: number;
}

// ========== Context ==========

/**
 * Context Snapshot
 */
export interface ContextSnapshot {
  id: string;
  sandboxId: SandboxId;
  createdAt: Date;
  sizeMB: number;
  data?: unknown;
}

// ========== Sandbox Spec & Interface ==========

/**
 * Sandbox Specification - Parameters for creating a sandbox
 */
export interface SandboxSpec {
  name: string;
  tenantId?: TenantId;
  isolationLevel: IsolationLevel;
  capabilities: Capability[];
  permissions?: Permission[];
  quota: ResourceQuota;
  priority?: Priority;
  labels?: Record<string, string>;
}

/**
 * Sandbox Interface
 */
export interface SandboxInterface {
  // Identity
  readonly id: SandboxId;
  readonly name: string;
  readonly tenantId?: TenantId;

  // Isolation
  readonly isolationLevel: IsolationLevel;

  // Capabilities
  readonly capabilities: ReadonlyArray<Capability>;
  readonly permissions: ReadonlyArray<Permission>;

  // Resources
  readonly quota: ResourceQuota;

  // State
  readonly status: SandboxStatus;
  readonly metrics: SandboxMetrics;

  // References
  readonly workspace: WorkspaceRef;
  readonly memory: MemoryRef;

  // Methods
  hasCapability(capability: Capability): boolean;
  hasPermission(permission: Permission): boolean;
  checkQuota(request: ResourceRequest): boolean;
}

/**
 * Resource Request
 */
export interface ResourceRequest {
  inference?: number;
  tokens?: number;
  cpu?: number;
  memory?: number;
  storage?: number;
  time?: number;
}

// ========== Snapshot ==========

/**
 * Snapshot - Sandbox state snapshot
 */
export interface Snapshot {
  id: SnapshotId;
  sandboxId: SandboxId;
  createdAt: Date;
  workspaceSnapshot: WorkspaceSnapshot;
  memorySnapshot: MemorySnapshot;
  contextSnapshot: ContextSnapshot;
  sizeMB: number;
  checksum: string;
}

export interface WorkspaceSnapshot {
  path: string;
  sizeMB: number;
}

export interface MemorySnapshot {
  entries: number;
  sizeMB: number;
}

// ========== Errors ==========

export class SandboxError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly sandboxId?: SandboxId
  ) {
    super(message);
    this.name = "SandboxError";
  }
}

export class InvalidTransitionError extends SandboxError {
  constructor(
    public readonly from: SandboxStatus,
    public readonly to: SandboxStatus
  ) {
    super(
      `Invalid state transition: ${from} -> ${to}`,
      "INVALID_TRANSITION"
    );
    this.name = "InvalidTransitionError";
  }
}

export class QuotaExceededError extends SandboxError {
  constructor(public readonly resource: string) {
    super(`Quota exceeded: ${resource}`, "QUOTA_EXCEEDED");
    this.name = "QuotaExceededError";
  }
}

export class SandboxNotFoundError extends SandboxError {
  constructor(sandboxId: SandboxId) {
    super(`Sandbox not found: ${sandboxId}`, "NOT_FOUND", sandboxId);
    this.name = "SandboxNotFoundError";
  }
}

export class SandboxBusyError extends SandboxError {
  constructor(sandboxId: SandboxId) {
    super(`Sandbox is busy: ${sandboxId}`, "BUSY", sandboxId);
    this.name = "SandboxBusyError";
  }
}

export class PermissionError extends SandboxError {
  constructor(message: string) {
    super(message, "PERMISSION_DENIED");
    this.name = "PermissionError";
  }
}