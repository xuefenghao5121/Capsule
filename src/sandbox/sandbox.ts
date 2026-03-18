/**
 * Sandbox - Core isolation unit
 * 
 * Analogous to a Process in traditional OS
 */

import { v4 as uuid } from "uuid";
import {
  SandboxId,
  SandboxStatus,
  IsolationLevel,
  Capability,
  Permission,
  ResourceQuota,
  ResourceRequest,
  SandboxMetrics,
  SandboxSpec,
  SandboxInterface,
  WorkspaceRef,
  MemoryRef,
  ContextSnapshot,
  createInitialMetrics,
  InvalidTransitionError,
  QuotaExceededError,
  DEFAULT_QUOTA,
} from "../types/sandbox.js";

/**
 * State transition map
 */
const ALLOWED_TRANSITIONS: Record<SandboxStatus, SandboxStatus[]> = {
  [SandboxStatus.CREATING]: [SandboxStatus.IDLE, SandboxStatus.ERROR],
  [SandboxStatus.IDLE]: [
    SandboxStatus.RUNNING,
    SandboxStatus.SUSPENDED,
    SandboxStatus.TERMINATING,
    SandboxStatus.WAITING,
  ],
  [SandboxStatus.RUNNING]: [
    SandboxStatus.IDLE,
    SandboxStatus.SUSPENDED,
    SandboxStatus.TERMINATING,
    SandboxStatus.WAITING,
    SandboxStatus.ERROR,
  ],
  [SandboxStatus.WAITING]: [
    SandboxStatus.IDLE,
    SandboxStatus.RUNNING,
    SandboxStatus.TERMINATING,
  ],
  [SandboxStatus.SUSPENDED]: [
    SandboxStatus.IDLE,
    SandboxStatus.TERMINATING,
  ],
  [SandboxStatus.MIGRATING]: [
    SandboxStatus.IDLE,
    SandboxStatus.ERROR,
  ],
  [SandboxStatus.TERMINATING]: [SandboxStatus.TERMINATED, SandboxStatus.ERROR],
  [SandboxStatus.TERMINATED]: [],
  [SandboxStatus.ERROR]: [SandboxStatus.TERMINATING],
};

/**
 * Sandbox Implementation
 */
export class Sandbox implements SandboxInterface {
  private _id: SandboxId;
  private _name: string;
  private _tenantId?: string;
  private _isolationLevel: IsolationLevel;
  private _capabilities: Capability[];
  private _permissions: Permission[];
  private _quota: ResourceQuota;
  private _status: SandboxStatus;
  private _metrics: SandboxMetrics;
  private _workspace: WorkspaceRef;
  private _memory: MemoryRef;
  private _context?: ContextSnapshot;
  private _priority: number;
  private _labels: Record<string, string>;

  constructor(
    spec: SandboxSpec,
    workspace: WorkspaceRef,
    memory: MemoryRef
  ) {
    this._id = this.generateId();
    this._name = spec.name;
    this._tenantId = spec.tenantId;
    this._isolationLevel = spec.isolationLevel;
    this._capabilities = [...spec.capabilities];
    this._permissions = spec.permissions ? [...spec.permissions] : [];
    this._quota = { ...DEFAULT_QUOTA, ...spec.quota };
    this._status = SandboxStatus.CREATING;
    this._metrics = createInitialMetrics();
    this._workspace = workspace;
    this._memory = memory;
    this._priority = spec.priority ?? 2;
    this._labels = spec.labels ?? {};
  }

  // ========== Getters ==========

  get id(): SandboxId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get tenantId(): string | undefined {
    return this._tenantId;
  }

  get isolationLevel(): IsolationLevel {
    return this._isolationLevel;
  }

  get capabilities(): ReadonlyArray<Capability> {
    return this._capabilities;
  }

  get permissions(): ReadonlyArray<Permission> {
    return this._permissions;
  }

  get quota(): ResourceQuota {
    return this._quota;
  }

  get status(): SandboxStatus {
    return this._status;
  }

  get metrics(): SandboxMetrics {
    return this._metrics;
  }

  get workspace(): WorkspaceRef {
    return this._workspace;
  }

  get memory(): MemoryRef {
    return this._memory;
  }

