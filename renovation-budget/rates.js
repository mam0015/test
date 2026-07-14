(function(global){
  'use strict';

  /*
    Verified AC prices below are copied in the same order/value from the
    existing Electrical, Plumbing and Cladding calculators. They are builder
    prices ex GST. The planner applies the app-wide 20% customer margin and
    then 10% GST.

    Other rates are editable planning allowances, not verified AC trade rates.
    They are deliberately labelled as allowances everywhere in the result.
  */
  const verified={
    electrical:{
      downlightSupply:{name:'LED Downlight — supply, wiring & install',rate:65,unit:'each'},
      downlightInstall:{name:'LED Downlight — install only',rate:45,unit:'each'},
      bathroomWallLight:{name:'Bathroom Wall Light — install on tiles',rate:160,unit:'each'},
      entranceLight:{name:'Outdoor Entrance Light',rate:180,unit:'each'},
      shavingLight:{name:'Shaving Cabinet Light',rate:240,unit:'each'},
      powerPointNew:{name:'Power Point — new wiring & install',rate:65,unit:'each'},
      powerPointReplace:{name:'Power Point — replacement / fit-off',rate:35,unit:'each'},
      doublePowerPoint:{name:'Double Power Point with extra switch',rate:75,unit:'each'},
      weatherproofPower:{name:'Weatherproof Power Point',rate:150,unit:'each'},
      switch1Replace:{name:'1 Gang Light Switch — replacement',rate:35,unit:'each'},
      switch1New:{name:'1 Gang Light Switch — new wiring',rate:65,unit:'each'},
      switch2Replace:{name:'2 Gang Light Switch — replacement',rate:40,unit:'each'},
      switch2New:{name:'2 Gang Light Switch — new wiring',rate:75,unit:'each'},
      switch3Replace:{name:'3 Gang Light Switch — replacement',rate:45,unit:'each'},
      switch3New:{name:'3 Gang Light Switch — new wiring',rate:85,unit:'each'},
      switch4New:{name:'4 Gang Light Switch — new wiring',rate:65,unit:'each'},
      dimmer:{name:'Rotary LED Dimmer',rate:90,unit:'each'},
      towelHeater:{name:'Electric Towel Heater',rate:220,unit:'each'},
      towelRack:{name:'Non-Electric Towel Rack',rate:85,unit:'each'},
      fanHeatLight:{name:'3-in-1 Fan / Heat / Light Combo',rate:250,unit:'each'},
      rangehoodDuct:{name:'Rangehood Duct',rate:320,unit:'each'},
      tvPoint:{name:'TV Antenna Point',rate:55,unit:'each'},
      dataPoint:{name:'Data Point',rate:55,unit:'each'}
    },
    plumbing:{
      bathroomRoughIn:{name:'Bathroom Rough-In Package',rate:3200,unit:'bathroom'},
      ensuiteRoughIn:{name:'Ensuite Rough-In Package',rate:3700,unit:'ensuite'},
      groundBathroomRoughIn:{name:'Ground Floor Bathroom Rough-In',rate:2500,unit:'bathroom'},
      laundryRoughIn:{name:'Laundry Rough-In',rate:800,unit:'laundry'},
      kitchenRoughIn:{name:'Kitchen Rough-In',rate:1100,unit:'kitchen'},
      retreatSinkRoughIn:{name:'Retreat Sink Rough-In',rate:700,unit:'sink'},
      waterPoint:{name:'New Water Point Rough-In',rate:220,unit:'point'},
      wastePoint:{name:'Waste Point Rough-In',rate:180,unit:'point'},
      wallMixer:{name:'Wall Mixer Rough-In',rate:160,unit:'each'},
      smartToilet:{name:'Smart Toilet Setup',rate:190,unit:'each'},
      rainShowerNogging:{name:'Rain Shower Nogging',rate:150,unit:'each'},
      toiletFitOff:{name:'Toilet Fit-Off',rate:320,unit:'each'},
      vanityFitOff:{name:'Vanity Basin Fit-Off',rate:300,unit:'each'},
      showerFitOff:{name:'Shower Fit-Off',rate:380,unit:'each'},
      bathFitOff:{name:'Bath Fit-Off',rate:420,unit:'each'},
      kitchenSinkFitOff:{name:'Kitchen Sink Fit-Off',rate:330,unit:'each'},
      laundryTroughFitOff:{name:'Laundry Trough Fit-Off',rate:260,unit:'each'},
      fridgeWater:{name:'Water to Fridge Fit-Off',rate:190,unit:'each'},
      dishwasher:{name:'Dishwasher Connection',rate:260,unit:'each'},
      gasAlteration:{name:'Gas Line Alteration',rate:410,unit:'each'},
      gasCooktop:{name:'Gas Hot Plate Fit-Off',rate:330,unit:'each'},
      concreteCut:{name:'Concrete Saw Cut / Jackhammer Allowance',rate:650,unit:'allowance'},
      drainAlteration:{name:'Sanitary Drain Alteration',rate:480,unit:'each'},
      bathWaste:{name:'Coloured Bath Waste + Flexible Connection',rate:250,unit:'each'},
      minorItem:{name:'Call-Out / Minor Plumbing Item',rate:165,unit:'each'}
    },
    cladding:{
      linealMetre:{name:'Thermory Pine Trax Natural C32 Cladding',rate:15.71,unit:'LM'},
      length54:{name:'Thermory C32 Cladding — 5.4m Length',rate:84.97,unit:'length'},
      coverage:{name:'Thermory C32 Cladding — material coverage',rate:112.25,unit:'m²'},
      package28:{name:'Thermory C32 — 28 Lengths / 151.40 LM',rate:2379.24,unit:'package'},
      corner42:{name:'42 x 42 Thermolit Corner Mould @ 4200mm',rate:46.42,unit:'each'},
      cornerLm:{name:'42 x 42 Thermolit Corner Mould',rate:11.05,unit:'LM'},
      cornerPack:{name:'Corner Moulding Pack — 6 pieces',rate:278.50,unit:'pack'},
      delivery:{name:'Cladding Delivery',rate:86.36,unit:'delivery'},
      originalPackage:{name:'Original Invoice Package',rate:2651.24,unit:'package'},
      revisedPackage:{name:'Revised Invoice Package',rate:2744.10,unit:'package'},
      orderPackage:{name:'Order Confirmation Package',rate:2465.60,unit:'package'}
    }
  };

  const allowances={
    demolition:{
      bathroom:{name:'Bathroom demolition and strip-out',rate:2800,unit:'room'},
      kitchen:{name:'Kitchen demolition and strip-out',rate:3400,unit:'room'},
      laundry:{name:'Laundry demolition and strip-out',rate:1500,unit:'room'},
      interior:{name:'General internal demolition',rate:48,unit:'m² of floor area'},
      waste:{name:'Waste removal and disposal',rate:950,unit:'load'}
    },
    waterproofing:{
      bathroom:{name:'Bathroom waterproofing',rate:105,unit:'m²'},
      laundry:{name:'Laundry waterproofing',rate:90,unit:'m²'}
    },
    tiling:{
      floorInstall:{name:'Floor tile installation',rate:105,unit:'m²'},
      wallInstall:{name:'Wall tile installation',rate:125,unit:'m²'},
      splashbackInstall:{name:'Splashback tile installation',rate:135,unit:'m²'},
      tileSupply:{name:'Tile supply allowance',rate:55,unit:'m²'}
    },
    cabinetry:{
      kitchen:{name:'Kitchen cabinetry and joinery',rate:1150,unit:'linear metre'},
      vanity:{name:'Bathroom vanity allowance',rate:1250,unit:'each'},
      laundry:{name:'Laundry cabinetry and joinery',rate:900,unit:'linear metre'},
      wardrobe:{name:'Built-in wardrobe allowance',rate:1800,unit:'each'}
    },
    benchtop:{
      stone:{name:'Engineered stone / porcelain benchtop allowance',rate:720,unit:'m²'},
      laminate:{name:'Laminate benchtop allowance',rate:280,unit:'m²'}
    },
    fixtures:{
      bathroom:{name:'Bathroom fixtures and fittings allowance',rate:2800,unit:'bathroom'},
      bath:{name:'Bath supply allowance',rate:950,unit:'each'},
      showerScreen:{name:'Frameless shower screen allowance',rate:1150,unit:'each'},
      kitchenSink:{name:'Kitchen sink and tap allowance',rate:850,unit:'kitchen'},
      laundryTrough:{name:'Laundry trough and tap allowance',rate:650,unit:'laundry'},
      appliances:{name:'Kitchen appliance allowance',rate:5200,unit:'kitchen'}
    },
    carpentry:{
      bathroomPrep:{name:'Bathroom carpentry and substrate preparation',rate:1750,unit:'room'},
      kitchenPrep:{name:'Kitchen carpentry and wall preparation',rate:2100,unit:'room'},
      laundryPrep:{name:'Laundry carpentry and wall preparation',rate:900,unit:'room'},
      wallChange:{name:'Internal wall modification allowance',rate:2300,unit:'wall'},
      internalDoor:{name:'Internal door replacement',rate:720,unit:'door'},
      skirting:{name:'Skirting and architrave allowance',rate:32,unit:'linear metre'},
      deck:{name:'Timber/composite deck allowance',rate:520,unit:'m²'},
      pergola:{name:'Pergola allowance',rate:980,unit:'m²'}
    },
    plastering:{
      wetArea:{name:'Wet-area plaster and patching',rate:850,unit:'room'},
      walls:{name:'Internal plaster repair allowance',rate:28,unit:'m² of floor area'}
    },
    painting:{
      bathroom:{name:'Bathroom painting allowance',rate:780,unit:'room'},
      kitchen:{name:'Kitchen painting allowance',rate:900,unit:'room'},
      laundry:{name:'Laundry painting allowance',rate:580,unit:'room'},
      interior:{name:'Whole-interior painting allowance',rate:52,unit:'m² of floor area'},
      exterior:{name:'Exterior painting allowance',rate:68,unit:'m² of wall area'}
    },
    flooring:{
      hybrid:{name:'Hybrid flooring — supply and install',rate:88,unit:'m²'},
      carpet:{name:'Carpet — supply and install',rate:62,unit:'m²'},
      timber:{name:'Engineered timber — supply and install',rate:175,unit:'m²'},
      tile:{name:'Internal floor tiles — supply and install',rate:165,unit:'m²'}
    },
    exterior:{
      claddingInstall:{name:'Cladding installation allowance',rate:92,unit:'m²'},
      landscaping:{name:'Landscaping allowance',rate:185,unit:'m²'},
      fence:{name:'New fencing allowance',rate:180,unit:'linear metre'},
      exteriorDoor:{name:'External door replacement allowance',rate:2200,unit:'door'},
      window:{name:'Window replacement allowance',rate:1450,unit:'window'},
      gutter:{name:'Gutter and downpipe allowance',rate:105,unit:'linear metre'}
    },
    professional:{
      design:{name:'Design, documentation and permit allowance',rate:6500,unit:'project'},
      engineering:{name:'Engineering allowance',rate:3500,unit:'project'},
      preliminaries:{name:'Site setup and project preliminaries',rate:4200,unit:'project'},
      cleaning:{name:'Final clean and handover allowance',rate:1400,unit:'project'}
    }
  };

  global.ACRenovationRates={
    verified,
    allowances,
    customerMargin:0.20,
    gst:0.10,
    qualityMultipliers:{essential:0.82,standard:1,premium:1.35,luxury:1.75},
    qualityLabels:{essential:'Essential / Budget',standard:'Standard',premium:'Premium',luxury:'Luxury'},
    missingVerifiedCatalogues:['Tiling','Carpentry & framing','Cabinetry & joinery','Waterproofing','Demolition','Painting','Flooring','Roofing','Windows & doors','Landscaping','Concreting','Heating & cooling','Permits & design']
  };
  const catalogue=global.AC_CATALOGUE_DEFAULTS||(global.AC_CATALOGUE_DEFAULTS=[]),tradeMap={demolition:'demolition',waterproofing:'waterproofing',tiling:'tiling',cabinetry:'cabinetry',benchtop:'benchtops',fixtures:'fixtures',carpentry:'carpentry',plastering:'plastering',painting:'painting',flooring:'flooring',exterior:'exterior',professional:'professional'};
  Object.entries(allowances).forEach(([group,items])=>Object.entries(items).forEach(([key,item],index)=>catalogue.push({item_key:`renovation:${group}:${key}`,trade:tradeMap[group]||'general',sort_order:index,name:item.name,builder_rate:Number(item.rate),unit:item.unit,customer_margin:20,active:true,source:'planning-allowance'})));
})(window);
