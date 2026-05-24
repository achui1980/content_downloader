/// <reference types="vitest" />

import { describe, expect, test } from "vitest";
import { buildInitialTaskState } from "../src/shared/contracts";

describe("desktop baseline", () => {
  test("buildInitialTaskState starts idle", () => {
    expect(buildInitialTaskState().status).toBe("idle");
  });
});
