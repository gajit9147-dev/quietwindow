import test from 'node:test';import assert from 'node:assert/strict';
import {initialState} from '../src/planner.ts';import {readWithLLM} from '../src/llm.ts';import {mediate} from '../src/mediator.ts';
const reply=(o:unknown,ok=true)=>(async()=>({ok,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]})})) as any;
process.env.GEMINI_API_KEY='test-key';
test('valid model output becomes a typed understanding',async()=>{
 const s=initialState();const q=s.quiet[0];
 const u:any=await readWithLLM(s,'move it',reply({quietId:q.id,newStart:960,newEnd:1020}));
 assert.equal(u.quietId,q.id);assert.equal(u.newStart,960);
 const m=mediate(s,'move it',false,{u,engine:'gemini'});assert.equal(m.status,'proposal');assert.equal(m.engine,'gemini');assert.equal(m.applied,false)});
test('unknown window id, bad times and http errors fall back (null)',async()=>{
 const s=initialState();
 assert.equal(await readWithLLM(s,'x',reply({quietId:'nope',newStart:60,newEnd:120})),null);
 assert.equal(await readWithLLM(s,'x',reply({quietId:s.quiet[0].id,newStart:900,newEnd:100})),null);
 assert.equal(await readWithLLM(s,'x',reply({},false)),null);
 assert.equal(await readWithLLM(s,'x',(async()=>{throw Error('net')}) as any),null)});
test('model asking a question is passed through, no key means null',async()=>{
 const s=initialState();
 assert.deepEqual(await readWithLLM(s,'x',reply({question:'Which window?'})),{question:'Which window?'});
 delete process.env.GEMINI_API_KEY;assert.equal(await readWithLLM(s,'x',reply({})),null)});
