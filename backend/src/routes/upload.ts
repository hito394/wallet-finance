import { Router } from "express";
import multer from "multer";

import type { StorageAdapter } from "../storage/storage_adapter.js";

export function createUploadRouter(storage: StorageAdapter, maxUploadBytes: number) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxUploadBytes },
  });

  router.post("/upload", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "file is required" });
        return;
      }

      const uploaded = await storage.saveFile({
        buffer: req.file.buffer,
        contentType: req.file.mimetype || "application/octet-stream",
        fileName: req.file.originalname,
      });

      res.status(201).json({
        key: uploaded.key,
        url: uploaded.url,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
