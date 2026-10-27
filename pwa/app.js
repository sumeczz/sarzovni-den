/**
 * Prohlížečová verze (PWA) pro telefon.
 *
 * Logika se znovu používá z rozšíření – `../js/core.js` (den v roce, sestavení
 * kódu, validace verze), `../js/code128.js` (SVG čárového kódu) a
 * `../js/label.js` (rozměry štítku). Rozdíl je jen v UI a v tom, že stav leží
 * v localStorage místo v chrome.storage.local, a že se tisk otevírá na stránce
 * `../print.html`, která funguje v prohlížeči stejně.
 */
import {
  buildCode,
  buildCodes,
  canEncode,
  formatDateTime,
  getTodayInfo,
  normalizeVersion,
  parseVersionList,
  plural,
  scheduleMidnightRefresh,
  validateVersion,
} from "../js/core.js";
import { renderCode128 } from "../js/code128.js";
import {
  DEFAULT_LABEL_WIDTH_MM,
  LABEL_SIZE_PRESETS,
  MAX_LABEL_WIDTH_MM,
  MIN_LABEL_WIDTH_MM,
  labelGeometry,
  labelGrid,
  recommendedWidthMm,
} from "../js/label.js";
import { addEntries, addEntry, clearAll, removeEntry, searchHistory } from "../js/storage.js";
import { loadState, saveState } from "./store.js";

const $ = (id) => document.getElementById(id);

const CODE_FONT_SIZE = 30;
const CODE_MIN_FONT_SIZE = 14;
const CODE_AVAILABLE_WIDTH = 300; // místo, které zbývá na kód po popisku "Verze:"
const CODE_MONO_RATIO = 0.6;
const CODE_FIXED_CHARS = 4; // den v roce (3) + rok (1)

const clampWidth = (value) => Math.min(MAX_LABEL_WIDTH_MM, Math.max(MIN_LABEL_WIDTH_MM, Math.round(value * 10) / 10));
const clampCopies = (value) => Math.min(200, Math.max(1, Math.round(value) || 1));

/** Desetinná čárka, jak se to píše v češtině (12,5 mm). */
const formatMm = (value) => String(value).replace(".", ",");

const elements = {
  date: $("date"),
  code: $("code"),
  version: $("version"),
  codeDay: $("code-day"),
  codeYear: $("code-year"),
  status: $("status"),
  barcodePanel: $("barcode-panel"),
  barcode: $("barcode"),
  barcodeCaption: $("barcode-caption"),
  printToggle: $("print-toggle"),
  printSummary: $("print-summary"),
  printConfig: $("print-config"),
  printInfo: $("print-info"),
  labelWidth: $("label-width"),
  labelCopies: $("label-copies"),
  presets: $("presets"),
  fixWidth: $("fix-width"),
  copy: $("copy"),
  print: $("print"),
  big: $("big"),
  save: $("save"),
  multiToggle: $("multi-toggle"),
  multiCount: $("multi-count"),
  multiBody: $("multi-body"),
  multiVersions: $("multi-versions"),
  multiInfo: $("multi-info"),
  multiCopy: $("multi-copy"),
  multiSave: $("multi-save"),
  multiPrint: $("multi-print"),
  historyToggle: $("history-toggle"),
  historyBody: $("history-body"),
  historyCount: $("history-count"),
  historyList: $("history-list"),
  historyEmpty: $("history-empty"),
  search: $("search"),
  clear: $("clear"),
};

let state = loadState();
let today = getTodayInfo();

