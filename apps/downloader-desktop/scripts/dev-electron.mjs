import { spawn } from "node:child_process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const devUrl = process.env.DOWNLOADER_DESKTOP_DEV_URL ?? "http://127.0.0.1:5173";
const parsedDevUrl = new URL(devUrl);
const devHost = parsedDevUrl.hostname;
const devPort = parsedDevUrl.port || "5173";

const children = [];
let shuttingDown = false;

function spawnChild(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv
    }
  });
  children.push(child);
  return child;
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`process exited with code ${code ?? "null"} signal ${signal ?? "null"}`));
    });
  });
}

async function waitForDevServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) {
        return;
      }
    } catch {
      
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`dev server not ready: ${url}`);
}

function shutdownChildren() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children.reverse()) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  shutdownChildren();
  process.exit(130);
});

process.on("SIGTERM", () => {
  shutdownChildren();
  process.exit(143);
});

async function main() {
  const build = spawnChild(npmCmd, ["run", "build:electron"]);
  await waitForExit(build);

  const vite = spawnChild(npmCmd, ["run", "dev", "--", "--host", devHost, "--port", devPort, "--strictPort"]);
  const viteExitPromise = waitForExit(vite);
  await Promise.race([
    waitForDevServer(devUrl),
    viteExitPromise.then(() => Promise.reject(new Error("vite exited before server was ready")))
  ]);

  const electron = spawnChild(npxCmd, ["electron", "."], {
    DOWNLOADER_DESKTOP_DEV_URL: devUrl
  });

  try {
    await waitForExit(electron);
  } finally {
    shutdownChildren();
  }
}

main().catch((error) => {
  shutdownChildren();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
