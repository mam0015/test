(function(){
  'use strict';
  const R=window.ACRenovationRates;
  if(!R)throw new Error('Renovation rates could not be loaded.');

  const DRAFT_KEY='ac_renovation_budget_draft_v1';
  const RESTORE_KEY='ac_project_renovation_restore_v1';
  const $=id=>document.getElementById(id);
  const money=value=>Number(value||0).toLocaleString('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0});
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number=value=>Math.max(0,Number(value)||0);
  const yes=value=>String(value)==='yes';
  function syncLiveRates(){if(!window.ACPriceCatalogue)return;['electrical','plumbing','cladding'].forEach(trade=>Object.values(R.verified[trade]||{}).forEach((item,index)=>{item.rate=window.ACPriceCatalogue.effectiveRate(trade,index,item.rate)}));Object.entries(R.allowances).forEach(([group,items])=>Object.entries(items).forEach(([key,item])=>{const row=window.ACPriceCatalogue.list().find(value=>value.item_key===`renovation:${group}:${key}`);if(row)item.rate=Number(row.builder_rate)}))}
  if(window.ACPriceCatalogue){window.ACPriceCatalogue.ready.then(syncLiveRates);window.addEventListener('ac-catalogue-changed',syncLiveRates)}

  const categories=[
    {id:'full-house',icon:'⌂',name:'Full House Renovation',description:'Kitchen, bathrooms, laundry, interiors, exterior and project costs.',scopes:['bathroom','kitchen','laundry','interior','exterior','project']},
    {id:'bathroom',icon:'◫',name:'Bathroom',description:'One or multiple bathrooms, including plumbing, electrical, tiling and fixtures.',scopes:['bathroom']},
    {id:'kitchen',icon:'▤',name:'Kitchen',description:'Cabinetry, benchtops, services, appliances, splashback and finishes.',scopes:['kitchen']},
    {id:'bath-kitchen',icon:'◇',name:'Bathroom + Kitchen',description:'A combined estimate with separate questions and cost breakdowns.',scopes:['bathroom','kitchen']},
    {id:'laundry',icon:'◉',name:'Laundry',description:'Cabinetry, plumbing, waterproofing, tiling and electrical work.',scopes:['laundry']},
    {id:'interior',icon:'▥',name:'Living & Bedrooms',description:'Painting, flooring, doors, wardrobes, walls and electrical upgrades.',scopes:['interior']},
    {id:'exterior',icon:'△',name:'Exterior & Outdoor',description:'Cladding, painting, windows, landscaping, deck, pergola and fencing.',scopes:['exterior']},
    {id:'custom',icon:'＋',name:'Custom / Multiple Areas',description:'Choose any combination of renovation areas for one estimate.',scopes:[]}
  ];

  const scopeInfo={
    bathroom:{name:'Bathroom',description:'Wet-area layout, fixtures, finishes and services'},
    kitchen:{name:'Kitchen',description:'Cabinetry, appliances, finishes and services'},
    laundry:{name:'Laundry',description:'Wet-area finishes, storage and services'},
    interior:{name:'Living Areas & Bedrooms',description:'Flooring, painting, carpentry and electrical'},
    exterior:{name:'Exterior & Outdoor',description:'Cladding, painting and outdoor improvements'},
    project:{name:'Project & Professional Costs',description:'Permits, engineering, site setup and handover'}
  };

  const option=(value,label)=>({value,label});
  const yesNo=[option('yes','Yes'),option('no','No')];
  const questions={
    bathroom:[
      {id:'bathroomCount',label:'How many bathrooms are included?',type:'number',min:1,max:10,step:1,default:1,help:'Include ensuites if they are part of this renovation.'},
      {id:'bathroomFloorArea',label:'Total bathroom floor area (m²)',type:'number',min:1,step:.5,default:6},
      {id:'bathroomWallTileArea',label:'Total wall tile area (m²)',type:'number',min:0,step:.5,default:20,help:'Use the combined tiled wall area for all selected bathrooms.'},
      {id:'bathroomPlumbing',label:'Plumbing work required',type:'choice',default:'full',options:[option('full','Full rough-in + fit-off'),option('fitoff','Fit-off only'),option('none','No plumbing')]},
      {id:'bathroomLayout',label:'Are plumbing locations changing?',type:'choice',default:'keep',options:[option('keep','Keep existing layout'),option('change','Change layout')]},
      {id:'toiletCount',label:'Number of toilets',type:'number',min:0,step:1,default:1},
      {id:'vanityCount',label:'Number of vanities',type:'number',min:0,step:1,default:1},
      {id:'showerCount',label:'Number of showers',type:'number',min:0,step:1,default:1},
      {id:'bathCount',label:'Number of baths',type:'number',min:0,step:1,default:0},
      {id:'bathroomDemolition',label:'Include demolition and waste removal?',type:'choice',default:'yes',options:yesNo},
      {id:'bathroomTiling',label:'Include tile supply and installation?',type:'choice',default:'yes',options:yesNo},
      {id:'bathroomFixtures',label:'Include fixtures and fittings allowance?',type:'choice',default:'yes',options:yesNo},
      {id:'bathroomDownlights',label:'New downlights',type:'number',min:0,step:1,default:4},
      {id:'bathroomPowerPoints',label:'New power points',type:'number',min:0,step:1,default:2},
      {id:'bathroomWallLights',label:'Bathroom wall lights',type:'number',min:0,step:1,default:1},
      {id:'bathroomFanHeaters',label:'3-in-1 fan / heat / light units',type:'number',min:0,step:1,default:1},
      {id:'bathroomTowelHeaters',label:'Electric towel heaters',type:'number',min:0,step:1,default:0}
    ],
    kitchen:[
      {id:'kitchenCount',label:'How many kitchens are included?',type:'number',min:1,max:5,step:1,default:1},
      {id:'kitchenFloorArea',label:'Kitchen floor area (m²)',type:'number',min:1,step:.5,default:16},
      {id:'kitchenCabinetLm',label:'Cabinetry length (linear metres)',type:'number',min:0,step:.5,default:7,help:'Include base and tall cabinetry once. This is a planning quantity.'},
      {id:'kitchenBenchtopArea',label:'Benchtop area (m²)',type:'number',min:0,step:.5,default:5},
      {id:'kitchenBenchtop',label:'Benchtop type',type:'choice',default:'stone',options:[option('stone','Stone / porcelain'),option('laminate','Laminate')]},
      {id:'kitchenSplashbackArea',label:'Splashback area (m²)',type:'number',min:0,step:.5,default:4},
      {id:'kitchenPlumbing',label:'Plumbing work required',type:'choice',default:'full',options:[option('full','Full rough-in + fit-off'),option('fitoff','Fit-off only'),option('none','No plumbing')]},
      {id:'kitchenGas',label:'Gas cooktop or gas line work?',type:'choice',default:'no',options:yesNo},
      {id:'kitchenDemolition',label:'Include demolition and waste removal?',type:'choice',default:'yes',options:yesNo},
      {id:'kitchenAppliances',label:'Include an appliance allowance?',type:'choice',default:'yes',options:yesNo},
      {id:'kitchenFlooring',label:'New kitchen flooring',type:'choice',default:'none',options:[option('none','Keep existing'),option('hybrid','Hybrid'),option('tile','Tiles'),option('timber','Engineered timber')]},
      {id:'kitchenWallChanges',label:'Internal walls to modify',type:'number',min:0,step:1,default:0},
      {id:'kitchenDownlights',label:'New downlights',type:'number',min:0,step:1,default:4},
      {id:'kitchenPowerPoints',label:'New power points',type:'number',min:0,step:1,default:6},
      {id:'kitchenRangehood',label:'Include rangehood duct installation?',type:'choice',default:'yes',options:yesNo}
    ],
    laundry:[
      {id:'laundryCount',label:'How many laundries are included?',type:'number',min:1,max:4,step:1,default:1},
      {id:'laundryFloorArea',label:'Laundry floor area (m²)',type:'number',min:1,step:.5,default:5},
      {id:'laundryCabinetLm',label:'Laundry cabinetry (linear metres)',type:'number',min:0,step:.5,default:2.5},
      {id:'laundryPlumbing',label:'Plumbing work required',type:'choice',default:'full',options:[option('full','Full rough-in + fit-off'),option('fitoff','Fit-off only'),option('none','No plumbing')]},
      {id:'laundryDemolition',label:'Include demolition and waste removal?',type:'choice',default:'yes',options:yesNo},
      {id:'laundryTiling',label:'Include floor tiles and waterproofing?',type:'choice',default:'yes',options:yesNo},
      {id:'laundryDownlights',label:'New downlights',type:'number',min:0,step:1,default:2},
      {id:'laundryPowerPoints',label:'New power points',type:'number',min:0,step:1,default:3}
    ],
    interior:[
      {id:'interiorFloorArea',label:'Internal renovation area (m²)',type:'number',min:1,step:1,default:120},
      {id:'interiorPainting',label:'Paint the interior?',type:'choice',default:'yes',options:yesNo},
      {id:'flooringType',label:'Main flooring type',type:'choice',default:'hybrid',options:[option('none','Keep existing'),option('hybrid','Hybrid'),option('carpet','Carpet'),option('timber','Engineered timber'),option('tile','Tiles')]},
      {id:'flooringArea',label:'New flooring area (m²)',type:'number',min:0,step:1,default:100},
      {id:'internalDoors',label:'Internal doors to replace',type:'number',min:0,step:1,default:0},
      {id:'wardrobes',label:'Built-in wardrobes',type:'number',min:0,step:1,default:0},
      {id:'interiorWallChanges',label:'Internal walls to modify',type:'number',min:0,step:1,default:0},
      {id:'skirtingLm',label:'New skirting / architrave (linear metres)',type:'number',min:0,step:1,default:0},
      {id:'interiorDownlights',label:'New downlights',type:'number',min:0,step:1,default:20},
      {id:'interiorPowerPoints',label:'New power points',type:'number',min:0,step:1,default:12},
      {id:'dataPoints',label:'New data points',type:'number',min:0,step:1,default:2},
      {id:'tvPoints',label:'New TV antenna points',type:'number',min:0,step:1,default:2}
    ],
    exterior:[
      {id:'claddingArea',label:'New cladding area (m²)',type:'number',min:0,step:1,default:0,help:'Thermory material pricing uses the existing AC Cladding calculator rate.'},
      {id:'claddingCorners',label:'Cladding corner mouldings',type:'number',min:0,step:1,default:0},
      {id:'exteriorPaintArea',label:'Exterior paint area (m²)',type:'number',min:0,step:1,default:0},
      {id:'landscapeArea',label:'Landscaping area (m²)',type:'number',min:0,step:1,default:0},
      {id:'deckArea',label:'Deck area (m²)',type:'number',min:0,step:1,default:0},
      {id:'pergolaArea',label:'Pergola area (m²)',type:'number',min:0,step:1,default:0},
      {id:'fenceLength',label:'New fencing (linear metres)',type:'number',min:0,step:1,default:0},
      {id:'windowCount',label:'Windows to replace',type:'number',min:0,step:1,default:0},
      {id:'exteriorDoors',label:'External doors to replace',type:'number',min:0,step:1,default:0},
      {id:'gutterLength',label:'Gutters / downpipes (linear metres)',type:'number',min:0,step:1,default:0},
      {id:'exteriorPowerPoints',label:'Weatherproof power points',type:'number',min:0,step:1,default:0},
      {id:'entranceLights',label:'Outdoor entrance lights',type:'number',min:0,step:1,default:0}
    ],
    project:[
      {id:'designPermit',label:'Include design, documentation and permits?',type:'choice',default:'yes',options:yesNo},
      {id:'engineering',label:'Include an engineering allowance?',type:'choice',default:'yes',options:yesNo},
      {id:'preliminaries',label:'Include site setup and project preliminaries?',type:'choice',default:'yes',options:yesNo},
      {id:'finalClean',label:'Include final clean and handover?',type:'choice',default:'yes',options:yesNo}
    ]
  };

  function freshState(){return{version:1,step:1,category:'',project:{name:'',client:'',budget:0,propertyType:'House',quality:'standard',contingency:15,goal:'Improve comfort and appearance'},scopes:[],priorities:{},answers:{},result:null}}
  let state=freshState(),recordRef=null;

  function defaultPriority(scope){return['bathroom','kitchen'].includes(scope)?'must':'important'}
  function defaultAnswer(question){return question.default==null?'':question.default}
  function ensureScopeDefaults(){
    state.scopes.forEach(scope=>{
      if(!state.priorities[scope])state.priorities[scope]=defaultPriority(scope);
      (questions[scope]||[]).forEach(question=>{if(state.answers[question.id]===undefined)state.answers[question.id]=defaultAnswer(question)});
    });
  }

  function renderCategories(){
    $('categoryGrid').innerHTML=categories.map(category=>`<button class="category ${state.category===category.id?'selected':''}" type="button" data-category="${category.id}"><div class="category-icon">${category.icon}</div><strong>${esc(category.name)}</strong><span>${esc(category.description)}</span><div class="check">${state.category===category.id?'✓ Selected':'Select'}</div></button>`).join('');
    $('categoryGrid').querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>selectCategory(button.dataset.category)));
    $('customScopes').classList.toggle('show',state.category==='custom');
    $('customScopeGrid').innerHTML=Object.entries(scopeInfo).map(([id,info])=>`<label class="scope-check"><input type="checkbox" value="${id}" ${state.scopes.includes(id)?'checked':''}><span>${esc(info.name)}</span></label>`).join('');
    $('customScopeGrid').querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{
      state.scopes=[...$('customScopeGrid').querySelectorAll('input:checked')].map(item=>item.value);ensureScopeDefaults();saveDraft(false);
    }));
  }

  function selectCategory(id){
    const category=categories.find(item=>item.id===id);if(!category)return;
    state.category=id;
    if(id!=='custom')state.scopes=[...category.scopes];
    ensureScopeDefaults();renderCategories();saveDraft(false);
  }

  function renderQuestion(question){
    const value=state.answers[question.id]===undefined?defaultAnswer(question):state.answers[question.id];
    if(question.type==='choice'){
      return `<div class="question ${question.full?'full':''}"><label class="title">${esc(question.label)}</label><div class="choice-row">${question.options.map(item=>`<div class="choice"><input type="radio" name="${question.id}" id="${question.id}_${item.value}" value="${item.value}" data-answer="${question.id}" ${String(value)===String(item.value)?'checked':''}><label for="${question.id}_${item.value}">${esc(item.label)}</label></div>`).join('')}</div>${question.help?`<span class="help">${esc(question.help)}</span>`:''}</div>`;
    }
    return `<div class="question ${question.full?'full':''}"><label class="title" for="${question.id}">${esc(question.label)}</label><input id="${question.id}" data-answer="${question.id}" type="number" inputmode="decimal" min="${question.min??0}" ${question.max!=null?`max="${question.max}"`:''} step="${question.step||1}" value="${esc(value)}">${question.help?`<span class="help">${esc(question.help)}</span>`:''}</div>`;
  }

  function renderQuestions(){
    ensureScopeDefaults();
    $('questionGroups').innerHTML=state.scopes.map(scope=>{
      const info=scopeInfo[scope];
      return `<section class="scope-block" data-scope="${scope}"><header class="scope-head"><div><h3>${esc(info.name)}</h3><p>${esc(info.description)}</p></div><select class="priority" data-priority="${scope}" aria-label="${esc(info.name)} priority"><option value="must" ${state.priorities[scope]==='must'?'selected':''}>Must Have</option><option value="important" ${state.priorities[scope]==='important'?'selected':''}>Important</option><option value="optional" ${state.priorities[scope]==='optional'?'selected':''}>Optional</option></select></header><div class="questions">${(questions[scope]||[]).map(renderQuestion).join('')}</div></section>`;
    }).join('');
    $('questionGroups').querySelectorAll('[data-answer]').forEach(input=>input.addEventListener('change',event=>{
      if(event.target.type==='radio'&&!event.target.checked)return;
      state.answers[event.target.dataset.answer]=event.target.type==='number'?number(event.target.value):event.target.value;saveDraft(false);
    }));
    $('questionGroups').querySelectorAll('[data-priority]').forEach(select=>select.addEventListener('change',()=>{state.priorities[select.dataset.priority]=select.value;saveDraft(false)}));
  }

  function syncProjectFromForm(){
    state.project={name:$('projectName').value.trim(),client:$('clientName').value.trim(),budget:number($('budget').value),propertyType:$('propertyType').value,quality:$('quality').value,contingency:number($('contingency').value),goal:$('goal').value};
  }
  function syncProjectToForm(){
    $('projectName').value=state.project.name||'';$('clientName').value=state.project.client||'';$('budget').value=state.project.budget||'';$('propertyType').value=state.project.propertyType||'House';$('quality').value=state.project.quality||'standard';$('contingency').value=String(state.project.contingency||15);$('goal').value=state.project.goal||'Improve comfort and appearance';
  }
  function validateStep(step){
    if(step===1){syncProjectFromForm();if(!state.project.name){alert('Enter the project name or address.');$('projectName').focus();return false}if(state.project.budget<1000){alert('Enter the available renovation budget.');$('budget').focus();return false}}
    if(step===2){if(!state.category){alert('Select a renovation category.');return false}if(!state.scopes.length){alert('Choose at least one renovation area.');return false}}
    return true;
  }
  function goTo(step,skipValidation){
    if(!skipValidation&&step>state.step&&!validateStep(state.step))return;
    state.step=step;
    document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('active',Number(panel.dataset.step)===step));
    document.querySelectorAll('[data-progress]').forEach(item=>{const value=Number(item.dataset.progress);item.classList.toggle('active',value===step);item.classList.toggle('done',value<step)});
    if(step===2)renderCategories();if(step===3)renderQuestions();
    saveDraft(false);window.scrollTo({top:0,behavior:'smooth'});
  }

  function readAnswer(id){return state.answers[id]}
  function buildLines(qualityOverride){
    syncLiveRates();
    const quality=qualityOverride||state.project.quality||'standard',qualityFactor=R.qualityMultipliers[quality]||1,lines=[];
    const priority=scope=>state.priorities[scope]||defaultPriority(scope);
    function add(scope,trade,item,qty,source,options={}){
      qty=number(qty);if(!qty)return;
      const rate=Number(item.rate)*(source==='allowance'&&options.finishSensitive?qualityFactor:1),builder=rate*qty;
      lines.push({id:`${scope}_${trade}_${lines.length}`,scope,trade,name:item.name,qty,unit:item.unit,rate,builder,source,priority:priority(scope),critical:!!options.critical,note:options.note||''});
    }
    const ac=(scope,trade,item,qty,options)=>add(scope,trade,item,qty,'ac',options);
    const allowance=(scope,trade,item,qty,options)=>add(scope,trade,item,qty,'allowance',options);
    const A=R.allowances,V=R.verified;

    if(state.scopes.includes('bathroom')){
      const scope='bathroom',count=number(readAnswer('bathroomCount')),floor=number(readAnswer('bathroomFloorArea')),wall=number(readAnswer('bathroomWallTileArea')),toilets=number(readAnswer('toiletCount')),vanities=number(readAnswer('vanityCount')),showers=number(readAnswer('showerCount')),baths=number(readAnswer('bathCount')),plumbing=readAnswer('bathroomPlumbing');
      if(yes(readAnswer('bathroomDemolition'))){allowance(scope,'Demolition',A.demolition.bathroom,count);allowance(scope,'Demolition',A.demolition.waste,Math.max(1,Math.ceil(count/2)))}
      if(plumbing==='full'){ac(scope,'Plumbing',V.plumbing.bathroomRoughIn,count,{critical:true});if(readAnswer('bathroomLayout')==='change')ac(scope,'Plumbing',V.plumbing.drainAlteration,count,{critical:true})}
      if(plumbing!=='none'){ac(scope,'Plumbing',V.plumbing.toiletFitOff,toilets,{critical:true});ac(scope,'Plumbing',V.plumbing.vanityFitOff,vanities,{critical:true});ac(scope,'Plumbing',V.plumbing.showerFitOff,showers,{critical:true});ac(scope,'Plumbing',V.plumbing.bathFitOff,baths,{critical:true});ac(scope,'Plumbing',V.plumbing.bathWaste,baths,{critical:true})}
      if(yes(readAnswer('bathroomTiling'))){allowance(scope,'Waterproofing',A.waterproofing.bathroom,floor+wall*.35,{critical:true});allowance(scope,'Tiling',A.tiling.tileSupply,floor+wall,{finishSensitive:true});allowance(scope,'Tiling',A.tiling.floorInstall,floor);allowance(scope,'Tiling',A.tiling.wallInstall,wall)}
      allowance(scope,'Carpentry',A.carpentry.bathroomPrep,count,{critical:true});allowance(scope,'Plastering',A.plastering.wetArea,count);allowance(scope,'Painting',A.painting.bathroom,count,{finishSensitive:true});
      if(yes(readAnswer('bathroomFixtures'))){allowance(scope,'Fixtures',A.fixtures.bathroom,count,{finishSensitive:true});allowance(scope,'Cabinetry',A.cabinetry.vanity,vanities,{finishSensitive:true});allowance(scope,'Fixtures',A.fixtures.showerScreen,showers,{finishSensitive:true});allowance(scope,'Fixtures',A.fixtures.bath,baths,{finishSensitive:true})}
      ac(scope,'Electrical',V.electrical.downlightSupply,readAnswer('bathroomDownlights'));ac(scope,'Electrical',V.electrical.powerPointNew,readAnswer('bathroomPowerPoints'));ac(scope,'Electrical',V.electrical.bathroomWallLight,readAnswer('bathroomWallLights'));ac(scope,'Electrical',V.electrical.fanHeatLight,readAnswer('bathroomFanHeaters'));ac(scope,'Electrical',V.electrical.towelHeater,readAnswer('bathroomTowelHeaters'));
    }

    if(state.scopes.includes('kitchen')){
      const scope='kitchen',count=number(readAnswer('kitchenCount')),floor=number(readAnswer('kitchenFloorArea')),plumbing=readAnswer('kitchenPlumbing'),splash=number(readAnswer('kitchenSplashbackArea'));
      if(yes(readAnswer('kitchenDemolition'))){allowance(scope,'Demolition',A.demolition.kitchen,count);allowance(scope,'Demolition',A.demolition.waste,Math.max(1,count))}
      if(plumbing==='full')ac(scope,'Plumbing',V.plumbing.kitchenRoughIn,count,{critical:true});
      if(plumbing!=='none'){ac(scope,'Plumbing',V.plumbing.kitchenSinkFitOff,count,{critical:true});ac(scope,'Plumbing',V.plumbing.dishwasher,count,{critical:true})}
      if(yes(readAnswer('kitchenGas'))){ac(scope,'Plumbing',V.plumbing.gasAlteration,count,{critical:true});ac(scope,'Plumbing',V.plumbing.gasCooktop,count,{critical:true})}
      allowance(scope,'Cabinetry',A.cabinetry.kitchen,readAnswer('kitchenCabinetLm'),{finishSensitive:true});allowance(scope,'Benchtops',readAnswer('kitchenBenchtop')==='laminate'?A.benchtop.laminate:A.benchtop.stone,readAnswer('kitchenBenchtopArea'),{finishSensitive:true});
      if(splash){allowance(scope,'Tiling',A.tiling.tileSupply,splash,{finishSensitive:true});allowance(scope,'Tiling',A.tiling.splashbackInstall,splash)}
      allowance(scope,'Fixtures',A.fixtures.kitchenSink,count,{finishSensitive:true});if(yes(readAnswer('kitchenAppliances')))allowance(scope,'Fixtures',A.fixtures.appliances,count,{finishSensitive:true});
      allowance(scope,'Carpentry',A.carpentry.kitchenPrep,count);allowance(scope,'Carpentry',A.carpentry.wallChange,readAnswer('kitchenWallChanges'),{critical:true});allowance(scope,'Plastering',A.plastering.wetArea,count);allowance(scope,'Painting',A.painting.kitchen,count,{finishSensitive:true});
      const flooring=readAnswer('kitchenFlooring');if(flooring&&flooring!=='none')allowance(scope,'Flooring',A.flooring[flooring],floor,{finishSensitive:true});
      ac(scope,'Electrical',V.electrical.downlightSupply,readAnswer('kitchenDownlights'));ac(scope,'Electrical',V.electrical.powerPointNew,readAnswer('kitchenPowerPoints'));if(yes(readAnswer('kitchenRangehood')))ac(scope,'Electrical',V.electrical.rangehoodDuct,count);
    }

    if(state.scopes.includes('laundry')){
      const scope='laundry',count=number(readAnswer('laundryCount')),floor=number(readAnswer('laundryFloorArea')),plumbing=readAnswer('laundryPlumbing');
      if(yes(readAnswer('laundryDemolition'))){allowance(scope,'Demolition',A.demolition.laundry,count);allowance(scope,'Demolition',A.demolition.waste,1)}
      if(plumbing==='full')ac(scope,'Plumbing',V.plumbing.laundryRoughIn,count,{critical:true});if(plumbing!=='none')ac(scope,'Plumbing',V.plumbing.laundryTroughFitOff,count,{critical:true});
      if(yes(readAnswer('laundryTiling'))){allowance(scope,'Waterproofing',A.waterproofing.laundry,floor,{critical:true});allowance(scope,'Tiling',A.tiling.tileSupply,floor,{finishSensitive:true});allowance(scope,'Tiling',A.tiling.floorInstall,floor)}
      allowance(scope,'Cabinetry',A.cabinetry.laundry,readAnswer('laundryCabinetLm'),{finishSensitive:true});allowance(scope,'Fixtures',A.fixtures.laundryTrough,count,{finishSensitive:true});allowance(scope,'Carpentry',A.carpentry.laundryPrep,count);allowance(scope,'Plastering',A.plastering.wetArea,count);allowance(scope,'Painting',A.painting.laundry,count,{finishSensitive:true});ac(scope,'Electrical',V.electrical.downlightSupply,readAnswer('laundryDownlights'));ac(scope,'Electrical',V.electrical.powerPointNew,readAnswer('laundryPowerPoints'));
    }

    if(state.scopes.includes('interior')){
      const scope='interior',area=number(readAnswer('interiorFloorArea')),flooring=readAnswer('flooringType');
      allowance(scope,'Carpentry',A.carpentry.wallChange,readAnswer('interiorWallChanges'),{critical:true});allowance(scope,'Carpentry',A.carpentry.internalDoor,readAnswer('internalDoors'),{finishSensitive:true});allowance(scope,'Cabinetry',A.cabinetry.wardrobe,readAnswer('wardrobes'),{finishSensitive:true});allowance(scope,'Carpentry',A.carpentry.skirting,readAnswer('skirtingLm'),{finishSensitive:true});
      if(number(readAnswer('interiorWallChanges')))allowance(scope,'Plastering',A.plastering.walls,area);
      if(yes(readAnswer('interiorPainting')))allowance(scope,'Painting',A.painting.interior,area,{finishSensitive:true});if(flooring&&flooring!=='none')allowance(scope,'Flooring',A.flooring[flooring],readAnswer('flooringArea'),{finishSensitive:true});
      ac(scope,'Electrical',V.electrical.downlightSupply,readAnswer('interiorDownlights'));ac(scope,'Electrical',V.electrical.powerPointNew,readAnswer('interiorPowerPoints'));ac(scope,'Electrical',V.electrical.dataPoint,readAnswer('dataPoints'));ac(scope,'Electrical',V.electrical.tvPoint,readAnswer('tvPoints'));
    }

    if(state.scopes.includes('exterior')){
      const scope='exterior',cladding=number(readAnswer('claddingArea'));
      if(cladding){ac(scope,'Cladding',V.cladding.coverage,cladding);ac(scope,'Cladding',V.cladding.corner42,readAnswer('claddingCorners'));ac(scope,'Cladding',V.cladding.delivery,1);allowance(scope,'Cladding',A.exterior.claddingInstall,cladding)}
      allowance(scope,'Painting',A.painting.exterior,readAnswer('exteriorPaintArea'),{finishSensitive:true});allowance(scope,'Landscaping',A.exterior.landscaping,readAnswer('landscapeArea'),{finishSensitive:true});allowance(scope,'Carpentry',A.carpentry.deck,readAnswer('deckArea'),{finishSensitive:true});allowance(scope,'Carpentry',A.carpentry.pergola,readAnswer('pergolaArea'),{finishSensitive:true});allowance(scope,'Fencing',A.exterior.fence,readAnswer('fenceLength'),{finishSensitive:true});allowance(scope,'Windows & Doors',A.exterior.window,readAnswer('windowCount'),{finishSensitive:true});allowance(scope,'Windows & Doors',A.exterior.exteriorDoor,readAnswer('exteriorDoors'),{finishSensitive:true});allowance(scope,'Roofing',A.exterior.gutter,readAnswer('gutterLength'));ac(scope,'Electrical',V.electrical.weatherproofPower,readAnswer('exteriorPowerPoints'));ac(scope,'Electrical',V.electrical.entranceLight,readAnswer('entranceLights'));
    }

    if(state.scopes.includes('project')){
      const scope='project';if(yes(readAnswer('designPermit')))allowance(scope,'Professional',A.professional.design,1);if(yes(readAnswer('engineering')))allowance(scope,'Professional',A.professional.engineering,1);if(yes(readAnswer('preliminaries')))allowance(scope,'Builder',A.professional.preliminaries,1);if(yes(readAnswer('finalClean')))allowance(scope,'Cleaning',A.professional.cleaning,1);
    }
    return lines;
  }

  function totalsFor(lines){
    const builderEx=lines.reduce((sum,line)=>sum+line.builder,0),margin=builderEx*R.customerMargin,customerEx=builderEx+margin,gst=customerEx*R.gst,worksInc=customerEx+gst,contingency=worksInc*(state.project.contingency/100),grand=worksInc+contingency;
    return{builderEx,margin,customerEx,gst,worksInc,contingency,grand,budget:state.project.budget,remaining:state.project.budget-grand,over:Math.max(0,grand-state.project.budget)};
  }

  function recommendations(lines,totals){
    const rank={must:0,important:1,optional:2},sorted=[...lines].sort((a,b)=>(a.priority==='optional')-(b.priority==='optional')||(b.critical-a.critical)||(rank[a.priority]-rank[b.priority])||(b.builder-a.builder)),available=Math.max(0,totals.budget/(1+state.project.contingency/100)),used={value:0},now=[],later=[],optional=[];
    sorted.forEach(line=>{const cost=line.builder*(1+R.customerMargin)*(1+R.gst);if(line.priority==='optional'){optional.push({...line,customerCost:cost});return}if(used.value+cost<=available){now.push({...line,customerCost:cost});used.value+=cost}else later.push({...line,customerCost:cost})});
    return{now,later,optional};
  }

  function calculate(){
    syncProjectFromForm();
    const lines=buildLines(),totals=totalsFor(lines),essentialTotals=state.project.quality==='essential'?totals:totalsFor(buildLines('essential')),recommendation=recommendations(lines,totals);
    state.result={createdAt:new Date().toISOString(),lines,totals,essentialTotal:essentialTotals.grand,recommendation};document.body.classList.add('result-ready');renderResults();goTo(4,true);saveDraft(false);
  }

  function recHtml(items,empty){return items.length?items.map(line=>`<div class="rec-item"><div>${esc(line.name)}<span>${esc(scopeInfo[line.scope]?.name||line.scope)}</span></div><strong>${money(line.customerCost)}</strong></div>`).join(''):`<div class="rec-empty">${esc(empty)}</div>`}
  function renderResults(){
    const result=state.result;if(!result)return;const {lines,totals,recommendation}=result,good=totals.remaining>=0,quality=R.qualityLabels[state.project.quality]||state.project.quality;
    const groups={};lines.forEach(line=>(groups[line.trade]||(groups[line.trade]=[])).push(line));
    const groupHtml=Object.entries(groups).map(([trade,items])=>{
      const total=items.reduce((sum,line)=>sum+line.builder*(1+R.customerMargin)*(1+R.gst),0);
      return `<section class="trade-group"><div class="trade-title"><span>${esc(trade)}</span><strong>${money(total)}</strong></div>${items.map(line=>`<div class="line-item"><div><strong>${esc(line.name)}</strong><small>${line.source==='ac'?'<span class="chip ac">Verified AC rate</span>':'<span class="chip allowance">Planning allowance</span>'} · ${esc(scopeInfo[line.scope]?.name||line.scope)} · ${esc(line.priority==='must'?'Must Have':line.priority==='important'?'Important':'Optional')}</small></div><div class="qty">${Number(line.qty).toLocaleString('en-AU')} ${esc(line.unit)}</div><div class="money">${money(line.builder*(1+R.customerMargin)*(1+R.gst))}</div></div>`).join('')}</section>`;
    }).join('');
    const saving=Math.max(0,totals.grand-result.essentialTotal),alternative=!good&&state.project.quality!=='essential'&&saving>500?` Changing all allowance-based finishes to Essential could reduce this planning total by approximately <strong>${money(saving)}</strong>.`:'';
    $('results').innerHTML=`
      <div class="result-top"><section class="total-card"><div class="total-label">Estimated renovation total inc GST and contingency</div><div class="grand-total">${money(totals.grand)}</div><div class="total-note">${esc(quality)} finish · ${state.project.contingency}% contingency · ${lines.length} priced items</div></section><section class="budget-card"><div class="budget-grid"><div class="budget-stat"><span>Available budget</span><strong>${money(totals.budget)}</strong></div><div class="budget-stat ${good?'good':'bad'}"><span>${good?'Remaining':'Over budget'}</span><strong>${money(good?totals.remaining:totals.over)}</strong></div><div class="budget-stat"><span>Works inc GST</span><strong>${money(totals.worksInc)}</strong></div><div class="budget-stat"><span>Contingency</span><strong>${money(totals.contingency)}</strong></div></div></section></div>
      <div class="result-banner ${good?'good':'bad'}"><strong>${good?'The selected renovation fits within the entered budget.':'The selected renovation is currently over budget.'}</strong>${good?`The planner leaves approximately ${money(totals.remaining)} after the selected work and contingency.`:`You would need approximately ${money(totals.over)} more, or you can move lower-priority work to a later stage.`}${alternative}</div>
      <div class="recommend-grid"><section class="recommend now"><h3>Do Now</h3><div class="recommend-list">${recHtml(recommendation.now,'No non-optional items fit within the entered budget yet.')}</div></section><section class="recommend later"><h3>Do Later</h3><div class="recommend-list">${recHtml(recommendation.later,'All selected Must Have and Important work fits within the budget.')}</div></section><section class="recommend optional"><h3>Optional Upgrades</h3><div class="recommend-list">${recHtml(recommendation.optional,'No areas were marked Optional.')}</div></section></div>
      <section class="breakdown"><div class="breakdown-head"><h3>Itemised Cost Breakdown</h3><div class="legend"><span class="chip ac">Verified AC rate</span><span class="chip allowance">Planning allowance</span></div></div>${groupHtml}<div class="cost-footer"><span>Builder catalogue / allowance subtotal ex GST</span><strong>${money(totals.builderEx)}</strong><span>Customer margin (20%)</span><strong>${money(totals.margin)}</strong><span>GST (10%)</span><strong>${money(totals.gst)}</strong><span>Contingency (${state.project.contingency}%)</span><strong>${money(totals.contingency)}</strong><span class="final">Estimated total</span><strong class="final">${money(totals.grand)}</strong></div></section>
      <section class="missing"><h3>Rates still requiring AC trade data</h3><p>The planner works without AI. Electrical, Plumbing and Thermory Cladding use the existing verified AC calculator rates. The categories below currently use editable planning allowances and should be replaced when your real invoices or trade price lists are available.</p><div class="missing-list">${R.missingVerifiedCatalogues.map(item=>`<span>${esc(item)}</span>`).join('')}</div></section>`;
  }

  function saveDraft(showMessage=true){
    try{syncProjectFromForm();localStorage.setItem(DRAFT_KEY,JSON.stringify({...state,result:null}));if(showMessage)toast('Draft saved on this device')}
    catch(_){if(showMessage)alert('The draft could not be saved on this device.')}
  }
  function toast(message){const el=document.createElement('div');el.className='acp-toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2400)}
  function reset(){if(!confirm('Start a new renovation plan? The current unsaved answers will be cleared.'))return;localStorage.removeItem(DRAFT_KEY);state=freshState();recordRef=null;document.body.classList.remove('result-ready');syncProjectToForm();renderCategories();$('results').innerHTML='';$('restoreNote').classList.remove('show');goTo(1,true)}

  function restoreSaved(){
    try{
      const raw=localStorage.getItem(RESTORE_KEY);if(!raw)return false;localStorage.removeItem(RESTORE_KEY);const saved=JSON.parse(raw),incoming=saved.state||saved;if(!incoming||!incoming.project)return false;
      recordRef=saved.projectId&&saved.recordId?{projectId:saved.projectId,recordId:saved.recordId}:null;state={...freshState(),...incoming,project:{...freshState().project,...incoming.project},answers:{...(incoming.answers||{})},priorities:{...(incoming.priorities||{})},result:null};ensureScopeDefaults();syncProjectToForm();renderCategories();renderQuestions();calculate();$('restoreNote').classList.add('show');return true;
    }catch(_){return false}
  }
  function loadDraft(){
    try{const saved=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(!saved||!saved.project)return;state={...freshState(),...saved,step:1,project:{...freshState().project,...saved.project},result:null};ensureScopeDefaults();syncProjectToForm();renderCategories()}
    catch(_){}
  }

  document.querySelectorAll('[data-next]').forEach(button=>button.addEventListener('click',()=>goTo(Number(button.dataset.next))));
  document.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>goTo(Number(button.dataset.back),true)));
  ['projectName','clientName','budget','propertyType','quality','contingency','goal'].forEach(id=>$(id).addEventListener('change',()=>saveDraft(false)));
  $('saveDraftBtn').addEventListener('click',()=>saveDraft(true));$('calculateBtn').addEventListener('click',calculate);$('printBtn').addEventListener('click',()=>window.print());$('newPlanBtn').addEventListener('click',reset);

  window.ACProjectCapture=async function(){
    if(!state.result)throw new Error('Calculate the renovation estimate before saving it.');
    const total=state.result.totals.grand,category=categories.find(item=>item.id===state.category)?.name||'Renovation';
    return{module:'renovation-budget',title:`${state.project.name} — Renovation Budget Plan`,summary:`${category} • ${money(total)} estimated total`,recordRef,data:{version:1,state:{...state,result:null},result:{createdAt:state.result.createdAt,lines:state.result.lines,totals:state.result.totals,essentialTotal:state.result.essentialTotal}}};
  };

  window.ACProjectSaved=function(detail){if(detail&&detail.module==='renovation-budget')recordRef={projectId:detail.projectId,recordId:detail.recordId}};

  syncProjectToForm();renderCategories();if(!restoreSaved())loadDraft();
})();
