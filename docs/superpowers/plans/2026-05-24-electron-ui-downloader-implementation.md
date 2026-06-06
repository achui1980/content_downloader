# Electron UI Downloader MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron + React desktop app that can start/stop the existing 2025copy downloader with real-time progress/logs, then package it after functional stability.

**Architecture:** Create a new desktop app package under `apps/downloader-desktop` with strict process boundaries (renderer UI, preload bridge, main process orchestration). Reuse the existing downloader by adding machine-readable progress events and spawning it from Electron main process via `child_process`. Ship phase A (dev-mode fully functional) first, then phase B (installer packaging).

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, electron-builder, Node child_process

---

## File Structure

- Create: `apps/downloader-desktop/package.json` - desktop app scripts/dependencies
- Create: `apps/downloader-desktop/tsconfig.json` - desktop TS config
- Create: `apps/downloader-desktop/vite.config.ts` - renderer build config
- Create: `apps/downloader-desktop/electron-builder.yml` - packaging targets
- Create: `apps/downloader-desktop/src/main/index.ts` - BrowserWindow lifecycle and IPC wiring
- Create: `apps/downloader-desktop/src/main/download-session.ts` - downloader child process lifecycle
- Create: `apps/downloader-desktop/src/main/downloader-path.ts` - resolve CLI entry path (dev/prod)
- Create: `apps/downloader-desktop/src/main/log-event-parser.ts` - parse JSON event lines from downloader
- Create: `apps/downloader-desktop/src/preload/index.ts` - safe bridge API
- Create: `apps/downloader-desktop/src/renderer/main.tsx` - renderer bootstrap
- Create: `apps/downloader-desktop/src/renderer/App.tsx` - page layout and state machine
- Create: `apps/downloader-desktop/src/renderer/components/*.tsx` - form/progress/log/result widgets
- Create: `apps/downloader-desktop/src/shared/contracts.ts` - IPC and domain contracts
- Create: `apps/downloader-desktop/tests/*.test.ts` - desktop unit tests
- Modify: `tools/download-comic-2025copy/src/types.ts` - progress/event payloads
- Modify: `tools/download-comic-2025copy/src/main.ts` - emit structured progress events
- Modify: `tools/download-comic-2025copy/src/cli.ts` - add `--events-json` switch
- Modify: `tools/download-comic-2025copy/tests/config.test.ts` - CLI option tests
- Modify: `tools/download-comic-2025copy/README.md` - event-mode docs
- Create: `.github/workflows/desktop-package.yml` - phase B multi-OS packaging CI

### Task 1: Scaffold desktop app package and baseline scripts

**Files:**
- Create: `apps/downloader-desktop/package.json`
- Create: `apps/downloader-desktop/tsconfig.json`
- Create: `apps/downloader-desktop/vite.config.ts`
- Create: `apps/downloader-desktop/src/renderer/main.tsx`
- Create: `apps/downloader-desktop/src/renderer/App.tsx`
- Create: `apps/downloader-desktop/tests/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildInitialTaskState } from "../src/shared/contracts";

describe("desktop smoke", () => {
  it("starts in idle state", () => {
    expect(buildInitialTaskState().status).toBe("idle");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/smoke.test.ts` (from `apps/downloader-desktop`)
Expected: FAIL with module-not-found for `../src/shared/contracts`

- [ ] **Step 3: Write minimal implementation + scaffold scripts**

```ts
// apps/downloader-desktop/src/shared/contracts.ts
export type TaskStatus = "idle" | "running" | "stopping" | "success" | "failed";
export function buildInitialTaskState() {
  return { status: "idle" as TaskStatus };
}
```

```json
{
  "name": "downloader-desktop",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/smoke.test.ts`
Expected: PASS (`1 passed`)

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop
git commit -m "chore: scaffold electron desktop package baseline"
```

### Task 2: Define IPC/domain contracts and input validation

**Files:**
- Modify: `apps/downloader-desktop/src/shared/contracts.ts`
- Create: `apps/downloader-desktop/src/shared/validation.ts`
- Create: `apps/downloader-desktop/tests/validation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { validateStartInput } from "../src/shared/validation";

