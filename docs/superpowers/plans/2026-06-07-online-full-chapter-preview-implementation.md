# Online Full Chapter Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users click a chapter and read all images online in a continuous reader flow, without writing preview images to disk.

**Architecture:** Keep existing catalog preview flow, then add a dedicated on-demand chapter-detail path that returns full ordered image URLs for one chapter. Wire this through main/preload IPC into renderer state so the right pane becomes a chapter reader with loading/error/retry states. Preserve download behavior and selection lock rules.

**Tech Stack:** TypeScript, Node.js child_process, Electron IPC, React, Vitest, Playwright downloader tool

---

## File Structure

- Modify: `tools/download-comic-2025copy/src/cli.ts` - support dedicated chapter detail preview mode.
- Modify: `tools/download-comic-2025copy/src/config.ts` - validate `preview-chapter` mode args.
- Modify: `tools/download-comic-2025copy/src/types.ts` - config fields and chapter-detail event type.
- Modify: `tools/download-comic-2025copy/src/main.ts` - add `runPreviewChapter` returning full image list for one chapter.
- Modify: `tools/download-comic-2025copy/tests/config.test.ts` - new mode parsing/validation tests.
- Modify: `tools/download-comic-2025copy/tests/main.preview.test.ts` - chapter-detail event behavior tests.

- Modify: `apps/downloader-desktop/src/main/log-event-parser.ts` - parse `preview.chapterDetail` event.
- Create: `apps/downloader-desktop/src/main/preview-chapter-request.ts` - one-shot process request for chapter detail.
- Modify: `apps/downloader-desktop/src/main/index.ts` - add `preview:loadChapter` IPC handler.
- Modify: `apps/downloader-desktop/tests/log-event-parser.test.ts` - parser coverage for chapter detail.
- Create: `apps/downloader-desktop/tests/preview-chapter-request.test.ts` - one-shot request behavior tests.

- Modify: `apps/downloader-desktop/src/shared/contracts.ts` - chapter detail request/result types.
- Modify: `apps/downloader-desktop/src/preload/index.ts` - expose `loadPreviewChapter` API.
- Modify: `apps/downloader-desktop/tests/preload-api.test.ts` - new preload invoke and event wiring assertions.

