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