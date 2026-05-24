import { basename } from "node:path";

export function sanitizePathSegment(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "untitled";
  }

  return trimmed
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "_");
}

export function buildImageFileName(index: number, extension: string, padWidth = 3): string {
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
  return `${String(index).padStart(padWidth, "0")}.${safeExt}`;
}

export function inferExtensionFromUrl(imageUrl: string): string {
  try {
    const file = basename(new URL(imageUrl).pathname);
    const dotIndex = file.lastIndexOf(".");
    if (dotIndex > -1 && dotIndex < file.length - 1) {
      return file.slice(dotIndex + 1).toLowerCase();
    }
  } catch {
    return "jpg";
  }

  return "jpg";
}

export function getComicSlugFromUrl(comicUrl: string): string {
  try {
    const parsed = new URL(comicUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const comicIndex = segments.indexOf("comic");
    if (comicIndex > -1 && segments[comicIndex + 1]) {
      return sanitizePathSegment(segments[comicIndex + 1]);
    }
  } catch {
    return "comic";
  }

  return "comic";
}

export function chapterSortKey(title: string): number {
  const match = title.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }
  return Number.parseFloat(match[1]);
}
