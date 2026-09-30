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
    const screenshotDir=path.join(fixtures,'screenshots');fs.mkdirSync(screenshotDir,{recursive:true});
    await select('Aatrox');
    assert.equal(await page.locator('#comboQuick > button').count(),6);
    assert.match(await page.getByRole('button',{name:'Add Q',exact:true}).locator('img').getAttribute('src'),/AatroxQ/);
    const square=await page.locator('#comboQuick > button').first().boundingBox();near(square.width,square.height,'square ability buttons',1);
    await page.locator('#targetEnabled').click();
    assert.equal(await page.locator('#targetModal').isVisible(),false);
    await page.locator('#targetSettingsBtn').click();
    await page.locator('#targetArmor').fill('50');await page.locator('#targetArmor').press('Tab');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#targetSettingsBtn').evaluate(el=>el===document.activeElement),true);
    await add('q:0');await add('q:1');await add('q:2');
    assert.equal(await duration(),2.6);assert.ok(await total()>0);
    assert.equal(await page.locator('#comboSequence').innerText(),'Q → Q2 → Q3');
    await page.locator('#comboSteps [data-op="up"]').nth(1).click();
    assert.ok(await total()>0);assert.ok(await page.locator('[data-time-note]').count());
    await page.locator('#comboSteps [data-op="down"]').first().click();
    await clear();await add('aa:no-crit');await add('aa:crit');
    const expected=await page.evaluate(()=>{
      const s=computeDerivedBuildStats();const r=Object.values(BUILDER.cdragonRaw).find(r=>r.__type==='CharacterRecord'&&r.basicAttack);
      return {time:1/s.asTotal+ComboTester.attackWindup(r,s.asTotal,s.base.attackspeed),damage:AttackEffects.model(BUILDER,ItemLookupShared.getState().cdragonById).profile(s,{critOutcome:'no-crit'}).baseAttackDamage*(1+s.critDamage/100)};
    });
    near(await duration(),expected.time,'AA spacing includes windup',.011);near(await total(),expected.damage,'explicit critical outcomes');
    await edit(0);assert.ok(Number(await page.getByLabel('Cast / attack windup (s)',{exact:true}).getAttribute('placeholder'))>0);await done();
    await page.locator('#comboSteps [data-op="copy"]').first().click();assert.equal(await page.locator('#comboSteps > li').count(),3);
    await page.locator('#comboSteps [data-op="remove"]').last().click();
    const before=await total();await page.locator('#targetEnabled').click();assert.ok(await total()>before);
    // Offset-format windup, custom naming, missing-value warnings, and typed hover.
    await select('Ahri');await page.getByRole('button',{name:'Add AA no crit',exact:true}).click();
    assert.ok(await duration()>0);assert.equal(await page.locator('[data-time-note]').count(),0);
    await openPicker();assert.equal(await page.getByRole('button',{name:/AA basic attack/}).count(),0);
    await page.locator('[data-custom-action]').click();
    assert.equal(await page.locator('#comboEditModal').isVisible(),true);
    await fill('Action name','Extra hit <test>');await fill('Damage','125');
    await page.getByLabel('Damage type',{exact:true}).selectOption('magic');
    await fill('Cast / attack windup (s)','0.2');await done();
    assert.match(await page.locator('#comboSteps [data-op="edit"]').last().getAttribute('aria-label'),/Extra hit <test>/);
    assert.equal(await page.locator('#comboSteps test').count(),0,'custom labels are escaped');
    assert.equal(await page.locator('#comboSequence').innerText(),'AA → ?');
    await page.locator('[data-combo-total]').hover();
    assert.equal(await page.locator('#comboDamageTooltip').isVisible(),true);
    assert.match(await page.locator('#comboDamageTooltip .combo-type-magic').innerText(),/125.0/);
    assert.equal(await page.locator('#comboDamageTooltip .combo-type-physical').count(),1);
    assert.equal(await page.locator('#comboDamageTooltip .combo-type-true').count(),1);
    await edit(1);await fill('Damage','');await fill('Cast / attack windup (s)','');await done();
    assert.ok(await page.locator('[data-damage-note]').count());assert.ok(await page.locator('[data-time-note]').count());
    assert.ok(await page.locator('#comboResult .combo-alert').count()>=2);assert.ok(Number.isFinite(await total()));assert.ok(Number.isFinite(await duration()));
    await edit(1);await fill('Damage','0');await fill('Cast / attack windup (s)','0');await done();
    assert.equal(await page.locator('[data-damage-note]').count(),0);assert.equal(await page.locator('[data-time-note]').count(),0);
    await select('Aurora');await add('q:0');await add('q:1');
    assert.ok(await total()>0);assert.equal(await duration(),.5,'missing recast interval is zero');
    assert.ok(await page.locator('[data-time-note]').count());
    await edit(1);await fill('Recast interval (s)','0.5');await done();assert.equal(await duration(),.75);
    await page.evaluate(()=>{BUILDER.itemSlots=['3152','3115','3089','','','',''];renderStats();renderAbilityCards();});
    await openPicker();
    assert.equal(await page.locator('[data-action-id^="item:3089:"]').count(),0,'stat-only Deathcap passive is excluded');
    const active=await page.locator('[data-action-id^="item:3152:"]').first().getAttribute('data-action-id');
    await page.locator(`[data-action-id="${active}"]`).click();
    await edit(2);assert.ok(Number(await page.getByLabel('Damage',{exact:true}).getAttribute('placeholder'))>0);await done();
    const amount=await total();await page.locator('#targetEnabled').click();assert.ok(await total()<amount);await page.locator('#targetEnabled').click();
    await openPicker();const passive=await page.locator('[data-action-id^="item:3115:"]').first().getAttribute('data-action-id');await page.locator(`[data-action-id="${passive}"]`).click();assert.ok(await total()>amount);
    await page.evaluate(()=>{BUILDER.itemSlots=Array(7).fill('');renderStats();renderAbilityCards();});
    assert.ok(await page.locator('[data-damage-note]').count());assert.ok(Number.isFinite(await total()));
    await select('Aatrox');await add('q:0');await add('q:1');await add('aa:no-crit');await add('e:0');await add('r:0');
    await page.evaluate(()=>document.getElementById('comboPanel').scrollTop=0);
    await page.screenshot({path:path.join(screenshotDir,'combo-icons-desktop.png'),fullPage:true});
    await openPicker();await page.screenshot({path:path.join(screenshotDir,'combo-action-picker.png'),fullPage:true});await page.keyboard.press('Escape');
    await edit(0);await page.screenshot({path:path.join(screenshotDir,'combo-action-editor.png'),fullPage:true});await done();
    for(const width of [1440,1100,800,390]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no page overflow at '+width);
      const row=page.locator('#comboSteps > li').first();await row.scrollIntoViewIfNeeded();
      assert.equal(await row.evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'no action row overflow at '+width);
    }
    await page.locator('#comboPanel').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(screenshotDir,'combo-icons-mobile.png'),fullPage:true});
    await openPicker();assert.ok(await page.locator('#comboActionModal').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));await page.keyboard.press('Escape');
    await page.locator('#targetSettingsBtn').click();assert.ok(await page.locator('#targetModal').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);console.log('Combo icon UI, dialogs, damage types, zero fallbacks, crit outcomes, windup and responsive checks passed');
  } finally { await browser.close();server.close(); }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
