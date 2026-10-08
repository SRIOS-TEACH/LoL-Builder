import SavedBuilds from './shared/savedBuilds.js';
/* Saved cards deliberately display the exact results captured by Builder. */
(function(){
const status=document.getElementById('compareStatus'),grid=document.getElementById('compareGrid');
function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function render(){try{
 const all=SavedBuilds.read(),query=document.getElementById('buildSearch').value.toLowerCase();grid.replaceChildren();
 const builds=all.filter(b=>(b.name+' '+b.championName).toLowerCase().includes(query));
 status.textContent=all.length?`${builds.length} saved builds shown`:'No saved builds yet. Choose a champion in Builder and save your first build.';
 for(const b of builds){const card=node('article','','compare-card');card.append(node('h2',b.name));const hero=node('div','','compare-hero');
 const icon=document.createElement('img');icon.src=`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(b.version)}/img/champion/${encodeURIComponent(b.state.selectedChampion)}.png`;icon.alt=b.championName;hero.append(icon,node('strong',b.championName),node('span','Level '+b.state.level));card.append(hero,node('small',`Patch ${b.version} · ${new Date(b.savedAt).toLocaleDateString()}`));
 const items=node('div','','compare-items');for(const id of b.state.itemSlots){const slot=node('span',id?'':'+');if(id){const img=document.createElement('img');img.src=`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(b.version)}/img/item/${encodeURIComponent(id)}.png`;img.alt=b.itemNames?.[id]||id;slot.append(img);}items.append(slot);}card.append(items,node('p',`${b.gold} gold`),node('small',b.state.target?.enabled?`Target: ${b.state.target.currentHp}/${b.state.target.maxHp} HP · ${b.state.target.armor} armor · ${b.state.target.mr} MR`:'Before target defences'));
 const abilities=node('div','','compare-abilities');for(const a of b.abilitySummary||[]){const cell=node('div','','compare-ability');if(a.icon){const img=document.createElement('img');img.src=a.icon;img.alt=a.name;cell.append(img);}cell.append(node('strong',a.slot.toUpperCase()),node('small',a.rank===undefined?'Passive':'Rank '+a.rank),node('span',/unavailable|See Builder/i.test(a.damage)?'—':a.damage.replace(/^Damage:\s*/,'').replace(/\b(?:physical|magic|true) damage\b/gi,'').trim()));abilities.append(cell);}
 for(const [title,text]of [['Champion stats',b.stats],['Selected runes',b.runes],['Attack',b.attack],['Combo Tester',b.combo]]){if(title==='Attack')card.append(abilities);const details=document.createElement('details');details.open=['Abilities','Attack','Combo Tester'].includes(title);details.append(node('summary',title),node('div',text||'No results saved','compare-results'));card.append(details);}
 const actions=node('div','','compare-actions'),edit=node('a','Open & tweak','btn');edit.href='Builder.html?build='+encodeURIComponent(b.id);actions.append(edit);
 for(const [label,action]of [['Copy',()=>SavedBuilds.copy(b.id)],['Delete',()=>SavedBuilds.remove(b.id)]]){const button=node('button',label,'btn');button.type='button';button.onclick=()=>{try{action();render();}catch(e){status.textContent=e.message;}};actions.append(button);}card.append(actions);grid.append(card);}
}catch(e){status.textContent='Could not access saved builds: '+e.message;}}
document.getElementById('buildSearch').addEventListener('input',render);window.addEventListener('storage',render);render();
})();
