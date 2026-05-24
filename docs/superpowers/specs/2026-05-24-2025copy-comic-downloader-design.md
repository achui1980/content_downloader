# 2025copy Comic Image Downloader Skill Design

## Goal

Create an OpenCode skill that downloads all chapter images under the "hua" tab from a 2025copy comic page URL.

Primary test target:

- `https://www.2025copy.com/comic/guichuyinxiong`

## Scope

### In scope

- Single site support: `www.2025copy.com`
- Content type: comic chapter images (not video)
- Chapter source: all chapters under the "hua" tab, across all pagination
- Output format: one folder per chapter, ordered image files
- Resume behavior: skip already downloaded files and continue

### Out of scope (v1)

- Multi-site support
- Video download
- CBZ packaging
- Authentication-only chapters

## Architecture

The implementation has two layers:

1. OpenCode skill wrapper
2. Node.js Playwright downloader tool

### Components

- `SKILL.md`: usage and trigger instructions for OpenCode
- `cli.ts`: parameter parsing and command entry
- `discoverChapters.ts`: open comic page, focus "hua" category, collect chapter links
- `extractChapterImages.ts`: load chapter page and extract image URLs in order
- `chapterDownloader.ts`: concurrent image download with retries
- `checkpoint.ts`: persisted resume state and skip logic
- `main.ts`: orchestration and summary writing

## Data Flow

1. Input comic URL is validated (`2025copy`, `/comic/<slug>` pattern)
2. Playwright loads detail page and discovers chapter list
3. For each chapter:
   - extract chapter image URLs in reading order
   - build chapter directory and target image names
   - download missing files with retry/backoff
4. Persist `run-summary.json` and checkpoint state

## Error Handling

- Parsing failure for one chapter does not stop the full run
- Per-image retry with exponential backoff
- Invalid zero-byte files are deleted and retried
- All failures are captured in summary output for rerun

## Validation and Acceptance

- Smoke run with a limited chapter count
- Full run for target URL under "hua" category
- Interrupt and rerun confirms resume works
- Summary includes:
  - total chapters
  - successful chapters
  - failed chapters
  - image-level failures
