import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectLayout, createGeneratedRecords, runPreflight } from '../js/quality.js';
import { cloneDefaultLayout } from '../js/label-model.js';

test('kontrola layoutu blokuje přesah mimo štítek', () => {
  const issues = inspectLayout([{ id:'x', label:'mimo', type:'text', x:99, y:1, w:10, h:5, fontSize:3 }], 104, 150);
  assert.ok(issues.some(x => x.code === 'element-outside' && x.severity === 'error'));
});
test('šaržovní kód se generuje z verze a explicitního data', () => {
  const [record] = createGeneratedRecords([{ version:'12472A', _line:2 }], { codeMode:'sharnovni', date:'2026-10-19' });
  assert.equal(record.generatedCode, '12472A2926');
  assert.equal(record._generationError, '');
});
test('neplatná verze blokuje tisk', () => {
  const [record] = createGeneratedRecords([{ version:'', _line:2 }], { codeMode:'sharnovni', date:'2026-10-19' });
  const result = runPreflight([record], cloneDefaultLayout(), { widthMm:104, heightMm:151.63 });
  assert.equal(result.ready, false);
  assert.ok(result.issues.some(x => x.code === 'generation' && x.severity === 'error'));
});
test('duplicitní kódy jsou označené jako upozornění', () => {
  const records = [{ generatedCode:'A', _line:2 }, { generatedCode:'A', _line:3 }];
  const result = runPreflight(records, [], { widthMm:104, heightMm:151.63 });
  assert.ok(result.issues.some(x => x.code === 'duplicate-code' && x.severity === 'warning'));
});
test('prázdná dávka nebo neplatný rozměr není připraven k tisku', () => {
  assert.equal(runPreflight([], [], { widthMm:104, heightMm:150 }).ready, false);
  assert.ok(runPreflight([{generatedCode:'A'}], [], { widthMm:0, heightMm:150 }).errors > 0);
});
test('výchozí návrh štítku má všechny prvky uvnitř 104 × 151,63 mm', () => {
  const result = inspectLayout(cloneDefaultLayout(), 104, 151.63);
  assert.equal(result.filter(x => x.severity === 'error').length, 0);
});
