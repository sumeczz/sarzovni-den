import QRCode from "./vendor/qr/index.js";

const ERROR_CORRECTION = { L: 1, M: 0, Q: 3, H: 2 };

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function color(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? value : fallback;
}

function relativeLuminance(hex) {
  const channel = (offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Produces a real, self-contained SVG QR code.
 * The matrix is encoded as SVG geometry (never as plain text), so the visual
 * output and file exports use exactly the same reliable representation.
 */
export function buildQrSvg(payload, options = {}) {
  if (typeof payload !== "string" || payload.length === 0) {
    throw new Error("Zadej obsah QR kódu.");
  }

  const ecc = String(options.ecc ?? "M").toUpperCase();
  if (!Object.hasOwn(ERROR_CORRECTION, ecc)) throw new Error("Neznámá úroveň korekce QR kódu.");

  const qr = new QRCode(0, ERROR_CORRECTION[ecc]);
  qr.addData(payload);
  qr.make();

  const count = qr.getModuleCount();
  if (!Number.isInteger(count) || count < 21) {
    throw new Error("QR kód se nepodařilo správně sestavit.");
  }

  const quiet = options.quiet ?? true;
  const margin = quiet ? 4 : 0;
  const total = count + margin * 2;
  const fg = color(options.fg, "#101828");
  const bg = color(options.bg, "#ffffff");
  if (contrastRatio(fg, bg) < 3) {
    throw new Error("Kontrast barev je příliš nízký pro spolehlivé skenování. Zvol výrazně tmavší moduly a světlejší pozadí.");
  }
  const rounded = options.rounded ?? false;
  const size = clamp(options.size ?? 512, 64, 4096, 512);

  // Important: non-rounded modules must be inside an SVG <path d="...">.
  // Bare path command text inside <g> is not rendered by SVG, causing a blank QR.
  let pathData = "";
  let roundedRects = "";
  let darkModules = 0;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      darkModules++;
      const x = col + margin;
      const y = row + margin;
      if (rounded) roundedRects += `<rect x="${x}" y="${y}" width="1" height="1" rx="0.22"/>`;
      else pathData += `M${x} ${y}h1v1h-1z`;
    }
  }

  if (darkModules === 0) throw new Error("QR matice neobsahuje žádné tmavé moduly.");
  const modules = rounded ? roundedRects : `<path d="${pathData}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR kód"><rect width="${total}" height="${total}" fill="${bg}"/><g fill="${fg}">${modules}</g></svg>`;
}
