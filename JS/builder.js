const BUILDER = {
  version: "",
  champions: {},
  items: {},
  selectedChampion: "",
  championData: null,
  level: 1,
  abilityRanks: { q: 0, w: 0, e: 0, r: 0 },
  itemSlots: Array(6).fill(""),
  activeSlot: null,
  itemTags: new Set(),
  champTags: new Set(),
  modalItemFiltered: [],
  modalChampFiltered: [],
  runeModalTarget: null,
  runeSelections: {
    primaryPath: "sorcery",
    secondaryPath: "precision",
    primary: ["arcane-comet", "manaflow-band", "absolute-focus", "gathering-storm"],
    secondary: ["legend-haste", "cut-down"],
    shards: ["adaptive-force", "adaptive-force", "scaling-health"],
  },
};

const RUNE_DATA = {
  pathDefaults: {
    sorcery: ["arcane-comet", "manaflow-band", "absolute-focus", "gathering-storm"],
    precision: ["press-the-attack", "presence-of-mind", "legend-haste", "cut-down"],
    domination: ["electrocute", "cheap-shot", "eyeball-collection", "ultimate-hunter"],
    resolve: ["grasp-of-the-undying", "demolish", "second-wind", "overgrowth"],
    inspiration: ["first-strike", "magical-footwear", "biscuit-delivery", "cosmic-insight"],
  },
  paths: {
    sorcery: {
      name: "Sorcery",
      splash: "url(https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/Sorcery.png)",
      icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/Sorcery.png",
      primaryRows: [["arcane-comet", "summon-aery", "phase-rush"], ["nullifying-orb", "manaflow-band", "nimbus-cloak"], ["transcendence", "celerity", "absolute-focus"], ["scorch", "waterwalking", "gathering-storm"]],
    },
    precision: {
      name: "Precision",
      splash: "url(https://ddragon.canisback.com/img/perk-images/Styles/Precision/Precision.png)",
      icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/Precision.png",
      primaryRows: [["press-the-attack", "fleet-footwork", "conqueror"], ["overheal", "triumph", "presence-of-mind"], ["legend-alacrity", "legend-haste", "legend-bloodline"], ["coup-de-grace", "cut-down", "last-stand"]],
    },
    domination: {
      name: "Domination",
      splash: "url(https://ddragon.canisback.com/img/perk-images/Styles/Domination/Domination.png)",
      icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/Domination.png",
      primaryRows: [["electrocute", "dark-harvest", "hail-of-blades"], ["cheap-shot", "taste-of-blood", "sudden-impact"], ["zombie-ward", "ghost-poro", "eyeball-collection"], ["treasure-hunter", "relentless-hunter", "ultimate-hunter"]],
    },
    resolve: {
      name: "Resolve",
      splash: "url(https://ddragon.canisback.com/img/perk-images/Styles/Resolve/Resolve.png)",
      icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/Resolve.png",
      primaryRows: [["grasp-of-the-undying", "aftershock", "guardian"], ["shield-bash", "demolish", "font-of-life"], ["conditioning", "second-wind", "bone-plating"], ["overgrowth", "revitalize", "unflinching"]],
    },
    inspiration: {
      name: "Inspiration",
      splash: "url(https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/Inspiration.png)",
      icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/Inspiration.png",
      primaryRows: [["first-strike", "glacial-augment", "unsealed-spellbook"], ["hextech-flashtraption", "magical-footwear", "cashback"], ["biscuit-delivery", "triple-tonic", "time-warp-tonic"], ["cosmic-insight", "approach-velocity", "jack-of-all-trades"]],
    },
  },
  runeLookup: {
    "arcane-comet": { name: "Arcane Comet", desc: "Damaging abilities launch a comet.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png" },
    "summon-aery": { name: "Summon Aery", desc: "Attacks and abilities send Aery.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/SummonAery/SummonAery.png" },
    "phase-rush": { name: "Phase Rush", desc: "3 hits grant movement speed.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png" },
    "manaflow-band": { name: "Manaflow Band", desc: "Abilities that hit grant max mana.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png" },
    "absolute-focus": { name: "Absolute Focus", desc: "Gain adaptive force at high health.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/AbsoluteFocus/AbsoluteFocus.png" },
    "gathering-storm": { name: "Gathering Storm", desc: "Gain increasing AD/AP over time.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/GatheringStorm/GatheringStorm.png" },
    "nullifying-orb": { name: "Nullifying Orb", desc: "Shield triggers vs magic damage.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/NullifyingOrb/Pokeshield.png" },
    "nimbus-cloak": { name: "Nimbus Cloak", desc: "Gain movement speed after summoner spells.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/NimbusCloak/6361.png" },
    "transcendence": { name: "Transcendence", desc: "Bonus ability haste at level milestones.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/Transcendence/Transcendence.png" },
    "celerity": { name: "Celerity", desc: "Improves all movement speed bonuses.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/Celerity/CelerityTemp.png" },
    "scorch": { name: "Scorch", desc: "Abilities scorch enemies for bonus damage.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/Scorch/Scorch.png" },
    "waterwalking": { name: "Waterwalking", desc: "Move speed + stats in river.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Sorcery/Waterwalking/Waterwalking.png" },
    "press-the-attack": { name: "Press the Attack", desc: "3 attacks expose targets.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png" },
    "fleet-footwork": { name: "Fleet Footwork", desc: "Energized attacks heal and grant speed.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png" },
    "conqueror": { name: "Conqueror", desc: "Gain adaptive force in combat.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/Conqueror/Conqueror.png" },
    "overheal": { name: "Overheal", desc: "Excess healing converts to a shield.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/Overheal.png" },
    "triumph": { name: "Triumph", desc: "Takedowns heal and grant bonus gold.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/Triumph.png" },
    "legend-alacrity": { name: "Legend: Alacrity", desc: "Gain attack speed from Legend stacks.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png" },
    "legend-bloodline": { name: "Legend: Bloodline", desc: "Gain lifesteal from Legend stacks.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png" },
    "coup-de-grace": { name: "Coup de Grace", desc: "Deal more damage to low-health enemies.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png" },
    "last-stand": { name: "Last Stand", desc: "Deal more damage while low health.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/LastStand/LastStand.png" },
    "presence-of-mind": { name: "Presence of Mind", desc: "Restore mana on takedown.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png" },
    "legend-haste": { name: "Legend: Haste", desc: "Gain ability haste via Legend stacks.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/LegendHaste/LegendHaste.png" },
    "cut-down": { name: "Cut Down", desc: "Bonus damage vs high-health targets.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Precision/CutDown/CutDown.png" },
    "electrocute": { name: "Electrocute", desc: "3 separate hits burst damage.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/Electrocute/Electrocute.png" },
    "dark-harvest": { name: "Dark Harvest", desc: "Damage low-health enemies for soul stacks.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png" },
    "hail-of-blades": { name: "Hail of Blades", desc: "Burst of attack speed at combat start.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png" },
    "taste-of-blood": { name: "Taste of Blood", desc: "Heal when damaging enemy champions.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png" },
    "sudden-impact": { name: "Sudden Impact", desc: "Penetration after dashes/stealth.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/SuddenImpact/SuddenImpact.png" },
    "zombie-ward": { name: "Zombie Ward", desc: "Wards replace destroyed enemy wards.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/ZombieWard/ZombieWard.png" },
    "ghost-poro": { name: "Ghost Poro", desc: "Wards spawn a spotting poro.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/GhostPoro/GhostPoro.png" },
    "treasure-hunter": { name: "Treasure Hunter", desc: "Bonus gold from unique takedowns.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/TreasureHunter/TreasureHunter.png" },
    "relentless-hunter": { name: "Relentless Hunter", desc: "Out-of-combat movement speed.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/RelentlessHunter/RelentlessHunter.png" },
    "cheap-shot": { name: "Cheap Shot", desc: "Bonus true damage to impaired enemies.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/CheapShot/CheapShot.png" },
    "eyeball-collection": { name: "Eyeball Collection", desc: "Gain adaptive force from takedowns.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png" },
    "ultimate-hunter": { name: "Ultimate Hunter", desc: "Ultimate cooldown reduction.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png" },
    "grasp-of-the-undying": { name: "Grasp of the Undying", desc: "Periodic empowered attack in combat.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png" },
    "aftershock": { name: "Aftershock", desc: "Immobilize enemies for resistances and burst.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png" },
    "guardian": { name: "Guardian", desc: "Guard allies and shield on damage.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/Guardian/Guardian.png" },
    "shield-bash": { name: "Shield Bash", desc: "Empower attacks after gaining shields.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/ShieldBash/ShieldBash.png" },
    "font-of-life": { name: "Font of Life", desc: "Impaired enemies can be marked for healing.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/FontOfLife/FontOfLife.png" },
    "conditioning": { name: "Conditioning", desc: "Gain bonus armor and magic resist later.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/Conditioning/Conditioning.png" },
    "bone-plating": { name: "Bone Plating", desc: "Reduce damage from incoming combo hits.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/BonePlating/BonePlating.png" },
    "revitalize": { name: "Revitalize", desc: "Stronger heals and shields.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/Revitalize/Revitalize.png" },
    "unflinching": { name: "Unflinching", desc: "Gain tenacity and slow resist.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/Unflinching/Unflinching.png" },
    "demolish": { name: "Demolish", desc: "Charge attack against towers.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/Demolish/Demolish.png" },
    "second-wind": { name: "Second Wind", desc: "Heal after taking champion damage.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/SecondWind/SecondWind.png" },
    "overgrowth": { name: "Overgrowth", desc: "Gain permanent max health.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Resolve/Overgrowth/Overgrowth.png" },
    "first-strike": { name: "First Strike", desc: "Strike first for bonus damage and gold.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png" },
    "glacial-augment": { name: "Glacial Augment", desc: "Immobilizing attacks create slow rays.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png" },
    "unsealed-spellbook": { name: "Unsealed Spellbook", desc: "Swap summoner spells mid game.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/UnsealedSpellbook/UnsealedSpellbook.png" },
    "hextech-flashtraption": { name: "Hextech Flashtraption", desc: "Flash while on cooldown after channel.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png" },
    "cashback": { name: "Cash Back", desc: "Receive gold back on purchases.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/CashBack/CashBack2.png" },
    "triple-tonic": { name: "Triple Tonic", desc: "Gain elixirs through the game.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/TripleTonic/TripleTonic.png" },
    "time-warp-tonic": { name: "Time Warp Tonic", desc: "Potions grant immediate effects and speed.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/TimeWarpTonic/TimeWarpTonic.png" },
    "approach-velocity": { name: "Approach Velocity", desc: "Move faster toward impaired enemies.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/ApproachVelocity/ApproachVelocity.png" },
    "jack-of-all-trades": { name: "Jack of All Trades", desc: "Gain value from varied stats.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/JackOfAllTrades/JackofAllTrades2.png" },
    "magical-footwear": { name: "Magical Footwear", desc: "Get free boots at 12 min.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png" },
    "biscuit-delivery": { name: "Biscuit Delivery", desc: "Periodic lane sustain biscuits.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png" },
    "cosmic-insight": { name: "Cosmic Insight", desc: "Summoner and item haste.", icon: "https://ddragon.canisback.com/img/perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png" },
    "adaptive-force": { name: "Adaptive", desc: "+9 Adaptive Force", icon: "https://ddragon.canisback.com/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png" },
    "attack-speed": { name: "Attack Speed", desc: "+10% Attack Speed", icon: "https://ddragon.canisback.com/img/perk-images/StatMods/StatModsAttackSpeedIcon.png" },
    "ability-haste": { name: "Ability Haste", desc: "+8 Ability Haste", icon: "https://ddragon.canisback.com/img/perk-images/StatMods/StatModsCDRScalingIcon.png" },
    "scaling-health": { name: "Scaling Health", desc: "+10-180 Health", icon: "https://ddragon.canisback.com/img/perk-images/StatMods/StatModsHealthScalingIcon.png" },
    "armor": { name: "Armor", desc: "+6 Armor", icon: "https://ddragon.canisback.com/img/perk-images/StatMods/StatModsArmorIcon.png" },
    "magic-resist": { name: "Magic Resist", desc: "+10 Magic Resist", icon: "https://ddragon.canisback.com/img/perk-images/StatMods/StatModsMagicResIcon.png" },
  },
  shardOptions: ["adaptive-force", "attack-speed", "ability-haste", "scaling-health", "armor", "magic-resist"],
};
function setStatus(message, isError = false) {
  const el = document.getElementById("builderStatus");
  el.textContent = message || "";
  el.classList.toggle("status-error", isError);
}

