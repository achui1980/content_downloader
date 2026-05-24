import type { Page } from "playwright";
import type { Chapter } from "../types.js";
import { chapterSortKey } from "../utils/pathing.js";

const CHAPTER_LINK_REGEX = /\/comic\/[^/]+\/chapter\/[0-9a-f-]+/i;

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function stripTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, "")).trim();
}

export function parseChaptersFromHtml(html: string, baseUrl: string): Chapter[] {
  const found = new Map<string, Chapter>();
  const anchorRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const title = stripTags(match[2]);

    if (!title || !/[话話]/.test(title)) {
      continue;
    }

    const absolute = new URL(href, baseUrl).toString();
    if (!CHAPTER_LINK_REGEX.test(absolute)) {
      continue;
    }

    if (!found.has(absolute)) {
      found.set(absolute, {
        title,
        url: absolute,
        order: 0
      });
    }
  }

  const chapters = [...found.values()].sort((a, b) => {
    const keyA = chapterSortKey(a.title);
    const keyB = chapterSortKey(b.title);
    if (keyA !== keyB) {
      return keyA - keyB;
    }
    return a.title.localeCompare(b.title, "zh-Hans-CN");
  });

  return chapters.map((chapter, index) => ({
    ...chapter,
    order: index + 1
  }));
}

async function selectHuaTab(page: Page): Promise<void> {
  const selectors = [
    "a:has-text('話')",
    "a:has-text('话')",
    "button:has-text('話')",
    "button:has-text('话')"
  ];

  for (const selector of selectors) {
    const candidate = page.locator(selector).first();
    if ((await candidate.count()) > 0) {
      await candidate.click({ timeout: 2500 }).catch(() => undefined);
      await page.waitForTimeout(700);
      return;
    }
  }
}

export async function discoverChapters(page: Page, comicUrl: string): Promise<Chapter[]> {
  await page.goto(comicUrl, { waitUntil: "domcontentloaded" });
  await selectHuaTab(page);
  await page.waitForTimeout(1200);

  let chapters = parseChaptersFromHtml(await page.content(), comicUrl);
  if (chapters.length > 0) {
    return chapters;
  }

  const fromDom = await page.$$eval("a[href*='/chapter/']", (anchors, base) => {
    return anchors
      .map((anchor) => {
        const href = anchor.getAttribute("href");
        const title = (anchor.textContent ?? "").trim();
        if (!href || !title) {
          return null;
        }
        const url = new URL(href, base).toString();
        return { title, url };
      })
      .filter((item): item is { title: string; url: string } => item !== null);
  }, comicUrl);

  const unique = new Map<string, Chapter>();
  for (const item of fromDom) {
    if (!/[话話]/.test(item.title)) {
      continue;
    }
    if (!CHAPTER_LINK_REGEX.test(item.url)) {
      continue;
    }
    if (!unique.has(item.url)) {
      unique.set(item.url, { title: item.title, url: item.url, order: 0 });
    }
  }

  chapters = [...unique.values()].sort((a, b) => chapterSortKey(a.title) - chapterSortKey(b.title));
  return chapters.map((chapter, index) => ({ ...chapter, order: index + 1 }));
}
