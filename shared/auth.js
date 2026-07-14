(function(global){
  'use strict';
  const config=global.AC_PLATFORM_CONFIG||{},SESSION_KEY='ac_auth_session_v1';
  let session=readSession(),profile=null,readyResolve;
  const ready=new Promise(resolve=>readyResolve=resolve);
  function readSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch(_){return null}}
  function saveSession(value){session=value||null;if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(SESSION_KEY);global.dispatchEvent(new CustomEvent('ac-auth-changed',{detail:{session,profile}}))}
  function base(){return String(config.supabaseUrl||'').replace(/\/$/,'')}
  function publicHeaders(extra={}){return{apikey:config.publishableKey||'','Content-Type':'application/json',...extra}}
  async function request(path,options={}){
    if(!base()||!config.publishableKey)throw new Error('Account service is not configured.');
    const response=await fetch(base()+path,{...options,headers:publicHeaders(options.headers||{})}),data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.msg||data.error_description||data.message||data.error||`Account service error (${response.status}).`);return data;
  }
  async function signIn(email,password){const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});saveSession(data);await loadProfile();return data}
  async function signUp(email,password,companyName){const data=await request('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password,data:{organisation_name:companyName||'Alert Construction'}})});if(data.access_token)saveSession(data);await loadProfile();return data}
  async function refresh(){if(!session?.refresh_token)return null;try{const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});saveSession(data);return data}catch(_){saveSession(null);return null}}
  async function signOut(){try{if(session?.access_token)await request('/auth/v1/logout',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}})}catch(_){}profile=null;saveSession(null)}
  async function ensure(){if(!session)return null;const expires=Number(session.expires_at||0)*1000;if(expires&&expires<Date.now()+60000)await refresh();return session}
  async function headers(){const current=await ensure();return current?.access_token?{Authorization:`Bearer ${current.access_token}`}:{}}
  async function loadProfile(){
    profile=null;const current=await ensure();if(!current?.user?.id)return null;
    try{const response=await fetch(`${base()}/rest/v1/profiles?id=eq.${encodeURIComponent(current.user.id)}&select=id,organisation_id,role,full_name,email`,{headers:publicHeaders({Authorization:`Bearer ${current.access_token}`})});if(response.ok){const rows=await response.json();profile=rows[0]||null}}catch(_){}
    global.dispatchEvent(new CustomEvent('ac-auth-changed',{detail:{session,profile}}));return profile;
  }
  function user(){return session?.user||null}
  function currentProfile(){return profile}
  function role(){return profile?.role||session?.user?.user_metadata?.role||''}
  function can(...roles){return !!session&&(!roles.length||roles.includes(role())||role()==='owner')}
  async function init(){await ensure();if(session)await loadProfile();readyResolve(session);global.dispatchEvent(new CustomEvent('ac-auth-ready',{detail:{session,profile}}))}
  global.ACAuth={ready,signIn,signUp,signOut,refresh,headers,user,profile:currentProfile,role,can,loadProfile,isSignedIn:()=>!!session,config};
  init();
})(window);
