/**
 * Read Tool - Read file contents
 */

import { RiskLevel } from "../../types/sandbox.js";
import { Tool } from "../../types/tool.js";

export const readTool: Tool = {
  id: "read",
  name: "read",
  description: "Read file contents from the workspace",
  riskLevel: RiskLevel.LOW,
  requiredCapabilities: ["file_read"],
  requiredPermissions: [],
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to workspace",
      },
      offset: {
        type: "number",
        description: "Start line number (0-indexed)",
      },
      limit: {
        type: "number",
        description: "Maximum number of lines to read",
      },
    },
    required: ["path"],
  },
  outputSchema: {
    type: "object",
    properties: {
      content: { type: "string" },
      path: { type: "string" },
      lines: { type: "number" },
    },
  },
  estimatedResources: {
    cpuMs: 1,
    memoryMB: 10,
    networkKB: 0,
    storageKB: 0,
  },
  cancellable: false,
  defaultTimeoutMs: 30000,
  executor: {
    async execute(input, context) {
      const { path, offset = 0, limit } = input as {
        path: string;
        offset?: number;
        limit?: number;
      };

      // Resolve path
      const resolvedPath = context.workspace.resolve(path);

      // Check if path is within workspace
      if (!context.workspace.contains(resolvedPath)) {
        throw new Error(`Path ${path} is outside workspace`);
      }

      // Read file
      const fs = await import("fs/promises");
      const content = await fs.readFile(resolvedPath, "utf-8");

      // Apply offset and limit
      const lines = content.split("\n");
      const selected = lines.slice(
        offset,
        limit !== undefined ? offset + limit : undefined
      );

      return {
        output: {
          content: selected.join("\n"),
          path,
          lines: selected.length,
        },
      };
    },
  },
};