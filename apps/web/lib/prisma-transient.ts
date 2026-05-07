type PrismaErrorLike = {
  code?: unknown;
  message?: unknown;
};

const transientPrismaErrorCodes = new Set(["P1001", "P1002", "P1017"]);

export function isTransientPrismaConnectionError(error: unknown) {
  const candidate = (typeof error === "object" && error ? error as PrismaErrorLike : null);
  const code = typeof candidate?.code === "string" ? candidate.code : null;
  const message = error instanceof Error ? error.message : typeof candidate?.message === "string" ? candidate.message : "";

  return Boolean(
    (code && transientPrismaErrorCodes.has(code))
      || /Can't reach database server|Server has closed the connection|Connection.*closed|Timed out/i.test(message),
  );
}

export async function withTransientDatabaseFallback<T>(
  operation: () => Promise<T>,
  fallback: T,
  options?: { retries?: number; onFallback?: () => void },
) {
  const retries = options?.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientPrismaConnectionError(error)) {
        throw error;
      }

      if (attempt === retries) {
        options?.onFallback?.();
        return fallback;
      }
    }
  }

  throw lastError;
}