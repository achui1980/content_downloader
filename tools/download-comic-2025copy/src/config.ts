import type { DownloaderConfig } from "./types.js";

export interface CliArgs {
  url?: string;
  outputDir?: string;
  concurrency?: number;
  retries?: number;
  timeoutMs?: number;
  headless?: boolean;
  maxChapters?: number;
  previewMaxChapters?: number;
  previewImagesPerChapter?: number;
  chapterUrls?: string[];
  eventsJson?: boolean;
  mode?: "download" | "discover" | "preview";
  help?: boolean;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function validateComicPageUrl(value: string, optionName: string): void {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${optionName} must be a valid URL`);
  }

  if (!parsedUrl.hostname.includes("2025copy.com")) {
    throw new Error(`${optionName} only supports 2025copy.com URLs`);
  }
  if (!parsedUrl.pathname.includes("/comic/")) {
    throw new Error(`${optionName} must be a comic detail page, e.g. /comic/<slug>`);
  }
}

export function createConfig(input: CliArgs): DownloaderConfig {
  if (!input.url) {
    throw new Error("Missing required --url");
  }

  validateComicPageUrl(input.url, "--url");

  const concurrency = input.concurrency ?? 4;
  const retries = input.retries ?? 3;
  const timeoutMs = input.timeoutMs ?? 15000;
  const headless = input.headless ?? true;
  const mode = input.mode ?? "download";
  const previewMaxChapters = input.previewMaxChapters ?? 12;
  const previewImagesPerChapter = input.previewImagesPerChapter ?? 3;
  const chapterUrls = input.chapterUrls ?? [];

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("--concurrency must be an integer >= 1");
  }
  if (!Number.isInteger(retries) || retries < 0) {
    throw new Error("--retries must be an integer >= 0");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000) {
    throw new Error("--timeout-ms must be an integer >= 1000");
  }
  if (input.maxChapters !== undefined && (!Number.isInteger(input.maxChapters) || input.maxChapters < 1)) {
    throw new Error("--max-chapters must be an integer >= 1");
  }
  if (!["download", "discover", "preview"].includes(mode)) {
    throw new Error("--mode must be one of: download, discover, preview");
  }
  if (!Number.isInteger(previewMaxChapters) || previewMaxChapters < 1) {
    throw new Error("--preview-max-chapters must be an integer >= 1");
  }
  if (!Number.isInteger(previewImagesPerChapter) || previewImagesPerChapter < 1) {
    throw new Error("--preview-images-per-chapter must be an integer >= 1");
  }
  if (!Array.isArray(chapterUrls)) {
    throw new Error("--chapter-url must be provided as a list of URLs");
  }
  chapterUrls.forEach((chapterUrl, index) => {
    if (typeof chapterUrl !== "string") {
      throw new Error(`--chapter-url #${index + 1} must be a string URL`);
    }
    validateComicPageUrl(chapterUrl, `--chapter-url #${index + 1}`);
  });

  return {
    url: input.url,
    outputDir: input.outputDir ?? "./downloads",
    mode,
    concurrency,
    retries,
    timeoutMs,
    headless,
    maxChapters: input.maxChapters,
    previewMaxChapters,
    previewImagesPerChapter,
    chapterUrls,
    eventsJson: input.eventsJson ?? false,
    userAgent: DEFAULT_USER_AGENT,
    chapterDelayMs: 300
  };
}
