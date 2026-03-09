#!/usr/bin/env node

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
const ONLY_CHAMPS = String(arg('--champions', '')).split(',').map((v) => v.trim()).filter(Boolean).map((v) => v.toLowerCase());

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;
const KNOWN_TOKENS = new Set(['cost', 'cooldown', 'range', 'abilityresourcename', 'spellmodifierdescriptionappend', 'championlevel']);
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

function isOpaquePath(value) {
  return /^\{[0-9a-f]+\}$/i.test(String(value || '').trim());
}

function parseQualifiedToken(token) {
  const t = String(token || '').trim().toLowerCase();
  const m = t.match(/^spell\.([^:]+):(.+)$/);
  if (!m) return null;
  return { spellRef: normalize(m[1]), tokenPart: m[2] };
}

function stripTokenMath(token) {
  const t = String(token || '').toLowerCase().trim();
  if (!t) return t;
  if (t.endsWith('nl')) return t.slice(0, -2);
  const m = t.match(/^([a-z0-9_.:]+)\*(-?\d+(?:\.\d+)?)$/);
  return m ? m[1] : t;
}

function isKnownNonCdragonToken(baseToken) {
  if (!baseToken) return true;
  if (KNOWN_TOKENS.has(baseToken)) return true;
  if (baseToken.includes('gamemodeinteger')) return true;
  if (/^[fe]\d+(?:\.\d+)?$/.test(baseToken)) return true; // legacy placeholders like f1, e0
  if (baseToken.includes('{{')) return true; // malformed nested token fragment
  return false;
}

function getTokensFromTooltip(tooltip) {
  const source = String(tooltip || '');
  const found = new Set();
  TOKEN_RE.lastIndex = 0;
  let match = TOKEN_RE.exec(source);
  while (match) {
    found.add(String(match[1] || '').trim());
    match = TOKEN_RE.exec(source);
  }
  return [...found];
}

function chooseRecordLabel(recordPath, record) {
  if (!recordPath) return '-';
  if (!isOpaquePath(recordPath)) return recordPath;
  const fallback = record?.mObjectPath || record?.mScriptName || record?.mName || '-';
  return `${recordPath} (${fallback})`;
}

function extractCdragonSpell(recordPath, spellRecord) {
  const spell = spellRecord?.mSpell || null;
  if (!spell) return null;
  return {
    recordPath,
    recordLabel: chooseRecordLabel(recordPath, spellRecord),
    rawRecord: spellRecord,
    dataValues: spell.mDataValues || spell.DataValues || [],
    calculations: spell.mSpellCalculations || spell.SpellCalculations || {},
  };
}

function resolveRecord(raw, pathIndex, requestedPath) {
  if (!requestedPath) return null;
  const key = pathIndex.get(normalizePath(requestedPath));
  if (!key) return null;
  return { path: key, record: raw[key] };
}

function scoreSpellCandidate(parsed, ddSpellTokens, ddSpellId) {
  if (!parsed) return -1;
  const calcKeys = Object.keys(parsed.calculations || {});
  const dvNames = (parsed.dataValues || []).map((d) => String(d?.mName || ''));

  let overlap = 0;
  const pool = [...calcKeys, ...dvNames].map(normalize);
  ddSpellTokens.forEach((tok) => {
    const nt = normalize(stripTokenMath(tok));
    if (!nt || isKnownNonCdragonToken(nt)) return;
    if (pool.some((k) => k === nt || k.includes(nt) || nt.includes(k))) overlap += 1;
  });

  const idBonus = normalize(parsed.recordPath).includes(normalize(ddSpellId)) ? 25 : 0;
  return overlap * 100 + calcKeys.length * 3 + dvNames.length + idBonus;
}

function buildChampionSpellIndex(raw) {
  const out = [];
  for (const [key, value] of Object.entries(raw || {})) {
    if (!value || typeof value !== 'object' || !value.mSpell) continue;
    const parsed = extractCdragonSpell(key, value);
    if (!parsed) continue;
    out.push(parsed);
  }
  return out;
}

function findBySpellRef(spellIndex, spellRef) {
  if (!spellRef) return [];
  return spellIndex.filter((row) => {
    const path = normalize(row.recordPath);
    const obj = normalize(row.rawRecord?.mObjectPath);
    const script = normalize(row.rawRecord?.mScriptName);
    const name = normalize(row.rawRecord?.mName);
    return [path, obj, script, name].some((v) => v.includes(spellRef) || spellRef.includes(v));
  });
}

