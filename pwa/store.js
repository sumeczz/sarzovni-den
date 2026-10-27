/**
 * Persistentní úložiště pro webovou PWA a bridge pro stránku Settings.
 * Při běhu uvnitř rozšíření má přednost chrome.storage.local, na GitHub Pages
 * se použije localStorage. Samotná PWA hlavní obrazovka používá synchronní webový režim.
 */
import { STORAGE_KEY, normalizeState, emptyState, addEntry, addEntries, removeEntry, clearAll, searchHistory } from "../js/storage.js";

function area() {
  try {
    const store = globalThis.localStorage;
    if (!store) return null;
    const probe = "__sklad_probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch (error) {
    console.warn("localStorage není dostupné, historie se neukládá.", error);
    return null;
  }
}
export async function loadState() {
  const extension = globalThis.chrome?.storage?.local;
  if (extension) {
    const stored = await extension.get(STORAGE_KEY);
    return normalizeState(stored[STORAGE_KEY]);
  }
  const store = area();
  if (!store) return normalizeState(null);
  try {
    return normalizeState(JSON.parse(store.getItem(STORAGE_KEY)));
  } catch (error) {
    console.warn("Uložený stav se nepodařilo přečíst, začíná se prázdný.", error);
    return normalizeState(null);
  }
}
export async function saveState(state) {
  const extension = globalThis.chrome?.storage?.local;
  if (extension) {
    await extension.set({ [STORAGE_KEY]: normalizeState(state) });
    return true;
  }
  const store = area();
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
    return true;
  } catch (error) {
    console.warn("Stav se nepodařilo uložit.", error);
    return false;
  }
}
export { STORAGE_KEY, normalizeState, emptyState, addEntry, addEntries, removeEntry, clearAll, searchHistory };
