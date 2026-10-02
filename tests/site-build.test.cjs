const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {buildSite, runtimeFiles} = require('../scripts/build-site.cjs');
const root = path.resolve(__dirname, '..');

test('site artifact preserves every runtime byte and local page route, excluding development files', t => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'lol-site-'));
  t.after(() => fs.rmSync(source, {recursive:true, force:true}));
  const files = runtimeFiles(root);
  for (const name of files) {
    fs.mkdirSync(path.dirname(path.join(source,name)), {recursive:true});
    fs.copyFileSync(path.join(root,name), path.join(source,name));
  }
  fs.mkdirSync(path.join(source,'docs'));
  fs.writeFileSync(path.join(source,'docs','private.md'), 'not runtime');
  const result = buildSite({sourceRoot:source});
  for (const prefix of ['', 'preview/']) {
    for (const name of files) assert.deepEqual(fs.readFileSync(path.join(result.output,prefix+name)), fs.readFileSync(path.join(source,name)), prefix+name);
    for (const page of files.filter(name => name.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(result.output,prefix+page),'utf8');
      for (const [,url] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        if (/^(?:[a-z]+:|\/\/|#)/i.test(url)) continue;
        assert.ok(fs.existsSync(path.resolve(result.output,prefix,path.dirname(page),url.split(/[?#]/)[0])), prefix+page+' -> '+url);
      }
    }
  }
  assert.equal(fs.existsSync(path.join(result.output,'docs')),false);
  assert.equal(fs.existsSync(path.join(result.output,'tests')),false);
  fs.writeFileSync(path.join(result.output,'stale.js'),'stale');
  buildSite({sourceRoot:source});
  assert.equal(fs.existsSync(path.join(result.output,'stale.js')),false);
  buildSite({sourceRoot:source,previewOnly:true});
  for (const name of files) assert.deepEqual(fs.readFileSync(path.join(source,'preview',name)),fs.readFileSync(path.join(source,name)));
});

test('build refuses output symlinks and preserves existing output when a source page is missing', t => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'lol-site-'));
  t.after(() => fs.rmSync(source, {recursive:true,force:true}));
  for (const dir of ['CSS','JS','assets','dist']) fs.mkdirSync(path.join(source,dir));
  fs.writeFileSync(path.join(source,'dist','keep.txt'),'keep');
  assert.throws(() => buildSite({sourceRoot:source}), /ENOENT/);
  assert.equal(fs.readFileSync(path.join(source,'dist','keep.txt'),'utf8'),'keep');
  for (const name of ['index.html','main.html','Builder.html','champ.html','itemLookup.html']) fs.writeFileSync(path.join(source,name),'');
  const linkRoot = fs.mkdtempSync(path.join(os.tmpdir(),'lol-link-'));
  t.after(() => fs.rmSync(linkRoot,{recursive:true,force:true}));
  fs.symlinkSync(linkRoot,path.join(source,'preview'),process.platform==='win32'?'junction':'dir');
  assert.throws(() => buildSite({sourceRoot:source,previewOnly:true}), /symlink/);
  assert.equal(fs.existsSync(linkRoot),true);
});