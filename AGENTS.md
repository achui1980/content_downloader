# AGENTS.md

## Repo shape
- This repo is not a single workspace package; it has two independent Node projects: `tools/download-comic-2025copy` (Playwright CLI) and `apps/downloader-desktop` (Electron + React shell around the CLI).
- Run `npm` commands with `--prefix <package-dir>` from repo root, or run them inside each package directory; do not assume a root `package.json` script exists.
- Treat `tools/download-comic-2025copy/dist`, `apps/downloader-desktop/dist-electron`, and `apps/downloader-desktop/release` as build output; edit `src/**`.

## High-value commands
- Tool first-time setup (matches CI/runtime expectations): `npm ci --prefix tools/download-comic-2025copy && PLAYWRIGHT_BROWSERS_PATH=0 npm exec --prefix tools/download-comic-2025copy playwright install chromium`.
- Tool run: `npm run start --prefix tools/download-comic-2025copy -- --url "https://www.2025copy.com/comic/<slug>"`.
- Tool verify: `npm test --prefix tools/download-comic-2025copy && npm run build --prefix tools/download-comic-2025copy`.
- Desktop dev (full Electron path): `npm run dev:electron --prefix apps/downloader-desktop` (or `./apps/downloader-desktop/scripts/dev-electron.sh` for auto-bootstrap).
- Desktop verify order: `npm test --prefix apps/downloader-desktop && npx tsc --noEmit -p apps/downloader-desktop/tsconfig.json && npm run build --prefix apps/downloader-desktop`.
- Desktop package: `npm run package --prefix apps/downloader-desktop -- --publish never`.

## Focused test runs
- Single tool test file: `npm test --prefix tools/download-comic-2025copy -- tests/config.test.ts`.
- Single desktop test file: `npm test --prefix apps/downloader-desktop -- tests/download-session.test.ts`.
- `apps/downloader-desktop/tests/docs.test.ts` enforces README command strings (`npm run dev`, `npm run dev:electron`, `./scripts/dev-electron.sh`), so keep README in sync with script changes.

## Wiring quirks that break easily
- Desktop session launches downloader with `--events-json`; renderer progress/status relies on event parsing in `apps/downloader-desktop/src/main/log-event-parser.ts`.
- Downloader resolution order in `apps/downloader-desktop/src/main/downloader-path.ts`: packaged `process.resourcesPath/downloader-tool/dist/src/cli.js` -> repo `tools/download-comic-2025copy/dist/src/cli.js` -> `npm run start` fallback. Rebuild the tool before validating desktop integration or packaging.
- Preload uses CommonJS runtime (`src/preload/runtime.cts` -> `runtime.cjs`), and `apps/downloader-desktop/src/main/app.ts` hardcodes `runtime.cjs`; keep this contract intact.
- URL validation differs by layer and is test-covered: desktop UI requires `https://www.2025copy.com/comic/<slug>` (`apps/downloader-desktop/src/shared/validation.ts`), while CLI accepts any host containing `2025copy.com` with `/comic/` in path (`tools/download-comic-2025copy/src/config.ts`).

## OpenCode local skill
- If a user asks to download from a 2025copy comic URL, use the repo skill `.opencode/skills/download-comic-2025copy/SKILL.md`.
