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
} from "./core.js";
import { code128SvgMarkup, renderCode128 } from "./code128.js";
import {
  DEFAULT_LABEL_WIDTH_MM,
  LABEL_SIZE_PRESETS,
  MAX_LABEL_WIDTH_MM,
  MIN_LABEL_WIDTH_MM,
  labelGeometry,
  labelGrid,
  recommendedWidthMm,
} from "./label.js";
import { addEntries, addEntry, clearAll, loadState, removeEntry, saveState, searchHistory } from "./storage.js";

const $ = (id) => document.getElementById(id);

const CODE_FONT_SIZE = 34;
const CODE_MIN_FONT_SIZE = 16;
const CODE_AVAILABLE_WIDTH = 348; // místo, které zbývá na kód po popisku "Verze:"
const CODE_MONO_RATIO = 0.6; // šířka jednoho znaku monospace písma vůči velikosti písma
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
  toolsToggle: $("tools-toggle"),
  toolsBody: $("tools-body"),
  toolText: $("tool-text"),
  toolPreview: $("tool-preview"),
  toolInfo: $("tool-info"),
  toolCopy: $("tool-copy"),
  toolDownload: $("tool-download"),
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

let state = await loadState();
let today = getTodayInfo();

let labelWidthMm = clampWidth(state.settings.labelWidthMm ?? DEFAULT_LABEL_WIDTH_MM);
let labelCopies = clampCopies(state.settings.labelCopies ?? 1);

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${kind}`.trim();
}

/** Doplňování dne a roku jde v nastavení dočasně vypnout. */
function codeOptions() {
  return {
    autoDay: state.settings?.autoFillDay !== false,
    autoYear: state.settings?.autoFillYear !== false,
  };
}

/** Aktuální kód, nebo prázdný řetězec, pokud verze chybí nebo není platná. */
function currentCode() {
  const check = validateVersion(elements.version.value);
  if (!check.ok || !canEncode(buildCode(check.value, today.date, codeOptions()))) return "";
  return buildCode(check.value, today.date, codeOptions());
}

/** Kódy z pole "Více kódů" pro dnešní den. */
function currentCodes() {
  const { versions, invalid } = parseVersionList(elements.multiVersions.value);
  return { versions, invalid, codes: buildCodes(versions, today.date, codeOptions()) };
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
 * U dlouhé verze se písmo zmenší, aby se řádek vešel do popupu.
 */
function fitCodeLine(versionLength) {
  const chars = versionLength + CODE_FIXED_CHARS;
  const size = Math.min(CODE_FONT_SIZE, Math.max(CODE_MIN_FONT_SIZE, Math.floor(CODE_AVAILABLE_WIDTH / (chars * CODE_MONO_RATIO))));
  elements.code.style.fontSize = `${size}px`;
  elements.version.size = Math.max(6, versionLength);
}

/** Přepíše dnešní kód, pole, stav i náhled tisku. */
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
      });
      return button;
    }),
  );
}

function renderToolBarcode() {
  const value = elements.toolText.value.trim();
  const supported = value.length > 0 && canEncode(value) && !/[\x00-\x1f\x7f]/.test(value);
  elements.toolPreview.replaceChildren();
  elements.toolCopy.disabled = !supported;
  elements.toolDownload.disabled = !supported;
  if (!value) {
    const hint = document.createElement("span");
    hint.textContent = "Zadej text pro náhled";
    elements.toolPreview.append(hint);
    elements.toolInfo.textContent = "Code 128 podporuje běžné ASCII znaky.";
    elements.toolInfo.className = "status";
    return;
  }
  if (!supported) {
    const hint = document.createElement("span");
    hint.textContent = "Tento text nelze zakódovat do Code 128 B.";
    elements.toolPreview.append(hint);
    elements.toolInfo.textContent = "Použij znaky ASCII bez diakritiky a řídicích znaků.";
    elements.toolInfo.className = "status error";
    return;
  }
  const svgHolder = document.createElement("div");
  svgHolder.className = "tool-barcode-svg";
  renderCode128(svgHolder, value, { barHeight: 72 });
  const caption = document.createElement("div");
  caption.className = "tool-barcode-caption";
  caption.textContent = value;
  elements.toolPreview.append(svgHolder, caption);
  elements.toolInfo.textContent = `${value.length} znaků · Code 128 B`;
  elements.toolInfo.className = "status ok";
}

function downloadToolSvg() {
  const value = elements.toolText.value.trim();
  if (!value || !canEncode(value) || /[\x00-\x1f\x7f]/.test(value)) return;
  const svg = code128SvgMarkup(value, { barHeight: 72 });
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `code128-${value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32) || "kod"}.svg`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      remove.addEventListener("click", async (event) => {
        event.stopPropagation();
        state = removeEntry(state, entry.code);
        await saveState(state);
        renderHistory();
      });

      return item;
    }),
  );
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(message, "ok");
    return true;
  } catch (error) {
    setStatus("Do schránky se nepodařilo zapsat.", "error");
    console.error(error);
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
  await saveState(state);
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
  await saveState(state);
  renderHistory();
  setStatus(`Uloženo do historie: ${plural(codes.length, ["kód", "kódy", "kódů"])}`, "ok");
  return true;
}

function openBigCode() {
  const code = currentCode();
  if (!code) return;
  chrome.tabs.create({ url: `scan.html?code=${encodeURIComponent(code)}` });
}

/** Tisková stránka přebírá rozměr štítku a počet kusů z panelu. */
function openPrint(codes) {
  if (codes.length === 0) return;
  const params = new URLSearchParams({
    codes: codes.join(","),
    width: String(labelWidthMm),
    copies: String(labelCopies),
  });
  chrome.tabs.create({ url: `print.html?${params}` });
}

function setPanelOpen(toggle, body, open) {
  body.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
}

async function saveSettings() {
  state.settings.labelWidthMm = labelWidthMm;
  state.settings.labelCopies = labelCopies;
  state.settings.printOpen = elements.printConfig.hidden === false;
  state.settings.multiOpen = elements.multiBody.hidden === false;
  state.settings.historyOpen = elements.historyBody.hidden === false;
  await saveState(state);
}

// Popup se po kliknutí mimo rozšíření zavře. Platnou verzi proto ukládáme už
// při psaní, aby se při dalším otevření rovnou znovu sestavil poslední kód.
let lastVersionSave = Promise.resolve();
function rememberCurrentVersion() {
  const check = validateVersion(elements.version.value);
  if (!check.ok) return;

  state.lastVersion = check.value;
  lastVersionSave = lastVersionSave
    .catch((error) => console.error("Nepodařilo se uložit předchozí verzi.", error))
    .then(() => saveState(state))
    .catch((error) => console.error("Nepodařilo se uložit poslední verzi.", error));
}

// Při psaní se hodnota pole nemění, písmena se převedou až po odečtení pole,
// jinak by se kurzor posouval proti psaní.
elements.version.addEventListener("input", () => {
  render();
  rememberCurrentVersion();
});

elements.version.addEventListener("blur", () => {
  const normalized = normalizeVersion(elements.version.value);
  if (normalized !== elements.version.value) elements.version.value = normalized;
  render();
  rememberCurrentVersion();
});

elements.version.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (await copyCode()) await saveEntry();
});

elements.toolText.addEventListener("input", renderToolBarcode);
elements.toolCopy.addEventListener("click", () => {
  const value = elements.toolText.value.trim();
  if (value && canEncode(value)) copyText(value, "Text čárového kódu zkopírován.");
});
elements.toolDownload.addEventListener("click", downloadToolSvg);

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

elements.fixWidth.addEventListener("click", async () => {
  labelWidthMm = clampWidth(Number(elements.fixWidth.dataset.width));
  renderPrintConfig(currentCode());
  await saveSettings();
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
  [elements.toolsToggle, elements.toolsBody],
]) {
  toggle.addEventListener("click", async () => {
    setPanelOpen(toggle, body, body.hidden);
    await saveSettings();
  });
}

elements.historyToggle.addEventListener("click", async () => {
  setPanelOpen(elements.historyToggle, elements.historyBody, elements.historyBody.hidden);
  await saveSettings();
});

elements.search.addEventListener("input", renderHistory);

elements.clear.addEventListener("click", async () => {
  if (!confirm("Opravdu vymazat celou historii?")) return;
  state = clearAll();
  await saveState(state);
  elements.search.value = "";
  renderHistory();
  setStatus("Historie je prázdná.");
});

elements.version.value = state.lastVersion;
setPanelOpen(elements.historyToggle, elements.historyBody, state.settings.historyOpen ?? false);
setPanelOpen(elements.printToggle, elements.printConfig, state.settings.printOpen ?? false);
setPanelOpen(elements.multiToggle, elements.multiBody, state.settings.multiOpen ?? true);
setPanelOpen(elements.toolsToggle, elements.toolsBody, false);
renderPresets();
render();
renderMulti();
renderToolBarcode();
renderHistory();
elements.version.focus();

// Kdyby popup zůstal otevřený přes půlnoc, přepočítá se den v roce i kód.
scheduleMidnightRefresh(() => {
  today = getTodayInfo();
  render();
  renderMulti();
});
