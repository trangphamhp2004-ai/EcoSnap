export async function run({assert,test,call,db,q,policy,base,clear}){
 const oldFetch=globalThis.fetch,oldNow=Date.now,oldKey=globalThis.__ecoTestEnv.OPENAI_API_KEY;
 let calls=0,now=base,answer='success';
 const jpeg=new Uint8Array([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]);
 const form=(key='public-production-key-001')=>{const f=new FormData();f.set('image',new File([jpeg],'fixture.jpg',{type:'image/jpeg'}));f.set('requestKey',key);f.set('consent','openai');f.set('mode','product');return f};
 const reset=()=>{clear();calls=0;now=base;answer='success';};
 try{
  Date.now=()=>now;globalThis.__ecoTestEnv.OPENAI_API_KEY='OFFLINE_PUBLIC_TEST_KEY';
  globalThis.fetch=async(url,opts)=>{
   calls++;assert.equal(url,'https://api.openai.com/v1/responses');const p=JSON.parse(opts.body);assert.equal(p.store,false);assert.equal(p.max_output_tokens,policy.PRODUCT_OUTPUT_TOKENS);
   if(answer==='error')return Response.json({error:{code:'insufficient_quota',message:'fixture'}},{status:429});
   const product={identified:answer==='success',multiple_products:false,brand:null,product_name:null,variant:null,label_photo:null,package_form:'bottle',warning:'none',components:answer==='success'?[{role:'body',name:'Chai nhựa đã rỗng',rule_id:'bottle',confidence:.97,material_code:'PET 1',photo_index:1}]:[]};
   return Response.json({id:'resp_offline_public_'+calls,model:policy.AI_MODEL,status:'completed',usage:{input_tokens:1000,output_tokens:200},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(product)}]}]});
  };
  await test('Public AI still requires authenticated identity, configured secret and explicit photo consent',async()=>{
   reset();assert.equal((await call('recognize',{method:'POST',body:form()})).status,401);
   delete globalThis.__ecoTestEnv.OPENAI_API_KEY;assert.equal((await call('recognize',{method:'POST',user:'a',body:form()})).status,503);globalThis.__ecoTestEnv.OPENAI_API_KEY='OFFLINE_PUBLIC_TEST_KEY';
   for(const field of ['consent','mode']){const f=form();f.delete(field);assert.equal((await call('recognize',{method:'POST',user:'a',body:f})).status,400)}
   for(const field of ['role','costVnd','apiKey','enable','mock']){const f=form();f.set(field,'forged');assert.equal((await call('recognize',{method:'POST',user:'a',body:f})).status,400)}
   assert.equal(calls,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,0);
  });
  await test('Ordinary users and admins use the production provider with normal quotas, no trial restriction and safe deduplication',async()=>{
   reset();for(const user of ['a','admin']){const r=await call('recognize',{method:'POST',user,body:form()});assert.equal(r.status,200);const data=await r.json();assert.equal(data.status,'success');assert.equal(data.schemaVersion,3);assert.equal(data.quota.dayUsed,1);assert.equal(data.quota.trial,null);assert.equal(data.quota.aiEnabled,true);const again=await call('recognize',{method:'POST',user,body:form()});assert.equal((await again.json()).requestId,data.requestId)}
   assert.equal(calls,2);const rows=db.prepare('SELECT trial_run_id,status,cost_vnd FROM ai_requests').all();assert.equal(rows.length,2);assert.ok(rows.every(r=>r.trial_run_id===''&&r.status==='success'&&r.cost_vnd>0&&r.cost_vnd<policy.MIN_RESERVE_VND));
  });
  await test('Public production route caps five daily successes and allows a new Vietnam calendar day',async()=>{
   reset();for(let i=0;i<5;i++)assert.equal((await call('recognize',{method:'POST',user:'a',body:form('public-day-request-00'+i)})).status,200);
   assert.equal((await call('recognize',{method:'POST',user:'a',body:form('public-day-blocked-001')})).status,429);assert.equal(calls,5);now=Date.parse('2026-10-03T17:00:00Z');assert.equal((await call('recognize',{method:'POST',user:'a',body:form('public-next-day-0001')})).status,200);assert.equal((await q.quota('a',now)).dayUsed,1);assert.equal((await q.quota('a',now)).monthUsed,6);
  });
  await test('Public production unknowns charge API usage only, enforce cooldown, and API errors do not consume success quota',async()=>{
   reset();answer='unknown';for(let i=0;i<3;i++){const r=await call('recognize',{method:'POST',user:'a',body:form('public-unknown-key-00'+i)});assert.equal((await r.json()).status,'unknown')}
   assert.equal((await q.quota('a',now)).dayUsed,0);assert.equal((await call('recognize',{method:'POST',user:'a',body:form('public-cooldown-key-001')})).status,429);assert.equal(calls,3);assert.ok((await q.budgetState(now)).cost>0);
   now+=600001;answer='error';const r=await call('recognize',{method:'POST',user:'a',body:form('public-api-error-key-01')});assert.equal((await r.json()).status,'error');assert.equal((await q.quota('a',now)).dayUsed,0);assert.equal(calls,4);
  });
  await test('Historical trial expense remains in the public budget; expired trial does not block normal requests',async()=>{
   reset();const row=await q.reserve('admin','historical-trial-key-001',base,'fixture');await q.settle(row.id,'error',{costVnd:100,model:'fixture',inputTokens:0,outputTokens:0,estimated:true},base,{status:'error'});db.prepare('UPDATE ai_requests SET trial_run_id=? WHERE id=?').run(policy.TRIAL_ID,row.id);now=policy.TRIAL_EXPIRES_AT+1;
   const r=await call('recognize',{method:'POST',user:'a',body:form()});assert.equal(r.status,200);assert.equal((await q.quota('admin',now)).trial,null);assert.ok((await q.budgetState(now)).cost>100);assert.equal(db.prepare('SELECT trial_run_id FROM ai_requests WHERE id=?').get(row.id).trial_run_id,policy.TRIAL_ID);
   db.prepare("UPDATE settings SET budget_vnd=? WHERE id='main'").run(policy.MIN_RESERVE_VND);assert.equal((await call('recognize',{method:'POST',user:'b',body:form('public-budget-stop-001')})).status,429);assert.equal(calls,1);
  });
 }finally{globalThis.fetch=oldFetch;Date.now=oldNow;if(oldKey===undefined)delete globalThis.__ecoTestEnv.OPENAI_API_KEY;else globalThis.__ecoTestEnv.OPENAI_API_KEY=oldKey;clear();}
}
