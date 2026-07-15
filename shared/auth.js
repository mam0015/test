(function(global){
  'use strict';
  const config=global.AC_PLATFORM_CONFIG||{},SESSION_KEY='ac_auth_session_v1';
  let session=readSession(),profile=null,profileError='',readyResolve;
  const ready=new Promise(resolve=>readyResolve=resolve);

  function readSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch(_){return null}}
  function saveSession(value){session=value||null;if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(SESSION_KEY);global.dispatchEvent(new CustomEvent('ac-auth-changed',{detail:{session,profile,profileError}}))}
  function base(){return String(config.supabaseUrl||'').replace(/\/$/,'')}
  function publicHeaders(extra={}){return{apikey:config.publishableKey||'','Content-Type':'application/json',...extra}}
  async function request(path,options={}){
    if(!base()||!config.publishableKey)throw new Error('Account service is not configured.');
    const response=await fetch(base()+path,{...options,headers:publicHeaders(options.headers||{})}),data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.msg||data.error_description||data.message||data.error||`Account service error (${response.status}).`);
    return data;
  }
  async function fetchUser(accessToken){return request('/auth/v1/user',{headers:{Authorization:`Bearer ${accessToken}`}})}
  async function consumeAuthRedirect(){
    const params=new URLSearchParams(String(location.hash||'').replace(/^#/,'')),accessToken=params.get('access_token');
    if(!accessToken)return'';
    const user=await fetchUser(accessToken),expiresIn=Number(params.get('expires_in')||3600);
    saveSession({access_token:accessToken,refresh_token:params.get('refresh_token')||'',token_type:params.get('token_type')||'bearer',expires_in:expiresIn,expires_at:Math.floor(Date.now()/1000)+expiresIn,user});
    const type=params.get('type')||'';if(type)sessionStorage.setItem('ac_auth_redirect_type',type);history.replaceState(null,'',location.pathname+location.search);return type;
  }
  async function signIn(email,password){const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});saveSession(data);await loadProfile();return data}
  async function signUp(email,password,companyName,teamCode=''){const data=await request('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password,data:{organisation_name:companyName||'Alert Construction',team_code:String(teamCode||'').trim().toUpperCase()}})});if(data.access_token)saveSession(data);await loadProfile();return data}
  async function refresh(){if(!session?.refresh_token)return null;try{const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});saveSession(data);return data}catch(_){profile=null;saveSession(null);return null}}
  async function signOut(){try{if(session?.access_token)await request('/auth/v1/logout',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}})}catch(_){}profile=null;profileError='';saveSession(null)}
  async function ensure(){if(!session)return null;const expires=Number(session.expires_at||0)*1000;if(expires&&expires<Date.now()+60000)await refresh();return session}
  async function headers(){const current=await ensure();return current?.access_token?{Authorization:`Bearer ${current.access_token}`}:{}}
  async function loadProfile(){
    profile=null;profileError='';const current=await ensure();if(!current?.user?.id)return null;
    try{
      const response=await fetch(`${base()}/rest/v1/profiles?id=eq.${encodeURIComponent(current.user.id)}&select=id,organisation_id,role,full_name,email,active,updated_at`,{headers:publicHeaders({Authorization:`Bearer ${current.access_token}`})});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||`Profile check failed (${response.status}).`)}
      const rows=await response.json();profile=rows[0]||null;if(!profile)profileError='No authorised team profile was found.';
    }catch(error){profileError=error.message||'The secure team profile could not be checked.'}
    global.dispatchEvent(new CustomEvent('ac-auth-changed',{detail:{session,profile,profileError}}));return profile;
  }
  function user(){return session?.user||null}
  function currentProfile(){return profile}
  function role(){return profile?.role||''}
  function hasAccess(){return !!session&&!!profile&&profile.active!==false}
  function can(...roles){return hasAccess()&&(!roles.length||roles.includes(role())||role()==='owner')}
  async function requestPasswordReset(email){
    const redirect=`${location.origin}${new URL('login/',new URL('../',document.currentScript?.src||location.href)).pathname}`;
    return request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',body:JSON.stringify({email})});
  }
  async function resendVerification(email){return request('/auth/v1/resend',{method:'POST',body:JSON.stringify({type:'signup',email})})}
  async function updatePassword(password){const current=await ensure();if(!current?.access_token)throw new Error('Open the password reset email again or sign in first.');const updated=await request('/auth/v1/user',{method:'PUT',headers:{Authorization:`Bearer ${current.access_token}`},body:JSON.stringify({password})});if(updated?.id){session.user=updated;saveSession(session)}return updated}
  async function audit(action,payload={}){
    if(!hasAccess()||!profile?.organisation_id)return false;
    try{
      const response=await fetch(`${base()}/rest/v1/rpc/log_ac_project_action`,{method:'POST',headers:publicHeaders(await headers()),body:JSON.stringify({p_action:action,p_project_id:payload.projectId||null,p_record_id:payload.recordId||null,p_module:payload.module||null,p_details:payload.details||{}})});
      return response.ok;
    }catch(_){return false}
  }
  async function init(){let redirectType='';try{redirectType=await consumeAuthRedirect()}catch(error){profileError=error.message||'The secure email link could not be opened.'}await ensure();if(session)await loadProfile();readyResolve(session);global.dispatchEvent(new CustomEvent('ac-auth-ready',{detail:{session,profile,profileError,redirectType}}));if(redirectType)global.dispatchEvent(new CustomEvent('ac-auth-redirect',{detail:{type:redirectType}}))}

  global.ACAuth={ready,signIn,signUp,signOut,refresh,headers,user,profile:currentProfile,role,can,hasAccess,loadProfile,isSignedIn:()=>!!session,profileError:()=>profileError,requestPasswordReset,resendVerification,updatePassword,audit,config};
  init();
})(window);
