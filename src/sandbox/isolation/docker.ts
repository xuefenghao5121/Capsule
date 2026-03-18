/**
 * Docker Isolator - L2 hard isolation implementation
 * 
 * Provides container-based isolation for untrusted agents
 */

import { spawn, ChildProcess } from "child_process";
import { Sandbox } from "../sandbox.js";
import { SandboxId, SandboxStatus } from "../../types/sandbox.js";

/**
 * Docker Isolator Configuration
 */
export interface DockerIsolatorConfig {
  image: string;
  network?: string;
  cpuLimit?: number;
  memoryLimitMB?: number;
  timeout?: number;
}

const DEFAULT_CONFIG: DockerIsolatorConfig = {
  image: "node:22-slim",
  network: "none",
  timeout: 60000,
};

/**
 * Docker Isolator
 * 
 * Implements L2 (hard) isolation using Docker containers
 */
export class DockerIsolator {
  private containers: Map<SandboxId, string> = new Map();
  private processes: Map<SandboxId, ChildProcess> = new Map();
  private config: DockerIsolatorConfig;

  constructor(config: Partial<DockerIsolatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if Docker is available
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("docker", ["--version"]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  /**
   * Isolate a sandbox in a Docker container
   */
  async isolate(sandbox: Sandbox): Promise<string> {
    if (this.containers.has(sandbox.id)) {
      throw new Error(`Sandbox ${sandbox.id} is already isolated`);
    }

    // Build docker run command
    const args = this.buildDockerArgs(sandbox);

    return new Promise((resolve, reject) => {
      const proc = spawn("docker", args);
      let containerId = "";
      let stderr = "";

      proc.stdout?.on("data", (data: Buffer) => {
        const output = data.toString().trim();
        if (!containerId && output.length === 64) {
          containerId = output;
        }
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0 && containerId) {
          this.containers.set(sandbox.id, containerId);
          this.processes.set(sandbox.id, proc);
          resolve(containerId);
        } else {
          reject(new Error(`Docker run failed: ${stderr}`));
        }
      });

      proc.on("error", (error) => {
        reject(new Error(`Docker error: ${error.message}`));
      });
    });
  }

  /**
   * Release a sandbox's isolation (stop and remove container)
   */
  async release(sandbox: Sandbox): Promise<void> {
    const containerId = this.containers.get(sandbox.id);
    if (!containerId) return;

    // Stop container
    await this.execDocker(["stop", containerId]);

    // Remove container
    await this.execDocker(["rm", containerId]);

    this.containers.delete(sandbox.id);
    this.processes.delete(sandbox.id);
  }

  /**
   * Execute a command in the container
   */
  async exec(
    sandbox: Sandbox,
    command: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const containerId = this.containers.get(sandbox.id);
    if (!containerId) {
      throw new Error(`Sandbox ${sandbox.id} is not isolated`);
    }

    return this.execDocker(["exec", containerId, ...command]);
  }

  /**
   * Get container info
   */
  async getInfo(sandbox: Sandbox): Promise<Record<string, unknown> | null> {
    const containerId = this.containers.get(sandbox.id);
    if (!containerId) return null;

    const { stdout } = await this.execDocker([
      "inspect",
      "--format",
      "{{json .}}",
      containerId,
    ]);

    try {
      return JSON.parse(stdout);
    } catch {
      return null;
    }
  }

  /**
   * Get container stats
   */
  async getStats(sandbox: Sandbox): Promise<{
    cpuPercent: number;
    memoryMB: number;
    networkBytes: number;
  } | null> {
    const containerId = this.containers.get(sandbox.id);
    if (!containerId) return null;

    const { stdout } = await this.execDocker([
      "stats",
      "--no-stream",
      "--format",
      "{{.CPUPerc}},{{.MemUsage}},{{.NetIO}}",
      containerId,
    ]);

    // Parse output: "0.50%,100MiB / 512MiB,1kB / 2kB"
    const parts = stdout.trim().split(",");
    if (parts.length >= 2) {
      return {
        cpuPercent: parseFloat(parts[0].replace("%", "")) || 0,
        memoryMB: this.parseMemory(parts[1].split("/")[0].trim()),
        networkBytes: this.parseNetwork(parts[2]?.trim() || "0B"),
      };
    }

    return null;
  }

  /**
   * Pause container
   */
  async pause(sandbox: Sandbox): Promise<void> {
    const containerId = this.containers.get(sandbox.id);
    if (!containerId) return;

    await this.execDocker(["pause", containerId]);
  }

  /**
   * Unpause container
   */
  async unpause(sandbox: Sandbox): Promise<void> {
    const containerId = this.containers.get(sandbox.id);
    if (!containerId) return;

    await this.execDocker(["unpause", containerId]);
  }

  /**
   * Check if container is running
   */
  async isRunning(sandbox: Sandbox): Promise<boolean> {
    const containerId = this.containers.get(sandbox.id);
    if (!containerId) return false;

    const { stdout } = await this.execDocker([
      "inspect",
      "--format",
      "{{.State.Running}}",
      containerId,
    ]);

    return stdout.trim() === "true";
  }

  // ========== Private Methods ==========

  private buildDockerArgs(sandbox: Sandbox): string[] {
    const args = ["run", "--detach"];

    // Network isolation
    args.push("--network", this.config.network || "none");

    // CPU limit
    if (sandbox.quota.maxCpuPercent) {
      const cpuQuota = Math.floor((sandbox.quota.maxCpuPercent / 100) * 100000);
      args.push("--cpu-quota", cpuQuota.toString());
      args.push("--cpu-period", "100000");
    }

    // Memory limit
    if (sandbox.quota.maxMemoryMB) {
      args.push("--memory", `${sandbox.quota.maxMemoryMB}m`);
    }

    // Workspace mount
    args.push("--volume", `${sandbox.workspace.path}:/workspace`);
    args.push("--workdir", "/workspace");

    // Environment variables
    args.push("--env", `SANDBOX_ID=${sandbox.id}`);

    // Security options
    args.push("--security-opt", "no-new-privileges");
    args.push("--cap-drop", "ALL");

    // Read-only root filesystem (optional, for extra security)
    // args.push("--read-only");

    // Image
    args.push(this.config.image);

    // Default command (sleep to keep container running)
    args.push("sleep", "infinity");

    return args;
  }

  private async execDocker(args: string[]): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve, reject) => {
      const proc = spawn("docker", args);
      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      });

      proc.on("error", (error) => {
        reject(new Error(`Docker error: ${error.message}`));
      });
    });
  }

  private parseMemory(str: string): number {
    const match = str.match(/^([\d.]+)(KiB|MiB|GiB)?$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = (match[2] || "MiB").toLowerCase();

    switch (unit) {
      case "kib":
        return value / 1024;
      case "gib":
        return value * 1024;
      default:
        return value;
    }
  }

  private parseNetwork(str: string): number {
    const match = str.match(/^([\d.]+)(kB|MB|GB)?$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = (match[2] || "B").toLowerCase();

    switch (unit) {
      case "kb":
        return value * 1000;
      case "mb":
        return value * 1000000;
      case "gb":
        return value * 1000000000;
      default:
        return value;
    }
  }
}