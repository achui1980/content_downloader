/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import { parseDownloaderEventLine } from "../src/main/log-event-parser";

describe("parseDownloaderEventLine", () => {
  test("parses known downloader JSON event lines", () => {
    const parsed = parseDownloaderEventLine(
      JSON.stringify({
        type: "chapter.start",
        index: 2,
        totalChapters: 12,
        chapterTitle: "Chapter 2"
      })
    );

    expect(parsed).toEqual({
      type: "chapter.start",
      index: 2,
      totalChapters: 12,
      chapterTitle: "Chapter 2"
    });
  });

  test("returns null for non-JSON lines", () => {
    expect(parseDownloaderEventLine("[2/12] Chapter 2")).toBeNull();
  });

  test("returns null for JSON values without event type", () => {
    expect(parseDownloaderEventLine(JSON.stringify({ message: "hello" }))).toBeNull();
  });

  test("returns null for unknown event types", () => {
    expect(parseDownloaderEventLine(JSON.stringify({ type: "something.else" }))).toBeNull();
  });
});
