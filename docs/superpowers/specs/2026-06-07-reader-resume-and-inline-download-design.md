# Reader Resume + Inline Chapter Download Design

## Background

Current desktop flow supports online chapter preview and online full-chapter reading, but reading continuity is weak:

- Users cannot directly download from the reader context.
- App restart loses the active comic/chapter/scroll position.
- There is no explicit way to know "which comic I was reading last time".

The user wants:

1. "Preview while reading can directly download."
2. "Next time open app, continue reading where I left off."
3. A clear entry point to pick/continue previously read comics.

## Decisions Captured From Conversation

- Chosen approach: local-first resume with online fallback (not full preview cache library).
- Resume behavior: restore last chapter + scroll position automatically.
- Entry point: top-of-home "Recently Read" list.
- Reader download action: "Download Current Chapter".
- Download UX: background download, do not interrupt reading.
- Recently-read retention: keep latest 20 comics.

## Goals

1. Add "Recently Read" at top of home screen so users can continue any prior comic quickly.
2. Add reader-side "Download Current Chapter" action that runs in background.
3. Persist reading progress by comic: chapter + scroll position.
4. On reopen, continue from the last reading point and prefer local chapter content when available.
5. Keep existing download flows (`Download All`, `Download Selected`) intact.

## Non-Goals

1. No full offline comic library manager in this iteration.
2. No auto-download of all viewed chapters.
3. No cross-device/cloud sync.
4. No local cache for online preview images beyond explicit chapter download output.

## UX Design

### 1) Recently Read Panel

Location: top area above URL/download controls.

Each item shows:

- Comic title (or slug fallback)
- Last chapter title
- Last read time
- `Continue` button

Behavior:

- List is sorted by `lastReadAt` descending.
- Max 20 items; oldest trimmed automatically.
- Selecting `Continue` restores target comic context and chapter.

### 2) Reader Actions

In reader panel add `Download Current Chapter` button.

Behavior:

- Starts chapter-only download in background.
- Reading area remains usable while downloading.
- Show non-blocking status chip/toast in reader header (`downloading` / `done` / `failed`).
- Re-click while same chapter is downloading is deduped.

### 3) Reopen Resume

On app launch:

- Load recent list.
- Optionally auto-continue last opened comic/chapter (default enabled for the latest item).

Chapter load source selection:

1. If downloaded local chapter exists -> load local images.
2. Else -> load online chapter detail.

Scroll restore:

- Restore to last saved scroll ratio after chapter images render.

## Architecture

## New Main-Process Services

### ReadingResumeStore (new)

Responsibility: durable resume metadata in `app.getPath("userData")`.

Suggested file:

- `apps/downloader-desktop/src/main/reading-resume-store.ts`

Data model:

```ts
interface DownloadedChapterRef {
  chapterUrl: string;
  chapterTitle: string;
  chapterDir: string;
  imagePaths: string[];
  downloadedAt: string;
}

interface ComicResumeEntry {
  comicKey: string;
  comicUrl: string;
  comicTitle: string;
  lastChapterUrl: string;
  lastChapterTitle: string;
  lastScrollRatio: number; // 0..1
  lastReadAt: string;
  downloadedChapters: Record<string, DownloadedChapterRef>;
}

interface ReadingResumeSnapshot {
  entries: ComicResumeEntry[];
}
```

Rules:

- Upsert by `comicKey`.
- Keep at most 20 entries.
- Clamp scroll ratio to `[0,1]`.
- Remove stale downloaded refs when files are missing.

### ReaderChapterLoader (new)

Responsibility: resolve chapter detail with local-first policy.

Suggested file:

- `apps/downloader-desktop/src/main/reader-chapter-loader.ts`

Flow:

1. Check resume store for downloaded chapter ref.
2. Validate local files exist.
3. Return local `file://` images when valid.
4. Else call existing `requestPreviewChapterDetail` (online) and return remote URLs.

### ReaderChapterDownloader (new)

Responsibility: one-shot chapter-only downloader process for current chapter.

Suggested file:

- `apps/downloader-desktop/src/main/reader-chapter-download-request.ts`

Flow:

