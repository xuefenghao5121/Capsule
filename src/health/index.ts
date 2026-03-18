/**
 * Health Check - System health monitoring
 */

import { SandboxId } from "../types/sandbox.js";

/**
 * Health Status
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Component Health
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  lastCheck: Date;
  metrics?: Record<string, number>;
}

/**
 * System Health
 */
export interface SystemHealth {
  status: HealthStatus;
  components: ComponentHealth[];
  uptime: number;
  version: string;
}

/**
 * Health Check Configuration
 */
export interface HealthCheckConfig {
  intervalMs: number;
  timeoutMs: number;
  thresholds: {
    cpuPercent: number;
    memoryPercent: number;
    errorRate: number;
    responseTimeMs: number;
  };
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  intervalMs: 30000,
  timeoutMs: 5000,
  thresholds: {
    cpuPercent: 80,
    memoryPercent: 80,
    errorRate: 0.05,
    responseTimeMs: 1000,
  },
};

/**
 * Health Checker
 * 
 * Monitors system health and reports status
 */
export class HealthChecker {
  private config: HealthCheckConfig;
  private startTime: Date;
  private components: Map<string, ComponentHealth> = new Map();
  private checkInterval?: ReturnType<typeof setInterval>;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = new Date();
  }

  /**
   * Start health checks
   */
  start(): void {
    this.checkInterval = setInterval(() => {
      this.runChecks();
    }, this.config.intervalMs);

    // Run initial check
    this.runChecks();
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Register a component for health monitoring
   */
  registerComponent(name: string, checkFn: () => Promise<ComponentHealth>): void {
    this.components.set(name, {
      name,
      status: "healthy",
      lastCheck: new Date(),
    });

    // Store check function
    (this.components.get(name) as any).checkFn = checkFn;
  }

  /**
   * Get current system health
   */
  getHealth(): SystemHealth {
    const components = Array.from(this.components.values());
    const overallStatus = this.calculateOverallStatus(components);

    return {
      status: overallStatus,
      components,
      uptime: Date.now() - this.startTime.getTime(),
      version: "0.1.0",
    };
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    const health = this.getHealth();
    return health.status === "healthy";
  }

  /**
   * Run all health checks
   */
  private async runChecks(): Promise<void> {
    // Check memory
    await this.checkMemory();

    // Check registered components
    for (const [name, component] of this.components) {
      const checkFn = (component as any).checkFn;
      if (checkFn) {
        try {
          const result = await Promise.race([
            checkFn(),
            this.timeout(this.config.timeoutMs),
          ]);
          this.components.set(name, result);
        } catch (error) {
          this.components.set(name, {
            name,
            status: "unhealthy",
            message: error instanceof Error ? error.message : "Check failed",
            lastCheck: new Date(),
          });
        }
      }
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<void> {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    let status: HealthStatus = "healthy";
    let message: string | undefined;

    if (heapUsedPercent > this.config.thresholds.memoryPercent) {
      status = "unhealthy";
      message = `Memory usage ${heapUsedPercent.toFixed(1)}% exceeds threshold ${this.config.thresholds.memoryPercent}%`;
    } else if (heapUsedPercent > this.config.thresholds.memoryPercent * 0.8) {
      status = "degraded";
      message = `Memory usage ${heapUsedPercent.toFixed(1)}% approaching threshold`;
    }

    this.components.set("memory", {
      name: "memory",
      status,
      message,
      lastCheck: new Date(),
      metrics: {
        heapUsedMB: memUsage.heapUsed / (1024 * 1024),
        heapTotalMB: memUsage.heapTotal / (1024 * 1024),
        heapUsedPercent,
      },
    });
  }

  /**
   * Calculate overall status
   */
  private calculateOverallStatus(components: ComponentHealth[]): HealthStatus {
    if (components.some((c) => c.status === "unhealthy")) {
      return "unhealthy";
    }
    if (components.some((c) => c.status === "degraded")) {
      return "degraded";
    }
    return "healthy";
  }

  /**
   * Timeout helper
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Health check timeout")), ms);
    });
  }
}

/**
 * Liveness probe (Kubernetes-style)
 */
export function createLivenessProbe(healthChecker: HealthChecker) {
  return async (): Promise<{ status: number; body: unknown }> => {
    const isHealthy = healthChecker.isHealthy();
    return {
      status: isHealthy ? 200 : 503,
      body: { status: isHealthy ? "ok" : "unhealthy" },
    };
  };
}

/**
 * Readiness probe (Kubernetes-style)
 */
export function createReadinessProbe(
  healthChecker: HealthChecker,
  dependencies: Map<string, () => Promise<boolean>>
) {
  return async (): Promise<{ status: number; body: unknown }> => {
    const results: Record<string, boolean> = {};

    for (const [name, check] of dependencies) {
      try {
        results[name] = await check();
      } catch {
        results[name] = false;
      }
    }

    const allReady = Object.values(results).every((v) => v);

    return {
      status: allReady ? 200 : 503,
      body: {
        status: allReady ? "ready" : "not ready",
        dependencies: results,
      },
    };
  };
}