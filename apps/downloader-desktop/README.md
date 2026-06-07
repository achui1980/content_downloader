# downloader-desktop

Electron + React desktop UI for the 2025copy downloader.

## Development

```bash
npm install
npm run dev
```

Run renderer + Electron together:

```bash
npm run dev:electron
```

Or use the shell launcher (auto-check deps/tool/browser):

```bash
./scripts/dev-electron.sh
```

## Test and Build

```bash
npm test
npx tsc --noEmit
npm run build
```

## Packaging

```bash
npm run package -- --dir
```

To generate installable artifacts:

```bash
npm run package -- --publish never
```

## Dev Smoke Checklist

1. Open app in development mode.
2. Fill URL with `https://www.2025copy.com/comic/guichuyinxiong`.
3. Set preview limits (`Preview Chapters`, `Images/Chapter`) and click `Preview` to fetch chapter previews.
4. Click a chapter title to load full online chapter images in the right-side reader.
5. Select output directory.
6. In the chapter list, choose the chapters to download (checkboxes).
7. Click `Download Selected` and confirm progress/log/status updates.
8. Stop and rerun, verify resume behavior (`skipped` increases).
