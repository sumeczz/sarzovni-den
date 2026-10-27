import { buildCode128Bars, buildCode128BarsFromValues } from "./code128.js";
import { buildQrSvg } from "./qr-svg.js";
import { GS1_APPLICATION_IDENTIFIERS, gs1Code128Values } from "./gs1.js";

const $ = (id) => document.getElementById(id);
const A4 = { width: 297, height: 210 };
const escapeXml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const QR_MODES = {
  text: [{ key: "text", label: "Text nebo data", type: "textarea", value: "https://example.com" }],
  url: [{ key: "url", label: "URL adresa", type: "text", value: "https://example.com" }],
  wifi: [
    { key: "ssid", label: "Název sítě (SSID)", type: "text", value: "" },
    { key: "password", label: "Heslo", type: "text", value: "" },
    { key: "security", label: "Zabezpečení", type: "select", options: [["WPA", "WPA / WPA2"], ["WEP", "WEP"], ["nopass", "Bez hesla"]], value: "WPA" },
    { key: "hidden", label: "Skrytá síť", type: "checkbox", value: false },
  ],
  email: [
    { key: "to", label: "Komu (e-mail)", type: "text", value: "" },
    { key: "subject", label: "Předmět", type: "text", value: "" },
    { key: "body", label: "Zpráva", type: "textarea", value: "" },
  ],
  phone: [{ key: "number", label: "Telefonní číslo", type: "text", value: "+420" }],
  sms: [
    { key: "number", label: "Telefonní číslo", type: "text", value: "+420" },
    { key: "message", label: "Zpráva", type: "textarea", value: "" },
  ],
  contact: [
    { key: "firstName", label: "Jméno", type: "text", value: "" },
    { key: "lastName", label: "Příjmení", type: "text", value: "" },
    { key: "org", label: "Firma", type: "text", value: "" },
    { key: "phone", label: "Telefon", type: "text", value: "" },
    { key: "email", label: "E-mail", type: "text", value: "" },
    { key: "url", label: "Web", type: "text", value: "" },
  ],
  location: [
    { key: "lat", label: "Zeměpisná šířka", type: "text", value: "50.0875" },
    { key: "lng", label: "Zeměpisná délka", type: "text", value: "14.4213" },
  ],
};

const state = {
  kind: "qr",
  qr: { mode: "text", values: {} },
  gs1: { elements: [] },
  placements: [],
  selectedId: null,
};

