# Online Preview Reader UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the desktop preview experience into a reader-first long-scroll comic experience that feels closer to a comic website while keeping existing preview and download flows working.

**Architecture:** Keep the existing Electron main/preload preview pipeline intact and focus the redesign in the renderer. Introduce a lightweight reader-mode state layer, rebuild the layout around a dominant reading surface, and add chapter-navigation behaviors that preserve reading rhythm without redesigning the downloader protocol.

**Tech Stack:** Electron, React, TypeScript, Vitest

---

## File Map

### Existing files to modify

- `apps/downloader-desktop/src/renderer/App.tsx`
  - Recompose the screen into entry and reader stages, wire reader navigation actions, and connect any new state transitions.
- `apps/downloader-desktop/src/renderer/state.ts`
  - Add reader-mode state, chapter navigation helpers, and in-session reading position memory.
- `apps/downloader-desktop/src/renderer/components/DownloadForm.tsx`
  - Reduce this component to an entry/setup surface and remove reader-dominating action emphasis once preview reading starts.
- `apps/downloader-desktop/src/renderer/components/ChapterListPanel.tsx`
  - Make the list act as a collapsible navigator with current-chapter emphasis.
- `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx`
  - Turn the panel into the main reading surface with inline loading/error/success/end-of-chapter states.
- `apps/downloader-desktop/src/renderer/main.tsx`
  - Keep entry point stable and only adjust imported styles if needed.
- `apps/downloader-desktop/src/renderer/styles/theme.css`
  - Replace dashboard-heavy layout rules with reader-first layout, compact header, reading column, and lighter chrome.
- `apps/downloader-desktop/tests/preview-state.test.ts`
  - Cover new state transitions for reader mode, previous/next navigation, and position restore.
- `apps/downloader-desktop/tests/smoke.test.ts`
  - Update behavior tests to match the new UX and remove assertions tied to the old fallback-heavy flow.

### New files to create

- `apps/downloader-desktop/src/renderer/reader-navigation.ts`
  - Small pure helpers for previous/next chapter lookup and end-of-chapter action derivation.
- `apps/downloader-desktop/tests/reader-navigation.test.ts`
  - Unit tests for pure chapter navigation helpers.

## Task 1: Add reader navigation helpers

**Files:**
- Create: `apps/downloader-desktop/src/renderer/reader-navigation.ts`
- Test: `apps/downloader-desktop/tests/reader-navigation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import { getAdjacentChapterUrls, hasAdjacentChapter } from "../src/renderer/reader-navigation";

const chapters = [
  { chapterUrl: "https://www.2025copy.com/comic/slug/1", chapterTitle: "1", index: 1, totalChapters: 3, images: [] },
  { chapterUrl: "https://www.2025copy.com/comic/slug/2", chapterTitle: "2", index: 2, totalChapters: 3, images: [] },
  { chapterUrl: "https://www.2025copy.com/comic/slug/3", chapterTitle: "3", index: 3, totalChapters: 3, images: [] }
];

describe("reader navigation helpers", () => {
  test("returns previous and next chapter urls around active chapter", () => {
    expect(getAdjacentChapterUrls(chapters, "https://www.2025copy.com/comic/slug/2")).toEqual({
      previousChapterUrl: "https://www.2025copy.com/comic/slug/1",
      nextChapterUrl: "https://www.2025copy.com/comic/slug/3"
    });
  });

  test("reports edge chapters correctly", () => {
    expect(hasAdjacentChapter(chapters, "https://www.2025copy.com/comic/slug/1", "previous")).toBe(false);
    expect(hasAdjacentChapter(chapters, "https://www.2025copy.com/comic/slug/1", "next")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix apps/downloader-desktop -- tests/reader-navigation.test.ts`
Expected: FAIL with module-not-found for `../src/renderer/reader-navigation`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { PreviewChapter } from "./state";

export function getAdjacentChapterUrls(chapters: PreviewChapter[], activeChapterUrl: string | null) {
  const activeIndex = chapters.findIndex((chapter) => chapter.chapterUrl === activeChapterUrl);
  if (activeIndex === -1) {
    return {
      previousChapterUrl: null,
      nextChapterUrl: null
    };
  }

  return {
    previousChapterUrl: chapters[activeIndex - 1]?.chapterUrl ?? null,
    nextChapterUrl: chapters[activeIndex + 1]?.chapterUrl ?? null
  };
}

