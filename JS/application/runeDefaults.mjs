export function createRuneData() {
return {
  pathDefaults: {},
  paths: {},
  runeLookup: {
    "adaptive-force": { name: "Adaptive", desc: "+9 Adaptive Force", longDesc: "+9 Adaptive Force", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png" },
    "attack-speed": { name: "Attack Speed", desc: "+10% Attack Speed", longDesc: "+10% Attack Speed", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png" },
    "ability-haste": { name: "Ability Haste", desc: "+8 Ability Haste", longDesc: "+8 Ability Haste", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsCDRScalingIcon.png" },
    "move-speed": { name: "Move Speed", desc: "+2.5% Move Speed", longDesc: "+2.5% Move Speed", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMovementSpeedIcon.png" },
    "scaling-health": { name: "Scaling Health", desc: "+10-200 Bonus Health", longDesc: "+10-200 Bonus Health", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png" },
    health: { name: "Health", desc: "+65 Bonus Health", longDesc: "+65 Bonus Health", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthPlusIcon.png" },
    "tenacity-slow-resist": { name: "Tenacity & Slow Resist", desc: "+15% Tenacity and Slow Resist", longDesc: "+15% Tenacity and Slow Resist", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsTenacityIcon.png" },
  },
  shardOptions: ["adaptive-force", "attack-speed", "ability-haste", "move-speed", "scaling-health", "health", "tenacity-slow-resist"],
};

}
