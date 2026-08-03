// Structured server logs.
//
// Rule: a log line may contain WHAT happened and WHICH code path, never WHO or
// WHAT THEY LIFT. Performance inputs, display names, free text, IP addresses,
// keys, and provider error bodies are all forbidden — so an allowlist of
// primitive fields is enforced here rather than trusted at each call site.

type LogLevel = "info" | "warn" | "error";

const ALLOWED_FIELDS = new Set([
  "route",
  "event",
  "code",
  "field",
  "status",
  "durationMs",
  "scoreVersion",
  "datasetVersionId",
  "datasetSampleSize",
  "datasetConfidence",
  "moderationStatus",
  "visibility",
  "idempotentReplay",
  "eligible",
  "bucket",
  "reason",
]);

export type LogFields = Record<string, string | number | boolean | undefined>;

function sanitize(fields: LogFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(key) || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

function emit(level: LogLevel, message: string, fields: LogFields) {
  const line = JSON.stringify({
    level,
    msg: message,
    ...sanitize(fields),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(message: string, fields: LogFields = {}) {
  emit("info", message, fields);
}

export function logWarn(message: string, fields: LogFields = {}) {
  emit("warn", message, fields);
}

export function logError(message: string, fields: LogFields = {}) {
  emit("error", message, fields);
}
