# Online Preview Reader UX Refresh Design

## Goal

Refocus `apps/downloader-desktop` from a downloader-first dashboard into a reader-first online preview experience for 2025copy comics.

The primary user outcome is:

1. Enter a comic URL and preview chapters quickly.
2. Click a chapter and immediately start reading it in a continuous vertical flow.
3. Move between chapters with minimal friction, similar to a comic website.
4. Keep download actions available without letting them dominate the reading experience.

Confirmed UX direction:

- Primary reading mode is single-column continuous scroll.
- Product feel should be closer to a web comic site than a utility app or image viewer.
- Online preview is the first priority; local reading can follow later.
- Main pain points to solve first are reading smoothness, chapter switching, and overall reader feel.

## Scope

### In scope

- Reader-first re-layout of the desktop preview experience.
- Chapter-to-reader transition improvements.
- Navigation improvements for previous/next chapter and chapter list usage.
- Inline reading states for loading, empty, and error cases.
- UX-level support for lightweight reading continuity such as current-chapter visibility and in-session position retention.

### Out of scope

- Full offline library management.
- Multi-task download queue redesign.
- Mobile gesture-heavy interactions.
- A full cross-session reading-history system in the first pass.

## Problem Statement

The current product works as a downloader with preview features, but it does not yet feel like a reading product.

Current UX issues:

- The interface hierarchy still emphasizes forms, logs, and task control over reading.
- Chapter opening feels like loading a detail pane instead of entering a reading mode.
- Chapter switching is functional but not smooth enough for long-form reading.
- Reading feedback is too system-oriented, making the experience feel operational instead of immersive.

## User Journey

Target journey:

1. User enters a comic URL.
2. User clicks `Preview` and gets a readable chapter overview.
3. User clicks a chapter and immediately lands in a dedicated reading state.
4. User reads by scrolling downward through ordered images.
5. User reaches the end of a chapter and naturally moves to the next one.
6. User optionally downloads the current or selected chapters without leaving the reading context.

## Core Design Principles

1. Content first, controls second.
2. Reading is the primary mode; downloading is a supporting action.
3. Chapter switching should preserve reading rhythm.
4. Feedback should appear where the user is reading, not force attention into logs.
5. The interface should feel closer to a comic site than to a control panel.

## UX Approach

### Recommended approach

Use a reader-first redesign for the online preview flow.

Why this approach:

- It directly addresses the user's confirmed priorities.
- It can materially improve perceived quality without waiting for a broader local-library redesign.
- It builds on the existing preview architecture instead of requiring a product reset.

### Alternatives considered

1. Feature-first enhancement without layout shift.
   - Lower disruption, but still feels like a tool UI.
2. Fully unified online/local reader redesign.
   - Better long-term consistency, but too large for the current priority.

## Information Architecture

The desktop experience should be treated as two stages instead of one dashboard.

### Stage 1: Entry view

Purpose:

- Collect the comic URL.
- Expose only the minimum preview and download parameters needed to begin.

Behavior:

- This remains a launch surface, not the main reading surface.
- After preview succeeds, the product should transition the user toward reading rather than keeping focus on setup controls.

### Stage 2: Reader view

Purpose:

- Provide a dedicated online reading experience.

Primary layout:

- Top: compact reading header.
- Left: collapsible chapter navigator.
- Center: dominant continuous-scroll reader.
- Edge or overlay: lightweight status and download feedback.
- Logs: hidden behind a secondary diagnostics affordance instead of remaining a primary panel.

## Reader View Design

### Reading header

Keep this minimal and reading-oriented.

Contents:

- Comic title.
- Current chapter title.
- `Previous chapter`.
- `Next chapter`.
- `Back to chapter list`.
- Download entry point.

This header should be visually lighter than the content area and avoid looking like a toolbar-heavy utility app.

### Chapter navigator

The chapter list should support orientation, not dominate the screen.

Responsibilities:

- Jump to any chapter quickly.
- Keep the current chapter clearly highlighted.
- Preserve list position near the current chapter.
- Optionally show lightweight markers for read state and download selection.

Behavior:

- Collapsible in reading mode.
- Easy to reopen without losing context.

### Reader surface

This is the main product surface and should carry most of the visual weight.

Behavior:

- Single-column, continuous vertical image flow.
- Stable reading width.
- Centered layout with predictable whitespace.
- Small inter-image gaps so the content feels like comic pages, not a gallery.
- Smooth natural wheel or trackpad scrolling.

## Interaction Model

