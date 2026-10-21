
import { performance } from "node:perf_hooks";
import { prisma } from "../lib/prisma.js";

const REQUEST_TIMEOUT_MS = 10_000;

export async function checkMonitor(monitorId: string) {
  // 1. Find the monitor.
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

  // 2. Check the website.
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

    await response.body?.cancel();
  } catch (error) {
    responseTimeMs = Math.round(performance.now() - startedAt);

    errorMessage =
      error instanceof Error
        ? error.message
        : "An unknown error occurred.";
  }

  // 3. Save the health-check result.
  const healthCheck = await prisma.healthCheck.create({
    data: {
      monitorId: monitor.id,
      statusCode,
      responseTimeMs,
      isUp,
      errorMessage,
    },
  });

  // 4. Find any unresolved incident for this monitor.
  const openIncident = await prisma.incident.findFirst({
    where: {
      monitorId: monitor.id,
      resolvedAt: null,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  if (!isUp) {
    // 5. Create an incident only if one is not already open.
    if (!openIncident) {
      await prisma.incident.create({
        data: {
          monitorId: monitor.id,
          title: `${monitor.name} is down`,
          description:
            errorMessage ?? "The monitor did not return a successful response.",
        },
      });

      console.log(`[Incident] OPENED: ${monitor.name}`);
    } else {
      console.log(`[Incident] Still open: ${monitor.name}`);
    }
  } else if (openIncident) {
    // 6. Resolve the incident when the monitor recovers.
    await prisma.incident.update({
      where: {
        id: openIncident.id,
      },
      data: {
        resolvedAt: new Date(),
      },
    });

    console.log(`[Incident] RESOLVED: ${monitor.name}`);
  }

  // 7. Return the health-check result.
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
