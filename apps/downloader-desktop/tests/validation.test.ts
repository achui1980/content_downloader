/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import type { PreviewInput, StartInput } from "../src/shared/contracts";
import { validatePreviewInput, validateStartInput } from "../src/shared/validation";

function buildValidInput(): StartInput {
  return {
    url: "https://www.2025copy.com/comic/guichuyinxiong",
    outputDir: "./downloads",
    concurrency: 4,
    retries: 3,
    selectedChapterUrls: ["https://www.2025copy.com/comic/guichuyinxiong/1"]
  };
}

function buildValidPreviewInput(): PreviewInput {
  return {
    url: "https://www.2025copy.com/comic/guichuyinxiong",
    previewMaxChapters: 5,
    previewImagesPerChapter: 3
  };
}

describe("validateStartInput", () => {
  test("returns valid for accepted input", () => {
    const result = validateStartInput(buildValidInput());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects non-2025copy url", () => {
    const result = validateStartInput({
      ...buildValidInput(),
      url: "https://example.com/comic/abc"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("只支持 2025copy 漫画链接");
  });

  test("rejects spoofed hostname containing 2025copy.com", () => {
    const result = validateStartInput({
      ...buildValidInput(),
      url: "https://evil2025copy.com/comic/abc"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("只支持 2025copy 漫画链接");
  });

  test("rejects non-canonical comic path", () => {
    const result = validateStartInput({
      ...buildValidInput(),
      url: "https://www.2025copy.com/foo/comic/abc"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("只支持 2025copy 漫画链接");
  });

  test("rejects empty outputDir", () => {
    const result = validateStartInput({
      ...buildValidInput(),
      outputDir: "   "
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("输出目录不能为空");
  });

  test("rejects concurrency lower than 1", () => {
    const result = validateStartInput({
      ...buildValidInput(),
      concurrency: 0
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("并发数必须是大于等于 1 的整数");
  });

  test("rejects concurrency that is not an integer", () => {
    const result = validateStartInput({
      ...buildValidInput(),
      concurrency: 1.5
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("并发数必须是大于等于 1 的整数");
  });

  test("rejects retries lower than 0", () => {
    const result = validateStartInput({
      ...buildValidInput(),
      retries: -1
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("重试次数必须是大于等于 0 的整数");
  });

  test("rejects retries that is not an integer", () => {
    const result = validateStartInput({
      ...buildValidInput(),
      retries: 1.25
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("重试次数必须是大于等于 0 的整数");
  });

  test("rejects empty selected chapters", () => {
    const result = validateStartInput({
      ...buildValidInput(),
      selectedChapterUrls: []
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("至少选择一个章节");
  });

  test("rejects selected chapters containing blank URL", () => {
    const result = validateStartInput({
      ...buildValidInput(),
      selectedChapterUrls: ["   "]
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("至少选择一个章节");
  });
});

describe("validatePreviewInput", () => {
  test("returns valid for accepted preview input", () => {
    const result = validatePreviewInput(buildValidPreviewInput());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects invalid preview URL", () => {
    const result = validatePreviewInput({
      ...buildValidPreviewInput(),
      url: "https://example.com/comic/abc"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("只支持 2025copy 漫画链接");
  });

  test("rejects previewMaxChapters lower than 1", () => {
    const result = validatePreviewInput({
      ...buildValidPreviewInput(),
      previewMaxChapters: 0
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("预览章节数必须是大于等于 1 的整数");
  });

  test("rejects previewImagesPerChapter lower than 1", () => {
    const result = validatePreviewInput({
      ...buildValidPreviewInput(),
      previewImagesPerChapter: 0
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("每章预览图片数必须是大于等于 1 的整数");
  });
});
