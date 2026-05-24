import { describe, expect, it } from "vitest";
import {
  buildImageFileName,
  chapterSortKey,
  getComicSlugFromUrl,
  inferExtensionFromUrl,
  sanitizePathSegment
} from "../src/utils/pathing.js";

describe("pathing", () => {
  it("builds image names", () => {
    expect(buildImageFileName(1, "jpg")).toBe("001.jpg");
    expect(buildImageFileName(12, "png")).toBe("012.png");
    expect(buildImageFileName(120, "webp", 4)).toBe("0120.webp");
  });

  it("infers extension", () => {
    expect(inferExtensionFromUrl("https://a.com/p/1.png")).toBe("png");
    expect(inferExtensionFromUrl("not-a-url")).toBe("jpg");
  });

  it("parses comic slug", () => {
    expect(getComicSlugFromUrl("https://www.2025copy.com/comic/guichuyinxiong")).toBe("guichuyinxiong");
  });

  it("sorts chapter titles", () => {
    expect(chapterSortKey("第8.5话")).toBe(8.5);
    expect(chapterSortKey("第10话")).toBe(10);
  });

  it("sanitizes path segments", () => {
    expect(sanitizePathSegment("第1话: / test")).toBe("第1话_ _ test");
  });
});
