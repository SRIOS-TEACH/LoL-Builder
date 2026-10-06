import ChampionSource from '../data/championSource.js';
import AttackEffects from '../shared/attackEffects.js';
import Calculations from '../shared/calculations.js';
import ChampionEffects from '../shared/championEffects.js';
import TargetDamage from '../shared/targetDamage.js';
/** Spell aliases, ranked data, localization and numeric formula/token resolution. No generated HTML. */

function create(state,data,statsEngine){
 const advancedItems=data.advancedItems || {};
 const {computeDerivedBuildStats,getComputedChampionStatsForTooltips,calculationContext}=statsEngine;
function parseByRank(valueBurn, rank) {
  if (!rank) return "-";
  if (valueBurn === undefined || valueBurn === null || valueBurn === "") return "-";
  const parts = String(valueBurn).split("/");
  return parts[Math.max(0, Math.min(parts.length - 1, rank - 1))] || parts[0] || "-";
}

function getSpellScalingSource(link, stats) {
  const map = {
    spelldamage: { value: stats.ap, label: "AP" },
    bonusattackdamage: { value: stats.bonusAd, label: "bonus AD" },
    attackdamage: { value: stats.totalAd, label: "AD" },
    armor: { value: stats.armor, label: "Armor" },
    bonusarmor: { value: stats.bonusArmor, label: "bonus Armor" },
    spellblock: { value: stats.mr, label: "MR" },
    bonusspellblock: { value: stats.bonusMr, label: "bonus MR" },
    health: { value: stats.hp, label: "HP" },
    bonushealth: { value: stats.bonusHp, label: "bonus HP" },
    mana: { value: stats.mp, label: "Mana" },
    bonusmana: { value: stats.bonusMp, label: "bonus Mana" },
  };
  return map[String(link || "").toLowerCase()] || null;
}

function getRankedValueIndex(values, rank) {
  if (!Array.isArray(values) || !values.length) return 0;
  const clampedRank = Math.max(0, Number(rank) || 0);
  // CommunityDragon spell arrays commonly have a sentinel value at index 0 and real ranks at 1..N.
  if (values.length >= 7) {
    return Math.max(0, Math.min(values.length - 1, clampedRank));
  }
  return Math.max(0, Math.min(values.length - 1, clampedRank - 1));
}

function getSpellDataValue(dataValues, tokenName, rank) {
  const value = Calculations.dataValue(dataValues, tokenName, rank, state.level);
  if (value.missing) return null;
  return { current: value.value, rankValues: [1,2,3,4,5].map(r => Calculations.dataValue(dataValues, tokenName, r, state.level).value) };
}

function getCalcStatSource(part, stats) {
  const value = Calculations.stat(part, {stats});
  return { ...value, label: value.text };
}

function isMissingGameCalculation(result) {
  if (!result || !Array.isArray(result.terms) || !result.terms.length) return true;
  return result.terms.every((term) => term?.missing === true);
}

function adaptCalculation(row) {
  return {...row, total:row.value, terms:[{text:row.text,value:row.value,missing:row.missing}]};
}

function evaluateCalculationPart(part, dataValues, rank, stats, calculationsMap = {}) {
  return Calculations.partValue(part, calculationContext(stats,dataValues,rank,calculationsMap));
}

function evaluateGameCalculation(calc, dataValues, rank, stats, calculationsMap = {}, effects = []) {
  return adaptCalculation(Calculations.evaluate(calc, calculationContext(stats,dataValues,rank,calculationsMap,effects)));
}

function canonicalizeToken(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildCanonicalTokenMap(keys = []) {
  return keys.reduce((acc, key) => {
    const canonical = canonicalizeToken(key);
    if (!canonical || acc[canonical]) return acc;
    acc[canonical] = key;
    return acc;
  }, {});
}

function buildResolvedSpellPayload(rawPayload, safeRank, stats) {
  const payload = rawPayload || null;
  const calculations = payload?.calculations || {};
  const dataValues = payload?.dataValues || [];
  const calcLookup = Object.fromEntries(Object.entries(calculations).map(([k, calc]) => {
    // The source exposes only the maximum recall tooltip calculation. Resolve
    // its multiplier against the configured target before prose and DPS use it.
    if(state.selectedChampion==='Aurora' && k.toLowerCase()==='q2damagemax'){
      const target=TargetDamage.normalize(state.target);
      const missing=target.enabled?1-target.currentHp/target.maxHp:0;
      const bonus=Calculations.dataValue(dataValues,'MissingHealthPercentMod',safeRank).value;
      calc={...calc,mMultiplier:{__type:'NumberCalculationPart',mNumber:1+(bonus??0.5)*missing}};
    }
    const evaluated = stats ? evaluateGameCalculation(calc, dataValues, safeRank, stats, calculations, payload?.effects || []) : null;
    return [String(k).toLowerCase(), evaluated];
  }));
  return {
    cdragonSpell: payload,
    calcLookup,
    calcLookupCanonicalMap: buildCanonicalTokenMap(Object.keys(calcLookup)),
    dataValueCanonicalMap: buildCanonicalTokenMap(dataValues.map((d) => String(d?.mName || d?.name || "").toLowerCase())),
  };
}

function getDeterministicTokenCandidates(token) {
  const candidates = [];
  const seen = new Set();
  const add = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  const tryTrimEdge = (value) => {
    add(value);
    const effectAmountMatch = value.match(/^effect(\d+)amount$/);
    if (effectAmountMatch) add(`e${effectAmountMatch[1]}`);
    if (value.endsWith("_tooltip")) add(value.slice(0, -8));
    if (value.endsWith("tooltip")) add(value.slice(0, -7));


  };

  tryTrimEdge(String(token || "").trim().toLowerCase());
  return candidates;
}

function resolveLegacyToken(tokenRaw, ctx) {
  const token = String(tokenRaw || "").trim().toLowerCase().replace(/\.\d+(?=\*|$)/, "");
  const denylist = new Set(["gamemodeinteger", "gamemodeinteger1", "gamemodeinteger2", "gamemodeinteger3"]);
  const multiplierMatchRegex = /^(?<left>[a-z0-9_:.]+)\*(?<mult>-?\d+(?:\.\d+)?)$/;

  const getQualifiedCtx = (spellRefRaw, localCtx) => {
    const normalizedRef = ChampionSource.normalizeSpellRecordName(spellRefRaw);
    const canonicalRef = canonicalizeToken(normalizedRef);
    if (!canonicalRef) return null;

    const aliasEntry = localCtx.allSpellPayloadByAlias?.[canonicalRef] || null;
    const payload = aliasEntry?.payload || localCtx.allSpellPayloadByRef?.[canonicalRef];
    if (!payload) return null;

    return {
      ...localCtx,
      cdragonSpell: payload.cdragonSpell,
      calcLookup: payload.calcLookup,
      calcLookupCanonicalMap: payload.calcLookupCanonicalMap,
      dataValueCanonicalMap: payload.dataValueCanonicalMap,
      qualifiedSpellAlias: aliasEntry?.metadata || null,
    };
  };

  const resolveSimple = (baseToken, localCtx = ctx) => {
    const candidates = getDeterministicTokenCandidates(baseToken);

    const resolveCalc = (lookupToken) => {
      if (denylist.has(canonicalizeToken(lookupToken))) return { kind: "empty", numeric: null };

      let calc = Calculations.lookup(localCtx.calcLookup, lookupToken);
      if (!calc) {
        const canonicalKey = localCtx.calcLookupCanonicalMap?.[canonicalizeToken(lookupToken)];
        if (canonicalKey) calc = localCtx.calcLookup[canonicalKey];
      }
      if (!calc) return null;

      if (calc.missing || calc.total === null) return {
        kind: "unavailable", text: calc.unsupported?.length ? "Value unavailable" : calc.text, diagnostics: calc.unsupported || [],
        numeric: null,
      };
      const shown = calc.displayAsPercent ? (calc.total * 100) : calc.total;
      return {
        kind: "calculation", calculation: calc, text: calc.text,
        numeric: shown,
        isPercent: calc.displayAsPercent === true,
      };
    };

    const resolveDataValue = (lookupToken) => {
      let dataValue = getSpellDataValue(localCtx.cdragonSpell?.dataValues || [], lookupToken, localCtx.safeRank);
      if (!dataValue) {
        const canonicalKey = localCtx.dataValueCanonicalMap?.[canonicalizeToken(lookupToken)];
        if (canonicalKey) dataValue = getSpellDataValue(localCtx.cdragonSpell?.dataValues || [], canonicalKey, localCtx.safeRank);
      }
      if (!dataValue) return null;
      return {
        kind: "number",
        numeric: dataValue.current,
      };
    };

    const resolveKnownToken = (lookupToken) => {
      let key = lookupToken;
      if (!Object.prototype.hasOwnProperty.call(localCtx.knownTokens, key)) {
        key = localCtx.knownTokenCanonicalMap?.[canonicalizeToken(lookupToken)] || key;
      }
      if (!Object.prototype.hasOwnProperty.call(localCtx.knownTokens, key)) return null;
      const v = localCtx.knownTokens[key];
      if (v === "" || v === "-") return { kind: "empty", numeric: null };
      const parsed = Number(v);
      return {
        kind: "known", display: v, text: String(v),
        numeric: Number.isFinite(parsed) ? parsed : null,
      };
    };

    for (const normalizedToken of candidates) {
      const calcResolved = resolveCalc(normalizedToken);
      if (calcResolved) return calcResolved;

      const dataResolved = resolveDataValue(normalizedToken);
      if (dataResolved) return dataResolved;

      const effectMatch = normalizedToken.match(/^e(\d+)$/);
      if (effectMatch) {
        const idx = Math.max(1, Number(effectMatch[1]));
        const arr = localCtx.spell.effect?.[idx] || [];
        if (!arr.length) continue;
        const rankIndex = Math.max(0, Math.min(arr.length - 1, localCtx.safeRank - 1));
        const current = Number(arr[rankIndex]) || 0;
        return {
          kind: "number",
          numeric: current,
        };
      }

      if (/^[af]\d+$/.test(normalizedToken) && localCtx.stats) {
        const v = localCtx.vars[normalizedToken];
        if (!v) continue;
        const source = getSpellScalingSource(v.link, localCtx.stats);
        if (!source) continue;
        const coeffRaw = Array.isArray(v.coeff) ? (v.coeff[getRankedValueIndex(v.coeff, localCtx.safeRank)] ?? v.coeff[0]) : v.coeff;
        const coeff = Number(coeffRaw || 0);
        const scaled = coeff * source.value;
        return {
          kind: "scaling", coefficient: coeff, statLabel: source.label, text: source.label,
          numeric: scaled,
        };
      }

      const knownResolved = resolveKnownToken(normalizedToken);
      if (knownResolved) return knownResolved;
    }

    return null;
  };

  const isNextLevel = token.endsWith("nl");
  const baseToken = isNextLevel ? token.slice(0, -2) : token;
  const nextRank = Math.min(5, ctx.safeRank + 1);
  const simpleCtx = { ...ctx, safeRank: isNextLevel ? nextRank : ctx.safeRank };

  const resolveWithMath = (candidateToken, localCtx, fallbackCtx = localCtx) => {
    const multMatch = candidateToken.match(multiplierMatchRegex);
    if (multMatch?.groups?.left && multMatch?.groups?.mult) {
      const left = resolveToken(multMatch.groups.left, localCtx, fallbackCtx);
      if (!left) return null;
      const mult = Number(multMatch.groups.mult);
      if(left.numeric===null)return {kind:"product",multiplier:mult,operand:left,numeric:null,text:mult+" × ("+(left.text || "Value unavailable")+")"};
      const value = left.numeric * mult;
      return {
        kind: "number",
        numeric: value,
      };
    }

    return resolveSimple(candidateToken, localCtx);
  };

  const resolveToken = (candidateToken, localCtx, fallbackCtx = localCtx) => {
    const qualifiedTokenMatch = candidateToken.match(/^spell\.([^:]+):(.+)$/);
    if (qualifiedTokenMatch) {
      const qualifiedCtx = getQualifiedCtx(qualifiedTokenMatch[1], localCtx);
      const qualifiedBaseToken = String(qualifiedTokenMatch[2] || "").trim().toLowerCase();
      if (qualifiedCtx && qualifiedBaseToken) {
        const qualifiedResolved = resolveWithMath(qualifiedBaseToken, qualifiedCtx, fallbackCtx);
        if (qualifiedResolved) return qualifiedResolved;

        const fallbackResolved = resolveWithMath(qualifiedBaseToken, fallbackCtx, fallbackCtx);
        if (fallbackResolved) return fallbackResolved;
      }
      return null;
    }

    return resolveWithMath(candidateToken, localCtx, fallbackCtx);
  };

  if ((/^f\d+$/.test(baseToken)||['bonusarmor','bonusmr','resistsfortooltip','bonusattackrange'].includes(baseToken)) && ctx.stats) {
    const value=ChampionEffects.model(state).token(ctx.spell.id,baseToken,ctx.stats,computeDerivedBuildStats());
    if(Number.isFinite(value))return {kind:"number",numeric:value};
  }
  const direct = resolveToken(baseToken, simpleCtx, simpleCtx);
  if (direct) return direct;

  return null;
}

function getSpellRankValueAt(spell, rawValue, safeRank) {
  if (rawValue === null || rawValue === undefined) return "-";
  if (typeof rawValue === "string") {
    if (rawValue.includes("/")) return parseByRank(rawValue, safeRank);
    return rawValue || "-";
  }
  if (Array.isArray(rawValue)) {
    if (!rawValue.length) return "-";
    const idx = Math.max(0, Math.min(rawValue.length - 1, safeRank - 1));
    const picked = rawValue[idx] ?? rawValue[0];
    return picked === null || picked === undefined || picked === "" ? "-" : String(picked);
  }
  const numeric = Number(rawValue);
  if (Number.isFinite(numeric)) return String(rawValue);
  return String(rawValue || "-");
}

function getSpellTokenValueAtRank(spell, baseToken, safeRank) {
  const token = String(baseToken || "").toLowerCase();
  const toCamelCase = (value) => String(value || "").replace(/[_-]+([a-z0-9])/gi, (_, chr) => chr.toUpperCase());
  const camel = toCamelCase(token);
  const candidateKeys = [token, `${token}burn`, camel, `${camel}Burn`];
  for (const key of candidateKeys) {
    if (!Object.prototype.hasOwnProperty.call(spell, key)) continue;
    const resolved = getSpellRankValueAt(spell, spell[key], safeRank);
    if (resolved !== "-") return resolved;
  }
  return "-";
}

function expandAbilityLocalization(text) {
  // This Builder selects Summoner's Rift items; game-mode variant 1 is the standard ruleset.
  let result=String(text).replace(/\{\{\s*(Spell_\w+_Tooltip_)\{\{\s*gamemodeinteger\s*\}\}\s*\}\}/gi,(_,prefix)=>`{{ ${prefix}1 }}`);
  // Show every weapon outcome rather than silently assume Aphelios's main hand.
  result=result.replace(/\{\{\s*Spell_ApheliosR_WeaponMod_\{\{\s*f1\s*\}\}\s*\}\}/gi,
    ()=>[1,2,3,4,5].map(i=>`{{ Spell_ApheliosR_WeaponMod_${i} }}`).join(''));
  for(let depth=0;depth<8;depth++){
    const expanded=result.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(full,key)=>state.strings?.[key.trim().toLowerCase()]??full);
    if(expanded===result)break;result=expanded;
  }
  return result.replace(/@([^@]+)@/g,(_,key)=>`{{ ${key} }}`);
}

function buildAbilityContext(spell, rank, spellKey) {
  const safeRank = Math.max(1, Number(rank) || 1);
  const stats = getComputedChampionStatsForTooltips();
  if (stats) stats.abilityDamageMultiplier = AttackEffects.model(state, advancedItems).abilityModifiers(stats).abilityDamageMultiplier;
  if (stats && spellKey !== 'p') {
    stats.haste += spellKey === 'r' ? stats.ultimateHaste : stats.basicHaste;
    stats.cooldownReduction = stats.haste / (100 + stats.haste);
  }
  const vars = Object.fromEntries((spell.vars || []).map((v) => [String(v.key || "").toLowerCase(), v]));

  const cdragonSpell = state.cdragonAbilityData?.[spellKey] || null;
  const resolvedSpellPayload = buildResolvedSpellPayload(cdragonSpell, safeRank, stats);
  const calcLookup = resolvedSpellPayload.calcLookup;

  const getSpellTokenValue = (baseToken) => getSpellTokenValueAtRank(spell, baseToken, safeRank);
  const nearbyAmmoTokens = Object.fromEntries(
    Object.keys(spell || {})
      .filter((tokenKey) => /(ammo|recharge|stock)/i.test(String(tokenKey || "")))
      .map((tokenKey) => [String(tokenKey || "").toLowerCase(), getSpellRankValueAt(spell, spell[tokenKey], safeRank)])
      .filter(([, tokenValue]) => tokenValue !== "-")
  );

  const knownTokens = {
    cost: parseByRank(spell.costBurn, safeRank),
    cooldown: parseByRank(spell.cooldownBurn, safeRank),
    range: parseByRank(spell.rangeBurn, safeRank),
    maxammo: getSpellTokenValue("maxammo"),
    ammorechargetime: getSpellTokenValue("ammorechargetime"),
    abilityresourcename: (spell.costType || "").replace(/<[^>]+>/g, "").replace(/[{}`]/g, "").trim() || "Mana",
    spellmodifierdescriptionappend: "",
    ...nearbyAmmoTokens,
  };

  const calcLookupCanonicalMap = resolvedSpellPayload.calcLookupCanonicalMap;
  const dataValueCanonicalMap = resolvedSpellPayload.dataValueCanonicalMap;
  const knownTokenCanonicalMap = buildCanonicalTokenMap(Object.keys(knownTokens));

  const allSpellPayloadByRef = Object.entries(state.cdragonAbilityData?.byRef || {}).reduce((acc, [refKey, payload]) => {
    acc[refKey] = buildResolvedSpellPayload(payload, safeRank, stats);
    return acc;
  }, {});
  const allSpellPayloadByAlias = Object.entries(state.cdragonAbilityData?.byAlias || {}).reduce((acc, [aliasKey, entry]) => {
    if (!entry?.payload) return acc;
    acc[aliasKey] = {
      ...entry,
      payload: buildResolvedSpellPayload(entry.payload, safeRank, stats),
    };
    return acc;
  }, {});

  return {
    spell,
    safeRank,
    stats,
    vars,
    cdragonSpell: resolvedSpellPayload.cdragonSpell,
    calcLookup,
    knownTokens,
    calcLookupCanonicalMap,
    dataValueCanonicalMap,
    knownTokenCanonicalMap,
    allSpellPayloadByRef,
    allSpellPayloadByAlias,
  };
}

function gameTooltip(payload,fallback='') {
  const loc=payload?.spellData?.mClientData?.mTooltipData?.mLocKeys;
  return state.strings?.[loc?.keyTooltip?.toLowerCase()] || state.strings?.[loc?.keyTooltipExtended?.toLowerCase()] || fallback;
}
function resolveAbilityToken(token,context){
 const row=resolveLegacyToken(token,context);
 if(!row)return {kind:"missing",status:"unsupported",numeric:null,text:"Value unavailable",token,diagnostics:["No matching live value or formula"]};
 return {...row,status:row.kind==="empty"?"omitted":Number.isFinite(row.numeric)?"ready":row.kind==="known"?"text":"unsupported",token};
}

function effectValues(payload,rank){
 if(!payload || !rank)return [];
 const context=calculationContext(getComputedChampionStatsForTooltips(),payload.dataValues,rank,payload.calculations,payload.effects);
  return Object.entries(payload.calculations||{}).filter(([name,calc])=>!name.startsWith('{')&&!calc.tooltipOnly&&!/^tooltiponly_/i.test(name)).map(([name,calc])=>{
    const row=Calculations.evaluate(calc,context);
    const slot=['q','w','e','r'].find(slot=>state.cdragonAbilityData?.[slot]===payload);
    const id=state.championData?.spells?.[['q','w','e','r'].indexOf(slot)]?.id;
    const bindings={GarenE:{NumberOfStrikes:'f1'},BelvethE:{TotalStrikes:'f2'},SettW:{MaxDamage:'f1'},PoppyW:{BonusArmor:'bonusarmor',BonusMR:'bonusmr'},GarenW:{ResistsForTooltip:'resistsfortooltip'},Feast:{BonusAttackRange:'bonusattackrange'}};
    const key=bindings[id]?.[name];
    const corrected=key?ChampionEffects.model(state).token(id,key,context.stats,computeDerivedBuildStats()):null;
    return {name,row,value:Number.isFinite(corrected)?corrected:row.value,
     displayAsPercent:Number.isFinite(corrected)?false:row.displayAsPercent};
  });
}
return {effectValues,parseByRank,getSpellScalingSource,getRankedValueIndex,getSpellDataValue,getCalcStatSource,isMissingGameCalculation,adaptCalculation,evaluateCalculationPart,evaluateGameCalculation,canonicalizeToken,buildCanonicalTokenMap,buildResolvedSpellPayload,getDeterministicTokenCandidates,resolveAbilityToken,getSpellRankValueAt,getSpellTokenValueAtRank,expandAbilityLocalization,buildAbilityContext,gameTooltip,resolveLegacyToken};
}
const AbilityResolution={create};
 const exportedApi = AbilityResolution;

export default exportedApi;
