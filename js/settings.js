import { buildCode, getTodayInfo } from "./core.js";
import { DEFAULT_SETTINGS } from "./storage.js";
import { loadState, saveState } from "../pwa/store.js";
import { readPrintDefaults, savePrintDefaults } from "./config.js";

const $ = (id) => document.getElementById(id);
const today = getTodayInfo();

const elements = {
  autoFillDay: $("auto-fill-day"),
  autoFillYear: $("auto-fill-year"),
  codePreview: $("code-preview"),
  previewNote: $("preview-note"),
  labelWidth: $("label-width"),
  labelCopies: $("label-copies"),
  printPaper: $("print-paper"),
  printOrientation: $("print-orientation"),
  printMargin: $("print-margin"),
  printGap: $("print-gap"),
  printMode: $("print-mode"),
  printText: $("print-text"),
  historyLimit: $("history-limit"),
  historyInfo: $("history-info"),
  clearHistory: $("clear-history"),
  status: $("status"),
  save: $("save"),
  reset: $("reset"),
};

const clampInt = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

const clampNum = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

let state = await loadState();
let printDefaults = readPrintDefaults();

function setStatus(message, error = false) {
  elements.status.textContent = message;
  elements.status.className = error ? "pill error" : "pill";
}

function renderPreview() {
  const options = { autoDay: elements.autoFillDay.checked, autoYear: elements.autoFillYear.checked };
  const code = buildCode("12472A", today.date, options);
  elements.codePreview.textContent = code;
  const parts = ["verze"];
  if (options.autoDay) parts.push("den v roce");
  if (options.autoYear) parts.push("rok");
  elements.previewNote.textContent = parts.join(" + ");
}

function renderHistoryInfo() {
  const count = Array.isArray(state.history) ? state.history.length : 0;
  const limit = clampInt(state.settings.historyLimit, 1, 500, DEFAULT_SETTINGS.historyLimit);
  elements.historyInfo.textContent = count
    ? `Uloženo ${count} z maximálně ${limit} záznamů.`
    : "Zatím žádná historie.";
}

function populate() {
  elements.autoFillDay.checked = state.settings.autoFillDay !== false;
  elements.autoFillYear.checked = state.settings.autoFillYear !== false;
  elements.labelWidth.value = String(state.settings.labelWidthMm ?? DEFAULT_SETTINGS.labelWidthMm);
  elements.labelCopies.value = String(state.settings.labelCopies ?? DEFAULT_SETTINGS.labelCopies);
  elements.historyLimit.value = String(state.settings.historyLimit ?? DEFAULT_SETTINGS.historyLimit);

  elements.printPaper.value = ["a4", "a5", "a6", "letter"].includes(printDefaults.paperId) ? printDefaults.paperId : "a4";
  elements.printOrientation.value = printDefaults.orientation === "landscape" ? "landscape" : "portrait";
  elements.printMargin.value = String(clampNum(printDefaults.pageMarginMm, 0, 50, 10));
  elements.printGap.value = String(clampNum(printDefaults.labelGapMm, 0, 50, 0));
  elements.printMode.value = ["auto", "paper", "label"].includes(printDefaults.printMode) ? printDefaults.printMode : "auto";
  elements.printText.checked = printDefaults.showText !== false;

  renderPreview();
  renderHistoryInfo();
}

function collectPrintDefaults() {
  return {
    widthMm: clampNum(elements.labelWidth.value, 20, 200, DEFAULT_SETTINGS.labelWidthMm),
    copies: clampInt(elements.labelCopies.value, 1, 200, DEFAULT_SETTINGS.labelCopies),
    paperId: elements.printPaper.value,
    orientation: elements.printOrientation.value,
    pageMarginMm: clampNum(elements.printMargin.value, 0, 50, 10),
    labelGapMm: clampNum(elements.printGap.value, 0, 50, 0),
    printMode: elements.printMode.value,
    showText: elements.printText.checked,
  };
}

async function save() {
  const print = collectPrintDefaults();
  state.settings.autoFillDay = elements.autoFillDay.checked;
  state.settings.autoFillYear = elements.autoFillYear.checked;
  state.settings.labelWidthMm = print.widthMm;
  state.settings.labelCopies = print.copies;
  state.settings.historyLimit = clampInt(elements.historyLimit.value, 10, 500, DEFAULT_SETTINGS.historyLimit);

  try {
    await saveState(state);
  } catch (error) {
    setStatus("Uložení se nepodařilo. Zkus stránku otevřít z rozšíření.", true);
    return;
  }

  printDefaults = print;
  const stored = savePrintDefaults(print);
  populate();
  setStatus(stored ? "Nastavení uloženo." : "Nastavení uloženo, výchozí tisk se ale nepodařilo zapsat.", !stored);
}

elements.save.addEventListener("click", save);

elements.reset.addEventListener("click", async () => {
  if (!window.confirm("Obnovit výchozí nastavení? Historie kódů zůstane zachována.")) return;
  state.settings = { ...state.settings, ...DEFAULT_SETTINGS };
  await saveState(state).catch(() => setStatus("Obnovení se nepodařilo uložit.", true));
  printDefaults = {
    widthMm: DEFAULT_SETTINGS.labelWidthMm,
    copies: DEFAULT_SETTINGS.labelCopies,
    paperId: "a4",
    orientation: "portrait",
    pageMarginMm: 10,
    labelGapMm: 0,
    printMode: "auto",
    showText: true,
  };
  savePrintDefaults(printDefaults);
  populate();
  setStatus("Výchozí nastavení obnoveno.");
});

elements.clearHistory.addEventListener("click", async () => {
  if (!window.confirm("Opravdu vymazat celou historii kódů?")) return;
  state.history = [];
  try {
    await saveState(state);
    renderHistoryInfo();
    setStatus("Historie byla vymazána.");
  } catch (error) {
    setStatus("Historii se nepodařilo vymazat.", true);
  }
});

for (const input of [elements.autoFillDay, elements.autoFillYear]) {
  input.addEventListener("change", renderPreview);
}

populate();
