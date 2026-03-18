/**
 * Tenant Manager - Multi-tenancy support
 */

import { v4 as uuid } from "uuid";
import { SandboxId, ResourceQuota, DEFAULT_QUOTA } from "../types/sandbox.js";

/**
 * Tenant ID
 */
export type TenantId = string;

/**
 * Tenant Configuration
 */
export interface TenantConfig {
  id: TenantId;
  name: string;
  quota: TenantQuota;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Tenant Quota (resource limits across all sandboxes)
 */
export interface TenantQuota {
  maxSandboxes: number;
  maxTotalTokensPerDay: number;
  maxTotalInferencePerHour: number;
  maxStorageMB: number;
  allowedIsolationLevels: ("L0" | "L1" | "L2")[];
  allowedCapabilities: string[];
}

/**
 * Default tenant quota
 */
const DEFAULT_TENANT_QUOTA: TenantQuota = {
  maxSandboxes: 10,
  maxTotalTokensPerDay: 10000000,
  maxTotalInferencePerHour: 10000,
  maxStorageMB: 10240,
  allowedIsolationLevels: ["L0", "L1", "L2"],
  allowedCapabilities: ["file_read", "file_write", "exec", "memory"],
};

/**
 * Tenant Usage
 */
export interface TenantUsage {
  sandboxCount: number;
  totalTokensToday: number;
  totalInferencesThisHour: number;
  totalStorageMB: number;
}

/**
 * Tenant Manager
 * 
 * Manages multi-tenant isolation and resource allocation
 */
export class TenantManager {
  private tenants: Map<TenantId, TenantConfig> = new Map();
  private usage: Map<TenantId, TenantUsage> = new Map();

  constructor() {
    // Create default tenant
    this.createTenant("default", "Default Tenant");
  }

  /**
   * Create a new tenant
   */
  createTenant(
    name: string,
    quota?: Partial<TenantQuota>,
    metadata?: Record<string, unknown>
  ): TenantConfig {
    const id = this.generateId();
    const config: TenantConfig = {
      id,
      name,
      quota: { ...DEFAULT_TENANT_QUOTA, ...quota },
      createdAt: new Date(),
      metadata,
    };

    this.tenants.set(id, config);
    this.usage.set(id, this.createEmptyUsage());

    return config;
  }

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: TenantId): TenantConfig | undefined {
    return this.tenants.get(tenantId);
  }

  /**
   * List all tenants
   */
  listTenants(): TenantConfig[] {
    return Array.from(this.tenants.values());
  }

  /**
   * Delete a tenant
   */
  deleteTenant(tenantId: TenantId): boolean {
    if (tenantId === "default") {
      throw new Error("Cannot delete default tenant");
    }

    const deleted = this.tenants.delete(tenantId);
    this.usage.delete(tenantId);
    return deleted;
  }

  /**
   * Update tenant quota
   */
  updateQuota(tenantId: TenantId, quota: Partial<TenantQuota>): void {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    tenant.quota = { ...tenant.quota, ...quota };
  }

  /**
   * Check if tenant can create a new sandbox
   */
  canCreateSandbox(tenantId: TenantId): boolean {
    const tenant = this.tenants.get(tenantId);
    const usage = this.usage.get(tenantId);

    if (!tenant || !usage) return false;

    return usage.sandboxCount < tenant.quota.maxSandboxes;
  }

  /**
   * Check if tenant has enough token quota
   */
  hasTokenQuota(tenantId: TenantId, tokens: number): boolean {
    const tenant = this.tenants.get(tenantId);
    const usage = this.usage.get(tenantId);

    if (!tenant || !usage) return false;

    return usage.totalTokensToday + tokens <= tenant.quota.maxTotalTokensPerDay;
  }

  /**
   * Check if tenant has enough inference quota
   */
  hasInferenceQuota(tenantId: TenantId, inferences: number): boolean {
    const tenant = this.tenants.get(tenantId);
    const usage = this.usage.get(tenantId);

    if (!tenant || !usage) return false;

    return (
      usage.totalInferencesThisHour + inferences <=
      tenant.quota.maxTotalInferencePerHour
    );
  }

  /**
   * Record sandbox creation
   */
  recordSandboxCreation(tenantId: TenantId): void {
    const usage = this.usage.get(tenantId);
    if (usage) {
      usage.sandboxCount++;
    }
  }

  /**
   * Record sandbox deletion
   */
  recordSandboxDeletion(tenantId: TenantId): void {
    const usage = this.usage.get(tenantId);
    if (usage && usage.sandboxCount > 0) {
      usage.sandboxCount--;
    }
  }

  /**
   * Record token usage
   */
  recordTokenUsage(tenantId: TenantId, tokens: number): void {
    const usage = this.usage.get(tenantId);
    if (usage) {
      usage.totalTokensToday += tokens;
    }
  }

  /**
   * Record inference usage
   */
  recordInferenceUsage(tenantId: TenantId, inferences: number = 1): void {
    const usage = this.usage.get(tenantId);
    if (usage) {
      usage.totalInferencesThisHour += inferences;
    }
  }

  /**
   * Get tenant usage
   */
  getUsage(tenantId: TenantId): TenantUsage | undefined {
    return this.usage.get(tenantId);
  }

  /**
   * Get all usage
   */
  getAllUsage(): Map<TenantId, TenantUsage> {
    return new Map(this.usage);
  }

  /**
   * Reset hourly usage (call every hour)
   */
  resetHourlyUsage(): void {
    for (const usage of this.usage.values()) {
      usage.totalInferencesThisHour = 0;
    }
  }

  /**
   * Reset daily usage (call every day)
   */
  resetDailyUsage(): void {
    for (const usage of this.usage.values()) {
      usage.totalTokensToday = 0;
    }
  }

  /**
   * Get sandbox resource quota for tenant
   */
  getSandboxQuota(tenantId: TenantId): ResourceQuota {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return DEFAULT_QUOTA;
    }

    // Calculate per-sandbox quota based on tenant quota
    const perSandboxTokens = Math.floor(
      tenant.quota.maxTotalTokensPerDay / tenant.quota.maxSandboxes
    );
    const perSandboxInference = Math.floor(
      tenant.quota.maxTotalInferencePerHour / tenant.quota.maxSandboxes
    );

    return {
      ...DEFAULT_QUOTA,
      maxTokensPerDay: perSandboxTokens,
      maxInferencePerHour: perSandboxInference,
    };
  }

  // ========== Private ==========

  private generateId(): TenantId {
    return `tenant-${uuid().slice(0, 8)}`;
  }

  private createEmptyUsage(): TenantUsage {
    return {
      sandboxCount: 0,
      totalTokensToday: 0,
      totalInferencesThisHour: 0,
      totalStorageMB: 0,
    };
  }
}