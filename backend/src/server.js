import express from "express";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { env } from "./config/env.js";
import { checkDatabaseConnection, pool } from "./config/db.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    const databaseConnected = await checkDatabaseConnection();
    if (!databaseConnected) {
      res.status(503).json({
        status: "degraded",
        api: "running",
        database: "disconnected",
      });
      return;
    }

    res.status(200).json({
      status: "ok",
      api: "running",
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "degraded",
      api: "running",
      database: "disconnected",
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  const server = app.listen(env.port, () => {
    console.log(`Collabrix API listening on port ${env.port}`);
  });

  server.on("error", (error) => {
    const details = error.code ? ` (${error.code})` : "";
    console.error(`Failed to start server on port ${env.port}${details}: ${error.message}`);
    pool.end().finally(() => process.exit(1));
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received; shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export function startServerAndReturn() {
  return startServer();
}

const isDirectExecution =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  startServerAndReturn().catch((error) => {
    console.error("Backend failed to start:", error.message);
    pool.end().finally(() => process.exit(1));
  });
}
