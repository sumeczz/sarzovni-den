import test from "node:test";
import assert from "node:assert/strict";
import { buildQrSvg } from "../js/qr-svg.js";

const SAMPLE = "https://example.com";

test("výchozí QR SVG skutečně obsahuje vykreslitelnou geometrii modulů", () => {
  const svg = buildQrSvg(SAMPLE);
  assert.match(svg, /^<svg\b/);
  assert.match(svg, /<path d="M/);
  assert.match(svg, /<rect width="33" height="33" fill="#ffffff"\/>/);
  const commands = svg.match(/M\d+ \d+h1v1h-1z/g) ?? [];
  assert.ok(commands.length > 100, `čekal jsem mnoho modulů, nalezeno ${commands.length}`);
  assert.doesNotMatch(svg, /<g[^>]*>[\s\n]*M\d+/, "SVG cesty nesmí zůstat jako obyčejný text uvnitř <g>");
});

test("zaoblený QR používá skutečné SVG rect prvky", () => {
  const svg = buildQrSvg(SAMPLE, { rounded: true });
  assert.match(svg, /<rect x="\d+" y="\d+" width="1" height="1" rx="0\.22"\/>/);
  assert.doesNotMatch(svg, /<path d="M/);
});

test("velikost, barvy, korekce a čistá zóna se promítnou do SVG", () => {
  const svg = buildQrSvg(SAMPLE, { size: 1024, fg: "#123456", bg: "#fefefe", ecc: "M", quiet: false });
  assert.match(svg, /viewBox="0 0 25 25" width="1024" height="1024"/);
  assert.match(svg, /fill="#fefefe"/);
  assert.match(svg, /<g fill="#123456">/);
  assert.match(svg, /<path d="M0 0/ , "bez čisté zóny se začátek QR matice posune na souřadnici 0,0");
  const highCorrection = buildQrSvg(SAMPLE, { ecc: "H", quiet: false });
  assert.match(highCorrection, /viewBox="0 0 29 29"/ , "vyšší korekce musí být respektována při volbě velikosti matice");
});

test("QR podporuje česká data i emoji", () => {
  const svg = buildQrSvg("Příliš žluťoučký kůň 🐴");
  assert.match(svg, /<path d="M/);
  assert.ok((svg.match(/M\d+ \d+h1v1h-1z/g) ?? []).length > 100);
});

test("prázdný obsah a neplatná úroveň korekce dávají srozumitelnou chybu", () => {
  assert.throws(() => buildQrSvg(""), /Zadej obsah/);
  assert.throws(() => buildQrSvg(SAMPLE, { ecc: "X" }), /úroveň korekce/);
});

test("QR odmítne barvy s nedostatečným kontrastem místo vytvoření nečitelného obrázku", () => {
  assert.throws(() => buildQrSvg(SAMPLE, { fg: "#ffffff", bg: "#ffffff" }), /Kontrast barev je příliš nízký/);
  assert.throws(() => buildQrSvg(SAMPLE, { fg: "#777777", bg: "#888888" }), /Kontrast barev je příliš nízký/);
});

test("velmi dlouhá data se bezpečně odmítnou, když překročí kapacitu QR", () => {
  assert.throws(() => buildQrSvg("x".repeat(10000)));
});
