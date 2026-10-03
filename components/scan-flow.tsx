'use client';
import {ProductConfirmation} from './product-label';
import {SortingPicker} from './sorting-flow';
import React,{useEffect,useRef,useState} from 'react';
import {Camera,Upload,ScanLine,Check,Search} from 'lucide-react';
type Item={id:string;name:string;group:string;steps?:string;verified?:boolean;published?:boolean;source?:string;version:number};
type Quota={aiEnabled:boolean;aiMessage?:string;trial?:{attempts:number;limit:number;cost:number;reserved:number;budget:number;message:string};dayUsed:number;dayPending:number;monthUsed:number;monthPending:number;dayLimit:number;monthLimit:number;cooldownUntil:number;budgetAvailable:boolean;processing:boolean};
type Result={status:string;requestId:string;message:string;identification?:{name:string;group:string};candidate?:Item;quota:Quota;schemaVersion?:number;components?:{name:string;rule_id:string|null;confidence:number}[]};
type Props={items:Item[];quota:Quota|null;quotaView:React.ReactNode;onQuota:(q:Quota)=>void;onConfirmed:(id:string)=>Promise<void>;onManual:()=>void;onSorted:(id:string)=>void};
export default function ScanFlow({items,quota,quotaView,onQuota,onConfirmed,onManual,onSorted}:Props){
 const [decoding,setDecoding]=useState(false),[sent,setSent]=useState(false);
 const [photos,setPhotos]=useState<{url:string;blob:Blob}[]>([]),[camera,setCamera]=useState(false),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null),[selected,setSelected]=useState(''),[editing,setEditing]=useState(false),[search,setSearch]=useState(''),[clock,setClock]=useState(Date.now());
 const input=useRef<HTMLInputElement>(null),video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),photoRef=useRef<{url:string;blob:Blob}[]>([]),decodeLock=useRef(false),key=useRef(''),lock=useRef(false),alive=useRef(true);
 const quotaCallback=useRef(onQuota);quotaCallback.current=onQuota;
 useEffect(()=>{const refresh=()=>{if(document.visibilityState!=='visible')return;fetch('/api/ecosnap/me',{credentials:'same-origin'}).then(r=>r.json()).then((m:any)=>{if(alive.current&&m.quota)quotaCallback.current(m.quota)}).catch(()=>{})};const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[]);
 const stopCamera=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCamera(false)};
 useEffect(()=>{alive.current=true;const t=setInterval(()=>setClock(Date.now()),1000);return()=>{alive.current=false;clearInterval(t);stream.current?.getTracks().forEach(t=>t.stop());photoRef.current.forEach(p=>URL.revokeObjectURL(p.url))}},[]);
 useEffect(()=>{if(camera&&video.current&&stream.current){video.current.srcObject=stream.current;video.current.play().catch(()=>setError('Không phát được camera. Hãy tải ảnh lên.'))}},[camera]);
 function resetRequest(){setConsent(false);setResult(null);setSent(false);setError('');key.current=crypto.randomUUID()}
 async function loadPhotos(files:File[]){
  if(!files.length||lock.current||decodeLock.current)return;
  if(photoRef.current.length+files.length>3){setError('Mỗi lần dùng tối đa 3 ảnh của cùng một tình huống.');return;}
  decodeLock.current=true;setDecoding(true);setError('');const added:{url:string;blob:Blob}[]=[];
  try{
   for(const f of files){
    if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>10*1024*1024)throw Error('Chọn ảnh JPG, PNG hoặc WEBP, tối đa 10 MB mỗi ảnh.');
    const bitmap=await createImageBitmap(f),scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height)),c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=c.getContext('2d');if(!ctx){bitmap.close();throw Error()}
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
    const blob=await new Promise<Blob|null>(resolve=>c.toBlob(resolve,'image/jpeg',.85));if(!blob||blob.size>2*1024*1024)throw Error();
    added.push({url:URL.createObjectURL(blob),blob});
   }
   if(!alive.current){added.forEach(p=>URL.revokeObjectURL(p.url));return;}
   photoRef.current=[...photoRef.current,...added];setPhotos(photoRef.current);resetRequest();setSelected('');setEditing(false);stopCamera();
  }catch(e){added.forEach(p=>URL.revokeObjectURL(p.url));setError(e instanceof Error&&e.message?e.message:'Không đọc được ảnh. Vui lòng chọn ảnh khác.');}finally{decodeLock.current=false;if(alive.current)setDecoding(false)}
 }
 function removePhoto(index:number){if(lock.current||decodeLock.current)return;URL.revokeObjectURL(photoRef.current[index].url);photoRef.current=photoRef.current.filter((_,i)=>i!==index);setPhotos(photoRef.current);resetRequest()}
 async function startCamera(){try{setError('');const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});if(!alive.current){s.getTracks().forEach(t=>t.stop());return}stream.current?.getTracks().forEach(t=>t.stop());stream.current=s;setCamera(true)}catch{setError('Không mở được camera hoặc quyền truy cập bị từ chối. Bạn có thể tải ảnh lên.')}}
 function capture(){const v=video.current;if(!v?.videoWidth)return;const c=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(v.videoWidth,v.videoHeight));c.width=Math.round(v.videoWidth*scale);c.height=Math.round(v.videoHeight*scale);c.getContext('2d')?.drawImage(v,0,0,c.width,c.height);c.toBlob(b=>{if(b)void loadPhotos([new File([b],'camera.jpg',{type:'image/jpeg'})])},'image/jpeg',.85)}
 async function request(path:string,init?:RequestInit){const r=await fetch('/api/ecosnap/'+path,{credentials:'same-origin',...init});const data:any=await r.json();if(!r.ok)throw Error(data.error||'Không tải được kết quả.');return data}
 const apply=(r:Result)=>{if(!alive.current)return;setResult(r);onQuota(r.quota);setSelected(r.candidate?.id||'');setEditing(!r.candidate)};
 async function recognize(){
  if(lock.current||decoding||!photos.length||!consent)return;lock.current=true;setBusy(true);setError('');setSent(true);
  try{const f=new FormData();photos.forEach((p,i)=>f.append('image',p.blob,'image-'+(i+1)+'.jpg'));f.set('mode','product');f.set('requestKey',key.current);f.set('consent','openai');let r:Result=await request('recognize',{method:'POST',body:f});apply(r);
   // Poll only an already admitted request; never replay a paid provider attempt.
   for(let i=0;r.status==='pending'&&i<18&&alive.current;i++){await new Promise(resolve=>setTimeout(resolve,2000));r=await request('recognition?id='+encodeURIComponent(r.requestId));apply(r)}
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Không nhận được phản hồi. Bấm lại để lấy kết quả của cùng yêu cầu.');try{const m=await request('me');if(m.quota)onQuota(m.quota)}catch{}}
  finally{lock.current=false;if(alive.current)setBusy(false)}
 }
 async function refreshResult(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{apply(await request(result?'recognition?id='+encodeURIComponent(result.requestId):'recognition?key='+encodeURIComponent(key.current)))}catch(e){setError(e instanceof Error?e.message:'Không tải được kết quả.');setSent(false)}finally{lock.current=false;setBusy(false)}}
 async function confirm(){if(!result||!selected||lock.current)return;lock.current=true;setBusy(true);setError('');try{const r=await request('recognition/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:result.requestId,itemId:selected,version:(result.candidate?.id===selected?result.candidate:items.find(i=>i.id===selected))?.version})});await onConfirmed(r.itemId)}catch(e){setError(e instanceof Error?e.message:'Chưa xác nhận được vật phẩm.')}finally{lock.current=false;if(alive.current)setBusy(false)}}
 const wait=Math.max(0,Math.ceil(((quota?.cooldownUntil||0)-clock)/1000));
 const blocked=!quota?.aiEnabled?(quota?.aiMessage||'AI đang tắt, chờ duyệt thử nghiệm'):wait?`Vui lòng chờ ${Math.floor(wait/60)}:${String(wait%60).padStart(2,'0')}`:!quota.budgetAvailable?'Ngân sách AI tạm hết':quota.processing?'Một yêu cầu đang được xử lý':quota.dayUsed+quota.dayPending>=quota.dayLimit?'Đã hết lượt hôm nay':quota.monthUsed+quota.monthPending>=quota.monthLimit?'Đã hết lượt tháng này':'';
 const options=items.filter(i=>i.verified&&i.published&&i.source?.trim()&&i.steps?.trim()&&(`${i.name} ${i.group}`).toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN')));
 return <section className="section narrow"><div className="page-title"><div className="eyebrow">Phân loại bằng ảnh</div><h1>Chụp món đồ. Đọc nhãn. Phân loại rõ hơn.</h1></div><div className="progress"><i className="on"/><i className={result?'on':''}/><i/></div>
  <div className="notice"><ScanLine size={18}/><span>{quota?.aiEnabled?'AI đọc nhãn và gợi ý từng phần. Bạn xác nhận sản phẩm trước khi xem hướng dẫn đã kiểm duyệt.':(quota?.aiMessage||'Nhận diện AI đang tắt, chờ duyệt thử nghiệm ảnh thật. Chụp/tải ảnh và xem trước vẫn dùng được; ảnh chưa được gửi tới OpenAI.')}</span></div>{quota?.trial&&<div className="notice"><span>{quota.trial.message} Đã tiếp nhận {quota.trial.attempts}/{quota.trial.limit} yêu cầu; chi phí và dự phòng {new Intl.NumberFormat('vi-VN').format(quota.trial.cost+quota.trial.reserved)}/{new Intl.NumberFormat('vi-VN').format(quota.trial.budget)} đ.</span></div>}{quotaView}
  <div className="card photo-guide"><strong>Một tình huống · tối đa 3 ảnh</strong><p>Ảnh 1: toàn bộ món đồ và phần còn bên trong. Có thể thêm ảnh nhãn sản phẩm và mã ở đáy bao bì. Không cần thêm ảnh nếu nhãn đã rõ.</p><small>Chỉ một lần nhận diện cho cả bộ ảnh. Không chụp thông tin riêng tư trên nhãn giao hàng.</small></div>
  <div className="upload-box">{camera?<><video ref={video} autoPlay playsInline muted/><button className="primary" disabled={decoding} onClick={capture}><Camera/>Chụp ảnh</button><button className="text" onClick={stopCamera}>Đóng camera</button></>:<>
  {!!photos.length&&<div className="photo-grid">{photos.map((p,i)=><figure key={p.url}><img src={p.url} alt={'Ảnh '+(i+1)+' bạn chọn'}/><figcaption>Ảnh {i+1}{i===0?' · toàn cảnh':''}<button className="text" disabled={busy||decoding} onClick={()=>removePhoto(i)} aria-label={'Bỏ ảnh '+(i+1)}>Bỏ ảnh</button></figcaption></figure>)}</div>}
  {!photos.length&&<><span className="icon"><Camera size={34}/></span><h3>Chụp hoặc tải ảnh lên</h3><p>Đủ sáng, chữ trên nhãn rõ và không bị lóa.</p></>}
  {photos.length<3&&<div className="actions"><button className="primary" disabled={busy||decoding} onClick={startCamera}><Camera/>Mở camera</button><button className="secondary" disabled={busy||decoding} onClick={()=>input.current?.click()}><Upload/>{photos.length?'Thêm ảnh nhãn / mã':'Tải ảnh lên'}</button></div>}<small>JPG, PNG, WEBP · Tối đa 10 MB mỗi ảnh</small></>}</div>
  <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{void loadPhotos(Array.from(e.target.files||[]));e.target.value=''}}/>
  {!!photos.length&&<div className="card spaced"><label className="checkbox"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>Tôi đồng ý gửi {photos.length} ảnh tới OpenAI khi bấm “Nhận diện ảnh”.</label><p>EcoSnap chỉ xử lý ảnh tạm thời, không lưu ảnh vào kho dữ liệu hay nhật ký. Ảnh được thu nhỏ và bỏ thông tin EXIF trước khi gửi. Kết quả giữ lại tên sản phẩm và thông tin cần cho phân loại, không giữ toàn bộ chữ trên nhãn.</p><small>OpenAI xử lý ảnh theo <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer">chính sách dữ liệu của OpenAI</a>. Không gửi ảnh có thông tin riêng tư không cần thiết.</small></div>}
  {error&&<div className="warning" role="alert">{error}</div>}
  {!result&&<button className="primary full" onClick={sent?refreshResult:recognize} disabled={busy||decoding||(!sent&&(!!blocked||!photos.length||!consent))}><ScanLine/>{busy?'Đang nhận diện…':decoding?'Đang chuẩn bị ảnh…':sent?'Lấy lại kết quả · không gửi ảnh lần nữa':blocked||'Nhận diện ảnh'}</button>}
  {result&&<div className="card spaced" role="status"><h2>{result.status==='success'?'Kiểm tra các phần cần tách':result.status==='no_guidance'?'Chưa có hướng dẫn phù hợp':result.status==='pending'?'Đang xử lý ảnh':result.status==='unknown'?'Chưa xác định được':'Chưa nhận diện được'}</h2><p>{result.message}</p>
   {result.identification&&<p>Gợi ý AI: <strong>{result.identification.name}</strong> · {result.identification.group}</p>}
   {!result.schemaVersion&&['success','no_guidance'].includes(result.status)&&<>{result.candidate&&!editing?<><p>Hướng dẫn phù hợp: <strong>{result.candidate.name}</strong> · {result.candidate.group}</p><button className="text" onClick={()=>{setEditing(true);setSelected('')}}>Không đúng, chọn lại vật phẩm</button></>:<div className="form"><label>Tìm vật phẩm trong kho đã kiểm duyệt<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tên vật phẩm hoặc nhóm"/></label><label>Vật phẩm bạn xác nhận<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Chọn vật phẩm phù hợp</option>{options.map(i=><option key={i.id} value={i.id}>{i.name} · {i.group}</option>)}</select></label><p>Chỉ chọn khi tên và chất liệu phù hợp với vật phẩm của bạn. Không có lựa chọn phù hợp thì tra cứu thủ công hoặc gửi góp ý.</p></div>}<button className="primary" disabled={!selected||busy} onClick={confirm}><Check/>Xác nhận và xem hướng dẫn</button></>}
   {result.status==='pending'?<button className="secondary" disabled={busy} onClick={refreshResult}>Kiểm tra kết quả · không trừ thêm lượt</button>:<button className="text" disabled={busy} onClick={()=>{setResult(null);setError('');setSent(false);key.current=crypto.randomUUID()}}>Nhận diện lại</button>}
  </div>}
  {result?.schemaVersion===3&&['success','no_guidance','unknown'].includes(result.status)&&<ProductConfirmation onBusyChange={v=>{lock.current=v;setBusy(v)}} key={result.requestId} result={result} onDone={onSorted}/>}
  {result?.schemaVersion===2&&result.components&&<SortingPicker key={result.requestId} observations={result.components} recognitionId={result.requestId} onDone={onSorted}/>}
  <button className="text center" onClick={onManual}><Search size={16}/>Nhập tên để phân loại · không trừ lượt</button>
 </section>;
}
