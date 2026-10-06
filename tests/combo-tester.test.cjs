const test = require('node:test');
const assert = require('node:assert/strict');
const {simulate,attackWindup,damageParts} = require('../JS/shared/comboTester.js').default;
const action = (id,damage,castTime,cooldown,extra={}) => ({id,group:id,damage,castTime,cooldown,...extra});
test('attacks respect reciprocal attack speed and include the final windup', () => {
  const aa = action('aa',100,0.2,0.5);
  const result = simulate([aa,aa]);
  assert.equal(result.total,200);
  assert.equal(result.duration,0.7);
  assert.equal(result.timeline[1].wait,0.3);
});
test('cooldowns overlap intervening casts, but casts cannot overlap each other', () => {
  const q = action('q',200,0.25,4), w = action('w',50,1,10);
  const result = simulate([q,w,q]);
  assert.equal(result.total,450);
  assert.equal(result.duration,4.25);
  assert.equal(result.timeline[1].start,0.25);
  assert.equal(result.timeline[2].start,4);
});
test('recasts use lockouts, enforce their order, and restart cooldown at the last cast', () => {
  const q = action('q',100,0.6,6), q2 = {...q,stage:1,recastDelay:1,recastWindow:4,cooldownStarts:'last'};
  const q3 = {...q2,stage:2};
  assert.equal(simulate([q,q2,q3,q]).duration,8.6);
  assert.equal(simulate([q2]).total,100);
  assert.match(simulate([q2]).timeWarnings.join(' '),/preceding cast/);
  assert.ok(simulate([q,q3]).timeWarnings.length);
  assert.ok(simulate([q,q2,q2]).timeWarnings.length);
  assert.match(simulate([q,action('r',10,5,20),q2]).timeWarnings.join(' '),/expired/);
});
test('missing values are explicit while genuine zero damage and instant casts work', () => {
  assert.equal(simulate([action('q',null,0.2,4)]).total,0);
  assert.equal(simulate([action('q',null,0.2,4)]).damageWarnings.length,1);
  assert.equal(simulate([action('q',100,null,4)]).duration,0);
  assert.equal(simulate([action('q',100,null,4)]).timeWarnings.length,1);
  const unknown = action('item',100,0,null);
  assert.equal(simulate([unknown]).duration,0);
  assert.equal(simulate([unknown,unknown]).duration,0);
  assert.match(simulate([unknown,unknown]).timeWarnings.join(' '),/cooldown/);
  assert.equal(simulate([action('utility',0,0,0)]).total,0);
  assert.equal(simulate([action('gone',100,0,0,{unavailable:true})]).total,0);
});
test('different variants share the same cooldown group and explicit procs count once', () => {
  const q = action('q:edge',200,0.5,5,{group:'q'});
  const q2 = action('q:normal',100,0.5,5,{group:'q'});
  const proc = action('item',75,0,1.5);
  const result = simulate([q,proc,q2,proc]);
  assert.equal(result.total,450);
  assert.equal(result.timeline[2].start,5);
  assert.equal(result.duration,5.5);
});
test('abandoning a last-cast cooldown chain waits for the recast window to expire', () => {
  const q = action('q',100,0.6,6,{lastStage:2,recastWindow:4,cooldownStarts:'last'});
  assert.equal(simulate([q,q]).timeline[1].start,10);
  const q2 = {...q,stage:1,recastDelay:1}, q3 = {...q2,stage:2};
  assert.equal(simulate([q,q2,q]).timeline[2].start,11);
  assert.equal(simulate([q,q2,q3,q]).timeline[3].start,8);
});

test('mixed damage retains typed contributions and scales explicit overrides', () => {
  const a={damage:150,components:[{type:'physical',value:90},{type:'magic',value:40},{type:'true',value:20}]};
  assert.deepEqual(damageParts(a),{physical:90,magic:40,true:20,untyped:0});
  assert.deepEqual(damageParts({...a,damage:300}),{physical:180,magic:80,true:40,untyped:0});
  assert.equal(simulate([{...a,castTime:0,cooldown:0}]).total,150);
  const partial={damage:null,components:[{type:'magic',value:50},{type:'true',value:null}],castTime:0};
  assert.equal(simulate([partial]).total,50);
  assert.equal(simulate([partial]).damageWarnings.length,1);
});
test('windup resolves both champion data formats, modifiers, and explicit overrides', () => {
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
  near(attackWindup({basicAttack:{mAttackCastTime:.3,mAttackTotalTime:1.5}},1,.6666666667),.2);
  near(attackWindup({basicAttack:{mAttackDelayCastOffsetPercent:-.1}},1,.625),.2);
  near(attackWindup({basicAttack:{mAttackDelayCastOffsetPercent:-.1,mAttackDelayCastOffsetPercentAttackSpeedRatio:.5}},1.25,.625),.24);
  near(attackWindup({basicAttack:{mAttackDelayCastOffsetPercent:-.1}},.625,.625,.4),.4);
  assert.equal(attackWindup(null,1,.625),null);
  assert.equal(attackWindup({basicAttack:{}},1,.625),null);
});

test('target health advances per action, including threshold effects and overkill', () => {
  const target={enabled:true,maxHp:1000,currentHp:1000};
  const hit=action('q',350,.25,1,{damageType:'magic'});
  const result=simulate([hit,hit,hit,hit],{target,resolveAction:(a,t)=>({...a,damage:a.damage*(t.currentHp/t.maxHp<.4?1.2:1)})});
  assert.deepEqual(result.timeline.map(r=>r.hpBefore),[1000,650,300,0]);
  assert.deepEqual(result.timeline.map(r=>r.hpAfter),[650,300,0,0]);
  assert.equal(result.total,1540);
  assert.equal(result.remainingHp,0);
  assert.equal(target.currentHp,1000);
  assert.equal(result.duration,3.25);
});
test('disabled targets retain static damage and missing damage leaves HP unchanged', () => {
  const missing=action('x',null,null,null);
  const on=simulate([missing],{target:{enabled:true,maxHp:1000,currentHp:600}});
  assert.equal(on.remainingHp,600);assert.equal(on.damageWarnings.length,1);
  const off=simulate([action('q',100,0,0)],{target:{enabled:false},resolveAction:()=>{throw Error('must not resolve');}});
  assert.equal(off.total,100);assert.equal(off.remainingHp,undefined);assert.equal(off.timeline[0].hpAfter,undefined);
});
