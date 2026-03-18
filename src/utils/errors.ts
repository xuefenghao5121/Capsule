/**
 * Errors - Custom error classes
 */

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AIError";
  }
}

export class ConfigurationError extends AIError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFIGURATION_ERROR", details);
    this.name = "ConfigurationError";
  }
}

export class ResourceError extends AIError {
  constructor(message: string, details?: unknown) {
    super(message, "RESOURCE_ERROR", details);
    this.name = "ResourceError";
  }
}

export class TimeoutError extends AIError {
  constructor(message: string, details?: unknown) {
    super(message, "TIMEOUT_ERROR", details);
    this.name = "TimeoutError";
  }
}