const elements = {
  paneQr: $("pane-qr"),
  paneBarcode: $("pane-barcode"),
  paneGs1: $("pane-gs1"),
  qrMode: $("qr-mode"),
  qrFields: $("qr-fields"),
  qrEcc: $("qr-ecc"),
  qrSize: $("qr-size"),
  qrFg: $("qr-fg"),
  qrBg: $("qr-bg"),
  qrQuiet: $("qr-quiet"),
  qrRounded: $("qr-rounded"),
  barText: $("bar-text"),
  barCount: $("bar-count"),
  barHeight: $("bar-height"),
  barFg: $("bar-fg"),
  barBg: $("bar-bg"),
  barHuman: $("bar-human"),
  gs1Ai: $("gs1-ai"),
  gs1Description: $("gs1-description"),
  gs1Value: $("gs1-value"),
  gs1Add: $("gs1-add"),
  gs1Clear: $("gs1-clear"),
  gs1List: $("gs1-list"),
  gs1PreviewLine: $("gs1-preview-line"),
  gs1Height: $("gs1-height"),
  gs1Fg: $("gs1-fg"),
  gs1Bg: $("gs1-bg"),
  gs1Human: $("gs1-human"),
  gs1Table: $("gs1-ai-table"),
  codeWidth: $("code-width"),
  codeHeight: $("code-height"),
  miniPreview: $("mini-preview"),
  sheet: $("sheet"),
  placementCount: $("placement-count"),
  status: $("status"),
};

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${kind}`.trim();
}

/* --------------------------------------------------------------- obsah */

function qrValues() {
  if (!state.qr.values[state.qr.mode]) {
    const defaults = Object.fromEntries((QR_MODES[state.qr.mode] || []).map((field) => [field.key, field.value]));
    state.qr.values[state.qr.mode] = defaults;
  }
  return state.qr.values[state.qr.mode];
}

function escapeWifi(value) {
  return String(value ?? "").replace(/([\\;,:"])/g, "\\$1");
}

function buildQrPayload() {
  const values = qrValues();
  switch (state.qr.mode) {
    case "wifi": {
      const t = values.security || "WPA";
      const password = t === "nopass" ? "" : values.password ? `P:${escapeWifi(values.password)};` : "";
      return `WIFI:T:${t};S:${escapeWifi(values.ssid)};${password}${values.hidden ? "H:true;" : ""};`;
    }
    case "email": {
      const query = [];
      if (values.subject) query.push(`subject=${encodeURIComponent(values.subject)}`);
      if (values.body) query.push(`body=${encodeURIComponent(values.body)}`);
      return `mailto:${values.to || ""}${query.length ? `?${query.join("&")}` : ""}`;
    }
    case "phone": return `tel:${values.number || ""}`;
    case "sms": return `SMSTO:${values.number || ""}:${values.message || ""}`;
    case "contact": {
      const lines = [
        "BEGIN:VCARD", "VERSION:3.0",
        `N:${values.lastName || ""};${values.firstName || ""};;;`,
        `FN:${[values.firstName, values.lastName].filter(Boolean).join(" ")}`,
        values.org ? `ORG:${values.org}` : "",
        values.phone ? `TEL:${values.phone}` : "",
        values.email ? `EMAIL:${values.email}` : "",
        values.url ? `URL:${values.url}` : "",
        "END:VCARD",
      ].filter(Boolean);
      return lines.join("\n");
    }
    case "location": return `geo:${values.lat || ""},${values.lng || ""}`;
    default: return values.text || values.url || "";
  }
}

function gs1ElementString() {
  return state.gs1.elements.map((item) => `(${item.ai})${item.value}`).join("");
}

/* ------------------------------------------------------------- náhledy */

function barcodeMarkup(geometry, options, captionText) {
  const captionHeight = options.humanReadable ? Math.max(14, Math.round(geometry.barHeight * 0.18)) : 0;
  const totalHeight = geometry.barHeight + captionHeight;
  const caption = options.humanReadable && captionText
    ? `<text x="${geometry.modules / 2}" y="${geometry.barHeight + captionHeight * 0.78}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(9, Math.round(captionHeight * 0.62))}" fill="${options.fg}">${escapeXml(captionText)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geometry.modules} ${totalHeight}" width="${geometry.modules * 2}" height="${totalHeight * 2}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" role="img" aria-label="Čárový kód ${escapeXml(captionText)}"><rect width="${geometry.modules}" height="${totalHeight}" fill="${options.bg}"/><g fill="${options.fg}">${geometry.bars.map((bar) => `<rect x="${bar.x}" y="0" width="${bar.width}" height="${geometry.barHeight}"/>`).join("")}</g>${caption}</svg>`;
}

function barcodeGeometry(text, options) {
  const geometry = buildCode128Bars(text, { quietZone: 10, barHeight: options.height });
  return { ...geometry, caption: text };
}

function gs1Geometry(elementString, options) {
  const gs1 = gs1Code128Values(elementString);
  const values = [...gs1.values, gs1.values.reduce((sum, value, index) => index === 0 ? value : sum + value * index, 0) % 103, 106];
  const geometry = buildCode128BarsFromValues(values, { quietZone: 10, barHeight: options.height });
  return { ...geometry, caption: gs1.hri };
}

function svgFor(kind, payload, options) {
  if (!String(payload ?? "").trim()) throw new Error("Zadej obsah kódu.");
  if (kind === "qr") return buildQrSvg(payload, options);
  if (kind === "barcode") {
    const geometry = barcodeGeometry(payload, options);
    return barcodeMarkup(geometry, options, geometry.caption);
  }
  const geometry = gs1Geometry(payload, options);
  return barcodeMarkup(geometry, options, geometry.caption);
}

