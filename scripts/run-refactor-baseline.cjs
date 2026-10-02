// Capture an unchanged checkout and run its existing tests for the refactor baseline.
// Requires Node 20+, PLAYWRIGHT_PATH and BROWSER_PATH (see docs/REFACTOR-BASELINE.md).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync, spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.BASELINE_OUTPUT || path.join(root, 'test-results', 'refactor-baseline-' + new Date().toISOString().replace(/[:.]/g, '-')));
const fixtureSource = path.resolve(process.env.FIXTURES_DIR || path.join(root, 'tests/fixtures'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8'}).trim();
if (fs.existsSync(output)) throw new Error('Use a new BASELINE_OUTPUT directory; existing evidence is never overwritten.');
if (!process.env.PLAYWRIGHT_PATH || !process.env.BROWSER_PATH) throw new Error('Set PLAYWRIGHT_PATH and BROWSER_PATH explicitly.');
fs.mkdirSync(output, {recursive:true});
const snapshot = path.join(output, 'snapshot');
const sourceFiles = git('ls-files', '-z').split('\0').filter(Boolean);
for (const name of ['docs/ROADMAP.md', 'docs/REFACTOR-PLAN.md', 'scripts/run-refactor-baseline.cjs']) {
  if (fs.existsSync(path.join(root,name)) && !sourceFiles.includes(name)) sourceFiles.push(name);
}
const sourceManifest = sourceFiles.sort().map(name => {
  const file = path.join(root,name), dest = path.join(snapshot,name);
  fs.mkdirSync(path.dirname(dest), {recursive:true}); fs.copyFileSync(file,dest);
  return {path:name, bytes:fs.statSync(file).size, sha256:hash(file)};
});
const {buildSite, runtimeFiles} = require(path.join(snapshot, 'scripts/build-site.cjs'));
buildSite({sourceRoot:snapshot, previewOnly:true});
const fixtureManifest = fs.readdirSync(fixtureSource).filter(name=>name.endsWith('.json')).sort().map(name => {
  const file = path.join(fixtureSource,name);
  return {path:name, bytes:fs.statSync(file).size, sha256:hash(file)};
});
const fixtureRoots = {};
for (const tree of ['root','preview']) {
  fixtureRoots[tree] = path.join(output, 'fixtures-'+tree);
  fs.mkdirSync(fixtureRoots[tree]);
  for (const item of fixtureManifest) fs.copyFileSync(path.join(fixtureSource,item.path),path.join(fixtureRoots[tree],item.path));
}
const versions = JSON.parse(fs.readFileSync(path.join(fixtureSource,'versions.json')));
const champions = JSON.parse(fs.readFileSync(path.join(fixtureSource,'champions.json')));
const parity = runtimeFiles(snapshot).map(name=>({
  path:'preview/'+name, matches:hash(path.join(snapshot,'preview',name))===hash(path.join(snapshot,name))
}));
const metadata = {
  startedAt:new Date().toISOString(), sourceRoot:root, snapshot, output,
  commit:git('rev-parse','HEAD'), branch:git('branch','--show-current'), initialStatus:git('status','--short'),
  node:process.version, nodeExecutable:process.execPath, platform:process.platform, arch:process.arch,
  playwright:require(path.join(process.env.PLAYWRIGHT_PATH,'package.json')).version,
  playwrightPath:process.env.PLAYWRIGHT_PATH, browserPath:process.env.BROWSER_PATH, browserSha256:hash(process.env.BROWSER_PATH),
  dataDragonVersion:versions[0], championIndexVersion:champions.version, championCount:Object.keys(champions.data).length,
  fixtureFiles:fixtureManifest.length, fixtureBytes:fixtureManifest.reduce((n,f)=>n+f.bytes,0),
  communityDragonProvenance:'Existing local captures from latest URLs; original capture timestamps and immutable source revision not recorded. Checksums identify the exact bytes used.',
  parity, sourceManifest, fixtureManifest,
};
write('manifest.json',metadata);
const results=[];
function run(id, args, tree='root', options={}) {
  return new Promise(resolve=>{
    const runDir=path.join(output,'runs',id); fs.mkdirSync(runDir,{recursive:true});
    const env={...process.env,APP_ROOT:tree==='preview'?path.join(snapshot,'preview'):snapshot,FIXTURES_DIR:fixtureRoots[tree],AUDIT_OUTPUT:path.join(runDir,'audit.json'),SCREENSHOT_DIR:runDir};
    for (const key of ['ADVANCED_DATA','TARGET_SETTINGS','AUDIT_ITEM_DESCRIPTIONS']) delete env[key];
    Object.assign(env,options);
    const startedAt=new Date().toISOString(), start=Date.now();
    const log=fs.createWriteStream(path.join(runDir,'output.log'));
    const child=spawn(process.execPath,args,{cwd:snapshot,env,windowsHide:true});
    child.stdout.pipe(log,{end:false}); child.stderr.pipe(log,{end:false});
    child.on('error',error=>log.write(String(error)+'\n'));
    child.on('close',(code,signal)=>{
      log.end();
      const result={id,tree,args,options,startedAt,seconds:Number(((Date.now()-start)/1000).toFixed(2)),exitCode:code,signal,status:code===0?'passed':'failed',log:path.relative(output,path.join(runDir,'output.log')).replaceAll('\\','/')};
      results.push(result); write('results.json',results);
      console.log(`${result.status.toUpperCase()} ${id} (${result.seconds}s)`); resolve(result);
    });
  });
}
async function main() {
  const {chromium}=require(process.env.PLAYWRIGHT_PATH);
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH});
  metadata.browserVersion=browser.version(); await browser.close(); write('manifest.json',metadata);
  await run('unit',['--test',...fs.readdirSync(path.join(snapshot,'tests')).filter(n=>n.endsWith('.test.cjs')).map(n=>'tests/'+n)]);
  // Each tree has isolated fixtures/screenshots; test servers allocate their own ports.
  await Promise.all(['root','preview'].map(async tree=>{
    for(const suite of ['browser','dps-browser','attack-browser']) {
      for(const mode of ['fallback','advanced']) await run(`${tree}-${suite}-${mode}`,['tests/'+suite+'.cjs'],tree,mode==='advanced'?{ADVANCED_DATA:'1'}:{});
    }
    await run(`${tree}-dps-targets`,['tests/dps-browser.cjs'],tree,{ADVANCED_DATA:'1',TARGET_SETTINGS:'1'});
    for(const suite of ['dashboard-browser','picker-browser','passives-browser','target-browser','combo-browser','combo-effects-browser','champion-effects']) {
      await run(`${tree}-${suite}`,['tests/'+suite+'.cjs'],tree,{ADVANCED_DATA:'1'});
    }
  }));
  for(const suite of ['combat-audit','calculation-audit','ability-audit']) await run(suite,['tests/'+suite+'.cjs'],'root',{ADVANCED_DATA:'1'});
  for(const mode of ['1','melee']) await run('item-descriptions-'+mode,['--test','tests/item-descriptions.test.cjs'],'root',{AUDIT_ITEM_DESCRIPTIONS:mode});
  const changedSource=sourceManifest.filter(item=>!fs.existsSync(path.join(root,item.path))||hash(path.join(root,item.path))!==item.sha256).map(item=>item.path);
  const changedFixtures=fixtureManifest.filter(item=>hash(path.join(fixtureSource,item.path))!==item.sha256).map(item=>item.path);
  write('integrity.json',{finishedAt:new Date().toISOString(),changedSource,changedFixtures,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length});
  console.log('Evidence: '+output);
  process.exitCode=results.some(r=>r.status==='failed')||changedSource.length||changedFixtures.length?1:0;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
