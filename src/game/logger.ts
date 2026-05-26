type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const maxEntries = 100;
const entries: LogEntry[] = [];
const enabled = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

function write(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    time: new Date().toISOString(),
    level,
    message,
    data,
  };

  entries.push(entry);

  if (entries.length > maxEntries) {
    entries.shift();
  }

  if (!enabled) {
    return;
  }

  if (level === "error") {
    console.error(`[the-in-laws-are-coming] ${message}`, data ?? "");
    return;
  }

  if (level === "warn") {
    console.warn(`[the-in-laws-are-coming] ${message}`, data ?? "");
    return;
  }

  console.info(`[the-in-laws-are-coming] ${message}`, data ?? "");
}

export const logger = {
  info: (message: string, data?: unknown) => write("info", message, data),
  warn: (message: string, data?: unknown) => write("warn", message, data),
  error: (message: string, data?: unknown) => write("error", message, data),
  entries: () => [...entries],
};

export function installGlobalErrorLogging(): void {
  if (typeof window === "undefined") {
    return;
  }

  Object.defineProperty(window, "__SUBURBAN_LOGS__", {
    configurable: true,
    get: () => logger.entries(),
  });

  window.addEventListener("error", (event) => {
    logger.error("runtime error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logger.error("unhandled promise rejection", {
      reason: event.reason instanceof Error ? event.reason.message : event.reason,
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
    });
  });
}
