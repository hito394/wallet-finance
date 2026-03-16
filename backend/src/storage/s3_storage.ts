import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { StorageAdapter } from "./storage_adapter.js";

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async saveFile(params: {
    buffer: Buffer;
    contentType: string;
    fileName: string;
  }): Promise<{ key: string; url: string }> {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}-${params.fileName}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );

    return {
      key,
      url: `https://${this.bucket}.s3.amazonaws.com/${key}`,
    };
  }
}
