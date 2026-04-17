export type ParsedTaskBlock = {
  section: string;
  description: string;
  titleLinks: string[];
  imageLinks: string[];
};

export function splitTaskBlocks(notes?: string | null) {
  return String(notes ?? "")
    .trim()
    // Store tasks as blocks separated by blank lines.
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function parseTaskBlock(
  block: string,
  options?: { ensureNonEmptyArrays?: boolean },
): ParsedTaskBlock {
  const ensureNonEmptyArrays = options?.ensureNonEmptyArrays ?? true;
  const lines = String(block ?? "")
    .split("\n")
    .map((l) => l.trimEnd());

  const findLineIndex = (exact: string) =>
    lines.findIndex((line) => line.trim().toLowerCase() === exact.toLowerCase());

  const descIndex = findLineIndex("Description:");
  const titleIndex = findLineIndex("Title: Link");
  const imageIndex = findLineIndex("Title: Image Link");

  const sectionLine = lines.find((l) => l.trimStart().toLowerCase().startsWith("section:"));
  const hasStructuredMarkers = Boolean(sectionLine) || descIndex !== -1 || titleIndex !== -1 || imageIndex !== -1;

  if (!hasStructuredMarkers) {
    const compact = String(block ?? "").trim();
    const nonEmptyLines = compact.split("\n").map((l) => l.trim()).filter(Boolean);
    const firstLine = nonEmptyLines[0] ?? "";
    const legacySection = firstLine.replace(/^\s*\d+\s*[\).\-\:]\s*/i, "").trim();
    return {
      section: legacySection,
      description: compact,
      titleLinks: ensureNonEmptyArrays ? [""] : [],
      imageLinks: ensureNonEmptyArrays ? [""] : [],
    };
  }

  const section = sectionLine ? sectionLine.split(":").slice(1).join(":").trim() : "";

  let description = "";
  if (descIndex !== -1) {
    const endIndex =
      titleIndex !== -1
        ? titleIndex
        : imageIndex !== -1
          ? imageIndex
          : undefined;
    description = lines.slice(descIndex + 1, endIndex).join("\n").trim();
  } else if (sectionLine) {
    const sectionLineIndex = lines.indexOf(sectionLine);
    const startIndex = sectionLineIndex !== -1 ? sectionLineIndex + 1 : 0;
    const endIndex =
      titleIndex !== -1
        ? titleIndex
        : imageIndex !== -1
          ? imageIndex
          : undefined;
    description = lines.slice(startIndex, endIndex).join("\n").trim();
  }

  const titleLinks =
    titleIndex !== -1
      ? lines
          .slice(titleIndex + 1, imageIndex !== -1 ? imageIndex : undefined)
          .map((l) => l.trim())
          .filter(Boolean)
      : [];

  const imageLinks =
    imageIndex !== -1
      ? lines
          .slice(imageIndex + 1)
          .map((l) => l.trim())
          .filter(Boolean)
      : [];

  return {
    section,
    description,
    titleLinks: ensureNonEmptyArrays ? (titleLinks.length ? titleLinks : [""]) : titleLinks,
    imageLinks: ensureNonEmptyArrays ? (imageLinks.length ? imageLinks : [""]) : imageLinks,
  };
}
