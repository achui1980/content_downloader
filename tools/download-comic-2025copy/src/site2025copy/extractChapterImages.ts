import type { Page } from "playwright";
import type { ImageEntry } from "../types.js";
import { inferExtensionFromUrl } from "../utils/pathing.js";

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const url of urls) {
    if (!seen.has(url)) {
      seen.add(url);
      output.push(url);
    }
  }

  return output;
}

function normalizeImageUrl(rawUrl: string, baseUrl: string): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const absolute = new URL(rawUrl, baseUrl).toString();
    if (absolute.includes("/static/ads/")) {
      return null;
    }
    return absolute;
  } catch {
    return null;
  }
}

export function extractImageUrlsFromHtml(html: string, baseUrl: string): string[] {
  const listMatch = html.match(/<ul[^>]*comicContent-list[^>]*>([\s\S]*?)<\/ul>/i);
  const input = listMatch?.[1] ?? html;

  const imageRegex = /<img[^>]*>/gi;
  const attributeRegex = /(?:data-src|data-original|src)=["']([^"']+)["']/i;

  const rawUrls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = imageRegex.exec(input)) !== null) {
    const attr = match[0].match(attributeRegex);
    if (!attr) {
      continue;
    }
    const normalized = normalizeImageUrl(attr[1], baseUrl);
    if (normalized) {
      rawUrls.push(normalized);
    }
  }

  return uniqueUrls(rawUrls);
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let total = 0;
      const distance = 500;
      const timer = window.setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;
        if (total >= document.body.scrollHeight + 2000) {
          window.clearInterval(timer);
          resolve();
        }
      }, 60);
    });
  });
}

export async function extractChapterImages(page: Page, chapterUrl: string, timeoutMs: number): Promise<ImageEntry[]> {
  await page.goto(chapterUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".comicContent-list", { timeout: timeoutMs });

  await page
    .waitForFunction(
      () => document.querySelectorAll(".comicContent-list img").length > 0,
      undefined,
      { timeout: timeoutMs }
    )
    .catch(() => undefined);

  await autoScroll(page);
  await page.waitForTimeout(300);

  const rawUrls = await page.$$eval(".comicContent-list img", (images) => {
    return images.map((image) => {
      return (
        image.getAttribute("data-src") ||
        image.getAttribute("data-original") ||
        image.getAttribute("src") ||
        ""
      );
    });
  });

  let urls = uniqueUrls(
    rawUrls
      .map((url) => normalizeImageUrl(url, chapterUrl))
      .filter((url): url is string => url !== null)
  );

  if (urls.length === 0) {
    urls = extractImageUrlsFromHtml(await page.content(), chapterUrl);
  }

  return urls.map((url, index) => ({
    index: index + 1,
    url,
    ext: inferExtensionFromUrl(url)
  }));
}
