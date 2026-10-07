// Conservative text inventory: reference candidates, never a dead-code proof.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.env.APP_ROOT||path.join(__dirname,'..'));
const output=path.resolve(process.env.INVENTORY_OUTPUT||path.join(__dirname,'../docs/refactor-baseline/inventory.json'));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const relative=file=>path.relative(root,file).replaceAll('\\','/');
const unique=values=>[...new Set(values)].sort();
const captures=(text,re)=>[...text.matchAll(re)].map(m=>m[1]);
const modules=walk(path.join(root,'JS')).filter(f=>f.endsWith('.js')).sort().map(file=>{
  const text=fs.readFileSync(file,'utf8'),lines=text.split(/\r?\n/);
  return {path:relative(file),lines:lines.length,
    namedFunctions:lines.flatMap((line,i)=>captures(line,/\bfunction\s+([\w$]+)\s*\(/g).map(name=>({name,line:i+1}))),
    globalApiCandidates:unique(captures(text,/\b(?:window|scope|globalScope)\.([A-Z]\w*)/g)),
    globalExports:unique(captures(text,/\b(?:window|scope|globalScope)\.([A-Z]\w*)\s*=/g)),
    builderFields:unique(captures(text,/\bBUILDER\.([\w]+)/g)),
    domIds:unique(captures(text,/getElementById\(['"]([^'"]+)['"]\)/g)),
    dataAttributes:unique(captures(text,/\b(data-[a-z][a-z0-9-]*)/g)),
    eventTypes:unique(captures(text,/addEventListener\(['"]([^'"]+)['"]/g)),
    dynamicClassAndAssetLines:lines.flatMap((line,i)=>/classList|className|class=|\.src\s*=|url\(|\/cdn\/|\.style\./.test(line)?[{line:i+1,text:line.trim()}]:[]),
    domReadySideEffect:/addEventListener\(['"]DOMContentLoaded/.test(text),
  };
});
const pages=['index.html','main.html','Builder.html','champ.html','itemLookup.html'].map(name=>{
  const text=fs.readFileSync(path.join(root,name),'utf8');
  return {path:name,scripts:captures(text,/<script[^>]+src=['"]([^'"]+)/g),styles:captures(text,/<link[^>]+href=['"]([^'"]+)/g),
    links:unique(captures(text,/<a[^>]+href=['"]([^'"]+)/g)),ids:unique(captures(text,/\bid=['"]([^'"]+)/g)),
    literalClasses:unique(captures(text,/\bclass=['"]([^'"]+)/g).flatMap(s=>s.split(/\s+/)))};
});
const css=walk(path.join(root,'CSS')).filter(f=>f.endsWith('.css')).map(file=>({path:relative(file),
  ruleCandidates:fs.readFileSync(file,'utf8').split(/\r?\n/).flatMap((line,i)=>line.includes('{')?[{line:i+1,text:line.trim()}]:[])}));
const report={method:'Text-pattern inventory of root runtime only. Includes export/self-references and misses computed/aliased accesses; not a complete call graph or safe-deletion list. Preview parity is recorded separately.',modules,pages,css};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(`Inventoried ${modules.length} JavaScript modules, ${pages.length} root pages and ${css.length} stylesheets.`);
