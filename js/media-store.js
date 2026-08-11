const DB_NAME='ourLifeOS-media'; const STORE_NAME='visionMedia'; const DB_VERSION=1;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable.'));
  return new Promise((resolve,reject)=>{ const request=indexedDB.open(DB_NAME,DB_VERSION); request.onupgradeneeded=()=>{ const db=request.result; if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME,{keyPath:'id'}); }; request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); });
}

async function transact(mode,work) { const db=await openDatabase(); return new Promise((resolve,reject)=>{ const tx=db.transaction(STORE_NAME,mode); const result=work(tx.objectStore(STORE_NAME)); tx.oncomplete=()=>{db.close();resolve(result?.result)}; tx.onerror=()=>{db.close();reject(tx.error)}; }); }

export async function resizeVisionImage(file,{maxDimension=1600,quality=.82}={}) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('Choose a supported image file.');
  if (!globalThis.document) return file;
  let image; let release=()=>{};
  try {
    if(globalThis.createImageBitmap) image=await createImageBitmap(file,{imageOrientation:'from-image'});
    else { const url=URL.createObjectURL(file);release=()=>URL.revokeObjectURL(url);image=await new Promise((resolve,reject)=>{const element=new Image();element.onload=()=>resolve(element);element.onerror=reject;element.src=url;}); }
  } catch { release();throw new Error('This image could not be decoded. Try a JPEG, PNG, or WebP file.'); }
  const sourceWidth=image.width||image.naturalWidth;const sourceHeight=image.height||image.naturalHeight;const scale=Math.min(1,maxDimension/Math.max(sourceWidth,sourceHeight)); const width=Math.max(1,Math.round(sourceWidth*scale)); const height=Math.max(1,Math.round(sourceHeight*scale));
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height; canvas.getContext('2d',{alpha:false}).drawImage(image,0,0,width,height); image.close?.();release();
  const type=file.type==='image/png'?'image/png':'image/webp'; const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,quality)); if(!blob) throw new Error('Image compression failed.'); return blob;
}

export function createMemoryMediaStore(seed=[]) {
  const records=new Map(seed.map(item=>[item.id,item]));
  return { async put(record){records.set(record.id,record);return record},async get(id){return records.get(id)||null},async delete(id){records.delete(id)},async list(){return [...records.values()]},async usage(){const rows=[...records.values()];return {count:rows.length,bytes:rows.reduce((sum,row)=>sum+(row.blob?.size||0),0)}},async clear(){records.clear()} };
}

export const mediaStore = {
  async put(record){ if(!record?.id||!(record.blob instanceof Blob))throw new Error('Invalid media record.'); await transact('readwrite',store=>store.put(record)); return record; },
  async get(id){ const result=await transact('readonly',store=>store.get(id)); return result||null; },
  async delete(id){ await transact('readwrite',store=>store.delete(id)); },
  async list(){ const result=await transact('readonly',store=>store.getAll()); return result||[]; },
  async usage(){ const rows=await this.list(); const estimate=globalThis.navigator?.storage?.estimate?await navigator.storage.estimate():{};return {count:rows.length,bytes:rows.reduce((sum,row)=>sum+(row.blob?.size||0),0),browserUsage:estimate.usage||null,quota:estimate.quota||null}; },
  async clear(){ await transact('readwrite',store=>store.clear()); }
};

const bytesToBase64 = bytes => { let binary=''; const chunk=0x8000; for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk)); return btoa(binary); };
export async function exportMediaRecords(adapter=mediaStore) { const rows=await adapter.list(); return Promise.all(rows.map(async row=>({id:row.id,type:row.blob.type,createdAt:row.createdAt,altText:row.altText||'',data:bytesToBase64(new Uint8Array(await row.blob.arrayBuffer()))}))); }
export async function importMediaRecords(rows,adapter=mediaStore) { for(const row of rows||[]){ const binary=atob(row.data||''); const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0)); await adapter.put({id:row.id,blob:new Blob([bytes],{type:row.type||'image/webp'}),createdAt:row.createdAt,altText:row.altText||''}); } }
