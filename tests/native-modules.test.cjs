const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {runtimeFiles}=require('../scripts/build-site.cjs');
const root=path.resolve(process.env.APP_ROOT||path.join(__dirname,'..'));
test('native entry and every static import resolve from the runtime artifact without legacy global registration',()=>{
 const html=fs.readFileSync(path.join(root,'Builder.html'),'utf8');
 assert.deepEqual([...html.matchAll(/<script[^>]*src="(JS\/[^" ]+)"[^>]*>/g)].map(row=>row[1]),['JS/builder.js']);
 assert.match(html,/<script type="module" src="JS\/builder.js"/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'JS/package.json'),'utf8')).type,'module');
 const graph=new Map();
 for(const file of runtimeFiles(root).filter(name=>/\.m?js$/.test(name))){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  graph.set(file,[]);
  assert.doesNotMatch(source,/module\.exports|\brequire\(|(?:window|globalThis)\.[A-Z]\w*\s*=/,file);
  for(const [,relative]of source.matchAll(/(?:import|export)[^;\n]*?from\s*['"]([^'"]+)['"]/g)){
   assert.ok(relative.startsWith('.'),file+' uses only relative browser imports');
   assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),relative)),file+' -> '+relative);
   graph.get(file).push(path.relative(root,path.resolve(root,path.dirname(file),relative)).split(path.sep).join('/'));
  }
 }
 const visited=new Set();
 function visit(file,ancestors=[]){assert.ok(!ancestors.includes(file),'Circular runtime imports: '+[...ancestors,file].join(' -> '));if(visited.has(file))return;for(const dependency of graph.get(file)||[])visit(dependency,[...ancestors,file]);visited.add(file);}
 for(const file of graph.keys())visit(file);
 for(const name of ['champLookup.js','itemLookup.js','comboUI.js'])assert.equal(fs.existsSync(path.join(root,'JS',name)),false,name+' is retired');
});
test('two native page controllers own separate input records and dispose independently without browser globals',()=>{
 const {createBuilderPage}=require(path.join(root,'JS/application/builderPage.mjs'));
 const a=createBuilderPage(),b=createBuilderPage();
 a.state.level=18;a.state.itemSlots[0]='1036';a.state.runeStacks.darkHarvest=9;a.state.target.currentHp=500;
 assert.equal(b.state.level,1);assert.equal(b.state.itemSlots[0],'');assert.equal(b.state.runeStacks.darkHarvest,undefined);assert.notEqual(b.state.target.currentHp,500);
 a.dispose();a.dispose();assert.notEqual(a.state.championRequestId,b.state.championRequestId);
 for(const name of ['BUILDER','ComboUI','CalculationPipeline','BuildStats','SourceRepositories'])assert.equal(globalThis[name],undefined,name+' remains private');
 b.dispose();
});