async function initBuilder() {
  try {
    setStatus("Loading champion and item data...");
    wireLevelOptions();
    await loadBuilderData();
    renderChampionSelect();
    renderItemSlots();
    initItemModal();
    initChampionModal();
    renderRunePanel();
    renderAbilityCards();
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("Failed to load data. Check internet connection and refresh.", true);
  }
}

function wireLevelOptions() {
  const level = document.getElementById("builderLevel");
  level.innerHTML = Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  level.addEventListener("change", () => {
    BUILDER.level = Number(level.value);
    enforceAbilityRules();
    renderAbilityCards();
    renderStats();
  });
}

function isSummonersRiftItem(id, item) {
  if (["3040", "3042", "3121"].includes(String(id))) return true;
  return item.gold?.purchasable && item.maps?.[11] && !item.requiredAlly;
}

async function loadBuilderData() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  BUILDER.version = versions[0];

  const champions = await fetch(`https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/data/en_US/champion.json`).then((r) => r.json());
  BUILDER.champions = champions.data;

  const items = await fetch(`https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/data/en_US/item.json`).then((r) => r.json());
  Object.entries(items.data).forEach(([id, item]) => {
    if (!isSummonersRiftItem(id, item)) return;
    BUILDER.items[id] = item;
    (item.tags || []).forEach((tag) => BUILDER.itemTags.add(tag));
  });
}

