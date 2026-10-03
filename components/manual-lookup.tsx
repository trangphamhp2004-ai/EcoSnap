'use client';
import React,{useRef,useState} from 'react';
import {Search,GlassWater,Package,Newspaper,ShoppingBag,Leaf,Shirt,Cpu,Shapes,Pencil} from 'lucide-react';
import {interpretManual,resolveManual,manualQuestions,validManual,manualAnswerLabel,OBJECT_FAMILIES,type ManualKind,type Answers} from '../lib/manual-lookup';
import {SortingPicker,sortingRequest} from './sorting-flow';
import {SORTING_VERSION} from '../lib/sorting-rules';
const familyIcons=[GlassWater,Package,Newspaper,ShoppingBag,Leaf,Shirt,Cpu,Shapes];
export default function ManualLookup({onDone}:{onDone:(id:string)=>void}){
 const [text,setText]=useState(''),[kind,setKind]=useState<ManualKind|null>(null),[answers,setAnswers]=useState<Answers>({}),[inferred,setInferred]=useState<Answers>({}),[editing,setEditing]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[kept,setKept]=useState(false),[revision,setRevision]=useState(0);
 const requestKey=useRef(''),lock=useRef(false);
 function begin(input:string,family?:ManualKind){if(lock.current)return;const r=family?{kind:family,answers:{}}:interpretManual(input);setText(input);setKind(r.kind);setAnswers(r.answers);setInferred(r.answers);setEditing([]);setError('');setKept(false);requestKey.current='';setRevision(n=>n+1)}
 function answer(field:string,value:string){if(lock.current)return;setError('');setAnswers(a=>({...a,[field]:value}));requestKey.current='';setKept(false)}
 const questions=kind?manualQuestions(kind,answers):[];
 const known=questions.filter(q=>inferred[q.field]&&answers[q.field]===inferred[q.field]&&!editing.includes(q.field));
 const pending=questions.filter(q=>!known.includes(q));
 const ready=!!kind&&validManual(kind,answers);
 async function build(){if(!kind||!ready||lock.current)return;const r=resolveManual(kind,answers);if(r.keep){setKept(true);return;}lock.current=true;setBusy(true);setError('');if(!requestKey.current)requestKey.current=crypto.randomUUID();try{const result=await sortingRequest('sorting',{manual:{kind,answers},version:SORTING_VERSION,key:requestKey.current,confirmed:true});onDone(result.id)}catch(e){setError(e instanceof Error?e.message:'Chưa mở được kết quả. Hãy thử lại.')}finally{lock.current=false;setBusy(false)}}
 return <>
  <form className="manual-search" onSubmit={e=>{e.preventDefault();begin(text)}}>
   <label htmlFor="manual-phrase">Tên đồ vật và tình trạng</label>
   <div className="search"><Search size={20}/><input id="manual-phrase" maxLength={300} disabled={busy} placeholder="Ví dụ: lọ serum thủy tinh, hộp bánh còn kem…" value={text} onChange={e=>setText(e.target.value)}/></div>
   <button className="primary" disabled={busy||!text.trim()}>Tra cứu thủ công</button>
  </form>
  <div className="scenario-list">{['Lọ serum thủy tinh','Hộp bánh gato còn bánh','Khăn giấy dính thức ăn','Chai nước còn nguyên'].map(s=><button className="secondary" key={s} disabled={busy} onClick={()=>begin(s)}>{s}</button>)}</div>
  {!kind?<><p className="family-caption">Hoặc chọn loại đồ vật — chưa cần biết thuộc nhóm rác nào.</p><div className="object-families">{OBJECT_FAMILIES.map((f,i)=>{const Icon=familyIcons[i];return <button className="card object-family" key={f.kind} onClick={()=>begin('',f.kind)}><span className={'icon pastel p'+i}><Icon size={25}/></span><span><strong>{f.name}</strong><small>{f.example}</small></span></button>})}</div></>:<button className="text" disabled={busy} onClick={()=>{setKind(null);setAnswers({});setInferred({});setKept(false);setError('');requestKey.current=''}}>Chọn đồ vật khác</button>}
  {kind&&kind!=='catalog'&&<div className="card manual-questions">
   <h2>{kind==='cake'?'Hộp bánh':kind==='tissue'?'Khăn giấy':OBJECT_FAMILIES.find(f=>f.kind===kind)?.name}</h2>
   {known.length>0&&<div className="known-facts"><p>Thông tin từ mô tả của bạn</p>{known.map(q=><div key={q.field}><span>{manualAnswerLabel(q.field,answers[q.field])}</span><button className="text" disabled={busy} aria-label={'Sửa: '+manualAnswerLabel(q.field,answers[q.field])} onClick={()=>setEditing(e=>[...e,q.field])}><Pencil size={15}/>Sửa</button></div>)}</div>}
   {pending.length>0&&<p>Chọn thêm thông tin còn thiếu. Bạn có thể chọn “Chưa rõ”.</p>}
   {pending.map(q=><fieldset className="manual-question" key={q.field}><legend>{q.title}</legend><div className="answer-options">{q.options.map(([value,label])=><label className={answers[q.field]===value?'selected':''} key={value}><input type="radio" disabled={busy} name={'manual-'+q.field} value={value} checked={answers[q.field]===value} onChange={()=>answer(q.field,value)}/><span>{label}</span></label>)}</div></fieldset>)}
   {(kind==='bottle'||kind==='container'&&answers.use==='personal')&&answers.intent!=='keep'&&['food','personal'].includes(answers.use)&&<label className="checkbox accessory-choice"><input type="checkbox" disabled={busy} checked={answers.accessory==='yes'} onChange={e=>answer('accessory',e.target.checked?'yes':'no')}/><span>Thêm nắp, vòi bơm hoặc phụ kiện cần phân loại riêng<small>Không tự coi phụ kiện cùng chất liệu với thân chai.</small></span></label>}
   {answers.remaining==='remains'&&answers.use==='personal'&&<p className="part-warning">Phần mỹ phẩm dư sẽ có bước kiểm tra riêng. Chưa đổ bỏ hoặc rửa khi chưa có hướng dẫn phù hợp.</p>}
   {(answers.wrapper==='dirty-paper'||answers.paperType==='dirty-paper'||answers.wrapper==='laminated'||answers.paperType==='laminated')&&<p className="part-warning">Không cần rửa giấy. Giấy bẩn hoặc có lớp phủ được kiểm tra riêng với giấy sạch.</p>}
   {ready&&pending.length===0&&<p>Kiểm tra thông tin trên rồi mở hướng dẫn. Có thể bấm “Sửa” nếu mô tả chưa đúng.</p>}
   <button className="primary full" disabled={busy||!ready} onClick={build}>{busy?'Đang mở hướng dẫn…':'Xem cách tách và phân loại'}</button>
  </div>}
  {kept&&<div className="notice">Bạn chọn giữ lại sử dụng nếu sản phẩm còn phù hợp. Chưa tạo rác để phân loại và không trừ lượt.</div>}
  {error&&<p className="warning" role="alert">{error}</p>}
  {kind==='catalog'&&<><p className="notice">Chọn phần phù hợp với đồ vật và tình trạng. Nếu chưa rõ, chọn “Đồ vật chưa đủ thông tin” để xem bước kiểm tra tiếp.</p><SortingPicker key={'catalog-'+revision} initialQuery={text} onDone={onDone}/></>}
 </>
}
