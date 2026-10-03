import {SORTING_RULES,SORTING_VERSION} from '../sorting-rules';
import {productResult} from './product-recognition';
import {sceneResult} from './sorting';
import {runtime,statement} from './database';
import {HttpError} from './auth';
import {boundedBody,str} from './security';
import {LIVE_OPENAI_ENABLED,AI_DISABLED_MESSAGE,GROUPS,TRIAL_EXPIRES_AT} from './ai-policy';
import {reserve,settle,quota,recoverPending,requestRow,type Outcome} from './quota';
import {productAIProvider,estimatedUsage,type ImageProvider,type CatalogItem} from './ai-provider';
const normalize=(v:string)=>v.normalize('NFC').trim().toLocaleLowerCase('vi-VN');
export function guide(row:any){
 if(!row||row.kind!=='items'||!row.published||!row.verified||!row.source?.trim())return null;
 let p:any;try{p=JSON.parse(row.payload)}catch{return null}
 if(typeof p.steps!=='string'||!p.steps.trim()||!GROUPS.includes(row.group_name)||!row.title?.trim())return null;
 return {id:row.id,name:row.title,group:row.group_name,description:typeof p.description==='string'?p.description:'',version:row.version};
}
export async function reviewedCatalog(){
 const rows=await statement("SELECT * FROM content WHERE kind='items' AND published=1 AND verified=1 ORDER BY id").all<any>();
 const catalog:CatalogItem[]=[];let size=0;
 for(const row of rows.results){const g=guide(row);if(!g)continue;const item={id:g.id,name:g.name,group:g.group,description:g.description.slice(0,350)};const bytes=new TextEncoder().encode(JSON.stringify(item)).length;if(size+bytes>20000||catalog.length>=100)break;catalog.push(item);size+=bytes;}
 return catalog;
}
// Client re-encodes PNG/WebP/JPEG to a bounded JPEG, removing EXIF. Validate
// dimensions/signature again on the server and strip metadata before dispatch.
export function cleanJPEG(bytes:Uint8Array){
 const invalid=()=>new HttpError(400,'Ảnh không hợp lệ. Vui lòng chọn lại JPG, PNG hoặc WEBP.');
 if(bytes.length<12||bytes.length>2*1024*1024||bytes[0]!==255||bytes[1]!==216)throw invalid();
 let offset=2,dimensions=false,scan=false,ended=false;const parts:Uint8Array[]=[bytes.subarray(0,2)];
 while(offset<bytes.length){
  const start=offset;if(bytes[offset++]!==255)throw invalid();while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];
  if(marker===217){if(!scan||offset!==bytes.length)throw invalid();parts.push(bytes.subarray(start,offset));ended=true;break;}
  if(marker===0||marker===216||marker>=208&&marker<=215)throw invalid();
  const length=bytes[offset]*256+bytes[offset+1];if(!Number.isFinite(length)||length<2||offset+length>bytes.length)throw invalid();
  if([192,193,194].includes(marker)){
   if(length<8)throw invalid();const height=bytes[offset+3]*256+bytes[offset+4],width=bytes[offset+5]*256+bytes[offset+6];
   if(!width||!height||width>1280||height>1280)throw new HttpError(400,'Ảnh gửi lên cần có cạnh dài tối đa 1280 pixel. Hãy chọn lại ảnh.');dimensions=true;
  }
  if(!(marker>=224&&marker<=239)&&marker!==254)parts.push(bytes.subarray(start,offset+length));
  offset+=length;
  if(marker===218){
   if(!dimensions)throw invalid();scan=true;const entropyStart=offset;
   while(offset<bytes.length){
    if(bytes[offset]!==255){offset++;continue}
    const next=bytes[offset+1];
    if(next===0||next>=208&&next<=215){offset+=2;continue}
    break;
   }
   parts.push(bytes.subarray(entropyStart,offset));
  }
 }
 if(!ended)throw invalid();const output=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){output.set(p,at);at+=p.length}return output;
}
async function submission(req:Request,userId:string,flow:'legacy'|'sorting'|'product'){
 if(!req.headers.get('content-type')?.startsWith('multipart/form-data'))throw new HttpError(415,'Vui lòng gửi ảnh từ chức năng chụp/tải ảnh.');
 const raw=await boundedBody(req,(flow==='product'?6:2)*1024*1024+20000);
 let form:FormData;try{form=await new Response(raw,{headers:{'Content-Type':req.headers.get('content-type')!}}).formData()}catch{throw new HttpError(400,'Không đọc được ảnh gửi lên.')}
 if(form.getAll('consent').length!==1||form.get('consent')!=='openai')throw new HttpError(400,'Vui lòng xác nhận gửi ảnh tới OpenAI để nhận diện.');
 if(form.getAll('requestKey').length!==1)throw new HttpError(400,'Mã yêu cầu không hợp lệ.');
 if(flow==='product'&&(form.getAll('mode').length!==1||form.get('mode')!=='product'||[...form.keys()].some(k=>!['image','requestKey','consent','mode'].includes(k))))throw new HttpError(400,'Yêu cầu đọc nhãn không hợp lệ.');
 const key=str(form.get('requestKey'),100),files=form.getAll('image');
 if(!files.length||files.length>(flow==='product'?3:1))throw new HttpError(400,'Chọn từ 1 đến 3 ảnh của cùng một tình huống.');
 const images:Uint8Array[]=[];
 for(const file of files){if(!(file instanceof File)||file.type!=='image/jpeg')throw new HttpError(400,'Ảnh gửi lên không đúng định dạng. Hãy chọn lại ảnh.');images.push(cleanJPEG(new Uint8Array(await file.arrayBuffer())));}
 const hashes=await Promise.all(images.map(async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))).map(x=>x.toString(16).padStart(2,'0')).join('')));
 if(new Set(hashes).size!==hashes.length)throw new HttpError(400,'Có ảnh trùng nhau. Hãy giữ mỗi góc chụp một ảnh.');
 let manifest:Uint8Array;
 if(flow==='product')manifest=new TextEncoder().encode(JSON.stringify({version:3,userId,flow,images:hashes}));
 else{const userBytes=new TextEncoder().encode(userId);manifest=new Uint8Array(userBytes.length+images[0].length);manifest.set(userBytes);manifest.set(images[0],userBytes.length);}
 const imageHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(manifest)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 return {key,image:images[0],images,imageHash};
}
export async function recognitionResult(userId:string,id:string,ms=Date.now()){
 await recoverPending(ms);const row=await statement('SELECT * FROM ai_requests WHERE id=? AND user_id=?',id,userId).first<any>();
 if(!row)throw new HttpError(404,'Không tìm thấy kết quả của bạn.');
 const result=row.status==='pending'?{status:'pending',message:'Ảnh đang được xử lý. Không gửi lại yêu cầu.'}:JSON.parse(row.result_json||'{"status":"error","message":"Không có kết quả để xem lại."}');
 if([2,3].includes(result.schemaVersion)&&result.ruleVersion!==SORTING_VERSION){result.status='no_guidance';result.message='Quy tắc đã cập nhật. Hãy kiểm tra và xác nhận lại từng phần.';result.ruleVersion=SORTING_VERSION;}
 // A guide can be withdrawn after recognition. Never revive unpublished advice.
 if(result.candidate){const current=guide(await statement('SELECT * FROM content WHERE id=?',result.candidate.id).first<any>());if(!current||current.version!==result.candidate.version||current.group!==result.candidate.group||current.name!==result.candidate.name){result.status='no_guidance';result.candidate=null;result.message='Hướng dẫn đã thay đổi hoặc không còn được xuất bản. Hãy chọn lại vật phẩm thủ công.';}}
 return {...result,requestId:row.id,quota:await quota(userId,ms)};
}
// Testable orchestration; only the production wrapper below is exposed by routes.
// Tests inject a mock HTTP transport into the real provider, never a public mode flag.
export async function runRecognition(req:Request,userId:string,provider:ImageProvider,clock=Date.now,trial=false,flow:'legacy'|'sorting'|'product'='legacy'){
 const {key,image,images,imageHash}=await submission(req,userId,flow),ms=clock();
 const previous=await requestRow(userId,key);
 if(previous){if(previous.image_hash!==imageHash)throw new HttpError(409,'Mã yêu cầu đã gắn với ảnh khác.');return recognitionResult(userId,previous.id,ms);}
 const catalog=flow!=='legacy'?SORTING_RULES.map(r=>({id:r.id,name:r.name,group:r.group||'unknown',description:r.scope})):await reviewedCatalog();
 if(!catalog.length)throw new HttpError(409,'Kho chưa có hướng dẫn vật phẩm đã kiểm duyệt. Chưa gửi ảnh tới OpenAI và không trừ lượt.');
 const r=await reserve(userId,key,ms,imageHash,trial);
 if(r.reused)return recognitionResult(userId,r.id,clock());
 let result:any={status:'error',message:'Nhận diện gặp lỗi kỹ thuật. Không trừ lượt; bạn có thể thử lại.'};let outcome:Outcome='error',usage=estimatedUsage(r.reserve_vnd);
 try{
  if(trial&&clock()>=TRIAL_EXPIRES_AT){
   await settle(r.id,'error',{costVnd:0,model:'',inputTokens:0,outputTokens:0},clock(),{status:'error',message:'Đợt thử đã hết hạn trước khi gửi ảnh. Không gọi OpenAI và không trừ lượt.'});
   return recognitionResult(userId,r.id,clock());
  }
  const response=await provider({image,images,catalog,reservation:r.reserve_vnd});usage=response.usage;
  if(response.technicalError&&response.failureCode)result={...result,failureCode:response.failureCode,...(response.httpStatus?{httpStatus:response.httpStatus}:{})};
  if(!response.technicalError&&response.product&&flow==='product'){result=productResult(response.product);outcome=result.status;}
  else if(!response.technicalError&&response.scene&&flow==='sorting'){result=sceneResult(response.scene);outcome=result.status;}
  else if(!response.technicalError&&response.identification&&flow==='legacy'){
   const v=response.identification;
   if(!v.identified||v.confidence<0.85||!v.item_name.trim()||!GROUPS.includes(v.group as any)){
    outcome='unknown';result={status:'unknown',message:'Chưa xác định chắc chắn vật phẩm. Không trừ lượt. Hãy chụp rõ một vật phẩm hoặc tra cứu thủ công.'};
   }else{
    const exact=v.match==='exact'&&catalog.find(x=>x.id===v.matched_item_id&&x.group===v.group&&normalize(x.name)===normalize(v.item_name));
    const current=exact?guide(await statement('SELECT * FROM content WHERE id=?',exact.id).first<any>()):null;
    const candidate=current&&current.group===v.group&&normalize(current.name)===normalize(v.item_name)?current:null;
    outcome=candidate?'success':'no_guidance';
    result={status:outcome,identification:{name:v.item_name,group:v.group},candidate,message:candidate?'Đây là gợi ý nhận diện. Hãy xác nhận hoặc chọn lại trước khi xem hướng dẫn.':'Đã nhận diện sơ bộ nhưng chưa có hướng dẫn được kiểm duyệt phù hợp. Không tự ghép sang vật phẩm khác và không trừ lượt.'};
   }
  }
 }catch{/* Never log an image, provider body, exception message, or key. */}
 await settle(r.id,outcome,usage,clock(),result);
 return recognitionResult(userId,r.id,clock());
}
export async function recognizeImage(req:Request,userId:string){
 if(!LIVE_OPENAI_ENABLED){const q=await quota(userId);if(!q.trial?.available)throw new HttpError(503,q.trial?.message||AI_DISABLED_MESSAGE);}
 const key=runtime().OPENAI_API_KEY;if(typeof key!=='string'||!key)throw new HttpError(503,'Nhận diện AI chưa sẵn sàng. Bạn vẫn có thể tra cứu thủ công.');
 return runRecognition(req,userId,productAIProvider(key),Date.now,!LIVE_OPENAI_ENABLED,'product');
}
export async function confirmRecognition(userId:string,id:string,itemId:string,expectedVersion:number){
 const row=await statement('SELECT * FROM ai_requests WHERE id=? AND user_id=?',id,userId).first<any>();
 if(!row||!['success','no_guidance'].includes(row.status))throw new HttpError(409,'Kết quả chưa sẵn sàng để xác nhận.');
 const item=guide(await statement('SELECT * FROM content WHERE id=?',itemId).first<any>());if(!item)throw new HttpError(409,'Vật phẩm chưa có hướng dẫn được kiểm duyệt và xuất bản.');
 if(item.version!==expectedVersion)throw new HttpError(409,'Hướng dẫn đã thay đổi. Hãy tải lại và kiểm tra trước khi xác nhận.');
 const prior=await statement('SELECT item_id FROM history WHERE recognition_id=? AND user_id=?',id,userId).first<any>();
 if(prior){if(prior.item_id!==itemId)throw new HttpError(409,'Kết quả này đã được xác nhận với vật phẩm khác. Bạn có thể tra cứu thủ công.');return {itemId:prior.item_id}}
 const r=JSON.parse(row.result_json||'{}'),method=r.candidate?.id===itemId?'AI · đã xác nhận':'AI · người dùng chọn lại';
 // Recheck eligibility inside the write: an admin may withdraw a guide concurrently.
 await statement("INSERT INTO history(id,user_id,item_id,method,created_at,recognition_id) SELECT ?,?,?,?,?,? FROM content WHERE id=? AND version=? AND kind='items' AND published=1 AND verified=1 AND TRIM(source)!='' AND json_valid(payload) AND TRIM(COALESCE(json_extract(payload,'$.steps'),''))!='' ON CONFLICT(recognition_id) DO NOTHING",crypto.randomUUID(),userId,itemId,method,Date.now(),id,itemId,expectedVersion).run();
 const saved=await statement('SELECT item_id FROM history WHERE recognition_id=? AND user_id=?',id,userId).first<any>();
 if(!saved||saved.item_id!==itemId)throw new HttpError(409,'Hướng dẫn vừa thay đổi hoặc kết quả đã được xác nhận. Hãy tải lại.');
 return {itemId:saved.item_id};
}
