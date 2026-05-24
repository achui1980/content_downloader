---
name: download-comic-2025copy
description: Use when the user provides a 2025copy comic URL and wants all chapters under the hua tab downloaded as ordered images with resume support.
---

# Download Comic From 2025copy

Use this skill only for `www.2025copy.com` comic detail pages.

## What it does

- Discovers chapters under the hua tab
- Extracts chapter image URLs in order
- Downloads images into one folder per chapter
- Supports retry and resume

## Run

From repository root:

```bash
npm install --prefix "tools/download-comic-2025copy"
npx playwright install chromium
npm run start --prefix "tools/download-comic-2025copy" -- --url "https://www.2025copy.com/comic/guichuyinxiong"
```

## Common options

```bash
npm run start --prefix "tools/download-comic-2025copy" -- --url "<comic-url>" --output-dir "./downloads" --concurrency 4 --retries 3 --timeout-ms 15000 --max-chapters 3
```

## Notes

- Download only content you are allowed to download.
- First run may take longer due to browser setup.
