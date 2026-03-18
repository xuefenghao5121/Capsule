/**
 * Tool Executor - Execute tools with context and permissions
 */

import {
  Tool,
  ToolResult,
  ToolError,
  ExecutionContext,
  WorkspaceContext,
  ToolStreamEvent,
} from "../types/tool.js";
import { Sandbox } from "../sandbox/sandbox.js";
import { resolve, relative, isAbsolute } from "path";

/**
 * Tool Executor Configuration
 */
export interface ToolExecutorConfig {
  defaultTimeout: number;
  maxConcurrent: number;
}

const DEFAULT_CONFIG: ToolExecutorConfig = {
  defaultTimeout: 60000,
  maxConcurrent: 10,
};

/**
 * Tool Executor
 */
export class ToolExecutor {
  private running: Map<string, AbortController> = new Map();

  constructor(private readonly config: ToolExecutorConfig = DEFAULT_CONFIG) {}

  /**
   * Execute a tool
   */
  async execute(
    tool: Tool,
    input: unknown,
    sandbox: Sandbox
  ): Promise<ToolResult> {
    // Validate input
    const validation = this.validateInput(tool, input);
    if (!validation.valid) {
      return {
        output: null,
        error: {
          code: "INVALID_INPUT",
          message: validation.error ?? "Invalid input",
          recoverable: true,
        },
      };
    }

    // Check permissions
    if (!this.checkPermissions(tool, sandbox)) {
      return {
        output: null,
        error: {
          code: "PERMISSION_DENIED",
          message: `Sandbox ${sandbox.id} does not have permission to use tool ${tool.id}`,
          recoverable: false,
        },
      };
    }

    // Create execution context
    const context = this.createContext(sandbox, tool.defaultTimeoutMs);

    // Execute
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(
        tool,
        input,
        context,
        tool.defaultTimeoutMs || this.config.defaultTimeout
      );

      // Record metrics
      sandbox.recordToolCall(tool.name);

      return {
        output: result,
        metrics: {
          durationMs: Date.now() - startTime,
          memoryPeakMB: 0,
          bytesWritten: 0,
          bytesRead: 0,
        },
      };
    } catch (error) {
      return {
        output: null,
        error: {
          code: "EXECUTION_ERROR",
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
        },
      };
    }
  }

  /**
   * Cancel a running execution
   */
  async cancel(executionId: string): Promise<void> {
    const controller = this.running.get(executionId);
    if (controller) {
      controller.abort();
      this.running.delete(executionId);
    }
  }

  // ========== Private ==========

  private validateInput(
    tool: Tool,
    input: unknown
  ): { valid: boolean; error?: string } {
    if (!input || typeof input !== "object") {
      return { valid: false, error: "Input must be an object" };
    }

    const schema = tool.inputSchema;
    const required = schema.required || [];

    for (const field of required) {
      if (!(field in (input as Record<string, unknown>))) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    return { valid: true };
  }

  private checkPermissions(tool: Tool, sandbox: Sandbox): boolean {
    // Check capabilities
    for (const cap of tool.requiredCapabilities) {
      if (!sandbox.hasCapability(cap)) {
        return false;
      }
    }

    return true;
  }

  private createContext(
    sandbox: Sandbox,
    timeout: number
  ): ExecutionContext {
    const workspace: WorkspaceContext = {
      rootPath: sandbox.workspace.path,
      resolve: (path: string) => {
        if (isAbsolute(path)) return path;
        return resolve(sandbox.workspace.path, "workspace", path);
      },
      contains: (path: string) => {
        const resolved = isAbsolute(path)
          ? path
          : resolve(sandbox.workspace.path, "workspace", path);
        const rel = relative(sandbox.workspace.path, resolved);
        return !rel.startsWith("..") && !isAbsolute(rel);
      },
    };

    return {
      sandboxId: sandbox.id,
      workspace,
      timeout,
    };
  }

  private async executeWithTimeout(
    tool: Tool,
    input: unknown,
    context: ExecutionContext,
    timeoutMs: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      tool.executor
        .execute(input, context)
        .then((result) => {
          clearTimeout(timer);
          resolve(result.output);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}