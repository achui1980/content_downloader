# Reader Image Zoom Design

## Goal

Improve readability in `apps/downloader-desktop` by making chapter images smaller by default so a page is more likely to fit within a single screen, while still letting the user enlarge or shrink the reading size when needed.

Confirmed direction:

- The current reader images feel too large.
- The preferred fix is adjustable zoom.
- The default should be smaller than the current full-width presentation.
- The change should stay focused on the reading surface and avoid a larger layout redesign.

## Scope

### In scope

- Add a lightweight zoom control to the reader header.
- Apply zoom only to chapter images in the reading stream.
- Set a smaller default zoom for full chapter reading.
- Keep the current chapter list and overall reader-stage layout intact.
- Add renderer test coverage for the new control and style contract.

### Out of scope

- Rebuilding the reader into a paged viewer.
- Per-image intelligent fitting based on aspect ratio.
- Cross-session persistence of zoom preference.
- Gesture shortcuts, keyboard shortcuts, or fullscreen-specific behavior.

## Problem Statement

The current full chapter reader renders each image at `width: 100%` of the available reading container. This makes pages feel oversized, especially on larger desktop windows, and often forces extra scrolling before the user can see the full shape of a comic page.

The current UX gap is:

- Reading pages are too large by default.
- Users cannot quickly reduce image size inside the app.
- The existing continuous-scroll reader is otherwise acceptable, so the smallest useful fix is to control image scale rather than redesign the whole reader.

## Recommended Approach

Add a small zoom selector in the reader header and use it to change the effective width of images inside the reading stream.

Recommended behavior:

1. Introduce three explicit zoom levels: `70%`, `85%`, and `100%`.
2. Default the reader to `85%` so images are immediately smaller than today.
3. Center image frames within the stream so reduced-width pages still look intentional.
4. Keep zoom changes local to the renderer session state.

Why this approach:

- It directly solves the reported issue without changing the app's information architecture.
- Fixed named zoom levels are simpler and safer than a freeform slider for a first pass.
- It preserves the current vertical reading model and chapter navigation behavior.

## Alternatives Considered

1. Fixed smaller width with no user control.
   - Simpler implementation, but too rigid across different monitors.
2. Force images to fit viewport height.
   - Closer to strict one-screen-per-page behavior, but page ratios vary and the result would be less predictable.
3. Freeform slider.
   - More flexible, but adds more UI and more state than needed for the current problem.

## UI Design

### Reader header control

Add a compact zoom control to `ReaderPanel` near the existing chapter navigation actions.

Requirements:

- Label it clearly, such as `Page size` or `Zoom`.
- Keep it visually secondary to chapter navigation.
- Make the options one click away, with no modal or nested menu.
- Ensure it works in both setup-stage reader preview and dedicated reader-stage view.

Preferred first-pass control:

- A small segmented control or compact button group with `70%`, `85%`, `100%`.

### Reader stream layout

When zoom is below `100%`:

- The image frame should no longer stretch edge-to-edge.
- The frame should be centered in the stream.
- The stream should keep the current continuous vertical flow and scroll behavior.
- Image aspect ratio must remain untouched.

## State and Data Flow

Add a reader zoom value to renderer state.

Expected flow:

1. App initializes reader zoom to the default level.
2. `ReaderPanel` receives the current zoom and renders the active control state.
3. User changes zoom.
4. Renderer dispatches a zoom action.
5. The reading stream updates image frame width styling without reloading chapter data.

This state should remain independent of preview events, chapter detail fetches, and download state.

## Error Handling

- Invalid zoom values should not be representable in the UI.
- If no chapter images are loaded, the zoom control may remain visible but should not break empty, loading, or error states.
- Zoom changes must not reset saved reader scroll positions for a chapter in this first pass.

## Testing Plan

### Renderer behavior

- Reducer test for default zoom value.
- Reducer test for updating zoom level.
- Component test for rendering the control and marking the active zoom option.

### Style contract

- CSS test asserting the reader image frame supports centered reduced-width layout.
- CSS test asserting the zoom control selectors exist if style-specific classes are introduced.

### Verification commands

- `npm test --prefix apps/downloader-desktop`
- `npx tsc --noEmit -p apps/downloader-desktop/tsconfig.json`
- `npm run build --prefix apps/downloader-desktop`

## Acceptance Criteria

1. Full chapter pages render smaller by default than they do today.
2. The user can switch between at least three page-size presets from the reader header.
3. Smaller zoom levels keep images centered and readable in the vertical stream.
4. Chapter navigation, loading, empty, and error states still behave correctly.
5. The change is contained to the desktop reader UI and does not alter downloader protocol behavior.
