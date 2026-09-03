// Curated font list. System fonts render everywhere; the web fonts are
// pulled in via index.html and must be loaded before an export.

export interface FontOption {
  label: string;
  value: string; // CSS font-family
  web?: boolean;
}

export const FONTS: FontOption[] = [
  { label: "System Sans", value: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Courier", value: "'Courier New', monospace" },
  { label: "Impact", value: "Impact, 'Arial Black', sans-serif" },
  { label: "Oswald", value: "'Oswald', sans-serif", web: true },
  { label: "Bebas Neue", value: "'Bebas Neue', sans-serif", web: true },
  { label: "Montserrat", value: "'Montserrat', sans-serif", web: true },
  { label: "Press Start 2P", value: "'Press Start 2P', monospace", web: true },
  { label: "Rubik Mono", value: "'Rubik Mono One', sans-serif", web: true },
];

export async function ensureFontsLoaded(): Promise<void> {
  try {
    // Nudge the browser to fetch each web face, then wait.
    for (const f of FONTS.filter((x) => x.web)) {
      const fam = f.value.split(",")[0].replace(/['"]/g, "").trim();
      await Promise.allSettled([
        (document as Document).fonts.load(`16px "${fam}"`),
        (document as Document).fonts.load(`bold 16px "${fam}"`),
      ]);
    }
    await (document as Document).fonts.ready;
  } catch {
    /* fonts API unavailable — carry on */
  }
}
