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
  championDetailCache: {},
  cdragonAbilityData: null,
  championModalRequestId: 0,
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
      splash: "url(https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7202_sorcery.png)",
      icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7202_sorcery.png",
      primaryRows: [["arcane-comet", "summon-aery", "phase-rush"], ["nullifying-orb", "manaflow-band", "nimbus-cloak"], ["transcendence", "celerity", "absolute-focus"], ["scorch", "waterwalking", "gathering-storm"]],
    },
    precision: {
      name: "Precision",
      splash: "url(https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7201_precision.png)",
      icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7201_precision.png",
      primaryRows: [["press-the-attack", "fleet-footwork", "conqueror"], ["overheal", "triumph", "presence-of-mind"], ["legend-alacrity", "legend-haste", "legend-bloodline"], ["coup-de-grace", "cut-down", "last-stand"]],
    },
    domination: {
      name: "Domination",
      splash: "url(https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7200_domination.png)",
      icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7200_domination.png",
      primaryRows: [["electrocute", "dark-harvest", "hail-of-blades"], ["cheap-shot", "taste-of-blood", "sudden-impact"], ["zombie-ward", "ghost-poro", "eyeball-collection"], ["treasure-hunter", "relentless-hunter", "ultimate-hunter"]],
    },
    resolve: {
      name: "Resolve",
      splash: "url(https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7204_resolve.png)",
      icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7204_resolve.png",
      primaryRows: [["grasp-of-the-undying", "aftershock", "guardian"], ["shield-bash", "demolish", "font-of-life"], ["conditioning", "second-wind", "bone-plating"], ["overgrowth", "revitalize", "unflinching"]],
    },
    inspiration: {
      name: "Inspiration",
      splash: "url(https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7203_whimsy.png)",
      icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7203_whimsy.png",
      primaryRows: [["first-strike", "glacial-augment", "unsealed-spellbook"], ["hextech-flashtraption", "magical-footwear", "cashback"], ["biscuit-delivery", "triple-tonic", "time-warp-tonic"], ["cosmic-insight", "approach-velocity", "jack-of-all-trades"]],
    },
  },
  runeLookup: {
    "arcane-comet": { name: "Arcane Comet", desc: "Damaging abilities launch a comet.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png" },
    "summon-aery": { name: "Summon Aery", desc: "Attacks and abilities send Aery.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/SummonAery/SummonAery.png" },
    "phase-rush": { name: "Phase Rush", desc: "3 hits grant movement speed.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png" },
    "manaflow-band": { name: "Manaflow Band", desc: "Abilities that hit grant max mana.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png" },
    "absolute-focus": { name: "Absolute Focus", desc: "Gain adaptive force at high health.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/AbsoluteFocus/AbsoluteFocus.png" },
    "gathering-storm": { name: "Gathering Storm", desc: "Gain increasing AD/AP over time.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/GatheringStorm/GatheringStorm.png" },
    "nullifying-orb": { name: "Nullifying Orb", desc: "Shield triggers vs magic damage.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/NullifyingOrb/Pokeshield.png" },
    "nimbus-cloak": { name: "Nimbus Cloak", desc: "Gain movement speed after summoner spells.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/NimbusCloak/6361.png" },
    "transcendence": { name: "Transcendence", desc: "Bonus ability haste at level milestones.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Transcendence/Transcendence.png" },
    "celerity": { name: "Celerity", desc: "Improves all movement speed bonuses.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Celerity/CelerityTemp.png" },
    "scorch": { name: "Scorch", desc: "Abilities scorch enemies for bonus damage.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Scorch/Scorch.png" },
    "waterwalking": { name: "Waterwalking", desc: "Move speed + stats in river.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Waterwalking/Waterwalking.png" },
    "press-the-attack": { name: "Press the Attack", desc: "3 attacks expose targets.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png" },
    "fleet-footwork": { name: "Fleet Footwork", desc: "Energized attacks heal and grant speed.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png" },
    "conqueror": { name: "Conqueror", desc: "Gain adaptive force in combat.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Conqueror/Conqueror.png" },
    "overheal": { name: "Overheal", desc: "Excess healing converts to a shield.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Overheal.png" },
    "triumph": { name: "Triumph", desc: "Takedowns heal and grant bonus gold.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Triumph.png" },
    "legend-alacrity": { name: "Legend: Alacrity", desc: "Gain attack speed from Legend stacks.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png" },
    "legend-bloodline": { name: "Legend: Bloodline", desc: "Gain lifesteal from Legend stacks.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png" },
    "coup-de-grace": { name: "Coup de Grace", desc: "Deal more damage to low-health enemies.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png" },
    "last-stand": { name: "Last Stand", desc: "Deal more damage while low health.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LastStand/LastStand.png" },
    "presence-of-mind": { name: "Presence of Mind", desc: "Restore mana on takedown.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png" },
    "legend-haste": { name: "Legend: Haste", desc: "Gain ability haste via Legend stacks.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendHaste/LegendHaste.png" },
    "cut-down": { name: "Cut Down", desc: "Bonus damage vs high-health targets.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CutDown/CutDown.png" },
    "electrocute": { name: "Electrocute", desc: "3 separate hits burst damage.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/Electrocute/Electrocute.png" },
    "dark-harvest": { name: "Dark Harvest", desc: "Damage low-health enemies for soul stacks.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png" },
    "hail-of-blades": { name: "Hail of Blades", desc: "Burst of attack speed at combat start.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png" },
    "taste-of-blood": { name: "Taste of Blood", desc: "Heal when damaging enemy champions.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png" },
    "sudden-impact": { name: "Sudden Impact", desc: "Penetration after dashes/stealth.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/SuddenImpact/SuddenImpact.png" },
    "zombie-ward": { name: "Zombie Ward", desc: "Wards replace destroyed enemy wards.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/ZombieWard/ZombieWard.png" },
    "ghost-poro": { name: "Ghost Poro", desc: "Wards spawn a spotting poro.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/GhostPoro/GhostPoro.png" },
    "treasure-hunter": { name: "Treasure Hunter", desc: "Bonus gold from unique takedowns.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TreasureHunter/TreasureHunter.png" },
    "relentless-hunter": { name: "Relentless Hunter", desc: "Out-of-combat movement speed.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/RelentlessHunter/RelentlessHunter.png" },
    "cheap-shot": { name: "Cheap Shot", desc: "Bonus true damage to impaired enemies.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/CheapShot/CheapShot.png" },
    "eyeball-collection": { name: "Eyeball Collection", desc: "Gain adaptive force from takedowns.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png" },
    "ultimate-hunter": { name: "Ultimate Hunter", desc: "Ultimate cooldown reduction.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png" },
    "grasp-of-the-undying": { name: "Grasp of the Undying", desc: "Periodic empowered attack in combat.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png" },
    "aftershock": { name: "Aftershock", desc: "Immobilize enemies for resistances and burst.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png" },
    "guardian": { name: "Guardian", desc: "Guard allies and shield on damage.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Guardian/Guardian.png" },
    "shield-bash": { name: "Shield Bash", desc: "Empower attacks after gaining shields.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/ShieldBash/ShieldBash.png" },
    "font-of-life": { name: "Font of Life", desc: "Impaired enemies can be marked for healing.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/FontOfLife/FontOfLife.png" },
    "conditioning": { name: "Conditioning", desc: "Gain bonus armor and magic resist later.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Conditioning/Conditioning.png" },
    "bone-plating": { name: "Bone Plating", desc: "Reduce damage from incoming combo hits.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/BonePlating/BonePlating.png" },
    "revitalize": { name: "Revitalize", desc: "Stronger heals and shields.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Revitalize/Revitalize.png" },
    "unflinching": { name: "Unflinching", desc: "Gain tenacity and slow resist.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Unflinching/Unflinching.png" },
    "demolish": { name: "Demolish", desc: "Charge attack against towers.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Demolish/Demolish.png" },
    "second-wind": { name: "Second Wind", desc: "Heal after taking champion damage.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/SecondWind/SecondWind.png" },
    "overgrowth": { name: "Overgrowth", desc: "Gain permanent max health.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Overgrowth/Overgrowth.png" },
    "first-strike": { name: "First Strike", desc: "Strike first for bonus damage and gold.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png" },
    "glacial-augment": { name: "Glacial Augment", desc: "Immobilizing attacks create slow rays.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png" },
    "unsealed-spellbook": { name: "Unsealed Spellbook", desc: "Swap summoner spells mid game.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/UnsealedSpellbook/UnsealedSpellbook.png" },
    "hextech-flashtraption": { name: "Hextech Flashtraption", desc: "Flash while on cooldown after channel.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png" },
    "cashback": { name: "Cash Back", desc: "Receive gold back on purchases.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CashBack/CashBack2.png" },
    "triple-tonic": { name: "Triple Tonic", desc: "Gain elixirs through the game.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/TripleTonic/TripleTonic.png" },
    "time-warp-tonic": { name: "Time Warp Tonic", desc: "Potions grant immediate effects and speed.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/TimeWarpTonic/TimeWarpTonic.png" },
    "approach-velocity": { name: "Approach Velocity", desc: "Move faster toward impaired enemies.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/ApproachVelocity/ApproachVelocity.png" },
    "jack-of-all-trades": { name: "Jack of All Trades", desc: "Gain value from varied stats.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/JackOfAllTrades/JackofAllTrades2.png" },
    "magical-footwear": { name: "Magical Footwear", desc: "Get free boots at 12 min.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png" },
    "biscuit-delivery": { name: "Biscuit Delivery", desc: "Periodic lane sustain biscuits.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png" },
    "cosmic-insight": { name: "Cosmic Insight", desc: "Summoner and item haste.", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png" },
    "adaptive-force": { name: "Adaptive", desc: "+9 Adaptive Force", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png" },
    "attack-speed": { name: "Attack Speed", desc: "+10% Attack Speed", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png" },
    "ability-haste": { name: "Ability Haste", desc: "+8 Ability Haste", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsCDRScalingIcon.png" },
    "scaling-health": { name: "Scaling Health", desc: "+10-180 Health", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png" },
    "armor": { name: "Armor", desc: "+6 Armor", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsArmorIcon.png" },
    "magic-resist": { name: "Magic Resist", desc: "+10 Magic Resist", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMagicResIcon.png" },
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
    renderStats();
    wireBuilderUiEvents();
    document.getElementById("passiveModal").addEventListener("click", (event) => {
      if (event.target.id === "passiveModal") closePassiveModal();
    });
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("Failed to load data. Check internet connection and refresh.", true);
  }
}

function wireBuilderUiEvents() {
  document.getElementById("championPickerBtn").addEventListener("click", openChampionModal);
  document.getElementById("passiveToggleBtn").addEventListener("click", togglePassivePanel);
  document.getElementById("clearModalFiltersBtn").addEventListener("click", clearModalFilters);
  document.getElementById("closeItemModalBtn").addEventListener("click", closeItemModal);
  document.getElementById("closeChampModalBtn").addEventListener("click", closeChampionModal);
  document.getElementById("closeRuneModalBtn").addEventListener("click", closeRuneModal);
  document.getElementById("closePassiveModalBtn").addEventListener("click", closePassiveModal);

  document.getElementById("modalChampGrid").addEventListener("mouseover", (event) => {
    const btn = event.target.closest("[data-champ]");
    if (!btn) return;
    renderChampionModalDetail(btn.dataset.champ);
  });
  document.getElementById("modalChampGrid").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-champ]");
    if (!btn) return;
    setChampionFromModal(btn.dataset.champ);
  });
  document.getElementById("itemSlots").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-slot]");
    if (!btn) return;
    openItemModal(Number(btn.dataset.slot));
  });
  document.getElementById("modalItemGrid").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-item-id]");
    if (!btn) return;
    renderModalItemDetail(btn.dataset.itemId);
  });
  document.getElementById("modalItemDetail").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-set-item-id]");
    if (!btn) return;
    setSlotItem(btn.dataset.setItemId);
  });
  document.getElementById("runePanel").addEventListener("click", (event) => {
    const secondaryRuneBtn = event.target.closest("[data-secondary-rune-id]");
    if (secondaryRuneBtn) {
      selectSecondaryRuneDirect(secondaryRuneBtn.dataset.secondaryRuneId);
      return;
    }

    const btn = event.target.closest("[data-rune-target]");
    if (!btn) return;
    openRuneModal(btn.dataset.runeTarget);
  });
  document.getElementById("runeModalList").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-rune-option-id]");
    if (!btn || btn.disabled) return;
    selectRuneOption(btn.dataset.runeOptionId);
  });
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

