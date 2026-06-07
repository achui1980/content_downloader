import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";
import { resolveDownloaderPath, type DownloaderPathInfo } from "./downloader-path.js";
import { parseDownloaderEventLine } from "./log-event-parser.js";
import type { PreviewChapterEvent, PreviewInput, PreviewLogEvent, PreviewStatusEvent } from "../shared/contracts.js";

export type PreviewStartInput = PreviewInput;

export interface PreviewSessionHandlers {
  onLog?: (event: PreviewLogEvent) => void;
  onChapter?: (event: PreviewChapterEvent) => void;
  onStatus?: (event: PreviewStatusEvent) => void;
}

interface SpawnedProcess {
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: (code: number | null) => void): this;
  kill(): boolean;
}

interface PreviewSessionDeps {
  spawnProcess?: (command: string, args: string[], options: SpawnOptions) => SpawnedProcess;
  resolveDownloaderPath?: () => DownloaderPathInfo;
}

function pipeLines(stream: NodeJS.ReadableStream | null, onLine: (line: string) => void): void {
  if (!stream) {
    return;
  }

  let buffered = "";
  stream.on("data", (chunk: Buffer | string) => {
    buffered += chunk.toString();

    let newlineIndex = buffered.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffered.slice(0, newlineIndex).replace(/\r$/, "");
      buffered = buffered.slice(newlineIndex + 1);
      onLine(line);
      newlineIndex = buffered.indexOf("\n");
    }
  });

  stream.on("end", () => {
    const line = buffered.replace(/\r$/, "");
    if (line.length > 0) {
      onLine(line);
    }
    buffered = "";
  });
}

export function createPreviewSession(deps: PreviewSessionDeps = {}) {
  const spawnProcess =
    deps.spawnProcess ??
    ((command: string, args: string[], options: SpawnOptions) => {
      return spawn(command, args, options) as unknown as SpawnedProcess;
    });
  const resolvePath = deps.resolveDownloaderPath ?? resolveDownloaderPath;

  let child: SpawnedProcess | null = null;
  let completed = false;
  let stopRequested = false;
  let handlers: PreviewSessionHandlers = {};

  function emitStatus(event: PreviewStatusEvent): void {
    handlers.onStatus?.(event);
  }

  function emitTerminalStatus(state: "done" | "failed", message?: string): void {
    if (completed) {
      return;
    }
    completed = true;
    emitStatus({ state, message });
  }

  function start(input: PreviewStartInput, nextHandlers: PreviewSessionHandlers = {}): void {
    if (child) {
      throw new Error("Preview session is already running");
    }

    handlers = nextHandlers;
    completed = false;
    stopRequested = false;
    emitStatus({ state: "starting" });

    const downloader = resolvePath();
    const args = [
      ...downloader.argsPrefix,
      "--url",
      input.url,
      "--mode",
      "preview",
      "--preview-max-chapters",
      String(input.previewMaxChapters),
      "--preview-images-per-chapter",
      String(input.previewImagesPerChapter),
      "--events-json"
    ];

    child = spawnProcess(downloader.command, args, {
      cwd: downloader.cwd,
      env: {
        ...process.env,
        ...downloader.env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    pipeLines(child.stdout, (line) => {
      const event = parseDownloaderEventLine(line);
      if (!event) {
        handlers.onLog?.({ source: "stdout", line });
        return;
      }

      if (event.type === "preview.start") {
        emitStatus({ state: "running" });
        return;
      }

      if (event.type === "preview.done") {
        emitTerminalStatus("done");
        return;
      }

      if (event.type === "preview.error") {
        emitTerminalStatus("failed", event.error);
        return;
      }

      if (event.type === "preview.chapter") {
        handlers.onChapter?.({
          index: event.index,
          totalChapters: event.totalChapters,
          chapterTitle: event.chapterTitle,
          chapterUrl: event.chapterUrl,
          images: event.images
        });
      }
    });

    pipeLines(child.stderr, (line) => {
      handlers.onLog?.({ source: "stderr", line });
    });

    child.on("error", (error) => {
      emitTerminalStatus("failed", error.message);
    });

    child.on("close", (code) => {
      child = null;
      if (stopRequested) {
        return;
      }
      if (completed) {
        return;
      }

      if (code === 0) {
        emitTerminalStatus("done");
        return;
      }

      emitTerminalStatus("failed", `Downloader exited with code ${code}`);
    });
  }

  function stop(): void {
    if (!child) {
      return;
    }

    stopRequested = true;
    child.kill();
    child = null;
    emitStatus({ state: "stopped" });
  }

  function isRunning(): boolean {
    return child !== null;
  }

  return {
    start,
    stop,
    isRunning
  };
}
