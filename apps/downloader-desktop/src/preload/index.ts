import type { DownloadLogEvent, DownloadProgressEvent, DownloadStatusEvent } from "../main/download-session.js";
import type { StartInput } from "../shared/contracts.js";

type IpcEventListener = (_event: unknown, payload: unknown) => void;

export interface PreloadIpcRenderer {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: IpcEventListener): void;
  off(channel: string, listener: IpcEventListener): void;
}

export interface DownloaderPreloadApi {
  startDownload(payload: StartInput & { taskId?: string }): Promise<{ taskId: string }>;
  stopDownload(taskId: string): Promise<{ stopped: boolean }>;
  selectOutputDir(): Promise<string | null>;
  openOutputDir(path: string): Promise<unknown>;
  onProgress(cb: (event: DownloadProgressEvent & { taskId: string }) => void): () => void;
  onLog(cb: (event: DownloadLogEvent & { taskId: string }) => void): () => void;
  onStatus(cb: (event: DownloadStatusEvent & { taskId: string }) => void): () => void;
}

export interface ContextBridgeLike {
  exposeInMainWorld(key: string, api: DownloaderPreloadApi): void;
}

export function createPreloadApi(ipcRenderer: PreloadIpcRenderer): DownloaderPreloadApi {
  return {
    startDownload(payload) {
      return ipcRenderer.invoke("download:start", payload) as Promise<{ taskId: string }>;
    },
    stopDownload(taskId) {
      return ipcRenderer.invoke("download:stop", taskId) as Promise<{ stopped: boolean }>;
    },
    selectOutputDir() {
      return ipcRenderer.invoke("dialog:selectOutputDir") as Promise<string | null>;
    },
    openOutputDir(path) {
      return ipcRenderer.invoke("shell:openOutputDir", path);
    },
    onProgress(cb) {
      const listener: IpcEventListener = (_event, payload) => {
        cb(payload as DownloadProgressEvent & { taskId: string });
      };
      ipcRenderer.on("download:progress", listener);
      return () => {
        ipcRenderer.off("download:progress", listener);
      };
    },
    onLog(cb) {
      const listener: IpcEventListener = (_event, payload) => {
        cb(payload as DownloadLogEvent & { taskId: string });
      };
      ipcRenderer.on("download:log", listener);
      return () => {
        ipcRenderer.off("download:log", listener);
      };
    },
    onStatus(cb) {
      const listener: IpcEventListener = (_event, payload) => {
        cb(payload as DownloadStatusEvent & { taskId: string });
      };
      ipcRenderer.on("download:status", listener);
      return () => {
        ipcRenderer.off("download:status", listener);
      };
    }
  };
}

export function exposeDownloaderApi(contextBridge: ContextBridgeLike, ipcRenderer: PreloadIpcRenderer): DownloaderPreloadApi {
  const api = createPreloadApi(ipcRenderer);
  contextBridge.exposeInMainWorld("downloader", api);
  return api;
}
