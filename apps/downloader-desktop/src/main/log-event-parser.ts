export type DownloaderEvent =
  | { type: "run.start" }
  | { type: "run.done" }
  | { type: "run.error"; error?: string }
  | { type: "preview.start" }
  | { type: "preview.done" }
  | { type: "preview.error"; error?: string }
  | {
      type: "preview.chapter";
      index: number;
      totalChapters: number;
      chapterTitle: string;
      chapterUrl: string;
      images: string[];
    }
  | {
      type: "preview.chapterDetail";
      chapterTitle: string;
      chapterUrl: string;
      totalImages: number;
      images: string[];
      capturedAt?: string;
    }
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
  "preview.start",
  "preview.done",
  "preview.error",
  "preview.chapter",
  "preview.chapterDetail",
  "chapter.start",
  "chapter.done",
  "image.written"
] as const);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

  if (parsed.type === "preview.chapter") {
    if (
      typeof parsed.index !== "number" ||
      typeof parsed.totalChapters !== "number" ||
      typeof parsed.chapterTitle !== "string" ||
      typeof parsed.chapterUrl !== "string" ||
      !Array.isArray(parsed.images) ||
      parsed.images.some((image) => typeof image !== "string")
    ) {
      return null;
    }

    return {
      type: "preview.chapter",
      index: parsed.index,
      totalChapters: parsed.totalChapters,
      chapterTitle: parsed.chapterTitle,
      chapterUrl: parsed.chapterUrl,
      images: parsed.images
    };
  }

  if (parsed.type === "preview.chapterDetail") {
    if (
      typeof parsed.totalImages !== "number" ||
      !Number.isFinite(parsed.totalImages) ||
      parsed.totalImages < 0 ||
      !Array.isArray(parsed.images) ||
      parsed.images.some((image) => typeof image !== "string")
    ) {
      return null;
    }

    const chapterTitle = sanitizeNonEmptyString(parsed.chapterTitle);
    const chapterUrl = sanitizeNonEmptyString(parsed.chapterUrl);
    if (!chapterTitle || !chapterUrl) {
      return null;
    }

    const images = parsed.images.map((image) => image.trim()).filter((image) => image.length > 0);
    const capturedAt = sanitizeNonEmptyString(parsed.capturedAt) ?? undefined;

    return {
      type: "preview.chapterDetail",
      chapterTitle,
      chapterUrl,
      totalImages: images.length,
      images,
      capturedAt
    };
  }

  if (parsed.type === "run.error" || parsed.type === "preview.error") {
    return {
      type: parsed.type,
      error: typeof parsed.error === "string" ? parsed.error : undefined
    };
  }

  if (
    parsed.type === "run.start" ||
    parsed.type === "run.done" ||
    parsed.type === "preview.start" ||
    parsed.type === "preview.done"
  ) {
    return { type: parsed.type };
  }

  return null;
}
