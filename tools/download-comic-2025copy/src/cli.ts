import { createConfig, type CliArgs } from "./config.js";
import { runDiscoverOnly, runDownloader } from "./main.js";
import { pathToFileURL } from "node:url";

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    headless: true,
    mode: "download"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    switch (token) {
      case "--url":
        args.url = next;
        i += 1;
        break;
      case "--output-dir":
        args.outputDir = next;
        i += 1;
        break;
      case "--concurrency":
        args.concurrency = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--retries":
        args.retries = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--timeout-ms":
        args.timeoutMs = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--max-chapters":
        args.maxChapters = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--mode":
        args.mode = next === "discover" ? "discover" : "download";
        i += 1;
        break;
      case "--headless":
        args.headless = true;
        break;
      case "--no-headless":
        args.headless = false;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        break;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`download-comic-2025copy

Required:
  --url <comic-url>

Optional:
  --output-dir <dir>      default: ./downloads
  --concurrency <n>       default: 4
  --retries <n>           default: 3
  --timeout-ms <n>        default: 15000
  --max-chapters <n>      default: all
  --headless              run browser headless
  --no-headless           run browser headed
  --mode discover         chapter discovery only
`);
}

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }

  const config = createConfig(parsed);

  if (parsed.mode === "discover") {
    await runDiscoverOnly(config);
    return;
  }

  const summary = await runDownloader(config);
  console.log(`Finished. Success chapters: ${summary.successChapters}, failed chapters: ${summary.failedChapters}`);
  console.log(`Output: ${summary.outputRoot}`);
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
