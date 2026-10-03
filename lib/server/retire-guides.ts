import {database,statement} from './database';
import {HttpError} from './auth';
// Owner requested replacing this exact legacy knowledge set on 2026-10-03.
// Fixed IDs and versions ensure this action can never erase new guidance.
const legacy=[{"id":"4a05158f-5643-459d-8ee7-a5d13262d028","version":2},{"id":"4cd3b4f6-ab53-4922-92bc-1f6e54b4f079","version":2},{"id":"6a5c956b-0faa-4b98-bd34-5c6b5e686c8a","version":2},{"id":"6f4904cb-d194-484b-ba8d-701b7d28af17","version":2},{"id":"733d405b-550b-40b1-80e2-3d491f04e689","version":2},{"id":"756a8e97-57fc-4b89-ab15-b6246245782d","version":2},{"id":"85c5c90c-9dfc-4765-bcf8-7513458613a0","version":2},{"id":"b537341c-7547-4651-a53e-d1cea506da5a","version":2},{"id":"b5fb3f29-b471-44a6-a779-8dbe6d22ad99","version":2},{"id":"b8487a4d-9ff0-4caa-b75b-a094dea1a613","version":2},{"id":"bf3bcaaf-c472-472d-ab38-b5d25d5d362d","version":2},{"id":"e9435c4e-3ca9-4434-9873-9232cd4ac60c","version":2},{"id":"e9fa6e5e-8cee-49c2-9edb-b840662c00a0","version":2},{"id":"ea36397e-bd64-4013-bd70-1b1883b02194","version":2},{"id":"group-0","version":1},{"id":"group-1","version":1},{"id":"group-2","version":1},{"id":"group-3","version":1},{"id":"group-4","version":1},{"id":"group-5","version":1},{"id":"group-6","version":1},{"id":"group-7","version":1}];
const marks=legacy.map(()=>'?').join(',');
export async function legacyGuideStatus(){
 const rows=await statement('SELECT id,version,title FROM content WHERE id IN ('+marks+')',...legacy.map(r=>r.id)).all<any>();
 return {count:rows.results.length,changed:rows.results.some(r=>legacy.find(x=>x.id===r.id)?.version!==r.version)};
}
export async function retireGuides(actorId:string,confirmed:boolean){
 if(confirmed!==true)throw new HttpError(400,'Chưa xác nhận thay kho hướng dẫn cũ.');
 const status=await legacyGuideStatus();if(status.changed)throw new HttpError(409,'Nội dung cũ vừa được chỉnh sửa. Chưa xóa để tránh mất thay đổi mới.');if(!status.count)return {removed:0};
 const changed=legacy.map(()=>'(id=? AND version!=?)').join(' OR ');
 const ids=legacy.map(r=>r.id);
 // A single conditional DELETE is atomic. References created meanwhile prevent
 // deletion through foreign keys; account/history/settings/cost rows are untouched.
 const deletion=statement('DELETE FROM content WHERE id IN ('+marks+') AND NOT EXISTS (SELECT 1 FROM content WHERE '+changed+')',...ids,...legacy.flatMap(r=>[r.id,r.version]));
 try{
  await database().batch([deletion,statement("INSERT INTO audit(id,actor_id,action,target,details,created_at) SELECT ?,?,'content.retire_legacy','legacy-2026-10-03',?,? WHERE changes()>0",crypto.randomUUID(),actorId,JSON.stringify({requestedCount:status.count}),Date.now())]);
 }catch{throw new HttpError(409,'Có lịch sử hoặc nội dung thay đổi liên quan đến kho cũ. Chưa xóa dữ liệu liên quan.');}
 const remaining=await legacyGuideStatus();if(remaining.count)throw new HttpError(409,'Kho cũ đã thay đổi đồng thời. Hãy tải lại để kiểm tra.');
 return {removed:status.count};
}
