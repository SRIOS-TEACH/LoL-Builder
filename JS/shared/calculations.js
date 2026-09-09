/** Data-driven Community Dragon calculation interpreter, shared by items and spells.
 * A missing combat input produces a symbolic expression, never an invented zero.
 */
(function (scope) {
  const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const format = value => Number.isFinite(value) ? String(Number(value.toFixed(3))) : 'Unavailable';
  const hash = name => {
    let value = 2166136261;
    for (const char of String(name).toLowerCase()) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
    return `{${value.toString(16).padStart(8, '0')}}`;
  };
  function lookup(object, key) {
    if (!object) return undefined;
    if (Object.hasOwn(object, key)) return object[key];
    const lower = String(key).toLowerCase();
    const hashed = hash(lower);
    const match = Object.keys(object).find(k => k.toLowerCase() === lower || k.toLowerCase() === hashed || hash(k) === lower);
    return match === undefined ? undefined : object[match];
  }
  const result = (value, text = format(value), inputs = [], unsupported = []) => ({value, text, inputs, unsupported, missing: value === null});
  const unknown = (text, key = text, unsupported = false) => result(null, text, unsupported ? [] : [key], unsupported ? [key] : []);
  function combine(rows, operator, calculate) {
    const inputs = [...new Set(rows.flatMap(row => row.inputs))];
    const unsupported = [...new Set(rows.flatMap(row => row.unsupported))];
    const value = rows.every(row => row.value !== null) ? calculate(rows.map(row => row.value)) : null;
    return result(Number.isFinite(value) ? value : null, rows.map(row => `(${row.text})`).join(` ${operator} `), inputs, unsupported);
  }
  function dataValue(values, name, rank = 1, level = 1) {
    const entries = Array.isArray(values) ? Object.fromEntries(values.map(v => [v.mName ?? v.name, v])) : values || {};
    const entry = lookup(entries, name);
    if (entry === undefined) return unknown(`Data value ${name}`, `data:${name}`, true);
    let raw = typeof entry === 'object' && entry !== null ? entry.mValues ?? entry.values ?? entry.mValue ?? entry.value : entry;
    // Bin serialization omits default-valued fields. An existing typed data value
    // without a value is zero; an absent named entry remains an error.
    if(raw === undefined && ['SpellDataValue','ItemDataValue'].includes(entry?.__type))raw=0;
    if (Array.isArray(raw)) {
      const index = raw.length >= 19 ? level : raw.length === 18 ? level - 1 : raw.length >= 7 ? rank : rank - 1;
      raw = raw[Math.max(0, Math.min(raw.length - 1, index))];
    }
    const value = raw === undefined || raw === null ? null : number(raw);
    return value === null ? unknown(`Data value ${name}`, `data:${name}`, true) : result(value);
  }
  // Current payload semantics: 0 (or omitted) = total, 1 = base, 2 = bonus.
  // Verified by Sheen's base-AD formula, Cho'Gath's bonus-HP formula and Seraph's bonus-mana formula.
  const statNames = {
    0:['ap','Ability Power'], 1:['armor','Armor'], 2:['totalAd','Attack Damage'],
    4:['attackSpeed','Attack Speed'], 6:['mr','Magic Resist'], 7:['moveSpeed','Move Speed'],
    8:['critChance','Critical Strike Chance'], 9:['critDamage','Critical Strike Damage'],
    10:['cooldownReduction','Cooldown Reduction'], 11:['haste','Ability Haste'],
    12:['hp','Health'], 13:['currentHp','Current Health'], 14:['healthPercent','Health Fraction'],
    15:['missingHp','Missing Health'], 16:['missingHealthPercent','Missing Health Fraction'],
    18:['lifeSteal','Life Steal'], 19:['physicalVamp','Physical Vamp'], 20:['omniVamp','Omnivamp'],
    21:['magicPenFlat','Magic Penetration'], 29:['lethality','Lethality'],
    30:['tenacity','Tenacity'], 31:['attackRange','Attack Range'], 34:['healShieldPower','Heal and Shield Power'],
  };
  const bonusKeys = {ap:'ap',armor:'bonusArmor',totalAd:'bonusAd',mr:'bonusMr',hp:'bonusHp',mp:'bonusMp',attackSpeed:'bonusAttackSpeed'};
  function stat(part, context, resource = false) {
    const code = Number(part.mStat ?? 0), mode = Number(part.mStatFormula ?? 0);
    const [key, label] = resource ? ['mp', 'Mana'] : statNames[code] || ['', `Stat ${code}`];
    if (!key || ![0,1,2].includes(mode)) return unknown(label, `stat:${code}:${mode}`, true);
    const target = !!part['{a8cb9c14}'];
    const stats = target ? context.targetStats || {} : context.stats || {};
    const bonusKey = bonusKeys[key] || `bonus${key[0].toUpperCase()}${key.slice(1)}`;
    const total = stats[key], bonus = stats[bonusKey];
    const base = stats[`base${key[0].toUpperCase()}${key.slice(1)}`] ?? (Number.isFinite(total) && Number.isFinite(bonus) ? total-bonus : undefined);
    const value = mode === 2 ? bonus : mode === 1 ? base : total;
    const text = `${target ? 'Target ' : ''}${mode === 2 ? 'Bonus ' : mode === 1 ? 'Base ' : ''}${label}`;
    return Number.isFinite(value) ? result(value,text) : unknown(text,`${target?'target':'self'}:${key}:${mode}`);
  }
  function condition(requirement, context) {
    if (!requirement) return {value:null,text:'condition'};
    let value = null, text = 'condition';
    switch (requirement.__type) {
      case 'IsRangedCastRequirement': value = typeof context.ranged === 'boolean' ? context.ranged : null; text='ranged'; break;
      case 'HasBuffCastRequirement': {
        const count = lookup(context.buffs, requirement.mBuffName);
        value = Number.isFinite(count) ? count > 0 : null; text='buff active'; break;
      }
      case 'HasAllSubRequirementsCastRequirement': {
        const rows=(requirement.mSubRequirements || []).map(r=>condition(r,context));
        value=rows.some(r=>r.value===false)?false:rows.every(r=>r.value===true)?true:null;text=rows.map(r=>r.text).join(' and ');break;
      }
      case 'AboveHealthPercentCastRequirement': {
        const threshold=requirement.mCurrentPercentHealth ?? dataValue(context.dataValues,requirement['{137cf12a}'],context.rank,context.level).value;
        value=Number.isFinite(context.stats?.healthPercent) && threshold!==null ? context.stats.healthPercent>threshold:null;text='health above threshold';break;
      }
    }
    if(requirement.mInvertResult){if(value!==null)value=!value;text=`not (${text})`;}
    return {value,text};
  }
  function evaluate(calc, context = {}, seen = new Set()) {
    if (!calc) return unknown('Calculation unavailable','missing calculation',true);
    if (typeof calc === 'string') calc=lookup(context.calculations,calc);
    if (!calc) return unknown('Calculation reference unavailable','missing reference',true);
    if (seen.has(calc)) return unknown('Circular calculation','circular calculation',true);
    seen=new Set(seen).add(calc);
    context={rank:1,level:1,...context};
    const p = part => partValue(part,context,seen);
    let row;
    if(calc.__type==='GameCalculationModified') {
      row=evaluate(lookup(context.calculations,calc.mModifiedGameCalculation),{...context,rank:calc.mOverrideSpellLevel??context.rank},seen);
    } else if(calc.__type==='GameCalculationConditional') {
      const requirement=condition(calc.mConditionalCalculationRequirements ?? calc['{c0482365}'],context);
      const yes=()=>evaluate(lookup(context.calculations,calc.mConditionalGameCalculation),context,seen);
      const no=()=>evaluate(lookup(context.calculations,calc.mDefaultGameCalculation),context,seen);
      if(requirement.value!==null)row=requirement.value?yes():no();
      else {
        const a=yes(),b=no();
        row=result(null,`${requirement.text}: ${a.text}; otherwise: ${b.text}`,[...new Set([...a.inputs,...b.inputs,'condition'])],[...a.unsupported,...b.unsupported]);
      }
    } else if(Array.isArray(calc.mFormulaParts ?? calc.mFormula)) {
      row=combine((calc.mFormulaParts??calc.mFormula).map(p),'+',values=>values.reduce((a,b)=>a+b,0));
      if(calc.mRangedMultiplier) {
        if(context.ranged===true)row=combine([row,p(calc.mRangedMultiplier)],'×',v=>v[0]*v[1]);
        else if(context.ranged!==false)row=result(null,`${row.text} (ranged: × ${p(calc.mRangedMultiplier).text})`,[...row.inputs,'ranged'],row.unsupported);
      }
    } else return unknown('Calculation unavailable',calc.__type||'unknown calculation',true);
    for(const [field,op,fn] of [['mMultiplier','×',v=>v[0]*v[1]],['mAddend','+',v=>v[0]+v[1]],['mSubtrahend','−',v=>v[0]-v[1]],['mDivider','/',v=>v[1]===0?NaN:v[0]/v[1]]]){
      if(calc[field]!==undefined)row=combine([row,p(calc[field])],op,fn);
    }
    return {...row,displayAsPercent:!!calc.mDisplayAsPercent};
  }
  function partValue(part, context = {}, seen = new Set()) {
    if(!part)return unknown('Missing formula part','missing part',true);
    const p=sub=>partValue(sub,context,seen), dv=name=>dataValue(context.dataValues,name,context.rank??1,context.level??1);
    const type=part.__type, level=context.level??1;
    switch(type){
      case 'NumberCalculationPart': return result(number(part.mNumber??0));
      case 'NamedDataValueCalculationPart': return dv(part.mDataValue);
      case 'EffectValueCalculationPart': {
        const effect=context.effects?.[Number(part.mEffectIndex)-1];
        const values=effect?.value??effect?.values??effect;
        const value=Array.isArray(values)?number(values[context.rank??1]):typeof values==='number'?number(values):null;
        return value===null?unknown(`Effect ${part.mEffectIndex}`,`effect:${part.mEffectIndex}`,true):result(value);
      }
      case 'StatByCoefficientCalculationPart':
      case 'StatByNamedDataValueCalculationPart':
      case 'StatBySubPartCalculationPart':
      case 'AbilityResourceByCoefficientCalculationPart': {
        const coefficient=type==='StatByNamedDataValueCalculationPart'?dv(part.mDataValue):type==='StatBySubPartCalculationPart'?p(part.mSubpart):result(number(part.mCoefficient??0));
        const source=stat(part,context,type==='AbilityResourceByCoefficientCalculationPart');
        const row=combine([coefficient,source],'×',v=>v[0]*v[1]);
        if(coefficient.value!==null)row.text=`${format(coefficient.value*100)}% ${source.text}`;
        return row;
      }
      case 'SumOfSubPartsCalculationPart':return combine((part.mSubparts??part.mSubParts??[]).map(p),'+',v=>v.reduce((a,b)=>a+b,0));
      case 'ProductOfSubPartsCalculationPart':return combine([part.mPart1,part.mPart2].map(p),'×',v=>v[0]*v[1]);
      case 'ClampSubPartsCalculationPart': {
        const row=combine((part.mSubparts??[part.mSubPart]).map(p),'+',v=>v.reduce((a,b)=>a+b,0));
        const low=part.mFloor??-Infinity,high=part.mCeiling??Infinity;
        return {...row,value:row.value===null?null:Math.min(high,Math.max(low,row.value)),text:`clamp(${row.text}, ${low}, ${high})`};
      }
      case 'ByCharLevelInterpolationCalculationPart': {
        const n=part['{7fe8e3b3}']? (level-1)*(0.7025+0.0175*(level-1))/17 : (Math.min(level,18)-1)/17;
        return result((part.mStartValue??0)+((part.mEndValue??0)-(part.mStartValue??0))*n);
      }
      case 'ByCharLevelFormulaCalculationPart': {
        const values=part.values??part.mValues??[];
        return values[level]===undefined?unknown('Level value unavailable','level array',true):result(number(values[level]));
      }
      case 'ByCharLevelBreakpointsCalculationPart': {
        let value=part.mLevel1Value??0, slope=part.mInitialBonusPerLevel??0;
        const points=new Map((part.mBreakpoints??[]).map(bp=>[bp.mLevel,bp]));
        for(let n=2;n<=level;n++){
          const bp=points.get(n);
          if(bp && bp.mBonusPerLevelAtAndAfter!==undefined)slope=bp.mBonusPerLevelAtAndAfter;
          value+=slope+(bp?.mAdditionalBonusAtThisLevel??0);
        }
        return result(value);
      }
      case 'CooldownMultiplierCalculationPart': return Number.isFinite(context.stats?.haste)?result(100/(100+context.stats.haste),'Cooldown multiplier'):unknown('Cooldown multiplier','self:haste:0');
      case 'BuffCounterByCoefficientCalculationPart':
      case 'BuffCounterByNamedDataValueCalculationPart': {
        const count=lookup(context.buffs,part.mBuffName);
        const coefficient=type==='BuffCounterByNamedDataValueCalculationPart'?dv(part.mDataValue):result(number(part.mCoefficient??0));
        return combine([Number.isFinite(count)?result(count,'Stacks'):unknown('Stacks',`buff:${part.mBuffName}`),coefficient],'×',v=>v[0]*v[1]);
      }
      case 'ByItemEpicnessCountCalculationPart': {
        const count=context.itemCounts?.[part.epicness];
        return combine([Number.isFinite(count)?result(count,'Item count'):unknown('Item count',`items:${part.epicness}`),result(number(part.Coefficient??1))],'×',v=>v[0]*v[1]);
      }
      case 'PercentageOfBuffNameElapsed': {
        const elapsed=context.buffElapsed?.[part.buffName];
        return combine([Number.isFinite(elapsed)?result(elapsed,'Buff duration elapsed'):unknown('Buff duration elapsed',`elapsed:${part.buffName}`),result(number(part.Coefficient??0))],'×',v=>v[0]*v[1]);
      }
      case '{f3cbe7b2}':return evaluate(lookup(context.calculations,part.mSpellCalculationKey),context,seen);
      // These current serialized types contain named rather than literal level values.
      case '{ee18a47b}': {
        const start=dv(part['{0589a59c}']),end=dv(part['{0b65bc23}']);
        const n=(level-1)/17;
        return combine([start,end],'→',v=>v[0]+(v[1]-v[0])*n);
      }
      case '{b22609db}':return combine([dv(part['{91d404a5}']),dv(part['{b2cd0eb0}'])],'+ per level',v=>v[0]+v[1]*(level-1));
      case '{4ce08984}': {
        const start=dv(part['{91d404a5}']),slope=dv(part['{bbd778a2}']);
        const points=(part['{9823b29a}']??[]).map(bp=>({mLevel:bp.level,mAdditionalBonusAtThisLevel:dv(bp['{ae9b464d}']).value,mBonusPerLevelAtAndAfter:dv(bp['{b0d8b2ac}']).value}));
        if(start.missing||slope.missing||points.some(bp=>bp.mAdditionalBonusAtThisLevel===null||bp.mBonusPerLevelAtAndAfter===null))return unknown('Level growth values unavailable','named breakpoints',true);
        return p({__type:'ByCharLevelBreakpointsCalculationPart',mLevel1Value:start.value,mInitialBonusPerLevel:slope.value,mBreakpoints:points});
      }
      case '{9e9e2e5c}': return context.resolveExternal?.(part.SourceObject,part['{137cf12a}']) ?? unknown('Other ability value','external data',true);
      case '{2b25a73a}':return dv(part['{137cf12a}']);
      default:return unknown('Unsupported formula',type||'unknown part',true);
    }
  }
  scope.Calculations={evaluate,partValue,dataValue,stat,lookup,hash,format};
  if(typeof module!=='undefined')module.exports=scope.Calculations;
})(typeof window!=='undefined'?window:globalThis);
