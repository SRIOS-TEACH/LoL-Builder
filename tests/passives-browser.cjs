// Fixture-backed integration checks for champion growth, passive prose and toggles.
// Requires advanced fixtures from scripts/download-test-data.py (ADVANCED_DATA=1).
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
const near = (actual, expected, label) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 0.02, `${label}: ${actual} != ${expected}`);
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
    const result = () => page.evaluate(() => {
      const stats = computeDerivedBuildStats();
      return { stats, attack: computeAutoAttackProfile(stats) };
    });
    const select = async name => {
      await page.evaluate(async name => {
        BUILDER.itemSlots = Array(7).fill('');
        await setChampion(name);
        await ensureGameText();
        BUILDER.runeSelections.primary = [];
        BUILDER.runeSelections.secondary = [];
        BUILDER.runeSelections.shards = [];
        BUILDER.abilityRanks = { q: 5, w: 5, e: 5, r: 3 };
        renderStats(); renderAbilityCards();
      }, name);
      await page.locator('#builderLevel').selectOption('18');
    };
    const edit = async (selector, value) => {
      const input = page.locator(selector);
      await input.fill(String(value));
      await input.dispatchEvent('change');
    };
    const equip = async ids => page.evaluate(ids => {
      BUILDER.itemSlots = Array.from({ length: 7 }, (_, index) => ids[index] || '');
      renderItemSlots(); renderStats(); renderAbilityCards();
    }, ids);
    const passive = page.locator('[data-ability-slot="p"]');
    const detailedPassive = async () => {
      const toggle = passive.locator('.detail-toggle');
      if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
      return passive.locator('.detailed-description').innerText();
    };

    await select('Aurora');
    near((await result()).stats.ad, 104, 'Aurora level 18 base AD');
    await page.locator('#builderLevel').selectOption('1');
    near((await result()).stats.ad, 53, 'Aurora level 1 base AD');
    await page.locator('#builderLevel').selectOption('18');
    assert.equal(await passive.locator('[data-combat-key="state:auroraSpirits"]').getAttribute('max'), '4');
    let text = await detailedPassive();
    assert.match(text, /%[^.]*max(?:imum)?\s+(?:health|HP)/i, 'Aurora passive describes percentage max-health damage');
    assert.match(text, /magic damage/i);
    assert.doesNotMatch(text, /move(?:ment)? speed/i, 'retired movement-speed effect is absent');
    const baseMoveSpeed = (await result()).stats.moveSpeed;
    await edit('[data-combat-key="state:auroraSpirits"]', 4);
    text = await detailedPassive();
    assert.match(text, /heal|restor/i);
    assert.match(text, /\b80\b/, 'four spirits heal 80 health per second at level 18 with no AP');
    near((await result()).stats.moveSpeed, baseMoveSpeed, 'spirits do not grant the removed movement speed');
    await edit('[data-combat-key="state:auroraSpirits"]', 5);
    assert.equal(await page.evaluate(() => BUILDER.combatValues['state:auroraSpirits']), 4, 'over-cap spirits cannot change combat state');

    await select('Ezreal');
    near((await result()).stats.ad, 123.75, 'Ezreal level 18 base AD');
    const unstacked = (await result()).stats.asTotal;
    const stacks = '[data-combat-key="state:risingSpellForceStacks"]';
    assert.equal(await page.locator(stacks).getAttribute('max'), '5');
    text = await detailedPassive();
    assert.match(text, /attack speed/i);
    assert.match(text, /\b10(?:\.0+)?\s*%/);
    assert.match(text, /\b5\b/);
    await edit(stacks, 5);
    near((await result()).stats.asTotal - unstacked, 0.625 * 0.5, 'five Rising Spell Force stacks grant 50% bonus AS using the AS ratio');
    await edit(stacks, 6);
    assert.equal(await page.evaluate(() => BUILDER.combatValues['state:risingSpellForceStacks']), 5, 'over-cap Ezreal stacks cannot change combat state');
    near((await result()).stats.asTotal - unstacked, 0.625 * 0.5, 'invalid stack edit preserves the capped AS');

    await equip(['3042']);
    await page.locator('[data-slot="0"]').click();
    await page.evaluate(() => renderModalItemDetail('3042'));
    const detailText = await page.locator('#modalItemDetail').innerText();
    assert.doesNotMatch(detailText, /\bEffects\b/, 'raw item effects table is removed');
    assert.match(detailText, /Gain 2% max Mana/i);
    assert.match(detailText, /1\.2%/);
    assert.match(detailText, /3%/);
    assert.doesNotMatch(detailText, /value unavailable|text unavailable|@\w+@/i, 'Muramana prose has resolved values');
    await page.locator('#closeItemModalBtn').click();
    assert.equal(await page.locator('#passiveToggleBtn').innerText(), 'Passives');
    await page.locator('#passiveToggleBtn').click();
    const section = key => page.locator(`[data-passive-section="3042:${key}"]`);
    for (const key of ['awe', 'shock-on-hit', 'shock']) assert.equal(await section(key).count(), 1, `Muramana ${key} appears exactly once`);
    assert.equal(await section('shock').locator('.passive-coverage').innerText(), 'Reference effect: not included in damage or stat totals.', 'ability Shock explicitly discloses that it is a reference effect');
    for (const key of ['awe', 'shock-on-hit']) assert.equal(await section(key).locator('.passive-coverage').count(), 0, `modeled Muramana ${key} has no reference-only disclosure`);
    const enabled = await result();
    let body = await section('awe').innerText();
    assert.match(body, /2% max Mana/i);
    body = await section('shock-on-hit').innerText();
    assert.match(body, /1\.2%/);
    body = await section('shock').innerText();
    assert.match(body, /3%/);
    assert.match(body, /ranged/i);
    const valueText = value => Number(value.toFixed(2)).toLocaleString('en-US');
    assert.ok((await section('awe').innerText()).includes(valueText(enabled.stats.mp * 0.02)), 'Awe shows its calculated AD');
    assert.ok((await section('shock-on-hit').innerText()).includes(valueText(enabled.stats.mp * 0.012)), 'Shock on-hit shows calculated damage');
    assert.ok((await section('shock').innerText()).includes(valueText(enabled.stats.mp * 0.03)), 'ranged ability Shock shows calculated damage');
    await page.locator('[data-item-passive="3042:awe"]').click();
    assert.equal(await page.locator('[data-item-passive="3042:awe"]').getAttribute('aria-pressed'), 'false');
    near(enabled.stats.ad - (await result()).stats.ad, enabled.stats.mp * 0.02, 'disabling Awe removes only its mana-to-AD bonus');
    await page.locator('[data-item-passive="3042:awe"]').click();
    near((await result()).stats.ad, enabled.stats.ad, 'reenabling Awe restores AD');
    await page.locator('[data-item-passive="3042:shock-on-hit"]').click();
    near(enabled.attack.autoAttackDamage - (await result()).attack.autoAttackDamage, enabled.stats.mp * 0.012, 'disabling attack Shock removes its on-hit damage');
    near((await result()).stats.ad, enabled.stats.ad, 'Shock toggle leaves Awe enabled');
    await page.locator('[data-item-passive="3042:shock-on-hit"]').click();
    near((await result()).attack.autoAttackDamage, enabled.attack.autoAttackDamage, 'reenabling attack Shock restores damage');
    await page.locator('#closePassiveModalBtn').click();

    await select('Aatrox');
    await equip(['3042']);
    await page.locator('#passiveToggleBtn').click();
    body = await section('shock').innerText();
    assert.match(body, /4%/);
    assert.match(body, /melee/i);
    assert.ok(body.includes(valueText((await result()).stats.mp * 0.04)), 'melee ability Shock uses 4% of actual max mana');
    await page.locator('#closePassiveModalBtn').click();

    await select('Ezreal');
    await equip(['3100']);
    const spellbladeToggle = page.locator('[data-attack-control="attack:spellblade"]');
    if (await spellbladeToggle.getAttribute('aria-pressed') !== 'true') await spellbladeToggle.click();
    const interval = page.locator('[data-attack-control="attack:spellbladeInterval"]');
    assert.equal(await interval.getAttribute('min'), '1.5', 'Spellblade interval enforces its actual cooldown');
    assert.equal(await interval.inputValue(), '1.5', 'Spellblade starts at its minimum cooldown');
    let lich = await result();
    let proc = lich.attack.rows.find(row => String(row.spellbladeId) === '3100');
    near(proc.value, 0.75 * 123.75 + 0.45 * lich.stats.ap, 'Lich Bane proc uses level-scaled base AD plus AP');
    near(proc.interval, 1.5, 'initial Lich Bane proc cadence');
    await edit('[data-attack-control="attack:spellbladeInterval"]', 1);
    lich = await result();
    proc = lich.attack.rows.find(row => String(row.spellbladeId) === '3100');
    assert.ok(proc.interval >= 1.5, 'an interval below cooldown cannot inflate Spellblade DPS');

    await page.locator('#passiveToggleBtn').click();
    const lichSection = page.locator('[data-passive-section="3100:spellblade"]');
    const lichPassiveToggle = page.locator('[data-item-passive="3100:spellblade"]');
    assert.equal(await lichSection.count(), 1, 'Lich Bane has one combined Spellblade section');
    assert.equal(await lichPassiveToggle.getAttribute('aria-pressed'), 'true', 'Passives reflects the active attack control');
    await lichPassiveToggle.click();
    assert.equal(await lichPassiveToggle.getAttribute('aria-pressed'), 'false');
    assert.equal((await result()).attack.rows.filter(row => String(row.spellbladeId) === '3100').length, 0, 'Passives Off removes Spellblade damage');
    assert.ok(await spellbladeToggle.count() === 0 || await spellbladeToggle.getAttribute('aria-pressed') === 'false', 'Attack controls cannot present the disabled Spellblade as active');
    await lichPassiveToggle.click();
    assert.equal(await lichPassiveToggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await spellbladeToggle.getAttribute('aria-pressed'), 'true', 'Passives On activates the attack control');
    assert.equal(await interval.inputValue(), '1.5', 'Passives On retains the minimum interval');
    near((await result()).attack.rows.find(row => String(row.spellbladeId) === '3100').value, proc.value, 'Passives On restores Spellblade damage');
    await page.locator('#closePassiveModalBtn').click();
    await spellbladeToggle.click();
    assert.equal((await result()).attack.rows.filter(row => String(row.spellbladeId) === '3100').length, 0, 'Attack control Off removes Spellblade damage');
    await page.locator('#passiveToggleBtn').click();
    assert.equal(await lichPassiveToggle.getAttribute('aria-pressed'), 'false', 'Passives reflects the disabled attack control');
    await lichPassiveToggle.click();
    assert.equal(await spellbladeToggle.getAttribute('aria-pressed'), 'true', 'Passives can re-enable Spellblade after the attack control turned it off');
    near((await result()).attack.rows.find(row => String(row.spellbladeId) === '3100').interval, 1.5, 're-enabled Spellblade has the default cadence');
    await page.locator('#closePassiveModalBtn').click();

    await equip(['3042', '3100', '3089']);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#passiveToggleBtn').click();
    const modal = page.locator('#passiveModalList');
    const sectionKeys = await modal.locator('[data-passive-section]').evaluateAll(sections => sections.map(section => section.dataset.passiveSection));
    assert.deepEqual(sectionKeys.slice().sort(), ['3042:awe', '3042:shock', '3042:shock-on-hit', '3089:magical-opus', '3100:spellblade'].sort(), 'each equipped passive has exactly one combined section');
    assert.equal(await modal.locator('[data-item-passive]').count(), sectionKeys.length, 'every passive section has one toggle');
    for (const key of sectionKeys) assert.equal(await page.locator(`[data-passive-section="${key}"] [data-item-passive]`).count(), 1, `${key} has a toggle inside its own section`);
    assert.doesNotMatch(await modal.innerText(), /\bEffects\b|value unavailable|text unavailable|@\w+@/i, 'Passives contains resolved prose without a raw Effects section');
    const screenshotDir = process.env.SCREENSHOT_DIR || path.join(fixtures, 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'passives-buildsmith.png'), fullPage: true });

    await page.locator('#closePassiveModalBtn').click();
    await select('Chogath');
    await equip(['3083', '1011']);
    await page.evaluate(() => {
      BUILDER.runeSelections.shards = ['health'];
      renderStats(); renderAbilityCards();
    });
    await edit('[data-combat-key="buff:{8682fc00}"]', 2);
    const warmogOn = (await result()).stats;
    near(warmogOn.item.hp, 1350, 'Warmog and Giant\'s Belt supply 1,350 item health');
    near(warmogOn.rune.hp, 65, 'health rune supplies separate bonus health');
    assert.ok(warmogOn.championBonuses.hp > 0, 'Feast supplies separate champion bonus health');
    await page.locator('#passiveToggleBtn').click();
    const vitality = page.locator('[data-item-passive="3083:warmog-s-vitality"]');
    assert.equal(await vitality.getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('[data-passive-section="3083:warmog-s-vitality"]').innerText(), /\b162\b/, 'Vitality prose resolves 12% of the equipped item health');
    await vitality.click();
    const warmogOff = (await result()).stats;
    near(warmogOn.hp - warmogOff.hp, 1350 * 0.12, 'Vitality amplifies only item-derived HP, excluding natural growth, rune health and Feast');
    near(warmogOff.item.hp, warmogOn.item.hp, 'disabling Vitality retains the items\' flat health');
    near(warmogOff.rune.hp, warmogOn.rune.hp, 'disabling Vitality retains rune health');
    near(warmogOff.championBonuses.hp, warmogOn.championBonuses.hp, 'disabling Vitality retains Feast health');
    await vitality.click();
    near((await result()).stats.hp, warmogOn.hp, 'reenabling Vitality restores only its item-health bonus');
    assert.deepEqual(errors, []);
    console.log('Passive browser checks passed: AD growth, champion stacks and prose, item descriptions, Muramana splits and toggles, Spellblade cadence');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
