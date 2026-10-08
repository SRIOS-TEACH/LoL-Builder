// Root HTML, CSS, JS and assets are the authoritative static application.
const fs = require('node:fs');
const path = require('node:path');

const pages = ['index.html', 'main.html', 'Builder.html', 'champ.html', 'itemLookup.html', 'Comparator.html'];
const directories = ['CSS', 'JS', 'assets'];
function runtimeFiles(sourceRoot) {
  const files = [...pages];
  function walk(relative) {
    for (const entry of fs.readdirSync(path.join(sourceRoot, relative), {withFileTypes:true})) {
      const name = relative + '/' + entry.name;
      if (entry.isSymbolicLink()) throw new Error('Runtime symlinks are not supported: ' + name);
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile() && (!entry.name.endsWith('.md') || name === 'assets/shop/README.md')) files.push(name);
    }
  }
  directories.forEach(walk);
  return files.sort();
}
function buildSite({sourceRoot = path.resolve(__dirname, '..'), previewOnly = false} = {}) {
  sourceRoot = fs.realpathSync(sourceRoot);
  // Output names are fixed; callers cannot supply arbitrary deletion targets.
  const output = path.join(sourceRoot, previewOnly ? 'preview' : 'dist');
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('Refusing symlink output: ' + output);
  const files = runtimeFiles(sourceRoot);
  // Read every source before replacing an output. Missing input leaves old output intact.
  const contents = files.map(name => ({name, bytes:fs.readFileSync(path.join(sourceRoot, name))}));
  fs.rmSync(output, {recursive:true, force:true});
  for (const prefix of previewOnly ? [''] : ['', 'preview/']) {
    for (const {name, bytes} of contents) {
      const destination = path.join(output, prefix + name);
      fs.mkdirSync(path.dirname(destination), {recursive:true});
      fs.writeFileSync(destination, bytes);
    }
  }
  return {output, files};
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--preview') || args.length > 1) throw new Error('Usage: node scripts/build-site.cjs [--preview]');
  const result = buildSite({previewOnly:args.includes('--preview')});
  console.log('Generated ' + result.output + ' from ' + result.files.length + ' authoritative runtime files.');
}
module.exports = {buildSite, runtimeFiles};