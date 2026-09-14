/** Explicit combat context. No unstated stack/health defaults and no game coefficients. */
(function(scope){
  const C=scope.Calculations;
  const nice=s=>String(s).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_:]/g,' ');
  const labels={ap:'Ability power',totalAd:'Attack damage',critDamage:'Critical damage',hp:'Maximum health',mp:'Mana',mr:'Magic resist',haste:'Ability haste',moveSpeed:'Move speed',attackRange:'Attack range',healShieldPower:'Heal/shield power'};
  function sourceContext(source,base){return {...base,dataValues:source.dataValues||[],calculations:source.calculations||{},effects:source.effects||[]};}
  function descriptors(sources,base={}){
    const found=new Map();
    function add(key,source,label){
      if(key.startsWith('buff:')||key.startsWith('elapsed:')){
        const [kind,name]=key.split(':');key=`${kind}:${/^\{[0-9a-f]+\}$/i.test(name)?name.toLowerCase():C.hash(name)}`;
      }
      if((base.targetFormulaOnly || base.managedTarget) && key.startsWith('target:'))return;
      if(base.automaticSelfStats && key.startsWith('self:') && !key.includes('healthPercent') && !key.includes('currentHp') && !key.includes('missingH'))return;
      if(found.has(key)){found.get(key).owners.add(source);return;}
      const [kind,name,mode]=key.split(':');
      if(kind==='self'||kind==='target'){
        if(['currentHp','missingHp','missingHealthPercent'].includes(name)){
          if(kind==='target'||!Number.isFinite(base.stats?.hp))add(`${kind}:hp:0`,source);
          add(`${kind}:healthPercent:0`,source);return;
        }
        if(name==='healthPercent')label=`${kind==='target'?'Target':'Your'} current health (%)`;
        else label=`${kind==='target'?'Target':'Your'} ${mode==='1'?'base ':mode==='2'?'bonus ':''}${labels[name]||nice(name).toLowerCase()}`;
      }
      const percent=name==='healthPercent'||name==='missingHealthPercent'||kind==='elapsed';
      found.set(key,{key,label:label||nice(name),kind,percent,boolean:kind==='condition'||kind==='ranged',owners:new Set([source])});
    }
    for(const source of sources){
      const context=sourceContext(source,base);
      for(const [name,calc] of Object.entries(source.calculations||{})){
        const effectName=String(name).startsWith('{')?`${nice(source.label)} effect`:nice(name);
        const owner=`${source.label}: ${effectName}`;
        const row=C.evaluate(calc,context);
        for(const key of row.inputs){
          if(key.startsWith('self:')||key.startsWith('target:'))add(key,owner);
          if(key.startsWith('items:'))add(key,owner,`Equipped items of rarity ${key.split(':')[1]}`);
        }
        function walk(node){
          if(!node||typeof node!=='object')return;
          if(base.allowLevelInput && (node.__type?.startsWith('ByCharLevel')||['{ee18a47b}','{b22609db}','{4ce08984}'].includes(node.__type)))add('level',owner,'Champion level (1–18; blank uses 1)');
          if(node.__type?.startsWith('BuffCounter')||node.__type==='HasBuffCastRequirement'){
            const key=`buff:${node.mBuffName}`;
            const readable=source.buffNames?.[node.mBuffName]||(!String(node.mBuffName).startsWith('{')?node.mBuffName:null);
            add(key,owner,`${readable?nice(readable):effectName} — stacks (0 if inactive)`);
          }
          if(node.__type==='PercentageOfBuffNameElapsed')add(`elapsed:${node.buffName}`,owner,`${effectName} — duration elapsed (%)`);
          if(node.__type==='IsRangedCastRequirement'&&typeof base.ranged!=='boolean')add('ranged',owner,'Ranged attacker');
          if(node.__type==='AboveHealthPercentCastRequirement')add('target:healthPercent:0',owner);
          if(node.__type==='HasNNearbyVisibleUnitsRequirement')add(`condition:${C.conditionKey(node)}`,owner,`Matching ally nearby (${node.mRange} range)`);
          if(node.__type==='{43b8e695}'){
            add('target:hp:0',owner);add('target:healthPercent:0',owner);
          }
          for(const value of Object.values(node))if(value&&typeof value==='object')walk(value);
        }
        walk(calc);
        if(calc.mRangedMultiplier&&typeof base.ranged!=='boolean')add('ranged',owner,'Ranged attacker');
      }
    }
    return [...found.values()];
  }
  function apply(base,values={}){
    const context={...base,stats:{...base.stats},targetStats:{...base.targetStats},buffs:{...base.buffs},buffElapsed:{...base.buffElapsed},conditions:{...base.conditions},itemCounts:{...base.itemCounts}};
    for(const [key,value] of Object.entries(values)){
      if(value===null||value===''||value===undefined)continue;
      const [kind,name,mode]=key.split(':');
      if(kind==='self'||kind==='target'){
        const stats=kind==='self'?context.stats:context.targetStats;
        const mapped=mode==='1'?`base${name[0].toUpperCase()}${name.slice(1)}`:mode==='2'?({totalAd:'bonusAd',ap:'ap',mp:'bonusMp',hp:'bonusHp'}[name]||`bonus${name[0].toUpperCase()}${name.slice(1)}`):name;
        if(Number.isFinite(value))stats[mapped]=value;
      }else if(kind==='buff')context.buffs[name]=value;
      else if(kind==='elapsed')context.buffElapsed[name]=value;
      else if(kind==='condition')context.conditions[name]=value;
      else if(kind==='ranged')context.ranged=value;
      else if(kind==='level')context.level=value;
      else if(kind==='items')context.itemCounts[name]=value;
    }
    context.stats=C.healthStats(context.stats);context.targetStats=C.healthStats(context.targetStats);
    return context;
  }
  function render(root,{sources,base={},values,onChange,fields:providedFields,inline=false}){
    if(!root)return;
    const fields=providedFields||descriptors(sources,base);
    root.replaceChildren();
    if(!fields.length)return;
    const details=document.createElement('details');details.open=root.dataset.open==='true';
    details.addEventListener('toggle',()=>root.dataset.open=String(details.open));
    const heading=document.createElement('summary');heading.textContent=`Calculation inputs (${fields.length})`;details.append(heading);
    const hint=document.createElement('p');hint.textContent='Enter combat state to resolve formulas. Blank means unknown. Stack inputs affect the formulas that reference them; they do not automatically apply all passive stat bonuses.';details.append(hint);
    const grid=document.createElement('div');grid.className='combat-input-grid';
    for(const field of fields){
      const label=document.createElement('label');label.textContent=field.label;label.title=[...field.owners].join('\n');
      const input=document.createElement(field.boolean?'select':'input');input.className='form-control';input.dataset.combatKey=field.key;
      if(field.boolean){for(const [value,text]of [['','Unknown'],['true','Yes'],['false','No']]){const option=document.createElement('option');option.value=value;option.textContent=value===''&&field.defaultValue!==undefined?`Default (${field.defaultValue?'Yes':'No'})`:text;input.append(option);}input.value=values[field.key]===undefined?'':String(values[field.key]);}
      else{
        input.type='number';
        input.min=Number.isFinite(field.min)?String(field.min):field.kind==='level'||field.key.endsWith(':hp:0')?'1':'0';
        input.step=Number.isFinite(field.step)&&field.step>0?String(field.step):['buff','level','items'].includes(field.kind)?'1':'any';
        if(field.percent)input.max='100';if(field.kind==='level')input.max='18';if(Number.isFinite(field.max))input.max=String(field.max);
        input.placeholder=field.defaultValue===undefined?'Unknown':String(field.defaultValue*(field.percent?100:1));
        input.value=Number.isFinite(values[field.key])?String(values[field.key]*(field.percent?100:1)):'';
      }
      input.addEventListener('change',()=>{
        if(!field.boolean&&input.value!==''){
          let value=Number(input.value);
          if(!Number.isFinite(value))return;
          if(input.min!=='')value=Math.max(Number(input.min),value);
          if(input.max!=='')value=Math.min(Number(input.max),value);
          if(input.step==='1')value=Math.floor(value);
          input.value=String(value);
        }
        if(!input.checkValidity())return;
        if(input.value==='')delete values[field.key];
        else values[field.key]=field.boolean?input.value==='true':Number(input.value)/(field.percent?100:1);
        onChange();
      });label.append(input);grid.append(label);
    }
    details.append(grid);root.append(inline?grid:details);
  }
  function itemSource(id,item,label){return {label:label||`Item ${id}`,dataValues:item?.mDataValues,calculations:item?.mItemCalculations,effects:item?.mEffectAmount};}
  scope.CombatInputs={descriptors,apply,render,itemSource};
  if(typeof module!=='undefined')module.exports=scope.CombatInputs;
})(typeof window!=='undefined'?window:globalThis);
