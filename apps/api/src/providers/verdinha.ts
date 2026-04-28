import type { PreviewResponse, ProviderInfo, SearchResponse } from "@capdown/contracts";
import type { ProviderAdapter, ProviderSearchInput } from "./types.js";
import { fetchWithTimeout } from "../utils/http.js";

// Python Scraper Service URL
const PYTHON_SCRAPER_URL = process.env.CAPDOWN_SCRAPER_URL ?? "http://127.0.0.1:4541";

export const verdinhaAdapter: ProviderAdapter = {
  info: {
    id: "verdinha",
    name: "Verdinha WTF",
    domains: ["verdinha.wtf", "cdn.verdinha.wtf"],
    status: "enabled",
  } satisfies ProviderInfo,

  canHandleUrl(url: URL) {
    return url.hostname === "verdinha.wtf" || url.hostname === "api.verdinha.wtf";
  },

  async search(input: ProviderSearchInput): Promise<SearchResponse> {
    const response = await fetchWithTimeout(`${PYTHON_SCRAPER_URL}/api/scrape/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider_id: "verdinha",
        q: input.q,
        limit: input.limit ?? 20,
        page: input.page ?? 1,
        deep: input.deep ?? false
      }),
      timeoutMs: 15000,
    });
    
    if (!response.ok) {
      throw new Error(`Python Scraper search failed with HTTP ${response.status}`);
    }

    return await response.json();
  },

  async preview(url: URL): Promise<PreviewResponse> {
    const response = await fetchWithTimeout(`${PYTHON_SCRAPER_URL}/api/scrape/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider_id: "verdinha",
        url: url.toString(),
      }),
      timeoutMs: 15000,
    });
    
    if (!response.ok) {
      throw new Error(`Python Scraper preview failed with HTTP ${response.status}`);
    }

    return await response.json();
  },

  async getChapterPages(chapterSourceId: string) {
    const response = await fetchWithTimeout(`${PYTHON_SCRAPER_URL}/api/scrape/chapter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider_id: "verdinha",
        source_id: chapterSourceId,
      }),
      timeoutMs: 15000,
    });
    
    if (!response.ok) {
      throw new Error(`Python Scraper get chapter failed with HTTP ${response.status}`);
    }

    return await response.json();
  },
};
