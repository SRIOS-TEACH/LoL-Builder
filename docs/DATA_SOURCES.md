# External Data Sources

## Data Dragon (Riot)
- Version index: `https://ddragon.leagueoflegends.com/api/versions.json`
- Champion index: `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json`
- Champion details: `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion/{champion}.json`
- Item index: `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/item.json`
- Item/champion/perk image assets under `https://ddragon.leagueoflegends.com/cdn/`

## Community Dragon
- Item calculations: `https://raw.communitydragon.org/latest/game/items.cdtb.bin.json`
- Champion runtime ability data:
  `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/en_us/v1/champions/{championId}.json`

## Usage notes
- Data Dragon provides stable baseline game data and display metadata.
- Community Dragon augments tooltip/stat formulas where Data Dragon text includes unresolved placeholders.
