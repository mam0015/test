(function(global){
  'use strict';
  const rows=[];
  function add(trade,items){items.forEach((item,index)=>rows.push({item_key:`${trade}:${index}`,trade,sort_order:index,name:item[0],builder_rate:Number(item[1]),unit:item[2]||'each',customer_margin:20,active:true,source:'existing-ac-calculator'}))}
  add('electrical',[
    ['LED Downlight - Supply, wiring & install',65],['LED Downlight - Install only',45],['Bathroom Wall Light - Install on tiles',160],['Outdoor Entrance Light',180],['Shaving Cabinet Light',240],['Power Point - New wiring & install',65],['Power Point - Replacement / fit off',35],['Double Power Point with extra switch',75],['Weatherproof Power Point',150],['1 Gang Light Switch - Replacement',35],['1 Gang Light Switch - New wiring',65],['2 Gang Light Switch - Replacement',40],['2 Gang Light Switch - New wiring',75],['3 Gang Light Switch - Replacement',45],['3 Gang Light Switch - New wiring',85],['4 Gang Light Switch - Replacement',65],['Rotary LED Dimmer',90],['Electric Towel Heater',220],['Non-Electric Towel Rack',85],['3-in-1 Fan / Heat / Light Combo',250],['Rangehood Duct',320],['TV Antenna Point',55],['Data Point',55]
  ]);
  add('plumbing',[
    ['Bathroom Rough-In Package',3200],['Ensuite Rough-In Package',3700],['Ground Floor Bathroom Rough-In',2500],['Laundry Rough-In',800],['Kitchen Rough-In',1100],['Retreat Sink Rough-In',700],['New Water Point Rough-In',220],['Waste Point Rough-In',180],['Wall Mixer Rough-In',160],['Smart Toilet Setup',190],['Rain Shower Nogging',150],['Toilet Fit-Off',320],['Vanity Basin Fit-Off',300],['Shower Fit-Off',380],['Bath Fit-Off',420],['Kitchen Sink Fit-Off',330],['Laundry Trough Fit-Off',260],['Water to Fridge Fit-Off',190],['Dishwasher Connection',260],['Gas Line Alteration',410],['Gas Hot Plate Fit-Off',330],['Concrete Saw Cut / Jackhammer Allowance',650],['Sanitary Drain Alteration',480],['Coloured Bath Waste + Flexible Connection',250],['Call-Out / Minor Plumbing Item',165]
  ]);
  add('cladding',[
    ['Thermory Pine Trax Natural C32 Cladding - 140 x 20 LM',15.71,'LM'],['Thermory C32 Cladding - 5.4m Length',84.97,'length'],['Thermory C32 Cladding - estimated material coverage m²',112.25,'m²'],['Thermory C32 Cladding - 28 Lengths / 151.40 LM',2379.24,'package'],['42 x 42 THERMOLIT SPR Corner Mould CP3 @ 4200mm',46.42,'each'],['42 x 42 THERMOLIT SPR Corner Mould CP3 LM',11.05,'LM'],['Corner Moulding Pack - 6 Pieces',278.50,'pack'],['Delivery Charge / Express Delivery UTE',86.36,'delivery'],['Original Invoice Package - 28 Lengths + 4 Corners + Delivery',2651.24,'package'],['Revised Invoice Package - 28 Lengths + 6 Corners + Delivery',2744.10,'package'],['Order Confirmation Package - 28 Lengths + Delivery, no corners',2465.60,'package']
  ]);
  global.AC_CATALOGUE_DEFAULTS=rows;
})(window);
