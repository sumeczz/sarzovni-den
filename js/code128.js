/**
 * Code 128 (subset B) -> SVG čárový kód, bez externích závislostí.
 *
 * Tabulka šířek je převzata ze standardu ISO/IEC 15417 (viz README):
 * každý symbol tvoří 3 černé pruhy a 3 mezery o šířce 1-4 moduly,
 * součet šířek je 11 modulů (pruhy sudé, mezery liché). Stop symbol má navíc
 * 2modulový pruh, tedy 13 modulů.
 */

const START_B = 104;
const FNC1 = 102;
const STOP = 106;
const QUIET_ZONE_MODULES = 10;
const DEFAULT_BAR_HEIGHT = 50;

/** Šířky pruhů a mezer pro hodnoty 0-106 (index = hodnota symbolu). */
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "233111",
];

const STOP_TRAILING_BAR = 2;

function toWidths(pattern) {
  return pattern.split("").map(Number);
}

/**
 * @param {string} text
 * @returns {{values: number[], checksum: number}} hodnoty symbolů včetně startu, dat, kontrolní součtu a stopu
 */
export function encodeCode128B(text) {
  if (!text) {
    throw new Error("Code 128: prázdný vstup.");
  }

  const values = [START_B];
  let checksum = START_B;
  let weight = 1;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code < 32 || code > 127) {
      throw new Error(`Code 128 (subset B) neumí znak "${char}" (ASCII ${code}).`);
    }
    const value = code - 32;
    values.push(value);
    checksum += value * weight;
    weight += 1;
  }
  const checksumValue = checksum % 103;
  values.push(checksumValue, STOP);
  return { values, checksum: checksumValue };
}

/**
 * Geometrie pruhů v modulech.
 * @returns {{bars: Array<{x: number, width: number}>, modules: number, barHeight: number}}
 */
export function buildCode128BarsFromValues(values, { quietZone = QUIET_ZONE_MODULES, barHeight = DEFAULT_BAR_HEIGHT } = {}) {
  if (!Array.isArray(values) || values.length < 3) throw new Error("Code 128: chybí hodnoty symbolů.");
  const bars = [];
  let x = quietZone;

  for (const value of values) {
    for (const [index, width] of toWidths(PATTERNS[value]).entries()) {
      // sudé indexy (0, 2, 4) jsou černé pruhy
      if (index % 2 === 0) {
        bars.push({ x, width });
      }
      x += width;
    }
  }
  bars.push({ x, width: STOP_TRAILING_BAR });
  x += STOP_TRAILING_BAR;

  return { bars, modules: x + quietZone, barHeight };
}

export function buildCode128Bars(text, options = {}) {
  return buildCode128BarsFromValues(encodeCode128B(text).values, options);
}

/** SVG markup čárového kódu, přizpůsobí se šířce kontejneru. */
export function code128SvgMarkup(text, options = {}) {
  const { bars, modules, barHeight } = buildCode128Bars(text, options);
  const rects = bars
    .map((bar) => `<rect x="${bar.x}" y="0" width="${bar.width}" height="${barHeight}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules} ${barHeight}" ` +
    `preserveAspectRatio="xMidYMid meet" role="img" aria-label="Čárový kód ${escapeXml(text)}">` +
    `<rect x="0" y="0" width="${modules}" height="${barHeight}" fill="#fff"/>` +
    `<g fill="#000">${rects}</g>` +
    `</svg>`
  );
}

/** Vykreslí čárový kód do elementu (obsah elementu se nahradí). */
export function renderCode128(container, text, options = {}) {
  container.innerHTML = code128SvgMarkup(text, options);
  return container;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export { START_B, FNC1, PATTERNS as CODE128_PATTERNS };
