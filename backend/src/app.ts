import express from "express";
import path from "node:path";

import { corsMiddleware } from "./config/cors.js";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { createUploadRouter } from "./routes/upload.js";
import { LocalStorageAdapter } from "./storage/local_storage.js";
import { S3StorageAdapter } from "./storage/s3_storage.js";
import type { StorageAdapter } from "./storage/storage_adapter.js";

function createStorageAdapter(): StorageAdapter {
  if (env.storageDriver === "s3") {
    if (!env.s3Bucket || !env.s3Region || !env.s3AccessKeyId || !env.s3SecretAccessKey) {
      throw new Error("S3 storage selected but S3 environment variables are incomplete");
    }

    return new S3StorageAdapter(
      env.s3Bucket,
      env.s3Region,
      env.s3AccessKeyId,
      env.s3SecretAccessKey,
    );
  }

  return new LocalStorageAdapter(env.localUploadDir);
}

const storage = createStorageAdapter();

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(corsMiddleware);

if (env.storageDriver === "local") {
  app.use("/uploads", express.static(path.resolve(env.localUploadDir)));
}

app.use(healthRouter);
app.use(createUploadRouter(storage, env.maxUploadBytes));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({ error: message });
});
