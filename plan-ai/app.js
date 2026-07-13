(function(){
  'use strict';

  const CATALOGS={
    electrical:{label:'Electrical',path:'../electrical/index.html',storage:'ac_ai_electrical_prefill_v1',profit:'percent',items:[
      ['LED Downlight - Supply, wiring & install',65],['LED Downlight - Install only',45],['Bathroom Wall Light - Install on tiles',160],['Outdoor Entrance Light',180],['Shaving Cabinet Light',240],['Power Point - New wiring & install',65],['Power Point - Replacement / fit off',35],['Double Power Point with extra switch',75],['Weatherproof Power Point',150],['1 Gang Light Switch - Replacement',35],['1 Gang Light Switch - New wiring',65],['2 Gang Light Switch - Replacement',40],['2 Gang Light Switch - New wiring',75],['3 Gang Light Switch - Replacement',45],['3 Gang Light Switch - New wiring',85],['4 Gang Light Switch - Replacement',65],['Rotary LED Dimmer',90],['Electric Towel Heater',220],['Non-Electric Towel Rack',85],['3-in-1 Fan / Heat / Light Combo',250],['Rangehood Duct',320],['TV Antenna Point',55],['Data Point',55]
    ]},
    plumbing:{label:'Plumbing',path:'../plumbing/index.html',storage:'ac_ai_plumbing_prefill_v1',profit:'percent',items:[
      ['Bathroom Rough-In Package',3200],['Ensuite Rough-In Package',3700],['Ground Floor Bathroom Rough-In',2500],['Laundry Rough-In',800],['Kitchen Rough-In',1100],['Retreat Sink Rough-In',700],['New Water Point Rough-In',220],['Waste Point Rough-In',180],['Wall Mixer Rough-In',160],['Smart Toilet Setup',190],['Rain Shower Nogging',150],['Toilet Fit-Off',320],['Vanity Basin Fit-Off',300],['Shower Fit-Off',380],['Bath Fit-Off',420],['Kitchen Sink Fit-Off',330],['Laundry Trough Fit-Off',260],['Water to Fridge Fit-Off',190],['Dishwasher Connection',260],['Gas Line Alteration',410],['Gas Hot Plate Fit-Off',330],['Concrete Saw Cut / Jackhammer Allowance',650],['Sanitary Drain Alteration',480],['Coloured Bath Waste + Flexible Connection',250],['Call-Out / Minor Plumbing Item',165]
    ]},
    cladding:{label:'Cladding',path:'../cladding/index.html',storage:'ac_ai_cladding_prefill_v1',profit:'percent',decimal:true,items:[
      ['Thermory Pine Trax Natural C32 Cladding - 140 x 20 LM',15.71],['Thermory C32 Cladding - 5.4m Length',84.97],['Thermory C32 Cladding - estimated material coverage m²',112.25],['Thermory C32 Cladding - 28 Lengths / 151.40 LM',2379.24],['42 x 42 THERMOLIT SPR Corner Mould CP3 @ 4200mm',46.42],['42 x 42 THERMOLIT SPR Corner Mould CP3 LM',11.05],['Corner Moulding Pack - 6 Pieces',278.50],['Delivery Charge / Express Delivery UTE',86.36],['Original Invoice Package - 28 Lengths + 4 Corners + Delivery',2651.24],['Revised Invoice Package - 28 Lengths + 6 Corners + Delivery',2744.10],['Order Confirmation Package - 28 Lengths + Delivery, no corners',2465.60]
    ]},
    // Future trade scaffold. Kept in code but intentionally hidden from the UI until
    // a verified Carpentry catalogue and detection rules are supplied.
    carpentry:{enabled:false,label:'Carpentry',path:'../carpentry/index.html',storage:'ac_ai_carpentry_prefill_v1',profit:'percent',items:[]}
  };
  const GST=.10,PROFIT=.20;
  const config=window.AC_PLAN_AI_CONFIG||{};
  const state={trade:'electrical',method:'fast',file:null,fileData:null,responseId:null,analysis:null,items:[],busy:false};
  const cardData=new WeakMap();
  const $=id=>document.getElementById(id);
  let errorTimer,timerId,startTime;

  function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
  function money(value){return Number(value||0).toLocaleString('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:2})}
  function showError(message){const box=$('errorBox');box.textContent=message;box.hidden=false;clearTimeout(errorTimer);errorTimer=setTimeout(()=>box.hidden=true,5500)}
  function scrollMessages(){const messages=$('messages');messages.scrollTop=messages.scrollHeight}
  function current(){return CATALOGS[state.trade]}

  document.querySelectorAll('.trade').forEach(button=>button.addEventListener('click',()=>{
    if(state.busy)return;
    state.trade=button.dataset.trade;state.responseId=null;state.analysis=null;state.items=[];
    document.querySelectorAll('.trade').forEach(x=>x.classList.toggle('active',x===button));
    $('chatInput').placeholder=`e.g. Calculate the ${current().label.toLowerCase()} work from the plan below`;
    addMessage(`Switched to ${current().label}. I will use the ${current().label} price catalogue for the next calculation.`,'assistant');
  }));

  const METHOD_COPY={
    fast:'Fast Vision uses one AI vision pass to read the plan legend and count visible symbols. It is quicker, but every quantity still needs checking.',
    smart:'Smart Review uses a deeper AI review of pages, legends, symbols, notes and possible double-counting. It is slower and lower risk.'
  };
  document.querySelectorAll('.method').forEach(button=>button.addEventListener('click',()=>{
    if(state.busy)return;
    state.method=button.dataset.method;state.responseId=null;state.analysis=null;state.items=[];
    document.querySelectorAll('.method').forEach(x=>{const active=x===button;x.classList.toggle('active',active);x.setAttribute('aria-checked',String(active))});
    $('methodNote').textContent=METHOD_COPY[state.method];
    addMessage(state.method==='fast'?'Fast Vision selected. One AI vision pass will count the visible trade symbols.':'Smart Review selected. The secure AI service will perform a deeper multi-page plan review.','assistant');
  }));

  const dropzone=$('dropzone');
  $('planFile').addEventListener('change',event=>selectFile(event.target.files[0]));
  ['dragenter','dragover'].forEach(name=>dropzone.addEventListener(name,event=>{event.preventDefault();dropzone.classList.add('drag')}));
  ['dragleave','drop'].forEach(name=>dropzone.addEventListener(name,event=>{event.preventDefault();dropzone.classList.remove('drag')}));
  dropzone.addEventListener('drop',event=>selectFile(event.dataTransfer.files[0]));
  $('removeFileBtn').addEventListener('click',clearFile);

  function selectFile(file){
    if(!file)return;
    const type=inferFileType(file);
    if(!type)return showError('Please upload a PDF, Word, PNG, JPG, WEBP, TXT or CSV plan.');
    const max=(Number(config.maxFileMb)||15)*1024*1024;if(file.size>max)return showError(`The plan must be smaller than ${config.maxFileMb||15} MB.`);
    state.file=file;state.fileData=null;state.responseId=null;dropzone.classList.add('has-file');
    $('fileTitle').textContent=file.name;$('fileMeta').textContent=`${(file.size/1024/1024).toFixed(2)} MB • Uploaded and ready`;$('removeFileBtn').hidden=false;
    addMessage(`${file.name} is attached. Select a trade and analysis method, then send your question.`,'assistant');
  }
  function inferFileType(file){
    const known=['application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/csv'];
    if(known.includes(String(file.type||'').toLowerCase()))return String(file.type).toLowerCase();
    const ext=(String(file.name||'').match(/\.([^.]+)$/)||[])[1]?.toLowerCase();
    return{pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain',csv:'text/csv'}[ext]||'';
  }
  function clearFile(){state.file=null;state.fileData=null;state.responseId=null;$('planFile').value='';dropzone.classList.remove('has-file');$('fileTitle').textContent='Upload house plan';$('fileMeta').textContent='Choose a file or drag it here';$('removeFileBtn').hidden=true}
  function readFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The selected plan could not be read.'));reader.readAsDataURL(file)})}

  async function callFunction(body){
    if(!config.functionUrl)throw new Error('The AI connection has not been activated yet.');
    const response=await fetch(config.functionUrl,{method:'POST',headers:{'Content-Type':'application/json','apikey':config.publishableKey||''},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`AI service error (${response.status}).`);return data;
  }

  $('chatForm').addEventListener('submit',async event=>{
    event.preventDefault();if(state.busy)return;
    const input=$('chatInput'),question=input.value.trim();if(!question)return;
    if(!state.file)return showError('Upload the plan file below before sending your question.');
    addMessage(question,'user');input.value='';setBusy(true);
    const thinking=addThinking();
    try{
      const shouldAnalyse=!state.responseId||/calculate|estimate|extract|count|analyse|analyze|scan|محاسبه|قیمت|شمار/i.test(question);
      let data;
      if(shouldAnalyse){
        if(!state.fileData)state.fileData=await readFile(state.file);
        data=await callFunction({mode:'analyse',scanMode:state.method,trade:state.trade,fileData:state.fileData,fileName:state.file.name,fileType:inferFileType(state.file),question});
        state.responseId=data.responseId||null;state.analysis=data.analysis;
        if(state.analysis){state.analysis.method=state.method;state.analysis.confidence=state.method==='fast'?'Medium — check every count':'Higher — still requires trade review'}
        removeThinking(thinking);renderAnalysis(data.analysis);
      }else{
        data=await callFunction({mode:'question',trade:state.trade,previousResponseId:state.responseId,question});
        state.responseId=data.responseId||state.responseId;removeThinking(thinking);addMessage(data.answer||'No answer was returned.','assistant');
      }
    }catch(error){removeThinking(thinking);addMessage(`I could not complete the request: ${error.message}`,'failure')}
    finally{setBusy(false);input.focus()}
  });

  function setBusy(value){state.busy=value;$('sendBtn').disabled=value;document.querySelectorAll('.trade,.method').forEach(x=>x.disabled=value)}
  function addMessage(text,type){
    const row=document.createElement('div');row.className=`message-row ${type}`;row.innerHTML=`<div class="avatar">${type==='user'?'YOU':type==='failure'?'!':'AI'}</div><div class="bubble"></div>`;row.querySelector('.bubble').textContent=text;$('messages').appendChild(row);scrollMessages();return row;
  }
  function addThinking(){
    const label=state.method==='fast'?'Running a fast vision pass across legends and symbols':'Reviewing every relevant page, legend, symbol and note';
    const row=document.createElement('div');row.className='message-row assistant';row.innerHTML=`<div class="avatar">${state.method==='fast'?'FS':'AI'}</div><div class="bubble"><div class="thinking"><i></i><i></i><i></i><span>${label}</span></div><small class="elapsed">0 seconds</small></div>`;$('messages').appendChild(row);startTime=Date.now();timerId=setInterval(()=>{const el=row.querySelector('.elapsed');if(el)el.textContent=`${Math.floor((Date.now()-startTime)/1000)} seconds`},1000);scrollMessages();return row;
  }
  function updateThinking(row,label,progress){if(!row)return;const text=row.querySelector('.thinking span');if(text)text.textContent=`${label||'Scanning plan'}${Number.isFinite(progress)?` • ${progress}%`:''}`}
  function removeThinking(row){clearInterval(timerId);if(row)row.remove()}

  function renderAnalysis(analysis){
    if(!analysis)return addMessage('The AI response was incomplete. Please try again.','failure');
    if(analysis.status!=='success')return renderMissing();
    const catalog=current(),merged=new Map();
    (analysis.items||[]).forEach(item=>{
      const index=Number(item.catalog_index);if(!Number.isInteger(index)||index<0||index>=catalog.items.length)return;
      const raw=Math.max(0,Number(item.quantity)||0);const quantity=catalog.decimal?Math.round(raw*100)/100:Math.round(raw);if(!quantity)return;
      if(merged.has(index)){const old=merged.get(index);old.quantity+=quantity;old.evidence=[old.evidence,item.evidence].filter(Boolean).join(' / ')}
      else merged.set(index,{catalog_index:index,quantity,evidence:item.evidence||'Visible in the selected trade plan.'});
    });
    state.items=Array.from(merged.values()).sort((a,b)=>a.catalog_index-b.catalog_index);
    if(!state.items.length)return renderMissing();
    addMessage(analysis.summary||`I found ${state.items.length} priced ${catalog.label.toLowerCase()} items in the plan.`,'assistant');
    createResultCard(analysis);scrollMessages();
  }

  function renderMissing(){
    const trade=current().label;
    const descriptions={electrical:'an Electrical layout, symbols or legend',plumbing:'a Plumbing/Hydraulic layout showing the required plumbing scope',cladding:'elevations or a material schedule showing measurable cladding areas and dimensions'};
    addMessage(`I couldn’t calculate the ${trade} estimate because the uploaded plan does not contain ${descriptions[state.trade]}. Please discuss this with the Builder and request the relevant ${trade} plan. No price has been produced.`,'failure');
    const card=document.createElement('div');card.className='missing-card';card.innerHTML=`<strong>${esc(trade)} plan not found</strong>The architectural drawing does not provide enough ${esc(trade.toLowerCase())} information for a reliable calculation. This must be raised with the Builder before estimating.`;$('messages').appendChild(card);scrollMessages();
  }

  function createResultCard(analysis){
    const catalog=current(),card=document.createElement('section');card.className='result-card';card.dataset.resultTrade=state.trade;
    cardData.set(card,{trade:state.trade,items:state.items.map(item=>({...item}))});
    const rows=state.items.map((item,index)=>{const product=catalog.items[item.catalog_index],step=catalog.decimal?'0.01':'1';return `<div class="detected-row" data-item="${index}"><div class="detected-name"><strong>${esc(product[0])}</strong><small>${esc(item.evidence)}</small></div><div class="quantity"><button type="button" data-step="-${step}">−</button><input type="number" min="0" step="${step}" value="${item.quantity}" aria-label="Quantity"><button type="button" data-step="${step}">+</button></div><div class="line-price">${money(product[1]*item.quantity)}</div></div>`}).join('');
    const assumptions=(analysis.assumptions||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>No additional assumptions listed.</li>';
    const warnings=[...(analysis.warnings||[]),...(analysis.unpriced_items||[]).map(x=>`Unpriced: ${x}`)].map(x=>`<li>${esc(x)}</li>`).join('')||'<li>Confirm all quantities with the Builder and relevant trade.</li>';
    const method=analysis.method==='fast'?'Fast Vision':'Smart Review';const confidence=analysis.confidence||(analysis.method==='fast'?'Medium — check every count':'Higher — still requires trade review');
    card.innerHTML=`<div class="result-top"><h3>${esc(catalog.label)} Estimate From Plan</h3><p>Matched to the existing Alert Construction ${esc(catalog.label)} catalogue. Review every editable quantity before use.</p><span class="result-method">${esc(method)}</span><span class="confidence">${esc(confidence)}</span></div><div class="totals"><div class="total-box"><span>Cost + GST</span><strong data-builder-total>$0.00</strong><small>Catalogue subtotal + 10% GST</small></div><div class="total-box"><span>Customer Estimate</span><strong data-customer-total>$0.00</strong><small>+20% margin, then +10% GST</small></div></div><div class="detected-list">${rows}</div><div class="result-notes"><div><strong>Assumptions</strong><ul>${assumptions}</ul></div><div><strong>Builder Check</strong><ul>${warnings}</ul></div></div><div class="result-actions"><button class="open-calculator" type="button">Open ${esc(catalog.label)} Calculator →</button></div>`;
    $('messages').appendChild(card);bindResultCard(card);updateCard(card);
  }

  function bindResultCard(card){
    const data=cardData.get(card),catalog=CATALOGS[data.trade];
    card.querySelectorAll('.detected-row').forEach(row=>{const input=row.querySelector('input'),index=Number(row.dataset.item);input.addEventListener('input',()=>{const n=Math.max(0,Number(input.value)||0);data.items[index].quantity=catalog.decimal?Math.round(n*100)/100:Math.round(n);input.value=data.items[index].quantity;row.querySelector('.line-price').textContent=money(catalog.items[data.items[index].catalog_index][1]*data.items[index].quantity);updateCard(card)});row.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{input.value=Math.max(0,Number(input.value||0)+Number(button.dataset.step));input.dispatchEvent(new Event('input'))}))});
    card.querySelector('.open-calculator').addEventListener('click',()=>transferToCalculator(card));
  }
  function totalsFor(card){const data=cardData.get(card),catalog=CATALOGS[data.trade],base=data.items.reduce((sum,item)=>sum+catalog.items[item.catalog_index][1]*item.quantity,0);return{builder:base*(1+GST),customer:base>0?base*(1+PROFIT)*(1+GST):0}}
  function updateCard(card){const value=totalsFor(card);card.querySelector('[data-builder-total]').textContent=money(value.builder);card.querySelector('[data-customer-total]').textContent=money(value.customer)}
  function transferToCalculator(card){const data=cardData.get(card),catalog=CATALOGS[data.trade],quantities=Array(catalog.items.length).fill(0);data.items.forEach(item=>quantities[item.catalog_index]=item.quantity);localStorage.setItem(catalog.storage,JSON.stringify({quantities,project:state.file?state.file.name.replace(/\.[^.]+$/,''):`AI ${catalog.label} Estimate`,mode:'customer',createdAt:new Date().toISOString()}));window.location.href=catalog.path}
  window.ACProjectCapture=async function(){
    const cards=document.querySelectorAll('.result-card'),card=cards[cards.length-1];if(!card)throw new Error('Complete a plan estimate before saving it.');
    const saved=cardData.get(card),totals=totalsFor(card),analysis=state.analysis||{},name=state.file?state.file.name.replace(/\.[^.]+$/,''):'Plan';
    return{module:'plan-estimate',title:name+' — '+CATALOGS[saved.trade].label+' Plan Estimate',summary:saved.items.length+' priced items • '+money(totals.builder)+' builder total',attachment:state.file,data:{trade:saved.trade,method:analysis.method||state.method,items:saved.items,analysis:analysis,builderTotalIncGst:totals.builder,customerTotalIncGst:totals.customer}};
  };
})();
