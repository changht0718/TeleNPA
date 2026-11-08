/* NEMA authenticated cloud sync. Audio is persisted in private Supabase Storage, not a public URL. */
(()=>{'use strict';
const A=window.TeleNPAAuth;
const $=id=>document.getElementById(id);
const report=(message)=>{for(const id of ['cloudStatus','interludeCloudStatus','finishCloudStatus']){const el=$(id);if(el)el.textContent=message}};
const uid=()=>A?.user()?.id;
const stableUUID=()=>crypto.randomUUID();
const iso=()=>new Date().toISOString();
const upsert=async(table,record)=>A.request('/rest/v1/'+table+'?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(record)});
let inProgress=false;
async function syncOne(state,entry,loadAudio,persist){
 const user=uid();if(!user)throw Error('未登入 Supabase；資料僅保存在本機');
 state.cloud_run_ids??={};state.cloud_run_ids[entry.phase]??=stableUUID();
 entry.cloud_id??=stableUUID();persist();
 const runId=state.cloud_run_ids[entry.phase];
 const session=state.battery_id||null;
 // Create/update the parent run first, because responses reference it.
 await upsert('test_runs',{
  id:runId,owner_id:user,battery_session_id:session,test_id:'story',test_version:'pilot-v4',
  mode:'formal',condition:entry.phase,status:state.phase==='finished'?'completed':'in_progress',
  started_at:state.created_at,ended_at:state.phase==='finished'?iso():null,source_record_id:state.id
 });
 let path=entry.cloud_audio_path||null;
 if(entry.recording_id&&entry.recorded){
  const blob=await loadAudio(entry.recording_id);
  if(!blob)throw Error('找不到原始音檔，請先下載本機備份');
  path=path||`${user}/${state.id}/${entry.phase}/${entry.story}-${entry.cloud_id}.${blob.type.includes('mp4')?'m4a':'webm'}`;
  await A.uploadAudio(path,blob);
  entry.cloud_audio_path=path;
 }
 await upsert('nema_responses',{
  id:entry.cloud_id,owner_id:user,battery_session_id:session,test_run_id:runId,
  story_id:entry.story,phase:entry.phase,stimulus_version:'pilot-v1',
  audio_path:path,audio_mime:entry.recording_type||null,audio_bytes:entry.recording_bytes||null,
  edited_transcript:entry.transcript||null,asr_transcript:entry.asr_transcript||null,
  marks:entry.marks||[],rubric_version:'pilot-v1',recorded_at:entry.recorded_at||null,updated_at:iso()
 });
 entry.synced_at=iso();
 return true;
}
async function sync(state,loadAudio,persist){
 if(inProgress)return false;
 if(!A?.isLoggedIn()){report('未登入 Supabase，錄音與評分仍僅保存在本機；請返回首頁登入後再同步');return false}
 inProgress=true;report('正在同步 NEMA 錄音與評分至私人雲端儲存空間…');
 let ok=0;
 try{
  for(const e of Object.values(state.entries||{})){
   if(!e.played&&!e.recorded&&!(e.transcript||'').trim())continue;
   await syncOne(state,e,loadAudio,persist);
   persist();ok++;
  }
  report('雲端同步成功：'+ok+' 段回憶已保存（錄音僅登入擁有人可存取）');
  return true;
 }catch(err){report('雲端同步尚未完成：'+err.message+'。本機資料仍保留，請重試。');return false}
 finally{inProgress=false}
}
window.NEMACloud={sync,report,isLoggedIn:()=>!!A?.isLoggedIn()};
A?.restore().then(()=>{report(A.isLoggedIn()?'已登入，可同步私人錄音':'未登入，請先在 TeleNPA 首頁登入')});
})();