function generatorConfig() {
  if (state.kind === "qr") {
    return {
      kind: "qr",
      payload: buildQrPayload(),
      options: {
        ecc: elements.qrEcc.value,
        size: Number(elements.qrSize.value),
        fg: elements.qrFg.value,
        bg: elements.qrBg.value,
        quiet: elements.qrQuiet.checked,
        rounded: elements.qrRounded.checked,
      },
    };
  }
  if (state.kind === "barcode") {
    return {
      kind: "barcode",
      payload: elements.barText.value,
      options: {
        height: Number(elements.barHeight.value),
        fg: elements.barFg.value,
        bg: elements.barBg.value,
        humanReadable: elements.barHuman.checked,
      },
    };
  }
  return {
    kind: "gs1",
    payload: gs1ElementString(),
    options: {
      height: Number(elements.gs1Height.value),
      fg: elements.gs1Fg.value,
      bg: elements.gs1Bg.value,
      humanReadable: elements.gs1Human.checked,
    },
  };
}

function renderMiniPreview() {
  try {
    const config = generatorConfig();
    elements.miniPreview.innerHTML = svgFor(config.kind, config.payload, config.options);
  } catch (error) {
    elements.miniPreview.innerHTML = `<p class="mini-status">${escapeXml(error.message)}</p>`;
  }
}

/* -------------------------------------------------------------- arch A4 */

function placementSize(config) {
  if (config.kind === "qr") return { w: 32, h: 32 };
  const geometry = config.kind === "gs1" ? gs1Geometry(config.payload, config.options) : barcodeGeometry(config.payload, config.options);
  const width = clamp(geometry.modules * 0.33, 25, A4.width - 20);
  const height = clamp(config.options.height * 0.2, 10, 60);
  return { w: Math.round(width * 10) / 10, h: Math.round(height * 10) / 10 };
}

function chosenSize(config) {
  const widthText = String(elements.codeWidth.value ?? "").trim();
  const heightText = String(elements.codeHeight.value ?? "").trim();
  const width = widthText ? Number(widthText) : NaN;
  const height = heightText ? Number(heightText) : NaN;
  if (Number.isFinite(width) && Number.isFinite(height) && width >= 10 && height >= 10) {
    return { w: clamp(width, 10, A4.width), h: clamp(height, 10, A4.height) };
  }
  const fallback = placementSize(config);
  elements.codeWidth.value = String(fallback.w);
  elements.codeHeight.value = String(fallback.h);
  return fallback;
}

function selectedPlacement() {
  return state.placements.find((item) => item.id === state.selectedId) || null;
}

function syncSizeFields() {
  const placement = selectedPlacement();
  if (!placement) return;
  elements.codeWidth.value = String(placement.w);
  elements.codeHeight.value = String(placement.h);
}

function selectPlacement(id) {
  state.selectedId = id;
  syncSizeFields();
  renderSheet();
}

function applySizeInputs() {
  const placement = selectedPlacement();
  if (!placement) return;
  const width = Number(elements.codeWidth.value);
  const height = Number(elements.codeHeight.value);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 10 || height < 10) return;
  placement.w = clamp(width, 10, A4.width);
  placement.h = clamp(height, 10, A4.height);
  placement.x = clamp(placement.x, 0, A4.width - placement.w);
  placement.y = clamp(placement.y, 0, A4.height - placement.h);
  renderSheet();
}

function alignSelected(mode) {
  const placement = selectedPlacement();
  if (!placement) return setStatus("Nejdřív klikni na kód v archu, který chceš zarovnat.", "error");
  const margin = 5;
  if (mode === "left") placement.x = margin;
  else if (mode === "right") placement.x = A4.width - margin - placement.w;
  else if (mode === "center-x") placement.x = (A4.width - placement.w) / 2;
  else if (mode === "top") placement.y = margin;
  else if (mode === "bottom") placement.y = A4.height - margin - placement.h;
  else if (mode === "center-y") placement.y = (A4.height - placement.h) / 2;
  else if (mode === "next") placeNextToOther(placement);
  placement.x = Math.round(clamp(placement.x, 0, A4.width - placement.w) * 10) / 10;
  placement.y = Math.round(clamp(placement.y, 0, A4.height - placement.h) * 10) / 10;
  renderSheet();
  setStatus("Kód zarovnán.", "ok");
}

