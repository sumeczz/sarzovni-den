/**
 * Jednorázový generátor ikon (npm run icons).
 * Kreslí PNG přímo pomocí zlib, aby projekt nemusel mít žádné závislosti.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "icons");
// 16-128 px pro rozšíření, 192 a 512 px pro PWA (maskable náboj je kreslený uvnitř)
const SIZES = [16, 32, 48, 128, 192, 512];

const BACKGROUND = [15, 23, 42]; // tmavě modrá
const FOREGROUND = [248, 250, 252]; // bílá
const ACCENT = [250, 204, 21]; // žlutá

/**
 * Šířky pruhů a mezer v modulech, začíná i končí tichou zónou.
 * Na malých velikostech se používá hrubší varianta, jinak by pruhy splynuly.
 */
const MODULES = {
  16: [2, 1, 2, 1, 1, 2, 1, 1],
  32: [2, 1, 2, 1, 1, 3, 1, 1, 2, 1, 2, 1],
  48: [2, 1, 2, 1, 1, 3, 1, 1, 2, 1, 2, 1],
  128: [2, 1, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 1, 1, 3, 1, 1, 2],
};
/** Poslední černý pruh, který se vyznačuje barvou, aby šlo poznat orientaci. */
const ACCENT_FROM_END = 5;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** @param {(x: number, y: number) => number[]} pixel barva [r, g, b] */
function encodePng(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filtr: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bitová hloubka
  ihdr[9] = 2; // typ: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Zaoblený obdélník s poloměrem r. */
function inRoundedRect(x, y, size, radius) {
  const inset = size * 0.04;
  const left = inset;
  const right = size - inset;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, left + radius), right - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

// Ikony pro PWA (192 a 512 px) musí přežít kruhové oříznutí na plošce telefonu,
// proto se u nich kreslí "maskable" varianta: obsah uvnitř bezpečného středu.
function makeIcon(size) {
  const maskable = size >= 192;
  const modules = MODULES[size] ?? MODULES[128];
  const lastBarIndex = modules.length - ACCENT_FROM_END - 1;

  // u maskable varianty se vše zmenší na 62 % a celá plocha je jednolitá barva pozadí
  const content = size * (maskable ? 0.62 : 1);
  const offset = (size - content) / 2;
  const plateLeft = offset + content * 0.06;
  const plateWidth = content * 0.88;
  const moduleWidth = plateWidth / modules.length; // tichá zóna je součástí modules
  const barTop = offset + content * 0.3;
  const barHeight = content * 0.36;
  const radius = maskable ? 0 : size * 0.22;

  // Tichá zóna čárového kódu musí být světlá, proto kreslím bílou "leteckou" lištu.
  const plateTop = Math.max(offset + content * 0.12, barTop - moduleWidth);
  const plateBottom = Math.min(offset + content * 0.88, barTop + barHeight + moduleWidth);

  return encodePng(size, (x, y) => {
    if (maskable || inRoundedRect(x + 0.5, y + 0.5, size, radius)) {
      const barX = x + 0.5;
      const barY = y + 0.5;
      if (barY >= barTop && barY < barTop + barHeight) {
        let position = 0;
        for (const [index, width] of modules.entries()) {
          const start = plateLeft + position * moduleWidth;
          const end = start + width * moduleWidth;
          if (index % 2 === 0 && barX >= start && barX < end) {
            return index === lastBarIndex ? ACCENT : BACKGROUND;
          }
          position += width;
        }
      }

      const onPlate = barY >= plateTop && barY < plateBottom && barX >= plateLeft && barX < plateLeft + plateWidth;
      return onPlate ? FOREGROUND : BACKGROUND;
    }
    return BACKGROUND;
  });
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `icon${size}.png`);
  writeFileSync(file, makeIcon(size));
  console.log(`napsáno ${file}`);
}