1. Spawn downloader CLI with selected single chapter.
2. Parse events and completion.
3. Resolve output chapter directory and image files.
4. Update `ReadingResumeStore.downloadedChapters`.

## IPC Contract Additions

In `apps/downloader-desktop/src/shared/contracts.ts` add:

```ts
interface RecentComicItem {
  comicKey: string;
  comicUrl: string;
  comicTitle: string;
  lastChapterUrl: string;
  lastChapterTitle: string;
  lastScrollRatio: number;
  lastReadAt: string;
}

interface SaveReadingProgressInput {
  comicUrl: string;
  comicTitle?: string;
  chapterUrl: string;
  chapterTitle?: string;
  scrollRatio: number;
}

interface ReaderLoadChapterInput {
  chapterUrl: string;
}

interface ReaderLoadChapterResult extends PreviewChapterDetail {
  source: "local" | "online";
}

interface ReaderDownloadCurrentChapterInput {
  chapterUrl: string;
  outputDir: string;
  concurrency: number;
  retries: number;
}

interface ReaderDownloadCurrentChapterResult {
  chapterUrl: string;
  source: "downloaded";
  chapterDir: string;
  imagePaths: string[];
}
```

New IPC channels in `apps/downloader-desktop/src/main/index.ts`:

- `reader:listRecent`
- `reader:saveProgress`
- `reader:loadChapter`
- `reader:downloadCurrentChapter`

Preload API (`apps/downloader-desktop/src/preload/index.ts`) exposes typed wrappers.

## Renderer Design

## State Additions

In `apps/downloader-desktop/src/renderer/state.ts`:

- `recentComics: RecentComicItem[]`
- `readerDownloadStatus: "idle" | "running" | "done" | "error"`
- `readerDownloadMessage: string | null`
- optional `autoResumeAttempted: boolean`

## Behavior

1. On mount, fetch `reader:listRecent`.
2. Render recently-read panel at top.
3. On continue click:
   - set URL context,
   - load target chapter via `reader:loadChapter`,
   - restore scroll ratio after image render.
4. On chapter switch/scroll (throttled), call `reader:saveProgress`.
5. In reader header show `Download Current Chapter` button and status.
6. On download success, optionally reload current chapter detail from local source.

## Error Handling

1. Missing local files in downloaded ref:
   - clear stale ref,
   - fallback to online,
   - append non-fatal log line.
2. Online load failure:
   - keep previous resume data,
   - show retry action.
3. Background download failure:
   - show reader status error,
   - do not reset reading context.
4. Save-progress write failure:
   - log only, do not block UI.

## Testing Strategy

## Main Process Tests

1. `reading-resume-store.test.ts`
   - upsert/merge behavior
   - 20-item truncation
   - sort order
   - scroll ratio clamping
2. `reader-chapter-loader.test.ts`
   - local hit returns `source=local`
   - stale local ref falls back online and prunes ref
3. `reader-chapter-download-request.test.ts`
   - one-shot chapter download success updates local index
   - duplicate-in-flight request dedupe
   - failure does not poison stored index

## Renderer Tests

1. recent list render + continue action in `smoke.test.ts`
2. progress save throttling and reducer transitions in `preview-state.test.ts` (or a new reader state test file)
3. reader download button status transitions + retry unaffected

## End-to-End Smoke Cases

1. Start preview -> open chapter -> click download current -> keep reading while status updates.
2. Restart app -> see recent list -> continue -> restore chapter + scroll.
3. Delete local chapter files manually -> restart -> app falls back online without crash.

## Rollout and Compatibility

1. Existing users with no resume file start with empty recent list.
2. Existing download flows remain unchanged.
3. Resume storage is additive and backward-compatible.

## Acceptance Criteria

1. User can click `Download Current Chapter` while reading and continue scrolling uninterrupted.
2. App shows a recent comics panel on startup with max 20 entries.
3. Reopen app restores the last reading chapter and near-previous scroll position.
4. If the chapter was downloaded previously, chapter load uses local files first.
5. If local files are missing, app transparently falls back to online chapter load.
6. Existing full download flows and tests remain green.
