import {
  buildCode,
  canEncode,
  formatDate,
  getDayOfYear,
  getTodayInfo,
  normalizeVersion,
  plural,
  validateVersion,
} from "./core.js";
import { renderCode128 } from "./code128.js";
import {
  DEFAULT_LABEL_WIDTH_MM,
  LABEL_MARGIN_MM,
  LABEL_SIZE_PRESETS,
  MAX_LABEL_WIDTH_MM,
  MIN_BAR_HEIGHT_MM,
  MIN_LABEL_WIDTH_MM,
  MIN_MODULE_MM,
  recommendedWidthMm,
  labelGeometry,
} from "./label.js";

const $ = (id) => document.getElementById(id);
const MM_PX = 96 / 25.4;
const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatMm = (value, digits = 1) => String(round(Number(value), digits)).replace(".", ",");

const PAPER_SIZES = {
  a4: { name: "A4", widthMm: 210, heightMm: 297 },
  a5: { name: "A5", widthMm: 148, heightMm: 210 },
  a6: { name: "A6", widthMm: 105, heightMm: 148 },
  letter: { name: "Letter", widthMm: 215.9, heightMm: 279.4 },
  custom: { name: "Vlastní", widthMm: 210, heightMm: 297 },
};

const params = new URLSearchParams(location.search);
const numberOrNull = (raw) => {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const state = {
  codes: parseCodes(params.get("codes")),
  labelWidthMm: clampWidth(Number(params.get("width")) || DEFAULT_LABEL_WIDTH_MM),
  labelHeightMm: numberOrNull(params.get("height")),
  copies: clampCopies(Number(params.get("copies")) || 1),
  paperId: Object.hasOwn(PAPER_SIZES, params.get("paper")) ? params.get("paper") : "a4",
  customPaper: {
    widthMm: numberOrNull(params.get("paperWidth")) || 210,
    heightMm: numberOrNull(params.get("paperHeight")) || 297,
  },
  orientation: params.get("orientation") === "landscape" ? "landscape" : "portrait",
  pageMarginMm: 10,
  labelGapMm: 0,
  columns: 0,
  showText: true,
  showOutlines: true,
  barHeightMm: null,
  textSizeMm: null,
  printMode: "auto",
  selectedPart: "barcode",
  layout: {
    barcode: { x: null, y: null },
    text: { x: null, y: null, align: "center" },
  },
  drag: null,
  editorScale: 1,
};

const elements = {
  code: $("code"),
  info: $("info"),
  print: $("print"),
  back: $("back"),
  paperSize: $("paper-size"),
  paperCustom: $("paper-custom"),
  paperWidth: $("paper-width"),
  paperHeight: $("paper-height"),
  orientation: $("orientation"),
  pageMargin: $("page-margin"),
  printMode: $("print-mode"),
  width: $("width"),
  height: $("height"),
  presets: $("presets"),
  copies: $("copies"),
  labelGap: $("label-gap"),
  columns: $("columns"),
  barHeight: $("bar-height"),
  textSize: $("text-size"),
  textAlign: $("text-align"),
  showText: $("show-text"),
  showOutlines: $("show-outlines"),
  fixWidth: $("fix-width"),
  resetLayout: $("reset-layout"),
  manualCard: $("manual-card"),
  manualInput: $("manual-versions"),
  editorLabel: $("editor-label"),
  editorWrap: $("editor-label-wrap"),
  editorStage: $("editor-stage"),
  pages: $("pages"),
  pageCaption: $("page-caption"),
  pageSizePill: $("page-size-pill"),
  note: $("note"),
  pageRule: $("page-rule"),
};

const today = getTodayInfo();

function clampWidth(value) {
  return clamp(Math.round(value * 10) / 10, MIN_LABEL_WIDTH_MM, MAX_LABEL_WIDTH_MM);
}

function clampCopies(value) {
  return clamp(Math.round(value) || 1, 1, 200);
}

/** Kódy z adresy: buď hotový seznam, nebo jedna verze, ze které se kód složí. */
function parseCodes(raw) {
  const list = String(raw ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item !== "" && canEncode(item));
  return [...new Set(list)];
}

function paperDimensions() {
  const base = state.paperId === "custom" ? state.customPaper : PAPER_SIZES[state.paperId] || PAPER_SIZES.a4;
  return state.orientation === "landscape"
    ? { widthMm: base.heightMm, heightMm: base.widthMm }
    : { widthMm: base.widthMm, heightMm: base.heightMm };
}

function dimensions() {
  const geometry = labelGeometry(state.codes[0] || "0000000000", state.labelWidthMm);
  const labelHeight = state.labelHeightMm ?? geometry.heightMm;
  const barHeight = clamp(state.barHeightMm ?? geometry.barHeightMm, 4, Math.max(4, labelHeight - 4));
  const textSize = clamp(state.textSizeMm ?? geometry.codeTextMm, 1.2, Math.max(1.2, labelHeight - 4));
  const barWidth = Math.max(6, state.labelWidthMm - 2 * LABEL_MARGIN_MM);
  const moduleMm = barWidth / geometry.modules;
  return {
    geometry,
    labelHeight,
    barWidth,
    barHeight,
    barHeightModules: Math.max(1, Math.round(barHeight / moduleMm)),
    textSize,
    textWidth: barWidth,
    moduleMm,
  };
}

function positions(dim) {
  const margin = LABEL_MARGIN_MM;
  const textHeight = dim.textSize * 1.15;
  const autoTextY = Math.min(margin + dim.barHeight + dim.geometry.gapMm, Math.max(0, dim.labelHeight - textHeight));
  const barcode = {
    x: clamp(state.layout.barcode.x ?? margin, 0, Math.max(0, state.labelWidthMm - dim.barWidth)),
    y: clamp(state.layout.barcode.y ?? margin, 0, Math.max(0, dim.labelHeight - dim.barHeight)),
    w: dim.barWidth,
    h: dim.barHeight,
  };
  const text = {
    x: clamp(state.layout.text.x ?? margin, 0, Math.max(0, state.labelWidthMm - dim.textWidth)),
    y: clamp(state.layout.text.y ?? autoTextY, 0, Math.max(0, dim.labelHeight - textHeight)),
    w: dim.textWidth,
    h: textHeight,
    align: state.layout.text.align,
  };
  return { barcode, text };
}

function applyVars(root, dim, pos) {
  root.style.setProperty("--label-width", `${state.labelWidthMm}mm`);
  root.style.setProperty("--label-height", `${dim.labelHeight}mm`);
  root.style.setProperty("--bar-x", `${pos.barcode.x}mm`);
  root.style.setProperty("--bar-y", `${pos.barcode.y}mm`);
  root.style.setProperty("--bar-w", `${pos.barcode.w}mm`);
  root.style.setProperty("--bar-h", `${pos.barcode.h}mm`);
  root.style.setProperty("--text-x", `${pos.text.x}mm`);
  root.style.setProperty("--text-y", `${pos.text.y}mm`);
  root.style.setProperty("--text-w", `${pos.text.w}mm`);
  root.style.setProperty("--text-size", `${dim.textSize}mm`);
  root.style.setProperty("--text-align", pos.text.align);
}

function createLabel(code, dim) {
  const label = document.createElement("div");
  label.className = "label";

  const barcode = document.createElement("div");
  barcode.className = "label-barcode";
  barcode.dataset.part = "barcode";
  renderCode128(barcode, code, { barHeight: dim.barHeightModules });
  label.append(barcode);

  if (state.showText) {
    const text = document.createElement("p");
    text.className = "label-code";
    text.dataset.part = "text";
    text.textContent = code;
    label.append(text);
  }
  return label;
}

function renderPresets() {
  elements.presets.replaceChildren(
    ...LABEL_SIZE_PRESETS.map((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset";
      button.textContent = preset.name;
      button.dataset.width = String(preset.widthMm);
      button.classList.toggle("is-active", preset.widthMm === state.labelWidthMm);
      button.addEventListener("click", () => {
        state.labelWidthMm = preset.widthMm;
        elements.width.value = String(preset.widthMm);
        render();
      });
      return button;
    }),
  );
}

function renderEditor(dim) {
  const pos = positions(dim);
  const label = elements.editorLabel;
  label.replaceChildren();
  label.classList.remove("is-dragging");

  const sample = state.codes[0] || "0000000000";
  const barcode = createLabel(sample, dim).querySelector(".label-barcode");
  barcode.classList.toggle("is-selected", state.selectedPart === "barcode");
  label.append(barcode);

  const text = label.querySelector(".label-code");
  if (text) {
    text.classList.toggle("is-selected", state.selectedPart === "text");
  } else if (state.selectedPart === "text") {
    state.selectedPart = "barcode";
  }

  applyVars(label, dim, pos);

  for (const part of ["barcode", "text"]) {
    const node = label.querySelector(`[data-part="${part}"]`);
    if (!node) continue;
    node.addEventListener("pointerdown", (event) => startDrag(event, part));
  }

  fitEditor(dim);
}

function fitEditor(dim) {
  const pxWidth = state.labelWidthMm * MM_PX;
  const pxHeight = dim.labelHeight * MM_PX;
  const available = Math.max(180, elements.editorStage.clientWidth - 44);
  const scale = clamp(Math.min(available / pxWidth, 360 / pxHeight), 0.3, 3);
  state.editorScale = scale;
  elements.editorLabel.style.transform = `scale(${scale})`;
  elements.editorWrap.style.width = `${pxWidth * scale}px`;
  elements.editorWrap.style.height = `${pxHeight * scale}px`;
}

function gridFor(dim) {
  const paper = paperDimensions();
  const usableWidth = Math.max(0, paper.widthMm - 2 * state.pageMarginMm);
  const usableHeight = Math.max(0, paper.heightMm - 2 * state.pageMarginMm);
  const columns = state.columns > 0
    ? state.columns
    : Math.max(1, Math.floor((usableWidth + state.labelGapMm) / (state.labelWidthMm + state.labelGapMm)));
  const rows = Math.max(1, Math.floor((usableHeight + state.labelGapMm) / (dim.labelHeight + state.labelGapMm)));
  return { columns, rows, perPage: Math.max(1, columns * rows) };
}

function currentPageMode(count) {
  if (state.printMode === "label") return "label";
  if (state.printMode === "paper") return "paper";
  return count <= 1 ? "label" : "paper";
}

function setPageVars(page, dim, pos, mode, grid) {
  const paper = paperDimensions();
  const width = mode === "label" ? state.labelWidthMm : paper.widthMm;
  const height = mode === "label" ? dim.labelHeight : paper.heightMm;
  page.dataset.widthMm = String(width);
  page.dataset.heightMm = String(height);
  page.style.setProperty("--paper-width", `${width}mm`);
  page.style.setProperty("--paper-height", `${height}mm`);
  page.style.setProperty("--page-margin", `${mode === "label" ? 0 : state.pageMarginMm}mm`);
  page.style.setProperty("--label-gap", `${mode === "label" ? 0 : state.labelGapMm}mm`);
  page.style.setProperty("--columns", String(mode === "label" ? 1 : grid.columns));
  applyVars(page, dim, pos);
}

function renderPages(labels, dim, pos, mode, grid) {
  elements.pages.replaceChildren();
  const perPage = mode === "label" ? 1 : grid.perPage;
  const chunks = labels.length ? [] : [[]];
  for (let start = 0; start < labels.length; start += perPage) chunks.push(labels.slice(start, start + perPage));

  for (const chunk of chunks) {
    const page = document.createElement("div");
    page.className = `page${mode === "label" ? " is-label" : ""}`;
    setPageVars(page, dim, pos, mode, grid);
    for (const code of chunk) page.append(createLabel(code, dim));
    const wrap = document.createElement("div");
    wrap.className = "page-preview";
    wrap.append(page);
    elements.pages.append(wrap);
  }
}

function fitPages() {
  const available = Math.max(200, elements.pages.clientWidth - 12);
  const availableHeight = Math.max(260, window.innerHeight * 0.78);
  for (const wrap of elements.pages.querySelectorAll(".page-preview")) {
    const page = wrap.firstElementChild;
    if (!page) continue;
    const widthMm = Number(page.dataset.widthMm) || 210;
    const heightMm = Number(page.dataset.heightMm) || 297;
    const scale = clamp(
      Math.min(2, available / (widthMm * MM_PX), availableHeight / (heightMm * MM_PX)),
      0.1,
      2,
    );
    page.style.transform = `scale(${scale})`;
    wrap.style.width = `${widthMm * MM_PX * scale}px`;
    wrap.style.height = `${heightMm * MM_PX * scale}px`;
  }
}

function renderInfo(count, dim, mode, grid) {
  const codeCount = state.codes.length;
  elements.code.textContent = count
    ? codeCount === 1 && state.copies === 1
      ? state.codes[0]
      : `${plural(codeCount, ["kód", "kódy", "kódů"])} · ${plural(count, ["štítek", "štítky", "štítků"])}`
    : "Žádný kód";

  elements.print.disabled = count === 0;

  const pages = count === 0 ? 0 : mode === "label" ? count : Math.ceil(count / grid.perPage);
  const placement = mode === "label"
    ? count <= 1
      ? "stránka má velikost štítku"
      : `${count} stránek · 1 štítek na stránku`
    : `mřížka ${grid.columns} × ${grid.rows} na ${PAPER_SIZES[state.paperId].name}${state.orientation === "landscape" ? " na šířku" : ""}`;

  const summary =
    `Štítek ${formatMm(state.labelWidthMm)} × ${formatMm(dim.labelHeight)} mm · ` +
    `modul ${formatMm(dim.moduleMm, 3)} mm · ` +
    (count ? `${plural(count, ["štítek", "štítky", "štítků"])} · ${pages} ${plural(pages, ["stránka", "stránky", "stránek"])} · ` : "") +
    placement;

  const warnings = [];
  if (count && dim.moduleMm < MIN_MODULE_MM) warnings.push("modul kódu je příliš úzký, čtečka ho nemusí přečíst");
  if (count && dim.barHeight < MIN_BAR_HEIGHT_MM) warnings.push("pruhy jsou nízké, doporučujeme aspoň 6,35 mm");
  if (mode === "paper" && count) {
    const paper = paperDimensions();
    const usedWidth = grid.columns * state.labelWidthMm + Math.max(0, grid.columns - 1) * state.labelGapMm + 2 * state.pageMarginMm;
    const usedHeight = grid.rows * dim.labelHeight + Math.max(0, grid.rows - 1) * state.labelGapMm + 2 * state.pageMarginMm;
    if (usedWidth > paper.widthMm + 0.01) warnings.push("mřížka přetéká šířku papíru, sniž počet sloupců nebo šířku štítku");
    if (usedHeight > paper.heightMm + 0.01) warnings.push("řádky štítků přetékají výšku papíru, zmenši štítek nebo okraje");
  }

  elements.info.textContent = warnings.length ? `${summary} — ${warnings.join("; ")}.` : summary;
  elements.info.className = warnings.length ? "info is-warning" : "info";

  elements.fixWidth.hidden = !count || dim.moduleMm >= MIN_MODULE_MM;
  if (!elements.fixWidth.hidden) {
    const suggested = Math.min(MAX_LABEL_WIDTH_MM, recommendedWidthMm(state.codes[0]));
    const canGrow = suggested > state.labelWidthMm;
    elements.fixWidth.textContent = canGrow ? `Zvětšit štítek na ${formatMm(suggested)} mm` : "Štítek je už maximální";
    elements.fixWidth.disabled = !canGrow;
    elements.fixWidth.dataset.width = String(suggested);
  }

  elements.pageCaption.textContent = count
    ? `${pages} ${plural(pages, ["stránka", "stránky", "stránek"])} · ${plural(count, ["štítek", "štítky", "štítků"])}`
    : "Náhled";
  elements.pageSizePill.textContent = mode === "label"
    ? `Štítek ${formatMm(state.labelWidthMm)} × ${formatMm(dim.labelHeight)} mm`
    : `${PAPER_SIZES[state.paperId].name} · ${state.orientation === "landscape" ? "na šířku" : "na výšku"}`;

  elements.note.textContent =
    "V dialogu tisku vypni hlavičku a patičku (data, URL) a měřítko nech na 100 %. " +
    (mode === "label"
      ? "Stránka se vytiskne přesně o velikosti štítku."
      : "Štítky jsou rozmístěné na zvolený papír; při více kusech se stránky zalamují automaticky.");
}

function applyPageRule(mode, dim) {
  const paper = paperDimensions();
  const size = mode === "label"
    ? `${state.labelWidthMm}mm ${dim.labelHeight}mm`
    : `${paper.widthMm}mm ${paper.heightMm}mm`;
  elements.pageRule.textContent = `@page { size: ${size}; margin: 0; }`;
}

function render() {
  const dim = dimensions();
  const pos = positions(dim);
  const labels = state.codes.flatMap((code) => Array.from({ length: state.copies }, () => code));
  const mode = currentPageMode(labels.length);
  const grid = gridFor(dim);

  renderPresets();
  renderEditor(dim);
  renderPages(labels, dim, pos, mode, grid);
  renderInfo(labels.length, dim, mode, grid);
  applyPageRule(mode, dim);

  fitPages();
  requestAnimationFrame(fitPages);

  document.title = labels.length
    ? `Tisk: ${state.codes.length === 1 && state.copies === 1 ? state.codes[0] : plural(labels.length, ["štítek", "štítky", "štítků"])}`
    : "Tisk čárového kódu";
}

function updatePositionVars() {
  const dim = dimensions();
  const pos = positions(dim);
  applyVars(elements.editorLabel, dim, pos);
  elements.pages.querySelectorAll(".page").forEach((page) => applyVars(page, dim, pos));
}

function selectPart(part) {
  if (part === "text" && !state.showText) {
    state.showText = true;
    elements.showText.checked = true;
    state.selectedPart = "text";
    render();
    return;
  }
  state.selectedPart = part;
  document.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("is-active", chip.dataset.part === part));
  elements.editorLabel.querySelectorAll("[data-part]").forEach((node) => {
    node.classList.toggle("is-selected", node.dataset.part === part);
  });
}

