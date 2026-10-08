// Run with FIXTURES_DIR pointing to downloaded Data Dragon JSON (see docs/TESTING.md).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.APP_ROOT || path.join(__dirname,'..'));
const fixtures = path.resolve(process.env.FIXTURES_DIR || 'tests/fixtures');
const read = name => fs.readFileSync(path.join(fixtures,name));
const index = JSON.parse(read('champions.json')).data;
const errors=[], requests=[];
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if (!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
 try {res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}
 catch {res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 let failCore=false;
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin===base)return route.fallback();
   requests.push(url.href);
   if(!url.pathname.endsWith('.json')&&process.env.REAL_ART)return route.continue();
   if(!url.pathname.endsWith('.json'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#334155"/></svg>'});
   if(url.hostname==='raw.communitydragon.org' && process.env.ADVANCED_DATA && !failCore) {
     const name=url.pathname.endsWith('/items.cdtb.bin.json')?'cd-items.json':fs.readdirSync(fixtures).find(f=>f.toLowerCase()===path.basename(url.pathname));
     return route.fulfill({contentType:'application/json',body:read(name)});
   }
   if(failCore || url.hostname==='raw.communitydragon.org') return route.fulfill({status:503,body:'Unavailable'});
   let file=url.pathname.endsWith('/versions.json')?'versions.json':url.pathname.endsWith('/champion.json')?'champions.json':url.pathname.endsWith('/item.json')?'items.json':url.pathname.endsWith('/runesReforged.json')?'runes.json':path.basename(url.pathname);
   if(file==='Ahri.json')await new Promise(r=>setTimeout(r,100));
   return route.fulfill({contentType:'application/json',body:read(file)});
 });

 const output=process.env.THEME_SCREENSHOTS||'test-results/site-theme';fs.mkdirSync(output,{recursive:true});
 await page.goto(base+'/Builder.html');await page.waitForFunction(()=>document.querySelectorAll('#itemSlots button').length===7);
 await page.locator('#championPickerBtn').click();await page.locator('#modalChampSearch').fill('Aurora');await page.locator('[data-champ="Aurora"]').click();await page.waitForFunction(()=>document.querySelector('#dashboardChampionName').textContent==='Aurora');
 await page.locator('#builderLevel').selectOption('18');await page.locator('#rank_q').selectOption('5');await page.locator('#rank_e').selectOption('5');await page.locator('#rank_r').selectOption('3');await page.locator('[data-slot="0"]').click();await page.locator('#modalItemSearch').fill('Nashor');await page.locator('#modalItemGrid [data-item-id="3115"]').click();await page.locator('[data-set-item-id="3115"]').click();await page.locator('[aria-label="Add AA no crit"]').click();await page.locator('#buildName').fill('Aurora · Burst');await page.locator('#saveBuild').click();
 await page.evaluate(()=>{const key='lol-buildsmith.builds.v1';const records=JSON.parse(localStorage.getItem(key));localStorage.setItem(key,JSON.stringify([...records,{...records[0],id:'reference-copy',name:'Aurora · Reference'},{...records[0],id:'alternate-copy',name:'Aurora · Alternate'}]));});
 const navStyles=[];
 for(const width of [1440,768,390,1920]){
  await page.setViewportSize({width,height:1000});
  for(const [file,name]of [['main.html','home'],['Builder.html','builder'],['champ.html','champion'],['itemLookup.html','items'],['Comparator.html','comparator']]){
   await page.goto(base+'/'+file);
   if(name==='builder'){await page.waitForFunction(()=>document.querySelectorAll('#itemSlots button').length===7);await page.goto(base+'/'+file+'?build='+await page.evaluate(()=>JSON.parse(localStorage.getItem('lol-buildsmith.builds.v1'))[0].id));await page.waitForFunction(()=>document.querySelector('#dashboardChampionName').textContent==='Aurora');}
   if(name==='champion'){await page.waitForFunction(()=>document.querySelectorAll('#champRoster button').length>0);await page.locator('#champSearch').fill('Aurora');await page.locator('#champRoster [data-champ="Aurora"]').click();await page.waitForFunction(()=>document.querySelector('#champName').textContent==='Aurora'&&!document.querySelector('#champDetails').hidden);}
   if(name==='items'){await page.waitForFunction(()=>document.querySelectorAll('#itemGrid button').length>0);await page.locator('#itemSearch').fill('Nashor');await page.locator('#itemGrid [data-item-id="3115"]').click();await page.evaluate(()=>scrollTo(0,0));}
   if(name==='comparator'){await page.waitForFunction(()=>document.querySelectorAll('.compare-card').length===3);if(width===1440)await page.locator('.compare-card').first().getByRole('button',{name:'Pin left',exact:true}).click();}
   assert.equal(await page.locator('.navbar [aria-current="page"]').count(),1,name+' active navigation');const current=await page.locator('.navbar [aria-current="page"]').boundingBox();assert.ok(current.x>=0&&current.x+current.width<=width,name+' active tab visible');
   const fit=await page.evaluate(()=>({document:document.documentElement.scrollWidth,width:innerWidth,content:document.querySelector('.content-wrapper').scrollWidth,contentWidth:document.querySelector('.content-wrapper').clientWidth}));assert.ok(fit.document<=fit.width&&fit.content<=fit.contentWidth,name+' overflow '+width+': '+JSON.stringify(fit));
   const style=await page.locator('.navbar').evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderBottomColor,getComputedStyle(el.querySelector('.nav-link')).fontFamily,getComputedStyle(el.querySelector('[aria-current]')).color];});if(width===1440)navStyles.push(style);
   if(process.env.REAL_ART){await page.evaluate(async()=>{const sources=[...document.querySelectorAll('body,.home-hero,.champion-hero,.item-explorer-hero,.compare-hero')].flatMap(el=>[...getComputedStyle(el).backgroundImage.matchAll(/url\("?([^"\)]+)"?\)/g)].map(match=>match[1]));await Promise.all(sources.map(src=>new Promise(resolve=>{const img=new Image();img.onload=resolve;img.onerror=resolve;img.src=src;})));});await page.waitForFunction(()=>[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0;}).every(i=>i.complete));await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.ability-icon')].map(img=>img.decode().catch(()=>{})));});}
   await page.screenshot({path:path.join(output,name+'-'+width+'.png'),fullPage:name!=='builder'||width===390});
  }
 }
 for(const style of navStyles)assert.deepEqual(style,navStyles[0]);
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/Builder.html');await page.waitForFunction(()=>document.querySelectorAll('#itemSlots button').length===7);await page.locator('#championPickerBtn').click();await page.screenshot({path:path.join(output,'champion-picker.png')});await page.locator('#closeChampModalBtn').click();
 assert.deepEqual(errors,[]);console.log('PASS coherent theme: all five native pages, matching navigation, one active link, no document/content overflow at 390/768/1440/1920px, real build cards and shared modal styling');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