function renderChampionSelect() {
  Object.keys(BUILDER.champions).forEach((name) => {
    (BUILDER.champions[name].tags || []).forEach((tag) => BUILDER.champTags.add(tag));
  });
  document.getElementById("championPickerBtn").textContent = "Select champion";
}

function initChampionModal() {
  const modal = document.getElementById("champModal");
  document.getElementById("modalChampSearch").addEventListener("input", renderChampionModalGrid);
  modal.addEventListener("click", (event) => {
    if (event.target.id === "champModal") closeChampionModal();
  });
  const root = document.getElementById("modalChampFilters");
  root.innerHTML = Array.from(BUILDER.champTags).sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" class="champ-tag" value="${tag}"> ${tag}</label>`).join("");
  root.querySelectorAll(".champ-tag").forEach((cb) => cb.addEventListener("change", renderChampionModalGrid));
}

function openChampionModal() {
  document.getElementById("champModal").classList.remove("hidden");
  renderChampionModalGrid();
}

function closeChampionModal() {
  document.getElementById("champModal").classList.add("hidden");
}

function renderChampionModalGrid() {
  const text = document.getElementById("modalChampSearch").value.trim().toLowerCase();
  const tags = new Set(Array.from(document.querySelectorAll(".champ-tag:checked")).map((cb) => cb.value));
  BUILDER.modalChampFiltered = Object.keys(BUILDER.champions)
    .filter((name) => {
      const c = BUILDER.champions[name];
      return (!text || name.toLowerCase().includes(text)) && (!tags.size || Array.from(tags).every((t) => c.tags?.includes(t)));
    })
    .sort((a, b) => a.localeCompare(b));

  document.getElementById("modalChampResults").textContent = `${BUILDER.modalChampFiltered.length} champions`;
  document.getElementById("modalChampGrid").innerHTML = BUILDER.modalChampFiltered
    .map((name) => `<button class="item-button-icon" data-champ="${name}" onclick="setChampionFromModal(this.dataset.champ)" title="${name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${BUILDER.champions[name].image.full}" alt="${name}"></button>`)
    .join("");
  renderChampionModalDetail(BUILDER.modalChampFiltered[0] || null);
}

