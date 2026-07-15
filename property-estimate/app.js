(function(){
  'use strict';
  const $=id=>document.getElementById(id),DRAFT_KEY='ac_property_estimate_draft_v1',RESTORE_KEY='ac_project_property_restore_v1';
  const BENCHMARK_DATE='2025-12-31',BENCHMARKS={metro:{house:900000,unit:640000},regional:{house:620000,unit:468000}};
  const TYPICAL={house:{bedrooms:3,bathrooms:2,carSpaces:1,landArea:500,floorArea:160},townhouse:{bedrooms:3,bathrooms:2,carSpaces:1,landArea:250,floorArea:130},unit:{bedrooms:2,bathrooms:1,carSpaces:1,landArea:null,floorArea:80}};
  const CONDITION={major:-.12,dated:-.06,average:0,renovated:.08,premium:.14};
  const CONDITION_LABEL={major:'Needs major work',dated:'Dated / mostly original',average:'Average maintained',renovated:'Recently renovated',premium:'Premium renovation / finish'};
  const IDS=['estimateName','suburb','postcode','region','propertyType','suburbMedian','benchmarkDate','marketTrend','bedrooms','bathrooms','carSpaces','landArea','floorArea','yearBuilt','condition','levels','titleType','landShape','slope','frontage','notes','followUpDate'];
  const CHECKS=['outdoor','landscaping','pool','solar'];
  let comparableCount=0,selectedFiles=[],lastResult=null,recordRef=null;

  const number=value=>value===''||value==null?null:(Number.isFinite(Number(value))?Number(value):null);
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const money=value=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(value||0);
  const shortDate=value=>{if(!value)return'Not supplied';const d=new Date(value+'T00:00:00');return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})};
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const median=values=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2};
  const round5=value=>Math.round(value/5000)*5000;
  const ratioAdjustment=(subject,reference,elasticity,min,max)=>subject&&reference?clamp(Math.pow(subject/reference,elasticity),min,max):1;

  function builtInBenchmark(region,type){
    const market=BENCHMARKS[region]||BENCHMARKS.metro;
    if(type==='townhouse')return Math.round((market.house+market.unit)/2);
    return market[type]||market.house;
  }

  function addComparable(value={}){
    if(comparableCount>=5)return;
    const index=++comparableCount,card=document.createElement('article');card.className='comparable';card.dataset.comparable=String(index);
    card.innerHTML=`<div class="comp-head"><strong>Comparable ${index}</strong><button type="button" data-remove>Remove</button></div><div class="comp-grid">
      <div class="comp-field comp-address"><label>Address / description</label><input class="comp-address-value" value="${esc(value.address||'')}" placeholder="Same suburb or nearby"></div>
      <div class="comp-field"><label>Sold price</label><input class="comp-price" type="number" min="0" step="5000" inputmode="decimal" value="${esc(value.price??'')}" placeholder="$"></div>
      <div class="comp-field"><label>Sale date</label><input class="comp-date" type="date" value="${esc(value.date||'')}"></div>
      <div class="comp-field"><label>Bedrooms</label><input class="comp-bedrooms" type="number" min="0" max="20" step="1" value="${esc(value.bedrooms??'')}" placeholder="Beds"></div>
      <div class="comp-field"><label>Bathrooms</label><input class="comp-bathrooms" type="number" min="0" max="15" step="0.5" value="${esc(value.bathrooms??'')}" placeholder="Baths"></div>
      <div class="comp-field"><label>Car spaces</label><input class="comp-cars" type="number" min="0" max="12" step="1" value="${esc(value.carSpaces??'')}" placeholder="Cars"></div>
      <div class="comp-field"><label>Land m²</label><input class="comp-land" type="number" min="0" step="1" value="${esc(value.landArea??'')}" placeholder="Land"></div>
      <div class="comp-field"><label>Floor m²</label><input class="comp-floor" type="number" min="0" step="1" value="${esc(value.floorArea??'')}" placeholder="Floor"></div>
      <div class="comp-field"><label>Condition</label><select class="comp-condition"><option value="">Unknown</option>${Object.entries(CONDITION_LABEL).map(([key,label])=>`<option value="${key}" ${value.condition===key?'selected':''}>${label}</option>`).join('')}</select></div>
    </div>`;
    $('comparables').appendChild(card);card.querySelector('[data-remove]').addEventListener('click',()=>{card.remove();renumberComparables()});
  }

  function renumberComparables(){const cards=[...document.querySelectorAll('[data-comparable]')];comparableCount=cards.length;cards.forEach((card,index)=>{card.dataset.comparable=String(index+1);card.querySelector('.comp-head strong').textContent=`Comparable ${index+1}`})}
  function readComparables(){return[...document.querySelectorAll('[data-comparable]')].map(card=>({address:card.querySelector('.comp-address-value').value.trim(),price:number(card.querySelector('.comp-price').value),date:card.querySelector('.comp-date').value,bedrooms:number(card.querySelector('.comp-bedrooms').value),bathrooms:number(card.querySelector('.comp-bathrooms').value),carSpaces:number(card.querySelector('.comp-cars').value),landArea:number(card.querySelector('.comp-land').value),floorArea:number(card.querySelector('.comp-floor').value),condition:card.querySelector('.comp-condition').value}));}
  function readState(){const state={};IDS.forEach(id=>{state[id]=$(id).value});CHECKS.forEach(id=>{state[id]=$(id).checked});state.comparables=readComparables();return state}
  function writeState(state={}){IDS.forEach(id=>{if(state[id]!==undefined&&state[id]!==null)$(id).value=state[id]});CHECKS.forEach(id=>{$(id).checked=!!state[id]});$('comparables').innerHTML='';comparableCount=0;(Array.isArray(state.comparables)&&state.comparables.length?state.comparables:[{},{},{}]).slice(0,5).forEach(addComparable)}

  function validate(state){
    if(!state.suburb.trim()){showStep(1);$('suburb').focus();throw new Error('Enter the Victorian suburb to calculate the value guide.')}
    if(state.postcode&&!/^(3\d{3}|8\d{3})$/.test(state.postcode.trim())){showStep(1);$('postcode').focus();throw new Error('Enter a valid 4-digit Victorian postcode, or leave it blank.')}
  }

  function commonPropertyFactor(state,includeCondition=true){
    let factor=1,items=[];
    const add=(rate,label)=>{if(!rate)return;factor*=1+rate;items.push({label,rate})};
    if(includeCondition&&state.condition)add(CONDITION[state.condition]||0,CONDITION_LABEL[state.condition]);
    add({corner:.02,irregular:-.02,battleaxe:-.03}[state.landShape]||0,{corner:'Corner site',irregular:'Irregular land shape',battleaxe:'Battle-axe / rear site'}[state.landShape]);
    add({moderate:-.02,steep:-.05}[state.slope]||0,{moderate:'Moderate site slope',steep:'Steep site slope'}[state.slope]);
    add({narrow:-.02,wide:.02}[state.frontage]||0,{narrow:'Narrow frontage',wide:'Wide frontage'}[state.frontage]);
    if((state.propertyType==='townhouse'||state.propertyType==='unit')&&state.titleType==='standalone')add(.01,'Standalone title');
    if(state.titleType==='shared')add(-.02,'Shared land / common driveway');
    if(state.outdoor)add(.015,'Covered outdoor area');if(state.landscaping)add(.01,'Established landscaping');if(state.pool)add(.02,'Compliant pool / spa');if(state.solar)add(.01,'Solar / energy upgrades');
    const raw=factor-1,capped=clamp(raw,-.25,.25);return{factor:1+capped,items};
  }

  function baselineFeatureFactor(state){
    const typical=TYPICAL[state.propertyType]||TYPICAL.house;let factor=1,items=[];
    const diff=(key,rate,cap,label)=>{const value=number(state[key]);if(value===null)return;const adjustment=clamp((value-typical[key])*rate,-cap,cap);factor*=1+adjustment;if(adjustment)items.push({label:`${label}: ${value}`,rate:adjustment})};
    diff('bedrooms',.04,.12,'Bedrooms');diff('bathrooms',.03,.09,'Bathrooms');diff('carSpaces',.015,.045,'Car spaces');
    const land=number(state.landArea);if(land&&typical.landArea){const adjustment=clamp(Math.pow(land/typical.landArea,.10)-1,-.12,.12);factor*=1+adjustment;items.push({label:`Land area: ${land} m²`,rate:adjustment})}
    const floor=number(state.floorArea);if(floor&&typical.floorArea){const adjustment=clamp(Math.pow(floor/typical.floorArea,.15)-1,-.15,.15);factor*=1+adjustment;items.push({label:`Floor area: ${floor} m²`,rate:adjustment})}
    return{factor:clamp(factor,.72,1.30),items};
  }

  function timeFactor(saleDate,annualTrend){
    if(!saleDate||!annualTrend)return 1;const date=new Date(saleDate+'T00:00:00'),now=new Date();if(Number.isNaN(date.getTime()))return 1;const years=clamp((now-date)/(365.25*86400000),0,3);return Math.pow(1+annualTrend/100,years);
  }

  function adjustComparable(comp,state){
    let factor=timeFactor(comp.date,number(state.marketTrend)||0),notes=[];
    if(Math.abs(factor-1)>.001)notes.push(`Market timing ${((factor-1)*100).toFixed(1)}%`);
    const fields=[['landArea',.22,.84,1.18,'land'],['floorArea',.30,.84,1.20,'floor']];
    fields.forEach(([key,power,min,max,label])=>{const f=ratioAdjustment(number(state[key]),comp[key],power,min,max);factor*=f;if(Math.abs(f-1)>.001)notes.push(`${label} ${((f-1)*100).toFixed(1)}%`)});
    [['bedrooms',.03,.09,'beds'],['bathrooms',.025,.075,'baths'],['carSpaces',.015,.045,'cars']].forEach(([key,rate,cap,label])=>{const subject=number(state[key]);if(subject===null||comp[key]===null)return;const f=1+clamp((subject-comp[key])*rate,-cap,cap);factor*=f;if(Math.abs(f-1)>.001)notes.push(`${label} ${((f-1)*100).toFixed(1)}%`)});
    if(state.condition&&comp.condition){const f=1+clamp((CONDITION[state.condition]||0)-(CONDITION[comp.condition]||0),-.15,.15);factor*=f;if(Math.abs(f-1)>.001)notes.push(`condition ${((f-1)*100).toFixed(1)}%`)}
    factor=clamp(factor,.65,1.45);return{...comp,factor,adjusted:comp.price*factor,notes};
  }

  function missingEvidence(state,validComps){
    const missing=[];if(validComps.length<3)missing.push(`${3-validComps.length} more recent comparable sale${3-validComps.length===1?'':'s'}`);if(!number(state.suburbMedian))missing.push('Matching suburb median');if(validComps.length&&validComps.some(comp=>!comp.date))missing.push('Sale dates for every comparable');if(!validComps.length&&number(state.suburbMedian)&&!state.benchmarkDate)missing.push('Suburb median date');if(number(state.bedrooms)===null)missing.push('Bedrooms');if(number(state.bathrooms)===null)missing.push('Bathrooms');if(number(state.landArea)===null&&state.propertyType!=='unit')missing.push('Land area');if(number(state.floorArea)===null)missing.push('Floor area');if(!state.condition)missing.push('Condition / renovation level');return missing;
  }

  function calculateValue(input){
    const state=input||readState();validate(state);const validComps=(state.comparables||[]).filter(comp=>number(comp.price)>0).map(comp=>({...comp,price:number(comp.price),bedrooms:number(comp.bedrooms),bathrooms:number(comp.bathrooms),carSpaces:number(comp.carSpaces),landArea:number(comp.landArea),floorArea:number(comp.floorArea)}));
    const adjustedComps=validComps.map(comp=>adjustComparable(comp,state));let midpoint,method,source,benchmark,adjustments=[],rangeRate,baseConfidence;
    if(adjustedComps.length){
      const compBase=median(adjustedComps.map(comp=>comp.adjusted)),common=commonPropertyFactor(state,!adjustedComps.some(comp=>comp.condition));midpoint=compBase*common.factor;adjustments=common.items;method='comparable-sales';source=`${adjustedComps.length} adjusted comparable sale${adjustedComps.length===1?'':'s'}`;benchmark=compBase;rangeRate=adjustedComps.length>=3?.065:adjustedComps.length===2?.09:.13;baseConfidence=adjustedComps.length>=3?76:adjustedComps.length===2?66:52;
    }else{
      const supplied=number(state.suburbMedian),broad=builtInBenchmark(state.region,state.propertyType),base=supplied||broad,profile=baselineFeatureFactor(state),common=commonPropertyFactor(state,true);midpoint=base*profile.factor*common.factor;adjustments=[...profile.items,...common.items];benchmark=base;if(supplied){method='suburb-median';source='User-supplied matching suburb median';rangeRate=.14;baseConfidence=46}else{method='victoria-benchmark';source=state.propertyType==='townhouse'?'Modelled townhouse midpoint from official house/unit benchmarks':'Official broad Victorian market benchmark';rangeRate=.22;baseConfidence=26}
    }
    if(adjustedComps.length){const today=Date.now(),undated=adjustedComps.filter(comp=>!comp.date).length,old=adjustedComps.filter(comp=>comp.date&&today-new Date(comp.date+'T00:00:00').getTime()>548*86400000).length;if(undated){rangeRate+=.015;baseConfidence-=4}if(old){rangeRate+=.025;baseConfidence-=8}}
    const missing=missingEvidence(state,validComps),filled=[state.bedrooms,state.bathrooms,state.carSpaces,state.landArea,state.floorArea,state.condition,state.landShape,state.slope].filter(value=>value!==''&&value!=null).length;
    let confidence=baseConfidence+filled*1.5+(state.benchmarkDate?2:0)+(validComps.filter(comp=>comp.date).length>=Math.min(3,validComps.length)&&validComps.length?3:0);confidence=Math.round(clamp(confidence,20,90));rangeRate+=Math.min(.04,missing.length*.004);midpoint=round5(midpoint);const low=round5(midpoint*(1-rangeRate)),high=round5(midpoint*(1+rangeRate));
    const label=confidence>=78?'Strong market guide':confidence>=60?'Moderate market guide':confidence>=42?'Indicative guide':'Broad guide only';
    const comparableDates=validComps.map(comp=>comp.date).filter(Boolean).sort(),evidenceDate=method==='comparable-sales'?(comparableDates.at(-1)||null):method==='suburb-median'?(state.benchmarkDate||null):BENCHMARK_DATE;
    return{midpoint,low,high,rangeRate,confidence,label,method,source,benchmark,benchmarkDate:evidenceDate,adjustments,comparables:adjustedComps,missing,calculatedAt:new Date().toISOString(),officialBenchmark:{date:BENCHMARK_DATE,region:state.region,propertyType:state.propertyType,value:builtInBenchmark(state.region,state.propertyType),townhouseModelled:state.propertyType==='townhouse'}};
  }

  function renderResult(result,state){
    const rows=result.adjustments.length?result.adjustments.map(item=>`<div class="result-row"><span>${esc(item.label||'Property factor')}</span><strong>${item.rate>=0?'+':''}${(item.rate*100).toFixed(1)}%</strong></div>`).join(''):'<div class="result-row"><span>No optional property adjustments applied</span><strong>Neutral</strong></div>';
    const comps=result.comparables.length?result.comparables.map((comp,index)=>`<div class="result-row"><span>${esc(comp.address||`Comparable ${index+1}`)} · sold ${money(comp.price)}${comp.date?' · '+shortDate(comp.date):''}</span><strong>${money(round5(comp.adjusted))}<small style="display:block;color:#999">${comp.notes.length?esc(comp.notes.join(', ')):'No measured adjustment'}</small></strong></div>`).join(''):'<div class="result-row"><span>No comparable sales supplied</span><strong>Broader evidence used</strong></div>';
    $('results').innerHTML=`<div class="result-hero"><div class="estimate-card"><span>Indicative market value guide · ${esc(state.suburb)}</span><div class="estimate-main">${money(result.midpoint)}</div><div class="estimate-range">Suggested range: ${money(result.low)} – ${money(result.high)}</div></div><div class="confidence-card"><span>Evidence confidence</span><strong>${result.confidence}% · ${result.label}</strong><div class="confidence-meter"><i style="width:${result.confidence}%"></i></div><p>This score measures the information supplied, not a guarantee that the property will sell in this range.</p></div></div>
      <div class="evidence-grid"><div class="evidence"><span>Primary evidence</span><strong>${esc(result.source)}</strong></div><div class="evidence"><span>Evidence date</span><strong>${shortDate(result.benchmarkDate)}</strong></div><div class="evidence"><span>Estimate created</span><strong>${new Date(result.calculatedAt).toLocaleString('en-AU')}</strong></div></div>
      <div class="result-grid"><div class="result-box"><h3>Property adjustments</h3><div class="result-list">${rows}</div></div><div class="result-box"><h3>Comparable-sale working</h3><div class="result-list">${comps}</div></div></div>
      <div class="missing"><h3>What would improve this estimate?</h3><p>More complete, verified evidence narrows the range. You can still save this guide with unanswered optional questions.</p><div class="missing-tags">${result.missing.length?result.missing.map(item=>`<span>${esc(item)}</span>`).join(''):'<span>Core evidence is complete—have a professional review it.</span>'}</div></div>
      <div class="disclaimer"><strong>Important—preliminary guide only.</strong> This rule-based tool is not a formal valuation, appraisal, lender valuation, tax/insurance valuation, agent’s estimated selling price or Victorian Statement of Information. It cannot inspect the property, verify title/easements, zoning, defects, school-zone boundaries or whether a sale is genuinely comparable. Plans and photos are stored for human review and are not automatically analysed. Verify current comparable sales and obtain advice from a licensed estate agent and/or Certified Practising Valuer before buying, selling, lending or making another financial decision.<br><br><a class="source-link" href="https://www.land.vic.gov.au/valuations/resources-and-reports/property-sales-statistics" target="_blank" rel="noopener">Valuer-General Victoria property sales statistics ↗</a> · <a class="source-link" href="https://www.consumer.vic.gov.au/housing/buying-and-selling-property/understanding-property-prices-and-underquoting-for-buyers" target="_blank" rel="noopener">Consumer Affairs Victoria pricing guidance ↗</a></div>`;
  }

  function showStep(step){document.querySelectorAll('[data-step]').forEach(panel=>panel.classList.toggle('active',Number(panel.dataset.step)===step));document.querySelectorAll('[data-progress]').forEach(item=>{const value=Number(item.dataset.progress);item.classList.toggle('active',value===step);item.classList.toggle('done',value<step)});scrollTo({top:0,behavior:'smooth'})}
  function saveDraft(){localStorage.setItem(DRAFT_KEY,JSON.stringify({state:readState(),savedAt:new Date().toISOString()}));toast('Draft saved on this device. Attachments are saved only when you save to a Project.')}
  function toast(message){const node=document.createElement('div');node.className='acp-toast';node.textContent=message;document.body.appendChild(node);setTimeout(()=>node.remove(),3200)}
  function fileList(){selectedFiles=[...$('propertyFiles').files];$('fileList').innerHTML=selectedFiles.map(file=>`<span class="file-chip">${esc(file.name)} · ${(file.size/1048576).toFixed(1)} MB</span>`).join('')}
  function clearEstimate(){if(!confirm('Start a new property estimate? This clears the current unsaved form and result.'))return;localStorage.removeItem(DRAFT_KEY);recordRef=null;lastResult=null;selectedFiles=[];document.querySelectorAll('input,textarea').forEach(input=>{if(input.type!=='checkbox'&&input.type!=='file')input.value='';if(input.type==='checkbox')input.checked=false});$('region').value='metro';$('propertyType').value='house';$('comparables').innerHTML='';comparableCount=0;[{},{},{}].forEach(addComparable);$('fileList').innerHTML='';document.body.classList.remove('result-ready');showStep(1)}

  document.querySelectorAll('[data-next]').forEach(button=>button.addEventListener('click',()=>{try{if(Number(button.dataset.next)>1)validate(readState());showStep(Number(button.dataset.next))}catch(error){alert(error.message)}}));
  document.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>showStep(Number(button.dataset.back))));
  $('addComparable').addEventListener('click',()=>addComparable());$('propertyFiles').addEventListener('change',fileList);$('saveDraft').addEventListener('click',saveDraft);$('print').addEventListener('click',()=>print());$('newEstimate').addEventListener('click',clearEstimate);
  $('calculate').addEventListener('click',()=>{try{const state=readState();lastResult=calculateValue(state);renderResult(lastResult,state);document.body.classList.add('result-ready');showStep(4);localStorage.setItem(DRAFT_KEY,JSON.stringify({state,result:lastResult,savedAt:new Date().toISOString()}))}catch(error){alert(error.message)}});

  window.ACProjectCapture=async()=>{
    if(!lastResult)throw new Error('Calculate the property value guide before saving it to a Project.');const state=readState(),name=state.estimateName.trim()||state.suburb.trim()||'Property';
    return{module:'property-estimate',title:`${name} — Property Value Guide`,summary:`${money(lastResult.low)} – ${money(lastResult.high)} · ${lastResult.label}`,attachments:selectedFiles,recordRef,data:{state,result:lastResult,audit:{method:'Rule-based comparable-sales property value guide',evidenceCount:lastResult.comparables.length,confidence:lastResult.confidence,generatedAt:lastResult.calculatedAt,savedAt:new Date().toISOString(),generatedBy:window.ACAuth?.user?.()?.email||'authorised user',humanChanges:[]}}};
  };
  window.ACProjectSaved=({projectId,recordId})=>{recordRef={projectId,recordId};if(selectedFiles.length){selectedFiles=[];$('propertyFiles').value='';$('fileList').innerHTML='<span class="file-chip">Files saved with this Project record.</span>'}const state=readState();if(state.followUpDate){const project=window.ACProjects?.get(projectId),marker=`property-estimate:${recordId}`;if(project&&!project.tasks?.some(task=>task.notes===marker))window.ACProjects.addTask(projectId,{title:`Review property value estimate — ${state.suburb}`,dueDate:state.followUpDate,priority:'Normal',notes:marker})}};

  function initialise(){
    let payload=null;try{payload=JSON.parse(localStorage.getItem(RESTORE_KEY)||'null')}catch(_){}if(payload){localStorage.removeItem(RESTORE_KEY);writeState(payload.state||{});recordRef=payload.projectId&&payload.recordId?{projectId:payload.projectId,recordId:payload.recordId}:null;if(payload.result){lastResult=payload.result;renderResult(lastResult,readState());document.body.classList.add('result-ready');showStep(4)}$('restoreNote').classList.add('show');return}
    try{const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(draft?.state){writeState(draft.state);if(draft.result){lastResult=draft.result;renderResult(lastResult,readState());document.body.classList.add('result-ready')}}else writeState({})}catch(_){writeState({})}
  }
  window.ACPropertyEstimator={calculate:calculateValue,benchmarks:BENCHMARKS,benchmarkDate:BENCHMARK_DATE};
  initialise();
})();
