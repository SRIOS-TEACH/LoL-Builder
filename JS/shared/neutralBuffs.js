import source from '../data/neutralBuffData.js';
import Calculations from './calculations.js';
const number=(name,key)=>Calculations.dataValue(source[name]?.dataValues,key,1).value;
const calculate=(name,key,level)=>Calculations.evaluate(source[name]?.calculations[key],{level}).value;
const dragons={infernal:'Infernal',mountain:'Mountain',ocean:'Ocean',cloud:'Cloud',hextech:'Hextech',chemtech:'ChemTech'};
const controls=[['red','Red buff'],['blue','Blue buff'],['baron','Baron'],['elder','Elder dragon'],...Object.keys(dragons).map(k=>[k,k[0].toUpperCase()+k.slice(1)+' dragon'])];
function model(state){
 const v=state.combatValues||{},active=k=>v['neutral:'+k]===true;
 const count=k=>active(k)?Math.min(4,Math.max(0,Math.floor(Number(v['neutral:'+k+':stacks'])||0))):0;
 const value=(k,key)=>number('SRX_DragonBuff'+dragons[k],key)*count(k);
 const blueHaste=active('blue')?calculate('CrestoftheAncientGolem','{bda1b32b}',state.level):0;
 const healShieldPower=value('chemtech','HealShieldPerStack'),tenacity=value('chemtech','TenacityPerStack');
 function apply(stats,apMultiplier=1){
  const out={...stats},baronAd=active('baron')?Math.max(0,Number(v['neutral:baron:ad']??12)):0,baronAp=active('baron')?Math.max(0,Number(v['neutral:baron:ap']??20)):0;
  out.ad=(out.ad+baronAd)*(1+value('infernal','ADandAPPercentIncrease'));
  out.ap=(out.ap+baronAp*apMultiplier)*(1+value('infernal','ADandAPPercentIncrease'));
  out.armor*=1+value('mountain','BonusDefenses');out.mr*=1+value('mountain','BonusDefenses');
  const speed=value('hextech','AttackSpeed');out.asTotal=Math.min(state.selectedChampion==='Belveth'?9999:state.selectedChampion==='Jinx'&&v['attack:excited']===true?90:Math.max(3,out.asTotal),out.asTotal+(out.base.attackspeedratio??out.base.attackspeed)*speed);
  out.bonusAttackSpeedFromChampion=(out.bonusAttackSpeedFromChampion||0)+speed;
  out.abilityHaste+=blueHaste+value('hextech','AbilityHaste');
  const healthFraction=Math.max(0,Math.min(1,Number(v['self:healthPercent:0']??1)));
  out.hp5+=(out.hp*(1-healthFraction))*value('ocean','HealingPercent');
  if(active('blue'))out.mp5+=(number('CrestoftheAncientGolem','FlatRestore')+out.mp*number('CrestoftheAncientGolem','PercentRestore')/100);
  if(active('red')&&v['neutral:outOfCombat']===true)out.hp5+=out.hp*calculate('BlessingoftheLizardElder','{670feb37}',state.level);
  if(active('cloud')&&v['neutral:outOfCombat']===true)out.moveSpeed*=1+value('cloud','MSAmountPerStack');
  return out;
 }
 function burns(){
  const rows=[];
  if(active('red')){const duration=number('BlessingoftheLizardElder','DebuffDuration'),total=calculate('BlessingoftheLizardElder','DamageOverTime',state.level);rows.push({label:'Red buff burn',total,duration,type:'true'});}
  if(active('elder')){const d=k=>number('ElderDragonBuff',k),time=Math.max(0,Math.min(1,((state.gameTimeMinutes??20)-d('BurnDamageTimeMultiplierMin'))/(d('BurnDamageTimeMultiplierMax')-d('BurnDamageTimeMultiplierMin')))),duration=d('DebuffDuration');rows.push({label:'Elder dragon burn',total:(d('BurnDamagePerSecondMin')+time*(d('BurnDamagePerSecondMax')-d('BurnDamagePerSecondMin')))*duration,duration,type:'true'});}
  return rows;
 }
 return {apply,burns,healShieldPower,tenacity,controls,active,count,slowResistance:value('cloud','SRAmountPerStack')};
}
export default {model,controls,dragons};
