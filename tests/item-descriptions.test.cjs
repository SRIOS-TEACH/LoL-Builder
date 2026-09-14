const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('../JS/shared/calculations.js');
const ItemDescriptions=require('../JS/shared/itemDescriptions.js');
const ItemPolicy=require('../JS/shared/itemPolicy.js');
const excerpts=require('./attack-excerpts.json');
const plain=html=>html.replace(/<[^>]*>/g,'');
const context=(ranged=true)=>({level:18,ranged,targetFormulaOnly:true,automaticSelfStats:true,
  stats:{ap:100,baseAd:100,totalAd:175,bonusAd:75,hp:3000,baseHp:2000,bonusHp:1000,itemHp:800,mp:2290,baseMp:1000,bonusMp:1290,armor:150,baseArmor:100,bonusArmor:50,mr:100,baseMr:50,bonusMr:50,critChance:.25,critDamage:2.3,attackSpeed:1.5,bonusAttackSpeed:.5,moveSpeed:400,baseMoveSpeed:335,haste:20,healShieldPower:0,lethality:20},
  targetStats:{hp:2500,currentHp:1500,bonusHp:1000,armor:100,mr:100},buffs:{},conditions:{},itemCounts:{}});
// Exact localization snippets from the captured 16.18 game string table.
const lichText='<passive>Spellblade</passive> {{ Item_Cooldown}}<br>After using an Ability, your next Attack within @SpellBladeDuration@ seconds gains <attackSpeed>@SheenASBuff*100@% Attack Speed</attackSpeed> and deals <magicDamage>@SpellbladeDamage@ bonus magic damage</magicDamage> {{ Item_Keyword_OnHit }}.';
const strings={item_3100_tooltip:lichText,item_cooldown:'%i:cooldown% (@Cooldown@s)',item_keyword_onhit:'%i:OnHit% <OnHit>On-Hit</OnHit>'};

