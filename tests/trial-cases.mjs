import path from 'node:path';
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
export async function run({assert,test,call,db,q,policy,temp,base,clear}){
 const ai=await import(path.join(temp,'lib/server/recognition.js'));
 const {TRIAL_RESERVE_SQL}=await import(path.join(temp,'lib/server/quota-sql.js'));
 const usage={costVnd:1,model:'fixture',inputTokens:1,outputTokens:0};
 const reset=()=>{clear();db.exec("UPDATE users SET role='user' WHERE id IN ('a','b'); UPDATE users SET role='admin' WHERE id='admin'");};
 const reserve=(key,at=base,user='admin')=>q.reserve(user,key,at,'fixture-hash',true);
 if(!policy.ADMIN_TRIAL_ENABLED){
  await test('Trial closed: admin admission blocked, live API remains disabled',async()=>{reset();assert.equal(policy.LIVE_OPENAI_ENABLED,false);await assert.rejects(()=>reserve('closed-trial-request-001'),e=>e.status===503);assert.equal((await q.quota('admin',base)).aiEnabled,false);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,0);});
  return;
 }
 await test('Trial allows admin only; ordinary users cannot opt in or create a reservation',async()=>{reset();await assert.rejects(()=>reserve('trial-user-rejected-001',base,'a'),e=>e.status===429);assert.equal((await q.quota('a',base)).aiEnabled,false);assert.equal((await q.quota('admin',base)).aiEnabled,true);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,0);});
 await test('Trial counts every outcome, caps at five, preserves success-only quota and free recovery',async()=>{
  reset();let first;
  for(const [i,outcome] of ['unknown','success','no_guidance','error','unknown'].entries()){const r=await reserve('trial-count-key-000'+i);if(!first)first=r;await q.settle(r.id,outcome,usage,base,{status:outcome,message:'fixture'});}
  assert.equal((await q.trialState('admin',base)).attempts,5);assert.equal((await q.quota('admin',base)).dayUsed,1);
  await assert.rejects(()=>reserve('trial-sixth-blocked-001'),e=>e.status===429);
  assert.equal((await reserve('trial-count-key-0000')).id,first.id);
  const before=db.prepare('SELECT COUNT(*) n,SUM(cost_vnd) cost FROM ai_requests').get();
  const recovered=await call('recognition?key=trial-count-key-0000',{user:'admin'});assert.equal(recovered.status,200);assert.equal((await recovered.json()).requestId,first.id);
  assert.equal((await ai.recognitionResult('admin',first.id,policy.TRIAL_EXPIRES_AT+1)).requestId,first.id);
  assert.deepEqual(db.prepare('SELECT COUNT(*) n,SUM(cost_vnd) cost FROM ai_requests').get(),before);
 });
 await test('Trial deduplicates pending requests without reserving another call or cost',async()=>{reset();const a=await reserve('trial-duplicate-key-001');const b=await reserve('trial-duplicate-key-001');assert.equal(a.id,b.id);assert.equal(b.reused,true);assert.equal((await q.trialState('admin',base)).attempts,1);await assert.rejects(()=>reserve('trial-another-pending-01'),e=>e.status===409);});
 await test('Trial budget includes pending and uncertain costs; a new call cannot exceed 20,000 VND',async()=>{reset();const a=await reserve('trial-budget-key-0001');assert.equal((await q.trialState('admin',base)).reserved,policy.MIN_RESERVE_VND);await q.settle(a.id,'error',{...usage,costVnd:policy.TRIAL_BUDGET_VND-policy.MIN_RESERVE_VND+1,estimated:true},base,{status:'error'});await assert.rejects(()=>reserve('trial-budget-key-0002'),e=>e.status===429);assert.equal((await q.quota('admin',base)).dayUsed,0);assert.equal((await q.trialState('admin',base)).attempts,1);});
 await test('Trial does not reset its attempt budget at calendar boundaries and expires closed',async()=>{reset();const a=await reserve('trial-expiry-key-0001');await q.settle(a.id,'no_guidance',usage,base,{status:'no_guidance'});assert.equal((await q.trialState('admin',Date.parse('2026-11-01T00:00:00Z'))).attempts,1);await assert.rejects(()=>reserve('trial-expiry-key-0002',policy.TRIAL_EXPIRES_AT),e=>e.status===429);assert.equal((await q.trialState('admin',policy.TRIAL_EXPIRES_AT)).available,false);});
 await test('Trial checks expiry again immediately before dispatch and does not charge an unsent image',async()=>{
  reset();const jpeg=new Uint8Array([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]);const f=new FormData();f.set('image',new File([jpeg],'fixture.jpg',{type:'image/jpeg'}));f.set('requestKey','trial-late-dispatch-001');f.set('consent','openai');let ticks=0,calls=0;const result=await ai.runRecognition(new Request('https://ecosnap.trangphamhp2004.chatgpt.site/api/ecosnap/recognize',{method:'POST',body:f}),'admin',async()=>{calls++;throw Error('must not dispatch')},()=>policy.TRIAL_EXPIRES_AT+(ticks++===0?-1:1),true);assert.equal(calls,0);assert.equal(result.status,'error');assert.equal(db.prepare('SELECT cost_vnd FROM ai_requests').get().cost_vnd,0);
 });
 await test('Concurrent administrators cannot exceed the last trial slot or reserved trial budget',async()=>{
  reset();db.exec("PRAGMA journal_mode=WAL; UPDATE users SET role='admin' WHERE id IN ('a','b')");
  for(let i=0;i<4;i++){const r=await reserve('trial-race-prior-000'+i);await q.settle(r.id,'no_guidance',usage,base,{status:'no_guidance'});}
  const file=path.join(temp,'trial-worker.mjs');fs.writeFileSync(file,`import {workerData,parentPort} from 'node:worker_threads';import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync(workerData.db);d.exec('PRAGMA busy_timeout=10000');try{const r=d.prepare(workerData.sql).get(...workerData.args);parentPort.postMessage({ok:!!r})}catch(e){parentPort.postMessage({error:e.message})}finally{d.close()}`);
  const results=await Promise.all(Array.from({length:8},(_,i)=>new Promise((resolve,reject)=>{const u=i%2?'a':'b';const args=['trial-worker-'+i,u,'trial-worker-key-'+i,'2026-10-03','2026-10',policy.MIN_RESERVE_VND,base,'hash'+i,policy.TRIAL_ID,u,base,'2026-10-03','2026-10','2026-10',policy.MIN_RESERVE_VND,base,policy.TRIAL_EXPIRES_AT,policy.TRIAL_ID,policy.TRIAL_CALL_LIMIT,policy.TRIAL_ID,policy.MIN_RESERVE_VND,policy.TRIAL_BUDGET_VND];const w=new Worker(file,{workerData:{db:path.join(temp,'data.sqlite'),sql:TRIAL_RESERVE_SQL,args}});w.on('message',resolve);w.on('error',reject)})));
  assert.ok(results.every(x=>!x.error),JSON.stringify(results));assert.equal(results.filter(x=>x.ok).length,1);const t=await q.trialState('admin',base);assert.equal(t.attempts,5);assert.ok(t.cost+t.reserved<=20000);reset();
 });
}