function startDrag(event, part) {
  if (event.button !== 0) return;
  event.preventDefault();
  selectPart(part);

  const dim = dimensions();
  const pos = positions(dim);
  const current = part === "barcode" ? pos.barcode : pos.text;
  state.drag = {
    part,
    startX: event.clientX,
    startY: event.clientY,
    x: state.layout[part].x ?? current.x,
    y: state.layout[part].y ?? current.y,
    w: current.w,
    h: current.h,
    labelHeight: dim.labelHeight,
  };
  elements.editorLabel.classList.add("is-dragging");
  document.addEventListener("pointermove", onDragMove);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
}

function onDragMove(event) {
  const drag = state.drag;
  if (!drag) return;
  const perMm = MM_PX * state.editorScale;
  const snap = (value) => Math.round(value * 2) / 2;
  const dx = (event.clientX - drag.startX) / perMm;
  const dy = (event.clientY - drag.startY) / perMm;
  state.layout[drag.part].x = clamp(snap(drag.x + dx), 0, Math.max(0, state.labelWidthMm - drag.w));
  state.layout[drag.part].y = clamp(snap(drag.y + dy), 0, Math.max(0, drag.labelHeight - drag.h));
  updatePositionVars();
}

function endDrag() {
  if (!state.drag) return;
  state.drag = null;
  elements.editorLabel.classList.remove("is-dragging");
  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", endDrag);
  document.removeEventListener("pointercancel", endDrag);
}