function placeNextToOther(placement) {
  const others = state.placements.filter((item) => item.id !== placement.id);
  if (!others.length) {
    placement.x = (A4.width - placement.w) / 2;
    placement.y = (A4.height - placement.h) / 2;
    return;
  }
  const centerX = placement.x + placement.w / 2;
  const centerY = placement.y + placement.h / 2;
  const nearest = others.reduce((best, item) => {
    const distance = Math.hypot(item.x + item.w / 2 - centerX, item.y + item.h / 2 - centerY);
    return !best || distance < best.distance ? { item, distance } : best;
  }, null).item;
  const gap = 2;
  let x = nearest.x + nearest.w + gap;
  let y = nearest.y;
  if (x + placement.w > A4.width - 2) { x = nearest.x; y = nearest.y + nearest.h + gap; }
  if (y + placement.h > A4.height - 2) { x = nearest.x - placement.w - gap; y = nearest.y; }
  placement.x = x;
  placement.y = y;
}

function addToSheet({ silent = false } = {}) {
  let config;
  try {
    config = generatorConfig();
    svgFor(config.kind, config.payload, config.options);
  } catch (error) {
    setStatus(error.message, "error");
    return null;
  }
  const size = chosenSize(config);
  const index = state.placements.length;
  const placement = {
    id: `code-${Date.now()}-${index}`,
    kind: config.kind,
    payload: config.payload,
    options: config.options,
    w: size.w,
    h: size.h,
    x: clamp(20 + index * 6, 0, A4.width - size.w),
    y: clamp(20 + index * 6, 0, A4.height - size.h),
  };
  state.placements.push(placement);
  state.selectedId = placement.id;
  syncSizeFields();
  renderSheet();
  if (!silent) setStatus(`Kód přidán na arch (${state.placements.length}). Přetáhni ho, kam potřebuješ.`, "ok");
  return placement;
}

function renderSheet() {
  const stage = elements.sheet.parentElement;
  const availableWidth = Math.max(320, stage.clientWidth - 36);
  const availableHeight = Math.max(260, window.innerHeight - 320);
  const scale = clamp(Math.min(availableWidth / A4.width, availableHeight / A4.height), 0.35, 2.2);
  elements.sheet.style.width = `${A4.width * scale}px`;
  elements.sheet.style.height = `${A4.height * scale}px`;
  elements.sheet.style.backgroundSize = `${10 * scale}px ${10 * scale}px`;
  elements.sheet.replaceChildren();

  for (const placement of state.placements) {
    const node = document.createElement("div");
    node.className = `sheet-item${placement.id === state.selectedId ? " selected" : ""}`;
    node.dataset.id = placement.id;
    Object.assign(node.style, {
      left: `${placement.x * scale}px`,
      top: `${placement.y * scale}px`,
      width: `${placement.w * scale}px`,
      height: `${placement.h * scale}px`,
    });
    try {
      node.innerHTML = svgFor(placement.kind, placement.payload, placement.options);
    } catch (error) {
      node.textContent = error.message;
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "item-remove";
    remove.textContent = "×";
    remove.title = "Odebrat kód";
    remove.addEventListener("pointerdown", (event) => event.stopPropagation());
    remove.addEventListener("click", (event) => { event.stopPropagation(); removePlacement(placement.id); });
    node.append(remove);
    node.addEventListener("pointerdown", (event) => startDrag(event, placement));
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.selectedId !== placement.id) selectPlacement(placement.id);
    });
    elements.sheet.append(node);
  }

  elements.placementCount.textContent = `${state.placements.length} kódů`;
  $("delete-selected").disabled = !state.selectedId;
  $("center-selected").disabled = !state.selectedId;
  document.querySelectorAll(".align-btn").forEach((button) => { button.disabled = !state.selectedId; });
}

function startDrag(event, placement) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  state.selectedId = placement.id;
  syncSizeFields();
  const scale = elements.sheet.clientWidth / A4.width;
  const start = { clientX: event.clientX, clientY: event.clientY, x: placement.x, y: placement.y };
  const target = event.currentTarget;
  target.setPointerCapture?.(event.pointerId);
  renderSheet();

  const onMove = (moveEvent) => {
    const dx = (moveEvent.clientX - start.clientX) / scale;
    const dy = (moveEvent.clientY - start.clientY) / scale;
    placement.x = Math.round(clamp(start.x + dx, 0, A4.width - placement.w) * 2) / 2;
    placement.y = Math.round(clamp(start.y + dy, 0, A4.height - placement.h) * 2) / 2;
    const current = elements.sheet.querySelector(`[data-id="${placement.id}"]`);
    if (current) {
      current.style.left = `${placement.x * scale}px`;
      current.style.top = `${placement.y * scale}px`;
    }
  };
  const onUp = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    renderSheet();
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

