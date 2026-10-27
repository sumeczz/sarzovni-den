import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSapTable, mapImportRows, autoMapHeaders, normalizeImportHeader, detectDelimiter, detectDateFormat } from '../js/sap-import.js';

const sample = `Přehled skladových zásob\nMaterial\tMaterial Description\tVendor Batch (LICHA)\tBatch (CHARG)\tPlant (WERKS)\tStorage Location (LGORT)\tQuantity (MENGE)\tUnit (MEINS)\n0000123456\tPlech 0,8 mm\t12472A\tB260019\t1100\t0001\t250,000\tKG\n0000123457\tPlech DC04\t12472B\tB260020\t1100\t0001\t120,000\tKG\nCelkem\t\t\t\t\t\t370,000\tKG`;

test('normalizace českých hlaviček odstraní diakritiku a sjednotí mezery', () => {
  assert.equal(normalizeImportHeader('  Číslo materiálu (MATNR) '), 'cislo materialu matnr');
});
test('detekuje tabulátor SAP/Excel i CSV středník', () => {
  assert.equal(detectDelimiter('MATNR\tCHARG\n0001\tB1').delimiter, '\t');
  assert.equal(detectDelimiter('MATNR;CHARG\n0001;B1').delimiter, ';');
});
test('přeskočí úvodní titul, rozpozná SAP hlavičku a odstraní souhrn', () => {
  const parsed = parseSapTable(sample);
  assert.equal(parsed.headerIndex, 1);
  assert.equal(parsed.rows.length, 2);
  assert.ok(parsed.warnings.some(x => x.includes('úvodních řádků')));
});
test('odděluje dodavatelskou šarži LICHA od dávky CHARG', () => {
  const parsed = parseSapTable(sample);
  const mapped = mapImportRows(parsed);
  assert.equal(mapped[0].version, '12472A');
  assert.equal(mapped[0].sapBatch, 'B260019');
});
test('zachová úvodní nuly v MATNR, závodu a skladovém místě', () => {
  const row = mapImportRows(parseSapTable(sample))[0];
  assert.equal(row.material, '0000123456');
  assert.equal(row.plant, '1100');
  assert.equal(row.storageLocation, '0001');
});
test('CSV respektuje uvozovky, oddělovače uvnitř textu a zdvojené uvozovky', () => {
  const parsed = parseSapTable('MATNR;MAKTX;LICHA\n0001;"Plech, černý; ""extra""";A1');
  const row = mapImportRows(parsed)[0];
  assert.equal(row.description, 'Plech, černý; "extra"');
});
test('technické SAP názvy se mapují i při různém pořadí sloupců', () => {
  const parsed = parseSapTable('LGPLA\tVFDAT\tMATNR\tLICHA\tMENGE\tMEINS\nA-01-02\t20261231\t0007\tV2\t12,500\tKG');
  const row = mapImportRows(parsed)[0];
  assert.equal(row.storageBin, 'A-01-02');
  assert.equal(row.expiryDate, '20261231');
  assert.equal(row.material, '0007');
  assert.equal(row.version, 'V2');
});
test('obecný Batch se nikdy automaticky nepovažuje za dodavatelskou verzi', () => {
  const parsed = parseSapTable('Material\tBatch\n0001\tB260019');
  assert.equal(parsed.mapping.sapBatch, 1);
  assert.equal(parsed.mapping.version, null);
  assert.ok(parsed.warnings.some(x => x.includes('šarže dodavatele')));
});
test('bez hlavičky lze data ručně mapovat bez ztráty řádků', () => {
  const parsed = parseSapTable('0001\tA-01\n0002\tA-02', { hasHeader: false });
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.mapping.material, null);
  assert.equal(mapImportRows(parsed, { material: 0, version: 1 })[1].version, 'A-02');
});
test('opakovaná hlavička uprostřed exportu se ignoruje', () => {
  const parsed = parseSapTable('MATNR\tLICHA\n0001\tA1\nMATNR\tLICHA\n0002\tA2');
  assert.deepEqual(parsed.rows.map(r => r.cells), [['0001','A1'], ['0002','A2']]);
});
test('mapování rozpozná české i anglické varianty polí', () => {
  const mapping = autoMapHeaders(['Číslo materiálu', 'Šarže dodavatele', 'Druh pohybu', 'Skladová pozice', 'Datum expirace']);
  assert.deepEqual([mapping.material, mapping.version, mapping.movementType, mapping.storageBin, mapping.expiryDate], [0,1,2,3,4]);
});
test('rozpozná běžná data SAP, české datum a Excel serial', () => {
  assert.equal(detectDateFormat('20261019').iso, '2026-10-19');
  assert.equal(detectDateFormat('19.10.2026').iso, '2026-10-19');
  assert.equal(detectDateFormat('46314').valid, true);
  assert.equal(detectDateFormat('31.02.2026').valid, false);
});
test('odmítne prázdný import se srozumitelnou chybou', () => {
  assert.throws(() => parseSapTable('  \n\t'), /Vlož tabulku/);
});
