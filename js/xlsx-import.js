/** Tiny offline OOXML reader for modern .xlsx files (first worksheet only).
 * Supports shared strings, inline strings, booleans, cached formula values and numeric cells.
 * Legacy binary .xls is intentionally not supported; use CSV or paste the grid instead.
 */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 60 * 1024 * 1024;
const decoder = new TextDecoder("utf-8");

function u16(view, offset) { return view.getUint16(offset, true); }
function u32(view, offset) { return view.getUint32(offset, true); }
function decodeXml(value) {
  return String(value ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function xmlTextRuns(xml) {
  return [...String(xml).matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
}
function attr(tag, name) {
  const match = String(tag).match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`));
  return match ? decodeXml(match[2]) : "";
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") throw new Error("Tento prohlížeč neumí rozbalit XLSX přímo. V Excelu zkopíruj tabulku nebo ji ulož jako CSV UTF-8.");
  let stream;
  try { stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")); }
  catch { throw new Error("Prohlížeč nepodporuje rozbalení XLSX. Použij kopírování tabulky z Excelu nebo export CSV UTF-8."); }
  const output = await new Response(stream).arrayBuffer();
  if (output.byteLength > MAX_UNCOMPRESSED_BYTES) throw new Error("Rozbalený XLSX soubor je příliš velký (limit 60 MB).");
  return new Uint8Array(output);
}

async function readZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer), view = new DataView(arrayBuffer);
  if (bytes.length < 22) throw new Error("Soubor není platný XLSX (ZIP hlavička chybí).");
  let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 65557); offset <= bytes.length - 22; offset++) {
    if (u32(view, offset) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) throw new Error("V XLSX se nepodařilo najít tabulku souborů ZIP.");
  const entryCount = u16(view, eocd + 10), directoryOffset = u32(view, eocd + 16);
  if (entryCount > 10000) throw new Error("XLSX obsahuje neobvykle mnoho souborů.");
  const entries = new Map();
  let offset = directoryOffset;
  for (let i = 0; i < entryCount; i++) {
    if (u32(view, offset) !== 0x02014b50) throw new Error("Poškozená tabulka souborů XLSX.");
    const method = u16(view, offset + 10), compressedSize = u32(view, offset + 20), uncompressedSize = u32(view, offset + 24);
    const nameLength = u16(view, offset + 28), extraLength = u16(view, offset + 30), commentLength = u16(view, offset + 32), localOffset = u32(view, offset + 42);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)).replaceAll("\\", "/");
    entries.set(name, { name, method, compressedSize, uncompressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return {
    async text(name) {
      const entry = entries.get(name);
      if (!entry) return null;
      if (entry.uncompressedSize > MAX_UNCOMPRESSED_BYTES) throw new Error(`Soubor ${name} v XLSX je příliš velký.`);
      const local = entry.localOffset;
      if (u32(view, local) !== 0x04034b50) throw new Error(`Poškozená XLSX položka ${name}.`);
      const nameLength = u16(view, local + 26), extraLength = u16(view, local + 28), dataStart = local + 30 + nameLength + extraLength;
      const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);
      let raw;
      if (entry.method === 0) raw = compressed;
      else if (entry.method === 8) raw = await inflateRaw(compressed);
      else throw new Error(`XLSX používá nepodporovanou kompresi (${entry.method}).`);
      return decoder.decode(raw);
    },
    names: [...entries.keys()],
  };
}

function columnIndex(cellRef) {
  const letters = String(cellRef).match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "A";
  let result = 0;
  for (const char of letters) result = result * 26 + char.charCodeAt(0) - 64;
  return result - 1;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => xmlTextRuns(match[1]));
}

function parseWorksheet(xml, sharedStrings) {
  if (!xml) throw new Error("XLSX neobsahuje čitelný první list.");
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowXml = rowMatch[2], cells = [];
    for (const cellMatch of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const tag = cellMatch[1], content = cellMatch[2], cellType = attr(tag, "t"), col = columnIndex(attr(tag, "r"));
      let value = "";
      if (cellType === "inlineStr") value = xmlTextRuns(content.match(/<is(?:\s[^>]*)?>([\s\S]*?)<\/is>/)?.[1] ?? content);
      else {
        const raw = decodeXml(content.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1] ?? "");
        if (cellType === "s") value = sharedStrings[Number(raw)] ?? "";
        else if (cellType === "b") value = raw === "1" ? "TRUE" : "FALSE";
        else if (cellType === "e") value = `#ERROR:${raw}`;
        else value = raw;
      }
      if (Number.isFinite(col) && col >= 0 && col < 16384) cells[col] = value;
    }
    if (cells.some((value) => String(value ?? "").trim() !== "")) rows.push(cells.map((value) => String(value ?? "")));
  }
  return rows;
}

function resolveFirstSheetPath(workbookXml, relsXml) {
  const sheetMatch = String(workbookXml ?? "").match(/<sheet\b[^>]*\br:id\s*=\s*(["'])(.*?)\1[^>]*\/?\s*>/);
  const relId = sheetMatch?.[2];
  if (!relId) return "xl/worksheets/sheet1.xml";
  const relation = [...String(relsXml ?? "").matchAll(/<Relationship\b([^>]*)\/?\s*>/g)].find((match) => attr(match[1], "Id") === relId);
  const target = relation ? attr(relation[1], "Target") : "";
  if (!target) return "xl/worksheets/sheet1.xml";
  if (target.startsWith("/")) return target.replace(/^\//, "");
  return target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//, "")}`;
}

function encodeTsvCell(value) {
  const text = String(value ?? "");
  return /[\t\r\n"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function parseXlsxFile(file) {
  if (!file || !/\.(xlsx|xlsm)$/i.test(file.name || "")) throw new Error("Vyber moderní soubor .xlsx nebo .xlsm. Starší .xls otevři v Excelu a ulož jako CSV UTF-8.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Soubor je větší než limit 25 MB.");
  const zip = await readZipEntries(await file.arrayBuffer());
  const workbook = await zip.text("xl/workbook.xml");
  const rels = await zip.text("xl/_rels/workbook.xml.rels");
  if (!workbook) throw new Error("Soubor nemá platnou strukturu Excel OOXML.");
  const path = resolveFirstSheetPath(workbook, rels);
  const sheet = await zip.text(path);
  const shared = parseSharedStrings(await zip.text("xl/sharedStrings.xml"));
  const rows = parseWorksheet(sheet, shared);
  if (!rows.length) throw new Error("První list v souboru neobsahuje žádné buňky.");
  return rows.map((row) => row.map(encodeTsvCell).join("\t")).join("\n");
}
