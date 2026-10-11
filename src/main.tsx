import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {initialState,time,planDiff,type State,type Plan,type Slot} from './planner';
import type {Negotiation,Option} from './negotiate';
import './style.css';

async function api(path:string,body?:unknown){
 const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data;
}
type Preview={status:'proposal'|'needs_clarification';understood?:string;question?:string;toolTrace?:{tool:string;note:string}[]};
const ROOMS:[string,string][]=[['office','Office'],['bedroom','Bedroom'],['living','Living room'],['kitchen','Kitchen'],['utility','Utility']];
const EXAMPLES=["Maya's call moved to 4pm","Leo's reading ends at 17:30","Push Arun's rest 30 minutes later"];
const describe=(id:string)=>id.startsWith('smallest')?'Keeps every chore that still works where it was. Moves only what the change breaks.':id.startsWith('early')?'Starts each chore at its earliest compatible time.':'Pushes chores toward their deadlines to keep the afternoon open.';
const stats=(p:Plan)=>{const t=p.trace||[];const moved=t.filter(x=>x.kind==='moved'),changed=t.filter(x=>x.kind==='moved'||x.kind==='new').length;return {changed,shift:moved.reduce((n,x)=>n+Math.abs((x.to!.start)-(x.from!.start)),0),unplaced:p.unscheduled.length}};

function Timeline({s,before,after}:{s:State;before:Plan|null;after:Plan}){
 const all=[...s.quiet.flatMap(q=>[q.start,q.end]),...s.chores.flatMap(c=>[c.earliest,c.deadline])];
 const lo=Math.floor(Math.min(...all)/60)*60,hi=Math.ceil(Math.max(...all)/60)*60,span=hi-lo;
 const pct=(m:number)=>`${((m-lo)/span)*100}%`,wid=(a:number,b:number)=>`${((b-a)/span)*100}%`;
 const hours:number[]=[];for(let h=lo;h<=hi;h+=60)hours.push(h);
 const label=(id:string)=>{const w=(s.chores.find(c=>c.id===id)?.label||id).split(' ').sort((a,b)=>b.length-a.length)[0];return w[0].toUpperCase()+w.slice(1)};
 const roomOf=(id:string)=>s.chores.find(c=>c.id===id)?.room;
 const blocks=(plan:Plan|null,keyPrefix:string,showOld:boolean)=>ROOMS.map(([room,name])=>{
  const slots:Slot[]=(plan?.slots||[]).filter(x=>roomOf(x.choreId)===room);
  return <div className="trow" key={keyPrefix+room}><div className="room">{name}</div><div className="track">{hours.map(h=><i className="gridline" key={h} style={{left:pct(h)}}/>)}
   {s.quiet.filter(q=>q.room===room).map(q=><span key={q.id} className="block q" style={{left:pct(q.start),width:wid(q.start,q.end)}} title={`${q.person}: ${q.label}`}>{q.person} · {q.label}</span>)}
   {showOld&&after.trace?.filter(t=>t.kind==='moved'&&t.from&&roomOf(t.choreId)===room).map(t=><span key={'o'+t.choreId} className="block old" style={{left:pct(t.from!.start),width:wid(t.from!.start,t.from!.end)}} title="Previous position">{label(t.choreId)}</span>)}
   {slots.map(x=>{const c=s.chores.find(c=>c.id===x.choreId)!;const bad=keyPrefix==='b'&&s.quiet.some(q=>overlapsQuiet(c,x,q));return <span key={x.choreId} className={'block '+(bad?'conflict':'c')} style={{left:pct(x.start),width:wid(x.start,x.end)}} title={`${c.label} ${time(x.start)}-${time(x.end)}`}>{label(x.choreId)}</span>})}
  </div></div>});
 return <div className="timeline"><div className="legend"><span><i className="swatch quiet"/>Quiet window</span><span><i className="swatch chore"/>Chore</span><span><i className="swatch old"/>Previous position</span><span><i className="swatch conflict"/>Conflict with today's quiet windows</span></div>
  <div className="tl"><div className="subhead">{before?'Before · last approved plan':'Before · no approved plan yet'}</div>
  <div className="hours"><div/><div className="scale">{hours.map(h=><span key={h} style={{left:pct(h)}}>{time(h)}</span>)}</div></div>{blocks(before,'b',false)}
  <div className="subhead">After · {after.label}</div>{blocks(after,'a',true)}</div></div>;
}
function overlapsQuiet(c:State['chores'][0],x:Slot,q:State['quiet'][0]){
 const reach:Record<string,string[]>={office:['office'],living:['living','office','bedroom'],utility:['utility','office'],kitchen:['kitchen','living','office'],bedroom:['bedroom']};
 return (c.noisy?reach[c.room]:[c.room]).includes(q.room)&&x.start<q.end&&q.start<x.end;
}