function centerSelected() {
  const placement = state.placements.find((item) => item.id === state.selectedId);
  if (!placement) return;
  placement.x = Math.round(((A4.width - placement.w) / 2) * 10) / 10;
  placement.y = Math.round(((A4.height - placement.h) / 2) * 10) / 10;
  renderSheet();
}

function removePlacement(id) {
  state.placements = state.placements.filter((item) => item.id !== id);
  if (state.selectedId === id) state.selectedId = state.placements.at(-1)?.id || null;
  syncSizeFields();
  renderSheet();
  setStatus("Kód odebrán z archu.");
}

function printSheet() {
  if (!state.placements.length) return setStatus("Na archu není žádný kód. Přidej ho tlačítkem „Přidat na arch +“.", "error");
  const parts = state.placements.map((placement) => {
    const svg = svgFor(placement.kind, placement.payload, placement.options);
    return `<div style="position:absolute;left:${placement.x}mm;top:${placement.y}mm;width:${placement.w}mm;height:${placement.h}mm">${svg}</div>`;
  });
  const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Arch kódů A4</title><style>@page{size:297mm 210mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}.sheet{position:relative;width:297mm;height:210mm;overflow:hidden}.sheet svg{display:block;width:100%;height:100%}</style></head><body><div class="sheet">${parts.join("")}</div><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return setStatus("Pro tisk povol vyskakovací okna.", "error");
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/* -------------------------------------------------------------- QR pole */

function renderQrFields() {
  elements.qrFields.replaceChildren();
  for (const field of QR_MODES[state.qr.mode]) {
    const label = document.createElement("label");
    label.className = "field";
    const span = document.createElement("span");
    span.textContent = field.label;
    let control;
    if (field.type === "textarea") {
      control = document.createElement("textarea");
      control.rows = 3;
      control.value = qrValues()[field.key] ?? field.value;
    } else if (field.type === "select") {
      control = document.createElement("select");
      for (const [value, text] of field.options) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        control.append(option);
      }
      control.value = qrValues()[field.key] ?? field.value;
    } else if (field.type === "checkbox") {
      control = document.createElement("input");
      control.type = "checkbox";
      control.checked = Boolean(qrValues()[field.key] ?? field.value);
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.value = qrValues()[field.key] ?? field.value;
    }
    control.dataset.key = field.key;
    control.addEventListener("input", () => {
      qrValues()[field.key] = field.type === "checkbox" ? control.checked : control.value;
      renderMiniPreview();
    });
    control.addEventListener("change", () => {
      qrValues()[field.key] = field.type === "checkbox" ? control.checked : control.value;
      renderMiniPreview();
    });
    label.append(span, control);
    elements.qrFields.append(label);
  }
}

/* -------------------------------------------------------------- GS1 AI */