### Opening a chapter

- Clicking a chapter should feel like entering that chapter, not requesting technical detail data.
- The reader should switch into a reading state immediately, with loading feedback rendered in the reader area itself.

### Primary reading interaction

- Scrolling downward is the main interaction.
- The UI should not require frequent clicks to continue reading.
- Download controls remain available but visually secondary.

### Chapter switching

Support three complementary ways to move:

1. Header buttons for previous and next chapter.
2. Direct jump from the chapter navigator.
3. A strong bottom-of-chapter next-step action.

The most important rule is that chapter transitions should not feel like returning to a workflow screen.

## Continuous Reading Strategy

### Phase 1: Smooth chapter transitions

The first pass should optimize for smooth discrete chapter reading.

Requirements:

- Current chapter is always obvious.
- End-of-chapter UI offers a clear `Next chapter` primary action.
- Switching chapters opens the next chapter directly at the top of the reader.
- Background preparation for adjacent chapter data is allowed to reduce perceived delay.

### Phase 2: Near-seamless reading continuity

Later, the product can approach true cross-chapter continuous reading.

Possible extension:

- Append the next chapter beneath the current chapter with a lightweight divider.
- Load adjacent chapter content on demand near the bottom of the current chapter.

This is intentionally deferred so the first iteration can improve feel without taking on too much complexity.

## Reader States

### Empty state

- If no chapter is selected yet, the main panel should invite the user to start reading from the chapter list.
- This should feel like a reading entry point, not a blank technical placeholder.

### Loading state

- Use reader-area skeletons or simple visual placeholders.
- Avoid exposing raw task language while the reader is loading a chapter.

### Error state

- Show the failure inline in the reader area.
- Offer a clear retry action for the current chapter.
- Keep the chapter list interactive so the user can move elsewhere.

### Success state

- Render the full chapter in natural image order.
- Keep chapter title and navigation visible without overpowering the content.

## Download UX Within Reading Context

Download remains important, but it should behave like a secondary action.

Rules:

- Prioritize `Download current chapter` and `Download selected chapters` from within the reader context.
- Show download progress in a lightweight overlay, toast, or docked compact status area.
- Do not force the user to shift attention into a large persistent log panel while reading.

## Priorities

### P0

- Make the reader surface the dominant UI once a chapter is opened.
- Improve continuous-scroll presentation and spacing.
- Add clear previous/next chapter controls.
- Add strong end-of-chapter next-step actions.
- Move reading feedback into the reader surface.
- Reduce the prominence of logs and setup controls during reading.

### P1

- Preserve in-session reading position.
- Preload or prepare adjacent chapter data for faster transitions.
- Improve chapter-list orientation and read markers.
- Make download controls feel native to the reading context.

### P2

- Add a more immersive reading mode with less chrome.
- Explore partial cross-chapter continuous loading.
- Add secondary reading helpers such as return-to-top or richer jump affordances.

## Architecture Impact

This design should primarily reuse existing preview and chapter-detail flows, but change how the renderer composes them.

Likely impact areas:

- `apps/downloader-desktop/src/renderer/App.tsx`
- `apps/downloader-desktop/src/renderer/state.ts`
- `apps/downloader-desktop/src/renderer/components/ChapterListPanel.tsx`
- `apps/downloader-desktop/src/renderer/components/ReaderPanel.tsx`
- `apps/downloader-desktop/src/renderer/components/DownloadForm.tsx`
- supporting styles and tests

The main process and downloader protocol should change only where necessary to support smoother transitions or lightweight adjacent-chapter preparation.

## Testing Plan

### Renderer UX behavior

- Chapter click enters reader mode.
- Current chapter highlight stays in sync.
- Previous/next actions update the reader correctly.
- End-of-chapter actions route users naturally.
- Loading, empty, and error states render inline in the reader.

### State behavior

- Active chapter changes do not unexpectedly alter download selection.
- Reading-mode transitions preserve task and request isolation.
- In-session position memory restores correctly when returning to the same chapter.

### Integration safety

- Existing preview and download flows remain functional.
- Download stop/start controls still work while the UI is reader-first.

## Acceptance Criteria

1. After preview, a user can click a chapter and immediately enter a reader-like long-scroll experience.
2. The main screen clearly prioritizes reading over logs and control panels.
3. Users can move to previous or next chapters without losing the sense of continuous reading.
4. Chapter loading and failure feedback appear in the reader area rather than requiring log inspection.
5. Download actions remain available without overwhelming the reading UI.
