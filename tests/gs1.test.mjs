import test from "node:test";
import assert from "node:assert/strict";

import { buildCode128BarsFromValues } from "../js/code128.js";
import { gs1CheckDigit, gs1Code128Values, parseGs1ElementString } from "../js/gs1.js";
import { runPreflight } from "../js/quality.js";

const GS1 = "(01)09506000134352(10)LOT-42(17)270131";
const checksum = (values) => values.reduce((sum, value, index) => index === 0 ? value : sum + value * index, 0) % 103;

test("GS1 Mod-10 ověří kontrolní číslici GTIN", () => {
  assert.equal(gs1CheckDigit("0950600013435"), "2");
  assert.throws(() => parseGs1ElementString("(01)09506000134351"), /kontrolní číslici/);
});

test("GS1-128 vloží FNC1 na začátek a za proměnný AI před dalším prvkem", () => {
  const result = gs1Code128Values(GS1);
  assert.equal(result.values[0], 104, "Start B");
  assert.equal(result.values[1], 102, "počáteční FNC1");
  assert.equal(result.values.filter((value) => value === 102).length, 2, "oddělovač za AI (10)");
  const geometry = buildCode128BarsFromValues([...result.values, checksum(result.values), 106]);
  assert.ok(geometry.modules > 0);
  assert.ok(geometry.bars.length > 0);
});

test("AI (02) bez počtu (37) zůstane čitelný, ale hlásí vztahové upozornění", () => {
  const result = parseGs1ElementString("(02)09506000134352");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /\(37\)/);
});

test("předtisková kontrola ověří GS1-128 stejnou cestou jako náhled", () => {
  const layout = [{ id: "gs1", label: "GS1", type: "barcode", field: "barcodeContent", barcodeFormat: "gs1-128", x: 2, y: 2, w: 100, h: 25, enabled: true }];
  const result = runPreflight([{ _line: 2, generatedCode: "X", barcodeContent: GS1 }], layout, { widthMm: 104, heightMm: 40 });
  assert.equal(result.errors, 0);
});
