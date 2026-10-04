export async function run({assert,test:runTest,call,db,q,base,clear,manual,rules,post,body}){
 // Isolate each fixture's rate window so this expanded suite does not consume another case's allowance.
 const test=(name,fn)=>runTest(name,async()=>{db.exec('DELETE FROM rate_limits');await fn()});
 const emptyGlass={use:'personal',material:'glass',remaining:'empty',damage:'intact'};
 const submit=(kind,answers,extra={})=>post(body(undefined,{manual:{kind,answers},...extra}));
 await test('Cosmetic descriptions infer object/material/use without asking users to know a waste group',async()=>{
  const r=manual.interpretManual('lọ serum thủy tinh');assert.equal(r.kind,'bottle');assert.equal(r.answers.use,'personal');assert.equal(r.answers.material,'glass');
  assert.deepEqual(manual.manualQuestions(r.kind,r.answers).filter(x=>!r.answers[x.field]).map(x=>x.field),['remaining','damage']);
  assert.equal(manual.OBJECT_FAMILIES.length,8);assert.equal(manual.interpretManual('lò vi sóng').kind,'special');assert.equal(manual.interpretManual('nước lọc').kind,'catalog');
  assert.equal(manual.interpretManual('bánh kem còn thừa').kind,'food');assert.equal(manual.interpretManual('bánh kem còn thừa').answers.foodType,'food');
 });
 await test('Water-word household products and unknown contents never infer food packaging',async()=>{
  for(const text of ['chai nước hoa','chai nước tẩy toilet','chai Javen','chai nước rửa chén','chai nước lau nhà','chai nước chưa rõ là gì'])assert.notEqual(manual.interpretManual(text).answers.use,'food',text);
  assert.equal(manual.interpretManual('chai nhựa đựng thuốc trừ sâu đã rỗng').answers.use,'chemical');
  assert.equal(manual.interpretManual('chai nước suối').answers.use,'food');
 });
 await test('Negated, conflicting and accessory descriptions leave uncertain attributes to be answered',async()=>{
  for(const text of ['lọ serum thủy tinh không còn nắp','lọ serum chưa rỗng','lọ serum rỗng nhưng còn kem','lọ serum không còn nguyên vẹn'])assert.equal(manual.interpretManual(text).answers.remaining,undefined,text);
  for(const text of ['lọ thủy tinh không vỡ nhưng nứt','lọ serum không còn nguyên vẹn','chai thủy tinh còn vỏ'])assert.equal(manual.interpretManual(text).answers.damage,undefined,text);
  assert.equal(manual.interpretManual('chai không phải thủy tinh').answers.material,undefined);
  assert.equal(manual.interpretManual('lọ thủy tinh có nắp nhựa').answers.material,undefined);
  assert.equal(manual.interpretManual('lọ thủy tinh bị vỡ').answers.damage,'broken');assert.equal(manual.interpretManual('lọ thủy tinh vỡ').answers.damage,'broken');
  assert.equal(manual.interpretManual('lọ serum đã rỗng').answers.remaining,'empty');
  assert.equal(manual.interpretManual('khăn giấy đã dùng dính hóa chất').answers.used,undefined);
  assert.equal(manual.interpretManual('khăn giấy đã dùng').answers.used,undefined);
 });
 await test('Empty cosmetic glass body stays recyclable when its pump is unresolved',async()=>{
  clear();const r=await submit('bottle',{...emptyGlass,accessory:'yes'});assert.equal(r.status,200);const v=await r.json();
  assert.equal(v.plan.components.find(x=>x.id==='glass').group,'recycle');assert.equal(v.plan.components.find(x=>x.id==='unknown-accessory').group,null);assert.equal(v.plan.complete,false);
  assert.equal((await q.quota('a',base)).dayUsed,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,0);
 });
 await test('Cosmetics with residue keep the body classification conditional and never classify residue as food',async()=>{
  const r=await submit('bottle',{...emptyGlass,remaining:'remains'});assert.equal(r.status,200);const v=await r.json();
  assert.ok(v.plan.components.find(x=>x.id==='glass').condition);assert.equal(v.plan.components.find(x=>x.id==='product-residue').group,null);assert.equal(v.plan.complete,false);
  assert.ok(v.plan.components.every(x=>x.group!=='food'));assert.match(v.plan.components.find(x=>x.id==='product-residue').warning,/Không.*đổ xuống cống/);
 });
 await test('Broken glass instructions retain sharp-edge safety even when cosmetic residue remains',async()=>{
  const r=await submit('bottle',{...emptyGlass,damage:'broken',remaining:'remains'});const v=await r.json();const glass=v.plan.components.find(x=>x.id==='glass-broken');assert.equal(glass.group,'recycle');assert.ok(glass.condition);assert.match(glass.steps.join(' '),/sắc nhọn/);
 });
 await test('Unknown contents invalidate shell assumptions; hazardous containers remain special even when empty',async()=>{
  let r=await submit('bottle',{...emptyGlass,remaining:'unknown'});let v=await r.json();assert.ok(v.plan.components.every(x=>x.group===null));
  r=await submit('bottle',{...emptyGlass,use:'chemical'});v=await r.json();assert.equal(v.plan.components.length,1);assert.equal(v.plan.components[0].id,'hazardous');assert.equal(v.plan.components[0].special,true);
 });
 await test('Cake, dirty paper, used tissues and intact water bottles retain their earlier component flows',async()=>{
  for(const [kind,answers,expected] of [
   ['cake',{food:'yes',wrapper:'dirty-paper',base:'laminated'},['food','dirty-paper','laminated']],
   ['tissue',{used:'yes',food:'yes'},['food','tissue']],
   ['container',{use:'food',food:'yes',wrapper:'foam'},['food','foam']],
   ['container',{use:'food',food:'yes',wrapper:'single-use'},['food','single-use']],
   ['container',{use:'food',food:'yes',wrapper:'plastic-container'},['food','plastic-container']],
   ['container',{use:'food',food:'yes',wrapper:'metal'},['food','metal']],
   ['bottle',{needIntent:'yes',intent:'discard',use:'food',material:'bottle',remaining:'remains'},['bottle','drink-residue']]
  ]){const r=await submit(kind,answers);assert.equal(r.status,200);const v=await r.json();assert.deepEqual(v.plan.components.map(x=>x.id),expected)}
  assert.equal((await submit('bottle',{needIntent:'yes',intent:'keep'})).status,400);
  assert.equal(manual.resolveManual('bottle',{needIntent:'yes',intent:'keep'}).keep,true);
 });
 await test('Every broad family resolves reviewed or explicitly unresolved content, including non-food containers',async()=>{
  for(const [kind,answers,expected] of [
   ['container',emptyGlass,'glass'],['paper',{paperType:'paper'},'paper'],['paper',{paperType:'unknown'},'unknown-item'],
   ['bag',{bagType:'plastic'},'plastic-bag'],['bag',{bagType:'chemical'},'hazardous'],['bag',{bagType:'dirty'},'unknown-container'],
   ['food',{foodType:'food'},'food'],['food',{foodType:'garden'},'garden'],
   ['clothes',{fabricType:'ordinary'},'clothes'],['clothes',{fabricType:'chemical'},'hazardous-fabric'],
   ['special',{specialType:'battery'},'battery'],['special',{specialType:'electronics'},'electronics'],['special',{specialType:'lamp'},'lamp'],
   ['tissue',{used:'no'},'unknown-item']
  ]){const r=await submit(kind,answers);assert.equal(r.status,200,kind);assert.equal((await r.json()).plan.components[0].id,expected)}
 });
 await test('Server rejects incomplete manual answers and invalid enums instead of silently defaulting',async()=>{
  for(const [kind,answers] of [['bottle',{use:'personal'}],['bottle',{...emptyGlass,damage:'made-up'}],['bottle',{...emptyGlass,material:'paper'}],['bottle',{...emptyGlass,cost:'0'}],['bottle',{...emptyGlass,constructor:'x'}],['catalog',{}],['made-up',{}],['cake',{food:'yes',wrapper:'glass',base:'none'}]])assert.equal((await submit(kind,answers)).status,400);
  assert.equal((await submit('bottle',[])).status,400);assert.equal((await submit('bottle',null)).status,400);
 });
 await test('Backend derives manual results despite forged rule IDs, user ID, group, or costs',async()=>{
  clear();const r=await submit('bottle',emptyGlass,{ids:['food'],group:'food',costVnd:-100,userId:'b'});assert.equal(r.status,200);const v=await r.json();assert.equal(v.plan.components[0].id,'glass');
  assert.equal((await call('sorting?id='+v.id,{user:'b'})).status,404);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,0);
 });
 await test('Concurrent structured manual submissions are idempotent and changed answers cannot overwrite',async()=>{
  const b=body(undefined,{manual:{kind:'bottle',answers:emptyGlass}});const rs=await Promise.all(Array.from({length:12},()=>post(b)));assert.ok(rs.every(r=>r.status===200));const vs=await Promise.all(rs.map(r=>r.json()));assert.equal(new Set(vs.map(x=>x.id)).size,1);
  assert.equal((await post({...b,manual:{kind:'bottle',answers:{...emptyGlass,remaining:'remains'}}})).status,409);
 });
 await test('Old saved results remain readable with revised rules and stale submissions must be refreshed',async()=>{
  const r=await submit('bottle',emptyGlass);const v=await r.json();db.prepare('UPDATE sorting_results SET rule_version=1 WHERE id=?').run(v.id);const old=await (await call('sorting?id='+v.id,{user:'a'})).json();assert.equal(old.updated,true);assert.equal(old.plan.version,rules.SORTING_VERSION);assert.equal(old.plan.components[0].id,'glass');
  assert.equal((await submit('bottle',emptyGlass,{version:1})).status,409);
  const missing=rules.sortingPlan(['food','retired-rule']);assert.equal(missing.complete,false);assert.ok(missing.components.some(x=>x.id==='unknown-item'));
 });
 await test('Manual request throttling still caps 60 submissions per minute without debiting AI quota',async()=>{
  clear();const b=body(undefined,{manual:{kind:'bottle',answers:emptyGlass}});for(let n=0;n<60;n++)assert.equal((await post(b)).status,200);
  assert.equal((await post(b)).status,429);assert.equal((await q.quota('a',base)).dayUsed,0);
 });
 db.exec('DELETE FROM rate_limits');
}
