import {database,statement} from './database';
import {HttpError} from './auth';
import {KNOWLEDGE_REVISION,relatedReading} from '../knowledge';
import {KNOWLEDGE_PACK} from './knowledge-pack';
export async function knowledgePackStatus(){
 const rows=(await statement("SELECT id FROM content WHERE id LIKE 'eco-knowledge-20261003-%'").all<{id:string}>()).results;
 const existing=new Set(rows.map(r=>r.id));
 const missing=KNOWLEDGE_PACK.filter(r=>!existing.has(r.id));
 return {revision:KNOWLEDGE_REVISION,total:KNOWLEDGE_PACK.length,remaining:missing.length,installed:KNOWLEDGE_PACK.length-missing.length};
}
export async function importKnowledgePack(actor:string,revision:unknown){
 if(revision!==KNOWLEDGE_REVISION)throw new HttpError(409,'Kho nội dung đã thay đổi. Vui lòng tải lại trang.');
 const existing=new Set((await statement("SELECT id FROM content WHERE id LIKE 'eco-knowledge-20261003-%'").all<{id:string}>()).results.map(r=>r.id));
 const rows=KNOWLEDGE_PACK.filter(r=>!existing.has(r.id)).slice(0,20);
 if(rows.length)await database().batch([
  ...rows.map(r=>statement('INSERT INTO content(id,kind,title,group_name,payload,published,verified,source,updated_at) VALUES(?,?,?,?,?,1,1,?,?) ON CONFLICT(id) DO NOTHING',r.id,r.kind,r.title,'',JSON.stringify(r.payload),r.source,Date.now())),
  statement('INSERT INTO audit(id,actor_id,action,target,details,created_at) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),actor,'knowledge.import',KNOWLEDGE_REVISION,JSON.stringify({ids:rows.map(r=>r.id)}),Date.now())
 ]);
 return knowledgePackStatus();
}
export async function readingForRules(ids:string[]){
 const rows=(await statement("SELECT * FROM content WHERE kind='articles' AND published=1 AND verified=1 ORDER BY updated_at DESC,id").all<any>()).results.map(r=>({...JSON.parse(r.payload),id:r.id,title:r.title,kind:r.kind,published:true,verified:true}));
 return relatedReading(rows,ids).map(({id,title,summary})=>({id,title,summary}));
}
