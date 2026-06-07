# Desktop Preview Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reader-style pre-download preview flow where users preview chapter images, select chapters, and download only the selected subset.

**Architecture:** Extend the downloader CLI with `preview` mode and explicit chapter filters, then wire a separate preview session in Electron main while keeping existing download events backward-compatible. Recompose renderer into a reader-first layout (left chapter list, right image stream, bottom logs/status) with strict task ID gating and download-time selection locking.

**Tech Stack:** TypeScript, Node.js, Playwright, Electron, React, Vitest, Vite

---

## File Structure

- Modify: `tools/download-comic-2025copy/src/cli.ts` - parse preview args and repeatable `--chapter-url`.
- Modify: `tools/download-comic-2025copy/src/config.ts` - validate and normalize preview/filter options.
- Modify: `tools/download-comic-2025copy/src/types.ts` - extend config and preview event models.
- Modify: `tools/download-comic-2025copy/src/main.ts` - add `runPreview` and selected-chapter filtering in download mode.
- Create: `tools/download-comic-2025copy/tests/main.preview.test.ts` - preview event and chapter-filter behavior.
- Modify: `tools/download-comic-2025copy/tests/config.test.ts` - CLI/config coverage for new flags.
- Modify: `apps/downloader-desktop/src/main/log-event-parser.ts` - parse `preview.*` events.
- Create: `apps/downloader-desktop/src/main/preview-session.ts` - preview process lifecycle management.
- Modify: `apps/downloader-desktop/src/main/index.ts` - add preview IPC handlers and channel fan-out.
- Modify: `apps/downloader-desktop/src/preload/index.ts` - expose preview methods/event subscriptions.
- Modify: `apps/downloader-desktop/src/shared/contracts.ts` - add preview types and selected chapter download input.
- Modify: `apps/downloader-desktop/src/shared/validation.ts` - validation for preview params and chapter selection.
- Modify: `apps/downloader-desktop/src/renderer/state.ts` - preview/download combined state machine.
- Modify: `apps/downloader-desktop/src/renderer/App.tsx` - reader-first orchestration and event wiring.
- Create: `apps/downloader-desktop/src/renderer/components/ChapterListPanel.tsx` - chapter navigation + selection.
- Create: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx` - original-image reading panel.
- Modify: `apps/downloader-desktop/src/renderer/components/DownloadForm.tsx` - shrink to top-row controls and preview actions.
- Modify: `apps/downloader-desktop/src/renderer/styles/theme.css` - two-pane reader layout and responsive behavior.
- Modify: `apps/downloader-desktop/tests/log-event-parser.test.ts` - preview event parsing tests.
- Create: `apps/downloader-desktop/tests/preview-session.test.ts` - preview spawn/session behavior tests.
- Modify: `apps/downloader-desktop/tests/preload-api.test.ts` - preview IPC bridge tests.
- Modify: `apps/downloader-desktop/tests/app-state.test.ts` - new state transition expectations.
- Create: `apps/downloader-desktop/tests/preview-state.test.ts` - selection lock and stale-event gating tests.
- Modify: `tools/download-comic-2025copy/README.md` - document preview and chapter-url CLI usage.
- Modify: `apps/downloader-desktop/README.md` - document preview-first desktop workflow.

### Task 1: Extend downloader CLI arguments and config validation

**Files:**
- Modify: `tools/download-comic-2025copy/tests/config.test.ts`
- Modify: `tools/download-comic-2025copy/src/cli.ts`
- Modify: `tools/download-comic-2025copy/src/config.ts`
- Modify: `tools/download-comic-2025copy/src/types.ts`

- [ ] **Step 1: Write the failing tests for preview and chapter-url args**

```ts
it("parses preview args and repeated chapter-url", () => {
  const parsed = parseCliArgs([
    "--url",
    "https://www.2025copy.com/comic/guichuyinxiong",
    "--mode",
    "preview",
    "--preview-max-chapters",
    "8",
    "--preview-images-per-chapter",
    "4",
    "--chapter-url",
    "https://www.2025copy.com/comic/guichuyinxiong/chapter/a",
    "--chapter-url",
    "https://www.2025copy.com/comic/guichuyinxiong/chapter/b"
  ]);

  expect(parsed.mode).toBe("preview");
  expect(parsed.previewMaxChapters).toBe(8);
  expect(parsed.previewImagesPerChapter).toBe(4);
  expect(parsed.chapterUrls).toEqual([
    "https://www.2025copy.com/comic/guichuyinxiong/chapter/a",
    "https://www.2025copy.com/comic/guichuyinxiong/chapter/b"
  ]);
});

