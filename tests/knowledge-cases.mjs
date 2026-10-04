import path from 'node:path';
export async function run({assert,test,call,db,temp}){
 const {KNOWLEDGE_PACK:pack}=await import(path.join(temp,'lib/server/knowledge-pack.js'));
 const helper=await import(path.join(temp,'lib/knowledge.js'));
 const {SORTING_RULES,SORTING_VERSION}=await import(path.join(temp,'lib/sorting-rules.js'));
 const imported=()=>db.prepare("SELECT * FROM content WHERE id LIKE 'eco-knowledge-20261003-%'").all();
 const send=(user='admin',revision=helper.KNOWLEDGE_REVISION)=>call('admin/knowledge-pack',{method:'POST',user,body:{revision}});
 await test('Knowledge pack has 60 sourced locations, 16 projects, 11 articles and valid rule links',async()=>{
  assert.equal(pack.length,87);assert.equal(new Set(pack.map(r=>r.id)).size,87);
  for(const [kind,count] of [['points',60],['projects',16],['articles',11]])assert.equal(pack.filter(r=>r.kind===kind).length,count);
  for(const r of pack){assert.ok(r.id.length<=100);assert.equal(r.payload.checkedAt,'2026-10-03');assert.ok(helper.sourceLinks(r.source).length);assert.ok(!/fixture|FAKE_|API_KEY|PDF được liên kết chính thức chưa đọc|trong UI/i.test(JSON.stringify(r)));
   if(r.kind==='points'){assert.ok(r.payload.address);assert.ok(r.payload.materials);assert.ok(r.payload.status)}
   if(r.kind==='articles'){assert.ok(r.payload.body.length>100);assert.ok(r.payload.summary);for(const id of r.payload.relatedRules.split(','))assert.ok(SORTING_RULES.some(r=>r.id===id))}
  }
  assert.match(pack.find(r=>r.id.endsWith('lagom-mrf')).payload.hours,/Liên hệ/);
  for(const p of pack.filter(r=>r.kind==='points'&&r.id.includes('-coca-')))assert.match(p.payload.status,/quyền vào/);
 });
 await test('Knowledge import is authenticated admin-only, same-origin and revision checked',async()=>{
  assert.equal((await send('')).status,401);assert.equal((await send('a')).status,403);assert.equal((await call('admin/knowledge-pack',{user:'a'})).status,403);assert.equal((await send('admin','bad')).status,409);
  assert.equal((await call('admin/knowledge-pack',{method:'POST',user:'admin',origin:'https://evil.test',body:{revision:helper.KNOWLEDGE_REVISION}})).status,403);assert.equal(imported().length,0);
 });
 const before={users:db.prepare('SELECT * FROM users').all(),ai:db.prepare('SELECT * FROM ai_requests').all(),settings:db.prepare('SELECT * FROM settings').all(),existing:db.prepare('SELECT * FROM content').all()};
 await test('Import database failure leaves no partial published content',async()=>{
  const batch=globalThis.__ecoTestEnv.DB.batch;globalThis.__ecoTestEnv.DB.batch=async()=>{throw Error('fixture storage outage')};try{assert.equal((await send()).status,503);assert.equal(imported().length,0)}finally{globalThis.__ecoTestEnv.DB.batch=batch}
 });
 await test('Concurrent and repeated imports complete without duplicates or changing existing data',async()=>{
  const responses=await Promise.all(Array.from({length:5},()=>send()));for(const r of responses)assert.equal(r.status,200);
  for(let n=0;n<10;n++){const status=await (await call('admin/knowledge-pack',{user:'admin'})).json();if(!status.remaining)break;assert.equal((await send()).status,200)}
  assert.equal(imported().length,87);const again=await(await send()).json();assert.equal(again.remaining,0);assert.equal(again.installed,87);
  for(const row of before.existing)assert.deepEqual(db.prepare('SELECT * FROM content WHERE id=?').get(row.id),row);
  assert.deepEqual(db.prepare('SELECT * FROM users').all(),before.users);assert.deepEqual(db.prepare('SELECT * FROM ai_requests').all(),before.ai);assert.deepEqual(db.prepare('SELECT * FROM settings').all(),before.settings);
 });
 await test('Anonymous visitors can read populated public articles, points and projects',async()=>{
  for(const [kind,count] of [['points',60],['projects',16],['articles',11]]){const r=await call('content?kind='+kind);assert.equal(r.status,200);const {rows}=await r.json();assert.equal(rows.filter(r=>r.id.startsWith('eco-knowledge')).length,count);assert.ok(rows.every(r=>r.published&&r.verified))}
 });
 await test('Import retry preserves administrator edits and publication withdrawal',async()=>{
  const first=pack.find(r=>r.kind==='articles'),previous=db.prepare('SELECT * FROM content WHERE id=?').get(first.id);db.prepare('UPDATE content SET title=?,published=0,version=version+1 WHERE id=?').run('Biên tập đã sửa',first.id);
  assert.equal((await send()).status,200);assert.equal(db.prepare('SELECT title FROM content WHERE id=?').get(first.id).title,'Biên tập đã sửa');assert.equal(db.prepare('SELECT published FROM content WHERE id=?').get(first.id).published,0);
  db.prepare('UPDATE content SET title=?,published=?,version=? WHERE id=?').run(previous.title,previous.published,previous.version,first.id);
 });
 await test('Related reading matches exact rules, excludes withdrawn and expired articles',async()=>{
  const rows=pack.map(r=>({...r,...r.payload,published:true,verified:true}));const now=Date.parse('2026-10-03T12:00:00+07:00');
  assert.deepEqual(helper.relatedReading(rows,['battery'],now).map(r=>r.id),['eco-knowledge-20261003-articles-pin-cu-thu-gom-rieng']);assert.ok(helper.relatedReading(rows,['clothes'],now).some(r=>r.title.startsWith('Dọn tủ')));assert.equal(helper.relatedReading(rows,['unknown-liquid'],now).length,0);
  const row=rows.find(r=>r.id.endsWith('diem-thu-gom-chai-lon'));assert.ok(helper.relatedReading(rows,['bottle'],Date.parse('2026-12-06T16:59:58Z')).includes(row));assert.ok(!helper.relatedReading(rows,['bottle'],Date.parse('2026-12-06T17:00:00Z')).includes(row));
  assert.equal(helper.relatedReading([{...row,published:false}],['bottle'],now).length,0);assert.equal(helper.relatedReading([{...row,verified:false}],['bottle'],now).length,0);
 });
 await test('Saved manual results expose curated reading without quota and reflect withdrawal',async()=>{
  const requests=db.prepare('SELECT * FROM ai_requests').all();db.exec('DELETE FROM rate_limits');
  const res=await call('sorting',{method:'POST',user:'a',body:{ids:['battery'],version:SORTING_VERSION,key:'knowledge-manual-fixture-01',confirmed:true}});assert.equal(res.status,200);
  const result=await res.json();assert.equal(result.relatedArticles.length,1);const article=result.relatedArticles[0];assert.match(article.title,/Pin cũ/);db.prepare('UPDATE content SET published=0 WHERE id=?').run(article.id);
  const reread=await(await call('sorting?id='+result.id,{user:'a'})).json();assert.equal(reread.relatedArticles.length,0);assert.equal(reread.plan.components[0].special,true);db.prepare('UPDATE content SET published=1 WHERE id=?').run(article.id);assert.deepEqual(db.prepare('SELECT * FROM ai_requests').all(),requests);
 });
 await test('Directory supports accents, place names and exact program filtering',async()=>{
  const rows=pack.filter(r=>r.kind==='points').map(r=>({...r,...r.payload}));assert.ok(helper.filterPoints(rows,'quan ao','','').length>=4);assert.equal(helper.filterPoints(rows,'','ha dong','').filter(p=>p.title==='TH true mart Vạn Phúc').length,1);
  const only=helper.filterPoints(rows,'','','Việt Nam Tái Chế');assert.equal(only.length,4);assert.ok(only.every(r=>r.program==='Việt Nam Tái Chế'));assert.equal(helper.filterPoints(rows,'no such material 8273','','').length,0);
 });
 await test('Source links permit only HTTPS references without embedded credentials',async()=>{assert.equal(helper.sourceLinks('javascript:alert(1) http://unsafe.test https://name:secret@bad.test').length,0);assert.deepEqual(helper.sourceLinks('https://example.com/a https://example.com/a').map(r=>r.url),['https://example.com/a'])});
}
