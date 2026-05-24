import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseChaptersFromHtml } from "../src/site2025copy/discoverChapters.js";

describe("parseChaptersFromHtml", () => {
  it("extracts and sorts hua chapters", () => {
    const html = readFileSync(join(import.meta.dirname, "fixtures", "chapter-list.html"), "utf8");
    const chapters = parseChaptersFromHtml(html, "https://www.2025copy.com/comic/guichuyinxiong");

    expect(chapters).toHaveLength(4);
    expect(chapters[0].title).toContain("第1话");
    expect(chapters[1].title).toContain("第2话");
    expect(chapters[2].title).toContain("第8.5话");
    expect(chapters[3].title).toContain("第10话");
  });
});
