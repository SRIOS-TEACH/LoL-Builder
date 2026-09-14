const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.APP_ROOT || path.join(__dirname, '..');

function app() {
  const context = vm.createContext({ document: { addEventListener() {} } });
  context.window = context;
  for (const file of ['shared/buildStats', 'builder']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'JS', file + '.js'), 'utf8'), context);
  }
  return context;
}

// Character record excerpts captured from Community Dragon 16.18 alongside
// Data Dragon 16.18.1. All six DD records publish attackdamageperlevel: 0.
// e.g. /16.18/game/data/characters/aurora/aurora.bin.json, CharacterRecords/Root.
const champions = [
  ['Aatrox', 60, 5], ['Aurora', 53, 3], ['Ezreal', 60, 3.75],
  ['Ashe', 59, 3.5], ['Jhin', 61, 4.40000009536743], ['Yasuo', 60, 2.5],
];

test('character-record AD growth reaches level-scaled base AD despite the zero DD field', () => {
  const c = app();
  for (const [name, base, growth] of champions) {
    const record = { [`Characters/${name}/CharacterRecords/Root`]: {
      baseDamageModifiable: { baseValue: base, __type: 'ModifiableFloat' },
      damagePerLevelModifiable: { baseValue: growth, __type: 'ModifiableFloat' },
    } };
    const cd = c.extractChampionStatsFromBinRoot(record, name, name.toLowerCase());
    const stats = c.BuildStats.mergeChampionStats({ attackdamage: base, attackdamageperlevel: 0 }, cd);
    assert.equal(stats.attackdamageperlevel, growth, name);
    assert.equal(stats.attackdamage + stats.attackdamageperlevel * c.BuildStats.growthFactor(1), base, name);
    assert.ok(Math.abs(stats.attackdamage + stats.attackdamageperlevel * c.BuildStats.growthFactor(2) - (base + 0.72 * growth)) < 1e-8, name);
    assert.ok(Math.abs(stats.attackdamage + stats.attackdamageperlevel * c.BuildStats.growthFactor(18) - (base + 17 * growth)) < 1e-8, name);
  }
});

test('AD growth supports named, modifiable and legacy hashed character-record fields', () => {
  const c = app();
  for (const fields of [
    { damagePerLevel: 3.75 },
    { damagePerLevelModifiable: { baseValue: 3.75 } },
    { '{e2b5d80d}': 3.75 },
    { '{e2b5d80d}': { baseValue: 3.75 } },
  ]) {
    const cd = c.extractChampionStatsFromBinRoot({ 'characters/ezreal/characterrecords/root': fields }, 'Ezreal', 'ezreal');
    assert.equal(c.BuildStats.mergeChampionStats({ attackdamageperlevel: 0 }, cd).attackdamageperlevel, 3.75);
  }
});

test('missing AD growth preserves the patch value and legitimate zero growth remains zero', () => {
  const c = app();
  for (const value of [undefined, null, NaN, Infinity, '3.75']) {
    assert.equal(c.BuildStats.mergeChampionStats({ attackdamageperlevel: 3.75 }, { attackdamageperlevel: value }).attackdamageperlevel, 3.75);
  }
  assert.equal(c.BuildStats.mergeChampionStats({ attackdamageperlevel: 3.75 }, { attackdamageperlevel: 0 }).attackdamageperlevel, 0);
  // Senna's zero growth is omitted from the BIN, and is correctly zero in DD.
  const senna = c.extractChampionStatsFromBinRoot({ 'Characters/Senna/CharacterRecords/Root': { baseDamageModifiable: { baseValue: 50 } } }, 'Senna', 'senna');
  assert.equal(c.BuildStats.mergeChampionStats({ attackdamage: 50, attackdamageperlevel: 0 }, senna).attackdamageperlevel, 0);
});

test('growth correction preserves other patch stats and never mutates source data', () => {
  const c = app();
  const dd = { hpregen: 5, attackdamage: 53, attackdamageperlevel: 0, attackspeed: 0.668 };
  const cd = { hpregen: 1, attackdamage: 999, attackdamageperlevel: 3, attackspeedratio: 0.625 };
  const stats = c.BuildStats.mergeChampionStats(dd, cd);
  assert.equal(stats.hpregen, 5);
  assert.equal(stats.attackdamage, 53);
  assert.equal(stats.attackspeedratio, 0.625);
  assert.equal(dd.attackdamageperlevel, 0);
  assert.equal(cd.hpregen, 1);
});
