// Verify local stylesheet dependencies and custom-property closure without a CSS toolchain.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {runtimeFiles} = require('./build-site.cjs');
function checkStyles({sourceRoot = path.resolve(__dirname, '..')} = {}) {
  const files = runtimeFiles(sourceRoot), loaded = new Set(), active = new Set(), texts = [];
  function local(owner, url) {
    assert.ok(!/^(?:[a-z]+:|\/\/)/i.test(url), 'Stylesheet imports must be local: ' + url);
    const file = path.resolve(sourceRoot, path.dirname(owner), url.split(/[?#]/)[0]);
    assert.ok(file.startsWith(path.resolve(sourceRoot) + path.sep), 'Stylesheet escapes the site: ' + url);
    assert.ok(fs.existsSync(file), 'Missing stylesheet: ' + owner + ' -> ' + url);
    return path.relative(sourceRoot, file).split(path.sep).join('/');
  }
  function visit(name) {
    assert.ok(!active.has(name), 'Circular stylesheet import: ' + name);
    if (loaded.has(name)) return;
    active.add(name);
    const text = fs.readFileSync(path.join(sourceRoot, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    texts.push(text);
    const imports = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/g;
    for (const match of text.matchAll(imports)) {
      const preceding = text.slice(0, match.index).replace(imports, '').trim();
      assert.equal(preceding, '', 'Imports must precede style rules: ' + name);
      visit(local(name, match[1]));
    }
    active.delete(name); loaded.add(name);
  }
  for (const page of files.filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(sourceRoot, page), 'utf8');
    for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
      if (!/rel=["']stylesheet["']/i.test(tag)) continue;
      const url = tag.match(/href=["']([^"']+)["']/i)?.[1];
      assert.ok(url, 'Stylesheet link has no URL: ' + page);
      visit(local(page, url));
    }
  }
  for (const name of files.filter(name => name.endsWith('.css'))) assert.ok(loaded.has(name), 'Unreferenced runtime stylesheet: ' + name);
  const all = texts.join('\n');
  const declared = new Set([...all.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
  for (const [,name,fallback] of all.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
    assert.ok(declared.has(name) || fallback === ',', 'Missing custom property without fallback: ' + name);
  }
  return {stylesheets:loaded.size, customProperties:declared.size};
}
if (require.main === module) console.log('PASS stylesheet dependencies: ' + JSON.stringify(checkStyles()));
module.exports = {checkStyles};
