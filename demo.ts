/**
 * Capsule Demo - Local test script (simplified)
 */

import { SandboxManager } from "./src/sandbox/manager.js";
import { Scheduler } from "./src/scheduler/scheduler.js";
import { ToolRegistry } from "./src/tools/registry.js";
import { SessionStore } from "./src/session/store.js";
import { TelemetryManager } from "./src/telemetry/index.js";
import { IsolationLevel, Priority, SandboxStatus } from "./src/types/sandbox.js";
import { TaskType, TaskStatus } from "./src/types/task.js";
import { builtInTools } from "./src/tools/builtins/index.js";

async function main() {
  console.log("🚀 Capsule Demo - Local Test\n");

  // Initialize components
  console.log("1. Initializing components...");
  
  const sandboxManager = new SandboxManager({
    workspaceRoot: "./demo-workspace",
    maxSandboxes: 10,
  });

  const scheduler = new Scheduler(sandboxManager, {
    maxConcurrent: 5,
  });

  const toolRegistry = new ToolRegistry();
  
  // Register built-in tools
  for (const tool of builtInTools) {
    toolRegistry.register(tool);
  }
  
  const sessionStore = new SessionStore({
    dataPath: "./demo-workspace/sessions",
    maxSessions: 100,
  });
  const telemetry = new TelemetryManager();

  console.log("   ✅ Components initialized\n");

  // Start the system
  console.log("2. Starting Scheduler...");
  await scheduler.start();
  console.log("   ✅ Started\n");

  // List built-in tools
  console.log("3. Built-in tools:");
  const tools = toolRegistry.list();
  for (const tool of tools) {
    console.log(`   - ${tool.name} (${tool.riskLevel})`);
  }
  console.log("");

  // Create a sandbox
  console.log("4. Creating sandbox...");
  const sandbox = await sandboxManager.create({
    name: "demo-agent",
    isolationLevel: IsolationLevel.L1,
    capabilities: ["file_read", "file_write", "exec"],
    quota: {
      maxInferencePerHour: 100,
      maxTokensPerDay: 10000,
      maxCpuPercent: 50,
      maxMemoryMB: 256,
      maxContextSize: 4096,
      maxWorkspaceMB: 100,
      maxMemoryStorageMB: 50,
      maxExecutionTimeSec: 60,
      maxIdleTimeSec: 300,
      maxNetworkMBPerHour: 10,
    },
  });
  console.log(`   ✅ Created: ${sandbox.id}`);
  console.log(`   Status: ${sandbox.status}`);
  console.log(`   Isolation: ${sandbox.isolationLevel}\n`);

  // Test capabilities
  console.log("5. Testing capabilities:");
  console.log(`   hasCapability('file_read'): ${sandbox.hasCapability("file_read")}`);
  console.log(`   hasCapability('browser'): ${sandbox.hasCapability("browser")}\n`);

  // Test quota
  console.log("6. Testing quota:");
  console.log(`   checkQuota({ inference: 1 }): ${sandbox.checkQuota({ inference: 1 })}`);
  console.log(`   checkQuota({ inference: 1000 }): ${sandbox.checkQuota({ inference: 1000 })}\n`);

  // Get system stats
  console.log("7. System statistics:");
  const stats = sandboxManager.getStats();
  console.log(`   Total sandboxes: ${stats.totalSandboxes}`);
  console.log(`   By status: ${JSON.stringify(stats.byStatus)}`);

  const sessionStats = sessionStore.getStats();
  console.log(`   Sessions: ${sessionStats.total}\n`);

  // Health check
  console.log("8. Health check:");
  const health = telemetry.export();
  console.log(`   Metrics: ${health.metrics.length}`);
  console.log(`   Logs: ${health.logs.length}\n`);

  // Cleanup
  console.log("9. Cleaning up...");
  await sandboxManager.destroy(sandbox.id);
  console.log("   ✅ Sandbox destroyed");

  await scheduler.stop();
  console.log("   ✅ Scheduler stopped\n");

  console.log("✅ Demo completed successfully!");
}

main().catch(console.error);