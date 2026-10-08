import CalculationPipeline from '../engine/calculationPipeline.js';
import Calculations from '../shared/calculations.js';
import TextValues from '../core/text.js';
const escape=TextValues.escapeHtml;
/** Presentation of source expressions only: never append evaluated damage totals. */
export function mergeFormulaRanks(values,levelScaling=false){
 const unique=[...new Set(values)];if(unique.length===1)return unique[0];
 const number=/\d+(?:\.\d+)?/g,skeleton=values.map(v=>v.replace(number,'#'));
 if(skeleton.every(v=>v===skeleton[0])){
  const numbers=values.map(v=>[...v.matchAll(number)].map(m=>m[0]));let index=0;
  return values[0].replace(number,()=>{const parts=[...new Set(numbers.map(row=>row[index]))];index++;return parts.length===1?parts[0]:levelScaling?`(${parts[0]}–${parts.at(-1)}, by level)`:parts.join('/');});
 }
 return unique.join(levelScaling?' → ':' / ');
}
function expression(row){
 if(!row||row.kind==='missing'||row.kind==='unavailable')return 'Formula unavailable';
 if(row.kind==='empty')return '';
 if(row.kind==='calculation'){const formula=row.calculation.text;return row.isPercent?`100 × (${formula})%`:formula;}
 if(row.kind==='scaling')return `${Calculations.format(row.coefficient*100)}% ${row.statLabel}`;
 if(row.kind==='product')return `${row.multiplier} × (${expression(row.operand)})`;
 if(row.kind==='known')return String(row.display);
 return Number.isFinite(row.numeric)?Calculations.format(row.numeric):'Formula unavailable';
}
export function renderFormulaDescription({prepared,strings,id,slot}){
 const champ=prepared.champion,payload=prepared.abilities?.[slot];
 const spell=slot==='p'?{id:'passive',vars:[],effectBurn:[],description:champ.passive.description}:champ.spells[['q','w','e','r'].indexOf(slot)];
 const evaluation=(level=1)=>CalculationPipeline.create({build:{selectedChampion:id,level,runeSelections:{primaryPath:'',secondaryPath:'',primary:[],secondary:[],shards:[]}},data:{champion:champ,championRaw:prepared.raw,abilities:prepared.abilities,strings,stringsReady:!!Object.keys(strings).length}});
 const first=evaluation(),last=slot==='p'?evaluation(18):first;
 const raw=first.resolution.gameTooltip(payload,spell.tooltip||spell.description);
 const template=first.resolution.expandAbilityLocalization(raw);
 if(slot==='p'&&id==='Aurora'&&payload&&Object.keys(strings).length){
  const passive=e=>e.stats.passiveEvaluation(e.resolution.buildAbilityContext(spell,1,'p').stats);
  const base=passive(first),end=passive(last);
  const damage=mergeFormulaRanks([Calculations.format(base.baseFraction*100),Calculations.format(end.baseFraction*100)],true);
  const heal=mergeFormulaRanks([expression(first.resolution.resolveAbilityToken('HealCalc',first.resolution.buildAbilityContext(spell,1,'p'))),expression(last.resolution.resolveAbilityToken('HealCalc',last.resolution.buildAbilityContext(spell,1,'p')))],true);
  return `Damaging an enemy 3 times with abilities or attacks deals <span class="ability-formula">(${escape(damage)} + ${escape(Calculations.format(base.apCoefficient*100))}% Ability Power)% × target maximum Health</span> as magic damage. Against champions, this frees a spirit for ${escape(base.summary.spiritDuration)} seconds. Each spirit restores <span class="ability-formula">${escape(heal)}</span> Health per second, up to ${escape(base.summary.maxSpirits)} spirits.<br><br>Damage against monsters is capped at 100–270, based on level.`;
 }
 const ranks=slot==='p'?[1]:Array.from({length:spell.maxrank||5},(_,i)=>i+1);
 const html=template.replace(/\{\{\s*([^}]+?)\s*\}\}/g,(_,token)=>{
  const rows=ranks.map(rank=>expression(first.resolution.resolveAbilityToken(token,first.resolution.buildAbilityContext(spell,rank,slot))));
  if(slot==='p')rows.push(expression(last.resolution.resolveAbilityToken(token,last.resolution.buildAbilityContext(spell,1,slot))));
  return `<span class="ability-formula">${escape(mergeFormulaRanks(rows,slot==='p'))}</span>`;
 }).replace(/@[^@\s]+@/g,'<span class="ability-formula">Formula unavailable</span>');
 const colored=html.replace(/<(physicalDamage|magicDamage|trueDamage|healing|status)>/gi,(_,tag)=>`<span class="ability-${({physicalDamage:'damage-physical',magicDamage:'damage-magic',trueDamage:'damage-true',healing:'healing',status:'status'})[tag]}">`).replace(/<\/(physicalDamage|magicDamage|trueDamage|healing|status)>/gi,'</span>');
 return colored+(slot==='p'&&template===spell.description?'<p class="explorer-muted">Detailed formulas are currently unavailable; showing the summary.</p>':'');
}
