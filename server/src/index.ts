import { config } from "dotenv";
config();

import http from "node:http";
import cluster from "node:cluster";
import os from "node:os";
import express from "express";
import cors from "cors";
import mainRestRouter from "./internal/rest/index.js";

import { toNodeHandler } from "better-auth/node";
import { checkEnvVars } from "./utils/initUtils.js";
import { client, db } from "./db/initDrizzle.js";
import { auth } from "./utils/auth.js";
import { generateId } from "./utils/genUtils.js";

checkEnvVars();

const init = async () => {
  const app = express();

  app.use(
    cors({
      origin: ["http://localhost:3000"],
      credentials: true,
      allowedHeaders: [
        "Authorization",
        "Origin",
        "Accept",
        "Content-Type",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Cache-Control",
      ],
    })
  );

  app.all("/api/auth/*splat", toNodeHandler(auth));

  const server = http.createServer(app);

  server.keepAliveTimeout = 120000; // 120 seconds
  server.headersTimeout = 120000; // 120 seconds should >= keepAliveTimeout

  app.use(async (req: any, res: any, next: any) => {
    req.db = db;
    req.id = req.headers["rndr-id"] || generateId("local_req");
    req.timestamp = Date.now();

    next();
  });

  app.use(mainRestRouter);

  const PORT = 8080;

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

if (process.env.NODE_ENV === "development") {
  init();
  registerShutdownHandlers();
} else {
  let numCPUs = os.cpus().length;

  if (cluster.isPrimary) {
    console.log(`Master ${process.pid} is running`);
    console.log("Number of CPUs", numCPUs);

    let numWorkers = 10;

    for (let i = 0; i < numWorkers; ++i) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.error(`WORKER DIED: ${worker.process.pid}`);
      cluster.fork();
    });
  } else {
    init();
    registerShutdownHandlers();
  }
}

function registerShutdownHandlers() {
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
  // Do NOT use process.on("exit", ...) for async cleanup!
}

async function gracefulShutdown() {
  console.log("Shutting down worker, closing DB connections....");
  try {
    await client.end();
    console.log("DB connection closed. Exiting process.");
    process.exit(0);
  } catch (error) {
    console.error("Error closing DB connection:", error);
    process.exit(1);
  }
}

// Close connections gracefully?
const closeConnections = async () => {
  console.log("Closing connections");
  await client.end();
};

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  await closeConnections();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  await closeConnections();
  process.exit(0);
});
