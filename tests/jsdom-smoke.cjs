const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const waitFor=async(test,label)=>{for(let i=0;i<100;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,10))}throw new Error(`Timed out waiting for ${label}`)};

function domFor(html){
  const dom=new JSDOM(read(html),{url:`https://mam0015.github.io/Alert-Construction/${html.replace('index.html','')}`,runScripts:'outside-only'});
  dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  dom.window.scrollTo=function(){};
  return dom;
}

(async()=>{
  const plan=domFor('plan-ai/index.html');
  plan.window.eval(read('plan-ai/config.js'));
  let planRequest;
  plan.window.fetch=async(_url,options)=>{planRequest={headers:options.headers,body:JSON.parse(options.body)};return{ok:true,status:200,json:async()=>({responseId:'r1',analysis:{status:'success',summary:'Symbols counted',items:[{catalog_index:0,quantity:10,evidence:'10 symbols outside legend'}],assumptions:[],warnings:[],unpriced_items:[]}})}};
  plan.window.eval(read('plan-ai/app.js'));
  const planFile=new plan.window.File([new Uint8Array([37,80,68,70])],'plan.pdf',{type:'application/pdf'});
  Object.defineProperty(plan.window.document.querySelector('#planFile'),'files',{value:[planFile]});
  plan.window.document.querySelector('#planFile').dispatchEvent(new plan.window.Event('change'));
  plan.window.document.querySelector('#chatInput').value='Count and calculate the electrical symbols';
  plan.window.document.querySelector('#chatForm').dispatchEvent(new plan.window.Event('submit',{cancelable:true}));
  await waitFor(()=>plan.window.document.querySelector('.result-card'),'plan result');
  if(planRequest.body.scanMode!=='fast')throw new Error('Fast Vision did not send scanMode=fast');
  if(planRequest.headers.Authorization||planRequest.headers.authorization)throw new Error('Plan request incorrectly sent Authorization');
  if(!planRequest.headers.apikey)throw new Error('Plan request did not send apikey');
  if(!plan.window.document.querySelector('[data-customer-total]').textContent.includes('858.00'))throw new Error('Plan total did not apply 20% then 10% GST');

  const quote=domFor('quote-analysis/index.html');
  quote.window.eval(read('plan-ai/config.js'));
  let quoteRequest;
  quote.window.fetch=async(_url,options)=>{quoteRequest={headers:options.headers,body:JSON.parse(options.body)};return{ok:true,status:200,json:async()=>({analysis:{supplier:'Test',quote_number:'Q1',summary:'Test',gst_treatment:'ex_gst',quote_total_ex_gst:1000,quote_total_inc_gst:1100,items:[{quoted_name:'Downlights',description:'Supply and install',quantity:10,quoted_line_total_ex_gst:1000,catalog_index:0,evidence:'Line 1',notes:''}],warnings:[]}})}};
  quote.window.eval(read('quote-analysis/app.js'));
  const quoteFile=new quote.window.File([new Uint8Array([37,80,68,70])],'quote.pdf',{type:'application/pdf'});
  Object.defineProperty(quote.window.document.querySelector('#quoteFile'),'files',{value:[quoteFile]});
  quote.window.document.querySelector('#quoteFile').dispatchEvent(new quote.window.Event('change'));
  quote.window.document.querySelector('#analyseBtn').click();
  await waitFor(()=>quote.window.document.querySelector('#results').classList.contains('show'),'quote result');
  if(quoteRequest.headers.Authorization||quoteRequest.headers.authorization)throw new Error('Quote request incorrectly sent Authorization');
  if(quote.window.document.querySelector('#expensiveCount').textContent!=='1')throw new Error('Quote $100 rule did not mark the line expensive');

  const projects=domFor('projects/index.html');
  projects.window.eval(read('shared/project-store.js'));
  projects.window.eval(read('projects/app.js'));
  projects.window.document.querySelector('#newProjectBtn').click();
  projects.window.document.querySelector('#newName').value='Smoke Test Project';
  projects.window.document.querySelector('#projectModal .modal-save').click();
  if(!projects.window.document.body.textContent.includes('Smoke Test Project'))throw new Error('Project could not be saved locally');
  if(!projects.window.document.querySelector('.storage-note').textContent.includes('browser and device only'))throw new Error('Local-only storage warning is missing');

  console.log('PASS: Fast Vision request, pricing, Quote Analysis and Projects UI');
})().catch(error=>{console.error(error);process.exit(1)});
