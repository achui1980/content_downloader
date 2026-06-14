/// <reference types="vitest" />

import { describe, expect, test, vi } from "vitest";
import { createElement, createRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ChapterListPanel } from "../src/renderer/components/ChapterListPanel";
import { DownloadForm } from "../src/renderer/components/DownloadForm";
import { ReaderPanel } from "../src/renderer/components/ReaderPanel";
import { App } from "../src/renderer/App";
import { resolveDownloadScope } from "../src/renderer/download-scope";
import { buildDefaultStartInput, buildInitialTaskState } from "../src/shared/contracts";
import { validateStartInput } from "../src/shared/validation";
import type { DownloaderPreloadApi } from "../src/preload";

function buildDownloadFormProps(overrides: Partial<Parameters<typeof DownloadForm>[0]> = {}): Parameters<typeof DownloadForm>[0] {
  return {
    values: {
      ...buildDefaultStartInput(),
      selectedChapterUrls: ["https://www.2025copy.com/comic/example/chapter-1"]
    },
    isRunning: false,
    isPreviewing: false,
    hasApi: true,
    canStart: true,
    canPreview: true,
    selectedChapterCount: 1,
    previewMaxChapters: 3,
    previewImagesPerChapter: 5,
    validationErrors: [],
    onChange: () => {},
    onChangePreviewMaxChapters: () => {},
    onChangePreviewImagesPerChapter: () => {},
    onStartPreview: () => {},
    onStopPreview: () => {},
    onDownloadAll: () => {},
    onDownloadSelected: () => {},
    onStop: () => {},
    onSelectOutputDir: () => {},
    onOpenOutputDir: () => {},
    ...overrides
  };
}

function renderDownloadForm(props: Parameters<typeof DownloadForm>[0]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(createElement(DownloadForm, props));
  });

  const getButton = (label: string) => {
    const button = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === label);
    if (!button) {
      throw new Error(`Button not found: ${label}`);
    }
    return button;
  };

  return {
    getButton,
    cleanup: () => {
      root.unmount();
      container.remove();
    }
  };
}

function renderReaderPanel(props: Parameters<typeof ReaderPanel>[0]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(createElement(ReaderPanel, props));
  });

  return {
    container,
    cleanup: () => {
      root.unmount();
      container.remove();
    }
  };
}

