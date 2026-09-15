// Shared test environment: a fresh IndexedDB + localStorage per test file.
import "fake-indexeddb/auto";
import { beforeEach } from "vitest";

beforeEach(() => {
  localStorage.clear();
});
