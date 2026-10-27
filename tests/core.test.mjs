import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import {
  buildCode,
  buildCodes,
  canEncode,
  formatDate,
  formatDateTime,
  formatDayOfYear,
  getDayOfYear,
  getTodayInfo,
  getYearDigit,
  msUntilNextMidnight,
  normalizeVersion,
  parseVersionList,
  plural,
  scheduleMidnightRefresh,
  validateVersion,
} from "../js/core.js";

const day = (year, month, date) => new Date(year, month - 1, date, 12, 0, 0);

test("den v roce se počítá od 1. ledna", () => {
  assert.equal(getDayOfYear(day(2026, 1, 1)), 1);
  assert.equal(getDayOfYear(day(2026, 1, 2)), 2);
  assert.equal(getDayOfYear(day(2026, 3, 1)), 60);
  assert.equal(getDayOfYear(day(2026, 9, 30)), 273);
  assert.equal(getDayOfYear(day(2026, 12, 31)), 365);
});

test("přestupný rok má 366 dní", () => {
  assert.equal(getDayOfYear(day(2028, 3, 1)), 61);
  assert.equal(getDayOfYear(day(2028, 12, 31)), 366);
  assert.equal(getDayOfYear(day(2027, 12, 31)), 365);
});

test("den v roce sedí i kolem změny letního času", () => {
  // 31. 3. a 31. 10. 2026 jsou dny změny času, tady krátce po půlnoci
  for (const [year, month, date, expected] of [
    [2026, 3, 31, 90],
    [2026, 10, 31, 304],
    [2026, 1, 1, 1],
    [2026, 12, 31, 365],
  ]) {
    assert.equal(getDayOfYear(new Date(year, month - 1, date, 0, 30)), expected, `${date}.${month}.${year} v 00:30`);
    assert.equal(getDayOfYear(new Date(year, month - 1, date, 23, 59)), expected, `${date}.${month}.${year} ve 23:59`);
  }
});

test("den v roce se nemění během dne", () => {
  for (const hour of [0, 1, 2, 12, 23]) {
    const morning = getDayOfYear(new Date(2026, 8, 30, hour, 0));
    const evening = getDayOfYear(new Date(2026, 8, 30, hour, 59));
    assert.equal(morning, 273);
    assert.equal(evening, 273);
  }
});

test("den v roce je vždy na tři místa", () => {
  assert.equal(formatDayOfYear(day(2026, 1, 1)), "001");
  assert.equal(formatDayOfYear(day(2026, 9, 7)), "250");
  assert.equal(formatDayOfYear(day(2026, 9, 30)), "273");
  assert.equal(formatDayOfYear(day(2026, 12, 31)), "365");
  assert.equal(formatDayOfYear(day(2028, 12, 31)), "366");
});

test("z roku se bere poslední číslice", () => {
  assert.equal(getYearDigit(day(2026, 9, 30)), "6");
  assert.equal(getYearDigit(day(2029, 9, 30)), "9");
  assert.equal(getYearDigit(day(2030, 9, 30)), "0");
  assert.equal(getYearDigit(day(2031, 9, 30)), "1");
});

test("kód je verze plechu + den v roce + rok", () => {
  assert.equal(buildCode("12472A", day(2026, 9, 30)), "12472A2736");
  assert.equal(buildCode("1", day(2026, 1, 1)), "10016");
  assert.equal(buildCode("ABC", day(2028, 12, 31)), "ABC3668");
  assert.equal(buildCode("9", day(2026, 9, 30)), "92736");
});

test("kód se sestaví i z nečisté verze", () => {
  assert.equal(normalizeVersion(" 12472A "), "12472A");
  assert.equal(normalizeVersion("124 72A"), "12472A");
  assert.equal(normalizeVersion("12472a"), "12472A");
  assert.equal(normalizeVersion(undefined), "");
  assert.equal(buildCode(" 124 72a ", day(2026, 9, 30)), "12472A2736");
});

test("dnešní údaje jsou konzistentní", () => {
  const info = getTodayInfo(day(2026, 9, 30));
  assert.deepEqual(
    { dayOfYear: info.dayOfYear, dayString: info.dayString, year: info.year, yearDigit: info.yearDigit, dateLabel: info.dateLabel },
    { dayOfYear: 273, dayString: "273", year: 2026, yearDigit: "6", dateLabel: "30. 9. 2026" },
  );
});

