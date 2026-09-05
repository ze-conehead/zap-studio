// Tiny i18n layer. English is the source language (keys are the English
// strings themselves), German is a lookup table. Language choice lives in
// localStorage and is exposed through a useSyncExternalStore pub/sub so any
// component re-renders when it changes.

import { useSyncExternalStore } from "react";
import { de } from "./locale/de";

export type Lang = "en" | "de";

const KEY = "stickerstudio:lang";
const listeners = new Set<() => void>();

function load(): Lang {
  try {
    return localStorage.getItem(KEY) === "de" ? "de" : "en";
  } catch {
    return "en";
  }
}

let lang: Lang = load();
syncDocumentLang();

function syncDocumentLang() {
  try {
    document.documentElement.lang = lang;
  } catch {
    /* no document (tests) */
  }
}

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable */
  }
  syncDocumentLang();
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

type Vars = Record<string, string | number>;

// Translate `key` (an English string) into the active language, filling in
// {placeholder} tokens from `vars`. Unknown keys fall back to the key, so a
// missing German entry still shows readable English.
export function t(key: string, vars?: Vars): string {
  let s = lang === "de" ? de[key] ?? key : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

// Hook form: subscribes the caller so it re-renders on a language switch.
export function useT(): typeof t {
  useSyncExternalStore(subscribe, getLang, getLang);
  return t;
}

export function useLang(): [Lang, (l: Lang) => void] {
  const current = useSyncExternalStore(subscribe, getLang, getLang);
  return [current, setLang];
}
