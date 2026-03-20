const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export type ParsedImageLink = {
  title: string | null;
  url: string;
};

function normalizeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  const parsed = new URL(trimmed);
  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new Error("Only http and https links are allowed.");
  }
  return parsed.toString();
}

function parseLine(line: string): ParsedImageLink {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new Error("Empty line.");
  }

  const urlMatch = trimmed.match(/https?:\/\/\S+/i);
  if (!urlMatch) {
    throw new Error("Missing URL.");
  }

  const rawUrl = urlMatch[0];
  const url = normalizeUrl(rawUrl);
  const beforeUrl = trimmed.slice(0, urlMatch.index ?? 0).trim();
  const title = beforeUrl.replace(/[:\-|]+$/g, "").trim();

  return {
    title: title || null,
    url,
  };
}

export function parseImageLinks(
  value: string | null | undefined,
  options?: { strict?: boolean },
): ParsedImageLink[] {
  if (!value?.trim()) return [];

  const strict = options?.strict ?? false;
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (strict) {
    return lines.map(parseLine);
  }

  return lines.flatMap((line) => {
    try {
      return [parseLine(line)];
    } catch {
      return [];
    }
  });
}

export function normalizeImageLinkInput(value: string | null | undefined): string | null {
  const parsed = parseImageLinks(value, { strict: true });
  if (!parsed.length) return null;

  return parsed
    .map((entry) => (entry.title ? `${entry.title}: ${entry.url}` : entry.url))
    .join("\n");
}
