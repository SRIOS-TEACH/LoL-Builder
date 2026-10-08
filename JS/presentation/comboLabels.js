/** Compact action labels are presentation only; they do not change damage. */
export default function comboShortcut(action){
 if(action.runeId || /^(rune|mastery)(:|$)/.test(action.group||''))return 'M';
 if(action.itemId || action.group==='spellblade' || /^(item:|bonus:|effect)/.test(action.group||''))return 'I';
 return action.shortcut || '?';
}
