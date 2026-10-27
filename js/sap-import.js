/**
 * Offline parser for copied SAP GUI/Fiori grids, Excel ranges and delimited exports.
 * Does not infer that a generic SAP batch is the supplier version: CHARG/batch and
 * supplier batch (LICHA) are deliberately separate concepts.
 */
export const IMPORT_FIELDS = [
  { key: "version", label: "Verze / šarže dodavatele (LICHA)", required: true },
  { key: "material", label: "Číslo materiálu (MATNR)" },
  { key: "description", label: "Popis materiálu (MAKTX)" },
  { key: "sapBatch", label: "Dávka SAP (CHARG)" },
  { key: "vendor", label: "Dodavatel (LIFNR)" },
  { key: "vendorMaterial", label: "Materiál dodavatele (IDNLF)" },
  { key: "plant", label: "Závod (WERKS)" },
  { key: "storageLocation", label: "Skladové místo (LGORT)" },
  { key: "warehouseNumber", label: "Číslo skladu EWM (LGNUM)" },
  { key: "storageType", label: "Typ skladu (LGTYP)" },
  { key: "storageBin", label: "Skladová pozice / bin (LGPLA)" },
  { key: "handlingUnit", label: "Manipulační jednotka / HU" },
  { key: "stockType", label: "Typ zásoby" },
  { key: "specialStock", label: "Speciální zásoba" },
  { key: "quantity", label: "Množství" },
  { key: "unit", label: "Měrná jednotka (MEINS)" },
  { key: "date", label: "Datum dokladu / příjmu" },
  { key: "postingDate", label: "Datum zaúčtování (BUDAT)" },
  { key: "documentDate", label: "Datum dokladu (BLDAT)" },
  { key: "productionDate", label: "Datum výroby (HSDAT)" },
  { key: "expiryDate", label: "Expirace (VFDAT)" },
  { key: "purchaseOrder", label: "Nákupní objednávka (EBELN)" },
  { key: "purchaseOrderItem", label: "Položka objednávky (EBELP)" },
  { key: "inboundDelivery", label: "Příchozí dodávka (VBELN)" },
  { key: "materialDocument", label: "Materiálový doklad (MBLNR)" },
  { key: "documentYear", label: "Rok materiálového dokladu (MJAHR)" },
  { key: "documentItem", label: "Položka materiálového dokladu (ZEILE)" },
  { key: "movementType", label: "Druh pohybu (BWART)" },
  { key: "productionOrder", label: "Výrobní zakázka (AUFNR)" },
  { key: "reservation", label: "Rezervace (RSNUM)" },
  { key: "salesOrder", label: "Zakázka zákazníka (KDAUF)" },
  { key: "salesOrderItem", label: "Položka zakázky (KDPOS)" },
  { key: "supplierCode", label: "Kód dodavatele" },
  { key: "customerCode", label: "Kód zákazníka (KUNNR)" },
  { key: "materialGroup", label: "Skupina materiálu (MATKL)" },
  { key: "serialNumber", label: "Sériové číslo (SERNR)" },
  { key: "qrContent", label: "Obsah QR kódu" },
  { key: "barcodeContent", label: "Externí čárový kód" },
  { key: "labelName", label: "Název štítku" },
];

