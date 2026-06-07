import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chapter, DownloaderConfig, ImageEntry } from "../src/types.js";

const mocks = vi.hoisted(() => {
  const page = {};
  const context = {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined)
  };
  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined)
  };

  return {
    page,
    context,
    browser,
    launch: vi.fn(async () => browser),
    discoverChapters: vi.fn(async () => [] as Chapter[]),
    extractChapterImages: vi.fn(async (..._args: unknown[]) => [] as ImageEntry[]),
    downloadChapterImages: vi.fn(async (..._args: unknown[]) => ({
      chapterTitle: "",
      chapterUrl: "",
      chapterDir: "",
      extractedCount: 0,
      downloadedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: []
    })),
    createCheckpointStore: vi.fn(() => ({
      has: vi.fn(async () => false),
      markDone: vi.fn(async () => undefined)
    })),
    mkdir: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined)
  };
});

vi.mock("playwright", () => ({
  chromium: {
    launch: mocks.launch
  }
}));

vi.mock("../src/site2025copy/discoverChapters.js", () => ({
  discoverChapters: mocks.discoverChapters
}));

vi.mock("../src/site2025copy/extractChapterImages.js", () => ({
  extractChapterImages: mocks.extractChapterImages
}));

vi.mock("../src/download/chapterDownloader.js", () => ({
  downloadChapterImages: mocks.downloadChapterImages
}));

vi.mock("../src/state/checkpoint.js", () => ({
  createCheckpointStore: mocks.createCheckpointStore
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile
}));

import { runDownloader, runPreview, runPreviewChapter } from "../src/main.js";

function createConfig(overrides: Partial<DownloaderConfig> = {}): DownloaderConfig {
  return {
    url: "https://www.2025copy.com/comic/demo",
    outputDir: "./downloads",
    mode: "download",
    concurrency: 1,
    retries: 1,
    timeoutMs: 1000,
    headless: true,
    previewMaxChapters: 2,
    previewImagesPerChapter: 2,
    chapterUrls: [],
    userAgent: "test-agent",
    chapterDelayMs: 0,
    eventsJson: false,
    ...overrides
  };
}

