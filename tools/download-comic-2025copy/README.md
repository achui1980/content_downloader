# download-comic-2025copy

Download ordered comic images from 2025copy comic pages.

## Install

```bash
npm install
```

Playwright browser binaries may be required on first run:

```bash
npx playwright install chromium
```

## Usage

```bash
npm run start -- --url "https://www.2025copy.com/comic/guichuyinxiong"
```

Optional flags:

- `--output-dir ./downloads`
- `--concurrency 4`
- `--retries 3`
- `--timeout-ms 15000`
- `--max-chapters 3`
- `--no-headless`
- `--mode discover`

## Output

- `downloads/<comic-slug>/<chapter-folder>/*.jpg|png`
- `downloads/<comic-slug>/run-summary.json`
- `downloads/<comic-slug>/.download-checkpoint.json`
