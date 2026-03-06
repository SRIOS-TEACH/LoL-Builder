const assert = require('assert');
const { isPurchasableItem, dedupeByNameWithMapPriority } = require('../JS/shared/itemPolicy.js');

const baseItem = {
  gold: { purchasable: true },
  maps: { 11: true },
  requiredAlly: false,
};

assert.strictEqual(isPurchasableItem('1001', baseItem), true, 'basic purchasable item should pass');
assert.strictEqual(isPurchasableItem('3040', { gold: { purchasable: false }, maps: {}, requiredAlly: true }), true, 'force include should pass');
assert.strictEqual(isPurchasableItem('2001', { gold: { purchasable: false }, maps: { 11: true } }), false, 'non purchasable should fail');

const entries = [
  ['3000', { name: 'Example Blade', maps: { 12: true }, gold: { purchasable: true } }],
  ['3001', { name: 'Example Blade', maps: { 11: true, 12: true }, gold: { purchasable: true } }],
  ['1000', { name: 'Another Item', maps: { 11: true }, gold: { purchasable: true } }],
];

const deduped = dedupeByNameWithMapPriority(entries, new Set([11]));
const ids = deduped.map(([id]) => id).sort();
assert.deepStrictEqual(ids, ['1000', '3001'], 'should keep best map candidate per normalized name');

console.log('itemPolicy tests passed');
