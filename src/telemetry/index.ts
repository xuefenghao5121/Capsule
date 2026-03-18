/**
 * Telemetry - Monitoring and tracing
 */

import { SandboxId } from "../../types/sandbox.js";
import { TaskId } from "../../types/task.js";

/**
 * Metric Types
 */
export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
}

/**
 * Span for distributed tracing
 */
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: Date;
  endTime?: Date;
  tags: Record<string, string>;
  logs: LogEntry[];
}

/**
 * Log Entry
 */
export interface LogEntry {
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  fields?: Record<string, unknown>;
}

/**
 * Telemetry Configuration
 */
export interface TelemetryConfig {
  enabled: boolean;
  sampleRate: number;
  exportEndpoint?: string;
}

const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: true,
  sampleRate: 1.0,
};

/**
 * Telemetry Manager
 * 
 * Collects metrics, traces, and logs for observability
 */
export class TelemetryManager {
  private config: TelemetryConfig;
  private metrics: Metric[] = [];
  private spans: Map<string, Span> = new Map();
  private logs: LogEntry[] = [];

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========== Metrics ==========

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {}
  ): void {
    if (!this.config.enabled) return;

    // Apply sampling
    if (Math.random() > this.config.sampleRate) return;

    this.metrics.push({
      name,
      value,
      timestamp: new Date(),
      tags,
    });

    // Keep only last 10000 metrics
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, tags: Record<string, string> = {}): void {
    const current = this.metrics.filter(
      (m) => m.name === name && this.matchTags(m.tags, tags)
    ).length;

    this.recordMetric(name, current + 1, tags);
  }

  /**
   * Record a gauge
   */
  recordGauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric(name, value, tags);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric(name, value, tags);
  }

  /**
   * Get metrics
   */
  getMetrics(filter?: { name?: string; tags?: Record<string, string> }): Metric[] {
    let result = this.metrics;

    if (filter?.name) {
      result = result.filter((m) => m.name === filter.name);
    }

    if (filter?.tags) {
      result = result.filter((m) => this.matchTags(m.tags, filter.tags!));
    }

    return result;
  }

  // ========== Tracing ==========

  /**
   * Start a new span
   */
  startSpan(
    operation: string,
    parentSpanId?: string,
    tags: Record<string, string> = {}
  ): Span {
    const traceId = this.generateId("trace");
    const spanId = this.generateId("span");

    const span: Span = {
      traceId,
      spanId,
      parentSpanId,
      operation,
      startTime: new Date(),
      tags,
      logs: [],
    };

    this.spans.set(spanId, span);
    return span;
  }

  /**
   * End a span
   */
  endSpan(spanId: string): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = new Date();
    }
  }

  /**
   * Add log to span
   */
  logToSpan(
    spanId: string,
    level: LogEntry["level"],
    message: string,
    fields?: Record<string, unknown>
  ): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: new Date(),
        level,
        message,
        fields,
      });
    }
  }

  /**
   * Get span
   */
  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get all spans
   */
  getSpans(): Span[] {
    return Array.from(this.spans.values());
  }

  // ========== Logging ==========

  /**
   * Log a message
   */
  log(
    level: LogEntry["level"],
    message: string,
    fields?: Record<string, unknown>
  ): void {
    if (!this.config.enabled) return;

    this.logs.push({
      timestamp: new Date(),
      level,
      message,
      fields,
    });

    // Keep only last 10000 logs
    if (this.logs.length > 10000) {
      this.logs = this.logs.slice(-10000);
    }
  }

  /**
   * Get logs
   */
  getLogs(filter?: { level?: LogEntry["level"]; since?: Date }): LogEntry[] {
    let result = this.logs;

    if (filter?.level) {
      result = result.filter((l) => l.level === filter.level);
    }

    if (filter?.since) {
      result = result.filter((l) => l.timestamp >= filter.since!);
    }

    return result;
  }

  // ========== Sandbox Telemetry ==========

  /**
   * Record sandbox metrics
   */
  recordSandboxMetrics(
    sandboxId: SandboxId,
    metrics: {
      inferences?: number;
      tokens?: number;
      cpuPercent?: number;
      memoryMB?: number;
      errorCount?: number;
    }
  ): void {
    const tags = { sandboxId };

    if (metrics.inferences !== undefined) {
      this.recordGauge("sandbox.inferences", metrics.inferences, tags);
    }
    if (metrics.tokens !== undefined) {
      this.recordGauge("sandbox.tokens", metrics.tokens, tags);
    }
    if (metrics.cpuPercent !== undefined) {
      this.recordGauge("sandbox.cpu_percent", metrics.cpuPercent, tags);
    }
    if (metrics.memoryMB !== undefined) {
      this.recordGauge("sandbox.memory_mb", metrics.memoryMB, tags);
    }
    if (metrics.errorCount !== undefined) {
      this.recordGauge("sandbox.error_count", metrics.errorCount, tags);
    }
  }

  /**
   * Record task metrics
   */
  recordTaskMetrics(
    taskId: TaskId,
    metrics: {
      latencyMs?: number;
      tokensUsed?: number;
      toolCalls?: number;
    }
  ): void {
    const tags = { taskId };

    if (metrics.latencyMs !== undefined) {
      this.recordHistogram("task.latency_ms", metrics.latencyMs, tags);
    }
    if (metrics.tokensUsed !== undefined) {
      this.recordHistogram("task.tokens", metrics.tokensUsed, tags);
    }
    if (metrics.toolCalls !== undefined) {
      this.recordHistogram("task.tool_calls", metrics.toolCalls, tags);
    }
  }

  // ========== Export ==========

  /**
   * Export all telemetry data
   */
  export(): {
    metrics: Metric[];
    spans: Span[];
    logs: LogEntry[];
  } {
    return {
      metrics: this.metrics,
      spans: this.getSpans(),
      logs: this.logs,
    };
  }

  /**
   * Clear all telemetry data
   */
  clear(): void {
    this.metrics = [];
    this.spans.clear();
    this.logs = [];
  }

  // ========== Private ==========

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private matchTags(
    actual: Record<string, string>,
    expected: Record<string, string>
  ): boolean {
    for (const [key, value] of Object.entries(expected)) {
      if (actual[key] !== value) return false;
    }
    return true;
  }
}