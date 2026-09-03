// Neutral, generic console-themed placeholder marks. No real brands.
// Each is a self-contained SVG encoded as a data URI so it drops straight
// into an image layer. Swap these for your own artwork any time.

export interface LogoPreset {
  id: string;
  label: string;
  svg: string;
}

const wrap = (inner: string, vb = "0 0 240 120") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;

export const LOGO_PRESETS: LogoPreset[] = [
  {
    id: "gamepad",
    label: "Gamepad",
    svg: wrap(`
      <g fill="none" stroke="#f4f4f5" stroke-width="8" stroke-linejoin="round">
        <path d="M70 40h100c26 0 44 20 48 44 4 22-10 40-30 40-14 0-22-10-30-18H82c-8 8-16 18-30 18-20 0-34-18-30-40 4-24 22-44 48-44Z"/>
        <path d="M64 74h28M78 60v28" stroke-linecap="round"/>
      </g>
      <circle cx="168" cy="66" r="7" fill="#f4f4f5"/>
      <circle cx="186" cy="84" r="7" fill="#f4f4f5"/>`),
  },
  {
    id: "cube",
    label: "Cube console",
    svg: wrap(`
      <g fill="none" stroke="#f4f4f5" stroke-width="8" stroke-linejoin="round">
        <path d="M120 18 208 60v0L120 102 32 60Z"/>
        <path d="M120 102V60M120 60 208 18M120 60 32 18"/>
      </g>`),
  },
  {
    id: "handheld",
    label: "Handheld",
    svg: wrap(`
      <g fill="none" stroke="#f4f4f5" stroke-width="8" stroke-linejoin="round">
        <rect x="60" y="16" width="120" height="88" rx="16"/>
        <rect x="82" y="34" width="76" height="40" rx="4"/>
        <circle cx="78" cy="90" r="6" fill="#f4f4f5"/>
        <circle cx="162" cy="90" r="6" fill="#f4f4f5"/>
      </g>`),
  },
  {
    id: "disc",
    label: "Disc",
    svg: wrap(`
      <g fill="none" stroke="#f4f4f5" stroke-width="8">
        <circle cx="120" cy="60" r="44"/>
        <circle cx="120" cy="60" r="12"/>
        <path d="M120 16a44 44 0 0 1 38 22" stroke-linecap="round"/>
      </g>`),
  },
  {
    id: "power",
    label: "Power",
    svg: wrap(`
      <g fill="none" stroke="#f4f4f5" stroke-width="10" stroke-linecap="round">
        <path d="M120 26v34"/>
        <path d="M92 42a40 40 0 1 0 56 0"/>
      </g>`),
  },
  {
    id: "pixel-heart",
    label: "Pixel heart",
    svg: wrap(`
      <g fill="#f4f4f5">
        <rect x="84" y="34" width="16" height="16"/><rect x="100" y="34" width="16" height="16"/>
        <rect x="140" y="34" width="16" height="16"/><rect x="156" y="34" width="16" height="16"/>
        <rect x="68" y="50" width="16" height="16"/><rect x="172" y="50" width="16" height="16"/>
        <rect x="84" y="50" width="88" height="16"/>
        <rect x="84" y="66" width="88" height="16"/>
        <rect x="100" y="82" width="56" height="16"/>
        <rect x="116" y="98" width="24" height="16"/>
      </g>`),
  },
];

export function logoDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}
