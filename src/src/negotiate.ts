import {conflict, overlap, time, type State, type Plan, type Chore, type Slot} from './planner';

// Honest negotiation: when a chore cannot be placed, say why and list concrete, costed ways to resolve it.
// Nothing here changes state. Each option carries a typed edit that a person must review.
export type Option =
 | {kind:'extend_deadline'; choreId:string; newDeadline:number; text:string}
 | {kind:'shift_quiet'; quietId:string; person:string; newStart:number; newEnd:number; text:string}
 | {kind:'skip_today'; choreId:string; text:string};
export type Negotiation = {choreId:string; label:string; blockers:string[]; options:Option[]};

const fits=(c:Chore,s:State,slots:Slot[])=>{for(let t=Math.ceil(c.earliest/5)*5;t+c.duration<=c.deadline;t+=5){if(!conflict(c,t,s)&&!slots.some(x=>overlap(t,t+c.duration,x.start,x.end)))return t}return null};

export function negotiate(s:State,p:Plan):Negotiation[]{
 return p.unscheduled.flatMap(u=>{
  const c=s.chores.find(x=>x.id===u.choreId);if(!c)return [];
  const others=p.slots.filter(x=>x.choreId!==c.id);
  // Which declared windows block this chore at every start time in its own time range?
  const blockers=new Set<string>();
  for(let t=Math.ceil(c.earliest/5)*5;t+c.duration<=c.deadline;t+=5){const why=conflict(c,t,s);if(why)blockers.add(why)}
  const options:Option[]=[];
  for(let d=c.deadline+5;d<=Math.min(1440,c.deadline+180);d+=5){const moved={...c,deadline:d};const t=fits(moved,s,others);if(t!==null){options.push({kind:'extend_deadline',choreId:c.id,newDeadline:d,text:`Let it finish by ${time(d)} instead of ${time(c.deadline)} (${d-c.deadline} min later). It would run ${time(t)}-${time(t+c.duration)}.`});break}}
  for(const q of s.quiet){
   const touches=[...blockers].some(b=>b.includes(q.person+"'s"));
   if(!touches)continue;
   let found:Option|null=null;
   for(let delta=5;delta<=60&&!found;delta+=5)for(const sign of [1,-1]){const ns=q.start+sign*delta,ne=q.end+sign*delta;if(ns<0||ne>1440)continue;
    const next={...s,quiet:s.quiet.map(x=>x.id===q.id?{...x,start:ns,end:ne}:x)};
    if(fits(c,next,others)!==null){found={kind:'shift_quiet',quietId:q.id,person:q.person,newStart:ns,newEnd:ne,text:`Ask ${q.person} to move "${q.label}" ${delta} min ${sign>0?'later':'earlier'} (${time(ns)}-${time(ne)}). That is their decision, not ours.`};break}}
   if(found)options.push(found)}
  options.push({kind:'skip_today',choreId:c.id,text:`Leave "${c.label}" for another day, or do it by hand without noise.`});
  return [{choreId:c.id,label:c.label,blockers:[...blockers],options}];
 });
}
