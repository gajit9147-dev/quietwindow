export type Quiet = {id:string; person:string; label:string; room:string; start:number; end:number};
export type Chore = {id:string; label:string; room:string; duration:number; noisy:boolean; earliest:number; deadline:number};
export type State = {revision:number; quiet:Quiet[]; chores:Chore[]; accepted:Plan|null; history:{at:string;label:string}[]; previous:Plan|null};
export type Slot = {choreId:string;start:number;end:number;reason:string};
export type TraceItem = {choreId:string;kind:'kept'|'moved'|'new'|'unplaced';from?:{start:number;end:number};to?:{start:number;end:number};text:string};
export type Plan = {id:string; revision:number;label:string;slots:Slot[];unscheduled:{choreId:string;reason:string}[];trace?:TraceItem[]};
export const time=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const parseTime=(s:string)=>{if(!/^\d{2}:\d{2}$/.test(s))throw Error('Use HH:MM');const [h,m]=s.split(':').map(Number);if(h>23||m>59)throw Error('Invalid time');return h*60+m};
export const initialState=():State=>({revision:0,quiet:[{id:'q1',person:'Maya',label:'Client call',room:'office',start:900,end:960},{id:'q2',person:'Arun',label:'Afternoon rest',room:'bedroom',start:840,end:930},{id:'q3',person:'Leo',label:'Reading time',room:'living',start:990,end:1020}],chores:[{id:'c1',label:'Vacuum living room',room:'living',duration:30,noisy:true,earliest:840,deadline:1080},{id:'c2',label:'Run laundry',room:'utility',duration:45,noisy:true,earliest:840,deadline:1080},{id:'c3',label:'Blend dinner prep',room:'kitchen',duration:15,noisy:true,earliest:960,deadline:1080},{id:'c4',label:'Sort clean clothes',room:'bedroom',duration:20,noisy:false,earliest:840,deadline:1080},{id:'c5',label:'Wipe kitchen surfaces',room:'kitchen',duration:20,noisy:false,earliest:840,deadline:1080},{id:'c6',label:'Take recycling out',room:'utility',duration:15,noisy:false,earliest:840,deadline:1080}],accepted:null,previous:null,history:[]});
// User-declared sound reach, not measured decibels. Bedroom is isolated from utility.
export const reaches:Record<string,string[]>={office:['office'],living:['living','office','bedroom'],utility:['utility','office'],kitchen:['kitchen','living','office'],bedroom:['bedroom']};
export const overlap=(a:number,b:number,c:number,d:number)=>a<d&&c<b;
const validText=(x:unknown,max=120):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const validRoom=(x:unknown):x is string=>typeof x==='string'&&Object.hasOwn(reaches,x);
export function validateState(s:State){
 if(!s||!Array.isArray(s.quiet)||!Array.isArray(s.chores)||!Number.isSafeInteger(s.revision)||s.revision<0)throw Error('Invalid household');
 if(s.quiet.length>20||s.chores.length>20)throw Error('Too many items');
 const quietIds=new Set<string>(),choreIds=new Set<string>();
 for(const q of s.quiet){if(!q||!validText(q.id,40)||quietIds.has(q.id)||!validText(q.person,60)||!validText(q.label)||!Number.isInteger(q.start)||!Number.isInteger(q.end)||q.start<0||q.end>1440||q.start>=q.end||!validRoom(q.room))throw Error('Invalid quiet window');quietIds.add(q.id)}
 for(const c of s.chores){if(!c||!validText(c.id,40)||choreIds.has(c.id)||!validText(c.label)||typeof c.noisy!=='boolean'||!Number.isInteger(c.duration)||c.duration<=0||c.duration>180||!Number.isInteger(c.earliest)||!Number.isInteger(c.deadline)||c.earliest<0||c.deadline>1440||c.earliest>=c.deadline||!validRoom(c.room))throw Error('Invalid chore');choreIds.add(c.id)}
}
export function conflict(c:Chore,start:number,s:State):string|null {const end=start+c.duration;for(const q of s.quiet){if((c.noisy?reaches[c.room]:[c.room]).includes(q.room)&&overlap(start,end,q.start,q.end))return `${q.person}'s ${q.label.toLowerCase()} in the ${q.room} (${time(q.start)}-${time(q.end)})`};return null}
function searchPlans(s:State):Plan[]{
 validateState(s);
 const base=[...s.chores].sort((a,b)=>a.deadline-b.deadline||Number(b.noisy)-Number(a.noisy)||a.id.localeCompare(b.id));
 const orders:Chore[][]=[];
 // Small-demo search: compare every ordering for six chores, each using greedy slot placement.
 // This improves coverage but does not prove global optimality across every start-time combination.
 function permute(prefix:Chore[],rest:Chore[]){if(!rest.length){orders.push(prefix);return}for(let i=0;i<rest.length;i++)permute([...prefix,rest[i]],rest.filter((_,j)=>i!==j))}
 if(base.length<=6)permute([],base);else{orders.push(base,[...base].reverse());let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;for(let k=0;k<60;k++){const o=[...base];for(let i=o.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[o[i],o[j]]=[o[j],o[i]]}orders.push(o)}}
 return ['early','late'].map(kind=>{
  let best:Plan|null=null,bestScore=Infinity;
  for(const order of orders){const slots:Slot[]=[],unscheduled:Plan['unscheduled']=[];
   for(const c of order){let chosen:number|null=null;const candidates:number[]=[];for(let t=Math.ceil(c.earliest/5)*5;t+c.duration<=c.deadline;t+=5)candidates.push(t);if(kind==='late')candidates.reverse();for(const t of candidates){if(conflict(c,t,s)||slots.some(x=>overlap(t,t+c.duration,x.start,x.end)))continue;chosen=t;break}
    if(chosen===null)unscheduled.push({choreId:c.id,reason:'The bounded ordering search could not place this chore. Different start-time combinations may help; review constraints before deciding.'});
    else slots.push({choreId:c.id,start:chosen,end:chosen+c.duration,reason:c.noisy?'Outside every declared quiet window in rooms this sound reaches.':'Respects room occupancy and other chore times.'});
   }
   const score=unscheduled.length*1000000+slots.reduce((n,x)=>n+(kind==='early'?x.end:-x.start),0);
   if(score<bestScore){bestScore=score;best={id:kind+'-'+s.revision,revision:s.revision,label:kind==='early'?'Finish earlier':'Keep the afternoon open',slots:slots.sort((a,b)=>a.start-b.start),unscheduled}}
  }
  return best!;
 });
}
export function approve(s:State,p:Plan):State{if(p.revision!==s.revision)throw Error('Plan is stale. Generate fresh alternatives.');const trusted=createPlans(s).find(x=>x.id===p.id);if(!trusted)throw Error('Unknown plan');return {...s,revision:s.revision+1,accepted:trusted,history:[{at:new Date().toISOString(),label:'Approved '+trusted.label},...s.history].slice(0,20)}}

