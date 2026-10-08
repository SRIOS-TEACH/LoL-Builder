const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {checkStyles} = require('../scripts/check-styles.cjs');
const {buildSite, runtimeFiles} = require('../scripts/build-site.cjs');
const root = path.resolve(__dirname, '..');
test('all stylesheet imports and required variables resolve on both generated routes', t => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'lol-css-'));
  t.after(() => fs.rmSync(source, {recursive:true, force:true}));
  for (const name of runtimeFiles(root)) {
    const target = path.join(source, name); fs.mkdirSync(path.dirname(target), {recursive:true}); fs.copyFileSync(path.join(root, name), target);
  }
  const expected = checkStyles({sourceRoot:source});
  const {output} = buildSite({sourceRoot:source});
  for (const prefix of ['', 'preview']) assert.deepEqual(checkStyles({sourceRoot:path.join(output, prefix)}), expected);
});
test('stylesheet verification catches missing nested imports, cycles and missing variables', t => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'lol-css-bad-'));
  t.after(() => fs.rmSync(source, {recursive:true, force:true}));
  for (const directory of ['CSS', 'JS', 'assets']) fs.mkdirSync(path.join(source, directory));
  for (const name of ['index.html', 'main.html', 'Builder.html', 'champ.html', 'itemLookup.html']) fs.writeFileSync(path.join(source, name), '<link rel="stylesheet" href="CSS/entry.css">');
  const entry = path.join(source, 'CSS/entry.css');
  fs.writeFileSync(entry, '@import url("missing.css");');
  assert.throws(() => checkStyles({sourceRoot:source}), /Missing stylesheet/);
  fs.writeFileSync(entry, '@import url("entry.css");');
  assert.throws(() => checkStyles({sourceRoot:source}), /Circular stylesheet/);
  fs.writeFileSync(entry, 'body {color:var(--missing);}');
  assert.throws(() => checkStyles({sourceRoot:source}), /Missing custom property/);
  fs.writeFileSync(entry, 'body {color:var(--caller-color, blue);}');
  assert.doesNotThrow(() => checkStyles({sourceRoot:source}));
});
