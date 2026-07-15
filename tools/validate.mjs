import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=message=>{throw new Error(message)};

function jsCatalogs(file,endMarker){
  const source=read(file),start=source.indexOf('const CATALOGS=');
  const end=source.indexOf(endMarker,start);
  if(start<0||end<0)fail(`Could not read catalogues from ${file}`);
  const literal=source.slice(start+'const CATALOGS='.length,end).trim().replace(/;$/,'');
  return Function(`return (${literal})`)();
}

function calculatorRates(file){
  return [...read(file).matchAll(/class="item"[^>]*data-rate="([0-9.]+)"/g)].map(match=>Number(match[1]));
}

function backendRates(trade){
  const source=read('supabase/functions/analyse-plan/index.ts');
  const start=source.indexOf(`${trade}:{`),catalog=start<0?-1:source.indexOf('catalog:[',start);
  const next=source.indexOf('\n  },',catalog);
  if(catalog<0||next<0)fail(`Could not read ${trade} backend catalogue`);
  return [...source.slice(catalog,next).matchAll(/\{name:"[^"]+",rate:([0-9.]+)\}/g)].map(match=>Number(match[1]));
}

const plan=jsCatalogs('plan-ai/app.js','const GST');
const quote=jsCatalogs('quote-analysis/app.js','const config');
const renovationWindow={};
Function('window',read('renovation-budget/rates.js'))(renovationWindow);
const renovation=renovationWindow.ACRenovationRates;
const expected={electrical:23,plumbing:25,cladding:11};

for(const [trade,count] of Object.entries(expected)){
  const planRates=plan[trade].items.map(item=>Number(item[1]));
  const quoteRates=quote[trade].items.map(item=>Number(item[1]));
  const calcRates=calculatorRates(`${trade}/index.html`);
  const edgeRates=backendRates(trade);
  for(const [source,rates] of Object.entries({planRates,quoteRates,calcRates,edgeRates})){
    if(rates.length!==count)fail(`${trade} ${source} has ${rates.length} rates; expected ${count}`);
    if(JSON.stringify(rates)!==JSON.stringify(planRates))fail(`${trade} ${source} rate ordering does not match Plan Estimator`);
  }
}

const renovationRateChecks=[
  ['Electrical downlight',renovation.verified.electrical.downlightSupply.rate,plan.electrical.items[0][1]],
  ['Electrical power point',renovation.verified.electrical.powerPointNew.rate,plan.electrical.items[5][1]],
  ['Electrical fan/heat/light',renovation.verified.electrical.fanHeatLight.rate,plan.electrical.items[19][1]],
  ['Plumbing bathroom rough-in',renovation.verified.plumbing.bathroomRoughIn.rate,plan.plumbing.items[0][1]],
  ['Plumbing kitchen rough-in',renovation.verified.plumbing.kitchenRoughIn.rate,plan.plumbing.items[4][1]],
  ['Plumbing dishwasher',renovation.verified.plumbing.dishwasher.rate,plan.plumbing.items[18][1]],
  ['Cladding square metre',renovation.verified.cladding.coverage.rate,plan.cladding.items[2][1]],
  ['Cladding delivery',renovation.verified.cladding.delivery.rate,plan.cladding.items[7][1]]
];
for(const [name,actual,wanted] of renovationRateChecks)if(Number(actual)!==Number(wanted))fail(`${name} does not match the existing AC calculator`);
if(renovation.customerMargin!==0.2||renovation.gst!==0.1)fail('Renovation pricing formula must retain 20% margin and 10% GST');

const base=1000,customer=base*1.2*1.1;
if(Math.abs(customer-1320)>0.001)fail('Pricing formula must apply 20% before 10% GST');

const required=['index.html','.nojekyll','offline.html','login/index.html','login/app.js','legal/privacy.html','legal/terms.html','catalogue/index.html','catalogue/app.js','plan-ai/index.html','quote-analysis/index.html','projects/index.html','renovation-budget/index.html','renovation-budget/rates.js','renovation-budget/app.js','property-estimate/index.html','property-estimate/app.js','permit-checklist/index.html','permit-checklist/app.js','shared/auth.js','shared/analytics.js','shared/cloud-sync.js','shared/catalogue-runtime.js','shared/product-shell.js','supabase/migrations/20260714_product_foundation.sql','supabase/migrations/20260714_security_audit_hardening.sql','supabase/migrations/20260715_optional_team_code.sql','supabase/migrations/20260715_privacy_analytics.sql','supabase/functions/analyse-plan/index.ts','assets/app-icon.svg','assets/alert-construction-logo-white.svg'];
for(const file of required)if(!fs.existsSync(path.join(root,file)))fail(`Missing ${file}`);

const allFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else allFiles.push(full)}}
walk(root);
for(const file of allFiles){if(!/\.(?:html|js|ts|txt|toml|json|webmanifest)$/i.test(file))continue;const text=fs.readFileSync(file,'utf8');if(/\bsk-[A-Za-z0-9_-]{20,}/.test(text))fail(`Possible secret key in ${path.relative(root,file)}`)}

