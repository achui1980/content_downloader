# Desktop Preview Reader Design

## Goal

Add a pre-download preview flow in `apps/downloader-desktop` so users can:

1. Fetch preview data before downloading.
2. Browse chapters in a reader-like layout (left chapter list, right original images).
3. Select chapters in preview and download only selected chapters.

Primary UX direction (confirmed):

- Reader-first layout (not current dashboard-style grouping).
- Preview is remote-only (no local image write in preview step).
- Selected chapters in preview become download scope.
- No legacy-layout toggle in v1.

## Scope

### In scope

- New CLI preview mode in `tools/download-comic-2025copy`.
- New CLI chapter-selection input for download runs.
- Desktop main/preload/renderer wiring for preview session.
- Reader-style UI and state machine changes in desktop renderer.
- Test coverage for preview events, chapter selection, and compatibility.

### Out of scope

- Full in-app local image gallery/history browser.
- Persistent preview cache on disk.
- Multi-task queue.
- Mobile-style gesture navigation.

## Confirmed Decisions

- Keep existing download run event protocol (`run.*`, `chapter.*`, `image.written`) intact.
- Add preview protocol under separate namespace (`preview.*`) to avoid collisions.
- Preview session and download session are separated in desktop main process.
- Download-time chapter filtering uses repeatable `--chapter-url <url>` arguments.
- CLI stays backward-compatible when `--chapter-url` is not provided (existing default selection logic).

## Architecture

### Tool (`tools/download-comic-2025copy`)

Add preview and chapter filter support at CLI/config/orchestration layers:

- `src/cli.ts`
  - Parse `--mode preview`.
  - Parse `--preview-max-chapters <n>`.
  - Parse `--preview-images-per-chapter <n>`.
  - Parse repeatable `--chapter-url <url>`.
- `src/config.ts` + `src/types.ts`
  - Extend config types with preview parameters and selected chapter URLs.
  - Validate preview numeric bounds and selected chapter URL shape.
- `src/main.ts`
  - Add `runPreview(config)` path.
  - In download mode, filter discovered chapters by selected URLs when provided.

### Desktop app (`apps/downloader-desktop`)

- Main process
  - Keep existing download IPC channels.
  - Add preview IPC channels (`preview:start`, `preview:stop` if needed).
  - Add `preview-session.ts` to spawn downloader in preview mode and parse `preview.*` lines.
- Preload
  - Expose preview API methods and event listeners alongside existing download API.
- Renderer
  - Add preview domain state: preview settings, chapter list, selected chapter for reading, selected chapter set for download scope.
  - Recompose UI into reader-first layout.

## CLI and Event Contract

### New preview args

- `--mode preview`
- `--preview-max-chapters <n>`
- `--preview-images-per-chapter <n>`

### New download scope arg

- Repeatable: `--chapter-url <url>`

### Preview JSON events (when `--events-json` is enabled)

- `preview.start`
  - `comicUrl`, `previewMaxChapters`, `previewImagesPerChapter`, timestamps.
- `preview.chapter`
  - `index`, `totalChapters`, `chapterTitle`, `chapterUrl`, `images: string[]`.
- `preview.done`
  - preview totals and timestamps.
- `preview.error`
  - error string and failure timestamp.

Existing events remain unchanged:

- `run.start`, `chapter.start`, `image.written`, `chapter.done`, `run.done`, `run.error`.

## UI Structure and Interaction

Reader-style single window:

1. **Top action row**
   - Comic URL field.
   - Primary actions: `Fetch Preview`, `Start Download`, `Stop`.
2. **Left panel (chapter navigator)**
   - Preview options: max chapters, images per chapter.
   - Chapter list with two independent interactions:
     - checkbox toggles download selection set,
     - row click switches currently viewed chapter on right panel.
3. **Right panel (reader view)**
   - Original image list for active chapter, stacked vertically for scroll reading.
   - No forced crop/thumbnail-only mode.
4. **Bottom dock**
   - Unified logs + status/progress summary.

### State machine (renderer)

- `idle` -> `previewing` -> `ready`
- `ready` -> `downloading` -> (`done` | `failed` | `stopped`)
- `downloading` -> `stopped`

Behavior rules:

- Preview is remote-only and does not write images to output dir.
- Downloading locks chapter selection to prevent scope drift mid-run.
- Stop unlocks selection and allows preview refresh.
- Task IDs gate events; stale preview/download events are ignored.

## Data Flow

1. User sets URL + preview limits and clicks `Fetch Preview`.
2. Renderer invokes preview IPC.
3. Main process spawns downloader preview mode with `--events-json`.
4. Renderer receives `preview.*` events and builds chapter/image preview state.
5. User selects chapters and clicks `Start Download`.
6. Renderer sends selected `chapterUrl[]` with download payload.
7. Main process spawns existing downloader flow plus repeated `--chapter-url` args.
8. Existing download events drive progress/log/result UI.

## Error Handling

- Preview failure does not mutate download runtime state.
- Parse failures on individual lines fall back to raw logs instead of crashing session.
- Invalid preview input blocks request with user-facing validation messages.
- Empty preview result shows actionable empty state (site/layout changed, try lower preview size or retry).
- Download start with zero selected chapters is blocked with a clear prompt to select at least one chapter.

## Testing Plan

### Tool tests

- CLI parsing for preview and chapter-url repeat args.
- Config validation for new fields.
- `runPreview` event emission shape and ordering.
- Download filtering by selected chapter URLs while preserving existing defaults.

### Desktop main/preload tests

- Preview session spawn args include preview flags and `--events-json`.
- Event parser handles `preview.*` and existing `run.*` without regression.
- IPC wiring for preview channels and download channels remains stable.

### Renderer tests

- Reducer transitions for `previewing/ready/downloading` states.
- Chapter list interactions: select-for-download vs open-for-reading.
- Task ID mismatch ignores stale events.
- Download lock/unlock behavior around running/stopped states.

### Verification commands

- `npm test --prefix tools/download-comic-2025copy`
- `npm run build --prefix tools/download-comic-2025copy`
- `npm test --prefix apps/downloader-desktop`
- `npx tsc --noEmit -p apps/downloader-desktop/tsconfig.json`
- `npm run build --prefix apps/downloader-desktop`

## Acceptance Criteria

1. User can fetch preview with custom limits and see chapter list + reader images.
2. Preview does not create downloaded image files on disk.
3. User can select subset chapters and download only selected subset.
4. Existing non-preview download flow still works with current commands.
5. Stop/retry behavior remains functional and event/log rendering stays stable.
