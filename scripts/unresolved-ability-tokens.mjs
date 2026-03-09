#!/usr/bin/env node

/**
 * Build a report of unresolved Data Dragon tooltip tokens and attach likely
 * associated CDragon records/keys for manual triage.
 *
 * Usage examples:
 *   node scripts/unresolved-ability-tokens.mjs
 *   node scripts/unresolved-ability-tokens.mjs --champions Aatrox,Akali,Akshan
 *   node scripts/unresolved-ability-tokens.mjs --limit 30
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  return args[i + 1] ?? fallback;
};

const OUT_DIR = arg('--out', 'artifacts/unresolved-tokens');
const LIMIT = Number(arg('--limit', '0')) || 0;
const ONLY_CHAMPS = String(arg('--champions', ''))
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)
  .map((v) => v.toLowerCase());

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;
const KNOWN_TOKENS = new Set([
  'cost',
  'cooldown',
  'range',
  'abilityresourcename',
  'spellmodifierdescriptionappend',
  'championlevel',
]);

const SLOT_KEYS = ['q', 'w', 'e', 'r'];

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function normalizeSpellRecordName(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function getTokensFromTooltip(tooltip) {
  const found = new Set();
  let match = TOKEN_RE.exec(String(tooltip || ''));
  while (match) {
    found.add(String(match[1] || '').trim());
    match = TOKEN_RE.exec(String(tooltip || ''));
  }
  return [...found];
}

function stripTokenMath(token) {
  const t = String(token || '').toLowerCase().trim();
  if (!t) return t;
  if (t.endsWith('nl')) return t.slice(0, -2);
  const m = t.match(/^([a-z0-9_]+)\*(-?\d+(?:\.\d+)?)$/);
  return m ? m[1] : t;
}

function extractCdragonSpell(spellRecord) {
  const spell = spellRecord?.mSpell || null;
  if (!spell) return null;
  return {
    recordPath: spellRecord.___recordPath || null,
    dataValues: spell.mDataValues || spell.DataValues || [],
    calculations: spell.mSpellCalculations || spell.SpellCalculations || {},
  };
}

function resolveRecord(raw, pathIndex, requestedPath) {
  if (!requestedPath) return null;
  const key = pathIndex.get(normalizePath(requestedPath));
  if (!key) return null;
  const record = raw[key];
  if (record && typeof record === 'object') record.___recordPath = key;
  return record || null;
}

function scoreSpellCandidate(parsed, ddSpellTokens) {
  if (!parsed) return -1;
  const calcKeys = Object.keys(parsed.calculations || {});
  const dvNames = (parsed.dataValues || []).map((d) => String(d?.mName || ''));

  let overlap = 0;
  const pool = [...calcKeys, ...dvNames].map(normalize);
  ddSpellTokens.forEach((tok) => {
    const nt = normalize(stripTokenMath(tok));
    if (!nt) return;
    if (pool.some((k) => k === nt || k.includes(nt) || nt.includes(k))) overlap += 1;
  });

  return overlap * 100 + calcKeys.length * 3 + dvNames.length;
}

function extractAbilityDataFromRoot(raw, championName, pathName, ddSpells = []) {
  const pathIndex = new Map(Object.keys(raw || {}).map((key) => [normalizePath(key), key]));
  const rootCandidates = [
    `Characters/${championName}/CharacterRecords/Root`,
    `Characters/${pathName}/CharacterRecords/Root`,
  ];

  const rootPath = rootCandidates
    .map((candidate) => pathIndex.get(normalizePath(candidate)))
    .find(Boolean) || null;
  const root = rootPath ? raw[rootPath] : null;
  const abilities = Array.isArray(root?.mAbilities) ? root.mAbilities : [];
  if (!abilities.length) return null;

  const abilityByName = new Map();
  abilities.forEach((abilityPath) => {
    const abilityRecord = resolveRecord(raw, pathIndex, abilityPath);
    if (!abilityRecord) return;
    const thisName = normalizeSpellRecordName(
      abilityRecord?.mScriptName || abilityRecord?.mObjectPath || abilityRecord?.mName,
    );
    if (thisName) abilityByName.set(thisName, abilityRecord);
  });

  const bySlot = {};
  ddSpells.forEach((spell, idx) => {
    const slot = SLOT_KEYS[idx];
    if (!slot) return;

    const nameCandidates = [
      `Characters/${championName}/Spells/${spell?.name}Ability`,
      `Characters/${pathName}/Spells/${spell?.name}Ability`,
      `Characters/${championName}/Spells/${spell?.id}Ability`,
      `Characters/${pathName}/Spells/${spell?.id}Ability`,
      spell?.name,
      spell?.id,
    ].filter(Boolean);

    let abilityRecord = nameCandidates
      .map((candidate) => resolveRecord(raw, pathIndex, candidate))
      .find(Boolean) || null;

    if (!abilityRecord) {
      const normalizedCandidates = nameCandidates.map((candidate) => normalizeSpellRecordName(candidate));
      abilityRecord = normalizedCandidates
        .map((candidate) => abilityByName.get(candidate))
        .find(Boolean) || null;
    }

    if (!abilityRecord) return;
    const childSpells = Array.isArray(abilityRecord?.mChildSpells) ? abilityRecord.mChildSpells : [];
    const candidatePaths = childSpells.length ? childSpells : [abilityRecord.___recordPath].filter(Boolean);
    const ddTokens = getTokensFromTooltip(spell?.tooltip || '');

    const candidates = candidatePaths
      .map((candidatePath) => resolveRecord(raw, pathIndex, candidatePath))
      .map((record) => extractCdragonSpell(record))
      .filter(Boolean)
      .map((parsed) => ({ parsed, score: scoreSpellCandidate(parsed, ddTokens) }));

    if (!candidates.length) return;
    candidates.sort((a, b) => b.score - a.score);
    bySlot[slot] = candidates[0].parsed;
  });

  const passivePathCandidates = [
    `Characters/${championName}/Spells/${championName}PassiveAbility`,
    `Characters/${pathName}/Spells/${pathName}PassiveAbility`,
  ];
  const passiveRecord = passivePathCandidates
    .map((candidate) => resolveRecord(raw, pathIndex, candidate))
    .find(Boolean) || null;
  if (passiveRecord) {
    const childSpells = Array.isArray(passiveRecord?.mChildSpells) ? passiveRecord.mChildSpells : [];
    const candidatePaths = childSpells.length ? childSpells : [passiveRecord.___recordPath].filter(Boolean);
    const candidates = candidatePaths
      .map((p) => resolveRecord(raw, pathIndex, p))
      .map((record) => extractCdragonSpell(record))
      .filter(Boolean);
    if (candidates.length) bySlot.p = candidates[0];
  }

  return Object.keys(bySlot).length ? bySlot : null;
}

function tokenLooksResolved(token, slotPayload, spell) {
  const raw = String(token || '').trim().toLowerCase();
  if (!raw) return true;
  if (raw.includes('gamemodeinteger')) return true;

  const base = stripTokenMath(raw);
  if (KNOWN_TOKENS.has(base)) return true;

  const dataValues = slotPayload?.dataValues || [];
  const calcKeys = Object.keys(slotPayload?.calculations || {});

  const nBase = normalize(base.replace(/tooltip$/i, ''));

  const hasCalc = calcKeys.some((k) => {
    const nk = normalize(k);
    return nk === nBase || nk.includes(nBase) || nBase.includes(nk);
  });
  if (hasCalc) return true;

  const hasDataValue = dataValues.some((d) => {
    const nd = normalize(d?.mName);
    return nd === nBase || nd.includes(nBase) || nBase.includes(nd);
  });
  if (hasDataValue) return true;

  if (/^e\d+$/.test(base)) {
    const idx = Number(base.slice(1));
    if (Array.isArray(spell?.effect?.[idx]) && spell.effect[idx].length) return true;
  }

  if (/^[af]\d+$/.test(base)) {
    const vars = spell?.vars || [];
    if (vars.some((v) => String(v?.key || '').toLowerCase() === base)) return true;
  }

  return false;
}

function bestAssociations(token, slotPayload) {
  const base = stripTokenMath(token).replace(/tooltip$/i, '');
  const nt = normalize(base);
  const calcKeys = Object.keys(slotPayload?.calculations || {});
  const dataValues = (slotPayload?.dataValues || []).map((d) => String(d?.mName || '')).filter(Boolean);

  const rank = (name) => {
    const nn = normalize(name);
    if (nn === nt) return 1000;
    if (!nn || !nt) return -1;
    if (nn.includes(nt)) return 700 - Math.max(0, nn.length - nt.length);
    if (nt.includes(nn)) return 500 - Math.max(0, nt.length - nn.length);
    return -1;
  };

  const calcMatches = calcKeys
    .map((k) => ({ key: k, score: rank(k) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.key);

  const dataMatches = dataValues
    .map((k) => ({ key: k, score: rank(k) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.key);

  return { calcMatches, dataMatches };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status}) ${url}`);
  }
  return res.json();
}

async function main() {
  const versions = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
  const version = versions[0];
  const champIndex = await fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
  let champs = Object.values(champIndex.data || {});
  if (ONLY_CHAMPS.length) {
    champs = champs.filter((c) => ONLY_CHAMPS.includes(String(c.id || '').toLowerCase()) || ONLY_CHAMPS.includes(String(c.name || '').toLowerCase()));
  }

  const rows = [];
  for (const champ of champs) {
    const champName = champ.id;
    const detail = await fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${champName}.json`);
    const champData = detail.data[champName];
    const pathName = String(champName).toLowerCase().replace(/[^a-z0-9]/g, '');

    let cdragonRaw = null;
    try {
      cdragonRaw = await fetchJson(`https://raw.communitydragon.org/latest/game/data/characters/${pathName}/${pathName}.bin.json`);
    } catch (err) {
      rows.push({
        champion: champName,
        spellSlot: '*',
        spellId: '*',
        token: '*cdragon-fetch-failed*',
        reason: String(err.message || err),
        cdragonRecord: '',
        associatedCalcKeys: '',
        associatedDataValues: '',
      });
      continue;
    }

    const cdragonBySlot = extractAbilityDataFromRoot(cdragonRaw, champName, pathName, champData.spells || []) || {};

    for (let i = 0; i < (champData.spells || []).length; i += 1) {
      const spell = champData.spells[i];
      const slot = SLOT_KEYS[i];
      const payload = cdragonBySlot[slot] || { dataValues: [], calculations: {}, recordPath: null };

      const tokens = getTokensFromTooltip(spell.tooltip || '');
      for (const token of tokens) {
        if (tokenLooksResolved(token, payload, spell)) continue;

        const assoc = bestAssociations(token, payload);
        rows.push({
          champion: champName,
          spellSlot: slot.toUpperCase(),
          spellId: spell.id,
          token,
          reason: 'no-calc-or-data-value-match',
          cdragonRecord: payload.recordPath || '',
          associatedCalcKeys: assoc.calcMatches.join(' | '),
          associatedDataValues: assoc.dataMatches.join(' | '),
        });
      }
    }
  }

  const limitedRows = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;

  await mkdir(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, 'unresolved-tokens.json');
  const mdPath = path.join(OUT_DIR, 'unresolved-tokens.md');

  await writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), count: limitedRows.length, rows: limitedRows }, null, 2), 'utf8');

  const md = [
    '# Unresolved Ability Tokens',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Rows: ${limitedRows.length}`,
    '',
    '| Champion | Slot | Spell | Token | CDragon Record | Associated Calc Keys | Associated DataValues |',
    '|---|---|---|---|---|---|---|',
    ...limitedRows.map((r) => `| ${r.champion} | ${r.spellSlot} | ${r.spellId} | \`${r.token}\` | \`${r.cdragonRecord || '-'}\` | ${r.associatedCalcKeys || '-'} | ${r.associatedDataValues || '-'} |`),
    '',
  ].join('\n');

  await writeFile(mdPath, md, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${limitedRows.length} rows to:`);
  // eslint-disable-next-line no-console
  console.log(`- ${jsonPath}`);
  // eslint-disable-next-line no-console
  console.log(`- ${mdPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