beforeEach(() => {
  mocks.context.newPage.mockResolvedValue(mocks.page);
  mocks.context.close.mockResolvedValue(undefined);
  mocks.browser.newContext.mockResolvedValue(mocks.context);
  mocks.browser.close.mockResolvedValue(undefined);
  mocks.launch.mockResolvedValue(mocks.browser);

  const chapters: Chapter[] = [
    { title: "第1话", url: "https://www.2025copy.com/comic/demo/chapter/a", order: 1 },
    { title: "第2话", url: "https://www.2025copy.com/comic/demo/chapter/b", order: 2 },
    { title: "第3话", url: "https://www.2025copy.com/comic/demo/chapter/c", order: 3 }
  ];
  mocks.discoverChapters.mockResolvedValue(chapters);

  mocks.extractChapterImages.mockImplementation(async (...args: unknown[]) => {
    const chapterUrl = String(args[1]);
    return [
      { index: 1, url: `${chapterUrl}/img-1.webp`, ext: "webp" },
      { index: 2, url: `${chapterUrl}/img-2.webp`, ext: "webp" },
      { index: 3, url: `${chapterUrl}/img-3.webp`, ext: "webp" }
    ];
  });

  mocks.downloadChapterImages.mockImplementation(async (...args: unknown[]) => {
    const input = args[0] as {
      chapterTitle: string;
      chapterUrl: string;
      chapterDir: string;
      images: ImageEntry[];
    };
    return {
      chapterTitle: input.chapterTitle,
      chapterUrl: input.chapterUrl,
      chapterDir: input.chapterDir,
      extractedCount: input.images.length,
      downloadedCount: input.images.length,
      skippedCount: 0,
      failedCount: 0,
      failures: []
    };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("runDownloader chapter selection", () => {
  it("keeps all discovered chapters when chapterUrls is empty", async () => {
    await runDownloader(createConfig());

    expect(mocks.downloadChapterImages).toHaveBeenCalledTimes(3);
    const chapterUrls = mocks.downloadChapterImages.mock.calls.map((call) => {
      const input = call[0] as { chapterUrl: string } | undefined;
      return input?.chapterUrl;
    });
    expect(chapterUrls).toEqual([
      "https://www.2025copy.com/comic/demo/chapter/a",
      "https://www.2025copy.com/comic/demo/chapter/b",
      "https://www.2025copy.com/comic/demo/chapter/c"
    ]);
  });

  it("downloads only chapters whose URL is selected", async () => {
    await runDownloader(
      createConfig({
        chapterUrls: [
          "https://www.2025copy.com/comic/demo/chapter/b",
          "https://www.2025copy.com/comic/demo/chapter/c"
        ]
      })
    );

    expect(mocks.downloadChapterImages).toHaveBeenCalledTimes(2);
    const chapterUrls = mocks.downloadChapterImages.mock.calls.map((call) => {
      const input = call[0] as { chapterUrl: string } | undefined;
      return input?.chapterUrl;
    });
    expect(chapterUrls).toEqual([
      "https://www.2025copy.com/comic/demo/chapter/b",
      "https://www.2025copy.com/comic/demo/chapter/c"
    ]);
  });

  it("matches selected chapter URLs after normalizing slash/query/hash", async () => {
    await runDownloader(
      createConfig({
        chapterUrls: ["https://www.2025copy.com/comic/demo/chapter/b/?from=list#top"]
      })
    );

    expect(mocks.downloadChapterImages).toHaveBeenCalledTimes(1);
    const firstInput = mocks.downloadChapterImages.mock.calls[0]?.[0] as { chapterUrl: string } | undefined;
    expect(firstInput?.chapterUrl).toBe(
      "https://www.2025copy.com/comic/demo/chapter/b"
    );
  });

  it("emits run.error and throws when any selected chapter URL is unmatched", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await expect(
      runDownloader(
        createConfig({
          eventsJson: true,
          chapterUrls: [
            "https://www.2025copy.com/comic/demo/chapter/b",
            "https://www.2025copy.com/comic/demo/chapter/missing"
          ]
        })
      )
    ).rejects.toThrow(/chapter-url/);

    const payloads = stdoutSpy.mock.calls.map((call) => JSON.parse(String(call[0]).trim()) as { type: string });
    expect(payloads.map((payload) => payload.type)).toEqual(["run.start", "run.error"]);
    expect(mocks.downloadChapterImages).not.toHaveBeenCalled();
  });
});

describe("runPreview", () => {
  it("emits preview events with chapter and image limits and does not write files", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runPreview(
      createConfig({
        mode: "preview",
        eventsJson: true,
        previewMaxChapters: 2,
        previewImagesPerChapter: 2
      })
    );

    const payloads = stdoutSpy.mock.calls.map((call) => JSON.parse(String(call[0]).trim()) as { type: string });

    expect(payloads.map((payload) => payload.type)).toEqual([
      "preview.start",
      "preview.chapter",
      "preview.chapter",
      "preview.done"
    ]);

    expect(payloads[1]).toMatchObject({
      chapterUrl: "https://www.2025copy.com/comic/demo/chapter/a",
      totalImages: 3,
      images: [
        "https://www.2025copy.com/comic/demo/chapter/a/img-1.webp",
        "https://www.2025copy.com/comic/demo/chapter/a/img-2.webp"
      ]
    });
    expect(payloads[2]).toMatchObject({
      chapterUrl: "https://www.2025copy.com/comic/demo/chapter/b",
      totalImages: 3,
      images: [
        "https://www.2025copy.com/comic/demo/chapter/b/img-1.webp",
        "https://www.2025copy.com/comic/demo/chapter/b/img-2.webp"
      ]
    });

    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.downloadChapterImages).not.toHaveBeenCalled();
  });

  it("emits only remote http/https URLs in preview.chapter images", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    mocks.extractChapterImages.mockResolvedValueOnce([
      { index: 1, url: "data:image/png;base64,AAA", ext: "png" },
      { index: 2, url: "blob:https://www.2025copy.com/abc", ext: "webp" },
      { index: 3, url: "file:///tmp/local.webp", ext: "webp" },
      { index: 4, url: "http://cdn.example.com/1.webp", ext: "webp" },
      { index: 5, url: "https://cdn.example.com/2.webp", ext: "webp" }
    ]);

    await runPreview(
      createConfig({
        mode: "preview",
        eventsJson: true,
        previewMaxChapters: 1,
        previewImagesPerChapter: 10
      })
    );

    const payloads = stdoutSpy.mock.calls.map((call) => JSON.parse(String(call[0]).trim()) as { type: string });
    const chapterPayload = payloads.find((payload) => payload.type === "preview.chapter") as
      | { images: string[] }
      | undefined;

    expect(chapterPayload?.images).toEqual([
      "http://cdn.example.com/1.webp",
      "https://cdn.example.com/2.webp"
    ]);
  });

  it("emits preview.error in events-json mode when preview fails", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    mocks.discoverChapters.mockRejectedValueOnce(new Error("preview failed"));

    await expect(
      runPreview(
        createConfig({
          mode: "preview",
          eventsJson: true
        })
      )
    ).rejects.toThrow("preview failed");

    const payloads = stdoutSpy.mock.calls.map((call) => JSON.parse(String(call[0]).trim()) as { type: string });
    expect(payloads.map((payload) => payload.type)).toEqual(["preview.start", "preview.error"]);
    expect(payloads[1]).toMatchObject({ error: "preview failed" });
  });

  it("emits preview.error and throws when any selected chapter URL is unmatched", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await expect(
      runPreview(
        createConfig({
          mode: "preview",
          eventsJson: true,
          chapterUrls: [
            "https://www.2025copy.com/comic/demo/chapter/b",
            "https://www.2025copy.com/comic/demo/chapter/missing"
          ]
        })
      )
    ).rejects.toThrow(/chapter-url/);

    const payloads = stdoutSpy.mock.calls.map((call) => JSON.parse(String(call[0]).trim()) as { type: string });
    expect(payloads.map((payload) => payload.type)).toEqual(["preview.start", "preview.error"]);
    expect(mocks.extractChapterImages).not.toHaveBeenCalled();
  });
});

