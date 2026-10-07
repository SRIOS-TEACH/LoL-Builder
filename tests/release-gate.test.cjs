const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fingerprint,verifyRelease}=require('../scripts/verify-release.cjs');
const root=path.resolve(__dirname,'..');
function evidence(){return {schemaVersion:1,passed:true,checks:{unit:{passed:true,count:225},browser:{passed:true,count:32},baseline:{passed:true,comparisons:20,comparisonComplete:true,unexplainedDifferences:0,exactBaselineMatch:true},headless:{passed:true,cases:10},reuse:{passed:true},recovery:{passed:true},performance:{passed:true},cleanSource:{passed:true}},runtimeFiles:fingerprint(root)};}
test('release gate rejects failed or incomplete evidence, even with matching runtime bytes',()=>{
 const report=evidence();assert.equal(verifyRelease({sourceRoot:root,report}),report);
 report.checks.recovery.passed=false;assert.throws(()=>verifyRelease({sourceRoot:root,report}),/recovery/);
 report.checks.recovery.passed=true;report.checks.browser.count=1;assert.throws(()=>verifyRelease({sourceRoot:root,report}),/browser coverage/);
 report.checks.browser.count=32;report.checks.baseline.unexplainedDifferences=1;assert.throws(()=>verifyRelease({sourceRoot:root,report}),/baseline comparison/);
});
test('release gate tolerates Git text line endings and rejects changed or added runtime files',t=>{
 const source=fs.mkdtempSync(path.join(os.tmpdir(),'lol-release-'));t.after(()=>fs.rmSync(source,{recursive:true,force:true}));
 const report=evidence();for(const {path:name}of report.runtimeFiles){const file=path.join(source,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(root,name),file);}
 const entry=path.join(source,'JS/builder.js'),text=fs.readFileSync(entry,'utf8');fs.writeFileSync(entry,text.replace(/\r?\n/g,'\r\n'));verifyRelease({sourceRoot:source,report});
 fs.appendFileSync(entry,'// unverified change');assert.throws(()=>verifyRelease({sourceRoot:source,report}),/Runtime differs/);
 fs.writeFileSync(entry,text);fs.writeFileSync(path.join(source,'JS/unverified.js'),'export default 1;');assert.throws(()=>verifyRelease({sourceRoot:source,report}),/Runtime differs/);
});
