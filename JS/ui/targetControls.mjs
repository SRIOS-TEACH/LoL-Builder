import TargetDamage from '../shared/targetDamage.js';
import {createLifecycle,createView} from './lifecycle.mjs';
export function createTargetControls({elements, initial, onChange}) {
const life=createLifecycle(), document=createView(elements);
let target=TargetDamage.normalize(initial);

  const modal = document.getElementById('targetModal');
  life.on(document.getElementById('targetSettingsBtn'),'click', () => modal.showModal());
  life.on(document.getElementById('closeTargetModal'),'click', () => modal.close());
  life.on(modal,'close', () => document.getElementById('targetSettingsBtn').focus());
  let backdrop = false;
  life.on(modal,'pointerdown', event => { backdrop = event.target === modal && (event.offsetX < 0 || event.offsetY < 0 || event.offsetX > modal.clientWidth || event.offsetY > modal.clientHeight); });
  life.on(modal,'click', event => { if (backdrop && event.target === modal) modal.close(); backdrop = false; });
  const fields={targetMaxHp:'maxHp',targetCurrentHp:'currentHp',targetArmor:'armor',targetMr:'mr',targetDamageReduction:'damageReduction'};
  const sync=()=>{
    target=TargetDamage.normalize(target);
    for(const [id,key]of Object.entries(fields))document.getElementById(id).value=target[key];
    document.getElementById('targetCurrentHp').max=target.maxHp;
    const button=document.getElementById('targetEnabled');
    button.setAttribute('aria-pressed',String(target.enabled));button.textContent=target.enabled?'On':'Off';
    document.getElementById('targetFields').classList.toggle('target-inactive',!target.enabled);
    document.getElementById('targetStatus').textContent=target.enabled?'On: damage against this target. True damage ignores defences and reduction.':'Off: damage before target defences. Target values are retained.';
  };
  let rendered=JSON.stringify(target);
  const update=(commit=true)=>{
    if(commit)sync();
    const next=JSON.stringify(target);
    if(next===rendered)return;
    rendered=next;onChange({...target});
  };
  life.on(document.getElementById('targetEnabled'),'click',()=>{target.enabled=!target.enabled;update();});
  const read=()=>{
    const draft={...target};
    for(const [id,key]of Object.entries(fields)){
      const input=document.getElementById(id),value=Number(input.value);
      if(input.value.trim()&&Number.isFinite(value))draft[key]=value;
    }
    target=TargetDamage.normalize(draft);
  };
  for(const id of Object.keys(fields)){
    const input=document.getElementById(id);
    life.on(input,'input',()=>{read();update(false);});
    // Damage updates while typing, so a later blur does not replace the button
    // the user is in the middle of clicking. Commit only formats/clamps fields.
    life.on(input,'change',()=>{read();update();});
  }
  sync();

return {update(next) {if(life.disposed)return; const normalized=TargetDamage.normalize(next), signature=JSON.stringify(normalized); if(signature===rendered)return; target=normalized; rendered=signature; sync();}, dispose() {modal.close();life.dispose();}};
}