test('Muramana prose combines coefficients and values for separate Awe, attack and ability effects',()=>{
  const describe=ranged=>ItemDescriptions.describe({id:'3042',item:{name:'Muramana'},source:excerpts.items['3042'],context:context(ranged)});
  const ranged=describe(true),text=plain(ranged.html);
  assert.deepEqual(ranged.sections.map(s=>s.label),['Awe','Shock (On-Hit)','Shock']);
  assert.match(text,/2% max Mana.*\+45\.8 AD/);
  assert.match(text,/1\.2% \(27\.48\) max Mana/);
  assert.match(text,/3% \(68\.7\) max Mana/);
  assert.match(text,/Ranged champion scaling/);
  const melee=plain(describe(false).html);
  assert.match(melee,/4% \(91\.6\) max Mana/);
  assert.match(melee,/1\.2% \(27\.48\) max Mana/);
  assert.match(melee,/Melee champion scaling/);
  assert.doesNotMatch(text,/unavailable|@|\{\{/);
});

test('Lich Bane expands inherited cooldown and On-Hit prose with base-AD and AP calculations',()=>{
  const source={...excerpts.items['3100'],mItemDataClient:{mTooltipData:{mLocKeys:{keyTooltip:'Item_3100_Tooltip'}}}};
  const result=ItemDescriptions.describe({id:'3100',item:{name:'Lich Bane'},source,strings,context:context()});
  const text=plain(result.html);
  assert.equal(result.localized,true);
  assert.match(text,/Spellblade \s*\(1\.5s\)/);
  assert.match(text,/within 10 seconds/);
  assert.match(text,/50% Attack Speed/);
  // 75% of 100 base AD + 45% of 100 AP = 120, independent of the 75 bonus AD.
  assert.match(text,/120 bonus magic damage/);
  assert.match(text,/On-Hit/);
  assert.doesNotMatch(text,/unavailable|@|\{\{|%i:/);
  assert.deepEqual(result.sections.map(s=>s.label),['Spellblade']);
});

test('Repeated passive labels merge their prose while inline On-Hit stays inside its effect',()=>{
  const item={description:'<stats>50 Attack Damage</stats><passive>Shock</passive><br>First effect <OnHit>On-Hit</OnHit>.<br><passive>Shock</passive><br>Second effect.'};
  const result=ItemDescriptions.describe({id:'test',item,context:context()});
  assert.equal(result.sections.length,1);assert.equal(result.sections[0].label,'Shock');
  assert.match(result.sections[0].html,/First effect/);assert.match(result.sections[0].html,/Second effect/);
  assert.doesNotMatch(result.html,/<stats>/);assert.equal(result.localized,false);
});

test('Missing game values remain explicit instead of becoming zero damage',()=>{
  const result=ItemDescriptions.describe({id:'test',item:{description:'<passive>Unknown</passive>Deal @MissingDamage@ damage.'},context:context()});
  assert.match(plain(result.html),/value unavailable/);assert.doesNotMatch(plain(result.html),/Deal 0 damage/);
});

test('Frozen Heart negative multipliers display a positive attack-speed reduction',()=>{
  const source={mDataValues:[{mName:'ASPDSlow',mValue:-.2,__type:'ItemDataValue'}]};
  const result=ItemDescriptions.describe({id:'3110',item:{description:'<passive>Winter\'s Caress</passive><br>Reduce the <attackSpeed>Attack Speed</attackSpeed> of nearby champions by <attackSpeed>@ASPDSlow*-100@%</attackSpeed>.'},source,context:context()});
  assert.match(plain(result.html),/by 20%/);assert.doesNotMatch(result.html,/unavailable/);
});

test('Active-only game descriptions use their localized values and cooldown',()=>{
  const source={mDataValues:[{mName:'Cooldown',mValue:120,__type:'ItemDataValue'},{mName:'Duration',mValue:2.5,__type:'ItemDataValue'}],mItemDataClient:{mTooltipData:{mLocKeys:{keyActive:'Item_3157_Active'}}}};
  const result=ItemDescriptions.describe({id:'3157',item:{name:'Zhonya\'s Hourglass',description:'<active>Time Stop</active>Enter Stasis temporarily.'},source,context:context(),strings:{...strings,item_3157_active:'%i:activeEffect% <active>Time Stop</active> {{ Item_Cooldown }}<br>Enter <keyword>Stasis</keyword> for @Duration@ seconds.'}});
  const text=plain(result.html);
  assert.match(text,/120s/);assert.match(text,/2\.5 seconds/);assert.equal(result.sections[0].active,true);
});

test('Dynamic melee/ranged item macros preserve percentage display for Blade of the Ruined King',()=>{
  const source=excerpts.items['3153'];
  const item={description:'<passive>Mist\'s Edge</passive><br>Attacks deal <physicalDamage>{{ Item_Melee_Ranged_Split_Dynamic }}</physicalDamage> of enemy\'s current Health as bonus physical damage.'};
  const ranged=ItemDescriptions.describe({id:'3153',item,source,strings:{item_melee_ranged_split_dynamic:'{{ Item_Range_Mod_@ChampRange@_Dynamic }}'},context:context(true)});
  const melee=ItemDescriptions.describe({id:'3153',item,source,strings:{item_melee_ranged_split_dynamic:'{{ Item_Range_Mod_@ChampRange@_Dynamic }}'},context:context(false)});
  assert.match(plain(ranged.html),/6%/);assert.match(plain(melee.html),/9%/);
  assert.doesNotMatch(ranged.html,/unavailable/);assert.doesNotMatch(melee.html,/unavailable/);
});

test('Inline references to another passive stay inside Death\'s Dance Defy explanation',()=>{
  const item={description:'<passive>Ignore Pain</passive><br>Damage taken is dealt over time.<br><br><passive>Defy</passive><br>When a champion dies, cleanse <passive>Ignore Pain\'s</passive> remaining damage and restore Health.'};
  const result=ItemDescriptions.describe({id:'6333',item,context:context()});
  assert.deepEqual(result.sections.map(s=>s.label),['Ignore Pain','Defy']);
  assert.match(plain(result.sections[1].html),/cleanse Ignore Pain's remaining damage/);
});

test('Source-authored string calculations resolve ranged/melee aliases and hashed numeric formulas',()=>{
  const source={StringCalculations:{HasteFromAD:{MeleeResult:'@HasteFromADMelee@',RangedResult:'@HasteFromADRanged@',DefaultResult:'@HasteFromADMelee@',__type:'{4750ceb6}'}},mItemCalculations:{
    '{e4d9f16b}':{mFormulaParts:[{mNumber:5,__type:'NumberCalculationPart'},{mStat:2,mStatFormula:2,mCoefficient:.13,__type:'StatByCoefficientCalculationPart'}],__type:'GameCalculation'},
    '{87892572}':{mFormulaParts:[{mNumber:5,__type:'NumberCalculationPart'},{mStat:2,mStatFormula:2,mCoefficient:.1,__type:'StatByCoefficientCalculationPart'}],__type:'GameCalculation'}
  }};
  const item={description:'<passive>Famine</passive><br>Gain @HasteFromAD@ Ability Haste.'};
  const text=ranged=>plain(ItemDescriptions.describe({id:'2517',item,source,context:context(ranged)}).html);
  assert.match(text(true),/12\.5 Ability Haste/);assert.match(text(false),/14\.75 Ability Haste/);
});

test('Warmog vitality prose uses item health without multiplying rune or champion health',()=>{
  const source={mDataValues:[{mName:'HPAmp',mValue:.12,__type:'ItemDataValue'}]};
  const item={description:'<passive>Warmog\'s Vitality</passive><br>Gain bonus Health equal to @HPAmp*100@% of your Item Health (<healing>@f2@</healing>).'};
  const ctx=context();ctx.stats.itemHp=1000;ctx.stats.bonusHp=1500;ctx.stats.hp=3500;
  const text=plain(ItemDescriptions.describe({id:'3083',item,source,context:ctx}).html);
  assert.match(text,/12% of your Item Health \(120\)/);assert.doesNotMatch(text,/\(180\)|unavailable/);
});

// Optional full-catalog diagnostics use local fixtures; normal unit tests need no downloads.
if(process.env.AUDIT_ITEM_DESCRIPTIONS){
  const directory=path.resolve(process.env.FIXTURES_DIR||path.join(__dirname,'fixtures'));
  const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
  const catalog=read('items.json').data,raw=read('cd-items.json'),table=read('lol.stringtable.json');
  const localization=table.entries||table;
  const byId=Object.fromEntries(Object.entries(raw).map(([key,value])=>[key.match(/Items\/(\d+)$/)?.[1]||String(value.itemID||value.id||''),value]));
  const items=ItemPolicy.dedupeByNameWithMapPriority(Object.entries(catalog).filter(([id,item])=>ItemPolicy.isPurchasableItem(id,item)&&item.maps?.[11]));
  for(const entry of Object.entries(catalog).filter(([id])=>/^120[0-4]$/.test(id)||/^317[0-6]$/.test(id)))if(!items.some(([id])=>id===entry[0]))items.push(entry);
  const report=[],missingActives=[];let localized=0,complete=0,activeCount=0;
  const ranged=process.env.AUDIT_ITEM_DESCRIPTIONS!=='melee';
  for(const [id,item]of items){
    const source=byId[id],ctx=context(ranged);
    const result=ItemDescriptions.describe({id,item,source,strings:localization,context:ctx});
    const activeKey=source?.mItemDataClient?.mTooltipData?.mLocKeys?.keyActive;
    const activeLabel=localization[activeKey?.toLowerCase()]?.match(/<active>([^<]+)<\/active>/i)?.[1];
    if(activeLabel){activeCount++;if(!result.sections.some(section=>section.active&&section.label===activeLabel))missingActives.push({id,name:item.name,label:activeLabel});}
    if(result.localized)localized++;
    if(!/unavailable|@[^@]+@|\{\{/.test(result.html)){complete++;continue;}
    const loc=source?.mItemDataClient?.mTooltipData?.mLocKeys,key=loc?.keyTooltip;
    let rawText=[localization[key?.toLowerCase()],localization[loc?.keyActive?.toLowerCase()]].filter(Boolean).join('<br><br>')||item.description;
    rawText=rawText.replace(/\{\{\s*Item_Melee_Ranged_Split\s*\}\}/gi,ranged?'@RangedItemCalcValue@':'@MeleeItemCalcValue@');
    for(let pass=0;pass<8;pass++){
      const next=rawText.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(full,key)=>localization[key.toLowerCase().trim()]??full);
      if(next===rawText)break;rawText=next;
    }
    const missing=[];
    for(const match of rawText.matchAll(/@([^@]+)@/g)){
      const token=match[1],name=token.match(/^([^*.]+)/)?.[1],formula=Calculations.lookup(source?.mItemCalculations,name);
      const c={...ctx,dataValues:source?.mDataValues||[],calculations:source?.mItemCalculations||{},effects:source?.mEffectAmount||[]};
      const row=formula?Calculations.evaluate(formula,c):Calculations.dataValue(c.dataValues,name,1,ctx.level);
      if((row.value===null||row.value===undefined)&&result.html.includes(ItemDescriptions.escape(row.text)))missing.push({token,reason:row.text,inputs:row.inputs,unsupported:row.unsupported});
    }
    report.push({id,name:item.name,localized:result.localized,sourceKey:key,missing,text:plain(result.html)});
  }
  console.log('ITEM DESCRIPTION AUDIT '+JSON.stringify({ranged,total:items.length,localized,complete,incomplete:report.length,activeCount,missingActives,report},null,2));
}
