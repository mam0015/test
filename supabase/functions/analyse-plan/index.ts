import { withSupabase } from "jsr:@supabase/server@^1";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS=new Set(["https://mam0015.github.io","http://localhost:4173","http://127.0.0.1:4173"]);
const ALLOWED_FILE_TYPES=new Set(["application/pdf","image/png","image/jpeg","image/webp","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain","text/csv"]);
const MAX_DATA_URL_LENGTH=22_000_000;

type CatalogItem={name:string;rate:number};
type TradeConfig={label:string;required:string;rules:string;catalog:CatalogItem[]};

// Future Carpentry module scaffold. It is intentionally excluded from TRADE_CONFIG,
// so no Carpentry request can be submitted until verified prices and plan rules exist.
// When the module is ready, move this entry into TRADE_CONFIG and populate catalog.
const FUTURE_TRADE_CONFIG={
  carpentry:{enabled:false,label:"Carpentry",required:"",rules:"",catalog:[] as CatalogItem[]}
};

const TRADE_CONFIG:Record<string,TradeConfig>={
  electrical:{
    label:"Electrical",
    required:"An electrical layout with visible electrical symbols, switching/power information, annotations or an electrical legend. An ordinary architectural floor plan without electrical information is not enough.",
    rules:"Use supply-and-install items for new work unless the plan explicitly says replacement or install-only. Follow the plan legend for single/double outlets and switch gangs. Do not infer switchboard, circuits, mains, smoke alarms, appliances, solar, EV charging, security or other unpriced scope.",
    catalog:[
      {name:"LED Downlight - Supply, wiring & install",rate:65},{name:"LED Downlight - Install only",rate:45},{name:"Bathroom Wall Light - Install on tiles",rate:160},{name:"Outdoor Entrance Light",rate:180},{name:"Shaving Cabinet Light",rate:240},{name:"Power Point - New wiring & install",rate:65},{name:"Power Point - Replacement / fit off",rate:35},{name:"Double Power Point with extra switch",rate:75},{name:"Weatherproof Power Point",rate:150},{name:"1 Gang Light Switch - Replacement",rate:35},{name:"1 Gang Light Switch - New wiring",rate:65},{name:"2 Gang Light Switch - Replacement",rate:40},{name:"2 Gang Light Switch - New wiring",rate:75},{name:"3 Gang Light Switch - Replacement",rate:45},{name:"3 Gang Light Switch - New wiring",rate:85},{name:"4 Gang Light Switch - Replacement",rate:65},{name:"Rotary LED Dimmer",rate:90},{name:"Electric Towel Heater",rate:220},{name:"Non-Electric Towel Rack",rate:85},{name:"3-in-1 Fan / Heat / Light Combo",rate:250},{name:"Rangehood Duct",rate:320},{name:"TV Antenna Point",rate:55},{name:"Data Point",rate:55}
    ]
  },
  plumbing:{
    label:"Plumbing",
    required:"A plumbing, hydraulic, sanitary, drainage or services plan showing enough plumbing scope to quantify. Visible toilets or sinks on an ordinary architectural plan alone are not enough to price rough-in and fit-off reliably.",
    rules:"Do not double count a bathroom/ensuite/laundry/kitchen rough-in package together with individual rough-in points for the same scope. Fit-off items may be counted separately only when the requested scope includes fit-off. Never infer gas work, concrete cutting, drain alteration or call-outs unless noted on the plumbing documentation.",
    catalog:[
      {name:"Bathroom Rough-In Package",rate:3200},{name:"Ensuite Rough-In Package",rate:3700},{name:"Ground Floor Bathroom Rough-In",rate:2500},{name:"Laundry Rough-In",rate:800},{name:"Kitchen Rough-In",rate:1100},{name:"Retreat Sink Rough-In",rate:700},{name:"New Water Point Rough-In",rate:220},{name:"Waste Point Rough-In",rate:180},{name:"Wall Mixer Rough-In",rate:160},{name:"Smart Toilet Setup",rate:190},{name:"Rain Shower Nogging",rate:150},{name:"Toilet Fit-Off",rate:320},{name:"Vanity Basin Fit-Off",rate:300},{name:"Shower Fit-Off",rate:380},{name:"Bath Fit-Off",rate:420},{name:"Kitchen Sink Fit-Off",rate:330},{name:"Laundry Trough Fit-Off",rate:260},{name:"Water to Fridge Fit-Off",rate:190},{name:"Dishwasher Connection",rate:260},{name:"Gas Line Alteration",rate:410},{name:"Gas Hot Plate Fit-Off",rate:330},{name:"Concrete Saw Cut / Jackhammer Allowance",rate:650},{name:"Sanitary Drain Alteration",rate:480},{name:"Coloured Bath Waste + Flexible Connection",rate:250},{name:"Call-Out / Minor Plumbing Item",rate:165}
    ]
  },
  cladding:{
    label:"Cladding",
    required:"Building elevations or a cladding/material schedule that clearly identifies cladding extents plus dimensions or a usable scale. A floor plan without measurable cladding elevations is not enough.",
    rules:"For a plan-based estimate prefer the m² rate, relevant corner moulding quantities and one delivery. Never combine m²/LM calculations with a full invoice package because that double counts material. Deduct openings only when dimensions are visible.",
    catalog:[
      {name:"Thermory Pine Trax Natural C32 Cladding - 140 x 20 LM",rate:15.71},{name:"Thermory C32 Cladding - 5.4m Length",rate:84.97},{name:"Thermory C32 Cladding - estimated material coverage m²",rate:112.25},{name:"Thermory C32 Cladding - 28 Lengths / 151.40 LM",rate:2379.24},{name:"42 x 42 THERMOLIT SPR Corner Mould CP3 @ 4200mm",rate:46.42},{name:"42 x 42 THERMOLIT SPR Corner Mould CP3 LM",rate:11.05},{name:"Corner Moulding Pack - 6 Pieces",rate:278.50},{name:"Delivery Charge / Express Delivery UTE",rate:86.36},{name:"Original Invoice Package - 28 Lengths + 4 Corners + Delivery",rate:2651.24},{name:"Revised Invoice Package - 28 Lengths + 6 Corners + Delivery",rate:2744.10},{name:"Order Confirmation Package - 28 Lengths + Delivery, no corners",rate:2465.60}
    ]
  }
};

