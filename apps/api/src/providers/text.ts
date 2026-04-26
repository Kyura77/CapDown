export function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

export function truncateText(value: string | null | undefined, maxLength = 200): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function pickLocalizedText(
  value: Record<string, unknown> | null | undefined,
  preferredLocales: string[] = ["en", "pt-br", "pt"],
): string | null {
  if (!value) {
    return null;
  }

  for (const locale of preferredLocales) {
    const candidate = value[locale];
    const normalized = normalizeText(typeof candidate === "string" ? candidate : null);
    if (normalized) {
      return normalized;
    }
  }

  for (const candidate of Object.values(value)) {
    const normalized = normalizeText(typeof candidate === "string" ? candidate : null);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function toOptionalInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

export function toChapterLabel(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}
