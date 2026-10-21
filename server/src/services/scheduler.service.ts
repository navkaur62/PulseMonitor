
import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { checkMonitor } from "./health-check.service.js";

let schedulerStarted = false;

export function startMonitorScheduler() {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  console.log("PulseMonitor scheduler started.");

  // Check active monitors every 10 seconds for due checks.
  cron.schedule("*/10 * * * * *", async () => {
    try {
      const monitors = await prisma.monitor.findMany({
        where: { isActive: true },
        select: {
          id: true,
          intervalSec: true,
          healthChecks: {
            orderBy: { checkedAt: "desc" },
            take: 1,
            select: { checkedAt: true },
          },
        },
      });

      const now = Date.now();

      for (const monitor of monitors) {
        const lastCheck = monitor.healthChecks[0]?.checkedAt;
        const isDue =
          !lastCheck ||
          now - lastCheck.getTime() >= monitor.intervalSec * 1000;

        if (!isDue) {
          continue;
        }

        // Do not block checks for other monitors.
        void checkMonitor(monitor.id)
          .then((result) => {
            console.log(
              `[Monitor] ${result.monitorName}: ${
                result.isUp ? "UP" : "DOWN"
              } (${result.responseTimeMs ?? "N/A"} ms)`
            );
          })
          .catch((error) => {
            console.error(
              `[Monitor] Check failed for ${monitor.id}:`,
              error
            );
          });
      }
    } catch (error) {
      console.error("Scheduler tick failed:", error);
    }
  });
}