const BUILDER_FORCE_INCLUDE_ITEM_IDS = window.ItemPolicy.FORCE_INCLUDE_ITEM_IDS;

function getItemLookupShared() {
  return (typeof window !== "undefined" && window.ItemLookupShared) ? window.ItemLookupShared : null;
}

function isPurchasableBuilderItem(id, item) {
  const shared = getItemLookupShared();
  if (shared?.isPurchasableItem) return shared.isPurchasableItem(id, item);
  return window.ItemPolicy.isPurchasableItem(id, item);
}

function dedupeBuilderItems(itemEntries, preferredMaps = [11]) {
  const shared = getItemLookupShared();
  if (shared?.dedupeByNameWithMapPriority) return shared.dedupeByNameWithMapPriority(itemEntries, new Set(preferredMaps));
  return window.ItemPolicy.dedupeByNameWithMapPriority(itemEntries, new Set(preferredMaps));
}

async function loadBuilderData() {
  BUILDER.version = await window.ApiClient.fetchLatestVersion();

  const champions = await window.ApiClient.fetchChampionIndex(BUILDER.version);
  BUILDER.champions = champions.data;

  const [items, cdtbData] = await Promise.all([
    window.ApiClient.fetchItemIndex(BUILDER.version),
    window.ApiClient.fetchCommunityDragonItems().catch(() => null),
  ]);
  const cdtbByIdFallback = buildCdtbItemsById(cdtbData);

  const shared = getItemLookupShared();
  let sharedCdtbById = null;
  if (shared?.getState) {
    const state = shared.getState();
    state.version = BUILDER.version;
    state.items = items.data;
    if (shared.loadCommunityDragonCalcs) await shared.loadCommunityDragonCalcs();
    sharedCdtbById = state.cdragonById || null;
  }

  const dedupedItemEntries = dedupeBuilderItems(
    Object.entries(items.data).filter(([id, item]) => isPurchasableBuilderItem(id, item)),
    [11],
  ).filter(([id, item]) => item.maps?.[11] || BUILDER_FORCE_INCLUDE_ITEM_IDS.has(String(id)));

  dedupedItemEntries.forEach(([id, item]) => {
    const cdtbEntry = sharedCdtbById?.[String(id)] || cdtbByIdFallback.get(String(id));
    const stats = buildMergedItemStats(item.stats || {}, cdtbEntry);
    const mergedItem = { ...item, stats };
    BUILDER.items[id] = mergedItem;
    (mergedItem.tags || []).forEach((tag) => BUILDER.itemTags.add(tag));
  });

  if (shared?.getState) {
    const state = shared.getState();
    state.version = BUILDER.version;
    state.items = BUILDER.items;
  }
}

function buildCdtbItemsById(cdtbData) {
  const byId = new Map();
  Object.entries(cdtbData || {}).forEach(([key, entry]) => {
    const rawItemId = entry?.itemID
      ?? entry?.mItemDataClient?.mId
      ?? entry?.id
      ?? entry?.mId
      ?? key;
    const itemId = Number(String(rawItemId).match(/(\d+)(?:\D*)$/)?.[1]);
    if (!itemId) return;
    byId.set(String(itemId), entry);
  });
  return byId;
}

function readNumericStat(entry, base, aliases) {
  const entryValues = aliases
    .map((key) => entry?.[key])
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map((v) => Number(v) || 0);
  const baseValues = aliases
    .map((key) => base?.[key])
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map((v) => Number(v) || 0);

  const nonZeroEntry = entryValues.find((v) => v !== 0);
  if (nonZeroEntry !== undefined) return nonZeroEntry;
  const nonZeroBase = baseValues.find((v) => v !== 0);
  if (nonZeroBase !== undefined) return nonZeroBase;

  if (entryValues.length) return entryValues[0];
  if (baseValues.length) return baseValues[0];
  return 0;
}

function buildMergedItemStats(ddragonStats, cdtbEntry) {
  const base = { ...(ddragonStats || {}) };
  if (!cdtbEntry) return base;

  const cdtbStats = {
    FlatHPPoolMod: readNumericStat(cdtbEntry, base, ["mFlatHPPoolMod", "flatHPPoolMod", "FlatHPPoolMod"]),
    FlatMPPoolMod: readNumericStat(cdtbEntry, base, ["mFlatMPPoolMod", "flatMPPoolMod", "FlatMPPoolMod"]),
    FlatPhysicalDamageMod: readNumericStat(cdtbEntry, base, ["mFlatPhysicalDamageMod", "flatPhysicalDamageMod", "FlatPhysicalDamageMod"]),
    FlatMagicDamageMod: readNumericStat(cdtbEntry, base, ["mFlatMagicDamageMod", "flatMagicDamageMod", "FlatMagicDamageMod"]),
    FlatArmorMod: readNumericStat(cdtbEntry, base, ["mFlatArmorMod", "flatArmorMod", "FlatArmorMod"]),
    FlatSpellBlockMod: readNumericStat(cdtbEntry, base, ["mFlatSpellBlockMod", "flatSpellBlockMod", "FlatSpellBlockMod"]),
    PercentAttackSpeedMod: readNumericStat(cdtbEntry, base, ["mPercentAttackSpeedMod", "percentAttackSpeedMod", "PercentAttackSpeedMod"]),
    FlatMovementSpeedMod: readNumericStat(cdtbEntry, base, ["mFlatMovementSpeedMod", "flatMovementSpeedMod", "FlatMovementSpeedMod"]),
    PercentMovementSpeedMod: readNumericStat(cdtbEntry, base, ["mPercentMovementSpeedMod", "percentMovementSpeedMod", "PercentMovementSpeedMod"]),
    FlatHPRegenMod: readNumericStat(cdtbEntry, base, ["mFlatHPRegenMod", "flatHPRegenMod", "FlatHPRegenMod"]),
    FlatMPRegenMod: readNumericStat(cdtbEntry, base, ["mFlatMPRegenMod", "flatMPRegenMod", "FlatMPRegenMod"]),
    PercentBaseHPRegenMod: readNumericStat(cdtbEntry, base, ["mPercentBaseHPRegenMod", "percentBaseHPRegenMod", "mPercentHPRegenMod", "percentHPRegenMod", "PercentBaseHPRegenMod", "PercentHPRegenMod"]),
    PercentBaseMPRegenMod: readNumericStat(cdtbEntry, base, ["mPercentBaseMPRegenMod", "percentBaseMPRegenMod", "mPercentMPRegenMod", "percentMPRegenMod", "PercentBaseMPRegenMod", "PercentMPRegenMod"]),
    FlatCritChanceMod: readNumericStat(cdtbEntry, base, ["mFlatCritChanceMod", "flatCritChanceMod", "FlatCritChanceMod"]),
    PercentCritChanceMod: readNumericStat(cdtbEntry, base, ["mPercentCritChanceMod", "percentCritChanceMod", "PercentCritChanceMod"]),
    FlatCritDamageMod: readNumericStat(cdtbEntry, base, ["mFlatCritDamageMod", "flatCritDamageMod", "FlatCritDamageMod"]),
    PercentCritDamageMod: readNumericStat(cdtbEntry, base, ["mPercentCritDamageMod", "percentCritDamageMod", "PercentCritDamageMod"]),
    FlatAttackRangeMod: readNumericStat(cdtbEntry, base, ["mFlatAttackRangeMod", "flatAttackRangeMod", "FlatAttackRangeMod"]),
    FlatLethalityMod: readNumericStat(cdtbEntry, base, ["mFlatLethalityMod", "flatLethalityMod", "FlatLethalityMod"]),
    PercentArmorPenetrationMod: readNumericStat(cdtbEntry, base, ["mPercentArmorPenetrationMod", "percentArmorPenetrationMod", "PercentArmorPenetrationMod"]),
    FlatMagicPenetrationMod: readNumericStat(cdtbEntry, base, ["mFlatMagicPenetrationMod", "flatMagicPenetrationMod", "FlatMagicPenetrationMod"]),
    PercentMagicPenetrationMod: readNumericStat(cdtbEntry, base, ["mPercentMagicPenetrationMod", "percentMagicPenetrationMod", "PercentMagicPenetrationMod"]),
    PercentLifeStealMod: readNumericStat(cdtbEntry, base, ["mPercentLifeStealMod", "percentLifeStealMod", "PercentLifeStealMod"]),
    PercentOmnivampMod: readNumericStat(cdtbEntry, base, ["mPercentOmnivampMod", "percentOmnivampMod", "PercentOmnivampMod"]),
    PercentPhysicalVampMod: readNumericStat(cdtbEntry, base, ["mPercentPhysicalVampMod", "percentPhysicalVampMod", "PercentPhysicalVampMod"]),
    PercentTenacityMod: readNumericStat(cdtbEntry, base, ["mPercentTenacityMod", "percentTenacityMod", "PercentTenacityMod"]),
  };

  const haste = readNumericStat(cdtbEntry, base, ["mAbilityHasteMod", "mFlatHasteMod", "flatHasteMod", "FlatHasteMod", "FlatAbilityHasteMod", "AbilityHaste"]);
  cdtbStats.FlatHasteMod = haste;
  cdtbStats.FlatAbilityHasteMod = haste;
  cdtbStats.AbilityHaste = haste;

  return { ...base, ...cdtbStats };
}

function renderChampionSelect() {
  Object.keys(BUILDER.champions).forEach((name) => {
    (BUILDER.champions[name].tags || []).forEach((tag) => BUILDER.champTags.add(tag));
  });
  document.getElementById("championPickerBtn").innerHTML = "+";
  document.getElementById("championPickerBtn").setAttribute("aria-label", "Select champion");
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
    .map((name) => `<button class="item-button-icon" data-champ="${name}" title="${name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${BUILDER.champions[name].image.full}" alt="${name}"></button>`)
    .join("");
  renderChampionModalDetail(BUILDER.modalChampFiltered[0] || null);
}

async function renderChampionModalDetail(name) {
  const root = document.getElementById("modalChampDetail");
  if (!name) {
    root.innerHTML = "<p class='text-muted'>No champion found.</p>";
    return;
  }

  const reqId = ++BUILDER.championModalRequestId;
  const c = BUILDER.champions[name];
  root.innerHTML = `<h3>${name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${c.image.full}' alt='${name}'><p><strong>Tags:</strong> ${(c.tags || []).join(", ")}</p><p>${c.blurb}</p><div class='champ-ability-strip'><span class='text-muted'>Loading abilities...</span></div>`;

  if (!BUILDER.championDetailCache[name]) {
    const data = await window.ApiClient.fetchChampionDetails(BUILDER.version, name).catch(() => null);
    BUILDER.championDetailCache[name] = data?.data?.[name] || null;
  }
  if (reqId !== BUILDER.championModalRequestId) return;

  const detail = BUILDER.championDetailCache[name];
  const spells = detail?.spells || [];
  const icons = spells.map((s) => `<img class='champ-ability-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/spell/${s.image.full}' title='${s.name}' alt='${s.name}' loading='lazy'>`).join("");
  root.innerHTML = `<h3>${name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${c.image.full}' alt='${name}'><p><strong>Tags:</strong> ${(c.tags || []).join(", ")}</p><p>${c.blurb}</p><div class='champ-ability-strip'>${icons || "<span class='text-muted'>No abilities found.</span>"}</div>`;
}

