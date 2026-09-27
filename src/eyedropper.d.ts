// The EyeDropper API — lets the user sample a colour from anywhere on
// screen, not just the page. Chromium-only; ColorField feature-detects
// before use.

interface EyeDropperOpenOptions {
  signal?: AbortSignal;
}

interface EyeDropperOpenResult {
  sRGBHex: string;
}

interface EyeDropper {
  open(options?: EyeDropperOpenOptions): Promise<EyeDropperOpenResult>;
}

interface Window {
  EyeDropper?: { new (): EyeDropper };
}