function alignSelected(axis, align) {
  const dim = dimensions();
  const part = state.selectedPart;
  const margin = LABEL_MARGIN_MM;

  if (axis === "x") {
    if (part === "barcode") {
      const x = align === "left"
        ? margin
        : align === "right"
          ? state.labelWidthMm - margin - dim.barWidth
          : (state.labelWidthMm - dim.barWidth) / 2;
      state.layout.barcode.x = round(clamp(x, 0, Math.max(0, state.labelWidthMm - dim.barWidth)));
    } else {
      state.layout.text.x = null;
      state.layout.text.align = align;
      elements.textAlign.value = align;
    }
  } else {
    const height = part === "barcode" ? dim.barHeight : dim.textSize * 1.15;
    const y = align === "top"
      ? margin
      : align === "bottom"
        ? dim.labelHeight - margin - height
        : (dim.labelHeight - height) / 2;
    state.layout[part].y = round(clamp(y, 0, Math.max(0, dim.labelHeight - height)));
  }
  render();
}

function resetLayout() {
  state.labelHeightMm = null;
  state.barHeightMm = null;
  state.textSizeMm = null;
  state.labelGapMm = 0;
  state.columns = 0;
  state.layout = {
    barcode: { x: null, y: null },
    text: { x: null, y: null, align: "center" },
  };
  elements.height.value = "";
  elements.barHeight.value = "";
  elements.textSize.value = "";
  elements.labelGap.value = "0";
  elements.columns.value = "0";
  elements.textAlign.value = "center";
  render();
}

