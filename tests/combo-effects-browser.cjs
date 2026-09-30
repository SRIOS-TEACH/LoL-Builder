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
    await select('Veigar');
    const setBuild=async (ids,target=false,runes=[])=>page.evaluate(({ids,target,runes})=>{
      BUILDER.itemSlots=[...ids,...Array(7-ids.length).fill('')];
      BUILDER.target={enabled:target,maxHp:2000,currentHp:2000,armor:100,mr:100,damageReduction:0};
      BUILDER.runeSelections={primary:runes,secondary:[],shards:[]};renderStats();renderAbilityCards();
    },{ids,target,runes});
    const expected=async (id,key,index=0)=>page.evaluate(({id,key,index})=>resolveItemDescriptionHtml(BUILDER.items[id],id).sections.find(s=>s.key===key).damageOptions[index].value,{id,key,index});
    await setBuild(['6655','3146','6653','4646']);
    await add('item:6655:echo');near(await total(),await expected('6655','echo'),'Luden single echo');
    await clear();await add('item:6655:echo:damage:1');near(await total(),await expected('6655','echo',1),'Luden maximum isolated target');
    await clear();await add('item:3146:lightning-bolt');const rawGunblade=await total();near(rawGunblade,await expected('3146','lightning-bolt'),'Gunblade calculation');
    assert.ok(rawGunblade>0);assert.equal(await page.locator('[data-action-id="item:3146:active"]').count(),0,'no empty ACTIVE header action');
    await setBuild(['6655','3146','6653','4646'],true);near(await total(),await page.evaluate(raw=>TargetDamage.apply(raw,'magic',{target:BUILDER.target,stats:getComputedChampionStatsForTooltips()}).value,rawGunblade),'Gunblade mitigation once');
    const displayed=await page.evaluate(()=>Number(resolveItemDescriptionHtml(BUILDER.items['3146'],'3146').html.match(/data-damage-type="magic"[^>]*>([\d.,]+)/)[1].replaceAll(',','')));
    near(await total(),displayed,'Gunblade description and combo agree');
    await clear();await add('item:6655:echo:damage:1');near(await total(),await expected('6655','echo',1),'Luden maximum mitigation once');
    await clear();await add('item:6653:torment');near(await total(),await page.evaluate(()=>TargetDamage.apply(120,'magic',{target:BUILDER.target,stats:getComputedChampionStatsForTooltips()}).value),'Liandry complete burn');
    await clear();await add('item:4646:squall');near(await total(),await expected('4646','squall'),'Stormsurge damage');
    await page.evaluate(()=>{BUILDER.disabledItemPassives['4646:squall']=true;renderStats();renderAbilityCards();});near(await total(),0,'disabled item proc');
    await clear();await setBuild(['6655','3146'],true,['electrocute','sudden-impact','scorch','arcane-comet']);
    for(const id of ['electrocute','sudden-impact','scorch','arcane-comet']) {
      await add('rune:'+id);const expectedRune=await page.evaluate(id=>RuneEffects.damageActions(BUILDER,RUNE_DATA.runeLookup,getComputedChampionStatsForTooltips(),{adaptiveAp:isApAdaptiveChampion()}).find(a=>a.id==='rune:'+id).damage,id);
      assert.ok(expectedRune>0);near(await total(),expectedRune,id+' damage');
      assert.match(await page.locator('#comboSteps img').getAttribute('src'),/perk-images/);
      await clear();
    }
    await add('rune:arcane-comet:maximum');const maximum=await total();await clear();await add('rune:arcane-comet');near(maximum,2*await total(),'Comet maximum distance');
    await setBuild([],true,[]);near(await total(),0,'removed rune is unavailable');assert.ok(await page.locator('[data-damage-note]').count());await clear();
    await setBuild([],true,['dark-harvest']);
    await add('q:0');await edit(0);await fill('Damage','1100');await done();await add('rune:dark-harvest');assert.ok(await total()>1100,'Dark Harvest checks sequential target HP');
    await page.locator('#comboSteps [data-op="up"]').nth(1).click();near(await total(),1100,'Dark Harvest above threshold deals zero');
    await clear();await setBuild(['6655'],true,['scorch']);await add('item:6655:echo:damage:1');await add('rune:scorch');
    await openPicker();await page.locator('[data-action-id="rune:scorch"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(screenshotDir,'combo-rune-item-actions.png'),fullPage:true});await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);console.log('Rune procs, item outcomes, full burns, mitigation, removal and health sequencing passed');
  } finally { await browser.close();server.close(); }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
