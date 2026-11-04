import {pickBuilds} from './shared/buildPicker.js';
import './shared/savedDataControls.js';
import SavedBuilds from './shared/savedBuilds.js';
import {orderBuilds,moveBuild,statLabels} from './domain/comparisonOrder.js';
import {createBuildDraft} from './application/comparisonEditor.mjs';
const status=document.getElementById('compareStatus'),grid=document.getElementById('compareGrid'),pinnedHost=document.getElementById('pinnedBuild');
const dialog=document.getElementById('quickBuildEditor'),editorHost=document.getElementById('quickBuildHost'),editStatus=document.getElementById('quickBuildStatus'),apply=document.getElementById('applyBuildChanges');
const preferenceKey='lol-buildsmith.compare.v1';let upgrading=false;let dataGeneration=0;let preferences={order:[],pinned:null,sort:'manual',direction:'desc'},draft=null,ticket=0,returnFocus=null;
try{const saved=JSON.parse(localStorage.getItem(preferenceKey)||'null');if(saved)preferences={...preferences,...saved,order:Array.isArray(saved.order)?saved.order:[]};}catch{status.textContent='Comparison preferences could not be restored.';}
const node=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
function button(text,action,label=text){const b=node('button',text,'btn');b.type='button';b.setAttribute('aria-label',label);b.onclick=()=>Promise.resolve().then(action).catch(error=>status.textContent=error.message);return b;}
function persist(){localStorage.setItem(preferenceKey,JSON.stringify(preferences));}
function cycle(direction){const cards=[...grid.children];if(!cards.length)return;const index=cards.reduce((best,card,i)=>Math.abs(card.offsetLeft-grid.scrollLeft)<Math.abs(cards[best].offsetLeft-grid.scrollLeft)?i:best,0);const next=cards[(index+direction+cards.length)%cards.length];grid.scrollTo({left:next.offsetLeft,behavior:'smooth'});next.focus({preventScroll:true});}
function reorder(id,offset){preferences.order=moveBuild(orderBuilds(SavedBuilds.read(),preferences).map(b=>b.id),id,offset);preferences.sort='manual';persist();render();grid.querySelector(`[data-build-id="${CSS.escape(id)}"]`)?.focus();}
async function edit(build,mode='all',slot=0){
 document.getElementById('editBuildName').value=build.name;const request=++ticket;returnFocus=document.activeElement;dialog.showModal();apply.disabled=true;editStatus.textContent='Loading build…';const mount=document.createElement('div');editorHost.replaceChildren(mount);
 try{const next=await createBuildDraft(mount,build);if(request!==ticket){next.dispose();return;}draft=next;editStatus.textContent=build.version===draft.page.state.version?'Changes apply only to this card.':`Recalculated on patch ${draft.page.state.version}.`;apply.disabled=false;draft.focus(mode,slot);}
 catch(error){if(request===ticket)editStatus.textContent=error.message;}
}
function close(){ticket++;draft?.dispose();draft=null;dialog.close();returnFocus?.focus();}
document.getElementById('cancelBuildChanges').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
apply.onclick=()=>{try{if(!draft)return;const updated=draft.capture();updated.name=document.getElementById('editBuildName').value.trim();if(!updated.name)throw new Error('Enter a build name.');SavedBuilds.save(updated);close();render();status.textContent='Build updated.';}catch(error){editStatus.textContent='Could not save: '+error.message;}};
function card(build){
 const el=node('article','','compare-card');el.tabIndex=-1;el.dataset.buildId=build.id;el.style.setProperty('--card-art',`url("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(build.state.selectedChampion)}_0.jpg")`);
 const pin=button('♧',()=>{preferences.pinned=preferences.pinned===build.id?null:build.id;persist();render();},preferences.pinned===build.id?'Unpin':'Pin left');pin.classList.add('compare-pin');pin.setAttribute('aria-pressed',String(preferences.pinned===build.id));pin.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m16 3 5 5-3 1-4 5v3l-3-3-7 7 7-7-3-3h3l5-4z"/></svg>';el.append(pin);
 const hero=node('div','','compare-hero'),icon=document.createElement('img');icon.src=`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(build.version)}/img/champion/${encodeURIComponent(build.state.selectedChampion)}.png`;icon.alt=build.championName;const name=node('h2',build.name);name.title=build.name;hero.append(icon,name,button('Level '+build.state.level,()=>edit(build,'abilities','q')));el.append(hero);
 const items=node('div','','compare-items');build.state.itemSlots.forEach((id,index)=>{const slot=button(id?'':'+',()=>edit(build,'items',index),`Edit item slot ${index+1}: ${build.itemNames?.[id]||'Empty'}`);if(id){const img=document.createElement('img');img.src=`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(build.version)}/img/item/${encodeURIComponent(id)}.png`;img.alt=build.itemNames?.[id]||id;slot.append(img);}items.append(slot);});el.append(items,node('p',`${build.gold} gold`));
 el.append(button(build.state.target?.enabled?`Target: ${build.state.target.currentHp} HP · ${build.state.target.armor} armor · ${build.state.target.mr} MR`:'Target settings · Off',()=>edit(build,'target')));
 for(const [title,text]of [['Champion stats',build.stats],['Selected runes',build.runes]]){const details=document.createElement('details');details.append(node('summary',title));
  if(title==='Champion stats'&&build.metrics){for(const [key,label]of Object.entries(statLabels)){if(Number.isFinite(build.metrics[key])){const row=node('div','','compare-stat');row.append(node('span',label),node('strong',Number(build.metrics[key].toFixed(2)).toString()));details.append(row);}}}else details.append(node('div',title==='Selected runes'&&build.runeNames?build.runeNames.join('\n'):text||'No results saved','compare-results'));if(title==='Selected runes')details.append(button('Edit runes',()=>edit(build,'all')));el.append(details);}
 const abilities=node('div','','compare-abilities');for(const a of build.abilitySummary||[]){const cell=button('',()=>edit(build,'abilities',a.slot==='p'?'q':a.slot),'Edit '+a.name);cell.className='compare-ability';cell.dataset.slot=a.slot;if(a.icon){const img=document.createElement('img');img.src=a.icon;img.alt=a.name;cell.append(img);}cell.append(node('strong',a.slot.toUpperCase()),node('small',a.rank===undefined?'Passive':'Rank '+a.rank),node('span',/unavailable|See Builder/i.test(a.damage)?'—':a.damage.replace(/^Damage:\s*/,'').replace(/\b(?:physical|magic|true) damage\b/gi,'').trim()));const damageText=cell.querySelector('span');if(a.damageParts?.length){damageText.replaceChildren();a.damageParts.forEach((part,index)=>{if(index)damageText.append(document.createTextNode(' / '));const value=node('b',part.text);value.dataset.damageType=part.type;damageText.append(value);});}damageText.tabIndex=0;damageText.setAttribute('aria-label',a.name+' damage');abilities.append(cell);}const damage=node('section','','compare-damage');damage.append(node('h3','Ability damage'),abilities);el.insertBefore(damage,items);
 const metrics=node('div','','compare-metrics');for(const [label,key]of [['Attack','attackDamage'],['DPS','dps']]){const box=node('div','','compare-metric');box.append(node('small',label),node('strong',Number.isFinite(build.metrics?.[key])?build.metrics[key].toFixed(1):'—'));metrics.append(box);};el.insertBefore(metrics,damage);if(build.attackNotes?.length)el.append(node('small',build.attackNotes.join(' '),'text-muted'));
 const choices=comboChoices(build),chosen=choices[preferences.combos?.[build.id]]||choices[0];
 const combo=button('',()=>selectCombo(build),'Select combo for '+build.name);combo.className='compare-combo';combo.append(node('span','Combo '+(choices.indexOf(chosen)+1),'combo-label'),node('strong',Number.isFinite(chosen.damage)?chosen.damage.toFixed(1)+' damage':'—','combo-total'),node('span',chosen.text.split('\n').filter((line,index)=>index===0||/^Minimum time:/i.test(line)).join('\n')||'No combo saved','compare-results'));if(chosen.text.split('\n').slice(1).some(line=>line.trim()&&!/^(Total damage:|Minimum time:)/i.test(line))){const warning=node('span',' !','combo-warning');warning.title='This combo has calculation warnings. Open the combo selector to review.';warning.setAttribute('aria-label','Calculation warning');combo.querySelector('.combo-total').append(warning);}el.insertBefore(combo,damage);
 const footer=node('div','','compare-actions');footer.append(iconButton('left',()=>reorder(build.id,-1),'Move '+build.name+' left'),iconButton('right',()=>reorder(build.id,1),'Move '+build.name+' right'),iconButton('edit',()=>edit(build),'Edit build'),iconButton('copy',()=>{SavedBuilds.copy(build.id);render();},'Copy'),iconButton('delete',()=>{SavedBuilds.remove(build.id);if(preferences.pinned===build.id)preferences.pinned=null;persist();render();},'Delete'));el.append(footer,node('small',`Patch ${build.version} · ${new Date(build.savedAt).toLocaleDateString()}`));return el;
}
function render(){try{
 const all=SavedBuilds.read();preferences.order=[...preferences.order.filter(id=>all.some(b=>b.id===id)),...all.map(b=>b.id).filter(id=>!preferences.order.includes(id))];
 const builds=orderBuilds(all,preferences);grid.replaceChildren();pinnedHost.replaceChildren();for(const b of builds){if(preferences.hidden?.includes(b.id))continue;if(b.id===preferences.pinned)pinnedHost.append(card(b));else grid.append(card(b));}pinnedHost.hidden=!pinnedHost.children.length;requestAnimationFrame(updateScrollEdges);
 status.textContent=all.length?(all.some(b=>!b.metrics)?'Older cards gain sortable values when edited and applied.':''):'No saved builds yet. Create a build in Builder to start.';
 const selector=document.getElementById('buildSort');const options={manual:'Manual order',name:'Name',comboDamage:'Combo damage',attackDamage:'Attack damage',dps:'DPS',cost:'Cost',...statLabels};for(const b of all)for(const key of Object.keys(b.metrics||{}))if(!(key in options))options[key]=key.replace(/([A-Z])/g,' $1');selector.replaceChildren(...Object.entries(options).map(([value,label])=>new Option(label,value)));selector.value=preferences.sort;document.getElementById('sortDirection').value=preferences.direction;
 if(upgrading&&all.length){status.textContent='Updating older builds for numeric comparison…';document.querySelectorAll('.comparison-stage button').forEach(button=>button.disabled=true);}
}catch(error){status.textContent='Could not read saved builds: '+error.message;}}
document.getElementById('chooseBuilds').onclick=()=>pickBuilds({multiple:true,selected:SavedBuilds.read().filter(b=>!preferences.hidden?.includes(b.id)).map(b=>b.id),onSelect:ids=>{preferences.hidden=SavedBuilds.read().filter(b=>!ids.includes(b.id)).map(b=>b.id);persist();render();}});document.getElementById('buildSort').onchange=event=>{preferences.sort=event.target.value;persist();render();};document.getElementById('sortDirection').onchange=event=>{preferences.direction=event.target.value;persist();render();};document.getElementById('previousBuild').onclick=()=>cycle(-1);document.getElementById('nextBuild').onclick=()=>cycle(1);function resetSavedData(){
 dataGeneration++;
 if(dialog.open)close();
 try{preferences={order:[],pinned:null,sort:'manual',direction:'desc',...JSON.parse(localStorage.getItem(preferenceKey)||'{}')};}catch{preferences={order:[],pinned:null,sort:'manual',direction:'desc'};}
 render();
}
window.addEventListener('saved-data-cleared',resetSavedData);
window.addEventListener('storage',event=>{if(event.key===null||(event.key==='lol-buildsmith.builds.v1'||event.key===preferenceKey)&&event.newValue===null)resetSavedData();else render();});render();

