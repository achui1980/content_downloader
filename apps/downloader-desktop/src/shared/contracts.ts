export type TaskStatus = "idle" | "running" | "done" | "failed";

export interface TaskState {
  status: TaskStatus;
}

export interface StartInput {
  url: string;
  outputDir: string;
  concurrency: number;
  retries: number;
  selectedChapterUrls: string[];
}

export interface StartInputValidationResult {
  ok: boolean;
  errors: string[];
}

export interface PreviewInput {
  url: string;
  previewMaxChapters: number;
  previewImagesPerChapter: number;
}

export interface PreviewInputValidationResult {
  ok: boolean;
  errors: string[];
}

export interface PreviewLogEvent {
  source: "stdout" | "stderr";
  line: string;
}

export interface PreviewChapterEvent {
  index: number;
  totalChapters: number;
  chapterTitle: string;
  chapterUrl: string;
  images: string[];
}

export interface PreviewStatusEvent {
  state: "starting" | "running" | "done" | "failed" | "stopped";
  message?: string;
}

export interface PreviewChapterDetailRequestInput {
  chapterUrl: string;
}

export interface PreviewChapterDetail {
  chapterTitle: string;
  chapterUrl: string;
  totalImages: number;
  images: string[];
  capturedAt?: string;
}

export function buildDefaultStartInput(): StartInput {
  return {
    url: "https://www.2025copy.com/comic/guichuyinxiong",
    outputDir: "/tmp/2025copy-test",
    concurrency: 2,
    retries: 1,
    selectedChapterUrls: []
  };
}

export function buildInitialTaskState(): TaskState {
  return { status: "idle" };
}