/** Krátký slovník pro kontrolu ručního mapování v návrháři štítků. */
export const SAP_FIELD_DESCRIPTIONS = {
  version: "Dodavatelská šarže; pro šaržovní den je to zdroj verze. Nezaměňuj s CHARG.",
  material: "Jednoznačné číslo materiálu v kmenových datech SAP.",
  description: "Krátký text nebo popis materiálu.",
  sapBatch: "Interní dávka/šarže SAP. Je odlišná od dodavatelské šarže LICHA.",
  vendor: "Dodavatel nebo jeho číslo v SAP.", vendorMaterial: "Číslo materiálu používané dodavatelem.",
  plant: "Závod nebo provoz, ve kterém je zásoba vedena.", storageLocation: "Skladové místo v závodě.",
  warehouseNumber: "Číslo skladu pro Warehouse Management/EWM.", storageType: "Typ skladového prostoru.", storageBin: "Konkrétní skladová pozice.",
  handlingUnit: "Identifikátor manipulační jednotky, například palety nebo HU.", stockType: "Kategorizace zásoby.", specialStock: "Indikátor speciální zásoby.",
  quantity: "Množství zásoby nebo pohybu.", unit: "Základní nebo zadávací měrná jednotka.",
  date: "Obecné datum z exportu; při nejasném názvu zkontroluj význam ručně.", postingDate: "Datum účetního zaúčtování pohybu.", documentDate: "Datum uvedené na dokladu.",
  productionDate: "Datum výroby nebo montáže.", expiryDate: "Datum minimální trvanlivosti nebo expirace.",
  purchaseOrder: "Číslo nákupní objednávky.", purchaseOrderItem: "Číslo položky nákupní objednávky.",
  inboundDelivery: "Číslo příchozí dodávky.", materialDocument: "Číslo materiálového dokladu.", documentYear: "Rok materiálového dokladu.", documentItem: "Číslo položky materiálového dokladu.",
  movementType: "Druh skladového pohybu.", productionOrder: "Číslo výrobní zakázky.", reservation: "Číslo rezervace.",
  salesOrder: "Číslo zákaznické zakázky.", salesOrderItem: "Položka zákaznické zakázky.", supplierCode: "Vlastní kód dodavatele z exportu.", customerCode: "Číslo zákazníka.", materialGroup: "Skupina materiálu.", serialNumber: "Sériové číslo kusu.",
  qrContent: "Obsah určený pro QR kód.", barcodeContent: "Externě dodaný obsah pro čárový kód.", labelName: "Název, který lze vytisknout na štítku.",
};

