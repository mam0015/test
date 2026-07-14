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

  const renovation=domFor('renovation-budget/index.html');
  renovation.window.eval(read('renovation-budget/rates.js'));
  renovation.window.eval(read('shared/project-store.js'));
  renovation.window.eval(read('renovation-budget/app.js'));
  renovation.window.document.querySelector('#projectName').value='Bathroom Smoke Test';
  renovation.window.document.querySelector('#budget').value='50000';
  renovation.window.document.querySelector('[data-next="2"]').click();
  renovation.window.document.querySelector('[data-category="bathroom"]').click();
  renovation.window.document.querySelector('[data-next="3"]').click();
  if(!renovation.window.document.querySelector('[data-scope="bathroom"]'))throw new Error('Bathroom questions did not open from the category');
  renovation.window.document.querySelector('#bathroomFloorArea').value='8';
  renovation.window.document.querySelector('#bathroomFloorArea').dispatchEvent(new renovation.window.Event('change'));
  renovation.window.document.querySelector('#calculateBtn').click();
  if(!renovation.window.document.querySelector('[data-step="4"]').classList.contains('active'))throw new Error('Renovation estimate result did not open');
  if(!renovation.window.document.querySelector('.grand-total')?.textContent.includes('$'))throw new Error('Renovation total was not calculated');
  if(!renovation.window.document.querySelector('.chip.ac')||!renovation.window.document.querySelector('.chip.allowance'))throw new Error('Verified AC rates and planning allowances were not distinguished');
  const capture=await renovation.window.ACProjectCapture();
  if(capture.module!=='renovation-budget'||!capture.data.state)throw new Error('Renovation project capture is incomplete');
  const renovationProject=renovation.window.ACProjects.create({name:'Saved Renovation Project'});
  renovation.window.eval(read('shared/project-bridge.js'));
  renovation.window.document.querySelector('.acp-fab').click();
  renovation.window.document.querySelector('#acpProject').value=renovationProject.id;
  renovation.window.document.querySelector('.acp-save').click();
  await waitFor(()=>renovation.window.ACProjects.get(renovationProject.id).records.length===1,'renovation project save');
  const savedRecord=renovation.window.ACProjects.get(renovationProject.id).records[0];
  if(savedRecord.module!=='renovation-budget')throw new Error('Renovation estimate was not saved as a project record');
  renovation.window.document.querySelector('#bathroomCount').value='2';
  renovation.window.document.querySelector('#bathroomCount').dispatchEvent(new renovation.window.Event('change'));
  renovation.window.document.querySelector('#calculateBtn').click();
  renovation.window.document.querySelector('.acp-fab').click();
  renovation.window.document.querySelector('#acpProject').value=renovationProject.id;
  renovation.window.document.querySelector('.acp-save').click();
  await waitFor(()=>renovation.window.ACProjects.get(renovationProject.id).records[0].data.state.answers.bathroomCount===2,'renovation project update');
  if(renovation.window.ACProjects.get(renovationProject.id).records.length!==1)throw new Error('Editing a saved renovation created a duplicate record');

  const reopened=domFor('renovation-budget/index.html');
  reopened.window.localStorage.setItem('ac_project_renovation_restore_v1',JSON.stringify({state:capture.data.state,projectId:renovationProject.id,recordId:savedRecord.id}));
  reopened.window.eval(read('renovation-budget/rates.js'));
  reopened.window.eval(read('shared/project-store.js'));
  reopened.window.eval(read('renovation-budget/app.js'));
  if(!reopened.window.document.querySelector('#restoreNote').classList.contains('show'))throw new Error('Saved renovation estimate did not reopen from Projects');
  if(!reopened.window.document.querySelector('.grand-total'))throw new Error('Reopened renovation estimate was not recalculated');

  console.log('PASS: Fast Vision request, pricing, Quote Analysis, Projects and Renovation Budget UI');
})().catch(error=>{console.error(error);process.exit(1)});
