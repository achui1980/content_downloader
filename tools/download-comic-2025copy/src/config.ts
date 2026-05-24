import type { DownloaderConfig } from "./types.js";

export interface CliArgs {
  url?: string;
  outputDir?: string;
  concurrency?: number;
  retries?: number;
  timeoutMs?: number;
  headless?: boolean;
  maxChapters?: number;
  eventsJson?: boolean;
  mode?: "download" | "discover";
  help?: boolean;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export function createConfig(input: CliArgs): DownloaderConfig {
  if (!input.url) {
    throw new Error("Missing required --url");
  }

  const parsedUrl = new URL(input.url);
  if (!parsedUrl.hostname.includes("2025copy.com")) {
    throw new Error("Only 2025copy.com is supported in v1");
  }
  if (!parsedUrl.pathname.includes("/comic/")) {
    throw new Error("URL must be a comic detail page, e.g. /comic/<slug>");
  }

  const concurrency = input.concurrency ?? 4;
  const retries = input.retries ?? 3;
  const timeoutMs = input.timeoutMs ?? 15000;
  const headless = input.headless ?? true;

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

  return {
    url: input.url,
    outputDir: input.outputDir ?? "./downloads",
    concurrency,
    retries,
    timeoutMs,
    headless,
    maxChapters: input.maxChapters,
    eventsJson: input.eventsJson ?? false,
    userAgent: DEFAULT_USER_AGENT,
    chapterDelayMs: 300
  };
}
