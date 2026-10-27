import { IMPORT_FIELDS, SAP_FIELD_DESCRIPTIONS, parseSapTable, mapImportRows, normalizeImportHeader } from "./sap-import.js";
import { parseXlsxFile } from "./xlsx-import.js";
import { LABEL_PRESETS, FIELD_OPTIONS, cloneDefaultLayout, substituteTemplate, elementPayload } from "./label-model.js";
import { createGeneratedRecords, runPreflight } from "./quality.js";
import { buildCode128Bars, buildCode128BarsFromValues } from "./code128.js";
import { buildQrSvg } from "./qr-svg.js";
import { GS1_APPLICATION_IDENTIFIERS, gs1Code128Values } from "./gs1.js";

const $ = (id) => document.getElementById(id);
const state = {
  parsed: null,
  mapping: {},
  records: [],
  layout: cloneDefaultLayout(),
  selectedElementId: "main-barcode",
  previewIndex: 0,
  quality: null,
  canvasScale: 1,
  pasteSource: "",
  hasData: false,
};
const ESC = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const safeFilename = (value) => String(value || "stitky").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "stitky";
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
let toastTimer;
function notify(message, error = false) {
  const toast = $("toast"); toast.textContent = message; toast.classList.toggle("error", error); toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function showView(view) {
  for (const name of ["import", "design", "quality"]) $("view-" + name).hidden = name !== view;
  document.querySelectorAll(".workflow-step").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  if (view === "design") renderDesigner();
  if (view === "quality") { if (!state.quality) runQuality(); else renderQuality(); }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function syncWorkflowButtons() {
  document.querySelectorAll('.workflow-step').forEach((button) => { button.disabled = false; });
}
function invalidateQuality() {
  state.quality = null;
  $("print-labels").disabled = true;
  $("stat-ready").textContent = "Neověřeno";
  $("stat-ready").className = "stat-stale";
}
function currentLayoutDimensions() { return { widthMm: Number($("label-width-mm").value), heightMm: Number($("label-height-mm").value) }; }
function activeRecord() {
  if (state.records.length) return state.records[Math.max(0, Math.min(state.previewIndex, state.records.length - 1))];
  return { version: "12472A", generatedCode: "12472A2926", material: "0000123456", description: "Ukázkový materiál", sapBatch: "B260019", vendor: "Dodavatel", plant: "1100", storageLocation: "0001", quantity: "250", unit: "KG", purchaseOrder: "4500012345", expiryDate: "", qrContent: "", barcodeContent: "", _line: 1 };
}
function currentAllRecords() { return state.records.length ? state.records : [activeRecord()]; }
function activeElement() { return state.layout.find((element) => element.id === state.selectedElementId) || state.layout[0] || null; }
function tokenForHeader(header, index, seen = new Map()) {
  let base = normalizeImportHeader(header).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || `sloupec_${index + 1}`;
  const count = (seen.get(base) || 0) + 1; seen.set(base, count);
  if (count > 1) base += `_${count}`;
  return `sap_${base}`;
}
function fieldsForRecord() {
  const custom = (state.parsed?.headers || []).map((header, index) => ({ value: tokenForHeader(header, index, new Map()), label: `SAP: ${header || `Sloupec ${index + 1}`}` }));
  // Re-create the token map with duplicate suffixes stable over the whole header row.
  const seen = new Map();
  const customFields = (state.parsed?.headers || []).map((header, index) => ({ value: tokenForHeader(header, index, seen), label: `SAP: ${header || `Sloupec ${index + 1}`}` }));
  const all = [...FIELD_OPTIONS, ...customFields];
  return all.filter((item, index) => all.findIndex((candidate) => candidate.value === item.value) === index);
}
function recordsWithSourceColumns(records) {
  if (!state.parsed) return records;
  const seen = new Map();
  const headers = state.parsed.headers.map((header, index) => ({ key: tokenForHeader(header, index, seen), header, index }));
  return records.map((record) => {
    const next = { ...record };
    for (const item of headers) next[item.key] = String(record._raw?.[item.index] ?? "");
    return next;
  });
}
function parseHtmlClipboardTable(html) {
  if (!html || !/<table[\s>]/i.test(html)) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = [...doc.querySelectorAll("table")];
  if (!tables.length) return "";
  const table = tables.sort((a, b) => b.querySelectorAll("tr").length - a.querySelectorAll("tr").length)[0];
  const rows = [...table.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((cell) => (cell.innerText || cell.textContent || "").replace(/\u00a0/g, " ").replace(/[\r\n]+/g, " ").trim()));
  const clean = rows.filter((row) => row.some((cell) => cell));
  return clean.map((row) => row.map((cell) => /[\t\r\n"]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join("\t")).join("\n");
}
function renderImportWarnings(items) {
  const root = $("import-warnings"); root.replaceChildren(); root.hidden = !items?.length;
  for (const message of items || []) {
    const row = document.createElement("div"); row.className = "notice"; row.textContent = message; root.append(row);
  }
}
function appendReferenceRow(root, values) {
  const row = document.createElement("tr");
  for (const value of values) { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); }
  root.append(row);
}
function renderReferenceTables() {
  const sapRoot = $("sap-field-reference");
  for (const field of IMPORT_FIELDS) {
    const technical = field.label.match(/\(([^)]+)\)/)?.[1] || "—";
    appendReferenceRow(sapRoot, [technical, field.label.replace(/\s*\([^)]+\)/, ""), SAP_FIELD_DESCRIPTIONS[field.key] || "Pole zachované pro tisk a export."]);
  }
  const gs1Root = $("gs1-ai-reference");
  for (const item of GS1_APPLICATION_IDENTIFIERS) appendReferenceRow(gs1Root, [`(${item.ai})`, item.name, item.format, item.description]);
}
function renderMapping() {
  if (!state.parsed) return;
  const root = $("mapping-grid"); root.replaceChildren();
  for (const field of IMPORT_FIELDS) {
    const label = document.createElement("label"); label.className = "mapping-field";
    const title = document.createElement("span"); title.textContent = field.label + (field.required ? " *" : "");
    const select = document.createElement("select"); select.dataset.fieldKey = field.key; select.id = `map-${field.key}`;
    const empty = document.createElement("option"); empty.value = ""; empty.textContent = "— Nepřiřazovat —"; select.append(empty);
    state.parsed.headers.forEach((header, index) => {
      const option = document.createElement("option"); option.value = String(index); option.textContent = `${index + 1}. ${header || `Sloupec ${index + 1}`}`; select.append(option);
    });
    const mapped = state.mapping[field.key]; select.value = mapped === null || mapped === undefined ? "" : String(mapped);
    select.addEventListener("change", () => { state.mapping[field.key] = select.value === "" ? null : Number(select.value); updateImportSummary(); renderRawPreview(); });
    label.append(title, select); root.append(label);
  }
  $("mapping-panel").hidden = false;
  const detected = Object.values(state.mapping).filter((col) => col !== null && col !== undefined && col !== "").length;
  $("detect-status").textContent = `${detected} polí rozpoznáno`;
  $("detect-status").className = "pill";
  updateImportSummary(); renderRawPreview();
}
function updateImportSummary() {
  if (!state.parsed) return;
  const mapped = Object.values(state.mapping).filter((value) => value !== null && value !== undefined && value !== "").length;
  const unknown = state.parsed.headers.filter((header, index) => !Object.values(state.mapping).includes(index)).length;
  $("source-stats").textContent = `${state.parsed.rows.length} řádků · ${state.parsed.headers.length} sloupců · ${mapped} polí namapováno · ${unknown} sloupců bez mapování`;
  const hasVersion = state.mapping.version !== null && state.mapping.version !== undefined && state.mapping.version !== "";
  const mode = $("code-mode").value;
  const warningList = [...(state.parsed.warnings || [])];
  if (mode === "sharnovni" && !hasVersion) warningList.push("Pro šaržovní kód je nutné namapovat verzi / šarži dodavatele (LICHA). Dávka SAP (CHARG) ji nenahrazuje.");
  renderImportWarnings([...new Set(warningList)]);
}
function renderRawPreview() {
  if (!state.parsed) return;
  const head = $("import-table-head"), body = $("import-table-body"); head.replaceChildren(); body.replaceChildren();
  const indices = state.parsed.headers.map((_, index) => index).slice(0, 14);
  const lineHead = document.createElement("th"); lineHead.textContent = "Řádek"; head.append(lineHead);
  for (const index of indices) { const th = document.createElement("th"); th.textContent = state.parsed.headers[index] || `Sloupec ${index + 1}`; head.append(th); }
  for (const row of state.parsed.rows.slice(0, 12)) {
    const tr = document.createElement("tr"); const lineCell = document.createElement("td"); lineCell.textContent = String(row.line); tr.append(lineCell);
    for (const index of indices) { const td = document.createElement("td"); td.textContent = row.cells[index] || ""; tr.append(td); }
    body.append(tr);
  }
  if (state.parsed.headers.length > indices.length) {
    const row = document.createElement("tr"), cell = document.createElement("td"); cell.colSpan = indices.length + 1; cell.textContent = `Náhled zobrazuje prvních ${indices.length} sloupců. Import zachovává všech ${state.parsed.headers.length}.`; row.append(cell); body.append(row);
  }
}
function parseImport() {
  try {
    const raw = $("source-text").value;
    const requested = $("delimiter").value;
    const delimiter = requested === "\\t" ? "\t" : requested;
    const options = { delimiter, hasHeader: $("header-autodetect").checked ? undefined : false };
    state.parsed = parseSapTable(raw, options); state.mapping = { ...state.parsed.mapping };
    renderMapping(); notify(`Načteno ${state.parsed.rows.length} datových řádků; zkontroluj mapování.`);
  } catch (error) { notify(error.message || "Import se nepodařil.", true); }
}
const SAMPLE_SAP = `Přehled skladových zásob – příklad\nMaterial\tMaterial Description\tVendor Batch (LICHA)\tBatch (CHARG)\tPlant (WERKS)\tStorage Location (LGORT)\tWarehouse (LGNUM)\tStorage Type (LGTYP)\tStorage Bin (LGPLA)\tQuantity (MENGE)\tUnit (MEINS)\tPO (EBELN)\tInbound Delivery (VBELN)\tMovement Type (BWART)\n0000123456\tPlech DC01 0,8 mm\t12472A\tB260019\t1100\t0001\t001\t001\tA-01-02\t250,000\tKG\t4500012345\t1800009876\t101\n0000123457\tPlech DC04 1,0 mm\t12472B\tB260020\t1100\t0001\t001\t001\tA-01-03\t120,000\tKG\t4500012345\t1800009876\t101\n0000123458\tPásovina 2 mm\t12472C\tB260021\t1100\t0001\t001\t002\tB-04-01\t80,000\tKG\t4500012346\t1800009877\t101`;
function currentMapping() {
  const result = { ...state.mapping };
  document.querySelectorAll("#mapping-grid select[data-field-key]").forEach((select) => { result[select.dataset.fieldKey] = select.value === "" ? null : Number(select.value); });
  return result;
}
function applyMapping() {
  if (!state.parsed) return notify("Nejdřív vlož a analyzuj data ze SAPu nebo Excelu.", true);
  const mapping = currentMapping(); state.mapping = mapping;
  const base = recordsWithSourceColumns(mapImportRows(state.parsed, mapping));
  const mode = $("code-mode").value;
  const date = $("generation-date-mode").value === "manual" ? $("generation-date").value : todayIso();
  state.records = createGeneratedRecords(base, { codeMode: mode, date });
  state.previewIndex = 0; state.hasData = true; invalidateQuality(); syncWorkflowButtons();
  if (!state.records.length) return notify("Po filtrování nezůstaly žádné datové řádky.", true);
  $("design-record-caption").textContent = `${state.records.length} importovaných řádků · ukázka řádku ${state.records[0]._line}`;
  showView("design"); notify(`Připraveno ${state.records.length} záznamů. Další krok: návrh štítku a kontrola.`);
}
function code128Checksum(values) {
  return values.reduce((sum, value, index) => index === 0 ? value : sum + value * index, 0) % 103;
}
function barcodeData(payload, format = "code128") {
  if (format !== "gs1-128") return { geometry: buildCode128Bars(payload, { quietZone: 10, barHeight: 82 }), hri: payload, warnings: [] };
  const gs1 = gs1Code128Values(payload);
  const values = [...gs1.values, code128Checksum(gs1.values), 106];
  return { geometry: buildCode128BarsFromValues(values, { quietZone: 10, barHeight: 82 }), hri: gs1.hri, warnings: gs1.warnings };
}
function makeBarcodeSvg(payload, options = {}) {
  const data = String(payload ?? "").trim(); if (!data) throw new Error("Chybí data pro čárový kód.");
  const { geometry, hri } = barcodeData(data, options.format);
  const { bars, modules } = geometry; const humanReadable = !!options.humanReadable; const height = humanReadable ? 100 : 82;
  const foreground = /^#[0-9a-f]{6}$/i.test(options.foreground || "") ? options.foreground : "#111827";
  const background = /^#[0-9a-f]{6}$/i.test(options.background || "") ? options.background : "#ffffff";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules} ${height}" role="img" aria-label="Čárový kód ${ESC(hri)}"><rect width="${modules}" height="${height}" fill="${background}"/><g fill="${foreground}">${bars.map((bar) => `<rect x="${bar.x}" y="0" width="${bar.width}" height="82"/>`).join("")}</g>${humanReadable ? `<text x="${modules / 2}" y="95" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" fill="${foreground}">${ESC(hri)}</text>` : ""}</svg>`;
}
function svgParts(svg) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] || "0 0 100 100";
  const body = svg.replace(/^.*?<svg\b[^>]*>/s, "").replace(/<\/svg>\s*$/s, "");
  return { viewBox, body };
}
function itemSvgContent(element, record) {
  if (element.type === "barcode") return makeBarcodeSvg(elementPayload(element, record), { format: element.barcodeFormat, foreground: element.foreground, background: element.background, humanReadable: element.humanReadable });
  if (element.type === "qr") return buildQrSvg(elementPayload(element, record), { ecc: element.ecc || "M", fg: element.foreground || "#101828", bg: element.background || "#ffffff", quiet: element.quiet !== false, rounded: !!element.rounded, size: 256 });
  return "";
}
function renderCanvas() {
  const canvas = $("label-canvas"); const record = activeRecord(); const { widthMm, heightMm } = currentLayoutDimensions();
  const safeWidth = Number.isFinite(widthMm) && widthMm > 0 ? widthMm : 104;
  const safeHeight = Number.isFinite(heightMm) && heightMm > 0 ? heightMm : 151.63;
  const scale = Math.min(580 / safeWidth, 660 / safeHeight); state.canvasScale = scale;
  canvas.style.width = `${safeWidth * scale}px`; canvas.style.height = `${safeHeight * scale}px`; canvas.replaceChildren();
  $("dimension-pill").textContent = `${safeWidth.toLocaleString("cs-CZ")} × ${safeHeight.toLocaleString("cs-CZ")} mm`;
  for (const element of state.layout) {
    if (element.enabled === false) continue;
    const node = document.createElement("div"); node.className = `canvas-item type-${element.type}${element.id === state.selectedElementId ? " selected" : ""}`; node.dataset.elementId = element.id; node.title = `${element.label} · dvojklik/klik pro úpravu, přetažením posuneš`;
    const s = state.canvasScale;
    Object.assign(node.style, { left: `${Number(element.x) * s}px`, top: `${Number(element.y) * s}px`, width: `${Number(element.w) * s}px`, height: `${Number(element.h) * s}px`, fontSize: `${Math.max(7, Number(element.fontSize || 3) * s)}px`, fontWeight: element.bold ? "700" : "400", textAlign: element.align || "left" });
    if (element.type === "text") {
      node.textContent = substituteTemplate(element.template, record) || "〔prázdné〕";
      node.style.whiteSpace = "pre-wrap"; node.style.overflow = "hidden";
    } else {
      try { node.innerHTML = itemSvgContent(element, record); }
      catch (error) { node.textContent = `⚠ ${error.message}`; node.classList.add("canvas-error"); }
    }
    node.addEventListener("click", (event) => { event.stopPropagation(); selectElement(element.id); });
    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation(); selectElement(element.id, false);
      state.drag = { id: element.id, startX: event.clientX, startY: event.clientY, x: Number(element.x), y: Number(element.y), moved: false };
      node.setPointerCapture?.(event.pointerId);
    });
    canvas.append(node);
  }
  canvas.onclick = () => { state.selectedElementId = ""; renderElementList(); renderInspector(); renderCanvas(); };
}
function selectElement(id, repaint = true) {
  state.selectedElementId = id;
  if (repaint) { renderElementList(); renderInspector(); renderCanvas(); }
  else { renderElementList(); renderInspector(); document.querySelectorAll(".canvas-item").forEach((n) => n.classList.toggle("selected", n.dataset.elementId === id)); }
}
function renderElementList() {
  const root = $("element-list"); root.replaceChildren();
  for (const item of state.layout) {
    const row = document.createElement("div"); row.className = `element-row${item.id === state.selectedElementId ? " active" : ""}`;
    const toggle = document.createElement("input"); toggle.type = "checkbox"; toggle.checked = item.enabled !== false; toggle.title = "Zobrazit/skrýt prvek"; toggle.setAttribute("aria-label", `Zobrazit prvek ${item.label}`);
    toggle.addEventListener("change", () => { item.enabled = toggle.checked; invalidateQuality(); renderElementList(); renderCanvas(); });
    const select = document.createElement("button"); select.type = "button"; select.className = "element-select"; select.textContent = item.label; select.addEventListener("click", () => selectElement(item.id));
    const type = document.createElement("span"); type.className = `element-type-badge ${item.type}`; type.textContent = item.type === "text" ? "TXT" : item.type === "qr" ? "QR" : "128";
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "element-remove"; remove.textContent = "×"; remove.title = "Odebrat prvek"; remove.addEventListener("click", () => { state.layout = state.layout.filter((entry) => entry.id !== item.id); state.selectedElementId = state.layout[0]?.id || ""; invalidateQuality(); renderElementList(); renderInspector(); renderCanvas(); });
    row.append(toggle, type, select, remove); root.append(row);
  }
}
function labeledControl(labelText, control) { const label = document.createElement("label"); label.className = "field inspector-field"; const span = document.createElement("span"); span.textContent = labelText; label.append(span, control); return label; }
function updateElement(element, key, value, type = "text") {
  if (type === "number") value = Number(value);
  element[key] = value; invalidateQuality(); renderCanvas();
}
function renderInspector() {
  const root = $("element-inspector"); root.replaceChildren(); const item = activeElement();
  if (!item) { root.className = "inspector empty-inspector"; root.textContent = "Přidej prvek, nebo vyber prvek ze seznamu."; return; }
  root.className = "inspector";
  const name = document.createElement("input"); name.type = "text"; name.maxLength = 80; name.value = item.label; name.addEventListener("input", () => { item.label = name.value; invalidateQuality(); renderElementList(); });
  root.append(labeledControl("Název prvku", name));
  if (item.type === "text") {
    const template = document.createElement("textarea"); template.rows = 4; template.value = item.template || ""; template.spellcheck = false;
    template.addEventListener("input", () => { item.template = template.value; invalidateQuality(); renderCanvas(); });
    root.append(labeledControl("Text / šablona (podporuje {{pole}})", template));
    const field = document.createElement("select"); for (const optionData of fieldsForRecord()) { const option = document.createElement("option"); option.value = optionData.value; option.textContent = optionData.label; field.append(option); }
    const insert = document.createElement("button"); insert.type = "button"; insert.className = "button ghost full-button"; insert.textContent = "Vložit proměnnou do šablony"; insert.addEventListener("click", () => { const token = `{{${field.value}}}`; const start = template.selectionStart ?? template.value.length, end = template.selectionEnd ?? start; template.value = template.value.slice(0, start) + token + template.value.slice(end); template.focus(); template.setSelectionRange(start + token.length, start + token.length); item.template = template.value; invalidateQuality(); renderCanvas(); });
    root.append(labeledControl("Proměnná pro vložení", field), insert);
  } else {
    const field = document.createElement("select"); for (const optionData of fieldsForRecord()) { const option = document.createElement("option"); option.value = optionData.value; option.textContent = optionData.label; field.append(option); }
    field.value = item.field || (item.type === "barcode" ? "generatedCode" : "qrContent"); field.addEventListener("change", () => updateElement(item, "field", field.value));
    root.append(labeledControl("Zdroj dat", field));
    const template = document.createElement("textarea"); template.rows = 3; template.placeholder = "Nepovinné: vlastní obsah nebo šablona, např. https://firma.cz/{{material}}"; template.value = item.contentTemplate || ""; template.spellcheck = false;
    template.addEventListener("input", () => updateElement(item, "contentTemplate", template.value));
    root.append(labeledControl("Vlastní obsah / šablona", template));
    const sourceHint = document.createElement("p"); sourceHint.className = "field-hint"; sourceHint.textContent = "Když vyplníš šablonu, má přednost před zdrojovým polem. Vkládej proměnné jako {{material}}, {{version}} nebo {{sap_nazev_sloupce}}."; root.append(sourceHint);
    const codeSettings = document.createElement("div"); codeSettings.className = "inspector-grid";
    if (item.type === "barcode") {
      const format = document.createElement("select");
      for (const [value, label] of [["code128", "Code 128"], ["gs1-128", "GS1-128 (FNC1 + AI)"]]) { const option = document.createElement("option"); option.value = value; option.textContent = label; format.append(option); }
      format.value = item.barcodeFormat || "code128"; format.addEventListener("change", () => { updateElement(item, "barcodeFormat", format.value); renderInspector(); });
      const humanReadable = document.createElement("input"); humanReadable.type = "checkbox"; humanReadable.checked = !!item.humanReadable; humanReadable.addEventListener("change", () => updateElement(item, "humanReadable", humanReadable.checked));
      const foreground = document.createElement("input"); foreground.type = "color"; foreground.value = item.foreground || "#111827"; foreground.addEventListener("input", () => updateElement(item, "foreground", foreground.value));
      const background = document.createElement("input"); background.type = "color"; background.value = item.background || "#ffffff"; background.addEventListener("input", () => updateElement(item, "background", background.value));
      codeSettings.append(labeledControl("Formát", format), labeledControl("Čitelný obsah pod kódem", humanReadable), labeledControl("Barva pruhů", foreground), labeledControl("Pozadí", background));
      root.append(codeSettings);
      if (format.value === "gs1-128") { const hint = document.createElement("p"); hint.className = "field-hint"; hint.textContent = "GS1 zapisuj čitelně se závorkami: (01)09506000134352(10)LOT-42(17)270131. Závorky se nevkládají do kódu; návrhář vloží FNC1 a oddělovače automaticky."; root.append(hint); }
    } else {
      const ecc = document.createElement("select"); for (const [value, label] of [["L", "L · 7 %"], ["M", "M · 15 %"], ["Q", "Q · 25 %"], ["H", "H · 30 %"]]) { const option = document.createElement("option"); option.value = value; option.textContent = label; ecc.append(option); }
      ecc.value = item.ecc || "M"; ecc.addEventListener("change", () => updateElement(item, "ecc", ecc.value));
      const quiet = document.createElement("input"); quiet.type = "checkbox"; quiet.checked = item.quiet !== false; quiet.addEventListener("change", () => updateElement(item, "quiet", quiet.checked));
      const rounded = document.createElement("input"); rounded.type = "checkbox"; rounded.checked = !!item.rounded; rounded.addEventListener("change", () => updateElement(item, "rounded", rounded.checked));
      const foreground = document.createElement("input"); foreground.type = "color"; foreground.value = item.foreground || "#101828"; foreground.addEventListener("input", () => updateElement(item, "foreground", foreground.value));
      const background = document.createElement("input"); background.type = "color"; background.value = item.background || "#ffffff"; background.addEventListener("input", () => updateElement(item, "background", background.value));
      codeSettings.append(labeledControl("Korekce QR", ecc), labeledControl("Čistá zóna", quiet), labeledControl("Zaoblené moduly", rounded), labeledControl("Barva modulů", foreground), labeledControl("Pozadí", background));
      root.append(codeSettings);
    }
  }
  const grid = document.createElement("div"); grid.className = "inspector-grid";
  for (const [key, labelText, min, max, step] of [["x", "X · mm", 0, 210, 0.1], ["y", "Y · mm", 0, 300, 0.1], ["w", "Šířka · mm", 1, 210, 0.1], ["h", "Výška · mm", 1, 300, 0.1]]) {
    const input = document.createElement("input"); input.type = "number"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = Number(item[key]); input.addEventListener("input", () => { if (input.value !== "" && Number.isFinite(input.valueAsNumber)) updateElement(item, key, input.valueAsNumber, "number"); });
    grid.append(labeledControl(labelText, input));
  }
  root.append(grid);
  if (item.type === "text") {
    const typeGrid = document.createElement("div"); typeGrid.className = "inspector-grid";
    const font = document.createElement("input"); font.type = "number"; font.min = "1.2"; font.max = "20"; font.step = "0.1"; font.value = item.fontSize || 3; font.addEventListener("input", () => { if (font.value !== "") updateElement(item, "fontSize", font.value, "number"); });
    const align = document.createElement("select"); for (const [v, label] of [["left", "Vlevo"], ["center", "Na střed"], ["right", "Vpravo"]]) { const o = document.createElement("option"); o.value = v; o.textContent = label; align.append(o); } align.value = item.align || "left"; align.addEventListener("change", () => updateElement(item, "align", align.value));
    const bold = document.createElement("input"); bold.type = "checkbox"; bold.checked = !!item.bold; bold.addEventListener("change", () => updateElement(item, "bold", bold.checked));
    typeGrid.append(labeledControl("Velikost písma · mm", font), labeledControl("Zarovnání", align), labeledControl("Tučné písmo", bold)); root.append(typeGrid);
  }
  const hint = document.createElement("p"); hint.className = "field-hint"; hint.textContent = "Souřadnice začínají vlevo nahoře. Prvky lze posouvat přetažením v náhledu a přesně doladit zde."; root.append(hint);
}
function renderDesigner() {
  renderElementList(); renderInspector(); renderCanvas();
  $("preview-index").textContent = state.records.length ? `${state.previewIndex + 1} / ${state.records.length}` : "Ukázka / bez importu";
  $("preview-previous").disabled = !state.records.length || state.previewIndex <= 0;
  $("preview-next").disabled = !state.records.length || state.previewIndex >= state.records.length - 1;
  $("design-record-caption").textContent = state.records.length ? `Zdrojový řádek ${activeRecord()._line}` : "Ukázkový záznam — načti SAP / Excel pro reálné údaje";
}
function selectedPresetChanged() {
  const preset = LABEL_PRESETS.find((item) => item.id === $("label-preset").value); if (!preset) return;
  $("label-width-mm").value = preset.widthMm; $("label-height-mm").value = preset.heightMm; dimensionsChanged();
}
function dimensionsChanged() { if ($("label-preset").value !== "custom" && !LABEL_PRESETS.some((preset) => preset.id === $("label-preset").value && preset.widthMm === Number($("label-width-mm").value) && preset.heightMm === Number($("label-height-mm").value))) { if (![...$("label-preset").options].some((option) => option.value === "custom")) { const custom = document.createElement("option"); custom.value = "custom"; custom.textContent = "Vlastní rozměr / uložená šablona"; $("label-preset").append(custom); } $("label-preset").value = "custom"; } invalidateQuality(); renderCanvas(); $("print-size-summary").textContent = `${$("label-width-mm").value} × ${$("label-height-mm").value} mm`; }
const LAYOUT_LIBRARY_KEY = "sarzovni-den-label-layouts-v1";
function readLayoutLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAYOUT_LIBRARY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.name === "string" && Array.isArray(item.layout) && item.layout.length <= 100) : [];
  } catch { return []; }
}
function renderLayoutLibrary(selected = "") {
  const select = $("layout-library"); if (!select) return;
  const current = selected || select.value;
  select.replaceChildren();
  const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Uložené šablony…"; select.append(placeholder);
  for (const item of readLayoutLibrary()) {
    const option = document.createElement("option"); option.value = item.id; option.textContent = item.name; select.append(option);
  }
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}
function saveLayoutTemplate() {
  const name = window.prompt("Název šablony štítku:", `Šablona ${new Date().toLocaleDateString("cs-CZ")}`);
  if (name === null) return;
  const cleanName = name.trim().slice(0, 80);
  if (!cleanName) return notify("Zadej název šablony.", true);
  const library = readLayoutLibrary();
  const id = `layout-${Date.now()}`;
  library.unshift({ id, name: cleanName, savedAt: new Date().toISOString(), dimensions: currentLayoutDimensions(), layout: state.layout.map((item) => ({ ...item })) });
  try {
    localStorage.setItem(LAYOUT_LIBRARY_KEY, JSON.stringify(library.slice(0, 30)));
    renderLayoutLibrary(id); notify(`Šablona „${cleanName}“ byla uložena lokálně.`);
  } catch { notify("Šablonu se nepodařilo uložit. Zkontroluj dostupné místo v úložišti prohlížeče.", true); }
}
function loadLayoutTemplate() {
  const id = $("layout-library").value;
  const item = readLayoutLibrary().find((entry) => entry.id === id);
  if (!item) return notify("Vyber šablonu, kterou chceš načíst.", true);
  if (!item.dimensions || !Number.isFinite(Number(item.dimensions.widthMm)) || !Number.isFinite(Number(item.dimensions.heightMm)) || !Array.isArray(item.layout)) return notify("Uložená šablona je poškozená.", true);
  state.layout = item.layout.filter((element) => element && ["text", "barcode", "qr"].includes(element.type)).map((element) => ({ ...element }));
  state.selectedElementId = state.layout[0]?.id || "";
  if (![...$("label-preset").options].some((option) => option.value === "custom")) { const custom = document.createElement("option"); custom.value = "custom"; custom.textContent = "Vlastní rozměr / uložená šablona"; $("label-preset").append(custom); }
  $("label-preset").value = "custom";
  $("label-width-mm").value = item.dimensions.widthMm; $("label-height-mm").value = item.dimensions.heightMm;
  dimensionsChanged(); invalidateQuality(); renderDesigner(); notify(`Načtena šablona „${item.name}“. Před tiskem spusť kontrolu znovu.`);
}

