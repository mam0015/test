(function(global){
  'use strict';
  const config=global.AC_PLATFORM_CONFIG||{},SYNC_KEY='ac_cloud_sync_checkpoint_v1';let timer=null,pulling=false,lastRemote='';
  function status(value,message){global.dispatchEvent(new CustomEvent('ac-cloud-status',{detail:{status:value,message:message||''}}))}
  function localStamp(data){return(data?.projects||[]).reduce((latest,project)=>String(project.updatedAt||'')>latest?String(project.updatedAt):latest,'')}
  function checkpoint(){try{return JSON.parse(localStorage.getItem(SYNC_KEY)||'{}')}catch(_){return{}}}
  function setCheckpoint(value){localStorage.setItem(SYNC_KEY,JSON.stringify(value))}
  async function context(){await global.ACAuth?.ready;const session=global.ACAuth?.isSignedIn(),profile=global.ACAuth?.profile();if(!session||!profile?.organisation_id)return null;return{profile,headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(await global.ACAuth.headers())}}}
  function endpoint(profile){return`${String(config.supabaseUrl).replace(/\/$/,'')}/rest/v1/ac_workspaces?organisation_id=eq.${encodeURIComponent(profile.organisation_id)}`}
  async function pull(){
    if(pulling||!config.cloudSyncEnabled||!global.ACProjects)return;const ctx=await context();if(!ctx){status('','Sign in to enable cloud sync');return}pulling=true;status('syncing');
    try{const response=await fetch(endpoint(ctx.profile)+'&select=organisation_id,workspace,revision,updated_at',{headers:ctx.headers});if(!response.ok)throw new Error(`Cloud sync ${response.status}`);const row=(await response.json())[0],local=global.ACProjects.snapshot(),localTime=localStamp(local),remoteTime=String(row?.updated_at||'');lastRemote=remoteTime;
      const remoteProjects=Array.isArray(row?.workspace?.projects)?row.workspace.projects:[];
      if(remoteProjects.length&&remoteTime&&remoteTime>localTime){global.ACProjects.replaceSnapshot(row.workspace);setCheckpoint({remoteTime,revision:row.revision,at:new Date().toISOString()})}
      else if(local.projects.length&&(!remoteProjects.length||localTime>remoteTime))await push(true);else status('online');
    }catch(error){status('error',error.message)}finally{pulling=false}
  }
  async function push(fromPull=false){
    if(!config.cloudSyncEnabled||!global.ACProjects)return;const ctx=await context();if(!ctx){status('');return}const data=global.ACProjects.snapshot(),stamp=localStamp(data)||new Date().toISOString();status('syncing');
    try{const response=await fetch(`${String(config.supabaseUrl).replace(/\/$/,'')}/rest/v1/ac_workspaces?on_conflict=organisation_id`,{method:'POST',headers:{...ctx.headers,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({organisation_id:ctx.profile.organisation_id,workspace:data,updated_by:global.ACAuth.user()?.id||null})});if(!response.ok)throw new Error(`Cloud sync ${response.status}`);const rows=await response.json();lastRemote=String(rows[0]?.updated_at||stamp);setCheckpoint({remoteTime:lastRemote,revision:rows[0]?.revision,at:new Date().toISOString()});status('online')}
    catch(error){status('error',error.message);if(!fromPull)console.warn('AC cloud sync unavailable:',error.message)}
  }
  function queue(){clearTimeout(timer);timer=setTimeout(()=>push(false),900)}
  async function init(){if(!global.ACProjects||!global.ACAuth)return;await global.ACAuth.ready;await pull();global.addEventListener('ac-projects-changed',queue);setInterval(()=>{if(navigator.onLine)pull()},30000)}
  global.ACCloudSync={pull,push,status:()=>checkpoint(),lastRemote:()=>lastRemote};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
