# Reader Resume + Inline Chapter Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users continue reading after restart and download the currently opened chapter in the reader without interrupting reading.

**Architecture:** Add a main-process durable resume store and new reader IPC endpoints (`reader:listRecent`, `reader:saveProgress`, `reader:loadChapter`, `reader:downloadCurrentChapter`). Reader chapter loading becomes local-first (downloaded files) with online fallback, while renderer gets a recent-reading panel, scroll persistence, and reader-only download status independent of the existing global download state.

**Tech Stack:** TypeScript, Electron IPC, React, Node.js fs/path/child_process, Vitest

---

## File Structure

- Create: `apps/downloader-desktop/src/main/reading-resume-store.ts` - JSON-backed recent-reading + downloaded chapter index persistence.
- Create: `apps/downloader-desktop/src/main/reader-chapter-loader.ts` - local-first chapter detail resolver.
- Create: `apps/downloader-desktop/src/main/reader-chapter-download-request.ts` - one-shot chapter download request + index update.
- Modify: `apps/downloader-desktop/src/main/index.ts` - register reader IPC handlers and wire new services.
- Modify: `apps/downloader-desktop/src/shared/contracts.ts` - reader resume/download IPC types.
- Modify: `apps/downloader-desktop/src/preload/index.ts` - expose reader IPC methods.
- Modify: `apps/downloader-desktop/src/preload/runtime.cts` - keep runtime bridge API parity.
- Create: `apps/downloader-desktop/src/renderer/components/RecentReadsPanel.tsx` - top-of-home recent list UI.
- Modify: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx` - inline `Download Current Chapter` button + status.
- Modify: `apps/downloader-desktop/src/renderer/App.tsx` - recent list load, continue action, scroll save/restore, reader download workflow.
- Modify: `apps/downloader-desktop/src/renderer/state.ts` - recent list and reader download status state transitions.
- Modify: `apps/downloader-desktop/src/renderer/styles/theme.css` - panel/button/status styling.

- Modify: `tools/download-comic-2025copy/src/main.ts` - enrich `chapter.done` event with `chapterDir` for deterministic local indexing.
- Modify: `tools/download-comic-2025copy/tests/main.preview.test.ts` - event payload coverage for `chapter.done.chapterDir`.
- Modify: `apps/downloader-desktop/src/main/log-event-parser.ts` - parse `chapter.done.chapterDir`.
- Modify: `apps/downloader-desktop/tests/log-event-parser.test.ts` - parser coverage for optional `chapterDir`.

- Create tests:
  - `apps/downloader-desktop/tests/reading-resume-store.test.ts`
  - `apps/downloader-desktop/tests/reader-chapter-loader.test.ts`
  - `apps/downloader-desktop/tests/reader-chapter-download-request.test.ts`
- Modify tests:
  - `apps/downloader-desktop/tests/preload-api.test.ts`
  - `apps/downloader-desktop/tests/preview-state.test.ts`
  - `apps/downloader-desktop/tests/smoke.test.ts`
  - `apps/downloader-desktop/tests/preload-runtime.test.ts`

### Task 1: Add Shared Reader Contracts and Preload API Surface

**Files:**
- Modify: `apps/downloader-desktop/src/shared/contracts.ts`
- Modify: `apps/downloader-desktop/src/preload/index.ts`
- Modify: `apps/downloader-desktop/src/preload/runtime.cts`
- Modify: `apps/downloader-desktop/tests/preload-api.test.ts`
- Modify: `apps/downloader-desktop/tests/preload-runtime.test.ts`

- [ ] **Step 1: Write failing tests for new reader IPC API methods**

```ts
// apps/downloader-desktop/tests/preload-api.test.ts
await api.listRecentReadings();
await api.saveReadingProgress({
  comicUrl: "https://www.2025copy.com/comic/demo",
  chapterUrl: "https://www.2025copy.com/comic/demo/chapter/a",
  scrollRatio: 0.42
});
await api.loadReaderChapter({
  chapterUrl: "https://www.2025copy.com/comic/demo/chapter/a"
});
await api.downloadCurrentReaderChapter({
  chapterUrl: "https://www.2025copy.com/comic/demo/chapter/a",
  outputDir: "/tmp/2025copy",
  concurrency: 2,
  retries: 1
});

