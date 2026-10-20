
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "PulseMonitor API is running!",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`PulseMonitor API running at http://localhost:${PORT}`);
});