export function planDiff(s:State,p:Plan){const prior=s.accepted||s.previous;if(!prior)return {baseline:false,moved:0,newlyPlaced:p.slots.length,unresolved:p.unscheduled.length};let moved=0,newlyPlaced=0;for(const x of p.slots){const old=prior.slots.find(y=>y.choreId===x.choreId);if(!old)newlyPlaced++;else if(old.start!==x.start||old.end!==x.end)moved++}return {baseline:true,moved,newlyPlaced,unresolved:p.unscheduled.length}}


// ---- Minimum-disruption replan and reason trace ----
const priorPlan=(s:State)=>s.accepted||s.previous;
const clash=(c:Chore,t:number,s:State,slots:Slot[])=>conflict(c,t,s)||(slots.some(x=>overlap(t,t+c.duration,x.start,x.end))?'another chore':null);
function closeness(c:Chore,s:State,target:number){const out:number[]=[];for(let t=Math.ceil(c.earliest/5)*5;t+c.duration<=c.deadline;t+=5)out.push(t);return out.sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||a-b)}
function placeNear(s:State,fixed:Slot[],order:Chore[],prior:Plan){
 const slots=[...fixed],unscheduled:Plan['unscheduled']=[];let cost=0;
 for(const c of order){const old=prior.slots.find(x=>x.choreId===c.id);const target=old?old.start:c.earliest;let chosen:number|null=null;
  for(const t of closeness(c,s,target)){if(clash(c,t,s,slots))continue;chosen=t;break}
  if(chosen===null)unscheduled.push({choreId:c.id,reason:'No start time fits between its earliest time and deadline without a declared quiet window or another chore. See the trade-off options.'});
  else{slots.push({choreId:c.id,start:chosen,end:chosen+c.duration,reason:'Placed as close as possible to its earlier time.'});cost+=old?Math.abs(chosen-old.start):0}}
 return {slots,unscheduled,cost}}