function renderChampionModalDetail(name) {
  const root = document.getElementById("modalChampDetail");
  if (!name) {
    root.innerHTML = "<p class='text-muted'>No champion found.</p>";
    return;
  }
  const c = BUILDER.champions[name];
  root.innerHTML = `<h3>${name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${c.image.full}' alt='${name}'><p><strong>Tags:</strong> ${(c.tags || []).join(", ")}</p><p>${c.blurb}</p>`;
}

function setChampionFromModal(name) {
  setChampion(name);
  closeChampionModal();
}

function getRuneMeta(id) {
  return RUNE_DATA.runeLookup[id] || { name: "Select", desc: "Pick a rune", icon: "" };
}

function runeImgTag(meta, className = "") {
  const fallback = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='32' fill='%23111f3d'/><circle cx='32' cy='32' r='26' fill='%23273d70'/></svg>");
  return `<img class="${className}" src="${meta.icon || fallback}" alt="${meta.name}" onerror="this.onerror=null;this.src='${fallback}'">`;
}

async function setChampion(name) {
  const details = await fetch(`https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/data/en_US/champion/${name}.json`).then((r) => r.json());
  BUILDER.selectedChampion = name;
  BUILDER.championData = details.data[name];
  BUILDER.abilityRanks = { q: 1, w: 0, e: 0, r: 0 };
  BUILDER.level = Number(document.getElementById("builderLevel").value) || 1;

  const splashUrl = `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg)`;
  document.body.style.setProperty("--builder-splash-url", splashUrl);
  document.getElementById("runesCard").style.setProperty("--rune-splash-url", RUNE_DATA.paths[BUILDER.runeSelections.primaryPath].splash);
  document.getElementById("championPickerBtn").textContent = name;

  document.getElementById("selectedChampionBadge").classList.remove("hidden");
  document.getElementById("selectedChampionBadge").innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${BUILDER.championData.image.full}" alt="${name}">`;

  enforceAbilityRules();
  renderAbilityCards();
  renderStats();
}

function renderItemSlots() {
  const root = document.getElementById("itemSlots");
  root.innerHTML = BUILDER.itemSlots.map((_, i) => `<button class="item-slot-btn" onclick="openItemModal(${i})"><div id="slotText${i}" class="item-slot-empty">+</div></button>`).join("");
  refreshSlotLabels();
}