it("rejects invalid preview max chapters", () => {
  expect(() =>
    createConfig({
      url: "https://www.2025copy.com/comic/guichuyinxiong",
      mode: "preview",
      previewMaxChapters: 0
    })
  ).toThrow(/--preview-max-chapters/);
});
```

- [ ] **Step 2: Run focused test to confirm failure**

Run: `npm test --prefix tools/download-comic-2025copy -- tests/config.test.ts`
Expected: FAIL with missing `previewMaxChapters`/`chapterUrls` parsing and validation logic.

- [ ] **Step 3: Implement CLI parsing and config fields**

```ts
// tools/download-comic-2025copy/src/cli.ts
case "--preview-max-chapters":
  args.previewMaxChapters = Number.parseInt(next, 10);
  i += 1;
  break;
case "--preview-images-per-chapter":
  args.previewImagesPerChapter = Number.parseInt(next, 10);
  i += 1;
  break;
case "--chapter-url":
  args.chapterUrls = [...(args.chapterUrls ?? []), next];
  i += 1;
  break;
```

```ts
// tools/download-comic-2025copy/src/types.ts
export interface DownloaderConfig {
  url: string;
  outputDir: string;
  concurrency: number;
  retries: number;
  timeoutMs: number;
  headless: boolean;
  maxChapters?: number;
  userAgent: string;
  chapterDelayMs: number;
  eventsJson?: boolean;
  mode: "download" | "discover" | "preview";
  previewMaxChapters: number;
  previewImagesPerChapter: number;
  chapterUrls: string[];
}
```

```ts
// tools/download-comic-2025copy/src/config.ts
const previewMaxChapters = input.previewMaxChapters ?? 12;
const previewImagesPerChapter = input.previewImagesPerChapter ?? 3;
const chapterUrls = input.chapterUrls ?? [];

if (!Number.isInteger(previewMaxChapters) || previewMaxChapters < 1) {
  throw new Error("--preview-max-chapters must be an integer >= 1");
}
if (!Number.isInteger(previewImagesPerChapter) || previewImagesPerChapter < 1) {
  throw new Error("--preview-images-per-chapter must be an integer >= 1");
}
```

- [ ] **Step 4: Re-run focused test to confirm pass**

Run: `npm test --prefix tools/download-comic-2025copy -- tests/config.test.ts`
Expected: PASS with new preview/chapter-url assertions green.

- [ ] **Step 5: Commit**

```bash
git add tools/download-comic-2025copy/src/cli.ts tools/download-comic-2025copy/src/config.ts tools/download-comic-2025copy/src/types.ts tools/download-comic-2025copy/tests/config.test.ts
git commit -m "feat: add preview and chapter filter cli options"
```

### Task 2: Implement preview runtime and selected-chapter download filtering

**Files:**
- Create: `tools/download-comic-2025copy/tests/main.preview.test.ts`
- Modify: `tools/download-comic-2025copy/src/main.ts`
- Modify: `tools/download-comic-2025copy/src/cli.ts`

- [ ] **Step 1: Write failing tests for preview events and chapter filtering**

```ts
import { describe, expect, it } from "vitest";
import { selectDownloadChapters } from "../src/main.js";

