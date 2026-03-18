/**
 * Tool Types - Capability exposure interface
 */

import { ExecutionId } from "./sandbox.js";

export type ToolId = string;

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

/**
 * Tool Input Schema (JSON Schema)
 */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

/**
 * Tool Output Schema (JSON Schema)
 */
export interface ToolOutputSchema {
  type: "object" | "string" | "array";
  properties?: Record<string, unknown>;
  items?: unknown;
}

/**
 * Resource Estimation
 */
export interface ResourceEstimation {
  cpuMs: number;
  memoryMB: number;
  networkKB: number;
  storageKB: number;
}

/**
 * Tool Execution Context
 */
export interface ToolExecutionContext {
  sandboxId: string;
  workspace: {
    resolve: (path: string) => string;
    exists: (path: string) => boolean;
  };
  quotas: {
    checkInference: (count: number) => boolean;
    recordInference: (count: number) => void;
  };
  signal?: AbortSignal;
}

/**
 * Tool Execution Result
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  output?: T;
  error?: string;
  metrics?: {
    durationMs: number;
    tokensUsed?: number;
  };
}

/**
 * Tool Executor
 */
export interface ToolExecutor<TInput = unknown, TOutput = unknown> {
  execute(input: TInput, context: ToolExecutionContext): Promise<ToolResult<TOutput>>;
  cancel?(): void;
}

/**
 * Tool Definition
 */
export interface Tool<TInput = unknown, TOutput = unknown> {
  id: ToolId;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  requiredCapabilities: Capability[];
  requiredPermissions: Permission[];
  inputSchema: ToolInputSchema;
  outputSchema?: ToolOutputSchema;
  estimatedResources: ResourceEstimation;
  cancellable: boolean;
  defaultTimeoutMs: number;
  executor: ToolExecutor<TInput, TOutput>;
}

/**
 * Tool Registry Entry
 */
export interface ToolRegistryEntry {
  tool: Tool;
  registeredAt: Date;
  registeredBy?: string;
  usageCount: number;
  lastUsed?: Date;
}