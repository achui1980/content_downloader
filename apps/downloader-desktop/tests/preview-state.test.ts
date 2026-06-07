/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import { createInitialAppState, reduceAppState } from "../src/renderer/state";

describe("preview state", () => {
  test("collects preview chapters and defaults to selected", () => {
    const started = reduceAppState(createInitialAppState(), {
      type: "previewStarted",
      taskId: "preview-1"
    });

    const withChapter = reduceAppState(started, {
      type: "previewChapter",
      taskId: "preview-1",
      index: 1,
      totalChapters: 3,
      chapterTitle: "Chapter 1",
      chapterUrl: "https://www.2025copy.com/comic/slug/1",
      images: ["https://img/1.jpg", "https://img/2.jpg"]
    });

    expect(withChapter.previewChapters).toHaveLength(1);
    expect(withChapter.activeChapterUrl).toBe("https://www.2025copy.com/comic/slug/1");
    expect(withChapter.selectedChapterUrls).toEqual(["https://www.2025copy.com/comic/slug/1"]);
  });

  test("ignores stale preview events by task id", () => {
    const started = reduceAppState(createInitialAppState(), {
      type: "previewStarted",
      taskId: "preview-current"
    });

    const next = reduceAppState(started, {
      type: "previewStatus",
      taskId: "preview-old",
      state: "failed",
      message: "old failed"
    });

    expect(next.previewStatus).toBe("previewing");
    expect(next.previewError).toBeNull();
  });

  test("locks chapter selection while download is running and unlocks after stop", () => {
    const ready = reduceAppState(
      reduceAppState(createInitialAppState(), {
        type: "previewStarted",
        taskId: "preview-2"
      }),
      {
        type: "previewChapter",
        taskId: "preview-2",
        index: 1,
        totalChapters: 1,
        chapterTitle: "Chapter A",
        chapterUrl: "https://www.2025copy.com/comic/slug/a",
        images: []
      }
    );

    const previewReady = reduceAppState(ready, {
      type: "previewStatus",
      taskId: "preview-2",
      state: "done"
    });

    const running = reduceAppState(previewReady, {
      type: "started",
      taskId: "download-1"
    });

    const locked = reduceAppState(running, {
      type: "toggleChapterSelection",
      chapterUrl: "https://www.2025copy.com/comic/slug/a"
    });

    expect(locked.selectedChapterUrls).toEqual(["https://www.2025copy.com/comic/slug/a"]);

    const stopped = reduceAppState(locked, {
      type: "stopped"
    });

    const unlocked = reduceAppState(stopped, {
      type: "toggleChapterSelection",
      chapterUrl: "https://www.2025copy.com/comic/slug/a"
    });

    expect(unlocked.selectedChapterUrls).toEqual([]);
  });

  test("ignores previewChapter events while download is running", () => {
    const ready = reduceAppState(
      reduceAppState(createInitialAppState(), {
        type: "previewStarted",
        taskId: "preview-3"
      }),
      {
        type: "previewChapter",
        taskId: "preview-3",
        index: 1,
        totalChapters: 2,
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1",
        images: []
      }
    );

    const previewReady = reduceAppState(ready, {
      type: "previewStatus",
      taskId: "preview-3",
      state: "done"
    });

    const running = reduceAppState(previewReady, {
      type: "started",
      taskId: "download-2"
    });

    const next = reduceAppState(running, {
      type: "previewChapter",
      taskId: "preview-3",
      index: 2,
      totalChapters: 2,
      chapterTitle: "Chapter 2",
      chapterUrl: "https://www.2025copy.com/comic/slug/2",
      images: []
    });

    expect(next.previewChapters).toHaveLength(1);
    expect(next.previewChapters[0]?.chapterUrl).toBe("https://www.2025copy.com/comic/slug/1");
    expect(next.selectedChapterUrls).toEqual(["https://www.2025copy.com/comic/slug/1"]);
  });

  test("maps preview stopped to ready when preview chapters exist", () => {
    const withChapter = reduceAppState(
      reduceAppState(createInitialAppState(), {
        type: "previewStarted",
        taskId: "preview-4"
      }),
      {
        type: "previewChapter",
        taskId: "preview-4",
        index: 1,
        totalChapters: 1,
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1",
        images: []
      }
    );

    const stopped = reduceAppState(withChapter, {
      type: "previewStatus",
      taskId: "preview-4",
      state: "stopped"
    });

    expect(stopped.previewStatus).toBe("ready");
    expect(stopped.previewError).toBeNull();
  });

  test("tracks chapter detail lifecycle for active chapter", () => {
    const withChapter = reduceAppState(
      reduceAppState(createInitialAppState(), {
        type: "previewStarted",
        taskId: "preview-5"
      }),
      {
        type: "previewChapter",
        taskId: "preview-5",
        index: 1,
        totalChapters: 1,
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1",
        images: []
      }
    );

    const loading = reduceAppState(withChapter, {
      type: "previewChapterDetailLoading",
      requestId: "req-1",
      chapterUrl: "https://www.2025copy.com/comic/slug/1"
    });

    expect(loading.chapterDetailStatus).toBe("loading");
    expect(loading.chapterDetailRequestId).toBe("req-1");
    expect(loading.chapterDetailError).toBeNull();

    const failed = reduceAppState(loading, {
      type: "previewChapterDetailError",
      requestId: "req-1",
      message: "failed to load chapter"
    });

    expect(failed.chapterDetailStatus).toBe("error");
    expect(failed.chapterDetailError).toBe("failed to load chapter");

    const succeeded = reduceAppState(
      reduceAppState(failed, {
        type: "previewChapterDetailLoading",
        requestId: "req-2",
        chapterUrl: "https://www.2025copy.com/comic/slug/1"
      }),
      {
        type: "previewChapterDetailSuccess",
        requestId: "req-2",
        detail: {
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/slug/1",
          totalImages: 3,
          images: ["https://img/1.jpg", "https://img/2.jpg", "https://img/3.jpg"]
        }
      }
    );

    expect(succeeded.chapterDetailStatus).toBe("success");
    expect(succeeded.chapterDetailError).toBeNull();
    expect(succeeded.chapterDetail?.images).toHaveLength(3);
  });

  test("ignores stale chapter detail responses by request id", () => {
    const withChapter = reduceAppState(
      reduceAppState(
        reduceAppState(createInitialAppState(), {
          type: "previewStarted",
          taskId: "preview-6"
        }),
        {
          type: "previewChapter",
          taskId: "preview-6",
          index: 1,
          totalChapters: 2,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/slug/1",
          images: []
        }
      ),
      {
        type: "previewChapter",
        taskId: "preview-6",
        index: 2,
        totalChapters: 2,
        chapterTitle: "Chapter 2",
        chapterUrl: "https://www.2025copy.com/comic/slug/2",
        images: []
      }
    );

    const firstLoading = reduceAppState(withChapter, {
      type: "previewChapterDetailLoading",
      requestId: "req-1",
      chapterUrl: "https://www.2025copy.com/comic/slug/1"
    });

    const secondLoading = reduceAppState(firstLoading, {
      type: "previewChapterDetailLoading",
      requestId: "req-2",
      chapterUrl: "https://www.2025copy.com/comic/slug/2"
    });

    const staleResolved = reduceAppState(secondLoading, {
      type: "previewChapterDetailSuccess",
      requestId: "req-1",
      detail: {
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1",
        totalImages: 1,
        images: ["https://img/stale.jpg"]
      }
    });

    expect(staleResolved.chapterDetailStatus).toBe("loading");
    expect(staleResolved.chapterDetail).toBeNull();
    expect(staleResolved.activeChapterUrl).toBe("https://www.2025copy.com/comic/slug/2");

    const freshResolved = reduceAppState(staleResolved, {
      type: "previewChapterDetailSuccess",
      requestId: "req-2",
      detail: {
        chapterTitle: "Chapter 2",
        chapterUrl: "https://www.2025copy.com/comic/slug/2",
        totalImages: 2,
        images: ["https://img/2-1.jpg", "https://img/2-2.jpg"]
      }
    });

    expect(freshResolved.chapterDetailStatus).toBe("success");
    expect(freshResolved.chapterDetail?.chapterUrl).toBe("https://www.2025copy.com/comic/slug/2");
  });
});
