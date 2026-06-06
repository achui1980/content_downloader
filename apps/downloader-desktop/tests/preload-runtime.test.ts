/// <reference types="vitest" />

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("preload runtime wiring", () => {
  test("main window preload path points to CommonJS runtime", () => {
    const source = readFileSync("src/main/app.ts", "utf8");
    expect(source.includes('"runtime.cjs"')).toBe(true);
  });

  test("preload runtime uses require-based Electron bridge for sandboxed renderer", () => {
    const source = readFileSync("src/preload/runtime.cts", "utf8");

    expect(source.includes('require("electron")')).toBe(true);
    expect(source.includes('contextBridge.exposeInMainWorld("downloader"')).toBe(true);
  });
});
