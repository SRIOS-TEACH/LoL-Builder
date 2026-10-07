const {installBrowserHarness}=require('../tests/helpers/native-runtime.cjs');
// Characterization evidence, not independently verified game-correctness expectations.
const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(process.env.APP_ROOT||path.join(__dirname,'..'));
const fixtures=path.resolve(process.env.FIXTURES_DIR||path.join(root,'tests/fixtures'));
const advanced=process.env.ADVANCED_DATA==='1';
const output=process.env.AUDIT_OUTPUT;
if(!output)throw Error('Set AUDIT_OUTPUT to a new output JSON file.');
if(fs.existsSync(output))throw Error('Refusing to overwrite baseline evidence.');
const names=new Map(fs.readdirSync(fixtures).map(n=>[n.toLowerCase(),n]));
const read=name=>fs.readFileSync(path.join(fixtures,name));
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}
  catch{res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    await installBrowserHarness(page,root);
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin===base)return route.fallback();
      if(!url.pathname.endsWith('.json'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>'});
      if(url.hostname==='raw.communitydragon.org'&&!advanced)return route.fulfill({status:503,body:'Unavailable'});
      const file=url.pathname.endsWith('/versions.json')?'versions.json':url.pathname.endsWith('/champion.json')?'champions.json':url.pathname.endsWith('/item.json')?'items.json':url.pathname.endsWith('/runesReforged.json')?'runes.json':url.pathname.endsWith('/items.cdtb.bin.json')?'cd-items.json':names.get(path.basename(url.pathname).toLowerCase());
      if(!file){errors.push('Missing fixture: '+url.pathname);return route.fulfill({status:404,body:'Missing fixture'});}
      return route.fulfill({contentType:'application/json',body:read(file)});
    });
    await page.goto(base+'/Builder.html');
    await page.waitForFunction(()=>typeof BUILDER!=='undefined'&&BUILDER.uiReady);
    await page.evaluate(()=>BUILDER.enrichmentReady);
    const scenarios=[
      {id:'ashe-basic',champion:'Ashe',items:[],target:false,sequence:['aa','q','w']},
      {id:'ezreal-items',champion:'Ezreal',items:['3078','3042'],target:true,sequence:['q','aa','w']},
      {id:'veigar-health-sequence',champion:'Veigar',items:['3089','4645'],target:true,sequence:['q','r']},
      {id:'aatrox-recasts',champion:'Aatrox',items:[],target:true,sequence:['q','q:1','q:2']},
      {id:'aurora-magic',champion:'Aurora',items:['6655','6653'],target:true,sequence:['q','r']},
    ];
    const cases=[];
    for(const scenario of scenarios){
      await page.evaluate(async s=>{
        await setChampion(s.champion); await ensureGameText();
        BUILDER.level=18;BUILDER.abilityRanks={q:5,w:5,e:5,r:3};
        BUILDER.itemSlots=[...s.items,...Array(7-s.items.length).fill('')];
        BUILDER.combatValues={};BUILDER.disabledItemPassives={};BUILDER.runeStacks={};BUILDER.gameTimeMinutes=20;
        BUILDER.runeSelections={primaryPath:'precision',secondaryPath:'sorcery',primary:[],secondary:[],shards:[]};
        BUILDER.target={enabled:s.target,maxHp:2000,currentHp:2000,armor:100,mr:100,damageReduction:0};
        renderItemSlots();renderStats();renderAbilityCards();
      },scenario);
      const record=await page.evaluate(id=>{
        const computed=computeDerivedBuildStats(),attack=computeAutoAttackProfile(computed);
        const abilities=BUILDER.championData.spells.map((spell,i)=>{
          const slot=['q','w','e','r'][i],rank=BUILDER.abilityRanks[slot],ctx=buildAbilityContext(spell,rank,slot);
          return {slot,spellId:spell.id,rank,result:AbilityDps.profile({spell,rank,slot,champion:BUILDER.selectedChampion,
            cooldown:AbilityDps.cooldown(spell,rank,ctx.stats,ctx.cdragonSpell),tooltip:expandAbilityLocalization(spell.tooltip||spell.description||''),
            resolve:token=>resolveAbilityToken(token,ctx),payload:ctx.cdragonSpell,target:BUILDER.target,stats:ctx.stats,
            timing:{delay:BUILDER.combatValues[`dps:${slot}:delay`],overlap:BUILDER.combatValues[`dps:${slot}:overlap`]}})};
        });
        return {id,inputs:{champion:BUILDER.selectedChampion,level:BUILDER.level,ranks:BUILDER.abilityRanks,items:BUILDER.itemSlots,runes:BUILDER.runeSelections,
          target:BUILDER.target,combatValues:BUILDER.combatValues,runeStacks:BUILDER.runeStacks,gameTimeMinutes:BUILDER.gameTimeMinutes,disabledItemPassives:BUILDER.disabledItemPassives},
          stats:computed,attack,abilities,status:document.getElementById('builderStatus').textContent};
      },scenario.id);
      if(await page.locator('#comboClear').isEnabled())await page.locator('#comboClear').click();
      record.requestedSequence=scenario.sequence;record.unavailableSequenceActions=[];
      for(const key of scenario.sequence){
        if(key.includes(':')){
          await page.locator('[data-open-custom]').click();
          const picker=page.locator(`#comboActionList [data-action-id="${key}"]`);
          if(await picker.count()&&await picker.isEnabled())await picker.click();
          else {record.unavailableSequenceActions.push(key);await page.keyboard.press('Escape');}
        }else{
          const action=page.locator(`#comboQuick [data-add^="${key}:"]`).first();
          if(await action.count()&&await action.isEnabled())await action.click();else record.unavailableSequenceActions.push(key);
        }
      }
      record.comboDisplay=await page.locator('#comboResult').innerText();
      record.comboSteps=await page.locator('#comboSteps').innerText();
      record.targetAfter=await page.evaluate(()=>BUILDER.target);
      assert.deepEqual(record.targetAfter,record.inputs.target,'Combo display must restore the global target');
      cases.push(record);
    }
    assert.deepEqual(errors,[]);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify({kind:'captured-current-behavior',advanced,sourceRoot:root,cases},null,2)+'\n');
    console.log(`Captured ${cases.length} scenarios (${advanced?'advanced':'fallback'}), including explicit inputs, numerical results, diagnostics and combo display.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
