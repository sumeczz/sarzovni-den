import test from "node:test";
import assert from "node:assert/strict";

import {
  A4,
  CODE_TEXT_MM,
  CODE_TEXT_RATIO,
  DEFAULT_LABEL_WIDTH_MM,
  LABEL_MARGIN_MM,
  LABEL_SIZE_PRESETS,
  MAX_LABEL_WIDTH_MM,
  MIN_BAR_HEIGHT_MM,
  MIN_CODE_TEXT_MM,
  MIN_LABEL_WIDTH_MM,
  MIN_MODULE_MM,
  TEXT_GAP_MM,
  barcodeModules,
  labelGeometry,
  labelGrid,
  minimumWidthMm,
  pageRule,
  recommendedWidthMm,
} from "../js/label.js";

const CODE = "12472A2736";
const LONG_CODE = "1234567890123456789012342736";

test("počet modulů odpovídá kódu včetně tichých zón", () => {
  // 10 znaků + start + součet + stop = 13 symbolů po 11 modulech, plus 2modulová lišta a tiché zóny
  assert.equal(barcodeModules(CODE), 13 * 11 + 2 + 20);
  assert.equal(barcodeModules("A"), 4 * 11 + 2 + 20);
  assert.ok(barcodeModules(LONG_CODE) > barcodeModules(CODE));
});

test("doporučená a nejmenší šířka vycházejí z modulu", () => {
  const modules = barcodeModules(CODE);
  assert.equal(recommendedWidthMm(CODE), Math.ceil((modules * 0.33 + 4) * 10) / 10);
  assert.equal(minimumWidthMm(CODE), Math.ceil((modules * 0.25 + 4) * 10) / 10);
  assert.ok(minimumWidthMm(CODE) < recommendedWidthMm(CODE));
  // vypočtená šířka opravdu dává požadovanou šířku modulu
  assert.ok(labelGeometry(CODE, minimumWidthMm(CODE)).moduleMm >= MIN_MODULE_MM);
  assert.ok(labelGeometry(CODE, recommendedWidthMm(CODE)).moduleMm >= 0.33);
});

test("výška štítku v milimetrech", () => {
  const label = labelGeometry(CODE, 60);

  assert.equal(label.widthMm, 60);
  assert.equal(label.barcodeWidthMm, 60 - 2 * LABEL_MARGIN_MM);
  assert.equal(label.moduleMm, Math.round(label.barcodeWidthMm / label.modules * 1000) / 1000);
  assert.ok(label.moduleMm >= MIN_MODULE_MM);
  assert.equal(label.readable, true);
  assert.equal(label.barHeightMm, 11.2);
  assert.equal(label.codeTextMm, CODE_TEXT_MM);
  assert.equal(label.heightMm, 2 * LABEL_MARGIN_MM + 11.2 + 1.5 + CODE_TEXT_MM);
});

test("písmo pod kódem se vejde do šířky štítku", () => {
  const short = labelGeometry(CODE, 60);
  assert.equal(short.codeTextMm, CODE_TEXT_MM, "krátký kód má plné písmo");

  const long = labelGeometry(LONG_CODE, 60);
  assert.ok(long.codeTextMm < CODE_TEXT_MM, "dlouhý kód má menší písmo");
  assert.ok(
    long.codeTextMm * CODE_TEXT_RATIO * LONG_CODE.length <= long.barcodeWidthMm,
    "text pod kódem se musí vejít do šířky štítku",
  );
  assert.ok(long.codeTextMm >= MIN_CODE_TEXT_MM);
  assert.equal(long.heightMm, 2 * LABEL_MARGIN_MM + long.barHeightMm + TEXT_GAP_MM + long.codeTextMm);
});

test("výška pruhů v modulech odpovídá poměru stran čárového kódu", () => {
  const label = labelGeometry(CODE, 60);
  // SVG má viewBox v modulech, aby se kód neroztáhl a pruhy zůstaly stejně široké
  const aspect = label.barHeightModules / label.modules;
  const expected = label.barHeightMm / label.barcodeWidthMm;
  assert.ok(Math.abs(aspect - expected) < 0.01, `poměr ${aspect} vs ${expected}`);
  assert.ok(label.barHeightModules > 0);
});

