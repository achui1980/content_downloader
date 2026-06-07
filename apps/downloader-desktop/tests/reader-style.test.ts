/// <reference types="vitest" />

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("reader styles", () => {
  test("keeps chapter image frames from shrinking in vertical stream", () => {
    const css = readFileSync("src/renderer/styles/theme.css", "utf8");

    expect(css).toContain(".reader-image-frame {");
    expect(css).toContain("flex-shrink: 0;");
  });
});
