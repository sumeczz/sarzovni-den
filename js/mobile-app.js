import {
  addEntries, addEntry, clearAll, loadState, removeEntry, saveState, searchHistory,
} from "../pwa/store.js";
import {
  buildCode, buildCodes, formatDateTime, getTodayInfo, normalizeVersion,
  parseVersionList, scheduleMidnightRefresh, validateVersion,
} from "./core.js";
import { renderCode128 } from "./code128.js";
import { DEFAULT_LABEL_WIDTH_MM, MAX_LABEL_WIDTH_MM, MIN_LABEL_WIDTH_MM } from "./label.js";

const $ = (id) => document.getElementById(id);
const ui = {
  version: $("version"), date: $("today-pill"), status: $("generator-status"),
  code: $("generated-code"), barcode: $("barcode"), copy: $("copy-code"),
  big: $("show-big"), print: $("print-code"), save: $("save-code"),
  multi: $("multi-versions"), multiCount: $("multi-count"), multiStatus: $("multi-status"),
  multiCopy: $("multi-copy"), multiSave: $("multi-save"), multiPrint: $("multi-print"),
  historyToggle: $("history-toggle"), historyBody: $("history-body"),
  historyCount: $("history-count"), historySearch: $("history-search"),
  historyList: $("history-list"), historyEmpty: $("history-empty"),
  clearHistory: $("clear-history"), exportHistory: $("export-history"),
  toast: $("toast"), install: $("install-button"),
};
let state = await loadState();
let today = getTodayInfo();
let installPrompt = null;
let toastTimer = 0;

const width = (value) => Math.min(MAX_LABEL_WIDTH_MM, Math.max(MIN_LABEL_WIDTH_MM, Math.round(Number(value) || DEFAULT_LABEL_WIDTH_MM)));
const codeOptions = () => ({
  autoDay: state.settings?.autoFillDay !== false,
  autoYear: state.settings?.autoFillYear !== false,
});

