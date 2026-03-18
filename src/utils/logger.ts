/**
 * Logger - Logging utility
 */

type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  private level: LogLevel = "info";

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level === "debug") {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level !== "error" && this.level !== "warn") {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level !== "error") {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

export const logger = new Logger();