describe("validateStartInput", () => {
  it("rejects non-2025copy url", () => {
    const result = validateStartInput({
      url: "https://example.com/comic/abc",
      outputDir: "/tmp",
      concurrency: 4,
      retries: 3
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/validation.test.ts`
Expected: FAIL with module-not-found for `../src/shared/validation`

- [ ] **Step 3: Write minimal implementation**

```ts
export function validateStartInput(input: {
  url: string;
  outputDir: string;
  concurrency: number;
  retries: number;
}) {
  const validUrl = /^https:\/\/www\.2025copy\.com\/comic\/.+/.test(input.url);
  if (!validUrl) return { ok: false as const, message: "URL 必须是 2025copy comic 页面" };
  if (!input.outputDir) return { ok: false as const, message: "下载目录不能为空" };
  if (!Number.isInteger(input.concurrency) || input.concurrency < 1) return { ok: false as const, message: "并发必须>=1" };
  if (!Number.isInteger(input.retries) || input.retries < 0) return { ok: false as const, message: "重试必须>=0" };
  return { ok: true as const };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/validation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/shared apps/downloader-desktop/tests/validation.test.ts
git commit -m "feat: add desktop ipc contracts and start-input validation"
```

### Task 3: Add machine-readable downloader events in CLI tool

**Files:**
- Modify: `tools/download-comic-2025copy/src/types.ts`
- Modify: `tools/download-comic-2025copy/src/main.ts`
- Modify: `tools/download-comic-2025copy/src/cli.ts`
- Modify: `tools/download-comic-2025copy/tests/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli.js";

describe("cli event mode", () => {
  it("parses --events-json", () => {
    const args = parseCliArgs([
      "--url",
      "https://www.2025copy.com/comic/guichuyinxiong",
      "--events-json"
    ]);
    expect(args.eventsJson).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/config.test.ts` (from `tools/download-comic-2025copy`)
Expected: FAIL because `eventsJson` is undefined

- [ ] **Step 3: Write minimal implementation**

```ts
// in cli args
eventsJson?: boolean;

case "--events-json":
  args.eventsJson = true;
  break;
```

```ts
// in main workflow
if (config.eventsJson) {
  console.log(JSON.stringify({
    type: "chapter-start",
    index: i + 1,
    total: selected.length,
    title: chapter.title
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tools/download-comic-2025copy/src tools/download-comic-2025copy/tests/config.test.ts
git commit -m "feat: emit structured downloader events for desktop integration"
```

### Task 4: Implement Electron main-process download session manager

**Files:**
- Create: `apps/downloader-desktop/src/main/downloader-path.ts`
- Create: `apps/downloader-desktop/src/main/log-event-parser.ts`
- Create: `apps/downloader-desktop/src/main/download-session.ts`
- Create: `apps/downloader-desktop/tests/log-event-parser.test.ts`
- Create: `apps/downloader-desktop/tests/download-session.test.ts`

- [ ] **Step 1: Write failing parser test**

```ts
import { describe, expect, it } from "vitest";
import { parseDownloaderLine } from "../src/main/log-event-parser";

describe("parseDownloaderLine", () => {
  it("parses json event line", () => {
    const event = parseDownloaderLine('{"type":"chapter-start","index":1,"total":3,"title":"第1话"}');
    expect(event?.type).toBe("chapter-start");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/log-event-parser.test.ts`
Expected: FAIL with module-not-found

- [ ] **Step 3: Implement parser + session manager minimal logic**

```ts
export function parseDownloaderLine(line: string) {
  try {
    const parsed = JSON.parse(line);
    return parsed && typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}
```

```ts
const child = spawn(process.execPath, [cliPath, "--url", input.url, "--events-json"], {
  cwd: repoRoot,
  env: process.env
});
child.stdout.on("data", onData);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/log-event-parser.test.ts tests/download-session.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/main apps/downloader-desktop/tests
git commit -m "feat: add main-process downloader session and event parsing"
```

### Task 5: Implement secure preload bridge and IPC wiring

**Files:**
- Create: `apps/downloader-desktop/src/preload/index.ts`
- Modify: `apps/downloader-desktop/src/main/index.ts`
- Create: `apps/downloader-desktop/tests/preload-api.test.ts`

- [ ] **Step 1: Write the failing preload API test**

```ts
import { describe, expect, it } from "vitest";
import { buildPreloadApi } from "../src/preload/index";

describe("preload api", () => {
  it("exposes start/stop/select/open methods", () => {
    const api = buildPreloadApi({ invoke: async () => null, on: () => () => {} });
    expect(typeof api.startDownload).toBe("function");
    expect(typeof api.stopDownload).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/preload-api.test.ts`
Expected: FAIL with module-not-found

- [ ] **Step 3: Implement preload bridge + main IPC handlers**

```ts
export function buildPreloadApi(electron: {
  invoke: (channel: string, payload?: unknown) => Promise<unknown>;
  on: (channel: string, cb: (payload: unknown) => void) => () => void;
}) {
  return {
    startDownload: (payload: unknown) => electron.invoke("download:start", payload),
    stopDownload: (taskId: string) => electron.invoke("download:stop", { taskId }),
    selectOutputDir: () => electron.invoke("dialog:selectOutputDir"),
    openOutputDir: (path: string) => electron.invoke("shell:openOutputDir", { path }),
    onProgress: (cb: (payload: unknown) => void) => electron.on("download:progress", cb),
    onLog: (cb: (payload: unknown) => void) => electron.on("download:log", cb)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/preload-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/preload apps/downloader-desktop/src/main/index.ts apps/downloader-desktop/tests/preload-api.test.ts
git commit -m "feat: expose secure preload bridge and ipc handlers"
```

### Task 6: Build renderer MVP UI (form + progress + logs + result)

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/App.tsx`
- Create: `apps/downloader-desktop/src/renderer/state.ts`
- Create: `apps/downloader-desktop/src/renderer/components/DownloadForm.tsx`
- Create: `apps/downloader-desktop/src/renderer/components/ProgressPanel.tsx`
- Create: `apps/downloader-desktop/src/renderer/components/LogPanel.tsx`
- Create: `apps/downloader-desktop/src/renderer/components/ResultPanel.tsx`
- Create: `apps/downloader-desktop/tests/app-state.test.ts`

- [ ] **Step 1: Write failing state transition test**

```ts
import { describe, expect, it } from "vitest";
import { reduceTaskState } from "../src/renderer/state";

describe("task reducer", () => {
  it("moves from idle to running on start", () => {
    const next = reduceTaskState({ status: "idle" }, { type: "started", taskId: "t1" });
    expect(next.status).toBe("running");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/app-state.test.ts`
Expected: FAIL with missing reducer module

- [ ] **Step 3: Implement minimal reducer + UI wiring**

```ts
export function reduceTaskState(state: { status: string }, event: { type: string; taskId?: string }) {
  if (event.type === "started") return { ...state, status: "running", taskId: event.taskId };
  if (event.type === "done") return { ...state, status: "success" };
  if (event.type === "error") return { ...state, status: "failed" };
  return state;
}
```

```tsx
// App.tsx (excerpt)
<DownloadForm onStart={handleStart} onStop={handleStop} disabled={state.status === "running"} />
<ProgressPanel progress={progress} status={state.status} />
<LogPanel logs={logs} />
<ResultPanel result={result} onOpenOutput={handleOpenOutput} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/app-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer apps/downloader-desktop/tests/app-state.test.ts
git commit -m "feat: implement desktop mvp renderer workflow"
```

### Task 7: Phase A verification and developer docs

**Files:**
- Create: `apps/downloader-desktop/README.md`
- Modify: `tools/download-comic-2025copy/README.md`
- Create: `apps/downloader-desktop/tests/docs.test.ts`

- [ ] **Step 1: Write failing doc check test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("docs", () => {
  it("documents desktop dev command", () => {
    const text = readFileSync("README.md", "utf8");
    expect(text.includes("npm run dev")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/docs.test.ts`
Expected: FAIL until README exists with expected command

- [ ] **Step 3: Add docs and smoke verification commands**

```md
## Dev smoke

1. `npm run dev`
2. Start with URL `https://www.2025copy.com/comic/guichuyinxiong`
3. Set max chapters to 3 in debug mode
4. Verify logs, progress, and resume behavior
```

- [ ] **Step 4: Run phase A verification commands**

Run (desktop package):
- `npm test`
- `npm run build`

Run (downloader package):
- `npm test`

Expected: all commands exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/README.md apps/downloader-desktop/tests/docs.test.ts tools/download-comic-2025copy/README.md
git commit -m "docs: add desktop dev and smoke verification guide"
```

### Task 8: Phase B packaging configuration and CI matrix

**Files:**
- Create: `apps/downloader-desktop/electron-builder.yml`
- Create: `.github/workflows/desktop-package.yml`
- Modify: `apps/downloader-desktop/package.json`
- Create: `apps/downloader-desktop/tests/builder-config.test.ts`

- [ ] **Step 1: Write failing config test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("builder config", () => {
  it("contains three packaging targets", () => {
    const text = readFileSync("electron-builder.yml", "utf8");
    expect(text.includes("dmg")).toBe(true);
    expect(text.includes("nsis")).toBe(true);
    expect(text.includes("AppImage")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/builder-config.test.ts`
Expected: FAIL because file missing

- [ ] **Step 3: Add packaging config + CI workflow**

```yaml
# electron-builder.yml
appId: com.achui.downloader
mac:
  target: [dmg]
win:
  target: [nsis]
linux:
  target: [AppImage]
```

```yaml
# .github/workflows/desktop-package.yml
strategy:
  matrix:
    os: [macos-latest, windows-latest, ubuntu-latest]
```

```json
{
  "scripts": {
    "package": "electron-builder"
  }
}
```

- [ ] **Step 4: Run packaging dry-run checks**

Run:
- `npm run build`
- `npm run package -- --dir`

Expected: build artifacts generated without signing

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/electron-builder.yml apps/downloader-desktop/tests/builder-config.test.ts .github/workflows/desktop-package.yml apps/downloader-desktop/package.json
git commit -m "build: configure multi-platform desktop packaging"
```

## Final Verification Checklist

- [ ] `apps/downloader-desktop`: `npm test` passes
- [ ] `apps/downloader-desktop`: `npm run build` passes
- [ ] `tools/download-comic-2025copy`: `npm test` passes
- [ ] Desktop app can complete `max-chapters=3` run via UI
- [ ] Stop + rerun shows resume (`skipped` increases)
- [ ] Packaging dry run outputs platform directories
