/**
 * Isolation Index
 */

export { ProcessIsolator } from "./process.js";
export { DockerIsolator } from "./docker.js";

import { IsolationLevel } from "../../types/sandbox.js";
import { ProcessIsolator } from "./process.js";
import { DockerIsolator } from "./docker.js";

/**
 * Isolator Interface
 */
export interface Isolator {
  isolate(sandbox: import("../sandbox.js").Sandbox): Promise<void | string>;
  release(sandbox: import("../sandbox.js").Sandbox): Promise<void>;
}

/**
 * Create isolator based on isolation level
 */
export function createIsolator(
  level: IsolationLevel,
  config?: Record<string, unknown>
): Isolator {
  switch (level) {
    case IsolationLevel.L0:
      // No isolation
      return new NoOpIsolator();
    case IsolationLevel.L1:
      // Process-level isolation
      return new ProcessIsolator(config as any);
    case IsolationLevel.L2:
      // Docker container isolation
      return new DockerIsolator(config as any);
    default:
      throw new Error(`Unknown isolation level: ${level}`);
  }
}

/**
 * No-op isolator for L0 (trusted agents)
 */
class NoOpIsolator implements Isolator {
  async isolate(): Promise<void> {
    // No isolation
  }

  async release(): Promise<void> {
    // No cleanup needed
  }
}