import { canEncode, validateVersion, buildCode } from "./core.js";
import { buildCode128Bars, buildCode128BarsFromValues } from "./code128.js";
import { buildQrSvg } from "./qr-svg.js";
import { elementPayload, substituteTemplate } from "./label-model.js";
import { gs1Code128Values } from "./gs1.js";

const overlapArea = (a, b) => {
  const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return width * height;
};

export function inspectLayout(layout, widthMm, heightMm) {
  const issues = [];
  const visible = layout.filter((item) => item.enabled !== false);
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    issues.push({ severity: "error", code: "label-size", message: "Rozměry štítku musí být větší než nula." });
    return issues;
  }
  for (const element of visible) {
    if (![element.x, element.y, element.w, element.h].every((value) => Number.isFinite(Number(value)))) {
      issues.push({ severity: "error", code: "element-geometry", elementId: element.id, message: `Prvek „${element.label}“ má neplatnou polohu nebo rozměr.` });
      continue;
    }
    if (element.x < 0 || element.y < 0 || element.w <= 0 || element.h <= 0 || element.x + element.w > widthMm + 0.001 || element.y + element.h > heightMm + 0.001) {
      issues.push({ severity: "error", code: "element-outside", elementId: element.id, message: `Prvek „${element.label}“ přesahuje hranice štítku ${widthMm} × ${heightMm} mm.` });
    }
    if (element.type === "text" && (Number(element.fontSize) < 1.2 || Number(element.fontSize) > 20)) {
      issues.push({ severity: "warning", code: "font-size", elementId: element.id, message: `Písmo prvku „${element.label}“ má neobvyklou velikost (${element.fontSize} mm); zkontroluj čitelnost na skutečném tisku.` });
    }
  }
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i], b = visible[j];
      const area = overlapArea(a, b);
      const smaller = Math.min(Number(a.w) * Number(a.h), Number(b.w) * Number(b.h));
      // Warn only when the overlap is material, not for touching edges.
      if (smaller > 0 && area / smaller > 0.08) {
        issues.push({ severity: "warning", code: "element-overlap", elementId: a.id, message: `Prvky „${a.label}“ a „${b.label}“ se překrývají; zkontroluj náhled.` });
      }
    }
  }
  return issues;
}

function dateFromIso(iso) {
  if (!iso) return new Date();
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(NaN);
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  return d.getFullYear() === Number(match[1]) && d.getMonth() + 1 === Number(match[2]) && d.getDate() === Number(match[3]) ? d : new Date(NaN);
}

export function createGeneratedRecords(records, options = {}) {
  const mode = options.codeMode || "sharnovni";
  const generationDate = options.date ? dateFromIso(options.date) : new Date();
  return records.map((record) => {
    const next = { ...record };
    next.generatedCode = "";
    next._generationError = "";
    if (mode === "sharnovni") {
      const check = validateVersion(record.version);
      if (!check.ok) next._generationError = check.error;
      else if (Number.isNaN(generationDate.getTime())) next._generationError = "Zvolené datum není platné.";
      else next.generatedCode = buildCode(check.value, generationDate);
    } else if (mode === "barcode") {
      next.generatedCode = String(record.barcodeContent || record.version || "").trim();
      if (!next.generatedCode) next._generationError = "Chybí externí čárový kód nebo verze.";
    } else if (mode === "qr") {
      next.generatedCode = String(record.qrContent || record.barcodeContent || record.version || "").trim();
      if (!next.generatedCode) next._generationError = "Chybí obsah QR kódu.";
    }
    return next;
  });
}

