const {installBrowserHarness}=require('./helpers/native-runtime.cjs');
// Fixture-backed combo editor and calculation checks. Requires the advanced downloaded game fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.APP_ROOT || path.join(__dirname, '..'));
const fixtures = path.resolve(process.env.FIXTURES_DIR || 'tests/fixtures');
const files = new Map(fs.readdirSync(fixtures).map(name => [name.toLowerCase(), name]));
const read = name => fs.readFileSync(path.join(fixtures, name));
const errors = [];
const near = (actual, expected, label, tolerance = 0.11) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < tolerance, `${label}: ${actual} != ${expected}`);
const numbers = text => [...String(text).matchAll(/-?\d[\d,]*(?:\.\d+)?/g)].map(match => Number(match[0].replaceAll(',', '')));
const server = http.createServer((request, response) => {
  const file = path.resolve(root, '.' + decodeURIComponent(request.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  try {
    response.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(404); response.end(); }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
 await installBrowserHarness(page,root);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if(url.hostname==='www.googletagmanager.com')return route.fulfill({contentType:'text/javascript',body:''});
      if (url.origin === base) return route.fallback();
      if (!url.pathname.endsWith('.json')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#334155"/></svg>' });
      const name = url.pathname.endsWith('/items.cdtb.bin.json') ? 'cd-items.json'
        : url.pathname.endsWith('/versions.json') ? 'versions.json'
        : url.pathname.endsWith('/champion.json') ? 'champions.json'
        : url.pathname.endsWith('/item.json') ? 'items.json'
        : url.pathname.endsWith('/runesReforged.json') ? 'runes.json'
        : files.get(path.basename(url.pathname).toLowerCase());
      if (!name) throw Error('Missing advanced fixture for ' + url.href);
      return route.fulfill({ contentType: 'application/json', body: read(name) });
    });
    await page.goto(base + '/Builder.html');
    await page.waitForFunction(() => globalThis.BUILDER?.uiReady);
    await page.evaluate(() => BUILDER.enrichmentReady);

    const select = async name => page.evaluate(async name => {
      await setChampion(name); await ensureGameText(); BUILDER.level=18;
      BUILDER.abilityRanks={q:5,w:5,e:5,r:3}; renderStats(); renderAbilityCards();
      document.getElementById('builderLevel').value='18';
    },name);
    const openPicker = async () => page.getByRole('button',{name:'Custom Action',exact:true}).click();
    const add = async id => { await openPicker(); await page.locator(`[data-action-id="${id}"]`).click(); };
    const total = async () => Number(await page.locator('[data-combo-total]').innerText());
    const duration = async () => parseFloat(await page.locator('[data-combo-duration]').innerText());
    const edit = async index => page.locator('#comboSteps [data-op="edit"]').nth(index).click();
    const fill = async (name,value) => page.locator('#comboEditModal').getByLabel(name,{exact:true}).fill(value);
    const done = async () => page.locator('#closeComboEdit').click();
    const clear = async () => page.locator('#comboClear').click();
    await select('Kaisa');
    assert.equal(await page.locator('[data-combat-key="buff:{89ae79fa}"]').count(),0);
    await page.locator('[data-evolve="q"]').click();
    assert.equal(await page.locator('[data-evolve="q"]').isChecked(),true);
    const description=page.locator('[data-ability-slot="q"] .ability-description');
    await description.getByRole('button',{name:'Show more',exact:true}).click();
    assert.equal(await description.locator('.detailed-description').isVisible(),true);
    await description.getByRole('button',{name:'Show less',exact:true}).click();
    assert.equal(await description.locator('.simple-description').isVisible(),true);
    assert.equal(await page.locator('[data-ability-slot="q"] .ability-head [data-evolve]').count(),1);
    await page.getByRole('button',{name:'Add Q',exact:true}).click();
    const full=await total();await edit(0);
    const hits=page.locator('[data-field="hitCount"]');assert.equal(await hits.inputValue(),'12');
    await hits.fill('1');await done();assert.ok(await total()<full);
    await select('Malzahar');await page.getByRole('button',{name:'Add E',exact:true}).click();
    const burn=await total();await edit(0);
    assert.equal(await page.locator('[data-field="burnDuration"]').inputValue(),'4');
    await page.locator('[data-field="burnDuration"]').fill('2');await done();near(await total(),burn/2,'half burn');
    await select('Jayce');await add('form:switch');await add('form:q:0');assert.ok(await total()>0);
    assert.equal(await page.locator('[data-damage-note]').count(),0);
    await page.locator('[data-neutral="blue"]').check();
    assert.equal(await page.evaluate(()=>BUILDER.combatValues['neutral:blue']),true);
    await page.locator('[data-neutral="infernal"]').check();
    assert.equal(await page.locator('[data-neutral-value="infernal:stacks"]').inputValue(),'0');
    await page.locator('[data-neutral-value="infernal:stacks"]').fill('2');await page.locator('[data-neutral-value="infernal:stacks"]').press('Tab');
    assert.equal(await page.evaluate(()=>BUILDER.combatValues['neutral:infernal:stacks']),2);
    assert.equal(await page.locator('[data-neutral-buffs]').evaluate(el=>el.previousElementSibling.id),'runesCard');
    await select('Khazix');
    for(const width of [1440,768,390]){
      await page.setViewportSize({width,height:1000});
      const layout=await page.locator('[data-ability-slot="q"]').evaluate(card=>{
        const evolve=card.querySelector('.ability-evolve').getBoundingClientRect(),rank=card.querySelector('.ability-rank-row').getBoundingClientRect();
        const text=card.querySelector('.simple-description').getBoundingClientRect(),more=card.querySelector('.detail-toggle').getBoundingClientRect();
        return {overlap:evolve.left<rank.right&&evolve.right>rank.left&&evolve.top<rank.bottom&&evolve.bottom>rank.top,below:more.top>=text.bottom-1};
      });
      assert.equal(layout.overlap,false,'evolve/rank overlap at '+width);assert.equal(layout.below,true,'show more below description at '+width);
    }
    await page.setViewportSize({width:1440,height:1000});
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.locator('[data-ability-slot="q"]').screenshot({path:path.join(root,'test-results/ability-controls-preview.png')});
    await page.screenshot({path:path.join(root,'test-results/combat-mechanics-preview.png'),fullPage:true});
    assert.deepEqual(errors,[]);console.log('PASS evolve toggle, default/partial hits, default/partial burn, form switch, map buffs and Analytics page load.');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