test("výška pruhů má minimum pro čitelnost", () => {
  const narrow = labelGeometry(CODE, 25);
  assert.equal(narrow.barHeightMm, MIN_BAR_HEIGHT_MM);
  const wide = labelGeometry(CODE, 100);
  assert.ok(wide.barHeightMm > narrow.barHeightMm);
});

test("úzký štítek se čárným kódem se varuje", () => {
  const unreadable = labelGeometry(LONG_CODE, 60);
  assert.equal(unreadable.readable, false);
  assert.ok(unreadable.moduleMm < MIN_MODULE_MM);
  assert.equal(unreadable.recommendedWidthMm, recommendedWidthMm(LONG_CODE));
  assert.ok(unreadable.recommendedWidthMm > 60);

  assert.equal(labelGeometry(LONG_CODE, unreadable.recommendedWidthMm).readable, true);
  assert.equal(labelGeometry(LONG_CODE, unreadable.minimumWidthMm).readable, true);
});

test("mřížka štítků na archu A4", () => {
  const grid = labelGrid(10, 60, 40);
  assert.equal(grid.columns, Math.floor((A4.width - 20) / 60));
  assert.equal(grid.rows, Math.floor((A4.height - 20) / 40));
  assert.equal(grid.perPage, grid.columns * grid.rows);
  assert.equal(grid.fits, true);

  const small = labelGrid(1, 60, 40);
  assert.equal(small.perPage, grid.perPage);
  assert.equal(labelGrid(grid.perPage + 1, 60, 40).fits, false);
});

test("na jeden štítek se vejde jen jeden kus", () => {
  // mřížka nikdy nesmí mít nulu sloupců, i když je štítek širší než A4
  const grid = labelGrid(1, MAX_LABEL_WIDTH_MM, 20);
  assert.equal(grid.columns, 1);
  assert.equal(grid.rows, Math.floor((A4.height - 20) / 20));
});

test("pravidlo @page pro jeden štítek a pro arch", () => {
  const label = labelGeometry(CODE, 60);
  assert.equal(pageRule({ labelWidthMm: 60, labelHeightMm: label.heightMm, count: 1 }), "@page { size: 60mm 20.7mm; margin: 0mm; }");
  assert.equal(pageRule({ labelWidthMm: 60, labelHeightMm: label.heightMm, count: 6 }), "@page { size: 210mm 297mm; margin: 10mm; }");
});

test("výška štítku se řídí nejdelším kódem", () => {
  // krátký kód: 2*2 okraj + 11,2 pruhy + 1,5 mezera + 4 písmo
  assert.equal(labelGeometry(CODE, 60).heightMm, 20.7);
  // dlouhý kód má menší písmo pod kódem, ale výška nesmí přesáhnout výšku pruhů
  const long = labelGeometry(LONG_CODE, 60);
  assert.ok(long.codeTextMm < CODE_TEXT_MM);
  assert.ok(long.heightMm < labelGeometry(CODE, 60).heightMm);
});
test("předvolené rozměry štítků jsou v rozsahu a výška se dopočítá", () => {
  for (const preset of LABEL_SIZE_PRESETS) {
    assert.ok(preset.widthMm >= MIN_LABEL_WIDTH_MM && preset.widthMm <= MAX_LABEL_WIDTH_MM, preset.name);
    assert.equal("heightMm" in preset, false, "předvolba udává jen šířku, výška se počítá z kódu");
  }
  // název musí odpovídat šířce, jinak by na štítku chyběla výška
  for (const preset of LABEL_SIZE_PRESETS) {
    assert.equal(preset.name, `${preset.widthMm} mm`, "název předvolby");
  }
  assert.equal(DEFAULT_LABEL_WIDTH_MM, 60);
});
