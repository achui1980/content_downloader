/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import { createInitialAppState, reduceAppState } from "../src/renderer/state";

describe("renderer app state", () => {
  test("transitions from idle to running on started", () => {
    const next = reduceAppState(createInitialAppState(), {
      type: "started",
      taskId: "task-1"
    });

    expect(next.status).toBe("running");
    expect(next.taskId).toBe("task-1");
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
});
