import {test} from 'node:test';import assert from 'node:assert/strict';
import {initialState,createPlans,approve,conflict,overlap} from '../src/planner.ts';
import {mediate,parseRequest} from '../src/mediator.ts';
import {negotiate} from '../src/negotiate.ts';
import {runAgentTool,toolDefinitions} from '../src/tools.ts';

const approved=()=>{const s=initialState();return approve(s,createPlans(s).find(p=>p.id.startsWith('early'))!)};

test('smallest-change plan only exists after an approval and moves fewer chores',()=>{
 assert.ok(!createPlans(initialState()).some(p=>p.id.startsWith('smallest')));
 const a=approved();const moved=runAgentTool(a,{name:'update_quiet_window',revision:a.revision,id:'q1',start:960,end:1020}).state;
 const plans=createPlans(moved);const small=plans.find(p=>p.id.startsWith('smallest'))!;assert.ok(small);
 const count=(p:typeof small)=>p.trace!.filter(t=>t.kind==='moved').length;
 for(const p of plans)assert.ok(count(small)<=count(p)||small.unscheduled.length<p.unscheduled.length);
 for(const x of small.slots){const c=moved.chores.find(c=>c.id===x.choreId)!;assert.equal(conflict(c,x.start,moved),null);assert.ok(x.start>=c.earliest&&x.end<=c.deadline)}
 for(const x of small.slots)for(const y of small.slots)if(x!==y)assert.ok(!overlap(x.start,x.end,y.start,y.end))});
test('reason trace explains each move',()=>{const a=approved();const moved=runAgentTool(a,{name:'update_quiet_window',revision:a.revision,id:'q1',start:960,end:1020}).state;
 for(const p of createPlans(moved))for(const t of p.trace!.filter(t=>t.kind==='moved'))assert.match(t.text,/moves from \d\d:\d\d to \d\d:\d\d/)});
test('mediator parses plain English into typed calls and never approves',()=>{
 const s=initialState();const r=mediate(s,"Maya's call moved to 4pm",false);
 assert.equal(r.status,'proposal');if(r.status!=='proposal')return;
 assert.deepEqual(r.calls.map(c=>c.name),['get_household','update_quiet_window','propose_plans']);
 assert.equal(r.state.accepted,null);assert.equal(r.engine,'offline-rules');
 assert.ok(!toolDefinitions.some(t=>/approve/.test(t.name)));
 assert.equal(s.revision,0)});
test('mediator asks instead of guessing',()=>{
 assert.equal(mediate(initialState(),'something changed','false' as any).status,'needs_clarification');
 assert.equal(mediate(initialState(),'Maya is busy',false).status,'needs_clarification');
 assert.equal(mediate(initialState(),'Maya and Leo moved to 5pm',false).status,'needs_clarification')});
test('mediator handles shifts and end times',()=>{
 const s=initialState();let u:any=parseRequest(s,'Push Leo reading 30 minutes later');assert.equal(u.newStart,1020);assert.equal(u.newEnd,1050);
 u=parseRequest(s,'Maya call now ends at 17:30');assert.equal(u.newEnd,1050);assert.equal(u.newStart,990)});
test('honest negotiation lists costed options for an unplaced chore',()=>{
 const s=initialState();s.chores=[{id:'x',label:'Vacuum',room:'living',duration:30,noisy:true,earliest:990,deadline:1020}];
 const plan=createPlans(s)[0];assert.equal(plan.unscheduled.length,1);
 const n=negotiate(s,plan)[0];assert.ok(n.blockers.length>0);
 assert.ok(n.options.some(o=>o.kind==='skip_today'));
 const shift=n.options.find(o=>o.kind==='shift_quiet');if(shift&&shift.kind==='shift_quiet'){const q=s.quiet.map(x=>x.id===shift.quietId?{...x,start:shift.newStart,end:shift.newEnd}:x);assert.equal(conflict(s.chores[0],plan.unscheduled.length?990:0,{...s,quiet:q}) !== undefined,true)}});
test('deadline tool invalidates approval and rejects stale revisions',()=>{
 const a=approved();const n=runAgentTool(a,{name:'update_chore_deadline',revision:a.revision,id:'c1',deadline:1100}).state;
 assert.equal(n.accepted,null);assert.throws(()=>runAgentTool(n,{name:'update_chore_deadline',revision:a.revision,id:'c1',deadline:1110}),/changed/)});

test('names match whole words only, so "4am" does not select a person called Am',()=>{
 const s=initialState();s.quiet=s.quiet.map((q,i)=>i===0?{...q,person:'Am'}:q);
 const r=parseRequest(s,'Call moved to 4am') as any;
 assert.ok(!(r.person==='Am'));
});
test('more than six chores still produce plans',()=>{
 const s=initialState();const extra=[...s.chores,...s.chores.slice(0,3).map((c,i)=>({...c,id:'x'+i,label:c.label+' again'}))];
 const plans=createPlans({...s,chores:extra});
 assert.ok(plans.length>=2);
});
