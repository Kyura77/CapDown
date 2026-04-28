import type { PreviewResponse, ProviderInfo, SearchResponse } from "@capdown/contracts";
import type { ProviderAdapter, ProviderSearchInput } from "./types.js";
import { fetchWithTimeout } from "../utils/http.js";

// Python Scraper Service URL
const PYTHON_SCRAPER_URL = process.env.CAPDOWN_SCRAPER_URL ?? "http://127.0.0.1:4541";

export const egoToonsAdapter: ProviderAdapter = {
  info: {
    id: "ego_toons",
    name: "Ego Toons",
    domains: ["egotoons.com"],
    status: "enabled",
  } satisfies ProviderInfo,

  canHandleUrl(url: URL) {
    return url.hostname === "egotoons.com" || url.hostname.endsWith(".egotoons.com");
  },

  async search(input: ProviderSearchInput): Promise<SearchResponse> {
    const response = await fetchWithTimeout(`${PYTHON_SCRAPER_URL}/api/scrape/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider_id: "ego_toons",
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
        provider_id: "ego_toons",
        url: url.toString(),
      }),
      timeoutMs: 15000,
    });
    
    if (!response.ok) {
      throw new Error(`Python Scraper preview failed with HTTP ${response.status}`);
    }

    return await response.json();
  },

  async getChapterPages(chapterSourceId: string, chapterUrl?: string) {
    const response = await fetchWithTimeout(`${PYTHON_SCRAPER_URL}/api/scrape/chapter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider_id: "ego_toons",
        source_id: chapterSourceId,
        source_url: chapterUrl, // Pass the chapter_url if we have it
      }),
      timeoutMs: 15000,
    });
    
    if (!response.ok) {
      throw new Error(`Python Scraper get chapter failed with HTTP ${response.status}`);
    }

    return await response.json();
  },
};
