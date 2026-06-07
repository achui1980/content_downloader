import type { DownloaderPreloadApi, PreloadIpcRenderer } from "./index.js";
const { createPreloadApi } = require("./index.js") as typeof import("./index.js");

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

const api = createPreloadApi(ipcRenderer as unknown as PreloadIpcRenderer) as DownloaderPreloadApi;
contextBridge.exposeInMainWorld("downloader", api);
