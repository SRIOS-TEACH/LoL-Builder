import {captureBuild,restoreBuild} from './buildSnapshot.mjs';
import SavedBuilds from '../shared/savedBuilds.js';
import {pickBuilds,buildNotice} from '../shared/buildPicker.js';
export async function initSavedBuildControls(page) {
 const button=document.getElementById('saveBuild'),status=document.getElementById('saveStatus'),name=document.getElementById('buildName');button.disabled=false;
 const load=async build=>{await restoreBuild(page,document.body,build);name.value=build.name;status.textContent=build.version===page.state.version?'Saved build loaded.':`Saved on ${build.version}; recalculated with ${page.state.version}.`;};
 document.getElementById('loadBuild').onclick=()=>pickBuilds({onSelect:load});
 button.addEventListener('click',()=>{try{
  if(!page.state.championData)throw new Error('Choose a champion before saving.');
  const build=captureBuild(page,document.body,{},name.value);
  const save=()=>{SavedBuilds.save(build);status.textContent='Build saved. Ready to compare.';};
  if(SavedBuilds.read().some(b=>b.name.trim().toLocaleLowerCase()===build.name.toLocaleLowerCase()))buildNotice(`A build named “${build.name}” already exists. Create another build with this name? The existing build will be kept.`,{confirm:true,onConfirm:save});
  else{save();buildNotice(`Build “${build.name}” created.`);}
 }catch(error){status.textContent='Could not save: '+error.message;}});
 const id=new URLSearchParams(location.search).get('build');if(id)try{const build=SavedBuilds.read().find(b=>b.id===id);if(!build)throw new Error('Saved build was not found.');await load(build);}catch(error){status.textContent=error.message;}
}
