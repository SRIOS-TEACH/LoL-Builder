/** Resolve typed damage prose without changing scaling ratios, healing or utility values. */
(function(scope){
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain=value=>String(value).replace(/<[^>]*>/g,'');
  const number=value=>Number.isFinite(value)?Number(value.toFixed(2)).toLocaleString('en-US'):'Value unavailable';
  const pattern=syntax=>syntax==='item'?/@([^@]+)@(%)?/g:/\{\{\s*([^}]+?)\s*\}\}(%)?/g;
  function damage(value,type,context,equation=''){
    const row=scope.TargetDamage.apply(value,type,context);
    return `<span class="target-damage-number" tabindex="0" data-raw-damage="${value}" data-damage-type="${type}" title="${escape([equation,row.text].filter(Boolean).join('; '))}">${number(row.value)}</span>`;
  }
  function render(template,resolve,context={},syntax='ability'){
    const resolveOrdinary=(full,key,suffix='')=>{
      const row=resolve(key);return row?row.html+(suffix&&!row.isPercent?suffix:''):'<span class="ability-detail-missing">[value unavailable]</span>';
    };
    const active=context.target?.enabled===true;
    let html=String(template||'').replace(/<(physicalDamage|magicDamage|trueDamage)>([\s\S]*?)<\/\1>/gi,(whole,tag,body)=>{
      const type=tag.toLowerCase().replace('damage','');
      const text=plain(body),statOnly=/attack damage|ability power|attack speed|damage reduction|damage (?:is )?reduced|damage amplification|resistance/i.test(text.replace(/\bmagic attack damage\b/gi,'magic damage'));
      if(!active||statOnly)return whole;
      const skeleton=text.replace(pattern(syntax),'#').trim();
      let prepared=body;
      if(/^(?:#|\d+(?:\.\d+)?)(?:\s*(?:\+|to|and|–|-)\s*(?:#|\d+(?:\.\d+)?))*\s*(?:(?:bonus |additional )?(?:physical |magic |true )?damage)?\s*$/i.test(skeleton)){
        prepared=body.replace(/(\{\{[^}]*\}\}|@[^@]*@|<[^>]*>)|(\d+(?:\.\d+)?)/g,(full,protectedText,literal)=>protectedText||damage(Number(literal),type,context));
      }
      let resolved=prepared.replace(pattern(syntax),(full,key,suffix='',offset)=>{
        const row=resolve(key);
        if(!row||!Number.isFinite(row.numeric))return resolveOrdinary(full,key,suffix);
        const after=plain(prepared.slice(offset+full.length));
        const percent=row.isPercent||suffix==='%'||/^\s*%/.test(after);
        if(percent){
          // Ratios remain ratios. A health-based damage coefficient additionally
          // displays its resulting damage against the configured target.
          const health=after.match(/^\s*(?:%\s*)?(?:of\s+)?(?:(?:the\s+)?(?:target(?:'s)?|enemy(?:'s)?|their|its)\s+)?(max(?:imum)?|current|missing)\s+(?:health|hp)\b/i);
          const t=scope.TargetDamage.targetStats(context.target);
          const healthValue=health?({max:t.hp,maximum:t.hp,current:t.currentHp,missing:t.missingHp})[health[1].toLowerCase()]:null;
          const original=resolveOrdinary(full,key,suffix);
          return Number.isFinite(healthValue)?`${original} (${damage(row.numeric/100*healthValue,type,context,`${number(row.numeric)}% × ${number(healthValue)} target ${health[1]} HP`)} damage)`:original;
        }
        return damage(row.numeric,type,context,plain(row.html));
      });
      return `<${tag}>${resolved}</${tag}>`;
    });
    html=html.replace(pattern(syntax),resolveOrdinary);
    return html;
  }
  scope.DamageText={render,damage};
  if(typeof module!=='undefined')module.exports=scope.DamageText;
})(typeof window!=='undefined'?window:globalThis);
