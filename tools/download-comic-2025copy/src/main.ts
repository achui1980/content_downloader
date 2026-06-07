import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { createCheckpointStore } from "./state/checkpoint.js";
import { downloadChapterImages } from "./download/chapterDownloader.js";
import { discoverChapters } from "./site2025copy/discoverChapters.js";
import { extractChapterImages } from "./site2025copy/extractChapterImages.js";
import type { DownloaderConfig, RunSummary } from "./types.js";
import { sanitizePathSegment, getComicSlugFromUrl } from "./utils/pathing.js";

function normalizeChapterUrl(chapterUrl: string): string {
  const normalized = new URL(chapterUrl);
  normalized.hash = "";
  normalized.search = "";
  normalized.pathname = normalized.pathname.replace(/\/+$/, "") || "/";
  return normalized.toString();
}

function isRemoteHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function selectDownloadChapters<T extends { url: string }>(chapters: T[], chapterUrls: string[]): T[] {
  if (chapterUrls.length === 0) {
    return chapters;
  }

  const selectedChapterUrls = new Set(chapterUrls.map((url) => normalizeChapterUrl(url)));
  const discoveredChapterUrls = new Set(chapters.map((chapter) => normalizeChapterUrl(chapter.url)));
  const unmatchedChapterUrls = chapterUrls.filter((url) => !discoveredChapterUrls.has(normalizeChapterUrl(url)));

  if (unmatchedChapterUrls.length > 0) {
    throw new Error(`Some --chapter-url values were not found in discovered chapters: ${unmatchedChapterUrls.join(", ")}`);
  }

  return chapters.filter((chapter) => selectedChapterUrls.has(normalizeChapterUrl(chapter.url)));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function emitJsonEvent(config: DownloaderConfig, payload: Record<string, unknown>): void {
  if (!config.eventsJson) {
    return;
  }
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function reportCleanupError(config: DownloaderConfig, scope: "context" | "browser", error: unknown): void {
  if (config.eventsJson) {
    process.stderr.write(`[cleanup:${scope}] ${error instanceof Error ? error.message : String(error)}\n`);
    return;
  }
  console.warn(`[cleanup:${scope}]`, error);
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
  emitJsonEvent(config, {
    type: "run.start",
    comicUrl: config.url,
    outputRoot,
    startedAt
  });

  const chapterSummaries: RunSummary["chapters"] = [];
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  try {
    browser = await chromium.launch({ headless: config.headless });
    context = await browser.newContext({ userAgent: config.userAgent });
    const page = await context.newPage();

    const allChapters = await discoverChapters(page, config.url);
    const selectedChapters = selectDownloadChapters(allChapters, config.chapterUrls);
    const selected =
      config.maxChapters && config.maxChapters > 0
        ? selectedChapters.slice(0, config.maxChapters)
        : selectedChapters;

    for (let i = 0; i < selected.length; i += 1) {
      const chapter = selected[i];
      const chapterFolderName = `${String(i + 1).padStart(3, "0")}-${sanitizePathSegment(chapter.title)}`;
      const chapterDir = join(outputRoot, chapterFolderName);
      const chapterStartedAt = new Date().toISOString();

      emitJsonEvent(config, {
        type: "chapter.start",
        index: i + 1,
        totalChapters: selected.length,
        chapterTitle: chapter.title,
        chapterUrl: chapter.url,
        startedAt: chapterStartedAt
      });

      if (!config.eventsJson) {
        console.log(`[${i + 1}/${selected.length}] ${chapter.title}`);
      }

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
          checkpoint,
          onImageWritten: (event) => {
            emitJsonEvent(config, {
              type: "image.written",
              index: i + 1,
              totalChapters: selected.length,
              chapterTitle: chapter.title,
              chapterUrl: chapter.url,
              fileName: event.fileName,
              bytes: event.bytes,
              writtenImages: event.writtenImages,
              writtenBytes: event.writtenBytes,
              writtenAt: new Date().toISOString()
            });
          }
        });

        chapterSummaries.push(chapterSummary);
        await writeFile(join(chapterDir, "chapter-summary.json"), JSON.stringify(chapterSummary, null, 2), "utf8");

        emitJsonEvent(config, {
          type: "chapter.done",
          index: i + 1,
          totalChapters: selected.length,
          chapterTitle: chapter.title,
          chapterUrl: chapter.url,
          startedAt: chapterStartedAt,
          finishedAt: new Date().toISOString(),
          extractedCount: chapterSummary.extractedCount,
          downloadedCount: chapterSummary.downloadedCount,
          skippedCount: chapterSummary.skippedCount,
          failedCount: chapterSummary.failedCount,
          status: chapterSummary.failedCount > 0 ? "failed" : "ok"
        });
      } catch (error) {
        const chapterSummary = {
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
        };

        chapterSummaries.push(chapterSummary);
        emitJsonEvent(config, {
          type: "chapter.done",
          index: i + 1,
          totalChapters: selected.length,
          chapterTitle: chapter.title,
          chapterUrl: chapter.url,
          startedAt: chapterStartedAt,
          finishedAt: new Date().toISOString(),
          extractedCount: chapterSummary.extractedCount,
          downloadedCount: chapterSummary.downloadedCount,
          skippedCount: chapterSummary.skippedCount,
          failedCount: chapterSummary.failedCount,
          status: "failed",
          error: chapterSummary.failures[0]?.reason
        });
      }

      await delay(config.chapterDelayMs);
    }
  } catch (error) {
    emitJsonEvent(config, {
      type: "run.error",
      comicUrl: config.url,
      outputRoot,
      startedAt,
      error: error instanceof Error ? error.message : String(error),
      failedAt: new Date().toISOString()
    });
    throw error;
  } finally {
    if (context) {
      await context.close().catch((error) => {
        reportCleanupError(config, "context", error);
      });
    }
    if (browser) {
      await browser.close().catch((error) => {
        reportCleanupError(config, "browser", error);
      });
    }
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
  emitJsonEvent(config, {
    type: "run.done",
    comicUrl: config.url,
    outputRoot,
    startedAt,
    finishedAt,
    totalChapters: runSummary.totalChapters,
    successChapters: runSummary.successChapters,
    failedChapters: runSummary.failedChapters
  });
  return runSummary;
}

