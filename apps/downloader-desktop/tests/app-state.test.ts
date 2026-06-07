/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import { createInitialAppState, reduceAppState } from "../src/renderer/state";

describe("renderer app state", () => {
  test("transitions from idle to running on started", () => {
    const withSelection = reduceAppState(
      reduceAppState(createInitialAppState(), {
        type: "previewStarted",
        taskId: "preview-seed"
      }),
      {
        type: "previewChapter",
        taskId: "preview-seed",
        index: 1,
        totalChapters: 1,
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1",
        images: []
      }
    );

    const ready = reduceAppState(withSelection, {
      type: "previewStatus",
      taskId: "preview-seed",
      state: "done"
    });

    const next = reduceAppState(ready, {
      type: "started",
      taskId: "task-1"
    });

    expect(next.status).toBe("running");
    expect(next.taskId).toBe("task-1");
    expect(next.selectedChapterUrls).toEqual(["https://www.2025copy.com/comic/slug/1"]);
  });

  test("handles terminal done status from backend", () => {
    const running = reduceAppState(createInitialAppState(), {
      type: "started",
      taskId: "task-2"
    });

    const next = reduceAppState(running, {
      type: "status",
      taskId: "task-2",
      state: "done"
    });

    expect(next.status).toBe("done");
    expect(next.resultMessage).toBe("Download completed");
  });

  test("handles terminal failed status from backend", () => {
    const running = reduceAppState(createInitialAppState(), {
      type: "started",
      taskId: "task-3"
    });

    const next = reduceAppState(running, {
      type: "status",
      taskId: "task-3",
      state: "failed",
      message: "network error"
    });

    expect(next.status).toBe("error");
    expect(next.resultMessage).toBe("network error");
  });

  test("ignores stale events from another task", () => {
    const running = reduceAppState(createInitialAppState(), {
      type: "started",
      taskId: "task-current"
    });

    const next = reduceAppState(running, {
      type: "status",
      taskId: "task-old",
      state: "failed",
      message: "old task failed"
    });

    expect(next.status).toBe("running");
    expect(next.resultMessage).toBeNull();
  });

  test("does not start download while preview is previewing", () => {
    const previewing = reduceAppState(createInitialAppState(), {
      type: "previewStarted",
      taskId: "preview-active"
    });

    const next = reduceAppState(previewing, {
      type: "started",
      taskId: "task-while-preview"
    });

    expect(next.status).toBe("idle");
    expect(next.taskId).toBeNull();
    expect(next.previewStatus).toBe("previewing");
  });

  test("allows start after preview is stopped", () => {
    const previewing = reduceAppState(createInitialAppState(), {
      type: "previewStarted",
      taskId: "preview-active"
    });

    const previewStopped = reduceAppState(previewing, {
      type: "previewStatus",
      taskId: "preview-active",
      state: "stopped"
    });

    const started = reduceAppState(previewStopped, {
      type: "started",
      taskId: "task-after-stop"
    });

    expect(previewStopped.previewStatus).toBe("idle");
    expect(started.status).toBe("running");
    expect(started.taskId).toBe("task-after-stop");
  });
});
