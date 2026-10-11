import {test} from 'node:test';import assert from 'node:assert/strict';import {initialState,createPlans,conflict,overlap,approve,parseTime,planDiff,type State} from '../src/planner.ts';
test('both plans obey quiet windows, deadlines and single-task capacity',()=>{const s=initialState();for(const p of createPlans(s)){for(const x of p.slots){const c=s.chores.find(c=>c.id===x.choreId)!;assert.equal(conflict(c,x.start,s),null);assert.ok(x.start>=c.earliest&&x.end<=c.deadline)}for(let i=0;i<p.slots.length;i++)for(let j=i+1;j<p.slots.length;j++)assert.equal(overlap(p.slots[i].start,p.slots[i].end,p.slots[j].start,p.slots[j].end),false)}});
test('impossible chore is disclosed, not squeezed through quiet windows',()=>{const s=initialState();s.quiet=[{id:'all',person:'Maya',label:'Protected time',room:'office',start:0,end:1440}];const p=createPlans(s)[0];assert.equal(p.unscheduled.length,3);assert.equal(p.slots.length,3)});
test('proposals do not mutate the saved state',()=>{const s=initialState(),before=JSON.stringify(s);createPlans(s);assert.equal(JSON.stringify(s),before)});
test('stale approval rejected',()=>{const s=initialState(),p=createPlans(s)[0];assert.throws(()=>approve({...s,revision:1},p),/stale/)});
test('approval uses server generated plan, not tampered slots',()=>{const s=initialState(),p=createPlans(s)[0];p.slots=[];const n=approve(s,p);assert.ok(n.accepted!.slots.length>0);assert.equal(s.accepted,null)});
test('time edge cases',()=>{assert.equal(parseTime('23:59'),1439);assert.throws(()=>parseTime('24:00'));assert.throws(()=>parseTime('3:00'));assert.equal(overlap(900,930,930,960),false)});

test('bad labels, duplicate IDs, inherited room names and nonfinite times rejected',()=>{
 for(const mutate of [(s:State)=>{s.quiet[0].person=''},(s:State)=>{s.quiet[1].id=s.quiet[0].id},(s:State)=>{s.quiet[0].room='toString'},(s:State)=>{s.chores[0].earliest=NaN},(s:State)=>{s.chores[0].label='x'.repeat(121)},(s:State)=>{s.revision=-1}]){const s=initialState();mutate(s);assert.throws(()=>createPlans(s))}
});

test('ordering search handles a narrow-deadline task',()=>{const s=initialState();s.quiet=[];s.chores=[{id:'a',label:'Long task',room:'kitchen',duration:60,noisy:false,earliest:0,deadline:120},{id:'b',label:'Narrow task',room:'kitchen',duration:30,noisy:false,earliest:0,deadline:30}];for(const p of createPlans(s))assert.equal(p.unscheduled.length,0)});
test('plan diff retains previous approval baseline',()=>{const s=initialState(),p=createPlans(s)[0];assert.equal(planDiff(s,p).baseline,false);s.previous=p;const moved=structuredClone(p);moved.slots[0].start+=5;assert.equal(planDiff(s,moved).moved,1)});

test('200 random households: every placed chore obeys windows, bounds and single-task capacity',()=>{
 let seed=11;const rnd=(n:number)=>{seed=(seed*1103515245+12345)%2147483648;return seed%n};
 for(let i=0;i<200;i++){
  const s=initialState();
  s.quiet=s.quiet.map(q=>{const start=480+rnd(600);return {...q,start,end:Math.min(1440,start+30+rnd(180))}});
  for(const p of createPlans(s)){
   for(const x of p.slots){
    const c=s.chores.find(c=>c.id===x.choreId)!;
    assert.equal(x.end-x.start,c.duration);
    assert.ok(x.start>=c.earliest&&x.end<=c.deadline,'outside chore bounds');
    assert.equal(conflict(c,x.start,s),null,'placed inside a quiet window');
   }
   for(const a of p.slots)for(const b of p.slots)if(a!==b)assert.ok(!overlap(a.start,a.end,b.start,b.end),'two chores overlap');
   assert.equal(p.slots.length+p.unscheduled.length,s.chores.length,'a chore went missing');
  }
 }
});
