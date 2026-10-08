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
 const request=++ticket;returnFocus=document.activeElement;dialog.showModal();apply.disabled=true;editStatus.textContent='Loading build…';const mount=document.createElement('div');editorHost.replaceChildren(mount);
 try{const next=await createBuildDraft(mount,build);if(request!==ticket){next.dispose();return;}draft=next;editStatus.textContent=build.version===draft.page.state.version?'Changes apply only to this card.':`Recalculated on patch ${draft.page.state.version}.`;apply.disabled=false;draft.focus(mode,slot);}
 catch(error){if(request===ticket)editStatus.textContent=error.message;}
}
function close(){ticket++;draft?.dispose();draft=null;dialog.close();returnFocus?.focus();}
document.getElementById('cancelBuildChanges').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
apply.onclick=()=>{try{if(!draft)return;SavedBuilds.save(draft.capture());close();render();status.textContent='Build updated.';}catch(error){editStatus.textContent='Could not save: '+error.message;}};
function card(build){
 const el=node('article','','compare-card');el.tabIndex=-1;el.dataset.buildId=build.id;
 const actions=node('div','','compare-actions');actions.append(button(preferences.pinned===build.id?'Unpin':'Pin left',()=>{preferences.pinned=preferences.pinned===build.id?null:build.id;persist();render();}),button('←',()=>reorder(build.id,-1),'Move '+build.name+' left'),button('→',()=>reorder(build.id,1),'Move '+build.name+' right'));el.append(actions,node('h2',build.name));
 const hero=node('div','','compare-hero'),icon=document.createElement('img');icon.src=`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(build.version)}/img/champion/${encodeURIComponent(build.state.selectedChampion)}.png`;icon.alt=build.championName;hero.append(icon,node('strong',build.championName),button('Level '+build.state.level,()=>edit(build,'abilities','q')));el.append(hero,node('small',`Patch ${build.version} · ${new Date(build.savedAt).toLocaleDateString()}`));
 const items=node('div','','compare-items');build.state.itemSlots.forEach((id,index)=>{const slot=button(id?'':'+',()=>edit(build,'items',index),`Edit item slot ${index+1}: ${build.itemNames?.[id]||'Empty'}`);if(id){const img=document.createElement('img');img.src=`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(build.version)}/img/item/${encodeURIComponent(id)}.png`;img.alt=build.itemNames?.[id]||id;slot.append(img);}items.append(slot);});el.append(items,node('p',`${build.gold} gold`));
 el.append(button(build.state.target?.enabled?`Target: ${build.state.target.currentHp} HP · ${build.state.target.armor} armor · ${build.state.target.mr} MR`:'Target settings · Off',()=>edit(build,'target')));
 for(const [title,text]of [['Champion stats',build.stats],['Selected runes',build.runes]]){const details=document.createElement('details');details.append(node('summary',title));
  if(title==='Champion stats'&&build.metrics){for(const [key,label]of Object.entries(statLabels)){if(Number.isFinite(build.metrics[key])){const row=node('div','','compare-stat');row.append(node('span',label),node('strong',Number(build.metrics[key].toFixed(2)).toString()));details.append(row);}}}else details.append(node('div',title==='Selected runes'&&build.runeNames?build.runeNames.join('\n'):text||'No results saved','compare-results'));if(title==='Selected runes')details.append(button('Edit runes',()=>edit(build,'all')));el.append(details);}
 const abilities=node('div','','compare-abilities');for(const a of build.abilitySummary||[]){const cell=button('',()=>edit(build,'abilities',a.slot==='p'?'q':a.slot),'Edit '+a.name);cell.className='compare-ability';if(a.icon){const img=document.createElement('img');img.src=a.icon;img.alt=a.name;cell.append(img);}cell.append(node('strong',a.slot.toUpperCase()),node('small',a.rank===undefined?'Passive':'Rank '+a.rank),node('span',/unavailable|See Builder/i.test(a.damage)?'—':a.damage.replace(/^Damage:\s*/,'').replace(/\b(?:physical|magic|true) damage\b/gi,'').trim()));abilities.append(cell);}el.append(abilities);
 const metrics=node('div','','compare-metrics');for(const [label,key]of [['Attack','attackDamage'],['DPS','dps']])metrics.append(node('div',label+'\n'+(Number.isFinite(build.metrics?.[key])?build.metrics[key].toFixed(1):'—')));el.append(metrics);if(build.attackNotes?.length)el.append(node('small',build.attackNotes.join(' '),'text-muted'));
 const combo=document.createElement('details');combo.append(node('summary','Combo Tester'),node('div',build.combo||'No combo saved','compare-results'),button('Edit combo',()=>edit(build,'combo')));el.append(combo);
 const footer=node('div','','compare-actions');footer.append(button('Edit build',()=>edit(build)),button('Copy',()=>{SavedBuilds.copy(build.id);render();}),button('Delete',()=>{SavedBuilds.remove(build.id);if(preferences.pinned===build.id)preferences.pinned=null;persist();render();}));const link=node('a','Open & tweak','btn');link.href='Builder.html?build='+encodeURIComponent(build.id);footer.append(link);el.append(footer);return el;
}
function render(){try{
 const all=SavedBuilds.read(),query=document.getElementById('buildSearch').value.trim().toLowerCase();preferences.order=[...preferences.order.filter(id=>all.some(b=>b.id===id)),...all.map(b=>b.id).filter(id=>!preferences.order.includes(id))];
 const builds=orderBuilds(all,preferences);grid.replaceChildren();pinnedHost.replaceChildren();for(const b of builds){if(b.id===preferences.pinned)pinnedHost.append(card(b));else if((b.name+' '+b.championName).toLowerCase().includes(query))grid.append(card(b));}pinnedHost.hidden=!pinnedHost.children.length;
 status.textContent=all.length?`${all.length} saved builds. ${all.some(b=>!b.metrics)?'Older cards gain sortable values when edited and applied.':''}`:'No saved builds yet. Create a build in Builder to start.';
 const selector=document.getElementById('buildSort');const options={manual:'Manual order',name:'Name',comboDamage:'Combo damage',attackDamage:'Attack damage',dps:'DPS',cost:'Cost',...statLabels};for(const b of all)for(const key of Object.keys(b.metrics||{}))if(!(key in options))options[key]=key.replace(/([A-Z])/g,' $1');selector.replaceChildren(...Object.entries(options).map(([value,label])=>new Option(label,value)));selector.value=preferences.sort;document.getElementById('sortDirection').value=preferences.direction;
 if(upgrading&&all.length){status.textContent='Updating older builds for numeric comparison…';document.querySelectorAll('.comparison-stage button').forEach(button=>button.disabled=true);}
}catch(error){status.textContent='Could not read saved builds: '+error.message;}}
document.getElementById('buildSearch').addEventListener('input',render);document.getElementById('buildSort').onchange=event=>{preferences.sort=event.target.value;persist();render();};document.getElementById('sortDirection').onchange=event=>{preferences.direction=event.target.value;persist();render();};document.getElementById('previousBuild').onclick=()=>cycle(-1);document.getElementById('nextBuild').onclick=()=>cycle(1);function resetSavedData(){
 dataGeneration++;
 if(dialog.open)close();
 try{preferences={order:[],pinned:null,sort:'manual',direction:'desc',...JSON.parse(localStorage.getItem(preferenceKey)||'{}')};}catch{preferences={order:[],pinned:null,sort:'manual',direction:'desc'};}
 document.getElementById('buildSearch').value='';render();
}
window.addEventListener('saved-data-cleared',resetSavedData);
window.addEventListener('storage',event=>{if(event.key===null||(event.key==='lol-buildsmith.builds.v1'||event.key===preferenceKey)&&event.newValue===null)resetSavedData();else render();});render();

async function upgradeLegacy(refreshAll=false){
 if(upgrading)return;const legacy=SavedBuilds.read().filter(build=>refreshAll||!build.metrics);if(!legacy.length)return;
 const generation=dataGeneration;upgrading=true;render();let failed=0;
 const host=document.createElement('div');host.hidden=true;document.body.append(host);
 try{for(const build of legacy){if(generation!==dataGeneration)break;let session;try{session=await createBuildDraft(host,build);const current=SavedBuilds.read().find(b=>b.id===build.id);if(generation===dataGeneration&&current?.savedAt===build.savedAt)SavedBuilds.save(session.capture());}catch{failed++;}finally{session?.dispose();}}}
 finally{host.remove();upgrading=false;render();if(generation===dataGeneration)status.textContent=failed?'Some older builds could not be refreshed. Check your connection and use Refresh values to retry.':'Older builds refreshed using the current patch. Numeric sorting is ready.';}
}
document.getElementById('refreshBuildValues').onclick=()=>upgradeLegacy(true).catch(error=>status.textContent=error.message);
upgradeLegacy().catch(error=>status.textContent=error.message);