- Modify: `apps/downloader-desktop/src/renderer/state.ts` - active chapter detail loading/success/error state model.
- Modify: `apps/downloader-desktop/src/renderer/App.tsx` - chapter click triggers detail load request.
- Modify: `apps/downloader-desktop/src/renderer/components/ChapterListPanel.tsx` - explicit chapter open action.
- Modify: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx` - full-image reader states.
- Modify: `apps/downloader-desktop/src/renderer/styles/theme.css` - reader loading/error/long-scroll polish.
- Modify: `apps/downloader-desktop/tests/preview-state.test.ts` - detail lifecycle + stale response ignore tests.
- Modify: `apps/downloader-desktop/tests/smoke.test.ts` - high-level reader behavior assertions.

### Task 1: Add Tool-Side Chapter Detail Preview Mode

**Files:**
- Modify: `tools/download-comic-2025copy/tests/config.test.ts`
- Modify: `tools/download-comic-2025copy/src/cli.ts`
- Modify: `tools/download-comic-2025copy/src/config.ts`
- Modify: `tools/download-comic-2025copy/src/types.ts`
- Modify: `tools/download-comic-2025copy/src/main.ts`
- Modify: `tools/download-comic-2025copy/tests/main.preview.test.ts`

- [ ] **Step 1: Write failing tests for `preview-chapter` mode**

```ts
it("parses preview-chapter mode with chapter-url", () => {
  const parsed = parseCliArgs([
    "--url",
    "https://www.2025copy.com/comic/guichuyinxiong",
    "--mode",
    "preview-chapter",
    "--chapter-url",
    "https://www.2025copy.com/comic/guichuyinxiong/chapter/abc"
  ]);

  expect(parsed.mode).toBe("preview-chapter");
  expect(parsed.chapterUrls).toEqual(["https://www.2025copy.com/comic/guichuyinxiong/chapter/abc"]);
});
```

```ts
it("emits preview.chapterDetail with full image list", async () => {
  // mock discover/extract so one chapter returns 5 images
  // expect event payload includes all 5 ordered URLs, not sliced by previewImagesPerChapter
});
```

- [ ] **Step 2: Run tests to confirm red state**

Run: `npm test --prefix tools/download-comic-2025copy -- tests/config.test.ts tests/main.preview.test.ts`
Expected: FAIL for missing `preview-chapter` path and event type.

- [ ] **Step 3: Implement minimal mode and runtime**

```ts
// src/types.ts
export interface PreviewChapterDetailEvent {
  type: "preview.chapterDetail";
  chapterUrl: string;
  chapterTitle: string;
  images: string[];
}
```

```ts
// src/cli.ts
if (config.mode === "preview-chapter") {
  await runPreviewChapter(config);
  return;
}
```

```ts
// src/main.ts
export async function runPreviewChapter(config: DownloaderConfig): Promise<void> {
  const chapterUrl = config.chapterUrls[0];
  if (!chapterUrl) {
    throw new Error("--chapter-url is required for preview-chapter mode");
  }

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ userAgent: config.userAgent });
  const page = await context.newPage();

  try {
    const images = await extractChapterImages(page, chapterUrl, config.timeoutMs);
    emitJsonEvent(config, {
      type: "preview.chapterDetail",
      chapterUrl,
      chapterTitle: chapterUrl,
      images: images.map((item) => item.url)
    });
  } finally {
    await context.close();
    await browser.close();
  }
}
```

- [ ] **Step 4: Re-run tool tests**

Run: `npm test --prefix tools/download-comic-2025copy -- tests/config.test.ts tests/main.preview.test.ts`
Expected: PASS for new mode and event behavior.

- [ ] **Step 5: Commit**

```bash
git add tools/download-comic-2025copy/src tools/download-comic-2025copy/tests
git commit -m "feat: add on-demand chapter detail preview mode"
```

### Task 2: Add Desktop Main One-Shot Chapter Detail Request Path

**Files:**
- Modify: `apps/downloader-desktop/src/main/log-event-parser.ts`
- Create: `apps/downloader-desktop/src/main/preview-chapter-request.ts`
- Modify: `apps/downloader-desktop/src/main/index.ts`
- Modify: `apps/downloader-desktop/tests/log-event-parser.test.ts`
- Create: `apps/downloader-desktop/tests/preview-chapter-request.test.ts`

- [ ] **Step 1: Write failing tests for parser and request runner**

```ts
test("parses preview.chapterDetail event", () => {
  const parsed = parseDownloaderEventLine(
    JSON.stringify({
      type: "preview.chapterDetail",
      chapterUrl: "https://www.2025copy.com/comic/slug/chapter/a",
      chapterTitle: "第1话",
      images: ["https://cdn/1.jpg", "https://cdn/2.jpg"]
    })
  );
  expect(parsed?.type).toBe("preview.chapterDetail");
});
```

```ts
test("requests chapter detail with preview-chapter mode", async () => {
  // assert spawn args include: --mode preview-chapter --chapter-url <url> --events-json
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test --prefix apps/downloader-desktop -- tests/log-event-parser.test.ts tests/preview-chapter-request.test.ts`
Expected: FAIL due to missing parser branch/request module.

- [ ] **Step 3: Implement parser branch and request module**

```ts
// src/main/log-event-parser.ts
if (parsed.type === "preview.chapterDetail") {
  if (typeof parsed.chapterUrl !== "string" || !Array.isArray(parsed.images)) {
    return null;
  }
  return {
    type: "preview.chapterDetail",
    chapterUrl: parsed.chapterUrl,
    chapterTitle: typeof parsed.chapterTitle === "string" ? parsed.chapterTitle : "",
    images: parsed.images.filter((item): item is string => typeof item === "string")
  };
}
```

```ts
// src/main/preview-chapter-request.ts
export async function requestPreviewChapterDetail(input: { url: string; chapterUrl: string }): Promise<{ chapterUrl: string; chapterTitle: string; images: string[] }> {
  // spawn downloader once with --mode preview-chapter --chapter-url ... --events-json
  // parse stdout and resolve on preview.chapterDetail
}
```

```ts
// src/main/index.ts
deps.ipcMain.handle("preview:loadChapter", async (_event, payload) => {
  return requestPreviewChapterDetail(payload as { url: string; chapterUrl: string });
});
```

- [ ] **Step 4: Re-run focused tests**

Run: `npm test --prefix apps/downloader-desktop -- tests/log-event-parser.test.ts tests/preview-chapter-request.test.ts`
Expected: PASS for parser + request behavior.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/main apps/downloader-desktop/tests/log-event-parser.test.ts apps/downloader-desktop/tests/preview-chapter-request.test.ts
git commit -m "feat: add desktop chapter detail preview request path"
```

### Task 3: Extend Shared Contracts and Preload API for Chapter Detail Load

**Files:**
- Modify: `apps/downloader-desktop/src/shared/contracts.ts`
- Modify: `apps/downloader-desktop/src/preload/index.ts`
- Modify: `apps/downloader-desktop/tests/preload-api.test.ts`

- [ ] **Step 1: Write failing preload contract test**

```ts
test("exposes loadPreviewChapter api", async () => {
  const invoke = vi.fn(async () => ({ chapterUrl: "u", chapterTitle: "t", images: [] }));
  const api = createPreloadApi({ invoke, on: vi.fn(), off: vi.fn() });

  await api.loadPreviewChapter({
    url: "https://www.2025copy.com/comic/guichuyinxiong",
    chapterUrl: "https://www.2025copy.com/comic/guichuyinxiong/chapter/abc"
  });

  expect(invoke).toHaveBeenCalledWith("preview:loadChapter", expect.any(Object));
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npm test --prefix apps/downloader-desktop -- tests/preload-api.test.ts`
Expected: FAIL due to missing `loadPreviewChapter`.

- [ ] **Step 3: Implement shared type + preload method**

```ts
// src/shared/contracts.ts
export interface PreviewChapterDetailRequest {
  url: string;
  chapterUrl: string;
}

export interface PreviewChapterDetailResult {
  chapterUrl: string;
  chapterTitle: string;
  images: string[];
}
```

```ts
// src/preload/index.ts
loadPreviewChapter(payload) {
  return ipcRenderer.invoke("preview:loadChapter", payload) as Promise<PreviewChapterDetailResult>;
}
```

- [ ] **Step 4: Re-run preload tests**

Run: `npm test --prefix apps/downloader-desktop -- tests/preload-api.test.ts`
Expected: PASS for new preload method.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/shared/contracts.ts apps/downloader-desktop/src/preload/index.ts apps/downloader-desktop/tests/preload-api.test.ts
git commit -m "feat: expose chapter detail preview api in preload"
```

### Task 4: Implement Renderer Chapter Detail Reader Flow

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/state.ts`
- Modify: `apps/downloader-desktop/src/renderer/App.tsx`
- Modify: `apps/downloader-desktop/src/renderer/components/ChapterListPanel.tsx`
- Modify: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx`
- Modify: `apps/downloader-desktop/src/renderer/styles/theme.css`
- Modify: `apps/downloader-desktop/tests/preview-state.test.ts`
- Modify: `apps/downloader-desktop/tests/smoke.test.ts`

- [ ] **Step 1: Write failing renderer tests for detail lifecycle**

```ts
test("tracks chapter detail loading and success", () => {
  const loading = reduceAppState(createInitialAppState(), { type: "chapterDetailLoading", chapterUrl: "u1", requestId: "r1" });
  expect(loading.chapterLoadState).toBe("loading");

  const success = reduceAppState(loading, {
    type: "chapterDetailSuccess",
    chapterUrl: "u1",
    requestId: "r1",
    chapterTitle: "第1话",
    images: ["https://cdn/1.jpg"]
  });
  expect(success.chapterLoadState).toBe("success");
});
```

```ts
test("ignores stale chapter detail response", () => {
  // requestId mismatch should not overwrite active chapter detail
});
```

- [ ] **Step 2: Run focused tests to confirm failure**

Run: `npm test --prefix apps/downloader-desktop -- tests/preview-state.test.ts tests/smoke.test.ts`
Expected: FAIL because chapter-detail actions/state are missing.

- [ ] **Step 3: Implement renderer orchestration and UI**

```ts
// src/renderer/state.ts additions
chapterLoadState: "idle" | "loading" | "success" | "error";
activeChapterDetail: { chapterUrl: string; chapterTitle: string; images: string[] } | null;
activeChapterRequestId: string | null;
chapterLoadError: string | null;
```

```ts
// src/renderer/App.tsx, on chapter click
const requestId = `chapter-${Date.now()}`;
dispatch({ type: "chapterDetailLoading", chapterUrl, requestId });
const detail = await api.loadPreviewChapter({ url: input.url, chapterUrl });
dispatch({
  type: "chapterDetailSuccess",
  requestId,
  chapterUrl: detail.chapterUrl,
  chapterTitle: detail.chapterTitle,
  images: detail.images
});
```

```tsx
// src/renderer/components/ReaderPanel.tsx
if (chapterLoadState === "loading") return <section className="reader-loading">Loading chapter...</section>;
if (chapterLoadState === "error") return <button onClick={onRetry}>重试当前章</button>;
return <>{activeChapterDetail?.images.map((src) => <img key={src} src={src} loading="lazy" alt="chapter page" />)}</>;
```

- [ ] **Step 4: Re-run renderer tests**

Run: `npm test --prefix apps/downloader-desktop -- tests/preview-state.test.ts tests/smoke.test.ts`
Expected: PASS for detail load/success/error/stale guards and reader rendering.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer apps/downloader-desktop/tests/preview-state.test.ts apps/downloader-desktop/tests/smoke.test.ts
git commit -m "feat: add online full chapter reader flow"
```

### Task 5: Full Verification and Docs Sync

**Files:**
- Modify (if needed): `apps/downloader-desktop/README.md`
- Modify (if needed): `tools/download-comic-2025copy/README.md`

- [ ] **Step 1: Update docs if command/API shape changed**

```md
## Online full chapter preview

- Click a chapter to load all chapter images online.
- Preview does not write images to disk.
```

- [ ] **Step 2: Run full verification**

Run: `npm test --prefix tools/download-comic-2025copy && npm run build --prefix tools/download-comic-2025copy`
Expected: PASS for tool tests/build.

Run: `npm test --prefix apps/downloader-desktop && npx --prefix apps/downloader-desktop tsc --noEmit -p apps/downloader-desktop/tsconfig.json && npm run build --prefix apps/downloader-desktop`
Expected: PASS for desktop tests/typecheck/build.

- [ ] **Step 3: Manual smoke sanity**

Run: `npm run dev:electron --prefix apps/downloader-desktop`
Expected:
- Click chapter -> reader loads full chapter online.
- Error state allows retry.
- Download All/Selected still works.

- [ ] **Step 4: Commit**

```bash
git add apps/downloader-desktop/README.md tools/download-comic-2025copy/README.md
git commit -m "docs: document online full chapter preview flow"
```

## Self-Review Checklist (Completed)

- Spec coverage: all acceptance criteria map directly to Tasks 1-5.
- Placeholder scan: no TODO/TBD placeholders; each coding step has concrete snippets and commands.
- Type consistency: `PreviewChapterDetailRequest`, `PreviewChapterDetailResult`, and `preview.chapterDetail` naming is consistent across tool/main/preload/renderer tasks.