const PLAN_SCHEMA={type:"object",additionalProperties:false,properties:{
  status:{type:"string",enum:["success","missing_trade_plan"]},
  summary:{type:"string"},
  items:{type:"array",items:{type:"object",additionalProperties:false,properties:{catalog_index:{type:"integer",minimum:0},quantity:{type:"number",minimum:0},confidence:{type:"string",enum:["high","medium","low"]},evidence:{type:"string"}},required:["catalog_index","quantity","confidence","evidence"]}},
  assumptions:{type:"array",items:{type:"string"}},warnings:{type:"array",items:{type:"string"}},unpriced_items:{type:"array",items:{type:"string"}}
},required:["status","summary","items","assumptions","warnings","unpriced_items"]};

const QUOTE_SCHEMA={type:"object",additionalProperties:false,properties:{
  supplier:{type:"string"},quote_number:{type:"string"},summary:{type:"string"},
  gst_treatment:{type:"string",enum:["ex_gst","inc_gst","mixed","unknown"]},
  quote_total_ex_gst:{type:"number",minimum:0},quote_total_inc_gst:{type:"number",minimum:0},
  items:{type:"array",items:{type:"object",additionalProperties:false,properties:{
    quoted_name:{type:"string"},description:{type:"string"},quantity:{type:"number",minimum:0},
    quoted_unit_price_ex_gst:{type:"number",minimum:0},quoted_line_total_ex_gst:{type:"number",minimum:0},
    catalog_index:{type:"integer",minimum:-1},match_confidence:{type:"string",enum:["high","medium","low","none"]},
    evidence:{type:"string"},notes:{type:"string"}
  },required:["quoted_name","description","quantity","quoted_unit_price_ex_gst","quoted_line_total_ex_gst","catalog_index","match_confidence","evidence","notes"]}},
  warnings:{type:"array",items:{type:"string"}}
},required:["supplier","quote_number","summary","gst_treatment","quote_total_ex_gst","quote_total_inc_gst","items","warnings"]};

