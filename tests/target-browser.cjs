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
    const select = async name => {
      await page.evaluate(async name => {
        BUILDER.itemSlots = Array(7).fill('');
        await setChampion(name);
        await ensureGameText();
        BUILDER.runeSelections.primary = [];
        BUILDER.runeSelections.secondary = [];
        BUILDER.runeSelections.shards = [];
        BUILDER.combatValues = {};
        BUILDER.abilityRanks = { q: 5, w: 5, e: 5, r: 3 };
        renderStats(); renderAbilityCards();
      }, name);
      await page.locator('#builderLevel').selectOption('18');
    };
    const edit = async (selector, value) => {
      await page.locator(selector).fill(String(value));
      await page.locator(selector).press('Tab');
    };
    const equip = ids => page.evaluate(ids => {
      BUILDER.itemSlots = Array.from({ length: 7 }, (_, index) => ids[index] || '');
      renderItemSlots(); renderStats(); renderAbilityCards();
    }, ids);
    const enabled = async value => {
      if (await page.locator('#targetEnabled').getAttribute('aria-pressed') !== String(value)) await page.locator('#targetEnabled').click();
      assert.equal(await page.locator('#targetEnabled').getAttribute('aria-pressed'), String(value));
    };
    const target = async values => {
      const controls = { maxHp: '#targetMaxHp', currentHp: '#targetCurrentHp', armor: '#targetArmor', mr: '#targetMr', damageReduction: '#targetDamageReduction' };
      for (const [key, value] of Object.entries(values)) await edit(controls[key], value);
    };
    const result = () => page.evaluate(() => {
      const stats = computeDerivedBuildStats();
      return { stats, attack: computeAutoAttackProfile(stats), target: BUILDER.target };
    });
    const ability = slot => page.locator(`[data-ability-slot="${slot}"]`);
    const rows = slot => ability(slot).locator('.ability-dps-table tbody tr').evaluateAll(rows => rows.map(row => ({ label: row.children[0].textContent.trim(), damage: row.children[1].textContent.trim(), dps: row.children[2].textContent.trim() })));
    const metadata = () => page.locator('.ability-meta > span:not(.ability-damage-summary)').allTextContents();
    const statValue = name => page.locator('#statsTable').evaluate((element, name) => [...element.querySelectorAll('.stats-label')].find(label => label.textContent.trim().endsWith(name))?.nextElementSibling.textContent, name);
    const sourceValue = (slot, name, rank = 1) => page.evaluate(({ slot, name, rank }) => {
      const value = BUILDER.cdragonAbilityData[slot].dataValues.find(value => (value.mName ?? value.name) === name);
      return (value.mValues ?? value.values)[rank];
    }, { slot, name, rank });
    const checkSummary = async slot => {
      const damage = (await rows(slot)).flatMap(row => numbers(row.damage));
      const compact = numbers(await ability(slot).locator('.ability-damage-summary').textContent());
      assert.deepEqual(compact, damage, `${slot.toUpperCase()} compact numbers match detailed damage rows`);
    };
    const detailed = async slot => {
      const toggle = ability(slot).locator('.detail-toggle');
      if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
      return ability(slot).locator('.detailed-description').innerText();
    };
    const prose = async slot => {
      await detailed(slot);
      return ability(slot).locator('.detailed-description').evaluate(element => {
        const copy = element.cloneNode(true);
        copy.querySelectorAll('.ability-effect-values, .ability-dps, .ability-dps-form').forEach(element => element.remove());
        return copy.textContent;
      });
    };
    const proseDamage = slot => ability(slot).locator('.detailed-description .target-damage-number').evaluateAll(elements => elements.map(element => ({ value: Number(element.textContent.replaceAll(',', '')), raw: Number(element.dataset.rawDamage), type: element.dataset.damageType, title: element.title })));

    assert.equal(await page.locator('#targetEnabled').getAttribute('aria-pressed'), 'false', 'target mitigation is initially off');
    await select('Ashe');
    const initial = await result();
    const unchangedMeta = await metadata();
    const rawAshe = await rows('w');
    await target({ maxHp: 3000, currentHp: 1200, armor: 100, mr: 300, damageReduction: 20 });
    near((await result()).attack.autoAttackDamage, initial.attack.autoAttackDamage, 'editing disabled targets preserves raw attack damage');
    await enabled(true);
    let current = await result();
    near(current.attack.autoAttackDamage, initial.attack.autoAttackDamage * 0.4, 'physical attacks use armor then percentage damage reduction');
    near(current.attack.attackDps, initial.attack.attackDps * 0.4, 'attack DPS uses mitigated damage');
    near(numbers((await rows('w'))[0].damage)[0], numbers(rawAshe[0].damage)[0] * 0.4, 'Ashe W is physical damage');
    assert.deepEqual(await metadata(), unchangedMeta, 'target mitigation leaves cooldown, cost and range unchanged');
    near(current.stats.ad, initial.stats.ad, 'target armor does not alter displayed champion AD');
    await checkSummary('w');
    assert.match(await page.locator('[data-attack-result="damage"]').getAttribute('title'), /armor|physical|mitigat/i, 'attack hover explains target mitigation');
    await enabled(false);
    near((await result()).attack.autoAttackDamage, initial.attack.autoAttackDamage, 'turning targets off restores raw damage');
    assert.deepEqual((await result()).target, { enabled: false, maxHp: 3000, currentHp: 1200, armor: 100, mr: 300, damageReduction: 20 }, 'off retains edited target values');

    await select('Ezreal');
    assert.equal(await page.locator('#targetMaxHp').inputValue(), '3000', 'changing champions retains target HP');
    await equip(['1058']);
    const ezrealQ = await rows('q');
    const ezrealW = await rows('w');
    const ezrealMeta = await metadata();
    await enabled(true);
    near(numbers((await rows('q'))[0].damage)[0], numbers(ezrealQ[0].damage)[0] * 0.4, 'Ezreal Q remains physical despite scaling with AP');
    near(numbers((await rows('w'))[0].damage)[0], numbers(ezrealW[0].damage)[0] * 0.2, 'Ezreal W uses MR despite scaling with AD');
    assert.deepEqual(await metadata(), ezrealMeta, 'spell costs and cooldowns are not mitigated');
    await checkSummary('q'); await checkSummary('w');

    await select('Ahri');
    await enabled(false);
    let raw = await rows('q');
    const ahriMeta = await metadata();
    await enabled(true);
    let mitigated = await rows('q');
    near(numbers(mitigated[0].damage)[0], numbers(raw[0].damage)[0] * 0.2, 'Ahri Q outgoing magic damage');
    near(numbers(mitigated[1].damage)[0], numbers(raw[1].damage)[0], 'Ahri Q return true damage bypasses MR and damage reduction');
    near(numbers(mitigated[2].damage)[0], numbers(raw[0].damage)[0] * 0.2 + numbers(raw[1].damage)[0], 'Ahri Q combined total mitigates each damage type separately');
    near(numbers(mitigated[0].dps)[0], numbers(raw[0].dps)[0] * 0.2, 'Ahri outgoing DPS uses its mitigated magic damage');
    assert.deepEqual(await metadata(), ahriMeta);
    await checkSummary('q');
    const ahriDetail = await prose('q');
    assert.ok(numbers(ahriDetail).some(value => Math.abs(value - numbers(mitigated[0].damage)[0]) < 0.11), 'detailed ability prose includes mitigated outgoing damage');
    assert.ok(numbers(ahriDetail).some(value => Math.abs(value - numbers(raw[1].damage)[0]) < 0.11), 'detailed ability prose retains true return damage');
    const ahriProse = await proseDamage('q');
    assert.deepEqual(ahriProse.map(row => row.type), ['magic', 'true'], 'both Ahri Q prose hits carry their own damage type');
    near(ahriProse[0].value, ahriProse[0].raw * 0.2, 'magic prose number is mitigated independently of the damage table');
    near(ahriProse[1].value, ahriProse[1].raw, 'true prose number is unchanged independently of the damage table');
    assert.ok(ahriProse.every(row => /damage/i.test(row.title)), 'each prose damage number has its calculation in the hover text');

    await select('Lillia');
    await enabled(false);
    raw = await rows('q');
    const rawLillia = numbers(raw[0].damage);
    await enabled(true);
    const targetLillia = numbers((await rows('q'))[0].damage);
    near(targetLillia[0], rawLillia[0] * 0.2, 'Lillia Q inner hit is magic');
    near(targetLillia[1], rawLillia[0] * 0.2 + rawLillia[1] - rawLillia[0], 'Lillia Q outer edge preserves the true-damage part');
    await checkSummary('q');

    await select('Yone');
    await enabled(false);
    raw = await rows('r');
    await enabled(true);
    near(numbers((await rows('r'))[0].damage)[0], numbers(raw[0].damage)[0] * (0.4 + 0.2) / 2, 'Yone R combines separately mitigated physical and magic halves');
    await checkSummary('r');

    await select('Chogath');
    await enabled(false);
    raw = await rows('r');
    await enabled(true);
    mitigated = await rows('r');
    assert.deepEqual(mitigated, raw, 'Cho’Gath Feast damage and DPS bypass both resists and ordinary damage reduction');
    await target({ damageReduction: 100 });
    assert.deepEqual(await rows('r'), raw, '100% ordinary damage reduction still does not reduce true damage');
    near((await result()).attack.autoAttackDamage, 0, '100% damage reduction removes physical attack damage');
    await target({ damageReduction: 20 });

    await select('Ashe');
    await equip(['3153']);
    await target({ maxHp: 3000, currentHp: 900 });
    let attack = (await result()).attack;
    assert.ok(Number.isFinite(attack.autoAttackDamage), 'current-health on-hit resolves from unified target settings');
    const firstBorkTotal = attack.autoAttackDamage;
    await target({ currentHp: 1800 });
    near((await result()).attack.autoAttackDamage - firstBorkTotal, (1800 - 900) * 0.06 * 0.4, 'Blade of the Ruined King uses current HP then physical mitigation');
    assert.equal(await page.locator('[data-attack-control^="attack:target:"]').count(), 0, 'legacy attack target fields do not duplicate the unified controls');

    await select('DrMundo');
    let healthRows = await rows('q');
    near(numbers(healthRows[0].damage)[0], 1800 * 0.3 * 0.2, 'Mundo Q resolves current-health damage then applies MR');
    await target({ currentHp: 2400 });
    healthRows = await rows('q');
    near(numbers(healthRows[0].damage)[0], 2400 * 0.3 * 0.2, 'changing current HP updates ability damage and its compact summary');
    await checkSummary('q');

    await select('KogMaw');
    const kogBefore = (await result()).attack.autoAttackDamage;
    const kogToggle = page.locator('[data-ability-slot="w"] [data-attack-control="attack:championOnHit"]');
    assert.equal(await kogToggle.getAttribute('aria-pressed'), 'false', 'Kog W starts inactive');
    // Edit a focused target, then click the ability immediately: blur must not
    // replace the button between pointerdown and pointerup and swallow its click.
    await page.locator('#targetCurrentHp').fill('1800');
    await kogToggle.click();
    assert.equal(await kogToggle.getAttribute('aria-pressed'), 'true', 'Kog W toggle activates the on-hit');
    assert.equal((await result()).target.currentHp, 1800, 'a direct target-edit-to-ability-click retains the edit');
    const kogAfter = await result();
    near(kogAfter.attack.autoAttackDamage - kogBefore, 3000 * 0.06 * 0.2, 'Kog’Maw W max-health on-hit uses the shared target and magic mitigation');
    near(numbers((await rows('w'))[0].damage)[0], 3000 * 0.06 * 0.2, 'Kog’Maw W ability damage matches its on-hit magic component');
    await checkSummary('w');

    await select('Soraka');
    await enabled(false);
    const rawHealing = await prose('w');
    await enabled(true);
    assert.equal(await prose('w'), rawHealing, 'target settings do not change ability healing or its health cost');

    await select('Ashe');
    await equip(['3035', '3134']);
    await enabled(false);
    const noTarget = await result();
    await enabled(true);
    current = await result();
    const effectiveArmor = Math.max(0, 100 * (1 - current.stats.item.arPenPct / 100) - current.stats.item.arPenFlat);
    assert.ok(current.stats.item.arPenPct > 0 && current.stats.item.arPenFlat > 0, 'physical penetration fixture contains percentage and flat penetration');
    near(current.attack.autoAttackDamage, noTarget.attack.autoAttackDamage * 100 / (100 + effectiveArmor) * 0.8, 'percentage armor penetration is applied before lethality');

    await select('Ahri');
    await equip(['3135', '3020']);
    await enabled(false);
    raw = await rows('q');
    await enabled(true);
    current = await result();
    const effectiveMr = Math.max(0, 300 * (1 - current.stats.item.mrPenPct / 100) - current.stats.item.mrPenFlat);
    assert.ok(current.stats.item.mrPenPct > 0 && current.stats.item.mrPenFlat > 0, 'magic penetration fixture contains percentage and flat penetration');
    near(numbers((await rows('q'))[0].damage)[0], numbers(raw[0].damage)[0] * 100 / (100 + effectiveMr) * 0.8, 'percentage magic penetration is applied before flat magic penetration');

    await select('Darius');
    await equip(['3035']);
    await enabled(false);
    const rawDarius = { rows: await rows('q'), result: await result() };
    const dariusSourcePen = await sourceValue('e', 'PassivePercentArmorPen', 5);
    const dariusCombinedPen = 100 * (1 - (1 - rawDarius.result.stats.item.arPenPct / 100) * (1 - dariusSourcePen / 100));
    near(rawDarius.result.stats.armorPenPct, dariusCombinedPen, 'Darius E and Last Whisper percentage penetration combine multiplicatively');
    near(numbers(await statValue('ARPen'))[1], dariusCombinedPen, 'Darius Champion stats includes passive armor penetration');
    await enabled(true);
    const learnedDarius = await result();
    const dariusMultiplier = 100 / (100 + 100 * (1 - dariusCombinedPen / 100)) * 0.8;
    near(learnedDarius.attack.autoAttackDamage, rawDarius.result.attack.autoAttackDamage * dariusMultiplier, 'Darius attacks use combined champion and item penetration');
    near(numbers((await rows('q'))[0].damage)[0], numbers(rawDarius.rows[0].damage)[0] * dariusMultiplier, 'Darius Q uses combined champion and item penetration');
    await detailed('q');
    for (const damage of await proseDamage('q')) if (damage.type === 'physical') near(damage.value, damage.raw * dariusMultiplier, 'Darius Q prose uses combined penetration');
    await page.locator('#rank_e').selectOption('0');
    const unlearnedDarius = await result();
    near(unlearnedDarius.stats.armorPenPct, unlearnedDarius.stats.item.arPenPct, 'unlearned Darius E removes only champion penetration');
    near(numbers(await statValue('ARPen'))[1], unlearnedDarius.stats.item.arPenPct, 'Darius stats row updates when E is unlearned');
    const dariusItemOnly = 100 / (100 + 100 * (1 - unlearnedDarius.stats.item.arPenPct / 100)) * 0.8;
    near(unlearnedDarius.attack.autoAttackDamage, rawDarius.result.attack.autoAttackDamage * dariusItemOnly, 'unlearning Darius E updates attack mitigation');
    near(numbers((await rows('q'))[0].damage)[0], numbers(rawDarius.rows[0].damage)[0] * dariusItemOnly, 'unlearning Darius E updates ability mitigation');

    await select('Mordekaiser');
    await equip(['3135', '3115']);
    await enabled(false);
    const rawMorde = { rows: await rows('q'), result: await result() };
    const mordeSourcePen = await sourceValue('e', 'MagicPen', 5);
    const mordeCombinedPen = 100 * (1 - (1 - rawMorde.result.stats.item.mrPenPct / 100) * (1 - mordeSourcePen));
    near(rawMorde.result.stats.magicPenPct, mordeCombinedPen, 'Mordekaiser E and Void Staff percentage penetration combine multiplicatively');
    near(numbers(await statValue('MRPen'))[1], mordeCombinedPen, 'Mordekaiser Champion stats includes passive magic penetration');
    await enabled(true);
    const learnedMorde = await result();
    const mordeMultiplier = 100 / (100 + 300 * (1 - mordeCombinedPen / 100)) * 0.8;
    near(numbers((await rows('q'))[0].damage)[0], numbers(rawMorde.rows[0].damage)[0] * mordeMultiplier, 'Mordekaiser Q uses champion and item magic penetration');
    const mordeOnHit = learnedMorde.attack.rows.find(row => row.type === 'magic');
    assert.ok(mordeOnHit && mordeOnHit.rawValue > 0, 'Mordekaiser has a numeric magic on-hit component');
    near(mordeOnHit.value, mordeOnHit.rawValue * mordeMultiplier, 'Mordekaiser magic attacks use champion and item penetration');
    await page.locator('#rank_e').selectOption('0');
    const unlearnedMorde = await result();
    near(unlearnedMorde.stats.magicPenPct, unlearnedMorde.stats.item.mrPenPct, 'unlearned Mordekaiser E removes only champion penetration');
    near(numbers(await statValue('MRPen'))[1], unlearnedMorde.stats.item.mrPenPct, 'Mordekaiser stats row updates when E is unlearned');
    const mordeItemOnly = 100 / (100 + 300 * (1 - unlearnedMorde.stats.item.mrPenPct / 100)) * 0.8;
    near(numbers((await rows('q'))[0].damage)[0], numbers(rawMorde.rows[0].damage)[0] * mordeItemOnly, 'unlearning Mordekaiser E updates ability mitigation');
    const mordeNoEOnHit = unlearnedMorde.attack.rows.find(row => row.type === 'magic');
    near(mordeNoEOnHit.value, mordeNoEOnHit.rawValue * mordeItemOnly, 'unlearning Mordekaiser E updates magic attack mitigation');

    await select('Aphelios');
    await equip(['3134']);
    await enabled(false);
    const rawAphelios = { rows: await rows('r'), result: await result() };
    const apheliosPenPerRank = await sourceValue('p', 'APPerRank');
    await enabled(true);
    const initialAphelios = await result();
    const apheliosInitialPen = initialAphelios.stats.item.arPenFlat;
    near(initialAphelios.stats.armorPenFlat, apheliosInitialPen, 'Aphelios starts with item lethality only');
    await edit('[data-combat-key="buff:{f79080ae}"]', 6);
    const upgradedAphelios = await result();
    const apheliosCombinedPen = apheliosInitialPen + 6 * apheliosPenPerRank;
    near(upgradedAphelios.stats.armorPenFlat, apheliosCombinedPen, 'six Aphelios upgrades add their source-defined lethality');
    near(numbers(await statValue('ARPen'))[0], apheliosCombinedPen, 'Aphelios lethality upgrades appear in Champion stats');
    const apheliosMultiplier = 100 / (100 + Math.max(0, 100 - apheliosCombinedPen)) * 0.8;
    near(upgradedAphelios.attack.autoAttackDamage, rawAphelios.result.attack.autoAttackDamage * apheliosMultiplier, 'Aphelios attacks use upgraded lethality');
    near(numbers((await rows('r'))[0].damage)[0], numbers(rawAphelios.rows[0].damage)[0] * apheliosMultiplier, 'Aphelios ability damage uses upgraded lethality');
    await edit('[data-combat-key="buff:{f79080ae}"]', 0);
    near((await result()).attack.autoAttackDamage, initialAphelios.attack.autoAttackDamage, 'removing Aphelios upgrades restores item-only attack mitigation');

    await select('Aurora');
    await equip(['1058']);
    await edit('[data-combat-key="state:auroraSpirits"]', 4);
    await target({ maxHp: 4000, currentHp: 1200 });
    const auroraStats = await result();
    const expectedProc = 4000 * (0.01 + 0.00027 * auroraStats.stats.ap) * 0.2;
    const auraText = await detailed('p');
    assert.match(auraText, /max(?:imum)?\s+HP/i, 'Aurora keeps the max-health scaling explanation');
    assert.ok(numbers(auraText).some(value => Math.abs(value - expectedProc) < 0.11), `Aurora passive prose resolves target max-health proc damage after MR (${expectedProc}): ${auraText}`);
    const expectedHealing = 4 * (20 + 0.02 * auroraStats.stats.ap);
    assert.ok(numbers(auraText).some(value => Math.abs(value - expectedHealing) < 0.11), 'Aurora spirit healing is not reduced by target resists or damage reduction');

    await select('Ezreal');
    await equip(['3100']);
    await page.locator('[data-attack-control="attack:spellblade"]').click();
    await page.locator('#passiveToggleBtn').click();
    const lichText = await page.locator('[data-passive-section="3100:spellblade"]').innerText();
    current = await result();
    const lichProc = (123.75 * 0.75 + current.stats.ap * 0.45) * 0.2;
    assert.ok(numbers(lichText).some(value => Math.abs(value - lichProc) < 0.11), `Lich Bane passive prose displays post-MR spellblade damage (${lichProc}): ${lichText}`);
    await page.locator('#closePassiveModalBtn').click();
    await page.locator('[data-slot="0"]').click();
    await page.evaluate(() => renderModalItemDetail('3100'));
    const lichDetail = await page.locator('#modalItemDetail').innerText();
    assert.ok(numbers(lichDetail).some(value => Math.abs(value - lichProc) < 0.11), 'item selection detail also displays post-MR spellblade damage');
    await page.locator('#closeItemModalBtn').click();

    await select('Ahri');
    await equip(['4645', '3100']);
    await target({ maxHp: 4000, currentHp: 1600, armor: 100, mr: 300, damageReduction: 20 });
    await page.locator('[data-attack-control="attack:spellblade"]').click();
    const shadowThreshold = { rows: await rows('q'), result: await result() };
    const thresholdLich = shadowThreshold.result.attack.rows.find(row => String(row.spellbladeId) === '3100');
    await page.locator('#passiveToggleBtn').click();
    const shadowToggle = page.locator('[data-item-passive="4645:cinderbloom"]');
    assert.equal(await shadowToggle.getAttribute('aria-pressed'), 'true', 'Cinderbloom remains enabled when the target is exactly at its threshold');
    await page.locator('#closePassiveModalBtn').click();
    await target({ currentHp: 1599 });
    const shadowLow = { rows: await rows('q'), result: await result() };
    near(numbers(shadowLow.rows[0].damage)[0], numbers(shadowThreshold.rows[0].damage)[0] * 1.2, 'Cinderbloom amplifies Ahri Q magic damage only below 40% HP');
    near(numbers(shadowLow.rows[1].damage)[0], numbers(shadowThreshold.rows[1].damage)[0] * 1.2, 'Cinderbloom also amplifies Ahri Q true damage below 40% HP');
    const lowLich = shadowLow.result.attack.rows.find(row => String(row.spellbladeId) === '3100');
    near(lowLich.value, thresholdLich.value * 1.2, 'Cinderbloom amplifies Lich Bane once in attack calculations');
    await detailed('q');
    const shadowProse = await proseDamage('q');
    near(shadowProse.find(row => row.type === 'magic').value, numbers(shadowLow.rows[0].damage)[0], 'Cinderbloom magic prose matches the damage table');
    near(shadowProse.find(row => row.type === 'true').value, numbers(shadowLow.rows[1].damage)[0], 'Cinderbloom true-damage prose matches the damage table');
    await page.locator('#passiveToggleBtn').click();
    const lowLichProse = await page.locator('[data-passive-section="3100:spellblade"] .target-damage-number').allTextContents();
    assert.ok(lowLichProse.some(text => Math.abs(numbers(text)[0] - lowLich.value) < 0.11), 'amplified Lich Bane item prose agrees with its typed attack proc');
    await shadowToggle.click();
    assert.equal(await shadowToggle.getAttribute('aria-pressed'), 'false');
    const shadowOff = { rows: await rows('q'), result: await result() };
    near(numbers(shadowOff.rows[0].damage)[0], numbers(shadowThreshold.rows[0].damage)[0], 'disabling Cinderbloom restores unamplified magic damage below threshold');
    near(numbers(shadowOff.rows[1].damage)[0], numbers(shadowThreshold.rows[1].damage)[0], 'disabling Cinderbloom restores unamplified true damage below threshold');
    near(shadowOff.result.attack.rows.find(row => String(row.spellbladeId) === '3100').value, thresholdLich.value, 'disabling Cinderbloom restores unamplified attack procs');
    near(shadowOff.result.stats.ap, shadowLow.result.stats.ap, 'Cinderbloom toggle preserves the item’s flat AP');
    near(shadowOff.result.stats.item.mrPenFlat, shadowLow.result.stats.item.mrPenFlat, 'Cinderbloom toggle preserves the item’s magic penetration');
    await shadowToggle.click();
    await page.locator('#closePassiveModalBtn').click();
    await target({ mr: 900, damageReduction: 100 });
    const shadowImmune = await rows('q');
    near(numbers(shadowImmune[0].damage)[0], 0, 'Cinderbloom magic amplification does not bypass 100% damage reduction');
    near(numbers(shadowImmune[1].damage)[0], numbers(shadowLow.rows[1].damage)[0], 'amplified true damage still ignores MR and ordinary damage reduction');

    await select('Ezreal');
    await equip(['3100']);
    await page.locator('[data-attack-control="attack:spellblade"]').click();

    await target({ maxHp: 1000, currentHp: 2000, damageReduction: 125 });
    assert.equal(await page.locator('#targetCurrentHp').inputValue(), '1000', 'current HP cannot exceed max HP');
    assert.equal(await page.locator('#targetDamageReduction').inputValue(), '100', 'damage reduction cannot exceed 100%');
    await target({ currentHp: -10, damageReduction: -20 });
    assert.equal(await page.locator('#targetCurrentHp').inputValue(), '0', 'current HP cannot be negative');
    assert.equal(await page.locator('#targetDamageReduction').inputValue(), '0', 'damage reduction cannot be negative');
    await target({ maxHp: 3000, currentHp: 1500, armor: 100, mr: 50, damageReduction: 10 });
    const screenshotDir = process.env.SCREENSHOT_DIR || path.join(fixtures, 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'target-settings-buildsmith.png'), fullPage: true });
    const overflow = await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > innerWidth + 1, vertical: document.documentElement.scrollHeight > innerHeight + 1 }));
    assert.equal(overflow.horizontal, false, 'target controls do not create horizontal page scrolling at 1440×900');
    assert.deepEqual(errors, []);
    console.log('Target browser checks passed: controls, typed damage, mixed abilities, penetration, HP effects, passive and item prose, tooltip and clamp behavior');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