const ALIASES = {
  version: ["verze", "version", "sarz dodavatele", "sarze dodavatele", "sarz dodavatelska", "sarze dodavatelska", "dodavatelska sarze", "sarz dodavatele materialu", "supplier batch", "vendor batch", "vendor lot", "supplier lot", "lieferantencharge", "lieferanten chargennummer", "licha", "licha (sarz dodavatele)", "supplier batch number", "vendor batch number", "batch from supplier"],
  material: ["material", "material number", "material no", "material no.", "matnr", "cislo materialu", "kod materialu", "material id", "produkt", "product number", "item number", "item no", "item", "article", "article number"],
  description: ["description", "material description", "material short text", "short text", "maktx", "text materialu", "nazev materialu", "popis materialu", "material text", "kratky text", "material description short", "material description (short)", "bezeichnung", "kurztext"],
  sapBatch: ["batch", "batch number", "batch no", "batch no.", "charg", "chargenr", "sarz", "sarz materialu", "davka", "cislo sarze", "cislo davky", "lot", "lot number", "lot no", "batch id", "batch number (charg)", "chargenummer", "charge"],
  vendor: ["vendor", "supplier", "dodavatel", "vendor name", "supplier name", "lifnr", "supplier number", "vendor number", "dodavatel cislo", "cislo dodavatele", "lieferant", "creditor"],
  vendorMaterial: ["idnlf", "vendor material", "supplier material", "material number used by vendor", "dodavatelske cislo materialu", "material dodavatele", "supplier part number"],
  plant: ["plant", "werks", "zavod", "provoz", "plant code", "zavod expedice", "werk"],
  storageLocation: ["storage location", "storage loc", "stor. location", "sloc", "lgort", "skladove misto", "sklad", "umisteni skladu", "lagerort"],
  warehouseNumber: ["warehouse number", "warehouse no", "warehouse", "lgnum", "cislo skladu ewm", "warehouse management number", "wm warehouse"],
  storageType: ["storage type", "lgtyp", "typ skladu", "typ skladoveho prostoru", "lagerart"],
  storageBin: ["storage bin", "bin", "storage bin number", "lgpla", "skladova pozice", "skladova adresa", "pozice", "bin location", "lagerplatz"],
  handlingUnit: ["handling unit", "handling unit number", "hu", "exidv", "sscc", "manipulacni jednotka", "paleta", "paletovy stitek", "license plate number"],
  stockType: ["stock type", "stock category", "bestq", "typ zasoby", "typ skladu zasoba", "bestandstyp"],
  specialStock: ["special stock", "sobkz", "special stock indicator", "specialni zasoba"],
  quantity: ["quantity", "qty", "menge", "mnozstvi", "stock", "available quantity", "volne mnozstvi", "dodane mnozstvi", "zakladni mnozstvi", "entry quantity", "erfmg", "clabs", "labst", "gesme", "verfuegbarer bestand"],
  unit: ["unit", "uom", "meins", "base unit", "unit of measure", "merna jednotka", "mj", "jednotka", "entry unit", "erfme"],
  date: ["date", "datum", "posting date", "budat", "document date", "bldat", "created on", "creation date", "datum prijmu", "datum zauctovani", "vyrobni datum", "production date", "entry date", "cpudt"],
  postingDate: ["posting date", "budat", "datum zauctovani", "posting date in the document", "buchungsdatum"],
  documentDate: ["document date", "bldat", "datum dokladu", "belegdatum"],
  productionDate: ["production date", "hsdat", "date of manufacture", "datum vyroby", "herstellungsdatum"],
  expiryDate: ["expiry date", "expiration date", "shelf life expiration", "vfdat", "datum expirace", "datum spotreby", "trvanlivost do", "shelf life date", "best before", "sledovane datum"],
  purchaseOrder: ["purchase order", "purchase order number", "po number", "ebeln", "objednavka", "cislo objednavky", "nakupni objednavka", "objednavka dodavatele", "einkaufsbeleg"],
  purchaseOrderItem: ["purchase order item", "purchase order line", "ebelp", "polozka objednavky", "pol objednavky", "po item"],
  inboundDelivery: ["inbound delivery", "inbound delivery number", "inbound delivery no", "vbeln", "dodavka", "prichozi dodavka", "cislo dodavky", "lieferung"],
  materialDocument: ["material document", "material document number", "mbeln", "mblnr", "materialdok", "material document no", "materialovy doklad", "cislo materialoveho dokladu"],
  documentYear: ["document year", "fiscal year", "mjahr", "rok materialoveho dokladu", "fiscal year of material document"],
  documentItem: ["document item", "material document item", "zeile", "mb lpo", "polozka materialoveho dokladu", "doc item"],
  movementType: ["movement type", "movement type code", "bwart", "druh pohybu", "typ pohybu", "bewegungsart"],
  productionOrder: ["production order", "aufnr", "vyrobni zakazka", "manufacturing order"],
  reservation: ["reservation", "rsnum", "rezervace", "reservation number"],
  salesOrder: ["sales order", "kdauf", "zakazka zakaznika", "odberatelska objednavka"],
  salesOrderItem: ["sales order item", "kdpos", "polozka zakazky", "sales item"],
  supplierCode: ["supplier code", "supplier id", "vendor code", "dodavatel kod", "kod dodavatele", "lifnr code"],
  customerCode: ["customer", "customer number", "kunnr", "customer code", "kod zakaznika", "cislo zakaznika", "debitor"],
  materialGroup: ["material group", "matkl", "skupina materialu", "material group description"],
  serialNumber: ["serial number", "serial", "sernr", "seriove cislo", "serialno"],
  qrContent: ["qr content", "qr code", "qr data", "qr url", "url", "web address", "odkaz qr", "obsah qr", "qr payload"],
  barcodeContent: ["barcode", "barcode value", "ean", "ean 13", "ean/upc", "gtin", "external barcode", "carkovy kod", "externi kod", "kod ean"],
  labelName: ["label", "label name", "label title", "nazev stitku", "stitok", "nazev etikety", "material label"],
};

const SPECIALIZED = ["version", "vendorMaterial", "qrContent", "barcodeContent", "expiryDate", "postingDate", "documentDate", "productionDate", "purchaseOrderItem", "purchaseOrder", "inboundDelivery", "materialDocument", "documentYear", "documentItem", "movementType", "productionOrder", "reservation", "salesOrderItem", "salesOrder", "customerCode", "supplierCode", "warehouseNumber", "storageType", "storageBin", "handlingUnit", "stockType", "specialStock", "materialGroup", "serialNumber", "description", "storageLocation", "quantity", "unit", "material", "vendor", "plant", "date", "sapBatch", "labelName"];
const FOOTER_START = /^(total|grand total|subtotal|celkem|součet|soucet|počet záznamů|pocet zaznamu|výsledek|vysledek|no\. of entries|number of entries|záznamů celkem|zaznamu celkem)\b/i;

