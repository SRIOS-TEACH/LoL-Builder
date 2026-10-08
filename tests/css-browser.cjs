// Compare all computed styles, geometry and screenshots with the pre-CSS-refactor source.
// Requires CSS_BASELINE_ROOT, FIXTURES_DIR, PLAYWRIGHT_PATH and BROWSER_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const {installBrowserHarness} = require('./helpers/native-runtime.cjs');
const root = path.resolve(process.env.APP_ROOT || path.join(__dirname, '..'));
const before = process.env.CSS_BASELINE_ROOT && path.resolve(process.env.CSS_BASELINE_ROOT);
assert.ok(before, 'Set CSS_BASELINE_ROOT to a preserved pre-change source tree.');
const fixtures = path.resolve(process.env.FIXTURES_DIR || 'tests/fixtures');
const output = path.resolve(process.env.CSS_OUTPUT || 'test-results/css-visual');
const {verifyRelease} = require('../scripts/verify-release.cjs');
const baselineEvidence = path.resolve(process.env.CSS_BASELINE_EVIDENCE || path.join(__dirname, '../docs/phase6-release.json'));
const baselineReport = JSON.parse(fs.readFileSync(baselineEvidence, 'utf8'));
verifyRelease({sourceRoot:before, report:baselineReport});
const names = new Map(fs.readdirSync(fixtures).filter(n => n.endsWith('.json')).map(n => [n.toLowerCase(), n]));
const read = name => fs.readFileSync(path.join(fixtures, name));
const bundles = {before, after:root};
const errors = [], results = [];
fs.mkdirSync(output, {recursive:true});
const server = http.createServer((req, res) => {
  const parts = decodeURIComponent(req.url.split('?')[0]).split('/').filter(Boolean);
  const folder = bundles[parts.shift()];
  if (!folder) {res.writeHead(404); res.end(); return;}
  const file = path.resolve(folder, ...parts);
  if (!file.startsWith(folder + path.sep)) {res.writeHead(403); res.end(); return;}
  try {
    res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(fs.readFileSync(file));
  } catch {res.writeHead(404); res.end();}
});
async function capture(page, file) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path:file, animations:'disabled', fullPage:true});
  return page.evaluate(() => {
    const properties = Array.from(getComputedStyle(document.documentElement)).filter(name => !name.startsWith('--')).sort();
    const styles = [], styleIndexes = new Map();
    function styleIndex(element, pseudo = null) {
      const style = getComputedStyle(element, pseudo);
      const values = properties.map(name => style.getPropertyValue(name));
      // URLs are identical except for the local before/after source prefix.
      const key = JSON.stringify(values).replaceAll('/before/', '/source/').replaceAll('/after/', '/source/');
      if (!styleIndexes.has(key)) {styleIndexes.set(key, styles.length); styles.push(JSON.parse(key));}
      return styleIndexes.get(key);
    }
    const elements = [...document.querySelectorAll('body, body *')].map(element => {
      const rect = element.getBoundingClientRect();
      return {tag:element.tagName, id:element.id, classes:element.getAttribute('class'), rect:[rect.x, rect.y, rect.width, rect.height], style:styleIndex(element), before:styleIndex(element, '::before'), after:styleIndex(element, '::after')};
    });
    return {properties, styles, elements, overflow:document.documentElement.scrollWidth > innerWidth};
  });
}
function compareSnapshots(a, b, id) {
  assert.equal(a.elements.length, b.elements.length, id + ': DOM size');
  assert.deepEqual(a.properties, b.properties, id + ': available CSS properties');
  const differences = [];
  for (let i = 0; i < a.elements.length; i++) {
    const x = a.elements[i], y = b.elements[i];
    const label = x.tag + '#' + x.id + '.' + x.classes;
    for (const key of ['tag', 'id', 'classes', 'rect']) {
      if (JSON.stringify(x[key]) !== JSON.stringify(y[key])) differences.push({element:label, key, before:x[key], after:y[key]});
    }
    for (const pseudo of ['style', 'before', 'after']) {
      const oldStyle = a.styles[x[pseudo]], newStyle = b.styles[y[pseudo]];
      for (let j = 0; j < a.properties.length; j++) {
        if (oldStyle[j] !== newStyle[j]) differences.push({element:label, pseudo, property:a.properties[j], before:oldStyle[j], after:newStyle[j]});
      }
    }
  }
  if (differences.length) fs.writeFileSync(path.join(output, id + '-differences.json'), JSON.stringify(differences, null, 2));
  assert.equal(differences.length, 0, id + ': computed-style differences: ' + JSON.stringify(differences.slice(0, 5)));
  return a.elements.length;
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_PATH});
  try {
    // Loading these packages is optional outside the visual verification environment.
    const {PNG} = require(path.join(path.dirname(process.env.PLAYWRIGHT_PATH), 'pngjs'));
    const {default:pixelmatch} = await import(require('node:url').pathToFileURL(path.join(path.dirname(process.env.PLAYWRIGHT_PATH), 'pixelmatch/index.js')).href);
    const viewports = [{width:1440,height:900}, {width:1024,height:768}, {width:390,height:844}, {width:1440,height:650}, {width:1920,height:1080}];
    for (const viewport of viewports) {
      const pages = {};
      for (const kind of ['before', 'after']) {
        const page = await browser.newPage({viewport}); pages[kind] = page;
        await installBrowserHarness(page, bundles[kind]);
        page.on('pageerror', error => errors.push(kind + ': ' + error.message));
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin === base) return route.fallback();
          if (!url.pathname.endsWith('.json')) return route.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#334155"/></svg>'});
          const name = url.pathname.endsWith('/items.cdtb.bin.json') ? 'cd-items.json' : url.pathname.endsWith('/versions.json') ? 'versions.json' : url.pathname.endsWith('/champion.json') ? 'champions.json' : url.pathname.endsWith('/item.json') ? 'items.json' : url.pathname.endsWith('/runesReforged.json') ? 'runes.json' : names.get(path.basename(url.pathname).toLowerCase());
          assert.ok(name, 'Unknown fixture request: ' + url.pathname);
          return route.fulfill({contentType:'application/json', body:read(name)});
        });
      }
      async function state(name, action) {
        for (const page of Object.values(pages)) {
          await action(page);
          await page.addStyleTag({content:'*, *::before, *::after {animation:none !important;transition:none !important;caret-color:transparent !important;}'});
        }
        const id = viewport.width + 'x' + viewport.height + '-' + name;
        const paths = ['before', 'after'].map(kind => path.join(output, id + '-' + kind + '.png'));
        const a = await capture(pages.before, paths[0]), b = await capture(pages.after, paths[1]);
        const elements = compareSnapshots(a, b, id);
        const oldPNG = PNG.sync.read(fs.readFileSync(paths[0])), newPNG = PNG.sync.read(fs.readFileSync(paths[1]));
        assert.equal(newPNG.width, oldPNG.width, id + ': screenshot width');
        assert.equal(newPNG.height, oldPNG.height, id + ': screenshot height');
        const pixels = pixelmatch(oldPNG.data, newPNG.data, null, oldPNG.width, oldPNG.height, {threshold:0.1});
        assert.equal(pixels, 0, id + ': changed screenshot pixels');
        results.push({id, elements, computedStylesMatch:true, pixelsChanged:pixels});
        console.log('PASS ' + id + ' (' + elements + ' elements)');
      }
      for (const file of ['main.html', 'champ.html', 'itemLookup.html']) await state(file, async page => {await page.goto(base + '/' + (page === pages.before ? 'before/' : 'after/') + file);});
      await state('builder-empty', async page => {
        await page.goto(base + '/' + (page === pages.before ? 'before/' : 'after/') + 'Builder.html');
        await page.waitForFunction(() => document.querySelectorAll('#itemSlots button').length === 7 && document.querySelector('#builderStatus').textContent === '');
      });
      await state('builder-ashe', page => page.evaluate(async () => {await setChampion('Ashe'); await BUILDER.enrichmentReady; BUILDER.level = 18; BUILDER.abilityRanks = {q:5,w:5,e:5,r:3}; renderStats(); renderAbilityCards();}));
      await state('champion-picker', async page => {await page.locator('#championPickerBtn').click(); await page.locator('#modalChampSearch').fill('Ashe'); await page.locator('[data-champ="Ashe"]').hover(); await page.waitForFunction(() => document.querySelector('#modalChampDetail').textContent.includes('Ashe'));});
      await state('item-picker', async page => {await page.locator('#closeChampModalBtn').click(); await page.locator('[data-slot="0"]').click(); await page.locator('#modalItemSearch').fill('Long Sword'); await page.locator('[data-item-id="1036"]').click();});
      await state('item-equipped', async page => {await page.locator('[data-set-item-id="1036"]').click();});
      await state('target-dialog', async page => {await page.locator('#targetSettingsBtn').click(); await page.locator('#targetMaxHp').fill('3000');});
      await state('rune-stacks', async page => {await page.locator('#closeTargetModal').click(); await page.locator('#runeStacksBtn').click();});
      await state('passives', async page => {await page.locator('#closeRuneStacksBtn').click(); await page.locator('#passiveToggleBtn').click();});
      await state('combo-actions', async page => {await page.locator('#closePassiveModalBtn').click(); await page.locator('[aria-label="Add AA no crit"]').click(); await page.locator('[data-open-custom]').click();});
      for (const page of Object.values(pages)) await page.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({passed:true, baselineEvidence, baselineRuntimeFiles:baselineReport.runtimeFiles, cases:results.length, results}, null, 2) + '\n');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;}).finally(() => server.close());
