# Dual Download Entry Design

## Goal

Adjust the desktop reader workflow so users can start downloads in two explicit ways:

1. Download all chapters directly (without requiring preview first).
2. Download selected chapters from preview.

This is a UX behavior update on top of the existing preview-first reader implementation.

## Confirmed Decisions

- UI uses two independent actions: `下载全部` and `下载已选`.
- `下载已选` with zero selected chapters auto-falls back to full download.
- During preview, users are allowed to click download; app should stop preview first, then start download.
- Keep current download lock behavior: chapter selection remains locked while download is running.

## Scope

### In scope

- Renderer interaction and state-flow changes for dual download actions.
- Minimal supporting state updates for transition from preview to download.
- Regression tests for new behavior.

### Out of scope

- Downloader CLI protocol changes.
- New IPC channels beyond existing preview/download stop/start channels.
- Redesign of overall reader layout.

## UX and Interaction Design

### Action model

- `下载全部`
  - Starts full download regardless of chapter selection.
  - If preview is running, app stops preview first, then starts download.

- `下载已选`
  - Uses selected chapter URLs when selection is non-empty.
  - If selection is empty, auto-falls back to full download and writes an informational log message.
  - If preview is running, app stops preview first, then starts download.

### Transition behavior

- While app is in `previewing`, download intent is accepted.
- App executes a serial transition: `stopPreview` -> confirm preview not running -> `startDownload`.
- If `stopPreview` fails, download start is cancelled and error is surfaced.

### Locking behavior

- While download status is `running`, chapter selection cannot be changed.
- Preview chapter events received during active download must not mutate selected chapters.

## State Machine Update

Base state model remains, with one additional transition rule:

- Allowed path: `previewing` -> `ready` -> `downloading` (internal transition may be immediate once preview stops).
- `started` action should not enter download directly while preview is still active.
- `previewChapter` actions are ignored when download status is `running`.

## Implementation Boundaries

Primary change surface:

- `apps/downloader-desktop/src/renderer/App.tsx`
  - Add handlers `handleDownloadAll` and `handleDownloadSelected`.
  - Route both handlers through one internal `startDownloadWithScope` function.
  - Implement preview-stop-before-download sequence.

- `apps/downloader-desktop/src/renderer/components/DownloadForm.tsx`
  - Replace single start action with two explicit download buttons.
  - Respect disabled/loading conditions.

- `apps/downloader-desktop/src/renderer/state.ts`
  - Enforce no `started` transition while preview is active.
  - Ignore preview chapter mutations while download is running.

No protocol changes expected in downloader tool or preload contract for this scope.

## Error Handling

- `stopPreview` failure: show error and abort download start.
- `下载已选` fallback: add info log message when auto-converted to full download.
- Download start failure after successful preview stop: surface error and return to operable state.
- Continue task ID gating for all preview/download event streams to avoid stale updates.

## Testing Plan

Focused tests:

- `apps/downloader-desktop/tests/app-state.test.ts`
  - verifies download start is blocked while preview remains active.
- `apps/downloader-desktop/tests/preview-state.test.ts`
  - verifies preview chapter events are ignored during running download.
- `apps/downloader-desktop/tests/preload-api.test.ts` (only if call path assertions changed)

Verification commands:

- `npm test --prefix apps/downloader-desktop`
- `npx --prefix apps/downloader-desktop tsc --noEmit -p apps/downloader-desktop/tsconfig.json`
- `npm run build --prefix apps/downloader-desktop`

## Acceptance Criteria

1. User can click `下载全部` without running preview first.
2. Clicking `下载已选` with no selection automatically triggers full download.
3. Clicking either download button during preview stops preview and then starts download.
4. Selection remains locked during running download, and preview events do not alter selection then.
5. Existing preview and download log/progress/status behavior remains functional.
