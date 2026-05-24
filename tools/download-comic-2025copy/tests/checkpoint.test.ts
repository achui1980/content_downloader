import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createCheckpointStore } from "../src/state/checkpoint.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("checkpoint store", () => {
  it("persists completed images", () => {
    const dir = mkdtempSync(join(tmpdir(), "checkpoint-test-"));
    tempDirs.push(dir);

    const filePath = join(dir, "state.json");
    const first = createCheckpointStore(filePath);
    first.markImageDone("chapter-1", 1);
    first.markImageDone("chapter-1", 2);
    first.save();

    const second = createCheckpointStore(filePath);
    expect(second.isImageDone("chapter-1", 1)).toBe(true);
    expect(second.isImageDone("chapter-1", 2)).toBe(true);
    expect(second.isImageDone("chapter-1", 3)).toBe(false);
  });
});
