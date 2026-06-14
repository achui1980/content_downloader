# Immersive Full-Screen Reader Mode — Implementation Plan

## Step 1: Add immersiveReader state to App

**File:** `apps/downloader-desktop/src/renderer/App.tsx`

- Add `useState` for `immersiveReader` (boolean, default false)
- Pass `immersiveReader` and `onToggleImmersive` to both ReaderPanel instances
- Add `useEffect` with `keydown` listener for ESC key (only in reader-stage, check `isReaderStage`)
- ESC key toggles immersive mode off if on

**File:** `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx`

- Add `immersiveReader?: boolean` and `onToggleImmersive?: () => void` to `ReaderPanelProps`
- Add fullscreen toggle button in header (next to zoom control)
- Add CSS class `reader-panel-header--immersive` when in immersive mode

## Step 2: Add immersive CSS styles

**File:** `apps/downloader-desktop/src/renderer/styles/theme.css`

- `.app-shell--reader-stage.app-shell--immersive .app-header` → `display: none`
- `.app-shell--reader-stage.app-shell--immersive .reader-grid-col--chapters` → `display: none`
- `.app-shell--reader-stage.app-shell--immersive .reader-grid` → `grid-template-columns: minmax(0, 1fr)`
- `.app-shell--reader-stage.app-shell--immersive .reader-image-stream` → `max-height: calc(100vh - 120px)`
- `.app-shell--reader-stage.app-shell--immersive .reader-actions--endcap` → `display: none`
- `.reader-panel-header--immersive` → `position: fixed; top: 0; left: 0; right: 0; z-index: 100; opacity: 0; transform: translateY(-100%); pointer-events: none; transition: opacity 300ms ease, transform 300ms ease; background: rgba(11, 15, 20, 0.92); backdrop-filter: blur(12px); padding: 12px 20px`
- `.reader-panel-header--immersive.reader-panel-header--immersive-visible` → `opacity: 1; transform: translateY(0); pointer-events: auto`
- Immersive hover trigger: add `.reader-panel-header-anchor` with `position: fixed; top: 0; left: 0; right: 0; height: 60px; z-index: 99` to detect hover

## Step 3: Add ReaderPanel immersive toggle button

- Button goes next to the zoom control in the header
- Icon: expand symbol (SVG or Unicode `⛶`)
- When in immersive mode, button toggles immersive off
- Pass `onToggleImmersive` from App

## Step 4: Add keyboard handler

- In App.tsx `useEffect`, add `keydown` event listener
- Only active when `isReaderStage === true`
- Listen for `Escape` key, call toggle off if `immersiveReader === true`
- Clean up listener on unmount or when leaving reader stage

## Step 5: Write tests

**New file:** `apps/downloader-desktop/tests/immersive-reader.test.ts`

- Test `immersiveReader` state toggle
- Test ESC key handler
- Test CSS class application on ReaderPanel
- Test chapters panel hidden in immersive mode

## Step 6: Verify and merge

- `npm test --prefix apps/downloader-desktop`
- `npx tsc --noEmit -p tsconfig.json`（在 `apps/downloader-desktop` 下执行）
- `npm run build --prefix apps/downloader-desktop`
- Git: create branch, commit, PR or merge directly to main