function findKeyMatches(name, keys) {
  const nt = normalize(name);
  return keys
    .map((k) => {
      const nk = normalize(k);
      let score = -1;
      if (!nk || !nt) score = -1;
      else if (nk === nt) score = 1000;
      else if (nk.includes(nt)) score = 700 - Math.max(0, nk.length - nt.length);
      else if (nt.includes(nk)) score = 500 - Math.max(0, nt.length - nk.length);
      return { key: k, score };
    })
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function tokenResolvedInPayload(token, payload, spell) {
  const raw = String(token || '').trim().toLowerCase();
  const base = stripTokenMath(raw);
  if (isKnownNonCdragonToken(base)) return { resolved: true, reason: 'known-non-cdragon' };

  const qualified = parseQualifiedToken(base);
  const effective = qualified ? stripTokenMath(qualified.tokenPart) : base.replace(/tooltip$/i, '');
  const calcMatches = findKeyMatches(effective, Object.keys(payload?.calculations || {}));
  if (calcMatches.length) return { resolved: true, reason: 'calc-key-match' };

  const dvMatches = findKeyMatches(effective, (payload?.dataValues || []).map((d) => String(d?.mName || '')).filter(Boolean));
  if (dvMatches.length) return { resolved: true, reason: 'data-value-match' };

  if (/^e\d+$/.test(effective)) {
    const idx = Number(effective.slice(1));
    if (Array.isArray(spell?.effect?.[idx]) && spell.effect[idx].length) return { resolved: true, reason: 'effect-index-match' };
  }
  if (/^[af]\d+$/.test(effective)) {
    const vars = spell?.vars || [];
    if (vars.some((v) => String(v?.key || '').toLowerCase() === effective)) return { resolved: true, reason: 'vars-match' };
  }

  return { resolved: false, reason: 'no-local-match' };
}

function bestAssociations(token, localPayload, spellIndex, maxRows = 6) {
  const base = stripTokenMath(token).replace(/tooltip$/i, '');
  const qualified = parseQualifiedToken(base);
  const tokenPart = qualified ? stripTokenMath(qualified.tokenPart) : base;

  const localCalc = findKeyMatches(tokenPart, Object.keys(localPayload?.calculations || {})).map((r) => r.key);
  const localData = findKeyMatches(tokenPart, (localPayload?.dataValues || []).map((d) => String(d?.mName || '')).filter(Boolean)).map((r) => r.key);

  let scope = spellIndex;
  if (qualified?.spellRef) {
    const scoped = findBySpellRef(spellIndex, qualified.spellRef);
    if (scoped.length) scope = scoped;
  }

  const globalMatches = [];
  for (const row of scope) {
    const calc = findKeyMatches(tokenPart, Object.keys(row.calculations || {}));
    const dv = findKeyMatches(tokenPart, (row.dataValues || []).map((d) => String(d?.mName || '')).filter(Boolean));
    const top = Math.max(calc[0]?.score ?? -1, dv[0]?.score ?? -1);
    if (top < 0) continue;
    globalMatches.push({
      record: row.recordLabel,
      calcKeys: calc.slice(0, 4).map((r) => r.key),
      dataValues: dv.slice(0, 4).map((r) => r.key),
      score: top,
    });
  }

  globalMatches.sort((a, b) => b.score - a.score);
  return {
    localCalc,
    localData,
    globalMatches: globalMatches.slice(0, maxRows),
  };
}

function extractAbilityDataFromRoot(raw, championName, pathName, ddSpells = []) {
  const pathIndex = new Map(Object.keys(raw || {}).map((key) => [normalizePath(key), key]));
  const rootCandidates = [`Characters/${championName}/CharacterRecords/Root`, `Characters/${pathName}/CharacterRecords/Root`];
  const rootPath = rootCandidates.map((candidate) => pathIndex.get(normalizePath(candidate))).find(Boolean) || null;
  const root = rootPath ? raw[rootPath] : null;
  const abilities = Array.isArray(root?.mAbilities) ? root.mAbilities : [];
  if (!abilities.length) return null;

  const abilityByName = new Map();
  abilities.forEach((abilityPath) => {
    const resolved = resolveRecord(raw, pathIndex, abilityPath);
    if (!resolved?.record) return;
    const thisName = normalizeSpellRecordName(resolved.record?.mScriptName || resolved.record?.mObjectPath || resolved.record?.mName);
    if (thisName) abilityByName.set(thisName, resolved);
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

    let abilityRecord = nameCandidates.map((candidate) => resolveRecord(raw, pathIndex, candidate)).find((v) => !!v?.record) || null;
    if (!abilityRecord) {
      const normalizedCandidates = nameCandidates.map((candidate) => normalizeSpellRecordName(candidate));
      abilityRecord = normalizedCandidates.map((candidate) => abilityByName.get(candidate)).find(Boolean) || null;
    }
    if (!abilityRecord) return;

    const childSpells = Array.isArray(abilityRecord.record?.mChildSpells) ? abilityRecord.record.mChildSpells : [];
    const candidatePaths = [...new Set([
      ...childSpells,
      abilityRecord.path,
      `Characters/${championName}/Spells/${spell?.id}Ability/${spell?.id}`,
      `Characters/${pathName}/Spells/${spell?.id}Ability/${spell?.id}`,
      `Characters/${championName}/Spells/${spell?.name}Ability/${spell?.name}`,
      `Characters/${pathName}/Spells/${spell?.name}Ability/${spell?.name}`,
    ].filter(Boolean))];

    const ddTokens = getTokensFromTooltip(spell?.tooltip || '');
    const candidates = candidatePaths
      .map((candidatePath) => resolveRecord(raw, pathIndex, candidatePath))
      .filter((resolved) => !!resolved?.record)
      .map(({ path: resolvedPath, record }) => extractCdragonSpell(resolvedPath, record))
      .filter(Boolean)
      .map((parsed) => ({ parsed, score: scoreSpellCandidate(parsed, ddTokens, spell?.id || '') }));

    if (!candidates.length) return;
    candidates.sort((a, b) => b.score - a.score);
    bySlot[slot] = candidates[0].parsed;
  });

  return Object.keys(bySlot).length ? bySlot : null;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) ${url}`);
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

    let cdragonRaw;
    try {
      cdragonRaw = await fetchJson(`https://raw.communitydragon.org/latest/game/data/characters/${pathName}/${pathName}.bin.json`);
    } catch (err) {
      rows.push({ champion: champName, spellSlot: '*', spellId: '*', token: '*cdragon-fetch-failed*', reason: String(err.message || err), cdragonRecord: '-', associatedCalcKeys: '-', associatedDataValues: '-', associationHints: '-' });
      continue;
    }

    const spellIndex = buildChampionSpellIndex(cdragonRaw);
    const cdragonBySlot = extractAbilityDataFromRoot(cdragonRaw, champName, pathName, champData.spells || []) || {};

    for (let i = 0; i < (champData.spells || []).length; i += 1) {
      const spell = champData.spells[i];
      const slot = SLOT_KEYS[i];
      const payload = cdragonBySlot[slot] || { dataValues: [], calculations: {}, recordLabel: '-' };
      const tokens = getTokensFromTooltip(spell.tooltip || '');

      for (const token of tokens) {
        const resolved = tokenResolvedInPayload(token, payload, spell);
        if (resolved.resolved) continue;

        const assoc = bestAssociations(token, payload, spellIndex);
        const hints = assoc.globalMatches
          .map((m) => `${m.record} => calc:[${m.calcKeys.join(', ')}] dv:[${m.dataValues.join(', ')}]`)
          .join(' || ');

        rows.push({
          champion: champName,
          spellSlot: slot.toUpperCase(),
          spellId: spell.id,
          token,
          reason: resolved.reason,
          cdragonRecord: payload.recordLabel || '-',
          associatedCalcKeys: assoc.localCalc.join(' | ') || '-',
          associatedDataValues: assoc.localData.join(' | ') || '-',
          associationHints: hints || '-',
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
    '| Champion | Slot | Spell | Token | Reason | CDragon Record | Local Calc Keys | Local DataValues | Global Association Hints |',
    '|---|---|---|---|---|---|---|---|---|',
    ...limitedRows.map((r) => `| ${r.champion} | ${r.spellSlot} | ${r.spellId} | \`${r.token}\` | ${r.reason} | \`${r.cdragonRecord || '-'}\` | ${r.associatedCalcKeys || '-'} | ${r.associatedDataValues || '-'} | ${r.associationHints || '-'} |`),
    '',
  ].join('\n');

  await writeFile(mdPath, md, 'utf8');
  console.log(`Wrote ${limitedRows.length} rows to:`);
  console.log(`- ${jsonPath}`);
  console.log(`- ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
