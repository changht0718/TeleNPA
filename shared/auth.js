/* TeleNPA shared Supabase Auth — stores session in sessionStorage, not across browser restarts. */
(()=>{'use strict';
const cfg=window.CTT_CLOUD||{}, base=(cfg.url||'').replace(/\/$/,'');
const key='telenpa_auth_v2';let session=null;
try{session=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
if(session && (!session.expires_at || Date.now()>session.expires_at))session=null;
const configured=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url||'')&&!!cfg.anonKey;
const inform=()=>window.dispatchEvent(new CustomEvent('telenpa:auth'));
function save(x){session=x;if(x)sessionStorage.setItem(key,JSON.stringify(x));else sessionStorage.removeItem(key);inform()}
async function api(path,options={}){
 if(!configured())throw new Error('尚未設定 config.js');
 const headers={'apikey':cfg.anonKey,'Content-Type':'application/json',...(session?.access_token?{'Authorization':'Bearer '+session.access_token}:{}),...(options.headers||{})};
 let res;try{res=await fetch(base+path,{...options,headers})}catch{throw Error('網路無法連線')}
 let data=null;try{const txt=await res.text();data=txt?JSON.parse(txt):null}catch{throw Error('伺服器回傳格式錯誤')}
 if(!res.ok)throw Error(data?.message||data?.msg||data?.error_description||data?.error||'HTTP '+res.status);
 return data;
}
async function login(email,password){const d=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});save({access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Date.now()+(d.expires_in||3600)*1000-60000,user:d.user});return d.user}
async function refresh(){if(!session?.refresh_token)return null;const d=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});save({access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Date.now()+(d.expires_in||3600)*1000-60000,user:d.user});return session}
async function request(path,options={}){if(session&&Date.now()>=session.expires_at){try{await refresh()}catch{save(null);throw Error('登入已過期，請重新登入')}}return api(path,options)}
function logout(){save(null)}
window.TeleNPAAuth={configured,login,logout,request,user:()=>session?.user||null,isLoggedIn:()=>!!session?.user,restore:async()=>{if(session&&Date.now()>=session.expires_at){try{await refresh()}catch{save(null)}}return session?.user||null}};
})();