describe("selectDownloadChapters", () => {
  it("keeps only selected chapter urls", () => {
    const selected = selectDownloadChapters(
      [
        { title: "A", url: "u1", order: 1 },
        { title: "B", url: "u2", order: 2 }
      ],
      ["u2"]
    );

    expect(selected.map((c) => c.url)).toEqual(["u2"]);
  });
});
```

```ts
it("runs preview mode path", async () => {
  const parsed = parseCliArgs([
    "--url",
    "https://www.2025copy.com/comic/guichuyinxiong",
    "--mode",
    "preview"
  ]);
  expect(parsed.mode).toBe("preview");
});
```

- [ ] **Step 2: Run focused tests to confirm failure**

Run: `npm test --prefix tools/download-comic-2025copy -- tests/main.preview.test.ts tests/config.test.ts`
Expected: FAIL because `selectDownloadChapters` and preview run path do not exist.

- [ ] **Step 3: Add preview execution and filtering in main workflow**

```ts
// tools/download-comic-2025copy/src/main.ts
export function selectDownloadChapters(allChapters: Chapter[], selectedUrls: string[]): Chapter[] {
  if (selectedUrls.length === 0) {
    return allChapters;
  }
  const selectedSet = new Set(selectedUrls);
  return allChapters.filter((chapter) => selectedSet.has(chapter.url));
}

