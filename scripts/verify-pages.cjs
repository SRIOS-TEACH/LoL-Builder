// Verify a combined Pages artifact before uploading it.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const [production, refactor, output] = process.argv.slice(2).map(name => path.resolve(name));
if (!production || !refactor || !output) throw new Error('Usage: verify-pages.cjs production refactor-dist output');
// Each checkout owns its release schema and runtime page list.
require(path.join(path.dirname(refactor),'scripts','verify-release.cjs')).verifyRelease({sourceRoot:path.dirname(refactor)});
const tracked = execFileSync('git', ['ls-files', '-z'], {cwd:production}).toString().split('\0').filter(Boolean);
assert.ok(!tracked.some(name => name.startsWith('modular-refactor/')), 'Production already owns the preview path');
for (const name of tracked) assert.deepEqual(fs.readFileSync(path.join(output,name)),fs.readFileSync(path.join(production,name)), 'Production changed: '+name);
// Refactored production no longer tracks preview copies. Check generated routes too.
let productionPreviewCount = 0;
if (fs.existsSync(path.join(production,'scripts/build-site.cjs'))) {
  const generated = path.join(production,'dist','preview');
  assert.ok(fs.existsSync(generated), 'Production preview must be generated before composition');
  function verifyProductionPreview(relative = '') {
    for (const entry of fs.readdirSync(path.join(generated,relative), {withFileTypes:true})) {
      const name = path.join(relative,entry.name);
      if (entry.isDirectory()) verifyProductionPreview(name);
      else {
        assert.deepEqual(fs.readFileSync(path.join(output,'preview',name)),fs.readFileSync(path.join(generated,name)), 'Production preview changed: '+name);
        productionPreviewCount++;
      }
    }
  }
  verifyProductionPreview();
}
let count = 0;
function verifyTree(relative = '') {
  for (const entry of fs.readdirSync(path.join(refactor,relative), {withFileTypes:true})) {
    const name = path.join(relative,entry.name);
    if (entry.isDirectory()) verifyTree(name);
    else {
      assert.deepEqual(fs.readFileSync(path.join(output,'modular-refactor',name)),fs.readFileSync(path.join(refactor,name)), 'Preview changed: '+name);
      count++;
    }
  }
}
verifyTree();
const revision = execFileSync('git',['rev-parse','HEAD'],{cwd:path.dirname(refactor)}).toString().trim();
const mainRevision = execFileSync('git',['rev-parse','HEAD'],{cwd:production}).toString().trim();
fs.writeFileSync(path.join(output,'modular-refactor','deployment.json'),JSON.stringify({branch:'codex/modular-refactor',revision,productionRevision:mainRevision},null,2)+'\n');
console.log('Verified '+tracked.length+' unchanged production files and '+count+' refactor files and '+productionPreviewCount+' generated production preview files.');