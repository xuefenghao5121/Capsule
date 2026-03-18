/**
 * Session Key - Session identification and routing
 */

import { SandboxId, SessionType } from "../types/sandbox.js";

/**
 * Session Key Pattern: sbx:<sandboxId>:<type>:<identifier>
 */
const SESSION_KEY_PATTERN = /^sbx:([^:]+):([^:]+):(.+)$/;

/**
 * Session Key Components
 */
export interface SessionKeyComponents {
  sandboxId: SandboxId;
  type: SessionType;
  identifier: string;
}

/**
 * Parse a session key
 */
export function parseSessionKey(key: string): SessionKeyComponents {
  const match = key.match(SESSION_KEY_PATTERN);
  if (!match) {
    throw new Error(`Invalid session key: ${key}`);
  }

  return {
    sandboxId: match[1],
    type: match[2] as SessionType,
    identifier: match[3],
  };
}

/**
 * Build a session key
 */
export function buildSessionKey(components: SessionKeyComponents): string {
  return `sbx:${components.sandboxId}:${components.type}:${components.identifier}`;
}

/**
 * Create a DM session key
 */
export function forDM(sandboxId: SandboxId, userId: string): string {
  return buildSessionKey({
    sandboxId,
    type: SessionType.DM,
    identifier: `user:${userId}`,
  });
}

/**
 * Create a group session key
 */
export function forGroup(sandboxId: SandboxId, groupId: string): string {
  return buildSessionKey({
    sandboxId,
    type: SessionType.GROUP,
    identifier: groupId,
  });
}

/**
 * Create a channel session key
 */
export function forChannel(sandboxId: SandboxId, channelId: string): string {
  return buildSessionKey({
    sandboxId,
    type: SessionType.CHANNEL,
    identifier: channelId,
  });
}

/**
 * Create a task session key
 */
export function forTask(sandboxId: SandboxId, taskId: string): string {
  return buildSessionKey({
    sandboxId,
    type: SessionType.TASK,
    identifier: taskId,
  });
}

/**
 * Create a cron session key
 */
export function forCron(sandboxId: SandboxId, jobId: string): string {
  return buildSessionKey({
    sandboxId,
    type: SessionType.CRON,
    identifier: jobId,
  });
}

/**
 * Check if a string is a valid session key
 */
export function isValidSessionKey(key: string): boolean {
  return SESSION_KEY_PATTERN.test(key);
}