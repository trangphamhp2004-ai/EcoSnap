import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ProductConfirmation} from '../components/product-label';
import {SortingResult} from '../components/sorting-flow';
import ManualLookup from '../components/manual-lookup';
import '../app/globals.css';
function Fixture(){
 const [result,setResult]=useState<any>(null),[id,setId]=useState(''),[manual,setManual]=useState(false);
 useEffect(()=>{fetch('/fixture').then(r=>r.json()).then(setResult)},[]);
 return <><div className="prototype">KIỂM THỬ GIẢ LẬP · DỮ LIỆU RIÊNG · KHÔNG GỌI OPENAI</div><header><strong>EcoSnap · Kiểm thử</strong><button className="secondary" onClick={()=>{setManual(true);setId('')}}>Tra cứu thủ công</button><button className="secondary" onClick={()=>{setManual(false);setId('')}}>Xác nhận nhãn giả lập</button></header>{id?<SortingResult id={id} onBack={()=>setId('')} onSuggestions={()=>{}}/>:<section className="section narrow">{manual?<ManualLookup onDone={setId}/>:result?<ProductConfirmation result={result} onDone={setId}/>:<p>Đang chuẩn bị dữ liệu kiểm thử…</p>}</section>}</>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