function refreshSlotLabels() {
  BUILDER.itemSlots.forEach((id, i) => {
    const root = document.getElementById(`slotText${i}`);
    if (!id) {
      root.className = "item-slot-empty";
      root.textContent = "+";
      return;
    }
    const item = BUILDER.items[id];
    root.className = "";
    root.innerHTML = `<img class="item-slot-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png" alt="${item.name}" title="${item.name}">`;
  });
}

function initItemModal() {
  renderBuilderTagFilters();
  document.getElementById("modalItemSearch").addEventListener("input", renderModalItemGrid);
  document.getElementById("itemModal").addEventListener("click", (event) => {
    if (event.target.id === "itemModal") closeItemModal();
  });
}

function clearModalFilters() {
  document.getElementById("modalItemSearch").value = "";
  document.querySelectorAll(".modal-tag").forEach((cb) => { cb.checked = false; });
  renderModalItemGrid();
}

function renderBuilderTagFilters() {
  const root = document.getElementById("modalItemFilters");
  root.innerHTML = Array.from(BUILDER.itemTags).sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" class="modal-tag" value="${tag}"> ${tag}</label>`).join("");
  root.querySelectorAll(".modal-tag").forEach((cb) => cb.addEventListener("change", renderModalItemGrid));
}

function openItemModal(slot) {
  BUILDER.activeSlot = slot;
  document.getElementById("itemModalTitle").textContent = "Select Item";
  document.getElementById("itemModal").classList.remove("hidden");
  renderModalItemGrid();
}

function closeItemModal() {
  document.getElementById("itemModal").classList.add("hidden");
  BUILDER.activeSlot = null;
}

function renderModalItemGrid() {
  const text = document.getElementById("modalItemSearch").value.trim().toLowerCase();
  const tags = new Set(Array.from(document.querySelectorAll(".modal-tag:checked")).map((cb) => cb.value));
  BUILDER.modalItemFiltered = Object.entries(BUILDER.items)
    .filter(([, item]) => (!text || item.name.toLowerCase().includes(text)) && (!tags.size || Array.from(tags).every((t) => item.tags?.includes(t))))
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([id]) => id);
  const ids = BUILDER.modalItemFiltered;
  document.getElementById("modalResultsCount").textContent = `${ids.length} items shown`;
  document.getElementById("modalItemGrid").innerHTML = ids
    .map((id) => `<button class="item-button-icon" onclick="renderModalItemDetail('${id}')" title="${BUILDER.items[id].name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png" alt="${BUILDER.items[id].name}"></button>`)
    .join("");
  renderModalItemDetail(ids[0] || null);
}

function renderModalItemDetail(id) {
  const root = document.getElementById("modalItemDetail");
  if (!id) {
    root.innerHTML = "<p class='text-muted'>No items found.</p>";
    return;
  }
  const item = BUILDER.items[id];
  const statLines = Object.entries(item.stats || {}).filter(([, v]) => Number(v) !== 0).map(([k, v]) => `<div>${k}: ${v}</div>`).join("");
  root.innerHTML = `<h3>${item.name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png' alt='${item.name}'><p><strong>Cost:</strong> ${item.gold?.total ?? 0}g</p><div>${statLines}</div><div class='mt-10'>${item.description || ""}</div><button class='btn btn-sm mt-10' onclick="setSlotItem('${id}')">Select this item</button><button class='btn btn-sm mt-10 ml-5' onclick="setSlotItem('')">Clear slot</button>`;
}

function setSlotItem(itemId) {
  if (BUILDER.activeSlot === null) return;
  BUILDER.itemSlots[BUILDER.activeSlot] = itemId;
  refreshSlotLabels();
  renderStats();
  closeItemModal();
}

function abilityMaxByLevel(level, spellKey) {
  if (spellKey === "r") {
    if (level >= 16) return 3;
    if (level >= 11) return 2;
    if (level >= 6) return 1;
    return 0;
  }
  return Math.min(5, Math.ceil(level / 2));
}

function enforceAbilityRules() {
  ["q", "w", "e", "r"].forEach((k) => {
    BUILDER.abilityRanks[k] = Math.min(BUILDER.abilityRanks[k], abilityMaxByLevel(BUILDER.level, k));
  });
  let total = Object.values(BUILDER.abilityRanks).reduce((a, b) => a + b, 0);
  while (total > BUILDER.level) {
    const pick = ["q", "w", "e", "r"].sort((a, b) => BUILDER.abilityRanks[b] - BUILDER.abilityRanks[a]).find((k) => BUILDER.abilityRanks[k] > 0);
    BUILDER.abilityRanks[pick] -= 1;
    total -= 1;
  }
}

