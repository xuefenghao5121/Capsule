/**
 * Tool Types - Capability exposure interface
 */

import { RiskLevel as RL, Capability as Cap, Permission } from "./sandbox.js";
import { ExecutionId } from "./sandbox.js";

// Re-export for convenience
export { RiskLevel, Capability } from "./sandbox.js";

export type ToolId = string;

/**
 * Tool Interface
 */
export interface Tool {
  id: ToolId;
  name: string;
  description: string;

  // Schema
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;

  // Requirements
  requiredCapabilities: Capability[];
  requiredPermissions: Permission[];

  // Metadata
  estimatedResources: ResourceEstimate;
  riskLevel: RiskLevel;
  cancellable: boolean;
  defaultTimeoutMs: number;
}

/**
 * JSON Schema (simplified)
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  description?: string;
  enum?: string[];
  default?: unknown;
  [key: string]: unknown;
}

/**
 * Resource Estimate
 */
export interface ResourceEstimate {
  cpuMs: number;
  memoryMB: number;
  networkKB: number;
  storageKB: number;
}

/**
 * Tool Execution Context
 */
export interface ExecutionContext {
  sandboxId: string;
  workspace: WorkspaceContext;
  sessionId?: string;
  timeout: number;
  cancellationToken?: CancellationToken;
}

/**
 * Workspace Context
 */
export interface WorkspaceContext {
  rootPath: string;
  resolve(path: string): string;
  contains(path: string): boolean;
}

/**
 * Cancellation Token
 */
export interface CancellationToken {
  cancelled: boolean;
  reason?: string;
}

/**
 * Tool Result
 */
export interface ToolResult {
  output: unknown;
  error?: ToolError;
  metrics?: ToolExecutionMetrics;
}

/**
 * Tool Error
 */
export interface ToolError {
  code: string;
  message: string;
  recoverable: boolean;
}

/**
 * Tool Execution Metrics
 */
export interface ToolExecutionMetrics {
  durationMs: number;
  memoryPeakMB: number;
  bytesWritten: number;
  bytesRead: number;
}

/**
 * Tool Stream Event
 */
export interface ToolStreamEvent {
  type: "data" | "error" | "complete";
  data?: unknown;
  error?: ToolError;
}

/**
 * Tool Filter
 */
export interface ToolFilter {
  riskLevel?: RiskLevel;
  capability?: Capability;
  name?: string;
}

/**
 * Tool Executor
 */
export interface ToolExecutor {
  execute(input: unknown, context: ExecutionContext): Promise<ToolResult>;
  cancel?(executionId: ExecutionId): Promise<void>;
  executeStream?(
    input: unknown,
    context: ExecutionContext
  ): AsyncIterable<ToolStreamEvent>;
}