export function normalizeImportHeader(value) {
  return String(value ?? "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[_/\\()[\]{}:.,;]+/g, " ")
    .replace(/\s+/g, " ").trim();
}

function delimiterCounts(line) {
  const counts = { "\t": 0, ";": 0, ",": 0, "|": 0 };
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && Object.hasOwn(counts, ch)) counts[ch]++;
  }
  return counts;
}

export function detectDelimiter(text) {
  const lines = String(text ?? "").replace(/^\uFEFF/, "").split(/\r\n|\n|\r/).filter((line) => line.trim()).slice(0, 30);
  if (!lines.length) return { delimiter: "\t", name: "tabulátor", kind: "delimited" };
  const sums = { "\t": 0, ";": 0, ",": 0, "|": 0 };
  for (const line of lines) {
    const counts = delimiterCounts(line);
    for (const delimiter of Object.keys(sums)) sums[delimiter] += counts[delimiter];
  }
  const winner = Object.entries(sums).sort((a, b) => b[1] - a[1])[0];
  if (winner[1] > 0) {
    const names = { "\t": "tabulátor (SAP / Excel)", ";": "středník (CSV CZ/EU)", ",": "čárka (CSV)", "|": "svislá čára" };
    return { delimiter: winner[0], name: names[winner[0]], kind: "delimited" };
  }
  // Best-effort for SAP spool/list text where columns are separated by runs of spaces.
  const spaced = lines.filter((line) => /\S\s{2,}\S/.test(line)).length;
  if (spaced >= Math.min(2, lines.length)) return { delimiter: null, name: "mezery / textový výpis", kind: "fixed" };
  return { delimiter: "\t", name: "jeden sloupec", kind: "single" };
}

export function parseDelimited(text, delimiter = "\t") {
  const input = String(text ?? "").replace(/^\uFEFF/, "").replace(/\0/g, "");
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) quoted = false;
      else if (cell.length === 0) quoted = true;
      else cell += ch;
    } else if (!quoted && ch === delimiter) {
      row.push(cell); cell = "";
    } else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }
  return rows.map((cells) => cells.map((cellValue) => String(cellValue ?? "").replace(/\u00a0/g, " ").trim()));
}

function parseFixedWidth(text) {
  const lines = String(text ?? "").replace(/^\uFEFF/, "").replace(/\0/g, "").split(/\r\n|\n|\r/).filter((line) => line.trim());
  return lines.map((line) => line.trim().split(/\s{2,}/).map((v) => v.trim())).filter((row) => row.some(Boolean));
}

function aliasField(value) {
  const normalized = normalizeImportHeader(value);
  if (!normalized) return null;
  // Exact, specific aliases take precedence. Generic SAP batch/charge is never the version.
  for (const key of SPECIALIZED) {
    const aliases = ALIASES[key] || [];
    if (aliases.some((alias) => normalized === normalizeImportHeader(alias))) return key;
  }
  // Handle common appended technical names, e.g. "Supplier batch (LICHA)".
  if (/\b(licha|supplier batch|vendor batch|sarz dodavatele|verze)\b/.test(normalized)) return "version";
  const technical = [
    [/\b(charg|chargenr|batch|lot|davka|sarz)\b/, "sapBatch"], [/\b(matnr)\b/, "material"], [/\b(maktx)\b/, "description"],
    [/\b(werks)\b/, "plant"], [/\b(lgort)\b/, "storageLocation"], [/\b(lgnum)\b/, "warehouseNumber"], [/\b(lgtyp)\b/, "storageType"], [/\b(lgpla)\b/, "storageBin"],
    [/\b(lifnr)\b/, "vendor"], [/\b(idnlf)\b/, "vendorMaterial"], [/\b(menge|erfmg|clabs|labst|gesme)\b/, "quantity"], [/\b(meins|erfme)\b/, "unit"],
    [/\b(vfdat)\b/, "expiryDate"], [/\b(hsdat)\b/, "productionDate"], [/\b(budat)\b/, "postingDate"], [/\b(bldat)\b/, "documentDate"],
    [/\b(ebeln)\b/, "purchaseOrder"], [/\b(ebelp)\b/, "purchaseOrderItem"], [/\b(vbeln)\b/, "inboundDelivery"], [/\b(mblnr)\b/, "materialDocument"],
    [/\b(mjahr)\b/, "documentYear"], [/\b(zeile)\b/, "documentItem"], [/\b(bwart)\b/, "movementType"], [/\b(aufnr)\b/, "productionOrder"], [/\b(rsnum)\b/, "reservation"],
    [/\b(kdauf)\b/, "salesOrder"], [/\b(kdpos)\b/, "salesOrderItem"], [/\b(kunnr)\b/, "customerCode"], [/\b(matkl)\b/, "materialGroup"], [/\b(sernr)\b/, "serialNumber"],
  ];
  for (const [pattern, field] of technical) if (pattern.test(normalized)) return field;
  return null;
}

