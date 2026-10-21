
import { performance } from "node:perf_hooks";
import { prisma } from "../lib/prisma.js";

const REQUEST_TIMEOUT_MS = 10_000;

export async function checkMonitor(monitorId: string) {
  // Find the monitor in PostgreSQL.
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
  });

  if (!monitor) {
    throw new Error("Monitor not found.");
  }

  const startedAt = performance.now();

  let statusCode: number | null = null;
  let responseTimeMs: number | null = null;
  let isUp = false;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(monitor.url, {
      method: monitor.method,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    responseTimeMs = Math.round(performance.now() - startedAt);
    statusCode = response.status;
    isUp = response.ok;

    if (!response.ok) {
      errorMessage = `HTTP error: ${response.status}`;
    }

    // Release the response body without downloading it all.
    await response.body?.cancel();
  } catch (error) {
    responseTimeMs = Math.round(performance.now() - startedAt);

    errorMessage =
      error instanceof Error
        ? error.message
        : "An unknown error occurred.";
  }

  // Save this check in PostgreSQL.
  const healthCheck = await prisma.healthCheck.create({
    data: {
      monitorId: monitor.id,
      statusCode,
      responseTimeMs,
      isUp,
      errorMessage,
    },
  });

  return {
    monitorId: monitor.id,
    monitorName: monitor.name,
    url: monitor.url,
    isUp,
    statusCode,
    responseTimeMs,
    errorMessage,
    checkedAt: healthCheck.checkedAt,
  };
}
