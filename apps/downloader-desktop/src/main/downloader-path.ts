import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface DownloaderPathInfo {
  cwd: string;
  command: string;
  argsPrefix: string[];
  env?: Record<string, string>;
}

function createNodeExecutionPath(cwd: string, scriptPath: string): DownloaderPathInfo {
  return {
    cwd,
    command: process.execPath,
    argsPrefix: [scriptPath],
    env: {
      ELECTRON_RUN_AS_NODE: "1",
      PLAYWRIGHT_BROWSERS_PATH: "0"
    }
  };
}

export function resolveDownloaderPath(): DownloaderPathInfo {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(thisDir, "../../../../");
  const toolDir = resolve(repoRoot, "tools/download-comic-2025copy");
  const repoCli = resolve(toolDir, "dist/src/cli.js");

  const packagedToolDir = resolve(process.resourcesPath ?? "", "downloader-tool");
  const packagedCli = resolve(packagedToolDir, "dist/src/cli.js");

  if (existsSync(packagedCli)) {
    return createNodeExecutionPath(packagedToolDir, packagedCli);
  }

  if (existsSync(repoCli)) {
    return createNodeExecutionPath(toolDir, repoCli);
  }

  return {
    cwd: toolDir,
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    argsPrefix: ["run", "start", "--"]
  };
}