describe("runPreviewChapter", () => {
  it("emits preview.chapterDetail with full ordered image URLs", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    mocks.extractChapterImages.mockResolvedValueOnce([
      { index: 1, url: "https://cdn.example.com/chapter-b-1.webp", ext: "webp" },
      { index: 2, url: "blob:https://www.2025copy.com/abc", ext: "webp" },
      { index: 3, url: "https://cdn.example.com/chapter-b-3.webp", ext: "webp" },
      { index: 4, url: "https://cdn.example.com/chapter-b-4.webp", ext: "webp" }
    ]);

    await runPreviewChapter(
      createConfig({
        mode: "preview-chapter",
        eventsJson: true,
        previewImagesPerChapter: 1,
        chapterUrls: ["https://www.2025copy.com/comic/demo/chapter/b"]
      })
    );

    const payloads = stdoutSpy.mock.calls.map((call) => JSON.parse(String(call[0]).trim()) as { type: string });
    expect(payloads.map((payload) => payload.type)).toEqual([
      "preview.start",
      "preview.chapterDetail",
      "preview.done"
    ]);

    expect(payloads[1]).toMatchObject({
      chapterUrl: "https://www.2025copy.com/comic/demo/chapter/b",
      chapterTitle: "第2话",
      images: [
        "https://cdn.example.com/chapter-b-1.webp",
        "https://cdn.example.com/chapter-b-3.webp",
        "https://cdn.example.com/chapter-b-4.webp"
      ]
    });
  });

  it("falls back to the requested chapter URL when discovery misses that chapter", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    mocks.discoverChapters.mockResolvedValueOnce([
      { title: "第1话", url: "https://www.2025copy.com/comic/demo/chapter/a", order: 1 }
    ]);

    await runPreviewChapter(
      createConfig({
        mode: "preview-chapter",
        eventsJson: true,
        chapterUrls: ["https://www.2025copy.com/comic/demo/chapter/missing"]
      })
    );

    const payloads = stdoutSpy.mock.calls.map((call) => JSON.parse(String(call[0]).trim()) as { type: string });
    expect(payloads.map((payload) => payload.type)).toEqual([
      "preview.start",
      "preview.chapterDetail",
      "preview.done"
    ]);
    expect(payloads[1]).toMatchObject({
      chapterUrl: "https://www.2025copy.com/comic/demo/chapter/missing"
    });

    expect(mocks.extractChapterImages).toHaveBeenCalledWith(
      mocks.page,
      "https://www.2025copy.com/comic/demo/chapter/missing",
      1000
    );
  });
});
