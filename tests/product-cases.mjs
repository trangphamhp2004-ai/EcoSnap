import path from 'node:path';
export async function run({assert,test,call,db,q,policy,temp,base,clear,blobs}){
 const ai=await import(path.join(temp,'lib/server/recognition.js')),provider=await import(path.join(temp,'lib/server/ai-provider.js')),products=await import(path.join(temp,'lib/server/product-recognition.js')),sorting=await import(path.join(temp,'lib/server/sorting.js')),labels=await import(path.join(temp,'lib/product-label.js')),guides=await import(path.join(temp,'lib/server/product-guidance.js')),rules=await import(path.join(temp,'lib/sorting-rules.js'));
 const jpeg=new Uint8Array([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]);
 const photo=n=>{const b=jpeg.slice();b[25]=n;return b};
 const body={role:'body',name:'Thân chai nhựa đã rỗng',rule_id:'bottle',confidence:.97,material_code:'PET 1',photo_index:1};
 const observation={identified:true,multiple_products:false,brand:'Cocoon',product_name:'Sữa rửa mặt sen Hậu Giang',variant:'500 ml',label_photo:1,package_form:'bottle',warning:'none',components:[body]};
 const confirmed={...labels.EMPTY_PRODUCT,brand:'Cocoon',productName:'Sữa rửa mặt sen Hậu Giang',variant:'500 ml',packageForm:'bottle',materialCode:'PET 1',warning:'none',remaining:'empty'};
 let sequence=0,calls=0,lastPayload;
 const reset=()=>{clear();db.exec('DELETE FROM sorting_results; DELETE FROM rate_limits');calls=0;lastPayload=null};
 const form=(key='product-test-key-'+(++sequence).toString().padStart(8,'0'),photos=[photo(1)])=>{const f=new FormData();f.set('requestKey',key);f.set('consent','openai');f.set('mode','product');for(const bytes of photos)f.append('image',new File([bytes],'private-name.jpg',{type:'image/jpeg'}));return f};
 const request=f=>new Request('https://ecosnap.trangphamhp2004.chatgpt.site/api/ecosnap/recognize',{method:'POST',body:f});
 const response=(v=observation,overrides={})=>({id:'resp_product_fixture',model:policy.AI_MODEL,status:'completed',usage:{input_tokens:2400,output_tokens:700},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(v)}]}],...overrides});
 const mock=(v=observation,overrides={})=>provider.productAIProvider('FAKE_PRODUCT_KEY',async(url,opts)=>{calls++;lastPayload=JSON.parse(opts.body);return Response.json(response(v,overrides))});
 const run=(f=form(),p=mock(),at=base)=>ai.runRecognition(request(f),'a',p,()=>at,false,'product');
 const reject=(fn,status)=>assert.rejects(fn,e=>e.status===status);
 const save=(id,extra={})=>sorting.saveSorting('a',{ids:['bottle'],version:rules.SORTING_VERSION,key:'confirm-product-key-0001',confirmed:true,recognitionId:id,product:confirmed,productReviewed:true,...extra});
 await test('Product mode: three photos use one provider attempt, one reserved turn and backend-priced usage',async()=>{
  reset();const r=await run(form(undefined,[photo(1),photo(2),photo(3)]));assert.equal(r.status,'success');assert.equal(r.schemaVersion,3);assert.equal(r.confirmationState,'needs_confirmation');assert.equal(calls,1);assert.equal(lastPayload.input[0].content.filter(x=>x.type==='input_image').length,3);assert.equal(lastPayload.max_output_tokens,policy.PRODUCT_OUTPUT_TOKENS);assert.equal(lastPayload.store,false);assert.equal(lastPayload.tools,undefined);assert.match(lastPayload.instructions,/untrusted/);assert.equal(lastPayload.text.format.strict,true);assert.equal(r.quota.dayUsed,1);assert.equal(r.quota.dayPending,0);assert.equal(db.prepare('SELECT cost_vnd FROM ai_requests').get().cost_vnd,provider.usageCost(2400,700));assert.ok(policy.MIN_RESERVE_VND>=provider.usageCost(policy.MODEL_CONTEXT_TOKENS,policy.PRODUCT_OUTPUT_TOKENS));
 });
 await test('Product multipart rejects fourth photo, duplicate photos, bad later photos and repeated control fields before reservation',async()=>{
  for(const f of [form(undefined,[photo(1),photo(2),photo(3),photo(4)]),form(undefined,[photo(1),photo(1)]),form(undefined,[photo(1),new Uint8Array([1,2,3])]),form(undefined,[photo(1),photo(2),new Uint8Array([4,5])])]){reset();await reject(()=>run(f),400);assert.equal(calls,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,0)}
  for(const [k,v] of [['requestKey','duplicate-key-0001'],['consent','openai'],['mode','product'],['costVnd','0'],['apiKey','forged']]){reset();const f=form();f.append(k,v);await reject(()=>run(f),400);assert.equal(calls,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,0)}
 });
 await test('Product request hash covers every photo, count, order and mode; repeated keys cannot change the request',async()=>{
  reset();const key='photo-manifest-key-001';await run(form(key,[photo(1),photo(2)]));await run(form(key,[photo(1),photo(2)]));assert.equal(calls,1);
  for(const photos of [[photo(1),photo(3)],[photo(1)],[photo(2),photo(1)],[photo(1),photo(2),photo(3)]])await reject(()=>run(form(key,photos)),409);
  const legacy=form(key);legacy.delete('mode');await reject(()=>ai.runRecognition(request(legacy),'a',mock(),()=>base,false,'sorting'),409);assert.equal(calls,1);
 });
 await test('Product stripping applies to EXIF/comment data in all photos, no images or keys persist in D1/R2',async()=>{
  reset();const before=blobs.size,exif=n=>new Uint8Array([255,216,255,225,0,8,69,120,105,102,0,0,...photo(n).slice(2)]);await run(form(undefined,[exif(1),exif(2),exif(3)]));
  lastPayload.input[0].content.filter(x=>x.type==='input_image').forEach((x,i)=>assert.deepEqual(new Uint8Array(Buffer.from(x.image_url.split(',')[1],'base64')),photo(i+1)));
  const saved=JSON.stringify(db.prepare('SELECT * FROM ai_requests').all());for(const text of ['FAKE_PRODUCT_KEY','base64','data:image','private-name','Exif'])assert.ok(!saved.includes(text));assert.equal(blobs.size,before);
 });
 await test('Blurred/multiple/conflicting products remain unknown without user quota, but API cost is recorded',async()=>{
  for(const changes of [{identified:false,brand:null,product_name:null,variant:null,label_photo:null,components:[]},{multiple_products:true}]){reset();const r=await run(form(),mock({...observation,...changes}));assert.equal(r.status,'unknown');assert.equal(r.quota.dayUsed,0);assert.equal(r.product.brand,'');assert.equal(r.components.length,0);assert.ok(db.prepare('SELECT cost_vnd FROM ai_requests').get().cost_vnd>0)}
 });
 await test('Unknown brand never blocks basic reviewed sorting or forces a nearby product record',async()=>{
  reset();const r=await run(form(),mock({...observation,brand:null,product_name:null,variant:null,label_photo:null}));assert.equal(r.status,'success');assert.equal(r.product.brand,'');const saved=await save(r.requestId,{product:{...confirmed,brand:'Cocoonn'}});assert.equal(saved.productGuidance.references.length,0);assert.equal(saved.productGuidance.programs.length,0);assert.equal(saved.plan.components[0].id,'bottle');
 });
 await test('Unlabelled cake and plastic box retain separate components, unknown resin and the manual confirmation flow',async()=>{
  for(const rule_id of ['single-use','plastic-container']){
   reset();const parts=[{role:'contents',name:'Bánh / thức ăn',rule_id:'food',confidence:.97,material_code:'unknown',photo_index:1},{role:'body',name:'Hộp nhựa đựng bánh',rule_id,confidence:.95,material_code:'unknown',photo_index:1}];
   const r=await run(form(),mock({...observation,brand:null,product_name:null,variant:null,label_photo:null,package_form:'other',warning:'unknown',components:parts}));
   assert.equal(r.status,rule_id==='single-use'?'success':'no_guidance');assert.equal(r.product.brand,'');assert.equal(r.product.materialCode,'unknown');assert.deepEqual(r.components.map(c=>c.rule_id),['food',rule_id]);assert.equal(r.quota.dayUsed,rule_id==='single-use'?1:0);
   const saved=await save(r.requestId,{ids:['food',rule_id],product:r.product});assert.equal(saved.plan.components[0].id,'food');assert.ok(saved.plan.components.some(c=>c.id===rule_id));assert.ok(!saved.plan.components.some(c=>c.id==='bottle'));assert.equal(saved.productGuidance.references.length,0);assert.equal(saved.productGuidance.programs.length,0);
  }
 });
 await test('Unclear plastic box keeps visible food usable without inventing a box material or charging a full result',async()=>{
  reset();const r=await run(form(),mock({...observation,brand:null,product_name:null,variant:null,label_photo:null,warning:'unknown',components:[{...body,role:'contents',name:'Bánh',rule_id:'food',material_code:'unknown'},{...body,name:'Hộp chưa rõ',rule_id:null,confidence:.5,material_code:'unknown'}]}));assert.equal(r.status,'no_guidance');assert.equal(r.components[0].rule_id,'food');assert.equal(r.components[1].rule_id,null);assert.equal(r.quota.dayUsed,0);
 });
 await test('Workers-compatible transport rejects redirects with one attempt and never follows a credential-bearing request',async()=>{
  reset();let attempts=0;const p=provider.productAIProvider('REDIRECT_FIXTURE_SECRET',async(url,opts)=>{attempts++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(opts.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://untrusted.invalid/'}})});
  const r=await run(form(),p);assert.equal(r.status,'error');assert.equal(r.httpStatus,302);assert.equal(r.quota.dayUsed,0);assert.equal(attempts,1);assert.ok(!JSON.stringify(r).includes('REDIRECT_FIXTURE_SECRET'));
 });
 await test('Missing guide, low confidence and hazard labels cannot become a complete AI result',async()=>{
  for(const changes of [{components:[{...body,rule_id:null}]},{components:[{...body,confidence:.4}]},{warning:'present'},{components:[body,{role:'contents',name:'Phần chưa rõ',rule_id:null,confidence:.5,material_code:'unknown',photo_index:1}]}]){reset();const r=await run(form(),mock({...observation,...changes}));assert.notEqual(r.status,'success');assert.equal(r.quota.dayUsed,0);assert.ok(r.components.some(c=>c.rule_id===null))}
 });
 await test('Nắp ALU cannot assign aluminium to a plastic/unknown body; role order and confidence are respected',async()=>{
  const cap={...body,role:'cap',name:'Nắp',rule_id:'metal',material_code:'ALU'},unknownBody={...body,rule_id:null,material_code:'unknown'};
  for(const components of [[cap,unknownBody],[unknownBody,cap],[{...body,confidence:.3,material_code:'ALU'}],[body,{...body,material_code:'ALU'}]])assert.equal(products.productResult({...observation,components}).product.materialCode,'unknown');
 });
 await test('Invalid product schema, out-of-range photo references, URL/contact OCR and AI-authored advice are rejected',async()=>{
  for(const v of [{...observation,advice:'invented advice'},{...observation,label_photo:3},{...observation,brand:'person@example.com'},{...observation,product_name:'https://evil.test'},{...observation,variant:'0901234567'},{...observation,components:[{...body,photo_index:2}]},{...observation,components:[{...body,rule_id:'invented'}]},{...observation,label_photo:null},{...observation,components:[{...body,material_code:'recyclable everywhere'}]}]){reset();const r=await run(form(),mock(v));assert.equal(r.status,'error');assert.equal(r.quota.dayUsed,0);const saved=JSON.stringify(db.prepare('SELECT result_json FROM ai_requests').all());assert.ok(!saved.includes('evil.test'));assert.ok(!saved.includes('invented advice'))}
 });
 await test('Product API errors, missing usage and truncated responses settle cost without successful quota',async()=>{
  for(const p of [mock(observation,{status:'incomplete'}),mock(observation,{usage:null}),mock(observation,{usage:{input_tokens:100,output_tokens:1501}}),provider.productAIProvider('FAKE_PRODUCT_KEY',async()=>Response.json({error:{code:'insufficient_quota',message:'FAKE_PRODUCT_KEY data:image'}},{status:429}))]){reset();const r=await run(form(),p);assert.equal(r.status,'error');assert.equal(r.quota.dayUsed,0);assert.ok(db.prepare('SELECT cost_vnd FROM ai_requests').get().cost_vnd>0);assert.ok(!JSON.stringify(r).includes('FAKE_PRODUCT_KEY'))}
 });
 await test('Product timeout makes no retry and charges only the reserved estimate; pending turn is released',async()=>{
  reset();const p=provider.productAIProvider('fixture',async(_,opts)=>{calls++;return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('private failure'))))},5);const r=await run(form(),p);assert.equal(r.status,'error');assert.equal(calls,1);assert.equal(r.quota.dayPending,0);assert.equal(r.quota.dayUsed,0);const row=db.prepare('SELECT cost_vnd,reserve_vnd FROM ai_requests').get();assert.equal(row.cost_vnd,row.reserve_vnd);
 });
 await test('Concurrent product submissions share one call and cannot bypass the pending lock',async()=>{
  reset();let release,started;const ready=new Promise(r=>started=r),wait=new Promise(r=>release=r);const p=provider.productAIProvider('fixture',async()=>{calls++;started();await wait;return Response.json(response())});
  const first=run(form('parallel-product-key-01',[photo(1),photo(2)]),p);await ready;const others=await Promise.all(Array.from({length:8},()=>run(form('parallel-product-key-01',[photo(1),photo(2)]))));assert.ok(others.every(r=>r.status==='pending'));await reject(()=>run(form('parallel-product-key-02',[photo(1),photo(3)])),409);release();await first;assert.equal(calls,1);
 });
 await test('Product confirmation is owner scoped, durable and idempotent after the provider timeout window',async()=>{
  reset();const r=await run();const before=db.prepare('SELECT COUNT(*) n,SUM(cost_vnd) cost FROM ai_requests').get();await ai.recognitionResult('a',r.requestId,base+600000);assert.equal(db.prepare('SELECT status FROM ai_requests').get().status,'success');
  await reject(()=>sorting.saveSorting('b',{ids:['bottle'],version:rules.SORTING_VERSION,key:'other-user-confirm-01',confirmed:true,recognitionId:r.requestId,product:confirmed,productReviewed:true}),409);
  await reject(()=>save(r.requestId,{productReviewed:false}),400);await reject(()=>save(r.requestId,{product:undefined}),400);
  const saved=await Promise.all([save(r.requestId),save(r.requestId)]);assert.equal(saved[0].id,saved[1].id);assert.equal(db.prepare('SELECT COUNT(*) n FROM sorting_results').get().n,1);assert.equal(saved[0].product.brand,'Cocoon');assert.equal(saved[0].productGuidance.references.length,1);assert.equal(saved[0].productGuidance.programs.length,1);
  await reject(()=>save(r.requestId,{product:{...confirmed,brand:'Another'}}),409);assert.deepEqual(db.prepare('SELECT COUNT(*) n,SUM(cost_vnd) cost FROM ai_requests').get(),before);assert.equal(calls,1);assert.equal((await sorting.readSorting('a',saved[0].id)).product.productName,confirmed.productName);
 });
 await test('Corrections use user-confirmed label and backend references, not AI names or client cost/URLs',async()=>{
  reset();const r=await run(form(),mock({...observation,brand:'UnreadableBrand'}));const saved=await save(r.requestId);assert.equal(saved.product.brand,'Cocoon');assert.equal(saved.productGuidance.references.length,1);
  await reject(()=>save(r.requestId,{product:{...confirmed,source:'https://evil.test'}}),400);assert.ok(!JSON.stringify(saved).includes('evil.test'));
 });
 await test('Brand alone or a different variant/refill never inherits product-specific material',async()=>{
  for(const p of [{...confirmed,productName:''},{...confirmed,variant:'310ml'},{...confirmed,packageForm:'refill'},{...confirmed,productName:'Gel bí đao rửa mặt'},{...confirmed,materialCode:'PP 5'}])assert.equal(guides.productGuidance(p,['bottle'],base).references.length,0);
  assert.equal(guides.productGuidance(confirmed,['glass'],base).references.length,0);
 });
 await test('Takeback requires explicitly empty packaging and verified warning state; expiry withdraws stale guidance',async()=>{
  for(const p of [{...confirmed,remaining:'unknown'},{...confirmed,remaining:'remains'},{...confirmed,warning:'present'},{...confirmed,warning:'unknown'}])assert.equal(guides.productGuidance(p,['bottle'],base).programs.length,0);
  for(const ids of [['bottle','unknown-liquid'],['bottle','product-residue'],['glass-broken']])assert.equal(guides.productGuidance(confirmed,ids,base).programs.length,0);
  const stale=guides.productGuidance(confirmed,['bottle'],Date.parse('2027-01-02'));assert.equal(stale.references.length,0);assert.equal(stale.programs.length,0);assert.match(stale.message,/kiểm tra lại/);
 });
 await test('L’Occitane recommendation requires confirmed aluminium hand-cream tube, not cap or glass packaging',async()=>{
  const tube={...confirmed,brand:'L’Occitane',productName:'Shea Butter Hand Cream',packageForm:'tube',materialCode:'ALU'};assert.equal(guides.productGuidance(tube,['metal'],base).programs.length,1);
  for(const p of [{...tube,materialCode:'unknown'},{...tube,packageForm:'bottle'},{...tube,productName:'Dầu tắm'},{...tube,brand:'Another'}])assert.equal(guides.productGuidance(p,['metal'],base).programs.length,0);
 });
 await test('AI-only confirmation cannot omit unknown contents or ignore confirmed hazardous label; manual IDs unchanged',async()=>{
  reset();const r=await run();const saved=await save(r.requestId,{product:{...confirmed,remaining:'unknown'}});assert.equal(saved.plan.complete,false);assert.ok(saved.plan.components.some(p=>p.id==='unknown-container'));assert.equal(saved.productGuidance.programs.length,0);
  reset();const h=await run();const dangerous=await save(h.requestId,{product:{...confirmed,warning:'present'}});assert.ok(dangerous.plan.components.some(p=>p.id==='hazardous'));assert.equal(dangerous.productGuidance.programs.length,0);
  for(const packageForm of ['unknown','other'])for(const id of ['bottle','glass','metal'])for(const remaining of ['unknown','remains'])assert.ok(labels.productSelections([id],{...confirmed,packageForm,remaining}).includes('unknown-liquid'));
  for(const ids of [['paper'],['foam'],['food'],['unknown-item'],['glass','food']])assert.deepEqual(labels.productSelections(ids,{...confirmed,warning:'present'}),['hazardous']);
  const manual=await sorting.saveSorting('a',{manual:{kind:'bottle',answers:{use:'personal',material:'glass',remaining:'empty',damage:'intact'}},version:rules.SORTING_VERSION,key:'manual-unchanged-key-01',confirmed:true});assert.equal(manual.product,undefined);assert.deepEqual(manual.plan.components.map(p=>p.id),['glass']);
 });
 await test('Product gates, daily quota, cooldown and budget reject before network; review stays free',async()=>{
  reset();assert.equal(policy.LIVE_OPENAI_ENABLED,true);assert.equal((await q.quota('a',base)).aiEnabled,true);assert.equal(calls,0);
  let first;for(let i=0;i<5;i++){const r=await run(form(undefined,[photo(i+1)]));first||=r;}await reject(()=>run(),429);assert.equal(calls,5);assert.equal((await ai.recognitionResult('a',first.requestId,base)).status,'success');
  reset();for(let i=0;i<3;i++)await run(form(undefined,[photo(i+1)]),mock({...observation,identified:false}));await reject(()=>run(),429);assert.equal(calls,3);
  reset();db.prepare("UPDATE settings SET budget_vnd=? WHERE id='main'").run(policy.MIN_RESERVE_VND-1);await reject(()=>run(),429);assert.equal(calls,0);
 });
 await test('Schema-2 results saved before upgrade remain readable and confirmable without product labels',async()=>{
  reset();const f=form('schema-two-old-key-001');f.delete('mode');const scene={identified:true,components:[{name:'Chai',rule_id:'bottle',confidence:.95}]};const p=provider.sortingAIProvider('fixture',async()=>Response.json(response(scene,{usage:{input_tokens:1000,output_tokens:100}})));const r=await ai.runRecognition(request(f),'a',p,()=>base,false,'sorting');assert.equal(r.schemaVersion,2);
  const bytes=new Uint8Array([97,...photo(1)]),oldHash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');assert.equal(db.prepare('SELECT image_hash FROM ai_requests').get().image_hash,oldHash);
  const replay=form('schema-two-old-key-001');replay.delete('mode');assert.equal((await ai.runRecognition(request(replay),'a',p,()=>base,false,'sorting')).requestId,r.requestId);
  const saved=await sorting.saveSorting('a',{ids:['bottle'],version:rules.SORTING_VERSION,key:'old-schema-confirm-01',confirmed:true,recognitionId:r.requestId});assert.equal(saved.product,undefined);assert.equal(saved.plan.complete,true);
 });
}
