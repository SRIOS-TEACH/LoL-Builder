const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function createElementStub() {
  return {
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    style: { setProperty: () => {} },
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    closest: () => null,
    appendChild: () => {},
  };
}

global.window = global;
global.document = {
  addEventListener: () => {},
  getElementById: () => createElementStub(),
  querySelectorAll: () => [],
};

global.console.groupCollapsed = () => {};
global.console.groupEnd = () => {};

vm.runInThisContext(fs.readFileSync('JS/shared/apiClient.js', 'utf8'), { filename: 'JS/shared/apiClient.js' });
vm.runInThisContext(fs.readFileSync('JS/shared/itemPolicy.js', 'utf8'), { filename: 'JS/shared/itemPolicy.js' });
vm.runInThisContext(fs.readFileSync('JS/shared/abilityRules.js', 'utf8'), { filename: 'JS/shared/abilityRules.js' });
vm.runInThisContext(fs.readFileSync('JS/itemLookup.js', 'utf8'), { filename: 'JS/itemLookup.js' });
vm.runInThisContext(`${fs.readFileSync('JS/builder.js', 'utf8')}
window.__BUILDER = BUILDER;
`, { filename: 'JS/builder.js' });

(async () => {
  try {
  const version = await window.ApiClient.fetchLatestVersion();
  const champIndex = await window.ApiClient.fetchChampionIndex(version);
  const champions = champIndex?.data || {};

  window.__BUILDER.version = version;
  window.__BUILDER.champions = champions;

  const report = await window.runAbilityTagResolutionAudit();

  if (report.length) {
    const lines = report
      .map((row) => `${row.champion} ${row.spell}: ${row.unresolved.join(', ')}`)
      .join('\n');
    assert.fail(`Found unresolved ability tooltip tags:\n${lines}`);
  }

  console.log(`ability tag resolution audit passed for ${Object.keys(champions).length} champions (${version})`);
  } catch (error) {
    const code = error?.cause?.code || error?.code || '';
    if (code === 'ENETUNREACH' || code === 'ECONNREFUSED' || code === 'EAI_AGAIN') {
      console.warn(`ability tag resolution audit skipped: network unavailable (${code})`);
      return;
    }
    throw error;
  }
})();
