import {validProductContext,cleanProductContext,productSelections} from '../product-label';
import {productGuidance} from './product-guidance';
import {statement} from './database';
import {HttpError} from './auth';
import {SORTING_RULES,SORTING_VERSION,sortingPlan} from '../sorting-rules';
import {validManual,resolveManual,type ManualKind} from '../manual-lookup';
export type Scene={identified:boolean;components:{name:string;rule_id:string|null;confidence:number}[]};
export function validScene(v:any):v is Scene{return !!v&&Object.keys(v).length===2&&typeof v.identified==='boolean'&&Array.isArray(v.components)&&v.components.length<=6&&v.components.every((p:any)=>p&&Object.keys(p).length===3&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=120&&(p.rule_id===null||typeof p.rule_id==='string'&&p.rule_id.length<=80)&&typeof p.confidence==='number'&&Number.isFinite(p.confidence)&&p.confidence>=0&&p.confidence<=1)}
export function sceneResult(scene:Scene){
 const components=scene.components.map(p=>({...p,rule_id:p.confidence>=.85&&SORTING_RULES.some(r=>r.id===p.rule_id)?p.rule_id:null}));
 const matched=components.filter(p=>p.rule_id),plan=sortingPlan([...new Set(matched.map(p=>p.rule_id!))]);
 const status=!scene.identified||!matched.length?'unknown':components.some(p=>!p.rule_id)||!plan.complete?'no_guidance':'success';
 return {schemaVersion:2,ruleVersion:SORTING_VERSION,status,components,message:status==='success'?'Kiểm tra từng phần và điều kiện áp dụng trước khi xem cách phân loại.':status==='unknown'?'Chưa xác định đủ rõ. Bạn có thể chọn các phần thủ công, không trừ lượt.':'Một số phần cần bạn kiểm tra thêm. Chưa có kết quả phân loại đầy đủ, không trừ lượt.'};
}
function selectedIds(value:any){if(!Array.isArray(value)||!value.length||value.length>6||value.some(x=>typeof x!=='string'||!SORTING_RULES.some(r=>r.id===x)))throw new HttpError(400,'Chọn từ 1 đến 6 phần trong danh mục.');return [...new Set<string>(value)].sort()}
export async function saveSorting(userId:string,d:any){
 if(d.version!==SORTING_VERSION)throw new HttpError(409,'Hướng dẫn vừa cập nhật. Hãy tải lại và xác nhận.');
 if(d.confirmed!==true)throw new HttpError(400,'Vui lòng kiểm tra các phần và điều kiện áp dụng.');
 let submittedIds=d.ids;
 if(d.manual!==undefined){
  const m=d.manual;
  if(!m||typeof m!=='object'||Object.keys(m).some(k=>!['kind','answers'].includes(k))||!validManual(m.kind,m.answers))throw new HttpError(400,'Hãy kiểm tra đồ vật và trả lời các thông tin còn thiếu.');
  const resolved=resolveManual(m.kind as ManualKind,m.answers);
  if(resolved.keep)throw new HttpError(400,'Đồ vật được giữ lại sử dụng chưa cần tạo kết quả phân loại.');
  submittedIds=resolved.ids;
 }
 let ids=selectedIds(submittedIds);const key=d.key;
 if(typeof key!=='string'||!/^[\w-]{16,100}$/.test(key))throw new HttpError(400,'Mã tra cứu không hợp lệ.');
 let productContext:string|null=null;
 if(d.product!==undefined){if(d.productReviewed!==true||!validProductContext(d.product))throw new HttpError(400,'Hãy kiểm tra nhãn sản phẩm; không nhập địa chỉ, số điện thoại hoặc thông tin cá nhân.');productContext=JSON.stringify(cleanProductContext(d.product));}
 if(productContext){if(!d.recognitionId)throw new HttpError(400,'Thông tin nhãn chỉ dùng trong luồng ảnh đã xác nhận.');ids=productSelections(ids,JSON.parse(productContext));}
 const selection=JSON.stringify(ids);
 let recognitionId:string|null=null;
 if(d.recognitionId){if(typeof d.recognitionId!=='string')throw new HttpError(400,'Mã nhận diện không hợp lệ.');const row=await statement('SELECT status,result_json FROM ai_requests WHERE id=? AND user_id=?',d.recognitionId,userId).first<any>();if(!row||!['success','no_guidance','unknown'].includes(row.status)||![2,3].includes(JSON.parse(row.result_json||'{}').schemaVersion))throw new HttpError(409,'Không có kết quả nhận diện phù hợp của bạn.');if(JSON.parse(row.result_json||'{}').schemaVersion===3&&!productContext)throw new HttpError(400,'Vui lòng xác nhận hoặc sửa nhãn trước khi phân loại.');recognitionId=d.recognitionId;}
 const findExisting=async()=>{
  const rows=(await statement('SELECT id,request_key,recognition_id,selections,product_context FROM sorting_results WHERE user_id=? AND (request_key=? OR recognition_id=?)',userId,key,recognitionId).all<any>()).results;
  if(rows.length>1||rows.some(r=>r.selections!==selection||(r.product_context||null)!==productContext||(r.request_key===key&&r.recognition_id!==recognitionId)))throw new HttpError(409,'Lần tra cứu đã được xác nhận với ảnh hoặc các phần khác. Hãy bắt đầu tra cứu mới.');
  return rows[0];
 };
 const existing=await findExisting();
 if(existing)return readSorting(userId,existing.id);
 const id=crypto.randomUUID();
 await statement('INSERT INTO sorting_results(id,user_id,request_key,recognition_id,selections,product_context,rule_version,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',id,userId,key,recognitionId,selection,productContext,SORTING_VERSION,Date.now()).run();
 const saved=await findExisting();
 if(!saved)throw new HttpError(409,'Các phần đã thay đổi ở một tab khác. Hãy tải lại.');
 return readSorting(userId,saved.id);
}
export async function readSorting(userId:string,id:string){const row=await statement('SELECT * FROM sorting_results WHERE id=? AND user_id=?',id,userId).first<any>();if(!row)throw new HttpError(404,'Không tìm thấy kết quả của bạn.');const ids=JSON.parse(row.selections),product=row.product_context?JSON.parse(row.product_context):null;return {...(product&&validProductContext(product)?{product,productGuidance:productGuidance(product,ids)}:{}),id:row.id,plan:sortingPlan(ids),saved:!!row.saved,method:row.recognition_id?'Ảnh · đã xác nhận':'Tra cứu thủ công',createdAt:row.created_at,updated:row.rule_version!==SORTING_VERSION};}
export async function sortingHistory(userId:string){const rows=await statement('SELECT id,selections,saved,recognition_id,created_at FROM sorting_results WHERE user_id=? ORDER BY created_at DESC LIMIT 200',userId).all<any>();return rows.results.map(r=>({id:r.id,title:sortingPlan(JSON.parse(r.selections)).components.map(x=>x.name).join(' + '),saved:!!r.saved,createdAt:r.created_at,method:r.recognition_id?'Ảnh · đã xác nhận':'Tra cứu thủ công'}));}