const home=read('index.html'),platform=read('shared/platform-config.js'),migration=read('supabase/migrations/20260714_product_foundation.sql'),hardening=read('supabase/migrations/20260714_security_audit_hardening.sql'),optionalTeam=read('supabase/migrations/20260715_optional_team_code.sql'),usageMigration=read('supabase/migrations/20260715_privacy_analytics.sql'),edge=read('supabase/functions/analyse-plan/index.ts'),auth=read('shared/auth.js'),login=read('login/index.html'),catalogue=read('shared/catalogue-runtime.js'),shell=read('shared/product-shell.js'),analytics=read('shared/analytics.js'),privacy=read('legal/privacy.html'),terms=read('legal/terms.html');
if(!home.includes('og:title')||!home.includes('meta name="description"'))fail('Dashboard link-preview metadata is missing');
if(!platform.includes('enforceInternalLogin:true'))fail('Internal login protection is not enabled');
for(const table of ['organisations','profiles','ac_workspaces','price_catalogue','ac_audit_log'])if(!migration.includes(`public.${table}`))fail(`Database migration is missing ${table}`);
if(!migration.includes('enable row level security'))fail('Database Row Level Security is missing');
for(const marker of ['catalogue_access_probe','set_ac_member_access','rotate_ac_join_code','log_ac_project_action','workspace_audit_trigger','active = true'])if(!hardening.includes(marker))fail(`Security hardening is missing ${marker}`);
if(!catalogue.includes('securityState')||!catalogue.includes('catalogue_access_probe'))fail('Catalogue does not perform its authenticated server access probe');
if(!auth.includes('requestPasswordReset')||!auth.includes('resendVerification')||!auth.includes('hasAccess'))fail('Account recovery or active access handling is incomplete');
if(!auth.includes('team_code')||!login.includes('signUpTeamCode')||!login.includes('Leave blank if you do not have one'))fail('Optional Team Code signup is incomplete');
for(const marker of ['requested_code','site_supervisor','Private Workspace','auth.users','p.id is null','setup_ac_workspace','personal_workspace_created','team_code',"grant execute on function public.setup_ac_workspace"])if(!optionalTeam.includes(marker))fail(`Optional Team Code migration is missing ${marker}`);
if(!shell.includes('ac-signout')||!shell.includes('ac-sync-label')||!shell.includes('legal/privacy.html')||!shell.includes('legal/terms.html'))fail('Dashboard account, sync or legal links are incomplete');
if(!home.includes('toolSearch')||!home.includes('AI-assisted • Human verification required'))fail('Dashboard search or trust labels are missing');
if(!home.includes('./property-estimate/index.html')||!read('property-estimate/app.js').includes('comparable-sales'))fail('Property Value Guide is not connected to the dashboard or its evidence method is missing');
const permitHtml=read('permit-checklist/index.html'),permitApp=read('permit-checklist/app.js');
if(!home.includes('./permit-checklist/index.html')||!permitApp.includes("module:'permit-checklist'")||!permitApp.includes('ac_project_permit_restore_v1'))fail('Victoria Permit Checklist is not fully connected to the dashboard and Projects');
for(const marker of ['only a best-effort guess','not always true','Never start work','obtain confirmation in writing','Important: confirm the requirements before proceeding','local council','registered building surveyor','Written confirmation'])if(!permitHtml.includes(marker))fail(`Permit Checklist warning is missing ${marker}`);
for(const marker of ['Planning permit','Building permit','Certificate of Electrical Safety','Owner-builder Certificate of Consent','Asbestos assessment'])if(!permitApp.includes(marker))fail(`Permit Checklist rules are missing ${marker}`);
for(const marker of ['requireSignedInUser','/auth/v1/user','invalid or expired','Origin required'])if(!edge.includes(marker))fail(`Edge Function explicit user verification is missing ${marker}`);
if(edge.includes('withSupabase'))fail('Edge Function still relies on the previous ineffective auth-mode wrapper');
for(const marker of ['ac_usage_events','log_ac_usage','ac_usage_summary','180 days','Only an Owner can view usage analytics'])if(!usageMigration.includes(marker))fail(`Privacy-safe analytics migration is missing ${marker}`);
if(!analytics.includes("track('tool_opened')")||analytics.includes('estimate_value')||analytics.includes('project_name'))fail('Privacy-safe tool analytics are incomplete or collect prohibited content');
for(const marker of ['Australian Privacy Principles','Access and correction','Privacy questions and complaints','180 days','AI and automated processing'])if(!privacy.includes(marker))fail(`Privacy Policy is missing ${marker}`);
for(const marker of ['not a fixed quotation','licensed valuation','Australian Consumer Law','AI output may'])if(!terms.includes(marker))fail(`Terms of Use are missing ${marker}`);
if(!read('plan-ai/index.html').includes('not a licensed quote')||!read('quote-analysis/index.html').includes('not a quote or professional assessment')||!read('property-estimate/index.html').includes('not a licensed valuation'))fail('A required estimate/valuation disclaimer is missing');

console.log('PASS: foundation, explicit AI auth, APP legal pages, privacy-safe analytics, catalogue ordering, formulas, assets and secret scan');