export function findHeaderRow(matrix, scanRows = 12) {
  let best = { index: -1, score: 0, matches: {} };
  for (let i = 0; i < Math.min(matrix.length, scanRows); i++) {
    const cells = matrix[i];
    const matches = {};
    for (let j = 0; j < cells.length; j++) {
      const field = aliasField(cells[j]);
      if (field && matches[field] === undefined) matches[field] = j;
    }
    const uniqueCount = Object.keys(matches).length;
    const score = uniqueCount * 10 + Math.min(cells.filter((cell) => String(cell).trim()).length, 12) / 10;
    // Require at least 2 recognized fields except an unambiguous standalone Version header.
    const loneVersion = uniqueCount === 1 && matches.version === 0 && normalizeImportHeader(cells[0]) === "verze";
    if ((uniqueCount >= 2 || loneVersion) && score > best.score) best = { index: i, score, matches };
  }
  return best.index >= 0 ? best : null;
}

export function autoMapHeaders(headers) {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map(({ key }) => [key, null]));
  const usedColumns = new Set();
  for (let col = 0; col < headers.length; col++) {
    const field = aliasField(headers[col]);
    if (field && !usedColumns.has(col) && mapping[field] === null) {
      mapping[field] = col;
      usedColumns.add(col);
    }
  }
  return mapping;
}

function looksLikeRepeatedHeader(row, headers) {
  if (!headers.length) return false;
  let matches = 0, filled = 0;
  for (let i = 0; i < Math.min(row.length, headers.length); i++) {
    if (!String(row[i] ?? "").trim()) continue;
    filled++;
    if (normalizeImportHeader(row[i]) === normalizeImportHeader(headers[i])) matches++;
  }
  return filled > 0 && matches >= Math.min(2, filled) && matches / filled >= 0.6;
}

function isFooter(row) {
  return FOOTER_START.test(String(row[0] ?? "").trim());
}