expect(invoke).toHaveBeenCalledWith("reader:listRecent");
expect(invoke).toHaveBeenCalledWith("reader:saveProgress", expect.any(Object));
expect(invoke).toHaveBeenCalledWith("reader:loadChapter", expect.any(Object));
expect(invoke).toHaveBeenCalledWith("reader:downloadCurrentChapter", expect.any(Object));
```

```ts
// apps/downloader-desktop/tests/preload-runtime.test.ts
const source = readFileSync("src/preload/runtime.cts", "utf8");
expect(source.includes("loadReaderChapter")).toBe(true);
expect(source.includes("downloadCurrentReaderChapter")).toBe(true);
```

- [ ] **Step 2: Run focused preload tests to verify red state**

Run: `npm test --prefix apps/downloader-desktop -- tests/preload-api.test.ts tests/preload-runtime.test.ts`
Expected: FAIL because reader preload methods/types are missing.

- [ ] **Step 3: Implement minimal contracts + preload methods**

```ts
// apps/downloader-desktop/src/shared/contracts.ts
export interface RecentComicItem {
  comicKey: string;
  comicUrl: string;
  comicTitle: string;
  lastChapterUrl: string;
  lastChapterTitle: string;
  lastScrollRatio: number;
  lastReadAt: string;
}

export interface SaveReadingProgressInput {
  comicUrl: string;
  comicTitle?: string;
  chapterUrl: string;
  chapterTitle?: string;
  scrollRatio: number;
}

export interface ReaderLoadChapterInput {
  chapterUrl: string;
}

export interface ReaderLoadChapterResult extends PreviewChapterDetail {
  source: "local" | "online";
}

export interface ReaderDownloadCurrentChapterInput {
  chapterUrl: string;
  outputDir: string;
  concurrency: number;
  retries: number;
}

export interface ReaderDownloadCurrentChapterResult {
  chapterUrl: string;
  chapterDir: string;
  imagePaths: string[];
}
```

```ts
// apps/downloader-desktop/src/preload/index.ts
listRecentReadings() {
  return ipcRenderer.invoke("reader:listRecent") as Promise<RecentComicItem[]>;
},
saveReadingProgress(payload) {
  return ipcRenderer.invoke("reader:saveProgress", payload) as Promise<{ saved: true }>;
},
loadReaderChapter(payload) {
  return ipcRenderer.invoke("reader:loadChapter", payload) as Promise<ReaderLoadChapterResult>;
},
downloadCurrentReaderChapter(payload) {
  return ipcRenderer.invoke("reader:downloadCurrentChapter", payload) as Promise<ReaderDownloadCurrentChapterResult>;
},
```

```ts
// apps/downloader-desktop/src/preload/runtime.cts
listRecentReadings() {
  return ipc.invoke("reader:listRecent") as ReturnType<DownloaderPreloadApi["listRecentReadings"]>;
},
saveReadingProgress(payload) {
  return ipc.invoke("reader:saveProgress", payload) as ReturnType<DownloaderPreloadApi["saveReadingProgress"]>;
},
loadReaderChapter(payload) {
  return ipc.invoke("reader:loadChapter", payload) as ReturnType<DownloaderPreloadApi["loadReaderChapter"]>;
},
downloadCurrentReaderChapter(payload) {
  return ipc.invoke("reader:downloadCurrentChapter", payload) as ReturnType<DownloaderPreloadApi["downloadCurrentReaderChapter"]>;
},
```

- [ ] **Step 4: Re-run focused preload tests**

Run: `npm test --prefix apps/downloader-desktop -- tests/preload-api.test.ts tests/preload-runtime.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/shared/contracts.ts apps/downloader-desktop/src/preload/index.ts apps/downloader-desktop/src/preload/runtime.cts apps/downloader-desktop/tests/preload-api.test.ts apps/downloader-desktop/tests/preload-runtime.test.ts
git commit -m "feat: add reader preload contracts and ipc methods"
```

### Task 2: Implement ReadingResumeStore and Recent/Progress IPC

**Files:**
- Create: `apps/downloader-desktop/src/main/reading-resume-store.ts`
- Modify: `apps/downloader-desktop/src/main/index.ts`
- Create: `apps/downloader-desktop/tests/reading-resume-store.test.ts`
- Modify: `apps/downloader-desktop/tests/preload-api.test.ts`

- [ ] **Step 1: Write failing tests for store persistence, sort, and cap=20**

```ts
// apps/downloader-desktop/tests/reading-resume-store.test.ts
it("upserts entry and clamps scroll ratio", async () => {
  await store.saveProgress({
    comicUrl: "https://www.2025copy.com/comic/a",
    chapterUrl: "https://www.2025copy.com/comic/a/chapter/1",
    scrollRatio: 2
  });
  const list = await store.listRecent();
  expect(list[0]?.lastScrollRatio).toBe(1);
});

