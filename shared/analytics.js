(function(global){
  'use strict';
  const config=global.AC_PLATFORM_CONFIG||{};
  const ROUTES={
    electrical:'electrical',plumbing:'plumbing',cladding:'cladding',
    'renovation-budget':'renovation-budget','property-estimate':'property-value-guide',
    'plan-ai':'ai-plan-estimator','quote-analysis':'quote-price-analysis',
    projects:'projects-schedule',catalogue:'price-catalogue',checklist:'site-checklist',
    login:'account',legal:'legal'
  };
  const allowedEvents=new Set(['tool_opened','estimate_completed','record_saved']);
  const trackableTools=new Set(['electrical','plumbing','cladding','renovation-budget','property-value-guide','ai-plan-estimator','quote-price-analysis','projects-schedule','price-catalogue','site-checklist']);
  function toolFromPath(){const parts=location.pathname.split('/').filter(Boolean).reverse(),part=parts.find(value=>ROUTES[value]);return ROUTES[part]||'dashboard'}
  async function track(eventName,tool=toolFromPath()){
    if(config.analyticsEnabled===false||!allowedEvents.has(eventName)||!global.ACAuth)return false;
    try{
      await global.ACAuth.ready;
      if(!global.ACAuth.hasAccess?.())return false;
      const headers=await global.ACAuth.headers(),response=await fetch(`${String(config.supabaseUrl||'').replace(/\/$/,'')}/rest/v1/rpc/log_ac_usage`,{
        method:'POST',keepalive:true,headers:{apikey:config.publishableKey||'','Content-Type':'application/json',...headers},
        body:JSON.stringify({p_event_name:eventName,p_tool:String(tool).toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,60),p_path:location.pathname.slice(0,180)})
      });
      return response.ok;
    }catch(_){return false}
  }
  global.ACAnalytics={track,tool:toolFromPath};
  if(trackableTools.has(toolFromPath()))track('tool_opened');
})(window);
