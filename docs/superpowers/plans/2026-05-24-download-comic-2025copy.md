# Download Comic 2025copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OpenCode skill and Node.js downloader that fetches all chapter images under the 2025copy "hua" tab with resume support.

**Architecture:** Use Playwright for dynamic chapter/image discovery and a modular downloader pipeline for retries, checkpoint persistence, and deterministic output naming.

**Tech Stack:** Node.js, TypeScript, Playwright, p-limit, Vitest

---

### Task 1: Scaffold the tool project

**Files:**
- Create: `tools/download-comic-2025copy/package.json`
- Create: `tools/download-comic-2025copy/tsconfig.json`
- Create: `tools/download-comic-2025copy/vitest.config.ts`

- [ ] Add scripts for `start`, `test`, `build`, and `smoke:discover`
- [ ] Add TypeScript and test configuration

### Task 2: Implement core config and utilities

**Files:**
- Create: `tools/download-comic-2025copy/src/types.ts`
- Create: `tools/download-comic-2025copy/src/config.ts`
- Create: `tools/download-comic-2025copy/src/utils/pathing.ts`
- Create: `tools/download-comic-2025copy/src/state/checkpoint.ts`

- [ ] Define shared interfaces and summary models
- [ ] Implement CLI defaults and validation
- [ ] Implement deterministic naming and path sanitation
- [ ] Implement persisted checkpoint read/write and image completion marks

### Task 3: Implement 2025copy site extraction

**Files:**
- Create: `tools/download-comic-2025copy/src/site2025copy/discoverChapters.ts`
- Create: `tools/download-comic-2025copy/src/site2025copy/extractChapterImages.ts`

- [ ] Discover all "hua" chapters from comic detail page
- [ ] Extract ordered image URLs from chapter pages

### Task 4: Implement downloader pipeline

**Files:**
- Create: `tools/download-comic-2025copy/src/download/httpDownload.ts`
- Create: `tools/download-comic-2025copy/src/download/chapterDownloader.ts`
- Create: `tools/download-comic-2025copy/src/main.ts`
- Create: `tools/download-comic-2025copy/src/cli.ts`

- [ ] Implement retrying HTTP image download
- [ ] Implement chapter-level concurrent download with resume skip
- [ ] Write run summary JSON and chapter summary JSON

### Task 5: Add tests

**Files:**
- Create: `tools/download-comic-2025copy/tests/config.test.ts`
- Create: `tools/download-comic-2025copy/tests/pathing.test.ts`
- Create: `tools/download-comic-2025copy/tests/checkpoint.test.ts`
- Create: `tools/download-comic-2025copy/tests/discoverChapters.test.ts`
- Create: `tools/download-comic-2025copy/tests/extractChapterImages.test.ts`

- [ ] Cover defaults and validation
- [ ] Cover naming and sorting behavior
- [ ] Cover checkpoint persistence behavior
- [ ] Cover parser behavior with fixture HTML

### Task 6: Add OpenCode skill wrapper

**Files:**
- Create: `.opencode/skills/download-comic-2025copy/SKILL.md`
- Create: `.opencode/skills/download-comic-2025copy/README.md`

- [ ] Add proper skill frontmatter and trigger description
- [ ] Document command usage and parameters

### Task 7: Verify on target URL

**Verification commands:**

- `npm test` (from `tools/download-comic-2025copy`)
- `npm run start -- --url https://www.2025copy.com/comic/guichuyinxiong --max-chapters 3`

- [ ] Confirm 3-chapter smoke download works
- [ ] Confirm rerun skips existing files and resumes failures
