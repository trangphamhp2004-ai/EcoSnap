import {normalizeSearch} from './sorting-rules';
export const KNOWLEDGE_REVISION='2026-10-03';
export function sourceLinks(source:string){return [...new Set((source||'').match(/https:\/\/[^\s<>"\]]+/g)||[])].flatMap(raw=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?[{url:u.href,label:u.hostname.replace(/^www\./,'')}]:[]}catch{return []}})}
export function knowledgeExpired(row:any,now=Date.now()){return /^\d{4}-\d{2}-\d{2}$/.test(row.validUntil||'')&&now>=Date.parse(row.validUntil+'T23:59:59+07:00')}
export function relatedReading(rows:any[],ids:string[],now=Date.now()){
 return rows.filter(r=>r.kind==='articles'&&r.published&&r.verified&&!knowledgeExpired(r,now)&&String(r.relatedRules||'').split(',').some(id=>ids.includes(id.trim()))).slice(0,6);
}
export function filterPoints(rows:any[],query:string,area:string,program:string){const q=normalizeSearch(query),d=normalizeSearch(area);return rows.filter(p=>normalizeSearch([p.name,p.title,p.materials,p.address,p.program,p.conditions].join(' ')).includes(q)&&normalizeSearch(p.district+' '+p.address).includes(d)&&(!program||p.program===program))}
