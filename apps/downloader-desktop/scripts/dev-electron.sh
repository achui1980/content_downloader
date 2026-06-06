#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd -- "${APP_DIR}/../.." && pwd)"
TOOL_DIR="${REPO_DIR}/tools/download-comic-2025copy"

if [ ! -d "${APP_DIR}/node_modules" ]; then
  echo "[dev-electron] Installing desktop dependencies..."
  npm install --prefix "${APP_DIR}"
fi

if [ ! -f "${TOOL_DIR}/dist/src/cli.js" ]; then
  echo "[dev-electron] Building downloader tool..."
  npm install --prefix "${TOOL_DIR}"
  npm run build --prefix "${TOOL_DIR}"
fi

if ! compgen -G "${TOOL_DIR}/node_modules/playwright-core/.local-browsers/chromium-*" > /dev/null; then
  echo "[dev-electron] Installing Playwright Chromium..."
  PLAYWRIGHT_BROWSERS_PATH=0 npm exec --prefix "${TOOL_DIR}" playwright install chromium
fi

npm run dev:electron --prefix "${APP_DIR}"
