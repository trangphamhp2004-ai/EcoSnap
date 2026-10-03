import {database,statement,periods} from './database';
import {HttpError} from './auth';
import {RESERVE_SQL,TRIAL_RESERVE_SQL,FAILURE_SQL,SETTLE_SQL} from './quota-sql';
import {LIVE_OPENAI_ENABLED,DAILY_LIMIT,MONTHLY_LIMIT,BUDGET_CAP_VND,MIN_RESERVE_VND,PENDING_TTL_MS,WARNING_VND,ADMIN_TRIAL_ENABLED,TRIAL_ID,TRIAL_EXPIRES_AT,TRIAL_CALL_LIMIT,TRIAL_BUDGET_VND} from './ai-policy';
export type Outcome='success'|'unknown'|'no_guidance'|'error';
export type Usage={costVnd:number;model:string;inputTokens:number;outputTokens:number;estimated?:boolean;responseId?:string};
export async function getSettings(){
 await statement("INSERT INTO settings(id) VALUES('main') ON CONFLICT(id) DO NOTHING").run();
 const s=await statement("SELECT * FROM settings WHERE id='main'").first<any>();
 return {...s,daily_limit:DAILY_LIMIT,monthly_limit:MONTHLY_LIMIT,budget_vnd:Math.min(s.budget_vnd,BUDGET_CAP_VND),reserve_vnd:Math.max(s.reserve_vnd,MIN_RESERVE_VND)};
}
export async function recoverPending(ms=Date.now()){
 // An interrupted paid attempt may have incurred cost. Free the user's slot,
 // but retain the entire reservation as estimated spend; never dispatch it again.
 await statement("UPDATE ai_requests SET status='error',cost_vnd=reserve_vnd,cost_estimated=1,completed_at=?,result_json=? WHERE status='pending' AND created_at<=?",ms,JSON.stringify({status:'error',message:'Yêu cầu đã hết thời gian xử lý. Không trừ lượt; bạn có thể thử lại bằng yêu cầu mới.'}),ms-PENDING_TTL_MS).run();
}
export async function budgetState(ms=Date.now()){
 await recoverPending(ms);const s=await getSettings(),{month}=periods(ms);
 const b=await statement("SELECT COALESCE(SUM(cost_vnd),0) cost,COALESCE(SUM(CASE WHEN status='pending' THEN reserve_vnd ELSE 0 END),0) reserved,COALESCE(SUM(CASE WHEN cost_estimated=1 THEN cost_vnd ELSE 0 END),0) estimated,COUNT(*) requests,COALESCE(SUM(CASE WHEN status='success' THEN 1 ELSE 0 END),0) successes FROM ai_requests WHERE month=?",month).first<any>();
 return {...b,limit:s.budget_vnd,reservePerRequest:s.reserve_vnd,warning:b.cost+b.reserved>=WARNING_VND[1]?WARNING_VND[1]:b.cost+b.reserved>=WARNING_VND[0]?WARNING_VND[0]:0,available:b.cost+b.reserved+s.reserve_vnd<=s.budget_vnd};
}
export async function trialState(userId:string,ms=Date.now()){
 const u=await statement('SELECT role FROM users WHERE id=?',userId).first<any>();
 if(u?.role!=='admin')return null;
 const s=await getSettings();
 const t=await statement("SELECT COUNT(*) attempts,COALESCE(SUM(cost_vnd),0) cost,COALESCE(SUM(CASE WHEN status='pending' THEN reserve_vnd ELSE 0 END),0) reserved,COALESCE(SUM(CASE WHEN cost_estimated=1 THEN cost_vnd ELSE 0 END),0) estimated FROM ai_requests WHERE trial_run_id=?",TRIAL_ID).first<any>();
 const remaining=Math.max(0,TRIAL_CALL_LIMIT-t.attempts);
 const available=ADMIN_TRIAL_ENABLED&&ms<TRIAL_EXPIRES_AT&&remaining>0&&t.cost+t.reserved+s.reserve_vnd<=TRIAL_BUDGET_VND;
 const message=!ADMIN_TRIAL_ENABLED?'Đợt thử AI đã đóng.':ms>=TRIAL_EXPIRES_AT?'Đã hết thời gian thử AI.':!remaining?'Đợt thử đã dùng đủ 5 lần gọi.':t.cost+t.reserved+s.reserve_vnd>TRIAL_BUDGET_VND?'Ngân sách đợt thử không đủ dự phòng cho yêu cầu mới.':'Thử AI cho quản trị: tối đa 5 lần gọi và 20.000 đ; tính cả lỗi và chưa xác định.';
 return {...t,id:TRIAL_ID,limit:TRIAL_CALL_LIMIT,remaining,budget:TRIAL_BUDGET_VND,expiresAt:TRIAL_EXPIRES_AT,available,message};
}
export async function quota(userId:string,ms=Date.now()){
 await recoverPending(ms);const {day,month}=periods(ms);
 const [counts,u,b,t]=await Promise.all([
  statement("SELECT COALESCE(SUM(CASE WHEN status='success' AND day=? THEN 1 ELSE 0 END),0) dayUsed,COALESCE(SUM(CASE WHEN status='success' THEN 1 ELSE 0 END),0) monthUsed,COALESCE(SUM(CASE WHEN status='pending' AND day=? THEN 1 ELSE 0 END),0) dayPending,COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) monthPending FROM ai_requests WHERE user_id=? AND month=?",day,day,userId,month).first<any>(),
  statement('SELECT cooldown_until FROM users WHERE id=?',userId).first<any>(),budgetState(ms),trialState(userId,ms)]);
 const active=await statement("SELECT id FROM ai_requests WHERE user_id=? AND status='pending'",userId).first<any>();
 return {...counts,dayLimit:DAILY_LIMIT,monthLimit:MONTHLY_LIMIT,bonus:0,cooldownUntil:u?.cooldown_until||0,day,month,aiEnabled:LIVE_OPENAI_ENABLED||!!t?.available,aiMessage:t?.message,trial:t,budgetAvailable:b.available,processing:!!active,activeRequestId:active?.id||null};
}
export async function requestRow(userId:string,key:string){return statement('SELECT * FROM ai_requests WHERE user_id=? AND request_key=?',userId,key).first<any>()}
export async function reserve(userId:string,key:string,ms=Date.now(),imageHash='',trial=false){
 if(!/^[\w-]{16,100}$/.test(key))throw new HttpError(400,'Mã yêu cầu không hợp lệ.');
 await recoverPending(ms);await getSettings();
 const reuse=(r:any)=>{if((r.image_hash||'')!==imageHash)throw new HttpError(409,'Mã yêu cầu đã gắn với ảnh khác. Hãy chọn lại ảnh.');return {...r,reused:true}};
 const existing=await requestRow(userId,key);if(existing)return reuse(existing);
 const {day,month}=periods(ms),id=crypto.randomUUID();
 if(trial&&!ADMIN_TRIAL_ENABLED)throw new HttpError(503,'Đợt thử AI đã đóng.');
 const args=[id,userId,key,day,month,MIN_RESERVE_VND,ms,imageHash,...(trial?[TRIAL_ID]:[]),userId,ms,day,month,month,MIN_RESERVE_VND,...(trial?[ms,TRIAL_EXPIRES_AT,TRIAL_ID,TRIAL_CALL_LIMIT,TRIAL_ID,MIN_RESERVE_VND,TRIAL_BUDGET_VND]:[])];
 const row=await statement(trial?TRIAL_RESERVE_SQL:RESERVE_SQL,...args).first<any>();
 if(row)return {...row,reused:false};
 const duplicate=await requestRow(userId,key);if(duplicate)return reuse(duplicate);
 const active=await statement("SELECT * FROM ai_requests WHERE user_id=? AND status='pending'",userId).first<any>();
 if(active)throw new HttpError(409,'Một ảnh đang được xử lý trên tài khoản này. Hãy chờ kết quả trước khi gửi tiếp.');
 const q=await quota(userId,ms);
 if(trial&&!q.trial?.available)throw new HttpError(429,q.trial?.message||'Đợt thử chỉ dành cho tài khoản quản trị.');
 if(q.cooldownUntil>ms)throw new HttpError(429,'Ba lần chưa xác định liên tiếp. Vui lòng nghỉ 10 phút.');
 if(q.dayUsed>=DAILY_LIMIT)throw new HttpError(429,'Bạn đã dùng hết 5 lượt có kết quả hôm nay.');
 if(q.monthUsed>=MONTHLY_LIMIT)throw new HttpError(429,'Bạn đã dùng hết 20 lượt có kết quả trong tháng.');
 throw new HttpError(429,'Ngân sách AI khả dụng không đủ cho yêu cầu mới. Bạn vẫn có thể tra cứu thủ công.');
}
export async function settle(id:string,outcome:Outcome,usage:Usage,ms=Date.now(),result:unknown={status:'error'}){
 if(!['success','unknown','no_guidance','error'].includes(outcome)||![usage.costVnd,usage.inputTokens,usage.outputTokens].every(x=>Number.isSafeInteger(x)&&x>=0))throw new Error('Invalid trusted provider result');
 await recoverPending(ms);
 await database().batch([statement(FAILURE_SQL,outcome,ms,outcome,outcome,id),statement(SETTLE_SQL,outcome,usage.costVnd,usage.model,usage.inputTokens,usage.outputTokens,ms,JSON.stringify(result),usage.estimated?1:0,usage.responseId||null,id)]);
}
