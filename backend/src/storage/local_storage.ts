import fs from "node:fs/promises";
import path from "node:path";

import type { StorageAdapter } from "./storage_adapter.js";

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly baseDir: string) {}

  async saveFile(params: {
    buffer: Buffer;
    contentType: string;
    fileName: string;
  }): Promise<{ key: string; url: string }> {
    const ext = path.extname(params.fileName) || ".bin";
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const fullPath = path.join(this.baseDir, key);

    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(fullPath, params.buffer);

    return {
      key,
      url: `/uploads/${key}`,
    };
  }
}
