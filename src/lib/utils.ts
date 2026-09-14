import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Parses a number typed with either "," or "." as the decimal separator —
// and, being a plain string parse, works with a type="text" input instead
// of type="number", which some Windows/locale combinations stop accepting
// keystrokes in entirely inside the packaged Electron app.
export function parseLocaleNumber(s: string): number | undefined {
  const v = Number(s.trim().replace(",", "."));
  return Number.isFinite(v) ? v : undefined;
}
