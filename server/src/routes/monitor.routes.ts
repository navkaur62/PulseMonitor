
import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// POST /api/monitors — Create a monitor
router.post("/", async (req, res) => {
  try {
    const { name, url, method, intervalSec } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof url !== "string" ||
      !isValidUrl(url)
    ) {
      res.status(400).json({
        success: false,
        message: "A non-empty name and valid HTTP/HTTPS URL are required.",
      });
      return;
    }

    const selectedMethod =
      typeof method === "string" ? method.toUpperCase() : "GET";

    if (!allowedMethods.includes(selectedMethod)) {
      res.status(400).json({
        success: false,
        message: "Unsupported HTTP method.",
      });
      return;
    }

    const selectedInterval = intervalSec ?? 60;

    if (
      !Number.isInteger(selectedInterval) ||
      selectedInterval < 10 ||
      selectedInterval > 86400
    ) {
      res.status(400).json({
        success: false,
        message: "intervalSec must be an integer between 10 and 86400.",
      });
      return;
    }

    const monitor = await prisma.monitor.create({
      data: {
        name: name.trim(),
        url,
        method: selectedMethod,
        intervalSec: selectedInterval,
      },
    });

    res.status(201).json({
      success: true,
      message: "Monitor created successfully.",
      data: monitor,
    });
  } catch (error) {
    console.error("Create monitor failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create monitor.",
    });
  }
});

// GET /api/monitors — List monitors
router.get("/", async (_req, res) => {
  try {
    const monitors = await prisma.monitor.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      count: monitors.length,
      data: monitors,
    });
  } catch (error) {
    console.error("List monitors failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monitors.",
    });
  }
});

// GET /api/monitors/:id — Get one monitor
router.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);

    const monitor = await prisma.monitor.findUnique({
      where: { id },
      include: {
        healthChecks: {
          orderBy: { checkedAt: "desc" },
          take: 10,
        },
        incidents: {
          orderBy: { startedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!monitor) {
      res.status(404).json({
        success: false,
        message: "Monitor not found.",
      });
      return;
    }

    res.status(200).json({ success: true, data: monitor });
  } catch (error) {
    console.error("Get monitor failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monitor.",
    });
  }
});

// PATCH /api/monitors/:id — Update monitor settings
router.patch("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { name, url, method, intervalSec, isActive } = req.body;
    const data: {
      name?: string;
      url?: string;
      method?: string;
      intervalSec?: number;
      isActive?: boolean;
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({
          success: false,
          message: "name must be a non-empty string.",
        });
        return;
      }
      data.name = name.trim();
    }

    if (url !== undefined) {
      if (typeof url !== "string" || !isValidUrl(url)) {
        res.status(400).json({
          success: false,
          message: "url must be a valid HTTP/HTTPS URL.",
        });
        return;
      }
      data.url = url;
    }

    if (method !== undefined) {
      if (
        typeof method !== "string" ||
        !allowedMethods.includes(method.toUpperCase())
      ) {
        res.status(400).json({
          success: false,
          message: "Unsupported HTTP method.",
        });
        return;
      }
      data.method = method.toUpperCase();
    }

    if (intervalSec !== undefined) {
      if (
        !Number.isInteger(intervalSec) ||
        intervalSec < 10 ||
        intervalSec > 86400
      ) {
        res.status(400).json({
          success: false,
          message: "intervalSec must be an integer between 10 and 86400.",
        });
        return;
      }
      data.intervalSec = intervalSec;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        res.status(400).json({
          success: false,
          message: "isActive must be true or false.",
        });
        return;
      }
      data.isActive = isActive;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update.",
      });
      return;
    }

    const existing = await prisma.monitor.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Monitor not found.",
      });
      return;
    }

    const monitor = await prisma.monitor.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      message: "Monitor updated successfully.",
      data: monitor,
    });
  } catch (error) {
    console.error("Update monitor failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update monitor.",
    });
  }
});

// DELETE /api/monitors/:id — Delete a monitor
router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.monitor.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Monitor not found.",
      });
      return;
    }

    await prisma.monitor.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: "Monitor deleted successfully.",
    });
  } catch (error) {
    console.error("Delete monitor failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete monitor.",
    });
  }
});

export default router;
