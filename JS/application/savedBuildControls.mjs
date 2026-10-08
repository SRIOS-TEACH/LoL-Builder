import {captureBuild,restoreBuild} from './buildSnapshot.mjs';
import SavedBuilds from '../shared/savedBuilds.js';
/* Persistence stays independent of API payloads and derived calculation state. */
export async function initSavedBuildControls(page) {
  const BUILDER=page.state;
  const button=document.getElementById('saveBuild'),status=document.getElementById('saveStatus');
  let editingId=null;
  button.disabled=false;
  button.addEventListener('click',()=>{
    try{
      if(!BUILDER.championData)throw new Error('Choose a champion before saving.');
      const build=captureBuild(page,document.body,{id:editingId||undefined},document.getElementById('buildName').value);
      SavedBuilds.save(build);editingId=build.id;status.textContent='Build saved. Ready to compare.';
    }catch(e){status.textContent='Could not save: '+e.message;}
  });
  const id=new URLSearchParams(location.search).get('build');if(!id)return;
  try{
    const build=SavedBuilds.read().find(b=>b.id===id);if(!build)throw new Error('Saved build was not found.');
    await restoreBuild(page,document.body,build);
    document.getElementById('buildName').value=build.name;editingId=id;
    status.textContent=build.version===BUILDER.version?'Saved build loaded.':`Saved on ${build.version}; recalculated with ${BUILDER.version}.`;
  }catch(e){status.textContent=e.message;}
}