let labelWidthMm = clampWidth(state.settings.labelWidthMm ?? DEFAULT_LABEL_WIDTH_MM);
let labelCopies = clampCopies(state.settings.labelCopies ?? 1);

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${kind}`.trim();
}

/** Aktuální kód, nebo prázdný řetězec, pokud verze chybí nebo není platná. */
function currentCode() {
  const check = validateVersion(elements.version.value);
  if (!check.ok || !canEncode(buildCode(check.value, today.date))) return "";
  return buildCode(check.value, today.date);
}

/** Kódy z pole "Více kódů" pro dnešní den. */
function currentCodes() {
  const { versions, invalid } = parseVersionList(elements.multiVersions.value);
  return { versions, invalid, codes: buildCodes(versions, today.date) };
}

function renderBarcode(code) {
  const hasCode = code !== "";
  elements.barcodePanel.classList.toggle("is-empty", !hasCode);
  if (hasCode) {
    renderCode128(elements.barcode, code);
    elements.barcodeCaption.textContent = code;
  } else {
    elements.barcode.replaceChildren();
    elements.barcodeCaption.textContent = "";
  }
}

/**
 * Pole verze má být široké jako text, aby celý kód šel číst jako jedno číslo.
 * U dlouhé verze se písmo zmenší, aby se řádek vešel do displeje.
 */
function fitCodeLine(versionLength) {
  const chars = versionLength + CODE_FIXED_CHARS;
  const size = Math.min(CODE_FONT_SIZE, Math.max(CODE_MIN_FONT_SIZE, Math.floor(CODE_AVAILABLE_WIDTH / (chars * CODE_MONO_RATIO))));
  elements.code.style.fontSize = `${size}px`;
  elements.version.size = Math.max(6, versionLength);
}

function render() {
  elements.date.textContent = today.dateLabel;
  elements.codeDay.textContent = today.dayString;
  elements.codeYear.textContent = today.yearDigit;

  const check = validateVersion(elements.version.value);
  fitCodeLine(normalizeVersion(elements.version.value).length);
  const code = currentCode();

  if (check.ok || !elements.version.value.trim()) {
    setStatus(`Den v roce ${today.dayString}, rok ${today.year}.`);
  } else {
    setStatus(check.error, "error");
  }

  renderBarcode(code);
  for (const button of [elements.copy, elements.print, elements.big, elements.save]) {
    button.disabled = !code;
  }
  renderPrintConfig(code);
}

/** Konfigurace tisku: rozměr štítku a počet kusů, která jde rovnou do tisku. */
function renderPrintConfig(code) {
  const geometry = labelGeometry(code || "0000000000", labelWidthMm);
  const total = code ? labelCopies : 0;
  const grid = labelGrid(Math.max(total, 1), geometry.widthMm, geometry.heightMm);

  elements.labelWidth.value = String(labelWidthMm);
  elements.labelCopies.value = String(labelCopies);
  for (const button of elements.presets.children) {
    button.classList.toggle("is-active", Number(button.dataset.width) === labelWidthMm);
  }

  const summary = `${formatMm(geometry.widthMm)} × ${formatMm(geometry.heightMm)} mm`;
  elements.printSummary.textContent = code ? summary : `${formatMm(labelWidthMm)} mm`;

  const info =
    `Štítek ${summary} · modul ${formatMm(geometry.moduleMm)} mm` +
    (code
      ? total === 1
        ? " · jeden kus, stránka má velikost štítku"
        : ` · ${plural(total, ["štítek", "štítky", "štítků"])} · ${grid.columns} × ${grid.rows} na A4`
      : " · výška se dopočítá podle délky kódu");
  elements.printInfo.textContent = geometry.readable || !code ? info : `${info} – modul je příliš úzký, čtečka kód nemusí přečíst`;
  elements.printInfo.className = `status${geometry.readable || !code ? "" : " error"}`;

  elements.fixWidth.hidden = geometry.readable || !code;
  if (!elements.fixWidth.hidden) {
    const suggested = Math.min(MAX_LABEL_WIDTH_MM, recommendedWidthMm(code));
    const canGrow = suggested > labelWidthMm;
    elements.fixWidth.textContent = canGrow ? `Zvětšit na ${formatMm(suggested)} mm` : "Štítek je už maximální";
    elements.fixWidth.disabled = !canGrow;
    elements.fixWidth.dataset.width = String(suggested);
  }
}

function renderPresets() {
  elements.presets.replaceChildren(
    ...LABEL_SIZE_PRESETS.map((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset";
      button.textContent = preset.name;
      button.title = `${preset.widthMm} mm`;
      button.dataset.width = String(preset.widthMm);
      button.addEventListener("click", () => {
        labelWidthMm = preset.widthMm;
        renderPrintConfig(currentCode());
        saveSettings();
      });
      return button;
    }),
  );
}

function renderMulti() {
  const { codes, invalid } = currentCodes();
  const parts = [];

  elements.multiCount.textContent = codes.length > 0 ? plural(codes.length, ["kód", "kódy", "kódů"]) : "";
  if (codes.length > 0) {
    parts.push(codes.join(", "));
  }
  if (invalid.length > 0) {
    parts.push(`Přeskočeno (neplatné): ${invalid.join(", ")}`);
  }

  elements.multiInfo.textContent = parts.join(" · ");
  elements.multiInfo.className = `status${invalid.length > 0 && codes.length === 0 ? " error" : ""}`;
  for (const button of [elements.multiCopy, elements.multiSave, elements.multiPrint]) {
    button.disabled = codes.length === 0;
  }
}

function renderHistory() {
  const entries = searchHistory(state, elements.search.value);
  elements.historyCount.textContent = String(state.history.length);
  elements.historyEmpty.hidden = entries.length > 0;

  elements.historyList.replaceChildren(
    ...entries.map((entry) => {
      const item = document.createElement("li");
      item.className = "history-item";
      item.tabIndex = 0;
      item.title = "Doplnit do pole";

      const main = document.createElement("span");
      main.className = "history-item-main";

      const code = document.createElement("span");
      code.className = "history-item-code";
      code.textContent = entry.code;

      const meta = document.createElement("span");
      meta.className = "history-item-meta";
      meta.textContent = `${entry.version ? entry.version + " · " : ""}${formatDateTime(entry.createdAt)}`;

      main.append(code, meta);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "history-item-remove";
      remove.textContent = "✕";
      remove.title = "Smazat záznam";
      remove.setAttribute("aria-label", `Smazat záznam ${entry.code}`);

      item.append(main, remove);

      const use = () => {
        elements.version.value = entry.version;
        render();
        elements.version.focus();
      };
      item.addEventListener("click", use);
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          use();
        }
      });
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        state = removeEntry(state, entry.code);
        saveState(state);
        renderHistory();
      });

      return item;
    }),
  );
}

/** Kopírování do schránky; na starším prohlížeči nebo bez HTTPS nelze, dá se aspoň vybrat ručně. */
async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(message, "ok");
    return true;
  } catch (error) {
    console.warn("Schránka není dostupná:", error);
    setStatus("Do schránky se nepodařilo zapsat, kód je nad tlačítkem.", "error");
    return false;
  }
}

async function copyCode() {
  const code = currentCode();
  if (!code) return false;
  return copyText(code, `Zkopírováno: ${code}`);
}

async function copyAllCodes() {
  const { codes } = currentCodes();
  if (codes.length === 0) return false;
  return copyText(codes.join("\n"), `Zkopírováno ${plural(codes.length, ["kód", "kódy", "kódů"])}`);
}

async function saveEntry() {
  const code = currentCode();
  if (!code) return false;
  state = addEntry(state, { code, version: normalizeVersion(elements.version.value), dayOfYear: today.dayOfYear, year: today.year });
  saveState(state);
  renderHistory();
  setStatus(`Uloženo do historie: ${code}`, "ok");
  return true;
}

async function saveAllCodes() {
  const { versions, codes } = currentCodes();
  if (codes.length === 0) return false;
  state = addEntries(
    state,
    versions.map((version, index) => ({
      code: codes[index],
      version,
      dayOfYear: today.dayOfYear,
      year: today.year,
    })),
  );
  saveState(state);
  renderHistory();
  setStatus(`Uloženo do historie: ${plural(codes.length, ["kód", "kódy", "kódů"])}`, "ok");
  return true;
}

function openBigCode() {
  const code = currentCode();
  if (!code) return;
  // stejná složka, jen jiný cíl, ať jde o velký kód přímo v aplikaci
  location.href = `big.html?code=${encodeURIComponent(code)}`;
}

/** Tisková stránka je společná s rozšířením, jen jí předáme kódu a rozměr. */
function openPrint(codes) {
  if (codes.length === 0) return;
  const params = new URLSearchParams({
    codes: codes.join(","),
    width: String(labelWidthMm),
    copies: String(labelCopies),
  });
  location.href = `../print.html?${params}`;
}

function setPanelOpen(toggle, body, open) {
  body.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
}

function saveSettings() {
  state.settings.labelWidthMm = labelWidthMm;
  state.settings.labelCopies = labelCopies;
  state.settings.printOpen = elements.printConfig.hidden === false;
  state.settings.multiOpen = elements.multiBody.hidden === false;
  state.settings.historyOpen = elements.historyBody.hidden === false;
  saveState(state);
}

// Při psaní se hodnota pole nemění, písmena se převedou až po odečtení pole,
// jinak by se kurzor posouval proti psaní.
elements.version.addEventListener("input", render);

elements.version.addEventListener("blur", () => {
  const normalized = normalizeVersion(elements.version.value);
  if (normalized !== elements.version.value) elements.version.value = normalized;
  render();
});

elements.version.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (await copyCode()) await saveEntry();
});

elements.multiVersions.addEventListener("input", renderMulti);

elements.multiVersions.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (await copyAllCodes()) await saveAllCodes();
});

elements.labelWidth.addEventListener("input", () => {
  labelWidthMm = clampWidth(Number(elements.labelWidth.value));
  renderPrintConfig(currentCode());
});

elements.labelWidth.addEventListener("change", saveSettings);

elements.labelCopies.addEventListener("input", () => {
  labelCopies = clampCopies(Number(elements.labelCopies.value));
  renderPrintConfig(currentCode());
});

elements.labelCopies.addEventListener("change", saveSettings);

elements.fixWidth.addEventListener("click", () => {
  labelWidthMm = clampWidth(Number(elements.fixWidth.dataset.width));
  renderPrintConfig(currentCode());
  saveSettings();
});

elements.copy.addEventListener("click", copyCode);
elements.save.addEventListener("click", saveEntry);
elements.big.addEventListener("click", openBigCode);
elements.print.addEventListener("click", () => openPrint(currentCode() ? [currentCode()] : []));
elements.multiCopy.addEventListener("click", copyAllCodes);
elements.multiSave.addEventListener("click", saveAllCodes);
elements.multiPrint.addEventListener("click", () => openPrint(currentCodes().codes));

for (const [toggle, body] of [
  [elements.printToggle, elements.printConfig],
  [elements.multiToggle, elements.multiBody],
]) {
  toggle.addEventListener("click", () => {
    setPanelOpen(toggle, body, body.hidden);
    saveSettings();
  });
}

elements.historyToggle.addEventListener("click", () => {
  setPanelOpen(elements.historyToggle, elements.historyBody, elements.historyBody.hidden);
  saveSettings();
});

elements.search.addEventListener("input", renderHistory);

elements.clear.addEventListener("click", () => {
  if (!confirm("Opravdu vymazat celou historii?")) return;
  state = clearAll();
  saveState(state);
  elements.search.value = "";
  renderHistory();
  setStatus("Historie je prázdná.");
});

elements.version.value = state.lastVersion;
setPanelOpen(elements.historyToggle, elements.historyBody, state.settings.historyOpen ?? false);
setPanelOpen(elements.printToggle, elements.printConfig, state.settings.printOpen ?? false);
setPanelOpen(elements.multiToggle, elements.multiBody, state.settings.multiOpen ?? false);
renderPresets();
render();
renderMulti();
renderHistory();
elements.version.focus();

// Kdyby aplikace zůstala otevřená přes půlnoc, přepočítá se den v roce i kód.
scheduleMidnightRefresh(() => {
  today = getTodayInfo();
  render();
  renderMulti();
});

// Aplikace se má chovat jako instalovaná i po návratu z pozadí.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (getDayOfYearToday() === today.dayOfYear) return;
  today = getTodayInfo();
  render();
  renderMulti();
});

function getDayOfYearToday() {
  return getTodayInfo().dayOfYear;
}

// Service worker drží aplikaci dostupnou i bez signálu. Leží o úroveň výš,
// aby jeho scope sahal i na stránku tisku.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("../sw.js", { scope: "../" }).catch((error) => console.warn("Service worker se neregistroval:", error));
  });
}
