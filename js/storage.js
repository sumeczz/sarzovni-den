/**
 * Čisté funkce nad historií sdílí rozšíření i PWA.
 * Ukládání extension modulu zůstává chrome.storage.local; webová stránka má
 * samostatný localStorage adaptér v pwa/store.js a používá jej pro GitHub Pages.
 */
const STORAGE_KEY = "sklad";
const HISTORY_LIMIT = 50;

export const DEFAULT_SETTINGS = {
  historyLimit: HISTORY_LIMIT,
  labelWidthMm: 60,
  labelCopies: 1,
  autoFillDay: true,
  autoFillYear: true,
};

const clampInt = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};
const clampNum = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export const emptyState = () => ({
  lastVersion: "",
  history: [],
  settings: { ...DEFAULT_SETTINGS },
});

function normalizeSettings(raw) {
  const merged = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  return {
    ...merged,
    historyLimit: clampInt(merged.historyLimit, 1, 500, DEFAULT_SETTINGS.historyLimit),
    labelWidthMm: clampNum(merged.labelWidthMm, 20, 200, DEFAULT_SETTINGS.labelWidthMm),
    labelCopies: clampInt(merged.labelCopies, 1, 200, DEFAULT_SETTINGS.labelCopies),
    autoFillDay: merged.autoFillDay !== false,
    autoFillYear: merged.autoFillYear !== false,
  };
}
function toRecord(entry) {
  return {
    code: String(entry.code),
    version: String(entry.version ?? ""),
    dayOfYear: entry.dayOfYear ?? null,
    year: entry.year ?? null,
    createdAt: entry.createdAt ?? 0,
  };
}
export function normalizeState(raw) {
  const source = raw ?? {};
  return {
    lastVersion: String(source.lastVersion ?? ""),
    history: Array.isArray(source.history) ? source.history.filter((entry) => entry?.code).map(toRecord) : [],
    settings: normalizeSettings(source.settings),
  };
}
export function addEntry(state, entry, { historyLimit = state.settings?.historyLimit ?? HISTORY_LIMIT } = {}) {
  const next = normalizeState(state);
  const record = toRecord({ ...entry, createdAt: entry.createdAt ?? Date.now() });
  next.history = next.history.filter((item) => item.code !== record.code);
  next.history.unshift(record);
  next.history = next.history.slice(0, Math.max(0, historyLimit));
  if (record.version) next.lastVersion = record.version;
  return next;
}
export function addEntries(state, entries, { historyLimit } = {}) {
  let next = normalizeState(state);
  for (const entry of entries) next = addEntry(next, entry, { historyLimit });
  return next;
}
export function removeEntry(state, code) {
  const next = normalizeState(state);
  next.history = next.history.filter((entry) => entry.code !== code);
  return next;
}
export function clearAll() {
  return emptyState();
}
export function searchHistory(state, query) {
  const needle = String(query ?? "").trim().toLocaleLowerCase("cs");
  if (!needle) return normalizeState(state).history;
  return normalizeState(state).history.filter((entry) =>
    [entry.code, entry.version].some((field) => String(field ?? "").toLocaleLowerCase("cs").includes(needle)),
  );
}
function storage() {
  const area = globalThis.chrome?.storage?.local;
  if (!area) throw new Error("chrome.storage.local není dostupné.");
  return area;
}
export async function loadState() {
  const stored = await storage().get(STORAGE_KEY);
  return normalizeState(stored[STORAGE_KEY]);
}
export async function saveState(state) {
  await storage().set({ [STORAGE_KEY]: normalizeState(state) });
}
export { HISTORY_LIMIT, STORAGE_KEY };
