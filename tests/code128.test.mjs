import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCode128Bars,
  code128SvgMarkup,
  CODE128_PATTERNS,
  encodeCode128B,
} from "../js/code128.js";

const QUIET_ZONE = 10;
const START_B = 104;
const STOP = 106;
const REVERSE_STOP = "211133";
const STOP_TRAILING_BAR = 2;

/** Šířky -> bitový vzor, 1 = černý pruh. */
function widthsToBits(widths) {
  return widths.map((width, index) => (index % 2 === 0 ? "1".repeat(width) : "0".repeat(width))).join("");
}

/** Bitový vzor -> šířky. */
function bitsToWidths(bits) {
  return bits.match(/1+|0+/g).map((run) => run.length);
}

/** Všechny vzory, které podle ISO 15417 smějí být ve Code 128. */
function generateAllValidPatterns() {
  const found = new Set();
  for (let b1 = 1; b1 <= 4; b1++) {
    for (let s1 = 1; s1 <= 4; s1++) {
      for (let b2 = 1; b2 <= 4; b2++) {
        for (let s2 = 1; s2 <= 4; s2++) {
          for (let b3 = 1; b3 <= 4; b3++) {
            for (let s3 = 1; s3 <= 4; s3++) {
              const widths = [b1, s1, b2, s2, b3, s3];
              const total = widths.reduce((sum, width) => sum + width, 0);
              const bars = b1 + b2 + b3;
              const spaces = s1 + s2 + s3;
              if (total === 11 && bars % 2 === 0 && spaces % 2 === 1) {
                found.add(widths.join(""));
              }
            }
          }
        }
      }
    }
  }
  return found;
}

/** Všechny moduly čárového kódu jako "1011..." včetně tichých zón. */
function barsToModuleString(bars, modules) {
  const modules_ = new Array(modules).fill("0");
  for (const bar of bars) {
    for (let i = bar.x; i < bar.x + bar.width; i++) modules_[i] = "1";
  }
  return modules_.join("");
}

/** Nezávislý decoder: moduly -> text. */
function decodeModules(moduleString) {
  assert.equal(moduleString.slice(0, QUIET_ZONE), "0".repeat(QUIET_ZONE), "chybí levá tichá zóna");
  const body = moduleString.slice(QUIET_ZONE, moduleString.length - QUIET_ZONE);
  const runs = bitsToWidths(body);
  const widthsToValue = new Map(CODE128_PATTERNS.map((pattern, value) => [pattern, value]));

  // Každý symbol začíná i končí pruhem, takže se žádné dvě sousední plochy neslučují.
  assert.equal(runs.at(-1), STOP_TRAILING_BAR, "chybí koncový 2modulový pruh stopu");
  const symbolRuns = runs.slice(0, -1);
  assert.equal(symbolRuns.length % 6, 0, "počet pruhů a mezer není násobek 6");

  const values = [];
  for (let i = 0; i < symbolRuns.length; i += 6) {
    const widths = symbolRuns.slice(i, i + 6);
    const value = widthsToValue.get(widths.join(""));
    assert.notEqual(value, undefined, `neznámý vzor ${widths.join("")}`);
    values.push(value);
  }
  assert.equal(values[0], START_B, "kód nezačíná Start B");
  assert.equal(values.at(-1), STOP, "kód nekončí stop symbolem");

  const data = values.slice(1, -2);
  return String.fromCharCode(...data.map((value) => value + 32));
}

/** Nezávislý výpočet kontrolního součtu podle ISO 15417: start + Σ(pozice * hodnota). */
function referenceChecksum(values) {
  let sum = values[0];
  values.slice(1).forEach((value, index) => {
    sum += value * (index + 1);
  });
  return sum % 103;
}

test("tabulka vzorů obsahuje přesně všech 107 symbolů + reverse stop", () => {
  assert.equal(CODE128_PATTERNS.length, 107);
  assert.equal(new Set(CODE128_PATTERNS).size, 107, "duplicitní vzor v tabulce");
});

test("tabulka vzorů odpovídá všem kombinacím dovoleným standardem", () => {
  const valid = generateAllValidPatterns();
  const inTable = new Set([...CODE128_PATTERNS, REVERSE_STOP]);
  assert.equal(valid.size, 108, "standard má 108 platných vzorů");
  assert.deepEqual([...inTable].sort(), [...valid].sort());
});

test("známé vzory z ISO 15417 sedí", () => {
  const known = [
    [0, "11011001100"], // mezera
    [16, "10011101100"], // "0"
    [33, "10100011000"], // "A"
    [48, "11101110110"], // "P"
    [77, "11110111010"], // "m"
    [91, "11110110110"], // "{"
    [104, "11010010000"], // Start B
    [106, "11000111010"], // Stop
  ];
  for (const [value, bits] of known) {
    assert.equal(widthsToBits(bitsToWidths(bits)), bits, `vzor ${value} není konzistentní`);
    assert.equal(widthsToBits(CODE128_PATTERNS[value].split("").map(Number)), bits, `hodnota ${value} má jiný vzor`);
  }
});

