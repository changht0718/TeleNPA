/* Compatibility adapter: original NVCST localStorage keys and cloud table unchanged. */
(()=>{'use strict';
const A=window.TeleNPAAuth,$=id=>document.getElementById(id);
const DATA_KEY='ctt_research_v2_records',SYNC_KEY='ctt_cloud_synced_ids_v1';
const msg=s=>{$('cloudStatus').textContent=s};let busy=false;
const records=()=>{try{const x=JSON.parse(localStorage.getItem(DATA_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}};
const synced=()=>{try{return new Set(JSON.parse(localStorage.getItem(SYNC_KEY)||'[]'))}catch{return new Set()}};
const pending=()=>records().filter(x=>!synced().has(x.record_id));
const selectedSession=()=>{try{return JSON.parse(localStorage.getItem('telenpa_battery_active_v2')||'null')}catch{return null}};
function status(note=''){const u=A.user();msg((u?'已登入：'+u.email:'尚未登入')+'｜待上傳 '+pending().length+' 筆'+(note?'｜'+note:''));$('cloudLogout').disabled=!u}
async function login(){try{await A.login($('cloudEmail').value.trim(),$('cloudPassword').value);$('cloudPassword').value='';status('登入成功');await sync()}catch(e){status('登入失敗：'+e.message)}}
async function sync(){if(busy)return;if(!A.isLoggedIn()){status('請先登入');return}busy=true;$('cloudSync').disabled=true;let count=0;
try{for(const r of pending()){
 const payload={record_id:String(r.record_id),owner_id:A.user().id,participant_id:r.participant_id,session_id:r.session_id,part:r.part,mode:r.mode,status:r.status,started_at:r.started_at,ended_at:r.ended_at,duration_sec:r.duration_sec,error_count:r.error_count,raw:r};
 await A.request('/rest/v1/nvcst_records?on_conflict=record_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
 // Mark synced as soon as the original record is safely uploaded; optional Core bookkeeping cannot block it.
 const ids=synced();ids.add(r.record_id);localStorage.setItem(SYNC_KEY,JSON.stringify([...ids]));count++;
 try{const session=selectedSession();const match=session?.participant_id===r.participant_id && session?.session_id===r.session_id;
 await A.request('/rest/v1/test_runs?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:r.record_id,owner_id:A.user().id,battery_session_id:match?session.id:null,test_id:'nvcst',test_version:r.schema_version||'legacy',mode:r.mode,condition:r.condition||'unknown',status:r.status,started_at:r.started_at,ended_at:r.ended_at,source_record_id:r.record_id})});
 }catch(e){/* Core tables may not exist yet; original NVCST upload remains valid. */}
}status('成功同步 '+count+' 筆')}catch(e){status('同步未完成：'+e.message+'；原始資料仍保留於本機')}finally{busy=false;$('cloudSync').disabled=false}}
const quote=v=>'"'+String(v==null?'':typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')+'"';
const csv=(rows,cols)=>'\ufeff'+[cols.join(','),...rows.map(r=>cols.map(c=>quote(r[c])).join(','))].join('\r\n');
function dl(name,contents,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([contents],{type}));a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
async function exportCloud(){if(!A.isLoggedIn()){status('請先登入');return}try{let all=[];for(let offset=0;offset<=100000;offset+=500){const batch=await A.request('/rest/v1/nvcst_records?select=record_id,raw&order=started_at.asc&limit=500&offset='+offset);all.push(...batch);if(batch.length<500)break}const rs=all.map(x=>x.raw),stamp=new Date().toISOString().replace(/[:.]/g,'-');const summary=['schema_version','record_id','participant_id','session_id','part','task_name','condition','mode','status','started_at','ended_at','duration_sec','completed_targets','total_targets','error_count','summary'];dl('telenpa_cloud_summary_'+stamp+'.csv',csv(rs,summary),'text/csv;charset=utf-8');const events=rs.flatMap(r=>(r.events||[]).map(e=>({record_id:r.record_id,participant_id:r.participant_id,session_id:r.session_id,part:r.part,mode:r.mode,...e})));const eventCols=['record_id','participant_id','session_id','part','mode','trial_index','condition','rule','transition','set_size','target','options','correct_index','response_index','response','correct','rt_ms','pointer_type','timestamp_iso'];dl('telenpa_cloud_events_'+stamp+'.csv',csv(events,eventCols),'text/csv;charset=utf-8');dl('telenpa_cloud_full_'+stamp+'.json',JSON.stringify(rs,null,2),'application/json;charset=utf-8');status('下載雲端 '+rs.length+' 筆')}catch(e){status('匯出失敗：'+e.message)}}
window.NVCSTCloud={sync,pending};$('cloudLogin').onclick=login;$('cloudLogout').onclick=()=>{A.logout();status('已登出')};$('cloudSync').onclick=sync;$('cloudExport').onclick=exportCloud;
window.addEventListener('telenpa:auth',()=>status());window.addEventListener('ctt:recordSaved',()=>{status('新增紀錄');if(A.isLoggedIn())void sync()});window.addEventListener('online',()=>{if(A.isLoggedIn())void sync()});
$('clear').addEventListener('click',e=>{if(pending().length){e.stopImmediatePropagation();alert('仍有 '+pending().length+' 筆未同步，請先匯出完整 JSON 並補傳')}} ,true);
if(!A.configured())msg('請設定根目錄 config.js');else status();A.restore().then(()=>{status();if(A.isLoggedIn()&&pending().length)void sync()});
})();