export function runPreflight(records, layout, dimensions, options = {}) {
  const issues = inspectLayout(layout, Number(dimensions.widthMm), Number(dimensions.heightMm));
  const visible = layout.filter((item) => item.enabled !== false);
  if (!records.length) issues.push({ severity: "error", code: "empty-batch", message: "Pro tisk štítků načti data v Importu SAP, nebo použij hlavní generátor kódů." });
  if (records.length > 500) issues.push({ severity: "error", code: "too-many", message: `Dávka obsahuje ${records.length} štítků; maximum v tomto pracovním režimu je 500.` });

  const codes = new Map();
  records.forEach((record, index) => {
    const rowNum = record._line ?? index + 1;
    if (record._generationError) issues.push({ severity: "error", code: "generation", row: rowNum, message: `Řádek ${rowNum}: ${record._generationError}` });
    const code = String(record.generatedCode ?? "").trim();
    if (code) {
      if (codes.has(code)) issues.push({ severity: "warning", code: "duplicate-code", row: rowNum, message: `Řádek ${rowNum}: duplicitní výsledný kód „${code}“ (poprvé na řádku ${codes.get(code)}). Záměrné duplicity mohou být v pořádku.` });
      else codes.set(code, rowNum);
    }
    for (const element of visible) {
      if (element.type === "text") {
        const text = substituteTemplate(element.template, record).trim();
        if (text && text.length > 500) issues.push({ severity: "warning", code: "text-long", row: rowNum, elementId: element.id, message: `Řádek ${rowNum}: text v prvku „${element.label}“ je dlouhý (${text.length} znaků); může se nevejít.` });
      } else if (element.type === "barcode") {
        const payload = elementPayload(element, record);
        if (!payload) {
          issues.push({ severity: "error", code: "barcode-empty", row: rowNum, elementId: element.id, message: `Řádek ${rowNum}: prvek „${element.label}“ nemá data pro čárový kód.` });
          continue;
        }
        const isGs1 = element.barcodeFormat === "gs1-128";
        if (!isGs1 && !canEncode(payload)) {
          issues.push({ severity: "error", code: "barcode-charset", row: rowNum, elementId: element.id, message: `Řádek ${rowNum}: „${element.label}“ obsahuje znaky, které současný Code 128 subset B neumí zakódovat. Zvol ASCII kód nebo QR.` });
          continue;
        }
        try {
          const gs1 = isGs1 ? gs1Code128Values(payload) : null;
          const geometry = isGs1
            ? buildCode128BarsFromValues([...gs1.values, checksumForValues(gs1.values), 106], { quietZone: 10, barHeight: 100 })
            : buildCode128Bars(payload, { quietZone: 10, barHeight: 100 });
          for (const warning of gs1?.warnings || []) issues.push({ severity: "warning", code: "gs1-relation", row: rowNum, elementId: element.id, message: `Řádek ${rowNum}: ${warning}` });
const moduleMm = Number(element.w) / geometry.modules;
if (moduleMm < 0.2) issues.push({ severity: "error", code: "barcode-module-small", row: rowNum, elementId: element.id, message: `Řádek ${rowNum}: modul čárového kódu vychází ${moduleMm.toFixed(3)} mm; pod 0,20 mm je čtení nespolehlivé. Zvětši prvek nebo použij kratší obsah.` });
else if (moduleMm < 0.33) issues.push({ severity: "warning", code: "barcode-module-recommended", row: rowNum, elementId: element.id, message: `Řádek ${rowNum}: modul čárového kódu má ${moduleMm.toFixed(3)} mm; doporučeno alespoň 0,33 mm pro robustnější čtení.` });
        } catch (error) {
          issues.push({ severity: "error", code: "barcode-invalid", row: rowNum, elementId: element.id, message: `Řádek ${rowNum}: čárový kód nelze vytvořit (${error.message}).` });
        }
      } else if (element.type === "qr") {
        const payload = elementPayload(element, record);
        if (!payload) {
          issues.push({ severity: "warning", code: "qr-empty", row: rowNum, elementId: element.id, message: `Řádek ${rowNum}: QR prvek „${element.label}“ nemá obsah; při tisku zůstane prázdný.` });
          continue;
        }
        try {
          const svg = buildQrSvg(payload, { ecc: element.ecc || options.qrEcc || "M", fg: element.foreground || options.qrForeground || "#101828", bg: element.background || options.qrBackground || "#ffffff", quiet: element.quiet !== false, rounded: !!element.rounded, size: 512 });
          const view = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
          const moduleMm = view ? Number(element.w) / Number(view[1]) : 0;
          if (moduleMm < 0.35) issues.push({ severity: "warning", code: "qr-module-small", row: rowNum, elementId: element.id, message: `Řádek ${rowNum}: QR modul vychází přibližně ${moduleMm.toFixed(2)} mm. Dlouhý obsah nebo malý QR může být na termotisku hůře čitelný.` });
        } catch (error) {
          issues.push({ severity: "error", code: "qr-invalid", row: rowNum, elementId: element.id, message: `Řádek ${rowNum}: QR kód nelze vytvořit (${error.message}).` });
        }
      }
    }
  });
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return { issues, errors, warnings, ready: errors === 0 && records.length > 0, total: records.length };
}

function checksumForValues(values) {
  return values.reduce((sum, value, index) => index === 0 ? value : sum + value * index, 0) % 103;
}
