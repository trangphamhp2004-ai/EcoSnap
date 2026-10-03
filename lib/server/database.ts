import {env} from 'cloudflare:workers';
export function runtime(){return env as unknown as Record<string,any>}
export function database():D1Database{const db=runtime().DB;if(!db)throw new Error('STORAGE_UNAVAILABLE');return db}
export function bucket():R2Bucket{const b=runtime().BUCKET;if(!b)throw new Error('STORAGE_UNAVAILABLE');return b}
export function statement(sql:string,...args:any[]){return database().prepare(sql).bind(...args)}
export const now=()=>Date.now();
export function periods(ms=Date.now()){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));return {day,month:day.slice(0,7)}}
