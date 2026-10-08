import {createBuilderPage} from './application/builderPage.mjs';
const root=document.body;
const elements=Object.fromEntries([...root.querySelectorAll('[id]')].map(node=>[node.id,node]));
elements.attackSettingsHint=root.querySelector('.attack-settings-hint');
export const builderPage=createBuilderPage({root,elements});
await builderPage.start();

const {initSavedBuildControls}=await import('./application/savedBuildControls.mjs');
if(builderPage.state.uiReady)await initSavedBuildControls(builderPage);
