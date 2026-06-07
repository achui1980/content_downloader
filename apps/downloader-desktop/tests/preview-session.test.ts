/// <reference types="vitest" />

import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { describe, expect, test, vi } from "vitest";
import { createPreviewSession } from "../src/main/preview-session";

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

describe("createPreviewSession", () => {
  test("spawns downloader with preview arguments", () => {
    const child = new FakeChildProcess();
    const spawnMock = createSpawnMock(child);
    const session = createPreviewSession({
      spawnProcess: spawnMock,
      resolveDownloaderPath: () => ({
        cwd: "/tmp/downloader-tool",
        command: "npm",
        argsPrefix: ["run", "start", "--"]
      })
    });

    session.start({
      url: "https://www.2025copy.com/comic/guichuyinxiong",
      previewMaxChapters: 5,
      previewImagesPerChapter: 3
    });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const args = spawnMock.mock.calls[0][1];
    expect(args).toContain("--mode");
    expect(args).toContain("preview");
    expect(args).toContain("--events-json");
    expect(args).toContain("--preview-max-chapters");
    expect(args).toContain("5");
    expect(args).toContain("--preview-images-per-chapter");
    expect(args).toContain("3");
  });

  test("routes preview events into status/chapter/log callbacks", () => {
    const child = new FakeChildProcess();
    const session = createPreviewSession({
      spawnProcess: createSpawnMock(child),
      resolveDownloaderPath: () => ({
        cwd: "/tmp/downloader-tool",
        command: "npm",
        argsPrefix: ["run", "start", "--"]
      })
    });

    const statuses: string[] = [];
    const chapters: string[] = [];
    const logs: string[] = [];

    session.start(
      {
        url: "https://www.2025copy.com/comic/guichuyinxiong",
        previewMaxChapters: 5,
        previewImagesPerChapter: 3
      },
      {
        onStatus: (event) => statuses.push(event.state),
        onChapter: (event) => chapters.push(`${event.index}/${event.totalChapters}:${event.chapterTitle}`),
        onLog: (event) => logs.push(`${event.source}:${event.line}`)
      }
    );

    child.stdout.write(`${JSON.stringify({ type: "preview.start" })}\n`);
    child.stdout.write(
      `${JSON.stringify({
        type: "preview.chapter",
        index: 1,
        totalChapters: 2,
        chapterTitle: "A",
        chapterUrl: "https://www.2025copy.com/comic/guichuyinxiong/chapter-1",
        images: ["https://img.example/1.webp"]
      })}\n`
    );
    child.stdout.write("plain stdout line\n");
    child.stderr.write("stderr line\n");

    expect(statuses).toContain("running");
    expect(chapters).toEqual(["1/2:A"]);
    expect(logs).toContain("stdout:plain stdout line");
    expect(logs).toContain("stderr:stderr line");
  });

  test("emits failed from preview.error", () => {
    const child = new FakeChildProcess();
    const session = createPreviewSession({
      spawnProcess: createSpawnMock(child),
      resolveDownloaderPath: () => ({
        cwd: "/tmp/downloader-tool",
        command: "npm",
        argsPrefix: ["run", "start", "--"]
      })
    });
    const statuses: Array<{ state: string; message?: string }> = [];

    session.start(
      {
        url: "https://www.2025copy.com/comic/guichuyinxiong",
        previewMaxChapters: 5,
        previewImagesPerChapter: 3
      },
      {
        onStatus: (event) => statuses.push(event)
      }
    );

    child.stdout.write(`${JSON.stringify({ type: "preview.error", error: "boom" })}\n`);

    expect(statuses).toContainEqual({ state: "failed", message: "boom" });
  });

  test("supports stop semantics", () => {
    const child = new FakeChildProcess();
    const session = createPreviewSession({
      spawnProcess: createSpawnMock(child),
      resolveDownloaderPath: () => ({
        cwd: "/tmp/downloader-tool",
        command: "npm",
        argsPrefix: ["run", "start", "--"]
      })
    });
    const statuses: string[] = [];

    session.start(
      {
        url: "https://www.2025copy.com/comic/guichuyinxiong",
        previewMaxChapters: 5,
        previewImagesPerChapter: 3
      },
      {
        onStatus: (event) => statuses.push(event.state)
      }
    );

    session.stop();

    expect(child.killed).toBe(true);
    expect(statuses).toContain("stopped");
    expect(session.isRunning()).toBe(false);
  });
});
