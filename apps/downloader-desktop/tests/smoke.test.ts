/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import { buildDefaultStartInput, buildInitialTaskState } from "../src/shared/contracts";
import { validateStartInput } from "../src/shared/validation";

describe("desktop baseline", () => {
  test("buildInitialTaskState starts idle", () => {
    expect(buildInitialTaskState().status).toBe("idle");
  });

  test("buildDefaultStartInput provides test-friendly defaults", () => {
    expect(buildDefaultStartInput()).toEqual({
      url: "https://www.2025copy.com/comic/guichuyinxiong",
      outputDir: "/tmp/2025copy-test",
      concurrency: 2,
      retries: 1,
      selectedChapterUrls: []
    });
  });

  test("buildDefaultStartInput is intentionally invalid before chapter selection", () => {
    const result = validateStartInput(buildDefaultStartInput());

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("至少选择一个章节");
  });
});
