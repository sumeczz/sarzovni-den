/**
 * Rozměry štítku v milimetrech.
 *
 * Čárový kód se musí vytisknout v měřítku 1:1 a s dostatečně širokým modulem,
 * jinak ho čtečka nespolehlivě přečte. Proto je tady veškerá geometrie počítaná
 * v milimetrech a výpočty jsou oddělené od vykreslení, ať se dají testovat.
 */

import { buildCode128Bars } from "./code128.js";

/** A4 na výšku v milimetrech. */
export const A4 = { width: 210, height: 297 };
/** Okraj tiskárny u archu A4, když se tiskne více štítků najednou. */
export const PAGE_MARGIN_MM = 10;

/** Nejmenší přípustná šířka jednoho modulu (ISO/IEC 15417), pod tím čtečka nespolehlivě čte. */
export const MIN_MODULE_MM = 0.25;
const RECOMMENDED_MODULE_MM = 0.33;
/** Nejmenší výška pruhů, pod kterou čtečka ztrácí kontrast. */
export const MIN_BAR_HEIGHT_MM = 6.35;
const BAR_HEIGHT_RATIO = 0.2;

/** Vnitřní okraj štítku, výška písma pod kódem a mezery. */
export const LABEL_MARGIN_MM = 2;
export const CODE_TEXT_MM = 4;
export const TEXT_GAP_MM = 1.5;
/** Šířka jednoho znaku monospace písma vůči velikosti písma. */
export const CODE_TEXT_RATIO = 0.62;
export const MIN_CODE_TEXT_MM = 1.6;

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Počet modulů čárového kódu včetně tichých zón. */
export function barcodeModules(code) {
  return buildCode128Bars(code).modules;
}

/** Šířka štítku, při které má modul právě požadovanou šířku (včetně okrajů, zaokrouhleno nahoru). */
function widthForModuleMm(code, moduleMm) {
  return Math.ceil((barcodeModules(code) * moduleMm + 2 * LABEL_MARGIN_MM) * 10) / 10;
}

/** Šířka štítku, při které je čárný kód dobře čitelný. */
export function recommendedWidthMm(code) {
  return widthForModuleMm(code, RECOMMENDED_MODULE_MM);
}

/** Nejmenší šířka štítku, při které je kód ještě čitelný. */
export function minimumWidthMm(code) {
  return widthForModuleMm(code, MIN_MODULE_MM);
}

/**
 * Rozměry jednoho štítku pro kód zadané šířky.
 * @param {string} code
 * @param {number} labelWidthMm šířka štítku včetně okrajů
 */
export function labelGeometry(code, labelWidthMm) {
  const modules = barcodeModules(code);
  const barcodeWidthMm = labelWidthMm - 2 * LABEL_MARGIN_MM;
  const exactModuleMm = barcodeWidthMm / modules;
  const barHeightMm = Math.max(MIN_BAR_HEIGHT_MM, barcodeWidthMm * BAR_HEIGHT_RATIO);
  // dlouhý kód se musí pod kódem vejít do šířky štítku, jinak se písmo zmenší
  const codeTextMm = round(
    Math.min(CODE_TEXT_MM, Math.max(MIN_CODE_TEXT_MM, (barcodeWidthMm - 2) / (code.length * CODE_TEXT_RATIO))),
    2,
  );
  const heightMm = 2 * LABEL_MARGIN_MM + barHeightMm + TEXT_GAP_MM + codeTextMm;

  return {
    modules,
    barcodeWidthMm: round(barcodeWidthMm, 2),
    moduleMm: round(exactModuleMm, 3),
    barHeightMm: round(barHeightMm, 2),
    /** výška pruhů vyjádřená v modulech, aby SVG mělo správný poměr stran */
    barHeightModules: Math.round(barHeightMm / exactModuleMm),
    marginMm: LABEL_MARGIN_MM,
    gapMm: TEXT_GAP_MM,
    codeTextMm,
    widthMm: round(labelWidthMm),
    heightMm: round(heightMm, 2),
    /** modul už je moc úzký, čtečka kód nemusí přečíst */
    readable: exactModuleMm >= MIN_MODULE_MM,
    recommendedWidthMm: recommendedWidthMm(code),
    minimumWidthMm: minimumWidthMm(code),
  };
}

/**
 * Kolik štítků se vejde na arch A4 a v jaké mřížce.
 * @returns {{columns: number, rows: number, perPage: number, fits: boolean}}
 */
export function labelGrid(count, labelWidthMm, labelHeightMm, pageMarginMm = PAGE_MARGIN_MM) {
  const columns = Math.max(1, Math.floor((A4.width - 2 * pageMarginMm) / labelWidthMm));
  const rows = Math.max(1, Math.floor((A4.height - 2 * pageMarginMm) / labelHeightMm));
  const perPage = columns * rows;
  return { columns, rows, perPage, fits: count <= perPage };
}

/** CSS pravidlo @page pro tisk: buď přesně jeden štítek, nebo arch A4. */
export function pageRule({ labelWidthMm, labelHeightMm, count = 1, pageMarginMm = PAGE_MARGIN_MM }) {
  const size = count > 1 ? `${A4.width}mm ${A4.height}mm` : `${labelWidthMm}mm ${labelHeightMm}mm`;
  return `@page { size: ${size}; margin: ${count > 1 ? pageMarginMm : 0}mm; }`;
}

/**
 * Předvolby šířky štítku. Výška se pokaždé dopočítá z délky kódu, proto se
 * zadává jen šířka – tady proto není žádná výška.
 */
export const LABEL_SIZE_PRESETS = [
  { name: "60 mm", widthMm: 60 },
  { name: "50 mm", widthMm: 50 },
  { name: "70 mm", widthMm: 70 },
  { name: "100 mm", widthMm: 100 },
  { name: "125 mm", widthMm: 125 },
];

export const DEFAULT_LABEL_WIDTH_MM = 60;
export const MIN_LABEL_WIDTH_MM = 20;
export const MAX_LABEL_WIDTH_MM = 200;
