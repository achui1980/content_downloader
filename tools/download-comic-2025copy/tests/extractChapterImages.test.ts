import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractImageUrlsFromHtml } from "../src/site2025copy/extractChapterImages.js";

describe("extractImageUrlsFromHtml", () => {
  it("extracts ordered chapter images and ignores ads", () => {
    const html = readFileSync(join(import.meta.dirname, "fixtures", "chapter-images.html"), "utf8");
    const urls = extractImageUrlsFromHtml(
      html,
      "https://www.2025copy.com/comic/guichuyinxiong/chapter/abc"
    );

    expect(urls).toEqual([
      "https://img.example.com/001.jpg",
      "https://img.example.com/002.jpg",
      "https://img.example.com/003.png"
    ]);
  });
});