function toast(message, error = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle("error", error);
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2800);
}
function setStatus(message, type = "") {
  ui.status.textContent = message;
  ui.status.className = ("notice " + type).trim();
}
function currentCode() {
  const result = validateVersion(ui.version.value);
  return result.ok ? buildCode(result.value, today.date, codeOptions()) : "";
}
function currentCodes() {
  const parsed = parseVersionList(ui.multi.value);
  return { ...parsed, codes: buildCodes(parsed.versions, today.date, codeOptions()) };
}
function update() {
  today = getTodayInfo();
  ui.date.textContent = today.dateLabel;
  const result = validateVersion(ui.version.value);
  const code = result.ok ? buildCode(result.value, today.date, codeOptions()) : "";
  ui.code.textContent = code || "—";
  ui.barcode.replaceChildren();
  if (code) {
    try {
      renderCode128(ui.barcode, code, { barHeight: 58 });
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Kód se nepodařilo vykreslit.", "error");
    }
  }
  for (const button of [ui.copy, ui.big, ui.print, ui.save]) button.disabled = !code;
  if (!ui.version.value.trim()) setStatus("Zadej verzi plechu.");
  else if (!result.ok) setStatus(result.error, "error");
  else setStatus("Den v roce " + today.dayString + " · rok " + today.year + ".", "ok");
  updateMulti();
}
function updateMulti() {
  const { codes, invalid } = currentCodes();
  ui.multiCount.textContent = codes.length ? codes.length + " kódů" : "více verzí";
  const messages = [];
  if (codes.length) messages.push(codes.length + " kódů připraveno.");
  if (invalid.length) messages.push("Přeskočeno (neplatné): " + invalid.join(", ") + ".");
  ui.multiStatus.textContent = messages.join(" ") || "Kódy se generují podle dnešního data.";
  for (const button of [ui.multiCopy, ui.multiSave, ui.multiPrint]) button.disabled = codes.length === 0;
}
async function persist() {
  const success = await saveState(state);
  if (success === false) toast("Prohlížeč nedovolil uložit změny.", true);
}
async function copyText(value, message) {
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (!copied) throw new Error("Schránka není dostupná.");
    }
    toast(message);
    return true;
  } catch (error) {
    console.error(error);
    toast("Kopírování se nepodařilo. Označ kód a zkopíruj ho ručně.", true);
    return false;
  }
}
async function rememberOne() {
  const code = currentCode();
  const result = validateVersion(ui.version.value);
  if (!code || !result.ok) return;
  state = addEntry(state, { code, version: result.value, dayOfYear: today.dayOfYear, year: today.year });
  await persist();
  renderHistory();
  toast("Kód uložen do historie.");
}
async function rememberMany() {
  const { versions, codes } = currentCodes();
  if (!codes.length) return;
  state = addEntries(state, versions.map((version, index) => ({
    code: codes[index], version, dayOfYear: today.dayOfYear, year: today.year,
  })));
  await persist();
  renderHistory();
  toast("Uloženo " + codes.length + " kódů.");
}
function openBig(code) {
  if (!code) return;
  const url = new URL("./pwa/big.html", document.baseURI);
  url.searchParams.set("code", code);
  location.href = url.href;
}
function openPrint(codes) {
  if (!codes.length) return;
  const settings = state.settings || {};
  const params = new URLSearchParams({
    codes: codes.join(","),
    width: String(width(settings.labelWidthMm)),
    copies: String(Math.max(1, Math.min(200, Math.round(Number(settings.labelCopies) || 1)))),
  });
  location.href = new URL("./print.html?" + params.toString(), document.baseURI).href;
}
function renderHistory() {
  const entries = searchHistory(state, ui.historySearch.value);
  ui.historyCount.textContent = String(state.history.length);
  ui.historyEmpty.hidden = entries.length > 0;
  ui.historyList.replaceChildren(...entries.map((entry) => {
    const item = document.createElement("li");
    item.className = "history-item";
    const use = document.createElement("button");
    use.type = "button";
    use.className = "history-use";
    const code = document.createElement("strong");
    code.textContent = entry.code;
    const meta = document.createElement("small");
    meta.textContent = (entry.version || "Bez verze") + " · " + (entry.createdAt ? formatDateTime(entry.createdAt) : "starší záznam");
    use.append(code, meta);
    use.addEventListener("click", () => {
      ui.version.value = entry.version || "";
      update();
      window.scrollTo({ top: 0, behavior: "smooth" });
      ui.version.focus({ preventScroll: true });
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "history-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Smazat " + entry.code);
    remove.addEventListener("click", async () => {
      state = removeEntry(state, entry.code);
      await persist();
      renderHistory();
    });
    item.append(use, remove);
    return item;
  }));
}
function exportCsv() {
  const rows = [["kod", "verze", "den_v_roce", "rok", "vytvoreno"], ...state.history.map((entry) => [
    entry.code, entry.version, entry.dayOfYear ?? "", entry.year ?? "",
    entry.createdAt ? new Date(entry.createdAt).toISOString() : "",
  ])];
  const csv = "\uFEFF" + rows.map((row) => row.map((cell) => {
    const value = String(cell);
    return /[;\r\n"]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
  }).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "sarzovni-historie-" + today.year + "-" + today.dayString + ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
ui.version.value = state.lastVersion || "";
ui.version.addEventListener("input", () => {
  update();
  const result = validateVersion(ui.version.value);
  if (result.ok) {
    state.lastVersion = result.value;
    void persist();
  }
});
ui.version.addEventListener("blur", () => {
  ui.version.value = normalizeVersion(ui.version.value);
  update();
});
ui.version.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (await copyText(currentCode(), "Kód zkopírován.")) await rememberOne();
});
ui.copy.addEventListener("click", () => void copyText(currentCode(), "Kód zkopírován."));
ui.big.addEventListener("click", () => openBig(currentCode()));
ui.print.addEventListener("click", () => openPrint(currentCode() ? [currentCode()] : []));
ui.save.addEventListener("click", () => void rememberOne());
ui.multi.addEventListener("input", updateMulti);
ui.multiCopy.addEventListener("click", () => void copyText(currentCodes().codes.join("\n"), "Všechny kódy zkopírovány."));
ui.multiSave.addEventListener("click", () => void rememberMany());
ui.multiPrint.addEventListener("click", () => openPrint(currentCodes().codes));
ui.historyToggle.addEventListener("click", () => {
  const open = ui.historyBody.hidden;
  ui.historyBody.hidden = !open;
  ui.historyToggle.setAttribute("aria-expanded", String(open));
});
ui.historySearch.addEventListener("input", renderHistory);
ui.clearHistory.addEventListener("click", async () => {
  if (!state.history.length) return toast("Historie je už prázdná.");
  if (!confirm("Opravdu smazat celou historii kódů v tomto prohlížeči?")) return;
  state = clearAll();
  await persist();
  renderHistory();
  update();
  toast("Historie byla vymazána.");
});
ui.exportHistory.addEventListener("click", exportCsv);
window.addEventListener("pageshow", update);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") update();
});
scheduleMidnightRefresh(update);
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("./sw.js", document.baseURI), { scope: new URL("./", document.baseURI).pathname })
      .catch((error) => console.warn("Service worker se neregistroval:", error));
  });
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  ui.install.hidden = false;
});
ui.install.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  ui.install.hidden = true;
});
renderHistory();
update();