function createMockDownloaderApi(): DownloaderPreloadApi {
  return {
    startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
    stopDownload: vi.fn(async () => ({ stopped: true })),
    startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
    stopPreview: vi.fn(async () => ({ stopped: true })),
    loadPreviewChapter: vi.fn(async () => ({
      chapterTitle: "Chapter 1",
      chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
      totalImages: 2,
      images: ["https://img/default-1.jpg", "https://img/default-2.jpg"]
    })),
    selectOutputDir: vi.fn(async () => null),
    openOutputDir: vi.fn(async () => null),
    onProgress: vi.fn(() => () => {}),
    onLog: vi.fn(() => () => {}),
    onStatus: vi.fn(() => () => {}),
    onPreviewLog: vi.fn(() => () => {}),
    onPreviewChapter: vi.fn(() => () => {}),
    onPreviewStatus: vi.fn(() => () => {})
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return { promise, resolve, reject };
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForQueuedTimers(turns = 5): Promise<void> {
  for (let index = 0; index < turns; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("desktop baseline", () => {
  test("buildInitialTaskState starts idle", () => {
    expect(buildInitialTaskState().status).toBe("idle");
  });

  test("buildDefaultStartInput provides test-friendly defaults", () => {
    expect(buildDefaultStartInput()).toEqual({
      url: "https://www.2025copy.com/comic/guichuyinxiong",
      outputDir: "/tmp/2025copy-test",
      concurrency: 2,
      retries: 1,
      selectedChapterUrls: []
    });
  });

  test("buildDefaultStartInput is intentionally invalid before chapter selection", () => {
    const result = validateStartInput(buildDefaultStartInput());

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("至少选择一个章节");
  });

  test("resolveDownloadScope does not widen selected mode when no chapters are selected", () => {
    expect(resolveDownloadScope("selected", [])).toEqual({
      selectedChapterUrls: [],
      fallbackToAll: false,
      errorMessage: "Select at least one chapter before downloading selected chapters."
    });
  });

  test("DownloadForm keeps preview primary and moves download actions into a secondary section", () => {
    const markup = renderToStaticMarkup(createElement(DownloadForm, buildDownloadFormProps({ validationErrors: ["Validation message"] })));

    expect(markup).toContain("Preview Chapters");
    expect(markup).toContain('class="button button--primary"');
    expect(markup).toContain("Download images instead");
    expect(markup).toContain("Download All Chapters");
    expect(markup).toContain("Download Selected Chapters (1)");
    expect(markup).toContain("Preview Chapters");
    expect(markup).toContain('type="url"');
    expect(markup).toContain('aria-live="polite"');
  });

  test("DownloadForm remains renderable with legacy onSubmit fallback", () => {
    const markup = renderToStaticMarkup(createElement(DownloadForm, buildDownloadFormProps({ onSubmit: () => {} })));

    expect(markup).toContain("Download All Chapters");
    expect(markup).toContain("Download Selected Chapters (1)");
  });

  test("DownloadForm keeps Stop outside the collapsed download details while a download is running", () => {
    const { getButton, cleanup } = renderDownloadForm(buildDownloadFormProps({ isRunning: true }));

    try {
      const stopButton = getButton("Stop");

      expect(stopButton.closest("details")).toBeNull();
      expect(stopButton.hasAttribute("disabled")).toBe(false);
    } finally {
      cleanup();
    }
  });

  test("ChapterListPanel stays navigator-focused without reader-state copy", () => {
    const markup = renderToStaticMarkup(
      createElement(ChapterListPanel, {
        chapters: [
          {
            index: 1,
            totalChapters: 2,
            chapterTitle: "Chapter 1",
            chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
            images: ["https://img/preview-1.jpg"]
          },
          {
            index: 2,
            totalChapters: 2,
            chapterTitle: "Chapter 2",
            chapterUrl: "https://www.2025copy.com/comic/example/chapter-2",
            images: ["https://img/preview-2.jpg"]
          }
        ],
        selectedChapterUrls: ["https://www.2025copy.com/comic/example/chapter-1"],
        activeChapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        selectionLocked: false,
        onToggleChapter: () => {},
        onSelectChapter: () => {}
      })
    );

    expect(markup).toContain("Chapter Navigator");
    expect(markup).toContain("Choose from 2 previewed chapters.");
    expect(markup).toContain("Choose a chapter title to open it in the reader.");
    expect(markup).not.toContain("Current chapter:");
  });

  test("ReaderPanel renders chapter controls in the header and an up-next action at the end", () => {
    const markup = renderToStaticMarkup(
      createElement(ReaderPanel, {
        isReaderStage: true,
        previewStatus: "ready",
        activeChapter: {
          index: 1,
          totalChapters: 2,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        },
        chapterDetailStatus: "success",
        chapterDetail: {
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          totalImages: 2,
          images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
        },
        chapterDetailError: null,
        previewError: null,
        previousChapter: null,
        nextChapter: {
          index: 2,
          totalChapters: 2,
          chapterTitle: "Chapter 2",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-2",
          images: ["https://img/preview-2.jpg"]
        },
        scrollContainerRef: createRef<HTMLDivElement>(),
        onReaderScroll: () => {},
        onRetry: () => {},
        onBackToSetup: () => {},
        onStopPreview: () => {},
        onOpenPreviousChapter: () => {},
        onOpenNextChapter: () => {},
        readerZoom: 85,
        onReaderZoomChange: () => {}
      })
    );

    expect(markup).toContain("Back to setup");
    expect(markup).toContain("Previous chapter");
    expect(markup).toContain("Next chapter");
    expect(markup).toContain("Reading now");
    expect(markup).toContain("Up next");
    expect(markup).toContain("Chapter 2");
    expect(markup).toContain("Open next chapter");
  });

  test("ReaderPanel keeps the zoom control in the header and marks the active zoom", () => {
    const { container, cleanup } = renderReaderPanel({
          isReaderStage: true,
          previewStatus: "ready",
          activeChapter: {
            index: 1,
            totalChapters: 2,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        },
        chapterDetailStatus: "success",
        chapterDetail: {
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          totalImages: 2,
          images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
        },
        chapterDetailError: null,
        previewError: null,
        previousChapter: null,
        nextChapter: {
          index: 2,
          totalChapters: 2,
          chapterTitle: "Chapter 2",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-2",
          images: ["https://img/preview-2.jpg"]
        },
        scrollContainerRef: createRef<HTMLDivElement>(),
        onReaderScroll: () => {},
        onRetry: () => {},
        onBackToSetup: () => {},
        onStopPreview: () => {},
          onOpenPreviousChapter: () => {},
          onOpenNextChapter: () => {},
          readerZoom: 85,
          onReaderZoomChange: () => {}
    });

    try {
      const header = container.querySelector(".reader-panel-header");
      const zoomControl = container.querySelector(".reader-zoom-control");

      expect(header).not.toBeNull();
      expect(zoomControl).not.toBeNull();
      expect(header?.contains(zoomControl)).toBe(true);
      expect(zoomControl?.textContent).toContain("Page size");
      expect(zoomControl?.textContent).toContain("50%");
      expect(zoomControl?.textContent).toContain("70%");
      expect(zoomControl?.textContent).toContain("85%");
      expect(zoomControl?.textContent).toContain("100%");
      expect(zoomControl?.querySelector('.reader-zoom-option[aria-pressed="false"]')?.textContent).toBe("50%");
      expect(zoomControl?.querySelector('.reader-zoom-option--active[aria-pressed="true"]')?.textContent).toBe("85%");
      expect(zoomControl?.querySelectorAll('.reader-zoom-option[aria-pressed="false"]').item(1)?.textContent).toBe("70%");
      expect(zoomControl?.querySelectorAll('.reader-zoom-option[aria-pressed="false"]').item(2)?.textContent).toBe("100%");
    } finally {
      cleanup();
    }
  });

  test("ReaderPanel keeps recovery controls visible when preview fails during reader-stage usage", () => {
    const markup = renderToStaticMarkup(
      createElement(ReaderPanel, {
        isReaderStage: true,
        previewStatus: "failed",
        activeChapter: {
          index: 1,
          totalChapters: 2,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        },
        chapterDetailStatus: "success",
        chapterDetail: {
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          totalImages: 2,
          images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
        },
        chapterDetailError: null,
        previewError: "Preview stream failed",
        previousChapter: null,
        nextChapter: {
          index: 2,
          totalChapters: 2,
          chapterTitle: "Chapter 2",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-2",
          images: ["https://img/preview-2.jpg"]
        },
        scrollContainerRef: createRef<HTMLDivElement>(),
        onReaderScroll: () => {},
        onRetry: () => {},
        onBackToSetup: () => {},
        onStopPreview: () => {},
        onOpenPreviousChapter: () => {},
        onOpenNextChapter: () => {},
        readerZoom: 85,
        onReaderZoomChange: () => {}
      })
    );

    expect(markup).toContain("Preview stream failed");
    expect(markup).toContain("Back to setup");
    expect(markup).toContain("Next chapter");
    expect(markup).toContain('aria-pressed="true"');
  });

  test("DownloadForm uses onSubmit fallback when dedicated handlers are undefined", () => {
    const onSubmit = vi.fn();
    const view = renderDownloadForm(
      buildDownloadFormProps({
        onDownloadAll: undefined,
        onDownloadSelected: undefined,
        onSubmit
      })
    );

    try {
      view.getButton("Download All Chapters").click();
      view.getButton("Download Selected Chapters (1)").click();

      expect(onSubmit).toHaveBeenCalledTimes(2);
    } finally {
      view.cleanup();
    }
  });

  test("DownloadForm clicks call intended download handlers", () => {
    const onDownloadAll = vi.fn();
    const onDownloadSelected = vi.fn();
    const view = renderDownloadForm(buildDownloadFormProps({ onDownloadAll, onDownloadSelected }));

    try {
      view.getButton("Download All Chapters").click();
      view.getButton("Download Selected Chapters (1)").click();

      expect(onDownloadAll).toHaveBeenCalledTimes(1);
      expect(onDownloadSelected).toHaveBeenCalledTimes(1);
    } finally {
      view.cleanup();
    }
  });

  test("DownloadForm disables selected download when no chapters are selected", () => {
    const view = renderDownloadForm(
      buildDownloadFormProps({
        canDownloadAll: false,
        canDownloadSelected: false,
        selectedChapterCount: 0
      })
    );

    try {
      expect(view.getButton("Download All Chapters").hasAttribute("disabled")).toBe(true);
      expect(view.getButton("Download Selected Chapters (0)").hasAttribute("disabled")).toBe(true);
    } finally {
      view.cleanup();
    }
  });

  test("App blocks selected download when no chapters are selected", async () => {
    const api = createMockDownloaderApi();
    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const selectedButton = Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Download Selected Chapters (0)"
      );
      if (!selectedButton) {
        throw new Error("Download Selected Chapters button not found");
      }

      expect(selectedButton.hasAttribute("disabled")).toBe(true);

      const forcedSelectedButton = selectedButton as HTMLButtonElement;
      forcedSelectedButton.disabled = false;
      flushSync(() => {
        forcedSelectedButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(api.startDownload).toHaveBeenCalledTimes(0);
      expect(container.textContent).not.toContain("No chapters selected. Falling back to Download All.");
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("DownloadForm surfaces preview validation feedback inline when preview is disabled", () => {
    const markup = renderToStaticMarkup(
      createElement(
        DownloadForm,
        {
          ...buildDownloadFormProps({
            canPreview: false,
            validationErrors: []
          }),
          previewValidationErrors: ["预览章节数必须是大于等于 1 的整数"]
        }
      )
    );

    expect(markup).toContain("Preview Chapters");
    expect(markup).toContain("disabled");
    expect(markup).toContain("预览章节数必须是大于等于 1 的整数");
  });

  test("App back navigation exits reader stage while chapter detail is still loading", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];
    const loadingRequest = deferred<{
      chapterTitle: string;
      chapterUrl: string;
      totalImages: number;
      images: string[];
    }>();

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: true })),
      loadPreviewChapter: vi.fn(async () => loadingRequest.promise),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      statusHandlers.forEach((handler) => {
        handler({ taskId: previewTaskId, state: "done" });
      });

      await Promise.resolve();

      const chapterButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      if (!chapterButton) {
        throw new Error("Chapter button not found");
      }

      chapterButton.click();
      await Promise.resolve();

      expect(container.querySelector("main.app-shell--reader-stage")).not.toBeNull();
      expect(container.textContent).toContain("Loading full chapter...");

      const returnToSetupButton = Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Back to setup"
      );
      if (!returnToSetupButton) {
        throw new Error("Back to setup button not found while loading");
      }

      returnToSetupButton.click();
      await Promise.resolve();

      expect(container.querySelector("main.app-shell--reader-stage")).toBeNull();
      expect(container.querySelector("main.app-shell--setup-stage")).not.toBeNull();
      expect(container.textContent).toContain("Download All Chapters");

      loadingRequest.resolve({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 2,
        images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(container.querySelector("main.app-shell--reader-stage")).toBeNull();
      expect(container.querySelector("main.app-shell--setup-stage")).not.toBeNull();
      expect(container.querySelectorAll(".reader-image")).toHaveLength(0);
      expect(container.textContent).not.toContain("Back to setup");
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App keeps stop preview reachable from reader stage while preview is still running", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: true })),
      loadPreviewChapter: vi.fn(async () => ({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 2,
        images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
      })),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn(() => () => {})
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 2,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      await Promise.resolve();

      const chapterButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      if (!chapterButton) {
        throw new Error("Chapter button not found");
      }

      chapterButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const stopPreviewButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (node) => node.textContent?.trim() === "Stop Preview"
      );
      if (!stopPreviewButton) {
        throw new Error("Stop Preview button not found in reader stage");
      }

      stopPreviewButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(api.stopPreview).toHaveBeenCalledWith(previewTaskId);
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App starts download when preview already settled before stopPreview responds", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async (taskId: string) => {
        statusHandlers.forEach((handler) => {
          handler({ taskId, state: "done" });
        });
        return { stopped: false };
      }),
      loadPreviewChapter: vi.fn(async () => ({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 2,
        images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
      })),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      await Promise.resolve();

      const downloadAllButton = Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Download All Chapters"
      );
      if (!downloadAllButton) {
        throw new Error("Download All Chapters button not found");
      }

      downloadAllButton.click();
      await waitForQueuedTimers();

      expect(api.stopPreview).toHaveBeenCalledWith(previewTaskId);
      expect(api.startDownload).toHaveBeenCalledTimes(1);
      expect(container.textContent).not.toContain("Stop preview failed. Download was not started.");
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App keeps a real stopPreview failure when preview remains active", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: false })),
      loadPreviewChapter: vi.fn(async () => ({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 2,
        images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
      })),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn(() => () => {})
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      previewHandlers.forEach((handler) => {
        handler({
          taskId: (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId,
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      await Promise.resolve();

      const downloadAllButton = Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Download All Chapters"
      );
      if (!downloadAllButton) {
        throw new Error("Download All Chapters button not found");
      }

      downloadAllButton.click();
      await waitForQueuedTimers();

      expect(api.startDownload).toHaveBeenCalledTimes(0);
      expect(container.textContent).toContain("Stop preview failed. Download was not started.");
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App ignores stopPreview false when preview already finished naturally", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async (taskId: string) => {
        statusHandlers.forEach((handler) => {
          handler({ taskId, state: "done" });
        });
        return { stopped: false };
      }),
      loadPreviewChapter: vi.fn(async () => ({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 2,
        images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
      })),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      await Promise.resolve();

      const stopPreviewButton = Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Stop Preview"
      );
      if (!stopPreviewButton) {
        throw new Error("Stop Preview button not found");
      }

      stopPreviewButton.click();
      await waitForQueuedTimers();

      expect(api.stopPreview).toHaveBeenCalledWith(previewTaskId);
      expect(container.textContent).not.toContain("Stop preview failed");
      expect(container.querySelector("button.chapter-row")).not.toBeNull();
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App chapter reader flow loads on click, retries after error, and renders full chapter images", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];
    const firstRequest = deferred<{
      chapterTitle: string;
      chapterUrl: string;
      totalImages: number;
      images: string[];
    }>();
    const secondRequest = deferred<{
      chapterTitle: string;
      chapterUrl: string;
      totalImages: number;
      images: string[];
    }>();

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: true })),
      loadPreviewChapter: vi
        .fn<DownloaderPreloadApi["loadPreviewChapter"]>()
        .mockImplementationOnce(async () => firstRequest.promise)
        .mockImplementationOnce(async () => ({
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          totalImages: 3,
          images: ["https://img/full-1.jpg", "https://img/full-2.jpg", "https://img/full-3.jpg"]
        })),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      expect(container.querySelector("main.app-shell--setup-stage")).not.toBeNull();
      expect(container.querySelector("main.app-shell--reader-stage")).toBeNull();

      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      statusHandlers.forEach((handler) => {
        handler({ taskId: previewTaskId, state: "done" });
      });

      await Promise.resolve();

      const chapterButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      if (!chapterButton) {
        throw new Error("Chapter button not found");
      }

      chapterButton.click();
      await Promise.resolve();

      expect(api.loadPreviewChapter).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain("Loading full chapter...");

      firstRequest.reject(new Error("network down"));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(container.textContent).toContain("network down");

      const retryButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Retry");
      if (!retryButton) {
        throw new Error("Retry button not found");
      }

      retryButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(api.loadPreviewChapter).toHaveBeenCalledTimes(2);
      expect(container.querySelector("main.app-shell--setup-stage")).toBeNull();
      expect(container.querySelector("main.app-shell--reader-stage")).not.toBeNull();
      expect(container.querySelectorAll(".reader-image")).toHaveLength(3);

      const returnToSetupButton = Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Back to setup"
      );
      if (!returnToSetupButton) {
        throw new Error("Back to setup button not found");
      }

      returnToSetupButton.click();
      await Promise.resolve();

      expect(container.querySelector("main.app-shell--reader-stage")).toBeNull();
      expect(container.querySelector("main.app-shell--setup-stage")).not.toBeNull();
      expect(container.textContent).toContain("Download All Chapters");
      expect(container.querySelectorAll(".reader-image")).toHaveLength(0);
      expect(container.textContent).not.toContain("Back to setup");
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App allows reloading a chapter after returning to setup while an older load is still pending", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];
    const firstRequest = deferred<{
      chapterTitle: string;
      chapterUrl: string;
      totalImages: number;
      images: string[];
    }>();
    const secondRequest = deferred<{
      chapterTitle: string;
      chapterUrl: string;
      totalImages: number;
      images: string[];
    }>();

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: true })),
      loadPreviewChapter: vi
        .fn<DownloaderPreloadApi["loadPreviewChapter"]>()
        .mockImplementationOnce(async () => firstRequest.promise)
        .mockImplementationOnce(async () => secondRequest.promise),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      statusHandlers.forEach((handler) => {
        handler({ taskId: previewTaskId, state: "done" });
      });
      await Promise.resolve();

      const chapterButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      if (!chapterButton) {
        throw new Error("Chapter 1 button not found");
      }

      chapterButton.click();
      await Promise.resolve();

      expect(api.loadPreviewChapter).toHaveBeenCalledTimes(1);

      const backToSetupButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Back to setup");
      if (!backToSetupButton) {
        throw new Error("Back to setup button not found");
      }

      backToSetupButton.click();
      await Promise.resolve();

      const chapterButtonAfterReturn = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      if (!chapterButtonAfterReturn) {
        throw new Error("Chapter 1 button not found after returning to setup");
      }

      chapterButtonAfterReturn.click();
      await Promise.resolve();

      expect(api.loadPreviewChapter).toHaveBeenCalledTimes(2);

      secondRequest.resolve({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 1,
        images: ["https://img/full-1.jpg"]
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      firstRequest.resolve({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 1,
        images: ["https://img/stale-full-1.jpg"]
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(container.querySelectorAll(".reader-image")).toHaveLength(1);
      expect(container.textContent).not.toContain("stale-full-1.jpg");
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App clears stale preview chapters and selection after the comic URL changes", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: true })),
      loadPreviewChapter: vi.fn(async ({ chapterUrl }) => ({
        chapterTitle: chapterUrl.endsWith("chapter-1") ? "Chapter 1" : "Chapter 2",
        chapterUrl,
        totalImages: 1,
        images: ["https://img/full.jpg"]
      })),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      statusHandlers.forEach((handler) => {
        handler({ taskId: previewTaskId, state: "done" });
      });
      await Promise.resolve();

      expect(container.textContent).toContain("Download Selected Chapters (1)");

      const urlInput = container.querySelector<HTMLInputElement>("#download-url");
      if (!urlInput) {
        throw new Error("Comic URL input not found");
      }

      const setInputValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (!setInputValue) {
        throw new Error("Input value setter not found");
      }

      flushSync(() => {
        setInputValue.call(urlInput, "https://www.2025copy.com/comic/new-slug");
        urlInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await Promise.resolve();

      expect(container.textContent).toContain("Download Selected Chapters (0)");
      expect(Array.from(container.querySelectorAll("button.chapter-row")).map((node) => node.textContent?.trim())).not.toContain("Chapter 1");

      const selectedButton = Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Download Selected Chapters (0)"
      );
      if (!selectedButton) {
        throw new Error("Download Selected Chapters button not found after URL change");
      }

      expect(selectedButton.hasAttribute("disabled")).toBe(true);

      (selectedButton as HTMLButtonElement).disabled = false;
      flushSync(() => {
        selectedButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await waitForQueuedTimers();

      expect(api.startDownload).toHaveBeenCalledTimes(0);
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App ignores rapid chapter switches while a full chapter load is already in flight", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];
    const firstRequest = deferred<{
      chapterTitle: string;
      chapterUrl: string;
      totalImages: number;
      images: string[];
    }>();
    const secondRequest = deferred<{
      chapterTitle: string;
      chapterUrl: string;
      totalImages: number;
      images: string[];
    }>();

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: true })),
      loadPreviewChapter: vi
        .fn<DownloaderPreloadApi["loadPreviewChapter"]>()
        .mockImplementationOnce(async () => firstRequest.promise)
        .mockImplementationOnce(async () => secondRequest.promise),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 2,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
        handler({
          taskId: previewTaskId,
          index: 2,
          totalChapters: 2,
          chapterTitle: "Chapter 2",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-2",
          images: ["https://img/preview-2.jpg"]
        });
      });
      statusHandlers.forEach((handler) => {
        handler({ taskId: previewTaskId, state: "done" });
      });

      await Promise.resolve();

      const chapterOneButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      const chapterTwoButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 2"
      );
      if (!chapterOneButton || !chapterTwoButton) {
        throw new Error("Chapter buttons not found");
      }

      chapterOneButton.click();
      chapterTwoButton.click();
      await Promise.resolve();

      expect(api.loadPreviewChapter).toHaveBeenCalledTimes(1);
      expect((api.loadPreviewChapter as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toEqual({
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1"
      });

      const loadingButtons = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row"));
      expect(loadingButtons).toHaveLength(2);
      expect(loadingButtons.every((button) => button.disabled)).toBe(true);

      firstRequest.resolve({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 1,
        images: ["https://img/full-1.jpg"]
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      const chapterTwoButtonAfterFirstLoad = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 2"
      );
      if (!chapterTwoButtonAfterFirstLoad) {
        throw new Error("Chapter 2 button not found after first load");
      }

      chapterTwoButtonAfterFirstLoad.click();
      await Promise.resolve();

      expect(api.loadPreviewChapter).toHaveBeenCalledTimes(2);
      expect((api.loadPreviewChapter as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toEqual({
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-2"
      });

      const previousButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (node) => node.textContent?.trim() === "Previous chapter"
      );
      if (!previousButton) {
        throw new Error("Previous chapter button not found while second load is active");
      }

      expect(previousButton.disabled).toBe(true);

      secondRequest.resolve({
        chapterTitle: "Chapter 2",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-2",
        totalImages: 1,
        images: ["https://img/full-2.jpg"]
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App reader shows an end-of-chapter next action that opens the next chapter", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: true })),
      loadPreviewChapter: vi
        .fn<DownloaderPreloadApi["loadPreviewChapter"]>()
        .mockImplementationOnce(async () => ({
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          totalImages: 2,
          images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
        }))
        .mockImplementationOnce(async () => ({
          chapterTitle: "Chapter 2",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-2",
          totalImages: 1,
          images: ["https://img/full-3.jpg"]
        })),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 2,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
        handler({
          taskId: previewTaskId,
          index: 2,
          totalChapters: 2,
          chapterTitle: "Chapter 2",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-2",
          images: ["https://img/preview-2.jpg"]
        });
      });
      statusHandlers.forEach((handler) => {
        handler({ taskId: previewTaskId, state: "done" });
      });

      await Promise.resolve();

      const chapterButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      if (!chapterButton) {
        throw new Error("Chapter 1 button not found");
      }

      chapterButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(container.textContent).toContain("Up next");
      expect(container.textContent).toContain("Chapter 2");

      const nextActionButton = Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Open next chapter"
      );
      if (!nextActionButton) {
        throw new Error("Open next chapter button not found");
      }

      nextActionButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(api.loadPreviewChapter).toHaveBeenCalledTimes(2);
      expect((api.loadPreviewChapter as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toEqual({
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-2"
      });
      expect(container.textContent).toContain("Chapter 2");
      expect(container.querySelectorAll(".reader-image")).toHaveLength(1);
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App applies the selected reader zoom to loaded reader images", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: true })),
      loadPreviewChapter: vi.fn(async () => ({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 2,
        images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
      })),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      statusHandlers.forEach((handler) => {
        handler({ taskId: previewTaskId, state: "done" });
      });
      await Promise.resolve();

      const chapterButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      if (!chapterButton) {
        throw new Error("Chapter 1 button not found");
      }

      chapterButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const zoomButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (node) => node.textContent?.trim() === "70%"
      );
      if (!zoomButton) {
        throw new Error("70% zoom button not found");
      }

      zoomButton.click();
      await Promise.resolve();

      const firstFrame = container.querySelector<HTMLElement>(".reader-image-frame");
      if (!firstFrame) {
        throw new Error("Reader image frame not found");
      }

      expect(firstFrame.getAttribute("style")).toContain("width: 70%");
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App restores the prior scroll position when returning to a chapter", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: true })),
      loadPreviewChapter: vi.fn<DownloaderPreloadApi["loadPreviewChapter"]>(async ({ chapterUrl }) => ({
        chapterTitle: chapterUrl.endsWith("chapter-1") ? "Chapter 1" : "Chapter 2",
        chapterUrl,
        totalImages: 2,
        images: chapterUrl.endsWith("chapter-1")
          ? ["https://img/full-1.jpg", "https://img/full-2.jpg"]
          : ["https://img/full-3.jpg", "https://img/full-4.jpg"]
      })),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!previewTaskId) {
        throw new Error("Preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: previewTaskId,
          index: 1,
          totalChapters: 2,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
        handler({
          taskId: previewTaskId,
          index: 2,
          totalChapters: 2,
          chapterTitle: "Chapter 2",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-2",
          images: ["https://img/preview-2.jpg"]
        });
      });
      statusHandlers.forEach((handler) => {
        handler({ taskId: previewTaskId, state: "done" });
      });

      await Promise.resolve();

      const chapterOneButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      if (!chapterOneButton) {
        throw new Error("Chapter 1 button not found");
      }

      chapterOneButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const firstScroller = container.querySelector<HTMLDivElement>(".reader-image-stream");
      if (!firstScroller) {
        throw new Error("Reader scroller not found for Chapter 1");
      }

      firstScroller.scrollTop = 240;
      flushSync(() => {
        firstScroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await waitForAnimationFrame();

      const nextActionButton = Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Open next chapter"
      );
      if (!nextActionButton) {
        throw new Error("Open next chapter button not found");
      }

      nextActionButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(container.textContent).toContain("Chapter 2");

      const previousButton = Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Previous chapter"
      );
      if (!previousButton) {
        throw new Error("Previous chapter button not found");
      }

      previousButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const restoredScroller = container.querySelector<HTMLDivElement>(".reader-image-stream");
      if (!restoredScroller) {
        throw new Error("Reader scroller not found after returning to Chapter 1");
      }

      expect(container.textContent).toContain("Chapter 1");
      expect(restoredScroller.scrollTop).toBe(240);
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("App ignores queued reader scroll persistence after a preview reset", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    let queuedFrame: ((time: number) => void) | null = null;

    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      queuedFrame = callback;
      return 1;
    });
    window.cancelAnimationFrame = vi.fn(() => {});

    const api: DownloaderPreloadApi = {
      startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
      stopDownload: vi.fn(async () => ({ stopped: true })),
      startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
      stopPreview: vi.fn(async () => ({ stopped: true })),
      loadPreviewChapter: vi.fn(async ({ chapterUrl }) => ({
        chapterTitle: chapterUrl.endsWith("chapter-1") ? "Chapter 1" : "Chapter 2",
        chapterUrl,
        totalImages: 1,
        images: ["https://img/full.jpg"]
      })),
      selectOutputDir: vi.fn(async () => null),
      openOutputDir: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
      onPreviewLog: vi.fn(() => () => {}),
      onPreviewChapter: vi.fn((handler) => {
        previewHandlers.push(handler);
        return () => {
          const index = previewHandlers.indexOf(handler);
          if (index >= 0) {
            previewHandlers.splice(index, 1);
          }
        };
      }),
      onPreviewStatus: vi.fn((handler) => {
        statusHandlers.push(handler);
        return () => {
          const index = statusHandlers.indexOf(handler);
          if (index >= 0) {
            statusHandlers.splice(index, 1);
          }
        };
      })
    };

    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    try {
      const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!previewButton) {
        throw new Error("Preview Chapters button not found");
      }

      previewButton.click();
      await Promise.resolve();

      const firstPreviewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
      if (!firstPreviewTaskId) {
        throw new Error("First preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: firstPreviewTaskId,
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      statusHandlers.forEach((handler) => {
        handler({ taskId: firstPreviewTaskId, state: "done" });
      });
      await Promise.resolve();

      const chapterButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      if (!chapterButton) {
        throw new Error("Chapter 1 button not found");
      }

      chapterButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const firstScroller = container.querySelector<HTMLDivElement>(".reader-image-stream");
      if (!firstScroller) {
        throw new Error("Reader scroller not found for first preview");
      }

      firstScroller.scrollTop = 240;
      flushSync(() => {
        firstScroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      });

      expect(queuedFrame).not.toBeNull();

      const backToSetupButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Back to setup");
      if (!backToSetupButton) {
        throw new Error("Back to setup button not found");
      }

      backToSetupButton.click();
      await Promise.resolve();

      const secondPreviewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
      if (!secondPreviewButton) {
        throw new Error("Preview Chapters button not found after returning to setup");
      }

      secondPreviewButton.click();
      await Promise.resolve();

      const secondPreviewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]?.taskId;
      if (!secondPreviewTaskId) {
        throw new Error("Second preview task id not captured");
      }

      previewHandlers.forEach((handler) => {
        handler({
          taskId: secondPreviewTaskId,
          index: 1,
          totalChapters: 1,
          chapterTitle: "Chapter 1",
          chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
          images: ["https://img/preview-1.jpg"]
        });
      });
      statusHandlers.forEach((handler) => {
        handler({ taskId: secondPreviewTaskId, state: "done" });
      });
      await Promise.resolve();

      const pendingFrame = queuedFrame;
      if (pendingFrame) {
        (pendingFrame as (time: number) => void)(16);
      }
      await Promise.resolve();

      const secondChapterButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
        (node) => node.textContent?.trim() === "Chapter 1"
      );
      if (!secondChapterButton) {
        throw new Error("Chapter 1 button not found for second preview");
      }

      secondChapterButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const restoredScroller = container.querySelector<HTMLDivElement>(".reader-image-stream");
      if (!restoredScroller) {
        throw new Error("Reader scroller not found for second preview");
      }

      expect(restoredScroller.scrollTop).toBe(0);
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });
});
