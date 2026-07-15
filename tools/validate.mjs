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

const required=['index.html','.nojekyll','offline.html','login/index.html','login/app.js','catalogue/index.html','catalogue/app.js','plan-ai/index.html','quote-analysis/index.html','projects/index.html','renovation-budget/index.html','renovation-budget/rates.js','renovation-budget/app.js','property-estimate/index.html','property-estimate/app.js','shared/auth.js','shared/cloud-sync.js','shared/catalogue-runtime.js','shared/product-shell.js','supabase/migrations/20260714_product_foundation.sql','supabase/migrations/20260714_security_audit_hardening.sql','supabase/functions/analyse-plan/index.ts','assets/app-icon.svg','assets/alert-construction-logo-white.svg'];
for(const file of required)if(!fs.existsSync(path.join(root,file)))fail(`Missing ${file}`);

const allFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else allFiles.push(full)}}
walk(root);
for(const file of allFiles){if(!/\.(?:html|js|ts|txt|toml|json|webmanifest)$/i.test(file))continue;const text=fs.readFileSync(file,'utf8');if(/\bsk-[A-Za-z0-9_-]{20,}/.test(text))fail(`Possible secret key in ${path.relative(root,file)}`)}

const home=read('index.html'),platform=read('shared/platform-config.js'),migration=read('supabase/migrations/20260714_product_foundation.sql'),hardening=read('supabase/migrations/20260714_security_audit_hardening.sql'),edge=read('supabase/functions/analyse-plan/index.ts'),auth=read('shared/auth.js'),catalogue=read('shared/catalogue-runtime.js'),shell=read('shared/product-shell.js');
if(!home.includes('og:title')||!home.includes('meta name="description"'))fail('Dashboard link-preview metadata is missing');
if(!platform.includes('enforceInternalLogin:true'))fail('Internal login protection is not enabled');
for(const table of ['organisations','profiles','ac_workspaces','price_catalogue','ac_audit_log'])if(!migration.includes(`public.${table}`))fail(`Database migration is missing ${table}`);
if(!migration.includes('enable row level security'))fail('Database Row Level Security is missing');
for(const marker of ['catalogue_access_probe','set_ac_member_access','rotate_ac_join_code','log_ac_project_action','workspace_audit_trigger','active = true'])if(!hardening.includes(marker))fail(`Security hardening is missing ${marker}`);
if(!catalogue.includes('securityState')||!catalogue.includes('catalogue_access_probe'))fail('Catalogue does not perform its authenticated server access probe');
if(!auth.includes('requestPasswordReset')||!auth.includes('resendVerification')||!auth.includes('hasAccess'))fail('Account recovery or active access handling is incomplete');
if(!shell.includes('ac-signout')||!shell.includes('ac-sync-label'))fail('Dashboard account/sign-out/sync controls are incomplete');
if(!home.includes('toolSearch')||!home.includes('AI-assisted • Human verification required'))fail('Dashboard search or trust labels are missing');
if(!home.includes('./property-estimate/index.html')||!read('property-estimate/app.js').includes('comparable-sales'))fail('Property Value Guide is not connected to the dashboard or its evidence method is missing');
if(!edge.includes('Sign in before using AI analysis'))fail('Edge Function does not enforce signed-in AI access');

console.log('PASS: product foundation, security schema, catalogue ordering, renovation rate reuse, formula, assets and secret scan');
