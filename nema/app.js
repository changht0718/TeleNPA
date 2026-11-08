(()=>{'use strict';const $=id=>document.getElementById(id),ST=window.NEMA_STORIES;const KEY='telenpa_nema_prototype_v1';let state=null,recorder=null,chunks=[],stream=null,blobUrl=null,recognition=null,recBlob=null,recordSaving=false;
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){localStorage.setItem(KEY,JSON.stringify(state))}function load(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
function show(id){for(const x of ['setup','task','interlude','finish'])$(x).classList.toggle('hidden',x!==id)}
const pick=()=>state.selected;function current(){return state.selected[state.position]}
function entry(id,phase){const k=phase+':'+id;state.entries[k]??={story:id,phase,played:false,transcript:'',marks:[],recorded:false,recording_id:null};return state.entries[k]}
function note(s){$('taskStatus').textContent=s}
const cloudSync=()=>window.NEMACloud?.sync(state,fetchRecording,save)??Promise.resolve(false);
function render(){if(!state){show('setup');return}if(state.phase==='interlude'){show('interlude');renderInterval();return}if(state.phase==='finished'){show('finish');return}show('task');const id=current(),meta=ST[id],del=state.phase==='delayed',e=entry(id,state.phase);
 $('phaseLabel').textContent=(del?'NEMA-II · 延宕回憶':'NEMA-I · 立即回憶')+`｜第 ${state.position+1} / ${state.selected.length} 篇`; $('storyTitle').textContent=meta.title;
 $('bar').style.width=((state.position+1)/state.selected.length*100)+'%';
 $('stimulus').classList.toggle('hidden',del||e.played);$('recall').classList.toggle('hidden',!del&&!e.played);
 $('stimAudio').src=del?'':meta.audio;$('goRecall').disabled=!e.played;$('listenStatus').textContent='請播放完整故事。音檔結束後才能開始回憶。';
 $('recallPrompt').textContent=del?'請回憶先前聽過的這篇故事，盡量說出所有記得的內容。':'請說出剛才故事中所有記得的內容。';
 $('transcript').value=e.transcript||'';$('scoring').open=false;$('recPreview').classList.add('hidden');$('audioDownload').classList.add('hidden');$('recordStatus').textContent=e.recorded?'本段錄音已儲存於此裝置（可重新錄音）':'尚未錄音';$('record').disabled=false;$('stop').disabled=true;renderUnits(e);note('');
 if(e.recording_id)fetchRecording(e.recording_id).then(b=>{if(b&&state&&current()===id){releasePreview();blobUrl=URL.createObjectURL(b);$('recPreview').src=blobUrl;$('recPreview').classList.remove('hidden');$('audioDownload').href=blobUrl;$('audioDownload').download=`NEMA_${state.subject}_${id}_${state.phase}.webm`;$('audioDownload').classList.remove('hidden')}}).catch(()=>{});
}
function releasePreview(){if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=null}
function normalize(s){return String(s||'').replace(/[\s，。！？：、；,.!?;:「」『』]/g,'').replace(/臺/g,'台').toLowerCase()}
function renderUnits(e){const items=ST[e.story].units;$('units').innerHTML=items.map((u,i)=>`<div class="unit"><input type="checkbox" data-u="${i}" ${e.marks.includes(i)?'checked':''}><label>${String(i+1).padStart(2,'0')} · ${html(u[0])}</label></div>`).join('');$('units').querySelectorAll('input').forEach(x=>x.onchange=()=>{e.marks=[...$('units').querySelectorAll('input:checked')].map(x=>Number(x.dataset.u));$('score').textContent=e.marks.length+'/'+items.length;save()});$('score').textContent=e.marks.length+'/'+items.length}
function persistedTranscript(){const e=entry(current(),state.phase);e.transcript=$('transcript').value;save()}
$('transcript').addEventListener('change',persistedTranscript);
$('suggest').onclick=()=>{const e=entry(current(),state.phase),v=normalize($('transcript').value);e.transcript=$('transcript').value;e.marks=ST[e.story].units.flatMap((u,i)=>u.slice(1).some(key=>normalize(key)&&v.includes(normalize(key)))?[i]:[]);save();renderUnits(e);note('已以字串關鍵詞提供候選命中；不是正式自動語意評分。請逐項人工確認。')};
$('saveScore').onclick=async()=>{persistedTranscript();const ok=await cloudSync();note(ok?'已同步候選評分至雲端；正式給分仍需人工核對':'已保留本機資料，請檢查雲端同步提示。')};
$('start').onclick=()=>{const a=[];if($('daily').checked)a.push('A','B');if($('indigenous').checked)a.push('Ap','Bp');if(!a.length){alert('請至少勾選一組完整故事（A＋B 或 A′＋B′）。');return}const active=JSON.parse(localStorage.getItem('telenpa_battery_active_v2')||'null');state={schema:'nema-prototype-v1',id:crypto.randomUUID?.()||String(Date.now()),subject:active?.participant_id||'TEST',visit:active?.session_id||'V1',battery_id:active?.id||null,selected:a,delay_min:Number($('delay').value),phase:'immediate',position:0,entries:{},immediate_finished_at:null,created_at:new Date().toISOString(),protocol:JSON.parse(localStorage.getItem('telenpa_protocol_builder_v3')||'null')};save();render()};
$('stimAudio').onended=()=>{$('goRecall').disabled=false;$('listenStatus').textContent='故事播放完成。請進入口述回憶。'};
$('goRecall').onclick=()=>{entry(current(),'immediate').played=true;save();render()};
async function openDB(){return new Promise((ok,bad)=>{const q=indexedDB.open('TeleNPA_NEMA_Audio_v1',1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains('recordings'))q.result.createObjectStore('recordings')};q.onsuccess=()=>ok(q.result);q.onerror=()=>bad(q.error)})}
async function saveRecording(key,blob){const db=await openDB();return new Promise((ok,bad)=>{let t=db.transaction('recordings','readwrite'),r=t.objectStore('recordings').put(blob,key);r.onsuccess=()=>ok();r.onerror=()=>bad(r.error);t.oncomplete=()=>db.close()})}
async function fetchRecording(key){const db=await openDB();return new Promise((ok,bad)=>{let t=db.transaction('recordings','readonly'),r=t.objectStore('recordings').get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error);t.oncomplete=()=>db.close()})}
$('record').onclick=async()=>{try{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('此瀏覽器不支援麥克風錄音');stream=await navigator.mediaDevices.getUserMedia({audio:true});const types=['audio/mp4','audio/webm;codecs=opus','audio/webm'];let mime=types.find(x=>MediaRecorder.isTypeSupported?.(x))||'';recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=async()=>{recordSaving=true;stream?.getTracks().forEach(x=>x.stop());stream=null;try{recBlob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});const e=entry(current(),state.phase),key=state.id+':'+state.phase+':'+current();await saveRecording(key,recBlob);e.recorded=true;e.recording_id=key;e.recording_type=recBlob.type;e.recording_bytes=recBlob.size;e.recorded_at=new Date().toISOString();save();releasePreview();blobUrl=URL.createObjectURL(recBlob);$('recPreview').src=blobUrl;$('recPreview').classList.remove('hidden');$('audioDownload').href=blobUrl;$('audioDownload').download=`NEMA_${state.subject}_${current()}_${state.phase}.${recBlob.type.includes('mp4')?'m4a':'webm'}`;$('audioDownload').classList.remove('hidden');$('recordStatus').textContent='錄音已保存於本機，正在嘗試同步雲端…';void cloudSync();}catch(err){$('recordStatus').textContent='錄音儲存失敗：'+err.message}finally{recordSaving=false}};recorder.start(1000);$('recordStatus').textContent='● 正在錄音';$('recordStatus').className='recording';$('record').disabled=true;$('stop').disabled=false}catch(e){$('recordStatus').textContent='無法錄音：'+e.message}};
$('stop').onclick=()=>{if(recorder?.state==='recording')recorder.stop();$('record').disabled=false;$('stop').disabled=true;$('recordStatus').className='muted'};
$('asr').onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){note('此 Safari 不提供可用的 SpeechRecognition；錄音功能可獨立使用，請在施測後人工轉錄。');return}try{recognition=new SR();recognition.lang='zh-TW';recognition.continuous=true;recognition.interimResults=false;recognition.onresult=e=>{let s='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)s+=e.results[i][0].transcript+' ';$('transcript').value+=s;persistedTranscript()};recognition.onerror=e=>note('語音辨識失敗：'+e.error+'；請人工核對。');recognition.onend=()=>note('語音辨識已結束。請人工檢查逐字稿。');recognition.start();note('語音辨識嘗試啟動；可能使用外部服務，不要用於正式敏感資料。')}catch(e){note('語音辨識無法啟動：'+e.message)}};
$('next').onclick=async()=>{if(recorder?.state==='recording'||recordSaving){note('請先停止錄音，並等候本機保存完成。');return}persistedTranscript();if(!entry(current(),state.phase).recorded&&!confirm('這段尚未完成錄音，確定在測試模式下略過？'))return;const synced=await cloudSync();if(!synced&&!confirm('錄音／評分尚未成功同步雲端，離開後本機資料仍保留。是否以測試模式繼續？'))return;if(state.position+1<state.selected.length){state.position++;save();render();return}if(state.phase==='immediate'){state.immediate_finished_at=Date.now();state.phase='interlude';state.position=0;state.nvcst_finished=false;save();render();autoLaunchIntervening()}else{state.phase='finished';state.finished_at=new Date().toISOString();save();render();void cloudSync()}};
function middleSteps(){const steps=state.protocol?.steps||['nema:immediate','nvcst','nema:delayed'];const a=steps.indexOf('nema:immediate'),b=steps.indexOf('nema:delayed');if(a<0||b<=a)return [];return steps.slice(a+1,b).filter(x=>x==='nvcst')}
function nvcstUrl(){const c=state.protocol?.parts?.nvcst||['motor','search','maintain','switch'];return '../nvcst/?conditions='+encodeURIComponent(c.join(','))+'&return=nema&nema_id='+encodeURIComponent(state.id)}
function autoLaunchIntervening(){if(!state||state.phase!=='interlude'||state.nvcst_started||!middleSteps().includes('nvcst'))return;state.nvcst_started=true;save();sessionStorage.setItem('telenpa_prefill_v2',JSON.stringify({participant_id:state.subject,session_id:state.visit}));location.assign(nvcstUrl())}
function renderInterval(){
 const target=state.immediate_finished_at+state.delay_min*60000,ms=target-Date.now();
 $('targetMinutes').textContent=state.delay_min;
 $('countdown').textContent=ms>0?`${Math.floor(ms/60000)} 分 ${String(Math.floor(ms%60000/1000)).padStart(2,'0')} 秒`:'已達預定間隔';
 const hasNVCST=middleSteps().includes('nvcst');
 $('nvcstLink').classList.toggle('hidden',!hasNVCST||state.nvcst_finished);
 $('nvcstLink').href=nvcstUrl();
 $('attemptDelay').disabled=ms>0||(hasNVCST&&!state.nvcst_finished);
 $('interludeStatus').textContent=hasNVCST?(state.nvcst_finished?'NVCST 已完成，可在延宕時間達標後進行 NEMA-II。':'須先完成 NVCST；如果中途關閉，請由此重新開啟。'):'目前沒有其他已實作測驗可接續，請等待預定延宕時間。';
}
$('attemptDelay').onclick=()=>{if(Date.now()<state.immediate_finished_at+state.delay_min*60000||(middleSteps().includes('nvcst')&&!state.nvcst_finished)){renderInterval();return}state.actual_delay_seconds=Math.round((Date.now()-state.immediate_finished_at)/1000);state.phase='delayed';state.position=0;save();render()};
for(const id of ['syncCloud','interludeSync','finishSync'])$(id).onclick=()=>{if(state)void cloudSync()};
$('export').onclick=()=>{const data={...state,exported_at:new Date().toISOString(),warning:'Pilot only: browser ASR and keyword matches are not clinically validated. Raw audio separate in IndexedDB.'};const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=`NEMA_${state.subject}_${state.visit}_${state.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
const active=JSON.parse(localStorage.getItem('telenpa_battery_active_v2')||'null');if(active)$('participantView').textContent=`受試者 ${active.participant_id}｜施測 ${active.session_id}`;const proto=JSON.parse(localStorage.getItem('telenpa_protocol_builder_v3')||'null');if(proto?.delay_target_minutes)$('delay').value=String(proto.delay_target_minutes);
state=load();if(state?.schema!=='nema-prototype-v1')state=null;
const returnParams=new URLSearchParams(location.search);
if(state?.phase==='interlude'&&returnParams.get('resume')==='nvcst'&&returnParams.get('nema_id')===state.id){
 const needed=state.protocol?.parts?.nvcst||['motor','search','maintain','switch'];
 let results=[];try{results=JSON.parse(localStorage.getItem('ctt_research_v2_records')||'[]')}catch{}
 const completed=needed.every(condition=>results.some(r=>r.condition===condition && r.mode==='formal' && r.status==='completed' && r.participant_id===state.subject && r.session_id===state.visit && Date.parse(r.started_at)>=state.immediate_finished_at));
 if(completed){state.nvcst_finished=true;state.nvcst_finished_at=Date.now();save()}
 else{state.nvcst_finished=false;save()}

 history.replaceState(null,'',location.pathname);
}

if(state){$('setup').insertAdjacentHTML('beforeend','<p class="note">偵測到此瀏覽器既有 NEMA 進度。如需清除測試進度，使用下面的按鈕。</p><button id="reset" class="secondary">清除本機 NEMA 測試進度</button>');$('reset').onclick=()=>{if(confirm('確定清除本機 NEMA 進度？已錄音可能仍留在裝置儲存空間，請先匯出。')){localStorage.removeItem(KEY);location.reload()}}}render();setInterval(()=>{if(state?.phase==='interlude')renderInterval()},1000);
})();