test("kontrolní součet odpovídá referenčnímu výpočtu", () => {
  for (const text of ["12472A2736", "A", "X00Y", "abcdefghijklmnopqrstuvwxyz0123456789"]) {
    const { values, checksum } = encodeCode128B(text);
    assert.equal(checksum, referenceChecksum(values.slice(0, -2)), `součet pro "${text}"`);
  }
});

test("kontrolní součet sedí na vektoru X00Y ze standardu", () => {
  // [Start B] 56 16 16 57 -> (104 + 56*1 + 16*2 + 16*3 + 57*4) % 103
  assert.deepEqual(encodeCode128B("X00Y").values.slice(0, 4), [START_B, 56, 16, 16]);
  assert.equal(encodeCode128B("X00Y").checksum, 56);
});

test("sestavení kódu odpovídá hodnotám symbolů", () => {
  const { values } = encodeCode128B("12472A2736");
  assert.equal(values[0], START_B);
  assert.deepEqual(values.slice(1, 5), [17, 18, 20, 23]); // "1", "2", "4", "7"
  assert.deepEqual(values.slice(5, 10), [18, 33, 18, 23, 19]); // "2", "A", "2", "7", "3"
  assert.equal(values[10], "6".codePointAt(0) - 32);
  assert.equal(values.length, 10 + 3); // start + 10 znaků + součet + stop
});

test("vygenerovaný čárový kód jde dekódovat zpět na původní text", () => {
  const inputs = ["12472A2736", "X00Y", "A", "0", "Semtex5l", "abc123xyz", "  9  "];
  for (const text of inputs) {
    const { bars, modules } = buildCode128Bars(text);
    assert.equal(decodeModules(barsToModuleString(bars, modules)), text, `round-trip pro "${text}"`);
  }
});

test("geometrie pruhů odpovídá šířkám symbolů", () => {
  const { bars, modules } = buildCode128Bars("12472A2736");
  const symbolCount = 10 + 3; // start + 10 znaků + součet + stop
  assert.equal(bars.length, symbolCount * 3 + 1);
  assert.equal(modules, QUIET_ZONE * 2 + symbolCount * 11 + STOP_TRAILING_BAR);
  assert.deepEqual(bars[0], { x: QUIET_ZONE, width: 2 }); // Start B
  assert.deepEqual(bars.at(-1), { x: QUIET_ZONE + symbolCount * 11, width: STOP_TRAILING_BAR });

  for (const bar of bars) {
    assert.ok(bar.width >= 1 && bar.width <= 4, "šířka pruhu mimo 1-4 moduly");
    assert.ok(bar.x >= QUIET_ZONE, "pruh přesahuje do levé tiché zóny");
    assert.ok(bar.x + bar.width <= modules - QUIET_ZONE, "pruh přesahuje do pravé tiché zóny");
  }
  for (const [previous, next] of bars.slice(1).map((bar, index) => [bars[index], bar])) {
    assert.ok(next.x - (previous.x + previous.width) >= 1, "dva černé pruhy se spojily, čtečka by je četla jako jeden");
  }
});

test("kód bez tichých zón má správnou délku", () => {
  const { bars, modules } = buildCode128Bars("0", { quietZone: 0 });
  assert.equal(bars.length, 4 * 3 + 1); // start + znak + součet + stop
  assert.equal(modules, 4 * 11 + STOP_TRAILING_BAR);
});

test("subset B odmítne znaky mimo ASCII", () => {
  assert.throws(() => encodeCode128B("é"), /subset B/);
  assert.throws(() => encodeCode128B("tab\u0001"), /subset B/);
  assert.throws(() => encodeCode128B(""), /prázdný/);
});

test("SVG obsahuje tichou zónu, jednotlivé pruhy a popisek", () => {
  const markup = code128SvgMarkup("12472A2736");
  assert.match(markup, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ 50"/);
  assert.match(markup, /<rect x="0" y="0" width="\d+" height="50" fill="#fff"\/>/);
  assert.equal(markup.match(/<rect x="\d+" y="0" width="\d+" height="50"\/>/g).length, 40);
  assert.match(markup, /aria-label="Čárový kód 12472A2736"/);
  assert.match(markup, /<rect x="10" y="0" width="2" height="50"\/>/, "první pruh začíná za tichou zónou");
});

test("SVG escapuje text v popisku", () => {
  assert.match(code128SvgMarkup("12<34>&56"), /aria-label="Čárový kód 12&lt;34&gt;&amp;56"/);
});
