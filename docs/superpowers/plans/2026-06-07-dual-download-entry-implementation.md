# Dual Download Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support two explicit download actions in desktop UI (`下载全部` and `下载已选`) while preserving preview workflow and auto-fallback behavior.

**Architecture:** Keep downloader/preload/main IPC protocol unchanged and implement behavior in renderer orchestration. Add a small pure helper for download scope resolution so fallback logic is testable, then wire DownloadForm and App to run serial transition `stopPreview -> startDownload` when user starts download during preview. Preserve reducer protections for stale events and selection lock during active download.

**Tech Stack:** TypeScript, React, Electron preload IPC, Vitest

---

## File Structure

- Create: `apps/downloader-desktop/src/renderer/download-scope.ts` - resolves requested download mode into actual `selectedChapterUrls` payload and fallback metadata.
- Create: `apps/downloader-desktop/tests/download-scope.test.ts` - unit tests for fallback/all/selected scope logic.
- Modify: `apps/downloader-desktop/src/renderer/components/DownloadForm.tsx` - expose two download buttons and handlers.
- Modify: `apps/downloader-desktop/src/renderer/App.tsx` - orchestrate preview-stop-before-download and button-specific handlers.
- Modify: `apps/downloader-desktop/tests/app-state.test.ts` - keep reducer invariants aligned with transition path.
- Modify: `apps/downloader-desktop/tests/preview-state.test.ts` - ensure preview events do not mutate selection during running download.

### Task 1: Add Download Scope Resolver with Test Coverage

**Files:**
- Create: `apps/downloader-desktop/src/renderer/download-scope.ts`
- Create: `apps/downloader-desktop/tests/download-scope.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "vitest";
import { resolveDownloadScope } from "../src/renderer/download-scope";

describe("resolveDownloadScope", () => {
  test("returns all scope when mode is all", () => {
    const result = resolveDownloadScope("all", ["https://www.2025copy.com/comic/slug/chapter/1"]);
    expect(result.selectedChapterUrls).toEqual([]);
    expect(result.fallbackToAll).toBe(false);
  });

  test("keeps selected urls when mode is selected and non-empty", () => {
    const result = resolveDownloadScope("selected", [
      "https://www.2025copy.com/comic/slug/chapter/1",
      "https://www.2025copy.com/comic/slug/chapter/2"
    ]);
    expect(result.selectedChapterUrls).toHaveLength(2);
    expect(result.fallbackToAll).toBe(false);
  });

  test("auto-falls back to all when selected mode has no urls", () => {
    const result = resolveDownloadScope("selected", []);
    expect(result.selectedChapterUrls).toEqual([]);
    expect(result.fallbackToAll).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix apps/downloader-desktop -- tests/download-scope.test.ts`
Expected: FAIL with module-not-found for `src/renderer/download-scope.ts`.

- [ ] **Step 3: Implement minimal resolver**

```ts
export type DownloadRequestMode = "all" | "selected";

export interface DownloadScopeResult {
  selectedChapterUrls: string[];
  fallbackToAll: boolean;
}

export function resolveDownloadScope(mode: DownloadRequestMode, selectedChapterUrls: string[]): DownloadScopeResult {
  if (mode === "all") {
    return { selectedChapterUrls: [], fallbackToAll: false };
  }

  if (selectedChapterUrls.length === 0) {
    return { selectedChapterUrls: [], fallbackToAll: true };
  }

  return {
    selectedChapterUrls,
    fallbackToAll: false
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix apps/downloader-desktop -- tests/download-scope.test.ts`
Expected: PASS (`3 passed`).

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/download-scope.ts apps/downloader-desktop/tests/download-scope.test.ts
git commit -m "feat: add download scope resolver for all/selected actions"
```

### Task 2: Replace Single Download Button with Dual Entry Buttons

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/components/DownloadForm.tsx`