async function upgradeLegacy(refreshAll=false){
 if(upgrading)return;const legacy=SavedBuilds.read().filter(build=>refreshAll||!build.metrics||build.abilitySummary?.some(a=>!a.damageParts));if(!legacy.length)return;
 const generation=dataGeneration;upgrading=true;render();let failed=0;
 const host=document.createElement('div');host.hidden=true;document.body.append(host);
 try{for(const build of legacy){if(generation!==dataGeneration)break;let session;try{session=await createBuildDraft(host,build);const current=SavedBuilds.read().find(b=>b.id===build.id);if(generation===dataGeneration&&current?.savedAt===build.savedAt)SavedBuilds.save(session.capture());}catch{failed++;}finally{session?.dispose();}}}
 finally{host.remove();upgrading=false;render();if(generation===dataGeneration)status.textContent=failed?'Some older builds could not be refreshed. Check your connection and use Refresh values to retry.':'';}
}
document.getElementById('refreshBuildValues').onclick=()=>upgradeLegacy(true).catch(error=>status.textContent=error.message);
upgradeLegacy().catch(error=>status.textContent=error.message);

let drag=null,suppressClick=false;
function updateScrollEdges(){
 grid.style.setProperty('--fade-left',grid.scrollLeft>2?'24px':'0px');
 grid.style.setProperty('--fade-right',grid.scrollLeft<grid.scrollWidth-grid.clientWidth-2?'24px':'0px');
}
grid.addEventListener('pointerdown',event=>{
 if(event.pointerType!=='mouse'||event.button!==0)return;
 suppressClick=false;drag={id:event.pointerId,x:event.clientX,left:grid.scrollLeft,active:false};
});
grid.addEventListener('pointermove',event=>{
 if(!drag||event.pointerId!==drag.id)return;
 if(!drag.active&&Math.abs(event.clientX-drag.x)>6){drag.active=true;grid.setPointerCapture(event.pointerId);grid.classList.add('is-dragging');}
 if(drag.active){event.preventDefault();grid.scrollLeft=drag.left+drag.x-event.clientX;}
});
function finishDrag(){if(!drag)return;suppressClick=drag.active;drag=null;grid.classList.remove('is-dragging');updateScrollEdges();}
grid.addEventListener('pointerup',finishDrag);grid.addEventListener('pointercancel',finishDrag);grid.addEventListener('lostpointercapture',finishDrag);
grid.addEventListener('pointerleave',()=>{if(drag&&!drag.active)drag=null;});
grid.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}},true);
grid.addEventListener('dragstart',event=>event.preventDefault());
grid.addEventListener('scroll',updateScrollEdges,{passive:true});
new ResizeObserver(updateScrollEdges).observe(grid);
grid.addEventListener('keydown',event=>{if(event.target===grid&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();cycle(event.key==='ArrowLeft'?-1:1);}});


