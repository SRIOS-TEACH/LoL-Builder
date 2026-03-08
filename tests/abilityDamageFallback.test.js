const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

global.window = global;
global.document = {
  addEventListener: () => {},
  getElementById: () => ({ textContent: '', classList: { toggle: () => {} }, addEventListener: () => {}, style: { setProperty: () => {} } }),
  querySelectorAll: () => [],
};

global.console.groupCollapsed = () => {};
global.console.groupEnd = () => {};

vm.runInThisContext(fs.readFileSync('JS/shared/apiClient.js', 'utf8'), { filename: 'JS/shared/apiClient.js' });
vm.runInThisContext(fs.readFileSync('JS/shared/itemPolicy.js', 'utf8'), { filename: 'JS/shared/itemPolicy.js' });
vm.runInThisContext(fs.readFileSync('JS/shared/abilityRules.js', 'utf8'), { filename: 'JS/shared/abilityRules.js' });
vm.runInThisContext(fs.readFileSync('JS/itemLookup.js', 'utf8'), { filename: 'JS/itemLookup.js' });
vm.runInThisContext(`${fs.readFileSync('JS/builder.js', 'utf8')}
window.__evaluateCalculationPart = evaluateCalculationPart;
window.__evaluateGameCalculation = evaluateGameCalculation;
window.__findBestCalcTokenMatch = findBestCalcTokenMatch;
`, { filename: 'JS/builder.js' });

const stats = { ap: 100, totalAd: 90, bonusAd: 30, armor: 50, bonusArmor: 20, mr: 40, bonusMr: 10, hp: 1000, bonusHp: 300, mp: 400, bonusMp: 100 };
const dataValues = [{ mName: 'DamageAmp', mValues: [0, 0.2, 0.3, 0.4, 0.5, 0.6] }];

const productPart = {
  __type: 'ProductOfSubPartsCalculationPart',
  mPart1: { __type: 'NumberCalculationPart', mNumber: 100 },
  mPart2: { __type: 'NamedDataValueCalculationPart', mDataValue: 'DamageAmp' },
};
const productEval = window.__evaluateCalculationPart(productPart, dataValues, 2, stats);
assert.strictEqual(productEval.value, 20);

const ratioPart = {
  __type: 'RatioOfSubPartsCalculationPart',
  mPart1: { __type: 'NumberCalculationPart', mNumber: 120 },
  mPart2: { __type: 'NumberCalculationPart', mNumber: 3 },
};
const ratioEval = window.__evaluateCalculationPart(ratioPart, dataValues, 1, stats);
assert.strictEqual(ratioEval.value, 40);

const calcLookup = {
  basephysicaldamage: { total: 120, terms: [], displayAsPercent: false },
  detonationdamage: { total: 200, terms: [], displayAsPercent: false },
};
assert.strictEqual(window.__findBestCalcTokenMatch(calcLookup, 'physicaldamage'), 'basephysicaldamage');
assert.strictEqual(window.__findBestCalcTokenMatch(calcLookup, 'detonationamount'), 'detonationdamage');

const calc = {
  __type: 'GameCalculation',
  mFormulaParts: [productPart, ratioPart],
  mDisplayAsPercent: false,
};
const result = window.__evaluateGameCalculation(calc, dataValues, 2, stats, {});
assert.strictEqual(result.total, 60);

const calcMap = {
  basedamage: {
    __type: 'GameCalculation',
    mFormulaParts: [{ __type: 'NumberCalculationPart', mNumber: 25 }],
    mDisplayAsPercent: false,
  },
  totaldamage: {
    __type: 'GameCalculation',
    mFormulaParts: [{ __type: 'SumOfSubPartsCalculationPart', mSubParts: [
      { __type: 'NumberCalculationPart', mNumber: 10 },
      { __type: 'NumberCalculationPart', mNumber: 15 },
    ] }],
    mDisplayAsPercent: false,
  },
};

const conditionalCalc = {
  __type: 'GameCalculationConditional',
  mDefaultGameCalculation: 'basedamage',
};
const conditionalEval = window.__evaluateGameCalculation(conditionalCalc, dataValues, 1, stats, calcMap);
assert.strictEqual(conditionalEval.total, 25);

const subPartsEval = window.__evaluateGameCalculation(calcMap.totaldamage, dataValues, 1, stats, calcMap);
assert.strictEqual(subPartsEval.total, 25);

console.log('ability calculation coverage tests passed');