function App(){
 const [s,setS]=useState<State>(initialState()),[plans,setPlans]=useState<Plan[]>([]),[sel,setSel]=useState<string>(''),[status,setStatus]=useState('Loading your demo household…'),[busy,setBusy]=useState(false);
 const [llm,setLlm]=useState(false),[text,setText]=useState(EXAMPLES[0]),[preview,setPreview]=useState<Preview|null>(null),[neg,setNeg]=useState<Negotiation[]>([]),[opt,setOpt]=useState<string>(''),[confirming,setConfirming]=useState(false),[ack,setAck]=useState(false);
 useEffect(()=>{api('health').then(h=>setLlm(h.aiConnected===true)).catch(()=>{})},[]);
 useEffect(()=>{api('state').then(x=>{setS(x);setStatus('Your household is ready. Nothing changes until you approve.')}).catch(e=>setStatus(e.message))},[]);
 const plan=plans.find(p=>p.id===sel)||null;
 const act=async(fn:()=>Promise<void>)=>{setBusy(true);try{await fn()}catch(e){setStatus(e instanceof Error?e.message:'Something went wrong')}finally{setBusy(false)}};
 const reset=()=>{setPreview(null);setNeg([]);setOpt('');setConfirming(false);setAck(false)};
 async function loadPlans(state:State,list?:Plan[]){const ps:Plan[]=list||await api('plans',{revision:state.revision});setPlans(ps);const pick=ps.find(p=>p.id.startsWith('smallest'))||ps[0];setSel(pick.id);setConfirming(false);setAck(false);await loadNeg(state,pick)}
 async function loadNeg(state:State,p:Plan){if(!p.unscheduled.length){setNeg([]);return}setNeg(await api('negotiate',{revision:state.revision,planId:p.id}))}
 const review=()=>act(async()=>{const out=await api('mediate',{revision:s.revision,text,confirm:false});setPreview(out);setStatus(out.status==='proposal'?'Request understood. Review it, then apply the change.':'I need one more detail before changing anything.')});
 const applyChange=()=>act(async()=>{const out=await api('mediate',{revision:s.revision,text,confirm:true});setS(out.state);setPreview(null);reset();await loadPlans(out.state,out.plans);setStatus('Change applied. The previous approval is no longer valid. Review the options below.')});
 const generate=()=>act(async()=>{await loadPlans(s);setStatus('Options ready. Review the trade-offs before saving.')});
 const choose=(p:Plan)=>{setSel(p.id);setConfirming(false);setAck(false);setOpt('');act(()=>loadNeg(s,p))};
 const flat:{key:string;n:Negotiation;o:Option}[]=neg.flatMap(n=>n.options.map((o,i)=>({key:n.choreId+i,n,o})));
 const chosen=flat.find(f=>f.key===opt);
 const applyOption=()=>act(async()=>{if(!chosen)return;if(chosen.o.kind==='skip_today'){setStatus('Nothing changed. Leave this chore for another day, or pick another option.');return}const next=await api('apply-option',{revision:s.revision,option:chosen.o});setS(next);reset();await loadPlans(next);setStatus('Option applied after your review. Previous approval is no longer valid. Fresh options are below.')});
 const approve=()=>act(async()=>{if(!plan)return;const next=await api('approve',{revision:s.revision,planId:plan.id,acknowledgeIncomplete:plan.unscheduled.length>0&&ack});setS(next);setPlans([]);setSel('');setNeg([]);setConfirming(false);setAck(false);setStatus('Plan saved to your demo session.')});
 const before=s.accepted||s.previous||null;
 const diff=plan?planDiff(s,plan):null;void diff;
 const chosenPlanName=plan?.label;
 return <div className="app">
  <aside className="sidebar"><a className="brand" href="#today"><span className="brandmark" aria-hidden="true"/>QuietWindow</a>
   <div className="nav-label">Workspace</div>
   <nav aria-label="Main navigation"><a className="active" aria-current="page" href="#today">Today / Plan review</a><a href="#household">Household rules</a><a href="#chores">Chores</a><a href="#history">Plan history</a></nav>
   <div className="side-block" id="household"><div className="eyebrow">Household</div><p><strong>Fictional demo home</strong></p><p className="muted">3 people · 5 rooms</p><p><span className="dot"/>Sound-reach map declared</p><p className="muted">No microphones or audio sensing</p></div>
   <div className="side-block"><div className="eyebrow">Active constraints</div>{s.quiet.map(q=><div className="constraint" key={q.id}><strong>{q.person} · {q.label}</strong><small>{q.room} · {time(q.start)}-{time(q.end)}</small></div>)}</div>
   <div className="side-foot">{llm?<>Demonstration with an LLM reader<br/>Offline rules as fallback<br/></>:<>Offline demonstration<br/>No live AI connection<br/></>}All decisions require your review</div></aside>
  <div className="mobilebar"><a className="brand" href="#today"><span className="brandmark" aria-hidden="true"/>QuietWindow</a><span className="tag warn">{llm?'LLM reader + offline fallback':'Offline prototype'}</span></div>
  <main className="main" id="today">
   <div className="top"><div><div className="eyebrow">Fictional demo household</div><h1>Review the updated day</h1><p className="muted" aria-live="polite">{status}</p></div>
    <div className="tags"><span className="tag">Household revision {s.revision}</span><span className={'tag '+(s.accepted?'good':'warn')}>{s.accepted?'Plan approved':'Not approved'}</span><span className="tag warn">Offline prototype · no live AI</span></div></div>

   <section className="panel request" aria-labelledby="req-h">
    <div><div className="eyebrow">01 · Household request</div><h2 id="req-h">What changed?</h2>
     <label className="sr" htmlFor="req" style={{position:'absolute',left:-9999}}>Describe what changed</label>
     <VoiceButton onText={t=>{setText(t.slice(0,300));setPreview(null)}}/>
     <textarea id="req" value={text} maxLength={300} onChange={e=>{setText(e.target.value);setPreview(null)}}/>
     <div className="row"><button className="primary" onClick={review} disabled={busy||!text.trim()}>Review request</button>{plans.length===0&&<button onClick={generate} disabled={busy}>Plan the day as it is</button>}</div>
     <div className="examples" aria-label="Example requests">{EXAMPLES.map(x=><button key={x} onClick={()=>{setText(x);setPreview(null)}}>{x}</button>)}</div>
     <p className="muted" style={{marginTop:12,fontSize:12}}>{llm?'A language model (Gemini) reads your sentence and proposes one typed edit, which the server checks against the household. If it is unavailable, an offline rule-based reader is used. Neither has an approve tool.':'An offline rule-based reader turns your sentence into typed tool calls. It is not a language model, and it has no approve tool.'}</p></div>
    <div><div className="eyebrow">02 · Tool-call trace</div><h2>How the request was read</h2>
     {!preview&&<p className="muted" style={{marginTop:10}}>Nothing read yet. Press "Review request".</p>}
     {preview?.status==='needs_clarification'&&<div className="question" role="status"><strong>One question first</strong><p>{preview.question}</p></div>}
     {preview?.status==='proposal'&&<>
      <div className="understood" role="status"><strong>Understood</strong><p>{preview.understood}</p></div>
      <details className="trace"><summary>{preview.toolTrace!.length} typed tool calls (preview, nothing saved)</summary><div className="tracebody">{preview.toolTrace!.map((t,i)=><div key={i}><span className="n">{String(i+1).padStart(2,'0')}</span><span className="fn">{t.tool}</span> <span className="ok">→</span> {t.note}</div>)}</div></details>
      <div className="row" style={{marginTop:12}}><button className="primary" onClick={applyChange} disabled={busy}>Apply this change and plan</button><button onClick={()=>setPreview(null)} disabled={busy}>Cancel</button></div>
      <p className="muted" style={{fontSize:12,marginTop:8}}>Applying edits the declared quiet window and clears any saved approval. It does not approve a plan.</p></>}
    </div></section>

   {plans.length===0&&!s.accepted&&<div className="notice"><div><strong>No plan options yet</strong><p>Review a change above, or plan the day as it is. We check quiet windows, room reach and deadlines. Nothing saves automatically.</p></div></div>}
   {plan&&plan.unscheduled.length>0&&<div className="notice" role="alert"><div><strong>Decision needed: {plan.unscheduled.length} {plan.unscheduled.length===1?'chore does':'chores do'} not fit</strong><p>This option leaves {plan.unscheduled.map(u=>s.chores.find(c=>c.id===u.choreId)?.label).join(', ')} unplaced. See the choices below before approving.</p></div><span className="tag warn">{plan.unscheduled.length} unresolved</span></div>}

   {plans.length>0&&<section className="section" aria-labelledby="cmp-h"><div className="section-head"><div><div className="eyebrow">03 · Compare alternatives</div><h2 id="cmp-h">Choose a planning approach</h2></div><span className="muted" style={{fontSize:12}}>All options are proposals, not commitments</span></div>
    <div className="plans">{plans.map(p=>{const st=stats(p);const on=p.id===sel;return <button key={p.id} className={'plan'+(on?' selected':'')} aria-pressed={on} onClick={()=>choose(p)}>
     <div className="plan-top"><h3>{p.label}</h3><span className={'tag '+(on?'good':'')}>{on?'Selected':p.id.startsWith('smallest')?'Recommended':'Alternative'}</span></div><p>{describe(p.id)}</p>
     <div className="metric"><span>Chores changed</span><strong>{st.changed}</strong></div><div className="metric"><span>Total shift</span><strong>{st.shift} min</strong></div><div className="metric"><span>Not placed</span><strong>{st.unplaced}</strong></div></button>})}</div>
    <p className="muted" style={{fontSize:12,marginTop:10}}>Each option compares chore orderings on a 5-minute grid. It is not a proof of the best possible plan.</p></section>}

   {plan&&<section className="section" aria-labelledby="tl-h"><div className="section-head"><div><div className="eyebrow">04 · Schedule comparison</div><h2 id="tl-h">Before and after, by room</h2></div><span className="tag">{plan.label}</span></div><Timeline s={s} before={before} after={plan}/>
    <p className="muted mobilehint" style={{fontSize:12,marginTop:8}}>Scroll the timeline sideways to see the whole day.</p><p className="muted" style={{fontSize:12,marginTop:8}}>Sound reach follows a declared room map, not measured decibels.</p></section>}

   {plan&&<section className="section explain" id="chores" aria-labelledby="why-h">
    <div className="panel"><div className="eyebrow">05 · Explain</div><h2 id="why-h">Why each chore changed</h2><div style={{marginTop:8}}>
     {(plan.trace||[]).map(t=>{const c=s.chores.find(c=>c.id===t.choreId);return <div className={'reason '+t.kind} key={t.choreId}><div className="reason-head"><strong>{c?.label}{t.to?` · ${time(t.to.start)}-${time(t.to.end)}`:''}</strong><span className={'status '+t.kind}>{t.kind==='kept'?'KEPT':t.kind==='moved'?'MOVED':t.kind==='new'?'PLACED':'NOT PLACED'}</span></div><p>{t.text}{t.kind==='unplaced'?' '+(plan.unscheduled.find(u=>u.choreId===t.choreId)?.reason||''):''}</p></div>})}</div></div>
    <div className="panel"><div className="eyebrow">06 · Negotiate</div><h2>{neg.length?'What should happen?':'Nothing to negotiate'}</h2>
     {!neg.length&&<p className="muted" style={{marginTop:10}}>Every chore fits in this option.</p>}
     {neg.map(n=><div key={n.choreId}><p className="blocker"><strong>{n.label}</strong> is blocked by: {n.blockers.join('; ')||'its own time window'}.</p>
      {n.options.map((o,i)=>{const key=n.choreId+i;return <label className={'option'+(opt===key?' on':'')} key={key}><input type="radio" name="opt" checked={opt===key} onChange={()=>setOpt(key)}/><span><strong>{o.kind==='extend_deadline'?'Extend the deadline':o.kind==='shift_quiet'?`Ask ${o.person} to move their window`:'Skip it today'}</strong>{o.text}{o.kind==='shift_quiet'&&<span className="cost" style={{display:'block'}}>Only applies after {o.person} agrees. That is their decision.</span>}</span></label>})}</div>)}
     {chosen&&chosen.o.kind!=='skip_today'&&<button className="primary" style={{marginTop:12}} onClick={applyOption} disabled={busy}>{chosen.o.kind==='shift_quiet'?`${chosen.o.person} agreed: apply this change`:'Apply this change'}</button>}
     {chosen&&chosen.o.kind==='skip_today'&&<p className="muted" style={{marginTop:12,fontSize:12}}>Skipping changes nothing. You can still approve this option with the chore left unplaced.</p>}
     {neg.length>0&&<p className="muted" style={{fontSize:12,marginTop:10}}>No choice is applied automatically. Applying one edits the household, clears approval and re-plans.</p>}</div>
   </section>}

   {s.accepted&&<section className="panel saved" id="history" aria-labelledby="sv-h"><div className="eyebrow">Approved plan</div><h2 id="sv-h">{s.accepted.label} · revision {s.accepted.revision}</h2><p className="muted">Saved in this demo session only.</p><div style={{marginTop:8}}>{[...s.accepted.slots].sort((a,b)=>a.start-b.start).map(x=><div className="savedrow" key={x.choreId}><span>{time(x.start)} - {time(x.end)}</span><strong>{s.chores.find(c=>c.id===x.choreId)?.label}</strong></div>)}</div>
    {s.accepted.unscheduled.length>0&&<p className="muted" style={{marginTop:8}}>{s.accepted.unscheduled.length} chore(s) still unresolved. Approval did not make them fit.</p>}</section>}

   {plan&&<div className="approval" id="approval" role="region" aria-label="Approval"><div><div className="eyebrow">07 · Final review</div><strong>{confirming?`Confirm ${chosenPlanName}`:'Approval is still required'}</strong><p>Selected: {chosenPlanName}, based on household revision {s.revision}. {plan.unscheduled.length?`${plan.unscheduled.length} chore(s) stay unplaced, so a second confirmation is required.`:'Every chore fits.'} If the household changes first, this approval is rejected.</p></div>
    {!confirming?<button className="primary" onClick={()=>setConfirming(true)} disabled={busy}>Review and approve</button>
     :<div className="confirm">{plan.unscheduled.length>0&&<label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I understand {plan.unscheduled.length} chore(s) stay unplaced.</label>}<button className="primary" onClick={approve} disabled={busy||(plan.unscheduled.length>0&&!ack)}>Confirm and save</button><button onClick={()=>{setConfirming(false);setAck(false)}}>Back</button></div>}</div>}

   <div className="footer-note"><span>QuietWindow is a web simulation, not an installed Alexa add-on. {llm?'Only the request sentence is sent to a language model. ':'No live AI. '}No device control or household messages. Fictional people only.</span>
    <button className="textbtn" onClick={()=>act(async()=>{const next=await api('reset',{});setS(next);setPlans([]);setSel('');reset();setText(EXAMPLES[0]);setStatus('Fictional household reset.')})} disabled={busy}>Reset fictional demo</button></div>
  </main></div>;
}
createRoot(document.getElementById('root')!).render(<App/>);

function VoiceButton({onText}:{onText:(t:string)=>void}){
 const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;const [on,setOn]=useState(false);
 if(!SR)return null;
 const go=()=>{const r=new SR();r.lang='en-US';r.onresult=(e:any)=>onText(e.results[0][0].transcript);r.onend=()=>setOn(false);r.onerror=()=>setOn(false);setOn(true);r.start()};
 return <button type="button" className="textbtn" onClick={go} aria-pressed={on}>{on?'Listening...':'Speak the request'}</button>}
