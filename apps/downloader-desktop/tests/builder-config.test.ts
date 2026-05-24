/// <reference types="vitest" />

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("electron-builder config", () => {
  test("contains dmg, nsis, and AppImage targets", () => {
    const config = readFileSync("electron-builder.yml", "utf8");
    expect(config.includes("dmg")).toBe(true);
    expect(config.includes("nsis")).toBe(true);
    expect(config.includes("AppImage")).toBe(true);
  });
});
