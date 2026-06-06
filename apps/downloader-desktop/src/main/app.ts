import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerDownloadIpcHandlers } from "./index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function createMainWindow(): BrowserWindow {
  const preloadPath = join(__dirname, "..", "preload", "runtime.cjs");
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.DOWNLOADER_DESKTOP_DEV_URL;
  if (devUrl) {
    void window.loadURL(devUrl);
    return window;
  }

  const htmlPath = join(__dirname, "..", "..", "dist", "index.html");
  void window.loadFile(htmlPath);
  return window;
}

app.whenReady().then(() => {
  registerDownloadIpcHandlers({
    ipcMain,
    dialog,
    shell
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
