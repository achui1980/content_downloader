/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import { getAdjacentChapterUrls, hasAdjacentChapter } from "../src/renderer/reader-navigation";
import type { PreviewChapter } from "../src/renderer/state";

function buildChapter(index: number, chapterUrl: string): PreviewChapter {
  return {
    index,
    totalChapters: 3,
    chapterTitle: `Chapter ${index}`,
    chapterUrl,
    images: []
  };
}

describe("reader navigation", () => {
  const chapters: PreviewChapter[] = [
    buildChapter(1, "https://www.2025copy.com/comic/slug/1"),
    buildChapter(2, "https://www.2025copy.com/comic/slug/2"),
    buildChapter(3, "https://www.2025copy.com/comic/slug/3")
  ];

  test("returns previous and next chapter URLs for a middle chapter", () => {
    expect(getAdjacentChapterUrls(chapters, "https://www.2025copy.com/comic/slug/2")).toEqual({
      previousChapterUrl: "https://www.2025copy.com/comic/slug/1",
      nextChapterUrl: "https://www.2025copy.com/comic/slug/3"
    });
  });

  test("returns null when adjacent chapters do not exist", () => {
    expect(getAdjacentChapterUrls(chapters, "https://www.2025copy.com/comic/slug/1")).toEqual({
      previousChapterUrl: null,
      nextChapterUrl: "https://www.2025copy.com/comic/slug/2"
    });

    expect(getAdjacentChapterUrls(chapters, "https://www.2025copy.com/comic/slug/3")).toEqual({
      previousChapterUrl: "https://www.2025copy.com/comic/slug/2",
      nextChapterUrl: null
    });
  });

  test("returns null URLs and false booleans when the active chapter is missing", () => {
    expect(getAdjacentChapterUrls(chapters, "https://www.2025copy.com/comic/slug/missing")).toEqual({
      previousChapterUrl: null,
      nextChapterUrl: null
    });

    expect(hasAdjacentChapter(chapters, "https://www.2025copy.com/comic/slug/missing", "previous")).toBe(false);
    expect(hasAdjacentChapter(chapters, "https://www.2025copy.com/comic/slug/missing", "next")).toBe(false);
  });

  test("reports whether a previous or next chapter exists", () => {
    expect(hasAdjacentChapter(chapters, "https://www.2025copy.com/comic/slug/1", "previous")).toBe(false);
    expect(hasAdjacentChapter(chapters, "https://www.2025copy.com/comic/slug/1", "next")).toBe(true);
    expect(hasAdjacentChapter(chapters, "https://www.2025copy.com/comic/slug/2", "previous")).toBe(true);
    expect(hasAdjacentChapter(chapters, "https://www.2025copy.com/comic/slug/3", "next")).toBe(false);
  });
});
