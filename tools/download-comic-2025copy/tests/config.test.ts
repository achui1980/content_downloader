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

  it("rejects non-2025copy URL", () => {
    expect(() =>
      createConfig({
        url: "https://example.com/comic/foo"
      })
    ).toThrow(/2025copy/);
  });
});
