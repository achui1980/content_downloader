import {
  createDownloadSession,
  type DownloadLogEvent,
  type DownloadProgressEvent,
  type DownloadStatusEvent
} from "./download-session.js";
import {
  createPreviewSession
} from "./preview-session.js";
import type { PreviewChapterEvent, PreviewInput, PreviewLogEvent, PreviewStatusEvent, StartInput } from "../shared/contracts.js";

interface IpcSender {
  send(channel: string, payload: unknown): void;
}

interface IpcInvokeEvent {
  sender: IpcSender;
}

interface IpcMainLike {
  handle(channel: string, listener: (event: IpcInvokeEvent, ...args: unknown[]) => unknown): void;
}

interface DialogLike {
  showOpenDialog(...args: unknown[]): Promise<{ canceled: boolean; filePaths: string[] }>;
}

interface ShellLike {
  openPath(path: string): Promise<string>;
}

interface DownloadSessionLike {
  start(
    payload: StartInput,
    handlers: {
      onProgress?: (event: DownloadProgressEvent) => void;
      onLog?: (event: DownloadLogEvent) => void;
      onStatus?: (event: DownloadStatusEvent) => void;
    }
  ): void;
  stop(): void;
  isRunning(): boolean;
}

interface PreviewSessionLike {
  start(
    payload: PreviewInput,
    handlers: {
      onLog?: (event: PreviewLogEvent) => void;
      onChapter?: (event: PreviewChapterEvent) => void;
      onStatus?: (event: PreviewStatusEvent) => void;
    }
  ): void;
  stop(): void;
  isRunning(): boolean;
}

export interface RegisterDownloadIpcDeps {
  ipcMain: IpcMainLike;
  session?: DownloadSessionLike;
  previewSession?: PreviewSessionLike;
  dialog: DialogLike;
  shell: ShellLike;
}

export function registerDownloadIpcHandlers(deps: RegisterDownloadIpcDeps): void {
  const session = deps.session ?? createDownloadSession();
  const previewSession = deps.previewSession ?? createPreviewSession();
  let currentTaskId: string | null = null;
  let currentPreviewTaskId: string | null = null;

  deps.ipcMain.handle("download:start", (event, payload) => {
    const input = payload as StartInput & { taskId?: string };
    const taskId = typeof input.taskId === "string" && input.taskId.length > 0 ? input.taskId : `task-${Date.now()}`;
    currentTaskId = taskId;

    session.start(input, {
      onProgress(progress) {
        event.sender.send("download:progress", {
          taskId,
          ...progress
        });
      },
      onLog(log) {
        event.sender.send("download:log", {
          taskId,
          ...log
        });
      },
      onStatus(status) {
        event.sender.send("download:status", {
          taskId,
          ...status
        });
        if (status.state === "done" || status.state === "failed" || status.state === "stopped") {
          currentTaskId = null;
        }
      }
    });

    return { taskId };
  });

  deps.ipcMain.handle("download:stop", (_event, taskId) => {
    if (!session.isRunning()) {
      return { stopped: false };
    }
    if (typeof taskId === "string" && currentTaskId && taskId !== currentTaskId) {
      return { stopped: false };
    }
    session.stop();
    currentTaskId = null;
    return { stopped: true };
  });

  deps.ipcMain.handle("preview:start", (event, payload) => {
    const input = payload as PreviewInput & { taskId?: string };
    const taskId = typeof input.taskId === "string" && input.taskId.length > 0 ? input.taskId : `preview-${Date.now()}`;
    currentPreviewTaskId = taskId;

    previewSession.start(input, {
      onLog(log) {
        event.sender.send("preview:log", {
          taskId,
          ...log
        });
      },
      onChapter(chapter) {
        event.sender.send("preview:chapter", {
          taskId,
          ...chapter
        });
      },
      onStatus(status) {
        event.sender.send("preview:status", {
          taskId,
          ...status
        });
        if (status.state === "done" || status.state === "failed" || status.state === "stopped") {
          currentPreviewTaskId = null;
        }
      }
    });

    return { taskId };
  });

  deps.ipcMain.handle("preview:stop", (_event, taskId) => {
    if (!previewSession.isRunning()) {
      return { stopped: false };
    }
    if (typeof taskId === "string" && currentPreviewTaskId && taskId !== currentPreviewTaskId) {
      return { stopped: false };
    }
    previewSession.stop();
    currentPreviewTaskId = null;
    return { stopped: true };
  });

  deps.ipcMain.handle("dialog:selectOutputDir", async () => {
    const result = await deps.dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled) {
      return null;
    }
    return result.filePaths[0] ?? null;
  });

  deps.ipcMain.handle("shell:openOutputDir", async (_event, outputPath) => {
    if (typeof outputPath !== "string" || outputPath.length === 0) {
      return { opened: false, error: "Output path is required" };
    }
    const failure = await deps.shell.openPath(outputPath);
    return {
      opened: failure.length === 0,
      error: failure.length > 0 ? failure : null
    };
  });
}
