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

  test("parses image.written events", () => {
    const parsed = parseDownloaderEventLine(
      JSON.stringify({
        type: "image.written",
        fileName: "001.webp",
        bytes: 2048,
        writtenImages: 1,
        writtenBytes: 2048
      })
    );

    expect(parsed).toEqual({
      type: "image.written",
      fileName: "001.webp",
      bytes: 2048,
      writtenImages: 1,
      writtenBytes: 2048
    });
  });

  test("parses preview.chapter events", () => {
    const parsed = parseDownloaderEventLine(
      JSON.stringify({
        type: "preview.chapter",
        index: 1,
        totalChapters: 2,
        chapterTitle: "Chapter 1",
        chapterUrl: "https://www.2025copy.com/comic/slug/chapter-1",
        images: [
          "https://img.example/1.webp",
          "https://img.example/2.webp"
        ]
      })
    );

    expect(parsed).toEqual({
      type: "preview.chapter",
      index: 1,
      totalChapters: 2,
      chapterTitle: "Chapter 1",
      chapterUrl: "https://www.2025copy.com/comic/slug/chapter-1",
      images: [
        "https://img.example/1.webp",
        "https://img.example/2.webp"
      ]
    });
  });

  test("parses and sanitizes preview.chapterDetail events", () => {
    const parsed = parseDownloaderEventLine(
      JSON.stringify({
        type: "preview.chapterDetail",
        chapterTitle: "  Chapter 1  ",
        chapterUrl: " https://www.2025copy.com/comic/slug/chapter-1 ",
        totalImages: 999,
        images: [
          "https://img.example/1.webp",
          "  ",
          "https://img.example/2.webp"
        ]
      })
    );

    expect(parsed).toEqual({
      type: "preview.chapterDetail",
      chapterTitle: "Chapter 1",
      chapterUrl: "https://www.2025copy.com/comic/slug/chapter-1",
      totalImages: 2,
      images: [
        "https://img.example/1.webp",
        "https://img.example/2.webp"
      ]
    });
  });

  test("returns null for invalid preview.chapterDetail payload", () => {
    expect(
      parseDownloaderEventLine(
        JSON.stringify({
          type: "preview.chapterDetail",
          chapterTitle: "",
          chapterUrl: "https://www.2025copy.com/comic/slug/chapter-1",
          totalImages: 1,
          images: ["https://img.example/1.webp"]
        })
      )
    ).toBeNull();
  });

  test("parses preview lifecycle events", () => {
    expect(parseDownloaderEventLine(JSON.stringify({ type: "preview.start" }))).toEqual({
      type: "preview.start"
    });
    expect(parseDownloaderEventLine(JSON.stringify({ type: "preview.done" }))).toEqual({
      type: "preview.done"
    });
    expect(parseDownloaderEventLine(JSON.stringify({ type: "preview.error", error: "boom" }))).toEqual({
      type: "preview.error",
      error: "boom"
    });
  });
});