- [ ] **Step 1: Write the failing test for button labels and handlers**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("download form dual actions", () => {
  test("contains download-all and download-selected action labels", () => {
    const source = readFileSync("src/renderer/components/DownloadForm.tsx", "utf8");
    expect(source.includes("Download All")).toBe(true);
    expect(source.includes("Download Selected")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: FAIL because `DownloadForm.tsx` still has single submit action.

- [ ] **Step 3: Implement dual-button props and rendering**

```tsx
interface DownloadFormProps {
  // existing props...
  onDownloadAll: () => void;
  onDownloadSelected: () => void;
}

const downloadAllDisabled = props.isRunning || !props.hasApi || !props.canStart;
const downloadSelectedDisabled = props.isRunning || !props.hasApi || !props.canStart;

<button type="button" className="button button--primary" onClick={props.onDownloadAll} disabled={downloadAllDisabled}>
  Download All
</button>
<button
  type="button"
  className="button button--secondary"
  onClick={props.onDownloadSelected}
  disabled={downloadSelectedDisabled}
>
  Download Selected ({props.selectedChapterCount})
</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: PASS and no TypeScript errors in component props.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/components/DownloadForm.tsx apps/downloader-desktop/tests/smoke.test.ts
git commit -m "feat: add dual download action buttons in download form"
```

### Task 3: Implement App Orchestration for Preview-to-Download Transition

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/App.tsx`
- Modify: `apps/downloader-desktop/src/renderer/state.ts`
- Modify: `apps/downloader-desktop/tests/app-state.test.ts`
- Modify: `apps/downloader-desktop/tests/preview-state.test.ts`

- [ ] **Step 1: Write failing tests for transition and running-lock behavior**

```ts
test("ignores preview chapter events while download is running", () => {
  // existing setup...
  expect(next.previewChapters).toHaveLength(1);
});

test("keeps reducer start blocked when preview still previewing", () => {
  const previewing = reduceAppState(createInitialAppState(), { type: "previewStarted", taskId: "preview-1" });
  const next = reduceAppState(previewing, { type: "started", taskId: "download-1" });
  expect(next.status).toBe("idle");
});
```

- [ ] **Step 2: Run focused tests to verify red state**

Run: `npm test --prefix apps/downloader-desktop -- tests/app-state.test.ts tests/preview-state.test.ts`
Expected: FAIL for at least one missing transition assertion or stale mutation guard.

- [ ] **Step 3: Implement orchestration in App**

```ts
import { resolveDownloadScope, type DownloadRequestMode } from "./download-scope";

async function startDownloadWithMode(mode: DownloadRequestMode): Promise<void> {
  if (!api) {
    dispatch({ type: "error", message: "Preload API unavailable. Please start from Electron launcher." });
    return;
  }

  const scope = resolveDownloadScope(mode, state.selectedChapterUrls);
  const payload: StartInput = { ...input, selectedChapterUrls: scope.selectedChapterUrls };

  if (state.previewStatus === "previewing" && state.previewTaskId) {
    const stopResult = await api.stopPreview(state.previewTaskId);
    if (!stopResult.stopped) {
      dispatch({ type: "error", message: "Failed to stop preview before download." });
      return;
    }
    dispatch({ type: "previewStatus", taskId: state.previewTaskId, state: "stopped" });
  }

  if (scope.fallbackToAll) {
    dispatch({ type: "error", message: "No chapters selected. Switched to download all chapters." });
  }

  const taskId = `task-${Date.now()}`;
  dispatch({ type: "started", taskId });
  await api.startDownload({ ...payload, taskId });
}

const handleDownloadAll = () => startDownloadWithMode("all");
const handleDownloadSelected = () => startDownloadWithMode("selected");
```

```tsx
<DownloadForm
  // existing props...
  onDownloadAll={handleDownloadAll}
  onDownloadSelected={handleDownloadSelected}
/>
```

```ts
// reducer should keep these invariants:
// 1) started ignored while previewStatus is previewing
// 2) previewChapter ignored while download status is running
```

- [ ] **Step 4: Run focused tests to verify green state**

Run: `npm test --prefix apps/downloader-desktop -- tests/app-state.test.ts tests/preview-state.test.ts`
Expected: PASS (`app-state` and `preview-state` suites green).

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/App.tsx apps/downloader-desktop/src/renderer/state.ts apps/downloader-desktop/tests/app-state.test.ts apps/downloader-desktop/tests/preview-state.test.ts
git commit -m "feat: support download-all and selected fallback flow"
```

### Task 4: Run Full Desktop Verification

**Files:**
- No additional code files required (verification-only task)

- [ ] **Step 1: Run full desktop test suite**

Run: `npm test --prefix apps/downloader-desktop`
Expected: PASS with all test files green.

- [ ] **Step 2: Run desktop typecheck**

Run: `npx --prefix apps/downloader-desktop tsc --noEmit -p apps/downloader-desktop/tsconfig.json`
Expected: no output and exit code `0`.

- [ ] **Step 3: Run desktop build**

Run: `npm run build --prefix apps/downloader-desktop`
Expected: renderer build and electron TypeScript build both succeed.

- [ ] **Step 4: Commit final verification artifacts (if any test updates occurred)**

```bash
git add apps/downloader-desktop
git commit -m "test: verify dual download entry desktop flow"
```

## Self-Review Checklist (Completed)

- Spec coverage: dual buttons, fallback-to-all, preview-stop-before-download, and running-lock behavior each map to dedicated tasks.
- Placeholder scan: no TBD/TODO placeholders; every code-change step includes concrete snippets and exact commands.
- Type consistency: `DownloadRequestMode`, `selectedChapterUrls`, and dual button handler naming are consistent across helper, App, and form.
