/// <reference types="vitest" />

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("dev launcher", () => {
  test("uses strict Vite port to avoid mismatched Electron URL", () => {
    const script = readFileSync("scripts/dev-electron.mjs", "utf8");
    expect(script.includes("--strictPort")).toBe(true);
  });
});
