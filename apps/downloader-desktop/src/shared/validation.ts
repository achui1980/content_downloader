import type { StartInput, StartInputValidationResult } from "./contracts.js";

const URL_ERROR = "只支持 2025copy 漫画链接";
const OUTPUT_DIR_ERROR = "输出目录不能为空";
const CONCURRENCY_ERROR = "并发数必须是大于等于 1 的整数";
const RETRIES_ERROR = "重试次数必须是大于等于 0 的整数";

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

  return {
    ok: errors.length === 0,
    errors
  };
}
