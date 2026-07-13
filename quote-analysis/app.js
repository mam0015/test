(function(){
  'use strict';

  const THRESHOLD=100;
  const CATALOGS={
    electrical:{label:'Electrical',decimal:false,items:[
      ['LED Downlight - Supply, wiring & install',65],['LED Downlight - Install only',45],['Bathroom Wall Light - Install on tiles',160],['Outdoor Entrance Light',180],['Shaving Cabinet Light',240],['Power Point - New wiring & install',65],['Power Point - Replacement / fit off',35],['Double Power Point with extra switch',75],['Weatherproof Power Point',150],['1 Gang Light Switch - Replacement',35],['1 Gang Light Switch - New wiring',65],['2 Gang Light Switch - Replacement',40],['2 Gang Light Switch - New wiring',75],['3 Gang Light Switch - Replacement',45],['3 Gang Light Switch - New wiring',85],['4 Gang Light Switch - Replacement',65],['Rotary LED Dimmer',90],['Electric Towel Heater',220],['Non-Electric Towel Rack',85],['3-in-1 Fan / Heat / Light Combo',250],['Rangehood Duct',320],['TV Antenna Point',55],['Data Point',55]
    ]},
    plumbing:{label:'Plumbing',decimal:false,items:[
      ['Bathroom Rough-In Package',3200],['Ensuite Rough-In Package',3700],['Ground Floor Bathroom Rough-In',2500],['Laundry Rough-In',800],['Kitchen Rough-In',1100],['Retreat Sink Rough-In',700],['New Water Point Rough-In',220],['Waste Point Rough-In',180],['Wall Mixer Rough-In',160],['Smart Toilet Setup',190],['Rain Shower Nogging',150],['Toilet Fit-Off',320],['Vanity Basin Fit-Off',300],['Shower Fit-Off',380],['Bath Fit-Off',420],['Kitchen Sink Fit-Off',330],['Laundry Trough Fit-Off',260],['Water to Fridge Fit-Off',190],['Dishwasher Connection',260],['Gas Line Alteration',410],['Gas Hot Plate Fit-Off',330],['Concrete Saw Cut / Jackhammer Allowance',650],['Sanitary Drain Alteration',480],['Coloured Bath Waste + Flexible Connection',250],['Call-Out / Minor Plumbing Item',165]
    ]},
    cladding:{label:'Cladding',decimal:true,items:[
      ['Thermory Pine Trax Natural C32 Cladding - 140 x 20 LM',15.71],['Thermory C32 Cladding - 5.4m Length',84.97],['Thermory C32 Cladding - estimated material coverage m²',112.25],['Thermory C32 Cladding - 28 Lengths / 151.40 LM',2379.24],['42 x 42 THERMOLIT SPR Corner Mould CP3 @ 4200mm',46.42],['42 x 42 THERMOLIT SPR Corner Mould CP3 LM',11.05],['Corner Moulding Pack - 6 Pieces',278.50],['Delivery Charge / Express Delivery UTE',86.36],['Original Invoice Package - 28 Lengths + 4 Corners + Delivery',2651.24],['Revised Invoice Package - 28 Lengths + 6 Corners + Delivery',2744.10],['Order Confirmation Package - 28 Lengths + Delivery, no corners',2465.60]
    ]}
  };

  const config=window.AC_PLAN_AI_CONFIG||{};
  const state={trade:'electrical',file:null,fileData:null,busy:false,result:null,items:[],elapsedTimer:null,progressTimer:null,startTime:0};
  const $=id=>document.getElementById(id);
  let errorTimer;

  function money(value){return Number(value||0).toLocaleString('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:2,maximumFractionDigits:2})}
  function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
  function safeUrl(value){try{const url=new URL(String(value));return /^https?:$/.test(url.protocol)?url.href:''}catch(_){return''}}
  function showError(message){const box=$('errorBox');box.textContent=message;box.hidden=false;clearTimeout(errorTimer);errorTimer=setTimeout(()=>box.hidden=true,7000)}
  function round(value){return Math.round((Number(value)||0)*100)/100}
  function catalog(){return CATALOGS[state.trade]}

  document.querySelectorAll('.trade').forEach(button=>button.addEventListener('click',()=>{
    if(state.busy)return;
    state.trade=button.dataset.trade;
    state.result=null;state.items=[];$('results').classList.remove('show');
    document.querySelectorAll('.trade').forEach(item=>item.classList.toggle('active',item===button));
  }));

  const dropzone=$('dropzone');
  $('quoteFile').addEventListener('change',event=>selectFile(event.target.files[0]));
  ['dragenter','dragover'].forEach(name=>dropzone.addEventListener(name,event=>{event.preventDefault();dropzone.classList.add('drag')}));
  ['dragleave','drop'].forEach(name=>dropzone.addEventListener(name,event=>{event.preventDefault();dropzone.classList.remove('drag')}));
  dropzone.addEventListener('drop',event=>selectFile(event.dataTransfer.files[0]));
  $('removeFile').addEventListener('click',clearFile);
  $('analyseBtn').addEventListener('click',analyseQuote);
  $('resetBtn').addEventListener('click',resetAll);
  $('printBtn').addEventListener('click',()=>window.print());

  function selectFile(file){
    if(!file)return;
    const allowed=['application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/csv'];
    const extension=/\.(pdf|png|jpe?g|webp|docx?|txt|csv)$/i.test(file.name);
    if(!allowed.includes(file.type)&&!extension)return showError('Please upload a PDF, image, Word, TXT or CSV quote.');
    const max=(Number(config.maxFileMb)||15)*1024*1024;
    if(file.size>max)return showError(`The quote must be smaller than ${config.maxFileMb||15} MB.`);
    state.file=file;state.fileData=null;dropzone.classList.add('has-file');
    $('fileTitle').textContent=file.name;$('fileMeta').textContent=`${(file.size/1024/1024).toFixed(2)} MB • Ready for review`;$('removeFile').hidden=false;$('analyseBtn').disabled=false;
  }

  function inferFileType(file){
    const known=['application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/csv'];
    if(known.includes(String(file.type||'').toLowerCase()))return String(file.type).toLowerCase();
    const ext=(String(file.name||'').match(/\.([^.]+)$/)||[])[1]?.toLowerCase();
    return{pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain',csv:'text/csv'}[ext]||'';
  }

  function clearFile(){
    if(state.busy)return;
    state.file=null;state.fileData=null;$('quoteFile').value='';dropzone.classList.remove('has-file');$('fileTitle').textContent="Choose the tradie's quote";$('fileMeta').textContent='Tap here or drag the file into this box';$('removeFile').hidden=true;$('analyseBtn').disabled=true;
  }

  function readFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The selected quote could not be read.'));reader.readAsDataURL(file)})}

  async function callFunction(body){
    if(!config.functionUrl)throw new Error('The quote review connection has not been configured.');
    const response=await fetch(config.functionUrl,{method:'POST',headers:{'Content-Type':'application/json','apikey':config.publishableKey||''},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`Review service error (${response.status}).`);
    return data;
  }

  async function analyseQuote(){
    if(state.busy||!state.file)return;
    setBusy(true);startProgress();
    try{
      if(!state.fileData)state.fileData=await readFile(state.file);
      const data=await callFunction({mode:'quote',trade:state.trade,fileData:state.fileData,fileName:state.file.name,fileType:inferFileType(state.file)});
      if(!data.analysis||!Array.isArray(data.analysis.items))throw new Error('The quote result was incomplete. Please try again.');
      state.result=data.analysis;
      state.items=data.analysis.items.map(item=>({
        quoted_name:String(item.quoted_name||'Quoted item'),
        description:String(item.description||''),
        quantity:Math.max(0,Number(item.quantity)||0),
        quoted_line_total_ex_gst:Math.max(0,Number(item.quoted_line_total_ex_gst)||0),
        catalog_index:Number.isInteger(Number(item.catalog_index))?Number(item.catalog_index):-1,
        evidence:String(item.evidence||''),
        notes:String(item.notes||'')
      }));
      finishProgress();renderResults();
    }catch(error){stopProgress();showError(error.message||'The quote could not be reviewed.');}
    finally{setBusy(false)}
  }

  function setBusy(value){
    state.busy=value;$('analyseBtn').disabled=value||!state.file;$('quoteFile').disabled=value;$('removeFile').disabled=value;
    document.querySelectorAll('.trade').forEach(button=>button.disabled=value);
  }

  function startProgress(){
    $('results').classList.remove('show');$('progress').classList.add('show');state.startTime=Date.now();setProgress(8,'read','Opening every page and reading the quote…');
    state.elapsedTimer=setInterval(()=>{const seconds=Math.floor((Date.now()-state.startTime)/1000);$('elapsed').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`},1000);
    let tick=0;state.progressTimer=setInterval(()=>{tick++;if(tick===1)setProgress(25,'extract','Extracting line items, quantities and GST treatment…');else if(tick===2)setProgress(46,'match','Matching each quoted item to the AC catalogue…');else if(tick===3)setProgress(67,'check','Checking scope and current pricing context…');else if(tick>=4)setProgress(Math.min(92,74+tick*3),'check','Cross-checking the result before it is shown…')},9000);
  }
  function setProgress(percent,step,message){$('progressBar').style.width=percent+'%';$('progressStage').textContent=message;const order=['read','extract','match','check','result'],index=order.indexOf(step);document.querySelectorAll('.progress-steps span').forEach((item,i)=>item.classList.toggle('done',i<=index))}
  function finishProgress(){setProgress(100,'result','Result ready.');clearInterval(state.elapsedTimer);clearInterval(state.progressTimer);setTimeout(()=>$('progress').classList.remove('show'),500)}
  function stopProgress(){clearInterval(state.elapsedTimer);clearInterval(state.progressTimer);$('progress').classList.remove('show')}

  function renderResults(){
    const body=$('itemBody');body.innerHTML='';
    state.items.forEach((item,index)=>body.appendChild(makeRow(item,index)));
    renderNotes();recalculate();$('results').classList.add('show');setTimeout(()=>$('verdict').scrollIntoView({behavior:'smooth',block:'start'}),50);
  }

  function makeRow(item,index){
    const row=document.createElement('tr');row.dataset.index=index;
    const options=['<option value="-1">No reliable match</option>'].concat(catalog().items.map((product,i)=>`<option value="${i}" ${i===item.catalog_index?'selected':''}>${esc(product[0])} — ${money(product[1])}</option>`)).join('');
    const step=catalog().decimal?'0.01':'1';
    row.innerHTML=`<td class="quoted-name">${esc(item.quoted_name)}<small>${esc([item.description,item.evidence].filter(Boolean).join(' • '))}</small></td><td><select class="match" aria-label="Matched AC item">${options}</select></td><td style="width:86px"><input class="quantity" type="number" min="0" step="${step}" value="${item.quantity}" aria-label="Quantity"></td><td style="width:145px"><input class="quoted-line" type="number" min="0" step=".01" value="${round(item.quoted_line_total_ex_gst)}" aria-label="Quoted line total ex GST"></td><td class="money-cell ac-line">$0.00</td><td class="money-cell difference">$0.00</td><td><span class="line-status unmatched">NEED REVIEW</span></td>`;
    row.querySelector('.match').addEventListener('change',event=>{item.catalog_index=Number(event.target.value);recalculate()});
    row.querySelector('.quantity').addEventListener('input',event=>{const value=Math.max(0,Number(event.target.value)||0);item.quantity=catalog().decimal?round(value):Math.round(value);recalculate()});
    row.querySelector('.quoted-line').addEventListener('input',event=>{item.quoted_line_total_ex_gst=Math.max(0,Number(event.target.value)||0);recalculate()});
    return row;
  }

  function compareItem(item){
    if(!Number.isInteger(item.catalog_index)||item.catalog_index<0||item.catalog_index>=catalog().items.length||item.quantity<=0||item.quoted_line_total_ex_gst<=0)return{status:'unmatched',ac:0,difference:0};
    const ac=round(catalog().items[item.catalog_index][1]*item.quantity),difference=round(item.quoted_line_total_ex_gst-ac);
    return{status:difference>THRESHOLD?'expensive':difference< -THRESHOLD?'cheap':'fair',ac,difference};
  }

  function recalculate(){
    const counts={expensive:0,cheap:0,fair:0,unmatched:0};let reference=0,quotedComparable=0,comparableDifference=0,pricedCoverage=0;
    state.items.forEach((item,index)=>{
      const comparison=compareItem(item),row=$('itemBody').querySelector(`tr[data-index="${index}"]`);counts[comparison.status]++;
      if(comparison.status!=='unmatched'){reference+=comparison.ac;quotedComparable+=item.quoted_line_total_ex_gst;comparableDifference+=comparison.difference;pricedCoverage+=item.quoted_line_total_ex_gst}
      if(row){row.querySelector('.ac-line').textContent=comparison.status==='unmatched'?'—':money(comparison.ac);const diff=row.querySelector('.difference');diff.textContent=comparison.status==='unmatched'?'—':(comparison.difference>0?'+':'')+money(comparison.difference);diff.className='money-cell difference '+(comparison.difference>0?'positive':comparison.difference<0?'negative':'');const status=row.querySelector('.line-status');status.className='line-status '+comparison.status;status.textContent={expensive:'EXPENSIVE',cheap:'CHEAP',fair:'FAIR',unmatched:'NEED REVIEW'}[comparison.status]}}
    );
    const originalTotal=Math.max(0,Number(state.result.quote_total_ex_gst)||state.items.reduce((sum,item)=>sum+item.quoted_line_total_ex_gst,0)),coverage=originalTotal>0?Math.min(100,Math.round(pricedCoverage/originalTotal*100)):0;
    const verdict=overallVerdict(counts);
    $('quotedTotal').textContent=money(originalTotal);$('referenceTotal').textContent=money(reference);$('comparableDifference').textContent=(comparableDifference>0?'+':'')+money(comparableDifference);$('coverage').textContent=coverage+'%';
    $('expensiveCount').textContent=counts.expensive;$('cheapCount').textContent=counts.cheap;$('fairCount').textContent=counts.fair;$('unmatchedCount').textContent=counts.unmatched;
    const box=$('verdict');box.className='verdict '+verdict.kind;$('verdictTitle').textContent=verdict.title;$('verdictBadge').textContent=verdict.badge;$('verdictSummary').textContent=verdict.summary+(counts.unmatched?` ${counts.unmatched} item${counts.unmatched===1?'':'s'} still need manual review.`:'');
  }

  function overallVerdict(counts){
    const comparable=counts.expensive+counts.cheap+counts.fair;
    if(!comparable)return{kind:'needs_review',badge:'NEEDS REVIEW',title:'Not enough matched pricing for a reliable verdict',summary:'The quote was read, but its priced lines could not be matched confidently to the current AC catalogue.'};
    if(counts.expensive&&counts.cheap)return{kind:'mixed',badge:'MIXED PRICING',title:'This quote has mixed pricing',summary:'Some individual items are more than $100 above our price while other items are more than $100 below it. Review the flagged lines separately.'};
    if(counts.expensive)return{kind:'expensive',badge:'EXPENSIVE ITEMS',title:'This quote contains expensive items',summary:`${counts.expensive} individual line item${counts.expensive===1?' is':'s are'} more than $100 above the matching AC price.`};
    if(counts.cheap)return{kind:'cheap',badge:'CHEAPER ITEMS',title:'This quote contains cheaper items',summary:`${counts.cheap} individual line item${counts.cheap===1?' is':'s are'} more than $100 below the matching AC price.`};
    return{kind:'fair',badge:'FAIR PRICING',title:'The matched items look fairly priced',summary:'Every comparable line is within $100 of the matching AC price.'};
  }

  function renderNotes(){
    const warnings=[...(state.result.warnings||[])];if(state.result.gst_treatment==='unknown')warnings.unshift('GST treatment could not be confirmed. Check whether the quote figures include or exclude GST.');if(!warnings.length)warnings.push('Confirm the extracted scope, quantities and exclusions before relying on the result.');
    $('warningList').innerHTML=warnings.map(item=>`<li>${esc(item)}</li>`).join('');
    $('marketSummary').textContent='Every line verdict uses the fixed Alert Construction catalogue selected above. A difference greater than $100 is expensive, below −$100 is cheap, and anything within $100 is fair. Unmatched scope stays marked for manual review.';
    $('sourceList').innerHTML='';
  }

  function resetAll(){
    stopProgress();state.result=null;state.items=[];$('results').classList.remove('show');clearFile();window.scrollTo({top:0,behavior:'smooth'});
  }
  window.ACProjectCapture=async function(){
    if(!state.result||!state.items.length)throw new Error('Complete a quote analysis before saving it.');
    const name=state.file?state.file.name.replace(/\.[^.]+$/,''):'Trade Quote',verdict=$('verdictBadge').textContent||'Price review';
    return{module:'quote-analysis',title:name+' — '+catalog().label+' Quote Analysis',summary:verdict+' • '+$('quotedTotal').textContent,attachment:state.file,data:{trade:state.trade,result:state.result,items:state.items}};
  };
  (function restoreSavedAnalysis(){
    try{const raw=localStorage.getItem('ac_project_quote_restore_v1');if(!raw)return;const saved=JSON.parse(raw);localStorage.removeItem('ac_project_quote_restore_v1');if(!CATALOGS[saved.trade]||!saved.result||!Array.isArray(saved.items))return;state.trade=saved.trade;state.result=saved.result;state.items=saved.items;document.querySelectorAll('.trade').forEach(button=>button.classList.toggle('active',button.dataset.trade===state.trade));renderResults()}catch(_){}
  })();
})();
