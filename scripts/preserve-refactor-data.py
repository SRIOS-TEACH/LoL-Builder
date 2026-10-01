"""Preserve ignored baseline data and restore verified fixtures without overwriting files."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('action', choices=['pack', 'verify', 'restore-fixtures'])
parser.add_argument('archive', type=Path)
parser.add_argument('--root', type=Path)
args = parser.parse_args()
archive = args.archive.resolve()

if args.action == 'pack':
    if args.root is None:
        parser.error('pack requires --root')
    root = args.root.resolve()
    if archive.is_relative_to(root):
        parser.error('Store this independent archive outside the repository')
    if archive.exists():
        raise FileExistsError(archive)
    archive.parent.mkdir(parents=True, exist_ok=True)
    entries = []
    sources = [root / 'tests/fixtures', root / 'test-results/refactor-baseline-2026-09-30']
    for source in sources:
        if not source.is_dir():
            raise FileNotFoundError(source)
    with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        for source in sources:
            for file in sorted(source.rglob('*')):
                if not file.is_file():
                    continue
                if file.is_symlink() or not file.resolve().is_relative_to(root):
                    raise ValueError(f'Unexpected external/symlink source: {file}')
                data = file.read_bytes()
                name = file.relative_to(root).as_posix()
                entries.append({'path': name, 'bytes': len(data), 'sha256': digest(data)})
                output.writestr(name, data)
        output.writestr('PRESERVATION-MANIFEST.json', json.dumps(entries, indent=2) + '\n')

with zipfile.ZipFile(archive) as saved:
    entries = json.loads(saved.read('PRESERVATION-MANIFEST.json'))
    assert len({entry['path'] for entry in entries}) == len(entries), 'Duplicate manifest paths'
    assert set(saved.namelist()) == {entry['path'] for entry in entries} | {'PRESERVATION-MANIFEST.json'}, 'Archive content differs from manifest'
    for entry in entries:
        data = saved.read(entry['path'])
        assert len(data) == entry['bytes'] and digest(data) == entry['sha256'], entry['path']
    restored = 0
    if args.action == 'restore-fixtures':
        if args.root is None:
            parser.error('restore-fixtures requires --root')
        target = args.root.resolve() / 'tests/fixtures'
        selected = [entry for entry in entries if entry['path'].startswith('tests/fixtures/')]
        # Preflight every path before writing; never replace existing files.
        destinations = [(entry, (args.root.resolve() / entry['path']).resolve()) for entry in selected]
        for entry, destination in destinations:
            if not destination.is_relative_to(target) or destination.exists():
                raise ValueError(f'Unsafe or existing destination: {destination}')
        for entry, destination in destinations:
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('xb') as output:
                output.write(saved.read(entry['path']))
            assert digest(destination.read_bytes()) == entry['sha256'], entry['path']
            restored += 1

print(json.dumps({'archive': str(archive), 'archive_sha256': digest(archive.read_bytes()),
                  'files_verified': len(entries), 'uncompressed_bytes': sum(e['bytes'] for e in entries),
                  'fixture_files_restored': restored}, indent=2))
