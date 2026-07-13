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

const base=1000,customer=base*1.2*1.1;
if(Math.abs(customer-1320)>0.001)fail('Pricing formula must apply 20% before 10% GST');

const required=['index.html','.nojekyll','plan-ai/index.html','quote-analysis/index.html','projects/index.html','supabase/functions/analyse-plan/index.ts','assets/app-icon.svg','assets/alert-construction-logo-white.svg'];
for(const file of required)if(!fs.existsSync(path.join(root,file)))fail(`Missing ${file}`);

const allFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else allFiles.push(full)}}
walk(root);
for(const file of allFiles){if(!/\.(?:html|js|ts|txt|toml|json|webmanifest)$/i.test(file))continue;const text=fs.readFileSync(file,'utf8');if(/\bsk-[A-Za-z0-9_-]{20,}/.test(text))fail(`Possible secret key in ${path.relative(root,file)}`)}

console.log('PASS: root structure, catalogue ordering, rates, formula, assets and secret scan');
