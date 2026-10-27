/**
 * Sdílená logika pro popup, tisk i velký kód: den v roce, sestavení kódu ze verze
 * a dne, validace verze a plánování přepočtu o půlnoci.
 *
 * "Verze" je pracovní název firmy; v SAPu se stejná hodnota označuje
 * jako "šarže dodavatele". Kód z ní a z dne v roce je "šaržovní den".
 * Pozor: "dávka" (SAP batch) je jiný údaj a do tohoto kódu nepatří.
 */

const DAY_IN_YEAR_DIGITS = 3;
const MAX_VERSION_LENGTH = 24;
const VERSION_PATTERN = /^[A-Za-z0-9]+$/;
/**
 * Počet dní od 1. 1. včetně (1-based).
 * Počítá se z kalendářních polí přes UTC, ne z uplynulých milisekund,
 * jinak by změna letního času posunula výsledek o den.
 */
export function getDayOfYear(date) {
  const year = date.getFullYear();
  const days = (Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 1)) / 86400000;
  return days + 1;
}

/** Den v roce vždy na tři místa: 1. 1. -> "001", 30. 9. 2026 -> "273". */
export function formatDayOfYear(date) {
  return String(getDayOfYear(date)).padStart(DAY_IN_YEAR_DIGITS, "0");
}

/** Poslední číslice roku: 2026 -> "6". */
export function getYearDigit(date) {
  return String(date.getFullYear()).slice(-1);
}

/** Vše, co z dnešního data potřebuje zobrazení kódu i nadpis. */
export function getTodayInfo(date = new Date()) {
  const dayOfYear = getDayOfYear(date);
  return {
    date,
    dayOfYear,
    dayString: String(dayOfYear).padStart(DAY_IN_YEAR_DIGITS, "0"),
    year: date.getFullYear(),
    yearDigit: getYearDigit(date),
    dateLabel: formatDate(date),
  };
}

/**
 * Verze + den v roce + rok, např. "12472A" + "273" + "6".
 * Doplňování dne a roku lze v nastavení dočasně vypnout.
 */
export function buildCode(version, date = new Date(), { autoDay = true, autoYear = true } = {}) {
  return `${normalizeVersion(version)}${autoDay ? formatDayOfYear(date) : ""}${autoYear ? getYearDigit(date) : ""}`;
}

/** Ořízne bílé znaky, odstraní oddělovače a převede na velká písmena (jednotná podoba kódu). */
export function normalizeVersion(version) {
  return String(version ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

/**
 * @param {string} version verze plechu (v SAPu šarže dodavatele)
 * @returns {{ok: true, value: string} | {ok: false, error: string}}
 */
export function validateVersion(version) {
  const value = normalizeVersion(version);
  if (!value) {
    return { ok: false, error: "Zadej verzi plechu." };
  }
  if (value.length > MAX_VERSION_LENGTH) {
    return { ok: false, error: `Verze je příliš dlouhá (max ${MAX_VERSION_LENGTH} znaků).` };
  }
  if (!VERSION_PATTERN.test(value)) {
    return { ok: false, error: "Verze smí obsahovat jen písmena a číslice." };
  }
  return { ok: true, value };
}

/** Kód musí jít přepsat do čárového kódu (Code 128, subset B). */
export function canEncode(text) {
  if (!text) return false;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code < 32 || code > 127) return false;
  }
  return true;
}

/**
 * Rozdělí zadaný text na verze (oddělovače jsou mezera, čárka, středník a řádek).
 * Použije se pro vygenerování více kódů najednou.
 * @returns {{versions: string[], invalid: string[]}}
 */
export function parseVersionList(text) {
  const parts = String(text ?? "")
    .split(/[\s,;]+/)
    .filter(Boolean);

  const versions = [];
  const invalid = [];
  for (const part of parts) {
    const check = validateVersion(part);
    if (check.ok) versions.push(check.value);
    else invalid.push(part);
  }
  return { versions, invalid };
}

/** Kódy pro seznam verzí a den, např. ["12472A", "12472B"] -> ["12472A2736", "12472B2736"]. */
export function buildCodes(versions, date = new Date(), options = {}) {
  return versions.map((version) => buildCode(version, date, options));
}

/** Správný tvar počtu: 1 kód, 2 kódy, 5 kódů. */
export function plural(count, [one, few, many]) {
  const abs = Math.abs(count);
  if (abs === 1) return `${count} ${one}`;
  if (abs >= 2 && abs <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

/** "30. 9. 2026" */
export function formatDate(date) {
  return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}`;
}

/** "30. 9. 14:32" */
export function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${date.getDate()}. ${date.getMonth() + 1}. ${time}`;
}

/** Milisekundy do následující lokální půlnoci. */
export function msUntilNextMidnight(date = new Date()) {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  return midnight.getTime() - date.getTime();
}

/**
 * Zavolá callback těsně po přeloužení půlnoci, aby otevřený popup přepočítal kód.
 * @param {() => void} callback
 * @param {Date} [date] výchozí čas pro první naplánování (testy)
 * @returns {() => void} zrušení plánu, platné i po prvním spuštění
 */
export function scheduleMidnightRefresh(callback, date = new Date()) {
  let timer = null;
  let cancelled = false;

  const scheduleNext = () => {
    timer = setTimeout(() => {
      if (cancelled) return;
      callback();
      scheduleNext();
    }, msUntilNextMidnight(new Date()) + 1000);
  };

  const first = setTimeout(() => {
    if (cancelled) return;
    callback();
    scheduleNext();
  }, msUntilNextMidnight(date) + 1000);
  timer = first;

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
