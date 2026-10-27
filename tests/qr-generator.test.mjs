import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "../js/vendor/qr/index.js";

test("QR generátor automaticky zvolí verzi a vytvoří čitelnou matici", () => {
  const qr = new QRCode(0, 0);
  qr.addData("https://example.com");
  qr.make();
  assert.ok(qr.typeNumber >= 1 && qr.typeNumber <= 39);
  assert.equal(qr.getModuleCount(), qr.typeNumber * 4 + 17);
  assert.equal(typeof qr.isDark(0, 0), "boolean");
});

test("QR generátor podporuje českou diakritiku a emoji přes UTF-8", () => {
  const qr = new QRCode(0, 1);
  qr.addData("Příliš žluťoučký kůň 🐴");
  qr.make();
  assert.ok(qr.getModuleCount() >= 21);
  let dark = 0;
  for (let row = 0; row < qr.getModuleCount(); row++) {
    for (let col = 0; col < qr.getModuleCount(); col++) if (qr.isDark(row, col)) dark++;
  }
  assert.ok(dark > 0);
});

test("QR generátor odmítne data, která se nevejdou do dostupné kapacity", () => {
  const qr = new QRCode(0, 1);
  qr.addData("x".repeat(10000));
  assert.throws(() => qr.make());
});
