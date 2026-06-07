import type { PreviewInput, PreviewInputValidationResult, StartInput, StartInputValidationResult } from "./contracts.js";

const URL_ERROR = "只支持 2025copy 漫画链接";
const OUTPUT_DIR_ERROR = "输出目录不能为空";
const CONCURRENCY_ERROR = "并发数必须是大于等于 1 的整数";
const RETRIES_ERROR = "重试次数必须是大于等于 0 的整数";
const SELECTED_CHAPTERS_ERROR = "至少选择一个章节";
const PREVIEW_MAX_CHAPTERS_ERROR = "预览章节数必须是大于等于 1 的整数";
const PREVIEW_IMAGES_PER_CHAPTER_ERROR = "每章预览图片数必须是大于等于 1 的整数";

function is2025copyUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/^\/comic\/([^/]+)\/?$/);
    return parsed.hostname === "www.2025copy.com" && !!match && match[1].trim().length > 0;
  } catch {
    return false;
  }
}

export function validateStartInput(input: StartInput): StartInputValidationResult {
  const errors: string[] = [];

  if (!is2025copyUrl(input.url)) {
    errors.push(URL_ERROR);
  }

  if (input.outputDir.trim().length === 0) {
    errors.push(OUTPUT_DIR_ERROR);
  }

  if (!Number.isInteger(input.concurrency) || input.concurrency < 1) {
    errors.push(CONCURRENCY_ERROR);
  }

  if (!Number.isInteger(input.retries) || input.retries < 0) {
    errors.push(RETRIES_ERROR);
  }

  const selectedChapterCount = Array.isArray(input.selectedChapterUrls)
    ? input.selectedChapterUrls.filter((chapterUrl) => typeof chapterUrl === "string" && chapterUrl.trim().length > 0).length
    : 0;

  if (selectedChapterCount === 0) {
    errors.push(SELECTED_CHAPTERS_ERROR);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validatePreviewInput(input: PreviewInput): PreviewInputValidationResult {
  const errors: string[] = [];

  if (!is2025copyUrl(input.url)) {
    errors.push(URL_ERROR);
  }

  if (!Number.isInteger(input.previewMaxChapters) || input.previewMaxChapters < 1) {
    errors.push(PREVIEW_MAX_CHAPTERS_ERROR);
  }

  if (!Number.isInteger(input.previewImagesPerChapter) || input.previewImagesPerChapter < 1) {
    errors.push(PREVIEW_IMAGES_PER_CHAPTER_ERROR);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
