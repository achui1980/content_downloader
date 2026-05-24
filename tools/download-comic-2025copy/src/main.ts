import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { createCheckpointStore } from "./state/checkpoint.js";
import { downloadChapterImages } from "./download/chapterDownloader.js";
import { discoverChapters } from "./site2025copy/discoverChapters.js";
import { extractChapterImages } from "./site2025copy/extractChapterImages.js";
import type { DownloaderConfig, RunSummary } from "./types.js";
import { sanitizePathSegment, getComicSlugFromUrl } from "./utils/pathing.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runDiscoverOnly(config: DownloaderConfig): Promise<void> {
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ userAgent: config.userAgent });
  const page = await context.newPage();

  try {
    const chapters = await discoverChapters(page, config.url);
    console.log(`Discovered chapters: ${chapters.length}`);
    for (const chapter of chapters) {
      console.log(`${chapter.order}. ${chapter.title} -> ${chapter.url}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function runDownloader(config: DownloaderConfig): Promise<RunSummary> {
  const comicSlug = getComicSlugFromUrl(config.url);
  const outputRoot = join(config.outputDir, comicSlug);
  const checkpointFile = join(outputRoot, ".download-checkpoint.json");
  const checkpoint = createCheckpointStore(checkpointFile);

  await mkdir(outputRoot, { recursive: true });

  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ userAgent: config.userAgent });
  const page = await context.newPage();

  const chapterSummaries: RunSummary["chapters"] = [];

  try {
    const allChapters = await discoverChapters(page, config.url);
    const selected =
      config.maxChapters && config.maxChapters > 0 ? allChapters.slice(0, config.maxChapters) : allChapters;

    for (let i = 0; i < selected.length; i += 1) {
      const chapter = selected[i];
      const chapterFolderName = `${String(i + 1).padStart(3, "0")}-${sanitizePathSegment(chapter.title)}`;
      const chapterDir = join(outputRoot, chapterFolderName);

      console.log(`[${i + 1}/${selected.length}] ${chapter.title}`);

      try {
        const images = await extractChapterImages(page, chapter.url, config.timeoutMs);
        if (images.length === 0) {
          throw new Error("No images extracted from chapter page");
        }

        const chapterSummary = await downloadChapterImages({
          chapterTitle: chapter.title,
          chapterUrl: chapter.url,
          chapterDir,
          images,
          retries: config.retries,
          timeoutMs: config.timeoutMs,
          concurrency: config.concurrency,
          userAgent: config.userAgent,
          checkpoint
        });

        chapterSummaries.push(chapterSummary);
        await writeFile(join(chapterDir, "chapter-summary.json"), JSON.stringify(chapterSummary, null, 2), "utf8");
      } catch (error) {
        chapterSummaries.push({
          chapterTitle: chapter.title,
          chapterUrl: chapter.url,
          chapterDir,
          extractedCount: 0,
          downloadedCount: 0,
          skippedCount: 0,
          failedCount: 1,
          failures: [
            {
              index: 0,
              url: chapter.url,
              reason: error instanceof Error ? error.message : String(error)
            }
          ]
        });
      }

      await delay(config.chapterDelayMs);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const finishedAt = new Date().toISOString();
  const failedChapters = chapterSummaries.filter((chapter) => chapter.failedCount > 0).length;

  const runSummary: RunSummary = {
    comicUrl: config.url,
    outputRoot,
    startedAt,
    finishedAt,
    totalChapters: chapterSummaries.length,
    successChapters: chapterSummaries.length - failedChapters,
    failedChapters,
    chapters: chapterSummaries
  };

  await writeFile(join(outputRoot, "run-summary.json"), JSON.stringify(runSummary, null, 2), "utf8");
  return runSummary;
}
