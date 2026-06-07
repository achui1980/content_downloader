/// <reference types="vitest" />

import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { describe, expect, test, vi } from "vitest";
import { requestPreviewChapterDetail } from "../src/main/preview-chapter-request";

class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  killed = false;

  kill(): boolean {
    this.killed = true;
    this.emit("close", 0, null);
    return true;
  }
}

type SpawnMock = ReturnType<typeof vi.fn<(command: string, args: string[], options: object) => FakeChildProcess>>;

function createSpawnMock(child: FakeChildProcess): SpawnMock {
  return vi.fn<(command: string, args: string[], options: object) => FakeChildProcess>(() => child);
}

describe("requestPreviewChapterDetail", () => {
  test("spawns downloader in preview-chapter mode and resolves chapter detail", async () => {
    const child = new FakeChildProcess();
    const spawnMock = createSpawnMock(child);
    const promise = requestPreviewChapterDetail(
      {
        chapterUrl: "https://www.2025copy.com/comic/slug/chapter-1"
      },
      {
        spawnProcess: spawnMock,
        resolveDownloaderPath: () => ({
          cwd: "/tmp/downloader-tool",
          command: "npm",
          argsPrefix: ["run", "start", "--"]
        })
      }
    );

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const args = spawnMock.mock.calls[0][1];
    expect(args).toContain("--mode");
    expect(args).toContain("preview-chapter");
    expect(args).toContain("--chapter-url");
    expect(args).toContain("https://www.2025copy.com/comic/slug/chapter-1");
    expect(args).toContain("--events-json");

    child.stdout.write(
      `${JSON.stringify({
        type: "preview.chapterDetail",
        chapterTitle: " Chapter 1 ",
        chapterUrl: " https://www.2025copy.com/comic/slug/chapter-1 ",
        totalImages: 5,
        images: ["https://img.example/1.webp", "", "https://img.example/2.webp"]
      })}\n`
    );

    await expect(promise).resolves.toEqual({
      chapterTitle: "Chapter 1",
      chapterUrl: "https://www.2025copy.com/comic/slug/chapter-1",
      totalImages: 2,
      images: ["https://img.example/1.webp", "https://img.example/2.webp"]
    });
  });

  test("rejects when downloader emits preview.error", async () => {
    const child = new FakeChildProcess();
    const promise = requestPreviewChapterDetail(
      {
        chapterUrl: "https://www.2025copy.com/comic/slug/chapter-1"
      },
      {
        spawnProcess: createSpawnMock(child),
        resolveDownloaderPath: () => ({
          cwd: "/tmp/downloader-tool",
          command: "npm",
          argsPrefix: ["run", "start", "--"]
        })
      }
    );

    child.stdout.write(`${JSON.stringify({ type: "preview.error", error: "boom" })}\n`);

    await expect(promise).rejects.toThrow("boom");
  });

  test("rejects when downloader exits before chapter detail", async () => {
    const child = new FakeChildProcess();
    const promise = requestPreviewChapterDetail(
      {
        chapterUrl: "https://www.2025copy.com/comic/slug/chapter-1"
      },
      {
        spawnProcess: createSpawnMock(child),
        resolveDownloaderPath: () => ({
          cwd: "/tmp/downloader-tool",
          command: "npm",
          argsPrefix: ["run", "start", "--"]
        })
      }
    );

    child.emit("close", 1, null);

    await expect(promise).rejects.toThrow("Downloader exited with code 1");
  });
});
