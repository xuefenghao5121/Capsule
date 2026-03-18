/**
 * Process Isolator - L1 isolation implementation
 * 
 * Provides process-level isolation using child processes
 */

import { spawn, ChildProcess } from "child_process";
import { Sandbox } from "../sandbox.js";
import { SandboxId, SandboxStatus } from "../types/sandbox.js";

/**
 * Isolator Interface
 */
export interface Isolator {
  isolate(sandbox: Sandbox): Promise<void>;
  release(sandbox: Sandbox): Promise<void>;
  send(sandboxId: SandboxId, message: unknown): Promise<void>;
}

/**
 * Process Isolator Configuration
 */
export interface ProcessIsolatorConfig {
  workerPath: string;
  cpuLimit?: number;
  memoryLimitMB?: number;
}

/**
 * Process Isolator
 */
export class ProcessIsolator implements Isolator {
  private processes: Map<SandboxId, ChildProcess> = new Map();
  private messageHandlers: Map<SandboxId, (msg: unknown) => void> = new Map();

  constructor(private readonly config: ProcessIsolatorConfig) {}

  /**
   * Isolate a sandbox in a child process
   */
  async isolate(sandbox: Sandbox): Promise<void> {
    if (this.processes.has(sandbox.id)) {
      throw new Error(`Sandbox ${sandbox.id} is already isolated`);
    }

    // Create child process
    const child = spawn(process.execPath, [
      "--require",
      "source-map-support/register",
      this.config.workerPath,
      sandbox.id,
    ], {
      cwd: sandbox.workspace.path,
      env: {
        ...process.env,
        SANDBOX_ID: sandbox.id,
        SANDBOX_WORKSPACE: sandbox.workspace.path,
        NODE_OPTIONS: "--max-old-space-size=" + (sandbox.quota.maxMemoryMB || 512),
      },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      detached: false,
    });

    // Handle stdout
    child.stdout?.on("data", (data: Buffer) => {
      console.log(`[${sandbox.id}] stdout:`, data.toString());
    });

    // Handle stderr
    child.stderr?.on("data", (data: Buffer) => {
      console.error(`[${sandbox.id}] stderr:`, data.toString());
    });

    // Handle exit
    child.on("exit", (code, signal) => {
      this.handleExit(sandbox.id, code, signal);
    });

    // Handle error
    child.on("error", (error) => {
      console.error(`[${sandbox.id}] process error:`, error);
      this.processes.delete(sandbox.id);
    });

    // Handle IPC messages
    child.on("message", (message: unknown) => {
      const handler = this.messageHandlers.get(sandbox.id);
      if (handler) {
        handler(message);
      }
    });

    // Set resource limits (Unix only)
    if (this.config.cpuLimit) {
      this.setCpuLimit(child.pid, this.config.cpuLimit);
    }

    // Store process
    this.processes.set(sandbox.id, child);
  }

  /**
   * Release a sandbox's isolation
   */
  async release(sandbox: Sandbox): Promise<void> {
    const child = this.processes.get(sandbox.id);
    if (!child) return;

    // Send SIGTERM
    child.kill("SIGTERM");

    // Wait for exit (with timeout)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5000);

      child.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.processes.delete(sandbox.id);
    this.messageHandlers.delete(sandbox.id);
  }

  /**
   * Send a message to a sandbox
   */
  async send(sandboxId: SandboxId, message: unknown): Promise<void> {
    const child = this.processes.get(sandboxId);
    if (!child) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    if (!child.send) {
      throw new Error(`Sandbox ${sandboxId} does not support IPC`);
    }

    await new Promise<void>((resolve, reject) => {
      child.send!(message, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Register a message handler
   */
  onMessage(sandboxId: SandboxId, handler: (msg: unknown) => void): void {
    this.messageHandlers.set(sandboxId, handler);
  }

  /**
   * Get process info
   */
  getProcessInfo(sandboxId: SandboxId): { pid: number; running: boolean } | undefined {
    const child = this.processes.get(sandboxId);
    if (!child) return undefined;

    return {
      pid: child.pid ?? -1,
      running: !child.killed,
    };
  }

  // ========== Private Methods ==========

  private handleExit(sandboxId: SandboxId, code: number | null, signal: string | null): void {
    console.log(`[${sandboxId}] process exited: code=${code}, signal=${signal}`);
    this.processes.delete(sandboxId);
    this.messageHandlers.delete(sandboxId);
  }

  private setCpuLimit(pid: number | undefined, limit: number): void {
    // In production, would use cgroups or setrlimit
    // For now, this is a no-op
    console.log(`Setting CPU limit ${limit}% for PID ${pid}`);
  }

  private setMemoryLimit(pid: number | undefined, limitMB: number): void {
    // In production, would use cgroups
    console.log(`Setting memory limit ${limitMB}MB for PID ${pid}`);
  }
}

/**
 * Worker script template
 * This would be a separate file in production
 */
export const WORKER_SCRIPT = `
const { parentPort } = require('worker_threads');

parentPort.on('message', (msg) => {
  // Handle messages from parent
  console.log('Worker received:', msg);
  
  // Send response
  parentPort.postMessage({ type: 'ack', id: msg.id });
});
`;