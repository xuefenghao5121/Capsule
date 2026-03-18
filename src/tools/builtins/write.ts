/**
 * Write Tool - Write file contents
 */

import { RiskLevel } from "../../types/sandbox.js";
import { Tool } from "../../types/tool.js";

export const writeTool: Tool = {
  id: "write",
  name: "write",
  description: "Write content to a file in the workspace",
  riskLevel: RiskLevel.MEDIUM,
  requiredCapabilities: ["file_write"],
  requiredPermissions: [],
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to workspace",
      },
      content: {
        type: "string",
        description: "Content to write",
      },
      mode: {
        type: "string",
        enum: ["write", "append"],
        description: "Write mode (write or append)",
      },
    },
    required: ["path", "content"],
  },
  outputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      bytesWritten: { type: "number" },
    },
  },
  estimatedResources: {
    cpuMs: 1,
    memoryMB: 10,
    networkKB: 0,
    storageKB: 10,
  },
  cancellable: false,
  defaultTimeoutMs: 30000,
  executor: {
    async execute(input, context) {
      const { path, content, mode = "write" } = input as {
        path: string;
        content: string;
        mode?: "write" | "append";
      };

      // Resolve path
      const resolvedPath = context.workspace.resolve(path);

      // Check if path is within workspace
      if (!context.workspace.contains(resolvedPath)) {
        throw new Error(`Path ${path} is outside workspace`);
      }

      // Ensure parent directory exists
      const fs = await import("fs/promises");
      const { dirname } = await import("path");
      await fs.mkdir(dirname(resolvedPath), { recursive: true });

      // Write file
      await fs.writeFile(resolvedPath, content, {
        encoding: "utf-8",
        flag: mode === "append" ? "a" : "w",
      });

      return {
        output: {
          path,
          bytesWritten: Buffer.byteLength(content, "utf-8"),
        },
      };
    },
  },
};