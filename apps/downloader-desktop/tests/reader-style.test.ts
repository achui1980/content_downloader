/// <reference types="vitest" />

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function expectSelectorBlock(css: string, selector: string, properties: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockMatch = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"));

  expect(blockMatch, `Expected CSS block for ${selector}`).not.toBeNull();

  const block = blockMatch?.[1] ?? "";

  for (const property of properties) {
    expect(block, `Expected ${selector} to contain ${property}`).toContain(property);
  }
}

describe("reader styles", () => {
  test("keeps chapter image frames from shrinking in vertical stream", () => {
    const css = readFileSync("src/renderer/styles/theme.css", "utf8");

    expectSelectorBlock(css, ".reader-image-frame", ["flex-shrink: 0;"]);
  });

  test("defines reader-first stage layout selectors", () => {
    const css = readFileSync("src/renderer/styles/theme.css", "utf8");

    expectSelectorBlock(css, ".app-shell--setup-stage", ["max-width: 1480px;"]);
    expectSelectorBlock(css, ".app-shell--reader-stage", ["max-width: 1760px;", "padding-top: 18px;"]);
    expectSelectorBlock(css, ".reader-stage-shell", ["border-radius: 28px;", "box-shadow: 0 22px 56px rgba(3, 7, 16, 0.42);"]);
    expectSelectorBlock(css, ".reader-grid-col--chapters", ["min-width: 0;"]);
    expectSelectorBlock(css, ".reader-grid-col--chapters .card--chapter-list", ["position: sticky;", "top: 18px;"]);
    expectSelectorBlock(css, ".reader-grid-col--reader", ["min-width: 0;"]);
    expectSelectorBlock(css, ".reader-panel-header", ["display: flex;", "border-bottom: 1px solid rgba(120, 149, 217, 0.18);"]);
    expectSelectorBlock(css, ".chapter-list", ["display: flex;", "overflow: auto;"]);
    expectSelectorBlock(css, ".chapter-row-wrap", ["display: grid;", "grid-template-columns: auto 1fr auto;"]);
    expectSelectorBlock(css, ".reader-actions--endcap", ["border-radius: 18px;", "background: rgba(12, 18, 30, 0.82);"]);
  });
});