function comboChoices(build){
 const entries=[{text:build.combo||'',damage:build.metrics?.comboDamage,steps:build.comboSteps||[]},...(build.comboVariants||[])];
 return entries.filter((entry,index)=>entries.findIndex(other=>JSON.stringify(other.steps)===JSON.stringify(entry.steps))===index).sort((a,b)=>(b.damage||0)-(a.damage||0));
}
function selectCombo(build){
 const opener=document.activeElement,selector=node('dialog','','combo-selector');selector.setAttribute('aria-label','Select combo');
 selector.append(node('h2','Select combo'),node('p','Saved combinations, highest damage first.'));
 comboChoices(build).forEach((entry,index)=>{const option=button('',()=>{preferences.combos={...preferences.combos,[build.id]:index};persist();selector.close();render();},'Select combo '+(index+1));option.append(node('strong',Number.isFinite(entry.damage)?entry.damage.toFixed(1)+' damage':'No damage saved'),node('span',entry.text.split('\n').filter(line=>!/^Total damage:/i.test(line)).join('\n')));selector.append(option);});
 selector.append(button('Edit combo',()=>{selector.close();edit(build,'combo');}),button('Close',()=>selector.close()));
 selector.addEventListener('close',()=>{selector.remove();opener?.focus();});document.body.append(selector);selector.showModal();
}

function iconButton(kind,action,label){
 const paths={left:'M20 9H11V4L3 12l8 8v-5h9z',right:'M4 9h9V4l8 8-8 8v-5H4z',edit:'m16 3 5 5-12 12-6 1 1-6z M13 6l5 5',copy:'M9 9h12v12H9z M15 9V3H3v12h6',delete:'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7'};
 const control=button('',action,label);control.title=label;
 control.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" fill="'+(['left','right'].includes(kind)?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[kind]+'"/></svg>';
 return control;
}

