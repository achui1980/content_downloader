/// <reference types="vitest" />

import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { describe, expect, test, vi } from "vitest";
import { createDownloadSession } from "../src/main/download-session";

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

describe("createDownloadSession", () => {
  test("spawns downloader with --events-json", () => {
    const child = new FakeChildProcess();
    const spawnMock = createSpawnMock(child);
    const session = createDownloadSession({
      spawnProcess: spawnMock,
      resolveDownloaderPath: () => ({
        cwd: "/tmp/downloader-tool",
        command: "npm",
        argsPrefix: ["run", "start", "--"]
      })
    });

    session.start({
      url: "https://www.2025copy.com/comic/guichuyinxiong",
      outputDir: "./downloads",
      concurrency: 4,
      retries: 3
    });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const args = spawnMock.mock.calls[0][1];
    expect(args).toContain("--events-json");
  });

  test("routes stdout/stderr lines into status/progress/log callbacks", () => {
    const child = new FakeChildProcess();
    const session = createDownloadSession({
      spawnProcess: createSpawnMock(child),
      resolveDownloaderPath: () => ({
        cwd: "/tmp/downloader-tool",
        command: "npm",
        argsPrefix: ["run", "start", "--"]
      })
    });

    const statuses: string[] = [];
    const progress: number[] = [];
    const logs: string[] = [];

    session.start(
      {
        url: "https://www.2025copy.com/comic/guichuyinxiong",
        outputDir: "./downloads",
        concurrency: 4,
        retries: 3
      },
      {
        onStatus: (event) => statuses.push(event.state),
        onProgress: (event) => progress.push(event.index),
        onLog: (event) => logs.push(`${event.source}:${event.line}`)
      }
    );

    child.stdout.write(`${JSON.stringify({ type: "run.start" })}\n`);
    child.stdout.write(
      `${JSON.stringify({ type: "chapter.start", index: 1, totalChapters: 10, chapterTitle: "A" })}\n`
    );
    child.stdout.write("plain stdout line\n");
    child.stderr.write("stderr line\n");

    expect(statuses).toContain("running");
    expect(progress).toEqual([1]);
    expect(logs).toContain("stdout:plain stdout line");
    expect(logs).toContain("stderr:stderr line");
  });

  test("supports stop semantics", () => {
    const child = new FakeChildProcess();
    const session = createDownloadSession({
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
        outputDir: "./downloads",
        concurrency: 4,
        retries: 3
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

  test("flushes final stdout JSON line without trailing newline", async () => {
    const child = new FakeChildProcess();
    const session = createDownloadSession({
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
        outputDir: "./downloads",
        concurrency: 4,
        retries: 3
      },
      {
        onStatus: (event) => statuses.push(event.state)
      }
    );

    const ended = new Promise<void>((resolve) => {
      child.stdout.once("end", () => resolve());
    });
    child.stdout.end(JSON.stringify({ type: "run.done" }));
    await ended;

    expect(statuses).toContain("done");
  });

  test("emits failed once when child emits error then close", () => {
    const child = new FakeChildProcess();
    const session = createDownloadSession({
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
        outputDir: "./downloads",
        concurrency: 4,
        retries: 3
      },
      {
        onStatus: (event) => statuses.push(event.state)
      }
    );

    child.emit("error", new Error("spawn failed"));
    child.emit("close", null, null);

    expect(statuses.filter((state) => state === "failed")).toHaveLength(1);
  });
});
