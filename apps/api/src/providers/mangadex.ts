import { z } from "zod";
import type { PreviewResponse, ProviderInfo, SearchResponse, UnifiedSearchResult } from "@capdown/contracts";
import type { ProviderAdapter, ProviderSearchInput } from "./types.js";
import { pickLocalizedText, toChapterLabel, toOptionalInteger, truncateText } from "./text.js";

const MANGADEX_API_BASE = "https://api.mangadex.org";

const mangadexCoverRelationshipSchema = z.object({
  type: z.literal("cover_art"),
  attributes: z.object({
    fileName: z.string(),
  }).passthrough().optional(),
}).passthrough();

const mangadexSearchMangaSchema = z.object({
  id: z.string(),
  attributes: z.object({
    title: z.record(z.string(), z.unknown()),
    description: z.record(z.string(), z.unknown()).optional(),
    lastChapter: z.string().optional().nullable(),
  }).passthrough(),
  relationships: z.array(z.union([mangadexCoverRelationshipSchema, z.object({ type: z.string() }).passthrough()])),
}).passthrough();

const mangadexSearchResponseSchema = z.object({
  result: z.string(),
  response: z.string().optional(),
  data: z.array(mangadexSearchMangaSchema),
  total: z.number().int().optional(),
}).passthrough();

const mangadexDetailResponseSchema = z.object({
  result: z.string(),
  data: mangadexSearchMangaSchema,
}).passthrough();

const mangadexChapterSchema = z.object({
  id: z.string(),
  attributes: z.object({
    title: z.string().optional().nullable(),
    chapter: z.string().optional().nullable(),
  }).passthrough(),
}).passthrough();

const mangadexChaptersResponseSchema = z.object({
  result: z.string(),
  response: z.string().optional(),
  data: z.array(mangadexChapterSchema),
  total: z.number().int().optional(),
}).passthrough();

function buildMangaDexSearchUrl(query: ProviderSearchInput) {
  const url = new URL("/manga", MANGADEX_API_BASE);
  url.searchParams.set("title", query.q);
  url.searchParams.append("includes[]", "cover_art");
  url.searchParams.set("limit", String(query.limit));
  url.searchParams.set("offset", String((query.page - 1) * query.limit));
  return url;
}

function buildMangaDexMangaUrl(mangaId: string) {
  const url = new URL(`/manga/${encodeURIComponent(mangaId)}`, MANGADEX_API_BASE);
  url.searchParams.append("includes[]", "cover_art");
  return url;
}

function buildMangaDexChapterListUrl(mangaId: string) {
  const url = new URL("/chapter", MANGADEX_API_BASE);
  url.searchParams.set("manga", mangaId);
  url.searchParams.set("limit", "500");
  url.searchParams.set("offset", "0");
  url.searchParams.set("order[chapter]", "asc");
  return url;
}

function mapMangaDexSearchResult(manga: z.infer<typeof mangadexSearchMangaSchema>, index: number): UnifiedSearchResult {
  const title = pickLocalizedText(manga.attributes.title) ?? "Untitled";
  const description = truncateText(pickLocalizedText(manga.attributes.description));
  const coverRelationship = manga.relationships.find(
    (relationship): relationship is z.infer<typeof mangadexCoverRelationshipSchema> =>
      relationship.type === "cover_art",
  );
  const fileName = coverRelationship?.attributes?.fileName;
  const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}` : null;

  return {
    title,
    cover_url: coverUrl,
    description,
    score: Math.max(0, 1 - index * 0.01),
    sources: [
      {
        provider_id: "manga_dex",
        source_id: manga.id,
        title,
        slug: manga.id,
        source_url: buildMangaDexMangaUrl(manga.id).toString(),
        cover_url: coverUrl,
        total_chapters: toOptionalInteger(manga.attributes.lastChapter),
        description,
      },
    ],
  };
}

function mapMangaDexPreview(detail: z.infer<typeof mangadexSearchMangaSchema>, chapters: z.infer<typeof mangadexChapterSchema>[], sourceUrl: string): PreviewResponse {
  const coverRelationship = detail.relationships.find(
    (relationship): relationship is z.infer<typeof mangadexCoverRelationshipSchema> =>
      relationship.type === "cover_art",
  );
  const fileName = coverRelationship?.attributes?.fileName;
  const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${detail.id}/${fileName}` : null;

  return {
    provider_id: "manga_dex",
    source_id: detail.id,
    title: pickLocalizedText(detail.attributes.title) ?? "Untitled",
    source_url: sourceUrl,
    cover_url: coverUrl,
    chapters: chapters
      .map((chapter) => ({
        source_id: chapter.id,
        title: chapter.attributes.title?.trim() || `Chapter ${chapter.attributes.chapter?.trim() || chapter.id}`,
        number: toChapterLabel(chapter.attributes.chapter),
        source_url: new URL(`/chapter/${encodeURIComponent(chapter.id)}`, MANGADEX_API_BASE).toString(),
      }))
      .sort((left, right) => {
        const leftNumber = toOptionalInteger(left.number) ?? Number.MAX_SAFE_INTEGER;
        const rightNumber = toOptionalInteger(right.number) ?? Number.MAX_SAFE_INTEGER;
        return leftNumber - rightNumber;
      }),
  };
}

export const mangaDexAdapter: ProviderAdapter = {
  info: {
    id: "manga_dex",
    name: "MangaDex",
    domains: ["mangadex.org", "api.mangadex.org", "uploads.mangadex.org"],
  } satisfies ProviderInfo,

  canHandleUrl(url: URL) {
    return url.hostname === "mangadex.org" || url.hostname === "api.mangadex.org";
  },

  async search(input: ProviderSearchInput): Promise<SearchResponse> {
    const response = await fetch(buildMangaDexSearchUrl(input));
    if (!response.ok) {
      throw new Error(`MangaDex search failed with HTTP ${response.status}`);
    }

    const payload = mangadexSearchResponseSchema.parse(await response.json());
    return payload.data.map((manga, index) => mapMangaDexSearchResult(manga, index));
  },

  async preview(url: URL): Promise<PreviewResponse> {
    const mangaId = url.pathname.split("/").filter(Boolean).at(-1);
    if (!mangaId) {
      throw new Error("MangaDex preview URL is missing the manga id");
    }

    const [mangaResponse, chapterResponse] = await Promise.all([
      fetch(buildMangaDexMangaUrl(mangaId)),
      fetch(buildMangaDexChapterListUrl(mangaId)),
    ]);

    if (!mangaResponse.ok) {
      throw new Error(`MangaDex manga lookup failed with HTTP ${mangaResponse.status}`);
    }

    if (!chapterResponse.ok) {
      throw new Error(`MangaDex chapter lookup failed with HTTP ${chapterResponse.status}`);
    }

    const mangaPayload = mangadexDetailResponseSchema.parse(await mangaResponse.json());
    const chapterPayload = mangadexChaptersResponseSchema.parse(await chapterResponse.json());
    return mapMangaDexPreview(mangaPayload.data, chapterPayload.data, url.toString());
  },
};
