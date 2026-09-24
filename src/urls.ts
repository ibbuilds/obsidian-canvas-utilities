type HttpUrlExtraction = {
  validCount: number;
  urls: string[];
};

export type ExcalidrawUrlExtraction = {
  recognized: boolean;
  urls: string[];
};

function normalizeHttpUrl(candidate: string): string | null {
  const cleaned = candidate.replace(/[),.;]+$/g, "");

  try {
    const url = new URL(cleaned);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export function extractHttpUrls(text: string): HttpUrlExtraction {
  const matches = text.match(/https?:\/\/[^\s]+/gi) ?? [];
  const urls = new Set<string>();
  let validCount = 0;

  for (const match of matches) {
    const url = normalizeHttpUrl(match);

    if (!url) {
      continue;
    }

    validCount += 1;
    urls.add(url);
  }

  return {
    validCount,
    urls: [...urls],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractExcalidrawEmbedUrls(
  text: string,
): ExcalidrawUrlExtraction {
  let clipboard: unknown;

  try {
    clipboard = JSON.parse(text);
  } catch {
    return { recognized: false, urls: [] };
  }

  if (
    !isRecord(clipboard) ||
    clipboard.type !== "excalidraw/clipboard" ||
    !Array.isArray(clipboard.elements)
  ) {
    return { recognized: false, urls: [] };
  }

  const urls = new Set<string>();

  for (const element of clipboard.elements) {
    if (
      !isRecord(element) ||
      element.type !== "embeddable" ||
      typeof element.link !== "string"
    ) {
      continue;
    }

    const url = normalizeHttpUrl(element.link);

    if (url) {
      urls.add(url);
    }
  }

  return { recognized: true, urls: [...urls] };
}