  get priority(): number {
    return this._priority;
  }

  get labels(): Record<string, string> {
    return { ...this._labels };
  }

  // ========== State Management ==========

  /**
   * Transition to a new status
   */
  transition(to: SandboxStatus): void {
    const allowed = ALLOWED_TRANSITIONS[this._status];
    if (!allowed.includes(to)) {
      throw new InvalidTransitionError(this._status, to);
    }
    this._status = to;
    this._metrics.lastActiveAt = new Date();
  }

  /**
   * Check if transition is allowed
   */
  canTransition(to: SandboxStatus): boolean {
    return ALLOWED_TRANSITIONS[this._status].includes(to);
  }

  // ========== Capability Management ==========

  /**
   * Check if sandbox has a capability
   */
  hasCapability(capability: Capability): boolean {
    return this._capabilities.includes(capability);
  }

  /**
   * Check if sandbox has a permission
   */
  hasPermission(permission: Permission): boolean {
    return this._permissions.some(
      (p) =>
        p.resource === permission.resource && p.action === permission.action
    );
  }

  /**
   * Add a capability
   */
  addCapability(capability: Capability): void {
    if (!this._capabilities.includes(capability)) {
      this._capabilities.push(capability);
    }
  }

  /**
   * Remove a capability
   */
  removeCapability(capability: Capability): void {
    const index = this._capabilities.indexOf(capability);
    if (index >= 0) {
      this._capabilities.splice(index, 1);
    }
  }

  // ========== Resource Management ==========

  /**
   * Check if resource request is within quota
   */
  checkQuota(request: ResourceRequest): boolean {
    // Check inference quota
    if (request.inference !== undefined) {
      if (
        this._metrics.totalInferences + request.inference >
        this._quota.maxInferencePerHour
      ) {
        return false;
      }
    }

    // Check token quota
    if (request.tokens !== undefined) {
      if (
        this._metrics.totalTokens + request.tokens >
        this._quota.maxTokensPerDay
      ) {
        return false;
      }
    }

    // Check memory quota
    if (request.memory !== undefined) {
      if (request.memory > this._quota.maxMemoryMB) {
        return false;
      }
    }

    // Check time quota
    if (request.time !== undefined) {
      if (request.time > this._quota.maxExecutionTimeSec) {
        return false;
      }
    }

    return true;
  }

  /**
   * Consume resources
   */
  consumeResources(request: ResourceRequest): void {
    if (request.inference !== undefined) {
      this._metrics.totalInferences += request.inference;
    }
    if (request.tokens !== undefined) {
      this._metrics.totalTokens += request.tokens;
    }
  }

  // ========== Metrics Management ==========

  /**
   * Update metrics
   */
  updateMetrics(updates: Partial<SandboxMetrics>): void {
    this._metrics = { ...this._metrics, ...updates };
    this._metrics.lastActiveAt = new Date();
  }

  /**
   * Record an error
   */
  recordError(error: string): void {
    this._metrics.errorCount++;
    this._metrics.lastError = error;
  }

  /**
   * Record tool call
   */
  recordToolCall(toolName: string): void {
    this._metrics.toolCalls[toolName] =
      (this._metrics.toolCalls[toolName] || 0) + 1;
  }

  // ========== Priority Management ==========

  /**
   * Set priority
   */
  setPriority(priority: number): void {
    this._priority = Math.max(0, Math.min(4, priority));
  }

  // ========== Context Management ==========

  /**
   * Set context snapshot
   */
  setContext(context: ContextSnapshot): void {
    this._context = context;
  }

  /**
   * Get context snapshot
   */
  getContext(): ContextSnapshot | undefined {
    return this._context;
  }

  // ========== Utility ==========

  private generateId(): SandboxId {
    return `sbx-${uuid().slice(0, 8)}`;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      name: this._name,
      tenantId: this._tenantId,
      isolationLevel: this._isolationLevel,
      capabilities: this._capabilities,
      permissions: this._permissions,
      quota: this._quota,
      status: this._status,
      metrics: this._metrics,
      workspace: this._workspace,
      memory: this._memory,
      priority: this._priority,
      labels: this._labels,
    };
  }
}