function setChampionFromModal(name) {
  setChampion(name);
  closeChampionModal();
}

function getRuneMeta(id) {
  return RUNE_DATA.runeLookup[id] || { name: "Select", desc: "Pick a rune", icon: "" };
}

function runeImgTag(meta, className = "") {
  const fallback = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCc+PHJlY3Qgd2lkdGg9JzY0JyBoZWlnaHQ9JzY0JyByeD0nMzInIGZpbGw9JyMxMTFmM2QnLz48Y2lyY2xlIGN4PSczMicgY3k9JzMyJyByPScyNicgZmlsbD0nIzI3M2Q3MCcvPjwvc3ZnPg==";
  return `<img class="${className}" src="${meta.icon || fallback}" alt="${meta.name}" data-fallback="${fallback}" onerror="this.onerror=null;this.src=this.dataset.fallback">`;
}

function normalizeCdragonChampionPath(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCdragonRecordPath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function resolveCdragonRecord(raw, index, path) {
  if (!path) return null;
  const key = index.get(normalizeCdragonRecordPath(path));
  return key ? raw[key] : null;
}

function extractCdragonSpell(spellRecord) {
  const spell = spellRecord?.mSpell || null;
  if (!spell) return null;
  return {
    dataValues: spell.mDataValues || spell.DataValues || [],
    calculations: spell.mSpellCalculations || {},
  };
}

function extractAbilityDataFromRoot(raw, championName, pathName) {
  const pathIndex = new Map(Object.keys(raw || {}).map((key) => [normalizeCdragonRecordPath(key), key]));
  const rootCandidates = [
    `Characters/${championName}/CharacterRecords/Root`,
    `Characters/${pathName}/CharacterRecords/Root`,
  ];
  const rootPath = rootCandidates
    .map((candidate) => pathIndex.get(candidate))
    .find(Boolean)
    || null;

  const root = rootPath ? raw[rootPath] : null;
  const abilities = Array.isArray(root?.mAbilities) ? root.mAbilities : [];
  if (!abilities.length) return null;

  const slotByIndex = ["q", "w", "e", "r", "p"];
  const bySlot = {};

  abilities.slice(0, slotByIndex.length).forEach((abilityPath, idx) => {
    const slot = slotByIndex[idx];
    const abilityRecord = resolveCdragonRecord(raw, pathIndex, abilityPath);
    const childSpells = Array.isArray(abilityRecord?.mChildSpells) ? abilityRecord.mChildSpells : [];
    if (!childSpells.length) return;

    const primaryChildPath = childSpells[0];
    const primaryChild = resolveCdragonRecord(raw, pathIndex, primaryChildPath);
    let parsed = extractCdragonSpell(primaryChild);

    if (!parsed) {
      const fallbackChild = childSpells
        .map((path) => resolveCdragonRecord(raw, pathIndex, path))
        .map((entry) => extractCdragonSpell(entry))
        .find(Boolean);
      parsed = fallbackChild || null;
    }

    if (!parsed) return;
    bySlot[slot] = parsed;
  });

  return Object.keys(bySlot).length ? bySlot : null;
}

async function loadCdragonAbilityData(championName) {
  const pathName = normalizeCdragonChampionPath(championName);
  const url = `https://raw.communitydragon.org/latest/game/data/characters/${pathName}/${pathName}.bin.json`;
  const raw = await fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!raw) return null;

  return extractAbilityDataFromRoot(raw, championName, pathName)
    || null;
}

async function setChampion(name) {
  const details = await window.ApiClient.fetchChampionDetails(BUILDER.version, name);
  BUILDER.selectedChampion = name;
  BUILDER.championData = details.data[name];
  BUILDER.cdragonAbilityData = await loadCdragonAbilityData(name);
  BUILDER.level = Number(document.getElementById("builderLevel").value) || 1;

  const splashUrl = `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg)`;
  document.body.style.setProperty("--builder-splash-url", splashUrl);
  document.getElementById("runesCard").style.setProperty("--rune-splash-url", RUNE_DATA.paths[BUILDER.runeSelections.primaryPath].splash);
  document.getElementById("championPickerBtn").innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${BUILDER.championData.image.full}" alt="${name}">`;
  document.getElementById("championPickerBtn").setAttribute("aria-label", `Selected champion: ${name}`);

  enforceAbilityRules();
  renderAbilityCards();
  renderStats();
}

