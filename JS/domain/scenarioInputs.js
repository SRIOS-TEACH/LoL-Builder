
/** Scenario values are independent of calculation engines and page state. */

const finite=Number.isFinite,clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const numeric=(value,fallback)=>value!==null&&value!==''&&finite(Number(value))?Number(value):fallback;
/** Preserve the current target defaults and units: HP, resistances and percent reduction. */
function normalizeTarget(target={}) {
 const maxHp=Math.max(1,numeric(target?.maxHp,2000));
 return {enabled:target?.enabled===true,maxHp,currentHp:clamp(numeric(target?.currentHp,maxHp),0,maxHp),
  armor:numeric(target?.armor,100),mr:numeric(target?.mr,100),damageReduction:clamp(numeric(target?.damageReduction,0),0,100)};
}
function normalizeGameTime(value) {return finite(Number(value))?Math.max(0,Number(value)):0;}
/** @returns {{target: Object, gameTimeMinutes: number}} Fresh scenario inputs. */
function createScenarioInputs(initial={}) {
 return {target:normalizeTarget(initial.target),gameTimeMinutes:normalizeGameTime(initial.gameTimeMinutes)};
}
const api={normalizeTarget,normalizeGameTime,createScenarioInputs};const exportedApi = api;

export default exportedApi;
