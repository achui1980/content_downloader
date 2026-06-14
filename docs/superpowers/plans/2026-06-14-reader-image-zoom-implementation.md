# Reader Image Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add adjustable reader image zoom presets so full chapter pages render smaller by default and can be resized from the reader header.

**Architecture:** Keep the change local to the desktop renderer. Add a small `readerZoom` preset to renderer state, pass it from `App` into `ReaderPanel`, and apply the selected percentage directly to each `.reader-image-frame` while keeping the existing continuous vertical reader flow and chapter navigation intact.

**Tech Stack:** TypeScript, React 18, Electron renderer, CSS, Vitest, jsdom

---

## File Structure

- Modify: `apps/downloader-desktop/src/renderer/state.ts` - define zoom presets, store the active preset in app state, and handle zoom updates.
- Modify: `apps/downloader-desktop/src/renderer/App.tsx` - pass zoom state and change handler into both `ReaderPanel` render paths.
- Modify: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx` - render the zoom control and apply the selected width to chapter image frames.
- Modify: `apps/downloader-desktop/src/renderer/styles/theme.css` - style the zoom control and ensure reduced-width image frames stay centered.
- Modify: `apps/downloader-desktop/tests/preview-state.test.ts` - cover the default zoom value and reducer updates.
- Modify: `apps/downloader-desktop/tests/smoke.test.ts` - cover `ReaderPanel` zoom control rendering and end-to-end zoom interaction through `App`.
- Modify: `apps/downloader-desktop/tests/reader-style.test.ts` - lock in the centered reduced-width frame and zoom control selectors.

### Task 1: Add Reader Zoom State

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/state.ts`
- Modify: `apps/downloader-desktop/tests/preview-state.test.ts`

- [ ] **Step 1: Write failing reducer tests for default zoom and zoom updates**

```ts
// apps/downloader-desktop/tests/preview-state.test.ts
test("starts with the default reader zoom preset", () => {
  const state = createInitialAppState();

  expect(state.readerZoom).toBe(85);
});

test("updates reader zoom when the user picks another preset", () => {
  const next = reduceAppState(createInitialAppState(), {
    type: "setReaderZoom",
    zoom: 70
  });

  expect(next.readerZoom).toBe(70);
});
```

- [ ] **Step 2: Run focused state tests to verify they fail first**

Run: `npm test --prefix apps/downloader-desktop -- tests/preview-state.test.ts`
Expected: FAIL because `readerZoom` state and the `setReaderZoom` action do not exist yet.

- [ ] **Step 3: Implement the minimal zoom state in the reducer**

```ts
// apps/downloader-desktop/src/renderer/state.ts
export const readerZoomLevels = [70, 85, 100] as const;
export type ReaderZoom = (typeof readerZoomLevels)[number];

export interface AppState {
  // ...existing fields...
  readerZoom: ReaderZoom;
}

export type AppAction =
  // ...existing actions...
  | { type: "setReaderZoom"; zoom: ReaderZoom };

export function createInitialAppState(): AppState {
  return {
    // ...existing fields...
    readerZoom: 85,
    chapterDetailError: null
  };
}

export function reduceAppState(state: AppState, action: AppAction): AppState {
  if (action.type === "setReaderZoom") {
    return {
      ...state,
      readerZoom: action.zoom
    };
  }

  // ...existing reducer branches...
}
```

- [ ] **Step 4: Re-run the focused state test**

Run: `npm test --prefix apps/downloader-desktop -- tests/preview-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the state change**

```bash
git add apps/downloader-desktop/src/renderer/state.ts apps/downloader-desktop/tests/preview-state.test.ts
git commit -m "feat: add reader zoom state"
```

### Task 2: Wire Zoom Through App and ReaderPanel

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/App.tsx`
- Modify: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx`
- Modify: `apps/downloader-desktop/tests/smoke.test.ts`

- [ ] **Step 1: Write failing UI tests for the zoom control and interactive width update**

```ts
// apps/downloader-desktop/tests/smoke.test.ts
test("ReaderPanel renders page-size presets in the reader header", () => {
  const markup = renderToStaticMarkup(
    createElement(ReaderPanel, {
      isReaderStage: true,
      previewStatus: "ready",
      activeChapter: {
        index: 1,
        totalChapters: 2,
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        images: ["https://img/preview-1.jpg"]
      },
      chapterDetailStatus: "success",
      chapterDetail: {
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        totalImages: 2,
        images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
      },
      chapterDetailError: null,
      previewError: null,
      previousChapter: null,
      nextChapter: null,
      readerZoom: 85,
      scrollContainerRef: createRef<HTMLDivElement>(),
      onReaderScroll: () => {},
      onReaderZoomChange: () => {},
      onRetry: () => {},
      onBackToSetup: () => {},
      onStopPreview: () => {},
      onOpenPreviousChapter: () => {},
      onOpenNextChapter: () => {}
    })
  );

  expect(markup).toContain("Page size");
  expect(markup).toContain(">70%<");
  expect(markup).toContain(">85%<");
  expect(markup).toContain(">100%<");
  expect(markup).toContain('aria-pressed="true"');
});

