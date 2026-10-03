import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import {createRequire} from 'node:module';
// Test-only loopback server. Uses the isolated backend-test DB, real UI components
// and real backend handlers. It cannot contact OpenAI or production storage.
export async function start({temp,call,clear,db,base,policy}){
 const require=createRequire(import.meta.url),esbuild=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite/package.json'))]}));
 await esbuild.build({entryPoints:['tests/ui-entry.tsx'],bundle:true,outfile:path.join(temp,'ui.js'),format:'esm',jsx:'automatic',external:['/hero.png'],define:{'process.env.NODE_ENV':'"development"'}});
 clear();db.exec('DELETE FROM sorting_results; DELETE FROM rate_limits');
 const ai=await import(path.join(temp,'lib/server/recognition.js')),provider=await import(path.join(temp,'lib/server/ai-provider.js'));
 const observation={identified:true,multiple_products:false,brand:'Cocoon',product_name:'Sữa rửa mặt sen Hậu Giang',variant:'500 ml',label_photo:1,package_form:'bottle',warning:'none',components:[{role:'body',name:'Thân chai nhựa',rule_id:'bottle',confidence:.97,material_code:'PET 1',photo_index:1}]};
 const jpeg=new Uint8Array([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]);
 const f=new FormData();f.set('mode','product');f.set('consent','openai');f.set('requestKey','ui-fixture-product-0001');f.set('image',new File([jpeg],'test.jpg',{type:'image/jpeg'}));
 const result=await ai.runRecognition(new Request('https://ecosnap.trangphamhp2004.chatgpt.site/api/ecosnap/recognize',{method:'POST',body:f}),'a',provider.productAIProvider('FAKE_UI_KEY',async()=>Response.json({model:policy.AI_MODEL,status:'completed',usage:{input_tokens:2400,output_tokens:700},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(observation)}]}]})),()=>base,false,'product');
 const server=http.createServer(async(req,res)=>{try{
  const pathname=req.url||'/';
  if(pathname==='/fixture'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return}
  if(pathname.startsWith('/api/ecosnap/')){let raw='';for await(const part of req)raw+=part;const response=await call(pathname.slice('/api/ecosnap/'.length),{method:req.method,user:'a',...(raw?{body:JSON.parse(raw)}:{})});res.statusCode=response.status;res.setHeader('Content-Type','application/json');res.end(await response.text());return}
  if(pathname==='/ui.js'||pathname==='/ui.css'){res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(temp,pathname.slice(1))));return}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EcoSnap · Kiểm thử giả lập riêng</title><link rel="stylesheet" href="/ui.css"><div id="root"></div><script type="module" src="/ui.js"></script></html>');
 }catch{res.statusCode=500;res.end('Test fixture error')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));console.log('Isolated UI fixture: http://127.0.0.1:'+server.address().port+'/');
 await new Promise(resolve=>{process.once('SIGINT',()=>server.close(resolve));process.once('SIGTERM',()=>server.close(resolve))});
}
