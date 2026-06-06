# Electron UI Downloader Design (MVP)

## Goal

Build an installable desktop UI so users can run comic downloads directly from a graphical app instead of the terminal.

Primary goals for v1:

- Use `Electron + React`
- Reuse existing downloader logic in `tools/download-comic-2025copy`
- Support local development first, then packaging
- Target platforms for packaging: macOS, Windows, Linux

## Scope

### In scope (MVP)

- Single-window desktop app
- Input fields: comic URL, output directory, concurrency, retries
- Buttons: select directory, start download, stop download, open output directory
- Real-time progress and logs
- Completion and failure summary display
- Single active task only

### Out of scope (MVP)

- Multi-task queue
- History center
- Account/login features
- Theme switching
- Auto-update
- Code signing and notarization

## Confirmed Decisions

- Tech stack: Electron + React
- Runtime integration: call existing Node downloader CLI from Electron main process
- Shipping order:
  1. Functional integration in development mode
  2. Packaging after stability
- Packaging targets: `.dmg`, `.exe` (NSIS), `.AppImage`
- Signing: not required for first release

## Architecture

The app uses a three-part structure:

1. **Renderer (React UI)**
   - Collects user input
   - Displays progress, stats, logs, and final status
2. **Main process (Electron)**
   - Owns task lifecycle and process control
   - Handles secure filesystem and dialog operations
   - Spawns and manages downloader child process
3. **Downloader adapter layer**
   - Converts UI config into CLI arguments
   - Parses downloader output into structured UI events

### Process boundaries

- Renderer never executes shell commands directly
- Main process is the only layer that can spawn the downloader process
- Renderer communicates with main via IPC only

## Data Model

### Task

- `taskId`
- `url`
- `outputDir`
- `concurrency`
- `retries`
- `status` (`idle`, `running`, `stopping`, `success`, `failed`)
- `startedAt`
- `finishedAt`

### Progress snapshot

- `currentChapter`
- `totalChapters`
- `currentImage`
- `chapterImageTotal`
- `downloaded`
- `skipped`
- `failed`

### Log item

- `time`
- `level` (`info`, `warn`, `error`)
- `message`
- optional context (`chapter`, `imageUrl`)

### Result

- `summaryPath`
- `successChapters`
- `failedChapters`
- `failedItemsCount`

## IPC Contract

Renderer -> Main:

- `download:start`
- `download:stop`
- `dialog:selectOutputDir`
- `shell:openOutputDir`

Main -> Renderer:

- `download:started`
- `download:progress`
- `download:log`
- `download:done`
- `download:error`

## UI Structure and Flow

Single window, three sections:

1. **Config panel**
   - URL
   - output directory
   - concurrency
   - retries
2. **Run panel**
   - chapter progress
   - aggregate counters
   - status badge
3. **Log panel**
   - streaming logs
   - copy support

State transitions:

- `idle` -> `running` -> (`success` | `failed`)
- `running` -> `stopping` -> (`success` | `failed`)

Validation rules:

- URL must match `https://www.2025copy.com/comic/...`
- output directory must be selected and writable
- concurrency must be integer `>= 1`
- retries must be integer `>= 0`

## Error Handling

- Child process non-zero exit -> emit `download:error` with summarized reason
- Parse failure on one log line -> keep raw line as log (do not crash task)
- Stop request -> enter `stopping`, then wait for process exit and flush summary
- Directory/permission failure -> block start and show actionable error

## Delivery Phases

### Phase A: Functional integration (development mode)

- Integrate UI and CLI adapter
- Verify start/stop/progress/logging/result workflow
- Validate resume behavior via rerun
- Ensure status transitions are stable and no UI deadlocks

### Phase B: Packaging and distribution

- Add `electron-builder`
- Validate local macOS package first
- Add CI matrix build for macOS/Windows/Linux artifacts

## Acceptance Criteria

### Phase A acceptance

1. Can run and finish smoke download (`max-chapters=3`) from UI
2. Stop and rerun demonstrates resume (`skipped` increases)
3. UI shows chapter-level progress and live logs
4. UI can open output folder and locate `run-summary.json`
5. Failure states are clearly surfaced (network/parse/permission/process)

### Phase B acceptance

1. Build artifacts generated: `.dmg`, `.exe`, `.AppImage`
2. Each installer launches app successfully on target OS
3. Download workflow works post-install on each target OS
