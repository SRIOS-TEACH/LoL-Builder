// Repeatable two-route release characterization; fixture data never leaves the local test machine.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.REFACTOR_OUTPUT||path.join(root,'test-results','release-'+Date.now()));
if(fs.existsSync(out))throw Error('Use a new REFACTOR_OUTPUT; prior evidence is never overwritten.');
if(!process.env.PLAYWRIGHT_PATH||!process.env.BROWSER_PATH)throw Error('Set PLAYWRIGHT_PATH and BROWSER_PATH; see docs/TESTING.md.');
fs.mkdirSync(out,{recursive:true});
const fixtureSource=path.resolve(process.env.FIXTURES_DIR||path.join(root,'tests/fixtures'));
const fixtures=path.join(out,'fixtures');fs.mkdirSync(fixtures);
const fixtureFiles=fs.readdirSync(fixtureSource).filter(name=>name.endsWith('.json')).sort();
const fixtureHashes=fixtureFiles.map(name=>{const bytes=fs.readFileSync(path.join(fixtureSource,name));fs.writeFileSync(path.join(fixtures,name),bytes);return {path:name,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
const baselineManifest=JSON.parse(fs.readFileSync(path.join(root,'docs/refactor-baseline/manifest.json')));
for(const row of baselineManifest.fixtureManifest){assert.equal(fixtureHashes.find(item=>item.path===row.path)?.sha256,row.sha256,'Protected fixture changed: '+row.path);}
const {buildSite}=require('./build-site.cjs');buildSite({sourceRoot:root});buildSite({sourceRoot:root,previewOnly:true});
const results=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const {runtimeFiles}=require(path.join(root,'scripts/build-site.cjs'));
const parity=runtimeFiles(root).map(name=>{
 const bytes=fs.readFileSync(path.join(root,name));
 for(const prefix of ['dist/','dist/preview/','preview/']) assert.deepEqual(fs.readFileSync(path.join(root,prefix+name)),bytes,prefix+name);
 return {path:name,sha256:hash(bytes),generatedCopiesMatch:true};
});
function run(id,args,appRoot,options={}) {
 return new Promise(resolve=>{
  const folder=path.join(out,id);fs.mkdirSync(folder,{recursive:true});
  const env={...process.env,APP_ROOT:appRoot,FIXTURES_DIR:fixtures,AUDIT_OUTPUT:path.join(folder,'audit.json')};
  for(const key of ['ADVANCED_DATA','TARGET_SETTINGS','SCREENSHOT_DIR','AUDIT_ITEM_DESCRIPTIONS','CALCULATION_OUTPUT','REUSE_OUTPUT'])delete env[key];
  Object.assign(env,options);
  const log=fs.createWriteStream(path.join(folder,'output.log'));
  const start=Date.now(),child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  child.on('error',error=>log.write(String(error)));
  child.on('close',code=>{
   log.end();const item={id,exitCode:code,seconds:Math.round((Date.now()-start)/100)/10};
   results.push(item);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
   console.log((code===0?'PASS ':'FAIL ')+id+' '+item.seconds+'s');resolve(code);
  });
 });
}
(async()=>{
 await run('unit',['--test','--test-reporter=tap',...fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.cjs')).map(n=>'tests/'+n)],root);
 for(const tree of ['root','preview']){
  const app=path.join(root,'dist',tree==='preview'?'preview':'');
  for(const suite of ['browser','dps-browser','attack-browser'])
   for(const mode of ['fallback','advanced'])await run(tree+'-'+suite+'-'+mode,['tests/'+suite+'.cjs'],app,mode==='advanced'?{ADVANCED_DATA:'1'}:{});
  await run(tree+'-dps-targets',['tests/dps-browser.cjs'],app,{ADVANCED_DATA:'1',TARGET_SETTINGS:'1'});
  for(const suite of ['dashboard-browser','picker-browser','passives-browser','target-browser','combo-browser','combo-effects-browser','champion-effects','ui-reuse-browser','native-entry-browser'])
   await run(tree+'-'+suite,['tests/'+suite+'.cjs'],app,{ADVANCED_DATA:'1'});
  for(const mode of ['advanced','fallback']){
   const id=tree+'-cases-'+mode;await run(id,['scripts/capture-refactor-cases.cjs'],app,mode==='advanced'?{ADVANCED_DATA:'1'}:{});
   assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,id,'audit.json'))).cases,JSON.parse(fs.readFileSync(path.join(root,'docs/refactor-baseline/cases-'+mode+'.json'))).cases,id+' differs from baseline');
  }
 }
 for(const suite of ['combat-audit','calculation-audit','ability-audit'])await run(suite,['tests/'+suite+'.cjs'],root,{ADVANCED_DATA:'1'});
 for(const mode of ['1','melee'])await run('item-descriptions-'+mode,['--test','tests/item-descriptions.test.cjs'],root,{AUDIT_ITEM_DESCRIPTIONS:mode});
 await run('headless',['scripts/verify-calculations.cjs'],root,{CALCULATION_OUTPUT:path.join(out,'headless.json')});
 await run('data-reuse',['scripts/verify-reuse.cjs'],root,{REUSE_OUTPUT:path.join(out,'data-reuse.json')});
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'ability-audit/audit.json'))),JSON.parse(fs.readFileSync(path.join(root,'docs/ability-unavailable.json'))),'Ability audit differs from classified baseline');
 for(const row of parity)assert.equal(hash(fs.readFileSync(path.join(root,row.path))),row.sha256,'Runtime changed during verification: '+row.path);
 for(const row of fixtureHashes){assert.equal(hash(fs.readFileSync(path.join(fixtureSource,row.path))),row.sha256,'Original fixture changed');assert.equal(hash(fs.readFileSync(path.join(fixtures,row.path))),row.sha256,'Copied fixture changed');}
 const unitCount=Number(fs.readFileSync(path.join(out,'unit/output.log'),'utf8').match(/# tests (\d+)/)?.[1]);assert.ok(unitCount>=225);
 const report={unitTests:unitCount,fixtureFiles:fixtureHashes,node:process.version,fixtureVersion:JSON.parse(fs.readFileSync(path.join(fixtures,'versions.json')))[0],date:new Date().toISOString(),runtimeFiles:parity,results,representativeCases:{trees:2,modes:2,casesPerRun:5,exactBaselineMatch:true},passed:results.every(r=>r.exitCode===0)};
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
 if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
