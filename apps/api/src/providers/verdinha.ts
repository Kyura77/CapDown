import { z } from "zod";
import type { PreviewResponse, ProviderInfo, SearchResponse, UnifiedSearchResult } from "@capdown/contracts";
import type { ProviderAdapter, ProviderSearchInput } from "./types.js";
import { toChapterLabel, toOptionalInteger, truncateText } from "./text.js";

const VERDINHA_API_BASE = "https://api.verdinha.wtf";

const verdinhaSearchItemSchema = z.object({
  obr_id: z.union([z.number(), z.string()]),
  obr_nome: z.string(),
  obr_slug: z.string().optional().nullable(),
  obr_descricao: z.string().optional().nullable(),
  obr_imagem: z.string().optional().nullable(),
  scan_id: z.unknown().optional().nullable(),
  total_capitulos: z.unknown().optional(),
}).passthrough();

const verdinhaSearchResponseSchema = z.object({
  obras: z.array(verdinhaSearchItemSchema),
  pagina: z.number().int(),
  limite: z.number().int(),
  total: z.number().int(),
  totalPaginas: z.number().int(),
}).passthrough();

const verdinhaChapterSchema = z.object({
  cap_id: z.union([z.number(), z.string()]),
  cap_nome: z.string(),
  cap_numero: z.unknown().optional().nullable(),
  cap_liberado: z.boolean().optional().nullable(),
}).passthrough();

const verdinhaDetailResponseSchema = z.object({
  obr_id: z.union([z.number(), z.string()]),
  obr_nome: z.string(),
  obr_slug: z.string().optional().nullable(),
  obr_descricao: z.string().optional().nullable(),
  obr_imagem: z.string().optional().nullable(),
  scan_id: z.unknown().optional().nullable(),
  capitulos: z.array(verdinhaChapterSchema).default([]),
}).passthrough();

const verdinhaChapterPagesSchema = z.object({
  cap_paginas: z.array(z.object({
    src: z.string(),
    path: z.string(),
  })).default([]),
}).passthrough();

function buildVerdinhaSearchUrl(query: ProviderSearchInput) {
  const url = new URL("/obras/buscar", VERDINHA_API_BASE);
  url.searchParams.set("q", query.q);
  url.searchParams.set("limite", String(query.limit));
  url.searchParams.set("pagina", String(query.page));
  return url;
}

function buildVerdinhaDetailUrl(idOrSlug: string) {
  return new URL(`/obras/${encodeURIComponent(idOrSlug)}`, VERDINHA_API_BASE);
}

function buildVerdinhaChapterUrl(capId: string) {
  return new URL(`/capitulos/${encodeURIComponent(capId)}`, VERDINHA_API_BASE);
}

function resolveVerdinhaSourceUrl(url: URL) {
  if (url.hostname === "api.verdinha.wtf") {
    return url;
  }

  if (url.pathname.startsWith("/obras/")) {
    return new URL(url.pathname, VERDINHA_API_BASE);
  }

  if (url.hash.startsWith("#/obras/")) {
    return new URL(url.hash.slice(1), VERDINHA_API_BASE);
  }

  return url;
}

function buildVerdinhaCoverUrl(obraId: string, scanId: unknown, imageName: string | null | undefined) {
  const normalizedImageName = imageName?.trim();
  if (!normalizedImageName) {
    return null;
  }

  const normalizedScanId = toOptionalInteger(scanId) ?? 1;
  return `${VERDINHA_API_BASE}/cdn/scans/${normalizedScanId}/obras/${obraId}/${normalizedImageName}?width=400`;
}

function mapVerdinhaSearchResult(obra: z.infer<typeof verdinhaSearchItemSchema>, index: number): UnifiedSearchResult {
  const sourceId = String(obra.obr_id);
  const slug = obra.obr_slug?.trim() || sourceId;
  const title = obra.obr_nome.trim();
  const description = truncateText(obra.obr_descricao, 200);
  const coverUrl = buildVerdinhaCoverUrl(sourceId, obra.scan_id, obra.obr_imagem);

  return {
    title,
    cover_url: coverUrl,
    description,
    score: Math.max(0, 1 - index * 0.01),
    sources: [
      {
        provider_id: "verdinha",
        source_id: sourceId,
        title,
        slug,
        source_url: buildVerdinhaDetailUrl(slug).toString(),
        cover_url: coverUrl,
        total_chapters: toOptionalInteger(obra.total_capitulos),
        description,
      },
    ],
  };
}

function mapVerdinhaPreview(detail: z.infer<typeof verdinhaDetailResponseSchema>, sourceUrl: string): PreviewResponse {
  const sourceId = String(detail.obr_id);
  const coverUrl = buildVerdinhaCoverUrl(sourceId, detail.scan_id, detail.obr_imagem);
  const chapters = detail.capitulos
    .filter((chapter) => chapter.cap_liberado !== false)
    .sort((left, right) => {
      const leftNumber = toOptionalInteger(left.cap_numero) ?? Number.MAX_SAFE_INTEGER;
      const rightNumber = toOptionalInteger(right.cap_numero) ?? Number.MAX_SAFE_INTEGER;
      return leftNumber - rightNumber;
    })
    .map((chapter) => ({
      source_id: String(chapter.cap_id),
      title: chapter.cap_nome.trim(),
      number: toChapterLabel(chapter.cap_numero),
      // Verdinha expõe capítulos no payload de obra, mas não foi evidenciado um endpoint público
      // de detalhe por capítulo. Usamos a URL da obra como fallback de navegação estável.
      source_url: sourceUrl,
    }));

  return {
    provider_id: "verdinha",
    source_id: sourceId,
    title: detail.obr_nome.trim(),
    source_url: sourceUrl,
    cover_url: coverUrl,
    chapters,
  };
}

export const verdinhaAdapter: ProviderAdapter = {
  info: {
    id: "verdinha",
    name: "Verdinha",
    domains: ["verdinha.wtf", "api.verdinha.wtf"],
  } satisfies ProviderInfo,

  canHandleUrl(url: URL) {
    return url.hostname === "verdinha.wtf" || url.hostname === "api.verdinha.wtf";
  },

  async search(input: ProviderSearchInput): Promise<SearchResponse> {
    const response = await fetch(buildVerdinhaSearchUrl(input));
    if (!response.ok) {
      throw new Error(`Verdinha search failed with HTTP ${response.status}`);
    }

    const payload = verdinhaSearchResponseSchema.parse(await response.json());
    return payload.obras.map((obra, index) => mapVerdinhaSearchResult(obra, index));
  },

  async preview(url: URL): Promise<PreviewResponse> {
    const resolvedUrl = resolveVerdinhaSourceUrl(url);
    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      throw new Error(`Verdinha preview failed with HTTP ${response.status}`);
    }

    const payload = verdinhaDetailResponseSchema.parse(await response.json());
    return mapVerdinhaPreview(payload, resolvedUrl.toString());
  },

  async getChapterPages(chapterSourceId: string) {
    // Requires Bearer Token, handled by global fetch interception or AppState in a real scenario
    // For now, assume fetch handles Authorization headers transparently for api.verdinha.wtf if configured
    const response = await fetch(buildVerdinhaChapterUrl(chapterSourceId));
    if (!response.ok) {
      throw new Error(`Verdinha get chapter failed with HTTP ${response.status}`);
    }

    const payload = verdinhaChapterPagesSchema.parse(await response.json());
    return payload.cap_paginas.map((page, index) => ({
      index: index + 1,
      filename: page.src,
      url: `https://cdn.verdinha.wtf/${page.path}`,
    }));
  },
};
