/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import { createInitialAppState, reduceAppState } from "../src/renderer/state";

describe("preview state", () => {
  test("starts with the default reader zoom preset", () => {
    expect(createInitialAppState().readerZoom).toBe(85);
  });

  test("updates reader zoom when the user picks another preset", () => {
    const next = reduceAppState(createInitialAppState(), {
      type: "setReaderZoom",
      zoom: 70
    });

    expect(next.readerZoom).toBe(70);
  });

  test("starts in catalog mode with no saved reader positions", () => {
    const state = createInitialAppState();

    expect(state.readerMode).toBe("catalog");
    expect(state.readerPositions).toEqual({});
    expect(state.pendingRestoreChapterUrl).toBeNull();
  });

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

  test("ignores previewStarted while download is running", () => {
    const previewReady = reduceAppState(
      reduceAppState(
        reduceAppState(createInitialAppState(), {
          type: "previewStarted",
          taskId: "preview-before-run"
        }),
        {
          type: "previewChapter",
          taskId: "preview-before-run",
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/slug/1",
          images: []
        }
      ),
      {
        type: "previewStatus",
        taskId: "preview-before-run",
        state: "done"
      }
    );

    const running = reduceAppState(previewReady, {
      type: "started",
      taskId: "download-running"
    });

    const next = reduceAppState(running, {
      type: "previewStarted",
      taskId: "preview-during-run"
    });

    expect(next.previewTaskId).toBe("preview-before-run");
    expect(next.previewStatus).toBe("ready");
    expect(next.previewChapters).toHaveLength(1);
    expect(next.activeChapterUrl).toBe("https://www.2025copy.com/comic/slug/1");
  });

  test("invalidates preview-derived selection and reader state", () => {
    const previewReady = reduceAppState(
      reduceAppState(
        reduceAppState(
          reduceAppState(createInitialAppState(), {
            type: "previewStarted",
            taskId: "preview-reset"
          }),
          {
            type: "previewChapter",
            taskId: "preview-reset",
            index: 1,
            totalChapters: 1,
            chapterTitle: "Chapter 1",
            chapterUrl: "https://www.2025copy.com/comic/slug/1",
            images: []
          }
        ),
        {
          type: "previewChapterDetailLoading",
          requestId: "req-reset",
          chapterUrl: "https://www.2025copy.com/comic/slug/1"
        }
      ),
      {
        type: "previewChapterDetailSuccess",
        requestId: "req-reset",
        detail: {
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/slug/1",
          totalImages: 1,
          images: ["https://img/1.jpg"]
        }
      }
    );

    const invalidated = reduceAppState(previewReady, {
      type: "previewInvalidated"
    });

    expect(invalidated.previewStatus).toBe("idle");
    expect(invalidated.previewTaskId).toBeNull();
    expect(invalidated.previewChapters).toEqual([]);
    expect(invalidated.activeChapterUrl).toBeNull();
    expect(invalidated.selectedChapterUrls).toEqual([]);
    expect(invalidated.readerMode).toBe("catalog");
    expect(invalidated.chapterDetailStatus).toBe("idle");
    expect(invalidated.chapterDetail).toBeNull();
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
    expect(succeeded.readerMode).toBe("reading");
    expect(succeeded.pendingRestoreChapterUrl).toBe("https://www.2025copy.com/comic/slug/1");
  });

  test("clears settled chapter detail request ids so duplicate terminal events are ignored", () => {
    const withChapter = reduceAppState(
      reduceAppState(createInitialAppState(), {
        type: "previewStarted",
        taskId: "preview-terminal"
      }),
      {
        type: "previewChapter",
        taskId: "preview-terminal",
        index: 1,
        totalChapters: 1,
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1",
        images: []
      }
    );

    const resolved = reduceAppState(
      reduceAppState(withChapter, {
        type: "previewChapterDetailLoading",
        requestId: "req-success",
        chapterUrl: "https://www.2025copy.com/comic/slug/1"
      }),
      {
        type: "previewChapterDetailSuccess",
        requestId: "req-success",
        detail: {
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/slug/1",
          totalImages: 1,
          images: ["https://img/original.jpg"]
        }
      }
    );

    expect(resolved.chapterDetailRequestId).toBeNull();

    const duplicateSuccess = reduceAppState(resolved, {
      type: "previewChapterDetailSuccess",
      requestId: "req-success",
      detail: {
        chapterTitle: "Mutated Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1",
        totalImages: 1,
        images: ["https://img/duplicate.jpg"]
      }
    });

    expect(duplicateSuccess.chapterDetail?.chapterTitle).toBe("Chapter 1");
    expect(duplicateSuccess.chapterDetail?.images).toEqual(["https://img/original.jpg"]);

    const failed = reduceAppState(
      reduceAppState(duplicateSuccess, {
        type: "previewChapterDetailLoading",
        requestId: "req-error",
        chapterUrl: "https://www.2025copy.com/comic/slug/1"
      }),
      {
        type: "previewChapterDetailError",
        requestId: "req-error",
        message: "first failure"
      }
    );

    expect(failed.chapterDetailRequestId).toBeNull();

    const duplicateError = reduceAppState(failed, {
      type: "previewChapterDetailError",
      requestId: "req-error",
      message: "duplicate failure"
    });

    expect(duplicateError.chapterDetailError).toBe("first failure");
  });

  test("stores reader positions per chapter across chapter switches", () => {
    const withChapters = reduceAppState(
      reduceAppState(
        reduceAppState(createInitialAppState(), {
          type: "previewStarted",
          taskId: "preview-positions"
        }),
        {
          type: "previewChapter",
          taskId: "preview-positions",
          index: 1,
          totalChapters: 2,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/slug/1",
          images: []
        }
      ),
      {
        type: "previewChapter",
        taskId: "preview-positions",
        index: 2,
        totalChapters: 2,
        chapterTitle: "Chapter 2",
        chapterUrl: "https://www.2025copy.com/comic/slug/2",
        images: []
      }
    );

    const chapterOneLoaded = reduceAppState(
      reduceAppState(withChapters, {
        type: "previewChapterDetailLoading",
        requestId: "req-1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1"
      }),
      {
        type: "previewChapterDetailSuccess",
        requestId: "req-1",
        detail: {
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/slug/1",
          totalImages: 1,
          images: ["https://img/1.jpg"]
        }
      }
    );

    const afterChapterOnePosition = reduceAppState(chapterOneLoaded, {
      type: "readerPositionChanged",
      chapterUrl: "https://www.2025copy.com/comic/slug/1",
      position: 240
    });

    const chapterTwoLoaded = reduceAppState(
      reduceAppState(afterChapterOnePosition, {
        type: "previewChapterDetailLoading",
        requestId: "req-2",
        chapterUrl: "https://www.2025copy.com/comic/slug/2"
      }),
      {
        type: "previewChapterDetailSuccess",
        requestId: "req-2",
        detail: {
          chapterTitle: "Chapter 2",
          chapterUrl: "https://www.2025copy.com/comic/slug/2",
          totalImages: 1,
          images: ["https://img/2.jpg"]
        }
      }
    );

    const afterChapterTwoPosition = reduceAppState(chapterTwoLoaded, {
      type: "readerPositionChanged",
      chapterUrl: "https://www.2025copy.com/comic/slug/2",
      position: 96
    });

    expect(afterChapterTwoPosition.readerPositions).toEqual({
      "https://www.2025copy.com/comic/slug/1": 240,
      "https://www.2025copy.com/comic/slug/2": 96
    });
  });

  test("clears and re-queues restore markers for the active chapter", () => {
    const withChapter = reduceAppState(
      reduceAppState(createInitialAppState(), {
        type: "previewStarted",
        taskId: "preview-restore"
      }),
      {
        type: "previewChapter",
        taskId: "preview-restore",
        index: 1,
        totalChapters: 1,
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1",
        images: []
      }
    );

    const loaded = reduceAppState(
      reduceAppState(withChapter, {
        type: "previewChapterDetailLoading",
        requestId: "req-restore-1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1"
      }),
      {
        type: "previewChapterDetailSuccess",
        requestId: "req-restore-1",
        detail: {
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/slug/1",
          totalImages: 1,
          images: ["https://img/1.jpg"]
        }
      }
    );

    const restored = reduceAppState(loaded, {
      type: "readerPositionRestored",
      chapterUrl: "https://www.2025copy.com/comic/slug/1"
    });

    expect(restored.pendingRestoreChapterUrl).toBeNull();

    const reloaded = reduceAppState(
      reduceAppState(restored, {
        type: "previewChapterDetailLoading",
        requestId: "req-restore-2",
        chapterUrl: "https://www.2025copy.com/comic/slug/1"
      }),
      {
        type: "previewChapterDetailSuccess",
        requestId: "req-restore-2",
        detail: {
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/slug/1",
          totalImages: 1,
          images: ["https://img/1.jpg"]
        }
      }
    );

    expect(reloaded.pendingRestoreChapterUrl).toBe("https://www.2025copy.com/comic/slug/1");
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
