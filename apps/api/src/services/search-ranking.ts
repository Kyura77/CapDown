import type { SearchResponse, UnifiedSearchResult } from "@capdown/contracts";

const STOPWORDS = new Set([
  "a",
  "as",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "the",
]);

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function candidateTexts(result: UnifiedSearchResult) {
  const texts: Array<string | undefined | null> = [result.title, result.description];

  for (const source of result.sources) {
    texts.push(source.title, source.slug, source.description ?? undefined);
  }

  return texts.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function scoreTextMatch(query: string, candidate: string) {
  const normalizedQuery = normalizeText(query);
  const normalizedCandidate = normalizeText(candidate);

  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }

  let score = 0;

  if (normalizedCandidate === normalizedQuery) {
    score += 100;
  } else if (normalizedCandidate.includes(normalizedQuery)) {
    score += 70;
  } else if (normalizedQuery.includes(normalizedCandidate) && normalizedCandidate.length >= 3) {
    score += 40;
  }

  const queryTokens = tokenizeQuery(query);
  if (queryTokens.length > 0) {
    const matchedTokens = queryTokens.filter((token) => normalizedCandidate.includes(token));
    const coverage = matchedTokens.length / queryTokens.length;
    score += coverage * 50;

    if (matchedTokens.length === queryTokens.length) {
      score += 20;
    }
  }

  if (normalizedCandidate.startsWith(normalizedQuery)) {
    score += 10;
  }

  score += Math.max(0, 10 - Math.abs(normalizedCandidate.length - normalizedQuery.length) * 0.15);

  return score;
}

export function scoreSearchResult(query: string, result: UnifiedSearchResult) {
  const textScores = candidateTexts(result).map((candidate) => scoreTextMatch(query, candidate));
  const bestTextScore = textScores.length > 0 ? Math.max(...textScores) : 0;

  return bestTextScore + result.score * 0.05;
}

export function dedupeSearchResults(results: SearchResponse): SearchResponse {
  const seen = new Map<string, UnifiedSearchResult>();

  for (const result of results) {
    const key = result.sources
      .map((source) => `${source.provider_id}:${source.source_id}`)
      .sort()
      .join("|") || result.title;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, result);
      continue;
    }

    const nextSources = [...existing.sources];
    for (const source of result.sources) {
      if (!nextSources.some((current) => current.provider_id === source.provider_id && current.source_id === source.source_id)) {
        nextSources.push(source);
      }
    }

    seen.set(key, {
      ...existing,
      cover_url: existing.cover_url ?? result.cover_url,
      description: existing.description ?? result.description,
      sources: nextSources,
      score: Math.max(existing.score, result.score),
    });
  }

  return Array.from(seen.values());
}

export function rankSearchResults(query: string, results: SearchResponse): SearchResponse {
  return [...results]
    .map((result) => ({
      ...result,
      score: scoreSearchResult(query, result),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftProvider = left.sources[0]?.provider_id ?? "";
      const rightProvider = right.sources[0]?.provider_id ?? "";
      return leftProvider.localeCompare(rightProvider);
    });
}
