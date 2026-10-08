import {createBuilderPage} from './builderPage.mjs';
import {captureBuild,restoreBuild} from './buildSnapshot.mjs';
let template;
async function markup(){
 if(!template)template=fetch('Builder.html').then(response=>{if(!response.ok)throw new Error('Could not load build editor.');return response.text();}).catch(error=>{template=null;throw error;});
 const parsed=new DOMParser().parseFromString(await template,'text/html');
 parsed.querySelectorAll('script,nav,.save-build-controls,#saveStatus').forEach(el=>el.remove());
 return parsed.body.innerHTML;
}
/** A temporary, isolated editor; only Apply commits its draft. */
export async function createBuildDraft(host,build){
 host.classList.add('compact-dashboard','comparison-editor');host.innerHTML=await markup();
 const elements=Object.fromEntries([...host.querySelectorAll('[id]')].map(el=>[el.id,el]));
 elements.attackSettingsHint=host.querySelector('.attack-settings-hint');
 const page=createBuilderPage({root:host,elements});
 try{await page.start();if(!page.state.uiReady)throw new Error('Could not load build data. Check your connection and retry.');await restoreBuild(page,host,build);}
 catch(error){page.dispose();host.replaceChildren();throw error;}
 return {page,capture:()=>captureBuild(page,host,build,build.name),dispose(){page.dispose();host.replaceChildren();},focus(mode,slot){
  host.dataset.mode=mode;
  if(mode==='items')page.inspect.openItemModal(slot);
  if(mode==='target')elements.targetSettingsBtn.click();
  if(mode==='abilities')host.querySelector('#rank_'+slot)?.focus();
 }};
}
