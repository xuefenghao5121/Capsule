/**
 * Exec Tool - Execute shell commands
 */

import { RiskLevel } from "../../types/sandbox.js";
import { Tool } from "../../types/tool.js";
import { spawn } from "child_process";

export const execTool: Tool = {
  id: "exec",
  name: "exec",
  description: "Execute a shell command",
  riskLevel: RiskLevel.HIGH,
  requiredCapabilities: ["exec"],
  requiredPermissions: [],
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Command to execute",
      },
      args: {
        type: "array",
        items: { type: "string" },
        description: "Command arguments",
      },
      cwd: {
        type: "string",
        description: "Working directory",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds",
      },
    },
    required: ["command"],
  },
  outputSchema: {
    type: "object",
    properties: {
      stdout: { type: "string" },
      stderr: { type: "string" },
      exitCode: { type: "number" },
    },
  },
  estimatedResources: {
    cpuMs: 100,
    memoryMB: 50,
    networkKB: 0,
    storageKB: 0,
  },
  cancellable: true,
  defaultTimeoutMs: 60000,
  executor: {
    async execute(input, context) {
      const { command, args = [], cwd, timeout = 60000 } = input as {
        command: string;
        args?: string[];
        cwd?: string;
        timeout?: number;
      };

      const workingDir = cwd
        ? context.workspace.resolve(cwd)
        : context.workspace.rootPath;

      return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
          cwd: workingDir,
          timeout,
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          resolve({
            output: {
              stdout,
              stderr,
              exitCode: code ?? 0,
            },
          });
        });

        proc.on("error", (error) => {
          reject(error);
        });
      });
    },
  },
};