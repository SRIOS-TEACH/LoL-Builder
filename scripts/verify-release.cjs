// CI verifies that the deployed runtime is the exact locally characterized release.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {runtimeFiles}=require('./build-site.cjs');
function fingerprint(sourceRoot){
 return runtimeFiles(sourceRoot).map(name=>{
  let bytes=fs.readFileSync(path.join(sourceRoot,name));
  if(/\.(?:html|css|m?js|json|md|svg)$/.test(name))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
  return {path:name,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 });
}
function verifyRelease({sourceRoot=path.resolve(__dirname,'..'),report}={}){
 const evidenceFile=fs.existsSync(path.join(sourceRoot,'docs/release.json'))?'docs/release.json':'docs/phase6-release.json';
 report ||= JSON.parse(fs.readFileSync(path.join(sourceRoot,evidenceFile),'utf8'));
 assert.equal(report.schemaVersion,1,'Unsupported release evidence schema');
 assert.equal(report.passed,true,'Release verification did not pass');
 for(const name of ['unit','browser','baseline','headless','reuse','recovery','performance','cleanSource'])assert.equal(report.checks[name]?.passed,true,'Missing or failed release check: '+name);
 assert.ok(report.checks.unit.count>=225,'Incomplete unit coverage');
 assert.ok(report.checks.browser.count>=32,'Incomplete two-route browser coverage');
 assert.ok(report.checks.baseline.comparisons>=20 && report.checks.baseline.comparisonComplete===true && report.checks.baseline.unexplainedDifferences===0,'Incomplete baseline comparison');
 assert.ok(report.checks.headless.cases>=10,'Incomplete headless comparison');
 assert.deepEqual(fingerprint(sourceRoot),report.runtimeFiles,'Runtime differs from the verified release. Run the documented release checks and record new evidence before deployment.');
 return report;
}
if(require.main===module){const report=verifyRelease();console.log('PASS verified release fingerprint: '+report.runtimeFiles.length+' runtime files; local browser/recovery evidence present.');}
module.exports={fingerprint,verifyRelease};