// ------------------------------------------------------------------ vstupy

elements.paperSize.addEventListener("change", () => {
  state.paperId = elements.paperSize.value;
  elements.paperCustom.hidden = state.paperId !== "custom";
  render();
});

for (const input of [elements.paperWidth, elements.paperHeight]) {
  input.addEventListener("input", () => {
    const value = Number(input.value);
    if (!Number.isFinite(value) || value <= 0) return;
    state.customPaper.widthMm = clamp(value, 20, 1000);
    state.customPaper.heightMm = state.customPaper.heightMm;
    if (input === elements.paperWidth) state.customPaper.widthMm = clamp(value, 20, 1000);
    else state.customPaper.heightMm = clamp(value, 20, 1000);
    render();
  });
}

elements.orientation.addEventListener("change", () => {
  state.orientation = elements.orientation.value === "landscape" ? "landscape" : "portrait";
  render();
});

elements.printMode.addEventListener("change", () => {
  state.printMode = elements.printMode.value;
  render();
});

elements.pageMargin.addEventListener("input", () => {
  const value = Number(elements.pageMargin.value);
  if (!Number.isFinite(value)) return;
  state.pageMarginMm = clamp(value, 0, 50);
  render();
});

elements.width.addEventListener("input", () => {
  if (elements.width.value === "") return;
  state.labelWidthMm = clampWidth(Number(elements.width.value));
  render();
});

