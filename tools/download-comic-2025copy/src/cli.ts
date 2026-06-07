import { createConfig, type CliArgs } from "./config.js";
import { runDiscoverOnly, runDownloader, runPreview, runPreviewChapter } from "./main.js";
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
      case "--preview-max-chapters":
        args.previewMaxChapters = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--preview-images-per-chapter":
        args.previewImagesPerChapter = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--chapter-url":
        if (!next || next.startsWith("--")) {
          throw new Error("--chapter-url requires a URL value");
        }
        args.chapterUrls ??= [];
        args.chapterUrls.push(next);
        i += 1;
        break;
      case "--mode":
        if (next !== "download" && next !== "discover" && next !== "preview" && next !== "preview-chapter") {
          throw new Error("--mode must be one of: download, discover, preview, preview-chapter");
        }
        args.mode = next;
        i += 1;
        break;
      case "--headless":
        args.headless = true;
        break;
      case "--no-headless":
        args.headless = false;
        break;
      case "--events-json":
        args.eventsJson = true;
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
  --preview-max-chapters <n> default: 12
  --preview-images-per-chapter <n> default: 3
  --chapter-url <url>     repeatable; filter chapters in download/preview modes
  --headless              run browser headless
  --no-headless           run browser headed
  --mode discover         chapter discovery only
  --mode preview          preview-limited downloads
  --mode preview-chapter  fetch full image URLs for one chapter
  --events-json           emit JSON line events for download runs
`);
}

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }

  const config = createConfig(parsed);

  if (config.mode === "discover") {
    await runDiscoverOnly(config);
    return;
  }

  if (config.mode === "preview") {
    await runPreview(config);
    return;
  }

  if (config.mode === "preview-chapter") {
    await runPreviewChapter(config);
    return;
  }

  const summary = await runDownloader(config);
  if (!config.eventsJson) {
    console.log(`Finished. Success chapters: ${summary.successChapters}, failed chapters: ${summary.failedChapters}`);
    console.log(`Output: ${summary.outputRoot}`);
  }
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
