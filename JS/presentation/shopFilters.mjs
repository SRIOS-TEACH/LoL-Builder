// Shared League-style shop categories and stat-filter order.
export const SHOP_FILTER_GROUPS = [
  ['Physical', [['Damage','Attack Damage','AD'],['CriticalStrike','Critical Strike','Crit %'],['AttackSpeed','Attack Speed','AS'],['OnHit','On-hit','On-hit'],['ArmorPenetration','Armor Penetration','ARPen']]],
  ['Magic', [['SpellDamage','Ability Power','AP'],['Mana','Mana & Mana Regen','MP'],['MagicPenetration','Magic Penetration','MRPen']]],
  ['Defense', [['Health','Health & Health Regen','HP'],['Armor','Armor','Arm'],['SpellBlock','Magic Resist','MR']]],
  ['Utility', [['AbilityHaste','Ability Haste','AH'],['NonbootsMovement','Move Speed','MS'],['LifeSteal','Lifesteal & Omnivamp','Lifesteal']]],
];
export const SHOP_ROLES = [['Fighter',1],['Marksman',2],['Assassin',4],['Mage',16],['Tank',8],['Support',32]];