function cors(origin:string|null){const allowed=origin&&ALLOWED_ORIGINS.has(origin)?origin:"https://mam0015.github.io";return{"Access-Control-Allow-Origin":allowed,"Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function json(body:unknown,status:number,origin:string|null){return new Response(JSON.stringify(body),{status,headers:{...cors(origin),"Content-Type":"application/json"}})}
function outputText(response:any){if(typeof response?.output_text==="string")return response.output_text;for(const output of response?.output||[])for(const content of output?.content||[])if(content.type==="output_text"&&typeof content.text==="string")return content.text;return""}
function round(value:number){return Math.round((Number(value)||0)*100)/100}

async function callOpenAI(apiKey:string,payload:Record<string,unknown>){
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.error?.message||`OpenAI request failed (${response.status}).`);
  return data;
}

function filePart(body:any){
  const type=String(body.fileType||"");
  if(type.startsWith("image/"))return{type:"input_image",image_url:body.fileData,detail:"high"};
  const part:any={type:"input_file",filename:String(body.fileName||"document").slice(0,180),file_data:body.fileData};
  if(type==="application/pdf")part.detail="high";
  return part;
}

function catalogueText(trade:TradeConfig){return trade.catalog.map((item,index)=>`${index} | ${item.name} | ${item.rate.toFixed(2)} ex GST`).join("\n")}

async function liveTrade(request:Request,tradeKey:string,baseTrade:TradeConfig){
  const url=Deno.env.get("SUPABASE_URL"),apikey=request.headers.get("apikey")||Deno.env.get("SUPABASE_ANON_KEY")||"",authorization=request.headers.get("authorization")||"";
  if(!url||!apikey||!authorization)return baseTrade;
  try{
    const response=await fetch(`${url}/rest/v1/price_catalogue?trade=eq.${encodeURIComponent(tradeKey)}&active=eq.true&select=sort_order,item_name,builder_rate&order=sort_order`,{headers:{apikey,authorization}});
    if(!response.ok)return baseTrade;
    const catalogue=baseTrade.catalog.map(item=>({...item}));
    for(const row of await response.json())if(Number.isInteger(Number(row.sort_order))&&catalogue[Number(row.sort_order)])catalogue[Number(row.sort_order)]={name:String(row.item_name||catalogue[Number(row.sort_order)].name),rate:Number(row.builder_rate)};
    return{...baseTrade,catalog:catalogue};
  }catch(_){return baseTrade}
}

async function analysePlan(apiKey:string,model:string,trade:TradeConfig,body:any){
  const scanMode=body.scanMode==="smart"?"smart":"fast";
  const modeInstruction=scanMode==="smart"
    ?"Perform a deep, careful review. Inspect every relevant page, legend, schedule, symbol family, room and revision. Cross-check counts and explicitly look for duplicates."
    :"Perform one efficient vision pass. Prioritise the plan legend, standard trade symbols and clear annotations. Do not spend time on speculative interpretation; flag uncertainty instead.";
  const prompt=`You are a cautious Australian residential ${trade.label} plan take-off estimator. ${modeInstruction}

FIRST PERFORM A STRICT DOCUMENT GATE.
Required documentation: ${trade.required}
If the requirement is not satisfied, return status "missing_trade_plan", an empty items array, and no priceable assumptions. Explain plainly that the selected ${trade.label} plan is missing and the matter must be discussed with the Builder.

If and only if the gate passes, perform this symbol take-off workflow:
1. Find and read the drawing legend/key first. Learn what each symbol means on THIS drawing; use standard Australian construction symbols only when the drawing has no legend.
2. Locate each occurrence of those symbols in the drawing area. Never count the example symbol shown inside the legend itself.
3. Count by page and room/zone, then cross-check the total against schedules and notes.
4. Map only supported quantities to the fixed catalogue below. Do not invent an item merely because a room normally contains it.
5. A single final plan does not prove that an item was moved or replaced. Classify replacement, relocation, install-only or existing work only when existing/demolition/proposed drawings, revision clouds or explicit notes support it. Otherwise use the new-work catalogue item and add a warning.
6. Do not count symbols from another trade and do not count duplicate/revision sheets twice.

Trade rules: ${trade.rules}

Fixed Alert Construction catalogue. The first number is catalog_index and the final number is the fixed ex-GST rate:
${catalogueText(trade)}

Only matched catalogue items belong in items. Put other visible scope in unpriced_items. Never change rates. Include page, room/zone, symbol/legend label or dimension evidence for every quantity. Assign high, medium or low confidence to every priced line. If the symbol is unclear, do not guess: add a warning and leave it unpriced.

User request: ${String(body.question||`Calculate the ${trade.label} work from this plan.`).slice(0,3000)}`;
  const data=await callOpenAI(apiKey,{model,reasoning:{effort:scanMode==="smart"?"high":"low"},input:[{role:"user",content:[filePart(body),{type:"input_text",text:prompt}]}],text:{format:{type:"json_schema",name:"trade_plan_estimate",strict:true,schema:PLAN_SCHEMA}},store:true,max_output_tokens:scanMode==="smart"?6500:4500});
  const analysis=JSON.parse(outputText(data));if(analysis.status!=="success"){analysis.status="missing_trade_plan";analysis.items=[]}
  analysis.method=scanMode;
  return{analysis,responseId:data.id};
}

function normaliseQuote(extracted:any,trade:TradeConfig){
  const items=(Array.isArray(extracted.items)?extracted.items:[]).map((raw:any)=>{
    let quantity=Math.max(0,Number(raw.quantity)||0);if(!quantity)quantity=1;
    let unit=Math.max(0,Number(raw.quoted_unit_price_ex_gst)||0),line=Math.max(0,Number(raw.quoted_line_total_ex_gst)||0);
    if(!line&&unit)line=unit*quantity;if(!unit&&line&&quantity)unit=line/quantity;
    let index=Number(raw.catalog_index);
    const confidence=String(raw.match_confidence||"none");
    if(!Number.isInteger(index)||index<0||index>=trade.catalog.length||confidence==="low"||confidence==="none")index=-1;
    const ac=index>=0?round(trade.catalog[index].rate*quantity):0,difference=index>=0&&line>0?round(line-ac):0;
    const status=index<0||line<=0?"unmatched":difference>100?"expensive":difference< -100?"cheap":"fair";
    return{quoted_name:String(raw.quoted_name||"Quoted item"),description:String(raw.description||""),quantity:round(quantity),quoted_unit_price_ex_gst:round(unit),quoted_line_total_ex_gst:round(line),catalog_index:index,match_confidence:confidence,evidence:String(raw.evidence||""),notes:String(raw.notes||""),ac_unit_rate:index>=0?trade.catalog[index].rate:0,ac_line_total_ex_gst:ac,difference_ex_gst:difference,status};
  }).filter((item:any)=>item.quoted_name||item.quoted_line_total_ex_gst>0);
  let exTotal=Math.max(0,Number(extracted.quote_total_ex_gst)||0),incTotal=Math.max(0,Number(extracted.quote_total_inc_gst)||0);
  if(!exTotal&&incTotal&&extracted.gst_treatment==="inc_gst")exTotal=incTotal/1.1;
  if(!exTotal)exTotal=items.reduce((sum:number,item:any)=>sum+item.quoted_line_total_ex_gst,0);
  if(!incTotal&&exTotal)incTotal=exTotal*1.1;
  const counts={expensive:0,cheap:0,fair:0,unmatched:0};items.forEach((item:any)=>counts[item.status as keyof typeof counts]++);
  return{supplier:String(extracted.supplier||""),quote_number:String(extracted.quote_number||""),summary:String(extracted.summary||""),gst_treatment:String(extracted.gst_treatment||"unknown"),quote_total_ex_gst:round(exTotal),quote_total_inc_gst:round(incTotal),items,warnings:Array.isArray(extracted.warnings)?extracted.warnings.map(String):[],counts};
}

async function analyseQuote(apiKey:string,model:string,trade:TradeConfig,body:any){
  const prompt=`You are reviewing a real Australian ${trade.label} trade quote. Accuracy matters more than speed.

Read every page and table carefully. Extract every actual priced line item. Do not treat headings, subtotals, GST, deposits, payment schedules, balances, discounts or grand totals as line items. Preserve the supplier's wording and scope.

For each priced line:
1. Extract its quantity, ex-GST unit price and ex-GST line total.
2. If the document shows GST-inclusive pricing, convert the unit and line amount to ex GST by dividing by 1.10.
3. Match it to exactly one AC catalogue item only when the scope and unit basis genuinely align.
4. Use catalog_index -1 and confidence "none" when no reliable match exists.
5. Never spread a lump-sum total across unpriced scope and never invent missing prices or quantities.
6. Distinguish supply-and-install, installation-only, replacement, package, per-item, lineal-metre and square-metre scope.
7. Avoid double counting a package and its descriptive sub-items.

Fixed AC catalogue (the first number is catalog_index; rate is ex GST):
${catalogueText(trade)}

Return quote totals on both ex-GST and inc-GST bases when the document supports them. Clearly warn about exclusions, provisional sums, ambiguous GST, unclear quantities, unmatched scope, duplicated alternatives or anything that can make the comparison unreliable. Do not decide whether the overall quote is expensive from its total; the application will calculate each line separately using a fixed $100 line-item threshold.`;
  const data=await callOpenAI(apiKey,{model,reasoning:{effort:"high"},input:[{role:"user",content:[filePart(body),{type:"input_text",text:prompt}]}],text:{format:{type:"json_schema",name:"trade_quote_extraction",strict:true,schema:QUOTE_SCHEMA}},store:false,max_output_tokens:6500});
  const extracted=JSON.parse(outputText(data)),analysis:any=normaliseQuote(extracted,trade);
  analysis.market_review={summary:"Compared only with the fixed Alert Construction catalogue. Edit any uncertain match before use.",sources:[]};
  return{analysis,responseId:data.id};
}

async function processRequest(request:Request){
  const origin=request.headers.get("origin");
  if(request.method!=="POST")return json({error:"Method not allowed."},405,origin);
  const apiKey=Deno.env.get("OPENAI_API_KEY");if(!apiKey)return json({error:"Review service is not configured."},503,origin);
  try{
    const body=await request.json(),baseTrade=TRADE_CONFIG[body.trade];if(!baseTrade)return json({error:"Select Electrical, Plumbing or Cladding."},400,origin);
    const trade=await liveTrade(request,String(body.trade),baseTrade);
    const model=Deno.env.get("OPENAI_MODEL")||"gpt-5.6";
    if(body.mode==="question"){
      if(!body.previousResponseId||!body.question)return json({error:"A completed plan analysis and question are required."},400,origin);
      const data=await callOpenAI(apiKey,{model,previous_response_id:body.previousResponseId,input:[{role:"user",content:[{type:"input_text",text:String(body.question).slice(0,3000)}]}],store:true,max_output_tokens:1800});
      return json({answer:outputText(data),responseId:data.id},200,origin);
    }
    if(!body.fileData||!body.fileName)return json({error:body.mode==="quote"?"Upload a quote before analysing it.":"Upload a plan before sending."},400,origin);
    if(!["analyse","quote"].includes(String(body.mode||"")))return json({error:"Unsupported analysis mode."},400,origin);
    const fileType=String(body.fileType||"").toLowerCase();
    if(!ALLOWED_FILE_TYPES.has(fileType))return json({error:"Upload a PDF, Word, PNG, JPG, WEBP, TXT or CSV file."},400,origin);
    const fileData=String(body.fileData||"");
    if(fileData.length>MAX_DATA_URL_LENGTH)return json({error:"The file is too large."},413,origin);
    if(!fileData.startsWith(`data:${fileType};base64,`))return json({error:"The uploaded file data is invalid."},400,origin);
    const result=body.mode==="quote"?await analyseQuote(apiKey,model,trade,body):await analysePlan(apiKey,model,trade,body);
    return json(result,200,origin);
  }catch(error){console.error("analysis error",error instanceof Error?error.message:error);return json({error:"AI analysis failed. Check the Edge Function logs and OPENAI_API_KEY, then try again."},500,origin)}
}

const authenticatedFetch=withSupabase({auth:["publishable","secret"]},async(request,ctx)=>{
  const origin=request.headers.get("origin");
  // Public browser calls must come from the deployed Alert Construction origin.
  // Secret-key server calls may omit Origin for controlled testing and automation.
  if(String(ctx.authMode).startsWith("publishable")&&!origin)return json({error:"Origin required."},403,origin);
  if(String(ctx.authMode).startsWith("publishable")&&!/^Bearer\s+ey/i.test(request.headers.get("authorization")||""))return json({error:"Sign in before using AI analysis."},401,origin);
  return processRequest(request);
});

export default {
  fetch(request:Request){
    const origin=request.headers.get("origin");
    if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:"Origin not allowed."},403,origin);
    if(request.method==="OPTIONS")return new Response("ok",{headers:cors(origin)});
    return authenticatedFetch(request);
  }
};