it("keeps only latest 20 entries", async () => {
  for (let i = 0; i < 25; i += 1) {
    await store.saveProgress({ comicUrl: `https://www.2025copy.com/comic/${i}`, chapterUrl: `https://www.2025copy.com/comic/${i}/chapter/1`, scrollRatio: 0.3 });
  }
  expect((await store.listRecent())).toHaveLength(20);
});
```

```ts
// apps/downloader-desktop/tests/preload-api.test.ts in main IPC block
const listRecentHandler = handlers.get("reader:listRecent");
const saveProgressHandler = handlers.get("reader:saveProgress");
expect(listRecentHandler).toBeTypeOf("function");
expect(saveProgressHandler).toBeTypeOf("function");
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm test --prefix apps/downloader-desktop -- tests/reading-resume-store.test.ts tests/preload-api.test.ts`
Expected: FAIL because store and IPC handlers do not exist.

- [ ] **Step 3: Implement store and IPC wiring**

```ts
// apps/downloader-desktop/src/main/reading-resume-store.ts
export class ReadingResumeStore {
  constructor(private readonly filePath: string) {}

  async listRecent(): Promise<RecentComicItem[]> {
    const snapshot = await this.readSnapshot();
    return snapshot.entries
      .sort((a, b) => Date.parse(b.lastReadAt) - Date.parse(a.lastReadAt))
      .slice(0, 20)
      .map(({ downloadedChapters, ...item }) => item);
  }

  async saveProgress(input: SaveReadingProgressInput): Promise<void> {
    const snapshot = await this.readSnapshot();
    // upsert by comicKey + clamp scrollRatio + trim to 20
    await this.writeSnapshot(next);
  }

  async upsertDownloadedChapter(...): Promise<void> {
    // update downloadedChapters map by chapterUrl
  }
}
```

```ts
// apps/downloader-desktop/src/main/index.ts
const resumeStore = deps.resumeStore ?? createReadingResumeStore();

deps.ipcMain.handle("reader:listRecent", async () => {
  return resumeStore.listRecent();
});

