/**
 * Schedule Policy - Scheduling behavior configuration
 */

import { Priority } from "../types/sandbox.js";

/**
 * Schedule Policy
 */
export interface SchedulePolicy {
  name: string;

  // Preemption
  preemptive: boolean;

  // Time slice (0 = no limit)
  timeSliceMs: number;

  // Priority aging
  aging: boolean;
  agingIntervalMs: number;

  // Load balancing
  loadBalancing: boolean;

  // Affinity
  affinity: boolean;
}

/**
 * Default Schedule Policy
 */
export const DEFAULT_POLICY: SchedulePolicy = {
  name: "default",
  preemptive: true,
  timeSliceMs: 0, // No time slice for AI inference
  aging: true,
  agingIntervalMs: 60000,
  loadBalancing: true,
  affinity: true,
};

/**
 * Realtime Policy
 */
export const REALTIME_POLICY: SchedulePolicy = {
  name: "realtime",
  preemptive: true,
  timeSliceMs: 0,
  aging: false,
  agingIntervalMs: 0,
  loadBalancing: false,
  affinity: true,
};

/**
 * Batch Policy
 */
export const BATCH_POLICY: SchedulePolicy = {
  name: "batch",
  preemptive: false,
  timeSliceMs: 0,
  aging: true,
  agingIntervalMs: 300000, // 5 minutes
  loadBalancing: true,
  affinity: false,
};

/**
 * Fair Policy
 */
export const FAIR_POLICY: SchedulePolicy = {
  name: "fair",
  preemptive: true,
  timeSliceMs: 0,
  aging: true,
  agingIntervalMs: 30000,
  loadBalancing: true,
  affinity: false,
};

/**
 * Get policy by name
 */
export function getPolicy(name: string): SchedulePolicy {
  switch (name) {
    case "realtime":
      return REALTIME_POLICY;
    case "batch":
      return BATCH_POLICY;
    case "fair":
      return FAIR_POLICY;
    default:
      return DEFAULT_POLICY;
  }
}