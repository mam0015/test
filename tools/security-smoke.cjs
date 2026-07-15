const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const waitFor=async(test,label)=>{for(let i=0;i<120;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,10))}throw new Error(`Timed out waiting for ${label}`)};
const jsonResponse=(data,ok=true,status=200)=>({ok,status,json:async()=>data});

(async()=>{
  const signupDom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test/login/',runScripts:'outside-only'});
  signupDom.window.AC_PLATFORM_CONFIG={supabaseUrl:'https://secure.test',publishableKey:'public'};
  const signupBodies=[];signupDom.window.fetch=async(_url,options={})=>{signupBodies.push(JSON.parse(options.body||'{}'));return jsonResponse({user:{id:'new-user'}},true,200)};
  signupDom.window.eval(read('shared/auth.js'));await signupDom.window.ACAuth.ready;
  await signupDom.window.ACAuth.signUp('owner@example.test','password1','My Workspace','');
  await signupDom.window.ACAuth.signUp('member@example.test','password1','Ignored Workspace',' ac123 ');
  if(signupBodies[0].data.team_code!==''||signupBodies[1].data.team_code!=='AC123')throw new Error('Blank and supplied optional Team Codes were not sent correctly during signup');

  const authDom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test/login/',runScripts:'outside-only'});
  authDom.window.AC_PLATFORM_CONFIG={supabaseUrl:'https://secure.test',publishableKey:'public'};
  authDom.window.localStorage.setItem('ac_auth_session_v1',JSON.stringify({access_token:'token',refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'u1',email:'site@example.test'}}));
  authDom.window.fetch=async url=>{if(String(url).includes('/profiles?'))return jsonResponse([{id:'u1',organisation_id:'org1',role:'site_supervisor',active:false,email:'site@example.test'}]);throw new Error(`Unexpected auth request ${url}`)};
  authDom.window.eval(read('shared/auth.js'));await authDom.window.ACAuth.ready;
  if(!authDom.window.ACAuth.isSignedIn()||authDom.window.ACAuth.hasAccess())throw new Error('Revoked account was not retained as signed in but blocked from active access');

  const catDom=new JSDOM('<!doctype html><body><div class="item" data-rate="0"><span class="rate"></span><input class="qtyInput"></div></body>',{url:'https://example.test/electrical/',runScripts:'outside-only'});
  catDom.window.AC_PLATFORM_CONFIG={supabaseUrl:'https://secure.test',publishableKey:'public',catalogueCloudEnabled:true};
  catDom.window.AC_CATALOGUE_DEFAULTS=[{item_key:'electrical:0',trade:'electrical',sort_order:0,name:'Test item',builder_rate:10,unit:'each',customer_margin:20,active:true}];
  catDom.window.ACAuth={ready:Promise.resolve(),profile:()=>({organisation_id:'org1',role:'site_supervisor',active:true}),hasAccess:()=>true,headers:async()=>({Authorization:'Bearer token'}),user:()=>({id:'u1'})};
  const calls=[];catDom.window.fetch=async(url,options={})=>{calls.push({url:String(url),options});if(String(url).includes('catalogue_access_probe'))return jsonResponse({authorised:true,organisation_id:'org1',role:'site_supervisor',can_edit:false,checked_at:new Date().toISOString()});if(String(url).includes('/price_catalogue?'))return jsonResponse([{item_key:'electrical:0',trade:'electrical',sort_order:0,item_name:'Protected item',unit:'each',builder_rate:99,margin_percent:20,active:true,source:'Office catalogue'}]);throw new Error(`Unexpected catalogue request ${url}`)};
  catDom.window.eval(read('shared/catalogue-runtime.js'));catDom.window.document.dispatchEvent(new catDom.window.Event('DOMContentLoaded'));await catDom.window.ACPriceCatalogue.ready;
  if(!catDom.window.ACPriceCatalogue.security().verified||catDom.window.ACPriceCatalogue.security().can_edit)throw new Error('Catalogue server probe did not enforce read-only role');
  if(catDom.window.ACPriceCatalogue.list('electrical')[0].builder_rate!==99)throw new Error('Protected catalogue response was not applied');
  let denied=false;try{await catDom.window.ACPriceCatalogue.save(catDom.window.ACPriceCatalogue.list('electrical')[0])}catch(_){denied=true}if(!denied)throw new Error('Site Supervisor catalogue save was not denied');
  if(!calls[0].options.headers.Authorization)throw new Error('Catalogue probe did not use the signed-in token');

  const loginDom=new JSDOM(read('login/index.html'),{url:'https://example.test/login/',runScripts:'outside-only'});loginDom.window.HTMLElement.prototype.scrollIntoView=function(){};
  loginDom.window.AC_PLATFORM_CONFIG={supabaseUrl:'https://secure.test',publishableKey:'public'};
  loginDom.window.ACAuth={ready:Promise.resolve(),user:()=>({id:'owner1',email:'owner@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{organisation_name:'My Workspace'}}),profile:()=>({id:'owner1',organisation_id:'org1',role:'owner',active:true}),profileError:()=>'',headers:async()=>({Authorization:'Bearer token'}),hasAccess:()=>true,isSignedIn:()=>true,loadProfile:async()=>{},signOut:async()=>{},signIn:async()=>{},signUp:async()=>{},requestPasswordReset:async()=>{},resendVerification:async()=>{},updatePassword:async()=>{}};
  loginDom.window.fetch=async url=>{const value=String(url);if(value.includes('/organisations?'))return jsonResponse([{id:'org1',name:'My Workspace',join_code:'INVITE123',join_code_rotated_at:new Date().toISOString()}]);if(value.includes('/profiles?'))return jsonResponse([{id:'owner1',email:'owner@example.test',role:'owner',active:true,updated_at:new Date().toISOString()}]);if(value.includes('/ac_audit_log?')||value.includes('/price_catalogue_history?')||value.includes('/rpc/ac_usage_summary'))return jsonResponse([]);throw new Error(`Unexpected login request ${url}`)};
  loginDom.window.eval(read('login/app.js'));await waitFor(()=>!loginDom.window.document.querySelector('#ownerCode').hidden,'owner team code');
  if(!loginDom.window.document.querySelector('#joinChoice').hidden)throw new Error('Owners still see the confusing Join Existing Team box');
  if(!loginDom.window.document.querySelector('#signup').textContent.includes('completely fine'))throw new Error('Signup does not clearly explain that Team Code is optional');
  if(!loginDom.window.document.querySelector('#signup').textContent.includes('Privacy Policy')||loginDom.window.document.querySelector('#usageSection').hidden)throw new Error('Signup privacy notice or Owner usage insights are missing');

  const recoveryDom=new JSDOM(read('login/index.html'),{url:'https://example.test/login/',runScripts:'outside-only'});recoveryDom.window.HTMLElement.prototype.scrollIntoView=function(){};
  recoveryDom.window.AC_PLATFORM_CONFIG={supabaseUrl:'https://secure.test',publishableKey:'public'};let recoveredProfile=null,recoveryRequest=null;
  recoveryDom.window.ACAuth={ready:Promise.resolve(),user:()=>({id:'personal1',email:'personal@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{organisation_name:'Personal Workspace'}}),profile:()=>recoveredProfile,profileError:()=>recoveredProfile?'':'No authorised team profile was found.',headers:async()=>({Authorization:'Bearer token'}),hasAccess:()=>!!recoveredProfile,isSignedIn:()=>true,loadProfile:async()=>{recoveredProfile={id:'personal1',organisation_id:'personal-org',role:'owner',active:true}},signOut:async()=>{},signIn:async()=>{},signUp:async()=>{},requestPasswordReset:async()=>{},resendVerification:async()=>{},updatePassword:async()=>{}};
  recoveryDom.window.fetch=async(url,options={})=>{const value=String(url);if(value.includes('/rpc/setup_ac_workspace')){recoveryRequest=JSON.parse(options.body);return jsonResponse({organisation_id:'personal-org',role:'owner',mode:'individual',team_code:'PERSONAL1'})}if(value.includes('/organisations?'))return jsonResponse([{id:'personal-org',name:'Personal Workspace',join_code:'PERSONAL1',join_code_rotated_at:new Date().toISOString()}]);if(value.includes('/profiles?'))return jsonResponse([{id:'personal1',email:'personal@example.test',role:'owner',active:true,updated_at:new Date().toISOString()}]);if(value.includes('/ac_audit_log?')||value.includes('/price_catalogue_history?'))return jsonResponse([]);throw new Error(`Unexpected recovery request ${url}`)};
  recoveryDom.window.eval(read('login/app.js'));await waitFor(()=>!recoveryDom.window.document.querySelector('#personalChoice').hidden,'individual setup choice');
  recoveryDom.window.document.querySelector('#personalWorkspaceName').value='Ali Private Workspace';recoveryDom.window.document.querySelector('#createPersonalBtn').click();await waitFor(()=>!recoveryDom.window.document.querySelector('#ownerCode').hidden,'recovered personal Team Code');
  if(recoveryRequest?.p_team_code!==''||recoveryRequest?.p_name!=='Ali Private Workspace')throw new Error('Continue Individually did not create a blank-code private workspace');
  if(recoveryDom.window.document.querySelector('#teamCode').textContent!=='PERSONAL1')throw new Error('Recovered individual Owner did not receive a shareable Team Code');

  const dashboard=new JSDOM(read('index.html'),{url:'https://example.test/',runScripts:'outside-only'});
  [...dashboard.window.document.querySelectorAll('script:not([src])')].forEach(script=>dashboard.window.eval(script.textContent));
  dashboard.window.document.querySelector('#toolSearch').value='Build plumbing quotes';dashboard.window.document.querySelector('#toolSearch').dispatchEvent(new dashboard.window.Event('input'));
  const shown=[...dashboard.window.document.querySelectorAll('.tools-grid .tool')].filter(tool=>!tool.hidden);
  if(shown.length!==1||shown[0].dataset.tool!=='plumbing')throw new Error('Dashboard tool search did not filter the tool grid');

  const shellDom=new JSDOM('<!doctype html><body><header class="topbar"></header></body>',{url:'https://example.test/',runScripts:'outside-only'});
  shellDom.window.ACAuth={ready:Promise.resolve(),user:()=>({email:'owner@example.test'}),profile:()=>({role:'owner',active:true}),hasAccess:()=>true,isSignedIn:()=>true,signOut:async()=>{}};
  shellDom.window.confirm=()=>false;shellDom.window.eval(read('shared/product-shell.js'));shellDom.window.document.dispatchEvent(new shellDom.window.Event('DOMContentLoaded'));
  const platform=shellDom.window.document.querySelector('.ac-platform-inline');if(!platform||!platform.textContent.includes('owner@example.test')||platform.querySelector('.ac-signout').hidden)throw new Error('Dashboard account/role/sign-out controls are not visible');
  shellDom.window.dispatchEvent(new shellDom.window.CustomEvent('ac-cloud-status',{detail:{status:'online',message:'Last synced 2:30 pm'}}));if(!platform.textContent.includes('Last synced 2:30 pm'))throw new Error('Dashboard last-synced label did not update');
  if(!shellDom.window.document.querySelector('.ac-legal-footer')?.textContent.includes('Privacy Policy'))throw new Error('Global Privacy and Terms links are missing');

  const analyticsDom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test/test/plan-ai/',runScripts:'outside-only'});let analyticsBody=null;
  analyticsDom.window.AC_PLATFORM_CONFIG={supabaseUrl:'https://secure.test',publishableKey:'public',analyticsEnabled:true};analyticsDom.window.ACAuth={ready:Promise.resolve(),hasAccess:()=>true,headers:async()=>({Authorization:'Bearer token'})};
  analyticsDom.window.fetch=async(_url,options={})=>{analyticsBody=JSON.parse(options.body);return jsonResponse({},true,204)};analyticsDom.window.eval(read('shared/analytics.js'));await waitFor(()=>analyticsBody,'usage analytics');
  if(analyticsBody.p_tool!=='ai-plan-estimator'||analyticsBody.p_event_name!=='tool_opened'||Object.keys(analyticsBody).some(key=>/note|address|value|quote|file/i.test(key)))throw new Error('Usage analytics collected the wrong route or unsafe content');

  const gateDom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test/electrical/',runScripts:'outside-only'});gateDom.window.AC_PLATFORM_CONFIG={enforceInternalLogin:true};gateDom.window.ACAuth={ready:Promise.resolve(),hasAccess:()=>false,isSignedIn:()=>true,profile:()=>null,user:()=>({email:'personal@example.test'}),signOut:async()=>{}};gateDom.window.confirm=()=>false;gateDom.window.eval(read('shared/product-shell.js'));gateDom.window.document.dispatchEvent(new gateDom.window.Event('DOMContentLoaded'));await waitFor(()=>gateDom.window.document.querySelector('.ac-login-gate'),'individual setup gate');if(!gateDom.window.document.querySelector('.ac-login-gate').textContent.includes('no Team Code is required'))throw new Error('Protected tool gate still claims Team Code is required');

  const checklist=new JSDOM(read('checklist/index.html'),{url:'https://example.test/checklist/',runScripts:'outside-only'});checklist.window.confirm=()=>true;checklist.window.print=()=>{};
  const checklistScript=[...checklist.window.document.querySelectorAll('script:not([src])')][0];checklist.window.eval(checklistScript.textContent);
  const name=checklist.window.document.querySelector('#projectName');name.value='Undo Test';name.dispatchEvent(new checklist.window.Event('input'));
  checklist.window.document.querySelector('#resetBtn').click();if(name.value!=='')throw new Error('Checklist reset did not clear the form');
  const undo=checklist.window.document.querySelector('.ac-undo button');if(!undo)throw new Error('Checklist reset did not provide Undo');undo.click();if(name.value!=='Undo Test')throw new Error('Checklist Undo did not restore prior data');

  console.log('PASS: optional Team Code, Owner usage analytics, legal links, privacy-safe event logging, access gate, catalogue role denial, dashboard account/sync and checklist undo');
})().catch(error=>{console.error(error);process.exit(1)});
