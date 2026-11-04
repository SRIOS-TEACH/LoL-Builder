# Combat mechanics audit

## Calculation rules

An enabled single-hit attack effect adds its full damage to the displayed proc attack. Its sustained contribution is `proc damage × min(attacks/second, 1 / adjusted cooldown)`. This means Attack × attack speed need not equal DPS. Spellblade uses its own cooldown; legacy interval overrides no longer control it. Duration stims such as Wuju Style remain active for this comparison. Actual combat uptime, cooldown refunds, travel time and automatic combo proc triggers are not simulated.

Stack counters start at zero. Selecting a dragon enables its controls; enter its stack count to apply the bonuses. A multi-hit combo action defaults to its maximum hits, retaining unequal first/subsequent hits and physical/magic/true packets. A burn defaults to its full duration. A manual damage override takes precedence over hit/duration scaling.

Form switches affect subsequent combo actions and attacks, including when Target is off. Form abilities have independent cooldown groups. An ability from the wrong form is flagged and contributes zero. Gnar rage availability must be supplied by the player; the form-switch action does not generate rage. Shyvana's R enters Dragon Form; her explicit switch action also allows returning to Human Form.

## Focused regression coverage

| Mechanic | Champions / abilities checked |
| --- | --- |
| Evolution damage | Kai'Sa Q: 6/12 missiles and reduced repeat hits; Kha'Zix Q: isolated cooldown refund; Viktor E: laser/aftershock; Syndra W: magic plus evolved true damage |
| Evolution controls | Kha'Zix Q/W/E/R; Kai'Sa Q/W/E; Viktor Q/W/E/R; Syndra Q/W/E/R. Utility upgrades retain the game's description; they do not invent additional damage. Kai'Sa W cooldown assumes a successful champion hit. |
| Alternate kits and combo switching | Nidalee Human/Cougar Q/W/E; Jayce Hammer/Cannon Q/W/E; Elise Human/Spider Q/W/E; Gnar Mini/Mega Q/W/E; Rek'Sai Unburrowed/Burrowed Q/W/E; Shyvana Human/Dragon Q/W/E |
| Hit selection | Kai'Sa Q, Ahri Q/W, Syndra R, Miss Fortune R, Katarina R, Lucian R, Kennen R, Vel'Koz W, Taliyah Q, Gwen Q, Aatrox W; Garen E, Yuumi R and Xerath R also expose their full-hit outcomes |
| Burn duration | Malzahar E, Cassiopeia Q/W, Teemo E/R, Nidalee W, Rumble Q/R, Miss Fortune E, Renekton R, Shyvana Dragon E trail; source-bound on-hit poisons |
| Single-hit vs sustained damage | Shyvana Q, Viktor Q, Sheen and its upgrades; Master Yi E active-stim behavior |
| Defaults and neutral buffs | Zero stacks; level-scaled blue haste; Infernal AD/AP; Mountain defenses; red burn refresh; opt-in toggles and immutable saved inputs |
| UI and persistence | Evolve button, hit-count and burn-duration editors, switch-form action, map buffs below runes, saved combat inputs, root and preview routes, Analytics-enabled page loading |

Tests: `tests/combat-mechanics.test.cjs`, existing attack/target/combo suites, and `tests/mechanics-browser.cjs`. The offline excerpts are rebuilt with `node scripts/build-mechanics-fixtures.cjs` from the downloaded champion fixtures. They retain source formulas rather than substituting test-only formulas.

## Champion / effect checklist for future patch audits

These are regression candidates, not a claim that every possible game interaction is simulated. In particular, possession, stolen spells, summons, movement, resets, healing, executes and target switching require their own combat-state models.

