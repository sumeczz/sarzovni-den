import test from "node:test";
import assert from "node:assert/strict";

import {
  addEntries,
  addEntry,
  clearAll,
  emptyState,
  loadState,
  normalizeState,
  removeEntry,
  saveState,
  searchHistory,
  STORAGE_KEY,
} from "../js/storage.js";

const entry = (overrides = {}) => ({
  code: "12472A2736",
  version: "12472A",
  dayOfYear: 273,
  year: 2026,
  createdAt: 1_760_000_000_000,
  ...overrides,
});

test("prázdný stav má prázdnou historii", () => {
  const state = emptyState();
  assert.deepEqual(state.history, []);
  assert.equal(state.lastVersion, "");
  assert.equal(state.settings.historyLimit, 50);
});

test("poškozená data se převedou na použitelný stav", () => {
  const state = normalizeState({ lastVersion: 123, history: "nonsense", products: [{ name: "A" }] });
  assert.equal(state.lastVersion, "123");
  assert.deepEqual(state.history, []);
  assert.equal(state.settings.historyLimit, 50);
  assert.equal("products" in state, false, "zbytečné údaje se do stavu nedostanou");

  const cleaned = normalizeState({ history: [{ code: "A1", version: "1", product: "stará položka", extra: 1 }] });
  assert.deepEqual(cleaned.history[0], { code: "A1", version: "1", dayOfYear: null, year: null, createdAt: 0 });
  assert.equal("product" in cleaned.history[0], false, "pole z předchozí verze se uklidí");
});

test("pole batch se nepletne s verzí", () => {
  // "batch" je v SAPu jiný údaj (dávka), nesmí se číst jako verze
  const state = normalizeState({
    lastBatch: "1842523",
    history: [{ code: "1852A2566273", batch: "1842523", version: "1852A2566", dayOfYear: 273, year: 2026, createdAt: 1_760_000_000_000 }],
  });

  assert.equal(state.lastVersion, "", "cizí pole lastBatch se nečte jako verze");
  assert.equal(state.lastBatch, undefined, "cizí klíč se nepropírá dál");
  assert.equal(state.history[0].version, "1852A2566");
  assert.equal(state.history[0].batch, undefined, "batch se nepropírá do záznamu");
});

test("záznam se uloží a zapíše jako poslední", () => {
  const state = addEntry(emptyState(), entry());
  assert.equal(state.history.length, 1);
  assert.equal(state.lastVersion, "12472A");
  assert.deepEqual(state.history[0], entry());
});

test("historie má nejvýše nastavený limit záznamů", () => {
  let state = emptyState();
  for (let i = 0; i < 60; i++) {
    state = addEntry(state, entry({ code: `CODE${i}`, version: `V${i}` }), { historyLimit: 50 });
  }
  assert.equal(state.history.length, 50);
  assert.equal(state.history[0].code, "CODE59", "nejnovější záznam nahoře");
  assert.equal(state.history.at(-1).code, "CODE10", "nejstarší záznam se ořízl");
});

test("stejný kód se neuloží dvakrát, jen se posune nahoru", () => {
  let state = addEntry(emptyState(), entry({ code: "A1" }));
  state = addEntry(state, entry({ code: "B2" }));
  const again = addEntry(state, entry({ code: "A1", createdAt: 1_800_000_000_000 }));

  assert.equal(again.history.length, 2);
  assert.equal(again.history[0].code, "A1");
  assert.equal(again.history[0].createdAt, 1_800_000_000_000, "čas se aktualizoval");
});

test("uložení více kódů najednou", () => {
  const entries = [
    { code: "12472A2736", version: "12472A", dayOfYear: 273, year: 2026 },
    { code: "12472B2736", version: "12472B", dayOfYear: 273, year: 2026 },
    { code: "90011C2736", version: "90011C", dayOfYear: 273, year: 2026 },
  ];
  const state = addEntries(emptyState(), entries);

  assert.equal(state.history.length, 3);
  assert.equal(state.history[0].code, "90011C2736", "poslední přidaný je nahoře");
  assert.equal(state.lastVersion, "90011C");
  assert.deepEqual(
    state.history.map((item) => item.dayOfYear),
    [273, 273, 273],
  );
  assert.ok(state.history.every((item) => item.year === 2026));
  assert.deepEqual(addEntries(emptyState(), []), emptyState());
});

test("uložení více kódů se řídí limitem historie", () => {
  const many = Array.from({ length: 5 }, (_, index) => ({ code: `CODE${index}`, version: `V${index}` }));
  const state = addEntries(emptyState(), many, { historyLimit: 3 });
  assert.equal(state.history.length, 3);
  assert.equal(state.history[0].code, "CODE4");
});

test("smazání jednoho záznamu nechá ostatní", () => {
  const state = addEntries(emptyState(), [
    { code: "A", version: "1" },
    { code: "B", version: "2" },
  ]);
  const after = removeEntry(state, "A");
  assert.equal(after.history.length, 1);
  assert.equal(after.history[0].code, "B");
  assert.equal(after.lastVersion, "2", "poslední uložená verze zůstává");
});

test("vymazání všeho vyprázdní stav", () => {
  const state = addEntry(emptyState(), entry());
  assert.equal(state.history.length, 1);
  assert.deepEqual(clearAll(), emptyState());
});

test("hledání v historii funguje bez rozlišování velikosti písmen a háčků", () => {
  let state = addEntries(emptyState(), [
    { code: "12472A2736", version: "12472A" },
    { code: "90011C2736", version: "90011C" },
  ]);

  assert.equal(searchHistory(state, "").length, 2);
  assert.equal(searchHistory(state, "12472a").length, 1);
  assert.equal(searchHistory(state, "  12472A  ").length, 1);
  assert.equal(searchHistory(state, "90011C").length, 1);
  assert.equal(searchHistory(state, "2736").length, 2);
  assert.equal(searchHistory(state, "nesmysl").length, 0);
});

test("uložený stav jde přečíst a zapsat přes chrome.storage.local", async () => {
  const store = new Map();
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          return store.has(key) ? { [key]: structuredClone(store.get(key)) } : {};
        },
        async set(values) {
          for (const [key, value] of Object.entries(values)) store.set(key, structuredClone(value));
        },
      },
    },
  };

  const state = addEntry(emptyState(), entry());
  await saveState(state);
  const loaded = await loadState();

  assert.deepEqual(loaded.history, state.history);
  assert.equal(loaded.lastVersion, "12472A");
  assert.ok(store.has(STORAGE_KEY));

  delete globalThis.chrome;
  await assert.rejects(() => loadState(), /chrome\.storage\.local/);
});
