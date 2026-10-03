export const PRODUCT_VERSION=1;
export const MATERIAL_CODES=['PET 1','HDPE 2','PVC 3','LDPE 4','PP 5','PS 6','OTHER 7','GL','ALU','unknown'] as const;
export const PACKAGE_FORMS=['bottle','jar','tube','refill','other','unknown'] as const;
export type ProductContext={version:number;brand:string;productName:string;variant:string;packageForm:typeof PACKAGE_FORMS[number];materialCode:typeof MATERIAL_CODES[number];remaining:'empty'|'remains'|'unknown';warning:'present'|'none'|'unknown'};
export const EMPTY_PRODUCT:ProductContext={version:PRODUCT_VERSION,brand:'',productName:'',variant:'',packageForm:'unknown',materialCode:'unknown',warning:'unknown',remaining:'unknown'};
// Store only short product descriptors, never full OCR, contact details or label photos.
export function safeLabel(value:unknown):value is string{return typeof value==='string'&&value.length<=100&&!/[\u0000-\u001f<>@]|https?:|www\.|data:|(?:\d[\s()+.-]*){8,}/i.test(value)}
export function validProductContext(v:any):v is ProductContext{return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===8&&v.version===PRODUCT_VERSION&&safeLabel(v.brand)&&safeLabel(v.productName)&&safeLabel(v.variant)&&PACKAGE_FORMS.includes(v.packageForm)&&MATERIAL_CODES.includes(v.materialCode)&&['empty','remains','unknown'].includes(v.remaining)&&['present','none','unknown'].includes(v.warning)}
export function cleanProductContext(v:ProductContext):ProductContext{return {version:PRODUCT_VERSION,brand:v.brand.normalize('NFC').trim(),productName:v.productName.normalize('NFC').trim(),variant:v.variant.normalize('NFC').trim(),packageForm:v.packageForm,materialCode:v.materialCode,warning:v.warning,remaining:v.remaining}}
export const packageNames:Record<string,string>={bottle:'Chai',jar:'Lọ / hũ',tube:'Tuýp',refill:'Túi nạp lại',other:'Bao bì khác',unknown:'Chưa rõ'};
// Applies only to the AI confirmation flow. Manual questions and rules are unchanged.
export function productSelections(ids:string[],p:ProductContext){
 const shells=['bottle','glass','glass-broken','metal','unknown-container'];
 if(p.warning==='present')return ids.length?['hazardous']:[];
 if(ids.some(id=>shells.includes(id))&&p.remaining!=='empty'&&!ids.some(id=>['product-residue','drink-residue','unknown-liquid','food','hazardous'].includes(id)))return [...new Set([...ids,'unknown-liquid'])].sort();
 return [...new Set(ids)].sort();
}
