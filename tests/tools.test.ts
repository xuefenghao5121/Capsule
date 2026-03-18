/**
 * Tools Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../src/tools/registry.js";
import { readTool, writeTool, execTool } from "../src/tools/builtins/index.js";
import { RiskLevel, Capability } from "../src/types/tool.js";

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("should register a tool", () => {
    registry.register(readTool);

    const found = registry.get("read");
    expect(found).toBeDefined();
    expect(found?.name).toBe("read");
  });

  it("should not register duplicate tools", () => {
    registry.register(readTool);

    expect(() => registry.register(readTool)).toThrow();
  });

  it("should discover tools by filter", () => {
    registry.register(readTool);
    registry.register(writeTool);
    registry.register(execTool);

    const lowRisk = registry.discover({ riskLevel: RiskLevel.LOW });
    expect(lowRisk.length).toBe(1);
    expect(lowRisk[0].name).toBe("read");

    const highRisk = registry.discover({ riskLevel: RiskLevel.HIGH });
    expect(highRisk.length).toBe(1);
    expect(highRisk[0].name).toBe("exec");
  });

  it("should check permissions", () => {
    registry.register(execTool);

    const hasPermission = registry.checkPermission(
      "exec",
      ["exec"] as Capability[],
      []
    );
    expect(hasPermission).toBe(true);

    const noPermission = registry.checkPermission(
      "exec",
      ["file_read"] as Capability[],
      []
    );
    expect(noPermission).toBe(false);
  });

  it("should provide statistics", () => {
    registry.register(readTool);
    registry.register(writeTool);
    registry.register(execTool);

    const stats = registry.getStats();

    expect(stats.total).toBe(3);
    expect(stats.byRiskLevel[RiskLevel.LOW]).toBe(1);
    expect(stats.byRiskLevel[RiskLevel.MEDIUM]).toBe(1);
    expect(stats.byRiskLevel[RiskLevel.HIGH]).toBe(1);
  });
});