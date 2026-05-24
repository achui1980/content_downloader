import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface HttpDownloadOptions {
  url: string;
  targetPath: string;
  timeoutMs: number;
  retries: number;
  referer: string;
  userAgent: string;
}

export interface HttpDownloadResult {
  attempts: number;
  bytes: number;
  contentType: string | null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function downloadToFile(options: HttpDownloadOptions): Promise<HttpDownloadResult> {
  const maxAttempts = options.retries + 1;
  const tempPath = `${options.targetPath}.part`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mkdir(dirname(options.targetPath), { recursive: true });
      const response = await fetch(options.url, {
        method: "GET",
        headers: {
          "User-Agent": options.userAgent,
          Referer: options.referer
        },
        signal: AbortSignal.timeout(options.timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = Buffer.from(arrayBuffer);
      if (bytes.length === 0) {
        throw new Error("Empty response body");
      }

      await writeFile(tempPath, bytes);
      await rename(tempPath, options.targetPath);

      return {
        attempts: attempt,
        bytes: bytes.length,
        contentType: response.headers.get("content-type")
      };
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      if (attempt >= maxAttempts) {
        throw error;
      }
      await delay(2 ** (attempt - 1) * 1000);
    }
  }

  throw new Error("Unexpected download flow");
}
