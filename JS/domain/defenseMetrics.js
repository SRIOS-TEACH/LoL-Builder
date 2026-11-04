export function cdr(haste){return Number.isFinite(haste)&&haste>=0?100*haste/(100+haste):null;}
export function effectiveResistance(resist,percent=0,flat=0){return resist<0?resist:Math.max(0,resist*(1-percent/100)-flat);}
export function effectiveHealth({hp,armor,mr,physical=50,shields=[],reduction=0,armorPenPct=0,armorPenFlat=0,magicPenPct=0,magicPenFlat=0}){
 if(![hp,armor,mr,physical,reduction,armorPenPct,armorPenFlat,magicPenPct,magicPenFlat].every(Number.isFinite)||hp<=0||physical<0||physical>100||reduction<0||reduction>=100||[armorPenPct,magicPenPct].some(n=>n<0||n>100)||[armorPenFlat,magicPenFlat].some(n=>n<0)||shields.some(s=>!Number.isFinite(s.amount)||s.amount<0||!['physical','magic','all'].includes(s.type)))return null;
 const multiplier=resist=>resist>=0?100/(100+resist):2-100/(100-resist);
 const p=physical/100*multiplier(effectiveResistance(armor,armorPenPct,armorPenFlat))*(1-reduction/100),m=(1-physical/100)*multiplier(effectiveResistance(mr,magicPenPct,magicPenFlat))*(1-reduction/100);
 const sum=type=>shields.filter(s=>s.type===type).reduce((n,s)=>n+s.amount,0),sp=sum('physical'),sm=sum('magic'),h=hp+sum('all');
 // At death: max(p*D-Sp,0)+max(m*D-Sm,0)=HP+universal shields.
 let lo=h/(p+m),hi=(h+sp+sm)/(p+m);for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(Math.max(0,p*mid-sp)+Math.max(0,m*mid-sm)<h)lo=mid;else hi=mid;}return (lo+hi)/2;
}
export function sequenceDps({damage,cooldown,castTimes=[],automatic=false}){if(!Number.isFinite(damage)||!Number.isFinite(cooldown)||cooldown<=0||castTimes.some(t=>!Number.isFinite(t)||t<0))return null;return damage/(cooldown+castTimes.reduce((a,b)=>a+b,0));}
