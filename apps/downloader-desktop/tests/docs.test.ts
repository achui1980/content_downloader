/// <reference types="vitest" />

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("desktop docs", () => {
  test("documents npm run dev command", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme.includes("npm run dev")).toBe(true);
  });

  test("documents npm run dev:electron command", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme.includes("npm run dev:electron")).toBe(true);
  });

  test("documents shell launcher command", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme.includes("./scripts/dev-electron.sh")).toBe(true);
  });
});