test("App updates reader image width when a new zoom preset is clicked", async () => {
  const previewHandlers: Array<(event: { taskId: string; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }) => void> = [];
  const statusHandlers: Array<(event: { taskId: string; state: "starting" | "running" | "done" | "failed" | "stopped"; message?: string }) => void> = [];

  const api: DownloaderPreloadApi = {
    startDownload: vi.fn(async () => ({ taskId: "task-mock" })),
    stopDownload: vi.fn(async () => ({ stopped: true })),
    startPreview: vi.fn(async () => ({ taskId: "preview-mock" })),
    stopPreview: vi.fn(async () => ({ stopped: true })),
    loadPreviewChapter: vi.fn(async () => ({
      chapterTitle: "Chapter 1",
      chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
      totalImages: 2,
      images: ["https://img/full-1.jpg", "https://img/full-2.jpg"]
    })),
    selectOutputDir: vi.fn(async () => null),
    openOutputDir: vi.fn(async () => null),
    onProgress: vi.fn(() => () => {}),
    onLog: vi.fn(() => () => {}),
    onStatus: vi.fn(() => () => {}),
    onPreviewLog: vi.fn(() => () => {}),
    onPreviewChapter: vi.fn((handler) => {
      previewHandlers.push(handler);
      return () => {};
    }),
    onPreviewStatus: vi.fn((handler) => {
      statusHandlers.push(handler);
      return () => {};
    })
  };

  const previousApi = window.downloader;
  window.downloader = api;

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(createElement(App));
  });

  try {
    const previewButton = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Preview Chapters");
    if (!previewButton) {
      throw new Error("Preview Chapters button not found");
    }

    previewButton.click();
    await Promise.resolve();

    const previewTaskId = (api.startPreview as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.taskId;
    if (!previewTaskId) {
      throw new Error("Preview task id not captured");
    }

    previewHandlers.forEach((handler) => {
      handler({
        taskId: previewTaskId,
        index: 1,
        totalChapters: 1,
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/example/chapter-1",
        images: ["https://img/preview-1.jpg"]
      });
    });
    statusHandlers.forEach((handler) => {
      handler({ taskId: previewTaskId, state: "done" });
    });
    await Promise.resolve();

    const chapterButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button.chapter-row")).find(
      (node) => node.textContent?.trim() === "Chapter 1"
    );
    if (!chapterButton) {
      throw new Error("Chapter 1 button not found");
    }

    chapterButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const zoomButton = Array.from(container.querySelectorAll<HTMLButtonElement>(".reader-zoom-option")).find(
      (node) => node.textContent?.trim() === "70%"
    );
    if (!zoomButton) {
      throw new Error("70% zoom button not found");
    }

    zoomButton.click();
    await Promise.resolve();

    const firstFrame = container.querySelector<HTMLDivElement>(".reader-image-frame");
    expect(firstFrame?.getAttribute("style")).toContain("width: 70%");
  } finally {
    root.unmount();
    container.remove();
    window.downloader = previousApi;
  }
});
```

- [ ] **Step 2: Run focused smoke tests to verify they fail first**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: FAIL because `ReaderPanel` does not accept zoom props and no zoom control exists in the markup.

- [ ] **Step 3: Implement the minimal App and ReaderPanel wiring**

```ts
// apps/downloader-desktop/src/renderer/App.tsx
<ReaderPanel
  isReaderStage={true}
  previewStatus={state.previewStatus}
  activeChapter={activeChapter}
  chapterDetailStatus={state.chapterDetailStatus}
  chapterDetail={state.chapterDetail}
  chapterDetailError={state.chapterDetailError}
  previewError={state.previewError}
  previousChapter={previousChapter}
  nextChapter={nextChapter}
  readerZoom={state.readerZoom}
  scrollContainerRef={readerScrollContainerRef}
  onReaderScroll={handleReaderScroll}
  onReaderZoomChange={(zoom) => dispatch({ type: "setReaderZoom", zoom })}
  onBackToSetup={handleReturnToSetup}
  onStopPreview={handleStopPreview}
  canStopPreview={state.previewStatus === "previewing"}
  navigationDisabled={state.chapterDetailStatus === "loading"}
  onOpenPreviousChapter={() => {
    void handleLoadAdjacentChapter(previousChapter?.chapterUrl ?? null);
  }}
  onOpenNextChapter={() => {
    void handleLoadAdjacentChapter(nextChapter?.chapterUrl ?? null);
  }}
  onRetry={handleRetryCurrentChapter}
