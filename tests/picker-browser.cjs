// Run with the same downloaded Data Dragon fixtures as dashboard-browser.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.APP_ROOT || path.join(__dirname, '..'));
const fixtures = path.resolve(process.env.FIXTURES_DIR || 'tests/fixtures');
const read = name => fs.readFileSync(path.join(fixtures, name));
const itemFixtures = JSON.parse(read('items.json')).data;
const errors = [];
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404); res.end(); }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless: true, ...(process.env.BROWSER_PATH ? {executablePath: process.env.BROWSER_PATH} : {})});
  let releaseOptional;
  let recoverOptionalItems = false;
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    page.on('pageerror', error => errors.push(error.message));
    // Optional enrichment must not gate either picker. Hold real responses until
    // after interacting with both pickers, rather than asserting a speed budget.
    const optionalPaths = ['/items.cdtb.bin.json', '/runesReforged.json'];
    const isHeldUrl = url => optionalPaths.some(suffix => new URL(url).pathname.endsWith(suffix));
    const heldRequests = new Set();
    const heldFailures = [];
    const optionalGate = new Promise(resolve => { releaseOptional = resolve; });
    const pendingOptional = optionalPaths.map(suffix => page.waitForRequest(request => new URL(request.url()).pathname.endsWith(suffix)));
    page.on('requestfailed', request => { if (isHeldUrl(request.url())) heldFailures.push(request.failure()?.errorText); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
      if (!url.pathname.endsWith('.json')) return route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#334155"/></svg>'});
      if (isHeldUrl(url.href)) {
        heldRequests.add(url.pathname);
        await optionalGate;
        if (recoverOptionalItems && url.pathname.endsWith('/items.cdtb.bin.json')) return route.fulfill({contentType: 'application/json', body: read('cd-items.json')});
        return route.fulfill({status: 503, body: 'Optional data unavailable'}).catch(() => {});
      }
      if (url.hostname === 'raw.communitydragon.org') return route.fulfill({status: 503, body: 'Unavailable'});
      const file = url.pathname.endsWith('/versions.json') ? 'versions.json'
        : url.pathname.endsWith('/champion.json') ? 'champions.json'
        : url.pathname.endsWith('/item.json') ? 'items.json'
        : url.pathname.endsWith('/runesReforged.json') ? 'runes.json' : path.basename(url.pathname);
      if (!fs.existsSync(path.join(fixtures, file))) return route.fulfill({status: 404, body: 'Missing fixture'});
      return route.fulfill({contentType: 'application/json', body: read(file)});
    });
    await page.goto(base + '/Builder.html');
    await Promise.all(pendingOptional);
    await page.waitForFunction(() => document.querySelectorAll('#itemSlots button').length === 7);
    assert.equal(heldRequests.size, 2, 'rune and Community Dragon item responses remain deferred');
    await page.locator('#championPickerBtn').click();
    await page.locator('#modalChampSearch').fill('aatrox');
    assert.equal(await page.locator('#modalChampGrid [data-champ]').count(), 1, 'champion search is usable while enrichment is pending');
    await page.locator('#closeChampModalBtn').click();
    await page.locator('[data-slot="0"]').click();
    await page.locator('#modalItemSearch').fill('Long Sword');
    await page.locator('#modalItemGrid [data-item-id="1036"]').click();
    await page.locator('#modalItemDetail [data-set-item-id="1036"]').click();
    assert.equal(await page.evaluate(() => BUILDER.itemSlots[0]), '1036', 'items can be equipped before enrichment finishes');
    const buildGold = async () => Number((await page.locator('#buildGoldCost').innerText()).replace(/[^\d]/g, ''));
    assert.equal(await buildGold(), itemFixtures['1036'].gold.total, 'equipping an item updates total build gold before optional data arrives');
    assert.deepEqual(heldFailures, [], 'readiness was reached while requests were pending, not after their abort timeout');
    releaseOptional();
    await page.evaluate(() => BUILDER.enrichmentReady);
    assert.equal(await page.evaluate(() => BUILDER.itemSlots[0]), '1036', 'optional-data failure preserves the equipped item');
    assert.equal(await page.locator('#builderStatus').textContent(), '', 'optional-data failure does not turn startup into an error');

    const searches = [
      {open: '#championPickerBtn', modal: '#champModal', search: '#modalChampSearch', text: 'aatrox'},
      {open: '[data-slot="0"]', modal: '#itemModal', search: '#modalItemSearch', text: 'sword'}
    ];
    for (const picker of searches) {
      await page.locator(picker.open).click();
      const modal = page.locator(picker.modal);
      const search = page.locator(picker.search);
      await search.fill(picker.text);
      await search.click();
      assert.deepEqual(await search.evaluate(input => [input.selectionStart, input.selectionEnd]), [0, picker.text.length], `${picker.search}: clicking selects the existing search`);

      const bounds = await search.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(5, 5, {steps: 8});
      await page.mouse.up();
      assert.ok(await modal.isVisible(), `${picker.modal}: dragging out of search must not dismiss the picker`);
      await page.mouse.click(5, 5);
      assert.equal(await modal.isVisible(), false, `${picker.modal}: a fresh backdrop click closes the picker`);
    }

    const fixedDuringScroll = async ({open, modal, search, grid, detail, close}) => {
      await page.locator(open).click();
      await page.locator(search).fill('');
      const content = page.locator(grid);
      await page.waitForFunction(selector => {
        const element = document.querySelector(selector);
        return element.scrollHeight > element.clientHeight + 50;
      }, grid);
      const bounds = await content.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      const before = await page.evaluate(({modal, search, detail}) => {
        const box = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return {x: r.x, y: r.y, width: r.width, height: r.height};
        };
        return {search: box(search), detail: box(detail), modalScroll: document.querySelector(modal).scrollTop, pageScroll: window.scrollY};
      }, {modal, search, detail});
      await page.mouse.wheel(0, 650);
      await page.waitForFunction(selector => document.querySelector(selector).scrollTop > 0, grid);
      const after = await page.evaluate(({modal, search, detail}) => {
        const box = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return {x: r.x, y: r.y, width: r.width, height: r.height};
        };
        return {search: box(search), detail: box(detail), modalScroll: document.querySelector(modal).scrollTop, pageScroll: window.scrollY};
      }, {modal, search, detail});
      assert.deepEqual(after, before, `${grid}: scrolling results leaves search, preview and page fixed`);
      assert.ok(after.detail.y >= 0 && after.detail.y + after.detail.height <= 900, `${detail}: preview stays inside viewport`);
      // At the end of the list, further wheel gestures must not scroll the page.
      await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
      await page.mouse.wheel(0, 650);
      assert.equal(await page.evaluate(() => window.scrollY), before.pageScroll, `${grid}: no scroll chaining at the end of the results`);
      await page.locator(close).click();
    };
    await fixedDuringScroll({open: '#championPickerBtn', modal: '#champModal', search: '#modalChampSearch', grid: '#modalChampGrid', detail: '#modalChampDetail', close: '#closeChampModalBtn'});
    await fixedDuringScroll({open: '[data-slot="0"]', modal: '#itemModal', search: '#modalItemSearch', grid: '#modalItemGrid', detail: '#modalItemDetail', close: '#closeItemModalBtn'});

    await page.locator('[data-slot="0"]').click();
    assert.equal(await page.locator('#modalItemGrid .shop-item-cost').count(), 0, 'item tiles omit their former gold-cost labels');
    await page.locator('#modalItemGrid [data-item-id="1036"]').click();
    assert.match(await page.locator('#modalItemDetail').innerText(), new RegExp(`Cost:\\s*${itemFixtures['1036'].gold.total}g`), 'item details retain the item gold cost');
    const filters = page.locator('#modalItemFilters button[data-item-filter]');
    const names = await filters.evaluateAll(buttons => buttons.map(button => ({name: button.getAttribute('aria-label'), title: button.title, pressed: button.getAttribute('aria-pressed')})));
    assert.ok(names.length > 5 && names.length < 25, 'item picker exposes a concise set of main filters');
    assert.ok(names.every(filter => filter.name && filter.title === filter.name && ['true', 'false'].includes(filter.pressed)), 'icon filters have readable hover names, accessible labels and toggle state');
    assert.ok(!names.some(filter => /SpellDamage|NonbootsMovement|SpellBlock/.test(filter.name)), 'game file filter identifiers are not shown to users');
    assert.deepEqual(await page.locator('#modalItemFilters .shop-filter-group').evaluateAll(groups => groups.map(group => Array.from(group.querySelectorAll('[data-item-filter]'), button => button.dataset.itemFilter))), [
      ['Damage', 'CriticalStrike', 'AttackSpeed', 'OnHit', 'ArmorPenetration'],
      ['SpellDamage', 'Mana', 'MagicPenetration'],
      ['Health', 'Armor', 'SpellBlock'],
      ['AbilityHaste', 'NonbootsMovement', 'LifeSteal']
    ], 'stat filters preserve the four client groups and their vertical order');
    const iconPairs = await page.evaluate(() => {
      const stats = Object.fromEntries(Array.from(document.querySelectorAll('#statsTable .stats-label'), label => {
        const icon = label.querySelector('.stat-icon');
        return [label.textContent.replace(icon?.textContent || '', '').trim(), icon?.innerHTML];
      }));
      const statByFilter = {Damage: 'AD', CriticalStrike: 'Crit %', AttackSpeed: 'AS', ArmorPenetration: 'ARPen', SpellDamage: 'AP', Mana: 'MP', MagicPenetration: 'MRPen', Health: 'HP', Armor: 'Arm', SpellBlock: 'MR', AbilityHaste: 'AH', NonbootsMovement: 'MS', LifeSteal: 'Lifesteal'};
      return Object.entries(statByFilter).map(([filter, stat]) => ({filter, stat, shop: document.querySelector(`[data-item-filter="${filter}"] .stat-icon`)?.innerHTML, champion: stats[stat]}));
    });
    for (const pair of iconPairs) {
      assert.ok(pair.champion, `${pair.stat}: champion stat icon exists`);
      assert.equal(pair.shop, pair.champion, `${pair.filter}: filter uses the same icon as Champion stats`);
    }
    const abilityPower = page.locator('#modalItemFilters [data-item-filter="SpellDamage"]');
    assert.equal(await abilityPower.getAttribute('aria-label'), 'Ability Power');
    await abilityPower.click();
    assert.equal(await abilityPower.getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('#modalItemGrid [data-item-id="1052"]').count(), 'Ability Power includes Amplifying Tome');
    assert.equal(await page.locator('#modalItemGrid [data-item-id="1036"]').count(), 0, 'Ability Power excludes Long Sword');
    await page.locator('#resetItemFilters').click();
    assert.equal(await abilityPower.getAttribute('aria-pressed'), 'false');
    assert.ok(await page.locator('#modalItemGrid [data-item-id="1036"]').count(), 'clear filters restores the full shop');
    const roles = page.locator('#modalItemRoles [data-item-role]');
    assert.deepEqual(await roles.evaluateAll(buttons => buttons.map(button => button.dataset.itemRole)), ['Fighter', 'Marksman', 'Assassin', 'Mage', 'Tank', 'Support'], 'class filters follow the client order');
    assert.ok(await roles.evaluateAll(buttons => buttons.every(button => button.title && button.getAttribute('aria-label') && button.querySelector('img, svg'))), 'class icons provide hover names and accessible labels');
    assert.equal(await page.locator('#modalItemRoles [data-item-role]:disabled').count(), 6, 'class filters remain unavailable when source class metadata failed to load');
    recoverOptionalItems = true;
    await page.evaluate(async () => { await ItemLookupShared.loadCommunityDragonCalcs(); renderModalItemGrid(); });
    assert.equal(await page.locator('#modalItemRoles [data-item-role]:disabled').count(), 0, 'class filters become usable when item metadata is available');
    await page.locator('[data-item-role="Mage"]').click();
    assert.equal(await page.locator('[data-item-role="Mage"]').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('#modalItemGrid [data-item-id="3089"]').count(), 'Mage filter includes Rabadon\'s Deathcap');
    assert.equal(await page.locator('#modalItemGrid [data-item-id="3031"]').count(), 0, 'Mage filter excludes Infinity Edge');
    await abilityPower.click();
    await page.locator('#modalItemSearch').fill('Rabadon');
    await page.locator('#allItemsTab').click();
    assert.equal(await page.locator('#modalItemRoles [data-item-role][aria-pressed="true"]').count(), 0, 'All items clears the selected class');
    assert.equal(await abilityPower.getAttribute('aria-pressed'), 'true', 'All items preserves the selected stat filter');
    assert.equal(await page.locator('#modalItemSearch').inputValue(), 'Rabadon', 'All items preserves search text');
    await page.locator('[data-item-role="Mage"]').click();
    await page.locator('#resetItemFilters').click();
    assert.equal(await page.locator('#modalItemRoles [data-item-role][aria-pressed="true"]').count(), 0, 'top-left reset clears class selection');
    assert.equal(await abilityPower.getAttribute('aria-pressed'), 'false', 'top-left reset clears stat filters');
    assert.equal(await page.locator('#modalItemSearch').inputValue(), '', 'top-left reset clears search text');
    assert.equal(await page.locator('#allItemsTab').getAttribute('aria-pressed'), 'true', 'top-left reset returns to all items');
    assert.ok(await page.locator('#modalItemGrid [data-item-id="1036"]').count(), 'top-left reset restores items excluded by the class and stat filters');
    for (const [filter, included, excluded] of [['Mana', '1004', '1006'], ['Health', '1006', '1004'], ['NonbootsMovement', '1001', '1036'], ['LifeSteal', '4633', '3089'], ['OnHit', '3057', '3089']]) {
      await page.locator(`[data-item-filter="${filter}"]`).click();
      assert.ok(await page.locator(`#modalItemGrid [data-item-id="${included}"]`).count(), `${filter} includes its relevant item category`);
      assert.equal(await page.locator(`#modalItemGrid [data-item-id="${excluded}"]`).count(), 0, `${filter} excludes unrelated items`);
      await page.locator('#resetItemFilters').click();
    }
    const output = path.join(fixtures, 'screenshots');
    fs.mkdirSync(output, {recursive: true});
    await page.screenshot({path: path.join(output, 'item-picker-desktop.png')});
    await page.setViewportSize({width: 1440, height: 600});
    const shortPicker = await page.locator('#itemModal .picker-shell').boundingBox();
    assert.ok(shortPicker.y >= 0 && shortPicker.y + shortPicker.height <= 600, 'item picker fits a short desktop viewport');
    await page.screenshot({path: path.join(output, 'item-picker-short-desktop.png')});
    await page.setViewportSize({width: 1440, height: 900});
    await page.locator('#closeItemModalBtn').click();
    await page.locator('#championPickerBtn').click();
    await page.screenshot({path: path.join(output, 'champion-picker-desktop.png')});
    await page.locator('#closeChampModalBtn').click();
    await page.evaluate(raw=>{BUILDER.cdragonRaw=raw;},JSON.parse(read('Aurora.bin.json')));
    await page.locator('[data-slot="0"]').click();
    assert.ok(await page.locator('#recommendedItemsTab').isVisible());await page.locator('#recommendedItemsTab').click();
    assert.equal(await page.locator('#recommendedItemsTab').getAttribute('aria-pressed'),'true');
    assert.ok(await page.locator('#modalItemGrid [data-item-id="6653"]').count(),'Aurora source recommendation is available');
    assert.equal(await page.locator('#modalItemGrid [data-item-id="1036"]').count(),0,'non-recommended item is omitted');
    await page.locator('#resetItemFilters').click();
    assert.equal(await page.locator('#recommendedItemsTab').getAttribute('aria-pressed'), 'false', 'top-left reset also clears Recommended');
    await page.locator('#closeItemModalBtn').click();

    const equip = async (slot, id) => {
      await page.locator(`[data-slot="${slot}"]`).click();
      await page.locator('#resetItemFilters').click();
      if (id) await page.locator(`#modalItemGrid [data-item-id="${id}"]`).click();
      await page.locator(`#modalItemDetail [data-set-item-id="${id}"]`).click();
    };
    await equip(1, '1001');
    const swordAndBoots = itemFixtures['1036'].gold.total + itemFixtures['1001'].gold.total;
    assert.equal(await buildGold(), swordAndBoots, 'total build gold sums equipped item prices');
    await equip(6, '1202');
    assert.equal(await page.evaluate(() => BUILDER.itemSlots[7]), '1001', 'Bot quest relocates existing boots to its extra slot');
    assert.equal(await buildGold(), swordAndBoots, 'moving boots to the Bot slot preserves their contribution exactly once');
    await equip(7, '3006');
    assert.equal(await buildGold(), itemFixtures['1036'].gold.total + itemFixtures['3006'].gold.total, 'replacing extra-slot boots uses the new full price');
    await equip(6, '1200');
    assert.equal(await page.evaluate(() => BUILDER.itemSlots[1]), '3006', 'leaving Bot returns boots to the regular inventory');
    assert.equal(await buildGold(), itemFixtures['1036'].gold.total + itemFixtures['3006'].gold.total, 'returning boots to regular slots preserves build gold');
    await equip(1, '');
    assert.equal(await buildGold(), itemFixtures['1036'].gold.total, 'clearing an item immediately removes its cost');
    await equip(0, '');
    assert.equal(await buildGold(), 0, 'a role quest without purchased items has zero build gold');
    assert.deepEqual(errors, []);
    console.log('Nonblocking startup, optional-data failure, picker interactions, shop filters, retained detail prices and build gold including role-slot moves passed');
  } finally { releaseOptional?.(); await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
