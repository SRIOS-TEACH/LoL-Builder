const assert = require('assert');
const { abilityMaxByLevel, enforceAbilityRules } = require('../JS/shared/abilityRules.js');

assert.strictEqual(abilityMaxByLevel(1, 'q'), 1);
assert.strictEqual(abilityMaxByLevel(9, 'q'), 5);
assert.strictEqual(abilityMaxByLevel(5, 'r'), 0);
assert.strictEqual(abilityMaxByLevel(6, 'r'), 1);
assert.strictEqual(abilityMaxByLevel(16, 'r'), 3);

const normalized = enforceAbilityRules(6, { q: 5, w: 5, e: 0, r: 1 });
assert.deepStrictEqual(normalized, { q: 2, w: 3, e: 0, r: 1 });

console.log('abilityRules tests passed');
