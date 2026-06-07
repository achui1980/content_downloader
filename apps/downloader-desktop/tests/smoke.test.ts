/// <reference types="vitest" />

import { describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { DownloadForm } from "../src/renderer/components/DownloadForm";
import { App } from "../src/renderer/App";
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

function createMockDownloaderApi(): DownloaderPreloadApi {
  return {
    startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
    stopDownload: vi.fn(async () => ({ stopped: true })),
    startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
    stopPreview: vi.fn(async () => ({ stopped: true })),
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

  test("DownloadForm renders download actions and accessible field semantics", () => {
    const markup = renderToStaticMarkup(createElement(DownloadForm, buildDownloadFormProps({ validationErrors: ["Validation message"] })));

    expect(markup).toContain("Download All");
    expect(markup).toContain("Download Selected (1)");
    expect(markup).toContain('type="url"');
    expect(markup).toContain('aria-live="polite"');
  });

  test("DownloadForm remains renderable with legacy onSubmit fallback", () => {
    const markup = renderToStaticMarkup(createElement(DownloadForm, buildDownloadFormProps({ onSubmit: () => {} })));

    expect(markup).toContain("Download All");
    expect(markup).toContain("Download Selected (1)");
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

    view.getButton("Download All").click();
    view.getButton("Download Selected (1)").click();

    expect(onSubmit).toHaveBeenCalledTimes(2);
    view.cleanup();
  });

  test("DownloadForm clicks call intended download handlers", () => {
    const onDownloadAll = vi.fn();
    const onDownloadSelected = vi.fn();
    const view = renderDownloadForm(buildDownloadFormProps({ onDownloadAll, onDownloadSelected }));

    view.getButton("Download All").click();
    view.getButton("Download Selected (1)").click();

    expect(onDownloadAll).toHaveBeenCalledTimes(1);
    expect(onDownloadSelected).toHaveBeenCalledTimes(1);
    view.cleanup();
  });

  test("DownloadForm supports separate download button enablement", () => {
    const view = renderDownloadForm(buildDownloadFormProps({ canDownloadAll: false, canDownloadSelected: true }));

    expect(view.getButton("Download All").hasAttribute("disabled")).toBe(true);
    expect(view.getButton("Download Selected (1)").hasAttribute("disabled")).toBe(false);
    view.cleanup();
  });

  test("App keeps selected-empty fallback notice visible after starting download", async () => {
    const api = createMockDownloaderApi();
    const previousApi = window.downloader;
    window.downloader = api;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(createElement(App));
    });

    const selectedButton = Array.from(container.querySelectorAll("button")).find(
      (node) => node.textContent?.trim() === "Download Selected (0)"
    );
    if (!selectedButton) {
      throw new Error("Download Selected button not found");
    }

    selectedButton.click();
    await Promise.resolve();

    expect(api.startDownload).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("No chapters selected. Falling back to Download All.");

    root.unmount();
    container.remove();
    window.downloader = previousApi;
  });
});
