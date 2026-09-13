# League shop icons

These PNGs are unmodified sprite regions from Riot's in-game item shop, extracted from CommunityDragon on 2026-09-14. Riot Games owns the artwork. CommunityDragon provides the extracted game assets; it is not affiliated with Riot Games.

The source rectangles come directly from the `TextureData.mTextureUV` fields in the [item shop UI definition](https://raw.communitydragon.org/latest/game/clientstates/gameplay/ux/itemshop/uibase.cdtb.bin.json). Rectangles use `[left, top, right, bottom]` pixel coordinates. Extraction preserves each sprite's original size and transparency.

| File | Source rectangle |
| --- | --- |
| `gold.png` | `[2, 2, 34, 30]` |
| `all.png` | `[222, 95, 244, 117]` |
| `recommended.png` | `[780, 800, 832, 848]` |
| `fighter.png` | `[869, 29, 893, 55]` |
| `marksman.png` | `[869, 86, 897, 109]` |
| `assassin.png` | `[940, 205, 964, 226]` |
| `mage.png` | `[869, 60, 893, 82]` |
| `tank.png` | `[875, 112, 893, 137]` |
| `support.png` | `[843, 216, 869, 238]` |

The files above use [itemshop_texture_atlas.png](https://raw.communitydragon.org/latest/game/assets/ux/itemshop/itemshop_texture_atlas.png). `reset.png` uses `[71, 511, 135, 575]` from [itemshop_texture_atlas_2.png](https://raw.communitydragon.org/latest/game/assets/ux/itemshop/itemshop_texture_atlas_2.png).

The star is the game's **Popular** icon. Buildsmith reuses it for its existing champion **Recommended** filter, whose entries come from champion recommendation records rather than popularity statistics.

## Data mapping

Use the numeric `mItemAttributes` array in the [existing item BIN payload](https://raw.communitydragon.org/latest/game/items.cdtb.bin.json) for class filters:

| Class | Attribute |
| --- | --- |
| Fighter | `1` |
| Marksman | `2` |
| Assassin | `4` |
| Mage | `16` |
| Tank | `8` |
| Support | `32` |

Items may belong to several classes. Do not infer the class from an icon filename: for example, Eclipse still has `assassin` in its icon path but currently carries the Fighter attribute.

The screenshot's stat groups, in order, are:

1. Attack Damage, Critical Strike, Attack Speed, On-Hit Effects, Armor Penetration.
2. Ability Power, Mana & Regeneration, Magic Penetration.
3. Health & Regeneration, Armor, Magic Resistance.
4. Ability Haste, Movement, Life Steal & Omnivamp.

Names are verified against `stats_filter_*` entries in the [English game string table](https://raw.communitydragon.org/latest/game/en_us/data/menu/en_us/lol.stringtable.json). Health and mana filters include regeneration; movement includes boots and other movement items. The stat symbols themselves reuse the Champion Stats symbols in Buildsmith.
