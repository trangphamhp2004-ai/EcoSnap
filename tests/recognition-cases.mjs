import path from 'node:path';
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
export async function run({assert,test,call,db,q,policy,temp,base,clear,blobs}){
 const ai=await import(path.join(temp,'lib/server/recognition.js'));
 const providerModule=await import(path.join(temp,'lib/server/ai-provider.js'));
 const {RESERVE_SQL}=await import(path.join(temp,'lib/server/quota-sql.js'));
 const jpeg=new Uint8Array([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]);
 const identified={identified:true,item_name:'Chai thủy tinh',group:'Thủy tinh',confidence:.97,matched_item_id:'ai-glass',match:'exact'};
 const unknown={identified:false,item_name:'',group:'unknown',confidence:0,matched_item_id:null,match:'none'};
 const insert=db.prepare("INSERT INTO content(id,kind,title,group_name,payload,published,verified,source,updated_at) VALUES(?,'items',?,?,?,1,1,'Fixture đã kiểm duyệt',?)");
 insert.run('ai-glass','Chai thủy tinh','Thủy tinh',JSON.stringify({description:'Chai bằng thủy tinh',steps:'Hướng dẫn đã kiểm duyệt riêng trong bộ test.'}),base);
 insert.run('ai-paper','Hộp giấy','Giấy',JSON.stringify({description:'Hộp giấy sạch',steps:'Hướng dẫn giấy đã kiểm duyệt.'}),base);
 insert.run('ai-no-steps','Chai nhựa','Nhựa',JSON.stringify({description:'Thiếu hướng dẫn'}),base);
 let sequence=0,providerCalls=0,lastPayload;
 function request(key='image-test-'+String(++sequence).padStart(10,'0'),bytes=jpeg,extra={}){
  const form=new FormData();form.set('image',new File([bytes],'fixture.jpg',{type:'image/jpeg'}));form.set('requestKey',key);form.set('consent','openai');for(const [k,v] of Object.entries(extra))form.set(k,v);
  return new Request('https://ecosnap.trangphamhp2004.chatgpt.site/api/ecosnap/recognize',{method:'POST',body:form});
 }
 function payload(v=identified,overrides={}){return {id:'resp_fixture',model:policy.AI_MODEL,status:'completed',usage:{input_tokens:1200,output_tokens:180},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(v)}]}],...overrides}}
 function mock(v=identified,overrides={}){return providerModule.openAIProvider('FAKE_KEY_NOT_REAL',async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');providerCalls++;lastPayload=JSON.parse(options.body);return Response.json(payload(v,overrides))})}
 const run=(req,p=mock(),at=base)=>ai.runRecognition(req,'a',p,()=>at);
 function reset(){clear();db.exec('DELETE FROM history WHERE recognition_id IS NOT NULL');providerCalls=0;lastPayload=null}
 async function rejectsStatus(fn,status){await assert.rejects(fn,e=>e.status===status)}
 await test('Production release gate rejects even a configured key and client enable/mock flags before provider access',async()=>{
  reset();globalThis.__ecoTestEnv.OPENAI_API_KEY='FAKE_KEY_NOT_REAL';globalThis.__ecoTestEnv.ECOSNAP_AI_ENABLED='true';
  const form=new FormData();form.set('mode','mock');form.set('enabled','true');form.set('costVnd','0');assert.equal(policy.LIVE_OPENAI_ENABLED,false);
  const r=await call('recognize',{method:'POST',user:'a',body:form});assert.equal(r.status,503);assert.match((await r.json()).error,/đang tắt/);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,0);
 });
 await test('Real adapter with mocked response: success, schema, no-store, pinned model, explicit consent and backend cost',async()=>{
  reset();const r=await run(request('mock-success-key-0001',jpeg,{status:'success',costVnd:'0',model:'forged'}));assert.equal(r.status,'success');assert.equal(r.candidate.id,'ai-glass');assert.equal(r.quota.dayUsed,1);assert.equal(r.quota.monthUsed,1);assert.equal(providerCalls,1);
  assert.equal(lastPayload.store,false);assert.equal(lastPayload.background,false);assert.equal(lastPayload.model,policy.AI_MODEL);assert.equal(lastPayload.max_output_tokens,512);assert.equal(lastPayload.text.format.strict,true);assert.equal(lastPayload.service_tier,'default');assert.equal(lastPayload.tools,undefined);
  const row=db.prepare('SELECT * FROM ai_requests').get();assert.equal(row.cost_vnd,providerModule.usageCost(1200,180));assert.equal(row.model,policy.AI_MODEL);assert.equal(row.cost_estimated,0);assert.equal(row.status,'success');assert.equal(db.prepare('SELECT COUNT(*) n FROM history WHERE recognition_id IS NOT NULL').get().n,0);
 });
 await test('Idempotent replay preserves one charge and rejects same key with changed image',async()=>{
  const r=await run(request('mock-success-key-0001'));assert.equal(r.status,'success');assert.equal(providerCalls,1);assert.equal(r.quota.dayUsed,1);
  const changed=jpeg.slice();changed[25]=2;await rejectsStatus(()=>run(request('mock-success-key-0001',changed)),409);assert.equal(providerCalls,1);
 });
 await test('Confirmation and correction use reviewed guides, are idempotent and owner scoped; replay is free',async()=>{
  const row=db.prepare("SELECT * FROM ai_requests WHERE request_key='mock-success-key-0001'").get();
  await rejectsStatus(()=>ai.confirmRecognition('b',row.id,'ai-glass',1),409);await rejectsStatus(()=>ai.recognitionResult('b',row.id,base),404);await rejectsStatus(()=>ai.confirmRecognition('a',row.id,'ai-no-steps',1),409);
  const corrections=await Promise.all([ai.confirmRecognition('a',row.id,'ai-paper',1),ai.confirmRecognition('a',row.id,'ai-paper',1)]);assert.equal(corrections[0].itemId,'ai-paper');assert.equal(db.prepare('SELECT COUNT(*) n FROM history WHERE recognition_id=?').get(row.id).n,1);assert.match(db.prepare('SELECT method FROM history WHERE recognition_id=?').get(row.id).method,/chọn lại/);
  await rejectsStatus(()=>ai.confirmRecognition('a',row.id,'ai-glass',1),409);await ai.recognitionResult('a',row.id,base);assert.equal((await q.quota('a',base)).dayUsed,1);assert.equal(providerCalls,1);
 });
 await test('Manual lookup and result review do not create AI requests or cost',async()=>{
  const before=db.prepare('SELECT COUNT(*) n,SUM(cost_vnd) cost FROM ai_requests').get();for(let i=0;i<3;i++){assert.equal((await call('history',{method:'POST',user:'a',body:{itemId:'ai-paper'}})).status,200);assert.equal((await call('account',{user:'a'})).status,200)}assert.deepEqual(db.prepare('SELECT COUNT(*) n,SUM(cost_vnd) cost FROM ai_requests').get(),before);
 });
 await test('Unknown results cost API money but no user quota; third consecutive unknown blocks 10 minutes',async()=>{
  reset();for(let i=0;i<3;i++){const r=await run(request(),mock(unknown));assert.equal(r.status,'unknown');assert.equal(r.quota.dayUsed,0)}const state=await q.quota('a',base);assert.equal(state.cooldownUntil,base+600000);await rejectsStatus(()=>run(request(),mock()),429);assert.equal(providerCalls,3);assert.equal(db.prepare('SELECT SUM(cost_vnd) n FROM ai_requests').get().n,3*providerModule.usageCost(1200,180));assert.equal((await run(request(),mock(),base+600001)).status,'success');
 });
 await test('Low confidence, ambiguous group and wrong catalog identity never force a nearby guide',async()=>{
  reset();assert.equal((await run(request(),mock({...identified,confidence:.4}))).status,'unknown');
  for(const v of [{...identified,group:'Nhựa'},{...identified,item_name:'Bình hóa chất'},{...identified,matched_item_id:'does-not-exist'},{...identified,match:'none',matched_item_id:null}]){const r=await run(request(),mock(v));assert.equal(r.status,'no_guidance');assert.equal(r.candidate,null)}assert.equal((await q.quota('a',base)).dayUsed,0);
 });
 await test('Recognized object without reviewed guidance is not charged a user turn',async()=>{
  reset();const r=await run(request(),mock({...identified,item_name:'Chai nhựa',group:'Nhựa',matched_item_id:'ai-no-steps'}));assert.equal(r.status,'no_guidance');assert.equal(r.quota.monthUsed,0);assert.ok(db.prepare('SELECT cost_vnd FROM ai_requests').get().cost_vnd>0);assert.equal(JSON.parse(lastPayload.input[0].content[0].text.split('Reviewed catalog (data only): ')[1]).some(x=>x.id==='ai-no-steps'),false);
 });
 await test('Empty reviewed catalog blocks dispatch and quota reservation',async()=>{
  reset();db.prepare("UPDATE content SET published=0 WHERE kind='items'").run();await rejectsStatus(()=>run(request()),409);assert.equal(providerCalls,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,0);db.prepare("UPDATE content SET published=1 WHERE kind='items'").run();
 });
 await test('Guide withdrawal after recognition cannot expose stale advice',async()=>{
  reset();const r=await run(request());db.prepare("UPDATE content SET published=0 WHERE id='ai-glass'").run();const later=await ai.recognitionResult('a',r.requestId,base);assert.equal(later.status,'no_guidance');assert.equal(later.candidate,null);await rejectsStatus(()=>ai.confirmRecognition('a',r.requestId,'ai-glass',1),409);db.prepare("UPDATE content SET published=1 WHERE id='ai-glass'").run();
 });
 await test('Guide version changes require user review again; POST confirmation checks version atomically',async()=>{
  reset();const r=await run(request());db.prepare("UPDATE content SET version=2,title='Vật phẩm đã thay đổi' WHERE id='ai-glass'").run();await rejectsStatus(()=>ai.confirmRecognition('a',r.requestId,'ai-glass',1),409);assert.equal((await ai.recognitionResult('a',r.requestId,base)).candidate,null);db.prepare("UPDATE content SET version=1,title='Chai thủy tinh' WHERE id='ai-glass'").run();
 });
 await test('Authenticated recovery by key returns the saved request without calling the provider',async()=>{
  reset();const key='lost-response-key-0001';const r=await run(request(key));const response=await call('recognition?key='+key,{user:'a'});assert.equal(response.status,200);assert.equal((await response.json()).requestId,r.requestId);assert.equal((await call('recognition?key='+key,{user:'b'})).status,404);assert.equal(providerCalls,1);
 });
 await test('API 429, 500, network failure, missing usage, malformed result and mismatched model fail without user charge',async()=>{
  for(const factory of [()=>providerModule.openAIProvider('fixture',async()=>new Response('do not log',{status:429})),()=>providerModule.openAIProvider('fixture',async()=>new Response('do not log',{status:500})),()=>providerModule.openAIProvider('fixture',async()=>{throw Error('do not log image or key')}),()=>mock(identified,{usage:null}),()=>mock(identified,{output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'bad-json'}]}]}),()=>mock(identified,{model:'unknown-model'}),()=>mock(identified,{status:'incomplete'})]){
   reset();const r=await run(request(),factory());assert.equal(r.status,'error');assert.equal(r.quota.dayUsed,0);assert.ok(db.prepare('SELECT cost_vnd FROM ai_requests').get().cost_vnd>0);
  }
 });
 await test('Timeout makes one provider attempt, conservatively charges reservation, no retry or quota debit',async()=>{
  reset();let calls=0;const p=providerModule.openAIProvider('fixture',async(url,opts)=>{calls++;return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('timeout'))))},5);
  const r=await run(request(),p);assert.equal(r.status,'error');assert.equal(calls,1);const row=db.prepare('SELECT * FROM ai_requests').get();assert.equal(row.cost_vnd,row.reserve_vnd);assert.equal(row.cost_estimated,1);assert.equal(r.quota.dayUsed,0);
 });
 await test('Provider diagnostics retain only whitelisted codes and HTTP status, never response text or secrets',async()=>{
  reset();const p=providerModule.openAIProvider('FAKE_KEY_NOT_REAL',async()=>Response.json({error:{code:'insufficient_quota',message:'FAKE_KEY_NOT_REAL data:image/jpeg;base64,private'}},{status:429}));const r=await run(request(),p);assert.equal(r.failureCode,'insufficient_quota');assert.equal(r.httpStatus,429);const stored=db.prepare('SELECT result_json FROM ai_requests').get().result_json;assert.ok(!stored.includes('FAKE_KEY_NOT_REAL'));assert.ok(!stored.includes('base64'));assert.equal(r.quota.dayUsed,0);
 });
 await test('Untrusted or oversized provider error bodies cannot enter diagnostic fields',async()=>{
  for(const error of [{code:'FAKE_KEY_NOT_REAL',message:'private'},{code:'invalid_api_key',message:'x'.repeat(10000)}]){reset();const r=await run(request(),providerModule.openAIProvider('fixture',async()=>Response.json({error},{status:400})));assert.equal(r.failureCode,'http_error');assert.equal(r.httpStatus,400);assert.ok(!JSON.stringify(r).includes('FAKE_KEY_NOT_REAL'));}
 });
 await test('Same request from multiple tabs triggers exactly one provider call and exposes pending separately',async()=>{
  reset();let resolve,started;const ready=new Promise(r=>started=r),barrier=new Promise(r=>resolve=r);const p=providerModule.openAIProvider('fixture',async()=>{providerCalls++;started();await barrier;return Response.json(payload())});
  const first=run(request('parallel-image-key-0001'),p);await ready;
  const duplicates=await Promise.all(Array.from({length:10},()=>run(request('parallel-image-key-0001'),mock())));assert.ok(duplicates.every(x=>x.status==='pending'));assert.equal(duplicates[0].quota.dayUsed,0);assert.equal(duplicates[0].quota.dayPending,1);
  await rejectsStatus(()=>run(request('parallel-image-key-0002'),mock()),409);
  const changed=jpeg.slice();changed[25]=4;await rejectsStatus(()=>run(request('parallel-image-key-0003',changed),mock()),409);
  resolve();assert.equal((await first).status,'success');assert.equal(providerCalls,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,1);
 });
 await test('Daily/monthly hard limits ignore client/admin grants and all admission checks run before provider',async()=>{
  reset();for(let day=0;day<4;day++){for(let i=0;i<5;i++)assert.equal((await run(request(),mock(),base+day*86400000)).status,'success');await rejectsStatus(()=>run(request(),mock(),base+day*86400000),429)}
  db.prepare("UPDATE settings SET daily_limit=100,monthly_limit=100,budget_vnd=100000000 WHERE id='main'").run();db.prepare('INSERT INTO grants VALUES(?,?,?,?,?,?,?)').run('ai-grant','a','2026-10',100,'admin','fixture',base);
  await rejectsStatus(()=>run(request(),mock(),base+4*86400000),429);assert.equal(providerCalls,20);assert.equal((await q.getSettings()).budget_vnd,5000000);assert.equal((await q.quota('a',base+4*86400000)).bonus,0);
 });
 await test('A request crossing Vietnam midnight/month end stays in its admission period',async()=>{
  reset();const before=Date.parse('2026-10-31T16:59:59Z'),after=Date.parse('2026-10-31T17:00:01Z');const r=await q.reserve('a','month-boundary-key-01',before,'hash');await q.settle(r.id,'success',{costVnd:10,model:'fixture',inputTokens:1,outputTokens:1},after,{status:'success'});const row=db.prepare('SELECT * FROM ai_requests').get();assert.equal(row.day,'2026-10-31');assert.equal(row.month,'2026-10');assert.equal((await q.quota('a',after)).monthUsed,0);assert.equal((await q.quota('a',before)).monthUsed,1);
 });
 await test('Budget admits exact boundary, blocks one dong over including reservations and unknown costs',async()=>{
  reset();db.prepare("UPDATE settings SET budget_vnd=?,reserve_vnd=1 WHERE id='main'").run(policy.MIN_RESERVE_VND);const r=await q.reserve('a','budget-exact-bound-01',base,'hash');assert.equal(r.reserve_vnd,policy.MIN_RESERVE_VND);await rejectsStatus(()=>q.reserve('b','budget-exact-bound-02',base,'hash2'),429);await q.settle(r.id,'unknown',{costVnd:1,model:'fixture',inputTokens:1,outputTokens:1},base,{status:'unknown'});await rejectsStatus(()=>q.reserve('b','budget-exact-bound-03',base,'hash3'),429);
 });
 await test('Backend budget warning thresholds include pending reservations',async()=>{
  reset();const row=await q.reserve('a','warning-threshold-01',base,'hash');await q.settle(row.id,'error',{costVnd:3500000-policy.MIN_RESERVE_VND,model:'fixture',inputTokens:0,outputTokens:0},base,{status:'error'});const pending=await q.reserve('b','warning-threshold-02',base,'other');assert.equal((await q.budgetState(base)).warning,3500000);await q.settle(pending.id,'error',{costVnd:1000000+policy.MIN_RESERVE_VND,model:'fixture',inputTokens:0,outputTokens:0},base,{status:'error'});assert.equal((await q.budgetState(base)).warning,4500000);
 });
 await test('Abandoned requests release only user quota; late settlement cannot overwrite terminal recovery',async()=>{
  reset();const r=await q.reserve('a','stale-pending-key-01',base,'hash');let b=await q.budgetState(base);assert.equal(b.reserved,r.reserve_vnd);await q.recoverPending(base+policy.PENDING_TTL_MS+1);let row=db.prepare('SELECT * FROM ai_requests').get();assert.equal(row.status,'error');assert.equal(row.cost_estimated,1);assert.equal(row.cost_vnd,r.reserve_vnd);assert.equal((await q.quota('a',base+policy.PENDING_TTL_MS+1)).dayPending,0);await q.settle(r.id,'success',{costVnd:5,model:'fixture',inputTokens:1,outputTokens:1},base+policy.PENDING_TTL_MS+2,{status:'success'});assert.equal(db.prepare('SELECT status FROM ai_requests').get().status,'error');assert.equal((await q.reserve('a','stale-pending-key-01',base+policy.PENDING_TTL_MS+3,'hash')).reused,true);
 });
 await test('Concurrent SQLite connections cannot exceed one pending/user or global budget',async()=>{
  reset();db.exec('PRAGMA journal_mode=WAL');db.prepare("UPDATE settings SET budget_vnd=? WHERE id='main'").run(policy.MIN_RESERVE_VND*2-1);
  const file=path.join(temp,'concurrency-worker.mjs');fs.writeFileSync(file,`import {workerData,parentPort} from 'node:worker_threads';import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync(workerData.db);d.exec('PRAGMA busy_timeout=10000');try{const r=d.prepare(workerData.sql).get(...workerData.args);parentPort.postMessage({ok:!!r})}catch(e){parentPort.postMessage({error:e.message})}finally{d.close()}`);
  const runs=await Promise.all(Array.from({length:12},(_,i)=>new Promise((resolve,reject)=>{const u=i%2?'a':'b',id='worker-'+i,w=new Worker(file,{workerData:{db:path.join(temp,'data.sqlite'),sql:RESERVE_SQL,args:[id,u,'worker-request-key-'+i,'2026-10-03','2026-10',policy.MIN_RESERVE_VND,base,'hash'+i,u,base,'2026-10-03','2026-10','2026-10',policy.MIN_RESERVE_VND]}});w.on('message',resolve);w.on('error',reject)})));
  assert.ok(runs.every(x=>!x.error),JSON.stringify(runs));assert.equal(runs.filter(x=>x.ok).length,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,1);
 });
 await test('Image validation, missing consent and MIME spoof fail before provider; EXIF removed',async()=>{
  reset();await rejectsStatus(()=>run(request(undefined,jpeg,{consent:'no'})),400);await rejectsStatus(()=>run(request(undefined,new TextEncoder().encode('not an image'))),400);
  const large=jpeg.slice();large[9]=8;large[10]=1;await rejectsStatus(()=>run(request(undefined,large)),400);
  const exif=new Uint8Array([...jpeg.slice(0,2),255,225,0,8,69,120,105,102,0,0,...jpeg.slice(2)]);assert.deepEqual(ai.cleanJPEG(exif),jpeg);const between=new Uint8Array([...jpeg.slice(0,-2),255,254,0,5,65,66,67,255,225,0,4,1,2,255,217]);assert.deepEqual(ai.cleanJPEG(between),jpeg);assert.equal(providerCalls,0);
 });
 await test('Recognition persists no image, image URL, API key or provider body; R2 untouched',async()=>{
  reset();const stored=blobs.size;await run(request());const all=db.prepare('SELECT * FROM ai_requests').all();const text=JSON.stringify(all);assert.ok(!text.includes('base64'));assert.ok(!text.includes('FAKE_KEY_NOT_REAL'));assert.ok(!text.includes('data:image'));assert.equal(blobs.size,stored);assert.equal(all[0].image_hash.length,64);
 });
 await test('Admin cannot raise absolute quota/budget caps or lower reserve bound',async()=>{
  const s=await q.getSettings();for(const body of [{dailyLimit:6,monthlyLimit:20,budgetVnd:5000000,reserveVnd:policy.MIN_RESERVE_VND},{dailyLimit:5,monthlyLimit:21,budgetVnd:5000000,reserveVnd:policy.MIN_RESERVE_VND},{dailyLimit:5,monthlyLimit:20,budgetVnd:5000001,reserveVnd:policy.MIN_RESERVE_VND},{dailyLimit:5,monthlyLimit:20,budgetVnd:5000000,reserveVnd:1}])assert.equal((await call('admin/settings',{method:'POST',user:'admin',body:{...body,version:s.version}})).status,400);assert.equal((await call('admin/grants',{method:'POST',user:'admin',body:{userId:'a',amount:1,reason:'fixture'}})).status,409);
 });
}