function parseByRank(valueBurn, rank) {
  if (!rank) return "-";
  if (!valueBurn || valueBurn === "0") return "-";
  const parts = String(valueBurn).split("/");
  return parts[Math.max(0, Math.min(parts.length - 1, rank - 1))] || parts[0] || "-";
}

function renderAbilityCards() {
  const root = document.getElementById("abilityCards");
  if (!BUILDER.championData) {
    root.innerHTML = "<div class='ability-card'><p class='text-muted'>Select a champion to view abilities.</p></div>";
    document.getElementById("abilityRuleHint").textContent = "";
    return;
  }

  const champ = BUILDER.championData;
  const passive = `<div class="ability-card"><strong>Passive - ${champ.passive.name}</strong><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/passive/${champ.passive.image.full}" alt="${champ.passive.name}"><p>${champ.passive.description}</p></div>`;

  const spells = champ.spells.map((spell, i) => {
    const key = ["q", "w", "e", "r"][i];
    const max = abilityMaxByLevel(BUILDER.level, key);
    const opts = Array.from({ length: max + 1 }, (_, idx) => `<option value="${idx}">${idx}</option>`).join("");
    const rank = BUILDER.abilityRanks[key];
    const cd = parseByRank(spell.cooldownBurn, rank);
    const cost = parseByRank(spell.costBurn, rank);
    const range = parseByRank(spell.rangeBurn, rank);
    return `<div class="ability-card"><strong>${key.toUpperCase()} - ${spell.name}</strong><div class="ability-rank-row"><label class="label">Rank<select class="form-control" id="rank_${key}">${opts}</select></label></div><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/spell/${spell.image.full}" alt="${spell.name}"><p>${spell.description}</p><div><strong>Cooldown:</strong> ${cd}</div><div><strong>Cost:</strong> ${cost}</div><div><strong>Range:</strong> ${range}</div></div>`;
  }).join("");

  root.innerHTML = passive + spells;
  ["q", "w", "e", "r"].forEach((k) => {
    const el = document.getElementById(`rank_${k}`);
    if (!el) return;
    el.value = String(BUILDER.abilityRanks[k]);
    el.addEventListener("change", () => {
      BUILDER.abilityRanks[k] = Number(el.value);
      enforceAbilityRules();
      renderAbilityCards();
    });
  });
  document.getElementById("abilityRuleHint").textContent = `At level ${BUILDER.level}: basic max ${abilityMaxByLevel(BUILDER.level, "q")}, R max ${abilityMaxByLevel(BUILDER.level, "r")}, total points ${BUILDER.level}.`;
}

