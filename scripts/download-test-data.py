"""Capture a consistent Data Dragon patch for deterministic browser tests."""
import concurrent.futures
import json
import os
from pathlib import Path
import urllib.request

root = Path(os.environ.get('FIXTURES_DIR', Path(__file__).resolve().parents[1] / 'tests' / 'fixtures'))
root.mkdir(parents=True, exist_ok=True)

def get(url, filename):
    target = root / filename
    if target.exists():
        return json.loads(target.read_bytes())
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=45) as response:
        data = response.read()
    result = json.loads(data)
    target.write_bytes(data)
    return result

versions = get('https://ddragon.leagueoflegends.com/api/versions.json', 'versions.json')
version = versions[0]
base = f'https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US'
champions = get(base + '/champion.json', 'champions.json')['data']
jobs = [(base + '/item.json', 'items.json'), (base + '/runesReforged.json', 'runes.json')]
jobs += [(base + f'/champion/{name}.json', name + '.json') for name in champions]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(lambda args: get(*args), jobs))
print(f'Captured {len(champions)} champions and item/rune catalogs for {version} in {root}')

if os.environ.get('ADVANCED_DATA'):
    cd = 'https://raw.communitydragon.org/latest/game'
    get(cd + '/items.cdtb.bin.json', 'cd-items.json')
    get(cd + '/en_us/data/menu/en_us/lol.stringtable.json', 'lol.stringtable.json')
    jobs = [(cd + f'/data/characters/{name.lower()}/{name.lower()}.bin.json', name + '.bin.json') for name in champions]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda args: get(*args), jobs))
    print('Captured advanced calculation data (test fixtures only)')
