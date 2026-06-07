# Online Full Chapter Preview Design

## Goal

Upgrade desktop preview so users can read full chapter content online in a comic-reader experience:

1. Click a chapter on the left.
2. View all images of that chapter on the right in one continuous vertical flow.
3. Keep preview online-only (no image files written to local disk).

## Confirmed Decisions

- Preview mode remains online-only (no local cache files).
- Primary reading UX is single-column continuous scroll (not grid, not paged).
- Chapter details are loaded on demand (per chapter), not all chapters at once.
- Existing download actions (`下载全部` / `下载已选`) remain unchanged in behavior.

## Scope

### In scope

- Reader UX improvements focused on full chapter online preview.
- Data-flow split between chapter catalog and chapter detail.
- State updates for chapter-level loading/error/retry.
- Tests for detail loading flow and reader rendering states.

### Out of scope

- Persistent offline image cache.
- Download pipeline/protocol redesign.
- Queueing multiple preview tasks.

## UX Design

### Reader interaction

- Left panel stays as chapter navigator.
- Clicking a chapter triggers online load for that chapter's full image list.
- Right panel renders single-column full-width images in natural order.
- Reader supports continuous mouse-wheel scrolling.

### Visual states

- Loading state (chapter-level): skeleton placeholders in reader panel.
- Error state (chapter-level): inline error + `重试当前章` action.
- Success state: full chapter images with chapter title and count metadata.
- Empty state: clear guidance when no chapter selected.

### Transition behavior

- Switching chapter cancels/invalidates previous in-flight detail updates by task/token guard.
- Default behavior on chapter switch: reader scroll resets to top.
- Preview failures for one chapter do not block browsing other chapters.

## Data and Architecture

Current preview flow returns only first N images per chapter. New flow splits responsibilities:

1. **Catalog phase**
   - Keep lightweight chapter discovery list.
2. **Detail phase (on demand)**
   - Fetch full image URLs for selected chapter only.

### Desktop boundaries

- `main` keeps process/IPC orchestration.
- `preload` exposes chapter-detail preview request API.
- `renderer` manages chapter detail state and drives reader UI.

### Renderer state model additions

- `chapterCatalog`: chapter list metadata.
- `activeChapterId` / `activeChapterUrl`.
- `activeChapterDetail`: full image URL list + metadata.
- `chapterLoadState`: `idle | loading | success | error`.
- `chapterLoadError`: optional error message for active chapter.

### Consistency rules

- Task/request IDs gate chapter detail responses to avoid stale overwrite.
- Download running lock still applies to selection mutation rules.
- Reader state changes should not alter download scope unexpectedly.

## Protocol Strategy

Preferred implementation keeps current preview process model and extends it with chapter detail request capability.

Two viable shapes (implementation can pick either with equivalent behavior):

- **A. Extended preview events**
  - Add event types for chapter detail request/result/error.
- **B. Dedicated chapter-detail command path**
  - New command/mode for single chapter full-image fetch.

Either way, contract must support:

- Request chapter detail by chapter URL.
- Return complete ordered image URL list for that chapter.
- Return chapter-level error without collapsing entire preview session.

## Error Handling

- Chapter detail request failure:
  - Show inline reader error, keep chapter list interactive.
  - Retry button triggers same request for active chapter.
- Invalid/stale response:
  - Ignore if request token does not match active request.
- Preview catalog failure:
  - Show global preview error and allow retry.

## Performance and Stability

- Lazy-load images in reader panel (`loading="lazy"`).
- Keep in-memory detail cache minimal (optional small recent-chapter cache).
- Avoid preloading all chapters to prevent memory spikes.
- Preserve smooth scrolling by reserving layout space where possible.

## Testing Plan

### Desktop tests

- `apps/downloader-desktop/tests/preview-state.test.ts`
  - chapter detail loading/success/error transitions
  - stale response ignore behavior
- `apps/downloader-desktop/tests/app-state.test.ts`
  - existing download lock invariants unaffected
- Reader component tests (or smoke-level assertions)
  - loading/error/success rendering and image ordering

### Main/preload tests

- preview detail request wiring and payload parsing.
- chapter-level error propagation.

### Tool tests (if protocol changes are in tool)

- chapter detail extraction path and event payload shape.

## Verification Commands

- `npm test --prefix apps/downloader-desktop`
- `npx --prefix apps/downloader-desktop tsc --noEmit -p apps/downloader-desktop/tsconfig.json`
- `npm run build --prefix apps/downloader-desktop`

If tool protocol changes are introduced:

- `npm test --prefix tools/download-comic-2025copy`
- `npm run build --prefix tools/download-comic-2025copy`

## Acceptance Criteria

1. User can click any chapter and see full chapter images online (not truncated to first N).
2. Reader uses single-column continuous scroll and remains usable for long chapters.
3. Preview remains online-only with no image file writes.
4. Chapter-level load failures are recoverable via retry without breaking chapter navigation.
5. Existing download flows keep working as before.
