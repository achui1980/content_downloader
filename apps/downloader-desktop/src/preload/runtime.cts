import type { DownloaderPreloadApi, PreloadIpcRenderer } from "./index.js";

type IpcEventListener = (_event: unknown, payload: unknown) => void;

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

function createRuntimeApi(ipc: PreloadIpcRenderer): DownloaderPreloadApi {
  return {
    startDownload(payload) {
      return ipc.invoke("download:start", payload) as Promise<{ taskId: string }>;
    },
    stopDownload(taskId) {
      return ipc.invoke("download:stop", taskId) as Promise<{ stopped: boolean }>;
    },
    startPreview(payload) {
      return ipc.invoke("preview:start", payload) as Promise<{ taskId: string }>;
    },
    stopPreview(taskId) {
      return ipc.invoke("preview:stop", taskId) as Promise<{ stopped: boolean }>;
    },
    loadPreviewChapter(payload) {
      return ipc.invoke("preview:loadChapter", payload) as ReturnType<DownloaderPreloadApi["loadPreviewChapter"]>;
    },
    selectOutputDir() {
      return ipc.invoke("dialog:selectOutputDir") as Promise<string | null>;
    },
    openOutputDir(path) {
      return ipc.invoke("shell:openOutputDir", path);
    },
    onProgress(cb) {
      const listener: IpcEventListener = (_event, payload) => {
        cb(payload as Parameters<typeof cb>[0]);
      };
      ipc.on("download:progress", listener);
      return () => {
        ipc.off("download:progress", listener);
      };
    },
    onLog(cb) {
      const listener: IpcEventListener = (_event, payload) => {
        cb(payload as Parameters<typeof cb>[0]);
      };
      ipc.on("download:log", listener);
      return () => {
        ipc.off("download:log", listener);
      };
    },
    onStatus(cb) {
      const listener: IpcEventListener = (_event, payload) => {
        cb(payload as Parameters<typeof cb>[0]);
      };
      ipc.on("download:status", listener);
      return () => {
        ipc.off("download:status", listener);
      };
    },
    onPreviewLog(cb) {
      const listener: IpcEventListener = (_event, payload) => {
        cb(payload as Parameters<typeof cb>[0]);
      };
      ipc.on("preview:log", listener);
      return () => {
        ipc.off("preview:log", listener);
      };
    },
    onPreviewChapter(cb) {
      const listener: IpcEventListener = (_event, payload) => {
        cb(payload as Parameters<typeof cb>[0]);
      };
      ipc.on("preview:chapter", listener);
      return () => {
        ipc.off("preview:chapter", listener);
      };
    },
    onPreviewStatus(cb) {
      const listener: IpcEventListener = (_event, payload) => {
        cb(payload as Parameters<typeof cb>[0]);
      };
      ipc.on("preview:status", listener);
      return () => {
        ipc.off("preview:status", listener);
      };
    }
  };
}

const api = createRuntimeApi(ipcRenderer as unknown as PreloadIpcRenderer);
contextBridge.exposeInMainWorld("downloader", api);