function renderGs1Select() {
  elements.gs1Ai.replaceChildren();
  for (const item of GS1_APPLICATION_IDENTIFIERS) {
    const option = document.createElement("option");
    option.value = item.ai;
    option.textContent = `(${item.ai}) ${item.name} — ${item.format}`;
    elements.gs1Ai.append(option);
  }
  elements.gs1Table.replaceChildren();
  for (const item of GS1_APPLICATION_IDENTIFIERS) {
    const row = document.createElement("tr");
    for (const value of [`(${item.ai})`, item.name, `${item.format}${item.description ? ` · ${item.description}` : ""}`]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    elements.gs1Table.append(row);
  }
  updateGs1Description();
}

function updateGs1Description() {
  const item = GS1_APPLICATION_IDENTIFIERS.find((entry) => entry.ai === elements.gs1Ai.value);
  elements.gs1Description.textContent = item ? `${item.name} — ${item.format}. ${item.description}` : "";
  elements.gs1Value.placeholder = item?.format ? `Formát: ${item.format}` : "Hodnota";
}

function renderGs1List() {
  elements.gs1List.replaceChildren();
  for (const [index, item] of state.gs1.elements.entries()) {
    const row = document.createElement("li");
    row.className = "gs1-item";
    const ai = document.createElement("b");
    ai.textContent = `(${item.ai})`;
    const value = document.createElement("code");
    value.textContent = item.value;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Odebrat prvek";
    remove.addEventListener("click", () => {
      state.gs1.elements.splice(index, 1);
      renderGs1List();
      renderMiniPreview();
    });
    row.append(ai, value, remove);
    elements.gs1List.append(row);
  }
  elements.gs1PreviewLine.textContent = state.gs1.elements.length ? gs1ElementString() : "Zatím žádné prvky.";
}

function addGs1Element() {
  const ai = elements.gs1Ai.value;
  const value = elements.gs1Value.value.trim();
  if (!value) return setStatus("Zadej hodnotu pro vybraný AI.", "error");
  state.gs1.elements.push({ ai, value });
  elements.gs1Value.value = "";
  renderGs1List();
  try {
    gs1Code128Values(gs1ElementString());
    renderMiniPreview();
    setStatus(`AI (${ai}) přidán do kódu.`, "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

/* ------------------------------------------------------------- ovládání */

function setKind(kind) {
  state.kind = kind;
  document.querySelectorAll(".type-tab").forEach((button) => button.classList.toggle("active", button.dataset.kind === kind));
  elements.paneQr.hidden = kind !== "qr";
  elements.paneBarcode.hidden = kind !== "barcode";
  elements.paneGs1.hidden = kind !== "gs1";
  renderMiniPreview();
}

document.querySelectorAll(".type-tab").forEach((button) => button.addEventListener("click", () => setKind(button.dataset.kind)));
elements.qrMode.addEventListener("change", () => { state.qr.mode = elements.qrMode.value; renderQrFields(); renderMiniPreview(); });
for (const element of [elements.qrEcc, elements.qrSize, elements.qrFg, elements.qrBg, elements.qrQuiet, elements.qrRounded, elements.barHeight, elements.barFg, elements.barBg, elements.barHuman, elements.gs1Height, elements.gs1Fg, elements.gs1Bg, elements.gs1Human]) {
  element.addEventListener("input", renderMiniPreview);
  element.addEventListener("change", renderMiniPreview);
}
elements.barText.addEventListener("input", () => {
  elements.barCount.textContent = `${elements.barText.value.length} znaků`;
  renderMiniPreview();
});
elements.gs1Ai.addEventListener("change", updateGs1Description);
elements.gs1Value.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addGs1Element(); } });
elements.gs1Add.addEventListener("click", addGs1Element);
elements.gs1Clear.addEventListener("click", () => { state.gs1.elements = []; renderGs1List(); renderMiniPreview(); });
$("add-to-sheet").addEventListener("click", () => addToSheet());
elements.codeWidth.addEventListener("input", applySizeInputs);
elements.codeHeight.addEventListener("input", applySizeInputs);
document.querySelectorAll(".align-btn").forEach((button) => button.addEventListener("click", () => alignSelected(button.dataset.align)));
$("center-selected").addEventListener("click", centerSelected);
$("delete-selected").addEventListener("click", () => { if (state.selectedId) removePlacement(state.selectedId); });
$("clear-sheet").addEventListener("click", () => { state.placements = []; state.selectedId = null; renderSheet(); setStatus("Arch vyčištěn."); });
$("print-sheet").addEventListener("click", printSheet);
elements.sheet.addEventListener("pointerdown", () => { if (state.selectedId) { state.selectedId = null; renderSheet(); } });
document.addEventListener("keydown", (event) => {
  if ((event.key === "Delete" || event.key === "Backspace") && state.selectedId && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) {
    event.preventDefault();
    removePlacement(state.selectedId);
  }
});
window.addEventListener("resize", renderSheet);

renderQrFields();
renderGs1Select();
renderGs1List();
setKind("qr");
addToSheet({ silent: true });
const first = state.placements[0];
if (first) {
  first.x = Math.round(((A4.width - first.w) / 2) * 10) / 10;
  first.y = Math.round(((A4.height - first.h) / 2) * 10) / 10;
  renderSheet();
  setStatus("První kód je vycentrovaný na archu A4. Přidej další nebo ho přetáhni.", "ok");
} else {
  renderSheet();
  setStatus("Zadej obsah kódu a poté ho přidej na arch.", "error");
}