function addElement() {
  const type = $("new-element-type").value; const n = state.layout.length + 1;
  const item = type === "text"
    ? { id: `text-${Date.now()}`, label: `Text ${n}`, type, template: "{{material}}", x: 4, y: 88, w: Math.max(12, currentLayoutDimensions().widthMm - 8), h: 12, fontSize: 3, bold: false, align: "left", enabled: true }
    : type === "qr"
      ? { id: `${type}-${Date.now()}`, label: `QR kód ${n}`, type, field: "qrContent", ecc: "M", foreground: "#101828", background: "#ffffff", quiet: true, rounded: false, x: 4, y: 92, w: 22, h: 22, fontSize: 3, bold: false, align: "center", enabled: true }
      : { id: `${type}-${Date.now()}`, label: `Čárový kód ${n}`, type, field: "generatedCode", barcodeFormat: "code128", foreground: "#111827", background: "#ffffff", humanReadable: false, x: 4, y: 92, w: Math.max(25, currentLayoutDimensions().widthMm - 8), h: 18, fontSize: 3, bold: false, align: "center", enabled: true };
  state.layout.push(item); state.selectedElementId = item.id; invalidateQuality(); renderDesigner(); notify("Prvek přidán. Umísti ho v náhledu nebo zadej přesné souřadnice.");
}
function renderQuality() {
  const dimensions = currentLayoutDimensions(); const list = $("quality-list"); list.replaceChildren();
  $("print-size-summary").textContent = `${dimensions.widthMm} × ${dimensions.heightMm} mm`;
  $("print-mode-summary").textContent = ({ sharnovni: "Šaržovní kód", barcode: "Externí čárový kód", qr: "Obsah QR" })[$("code-mode").value] || "Šaržovní kód";
  $("stat-total").textContent = String(state.records.length); $("stat-errors").textContent = String(state.quality?.errors ?? "—"); $("stat-warnings").textContent = String(state.quality?.warnings ?? "—");
  if (!state.quality) {
    $("stat-ready").textContent = "Neověřeno"; $("stat-ready").className = "stat-stale"; $("print-labels").disabled = true;
    const p = document.createElement("div"); p.className = "empty-state"; p.textContent = state.records.length ? "Spusť kontrolu, aby se ověřily kódy, rozměry a celý import." : "Nejprve importuj data a připrav štítky."; list.append(p); return;
  }
  const result = state.quality; $("stat-errors").textContent = String(result.errors); $("stat-warnings").textContent = String(result.warnings);
  const warningsAllowed = $("allow-warnings").checked;
  const canPrint = result.ready && (result.warnings === 0 || warningsAllowed);
  $("stat-ready").textContent = result.errors ? "Blokováno" : result.warnings && !warningsAllowed ? "Prověřit" : "Připraveno";
  $("stat-ready").className = result.errors ? "stat-error" : canPrint ? "stat-ok" : "stat-warning";
  $("print-labels").disabled = !canPrint;
  if (!result.issues.length) { const ok = document.createElement("div"); ok.className = "quality-ok"; ok.textContent = "✓ Kontrola dokončena. Nebyly nalezeny chyby ani upozornění."; list.append(ok); }
  for (const issue of result.issues) {
    const row = document.createElement("article"); row.className = `quality-item ${issue.severity}`;
    const icon = document.createElement("span"); icon.className = "issue-icon"; icon.textContent = issue.severity === "error" ? "!" : "i";
    const body = document.createElement("div"); const title = document.createElement("b"); title.textContent = issue.severity === "error" ? "Chyba — tisk blokován" : "Upozornění"; const message = document.createElement("p"); message.textContent = issue.message; body.append(title, message); row.append(icon, body); list.append(row);
  }
  if (result.warnings && !warningsAllowed && result.errors === 0) { const note = document.createElement("p"); note.className = "note"; note.textContent = "Tisk se zapne až po potvrzení upozornění. Potvrzení nenahrazuje fyzickou zkoušku čitelnosti."; list.append(note); }
}
function runQuality() {
  const dimensions = currentLayoutDimensions();
  state.quality = runPreflight(state.records, state.layout, dimensions, { qrEcc: "M" });
  $("allow-warnings").checked = false; renderQuality();
  if (state.quality.errors) notify(`Kontrola našla ${state.quality.errors} chyb. Tisk je zablokován.`, true);
  else if (state.quality.warnings) notify(`Kontrola dokončena: ${state.quality.warnings} upozornění.`, true);
  else notify("Kontrola kvality prošla.");
}
function svgForRecord(record) {
  const { widthMm, heightMm } = currentLayoutDimensions(); const pieces = [];
  for (const item of state.layout) {
    if (item.enabled === false) continue;
    if (item.type === "text") {
      const text = substituteTemplate(item.template, record);
      const lines = text.split(/\r?\n/).slice(0, 100);
      const anchor = item.align === "center" ? "middle" : item.align === "right" ? "end" : "start";
      const x = item.align === "center" ? Number(item.x) + Number(item.w) / 2 : item.align === "right" ? Number(item.x) + Number(item.w) : Number(item.x);
      const lineHeight = Number(item.fontSize || 3) * 1.2;
      const texts = lines.map((line, index) => `<text x="${x}" y="${Number(item.y) + Number(item.fontSize || 3) + index * lineHeight}" font-family="Arial, sans-serif" font-size="${Number(item.fontSize || 3)}" font-weight="${item.bold ? 700 : 400}" text-anchor="${anchor}">${ESC(line)}</text>`).join("");
      pieces.push(`<g>${texts}</g>`);
    } else {
      try { const parts = svgParts(itemSvgContent(item, record)); pieces.push(`<svg x="${Number(item.x)}" y="${Number(item.y)}" width="${Number(item.w)}" height="${Number(item.h)}" viewBox="${ESC(parts.viewBox)}" preserveAspectRatio="xMidYMid meet">${parts.body}</svg>`); }
      catch (error) { throw new Error(`Řádek ${record._line ?? "?"}, prvek ${item.label}: ${error.message}`); }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}" role="img" aria-label="Štítek ${ESC(record.generatedCode || record.material || "")}"><rect x="0" y="0" width="${widthMm}" height="${heightMm}" fill="#ffffff"/>${pieces.join("")}</svg>`;
}
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.style.display = "none"; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1800); }
function csvCell(value) { const text = String(value ?? ""); return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function downloadResults() {
  if (!state.records.length) return notify("Nejsou připravena žádná data.", true);
  const keys = IMPORT_FIELDS.map((field) => field.key); const custom = Object.keys(state.records[0]).filter((key) => key.startsWith("sap_")); const headers = ["Zdrojový řádek", ...IMPORT_FIELDS.map((field) => field.label), "Výsledný kód", "Chyba generování", ...custom];
  const rows = [headers, ...state.records.map((record) => [record._line, ...keys.map((key) => record[key] ?? ""), record.generatedCode, record._generationError, ...custom.map((key) => record[key] ?? "")])];
  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `kontrola-stitku-${todayIso()}.csv`); notify("Kontrolní CSV exportováno.");
}
function downloadSvgSheet() {
  if (!state.records.length) return notify("Nejsou připravena žádná data.", true);
  if (state.records.length > 500) return notify("Export je omezen na 500 štítků na jednu dávku.", true);
  try {
    const { widthMm, heightMm } = currentLayoutDimensions(); const pieces = state.records.map((record, index) => {
      const svg = svgForRecord(record); const body = svg.replace(/^.*?<svg\b[^>]*>/s, "").replace(/<\/svg>\s*$/s, "");
      return `<g transform="translate(0 ${index * heightMm})">${body}</g>`;
    });
    const result = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm * state.records.length}mm" viewBox="0 0 ${widthMm} ${heightMm * state.records.length}">${pieces.join("")}</svg>`;
    downloadBlob(new Blob([result], { type: "image/svg+xml;charset=utf-8" }), `arch-stitku-${todayIso()}.svg`); notify(`SVG arch připraven (${state.records.length} štítků).`);
  } catch (error) { notify(error.message || "Export SVG se nepodařil.", true); }
}
function printLabels() {
  if (!state.quality || !state.quality.ready || state.quality.errors || (state.quality.warnings && !$("allow-warnings").checked)) return notify("Nejdřív dokonči kontrolu kvality. Tisk zůstává zablokovaný.", true);
  let html;
  try {
    const { widthMm, heightMm } = currentLayoutDimensions();
    html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Štítky – ${todayIso()}</title><style>@page{size:${widthMm}mm ${heightMm}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,sans-serif}.label-page{width:${widthMm}mm;height:${heightMm}mm;page-break-after:always;break-after:page;overflow:hidden}.label-page:last-child{page-break-after:auto;break-after:auto}.label-page svg{display:block;width:${widthMm}mm;height:${heightMm}mm}</style></head><body>${state.records.map((record) => `<section class="label-page">${svgForRecord(record)}</section>`).join("")}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`;
  } catch (error) { return notify(error.message || "Tiskový výstup se nepodařilo sestavit.", true); }
  const printWindow = window.open("", "_blank");
  if (!printWindow) return notify("Pro tisk povol vyskakovací okna pro tuto stránku.", true);
  printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
}

// Navigation, import / clipboard / file readers.
document.querySelectorAll(".workflow-step").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
$("load-sample").addEventListener("click", () => { $("source-text").value = SAMPLE_SAP; $("delimiter").value = "\\t"; $("header-autodetect").checked = true; parseImport(); });
$("parse-import").addEventListener("click", parseImport);
$("clear-import").addEventListener("click", () => { $("source-text").value = ""; state.parsed = null; state.mapping = {}; $("mapping-panel").hidden = true; renderImportWarnings([]); $("source-stats").textContent = "Zatím žádná data."; state.hasData = false; state.records = []; invalidateQuality(); syncWorkflowButtons(); notify("Vstupní data vymazána."); });$("source-text").addEventListener("paste", (event) => {
  const html = event.clipboardData?.getData("text/html"); const tsv = parseHtmlClipboardTable(html);
  if (tsv) { event.preventDefault(); const input = event.currentTarget; const start = input.selectionStart ?? input.value.length; const end = input.selectionEnd ?? start; input.value = input.value.slice(0, start) + tsv + input.value.slice(end); input.dispatchEvent(new Event("input", { bubbles: true })); state.pasteSource = "HTML tabulka"; }
});
$("source-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    if (/\.(xlsx|xlsm)$/i.test(file.name)) $("source-text").value = await parseXlsxFile(file);
    else if (/\.xls$/i.test(file.name)) throw new Error("Starší binární .xls není podporováno offline parserem. V Excelu zvol Uložit jako → CSV UTF-8, nebo zkopíruj tabulku přes Ctrl+C.");
    else {
      const buffer = await file.arrayBuffer(); let text;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
      catch { try { text = new TextDecoder("windows-1250").decode(buffer); } catch { text = new TextDecoder().decode(buffer); } }
      $("source-text").value = text;
    }
    notify(`Načten soubor ${file.name}. Nyní analyzuj sloupce.`);
  } catch (error) { notify(error.message || "Soubor se nepodařilo přečíst.", true); }
  finally { event.target.value = ""; }
});
$("code-mode").addEventListener("change", updateImportSummary);
$("header-autodetect").addEventListener("change", () => { if ($("source-text").value.trim()) parseImport(); });
$("delimiter").addEventListener("change", () => { if ($("source-text").value.trim()) parseImport(); });
$("generation-date-mode").addEventListener("change", () => { $("manual-date-wrap").hidden = $("generation-date-mode").value !== "manual"; });
$("generation-date").value = todayIso();
$("apply-mapping").addEventListener("click", applyMapping);

// Visual label designer.
for (const preset of LABEL_PRESETS) { const option = document.createElement("option"); option.value = preset.id; option.textContent = preset.label; $("label-preset").append(option); }
$("label-preset").value = "zebra104";
$("label-preset").addEventListener("change", selectedPresetChanged);
$("label-width-mm").addEventListener("input", dimensionsChanged); $("label-height-mm").addEventListener("input", dimensionsChanged);
$("add-element").addEventListener("click", addElement);
$("reset-layout").addEventListener("click", () => { state.layout = cloneDefaultLayout(); state.selectedElementId = "main-barcode"; invalidateQuality(); renderDesigner(); notify("Výchozí rozložení obnoveno."); });
$("save-layout").addEventListener("click", saveLayoutTemplate); $("load-layout").addEventListener("click", loadLayoutTemplate); renderLayoutLibrary();
$("go-quality").addEventListener("click", () => { showView("quality"); runQuality(); });
$("preview-previous").addEventListener("click", () => { if (state.previewIndex > 0) { state.previewIndex--; renderDesigner(); } });
$("preview-next").addEventListener("click", () => { if (state.previewIndex < state.records.length - 1) { state.previewIndex++; renderDesigner(); } });
$("label-canvas").addEventListener("pointermove", (event) => {
  const drag = state.drag; if (!drag) return;
  const item = state.layout.find((entry) => entry.id === drag.id); if (!item) return;
  const dx = (event.clientX - drag.startX) / state.canvasScale, dy = (event.clientY - drag.startY) / state.canvasScale;
  if (Math.abs(dx) + Math.abs(dy) > 0.8) drag.moved = true;
  item.x = Math.round(Math.max(0, Math.min(currentLayoutDimensions().widthMm - item.w, drag.x + dx)) * 10) / 10;
  item.y = Math.round(Math.max(0, Math.min(currentLayoutDimensions().heightMm - item.h, drag.y + dy)) * 10) / 10;
  const node = $("label-canvas").querySelector(`[data-element-id="${CSS.escape(item.id)}"]`); if (node) { node.style.left = `${item.x * state.canvasScale}px`; node.style.top = `${item.y * state.canvasScale}px`; }
  invalidateQuality();
});
document.addEventListener("pointerup", () => { if (state.drag) { const id = state.drag.id; state.drag = null; state.selectedElementId = id; renderElementList(); renderInspector(); renderCanvas(); } });
document.addEventListener("pointercancel", () => { state.drag = null; });

// Print preflight and exports.
$("run-quality").addEventListener("click", runQuality);
$("allow-warnings").addEventListener("change", renderQuality);
$("print-labels").addEventListener("click", printLabels);
$("download-results").addEventListener("click", downloadResults);
$("download-svg-sheet").addEventListener("click", downloadSvgSheet);

// Initial display: a useful sample canvas, but no real data is eligible for printing.
renderReferenceTables(); syncWorkflowButtons(); renderDesigner(); renderQuality();
showView("import");
