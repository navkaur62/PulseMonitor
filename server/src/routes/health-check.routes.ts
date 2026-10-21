
import { Router } from "express";
import { checkMonitor } from "../services/health-check.service.js";

const router = Router();

// POST /api/health-checks/:monitorId
router.post("/:monitorId", async (req, res) => {
  try {
    const monitorId = String(req.params.monitorId);
    const result = await checkMonitor(monitorId);

    res.status(201).json({
      success: true,
      message: "Health check completed successfully.",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Monitor not found.") {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Health check failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to complete health check.",
    });
  }
});

export default router;
