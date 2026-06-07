import { describe, expect, it } from "vitest";
import { createConfig } from "../src/config.js";
import { parseCliArgs } from "../src/cli.js";

describe("parseCliArgs", () => {
  it("parses defaults", () => {
    const parsed = parseCliArgs(["--url", "https://www.2025copy.com/comic/guichuyinxiong"]);
    const config = createConfig(parsed);

    expect(config.outputDir).toBe("./downloads");
    expect(config.concurrency).toBe(4);
    expect(config.retries).toBe(3);
    expect(config.timeoutMs).toBe(15000);
    expect(config.headless).toBe(true);
    expect(config.eventsJson).toBe(false);
  });

  it("parses --events-json flag", () => {
    const parsed = parseCliArgs(["--url", "https://www.2025copy.com/comic/guichuyinxiong", "--events-json"]);
    const config = createConfig(parsed);

    expect(parsed.eventsJson).toBe(true);
    expect(config.eventsJson).toBe(true);
  });

  it("does not enable events json by default", () => {
    const parsed = parseCliArgs(["--url", "https://www.2025copy.com/comic/guichuyinxiong"]);

    expect(parsed.eventsJson).toBeUndefined();
  });

  it("parses --mode preview", () => {
    const parsed = parseCliArgs(["--url", "https://www.2025copy.com/comic/guichuyinxiong", "--mode", "preview"]);
    const config = createConfig(parsed);

    expect(parsed.mode).toBe("preview");
    expect(config.mode).toBe("preview");
  });

  it("rejects unknown mode", () => {
    expect(() =>
      parseCliArgs(["--url", "https://www.2025copy.com/comic/guichuyinxiong", "--mode", "invalid"])
    ).toThrow(/--mode/);
  });

  it("parses preview limits", () => {
    const parsed = parseCliArgs([
      "--url",
      "https://www.2025copy.com/comic/guichuyinxiong",
      "--preview-max-chapters",
      "6",
      "--preview-images-per-chapter",
      "2"
    ]);
    const config = createConfig(parsed);

    expect(parsed.previewMaxChapters).toBe(6);
    expect(parsed.previewImagesPerChapter).toBe(2);
    expect(config.previewMaxChapters).toBe(6);
    expect(config.previewImagesPerChapter).toBe(2);
  });

  it("parses repeated --chapter-url", () => {
    const parsed = parseCliArgs([
      "--url",
      "https://www.2025copy.com/comic/guichuyinxiong",
      "--chapter-url",
      "https://www.2025copy.com/comic/chapter-a",
      "--chapter-url",
      "https://www.2025copy.com/comic/chapter-b"
    ]);
    const config = createConfig(parsed);

    expect(parsed.chapterUrls).toEqual([
      "https://www.2025copy.com/comic/chapter-a",
      "https://www.2025copy.com/comic/chapter-b"
    ]);
    expect(config.chapterUrls).toEqual([
      "https://www.2025copy.com/comic/chapter-a",
      "https://www.2025copy.com/comic/chapter-b"
    ]);
  });

  it("rejects --chapter-url missing value", () => {
    expect(() =>
      parseCliArgs(["--url", "https://www.2025copy.com/comic/guichuyinxiong", "--chapter-url"])
    ).toThrow(/--chapter-url/);
  });

  it("rejects --chapter-url followed by another flag", () => {
    expect(() =>
      parseCliArgs([
        "--url",
        "https://www.2025copy.com/comic/guichuyinxiong",
        "--chapter-url",
        "--headless"
      ])
    ).toThrow(/--chapter-url/);
  });

  it("defaults preview limits and chapter urls", () => {
    const config = createConfig({
      url: "https://www.2025copy.com/comic/guichuyinxiong"
    });

    expect(config.previewMaxChapters).toBe(12);
    expect(config.previewImagesPerChapter).toBe(3);
    expect(config.chapterUrls).toEqual([]);
  });

  it("rejects invalid preview max chapters", () => {
    expect(() =>
      createConfig({
        url: "https://www.2025copy.com/comic/guichuyinxiong",
        previewMaxChapters: 0
      })
    ).toThrow(/preview-max-chapters/);
  });

  it("rejects invalid preview images per chapter", () => {
    expect(() =>
      createConfig({
        url: "https://www.2025copy.com/comic/guichuyinxiong",
        previewImagesPerChapter: 0
      })
    ).toThrow(/preview-images-per-chapter/);
  });

  it("rejects invalid chapter url", () => {
    expect(() =>
      createConfig({
        url: "https://www.2025copy.com/comic/guichuyinxiong",
        chapterUrls: ["not-a-url"]
      })
    ).toThrow(/chapter-url/);
  });

  it("rejects chapter url outside supported host", () => {
    expect(() =>
      createConfig({
        url: "https://www.2025copy.com/comic/guichuyinxiong",
        chapterUrls: ["https://example.com/comic/chapter-a"]
      })
    ).toThrow(/chapter-url/);
  });

  it("rejects chapter url that is not a comic page", () => {
    expect(() =>
      createConfig({
        url: "https://www.2025copy.com/comic/guichuyinxiong",
        chapterUrls: ["https://www.2025copy.com/about"]
      })
    ).toThrow(/chapter-url/);
  });

  it("rejects non-2025copy URL", () => {
    expect(() =>
      createConfig({
        url: "https://example.com/comic/foo"
      })
    ).toThrow(/2025copy/);
  });
});
