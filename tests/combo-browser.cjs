// Fixture-backed target settings checks. Requires the advanced downloaded game fixtures.
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
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(404); response.end(); }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
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
    await page.waitForFunction(() => BUILDER.uiReady);
    await page.evaluate(() => BUILDER.enrichmentReady);

    const select = async name => page.evaluate(async name => {
      await setChampion(name); await ensureGameText(); BUILDER.level=18;
      BUILDER.abilityRanks={q:5,w:5,e:5,r:3}; renderStats(); renderAbilityCards();
    },name);
    const add = async id => { await page.locator('#comboAction').selectOption(id); await page.locator('#comboAdd').click(); };
    await select('Aatrox');
    await page.locator('#targetEnabled').click();
    assert.equal(await page.locator('#targetModal').isVisible(),false);
    await page.locator('#targetSettingsBtn').click();
    await page.locator('#targetArmor').fill('50');
    await page.locator('#targetArmor').press('Tab');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#targetModal').isVisible(),false);
    assert.equal(await page.locator('#targetSettingsBtn').evaluate(el=>el===document.activeElement),true);
    await add('q:0'); await add('q:1'); await add('q:2');
    assert.match(await page.locator('[data-combo-duration]').innerText(),/2.60 s/);
    assert.ok(Number(await page.locator('[data-combo-total]').innerText())>0);
    await page.locator('#comboSteps [data-op="up"]').nth(1).click();
    assert.equal(await page.locator('[data-combo-total]').innerText(),'Unavailable');
    await page.locator('#comboSteps [data-op="down"]').first().click();
    await page.locator('#comboClear').click();
    await add('aa'); await add('aa');
    assert.equal(await page.locator('#comboSteps > li').count(),2);
    const expected = await page.evaluate(()=>{
      const s=computeDerivedBuildStats();
      const r=Object.values(BUILDER.cdragonRaw).find(r=>r.__type==='CharacterRecord'&&r.basicAttack).basicAttack;
      return ((1+r.mAttackCastTime/r.mAttackTotalTime)/s.asTotal).toFixed(2)+' s';
    });
    assert.equal(await page.locator('[data-combo-duration]').innerText(),expected);
    await page.locator('#comboSteps [data-op="copy"]').first().click();
    assert.equal(await page.locator('#comboSteps > li').count(),3);
    await page.locator('#comboSteps [data-op="remove"]').last().click();
    const before=Number(await page.locator('[data-combo-total]').innerText());
    await page.locator('#targetEnabled').click();
    assert.ok(Number(await page.locator('[data-combo-total]').innerText())>before);
    await select('Aurora');
    assert.equal(await page.locator('#comboSteps > li').count(),0);
    await add('q:0'); await add('q:1');
    await page.locator('#comboSteps details').nth(1).locator('summary').click();
    await page.getByRole('spinbutton',{name:'Step 2 Recast interval (s)',exact:true}).fill('0.5');
    await page.getByRole('spinbutton',{name:'Step 2 Recast interval (s)',exact:true}).press('Tab');
    assert.equal(await page.locator('[data-combo-duration]').innerText(),'0.75 s');
    await page.evaluate(()=>{BUILDER.itemSlots[0]='3152';renderStats();renderAbilityCards();});
    const active=await page.locator('#comboAction option').evaluateAll(options=>options.find(o=>o.textContent.startsWith('Active'))?.value);
    assert.ok(active,'equipped active item can be selected');
    await add(active);
    assert.match(await page.locator('#comboSteps > li').last().innerText(),/107.8 damage/,'active damage loads from its resolved formula');
    await page.locator('#targetEnabled').click();
    assert.match(await page.locator('#comboSteps > li').last().innerText(),/53.9 damage/,'active item is mitigated exactly once');
    await page.locator('#targetEnabled').click();
    await page.locator('#comboSteps details').last().locator('summary').click();
    for(const [field,value] of [['Damage','100'],['Cast / windup (s)','0.1'],['Repeat cooldown (s)','40']]) {
      const input=page.getByRole('spinbutton',{name:'Step 3 '+field,exact:true});await input.fill(value);await input.press('Tab');
    }
    assert.ok(Number(await page.locator('[data-combo-total]').innerText())>100);
    await page.evaluate(()=>{BUILDER.itemSlots[0]='';renderStats();renderAbilityCards();});
    assert.equal(await page.locator('[data-combo-total]').innerText(),'Unavailable');
    await select('Ezreal');
    await add('q:0'); await add('q:0');
    const repeatTime=Number.parseFloat(await page.locator('[data-combo-duration]').innerText());
    await page.evaluate(()=>{BUILDER.itemSlots[0]='3115';renderStats();renderAbilityCards();});
    assert.ok(Number.parseFloat(await page.locator('[data-combo-duration]').innerText())<repeatTime,'item haste updates repeat timing');
    await page.locator('#comboClear').click();
    await add('aa');
    const attackDamage=Number(await page.locator('[data-combo-total]').innerText());
    const passive=await page.locator('#comboAction option').evaluateAll(options=>options.find(o=>o.value.startsWith('item:3115:'))?.value);
    assert.ok(passive);await add(passive);
    assert.ok(Number(await page.locator('[data-combo-total]').innerText())>attackDamage,'passive adds one explicit trigger');
    await page.evaluate(()=>{BUILDER.abilityRanks.q=0;renderStats();renderAbilityCards();});
    assert.equal(await page.locator('#comboQuick [data-add=""]').first().isDisabled(),true);
    await select('Aatrox');
    await page.evaluate(()=>{BUILDER.itemSlots[0]='';renderStats();renderAbilityCards();});
    await add('q:0'); await add('q:1'); await add('q:2'); await add('aa');
    await page.evaluate(()=>{document.getElementById('builderLevel').value='18';document.getElementById('comboPanel').scrollTop=0;});
    const screenshotDir=path.join(fixtures,'screenshots');fs.mkdirSync(screenshotDir,{recursive:true});
    await page.screenshot({path:path.join(screenshotDir,'combo-desktop.png'),fullPage:true});
    for(const width of [1440,1100,800,390]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal overflow at '+width);
    }
    await page.screenshot({path:path.join(screenshotDir,'combo-mobile.png'),fullPage:true});
    await page.locator('#targetSettingsBtn').click();
    assert.equal(await page.locator('#targetModal').isVisible(),true);
    assert.ok(await page.locator('#targetModal').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),'mobile dialog fits');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
    console.log('Combo browser checks passed');
  } finally { await browser.close();server.close(); }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
