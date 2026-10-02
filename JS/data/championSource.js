/** Reusable capability; no page initialization or DOM dependency. */
(function(scope){
const CDRAGON_STAT_HASH_TO_NAME = {
  "{18956a21}": "armorPerLevel",
  "{4af40dc3}": "baseDamage",
  "{4d37af28}": "hpPerLevel",
  "{836cc82a}": "attackSpeed",
  "{7bd4b298}": "attackRange",
  "{4f89c991}": "attackSpeedRatio",
  "{8662cf12}": "baseHP",
  "{913157bb}": "hpRegenPerLevel",
  "{9eedebad}": "baseStaticHPRegen",
  "{b9f2b365}": "attackSpeedPerLevel",
  "{e2b5d80d}": "damagePerLevel",
  "{e62d9d92}": "baseMoveSpeed",
  "{ea6100d5}": "baseArmor",
};

const CDRAGON_TO_DDRAGON_STAT_KEY = {
  baseDamage: "attackdamage",
  damagePerLevel: "attackdamageperlevel",
  baseHP: "hp",
  hpPerLevel: "hpperlevel",
  baseArmor: "armor",
  armorPerLevel: "armorperlevel",
  attackRange: "attackrange",
  attackSpeed: "attackspeed",
  attackSpeedPerLevel: "attackspeedperlevel",
  baseMoveSpeed: "movespeed",
  baseStaticHPRegen: "hpregen",
  hpRegenPerLevel: "hpregenperlevel",
  baseMP: "mp",
  mpPerLevel: "mpperlevel",
  baseStaticMPRegen: "mpregen",
  mpRegenPerLevel: "mpregenperlevel",
  baseSpellBlock: "spellblock",
  spellBlockPerLevel: "spellblockperlevel",
  baseCrit: "crit",
  critPerLevel: "critperlevel",
  baseCritDamage: "critdamage",
};

const DEFAULT_CHAMPION_BASE_STATS = {
  hp: 0,
  hpperlevel: 0,
  mp: 0,
  mpperlevel: 0,
  hpregen: 0,
  hpregenperlevel: 0,
  mpregen: 0,
  mpregenperlevel: 0,
  attackdamage: 0,
  attackdamageperlevel: 0,
  attackspeed: 0,
  attackspeedperlevel: 0,
  armor: 0,
  armorperlevel: 0,
  spellblock: 0,
  spellblockperlevel: 0,
  movespeed: 0,
  attackrange: 0,
  crit: 0,
  critperlevel: 0,
  critdamage: 0,
};

function normalizeCdragonChampionPath(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCdragonRecordPath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function resolveCdragonRecord(raw, index, path) {
  if (!path) return null;
  const key = index.get(normalizeCdragonRecordPath(path));
  return key ? raw[key] : null;
}

function extractCdragonSpell(spellRecord) {
  const spellCandidates = [
    spellRecord?.mSpell,
    spellRecord?.mClientData?.mSpell,
    spellRecord?.mSpellData,
    spellRecord,
  ].filter(Boolean);
  if (!spellCandidates.length) return null;

  const normalizeDataValues = (rawDataValues) => {
    if (Array.isArray(rawDataValues)) return rawDataValues;
    if (!rawDataValues || typeof rawDataValues !== "object") return [];
    return Object.entries(rawDataValues).map(([name, entry]) => {
      if (entry && typeof entry === "object") {
        return {
          mName: entry.mName || entry.name || entry.mDataValue || name,
          mValues: entry.mValues || entry.values || entry.mValue || entry.value || [],
        };
      }
      return { mName: name, mValues: [entry] };
    });
  };

  const normalizeCalculations = (rawCalculations) => {
    if (!rawCalculations || typeof rawCalculations !== "object") return {};
    return rawCalculations;
  };

  const parsedCandidate = spellCandidates
    .map((candidate) => ({
      spellData: candidate,
      effects: candidate?.mEffectAmount || [],
      dataValues: normalizeDataValues(
        candidate?.mDataValues
        || candidate?.DataValues
        || candidate?.dataValues
        || candidate?.mDataValuesMap
        || {},
      ),
      calculations: normalizeCalculations(
        candidate?.mSpellCalculations
        || candidate?.SpellCalculations
        || candidate?.spellCalculations
        || candidate?.mCalculations
        || {},
      ),
    }))
    .sort((a, b) => ((Object.keys(b.calculations || {}).length * 4) + (b.dataValues?.length || 0))
      - ((Object.keys(a.calculations || {}).length * 4) + (a.dataValues?.length || 0)))[0];

  if (!parsedCandidate) return null;
  return {
    spellData: parsedCandidate.spellData,
    effects: parsedCandidate.effects || [],
    dataValues: parsedCandidate.dataValues || [],
    calculations: parsedCandidate.calculations || {},
  };
}

function normalizeSpellRecordName(name) {
  return String(name || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

const DEBUG_CDRAGON_CHILD_SELECTION = false;

function extractTooltipTokens(tooltip) {
  const tokens = new Set();
  const rawTooltip = String(tooltip || "");
  const re = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
  let match = re.exec(rawTooltip);
  while (match) {
    const token = normalizeSpellRecordName(match[1]);
    if (token) tokens.add(token);
    match = re.exec(rawTooltip);
  }
  return tokens;
}

function spellDataValueName(entry) {
  return entry?.mName || entry?.mId || entry?.mDataValue || entry?.name || entry?.mKey || entry?.key || "";
}

function scoreSpellChildCandidate(parsed, tooltipTokens) {
  if (!parsed) return null;

  const calcKeys = Object.keys(parsed.calculations || {});
  const calcKeySet = new Set(calcKeys.map((key) => normalizeSpellRecordName(key)).filter(Boolean));
  const dataValues = Array.isArray(parsed.dataValues) ? parsed.dataValues : [];
  const dataValueNames = dataValues
    .map((entry) => normalizeSpellRecordName(spellDataValueName(entry)))
    .filter(Boolean);
  const dataValueSet = new Set(dataValueNames);

  let overlapCount = 0;
  (tooltipTokens || new Set()).forEach((token) => {
    if (calcKeySet.has(token) || dataValueSet.has(token)) overlapCount += 1;
  });

  const calculationCount = calcKeys.length;
  const dataValueCount = dataValues.length;
  const score = (calculationCount * 4) + (dataValueCount * 2) + (overlapCount * 6);

  return {
    score,
    overlapCount,
    calculationCount,
    dataValueCount,
  };
}

function chooseBestSpellChild(raw, pathIndex, childSpellPaths, ddSpell, slot = "") {
  const tooltipTokens = extractTooltipTokens(ddSpell?.tooltip);

  const candidates = childSpellPaths
    .map((path, index) => {
      const record = resolveCdragonRecord(raw, pathIndex, path);
      const parsed = extractCdragonSpell(record);
      if (!parsed) return null;
      const scoreMeta = scoreSpellChildCandidate(parsed, tooltipTokens);
      return {
        path,
        index,
        record: resolveCdragonRecord(raw, pathIndex, path),
        parsed,
        score: scoreMeta?.score || 0,
        overlapCount: scoreMeta?.overlapCount || 0,
        calculationCount: scoreMeta?.calculationCount || 0,
        dataValueCount: scoreMeta?.dataValueCount || 0,
      };
    })
    .filter(Boolean);

  if (!candidates.length) return null;

  const best = candidates
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount;
      if (b.calculationCount !== a.calculationCount) return b.calculationCount - a.calculationCount;
      if (b.dataValueCount !== a.dataValueCount) return b.dataValueCount - a.dataValueCount;
      return a.index - b.index;
    })[0];

  if (DEBUG_CDRAGON_CHILD_SELECTION) {
    console.debug("[CDragon child selection]", {
      slot,
      ddSpell: ddSpell?.id || ddSpell?.name || "",
      tooltipTokens: Array.from(tooltipTokens),
      selected: { path: best.path, score: best.score, overlapCount: best.overlapCount, calculationCount: best.calculationCount, dataValueCount: best.dataValueCount },
      candidates: candidates.map((candidate) => ({
        path: candidate.path,
        score: candidate.score,
        overlapCount: candidate.overlapCount,
        calculationCount: candidate.calculationCount,
        dataValueCount: candidate.dataValueCount,
      })),
    });
  }

  return {
    parsed: best.parsed,
    path: best.path,
    record: best.record,
  };
}

function addSpellPayloadAlias(lookup, payload, aliasRaw) {
  const normalized = normalizeSpellRecordName(aliasRaw);
  const canonical = canonicalizeToken(normalized);
  if (!canonical || lookup[canonical]) return;
  lookup[canonical] = payload;
}

function buildSpellPayloadLookupEntry(lookup, payload, aliases = []) {
  aliases.forEach((alias) => addSpellPayloadAlias(lookup, payload, alias));
}

function getObjectPathTail(value) {
  const path = String(value || "").trim();
  if (!path) return "";
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

function buildSpellAliasMetadata({ slot, spell = null, selectedChild = null, abilityRecord = null, nameCandidates = [] }) {
  return {
    slot,
    scriptName: selectedChild?.record?.mScriptName || abilityRecord?.mScriptName || "",
    objectPathTail: getObjectPathTail(
      selectedChild?.record?.mObjectPath
      || selectedChild?.path
      || abilityRecord?.mObjectPath
      || "",
    ),
    spellIdCandidate: String(spell?.id || ""),
    spellNameCandidate: String(spell?.name || ""),
    matchCandidates: nameCandidates.map((candidate) => String(candidate || "")).filter(Boolean),
  };
}

function registerSpellPayloadAliases(byAlias, payload, metadata, aliases = []) {
  aliases.forEach((aliasRaw) => {
    const normalized = normalizeSpellRecordName(aliasRaw);
    const canonical = canonicalizeToken(normalized);
    if (!canonical || byAlias[canonical]) return;
    byAlias[canonical] = {
      payload,
      metadata,
      alias: normalized,
      canonicalAlias: canonical,
    };
  });
}

function extractAbilityDataFromRoot(raw, championName, pathName, ddSpells = []) {
  const pathIndex = new Map(Object.keys(raw || {}).map((key) => [normalizeCdragonRecordPath(key), key]));
  const rootCandidates = [
    `Characters/${championName}/CharacterRecords/Root`,
    `Characters/${pathName}/CharacterRecords/Root`,
  ];
  const rootPath = rootCandidates
    .map((candidate) => pathIndex.get(normalizeCdragonRecordPath(candidate)))
    .find(Boolean)
    || null;

  const root = rootPath ? raw[rootPath] : null;
  const abilities = Array.isArray(root?.mAbilities) ? root.mAbilities : [];
  if (!abilities.length) return null;

  const abilityByName = new Map();

  abilities.forEach((abilityPath) => {
    const abilityRecord = resolveCdragonRecord(raw, pathIndex, abilityPath);
    if (!abilityRecord) return;
    const thisName = normalizeSpellRecordName(abilityRecord?.mScriptName || abilityRecord?.mObjectPath || abilityRecord?.mName);
    if (thisName) abilityByName.set(thisName, abilityRecord);
  });

  const bySlot = {};
  const byRef = {};
  const byAlias = {};

  ddSpells.forEach((spell, idx) => {
    const slot = ["q", "w", "e", "r"][idx];
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
      .map((candidate) => resolveCdragonRecord(raw, pathIndex, candidate))
      .find(Boolean)
      || null;

    if (!abilityRecord) {
      const normalizedCandidates = nameCandidates.map((candidate) => normalizeSpellRecordName(candidate));
      abilityRecord = normalizedCandidates
        .map((candidate) => abilityByName.get(candidate))
        .find(Boolean)
        || null;
    }

    const childSpells = [...new Set([abilityRecord?.mRootSpell,...(abilityRecord?.mChildSpells||[])].filter(Boolean))];
    if (!childSpells.length) return;
    const rootRecord=resolveCdragonRecord(raw,pathIndex,abilityRecord?.mRootSpell);
    const rootParsed=extractCdragonSpell(rootRecord);
    let selectedChild = rootParsed ? {path:abilityRecord.mRootSpell,record:rootRecord,parsed:rootParsed} : chooseBestSpellChild(raw, pathIndex, childSpells, spell, slot);
    if (!selectedChild?.parsed) {
      const fallbackChild = childSpells
        .map((path) => ({ path, record: resolveCdragonRecord(raw, pathIndex, path) }))
        .map((entry) => ({ ...entry, parsed: extractCdragonSpell(entry.record) }))
        .find((entry) => entry.parsed);
      selectedChild = fallbackChild || null;
    }

    const parsed = selectedChild?.parsed || null;
    if (!parsed) return;
    bySlot[slot] = parsed;

    const metadata = buildSpellAliasMetadata({
      slot,
      spell,
      selectedChild,
      abilityRecord,
      nameCandidates,
    });

    const aliases = [
      slot,
      spell?.name,
      spell?.id,
      ...nameCandidates,
      abilityRecord?.mScriptName,
      abilityRecord?.mObjectPath,
      getObjectPathTail(abilityRecord?.mObjectPath),
      abilityRecord?.mName,
      selectedChild?.record?.mScriptName,
      selectedChild?.record?.mObjectPath,
      getObjectPathTail(selectedChild?.record?.mObjectPath),
      selectedChild?.record?.mName,
      selectedChild?.path,
      getObjectPathTail(selectedChild?.path),
    ];
    buildSpellPayloadLookupEntry(byRef, parsed, aliases);
    registerSpellPayloadAliases(byAlias, parsed, metadata, aliases);
  });

  const passivePathCandidates = [
    root?.mCharacterPassiveSpell,
    `Characters/${championName}/Spells/${championName}PassiveAbility`,
    `Characters/${pathName}/Spells/${pathName}PassiveAbility`,
  ];
  const passiveRecord = passivePathCandidates
    .map((candidate) => resolveCdragonRecord(raw, pathIndex, candidate))
    .find(Boolean)
    || null;
  if (passiveRecord) {
    const childSpells = Array.isArray(passiveRecord?.mChildSpells) ? passiveRecord.mChildSpells : [];
    const directRecord=passiveRecord.mSpell?passiveRecord:resolveCdragonRecord(raw,pathIndex,passiveRecord.mRootSpell);
    const directParsed=extractCdragonSpell(directRecord);
    let selectedChild = directParsed?{record:directRecord,parsed:directParsed,path:root?.mCharacterPassiveSpell||passiveRecord.mRootSpell}:chooseBestSpellChild(raw, pathIndex, childSpells, null, "p");
    if (!selectedChild?.parsed) {
      const primaryChild = resolveCdragonRecord(raw, pathIndex, childSpells[0]);
      selectedChild = { parsed: extractCdragonSpell(primaryChild), path: childSpells[0], record: primaryChild };
    }
    const parsed = selectedChild?.parsed || null;
    if (parsed) bySlot.p = parsed;

    if (parsed) {
      const metadata = buildSpellAliasMetadata({
        slot: "p",
        spell: { id: `${championName}Passive`, name: "Passive" },
        selectedChild,
        abilityRecord: passiveRecord,
        nameCandidates: passivePathCandidates,
      });
      const aliases = [
        "p",
        "passive",
        `${championName}passive`,
        `${pathName}passive`,
        ...passivePathCandidates,
        passiveRecord?.mScriptName,
        passiveRecord?.mObjectPath,
        getObjectPathTail(passiveRecord?.mObjectPath),
        passiveRecord?.mName,
        selectedChild?.record?.mScriptName,
        selectedChild?.record?.mObjectPath,
        getObjectPathTail(selectedChild?.record?.mObjectPath),
        selectedChild?.record?.mName,
        selectedChild?.path,
        getObjectPathTail(selectedChild?.path),
      ];
      buildSpellPayloadLookupEntry(byRef, parsed, aliases);
      registerSpellPayloadAliases(byAlias, parsed, metadata, aliases);
    }
  }

  // Qualified tooltip references can point to auxiliary or hashed passive records.
  // Register exact source names; do not choose a similarly named damage formula.
  for(const [path,record] of Object.entries(raw||{})){
    if(!record?.mSpell)continue;
    const payload=extractCdragonSpell(record);
    const aliases=[record.ObjectName,record.mScriptName,record.objectPath,path,getObjectPathTail(path)].filter(Boolean);
    buildSpellPayloadLookupEntry(byRef,payload,aliases);
    registerSpellPayloadAliases(byAlias,payload,{slot:null},aliases);
  }
  if (!Object.keys(bySlot).length) return null;
  bySlot.byRef = byRef;
  bySlot.byAlias = byAlias;
  return bySlot;
}

// Read only present, finite values. Missing fields are not zero-valued stats.
function extractChampionStatsFromBinRoot(raw, championName, pathName) {
  const rootPath = `characters/${championName || pathName}/characterrecords/root`.toLowerCase();
  const root = Object.entries(raw || {}).find(([key]) => key.toLowerCase() === rootPath)?.[1];
  if (!root) return {};
  const stats = {};
  const mapping = { ...CDRAGON_TO_DDRAGON_STAT_KEY, attackSpeedRatio: 'attackspeedratio' };
  for (const [source, target] of Object.entries(mapping)) {
    const hash = Object.keys(CDRAGON_STAT_HASH_TO_NAME).find(key => CDRAGON_STAT_HASH_TO_NAME[key] === source);
    const rawValue = root[source + 'Modifiable'] ?? root[source] ?? root[hash];
    const value = typeof rawValue === 'object' && rawValue !== null ? rawValue.baseValue : rawValue;
    if (typeof value === 'number' && Number.isFinite(value)) stats[target] = value;
  }
  return stats;
}



function canonicalizeToken(name) { return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function prepareChampion(champion, raw, id, statsAdapter) {
  if (!champion?.stats || !champion.spells) throw new Error('Champion data is incomplete');
  const extra = extractChampionStatsFromBinRoot(raw, id, id.toLowerCase());
  const stats = statsAdapter.mergeChampionStats({...DEFAULT_CHAMPION_BASE_STATS, ...champion.stats}, extra);
  const characterRoot = raw?.['Characters/'+id+'/CharacterRecords/Root'];
  if (Number.isFinite(characterRoot?.critDamageMultiplier)) stats.critdamage = characterRoot.critDamageMultiplier;
  return {champion:{...champion,stats}, raw, abilities:raw ? extractAbilityDataFromRoot(raw,id,normalizeCdragonChampionPath(id),champion.spells) : null};
}

const api = {normalizeCdragonChampionPath, normalizeCdragonRecordPath, resolveCdragonRecord, extractCdragonSpell, normalizeSpellRecordName, extractTooltipTokens, spellDataValueName, scoreSpellChildCandidate, chooseBestSpellChild, addSpellPayloadAlias, buildSpellPayloadLookupEntry, getObjectPathTail, buildSpellAliasMetadata, registerSpellPayloadAliases, extractAbilityDataFromRoot, extractChampionStatsFromBinRoot, prepareChampion};
scope.ChampionSource = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
