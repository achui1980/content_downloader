import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";
import { resolveDownloaderPath, type DownloaderPathInfo } from "./downloader-path.js";
import { parseDownloaderEventLine } from "./log-event-parser.js";

export interface PreviewChapterDetailRequestInput {
  chapterUrl: string;
}

export interface PreviewChapterDetail {
  chapterTitle: string;
  chapterUrl: string;
  totalImages: number;
  images: string[];
  capturedAt?: string;
}

interface SpawnedProcess {
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: (code: number | null) => void): this;
}

interface PreviewChapterRequestDeps {
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

function deriveComicUrl(chapterUrl: string): string {
  try {
    const parsed = new URL(chapterUrl);
    const match = parsed.pathname.match(/^\/comic\/([^/]+)/);
    if (!match) {
      return chapterUrl;
    }
    return `${parsed.origin}/comic/${match[1]}`;
  } catch {
    return chapterUrl;
  }
}

export function requestPreviewChapterDetail(
  input: PreviewChapterDetailRequestInput,
  deps: PreviewChapterRequestDeps = {}
): Promise<PreviewChapterDetail> {
  const chapterUrl = input.chapterUrl.trim();
  if (chapterUrl.length === 0) {
    return Promise.reject(new Error("Chapter URL is required"));
  }

  const spawnProcess =
    deps.spawnProcess ??
    ((command: string, args: string[], options: SpawnOptions) => {
      return spawn(command, args, options) as unknown as SpawnedProcess;
    });
  const resolvePath = deps.resolveDownloaderPath ?? resolveDownloaderPath;

  const downloader = resolvePath();
  const args = [
    ...downloader.argsPrefix,
    "--url",
    deriveComicUrl(chapterUrl),
    "--mode",
    "preview-chapter",
    "--chapter-url",
    chapterUrl,
    "--events-json"
  ];

  const child = spawnProcess(downloader.command, args, {
    cwd: downloader.cwd,
    env: {
      ...process.env,
      ...downloader.env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  return new Promise<PreviewChapterDetail>((resolve, reject) => {
    let settled = false;

    const resolveOnce = (result: PreviewChapterDetail): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    const rejectOnce = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    pipeLines(child.stdout, (line) => {
      const event = parseDownloaderEventLine(line);
      if (!event) {
        return;
      }

      if (event.type === "preview.chapterDetail") {
        resolveOnce({
          chapterTitle: event.chapterTitle,
          chapterUrl: event.chapterUrl,
          totalImages: event.totalImages,
          images: event.images,
          capturedAt: event.capturedAt
        });
        return;
      }

      if (event.type === "preview.error") {
        rejectOnce(new Error(event.error ?? "Preview chapter request failed"));
      }
    });

    pipeLines(child.stderr, () => {
      return;
    });

    child.on("error", (error) => {
      rejectOnce(error);
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }

      if (code === 0) {
        rejectOnce(new Error("Chapter detail event not received"));
        return;
      }

      rejectOnce(new Error(`Downloader exited with code ${code}`));
    });
  });
}
