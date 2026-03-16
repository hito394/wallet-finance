export interface StorageAdapter {
  saveFile(params: {
    buffer: Buffer;
    contentType: string;
    fileName: string;
  }): Promise<{ key: string; url: string }>;
}
