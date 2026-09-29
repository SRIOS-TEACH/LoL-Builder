const test = require('node:test');
const assert = require('node:assert/strict');
const {simulate} = require('../JS/shared/comboTester.js');
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
  assert.equal(simulate([q2]).total,null);
  assert.equal(simulate([q,q3]).duration,null);
  assert.equal(simulate([q,q2,q2]).duration,null);
  assert.equal(simulate([q,action('r',10,5,20),q2]).duration,null);
});
test('missing values are explicit while genuine zero damage and instant casts work', () => {
  assert.equal(simulate([action('q',null,0.2,4)]).total,null);
  assert.equal(simulate([action('q',100,null,4)]).duration,null);
  const unknown = action('item',100,0,null);
  assert.equal(simulate([unknown]).duration,0);
  assert.equal(simulate([unknown,unknown]).duration,null);
  assert.equal(simulate([action('utility',0,0,0)]).total,0);
  assert.equal(simulate([action('gone',100,0,0,{unavailable:true})]).total,null);
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