function permutations<T>(xs:T[]):T[][]{if(xs.length<=1)return [xs];const out:T[][]=[];xs.forEach((x,i)=>permutations([...xs.slice(0,i),...xs.slice(i+1)]).forEach(r=>out.push([x,...r])));return out}
export function smallestChangePlan(s:State):Plan|null{
 const prior=priorPlan(s);if(!prior)return null;
 const keepable:Slot[]=[];
 for(const old of [...prior.slots].sort((a,b)=>a.start-b.start)){const c=s.chores.find(x=>x.id===old.choreId);if(!c)continue;
  if(old.start>=c.earliest&&old.end<=c.deadline&&old.end-old.start===c.duration&&!clash(c,old.start,s,keepable))keepable.push(old)}
 const attempts:{slots:Slot[];unscheduled:Plan['unscheduled'];cost:number}[]=[];
 for(const fixed of [keepable,[] as Slot[]]){
  const rest=s.chores.filter(c=>!fixed.some(x=>x.choreId===c.id));
  const orders=rest.length<=6?permutations(rest):[rest,[...rest].reverse()];
  for(const o of orders)attempts.push(placeNear(s,fixed,o,prior))}
 attempts.sort((a,b)=>a.unscheduled.length-b.unscheduled.length||a.cost-b.cost);
 const best=attempts[0];
 return {id:'smallest-'+s.revision,revision:s.revision,label:'Smallest change',slots:best.slots.sort((a,b)=>a.start-b.start),unscheduled:best.unscheduled}}
export function withTrace(s:State,p:Plan):Plan{
 const prior=priorPlan(s);const trace:TraceItem[]=[];const name=(id:string)=>s.chores.find(c=>c.id===id)?.label||id;
 for(const x of p.slots){const old=prior?.slots.find(y=>y.choreId===x.choreId);const c=s.chores.find(y=>y.id===x.choreId);
  if(!prior||!old)trace.push({choreId:x.choreId,kind:'new',to:{start:x.start,end:x.end},text:`${name(x.choreId)} placed at ${time(x.start)}. ${x.reason}`});
  else if(old.start===x.start&&old.end===x.end)trace.push({choreId:x.choreId,kind:'kept',from:{start:old.start,end:old.end},to:{start:x.start,end:x.end},text:`${name(x.choreId)} stays at ${time(x.start)}.`});
  else{const why=c?conflict(c,old.start,s):null;trace.push({choreId:x.choreId,kind:'moved',from:{start:old.start,end:old.end},to:{start:x.start,end:x.end},text:`${name(x.choreId)} moves from ${time(old.start)} to ${time(x.start)}${why?` because ${why} now blocks the old time`:old.end-old.start!==x.end-x.start?' because its length changed':' to make room for another chore'}.`})}}
 for(const u of p.unscheduled)trace.push({choreId:u.choreId,kind:'unplaced',text:`${name(u.choreId)} does not fit in this option${(u as any).reason?`: ${(u as any).reason}`:''}.`});
 return {...p,trace}}
export function createPlans(s:State):Plan[]{const base=searchPlans(s),small=smallestChangePlan(s);return (small?[small,...base]:base).map(p=>withTrace(s,p))}
