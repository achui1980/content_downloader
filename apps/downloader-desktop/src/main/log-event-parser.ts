export type DownloaderEvent =
  | { type: "run.start" }
  | { type: "run.done" }
  | { type: "run.error"; error?: string }
  | { type: "chapter.start"; index: number; totalChapters: number; chapterTitle?: string }
  | { type: "chapter.done"; index: number; totalChapters: number; status?: string }
  | {
      type: "image.written";
      fileName: string;
      bytes: number;
      writtenImages: number;
      writtenBytes: number;
    };

const EVENT_TYPES = new Set([
  "run.start",
  "run.done",
  "run.error",
  "chapter.start",
  "chapter.done",
  "image.written"
] as const);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseDownloaderEventLine(line: string): DownloaderEvent | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!isObject(parsed) || typeof parsed.type !== "string" || !EVENT_TYPES.has(parsed.type as never)) {
    return null;
  }

  if (parsed.type === "chapter.start") {
    if (typeof parsed.index !== "number" || typeof parsed.totalChapters !== "number") {
      return null;
    }
    return {
      type: "chapter.start",
      index: parsed.index,
      totalChapters: parsed.totalChapters,
      chapterTitle: typeof parsed.chapterTitle === "string" ? parsed.chapterTitle : undefined
    };
  }

  if (parsed.type === "chapter.done") {
    if (typeof parsed.index !== "number" || typeof parsed.totalChapters !== "number") {
      return null;
    }
    return {
      type: "chapter.done",
      index: parsed.index,
      totalChapters: parsed.totalChapters,
      status: typeof parsed.status === "string" ? parsed.status : undefined
    };
  }

  if (parsed.type === "image.written") {
    if (
      typeof parsed.fileName !== "string" ||
      typeof parsed.bytes !== "number" ||
      typeof parsed.writtenImages !== "number" ||
      typeof parsed.writtenBytes !== "number"
    ) {
      return null;
    }

    return {
      type: "image.written",
      fileName: parsed.fileName,
      bytes: parsed.bytes,
      writtenImages: parsed.writtenImages,
      writtenBytes: parsed.writtenBytes
    };
  }

  if (parsed.type === "run.error") {
    return {
      type: "run.error",
      error: typeof parsed.error === "string" ? parsed.error : undefined
    };
  }

  if (parsed.type === "run.start" || parsed.type === "run.done") {
    return { type: parsed.type };
  }

  return null;
}