/>

<ReaderPanel
  isReaderStage={false}
  previewStatus={state.previewStatus}
  activeChapter={activeChapter}
  chapterDetailStatus={state.chapterDetailStatus}
  chapterDetail={state.chapterDetail}
  chapterDetailError={state.chapterDetailError}
  previewError={state.previewError}
  previousChapter={previousChapter}
  nextChapter={nextChapter}
  readerZoom={state.readerZoom}
  scrollContainerRef={readerScrollContainerRef}
  onReaderScroll={handleReaderScroll}
  onReaderZoomChange={(zoom) => dispatch({ type: "setReaderZoom", zoom })}
  onBackToSetup={handleReturnToSetup}
  onStopPreview={handleStopPreview}
  canStopPreview={state.previewStatus === "previewing"}
  navigationDisabled={state.chapterDetailStatus === "loading"}
  onOpenPreviousChapter={() => {
    void handleLoadAdjacentChapter(previousChapter?.chapterUrl ?? null);
  }}
  onOpenNextChapter={() => {
    void handleLoadAdjacentChapter(nextChapter?.chapterUrl ?? null);
  }}
  onRetry={handleRetryCurrentChapter}
/>
```

```ts
// apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx
import type { ChapterDetailStatus, PreviewChapter, PreviewStatus, ReaderZoom } from "../state";
import { readerZoomLevels } from "../state";

interface ReaderPanelProps {
  // ...existing props...
  readerZoom: ReaderZoom;
  onReaderZoomChange: (zoom: ReaderZoom) => void;
}

<div className="reader-actions">
  <div className="reader-zoom-control" role="group" aria-label="Page size">
    <span className="reader-zoom-label">Page size</span>
    <div className="reader-zoom-options">
      {readerZoomLevels.map((zoom) => (
        <button
          key={zoom}
          type="button"
          className={`reader-zoom-option ${props.readerZoom === zoom ? "reader-zoom-option--active" : ""}`.trim()}
          aria-pressed={props.readerZoom === zoom}
          onClick={() => props.onReaderZoomChange(zoom)}
        >
          {zoom}%
        </button>
      ))}
    </div>
  </div>
  <button type="button" className="button button--secondary" onClick={props.onBackToSetup}>
    Back to setup
  </button>
  {props.canStopPreview ? (
    <button type="button" className="button button--secondary" onClick={props.onStopPreview}>
      Stop Preview
    </button>
  ) : null}
  <button
    type="button"
    className="button button--secondary"
    disabled={props.navigationDisabled || !props.previousChapter}
    onClick={props.onOpenPreviousChapter}
  >
    Previous chapter
  </button>
  <button
    type="button"
    className="button button--secondary"
    disabled={props.navigationDisabled || !props.nextChapter}
    onClick={props.onOpenNextChapter}
  >
    Next chapter
  </button>
</div>

{chapterDetail.images.map((image, index) => (
  <div
    key={`${chapterDetail.chapterUrl}-${index}`}
    className="reader-image-frame"
    style={{ width: `${props.readerZoom}%` }}
  >
    <img
      src={image}
      alt={`${chapterDetail.chapterTitle} page ${index + 1}`}
      className="reader-image"
      loading="lazy"
      width={1200}
      height={1600}
    />
  </div>
))}
```

- [ ] **Step 4: Re-run the focused smoke test**

Run: `npm test --prefix apps/downloader-desktop -- tests/smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the UI wiring**

