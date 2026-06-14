import type { PreviewChapter } from "./state";

type ReaderNavigationDirection = "previous" | "next";

export function getAdjacentChapterUrls(chapters: PreviewChapter[], activeChapterUrl: string): {
  previousChapterUrl: string | null;
  nextChapterUrl: string | null;
} {
  const activeIndex = chapters.findIndex((chapter) => chapter.chapterUrl === activeChapterUrl);

  if (activeIndex === -1) {
    return {
      previousChapterUrl: null,
      nextChapterUrl: null
    };
  }

  return {
    previousChapterUrl: chapters[activeIndex - 1]?.chapterUrl ?? null,
    nextChapterUrl: chapters[activeIndex + 1]?.chapterUrl ?? null
  };
}

export function hasAdjacentChapter(
  chapters: PreviewChapter[],
  activeChapterUrl: string,
  direction: ReaderNavigationDirection
): boolean {
  const adjacentChapterUrls = getAdjacentChapterUrls(chapters, activeChapterUrl);

  return direction === "previous"
    ? adjacentChapterUrls.previousChapterUrl !== null
    : adjacentChapterUrls.nextChapterUrl !== null;
}
