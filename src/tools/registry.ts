/**
 * Tool Registry - Tool registration and discovery
 */

import { Tool, ToolId, ToolFilter, RiskLevel, Capability } from "../types/tool.js";

/**
 * Tool Registry
 */
export class ToolRegistry {
  private tools: Map<ToolId, Tool> = new Map();
  private byName: Map<string, ToolId> = new Map();

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    this.validateTool(tool);

    if (this.tools.has(tool.id)) {
      throw new Error(`Tool already registered: ${tool.id}`);
    }

    this.tools.set(tool.id, tool);
    this.byName.set(tool.name, tool.id);
  }

  /**
   * Unregister a tool
   */
  unregister(toolId: ToolId): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      this.byName.delete(tool.name);
    }
    this.tools.delete(toolId);
  }

  /**
   * Get a tool by ID
   */
  get(toolId: ToolId): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get a tool by name
   */
  getByName(name: string): Tool | undefined {
    const id = this.byName.get(name);
    return id ? this.tools.get(id) : undefined;
  }

  /**
   * Discover tools matching filter
   */
  discover(filter?: ToolFilter): Tool[] {
    let tools = Array.from(this.tools.values());

    if (filter) {
      if (filter.riskLevel) {
        tools = tools.filter((t) => t.riskLevel === filter.riskLevel);
      }
      if (filter.capability) {
        tools = tools.filter((t) =>
          t.requiredCapabilities.includes(filter.capability!)
        );
      }
      if (filter.name) {
        tools = tools.filter((t) =>
          t.name.toLowerCase().includes(filter.name!.toLowerCase())
        );
      }
    }

    return tools;
  }

  /**
   * Check if a sandbox has permission to use a tool
   */
  checkPermission(
    toolId: ToolId,
    capabilities: Capability[],
    permissions: string[]
  ): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;

    // Check capabilities
    for (const cap of tool.requiredCapabilities) {
      if (!capabilities.includes(cap)) {
        return false;
      }
    }

    // Check permissions (simplified)
    return true;
  }

  /**
   * List all tools
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get registry stats
   */
  getStats(): {
    total: number;
    byRiskLevel: Record<RiskLevel, number>;
    byCapability: Record<string, number>;
  } {
    const byRiskLevel: Record<RiskLevel, number> = {
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.HIGH]: 0,
      [RiskLevel.CRITICAL]: 0,
    };

    const byCapability: Record<string, number> = {};

    for (const tool of this.tools.values()) {
      byRiskLevel[tool.riskLevel]++;
      for (const cap of tool.requiredCapabilities) {
        byCapability[cap] = (byCapability[cap] || 0) + 1;
      }
    }

    return {
      total: this.tools.size,
      byRiskLevel,
      byCapability,
    };
  }

  // ========== Private ==========

  private validateTool(tool: Tool): void {
    if (!tool.id || tool.id.trim() === "") {
      throw new Error("Tool ID is required");
    }
    if (!tool.name || tool.name.trim() === "") {
      throw new Error("Tool name is required");
    }
    if (!tool.description || tool.description.trim() === "") {
      throw new Error("Tool description is required");
    }
    if (!tool.inputSchema) {
      throw new Error("Tool input schema is required");
    }
    if (!tool.executor) {
      throw new Error("Tool executor is required");
    }
  }
}