import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCheckpointStore } from "../src/state/checkpoint.js";
import { downloadToFile } from "../src/download/httpDownload.js";
import { downloadChapterImages } from "../src/download/chapterDownloader.js";

vi.mock("../src/download/httpDownload.js", () => ({
  downloadToFile: vi.fn()
}));

const mockedDownloadToFile = vi.mocked(downloadToFile);
const tempDirs: string[] = [];

afterEach(() => {
  mockedDownloadToFile.mockReset();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("downloadChapterImages", () => {
  it("reports real-time write progress for each saved image", async () => {
    const dir = mkdtempSync(join(tmpdir(), "chapter-downloader-"));
    tempDirs.push(dir);

    mockedDownloadToFile.mockResolvedValue({
      attempts: 1,
      bytes: 2048,
      contentType: "image/webp"
    });

    const onImageWritten = vi.fn();
    const checkpoint = createCheckpointStore(join(dir, "checkpoint.json"));

    const summary = await downloadChapterImages({
      chapterTitle: "chapter",
      chapterUrl: "https://www.2025copy.com/comic/guichuyinxiong/1",
      chapterDir: join(dir, "chapter-1"),
      images: [
        {
          index: 1,
          url: "https://cdn.example.com/1.webp",
          ext: "webp"
        }
      ],
      retries: 1,
      timeoutMs: 1000,
      concurrency: 2,
      userAgent: "test-agent",
      checkpoint,
      onImageWritten
    });

    expect(summary.downloadedCount).toBe(1);
    expect(onImageWritten).toHaveBeenCalledWith({
      fileName: "001.webp",
      bytes: 2048,
      writtenImages: 1,
      writtenBytes: 2048
    });
  });
});
