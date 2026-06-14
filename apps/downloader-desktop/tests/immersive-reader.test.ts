/// <reference types="vitest" />

import { createElement, createRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ReaderPanel } from "../src/renderer/components/ReaderPanel";
import { App } from "../src/renderer/App";
import type { DownloaderPreloadApi } from "../src/preload";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return { promise, resolve, reject };
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

describe("immersive reader", () => {
  test("ReaderPanel renders the immersive toggle button when onToggleImmersive is provided", () => {
    const onToggleImmersive = vi.fn();
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
        nextChapter: null,
        scrollContainerRef: createRef<HTMLDivElement>(),
        onReaderScroll: () => {},
        onRetry: () => {},
        onBackToSetup: () => {},
        onStopPreview: () => {},
        onOpenPreviousChapter: () => {},
        onOpenNextChapter: () => {},
        readerZoom: 85,
        onReaderZoomChange: () => {},
        immersiveReader: false,
        onToggleImmersive
      })
    );

    expect(markup).toContain("Enter fullscreen");
    expect(markup).not.toContain("Exit fullscreen");
  });

  test("ReaderPanel shows exit fullscreen icon when immersiveReader is true", () => {
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
        nextChapter: null,
        scrollContainerRef: createRef<HTMLDivElement>(),
        onReaderScroll: () => {},
        onRetry: () => {},
        onBackToSetup: () => {},
        onStopPreview: () => {},
        onOpenPreviousChapter: () => {},
        onOpenNextChapter: () => {},
        readerZoom: 85,
        onReaderZoomChange: () => {},
        immersiveReader: true,
        onToggleImmersive: () => {}
      })
    );

    expect(markup).toContain("Exit fullscreen");
  });

  test("ReaderPanel applies reader-panel-header--immersive class when in immersive mode", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(
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
          nextChapter: null,
          scrollContainerRef: createRef<HTMLDivElement>(),
          onReaderScroll: () => {},
          onRetry: () => {},
          onBackToSetup: () => {},
          onStopPreview: () => {},
          onOpenPreviousChapter: () => {},
          onOpenNextChapter: () => {},
          readerZoom: 85,
          onReaderZoomChange: () => {},
          immersiveReader: true,
          onToggleImmersive: () => {}
        })
      );
    });

    try {
      const header = container.querySelector(".reader-panel-header--immersive");
      expect(header).not.toBeNull();
    } finally {
      root.unmount();
      container.remove();
    }
  });

  test("ReaderPanel does not render immersive anchor when not in immersive mode", () => {
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
        nextChapter: null,
        scrollContainerRef: createRef<HTMLDivElement>(),
        onReaderScroll: () => {},
        onRetry: () => {},
        onBackToSetup: () => {},
        onStopPreview: () => {},
        onOpenPreviousChapter: () => {},
        onOpenNextChapter: () => {},
        readerZoom: 85,
        onReaderZoomChange: () => {},
        immersiveReader: false,
        onToggleImmersive: () => {}
      })
    );

    expect(markup).not.toContain("reader-immersive-anchor");
  });

  test("ReaderPanel renders immersive anchor when in immersive mode", () => {
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
        nextChapter: null,
        scrollContainerRef: createRef<HTMLDivElement>(),
        onReaderScroll: () => {},
        onRetry: () => {},
        onBackToSetup: () => {},
        onStopPreview: () => {},
        onOpenPreviousChapter: () => {},
        onOpenNextChapter: () => {},
        readerZoom: 85,
        onReaderZoomChange: () => {},
        immersiveReader: true,
        onToggleImmersive: () => {}
      })
    );

    expect(markup).toContain("reader-immersive-anchor");
  });

  test("App toggles immersive mode and applies app-shell--immersive class", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];
    const chapterRequest = deferred<{
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
      loadPreviewChapter: vi.fn(async () => chapterRequest.promise),
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
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(container.querySelector("main.app-shell--reader-stage")).not.toBeNull();
      expect(container.querySelector("main.app-shell--immersive")).toBeNull();

      chapterRequest.resolve({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 2,
        images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      let immersiveButton: HTMLButtonElement | null = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        immersiveButton = container.querySelector<HTMLButtonElement>('button[aria-label="Enter fullscreen"]');
        if (immersiveButton) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (!immersiveButton) {
        const debugText = container.textContent?.slice(0, 500);
        const allButtons = Array.from(container.querySelectorAll("button")).map((b) => `${b.textContent?.trim()}[aria-label=${b.getAttribute("aria-label")}]`).join(", ");
        throw new Error(`Enter fullscreen button not found. Debug: ${debugText} Buttons: ${allButtons}`);
      }

      immersiveButton.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container.querySelector("main.app-shell--immersive")).not.toBeNull();
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });

  test("ESC key exits immersive mode when active", async () => {
    const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
    const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];
    const chapterRequest = deferred<{
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
      loadPreviewChapter: vi.fn(async () => chapterRequest.promise),
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
      await new Promise((resolve) => setTimeout(resolve, 100));

      chapterRequest.resolve({
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 2,
        images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      let immersiveButton: HTMLButtonElement | null = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        immersiveButton = container.querySelector<HTMLButtonElement>('button[aria-label="Enter fullscreen"]');
        if (immersiveButton) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (!immersiveButton) {
        throw new Error("Enter fullscreen button not found");
      }

      immersiveButton.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container.querySelector("main.app-shell--immersive")).not.toBeNull();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container.querySelector("main.app-shell--immersive")).toBeNull();
    } finally {
      root.unmount();
      container.remove();
      window.downloader = previousApi;
    }
  });
});