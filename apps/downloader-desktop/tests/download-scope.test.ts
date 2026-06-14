/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import { resolveDownloadScope } from "../src/renderer/download-scope";

describe("resolveDownloadScope", () => {
  test("returns empty selection without fallback for all mode", () => {
    const result = resolveDownloadScope("all", ["https://www.2025copy.com/comic/slug/1"]);

    expect(result).toEqual({
      selectedChapterUrls: [],
      fallbackToAll: false
    });
  });

  test("returns selected urls without fallback for selected mode when urls exist", () => {
    const selectedChapterUrls = [
      "https://www.2025copy.com/comic/slug/1",
      "https://www.2025copy.com/comic/slug/2"
    ];

    const result = resolveDownloadScope("selected", selectedChapterUrls);

    expect(result).toEqual({
      selectedChapterUrls,
      fallbackToAll: false
    });
  });

  test("returns an explicit error for selected mode when urls are empty", () => {
    const result = resolveDownloadScope("selected", []);

    expect(result).toEqual({
      selectedChapterUrls: [],
      fallbackToAll: false,
      errorMessage: "Select at least one chapter before downloading selected chapters."
    });
  });
});
