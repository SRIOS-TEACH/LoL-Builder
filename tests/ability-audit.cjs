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
 try {res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}
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
   if(url.origin===base)return route.continue();
   requests.push(url.href);
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
 await page.goto(base+'/Builder.html');
 await page.waitForFunction(()=>document.querySelectorAll('#itemSlots button').length===6);

 const rows=[];
 await page.evaluate(()=>{
   const original=resolveAbilityToken;
   window.abilityAuditRows=[];window.abilityAuditContext=null;
   resolveAbilityToken=function(token,ctx){
     const result=original(token,ctx);
     if(window.abilityAuditContext&&(!result||/value unavailable/i.test(result.html)))window.abilityAuditRows.push({...window.abilityAuditContext,token,reason:result?'Unsupported calculation part/reference':'No matching live value or formula'});
     return result;
   };
 });
 for(const champion of Object.keys(index)){
   const captured=await page.evaluate(async champion=>{
     await setChampion(champion);window.abilityAuditRows=[];
     for(const level of [1,6,11,18]){
       BUILDER.level=level;
       for(const [i,spell]of BUILDER.championData.spells.entries()){
         const slot=['q','w','e','r'][i];
         for(let rank=1;rank<=abilityMaxByLevel(level,slot);rank++){
           BUILDER.abilityRanks[slot]=rank;
           window.abilityAuditContext={champion,slot:slot.toUpperCase(),ability:spell.name,level,rank};
           buildDetailedAbilityText(spell,rank,slot);
         }
       }
       window.abilityAuditContext={champion,slot:'P',ability:BUILDER.championData.passive.name,level,rank:1};buildDetailedPassiveText();
     }
     window.abilityAuditContext=null;return window.abilityAuditRows;
   },champion);rows.push(...captured);
 }
 const unique=new Map();
 for(const row of rows){const key=[row.champion,row.slot,row.token,row.reason].join('|');if(!unique.has(key))unique.set(key,{...row,levels:[],ranks:[]});const r=unique.get(key);if(!r.levels.includes(row.level))r.levels.push(row.level);if(!r.ranks.includes(row.rank))r.ranks.push(row.rank);delete r.level;delete r.rank;}
 const report={champions:Object.keys(index).length,affectedChampions:new Set(rows.map(r=>r.champion)).size,affectedAbilities:new Set(rows.map(r=>r.champion+':'+r.slot)).size,unavailable:[...unique.values()]};
 const output=process.env.AUDIT_OUTPUT||path.join(root,'docs/ability-unavailable.json');fs.writeFileSync(output,JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,unavailable:undefined},null,2));
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
