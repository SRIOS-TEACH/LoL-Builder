import SavedBuilds from './savedBuilds.js';
export function pickBuilds({multiple=false,selected=[],onSelect}){
 const trigger=document.activeElement,dialog=document.createElement('dialog');dialog.className='build-picker';dialog.setAttribute('aria-label',multiple?'Choose comparison builds':'Load build');
 const heading=document.createElement('h2');heading.textContent=multiple?'Add / remove builds':'Load build';dialog.append(heading);
 const note=document.createElement('p');note.textContent=multiple?'Choose which builds appear in your comparison. Removing a build here does not delete it.':'Choose a saved build to load into the Builder.';dialog.append(note);
 const search=document.createElement('input');search.type='search';search.className='form-control';search.placeholder='Search champion or build name';search.setAttribute('aria-label','Search champion or build name');dialog.append(search);
 const list=document.createElement('div');list.className='build-picker-list';dialog.append(list);const chosen=new Set(selected);
 for(const build of SavedBuilds.read()){
  const tile=document.createElement('button');tile.dataset.search=(build.name+' '+build.championName).toLocaleLowerCase();tile.type='button';tile.className='build-picker-tile';tile.setAttribute('aria-pressed',String(chosen.has(build.id)));
  const icon=document.createElement('img');icon.className='picker-champion';icon.src=`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(build.version)}/img/champion/${encodeURIComponent(build.state.selectedChampion)}.png`;icon.alt=build.championName;
  const title=document.createElement('strong');title.textContent=build.name;const level=document.createElement('small');level.textContent='Level '+build.state.level;const items=document.createElement('div');items.className='picker-items';
  for(const id of build.state.itemSlots){const slot=document.createElement('span');if(id){const image=document.createElement('img');image.src=`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(build.version)}/img/item/${encodeURIComponent(id)}.png`;image.alt=build.itemNames?.[id]||id;slot.append(image);}items.append(slot);}
  tile.append(icon,title,level,items);tile.onclick=async()=>{if(multiple){chosen.has(build.id)?chosen.delete(build.id):chosen.add(build.id);tile.setAttribute('aria-pressed',String(chosen.has(build.id)));}else{try{tile.disabled=true;await onSelect(build);dialog.close();}catch(error){note.textContent=error.message;tile.disabled=false;}}};list.append(tile);
 }
 search.oninput=()=>{const query=search.value.trim().toLocaleLowerCase();for(const tile of list.children)tile.hidden=!tile.dataset.search.includes(query);};
 if(!list.children.length)note.textContent='No saved builds yet. Save a build in Builder first.';
 const close=document.createElement('button');close.className='btn';close.textContent='Cancel';close.onclick=()=>dialog.close();dialog.append(close);
 if(multiple){const apply=document.createElement('button');apply.className='btn';apply.textContent='Apply selection';apply.onclick=()=>{onSelect([...chosen]);dialog.close();};dialog.append(apply);}
 dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus();});document.body.append(dialog);dialog.showModal();
}
export function buildNotice(message,{confirm=false,onConfirm=()=>{}}={}){
 const trigger=document.activeElement,dialog=document.createElement('dialog');dialog.className='build-picker build-notice';dialog.setAttribute('aria-label',confirm?'Confirm save':'Build created');const text=document.createElement('p');text.textContent=message;dialog.append(text);
 if(confirm){const cancel=document.createElement('button');cancel.className='btn';cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();dialog.append(cancel);}
 const okay=document.createElement('button');okay.className='btn';okay.textContent=confirm?'Create another':'OK';okay.onclick=()=>{try{onConfirm();dialog.close();}catch(error){text.textContent=error.message;}};dialog.append(okay);dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus();});document.body.append(dialog);dialog.showModal();
}

export function resolveBuildName(build,onSave){
 const trigger=document.activeElement,dialog=document.createElement('dialog');dialog.className='build-picker build-notice';dialog.setAttribute('aria-label','Build name already exists');
 const message=document.createElement('p');message.textContent='A build named “'+build.name+'” already exists.';dialog.append(message);
 const input=document.createElement('input');input.className='form-control';input.maxLength=80;input.setAttribute('aria-label','New build name');input.value=build.name;input.hidden=true;dialog.append(input);
 const matches=()=>SavedBuilds.read().filter(b=>b.name.trim().toLocaleLowerCase()===build.name.trim().toLocaleLowerCase());
 const candidates=matches();const select=document.createElement('select');select.className='form-control';select.setAttribute('aria-label','Build to overwrite');for(const b of candidates){const option=document.createElement('option');option.value=b.id;option.textContent=b.name+' · '+b.championName+' · Level '+b.state.level+' · '+new Date(b.savedAt).toLocaleString();select.append(option);}select.hidden=candidates.length<2;dialog.append(select);
 const action=(label,fn)=>{const b=document.createElement('button');b.className='btn';b.textContent=label;b.onclick=()=>{try{fn();}catch(error){message.textContent=error.message;}};dialog.append(b);return b;};
 action('Cancel',()=>dialog.close());const overwrite=action('Overwrite',()=>{if(!matches().some(b=>b.id===select.value))throw new Error('That build changed. Cancel and save again.');onSave({...build,id:select.value});dialog.close();});
 const rename=action('Rename',()=>{input.hidden=false;input.focus();input.select();overwrite.hidden=true;select.hidden=true;rename.hidden=true;save.hidden=false;message.textContent='Enter a new, unique build name.';});
 const save=action('Save',()=>{const name=input.value.trim();if(!name)throw new Error('Enter a build name.');if(SavedBuilds.read().some(b=>b.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('That name is already used. Choose a new name.');onSave({...build,name});dialog.close();});save.hidden=true;
 dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus();});document.body.append(dialog);dialog.showModal();
}
