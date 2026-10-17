import React, { useEffect, useState } from "react";

type Preview = {
 preview_digest: string;
 backup_digest: string;
 approval_token?: string;
 modules: {key:string;action:string;reason:string;data:unknown}[];
 catalog: { notes: string[]; mappings: unknown[]; source_ref: string };
};
function SourceValues({data}:{data:unknown}) {
 const rows=Array.isArray(data)?data:[data];
 return <div className="mt-3 space-y-3">{rows.map((row,index)=><dl key={index} className="space-y-2 rounded-md border border-slate-200 p-3">{Object.entries(row as Record<string,unknown>).filter(([key,value])=>key!=="id"&&key!=="is_active"&&value!=="").map(([key,value])=><div key={key}><dt className="text-xs font-semibold capitalize text-slate-500">{key.replaceAll("_"," ")}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-sm text-slate-700">{String(value)}</dd></div>)}</dl>)}</div>;
}
const approval = "IMPORT EXISTING CONTENT AS DRAFTS";
export default function ContentImportPanel({onImported,blocked,onBusy}:{onImported:()=>void;blocked:boolean;onBusy:(busy:boolean)=>void}) {
 const [preview,setPreview]=useState<Preview|null>(null);
 const [token,setToken]=useState("");
 const [approved,setApproved]=useState(false);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{onBusy(busy);return ()=>onBusy(false)},[busy,onBusy]);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 async function request(path:string,body?:unknown) {
  const response=await fetch("/api/admin/site-content-import/"+path,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",headers:body?{"Content-Type":"application/json","X-Admin-Request":"1"}:{},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||"Import request failed.");
  return result;
 }
 async function review(backup=false) {
  setBusy(true);setError("");setNotice("");setToken("");setApproved(false);
  try {
   const result=await request(backup?"backup":"preview");setPreview(result);
   if(backup){
    const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="electrofix-content-backup.json";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setToken(result.approval_token);setNotice("Backup downloaded. Review the preview and retain the file before approving. Approval expires in 15 minutes.");
   }
  }catch(e){setError(e instanceof Error?e.message:"Preview failed.")}finally{setBusy(false)}
 }
 async function apply() {
  if(!approved||!token)return;
  setBusy(true);setError("");setNotice("");
  try{const result=await request("apply",{approval,approval_token:token});setToken("");setApproved(false);setPreview(null);setNotice(`${result.imported.length} modules imported as drafts. ${result.skipped.length} preserved. Review and publish each module when ready.`);onImported();}
  catch(e){setToken("");setApproved(false);setError(e instanceof Error?e.message:"Import failed.")}finally{setBusy(false)}
 }
 return <section className="mt-6 space-y-4 rounded-lg border border-[#DCE3E8] bg-white p-5 sm:p-6" aria-label="Existing content import">
  <div><h2 className="text-lg font-bold">Import existing website content</h2><p className="mt-1 text-sm text-slate-500">Preview existing content, download a backup, then approve importing untouched modules as drafts. Existing edits and publications are preserved.</p></div>
  {error&&<p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  {notice&&<p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
  <div className="flex flex-wrap gap-2"><button disabled={busy||blocked} onClick={()=>void review()} className="rounded-md border border-[#004179] px-4 py-2.5 text-sm font-bold text-[#004179] disabled:opacity-50">{busy?"Working…":"Preview import"}</button>{preview&&<button disabled={busy||blocked} onClick={()=>void review(true)} className="rounded-md border border-[#004179] px-4 py-2.5 text-sm font-bold text-[#004179] disabled:opacity-50">Download backup for approval</button>}</div>
  {preview&&<div className="space-y-3">
   {preview.modules.map(item=><details key={item.key} className="rounded-md border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">{item.key.replaceAll("_"," ")} — {item.action==="skip"?"Preserve existing content":"Import as draft"}</summary><p className="mt-2 text-xs text-slate-500">{item.reason}</p>{item.action!=="skip"&&<SourceValues data={item.data}/>}</details>)}
   <details className="rounded-md border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Source mapping and limitations</summary>{preview.catalog.notes.map(note=><p key={note} className="mt-2 text-xs text-slate-500">{note}</p>)}<pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(preview.catalog.mappings,null,2)}</pre></details>
   {token&&<div className="space-y-3"><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={busy||blocked} checked={approved} onChange={e=>setApproved(e.target.checked)}/>I retained the backup and approve importing the previewed content as drafts into this environment.</label><button disabled={busy||blocked||!approved||!preview.modules.some(item=>item.action==="import-draft")} onClick={()=>void apply()} className="rounded-md bg-[#004179] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Approve draft import</button></div>}
  </div>}
 </section>;
}