elements.height.addEventListener("input", () => {
  state.labelHeightMm = elements.height.value === "" ? null : clamp(Number(elements.height.value), 8, 1000);
  render();
});

elements.copies.addEventListener("input", () => {
  if (elements.copies.value === "") return;
  state.copies = clampCopies(Number(elements.copies.value));
  render();
});

elements.labelGap.addEventListener("input", () => {
  const value = Number(elements.labelGap.value);
  if (!Number.isFinite(value)) return;
  state.labelGapMm = clamp(value, 0, 50);
  render();
});

elements.columns.addEventListener("input", () => {
  const value = Number(elements.columns.value);
  if (!Number.isFinite(value)) return;
  state.columns = Math.round(clamp(value, 0, 20));
  render();
});

elements.barHeight.addEventListener("input", () => {
  state.barHeightMm = elements.barHeight.value === "" ? null : clamp(Number(elements.barHeight.value), 4, 300);
  render();
});

elements.textSize.addEventListener("input", () => {
  state.textSizeMm = elements.textSize.value === "" ? null : clamp(Number(elements.textSize.value), 1.2, 50);
  render();
});

elements.textAlign.addEventListener("change", () => {
  state.layout.text.align = elements.textAlign.value;
  if (state.selectedPart !== "text") selectPart("text");
  render();
});