function renderItemSlots() {
  const root = document.getElementById("itemSlots");
  root.innerHTML = BUILDER.itemSlots.map((_, i) => `<button class="item-slot-btn" data-slot="${i}"><div id="slotText${i}" class="item-slot-empty">+</div></button>`).join("");
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
    .map((id) => `<button class="item-button-icon" data-item-id="${id}" title="${BUILDER.items[id].name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png" alt="${BUILDER.items[id].name}"></button>`)
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
  const statNameMap = {
    FlatHPPoolMod: "Health",
    FlatMPPoolMod: "Mana",
    FlatHPRegenMod: "HP/5",
    FlatMPRegenMod: "MP/5",
    PercentBaseHPRegenMod: "Base HP Regen %",
    PercentBaseMPRegenMod: "Base MP Regen %",
    FlatPhysicalDamageMod: "Attack Damage",
    FlatMagicDamageMod: "Ability Power",
    FlatArmorMod: "Armor",
    FlatSpellBlockMod: "Magic Resist",
    PercentAttackSpeedMod: "Attack Speed %",
    FlatMovementSpeedMod: "Move Speed",
    PercentMovementSpeedMod: "Move Speed %",
    FlatCritChanceMod: "Crit Chance",
    PercentCritChanceMod: "Crit Chance %",
    FlatCritDamageMod: "Crit Damage",
    PercentCritDamageMod: "Crit Damage %",
    FlatAttackRangeMod: "Attack Range",
    FlatHasteMod: "Ability Haste",
    FlatAbilityHasteMod: "Ability Haste",
    AbilityHaste: "Ability Haste",
  };
  const pctStats = new Set(["PercentBaseHPRegenMod", "PercentBaseMPRegenMod", "PercentAttackSpeedMod", "PercentMovementSpeedMod", "PercentCritChanceMod", "PercentCritDamageMod"]);
  const statBuckets = new Map();
  const aliasCanonical = {
    FlatAbilityHasteMod: "FlatHasteMod",
    AbilityHaste: "FlatHasteMod",
    PercentHPRegenMod: "PercentBaseHPRegenMod",
    PercentMPRegenMod: "PercentBaseMPRegenMod",
  };
  const seenCanonical = new Set();
  Object.entries(item.stats || {})
    .filter(([, v]) => Number(v) !== 0)
    .forEach(([k, v]) => {
      const canonical = aliasCanonical[k] || k;
      if (seenCanonical.has(canonical)) return;
      seenCanonical.add(canonical);
      const label = statNameMap[canonical] || statNameMap[k] || canonical;
      const isPct = pctStats.has(canonical) || pctStats.has(k);
      const bucketKey = `${label}::${isPct ? 'pct' : 'flat'}`;
      const current = statBuckets.get(bucketKey) || { label, isPct, value: 0 };
      current.value += Number(v) || 0;
      statBuckets.set(bucketKey, current);
    });
  const statLines = Array.from(statBuckets.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((row) => `<div>${row.label}: ${row.isPct ? `${(row.value * 100).toFixed(1)}%` : row.value}</div>`)
    .join("");
  const passiveLabels = extractPassiveLabelsFromText(stripHtml(item.description || ""));
  const passiveLines = passiveLabels.length
    ? `<div class='mt-10'><strong>Passives</strong>${passiveLabels.map((label) => `<div>${label}</div>`).join("")}</div>`
    : "";

  const shared = getItemLookupShared();
  let enhancedDescription = item.description || "";
  let extractedFormulaRows = "";
  if (shared) {
    const resolved = shared.resolveDescriptionFormulas ? shared.resolveDescriptionFormulas(item, enhancedDescription) : enhancedDescription;
    let lines = [];
    if (shared.buildExtractedFormulas) {
      const extracted = shared.buildExtractedFormulas(String(id));
      lines = extracted?.lines || [];
    }
    if (shared.injectDamageFormulaText) enhancedDescription = shared.injectDamageFormulaText(resolved, lines, String(id));
    else enhancedDescription = resolved;
    if (shared.injectActiveCooldown) enhancedDescription = shared.injectActiveCooldown(enhancedDescription, shared.inferActiveCooldownSeconds ? shared.inferActiveCooldownSeconds(String(id)) : null);
    if (shared.emphasizeAbilityHeaders) enhancedDescription = shared.emphasizeAbilityHeaders(enhancedDescription);
    if (shared.enhanceActiveTooltip) enhancedDescription = shared.enhanceActiveTooltip(enhancedDescription);
    if (shared.colorizeStatsInHtml) enhancedDescription = shared.colorizeStatsInHtml(enhancedDescription);

    if (lines.length) {
      extractedFormulaRows = `<div class='mt-10'><strong>Effects</strong>${lines.map((line) => `<div>${line.name}: ${line.formula}</div>`).join("")}</div>`;
    }
  }

  root.innerHTML = `<h3>${item.name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png' alt='${item.name}'><p><strong>Cost:</strong> ${item.gold?.total ?? 0}g</p><div>${statLines}</div>${passiveLines}${extractedFormulaRows}<div class='mt-10'>${enhancedDescription}</div><button class='btn btn-sm mt-10' data-set-item-id='${id}'>Select this item</button><button class='btn btn-sm mt-10 ml-5' data-set-item-id=''>Clear slot</button>`;
}

function setSlotItem(itemId) {
  if (BUILDER.activeSlot === null) return;
  BUILDER.itemSlots[BUILDER.activeSlot] = itemId;
  refreshSlotLabels();
  renderStats();
  renderAbilityCards();
  closeItemModal();
}

function abilityMaxByLevel(level, spellKey) {
  return window.AbilityRules.abilityMaxByLevel(level, spellKey);
}

function enforceAbilityRules() {
  BUILDER.abilityRanks = window.AbilityRules.enforceAbilityRules(BUILDER.level, BUILDER.abilityRanks);
}

function parseByRank(valueBurn, rank) {
  if (!rank) return "-";
  if (!valueBurn || valueBurn === "0") return "-";
  const parts = String(valueBurn).split("/");
  return parts[Math.max(0, Math.min(parts.length - 1, rank - 1))] || parts[0] || "-";
}

function stripHtml(input) {
  return String(input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractPassiveLabelsFromText(text) {
  const labels = [];
  const re = /(?:UNIQUE\s+)?PASSIVE\s*(?:-|:)?\s*([A-Za-z0-9' ]+)?/gi;
  let match;
  while ((match = re.exec(text))) {
    const raw = String(match[1] || "").trim();
    labels.push(raw || "Passive");
  }
  return Array.from(new Set(labels));
}

/**
 * Resolves an item description using shared Item Lookup transformers so formulas/cooldowns are concrete.
 * @param {object} item Data Dragon item payload.
 * @param {string} itemId Numeric item id.
 * @returns {string} Enhanced item tooltip HTML.
 */
function resolveItemDescriptionHtml(item, itemId = "") {
  const shared = getItemLookupShared();
  let html = String(item?.description || "");
  if (!shared) return html;
  if (shared.resolveDescriptionFormulas) html = shared.resolveDescriptionFormulas(item, html);

  let lines = [];
  if (shared.buildExtractedFormulas) {
    const extracted = shared.buildExtractedFormulas(String(itemId || ""));
    lines = extracted?.lines || [];
  }
  if (shared.injectDamageFormulaText) html = shared.injectDamageFormulaText(html, lines, String(itemId || ""));
  if (shared.injectActiveCooldown) {
    const cd = shared.inferActiveCooldownSeconds ? shared.inferActiveCooldownSeconds(String(itemId || "")) : null;
    html = shared.injectActiveCooldown(html, cd);
  }
  if (shared.enhanceActiveTooltip) html = shared.enhanceActiveTooltip(html);
  return html;
}

/**
 * Extracts passive/on-hit/unique sections from an item tooltip and returns display-ready rows.
 * @param {string} descriptionHtml Tooltip html.
 * @returns {{label: string, impact: string}[]} Passive rows.
 */
function extractPassiveDescriptionsFromHtml(descriptionHtml) {
  const html = String(descriptionHtml || "");
  if (!html) return [];

  const normalized = html.replace(/<br\s*\/?>/gi, "\n");
  const rows = [];
  const sectionRe = /<(passive|onhit|unique)>\s*([^<]*)\s*<\/\1>\s*([\s\S]*?)(?=<(?:passive|onhit|unique|active)>|$)/gi;
  let match;
  while ((match = sectionRe.exec(normalized))) {
    const type = String(match[1] || "").toUpperCase();
    const label = stripHtml(match[2] || "").trim() || type;
    const desc = stripHtml(match[3] || "").trim();
    if (!desc) continue;
    rows.push({ label, impact: desc });
  }

  if (rows.length) return rows;

  const fallback = stripHtml(html);
  const labelFallbacks = extractPassiveLabelsFromText(fallback);
  return labelFallbacks.map((label) => ({ label, impact: fallback }));
}

function buildPassiveLedger(itemTotals, runeTotals) {
  const selectedItems = BUILDER.itemSlots
    .filter((id) => id && BUILDER.items[id])
    .map((id) => ({ id: String(id), item: BUILDER.items[id] }));
  const passiveEffects = [];
  const additiveMods = { ad: 0, ap: 0 };
  let apMultiplier = 1;
  let hasRabadon = false;

  selectedItems.forEach(({ id, item }) => {
    const resolvedDescriptionHtml = resolveItemDescriptionHtml(item, id);
    extractPassiveDescriptionsFromHtml(resolvedDescriptionHtml).forEach(({ label, impact }) => {
      passiveEffects.push({ source: "Item", owner: item.name, label, impact });
    });

    if (id === "3089") {
      hasRabadon = true;
      apMultiplier *= 1.30;
      passiveEffects.push({ source: "Item", owner: item.name, label: "Magical Opus", impact: "AP multiplier queued (applied after additive passives)" });
    }

    if (id === "3042" && BUILDER.championData) {
      const b = BUILDER.championData.stats;
      const L = BUILDER.level;
      const totalMana = b.mp + b.mpperlevel * (L - 1) + itemTotals.mp + runeTotals.mp;
      const bonusAd = totalMana * 0.02;
      if (bonusAd > 0) {
        additiveMods.ad += bonusAd;
        passiveEffects.push({ source: "Item", owner: item.name, label: "Awe", impact: `+${bonusAd.toFixed(1)} AD (2% max mana)` });
      }
    }

    if (id === "3040" && BUILDER.championData) {
      const b = BUILDER.championData.stats;
      const L = BUILDER.level;
      const baseMana = b.mp + b.mpperlevel * (L - 1);
      const bonusMana = Math.max(0, itemTotals.mp + runeTotals.mp);
      const bonusAp = bonusMana * 0.02;
      if (bonusAp > 0) {
        additiveMods.ap += bonusAp;
        passiveEffects.push({ source: "Item", owner: item.name, label: "Awe", impact: `+${bonusAp.toFixed(1)} AP (2% bonus mana)` });
      }
      if (baseMana > 0) {
        passiveEffects.push({ source: "Item", owner: item.name, label: "Mana context", impact: `Base mana ${baseMana.toFixed(1)}` });
      }
    }
  });

  if (BUILDER.championData?.passive) {
    const champPassiveName = BUILDER.championData.passive.name || "Passive";
    passiveEffects.push({ source: "Champion", owner: BUILDER.selectedChampion, label: champPassiveName, impact: "Champion passive identified" });
  }

  const apBeforeMultiplier = itemTotals.ap + runeTotals.ap + additiveMods.ap;
  const apAmp = Math.max(0, apBeforeMultiplier * (apMultiplier - 1));
  const statMods = {
    ad: additiveMods.ad,
    ap: additiveMods.ap + apAmp,
  };

  if (hasRabadon && apAmp > 0) {
    passiveEffects.push({ source: "Item", owner: "Rabadon's Deathcap", label: "Magical Opus", impact: `+${apAmp.toFixed(1)} AP (multipliers applied last)` });
  }

  return { passiveEffects, statMods };
}

function computeDerivedBuildStats() {
  if (!BUILDER.championData) return null;
  const base = BUILDER.championData.stats;
  const item = getItemStats();
  const rune = getRuneStats();
  const L = BUILDER.level;

  const ledger = buildPassiveLedger(item, rune);
  const passiveAd = ledger.statMods.ad;
  const passiveAp = ledger.statMods.ap;

  const hp = (base.hp + base.hpperlevel * (L - 1) + item.hp + rune.hp);
  const baseHp5 = base.hpregen + base.hpregenperlevel * (L - 1);
  const hp5 = (baseHp5 * (1 + item.hp5PctBase / 100) + item.hp5 + rune.hp5);
  const mp = (base.mp + base.mpperlevel * (L - 1) + item.mp + rune.mp);
  const baseMp5 = base.mpregen + base.mpregenperlevel * (L - 1);
  const mp5 = (baseMp5 * (1 + item.mp5PctBase / 100) + item.mp5 + rune.mp5);
  const ad = (base.attackdamage + base.attackdamageperlevel * (L - 1) + item.ad + rune.ad + passiveAd);
  const ap = item.ap + rune.ap + passiveAp;
  const armor = (base.armor + base.armorperlevel * (L - 1) + item.armor + rune.armor);
  const mr = (base.spellblock + base.spellblockperlevel * (L - 1) + item.mr + rune.mr);
  const asTotal = base.attackspeed * (1 + (base.attackspeedperlevel * (L - 1)) / 100) * (1 + (item.asPct + rune.asPct) / 100);
  const abilityHaste = item.haste + rune.haste;
  const critChance = (base.crit + base.critperlevel * (L - 1) + item.critChance + rune.critChance);
  const critDamage = (base.critdamage ? base.critdamage * 100 : 175) + item.critDamage + rune.critDamage;
  const attackRange = (base.attackrange || 0) + item.attackRange + rune.attackRange;
  const moveSpeed = (base.movespeed + item.msFlat + rune.msFlat) * (1 + (item.msPct + rune.msPct) / 100);

  return {
    base,
    item,
    rune,
    level: L,
    hp,
    hp5,
    mp,
    mp5,
    ad,
    ap,
    armor,
    mr,
    asTotal,
    abilityHaste,
    critChance,
    critDamage,
    attackRange,
    moveSpeed,
    passiveLedger: ledger,
  };
}

function renderPassivePanel(passiveLedger) {
  const root = document.getElementById("passiveModalList");
  if (!root) return;
  if (!passiveLedger) {
    root.innerHTML = "<div class='ability-card'><p class='text-muted'>Select a champion to inspect passive effects.</p></div>";
    return;
  }
  const rows = passiveLedger.passiveEffects
    .map((effect) => `<div class='ability-card'><strong>${effect.source}: ${effect.owner}</strong><div>${effect.label}</div>${effect.impact ? `<div class='text-muted'>${effect.impact}</div>` : ""}</div>`)
    .join("");
  root.innerHTML = rows || "<div class='ability-card'><p class='text-muted'>No passive effects detected.</p></div>";
}

function togglePassivePanel() {
  document.getElementById("passiveModal").classList.remove("hidden");
  const computed = computeDerivedBuildStats();
  renderPassivePanel(computed?.passiveLedger || null);
}

function closePassiveModal() {
  document.getElementById("passiveModal").classList.add("hidden");
}

function getChampionPassiveRangeBonus() {
  if (!BUILDER.championData) return 0;
  if (BUILDER.selectedChampion === "Tristana") {
    return ((Number(BUILDER.level) || 1) - 1) * (136 / 17);
  }
  return 0;
}

/**
 * Computes auto-attack profile from derived stats and supported on-hit item passives.
 * @param {ReturnType<typeof computeDerivedBuildStats>} computed Derived build stats.
 * @returns {{autoAttackDamage:number,attackDps:number,attackRange:number,onHitRows:string[]}}
 */
function computeAutoAttackProfile(computed) {
  const item = computed.item;
  const ap = computed.ap;
  const baseOnHitRows = [];
  let onHitDamage = 0;

  BUILDER.itemSlots.forEach((id) => {
    if (!id) return;
    if (id === "3115") {
      const v = 15 + 0.2 * ap;
      onHitDamage += v;
      baseOnHitRows.push(`Nashor's Tooth ${v.toFixed(1)}`);
    }
    if (id === "3091") {
      const v = 45;
      onHitDamage += v;
      baseOnHitRows.push(`Wit's End ${v.toFixed(1)}`);
    }
    if (id === "3153") {
      const v = 30;
      onHitDamage += v;
      baseOnHitRows.push(`Blade of the Ruined King ${v.toFixed(1)}+HP%`);
    }
    if (id === "3100") {
      const v = 1.5 * computed.base.attackdamage;
      onHitDamage += v;
      baseOnHitRows.push(`Lich Bane ${v.toFixed(1)}`);
    }
  });

  const autoAttackDamage = computed.ad + onHitDamage;
  const attackDps = autoAttackDamage * computed.asTotal;
  const attackRange = computed.attackRange + getChampionPassiveRangeBonus();
  return { autoAttackDamage, attackDps, attackRange, onHitRows: baseOnHitRows };
}

function summarizePassiveNumericData(cdragonPassive) {
  const rows = (cdragonPassive?.dataValues || [])
    .map((d) => {
      const vals = (d.mValues || []).map((v) => Number(v) || 0).filter((v, i, arr) => Number.isFinite(v) && (v !== 0 || arr.every((x) => x === 0)));
      if (!vals.length) return null;
      const nonZero = vals.filter((v) => v !== 0);
      if (!nonZero.length) return null;
      const shown = vals.slice(0, 6).map((v) => (Number.isInteger(v) ? String(v) : v.toFixed(2))).join("/");
      const label = String(d.mName || "Value").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
      return `${label}: ${shown}`;
    })
    .filter(Boolean)
    .slice(0, 3);
  return rows;
}

function buildDetailedPassiveText() {
  if (!BUILDER.championData?.passive) return "";
  const passive = BUILDER.championData.passive;
  const template = String(passive.description || "");
  const tokenRe = /{{\s*([^{}]+?)\s*}}/g;
  const cdragonPassive = BUILDER.cdragonAbilityData?.p || null;

  if (!cdragonPassive) return template;

  const dummySpell = { effectBurn: [], vars: [], costType: "" };
  const ctx = {
    spell: dummySpell,
    safeRank: 1,
    stats: getComputedChampionStatsForTooltips() || {
      ap: 0, totalAd: 0, bonusAd: 0, armor: 0, bonusArmor: 0, mr: 0, bonusMr: 0, hp: 0, bonusHp: 0, mp: 0, bonusMp: 0,
    },
    vars: [],
    cdragonSpell: cdragonPassive,
    calcLookup: cdragonPassive.calculations || {},
    knownTokens: {
      championlevel: Number(BUILDER.level) || 1,
    },
  };

  const resolved = template.replace(tokenRe, (full, tokenRaw) => {
    const resolved = resolveAbilityToken(tokenRaw, ctx);
    return resolved ? resolved.html : full;
  });

  const numericSummary = summarizePassiveNumericData(cdragonPassive);
  if (!numericSummary.length) return resolved;
  return `${resolved}<br><span class="ability-detail-eq">${numericSummary.join(" • ")}</span>`;
}

function getComputedChampionStatsForTooltips() {
  const computed = computeDerivedBuildStats();
  if (!computed) return null;
  const { base, item, rune, level: L, ad, ap, armor, mr, hp, mp } = computed;

  const baseAd = base.attackdamage + base.attackdamageperlevel * (L - 1);
  const totalAd = ad;
  const baseAp = 0;
  const totalAp = ap;
  const baseArmor = base.armor + base.armorperlevel * (L - 1);
  const totalArmor = armor;
  const baseMr = base.spellblock + base.spellblockperlevel * (L - 1);
  const totalMr = mr;
  const baseHp = base.hp + base.hpperlevel * (L - 1);
  const totalHp = hp;
  const baseMp = base.mp + base.mpperlevel * (L - 1);
  const totalMp = mp;

  return {
    ap: totalAp,
    totalAd,
    bonusAd: totalAd - baseAd,
    armor: totalArmor,
    bonusArmor: totalArmor - baseArmor,
    mr: totalMr,
    bonusMr: totalMr - baseMr,
    hp: totalHp,
    bonusHp: totalHp - baseHp,
    mp: totalMp,
    bonusMp: totalMp - baseMp,
  };
}

function getSpellScalingSource(link, stats) {
  const map = {
    spelldamage: { value: stats.ap, label: "AP" },
    bonusattackdamage: { value: stats.bonusAd, label: "bonus AD" },
    attackdamage: { value: stats.totalAd, label: "AD" },
    armor: { value: stats.armor, label: "Armor" },
    bonusarmor: { value: stats.bonusArmor, label: "bonus Armor" },
    spellblock: { value: stats.mr, label: "MR" },
    bonusspellblock: { value: stats.bonusMr, label: "bonus MR" },
    health: { value: stats.hp, label: "HP" },
    bonushealth: { value: stats.bonusHp, label: "bonus HP" },
    mana: { value: stats.mp, label: "Mana" },
    bonusmana: { value: stats.bonusMp, label: "bonus Mana" },
  };
  return map[String(link || "").toLowerCase()] || null;
}

function getRankedValueIndex(values, rank) {
  if (!Array.isArray(values) || !values.length) return 0;
  const clampedRank = Math.max(0, Number(rank) || 0);
  // CommunityDragon spell arrays commonly have a sentinel value at index 0 and real ranks at 1..N.
  if (values.length >= 7) {
    return Math.max(0, Math.min(values.length - 1, clampedRank));
  }
  return Math.max(0, Math.min(values.length - 1, clampedRank - 1));
}

function getSpellDataValue(dataValues, tokenName, rank) {
  const list = (dataValues || []).find((d) => String(d?.mName || "").toLowerCase() === String(tokenName || "").toLowerCase());
  if (!list || !Array.isArray(list.mValues) || !list.mValues.length) return null;
  const idx = getRankedValueIndex(list.mValues, rank);
  const current = Number(list.mValues[idx]) || 0;

  const rankValues = [];
  for (let i = 1; i <= 5; i += 1) {
    const ridx = getRankedValueIndex(list.mValues, i);
    rankValues.push(Number(list.mValues[ridx] || 0));
  }
  return { current, rankValues };
}

function getCalcStatSource(part, stats) {
  const dataValueName = String(part?.mDataValue || "").toLowerCase();
  if (dataValueName.includes("ap")) return { value: stats.ap, label: "AP" };
  if (dataValueName.includes("bonusad")) return { value: stats.bonusAd, label: "bonus AD" };
  if (dataValueName.includes("ad")) return { value: stats.totalAd, label: "AD" };
  if (dataValueName.includes("health")) return { value: stats.hp, label: "HP" };

  const statCode = Number(part?.mStat);
  if (statCode === 2) return { value: stats.totalAd, label: "AD" };
  if (statCode === 1 || statCode === 0 || Number.isNaN(statCode)) return { value: stats.ap, label: "AP" };
  return { value: stats.ap, label: `Stat ${statCode}` };
}

function formatAbilityStatLabel(label) {
  const m = {
    "bonus ad": "BonusAD",
    ad: "AD",
    ap: "AP",
    hp: "HP",
    mana: "Mana",
    armor: "Armor",
    "bonus armor": "BonusArmor",
    mr: "MR",
    "bonus mr": "BonusMR",
  };
  return m[String(label || "").toLowerCase()] || String(label || "Stat").replace(/\s+/g, "");
}

function formatAbilityNumber(value, isPercent = false) {
  const n = Number(value || 0);
  if (isPercent) return `${n.toFixed(1)}%`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function evaluateCalculationPart(part, dataValues, rank, stats) {
  if (!part) return null;
  const t = String(part?.__type || "");

  if (t === "NumberCalculationPart") {
    const val = Number(part?.mNumber || 0);
    return { value: val, text: formatAbilityNumber(val) };
  }
  if (t === "NamedDataValueCalculationPart") {
    console.log("here");
    const data = getSpellDataValue(dataValues, part?.mDataValue, rank);
    if (!data) return null;
    return { value: data.current, text: formatAbilityNumber(data.current) };
  }
  if (t === "StatByCoefficientCalculationPart") {
    const src = getCalcStatSource(part, stats);
    const coeff = Number(part?.mCoefficient || 0);
    return { value: src.value * coeff, text: `${(coeff * 100).toFixed(0)}% ${formatAbilityStatLabel(src.label)}` };
  }
  if (t === "StatByNamedDataValueCalculationPart") {
    const src = getCalcStatSource(part, stats);
    const coeffData = getSpellDataValue(dataValues, part?.mDataValue, rank);
    const coeff = coeffData ? coeffData.current : 0;
    return { value: src.value * coeff, text: `${(coeff * 100).toFixed(0)}% ${formatAbilityStatLabel(src.label)}` };
  }
  if (t === "ByCharLevelBreakpointsCalculationPart") {
    const level = Math.max(1, Number(BUILDER.level) || 1);
    const base = Number(part?.mLevel1Value || 0);
    const bonus = (part?.mBreakpoints || []).reduce((acc, bp) => {
      if (level >= Number(bp?.mLevel || 1)) return acc + Number(bp?.mAdditionalBonusAtThisLevel || 0);
      return acc;
    }, 0);
    const value = base + bonus;
    return { value, text: formatAbilityNumber(value) };
  }

  const evaluateChildren = () => {
    const out = [];
    const directArrayKeys = ["mSubparts", "mParts"];
    directArrayKeys.forEach((key) => {
      (part?.[key] || []).forEach((sub) => {
        const evaluated = evaluateCalculationPart(sub, dataValues, rank, stats);
        if (evaluated) out.push(evaluated);
      });
    });

    const directPartKeys = ["mPart", "mPart1", "mPart2", "mPart3", "mPart4", "mMultiplier", "mAddend", "mRemainder", "mSubPart"];
    directPartKeys.forEach((key) => {
      const sub = part?.[key];
      if (!sub || typeof sub !== "object") return;
      const evaluated = evaluateCalculationPart(sub, dataValues, rank, stats);
      if (evaluated) out.push(evaluated);
    });

    return out;
  };

  if (/SumOfSubParts/i.test(t)) {
    const parts = evaluateChildren();
    if (!parts.length) return null;
    return { value: parts.reduce((a, b) => a + b.value, 0), text: parts.map((p) => p.text).join(" + ") };
  }

  if (/ProductOfSubParts|Multiply|Multiplicative/i.test(t)) {
    const parts = evaluateChildren();
    if (!parts.length) return null;
    return { value: parts.reduce((acc, row) => acc * row.value, 1), text: parts.map((p) => p.text).join(" × ") };
  }

  if (/Difference|Subtract/i.test(t)) {
    const parts = evaluateChildren();
    if (!parts.length) return null;
    if (parts.length === 1) return parts[0];
    return { value: parts.slice(1).reduce((acc, row) => acc - row.value, parts[0].value), text: `${parts[0].text} - ${parts.slice(1).map((p) => p.text).join(" - ")}` };
  }

  if (/Ratio|Divide/i.test(t)) {
    const parts = evaluateChildren();
    if (parts.length < 2 || parts[1].value === 0) return null;
    return { value: parts[0].value / parts[1].value, text: `${parts[0].text} / ${parts[1].text}` };
  }

  if (/Clamp|Min|Max/i.test(t)) {
    const parts = evaluateChildren();
    if (!parts.length) return null;
    const head = parts[0].value;
    const floor = Number(part?.mFloor ?? part?.mMinimum ?? Number.NEGATIVE_INFINITY);
    const ceil = Number(part?.mCeiling ?? part?.mMaximum ?? Number.POSITIVE_INFINITY);
    const value = Math.min(Math.max(head, floor), ceil);
    return { value, text: formatAbilityNumber(value) };
  }

  if (typeof part?.mCoefficient === "number" || part?.mDataValue || typeof part?.mStat !== "undefined") {
    const src = getCalcStatSource(part, stats);
    const coeffData = part?.mDataValue ? getSpellDataValue(dataValues, part?.mDataValue, rank) : null;
    const coeffRaw = coeffData ? coeffData.current : Number(part?.mCoefficient || 0);
    if (coeffRaw !== 0) {
      return { value: src.value * coeffRaw, text: `${(coeffRaw * 100).toFixed(0)}% ${formatAbilityStatLabel(src.label)}` };
    }
  }

  return null;
}

function applyGameCalculationModifiers(calc, result, dataValues, rank, stats) {
  if (!calc || !result) return result;

  const multiplier = evaluateCalculationPart(calc.mMultiplier, dataValues, rank, stats);
  if (multiplier) {
    const multiplied = result.total * multiplier.value;
    result = {
      ...result,
      total: multiplied,
      terms: [{ text: `(${result.terms.map((t) => t.text).join(" + ")}) × (${multiplier.text})`, value: multiplied }],
    };
  }

  const addend = evaluateCalculationPart(calc.mAddend, dataValues, rank, stats);
  if (addend) {
    const added = result.total + addend.value;
    result = {
      ...result,
      total: added,
      terms: [{ text: `(${result.terms.map((t) => t.text).join(" + ")}) + (${addend.text})`, value: added }],
    };
  }

  const subtrahend = evaluateCalculationPart(calc.mSubtrahend, dataValues, rank, stats);
  if (subtrahend) {
    const subtracted = result.total - subtrahend.value;
    result = {
      ...result,
      total: subtracted,
      terms: [{ text: `(${result.terms.map((t) => t.text).join(" + ")}) - (${subtrahend.text})`, value: subtracted }],
    };
  }

  const divider = evaluateCalculationPart(calc.mDivider, dataValues, rank, stats);
  if (divider && divider.value !== 0) {
    const divided = result.total / divider.value;
    result = {
      ...result,
      total: divided,
      terms: [{ text: `(${result.terms.map((t) => t.text).join(" + ")}) / (${divider.text})`, value: divided }],
    };
  }

  return result;
}

function evaluateGameCalculation(calc, dataValues, rank, stats, calculationsMap = null, seen = new Set()) {
  if (!calc) return null;
  const ctype = String(calc.__type || "");

  if (ctype === "GameCalculationModified") {
    const key = String(calc.mModifiedGameCalculation || "");
    if (!calculationsMap || !key || seen.has(key)) return null;
    seen.add(key);
    const base = evaluateGameCalculation(calculationsMap[key], dataValues, rank, stats, calculationsMap, seen);
    if (!base) return null;
    return applyGameCalculationModifiers(
      calc,
      {
        total: base.total,
        terms: base.terms,
        displayAsPercent: !!calc.mDisplayAsPercent,
      },
      dataValues,
      rank,
      stats,
    );
  }

  if (!Array.isArray(calc.mFormulaParts)) return null;
  const parts = calc.mFormulaParts
    .map((part) => evaluateCalculationPart(part, dataValues, rank, stats))
    .filter(Boolean);
  if (!parts.length) return null;

  return applyGameCalculationModifiers(
    calc,
    {
      total: parts.reduce((a, b) => a + b.value, 0),
      terms: parts.map((p) => ({ text: p.text, value: p.value })),
      displayAsPercent: !!calc.mDisplayAsPercent,
    },
    dataValues,
    rank,
    stats,
  );
}

function normalizeCalcToken(token) {
  return String(token || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findBestCalcTokenMatch(calcLookup, token) {
  const keys = Object.keys(calcLookup || {});
  if (!keys.length) return null;
  const normalizedToken = normalizeCalcToken(token);
  const scored = keys.map((key) => {
    const normalizedKey = normalizeCalcToken(key);
    let score = -1;
    if (normalizedKey === normalizedToken) score = 1000;
    else if (normalizedKey.includes(normalizedToken)) score = 700 - (normalizedKey.length - normalizedToken.length);
    else if (normalizedToken.includes(normalizedKey)) score = 500 - (normalizedToken.length - normalizedKey.length);
    else {
      const strippedToken = normalizedToken.replace(/^(base|bonus|total)/, "").replace(/(damage|value|amount)$/g, "");
      const strippedKey = normalizedKey.replace(/^(base|bonus|total)/, "").replace(/(damage|value|amount)$/g, "");
      if (strippedKey && strippedToken && (strippedKey.includes(strippedToken) || strippedToken.includes(strippedKey))) {
        score = 300 - Math.abs(strippedKey.length - strippedToken.length);
      }
    }
    return { key, score };
  }).filter((row) => row.score >= 0).sort((a, b) => b.score - a.score);
  return scored.length ? scored[0].key : null;
}

function resolveAbilityToken(tokenRaw, ctx) {
  const token = String(tokenRaw || "").trim().toLowerCase();

  const resolveSimple = (baseToken, localCtx = ctx) => {
    let normalizedToken = baseToken;
    if (normalizedToken.endsWith("tooltip")) normalizedToken = normalizedToken.slice(0, -7);
    if (normalizedToken.includes("gamemodeinteger")) return { html: "", numeric: null };

    let calc = localCtx.calcLookup[normalizedToken];
    if (!calc) {
      const fuzzyKey = findBestCalcTokenMatch(localCtx.calcLookup || {}, normalizedToken);
      if (fuzzyKey) calc = localCtx.calcLookup[fuzzyKey];
    }
    if (calc) {
      const shown = calc.displayAsPercent ? (calc.total * 100) : calc.total;
      const eq = calc.terms.map((t) => t.text).join(" + ");
      return {
        html: `<span class="ability-detail-number">${formatAbilityNumber(shown, calc.displayAsPercent)} <span class="ability-detail-eq">(${eq})</span></span>`,
        numeric: shown,
      };
    }

    let dataValue = getSpellDataValue(localCtx.cdragonSpell?.dataValues || [], normalizedToken, localCtx.safeRank);
    if (!dataValue) {
      const dv = (localCtx.cdragonSpell?.dataValues || []).map((d) => String(d?.mName || "").toLowerCase());
      const fuzzyDv = dv.find((k) => k.includes(normalizedToken) || normalizedToken.includes(k));
      if (fuzzyDv) dataValue = getSpellDataValue(localCtx.cdragonSpell?.dataValues || [], fuzzyDv, localCtx.safeRank);
    }
    if (dataValue) {
      return {
        html: `<span class="ability-detail-number">${formatAbilityNumber(dataValue.current)}</span>`,
        numeric: dataValue.current,
      };
    }

    const effectMatch = normalizedToken.match(/^e(\d+)$/);
    if (effectMatch) {
      const idx = Math.max(1, Number(effectMatch[1]));
      const arr = localCtx.spell.effect?.[idx] || [];
      if (!arr.length) return null;
      const rankIndex = Math.max(0, Math.min(arr.length - 1, localCtx.safeRank - 1));
      const current = Number(arr[rankIndex]) || 0;
      return {
        html: `<span class="ability-detail-number">${formatAbilityNumber(current)}</span>`,
        numeric: current,
      };
    }

    if (/^[af]\d+$/.test(baseToken) && localCtx.stats) {
      const v = localCtx.vars[baseToken];
      if (!v) return null;
      const source = getSpellScalingSource(v.link, localCtx.stats);
      if (!source) return null;
      const coeffRaw = Array.isArray(v.coeff) ? (v.coeff[getRankedValueIndex(v.coeff, localCtx.safeRank)] ?? v.coeff[0]) : v.coeff;
      const coeff = Number(coeffRaw || 0);
      const scaled = coeff * source.value;
      return {
        html: `<span class="ability-detail-number">${formatAbilityNumber(scaled)} <span class="ability-detail-eq">(${(coeff * 100).toFixed(0)}% ${formatAbilityStatLabel(source.label)})</span></span>`,
        numeric: scaled,
      };
    }

    if (Object.prototype.hasOwnProperty.call(localCtx.knownTokens, baseToken)) {
      const v = localCtx.knownTokens[baseToken];
      if (v === "" || v === "-") return { html: "", numeric: null };
      const parsed = Number(v);
      return {
        html: `<span class="ability-detail-number">${v}</span>`,
        numeric: Number.isFinite(parsed) ? parsed : null,
      };
    }

    return null;
  };

  const isNextLevel = token.endsWith("nl");
  const baseToken = isNextLevel ? token.slice(0, -2) : token;
  const nextRank = Math.min(5, ctx.safeRank + 1);
  const simpleCtx = { ...ctx, safeRank: isNextLevel ? nextRank : ctx.safeRank };

  const multMatch = baseToken.match(/^([a-z0-9_]+)\*(-?\d+(?:\.\d+)?)$/);
  if (multMatch) {
    const left = resolveSimple(multMatch[1], simpleCtx);
    if (!left || left.numeric === null) return null;
    const mult = Number(multMatch[2]);
    const value = left.numeric * mult;
    return {
      html: `<span class="ability-detail-number">${formatAbilityNumber(value)}</span>`,
      numeric: value,
    };
  }

  const direct = resolveSimple(baseToken, simpleCtx);
  if (direct) return direct;

  return null;
}

function buildDetailedAbilityText(spell, rank, spellKey) {
  const raw = spell.tooltip || spell.description || "";
  const rawRank = Number(rank) || 0;
  
  if (rawRank <= 0) return spell.description || "";
  
  const safeRank = Math.max(1, rawRank);
  const stats = getComputedChampionStatsForTooltips();
  const vars = Object.fromEntries((spell.vars || []).map((v) => [String(v.key || "").toLowerCase(), v]));
  
  const cdragonSpell = BUILDER.cdragonAbilityData?.[spellKey] || null;
  const calcEntries = Object.entries(cdragonSpell?.calculations || {}).map(([k, calc]) => {
    const evaluated = stats ? evaluateGameCalculation(calc, cdragonSpell?.dataValues || [], safeRank, stats, cdragonSpell?.calculations || {}) : null;
    return [String(k).toLowerCase(), evaluated];
  });
  const calcLookup = Object.fromEntries(calcEntries);

  const knownTokens = {
    cost: parseByRank(spell.costBurn, safeRank),
    cooldown: parseByRank(spell.cooldownBurn, safeRank),
    range: parseByRank(spell.rangeBurn, safeRank),
    abilityresourcename: (spell.costType || "").replace(/<[^>]+>/g, "").replace(/[{}`]/g, "").trim() || "Mana",
    spellmodifierdescriptionappend: "",
  };

  const ctx = { spell, safeRank, stats, vars, cdragonSpell, calcLookup, knownTokens };
  const replaced = raw.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, tokenRaw) => {
    const resolved = resolveAbilityToken(tokenRaw, ctx);
    return resolved ? resolved.html : "";
  });

  return replaced
    .replace(/<physicalDamage>/gi, '<span class="ability-damage-physical">')
    .replace(/<\/physicalDamage>/gi, '</span>')
    .replace(/<magicDamage>/gi, '<span class="ability-damage-magic">')
    .replace(/<\/magicDamage>/gi, '</span>')
    .replace(/<trueDamage>/gi, '<span class="ability-damage-true">')
    .replace(/<\/trueDamage>/gi, '</span>')
    .replace(/<healing>/gi, '<span class="ability-healing">')
    .replace(/<\/healing>/gi, '</span>')
    .replace(/<status>/gi, '<span class="ability-status">')
    .replace(/<\/status>/gi, '</span>')
    .replace(/[{}]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function runAbilityTagResolutionAudit(sampleChampionNames = null) {
  const names = Array.isArray(sampleChampionNames) && sampleChampionNames.length
    ? sampleChampionNames
    : Object.keys(BUILDER.champions || {});
  const report = [];

  for (const name of names) {
    const details = await window.ApiClient.fetchChampionDetails(BUILDER.version, name).catch(() => null);
    const champ = details?.data?.[name];
    if (!champ) continue;
    const cdragonAbilityData = await loadCdragonAbilityData(name);

    champ.spells.forEach((spell, idx) => {
      const spellKey = ["q", "w", "e", "r"][idx];
      const tooltip = spell.tooltip || "";
      const tokens = Array.from(tooltip.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)).map((m) => String(m[1] || "").trim());

      const stats = {
        ap: 0,
        totalAd: champ.stats.attackdamage,
        bonusAd: 0,
        armor: champ.stats.armor,
        bonusArmor: 0,
        mr: champ.stats.spellblock,
        bonusMr: 0,
        hp: champ.stats.hp,
        bonusHp: 0,
        mp: champ.stats.mp,
        bonusMp: 0,
      };
      const vars = Object.fromEntries((spell.vars || []).map((v) => [String(v.key || "").toLowerCase(), v]));
      const cdragonSpell = cdragonAbilityData?.[spellKey] || null;
      const safeRank = 1;
      const calcLookup = Object.fromEntries(Object.entries(cdragonSpell?.calculations || {}).map(([k, calc]) => {
        const evaluated = evaluateGameCalculation(calc, cdragonSpell?.dataValues || [], safeRank, stats, cdragonSpell?.calculations || {});
        return [String(k).toLowerCase(), evaluated];
      }));
      const knownTokens = {
        cost: parseByRank(spell.costBurn, safeRank),
        cooldown: parseByRank(spell.cooldownBurn, safeRank),
        range: parseByRank(spell.rangeBurn, safeRank),
        abilityresourcename: (spell.costType || "").replace(/<[^>]+>/g, "").replace(/[{}`]/g, "").trim() || "Mana",
        spellmodifierdescriptionappend: "",
      };
      const ctx = { spell, safeRank, stats, vars, cdragonSpell, calcLookup, knownTokens };

      const unresolved = tokens.filter((tokenRaw) => !resolveAbilityToken(tokenRaw, ctx)).map((t) => t.toLowerCase());
      if (unresolved.length) {
        report.push({ champion: name, spell: spellKey.toUpperCase(), unresolved: Array.from(new Set(unresolved)) });
      }
    });
  }

  console.groupCollapsed(`Ability tag resolution audit: ${report.length} issue(s)`);
  report.forEach((row) => console.log(`${row.champion} ${row.spell}:`, row.unresolved.join(", ")));
  console.groupEnd();
  return report;
}
window.runAbilityTagResolutionAudit = runAbilityTagResolutionAudit;

function renderAbilityCards() {
  const root = document.getElementById("abilityCards");
  if (!BUILDER.championData) {
    root.innerHTML = "<div class='ability-card'><p class='text-muted'>Select a champion to view abilities.</p></div>";
    document.getElementById("abilityRuleHint").textContent = "";
    return;
  }

  const champ = BUILDER.championData;
  const computed = computeDerivedBuildStats();
  const attack = computed ? computeAutoAttackProfile(computed) : null;
  const passiveText = buildDetailedPassiveText();
  const passive = `<div class="ability-card ability-passive-card"><div class="ability-head"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/passive/${champ.passive.image.full}" alt="${champ.passive.name}"><strong>Passive - ${champ.passive.name}</strong></div><p class="ability-detail-text">${passiveText}</p></div>`;
  const attackCard = `<div class="ability-card ability-attack-card"><div class="ability-head"><strong>Attack</strong></div>
  <div><strong>Auto-Attack Damage:</strong> ${attack ? `${attack.autoAttackDamage.toFixed(1)} (${computed.ad.toFixed(1)}${attack.onHitRows.map((r) => ` + ${r}`).join("") || ""})` : "-"}</div>
  <div><strong>Attack DPS:</strong> ${attack ? `${attack.attackDps.toFixed(1)} (${attack.autoAttackDamage.toFixed(1)} × ${computed.asTotal.toFixed(3)})` : "-"}</div>
  <div><strong>Attack Range:</strong> ${attack ? attack.attackRange.toFixed(1) : "-"}</div></div>`;
  const abilityHaste = getItemStats().haste + getRuneStats().haste;
  const cooldownReductionPct = abilityHaste > 0 ? (abilityHaste / (abilityHaste + 100)) : 0;

  const spells = champ.spells.map((spell, i) => {
    const key = ["q", "w", "e", "r"][i];
    const max = abilityMaxByLevel(BUILDER.level, key);
    const opts = Array.from({ length: max + 1 }, (_, idx) => `<option value="${idx}">${idx}</option>`).join("");
    const rank = BUILDER.abilityRanks[key];
    const cdBase = parseByRank(spell.cooldownBurn, rank);
    const cdNumeric = Number(cdBase);
    const cd = Number.isFinite(cdNumeric) && cdNumeric > 0
      ? `${(cdNumeric * (1 - cooldownReductionPct)).toFixed(2)} (base ${cdNumeric.toFixed(2)})`
      : cdBase;
    const cost = parseByRank(spell.costBurn, rank);
    const range = parseByRank(spell.rangeBurn, rank);
    const detail = buildDetailedAbilityText(spell, rank, key);
    return `<div class="ability-card"><div class="ability-head"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/spell/${spell.image.full}" alt="${spell.name}"><strong>${key.toUpperCase()} - ${spell.name}</strong></div><div class="ability-rank-row"><label class="label">Rank<select class="form-control" id="rank_${key}">${opts}</select></label></div><p class="ability-detail-text">${detail}</p><div><strong>Cooldown:</strong> ${cd}</div><div><strong>Cost:</strong> ${cost}</div><div><strong>Range:</strong> ${range}</div></div>`;
  }).join("");

  root.innerHTML = passive + attackCard + spells;
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
  const totals = {
    hp: 0, hp5: 0, hp5PctBase: 0, mp: 0, mp5: 0, mp5PctBase: 0, ad: 0, ap: 0, armor: 0, mr: 0,
    haste: 0, asPct: 0, critChance: 0, critDamage: 0, attackRange: 0, msFlat: 0, msPct: 0,
    arPenFlat: 0, arPenPct: 0, mrPenFlat: 0, mrPenPct: 0, physicalVamp: 0, omniVamp: 0, tenacity: 0,
  };
  BUILDER.itemSlots.forEach((id) => {
    if (!id) return;
    const s = BUILDER.items[id].stats || {};
    totals.hp += s.FlatHPPoolMod || 0;
    totals.mp += s.FlatMPPoolMod || 0;
    totals.hp5 += s.FlatHPRegenMod || 0;
    totals.hp5PctBase += ((s.PercentBaseHPRegenMod || s.PercentHPRegenMod || 0) * 100);
    totals.mp5 += s.FlatMPRegenMod || 0;
    totals.mp5PctBase += ((s.PercentBaseMPRegenMod || s.PercentMPRegenMod || 0) * 100);
    totals.ad += s.FlatPhysicalDamageMod || 0;
    totals.ap += s.FlatMagicDamageMod || 0;
    totals.armor += s.FlatArmorMod || 0;
    totals.mr += s.FlatSpellBlockMod || 0;
    totals.haste += Number(
      s.FlatHasteMod
      ?? s.FlatAbilityHasteMod
      ?? s.AbilityHaste
      ?? s.FlatCooldownReduction
      ?? 0,
    );
    totals.asPct += (s.PercentAttackSpeedMod || 0) * 100;
    totals.critChance += ((s.FlatCritChanceMod || 0) + (s.PercentCritChanceMod || 0)) * 100;
    totals.critDamage += ((s.FlatCritDamageMod || 0) + (s.PercentCritDamageMod || 0)) * 100;
    totals.attackRange += s.FlatAttackRangeMod || 0;
    totals.msFlat += s.FlatMovementSpeedMod || 0;
    totals.msPct += (s.PercentMovementSpeedMod || 0) * 100;
    totals.arPenFlat += s.FlatLethalityMod || 0;
    totals.arPenPct += (s.PercentArmorPenetrationMod || 0) * 100;
    totals.mrPenFlat += s.FlatMagicPenetrationMod || 0;
    totals.mrPenPct += (s.PercentMagicPenetrationMod || 0) * 100;
    totals.physicalVamp += ((s.PercentPhysicalVampMod || 0) + (s.PercentLifeStealMod || 0)) * 100;
    totals.omniVamp += (s.PercentOmnivampMod || 0) * 100;
    totals.tenacity += (s.PercentTenacityMod || 0) * 100;
  });
  return totals;
}

function getRuneStats() {
  const totals = {
    hp: 0, hp5: 0, hp5PctBase: 0, mp: 0, mp5: 0, mp5PctBase: 0, ad: 0, ap: 0, armor: 0, mr: 0,
    haste: 0, asPct: 0, critChance: 0, critDamage: 0, attackRange: 0, msFlat: 0, msPct: 0,
    arPenFlat: 0, arPenPct: 0, mrPenFlat: 0, mrPenPct: 0, physicalVamp: 0, omniVamp: 0, tenacity: 0,
  };
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
  const emptyRows = [
    { name: "HP", icon: "❤️" },
    { name: "MP", icon: "🔷" },
    { name: "HP/5", icon: "💚" },
    { name: "MP/5", icon: "💙" },
    { name: "AD", icon: "🗡️" },
    { name: "AP", icon: "✨" },
    { name: "Range", icon: "🏹" },
    { name: "AH", icon: "⏱️" },
    { name: "Arm", icon: "🛡️" },
    { name: "MR", icon: "🔮" },
    { name: "AS", icon: "⚡" },
    { name: "MS", icon: "👟" },
    { name: "Crit %", icon: "🎯" },
    { name: "Crit Dmg", icon: "💥" },
    { name: "ARPen", icon: "🪓" },
    { name: "MRPen", icon: "🔹" },
    { name: "Lifesteal", icon: "🩸" },
    { name: "Tenacity", icon: "🦶" },
  ];
  const renderPairedRows = (rows) => {
    const pairRows = [];
    for (let i = 0; i < rows.length; i += 2) {
      pairRows.push([rows[i], rows[i + 1] || null]);
    }
    return `<table class="stats-table">${pairRows.map(([left, right]) => `<tr><td class="stats-label"><span class="stat-icon">${left.icon}</span>${left.name}</td><td class="stats-value" title="${left.eq || ''}">${left.displayValue}</td>${right ? `<td class="stats-label"><span class="stat-icon">${right.icon}</span>${right.name}</td><td class="stats-value" title="${right.eq || ''}">${right.displayValue}</td>` : '<td class="stats-label"></td><td class="stats-value"></td>'}</tr>`).join("")}</table>`;
  };

  if (!BUILDER.championData) {
    root.innerHTML = renderPairedRows(emptyRows.map((row) => ({ ...row, displayValue: "--" })));
    renderPassivePanel(null);
    return;
  }

  const computed = computeDerivedBuildStats();
  if (!computed) return;
  const {
    base, item, rune, level: L,
    hp, hp5, mp, mp5, ad, ap, armor, mr,
    asTotal, abilityHaste, critChance, critDamage, attackRange, moveSpeed,
    passiveLedger,
  } = computed;

  const rows = [
    { name: "HP", icon: "❤️", value: hp, eq: `${base.hp.toFixed(1)} + ${base.hpperlevel.toFixed(1)}*${L - 1} + ${item.hp.toFixed(1)} + ${rune.hp.toFixed(1)}` },
    { name: "MP", icon: "🔷", value: mp, eq: `${base.mp.toFixed(1)} + ${base.mpperlevel.toFixed(1)}*${L - 1} + ${item.mp.toFixed(1)} + ${rune.mp.toFixed(1)}` },
    { name: "HP/5", icon: "💚", value: hp5, eq: `(${base.hpregen.toFixed(1)} + ${base.hpregenperlevel.toFixed(2)}*${L - 1}) * (1 + ${item.hp5PctBase.toFixed(1)}%) + ${item.hp5.toFixed(1)} + ${rune.hp5.toFixed(1)}` },
    { name: "MP/5", icon: "💙", value: mp5, eq: `(${base.mpregen.toFixed(1)} + ${base.mpregenperlevel.toFixed(2)}*${L - 1}) * (1 + ${item.mp5PctBase.toFixed(1)}%) + ${item.mp5.toFixed(1)} + ${rune.mp5.toFixed(1)}` },
    { name: "AD", icon: "🗡️", value: ad, eq: `${base.attackdamage.toFixed(1)} + ${base.attackdamageperlevel.toFixed(1)}*${L - 1} + ${item.ad.toFixed(1)} + ${rune.ad.toFixed(1)} + passive(${passiveLedger.statMods.ad.toFixed(1)})` },
    { name: "AP", icon: "✨", value: ap, eq: `0 + ${item.ap.toFixed(1)} + ${rune.ap.toFixed(1)} + passive(${passiveLedger.statMods.ap.toFixed(1)})` },
    { name: "Range", icon: "🏹", value: attackRange, eq: `${(base.attackrange || 0).toFixed(1)} + ${item.attackRange.toFixed(1)} + ${rune.attackRange.toFixed(1)}` },
    { name: "AH", icon: "⏱️", value: abilityHaste, eq: `0 + ${item.haste.toFixed(1)} + ${rune.haste.toFixed(1)}` },
    { name: "Arm", icon: "🛡️", value: armor, eq: `${base.armor.toFixed(1)} + ${base.armorperlevel.toFixed(1)}*${L - 1} + ${item.armor.toFixed(1)} + ${rune.armor.toFixed(1)}` },
    { name: "MR", icon: "🔮", value: mr, eq: `${base.spellblock.toFixed(1)} + ${base.spellblockperlevel.toFixed(1)}*${L - 1} + ${item.mr.toFixed(1)} + ${rune.mr.toFixed(1)}` },
    { name: "AS", icon: "⚡", value: asTotal, eq: `${base.attackspeed.toFixed(3)} * level mult * (1 + ${(item.asPct + rune.asPct).toFixed(1)}%)` },
    { name: "MS", icon: "👟", value: moveSpeed, eq: `(${base.movespeed.toFixed(1)} + ${item.msFlat.toFixed(1)} + ${rune.msFlat.toFixed(1)}) * (1 + ${(item.msPct + rune.msPct).toFixed(1)}%)` },
    { name: "Crit %", icon: "🎯", value: critChance, eq: `${base.crit.toFixed(1)} + ${base.critperlevel.toFixed(1)}*${L - 1} + ${item.critChance.toFixed(1)} + ${rune.critChance.toFixed(1)}` },
    { name: "Crit Dmg", icon: "💥", value: critDamage, eq: `${(base.critdamage ? base.critdamage * 100 : 175).toFixed(1)} + ${item.critDamage.toFixed(1)} + ${rune.critDamage.toFixed(1)}` },
    { name: "ARPen", icon: "🪓", value: 0, eq: `${item.arPenFlat.toFixed(1)} / ${item.arPenPct.toFixed(1)}%` },
    { name: "MRPen", icon: "🔹", value: 0, eq: `${item.mrPenFlat.toFixed(1)} / ${item.mrPenPct.toFixed(1)}%` },
    { name: "Lifesteal", icon: "🩸", value: 0, eq: `${item.physicalVamp.toFixed(1)}% / ${item.omniVamp.toFixed(1)}%` },
    { name: "Tenacity", icon: "🦶", value: 0, eq: `${item.tenacity.toFixed(1)}%` },
  ];

  const tableHtml = renderPairedRows(rows.map((row) => {
    if (row.name === "ARPen") return { ...row, displayValue: `${item.arPenFlat.toFixed(1)}/${item.arPenPct.toFixed(1)}%` };
    if (row.name === "MRPen") return { ...row, displayValue: `${item.mrPenFlat.toFixed(1)}/${item.mrPenPct.toFixed(1)}%` };
    if (row.name === "Lifesteal") return { ...row, displayValue: `${item.physicalVamp.toFixed(1)}%/${item.omniVamp.toFixed(1)}%` };
    if (row.name === "Tenacity") return { ...row, displayValue: `${item.tenacity.toFixed(1)}%` };
    return {
      ...row,
      displayValue: row.value.toFixed(row.name === "AS" ? 3 : 1),
    };
  }));

  root.innerHTML = tableHtml;
  renderPassivePanel(passiveLedger);
}

function renderRunePanel() {
  const root = document.getElementById("runePanel");
  const primaryPath = RUNE_DATA.paths[BUILDER.runeSelections.primaryPath];
  const secondaryPath = RUNE_DATA.paths[BUILDER.runeSelections.secondaryPath];
  document.getElementById("runesCard").style.setProperty("--rune-splash-url", primaryPath.splash);

  const renderSlot = (id, label, target) => {
    const rune = getRuneMeta(id);
    return `<div class="rune-slot-row"><button class="rune-slot-btn" data-rune-target="${target}">${runeImgTag(rune)}</button><div class="rune-slot-label"><span class='rune-slot-kicker'>${label}</span><strong>${rune.name}</strong></div></div>`;
  };
  const renderSecondaryGrid = () => {
    const rows = getSecondaryRows(BUILDER.runeSelections.secondaryPath);
    const selected = new Set(BUILDER.runeSelections.secondary);
    return rows
      .flat()
      .map((runeId) => {
        const rune = getRuneMeta(runeId);
        const isSelected = selected.has(runeId);
        return `<button class="rune-secondary-cell ${isSelected ? "is-selected" : ""}" data-secondary-rune-id="${runeId}" type="button">${runeImgTag(rune)}<span class="rune-secondary-hover-desc">${rune.desc || rune.name}</span></button>`;
      })
      .join("");
  };

  ensureSecondarySelectionsValid();

  root.innerHTML = `
    <div class="rune-column-block">
      <div class="rune-column-title"><button class='btn btn-sm rune-path-btn' data-rune-target="primaryPath_0"><img src="${primaryPath.icon}" alt="${primaryPath.name}"><span>${primaryPath.name}</span></button></div>
      ${renderSlot(BUILDER.runeSelections.primary[0], "Keystone", "primary_0")}
      ${renderSlot(BUILDER.runeSelections.primary[1], "Row 1", "primary_1")}
      ${renderSlot(BUILDER.runeSelections.primary[2], "Row 2", "primary_2")}
      ${renderSlot(BUILDER.runeSelections.primary[3], "Row 3", "primary_3")}
    </div>
    <div class="rune-column-block">
      <div class="rune-column-title"><button class='btn btn-sm rune-path-btn' data-rune-target="secondaryPath_0"><img src="${secondaryPath.icon}" alt="${secondaryPath.name}"><span>${secondaryPath.name}</span></button></div>
      <div class='rune-subsection-title'>Secondary Runes</div>
      <div class="rune-secondary-grid">${renderSecondaryGrid()}</div>
    </div>
    <div class="rune-shard-row-wrap">
      <div class='rune-subsection-title rune-subsection-title-shards'>Stat Shards</div>
      <div class="rune-shard-row">
        ${renderSlot(BUILDER.runeSelections.shards[0], "Shard 1", "shard_0")}
        ${renderSlot(BUILDER.runeSelections.shards[1], "Shard 2", "shard_1")}
        ${renderSlot(BUILDER.runeSelections.shards[2], "Shard 3", "shard_2")}
      </div>
    </div>
  `;
}

function selectSecondaryRuneDirect(id) {
  const pathId = BUILDER.runeSelections.secondaryPath;
  const clickedRow = getSecondaryRowIndex(pathId, id);
  if (clickedRow < 0 || BUILDER.runeSelections.secondary.includes(id)) return;

  const [a, b] = BUILDER.runeSelections.secondary;
  const rowA = getSecondaryRowIndex(pathId, a);
  const rowB = getSecondaryRowIndex(pathId, b);

  if (rowA === clickedRow) BUILDER.runeSelections.secondary[0] = id;
  else if (rowB === clickedRow) BUILDER.runeSelections.secondary[1] = id;
  else if (rowA < 0) BUILDER.runeSelections.secondary[0] = id;
  else BUILDER.runeSelections.secondary[1] = id;

  ensureSecondarySelectionsValid();
  renderRunePanel();
  renderStats();
  renderAbilityCards();
}

function flattenSecondaryOptions(pathId) {
  const rows = RUNE_DATA.paths[pathId]?.primaryRows || [];
  return rows.slice(1).flat();
}

function getSecondaryRows(pathId) {
  return (RUNE_DATA.paths[pathId]?.primaryRows || []).slice(1);
}

function getSecondaryRowIndex(pathId, runeId) {
  const rows = getSecondaryRows(pathId);
  return rows.findIndex((row) => row.includes(runeId));
}

function getPathPrimaryDefaults(pathId) {
  return (RUNE_DATA.pathDefaults[pathId] || ["arcane-comet", "manaflow-band", "absolute-focus", "gathering-storm"]).slice(0, 4);
}

function getPathSecondaryDefaults(pathId) {
  const rows = getSecondaryRows(pathId);
  const first = rows[0]?.[0] || "legend-haste";
  const second = rows[1]?.[0] || rows[0]?.[1] || first;
  return [first, second];
}

function ensureSecondarySelectionsValid() {
  const [a, b] = BUILDER.runeSelections.secondary;
  const pathId = BUILDER.runeSelections.secondaryPath;
  const rowA = getSecondaryRowIndex(pathId, a);
  const rowB = getSecondaryRowIndex(pathId, b);

  if (rowA >= 0 && rowA === rowB) {
    const rows = getSecondaryRows(pathId);
    const fallback = rows.find((_row, idx) => idx !== rowA)?.[0];
    BUILDER.runeSelections.secondary[1] = fallback || b;
  }
}

function getRuneOptions(target) {
  if (target.startsWith("primaryPath")) return Object.entries(RUNE_DATA.paths).map(([id, p]) => ({ id, name: p.name, desc: `Set ${p.name} as primary path`, icon: p.icon }));
  if (target.startsWith("secondaryPath")) {
    return Object.entries(RUNE_DATA.paths).map(([id, p]) => ({
      id,
      name: p.name,
      desc: id === BUILDER.runeSelections.primaryPath ? "Secondary path cannot match primary path" : `Set ${p.name} as secondary path`,
      icon: p.icon,
      disabled: id === BUILDER.runeSelections.primaryPath,
    }));
  }
  if (target.startsWith("primary")) {
    const rowIndex = Number(target.split("_")[1]);
    const rows = RUNE_DATA.paths[BUILDER.runeSelections.primaryPath]?.primaryRows || [];
    return (rows[rowIndex] || []).map((id) => ({ id, ...getRuneMeta(id) }));
  }
  if (/^secondary_\d+$/.test(target)) {
    const slot = Number(target.split("_")[1]);
    const other = BUILDER.runeSelections.secondary[slot === 0 ? 1 : 0];
    const blockedRow = getSecondaryRowIndex(BUILDER.runeSelections.secondaryPath, other);
    const rows = getSecondaryRows(BUILDER.runeSelections.secondaryPath);
    return rows.flatMap((row, rowIndex) => row.map((id) => ({
      id,
      rowIndex,
      disabled: rowIndex === blockedRow,
      ...getRuneMeta(id),
    })));
  }
  const shardRow = Number(target.split("_")[1]);
  const perRow = [
    ["adaptive-force", "attack-speed", "ability-haste"],
    ["adaptive-force", "scaling-health"],
    ["scaling-health", "armor", "magic-resist"],
  ];
  return (perRow[shardRow] || RUNE_DATA.shardOptions).map((id) => ({ id, ...getRuneMeta(id) }));
}

function openRuneModal(target) {
  BUILDER.runeModalTarget = target;
  document.getElementById("runeModal").classList.remove("hidden");
  const options = getRuneOptions(target);
  document.getElementById("runeModalTitle").textContent = "Select Rune Option";
  const optionBtn = (o) => {
    const disabled = o.disabled ? "disabled" : "";
    const lockNote = o.disabled ? (o.desc || "This option is unavailable") : (o.desc || "");
    return `<button class="rune-option-btn ${o.disabled ? "is-disabled" : ""}" ${disabled} data-rune-option-id="${o.id}">${runeImgTag(o)}<div><div class="rune-option-name">${o.name}</div><div class="rune-option-desc">${lockNote}</div></div></button>`;
  };

  if (/^secondary_\d+$/.test(target)) {
    const groups = [0, 1, 2]
      .map((rowIndex) => options.filter((o) => o.rowIndex === rowIndex))
      .filter((group) => group.length);
    document.getElementById("runeModalList").innerHTML = groups
      .map((group, idx) => `<section class='rune-option-group'><h4 class='rune-option-group-title'>Secondary Row ${idx + 1}</h4><div class='rune-option-group-grid'>${group.map(optionBtn).join("")}</div></section>`)
      .join("");
  } else {
    document.getElementById("runeModalList").innerHTML = options.map(optionBtn).join("");
  }
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
  if (group === "secondary") {
    BUILDER.runeSelections.secondary[Number(index)] = id;
    ensureSecondarySelectionsValid();
  }
  if (group === "shard") BUILDER.runeSelections.shards[Number(index)] = id;
  if (group === "primaryPath") {
    BUILDER.runeSelections.primaryPath = id;
    BUILDER.runeSelections.primary = getPathPrimaryDefaults(id);
    if (BUILDER.runeSelections.secondaryPath === id) {
      const fallbackSecondary = Object.keys(RUNE_DATA.paths).find((pathId) => pathId !== id) || id;
      BUILDER.runeSelections.secondaryPath = fallbackSecondary;
      BUILDER.runeSelections.secondary = getPathSecondaryDefaults(fallbackSecondary);
    }
  }
  if (group === "secondaryPath") {
    if (id !== BUILDER.runeSelections.primaryPath) {
      BUILDER.runeSelections.secondaryPath = id;
      BUILDER.runeSelections.secondary = getPathSecondaryDefaults(id);
    }
    ensureSecondarySelectionsValid();
  }
  renderRunePanel();
  renderStats();
  renderAbilityCards();
  closeRuneModal();
}

document.addEventListener("DOMContentLoaded", initBuilder);