export async function runPreview(config: DownloaderConfig): Promise<void> {
  const startedAt = new Date().toISOString();
  emitJsonEvent(config, {
    type: "preview.start",
    comicUrl: config.url,
    startedAt,
    previewMaxChapters: config.previewMaxChapters,
    previewImagesPerChapter: config.previewImagesPerChapter
  });

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  try {
    browser = await chromium.launch({ headless: config.headless });
    context = await browser.newContext({ userAgent: config.userAgent });
    const page = await context.newPage();

    const allChapters = await discoverChapters(page, config.url);
    const selectedChapters = selectDownloadChapters(allChapters, config.chapterUrls);
    const limitedChapters = selectedChapters.slice(0, config.previewMaxChapters);

    for (let i = 0; i < limitedChapters.length; i += 1) {
      const chapter = limitedChapters[i];
      const images = await extractChapterImages(page, chapter.url, config.timeoutMs);
      const remoteImages = images.filter((image) => isRemoteHttpUrl(image.url));

      emitJsonEvent(config, {
        type: "preview.chapter",
        index: i + 1,
        totalChapters: limitedChapters.length,
        chapterTitle: chapter.title,
        chapterUrl: chapter.url,
        totalImages: remoteImages.length,
        images: remoteImages.slice(0, config.previewImagesPerChapter).map((image) => image.url),
        capturedAt: new Date().toISOString()
      });

      if (!config.eventsJson) {
        console.log(
          `[preview ${i + 1}/${limitedChapters.length}] ${chapter.title} (${Math.min(remoteImages.length, config.previewImagesPerChapter)}/${remoteImages.length} images)`
        );
      }

      await delay(config.chapterDelayMs);
    }

    emitJsonEvent(config, {
      type: "preview.done",
      comicUrl: config.url,
      startedAt,
      finishedAt: new Date().toISOString(),
      totalChapters: limitedChapters.length
    });
  } catch (error) {
    emitJsonEvent(config, {
      type: "preview.error",
      comicUrl: config.url,
      startedAt,
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    if (context) {
      await context.close().catch((error) => {
        reportCleanupError(config, "context", error);
      });
    }
    if (browser) {
      await browser.close().catch((error) => {
        reportCleanupError(config, "browser", error);
      });
    }
  }
}

export async function runPreviewChapter(config: DownloaderConfig): Promise<void> {
  const startedAt = new Date().toISOString();
  emitJsonEvent(config, {
    type: "preview.start",
    comicUrl: config.url,
    startedAt,
    previewMaxChapters: 1,
    previewImagesPerChapter: config.previewImagesPerChapter
  });

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  try {
    browser = await chromium.launch({ headless: config.headless });
    context = await browser.newContext({ userAgent: config.userAgent });
    const page = await context.newPage();

    const allChapters = await discoverChapters(page, config.url);
    const selectedChapters = selectDownloadChapters(allChapters, config.chapterUrls);
    const chapter = selectedChapters[0];
    if (!chapter) {
      throw new Error("No chapter matched --chapter-url");
    }

    const images = await extractChapterImages(page, chapter.url, config.timeoutMs);
    const remoteImages = images.filter((image) => isRemoteHttpUrl(image.url));

    emitJsonEvent(config, {
      type: "preview.chapterDetail",
      chapterTitle: chapter.title,
      chapterUrl: chapter.url,
      totalImages: remoteImages.length,
      images: remoteImages.map((image) => image.url),
      capturedAt: new Date().toISOString()
    });

    if (!config.eventsJson) {
      console.log(`[preview chapter] ${chapter.title} (${remoteImages.length} images)`);
    }

    emitJsonEvent(config, {
      type: "preview.done",
      comicUrl: config.url,
      startedAt,
      finishedAt: new Date().toISOString(),
      totalChapters: 1
    });
  } catch (error) {
    emitJsonEvent(config, {
      type: "preview.error",
      comicUrl: config.url,
      startedAt,
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    if (context) {
      await context.close().catch((error) => {
        reportCleanupError(config, "context", error);
      });
    }
    if (browser) {
      await browser.close().catch((error) => {
        reportCleanupError(config, "browser", error);
      });
    }
  }
}
