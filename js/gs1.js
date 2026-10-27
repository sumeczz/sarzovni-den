/**
 * Nejběžnější GS1 Application Identifiers pro skladové a logistické štítky.
 * Vstup používá čitelný tvar, například (01)09506000134352(10)LOT-42(17)270131.
 */
export const GS1_APPLICATION_IDENTIFIERS = [
  { ai: "00", name: "SSCC", format: "18 číslic", fixed: 18, description: "Sériové číslo logistické jednotky" },
  { ai: "01", name: "GTIN", format: "14 číslic", fixed: 14, description: "Identifikace obchodní položky" },
  { ai: "02", name: "CONTENT", format: "14 číslic", fixed: 14, description: "GTIN položky uvnitř logistické jednotky; doplňuje se počtem (37)" },
  { ai: "10", name: "BATCH/LOT", format: "1 až 20 znaků", max: 20, description: "Šarže nebo lot" },
  { ai: "11", name: "PROD DATE", format: "YYMMDD", fixed: 6, numeric: true, description: "Datum výroby" },
  { ai: "15", name: "BEST BEFORE", format: "YYMMDD", fixed: 6, numeric: true, description: "Minimální trvanlivost" },
  { ai: "17", name: "USE BY", format: "YYMMDD", fixed: 6, numeric: true, description: "Datum spotřeby / expirace" },
  { ai: "21", name: "SERIAL", format: "1 až 20 znaků", max: 20, description: "Sériové číslo" },
  { ai: "37", name: "COUNT", format: "1 až 8 číslic", max: 8, numeric: true, description: "Počet položek v logistické jednotce" },
  { ai: "240", name: "ADDITIONAL ID", format: "1 až 30 znaků", max: 30, description: "Doplňková identifikace výrobku" },
  { ai: "241", name: "CUSTOMER PART", format: "1 až 30 znaků", max: 30, description: "Číslo dílu zákazníka" },
  { ai: "250", name: "SECONDARY SERIAL", format: "1 až 30 znaků", max: 30, description: "Sekundární sériové číslo" },
  { ai: "400", name: "ORDER NUMBER", format: "1 až 30 znaků", max: 30, description: "Číslo objednávky" },
  { ai: "414", name: "LOCATION", format: "13 číslic", fixed: 13, description: "GLN fyzické lokace" },
  { ai: "415", name: "PAYER", format: "13 číslic", fixed: 13, description: "GLN plátce" },
  { ai: "420", name: "SHIP TO POST", format: "1 až 20 znaků", max: 20, description: "Poštovní směrovací číslo cíle" },
  { ai: "422", name: "ORIGIN", format: "3 číslice", fixed: 3, numeric: true, description: "Země původu podle ISO 3166-1 numeric" },
];

const BY_AI = new Map(GS1_APPLICATION_IDENTIFIERS.map((item) => [item.ai, item]));
const CHECK_DIGIT_AIS = new Set(["00", "01", "02", "414", "415"]);

export function gs1CheckDigit(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  let sum = 0;
  for (let index = digits.length - 1, position = 1; index >= 0; index--, position++) {
    sum += Number(digits[index]) * (position % 2 === 1 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
}

/** Rozebere čitelný zápis GS1; závorky jsou pro člověka, do čárového kódu se nekódují. */
export function parseGs1ElementString(value) {
  const source = String(value ?? "").trim();
  if (!source) throw new Error("GS1-128: chybí obsah s identifikátory, například (01)09506000134352(10)LOT-42.");
  const matches = [...source.matchAll(/\((\d{2,4})\)/g)];
  if (!matches.length || source.slice(0, matches[0].index).trim()) throw new Error("GS1-128 zapisuj se závorkami u AI, například (01)09506000134352(10)LOT-42.");

  const elements = matches.map((match, index) => {
    const ai = match[1];
    const definition = BY_AI.get(ai);
    if (!definition) throw new Error(`GS1-128: AI (${ai}) tento návrhář zatím nepodporuje.`);
    const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const data = source.slice(match.index + match[0].length, end).trim();
    if (!data) throw new Error(`GS1-128: AI (${ai}) nemá hodnotu.`);
    if (definition.fixed && data.length !== definition.fixed) throw new Error(`GS1-128: AI (${ai}) vyžaduje ${definition.format}.`);
    if (definition.max && data.length > definition.max) throw new Error(`GS1-128: AI (${ai}) dovoluje nejvýše ${definition.max} znaků.`);
    if (definition.numeric && !/^\d+$/.test(data)) throw new Error(`GS1-128: AI (${ai}) obsahuje pouze číslice.`);
    if (CHECK_DIGIT_AIS.has(ai)) {
      if (!/^\d+$/.test(data) || gs1CheckDigit(data.slice(0, -1)) !== data.at(-1)) throw new Error(`GS1-128: AI (${ai}) má neplatnou kontrolní číslici.`);
    }
    if (![...data].every((character) => character.codePointAt(0) >= 32 && character.codePointAt(0) <= 126)) throw new Error(`GS1-128: AI (${ai}) obsahuje znak mimo podporovanou znakovu sadu.`);
    return { ai, data, definition };
  });

  const warnings = [];
  if (elements.some((item) => item.ai === "02") && !elements.some((item) => item.ai === "37")) warnings.push("AI (02) se na logistické jednotce obvykle uvádí společně s počtem AI (37).");
  return { elements, warnings, hri: elements.map((item) => `(${item.ai})${item.data}`).join("") };
}

/** Data pro Code 128 B s počátečním FNC1 a oddělovači za proměnnými AI. */
export function gs1Code128Values(value, { startB = 104, fnc1 = 102 } = {}) {
  const parsed = parseGs1ElementString(value);
  const values = [startB, fnc1];
  for (const [index, item] of parsed.elements.entries()) {
    for (const character of item.ai + item.data) values.push(character.codePointAt(0) - 32);
    if (!item.definition.fixed && index < parsed.elements.length - 1) values.push(fnc1);
  }
  return { ...parsed, values };
}