function getItemStats() {
  const totals = { hp: 0, mp: 0, ad: 0, ap: 0, armor: 0, mr: 0, haste: 0, asPct: 0 };
  BUILDER.itemSlots.forEach((id) => {
    if (!id) return;
    const item = BUILDER.items[id] || {};
    const s = item.stats || {};
    totals.hp += s.FlatHPPoolMod || 0;
    totals.mp += s.FlatMPPoolMod || 0;
    totals.ad += s.FlatPhysicalDamageMod || 0;
    totals.ap += s.FlatMagicDamageMod || 0;
    totals.armor += s.FlatArmorMod || 0;
    totals.mr += s.FlatSpellBlockMod || 0;

    const explicitHaste = [s.FlatHasteMod, s.FlatAbilityHasteMod, s.AbilityHaste, s.AbilityHasteMod]
      .map(Number)
      .find((value) => Number.isFinite(value) && value !== 0) || 0;

    const cdrRaw = Number(s.FlatCooldownReduction);
    const cdrAsHaste = Number.isFinite(cdrRaw)
      ? (cdrRaw > 0 && cdrRaw < 1 ? (100 * cdrRaw) / (1 - cdrRaw) : cdrRaw)
      : 0;

    const descText = String(item.description || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ");
    const descHaste = Array.from(descText.matchAll(/\+\s*([0-9]+(?:\.[0-9]+)?)\s+Ability\s+Haste/gi))
      .reduce((sum, match) => sum + Number(match[1] || 0), 0);

    const hasteFromItem = explicitHaste || cdrAsHaste || descHaste || 0;
=======
    const hasteCandidates = [
      s.FlatHasteMod,
      s.FlatAbilityHasteMod,
      s.AbilityHaste,
      s.AbilityHasteMod,
      s.FlatCooldownReduction,
    ].map(Number).filter((value) => Number.isFinite(value));
    const hasteFromItem = hasteCandidates.find((value) => value !== 0) ?? hasteCandidates[0] ?? 0;
>>>>>>> main
    totals.haste += hasteFromItem;
    totals.asPct += (s.PercentAttackSpeedMod || 0) * 100;
  });
  return totals;
}

function getRuneStats() {
  const totals = { hp: 0, mp: 0, ad: 0, ap: 0, armor: 0, mr: 0, haste: 0, asPct: 0 };
  const selected = [
    ...BUILDER.runeSelections.primary,
    ...BUILDER.runeSelections.secondary,
    ...BUILDER.runeSelections.shards,
  ];

  selected.forEach((runeId) => {
    if (runeId === "ability-haste") totals.haste += 8;
    if (runeId === "attack-speed") totals.asPct += 10;
    if (runeId === "scaling-health") totals.hp += 10 + (BUILDER.level - 1) * 10;
    if (runeId === "armor") totals.armor += 6;
    if (runeId === "magic-resist") totals.mr += 10;

    // Adaptive force currently modeled as AP in this lightweight builder.
    if (runeId === "adaptive-force") totals.ap += 9;

    // Sorcery: +5 Ability Haste at level 5 and again at level 8.
    if (runeId === "transcendence") {
      if (BUILDER.level >= 5) totals.haste += 5;
      if (BUILDER.level >= 8) totals.haste += 5;
    }
  });

  return totals;
}

function renderStats() {
  const root = document.getElementById("statsTable");
  if (!BUILDER.championData) {
    root.innerHTML = "<p class='text-muted'>Select a champion to view stats.</p>";
    return;
  }

  const base = BUILDER.championData.stats;
  const item = getItemStats();
  const rune = getRuneStats();
  const L = BUILDER.level;

  const hp = (base.hp + base.hpperlevel * (L - 1) + item.hp + rune.hp);
  const mp = (base.mp + base.mpperlevel * (L - 1) + item.mp + rune.mp);
  const ad = (base.attackdamage + base.attackdamageperlevel * (L - 1) + item.ad + rune.ad);
  const armor = (base.armor + base.armorperlevel * (L - 1) + item.armor + rune.armor);
  const mr = (base.spellblock + base.spellblockperlevel * (L - 1) + item.mr + rune.mr);
  const asTotal = base.attackspeed * (1 + (base.attackspeedperlevel * (L - 1)) / 100) * (1 + (item.asPct + rune.asPct) / 100);
  const abilityHaste = item.haste + rune.haste;

  const rows = [
    { name: "HP", value: hp, eq: `${base.hp.toFixed(1)} + ${base.hpperlevel.toFixed(1)}*${L - 1} + ${item.hp.toFixed(1)} + ${rune.hp.toFixed(1)}` },
    { name: "MP", value: mp, eq: `${base.mp.toFixed(1)} + ${base.mpperlevel.toFixed(1)}*${L - 1} + ${item.mp.toFixed(1)} + ${rune.mp.toFixed(1)}` },
    { name: "AD", value: ad, eq: `${base.attackdamage.toFixed(1)} + ${base.attackdamageperlevel.toFixed(1)}*${L - 1} + ${item.ad.toFixed(1)} + ${rune.ad.toFixed(1)}` },
    { name: "AP", value: item.ap + rune.ap, eq: `0 + ${item.ap.toFixed(1)} + ${rune.ap.toFixed(1)}` },
    { name: "Armor", value: armor, eq: `${base.armor.toFixed(1)} + ${base.armorperlevel.toFixed(1)}*${L - 1} + ${item.armor.toFixed(1)} + ${rune.armor.toFixed(1)}` },
    { name: "MR", value: mr, eq: `${base.spellblock.toFixed(1)} + ${base.spellblockperlevel.toFixed(1)}*${L - 1} + ${item.mr.toFixed(1)} + ${rune.mr.toFixed(1)}` },
    { name: "Attack Speed", value: asTotal, eq: `${base.attackspeed.toFixed(3)} * level mult * (1 + ${(item.asPct + rune.asPct).toFixed(1)}%)` },
    { name: "Ability Haste", value: abilityHaste, eq: `0 + ${item.haste.toFixed(1)} + ${rune.haste.toFixed(1)}` },
  ];

  root.innerHTML = `<table class="stats-table">${rows.map((r) => `<tr><td class="stats-label">${r.name}</td><td class="stats-value" title="${r.eq}">${r.value.toFixed(r.name === "Attack Speed" ? 3 : 1)}</td></tr>`).join("")}</table>`;
}

function renderRunePanel() {
  const root = document.getElementById("runePanel");
  const primaryPath = RUNE_DATA.paths[BUILDER.runeSelections.primaryPath];
  const secondaryPath = RUNE_DATA.paths[BUILDER.runeSelections.secondaryPath];
  document.getElementById("runesCard").style.setProperty("--rune-splash-url", primaryPath.splash);

  const renderSlot = (id, label, target) => {
    const rune = getRuneMeta(id);
    return `<div class="rune-slot-row"><button class="rune-slot-btn" onclick="openRuneModal('${target}')">${runeImgTag(rune)}</button><div class="rune-slot-label">${label}<br>${rune.name}</div></div>`;
  };

  root.innerHTML = `
    <div>
      <div class="rune-column-title"><button class='btn btn-sm' onclick="openRuneModal('primaryPath_0')">${primaryPath.name}</button></div>
      ${renderSlot(BUILDER.runeSelections.primary[0], "Keystone", "primary_0")}
      ${renderSlot(BUILDER.runeSelections.primary[1], "Row 1", "primary_1")}
      ${renderSlot(BUILDER.runeSelections.primary[2], "Row 2", "primary_2")}
      ${renderSlot(BUILDER.runeSelections.primary[3], "Row 3", "primary_3")}
    </div>
    <div>
      <div class="rune-column-title"><button class='btn btn-sm' onclick="openRuneModal('secondaryPath_0')">${secondaryPath.name}</button></div>
      ${renderSlot(BUILDER.runeSelections.secondary[0], "Secondary 1", "secondary_0")}
      ${renderSlot(BUILDER.runeSelections.secondary[1], "Secondary 2", "secondary_1")}
      ${renderSlot(BUILDER.runeSelections.shards[0], "Shard 1", "shard_0")}
      ${renderSlot(BUILDER.runeSelections.shards[1], "Shard 2", "shard_1")}
      ${renderSlot(BUILDER.runeSelections.shards[2], "Shard 3", "shard_2")}
    </div>
  `;
}

function flattenSecondaryOptions(pathId) {
  const rows = RUNE_DATA.paths[pathId]?.primaryRows || [];
  return rows.slice(1).flat();
}

function getPathPrimaryDefaults(pathId) {
  return (RUNE_DATA.pathDefaults[pathId] || ["arcane-comet", "manaflow-band", "absolute-focus", "gathering-storm"]).slice(0, 4);
}

function getPathSecondaryDefaults(pathId) {
  const flat = flattenSecondaryOptions(pathId);
  return [flat[0], flat[1] || flat[0]];
}

function getRuneOptions(target) {
  if (target.startsWith("primaryPath")) return Object.entries(RUNE_DATA.paths).map(([id, p]) => ({ id, name: p.name, desc: `Set ${p.name} as primary path`, icon: p.icon }));
  if (target.startsWith("secondaryPath")) return Object.entries(RUNE_DATA.paths).map(([id, p]) => ({ id, name: p.name, desc: `Set ${p.name} as secondary path`, icon: p.icon }));
  if (target.startsWith("primary")) {
    const rowIndex = Number(target.split("_")[1]);
    const rows = RUNE_DATA.paths[BUILDER.runeSelections.primaryPath]?.primaryRows || [];
    return (rows[rowIndex] || []).map((id) => ({ id, ...getRuneMeta(id) }));
  }
  if (target.startsWith("secondary")) {
    return flattenSecondaryOptions(BUILDER.runeSelections.secondaryPath).map((id) => ({ id, ...getRuneMeta(id) }));
  }
  return RUNE_DATA.shardOptions.map((id) => ({ id, ...getRuneMeta(id) }));
}

function openRuneModal(target) {
  BUILDER.runeModalTarget = target;
  document.getElementById("runeModal").classList.remove("hidden");
  const options = getRuneOptions(target);
  document.getElementById("runeModalTitle").textContent = "Select Rune Option";
  document.getElementById("runeModalList").innerHTML = options.map((o) => `<button class="rune-option-btn" onclick="selectRuneOption('${o.id}')">${runeImgTag(o)}<div><div class="rune-option-name">${o.name}</div><div class="rune-option-desc">${o.desc}</div></div></button>`).join("");
  document.getElementById("runeModal").onclick = (e) => {
    if (e.target.id === "runeModal") closeRuneModal();
  };
}

function closeRuneModal() {
  document.getElementById("runeModal").classList.add("hidden");
  BUILDER.runeModalTarget = null;
}

function selectRuneOption(id) {
  const [group, index] = BUILDER.runeModalTarget.split("_");
  if (group === "primary") BUILDER.runeSelections.primary[Number(index)] = id;
  if (group === "secondary") BUILDER.runeSelections.secondary[Number(index)] = id;
  if (group === "shard") BUILDER.runeSelections.shards[Number(index)] = id;
  if (group === "primaryPath") {
    BUILDER.runeSelections.primaryPath = id;
    BUILDER.runeSelections.primary = getPathPrimaryDefaults(id);
  }
  if (group === "secondaryPath") {
    BUILDER.runeSelections.secondaryPath = id;
    BUILDER.runeSelections.secondary = getPathSecondaryDefaults(id);
  }
  renderRunePanel();
  closeRuneModal();
}
