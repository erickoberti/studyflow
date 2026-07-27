type ErrorContext = Record<string, string | number | boolean | null | undefined>;

export function reportApplicationError(scope: string, error: unknown, context: ErrorContext = {}) {
  const value = error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError", message: String(error) };
  console.error(JSON.stringify({ level: "error", scope, ...value, context, timestamp: new Date().toISOString() }));
}
