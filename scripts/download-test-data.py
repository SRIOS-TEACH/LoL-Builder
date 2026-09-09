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
    with urllib.request.urlopen(url, timeout=45) as response:
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