elements.showText.addEventListener("change", () => {
  state.showText = elements.showText.checked;
  if (!state.showText && state.selectedPart === "text") state.selectedPart = "barcode";
  render();
});

elements.showOutlines.addEventListener("change", () => {
  state.showOutlines = elements.showOutlines.checked;
  document.body.classList.toggle("no-outlines", !state.showOutlines);
});

elements.fixWidth.addEventListener("click", () => {
  state.labelWidthMm = clampWidth(Number(elements.fixWidth.dataset.width));
  elements.width.value = String(state.labelWidthMm);
  render();
});

elements.resetLayout.addEventListener("click", resetLayout);

document.querySelectorAll(".align-btn").forEach((button) => {
  button.addEventListener("click", () => alignSelected(button.dataset.axis, button.dataset.align));
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => selectPart(chip.dataset.part));
});

elements.print.addEventListener("click", () => window.print());

elements.back.addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.href = "popup.html";
});

window.addEventListener("resize", () => {
  fitPages();
  fitEditor(dimensions());
});

// ------------------------------------------------------------------ start

elements.width.value = String(state.labelWidthMm);
elements.height.value = state.labelHeightMm ? String(state.labelHeightMm) : "";
elements.copies.value = String(state.copies);
elements.paperSize.value = state.paperId;
elements.paperCustom.hidden = state.paperId !== "custom";
elements.paperWidth.value = String(state.customPaper.widthMm);
elements.paperHeight.value = String(state.customPaper.heightMm);
elements.orientation.value = state.orientation;
elements.pageMargin.value = String(state.pageMarginMm);
elements.printMode.value = state.printMode;
elements.labelGap.value = String(state.labelGapMm);
elements.columns.value = String(state.columns);
elements.barHeight.value = "";
elements.textSize.value = "";
elements.textAlign.value = state.layout.text.align;
elements.showText.checked = state.showText;
elements.showOutlines.checked = state.showOutlines;
document.body.classList.toggle("no-outlines", !state.showOutlines);

if (state.codes.length === 0) {
  elements.manualCard.hidden = false;
  elements.manualInput.focus();
  elements.manualInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const versions = elements.manualInput.value
      .split(/[\s,;]+/)
      .map((part) => validateVersion(part))
      .filter((check) => check.ok)
      .map((check) => check.value);
    if (versions.length === 0) {
      elements.info.textContent = "Zadej aspoň jednu platnou verzi (například 12472A).";
      elements.info.className = "info is-warning";
      return;
    }
    state.codes = versions.map((version) => buildCode(version, today.date));
    elements.manualInput.value = normalizeVersion(elements.manualInput.value);
    elements.manualCard.hidden = true;
    render();
  });
  elements.note.textContent = `Dnes je ${formatDate(today.date)}, den v roce ${getDayOfYear(today.date)}.`;
}

render();
