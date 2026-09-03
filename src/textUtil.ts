import type { TextLayer } from "./types";

export function fontStyleString(l: Pick<TextLayer, "bold" | "italic">): string {
  const parts: string[] = [];
  if (l.italic) parts.push("italic");
  if (l.bold) parts.push("bold");
  return parts.join(" ") || "normal";
}
