/// <reference types="vitest" />

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("desktop docs", () => {
  test("documents npm run dev command", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme.includes("npm run dev")).toBe(true);
  });
});
