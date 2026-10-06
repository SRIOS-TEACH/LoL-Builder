/** Explicit combat context. No unstated stack/health defaults and no game coefficients. */
(function(scope){
  const context=scope.CombatContext || (typeof require==='function'?require('../engine/combatContext.js'):null);
  const {descriptors,apply,itemSource}=context;
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
  scope.CombatInputs={descriptors,apply,render,itemSource};
  if(typeof module!=='undefined')module.exports=scope.CombatInputs;
})(typeof window!=='undefined'?window:globalThis);
