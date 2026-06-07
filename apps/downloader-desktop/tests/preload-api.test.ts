/// <reference types="vitest" />

import { describe, expect, test, vi } from "vitest";
import { createPreloadApi } from "../src/preload/index";
import { registerDownloadIpcHandlers } from "../src/main/index";

describe("preload api", () => {
  test("routes invocations through expected IPC channels", async () => {
    const invoke = vi.fn(async () => undefined);
    const api = createPreloadApi({
      invoke,
      on: vi.fn(),
      off: vi.fn()
    });

    await api.startDownload({
      url: "https://example.com/comic/1",
      outputDir: "/tmp/downloads",
      concurrency: 4,
      retries: 2,
      selectedChapterUrls: ["https://example.com/comic/1/chapter-1"]
    });
    await api.stopDownload("task-1");
    await api.selectOutputDir();
    await api.openOutputDir("/tmp/downloads");
    await api.startPreview({
      url: "https://example.com/comic/1",
      previewMaxChapters: 3,
      previewImagesPerChapter: 2
    });
    await api.stopPreview("preview-task-1");

    expect(invoke).toHaveBeenNthCalledWith(1, "download:start", {
      url: "https://example.com/comic/1",
      outputDir: "/tmp/downloads",
      concurrency: 4,
      retries: 2,
      selectedChapterUrls: ["https://example.com/comic/1/chapter-1"]
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "download:stop", "task-1");
    expect(invoke).toHaveBeenNthCalledWith(3, "dialog:selectOutputDir");
    expect(invoke).toHaveBeenNthCalledWith(4, "shell:openOutputDir", "/tmp/downloads");
    expect(invoke).toHaveBeenNthCalledWith(5, "preview:start", {
      url: "https://example.com/comic/1",
      previewMaxChapters: 3,
      previewImagesPerChapter: 2
    });
    expect(invoke).toHaveBeenNthCalledWith(6, "preview:stop", "preview-task-1");
  });

  test("subscribes to progress, log, and status events", () => {
    const on = vi.fn();
    const off = vi.fn();
    const api = createPreloadApi({
      invoke: vi.fn(),
      on,
      off
    });

    const unsubscribeProgress = api.onProgress(() => {});
    const unsubscribeLog = api.onLog(() => {});
    const unsubscribeStatus = api.onStatus(() => {});
    const unsubscribePreviewLog = api.onPreviewLog(() => {});
    const unsubscribePreviewChapter = api.onPreviewChapter(() => {});
    const unsubscribePreviewStatus = api.onPreviewStatus(() => {});

    expect(on).toHaveBeenNthCalledWith(1, "download:progress", expect.any(Function));
    expect(on).toHaveBeenNthCalledWith(2, "download:log", expect.any(Function));
    expect(on).toHaveBeenNthCalledWith(3, "download:status", expect.any(Function));
    expect(on).toHaveBeenNthCalledWith(4, "preview:log", expect.any(Function));
    expect(on).toHaveBeenNthCalledWith(5, "preview:chapter", expect.any(Function));
    expect(on).toHaveBeenNthCalledWith(6, "preview:status", expect.any(Function));

    const progressListener = on.mock.calls[0]?.[1];
    const logListener = on.mock.calls[1]?.[1];
    const statusListener = on.mock.calls[2]?.[1];
    const previewLogListener = on.mock.calls[3]?.[1];
    const previewChapterListener = on.mock.calls[4]?.[1];
    const previewStatusListener = on.mock.calls[5]?.[1];

    unsubscribeProgress();
    unsubscribeLog();
    unsubscribeStatus();
    unsubscribePreviewLog();
    unsubscribePreviewChapter();
    unsubscribePreviewStatus();

    expect(off).toHaveBeenNthCalledWith(1, "download:progress", progressListener);
    expect(off).toHaveBeenNthCalledWith(2, "download:log", logListener);
    expect(off).toHaveBeenNthCalledWith(3, "download:status", statusListener);
    expect(off).toHaveBeenNthCalledWith(4, "preview:log", previewLogListener);
    expect(off).toHaveBeenNthCalledWith(5, "preview:chapter", previewChapterListener);
    expect(off).toHaveBeenNthCalledWith(6, "preview:status", previewStatusListener);
  });
});

describe("main IPC handlers", () => {
  test("registers channels and bridges session progress/log events", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      })
    };
    const session = {
      start: vi.fn(),
      stop: vi.fn(),
      isRunning: vi.fn(() => true)
    };
    const previewSession = {
      start: vi.fn(),
      stop: vi.fn(),
      isRunning: vi.fn(() => true)
    };
    const showOpenDialog = vi.fn(async () => ({ canceled: false, filePaths: ["/tmp/output"] }));
    const openPath = vi.fn(async () => "");

    registerDownloadIpcHandlers({
      ipcMain,
      session,
      previewSession,
      dialog: { showOpenDialog },
      shell: { openPath }
    });

    const startHandler = handlers.get("download:start");
    const stopHandler = handlers.get("download:stop");
    const selectOutputDirHandler = handlers.get("dialog:selectOutputDir");
    const openOutputDirHandler = handlers.get("shell:openOutputDir");
    const previewStartHandler = handlers.get("preview:start");
    const previewStopHandler = handlers.get("preview:stop");

    expect(startHandler).toBeTypeOf("function");
    expect(stopHandler).toBeTypeOf("function");
    expect(selectOutputDirHandler).toBeTypeOf("function");
    expect(openOutputDirHandler).toBeTypeOf("function");
    expect(previewStartHandler).toBeTypeOf("function");
    expect(previewStopHandler).toBeTypeOf("function");

    const sender = { send: vi.fn() };
    const startResult = await startHandler?.(
      { sender },
      {
        url: "https://example.com/comic/1",
        outputDir: "/tmp/downloads",
        concurrency: 4,
        retries: 2,
        selectedChapterUrls: ["https://example.com/comic/1/chapter-1"]
      }
    );

    expect(session.start).toHaveBeenCalledWith(
      {
        url: "https://example.com/comic/1",
        outputDir: "/tmp/downloads",
        concurrency: 4,
        retries: 2,
        selectedChapterUrls: ["https://example.com/comic/1/chapter-1"]
      },
      {
        onProgress: expect.any(Function),
        onLog: expect.any(Function),
        onStatus: expect.any(Function)
      }
    );

    const [, callbacks] = session.start.mock.calls[0] as [{}, { onProgress: Function; onLog: Function; onStatus: Function }];
    callbacks.onProgress({ index: 1, totalChapters: 10, status: "started" });
    callbacks.onLog({ source: "stdout", line: "hello" });
    callbacks.onStatus({ state: "done" });

    expect(sender.send).toHaveBeenCalledWith("download:progress", expect.objectContaining({ index: 1 }));
    expect(sender.send).toHaveBeenCalledWith("download:log", expect.objectContaining({ line: "hello" }));
    expect(sender.send).toHaveBeenCalledWith("download:status", expect.objectContaining({ state: "done" }));

    await stopHandler?.({ sender }, (startResult as { taskId: string }).taskId);
    expect(session.stop).toHaveBeenCalledTimes(1);

    await selectOutputDirHandler?.({ sender });
    expect(showOpenDialog).toHaveBeenCalledTimes(1);

    await openOutputDirHandler?.({ sender }, "/tmp/output");
    expect(openPath).toHaveBeenCalledWith("/tmp/output");

    const previewStartResult = await previewStartHandler?.(
      { sender },
      {
        url: "https://example.com/comic/1",
        previewMaxChapters: 3,
        previewImagesPerChapter: 2
      }
    );

    expect(previewSession.start).toHaveBeenCalledWith(
      {
        url: "https://example.com/comic/1",
        previewMaxChapters: 3,
        previewImagesPerChapter: 2
      },
      {
        onLog: expect.any(Function),
        onChapter: expect.any(Function),
        onStatus: expect.any(Function)
      }
    );

    const [, previewCallbacks] = previewSession.start.mock.calls[0] as [{}, { onLog: Function; onChapter: Function; onStatus: Function }];
    previewCallbacks.onLog({ source: "stdout", line: "preview hello" });
    previewCallbacks.onChapter({
      index: 1,
      totalChapters: 2,
      chapterTitle: "c1",
      chapterUrl: "https://example.com/ch1",
      images: ["https://img/1.jpg"]
    });
    previewCallbacks.onStatus({ state: "done" });

    expect(sender.send).toHaveBeenCalledWith("preview:log", expect.objectContaining({ line: "preview hello" }));
    expect(sender.send).toHaveBeenCalledWith("preview:chapter", expect.objectContaining({ chapterTitle: "c1" }));
    expect(sender.send).toHaveBeenCalledWith("preview:status", expect.objectContaining({ state: "done" }));

    await previewStopHandler?.({ sender }, (previewStartResult as { taskId: string }).taskId);
    expect(previewSession.stop).toHaveBeenCalledTimes(1);
  });
});
