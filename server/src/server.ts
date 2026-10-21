
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma.js";
import monitorRoutes from "./routes/monitor.routes.js";
import healthCheckRoutes from "./routes/health-check.routes.js";
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());
app.use("/api/monitors", monitorRoutes);
app.use("/api/health-checks", healthCheckRoutes);
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "PulseMonitor API is running!",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health/database", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "PostgreSQL connection successful!",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      success: false,
      message: "Database connection failed.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`PulseMonitor API running at http://localhost:${PORT}`);
});