export async function runPreview(config: DownloaderConfig): Promise<void> {
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ userAgent: config.userAgent });
  const page = await context.newPage();
  try {
    const chapters = (await discoverChapters(page, config.url)).slice(0, config.previewMaxChapters);
    emitJsonEvent(config, { type: "preview.start", comicUrl: config.url });
    for (let i = 0; i < chapters.length; i += 1) {
      const chapter = chapters[i];
      const images = await extractChapterImages(page, chapter.url, config.timeoutMs);
      emitJsonEvent(config, {
        type: "preview.chapter",
        index: i + 1,
        totalChapters: chapters.length,
        chapterTitle: chapter.title,
        chapterUrl: chapter.url,
        images: images.slice(0, config.previewImagesPerChapter).map((item) => item.url)
      });
    }
    emitJsonEvent(config, { type: "preview.done", totalChapters: chapters.length });
  } catch (error) {
    emitJsonEvent(config, { type: "preview.error", error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}
```

```ts
// tools/download-comic-2025copy/src/cli.ts
if (parsed.mode === "preview") {
  await runPreview(config);
  return;
}
```

- [ ] **Step 4: Re-run focused tests and full tool test suite**

Run: `npm test --prefix tools/download-comic-2025copy -- tests/main.preview.test.ts tests/config.test.ts`
Expected: PASS for preview/filter tests.

Run: `npm test --prefix tools/download-comic-2025copy`
Expected: PASS with no regression in existing downloader tests.

- [ ] **Step 5: Commit**

```bash
git add tools/download-comic-2025copy/src/main.ts tools/download-comic-2025copy/src/cli.ts tools/download-comic-2025copy/tests/main.preview.test.ts
git commit -m "feat: add preview runtime and chapter selection filtering"
```

### Task 3: Add desktop preview parser and preview session process manager

**Files:**
- Modify: `apps/downloader-desktop/tests/log-event-parser.test.ts`
- Modify: `apps/downloader-desktop/src/main/log-event-parser.ts`
- Create: `apps/downloader-desktop/src/main/preview-session.ts`
- Create: `apps/downloader-desktop/tests/preview-session.test.ts`

- [ ] **Step 1: Write failing tests for preview events and preview spawn args**

```ts
test("parses preview.chapter event", () => {
  const parsed = parseDownloaderEventLine(
    JSON.stringify({
      type: "preview.chapter",
      index: 1,
      totalChapters: 3,
      chapterTitle: "第1话",
      chapterUrl: "https://www.2025copy.com/comic/x/chapter/y",
      images: ["https://cdn.example.com/1.webp"]
    })
  );
  expect(parsed?.type).toBe("preview.chapter");
});
```

```ts
test("spawns preview mode with events-json", () => {
  const child = new FakeChildProcess();
  const spawnMock = vi.fn(() => child);
  const session = createPreviewSession({
    spawnProcess: spawnMock,
    resolveDownloaderPath: () => ({ cwd: "/tmp/downloader", command: "npm", argsPrefix: ["run", "start", "--"] })
  });

  session.start({
    url: "https://www.2025copy.com/comic/guichuyinxiong",
    maxChapters: 8,
    imagesPerChapter: 3
  });

  const args = spawnMock.mock.calls[0]?.[1] as string[];
  expect(args).toContain("--mode");
  expect(args).toContain("preview");
  expect(args).toContain("--events-json");
  expect(args).toContain("--preview-max-chapters");
  expect(args).toContain("--preview-images-per-chapter");
});
```

- [ ] **Step 2: Run focused tests to confirm failure**

Run: `npm test --prefix apps/downloader-desktop -- tests/log-event-parser.test.ts tests/preview-session.test.ts`
Expected: FAIL because preview types/session are missing.

- [ ] **Step 3: Implement preview event parsing and session runtime**

```ts
// apps/downloader-desktop/src/main/log-event-parser.ts
type DownloaderEvent =
  | { type: "preview.start" }
  | { type: "preview.chapter"; index: number; totalChapters: number; chapterTitle: string; chapterUrl: string; images: string[] }
  | { type: "preview.done"; totalChapters: number }
  | { type: "preview.error"; error?: string }
  | { type: "run.start" }
  | { type: "run.done" }
  | { type: "run.error"; error?: string }
  | { type: "chapter.start"; index: number; totalChapters: number; chapterTitle?: string }
  | { type: "chapter.done"; index: number; totalChapters: number; status?: string }
  | { type: "image.written"; fileName: string; bytes: number; writtenImages: number; writtenBytes: number };
```

```ts
// apps/downloader-desktop/src/main/preview-session.ts
const args = [
  ...downloader.argsPrefix,
  "--url",
  input.url,
  "--mode",
  "preview",
  "--preview-max-chapters",
  String(input.maxChapters),
  "--preview-images-per-chapter",
  String(input.imagesPerChapter),
  "--events-json"
];
```

- [ ] **Step 4: Re-run focused tests**

Run: `npm test --prefix apps/downloader-desktop -- tests/log-event-parser.test.ts tests/preview-session.test.ts`
Expected: PASS for preview parser + spawn behavior.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/main/log-event-parser.ts apps/downloader-desktop/src/main/preview-session.ts apps/downloader-desktop/tests/log-event-parser.test.ts apps/downloader-desktop/tests/preview-session.test.ts
git commit -m "feat: add desktop preview event parser and session manager"
```

### Task 4: Extend IPC/preload/shared contracts for preview + chapter selection

**Files:**
- Modify: `apps/downloader-desktop/src/shared/contracts.ts`
- Modify: `apps/downloader-desktop/src/shared/validation.ts`
- Modify: `apps/downloader-desktop/src/main/index.ts`
- Modify: `apps/downloader-desktop/src/preload/index.ts`
- Modify: `apps/downloader-desktop/tests/preload-api.test.ts`
- Modify: `apps/downloader-desktop/tests/validation.test.ts`

- [ ] **Step 1: Write failing tests for new IPC channels and selection validation**

```ts
test("preload exposes preview start and preview subscriptions", () => {
  const api = createPreloadApi({ invoke: vi.fn(), on: vi.fn(), off: vi.fn() });
  expect(typeof api.startPreview).toBe("function");
  expect(typeof api.onPreviewChapter).toBe("function");
});
```

```ts
test("rejects start download when no chapter is selected", () => {
  const result = validateSelectedChapterUrls([]);
  expect(result.ok).toBe(false);
});
```

- [ ] **Step 2: Run focused tests to confirm failure**

Run: `npm test --prefix apps/downloader-desktop -- tests/preload-api.test.ts tests/validation.test.ts`
Expected: FAIL due to missing preview API and selection validation.

- [ ] **Step 3: Implement IPC contracts and validation**

```ts
// apps/downloader-desktop/src/shared/contracts.ts
export interface PreviewInput {
  url: string;
  maxChapters: number;
  imagesPerChapter: number;
}

export interface StartInput {
  url: string;
  outputDir: string;
  concurrency: number;
  retries: number;
  selectedChapterUrls: string[];
}
```

```ts
// apps/downloader-desktop/src/preload/index.ts
startPreview(payload) {
  return ipcRenderer.invoke("preview:start", payload) as Promise<{ taskId: string }>;
},
onPreviewChapter(cb) {
  const listener: IpcEventListener = (_event, payload) => cb(payload as PreviewChapterEvent & { taskId: string });
  ipcRenderer.on("preview:chapter", listener);
  return () => ipcRenderer.off("preview:chapter", listener);
}
```

```ts
// apps/downloader-desktop/src/main/index.ts
deps.ipcMain.handle("preview:start", (event, payload) => {
  previewSession.start(payload as PreviewInput, {
    onChapter(chapter) {
      event.sender.send("preview:chapter", { taskId, ...chapter });
    }
  });
  return { taskId };
});
```

- [ ] **Step 4: Re-run focused tests**

Run: `npm test --prefix apps/downloader-desktop -- tests/preload-api.test.ts tests/validation.test.ts`
Expected: PASS with preview IPC and selection validation covered.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/shared/contracts.ts apps/downloader-desktop/src/shared/validation.ts apps/downloader-desktop/src/main/index.ts apps/downloader-desktop/src/preload/index.ts apps/downloader-desktop/tests/preload-api.test.ts apps/downloader-desktop/tests/validation.test.ts
git commit -m "feat: wire preview ipc bridge and selected chapter validation"
```

### Task 5: Implement reader-style renderer state and UI layout

**Files:**
- Create: `apps/downloader-desktop/tests/preview-state.test.ts`
- Modify: `apps/downloader-desktop/tests/app-state.test.ts`
- Modify: `apps/downloader-desktop/src/renderer/state.ts`
- Modify: `apps/downloader-desktop/src/renderer/App.tsx`
- Create: `apps/downloader-desktop/src/renderer/components/ChapterListPanel.tsx`
- Create: `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx`
- Modify: `apps/downloader-desktop/src/renderer/components/DownloadForm.tsx`
- Modify: `apps/downloader-desktop/src/renderer/styles/theme.css`

- [ ] **Step 1: Write failing renderer-state tests for previewing/ready/selection-lock**

```ts
test("locks chapter selection while downloading", () => {
  const started = reduceAppState(createInitialAppState(), { type: "started", taskId: "task-1" });
  const next = reduceAppState(started, { type: "toggleChapterSelection", chapterUrl: "u1" });
  expect(next.selectedChapterUrls).toEqual([]);
});

test("stores preview chapter images for reader panel", () => {
  const next = reduceAppState(createInitialAppState(), {
    type: "preview.chapter",
    taskId: "preview-1",
    chapterUrl: "u1",
    chapterTitle: "第1话",
    index: 1,
    totalChapters: 1,
    images: ["https://cdn.example.com/1.webp"]
  });
  expect(next.previewChapters[0]?.images[0]).toContain("cdn.example.com");
});
```

- [ ] **Step 2: Run focused renderer tests to confirm failure**

Run: `npm test --prefix apps/downloader-desktop -- tests/app-state.test.ts tests/preview-state.test.ts`
Expected: FAIL due to missing preview state/actions.

- [ ] **Step 3: Implement reader-first UI and reducer changes**

```ts
// apps/downloader-desktop/src/renderer/state.ts
export interface PreviewChapter {
  chapterUrl: string;
  chapterTitle: string;
  index: number;
  totalChapters: number;
  images: string[];
}

export interface AppState {
  status: "idle" | "running" | "done" | "error" | "stopped";
  taskId: string | null;
  progressIndex: number;
  progressTotal: number;
  logs: string[];
  resultMessage: string | null;
  previewStatus: "idle" | "previewing" | "ready" | "failed";
  previewTaskId: string | null;
  previewChapters: PreviewChapter[];
  activeChapterUrl: string | null;
  selectedChapterUrls: string[];
}
```

```tsx
// apps/downloader-desktop/src/renderer/App.tsx
<section className="reader-layout">
  <aside className="reader-sidebar">
    <ChapterListPanel
      chapters={state.previewChapters}
      selectedChapterUrls={state.selectedChapterUrls}
      activeChapterUrl={state.activeChapterUrl}
      locked={state.status === "running"}
      onToggleSelection={handleToggleSelection}
      onOpenChapter={handleOpenChapter}
    />
  </aside>
  <section className="reader-content">
    <ReaderPanel chapter={activeChapter} />
  </section>
</section>
```

```css
/* apps/downloader-desktop/src/renderer/styles/theme.css */
.reader-layout {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  gap: 14px;
}

.reader-content {
  max-height: 66vh;
  overflow: auto;
}

.reader-image {
  width: 100%;
  height: auto;
  border-radius: 10px;
}
```

- [ ] **Step 4: Run renderer + desktop suite**

Run: `npm test --prefix apps/downloader-desktop -- tests/app-state.test.ts tests/preview-state.test.ts`
Expected: PASS for state transitions and selection lock.

Run: `npm test --prefix apps/downloader-desktop`
Expected: PASS with existing tests (`docs.test.ts`, `download-session.test.ts`, etc.) still green.

- [ ] **Step 5: Commit**

```bash
git add apps/downloader-desktop/src/renderer apps/downloader-desktop/tests/app-state.test.ts apps/downloader-desktop/tests/preview-state.test.ts
git commit -m "feat: ship reader-style preview ui with chapter selection"
```

### Task 6: Update docs, run full verification, and finalize

**Files:**
- Modify: `tools/download-comic-2025copy/README.md`
- Modify: `apps/downloader-desktop/README.md`

- [ ] **Step 1: Write/update documentation changes and doc assertions**

````md
## Preview mode

```bash
npm run start --prefix tools/download-comic-2025copy -- --url "https://www.2025copy.com/comic/<slug>" --mode preview --preview-max-chapters 10 --preview-images-per-chapter 3 --events-json
```

## Download selected chapters

```bash
npm run start --prefix tools/download-comic-2025copy -- --url "https://www.2025copy.com/comic/<slug>" --chapter-url "https://www.2025copy.com/comic/<slug>/chapter/<id1>" --chapter-url "https://www.2025copy.com/comic/<slug>/chapter/<id2>"
```
````

- [ ] **Step 2: Run end-to-end verification commands in required order**

Run: `npm test --prefix tools/download-comic-2025copy && npm run build --prefix tools/download-comic-2025copy`
Expected: PASS for tool tests + build output in `tools/download-comic-2025copy/dist`.

Run: `npm test --prefix apps/downloader-desktop && npx tsc --noEmit -p apps/downloader-desktop/tsconfig.json && npm run build --prefix apps/downloader-desktop`
Expected: PASS for desktop tests, typecheck, and build.

- [ ] **Step 3: Manual smoke check for preview->download flow**

Run: `npm run dev:electron --prefix apps/downloader-desktop`
Expected:
- Preview request returns chapters/images in UI.
- Chapter checkbox selection controls download scope.
- Start download with no selected chapter shows validation prompt.
- Start download with selected chapters only downloads selected subset.

- [ ] **Step 4: Commit**

```bash
git add tools/download-comic-2025copy/README.md apps/downloader-desktop/README.md
git commit -m "docs: document preview flow and chapter-scoped downloads"
```

## Self-Review Checklist (Completed)

- Spec coverage: CLI preview, event protocol, desktop IPC, reader UI, selection lock, and verification steps are all mapped to Tasks 1-6.
- Placeholder scan: no `TODO`/`TBD` placeholders remain; each code step includes concrete snippets.
- Type consistency: `previewMaxChapters`, `previewImagesPerChapter`, `chapterUrls`, and `selectedChapterUrls` naming is consistent across tool, IPC, and renderer tasks.
