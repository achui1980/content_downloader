import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import pLimit from "p-limit";
import { CheckpointStore } from "../state/checkpoint.js";
import type { ChapterSummary, ImageEntry } from "../types.js";
import { buildImageFileName } from "../utils/pathing.js";
import { downloadToFile } from "./httpDownload.js";

export interface ChapterDownloadOptions {
  chapterTitle: string;
  chapterUrl: string;
  chapterDir: string;
  images: ImageEntry[];
  retries: number;
  timeoutMs: number;
  concurrency: number;
  userAgent: string;
  checkpoint: CheckpointStore;
}

async function fileExistsAndValid(path: string): Promise<boolean> {
  try {
    const file = await stat(path);
    return file.isFile() && file.size > 0;
  } catch {
    return false;
  }
}

export async function downloadChapterImages(options: ChapterDownloadOptions): Promise<ChapterSummary> {
  await mkdir(options.chapterDir, { recursive: true });

  const limit = pLimit(options.concurrency);
  const failures: ChapterSummary["failures"] = [];

  let downloadedCount = 0;
  let skippedCount = 0;

  const padWidth = Math.max(3, String(options.images.length).length);

  await Promise.all(
    options.images.map((image) =>
      limit(async () => {
        const fileName = buildImageFileName(image.index, image.ext, padWidth);
        const targetPath = join(options.chapterDir, fileName);
        const checkpointKey = options.chapterUrl;

        const alreadyDone =
          options.checkpoint.isImageDone(checkpointKey, image.index) || (await fileExistsAndValid(targetPath));

        if (alreadyDone) {
          options.checkpoint.markImageDone(checkpointKey, image.index);
          skippedCount += 1;
          return;
        }

        try {
          await downloadToFile({
            url: image.url,
            targetPath,
            timeoutMs: options.timeoutMs,
            retries: options.retries,
            referer: options.chapterUrl,
            userAgent: options.userAgent
          });

          options.checkpoint.markImageDone(checkpointKey, image.index);
          downloadedCount += 1;
        } catch (error) {
          failures.push({
            index: image.index,
            url: image.url,
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      })
    )
  );

  options.checkpoint.save();

  return {
    chapterTitle: options.chapterTitle,
    chapterUrl: options.chapterUrl,
    chapterDir: options.chapterDir,
    extractedCount: options.images.length,
    downloadedCount,
    skippedCount,
    failedCount: failures.length,
    failures
  };
}