```bash
git add apps/downloader-desktop/src/renderer/App.tsx apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx apps/downloader-desktop/tests/smoke.test.ts
git commit -m "feat: add reader zoom controls"
```

### Task 3: Center Reduced-Width Pages and Lock the Style Contract

**Files:**
- Modify: `apps/downloader-desktop/src/renderer/styles/theme.css`
- Modify: `apps/downloader-desktop/tests/reader-style.test.ts`

- [ ] **Step 1: Write failing CSS tests for centered page frames and zoom selector styles**

```ts
// apps/downloader-desktop/tests/reader-style.test.ts
test("keeps reduced-width reader image frames centered", () => {
  const css = readFileSync("src/renderer/styles/theme.css", "utf8");

  expectSelectorBlock(css, ".reader-image-frame", ["flex-shrink: 0;", "max-width: 100%;", "margin-inline: auto;"]);
});

test("defines compact reader zoom controls", () => {
  const css = readFileSync("src/renderer/styles/theme.css", "utf8");

  expectSelectorBlock(css, ".reader-zoom-control", ["display: grid;", "gap: 6px;"]);
  expectSelectorBlock(css, ".reader-zoom-options", ["display: inline-flex;", "gap: 6px;"]);
  expectSelectorBlock(css, ".reader-zoom-option--active", ["border-color:", "background:"]);
});
```

- [ ] **Step 2: Run focused style tests to verify they fail first**

Run: `npm test --prefix apps/downloader-desktop -- tests/reader-style.test.ts`
Expected: FAIL because the new zoom selectors and centered frame properties are not in the stylesheet yet.

- [ ] **Step 3: Implement the minimal reader zoom styles**

```css
/* apps/downloader-desktop/src/renderer/styles/theme.css */
.reader-zoom-control {
  display: grid;
  gap: 6px;
}

.reader-zoom-label {
  color: var(--muted);
  font-size: 0.78rem;
}

.reader-zoom-options {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.reader-zoom-option {
  border: 1px solid rgba(120, 149, 217, 0.28);
  border-radius: 999px;
  background: rgba(10, 16, 26, 0.82);
  color: #dbe7ff;
  padding: 6px 10px;
  cursor: pointer;
}

.reader-zoom-option--active {
  border-color: rgba(94, 168, 255, 0.92);
  background: rgba(40, 86, 146, 0.48);
}

.reader-image-frame {
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  margin-inline: auto;
  border-radius: 12px;
  border: 1px solid rgba(120, 149, 217, 0.24);
  background: rgba(4, 8, 14, 0.64);
  overflow: hidden;
}
```

- [ ] **Step 4: Re-run the focused style test**

Run: `npm test --prefix apps/downloader-desktop -- tests/reader-style.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the stylesheet contract**

```bash
git add apps/downloader-desktop/src/renderer/styles/theme.css apps/downloader-desktop/tests/reader-style.test.ts
git commit -m "feat: style reader zoom presets"
```

### Task 4: Run Final Verification

**Files:**
- Modify: none
- Test: `apps/downloader-desktop/tests/preview-state.test.ts`
- Test: `apps/downloader-desktop/tests/smoke.test.ts`
- Test: `apps/downloader-desktop/tests/reader-style.test.ts`

- [ ] **Step 1: Run the full desktop test suite**

```bash
npm test --prefix apps/downloader-desktop
```

Expected: PASS with the new zoom tests and no regressions in preview/download reader flows.

- [ ] **Step 2: Run the desktop typecheck**

```bash
npx tsc --noEmit -p apps/downloader-desktop/tsconfig.json
```

Expected: PASS with `ReaderZoom` and new `ReaderPanel` props fully typed.

- [ ] **Step 3: Run the desktop production build**

```bash
npm run build --prefix apps/downloader-desktop
```

Expected: PASS and emit the renderer and Electron bundles without warnings caused by the zoom change.

- [ ] **Step 4: Commit the verified feature branch state**

```bash
git add apps/downloader-desktop/src/renderer/state.ts apps/downloader-desktop/src/renderer/App.tsx apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx apps/downloader-desktop/src/renderer/styles/theme.css apps/downloader-desktop/tests/preview-state.test.ts apps/downloader-desktop/tests/smoke.test.ts apps/downloader-desktop/tests/reader-style.test.ts
git commit -m "feat: add adjustable reader image zoom"
```
