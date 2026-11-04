// Explicit upgrades and transformations; balance values stay in champion data.
const evolutions={Khazix:['q','w','e','r'],Kaisa:['q','w','e'],Viktor:['q','w','e','r'],Syndra:['q','w','e','r']};
const forms={
 Nidalee:{key:'cougar',names:['Human','Cougar'],slot:'r',aliases:['Takedown','Pounce','Swipe']},
 Jayce:{key:'cannon',names:['Hammer','Cannon'],slot:'r',aliases:['JayceShockBlast','JayceHyperCharge','JayceAccelerationGate']},
 Elise:{key:'spider',names:['Human','Spider'],slot:'r',aliases:['EliseSpiderQCast','EliseSpiderW','EliseSpiderE']},
 Gnar:{key:'mega',names:['Mini','Mega'],slot:'r',aliases:['GnarBigQ','GnarBigW','GnarBigE']},
 RekSai:{key:'burrowed',names:['Unburrowed','Burrowed'],slot:'w',aliases:['RekSaiQBurrowed','RekSaiWBurrowed','RekSaiEBurrowed']},
 Shyvana:{key:'dragon',names:['Human','Dragon'],slot:'r',aliases:['ShyvanaQ','ShyvanaW','ShyvanaE']},
};
function prepare(state){
 const values=state.combatValues;
 for(const slot of evolutions[state.selectedChampion]||[]){
  const enabled=values['evolve:'+slot]===true;
  // These source conditions select the evolved tooltip/calculation branch.
  const payload=state.cdragonAbilityData?.[slot];
  const condition=payload?.calculations?.IsEvolved?.mConditionalCalculationRequirements
   ||(state.selectedChampion==='Kaisa'&&slot==='q'?payload?.calculations?.MaxDamageDisplay?.mConditionalCalculationRequirements:null);
  if(condition?.mBuffName)values['buff:'+condition.mBuffName]=enabled?1:0;
 }
 return state;
}
export default {evolutions,forms,prepare};
