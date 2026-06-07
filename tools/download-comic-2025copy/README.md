# download-comic-2025copy

Download ordered comic images from 2025copy comic pages.

## Install

```bash
npm ci --prefix tools/download-comic-2025copy
```

Install Playwright Chromium into the tool-local runtime path:

```bash
PLAYWRIGHT_BROWSERS_PATH=0 npm exec --prefix tools/download-comic-2025copy playwright install chromium
```

## Verification

```bash
npm test --prefix tools/download-comic-2025copy
npm run build --prefix tools/download-comic-2025copy
```

## Usage

```bash
npm run start -- --url "https://www.2025copy.com/comic/guichuyinxiong"
```

Download only specific chapters by repeating `--chapter-url`:

```bash
npm run start -- --url "https://www.2025copy.com/comic/guichuyinxiong" \
  --chapter-url "https://www.2025copy.com/comic/guichuyinxiong/1" \
  --chapter-url "https://www.2025copy.com/comic/guichuyinxiong/2"
```

Preview remote chapter images (no local files written):

```bash
npm run start -- --url "https://www.2025copy.com/comic/guichuyinxiong" --mode preview \
  --preview-max-chapters 5 --preview-images-per-chapter 6
```

Optional flags:

- `--output-dir ./downloads`
- `--concurrency 4`
- `--retries 3`
- `--timeout-ms 15000`
- `--max-chapters 3`
- `--no-headless`
- `--mode discover`
- `--mode preview`
- `--preview-max-chapters 5`
- `--preview-images-per-chapter 6`
- `--chapter-url "https://www.2025copy.com/comic/<slug>/<chapter>"` (repeatable)
- `--events-json` (emit machine-readable JSON line events)

Notes:

- Preview mode is remote-only: it fetches preview image URLs for UI readers and does not write image files.
- In the desktop app, run preview first, select chapters, then start download to write files locally.

## JSON Event Mode

Use this for desktop integration:

```bash
npm run start -- --url "https://www.2025copy.com/comic/guichuyinxiong" --events-json
```

Example event lines:

- `{"type":"run.start",...}`
- `{"type":"chapter.start",...}`
- `{"type":"image.written",...}`
- `{"type":"chapter.done",...}`
- `{"type":"run.done",...}`
- `{"type":"run.error",...}`

## Output

- `downloads/<comic-slug>/<chapter-folder>/*.jpg|png`
- `downloads/<comic-slug>/run-summary.json`
- `downloads/<comic-slug>/.download-checkpoint.json`
