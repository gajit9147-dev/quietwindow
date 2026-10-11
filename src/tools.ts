import {createPlans,validateState,type State} from './planner';
export type AgentCall={name:'get_household'}|{name:'propose_plans';revision:number}|{name:'update_chore_deadline';revision:number;id:string;deadline:number}|{name:'update_quiet_window';revision:number;id:string;start:number;end:number};
export const toolDefinitions=[{name:'get_household',description:'Read declared quiet windows and chores for this fictional session.'},{name:'propose_plans',description:'Generate alternatives without saving or approving.'},{name:'update_chore_deadline',description:'Extend one chore deadline after a reviewed user request, invalidating any saved approval.'},{name:'update_quiet_window',description:'Change one declared quiet window after a reviewed user request, invalidating any saved approval.'}];
// Deliberately no approve tool. Approval remains a reviewed UI action.
export function runAgentTool(s:State,call:AgentCall){
 if(call.name==='get_household')return {state:s,result:{revision:s.revision,quiet:s.quiet,chores:s.chores,accepted:s.accepted}};
 if(call.revision!==s.revision)throw Error('Household changed. Reload before applying.');
 if(call.name==='propose_plans')return {state:s,result:createPlans(s)};
 if(call.name==='update_quiet_window'){
  if(!s.quiet.some(q=>q.id===call.id))throw Error('Unknown quiet window');
  const next={...s,quiet:s.quiet.map(q=>q.id===call.id?{...q,start:call.start,end:call.end}:q),revision:s.revision+1,accepted:null,previous:s.accepted||s.previous||null,history:[{at:new Date().toISOString(),label:'Updated quiet window through reviewed tool call'},...s.history].slice(0,20)};
  validateState(next);return {state:next,result:{revision:next.revision,approvalInvalidated:true}};
 }
 if(call.name==='update_chore_deadline'){
  if(!s.chores.some(c=>c.id===call.id))throw Error('Unknown chore');
  const next={...s,chores:s.chores.map(c=>c.id===call.id?{...c,deadline:call.deadline}:c),revision:s.revision+1,accepted:null,previous:s.accepted||s.previous||null,history:[{at:new Date().toISOString(),label:'Extended a chore deadline through reviewed tool call'},...s.history].slice(0,20)};
  validateState(next);return {state:next,result:{revision:next.revision,approvalInvalidated:true}};
 }
 throw Error('Unknown tool');
}
