import type { PreviewResponse, ProviderInfo, SearchResponse } from "@capdown/contracts";

export type ProviderSearchInput = {
  q: string;
  limit: number;
  page: number;
  deep: boolean;
};

export interface ProviderAdapter {
  info: ProviderInfo;
  canHandleUrl(url: URL): boolean;
  search(input: ProviderSearchInput): Promise<SearchResponse>;
  preview(url: URL): Promise<PreviewResponse>;
  getChapterPages?(chapterSourceId: string): Promise<Array<{ url: string; index: number; filename: string }>>;
}