/** Parse common SAP ALV/Fiori clipboard tables and Excel/CSV/TSV. No data leaves the browser. */
export function parseSapTable(text, options = {}) {
  const source = String(text ?? "");
  if (!source.trim()) throw new Error("Vlož tabulku ze SAPu/Excelu nebo načti soubor CSV, TSV či TXT.");
  const detected = options.delimiter && options.delimiter !== "auto"
    ? { delimiter: options.delimiter === "fixed" ? null : options.delimiter, name: options.delimiter === "fixed" ? "mezery / textový výpis" : "ručně zvolený oddělovač", kind: options.delimiter === "fixed" ? "fixed" : "delimited" }
    : detectDelimiter(source);
  let matrix;
  if (detected.kind === "fixed") matrix = parseFixedWidth(source);
  else matrix = parseDelimited(source, detected.delimiter || "\t");
  if (!matrix.length) throw new Error("Ve vstupu se nenašly žádné datové řádky.");

  const header = options.hasHeader === false ? null : findHeaderRow(matrix);
  const hasHeader = options.hasHeader === true ? true : Boolean(header);
  let headerIndex = hasHeader ? (header?.index ?? 0) : -1;
  if (options.hasHeader === true && !header) headerIndex = 0;
  const width = Math.max(...matrix.map((row) => row.length));
  const headers = hasHeader
    ? Array.from({ length: width }, (_, col) => (matrix[headerIndex]?.[col]?.trim() || `Sloupec ${col + 1}`))
    : Array.from({ length: width }, (_, col) => `Sloupec ${col + 1}`);
  const rawRows = matrix.slice(hasHeader ? headerIndex + 1 : 0)
    .map((cells, offset) => ({ line: (hasHeader ? headerIndex + 2 : 1) + offset, cells: Array.from({ length: width }, (_, i) => String(cells[i] ?? "").trim()) }))
    .filter(({ cells }) => cells.some((cell) => cell !== ""))
    .filter(({ cells }) => !isFooter(cells))
    .filter(({ cells }) => !hasHeader || !looksLikeRepeatedHeader(cells, headers));

  const mapping = hasHeader ? autoMapHeaders(headers) : Object.fromEntries(IMPORT_FIELDS.map(({ key }) => [key, null]));
  const warnings = [];
  if (detected.kind === "fixed") warnings.push("Textový výpis rozdělený mezerami se parsuje orientačně; zkontroluj náhled sloupců a jejich mapování.");
  if (!hasHeader) warnings.push("Hlavička nebyla rozpoznána. Sloupce je potřeba namapovat ručně, aby se nespletla dávka SAP s šarží dodavatele.");
  if (headerIndex > 0) warnings.push(`Před hlavičkou bylo přeskočeno ${headerIndex} úvodních řádků (název sestavy / filtry SAP).`);
  if (mapping.version === null) warnings.push("Nenašel se jednoznačný sloupec Verze / šarže dodavatele. Obecný sloupec Batch/CHARG se záměrně nepoužil jako verze.");
  return { rows: rawRows, headers, mapping, headerIndex, hasHeader, delimiter: detected.delimiter, delimiterName: detected.name, kind: detected.kind, warnings, sourceRowCount: matrix.length };
}

/** Return mapped business fields without changing the original source cells. */
export function mapImportRows(parsed, mapping = parsed.mapping) {
  return parsed.rows.map(({ line, cells }) => {
    const record = { _line: line, _raw: cells.slice() };
    for (const { key } of IMPORT_FIELDS) {
      const index = mapping[key];
      record[key] = index === null || index === undefined || index === "" ? "" : String(cells[Number(index)] ?? "").trim();
    }
    return record;
  });
}

export function detectDateFormat(value) {
  const text = String(value ?? "").trim();
  if (!text) return { valid: false, date: null, reason: "Datum není vyplněné." };
  let match;
  // ISO date or timestamp; keep date-only semantics to avoid timezone shifts.
  if ((match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/))) {
    const [, y, m, d] = match;
    return checkedDate(Number(y), Number(m), Number(d));
  }
  // Czech / European D.M.YYYY, D/M/YYYY, D-M-YYYY
  if ((match = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\.?$/))) {
    const [, d, m, year] = match;
    const y = Number(year.length === 2 ? (Number(year) >= 70 ? `19${year}` : `20${year}`) : year);
    return checkedDate(y, Number(m), Number(d));
  }
  // SAP commonly exports YYYYMMDD as text.
  if ((match = text.match(/^(\d{4})(\d{2})(\d{2})$/))) return checkedDate(Number(match[1]), Number(match[2]), Number(match[3]));
  // Excel serial date, valid for the common range 1900–9999; may be passed as text.
  if (/^\d{5}(?:[.,]\d+)?$/.test(text)) {
    const serial = Number(text.replace(",", "."));
    if (serial >= 1 && serial <= 2958465) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      return checkedDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
  }
  return { valid: false, date: null, reason: "Formát data nebyl rozpoznán." };
}

function checkedDate(year, month, day) {
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  const valid = Number.isInteger(year) && year >= 1900 && year <= 9999 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? { valid: true, date, iso: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` } : { valid: false, date: null, reason: "Datum neexistuje v kalendáři." };
}
