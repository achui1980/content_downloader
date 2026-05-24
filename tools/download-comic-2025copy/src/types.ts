export interface DownloaderConfig {
  url: string;
  outputDir: string;
  concurrency: number;
  retries: number;
  timeoutMs: number;
  headless: boolean;
  maxChapters?: number;
  userAgent: string;
  chapterDelayMs: number;
  eventsJson?: boolean;
}

export interface Chapter {
  title: string;
  url: string;
  order: number;
}

export interface ImageEntry {
  index: number;
  url: string;
  ext: string;
}

export interface ImageFailure {
  index: number;
  url: string;
  reason: string;
}

export interface ChapterSummary {
  chapterTitle: string;
  chapterUrl: string;
  chapterDir: string;
  extractedCount: number;
  downloadedCount: number;
  skippedCount: number;
  failedCount: number;
  failures: ImageFailure[];
}

export interface RunSummary {
  comicUrl: string;
  outputRoot: string;
  startedAt: string;
  finishedAt: string;
  totalChapters: number;
  successChapters: number;
  failedChapters: number;
  chapters: ChapterSummary[];
}
