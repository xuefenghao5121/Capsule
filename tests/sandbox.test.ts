/**
 * Sandbox Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SandboxManager } from "../src/sandbox/manager.js";
import {
  IsolationLevel,
  SandboxStatus,
  Capability,
  DEFAULT_QUOTA,
} from "../src/types/sandbox.js";
import { mkdir, rm } from "fs/promises";

const TEST_WORKSPACE = "./test-workspace";

describe("Sandbox", () => {
  let manager: SandboxManager;

  beforeEach(async () => {
    await mkdir(TEST_WORKSPACE, { recursive: true });
    manager = new SandboxManager({
      workspaceRoot: TEST_WORKSPACE,
      maxSandboxes: 10,
    });
  });

  afterEach(async () => {
    await rm(TEST_WORKSPACE, { recursive: true, force: true });
  });

  it("should create a sandbox", async () => {
    const sandbox = await manager.create({
      name: "test-sandbox",
      isolationLevel: IsolationLevel.L1,
      capabilities: ["file_read", "file_write"],
      quota: DEFAULT_QUOTA,
    });

    expect(sandbox).toBeDefined();
    expect(sandbox.name).toBe("test-sandbox");
    expect(sandbox.status).toBe(SandboxStatus.IDLE);
    expect(sandbox.isolationLevel).toBe(IsolationLevel.L1);
  });

  it("should transition states correctly", async () => {
    const sandbox = await manager.create({
      name: "test-sandbox",
      isolationLevel: IsolationLevel.L1,
      capabilities: ["file_read"],
      quota: DEFAULT_QUOTA,
    });

    expect(sandbox.status).toBe(SandboxStatus.IDLE);

    // Valid transition
    sandbox.transition(SandboxStatus.RUNNING);
    expect(sandbox.status).toBe(SandboxStatus.RUNNING);

    // Invalid transition should throw
    expect(() => sandbox.transition(SandboxStatus.CREATING)).toThrow();
  });

  it("should check capabilities correctly", async () => {
    const sandbox = await manager.create({
      name: "test-sandbox",
      isolationLevel: IsolationLevel.L1,
      capabilities: ["file_read", "file_write"],
      quota: DEFAULT_QUOTA,
    });

    expect(sandbox.hasCapability("file_read")).toBe(true);
    expect(sandbox.hasCapability("file_write")).toBe(true);
    expect(sandbox.hasCapability("exec")).toBe(false);
  });

  it("should check resource quota correctly", async () => {
    const sandbox = await manager.create({
      name: "test-sandbox",
      isolationLevel: IsolationLevel.L1,
      capabilities: ["file_read"],
      quota: {
        ...DEFAULT_QUOTA,
        maxInferencePerHour: 10,
        maxTokensPerDay: 1000,
      },
    });

    // Should allow within quota
    expect(sandbox.checkQuota({ inference: 1, tokens: 100 })).toBe(true);

    // Consume resources
    sandbox.consumeResources({ inference: 5, tokens: 500 });

    // Should still allow
    expect(sandbox.checkQuota({ inference: 5, tokens: 500 })).toBe(true);

    // Consume more
    sandbox.consumeResources({ inference: 5, tokens: 500 });

    // Should deny - exceeded
    expect(sandbox.checkQuota({ inference: 1, tokens: 1 })).toBe(false);
  });

  it("should destroy a sandbox", async () => {
    const sandbox = await manager.create({
      name: "test-sandbox",
      isolationLevel: IsolationLevel.L1,
      capabilities: ["file_read"],
      quota: DEFAULT_QUOTA,
    });

    await manager.destroy(sandbox.id);

    const found = await manager.get(sandbox.id);
    expect(found).toBeUndefined();
  });

  it("should list sandboxes with filter", async () => {
    await manager.create({
      name: "sandbox-1",
      isolationLevel: IsolationLevel.L1,
      capabilities: ["file_read"],
      quota: DEFAULT_QUOTA,
    });

    await manager.create({
      name: "sandbox-2",
      isolationLevel: IsolationLevel.L2,
      capabilities: ["file_read"],
      quota: DEFAULT_QUOTA,
    });

    const all = await manager.list();
    expect(all.length).toBe(2);

    const l1Only = await manager.list({ isolationLevel: IsolationLevel.L1 });
    expect(l1Only.length).toBe(1);
    expect(l1Only[0].name).toBe("sandbox-1");
  });
});