deps.ipcMain.handle("reader:saveProgress", async (_event, payload) => {
  await resumeStore.saveProgress(payload as SaveReadingProgressInput);
  return { saved: true };
});
```

- [ ] **Step 4: Re-run focused tests**

Run: `npm test --prefix apps/downloader-desktop -- tests/reading-resume-store.test.ts tests/preload-api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/main/reading-resume-store.ts apps/downloader-desktop/src/main/index.ts apps/downloader-desktop/tests/reading-resume-store.test.ts apps/downloader-desktop/tests/preload-api.test.ts
git commit -m "feat: persist reader resume and recent list"
```

### Task 3: Add Local-First Reader Chapter Loader (`reader:loadChapter`)

**Files:**
- Create: `apps/downloader-desktop/src/main/reader-chapter-loader.ts`
- Modify: `apps/downloader-desktop/src/main/index.ts`
- Create: `apps/downloader-desktop/tests/reader-chapter-loader.test.ts`

- [ ] **Step 1: Write failing tests for local-hit and online-fallback behavior**

```ts
it("returns local image file URLs when chapter is downloaded", async () => {
  const result = await loadReaderChapter({ chapterUrl: chapterA }, depsWithExistingLocalFiles);
  expect(result.source).toBe("local");
  expect(result.images[0]).toMatch(/^file:\/\//);
});

it("falls back online and prunes stale downloaded ref", async () => {
  const result = await loadReaderChapter({ chapterUrl: chapterA }, depsWithMissingLocalFiles);
  expect(result.source).toBe("online");
  expect(removeDownloadedChapterRef).toHaveBeenCalledWith(chapterA);
});
```

- [ ] **Step 2: Run focused tests and confirm red state**

Run: `npm test --prefix apps/downloader-desktop -- tests/reader-chapter-loader.test.ts`
Expected: FAIL because loader does not exist.

- [ ] **Step 3: Implement loader + IPC endpoint**

```ts
// apps/downloader-desktop/src/main/reader-chapter-loader.ts
export async function loadReaderChapter(input: ReaderLoadChapterInput, deps: ReaderChapterLoaderDeps): Promise<ReaderLoadChapterResult> {
  const local = await deps.resumeStore.getDownloadedChapter(input.chapterUrl);
  if (local) {
    const existing = await filterExistingFiles(local.imagePaths);
    if (existing.length > 0) {
      return {
        source: "local",
        chapterTitle: local.chapterTitle,
        chapterUrl: input.chapterUrl,
        totalImages: existing.length,
        images: existing.map((filePath) => pathToFileURL(filePath).toString())
      };
    }
    await deps.resumeStore.removeDownloadedChapter(input.chapterUrl);
  }

  const online = await deps.requestPreviewChapterDetail({ chapterUrl: input.chapterUrl });
  return { ...online, source: "online" };
}
```

```ts
// apps/downloader-desktop/src/main/index.ts
deps.ipcMain.handle("reader:loadChapter", async (_event, payload) => {
  return readerChapterLoader.loadReaderChapter(payload as ReaderLoadChapterInput);
});
```

- [ ] **Step 4: Re-run focused tests**

Run: `npm test --prefix apps/downloader-desktop -- tests/reader-chapter-loader.test.ts tests/preload-api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/main/reader-chapter-loader.ts apps/downloader-desktop/src/main/index.ts apps/downloader-desktop/tests/reader-chapter-loader.test.ts apps/downloader-desktop/tests/preload-api.test.ts
git commit -m "feat: add local-first reader chapter loading"
```

### Task 4: Add Reader Background "Download Current Chapter"

**Files:**
- Modify: `tools/download-comic-2025copy/src/main.ts`
- Modify: `tools/download-comic-2025copy/tests/main.preview.test.ts`
- Modify: `apps/downloader-desktop/src/main/log-event-parser.ts`
- Modify: `apps/downloader-desktop/tests/log-event-parser.test.ts`
- Create: `apps/downloader-desktop/src/main/reader-chapter-download-request.ts`
- Modify: `apps/downloader-desktop/src/main/index.ts`
- Create: `apps/downloader-desktop/tests/reader-chapter-download-request.test.ts`

- [ ] **Step 1: Write failing tests for chapter done payload and one-shot reader download request**

```ts
// tools/download-comic-2025copy/tests/main.preview.test.ts
expect(payloads.find((p) => p.type === "chapter.done")).toMatchObject({
  chapterUrl: "https://www.2025copy.com/comic/demo/chapter/b",
  chapterDir: expect.stringContaining("/downloads/demo/")
});
```

```ts
// apps/downloader-desktop/tests/reader-chapter-download-request.test.ts
expect(args).toEqual(expect.arrayContaining([
  "--chapter-url",
  "https://www.2025copy.com/comic/demo/chapter/a",
  "--events-json"
]));
expect(result.chapterDir).toContain("demo");
expect(result.imagePaths.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm test --prefix tools/download-comic-2025copy -- tests/main.preview.test.ts && npm test --prefix apps/downloader-desktop -- tests/log-event-parser.test.ts tests/reader-chapter-download-request.test.ts`
Expected: FAIL due to missing `chapterDir` event parse/request module.

- [ ] **Step 3: Implement minimal tool + desktop main changes**

```ts
// tools/download-comic-2025copy/src/main.ts chapter.done payload
emitJsonEvent(config, {
  type: "chapter.done",
  index: i + 1,
  totalChapters: selected.length,
  chapterTitle: chapter.title,
  chapterUrl: chapter.url,
  chapterDir,
  // ...existing fields
});
```

```ts
// apps/downloader-desktop/src/main/log-event-parser.ts
if (parsed.type === "chapter.done") {
  return {
    type: "chapter.done",
    index: parsed.index,
    totalChapters: parsed.totalChapters,
    status: typeof parsed.status === "string" ? parsed.status : undefined,
    chapterDir: typeof parsed.chapterDir === "string" ? parsed.chapterDir : undefined,
    chapterUrl: typeof parsed.chapterUrl === "string" ? parsed.chapterUrl : undefined,
    chapterTitle: typeof parsed.chapterTitle === "string" ? parsed.chapterTitle : undefined
  };
}
```

```ts
// apps/downloader-desktop/src/main/reader-chapter-download-request.ts
export async function downloadCurrentReaderChapter(input: ReaderDownloadCurrentChapterInput, deps: ReaderChapterDownloadDeps): Promise<ReaderDownloadCurrentChapterResult> {
  // spawn downloader in download mode with one --chapter-url
  // parse chapter.done + run.done
  // resolve image files from chapterDir
  // update resumeStore.upsertDownloadedChapter(...)
}
```

```ts
// apps/downloader-desktop/src/main/index.ts
deps.ipcMain.handle("reader:downloadCurrentChapter", async (_event, payload) => {
  return readerChapterDownloader.downloadCurrentReaderChapter(payload as ReaderDownloadCurrentChapterInput);
});
```

- [ ] **Step 4: Re-run focused tests**

Run: `npm test --prefix tools/download-comic-2025copy -- tests/main.preview.test.ts && npm test --prefix apps/downloader-desktop -- tests/log-event-parser.test.ts tests/reader-chapter-download-request.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/download-comic-2025copy/src/main.ts tools/download-comic-2025copy/tests/main.preview.test.ts apps/downloader-desktop/src/main/log-event-parser.ts apps/downloader-desktop/tests/log-event-parser.test.ts apps/downloader-desktop/src/main/reader-chapter-download-request.ts apps/downloader-desktop/src/main/index.ts apps/downloader-desktop/tests/reader-chapter-download-request.test.ts
git commit -m "feat: support reader inline chapter download workflow"
```

### Task 5: Implement Renderer Recent List, Resume Restore, and Reader Download UI

**Files:**
- Create: `apps/downloader-desktop/src/renderer/components/RecentReadsPanel.tsx`
- Modify: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx`
- Modify: `apps/downloader-desktop/src/renderer/App.tsx`
- Modify: `apps/downloader-desktop/src/renderer/state.ts`
- Modify: `apps/downloader-desktop/src/renderer/styles/theme.css`
- Modify: `apps/downloader-desktop/tests/preview-state.test.ts`
- Modify: `apps/downloader-desktop/tests/smoke.test.ts`

- [ ] **Step 1: Write failing renderer tests for recent list + download-current + progress save behavior**

```ts
// apps/downloader-desktop/tests/smoke.test.ts
expect(container.textContent).toContain("Recently Read");
expect(api.listRecentReadings).toHaveBeenCalledTimes(1);

const continueButton = Array.from(container.querySelectorAll("button")).find((n) => n.textContent?.includes("Continue"));
continueButton?.click();
expect(api.loadReaderChapter).toHaveBeenCalledWith({ chapterUrl: "https://www.2025copy.com/comic/demo/chapter/a" });

const downloadCurrentButton = Array.from(container.querySelectorAll("button")).find((n) => n.textContent?.trim() === "Download Current Chapter");
downloadCurrentButton?.click();
expect(api.downloadCurrentReaderChapter).toHaveBeenCalledTimes(1);
```

```ts
// apps/downloader-desktop/tests/preview-state.test.ts
const next = reduceAppState(initial, { type: "readerRecentLoaded", items: [itemA, itemB] });
expect(next.recentComics).toHaveLength(2);

const running = reduceAppState(next, { type: "readerDownloadStarted", chapterUrl: itemA.lastChapterUrl });
expect(running.readerDownloadStatus).toBe("running");
```

- [ ] **Step 2: Run focused renderer tests to confirm red state**

Run: `npm test --prefix apps/downloader-desktop -- tests/preview-state.test.ts tests/smoke.test.ts`
Expected: FAIL because recent/read/download-current state/actions/UI do not exist.

- [ ] **Step 3: Implement renderer state and UI flow**

```ts
// apps/downloader-desktop/src/renderer/state.ts additions
recentComics: RecentComicItem[];
readerDownloadStatus: "idle" | "running" | "done" | "error";
readerDownloadMessage: string | null;

| { type: "readerRecentLoaded"; items: RecentComicItem[] }
| { type: "readerDownloadStarted"; chapterUrl: string }
| { type: "readerDownloadDone"; chapterUrl: string }
| { type: "readerDownloadError"; message: string }
```

```tsx
// apps/downloader-desktop/src/renderer/App.tsx
useEffect(() => {
  if (!api) return;
  void api.listRecentReadings().then((items) => {
    dispatch({ type: "readerRecentLoaded", items });
  });
}, [api]);

async function handleDownloadCurrentChapter(): Promise<void> {
  if (!api || !state.activeChapterUrl) return;
  dispatch({ type: "readerDownloadStarted", chapterUrl: state.activeChapterUrl });
  try {
    await api.downloadCurrentReaderChapter({
      chapterUrl: state.activeChapterUrl,
      outputDir: input.outputDir,
      concurrency: input.concurrency,
      retries: input.retries
    });
    dispatch({ type: "readerDownloadDone", chapterUrl: state.activeChapterUrl });
  } catch (error) {
    dispatch({ type: "readerDownloadError", message: error instanceof Error ? error.message : "Failed" });
  }
}
```

```tsx
// apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx
<div className="reader-toolbar">
  <button type="button" className="button button--secondary" onClick={onDownloadCurrentChapter} disabled={!activeChapterUrl || readerDownloadStatus === "running"}>
    Download Current Chapter
  </button>
  {readerDownloadMessage ? <span className="reader-download-status">{readerDownloadMessage}</span> : null}
</div>
```

```tsx
// apps/downloader-desktop/src/renderer/components/RecentReadsPanel.tsx
export function RecentReadsPanel({ items, onContinue }: Props) {
  return (
    <section className="card card--recent-reads">
      <h2>Recently Read</h2>
      {items.map((item) => (
        <button key={item.comicKey} type="button" className="recent-read-row" onClick={() => onContinue(item)}>
          <span>{item.comicTitle}</span>
          <span>{item.lastChapterTitle}</span>
          <span>Continue</span>
        </button>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Re-run focused renderer tests**

Run: `npm test --prefix apps/downloader-desktop -- tests/preview-state.test.ts tests/smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/components/RecentReadsPanel.tsx apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx apps/downloader-desktop/src/renderer/App.tsx apps/downloader-desktop/src/renderer/state.ts apps/downloader-desktop/src/renderer/styles/theme.css apps/downloader-desktop/tests/preview-state.test.ts apps/downloader-desktop/tests/smoke.test.ts
git commit -m "feat: add recent reading resume and inline reader download ui"
```

### Task 6: Integrate Scroll Save/Restore and Full Verification

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/App.tsx`
- Modify: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx`
- Modify: `apps/downloader-desktop/tests/smoke.test.ts`
- Modify (if needed): `apps/downloader-desktop/README.md`

- [ ] **Step 1: Write failing smoke test for scroll resume callback path**

```ts
// apps/downloader-desktop/tests/smoke.test.ts
// simulate reader scroll event callback
expect(api.saveReadingProgress).toHaveBeenCalledWith(
  expect.objectContaining({
    chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
    scrollRatio: expect.any(Number)
  })
);
```

- [ ] **Step 2: Run focused smoke test to verify red state**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: FAIL because scroll save callback wiring is missing.

- [ ] **Step 3: Implement scroll save/restore hooks**

```tsx
// apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx
<div
  className="reader-image-stream"
  ref={scrollContainerRef}
  onScroll={(event) => {
    const target = event.currentTarget;
    const max = Math.max(1, target.scrollHeight - target.clientHeight);
    onReaderScroll(target.scrollTop / max);
  }}
>
```

```ts
// apps/downloader-desktop/src/renderer/App.tsx
const saveTimerRef = useRef<number | null>(null);
function handleReaderScroll(scrollRatio: number): void {
  if (!api || !state.activeChapterUrl) return;
  if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
  saveTimerRef.current = window.setTimeout(() => {
    void api.saveReadingProgress({
      comicUrl: input.url,
      chapterUrl: state.activeChapterUrl!,
      chapterTitle: activeChapter?.chapterTitle,
      scrollRatio
    });
  }, 500);
}
```

```md
<!-- apps/downloader-desktop/README.md -->
- Reader supports `Download Current Chapter` in background.
- App shows Recently Read list and restores last chapter + scroll position on reopen.
```

- [ ] **Step 4: Run complete verification**

Run: `npm test --prefix tools/download-comic-2025copy && npm run build --prefix tools/download-comic-2025copy`
Expected: PASS.

Run: `npm test --prefix apps/downloader-desktop && npx --prefix apps/downloader-desktop tsc --noEmit -p apps/downloader-desktop/tsconfig.json && npm run build --prefix apps/downloader-desktop`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/App.tsx apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx apps/downloader-desktop/tests/smoke.test.ts apps/downloader-desktop/README.md
git commit -m "feat: persist reader scroll progress and restore on reopen"
```

## Self-Review Checklist (Completed)

- Spec coverage: recent list, inline current-chapter download, local-first restore, scroll resume, fallback/error handling, and verification are mapped to Tasks 1-6.
- Placeholder scan: no TODO/TBD placeholders in steps; each task contains concrete files, commands, and code snippets.
- Type consistency: `RecentComicItem`, `ReaderLoadChapterResult`, `ReaderDownloadCurrentChapterInput`, and `saveReadingProgress` naming is consistent across contracts, preload, main IPC, and renderer tasks.