| Category | Check these champions and abilities |
| --- | --- |
| Other transformations and replacement kits | Kayn base/Shadow Assassin/Rhaast; K'Sante All Out; Kled mounted/dismounted Q; Quinn R; Rell W; Viego possession; Sylas stolen R; Neeko disguise; Hwei spellbooks; Aphelios weapon pairs; Udyr awakened stances; Kayle level upgrades; Smolder Q thresholds |
| Attack replacements / empowered attacks | Blitzcrank E, Camille Q, Darius W, Dr. Mundo E, Ekko E, Fiora E, Fizz W, Garen Q, Gragas W, Hecarim Q interaction, Illaoi W, Jax W, Kassadin W, Leona Q, Nasus Q, Nautilus P, Nidalee Q, Rek'Sai Q, Renekton W, Rengar Q, Shyvana Q, Skarner Q, Trundle Q, Vayne Q, Vi E, Viktor Q, Volibear Q, Wukong Q, Xin Zhao Q, Yorick Q |
| Duration / limited-hit stims | Ashe Q, Bel'Veth R, Braum passive procs, Draven Q, Gwen E, Irelia P, Jax R, Kayle P/E, Kennen W, Kog'Maw W, Lulu P, Master Yi E/R, Nami E, Nilah Q, Qiyana W, Riven P, Rumble P, Shen Q, Sona Q/P, Taric P, Twisted Fate E, Twitch R, Urgot W, Varus W, Vayne W, Viego Q, Volibear P, Warwick P, Yunara Q |
| Permanent / temporary stacks | Aurelion Sol stardust, Bel'Veth lavender, Cho'Gath Feast, Draven adoration, Ezreal P, Garen W, Gwen Q, Jax P, Jinx Q, Kindred marks, Nasus Q, Rengar trophies, Senna mist, Shyvana passive, Sion W, Smolder practice, Swain fragments, Syndra splinters, Thresh souls, Veigar P, Volibear P; rune Conqueror, Legend, Grasp, Overgrowth, Gathering Storm, Dark Harvest and Jack of All Trades |
| Multi-hit / bounces / channels | Ahri Q/W/R; Akshan Q/R; Aphelios weapon actions; Aurelion Sol Q; Brand R; Fiddlesticks W/R; Garen E; Gwen Q/R; Heimerdinger W/RW; Kai'Sa Q; Kalista E; Katarina R; Kennen R; Lucian R; Master Yi Q; Miss Fortune R; Neeko R; Riven Q; Samira R; Sivir W; Syndra R; Taliyah Q/E; Urgot W; Vel'Koz W/R; Wukong R; Xerath R; Yi passive; Yuumi R; Zeri Q |
| Burns, bleeds, persistent zones | Amumu W; Anivia R; Brand P; Cassiopeia Q/W; Darius P; Fiddlesticks R; Fizz W; Gangplank P; Lillia P; Malzahar E/R; Miss Fortune E; Mordekaiser P; Naafiri Q; Nasus E/R; Nidalee W; Renekton R; Rumble Q/R; Shyvana E; Singed Q; Swain R; Talon P; Teemo E/R; Trundle R; Twitch P; Udyr R; Viktor R; Zyra plants |

## Item checklist

| Effect family | Items / effects |
| --- | --- |
| Shared Spellblade cooldown | Sheen, Trinity Force, Lich Bane, Iceborn Gauntlet, Essence Reaver, Bloodsong, Dusk and Dawn. Tests check every source formula and strongest eligible shared proc. |
| Repeated on-hits | Recurve Bow, Nashor's Tooth, Wit's End, Guinsoo's Rageblade Wrath/Phantom Hit, Blade of the Ruined King, Muramana Shock, Terminus, Titanic Hydra Cleave; Ardent Censer ally buff |
| Cooldown / charge procs | Kraken Slayer, Rapid Firecannon, Stormrazor, Scout's Slingshot, Statikk Shiv, Voltaic Cyclosword, Umbral Glaive, Titanic Crescent, Dead Man's Plate momentum, Hullbreaker Skipper, Sundered Sky, Fiendhunter Bolts |
| Stacks / amplifiers | Rageblade, Yun Tal, Spear of Shojin, Liandry's Torment, Riftmaker, Mejai's Soulstealer, Dark Seal, Heartsteel, Tear items, Experimental Hexplate, Horizon Focus, Lord Dominik's Regards, Shadowflame |
| Persistent / burn effects | Liandry's Torment, Blackfire Torch, Malignance Hatefog, Bami's Cinder, Sunfire Aegis, Hollow Radiance, Death's Dance deferred damage; distinguish damage amplification from a damage-over-time packet |
| Other critical interactions | On-hit propagation through Ezreal Q, Gangplank Q, Irelia Q, Katarina E/R, Master Yi Q, Senna Q, Warwick Q/R, Viego R and Smolder Q; attack replacement subtraction, crit conversion, item passive disable switches and typed mitigation |

## Data and limitations

Neutral-buff coefficients are extracted from [CommunityDragon's game spell records](https://raw.communitydragon.org/latest/game/shared.cdtb.bin.json), checked on 4 November 2026, and stored in `JS/data/neutralBuffData.js`. Blue haste uses the level-scaled source calculation. Cloud movement speed and red regeneration require Out of combat; Ocean regeneration uses the selected current-health fraction. Chemtech contributes tenacity and heal/shield power. Healing is not added to Effective HP.

Baron has editable AD/AP bonuses, initially the 20-minute values from [Riot patch 9.2](https://www.leagueoflegends.com/en-us/news/game-updates/patch-9-2-notes/). This avoids incorrectly increasing an already-acquired buff as game time changes. Set the bonuses granted at the kill time. Minion empowerment and recall speed have no champion-damage contribution. Elemental dragon stacks and Elder burn are included; dragon souls and automatic Elder execute are not simulated.

Burns use a proportional duration estimate; repeated applications do not create independent stacking burns unless the game effect explicitly stacks. The combo builder counts each selected action explicitly, so select one outcome for an ability rather than adding all its alternative rows. Damage without a supported source formula remains flagged, rather than silently becoming zero or receiving a guessed coefficient.

## Analytics deployment repair

The Google tag on Builder, Comparator and Home was valid. Both failing workflows stopped at the release-verification step because the HTML no longer matched `docs/release.json`. Keep the tag, run the documented tests/build, and refresh the verified fingerprint before deploying. Browser fixtures return an empty JavaScript response for the external tag so tests neither send Analytics events nor mistake the script for an image.