test("validace verze", () => {
  assert.deepEqual(validateVersion("12472A"), { ok: true, value: "12472A" });
  assert.deepEqual(validateVersion(" 12472a "), { ok: true, value: "12472A" });
  assert.equal(validateVersion("").ok, false);
  assert.equal(validateVersion("   ").ok, false);
  assert.match(validateVersion("").error, /verzi/i);
  assert.equal(validateVersion("12-45").ok, false);
  assert.match(validateVersion("12-45").error, /písmena a číslice/);
  assert.equal(validateVersion("Plech5").ok, true);
  assert.equal(validateVersion("ěščř").ok, false);
  assert.equal(validateVersion("A".repeat(25)).ok, false);
  assert.equal(validateVersion("A".repeat(24)).ok, true);
});

test("do čárového kódu jde jen tisícové/znakové ASCII", () => {
  assert.equal(canEncode("12472A2736"), true);
  assert.equal(canEncode("a b-c_1"), true);
  assert.equal(canEncode("ěščř"), false);
  assert.equal(canEncode("tab\u0001"), false);
  assert.equal(canEncode(""), false);
});

test("seznam verzí se rozdělí na jednotlivé verze", () => {
  assert.deepEqual(parseVersionList("12472A 12472B"), { versions: ["12472A", "12472B"], invalid: [] });
  assert.deepEqual(parseVersionList("12472A,12472B;90011C"), {
    versions: ["12472A", "12472B", "90011C"],
    invalid: [],
  });
  assert.deepEqual(parseVersionList("  12472a \n 12472B  "), { versions: ["12472A", "12472B"], invalid: [] });
  assert.deepEqual(parseVersionList(""), { versions: [], invalid: [] });
  assert.deepEqual(parseVersionList(null), { versions: [], invalid: [] });
});

test("v seznamu verzí se oddělí neplatné", () => {
  const parsed = parseVersionList("12472A 12-45 90011C ěščř");
  assert.deepEqual(parsed.versions, ["12472A", "90011C"]);
  assert.deepEqual(parsed.invalid, ["12-45", "ěščř"]);
});

test("duplicitní verze v seznamu zůstávají", () => {
  assert.deepEqual(parseVersionList("12472A 12472A").versions, ["12472A", "12472A"]);
});

test("kódy pro celý seznam", () => {
  assert.deepEqual(buildCodes(["12472A", "12472B"], day(2026, 9, 30)), ["12472A2736", "12472B2736"]);
  assert.deepEqual(buildCodes([], day(2026, 9, 30)), []);
});

test("tvar počtu podle českých pravidel", () => {
  const forms = ["kód", "kódy", "kódů"];
  assert.equal(plural(0, forms), "0 kódů");
  assert.equal(plural(1, forms), "1 kód");
  assert.equal(plural(2, forms), "2 kódy");
  assert.equal(plural(4, forms), "4 kódy");
  assert.equal(plural(5, forms), "5 kódů");
  assert.equal(plural(12, forms), "12 kódů");
  assert.equal(plural(-1, forms), "-1 kód");
  assert.equal(plural(2, ["arch", "archy", "archů"]), "2 archy");
});

test("formátování data a času", () => {
  assert.equal(formatDate(day(2026, 9, 30)), "30. 9. 2026");
  assert.equal(formatDate(day(2026, 1, 1)), "1. 1. 2026");
  assert.equal(formatDateTime(new Date(2026, 8, 30, 9, 5)), "30. 9. 09:05");
  assert.equal(formatDateTime(new Date(2026, 8, 30, 14, 32)), "30. 9. 14:32");
});

test("vzdálenost do půlnoci", () => {
  assert.equal(msUntilNextMidnight(new Date(2026, 8, 30, 12, 0, 0)), 12 * 3600 * 1000);
  assert.equal(msUntilNextMidnight(new Date(2026, 8, 30, 0, 0, 0)), 24 * 3600 * 1000);
  assert.equal(msUntilNextMidnight(new Date(2026, 8, 30, 23, 59, 59)), 1000);
});

test("přepočet naplánovaný těsně po půlnoci", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const ticks = [];

  // 23:59:59.500 -> plán 1,5 s po půlnoci
  const cancel = scheduleMidnightRefresh(() => ticks.push(true), new Date(2026, 8, 30, 23, 59, 59, 500));

  mock.timers.tick(1499);
  assert.deepEqual(ticks, [], "před půlnocí se nepřepočítalo");
  mock.timers.tick(2);
  assert.equal(ticks.length, 1, "po půlnoci se nepřepočítalo");

  cancel();
  mock.timers.tick(48 * 3600 * 1000);
  assert.equal(ticks.length, 1, "zrušený plán se nesmí znovu spustit");
  mock.timers.reset();
});
