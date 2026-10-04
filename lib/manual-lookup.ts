import {normalizeSearch} from './sorting-rules';
export type ManualKind='cake'|'tissue'|'bottle'|'container'|'paper'|'bag'|'food'|'clothes'|'special'|'catalog';
export type Answers=Record<string,string>;
export type ManualQuestion={field:string;title:string;options:string[][]};
export const OBJECT_FAMILIES:{kind:ManualKind;name:string;example:string}[]=[
 {kind:'bottle',name:'Chai, lọ, hũ',example:'Chai nước, lọ serum, hũ kem'},
 {kind:'container',name:'Hộp, khay',example:'Hộp bánh, hộp cơm, lon đồ hộp'},
 {kind:'paper',name:'Giấy, khăn giấy',example:'Carton, giấy ăn, giấy dính dầu'},
 {kind:'bag',name:'Túi, bao bì',example:'Túi giấy, túi nhựa, bao bì ghép'},
 {kind:'food',name:'Thức ăn',example:'Cơm thừa, rau củ bỏ đi'},
 {kind:'clothes',name:'Quần áo, đồ vải',example:'Quần áo cũ, khăn, chăn'},
 {kind:'special',name:'Đồ điện, pin',example:'Pin, thiết bị điện, bóng đèn'},
 {kind:'catalog',name:'Đồ khác',example:'Tìm hoặc chọn từng phần'}
];
const options={
 intent:[['keep','Chưa dùng, muốn giữ lại'],['discard','Tôi muốn bỏ / đồ đã dùng']],
 use:[['food','Thực phẩm, đồ uống'],['personal','Mỹ phẩm, chăm sóc cá nhân thông thường'],['household','Chất tẩy rửa hoặc sản phẩm gia dụng khác'],['chemical','Hóa chất có cảnh báo nguy hại'],['unknown','Chưa rõ đã đựng gì']],
 material:[['bottle','Nhựa'],['glass','Thủy tinh'],['metal','Kim loại'],['unknown','Chưa rõ chất liệu']],
 remaining:[['empty','Đã hết / đã rỗng'],['remains','Còn sản phẩm bên trong'],['unknown','Chưa rõ']],
 damage:[['intact','Nguyên vẹn'],['broken','Nứt hoặc vỡ'],['unknown','Chưa kiểm tra']],
 product:[['skin','Dưỡng da, làm sạch da thông thường'],['hair','Dầu gội, dầu xả, chăm sóc tóc thông thường'],['other','Loại khác hoặc chưa rõ']],
 accessory:[['no','Không có phần cần phân loại thêm'],['yes','Có nắp, vòi bơm hoặc phụ kiện']],
 wrapper:[['paper','Giấy / carton sạch, khô'],['dirty-paper','Giấy dính kem, dầu hoặc thức ăn'],['laminated','Giấy có lớp phủ nhựa / bạc'],['foam','Xốp'],['single-use','Hộp / khay nhựa dùng một lần'],['plastic-container','Hộp / khay nhựa, chưa rõ loại'],['metal','Kim loại'],['glass','Thủy tinh'],['unknown','Chưa rõ chất liệu']],
 food:[['yes','Có, tách được'],['no','Không còn / không tách được']],
 base:[['none','Không có đế riêng'],['same','Giống phần vỏ hộp'],['paper','Giấy / carton sạch'],['dirty-paper','Giấy dính bánh, kem hoặc dầu'],['laminated','Có lớp phủ nhựa / bạc'],['unknown','Chưa rõ']],
 used:[['yes','Đúng, đã sử dụng trong ăn uống'],['no','Chưa dùng hoặc dính chất khác']],
 paperType:[['paper','Giấy / carton sạch, khô'],['tissue','Khăn giấy đã dùng trong ăn uống'],['dirty-paper','Giấy bẩn hoặc thấm dầu'],['laminated','Giấy tráng phủ / nhiều lớp'],['unknown','Chưa rõ']],
 bagType:[['paper','Túi giấy sạch, khô'],['plastic','Túi nhựa đã rỗng, không từng chứa chất nguy hại'],['dirty','Còn bẩn / còn sản phẩm bên trong'],['laminated','Bao bì nhiều lớp'],['chemical','Từng chứa chất nguy hại'],['unknown','Chưa rõ']],
 foodType:[['food','Thức ăn thừa, rau củ bỏ đi'],['garden','Bã trà, cà phê hoặc rác làm vườn'],['unknown','Loại khác / chưa rõ']],
 fabricType:[['ordinary','Đồ vải thông thường'],['chemical','Dính dầu công nghiệp hoặc hóa chất nguy hại'],['unknown','Chưa rõ chất bám trên vải']],
 specialType:[['battery','Pin, ắc quy'],['electronics','Thiết bị điện, điện tử'],['lamp','Đèn huỳnh quang hoặc nhiệt kế thủy ngân'],['unknown','Loại khác / chưa rõ']]
};
const question=(field:keyof typeof options,title:string):ManualQuestion=>({field,title,options:options[field]});
const has=(s:string,pattern:RegExp)=>pattern.test(s);
// Whole-word vocabulary only; no model calls or storage of search sentences.
export function interpretManual(text:string):{kind:ManualKind;answers:Answers}{
 const s=normalizeSearch(text).replace(/[^a-z0-9]+/g,' ').trim(),a:Answers={};
 if(has(s,/\b(khan giay|giay an|tissue)\b/)){if(has(s,/\b(dinh (thuc an|do an)|lau mieng)\b/)&&!has(s,/\b(hoa chat|axit|thuoc tru sau|y te|khong ro|chua ro)\b/))a.used='yes';return {kind:'tissue',answers:a};}
 if(has(s,/\b(lo vi song|lo nuong|noi com dien)\b/))return {kind:'special',answers:{specialType:'electronics'}};
 if(has(s,/\b(chai|bottle|lo|hu)\b/)){
  if(has(s,/\b(thuy tinh)\b/))a.material='glass';else if(has(s,/\b(nhua)\b/))a.material='bottle';else if(has(s,/\b(kim loai|nhom|sat)\b/))a.material='metal';
  if(has(s,/\b(axit|thuoc tru sau|thuoc bao ve thuc vat|hoa chat nguy hai)\b/))a.use='chemical';
  else if(has(s,/\b(son mong|tay son|nhuom toc|hoa chat|tay rua|nuoc hoa|nuoc lau|nuoc rua|nuoc tay|javen)\b/))a.use='household';
  else if(has(s,/\b(my pham|serum|kem duong|dau goi|dau xa|sua rua mat|toner)\b/))a.use='personal';
  else if(has(s,/\b(nuoc (uong|suoi|khoang|loc|ngot)|do uong|thuc pham|bia|ruou|sua|mut|mat ong)\b/))a.use='food';
  const emptied=has(s,/\b(da het|da rong|het nuoc|dung het|rong)\b|\bkhong con (gi|san pham|nuoc|kem|serum|my pham)\b/);
  const remains=has(s.replace(/\bkhong con (gi|san pham|nuoc|kem|serum|my pham)\b/g,''),/\b(con du|con (my pham|kem|serum|nuoc|san pham))\b/);
  if(emptied&&!remains)a.remaining='empty';else if(remains&&!emptied)a.remaining='remains';
  const intact=has(s,/\b(khong vo|khong nut|nguyen ven)\b/);
  const broken=has(s.replace(/\bkhong (vo|nut)\b/g,''),/\b(nut|bi vo|da vo|vo roi|vo vun)\b/)||/(?:^|\s)vỡ(?:\s|$)/i.test(text.replace(/không vỡ/gi,''));
  if(intact&&!broken)a.damage='intact';else if(broken&&!intact)a.damage='broken';
  // Conflicting or negated descriptions need an explicit answer, never a hidden guess.
  if(has(s,/\bkhong (phai |bang )?(thuy tinh|nhua|kim loai)\b/)||['thuy tinh','nhua','kim loai'].filter(x=>s.includes(x)).length>1)delete a.material;
  if(has(s,/\bkhong (phai |dung |chua )?(my pham|serum|thuc pham|do uong)\b/)||has(s,/\b(khong ro|chua ro|khong biet)\b/))delete a.use;
  if(has(s,/\b(khong rong|chua rong|chua het)\b/))delete a.remaining;
  if(has(s,/\b(khong (con )?nguyen ven|chua kiem tra)\b/))delete a.damage;
  if(has(s.replace(/\bkhong con nguyen\b/g,''),/\b(con nguyen|chua dung|chua mo)\b/))a.needIntent='yes';
  if(has(s,/\b(can bo|muon bo|bo di)\b/))a.intent='discard';
  if(has(s,/\b(dau goi|dau xa)\b/))a.product='hair';else if(has(s,/\b(kem duong|sua rua mat)\b/))a.product='skin';
  return {kind:'bottle',answers:a};
 }
 const cake=has(s,/\b(banh (gato|ga to|kem|sinh nhat)|cake)\b/);
 const kind:ManualKind=cake&&has(s,/\b(hop|de|khay|bao bi)\b/)?'cake':has(s,/\b(hop|khay|lon)\b/)?'container':has(s,/\b(tui|bao bi)\b/)?'bag':has(s,/\b(giay|carton)\b/)?'paper':has(s,/\b(quan ao|do vai|ao cu|khan vai|chan)\b/)?'clothes':has(s,/\b(pin|ac quy|dien tu|bong den|nhiet ke|dien thoai)\b/)?'special':cake||has(s,/\b(thuc an|com thua|rau|cu qua|vo qua|ba ca phe|ba tra|la cay)\b/)?'food':'catalog';
 if(kind==='cake'||kind==='container'){
  if(has(s,/\b(xop)\b/))a.wrapper='foam';else if(has(s,/\b(kim loai|sat|thiec|nhom)\b/))a.wrapper='metal';else if(has(s,/\b(thuy tinh)\b/))a.wrapper='glass';else if(has(s,/\b(giay|carton)\b/)){
   if(has(s,/\b(phu|trang|nhieu lop)\b/))a.wrapper='laminated';else if(has(s,/\b(dinh|tham|ban|dau|mo)\b/))a.wrapper='dirty-paper';else if(has(s,/\b(sach|kho)\b/))a.wrapper='paper';
  }
  if(kind==='cake')a.use='food';
  if(has(s,/\b(hoa chat|thuoc tru sau|axit)\b/))a.use='chemical';
  else if(has(s,/\b(thuc an|thuc pham|do an|com|banh|ca hop|pate)\b/))a.use='food';
  if(has(s,/\b(khong con|da het|rong)\b/))a.food='no';else if(has(s,/\b(con (thuc an|do an|banh|com)|dinh (banh|kem)|chua (thuc an|banh))\b/))a.food='yes';
 }
 if(kind==='paper'){if(has(s,/\b(phu|trang|nhieu lop)\b/))a.paperType='laminated';else if(has(s,/\b(dinh|tham|ban|dau|mo)\b/))a.paperType='dirty-paper';else if(has(s,/\b(sach|kho)\b/))a.paperType='paper';}
 if(kind==='special'){if(has(s,/\b(pin|ac quy)\b/))a.specialType='battery';else if(has(s,/\b(huynh quang|thuy ngan)\b/))a.specialType='lamp';else if(has(s,/\b(dien tu|dien thoai)\b/))a.specialType='electronics';}
 if(kind==='food'&&(cake||has(s,/\b(com thua|thuc an thua|rau cu)\b/)))a.foodType='food';
 if(kind==='food'&&has(s,/\b(ba ca phe|ba tra|la cay)\b/))a.foodType='garden';
 return {kind,answers:a};
}
export function manualQuestions(kind:ManualKind,a:Answers):ManualQuestion[]{
 if(kind==='bottle'){
  const qs:ManualQuestion[]=[];
  if(a.needIntent==='yes'){qs.push(question('intent','Bạn muốn giữ lại hay bỏ món đồ này?'));if(a.intent!=='discard')return qs;}
  qs.push(question('use','Chai, lọ hoặc hũ đã đựng gì?'));
  if(!a.use||['chemical','household','unknown'].includes(a.use))return qs;
  qs.push(question('material','Vỏ làm bằng chất liệu gì?'),question('remaining','Còn sản phẩm bên trong không?'));
  if(a.material==='glass')qs.push(question('damage','Thủy tinh còn nguyên vẹn không?'));
  return qs;
 }
 if(kind==='cake'||kind==='container'){
  if(kind==='container'&&a.use==='personal')return manualQuestions('bottle',a);
  if(a.use==='chemical'||(kind==='container'&&a.use!=='food'))return [question('use','Hộp hoặc khay đã đựng gì?')];
  const qs=[...(kind==='container'?[question('use','Hộp hoặc khay đã đựng gì?')]:[]),question('food',kind==='cake'?'Có phần bánh cần bỏ riêng không?':'Có thức ăn dễ tách ra không?'),question('wrapper','Vỏ hộp thuộc loại nào?')];
  if(a.wrapper==='glass')qs.push(question('damage','Thủy tinh còn nguyên vẹn không?'));
  if(kind==='cake')qs.push(question('base','Phần đế bánh thuộc loại nào?'));
  return qs;
 }
 if(kind==='tissue')return [question('used','Đây là khăn giấy dùng trong ăn uống thông thường?'),...(a.used==='yes'?[question('food','Có miếng thức ăn dễ lấy ra khỏi khăn không?')]:[])];
 if(kind==='paper')return [question('paperType','Giấy đang ở tình trạng nào?'),...(['tissue','dirty-paper','laminated'].includes(a.paperType)?[question('food','Có thức ăn dễ tách ra khỏi giấy không?')]:[])];
 if(kind==='bag')return [question('bagType','Túi hoặc bao bì thuộc trường hợp nào?')];
 if(kind==='food')return [question('foodType','Bạn muốn bỏ loại nào?')];
 if(kind==='clothes')return [question('fabricType','Đồ vải có dính hóa chất nguy hại không?')];
 if(kind==='special')return [question('specialType','Đó là loại đồ nào?')];
 return [];
}
export function validManual(kind:unknown,a:unknown):a is Answers{
 if(typeof kind!=='string'||!['cake','tissue','bottle','container','paper','bag','food','clothes','special'].includes(kind)||!a||typeof a!=='object'||Array.isArray(a))return false;
 for(const [key,value] of Object.entries(a)){
  if(typeof value!=='string')return false;
  if(key==='needIntent'){if(value!=='yes')return false;continue;}
  const values=options[key as keyof typeof options];if(!Array.isArray(values)||!values.some(([v])=>v===value))return false;
 }
 const answers=a as Answers;
 if(answers.intent==='keep'&&answers.needIntent!=='yes')return false;
 const qs=manualQuestions(kind as ManualKind,answers);
 return qs.length>0&&qs.every(q=>q.options.some(([v])=>v===answers[q.field]));
}
export function manualAnswerLabel(field:string,value:string){return options[field as keyof typeof options]?.find(([v])=>v===value)?.[1]||value;}
export function resolveManual(kind:ManualKind,a:Answers):{ids:string[];keep?:boolean}{
 if(kind==='bottle'&&a.intent==='keep')return {ids:[],keep:true};
 const ids:string[]=[];
 const glass=()=>a.damage==='broken'?'glass-broken':'glass';
 if(kind==='bottle'){
  if(a.use==='chemical'||a.content==='chemical')return {ids:['hazardous']};
  if(['unknown','household'].includes(a.use))return {ids:['unknown-container','unknown-liquid']};
  const shell=a.material==='glass'?glass():['bottle','metal'].includes(a.material)?a.material:'unknown-container';
  ids.push(shell);
  if(a.remaining==='unknown')ids.push('unknown-liquid');
  else if(a.remaining==='remains')ids.push(a.use==='personal'?'product-residue':'drink-residue');
  if(a.accessory==='yes')ids.push('unknown-accessory');
 }else if(kind==='container'||kind==='cake'){
  if(a.use==='chemical')return {ids:['hazardous']};
  if(kind==='container'&&a.use==='personal')return resolveManual('bottle',a);
  if(kind==='container'&&a.use!=='food')return {ids:['unknown-container']};
  if(a.food==='yes')ids.push('food');
  const wrapper=a.wrapper==='glass'?glass():['paper','dirty-paper','laminated','foam','metal','single-use','plastic-container'].includes(a.wrapper)?a.wrapper:'unknown-container';ids.push(wrapper);
  if(kind==='cake'&&a.base&&a.base!=='none')ids.push(a.base==='same'?wrapper:['paper','dirty-paper','laminated'].includes(a.base)?a.base:'unknown-container');
 }else if(kind==='tissue'){ids.push(a.used==='yes'?'tissue':'unknown-item');if(a.used==='yes'&&a.food==='yes')ids.push('food');
 }else if(kind==='paper'){ids.push(['paper','dirty-paper','laminated','tissue'].includes(a.paperType)?a.paperType:'unknown-item');if(a.food==='yes'&&a.paperType!=='paper')ids.push('food');
 }else if(kind==='bag'){ids.push(({paper:'paper',plastic:'plastic-bag',laminated:'laminated',chemical:'hazardous'} as Record<string,string>)[a.bagType]||'unknown-container');
 }else if(kind==='food'){ids.push(['food','garden'].includes(a.foodType)?a.foodType:'unknown-item');
 }else if(kind==='clothes'){ids.push(a.fabricType==='ordinary'?'clothes':a.fabricType==='chemical'?'hazardous-fabric':'unknown-item');
 }else if(kind==='special'){ids.push(['battery','electronics','lamp'].includes(a.specialType)?a.specialType:'unknown-item');}
 return {ids:[...new Set(ids)]};
}