export function hasAdjacentChapter(
  chapters: PreviewChapter[],
  activeChapterUrl: string | null,
  direction: "previous" | "next"
): boolean {
  const adjacent = getAdjacentChapterUrls(chapters, activeChapterUrl);
  return direction === "previous" ? adjacent.previousChapterUrl !== null : adjacent.nextChapterUrl !== null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix apps/downloader-desktop -- tests/reader-navigation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/reader-navigation.ts apps/downloader-desktop/tests/reader-navigation.test.ts
git commit -m "test: add reader navigation helpers"
```

## Task 2: Extend renderer state for reader mode and position memory

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/state.ts`
- Modify: `apps/downloader-desktop/tests/preview-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("enters reader mode, tracks end-of-chapter readiness, and restores chapter position", () => {
  const withPreview = reduceAppState(
    reduceAppState(createInitialAppState(), { type: "previewStarted", taskId: "preview-1" }),
    {
      type: "previewChapter",
      taskId: "preview-1",
      index: 1,
      totalChapters: 2,
      chapterTitle: "Chapter 1",
      chapterUrl: "https://www.2025copy.com/comic/slug/1",
      images: []
    }
  );

  const loading = reduceAppState(withPreview, {
    type: "previewChapterDetailLoading",
    requestId: "req-1",
    chapterUrl: "https://www.2025copy.com/comic/slug/1"
  });

  const success = reduceAppState(loading, {
    type: "previewChapterDetailSuccess",
    requestId: "req-1",
    detail: {
      chapterTitle: "Chapter 1",
      chapterUrl: "https://www.2025copy.com/comic/slug/1",
      totalImages: 2,
      images: ["https://img/1.jpg", "https://img/2.jpg"]
    }
  });

  const stored = reduceAppState(success, {
    type: "readerPositionChanged",
    chapterUrl: "https://www.2025copy.com/comic/slug/1",
    scrollTop: 480
  });

  expect(stored.readerMode).toBe("reading");
  expect(stored.readerPositions["https://www.2025copy.com/comic/slug/1"]).toBe(480);

  const switched = reduceAppState(stored, { type: "setActiveChapter", chapterUrl: "https://www.2025copy.com/comic/slug/1" });
  expect(switched.pendingRestoreChapterUrl).toBe("https://www.2025copy.com/comic/slug/1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix apps/downloader-desktop -- tests/preview-state.test.ts`
Expected: FAIL with unknown action type or missing state fields such as `readerMode`

- [ ] **Step 3: Write minimal implementation**

```ts
export type ReaderMode = "catalog" | "reading";

// Append these members to the current AppState and AppAction definitions.
readerMode: ReaderMode;
readerPositions: Record<string, number>;
pendingRestoreChapterUrl: string | null;

| { type: "readerPositionChanged"; chapterUrl: string; scrollTop: number }
| { type: "readerPositionRestored"; chapterUrl: string }
| { type: "setReaderMode"; mode: ReaderMode };

export function createInitialAppState(): AppState {
  return {
    readerMode: "catalog",
    readerPositions: {},
    pendingRestoreChapterUrl: null
  };
}

if (action.type === "previewChapterDetailSuccess") {
  if (!state.chapterDetailRequestId || state.chapterDetailRequestId !== action.requestId) {
    return state;
  }
  return {
    ...state,
    readerMode: "reading",
    pendingRestoreChapterUrl: action.detail.chapterUrl,
    chapterDetailStatus: "success",
    chapterDetail: {
      ...action.detail,
      images: action.detail.images.filter((image) => image.trim().length > 0)
    },
    chapterDetailError: null
  };
}

if (action.type === "setActiveChapter") {
  const exists = state.previewChapters.some((chapter) => chapter.chapterUrl === action.chapterUrl);
  if (!exists) {
    return state;
  }
  return {
    ...state,
    readerMode: "catalog",
    activeChapterUrl: action.chapterUrl,
    pendingRestoreChapterUrl: action.chapterUrl,
    chapterDetailStatus: state.chapterDetail?.chapterUrl === action.chapterUrl ? "success" : "idle",
    chapterDetail: state.chapterDetail?.chapterUrl === action.chapterUrl ? state.chapterDetail : null,
    chapterDetailError: null
  };
}

if (action.type === "readerPositionChanged") {
  return {
    ...state,
    readerPositions: {
      ...state.readerPositions,
      [action.chapterUrl]: action.scrollTop
    }
  };
}

if (action.type === "readerPositionRestored") {
  if (state.pendingRestoreChapterUrl !== action.chapterUrl) {
    return state;
  }
  return {
    ...state,
    pendingRestoreChapterUrl: null
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix apps/downloader-desktop -- tests/preview-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/state.ts apps/downloader-desktop/tests/preview-state.test.ts
git commit -m "feat: add reader mode state"
```

## Task 3: Reshape the app shell into entry and reader stages

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/App.tsx`
- Modify: `apps/downloader-desktop/tests/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("App shows setup first and promotes reader layout after chapter load", async () => {
  const previewHandlers: Array<
    (event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void
  > = [];
  const statusHandlers: Array<
    (event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void
  > = [];
  const previousApi = window.downloader;
  const api = createMockDownloaderApi();
  api.onPreviewChapter = vi.fn((handler) => {
    previewHandlers.push(handler);
    return () => {};
  });
  api.onPreviewStatus = vi.fn((handler) => {
    statusHandlers.push(handler);
    return () => {};
  });
  api.loadPreviewChapter = vi.fn(async () => ({
    chapterTitle: "Chapter 1",
    chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
    totalImages: 2,
    images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
  }));
  window.downloader = api;

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(createElement(App));
  });

  const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview");
  previewButton?.click();
  await Promise.resolve();

  previewHandlers[0]?.({
    taskId: "preview-mock",
    index: 1,
    totalChapters: 1,
    chapterTitle: "Chapter 1",
    chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
    images: ["https://img/cover-1.jpg"]
  });
  statusHandlers[0]?.({ taskId: "preview-mock", state: "done" });
  await Promise.resolve();

  const chapterButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.includes("Chapter 1"));
  chapterButton?.click();
  await Promise.resolve();

  expect(container.textContent).toContain("Preview");
  expect(container.textContent).toContain("Previous chapter");
  expect(container.textContent).toContain("Next chapter");

  root.unmount();
  container.remove();
  window.downloader = previousApi;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: FAIL because the current app does not expose the reader-first labels or layout states

- [ ] **Step 3: Write minimal implementation**

```tsx
const adjacent = getAdjacentChapterUrls(state.previewChapters, state.activeChapterUrl);
const isReaderStage = state.readerMode === "reading" || state.chapterDetailStatus === "loading" || state.chapterDetailStatus === "error";

async function handleGoToAdjacentChapter(direction: "previous" | "next"): Promise<void> {
  const nextChapterUrl = direction === "previous" ? adjacent.previousChapterUrl : adjacent.nextChapterUrl;
  if (!nextChapterUrl) {
    return;
  }
  await handleLoadChapter(nextChapterUrl);
}

return (
  <main className={`app-shell ${isReaderStage ? "app-shell--reader" : "app-shell--entry"}`}>
    <section className="app-stage app-stage--setup">
      <DownloadForm
        values={input}
        isRunning={state.status === "running"}
        isPreviewing={state.previewStatus === "previewing"}
        hasApi={!!api}
        canStart={baseStartValidation.ok}
        canDownloadAll={baseStartValidation.ok}
        canDownloadSelected={baseStartValidation.ok && state.selectedChapterUrls.length > 0}
        canPreview={previewValidation.ok}
        selectedChapterCount={state.selectedChapterUrls.length}
        previewMaxChapters={previewMaxChapters}
        previewImagesPerChapter={previewImagesPerChapter}
        validationErrors={hasTriedStart ? baseStartValidation.errors : []}
        onChange={updateInput}
        onChangePreviewMaxChapters={setPreviewMaxChapters}
        onChangePreviewImagesPerChapter={setPreviewImagesPerChapter}
        onStartPreview={() => void handleStartPreview()}
        onStopPreview={() => void handleStopPreview()}
        onDownloadAll={() => void handleDownloadAll()}
        onDownloadSelected={() => void handleDownloadSelected()}
        onStop={() => void handleStop()}
        onSelectOutputDir={() => void handleSelectOutputDir()}
        onOpenOutputDir={() => void handleOpenOutputDir()}
      />
    </section>
    <section className="app-stage app-stage--reader">
      <ReaderPanel
        previewStatus={state.previewStatus}
        activeChapter={activeChapter}
        chapterDetailStatus={state.chapterDetailStatus}
        chapterDetail={state.chapterDetail}
        chapterDetailError={state.chapterDetailError}
        previewError={state.previewError}
        hasPreviousChapter={adjacent.previousChapterUrl !== null}
        hasNextChapter={adjacent.nextChapterUrl !== null}
        onPreviousChapter={() => void handleGoToAdjacentChapter("previous")}
        onNextChapter={() => void handleGoToAdjacentChapter("next")}
        onBackToList={() => dispatch({ type: "setReaderMode", mode: "catalog" })}
        onRetry={() => void handleRetryCurrentChapter()}
      />
    </section>
  </main>
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/App.tsx apps/downloader-desktop/tests/smoke.test.ts
git commit -m "feat: split setup and reader stages"
```

## Task 4: Redesign the chapter navigator and setup surface

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/components/ChapterListPanel.tsx`
- Modify: `apps/downloader-desktop/src/renderer/components/DownloadForm.tsx`
- Modify: `apps/downloader-desktop/tests/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("DownloadForm and chapter navigator reflect reader-first copy and controls", () => {
  const setupMarkup = renderToStaticMarkup(createElement(DownloadForm, buildDownloadFormProps()));
  expect(setupMarkup).toContain("Start Reading");
  expect(setupMarkup).not.toContain("Download Setup");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: FAIL because current labels still expose `Download Setup` and downloader-heavy wording

- [ ] **Step 3: Write minimal implementation**

```tsx
interface DownloadFormProps {
  isReaderStage?: boolean;
}

<section className="card card--setup">
  <h2>Start Reading</h2>
  <p className="setup-copy">Preview chapters first, then read online before deciding what to download.</p>
  <div className="field-group">
    <label className="field-label" htmlFor="download-url">Comic URL</label>
    <input id="download-url" className="input" type="url" value={props.values.url} onChange={(event) => props.onChange("url", event.target.value)} />
  </div>
  <div className="field-row-grid">
    <div className="field-group">
      <label className="field-label" htmlFor="preview-max-chapters">Preview Chapters</label>
      <input id="preview-max-chapters" className="input" type="number" min={1} value={props.previewMaxChapters} />
    </div>
    <div className="field-group">
      <label className="field-label" htmlFor="preview-images-per-chapter">Images/Chapter</label>
      <input id="preview-images-per-chapter" className="input" type="number" min={1} value={props.previewImagesPerChapter} />
    </div>
  </div>
  <div className="button-row">
    <button type="button" className="button button--primary">Preview</button>
    <button type="button" className="button button--secondary">Stop Preview</button>
  </div>
  <details className="setup-details">
    <summary>Download options</summary>
    <div className="field-group">Output directory field and browse button</div>
    <div className="field-row-grid">Concurrency and retries fields</div>
    <div className="button-row">Download all, download selected, stop, and open output actions</div>
  </details>
</section>

<section className="card card--chapter-list">
  <div className="chapter-list-header">
    <h2>Chapters</h2>
    <button type="button" className="button button--ghost">Hide List</button>
  </div>
  <p className="chapter-list-help">Pick a chapter to start reading. The current chapter stays highlighted.</p>
</section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/components/DownloadForm.tsx apps/downloader-desktop/src/renderer/components/ChapterListPanel.tsx apps/downloader-desktop/tests/smoke.test.ts
git commit -m "feat: soften setup and chapter navigator copy"
```

## Task 5: Rebuild the reader panel around reading states and chapter transitions

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx`
- Modify: `apps/downloader-desktop/tests/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("ReaderPanel renders inline loading, navigation, and end-of-chapter next action", () => {
  const markup = renderToStaticMarkup(
    createElement(ReaderPanel, {
      previewStatus: "ready",
      activeChapter: { chapterTitle: "Chapter 1", chapterUrl: "https://www.2025copy.com/comic/slug/1", index: 1, totalChapters: 2, images: [] },
      chapterDetailStatus: "success",
      chapterDetail: {
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/slug/1",
        totalImages: 1,
        images: ["https://img/1.jpg"]
      },
      chapterDetailError: null,
      previewError: null,
      hasPreviousChapter: false,
      hasNextChapter: true,
      onPreviousChapter: () => {},
      onNextChapter: () => {},
      onBackToList: () => {},
      onRetry: () => {}
    })
  );

  expect(markup).toContain("Previous chapter");
  expect(markup).toContain("Next chapter");
  expect(markup).toContain("Up next");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: FAIL because `ReaderPanel` does not yet expose reader navigation props or end-of-chapter actions

- [ ] **Step 3: Write minimal implementation**

```tsx
interface ReaderPanelProps {
  previewStatus: PreviewStatus;
  activeChapter: PreviewChapter | null;
  chapterDetailStatus: ChapterDetailStatus;
  chapterDetail: {
    chapterTitle: string;
    chapterUrl: string;
    totalImages: number;
    images: string[];
    capturedAt?: string;
  } | null;
  chapterDetailError: string | null;
  previewError: string | null;
  hasPreviousChapter: boolean;
  hasNextChapter: boolean;
  onPreviousChapter: () => void;
  onNextChapter: () => void;
  onBackToList: () => void;
}

<section className="card card--reader">
  <header className="reader-header">
    <button type="button" onClick={props.onBackToList}>Back to chapter list</button>
    <div className="reader-header-copy">
      <p className="reader-kicker">Now reading</p>
      <h2>{chapterDetail.chapterTitle}</h2>
    </div>
    <div className="reader-header-actions">
      <button type="button" onClick={props.onPreviousChapter} disabled={!props.hasPreviousChapter}>Previous chapter</button>
      <button type="button" onClick={props.onNextChapter} disabled={!props.hasNextChapter}>Next chapter</button>
    </div>
  </header>

  <div className="reader-image-stream">
    {chapterDetail.images.map((image, index) => (
      <div key={`${chapterDetail.chapterUrl}-${index}`} className="reader-image-frame">
        <img src={image} alt={`${chapterDetail.chapterTitle} page ${index + 1}`} className="reader-image" loading="lazy" />
      </div>
    ))}
  </div>

  <footer className="reader-endcap">
    <p className="reader-endcap-label">Up next</p>
    <button type="button" onClick={props.onNextChapter} disabled={!props.hasNextChapter}>Next chapter</button>
  </footer>
</section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx apps/downloader-desktop/tests/smoke.test.ts
git commit -m "feat: add reader navigation states"
```

## Task 6: Add DOM-based reading position restore and adjacent chapter loading hooks

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/App.tsx`
- Modify: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx`
- Modify: `apps/downloader-desktop/tests/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("App restores scroll position when returning to the same chapter", async () => {
  const previousApi = window.downloader;
  const api = createMockDownloaderApi();
  api.loadPreviewChapter = vi.fn(async () => ({
    chapterTitle: "Chapter 1",
    chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
    totalImages: 3,
    images: ["https://img/1.jpg", "https://img/2.jpg", "https://img/3.jpg"]
  }));
  window.downloader = api;

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(createElement(App));
  });

  const readerContainer = container.querySelector(".reader-scroll-region") as HTMLDivElement;
  readerContainer.scrollTop = 480;
  readerContainer.dispatchEvent(new Event("scroll"));

  const backButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Back to chapter list");
  backButton?.click();
  const chapterButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.includes("Chapter 1"));
  chapterButton?.click();
  await Promise.resolve();

  expect(readerContainer.scrollTop).toBe(480);

  root.unmount();
  container.remove();
  window.downloader = previousApi;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: FAIL because the reader container does not yet persist and restore chapter scroll positions

- [ ] **Step 3: Write minimal implementation**

```tsx
const readerScrollRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  const chapterUrl = state.activeChapterUrl;
  const container = readerScrollRef.current;
  if (!chapterUrl || !container) {
    return;
  }

  const handleScroll = () => {
    dispatch({
      type: "readerPositionChanged",
      chapterUrl,
      scrollTop: container.scrollTop
    });
  };

  container.addEventListener("scroll", handleScroll, { passive: true });
  return () => container.removeEventListener("scroll", handleScroll);
}, [state.activeChapterUrl]);

useEffect(() => {
  const chapterUrl = state.pendingRestoreChapterUrl;
  const container = readerScrollRef.current;
  if (!chapterUrl || !container) {
    return;
  }

  container.scrollTop = state.readerPositions[chapterUrl] ?? 0;
  dispatch({ type: "readerPositionRestored", chapterUrl });
}, [state.pendingRestoreChapterUrl, state.readerPositions]);

<ReaderPanel
  readerScrollRef={readerScrollRef}
  previewStatus={state.previewStatus}
  activeChapter={activeChapter}
  chapterDetailStatus={state.chapterDetailStatus}
  chapterDetail={state.chapterDetail}
  chapterDetailError={state.chapterDetailError}
  previewError={state.previewError}
  hasPreviousChapter={adjacent.previousChapterUrl !== null}
  hasNextChapter={adjacent.nextChapterUrl !== null}
  onPreviousChapter={() => void handleGoToAdjacentChapter("previous")}
  onNextChapter={() => void handleGoToAdjacentChapter("next")}
  onBackToList={() => dispatch({ type: "setReaderMode", mode: "catalog" })}
  onRetry={() => void handleRetryCurrentChapter()}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/App.tsx apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx apps/downloader-desktop/tests/smoke.test.ts
git commit -m "feat: restore in-session reader position"
```

## Task 7: Apply reader-first styling and remove dashboard feel

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/styles/theme.css`
- Test: `apps/downloader-desktop/tests/reader-style.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("theme includes reader-first layout classes", async () => {
  const css = await readFile(new URL("../src/renderer/styles/theme.css", import.meta.url), "utf8");
  expect(css).toContain(".app-shell--reader");
  expect(css).toContain(".reader-header");
  expect(css).toContain(".reader-endcap");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix apps/downloader-desktop -- tests/reader-style.test.ts`
Expected: FAIL because the stylesheet does not yet contain the new reader-first classes

- [ ] **Step 3: Write minimal implementation**

```css
.app-shell--reader {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  min-height: 100vh;
}

.reader-header {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.reader-image-stream {
  display: grid;
  gap: 12px;
  justify-items: center;
}

.reader-endcap {
  display: grid;
  gap: 12px;
  justify-items: center;
  padding: 24px 0 48px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix apps/downloader-desktop -- tests/reader-style.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer/styles/theme.css apps/downloader-desktop/tests/reader-style.test.ts
git commit -m "style: add reader-first layout"
```

## Task 8: Full desktop verification

**Files:**
- Modify: none unless verification exposes a defect

- [ ] **Step 1: Run targeted desktop tests**

Run: `npm test --prefix apps/downloader-desktop -- tests/reader-navigation.test.ts tests/preview-state.test.ts tests/smoke.test.ts tests/reader-style.test.ts`
Expected: PASS

- [ ] **Step 2: Run full desktop test suite**

Run: `npm test --prefix apps/downloader-desktop`
Expected: PASS

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit -p apps/downloader-desktop/tsconfig.json`
Expected: PASS with no TypeScript errors

- [ ] **Step 4: Run production build**

Run: `npm run build --prefix apps/downloader-desktop`
Expected: PASS and produce updated renderer/electron artifacts

- [ ] **Step 5: Commit final implementation**

```bash
git add apps/downloader-desktop
git commit -m "feat: refresh online preview reader ux"
```

## Spec Coverage Check

- Reader-first structure: covered by Tasks 3, 4, and 7.
- Chapter switching and reading rhythm: covered by Tasks 1, 3, and 5.
- Inline loading/error/end-of-chapter behavior: covered by Task 5.
- In-session reading continuity: covered by Tasks 2 and 6.
- Download remains secondary but accessible: covered by Tasks 3 and 4.

## Notes

- Do not redesign the downloader protocol unless a blocker appears during adjacent-chapter preparation.
- Keep changes incremental; prefer extending the current reducer and component set over introducing a large new view hierarchy.
- If `smoke.test.ts` becomes too broad during implementation, split new reader assertions into a dedicated test file before adding more coverage.
