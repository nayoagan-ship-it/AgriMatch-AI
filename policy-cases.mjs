const make=(id,title,condition,result,needs=[],extra={})=>({id,title,condition,result,needs,status:'conditional',sourceIds:[],...extra});
const foodCategory=input=>!['cash','other'].includes(input.category)||!/棉花|烟草|橡胶|亚麻|黄麻/.test(input.product);
const rate=value=>String(value)==='Free'?'基础列值为免税':String(value).replace(/([\d.]+)¢\/kg/g,'每公斤$1美分');

export function buildCaseDiscussion(module,input,country,sources=[]){
  const facts=module.findings.filter(f=>['general','product','reference'].includes(f.status)).map(f=>({text:f.fact,scope:f.scope,status:f.status,sourceIds:f.sourceIds}));
  const rule=key=>module.findings.find(f=>f.ruleKey===key&&f.status!=='lead'),province=input.originProvince,product=input.product,target=country.name,plant=!['livestock','aquatic'].includes(input.category);
  let scenarios=[];
  if(module.id==='posture'){
    scenarios=plant?[
      make('raw','原粮、鲜品或仍有生物活性的原料',`若${product}仍保留籽粒、鲜品或可传播有害生物的形态`,`应走${target}对应商品与原产地的准入、检疫核对路径；不能套用充分加工品的处理结论。`,['具体品种','加工与去活性方式','主管机构准入条件'],{relevant:['fresh','raw','dried','frozen'].includes(input.form)}),
      make('processed','研磨、热处理或其他加工食品',`若已充分加工，且属于${target}规则明确列举或认可的加工品`,`按加工品类别核对许可、食品监管和例外条件；仅选择“加工食品”还不能把所有成分和工艺视为同一准入路径。`,['具体加工工艺','完整配料','是否仍含完整籽粒'],{relevant:input.form==='processed'}),
      make('seed','种子或繁殖材料',`若实际用于播种、繁殖，或按${target}规则被归为繁殖材料`,'应单独核对种苗、品种、植检和许可条件；食用粮食或一般食品的结论不能直接套用。',['种苗用途证明','物种与品种','许可或检疫要求'],{relevant:input.form==='seed'}),
    ]:[
      make('animal-fresh','鲜冻动物产品',`若${product}属于鲜冻肉类、水产品或其他动物源性原料`,`分别核对${target}是否认可原产国、企业、卫生证书与冷链条件；不能仅凭一般食品登记判断准入。`,['动物种类','处理方式','国家及企业资格']),
      make('animal-processed','加工或复合食品',`若已加工或含多种动物、植物配料`,'分别核对加工成品类别及动物源性成分的专项条件，避免成品名称掩盖受控配料。',['配料比例','热处理参数','企业登记']),
    ];
    if(country.id==='US'&&rule('us-processed-wheat'))scenarios.unshift(make('us-wheat-listed','面粉等清单列举的非繁殖性小麦加工品','若实际货物属于APHIS列举的小麦磨制产品，并符合清单例外条件','在APHIS这一监管范围内通常可按一般准许路径处理，无需该范围的进口许可或植物检疫证书；到港检查、FDA和海关要求仍保留。',['确认具体品类与例外条件'],{status:'official-conditional',relevant:true,sourceIds:rule('us-processed-wheat').sourceIds}));
    if(country.id==='US'&&rule('us-processed-millet'))scenarios.unshift(make('us-millet-listed','经明确列举工艺处理的粟类','若实际经碱处理、制麦芽、蒸煮或精碾，且符合APHIS清单例外条件','按APHIS一般准许规则核对其监管范围内的许可及植检待遇；不能仅凭“去壳”或“加工食品”就认定满足这些工艺。FDA与海关要求分别核对。',['实际工艺及参数','清单条件和例外','其他主管机关要求'],{status:'official-conditional',relevant:input.form!=='seed',sourceIds:rule('us-processed-millet').sourceIds}));
    if(country.id==='JP'&&rule('jp-whole-millet'))scenarios.unshift(make('jp-millet-whole','保持完整谷粒的食用粟或黍','若货物仍为未压缩、切碎、破碎或磨粉的谷类籽粒','日本证书要求的例示包含粟和黍；按规定准备植物检疫证书并核对进口检查。去壳不是免证的充分条件，原产地禁限仍须另查。',['物种与加工状态','植物检疫证书','中国原产进口条件'],{status:'official-conditional',relevant:input.form!=='seed',sourceIds:rule('jp-whole-millet').sourceIds}));
    if(country.id==='KR'&&rule('kr-food-registration'))scenarios.unshift(make('kr-food-register','一般进口食品的设施登记与申报','若属于一般经营性进口食品，且境外设施已按MFDS要求登记','可继续核对进口申报、检验与品类条件；登记完成不是所有商品已获准进口的证明。',['境外设施登记状态','首次或重复进口','是否属于特殊卫生管控品类'],{status:'official-conditional',relevant:input.form!=='seed',sourceIds:rule('kr-food-registration').sourceIds}));
  }
  if(module.id==='tariff'){
    const candidates=module.findings.flatMap(f=>(f.tariffCandidates||[]).map(row=>({...row,sourceIds:f.sourceIds}))),groups=new Map();
    for(const row of candidates){
      const hs=row.hs.replace(/\D/g,''),title=product==='小麦'?(hs.startsWith('1101')?'小麦粉或混合麦粉':hs.startsWith('1108')?'小麦淀粉':hs.startsWith('1904')?'粗粒或其他加工谷物':hs.startsWith('1001')?'未加工小麦籽粒':'其他小麦加工品'):'按包装、成分与加工条件匹配的细目';
      const key=title+'|'+row.generalRate;if(!groups.has(key))groups.set(key,{title,rows:[]});groups.get(key).rows.push(row);
    }
    for(const [key,group] of groups)scenarios.push(make('tariff-'+scenarios.length,group.title,`若实际报关商品归入对应官方税则细目`,`${rate(group.rows[0].generalRate)}，这是该细目的基础列值；优惠、配额和原产地附加税还要分别确认，不能直接当作总税负。`,['报关归类','包装和配料条件','报关日期'],{status:'official-conditional',relevant:true,sourceIds:group.rows[0].sourceIds}));
    scenarios.push(
      make('normal-rate','不符合或不申请优惠条件','若没有可适用的优惠安排，或未提交满足要求的原产地证明',`应按${target}对应税目与原产地的常规待遇核对税费；不能用协定伙伴身份直接代替资格证明。`,['目标国税目','原产地认定','适用日期']),
      make('preference','满足优惠安排及证明条件','若存在适用协定，并同时满足产品原产地标准、证明和运输等条款','再按该协定对应税目和实施年度判断待遇；同一产品不能把不同协定的最优条款任意拼接。',['适用协定','原产地证明','产品特定规则']),
      make('extra-quota','涉及专项附加税、配额或许可证','若目标国对该原产地或税目另有措施','需将措施范围、配额资格和基础税率分别核对；资料缺失时不报零、不自动计算总税负。',['专项措施清单','配额或许可资格','生效与到期时间']),
    );
    if(country.id==='KR'&&rule('kr-preferential-origin'))scenarios.unshift(make('kr-fta','按适用FTA申请韩国优惠待遇','若实际商品满足选定协定的原产地标准并备有规定的证明','可以继续核对该协定对应税目和实施年度的优惠待遇；未满足原产标准或证明要求时，不能仅凭中国产地申报优惠。',['适用协定及税目','原产地证明','运输与加工条件'],{status:'official-conditional',sourceIds:rule('kr-preferential-origin').sourceIds}));
  }
  if(module.id==='regulation'){
    scenarios=[
      make('food','作为普通食品进入市场',`若${product}按${target}普通食品类别进口`,'核对进口商及生产设施条件、食品安全、残留和标签要求；原文中的例外需逐项满足。',['食品类别','进口商与设施状态','配料与标签'],{relevant:input.form!=='seed'&&foodCategory(input)}),
      make('plant-animal','同时受到植物或动物卫生监管',plant?'若货物仍属于受管制植物产品、籽粒或繁殖材料':'若涉及动物源性原料或受特殊卫生管控品类','食品合规与卫生检疫分别核对；满足一套规则不自动替代另一主管机构要求。',['物种品种','加工方式','检疫证书及处理条件'],{relevant:input.form==='seed'||['fresh','raw','frozen'].includes(input.form)}),
      make('special','作为饲料、种苗或特殊成分产品',`若实际用途、成分或宣称使其进入${target}另一监管类别`,'改按对应类别讨论残留、标签、登记和许可；不能沿用普通食用成品的检验结论。',['实际用途与宣称','特殊成分','对应主管机关']),
    ];
  }
  if(module.id==='origin'){
    scenarios=[
      make('national','措施按国家或关税原产地适用',`若${target}文件以国家或关税原产地为适用对象`,`以实际原产认定核对；${province}提供生产地区信息，本身不是减税、豁免或禁限证据。`,['实际生产加工链','原产地认定标准']),
      make('regional','措施明确列出地区、疫区或省份',`若官方文件明确覆盖${province}或与供应链有关的特定地区`,'按明确列举的产品、地区和有效期判断；未被资料明确覆盖时，不扩大或缩小措施范围。',['地区名单','产品范围','措施有效日期']),
      make('facility','措施针对企业、工厂或供应链',`若${target}采用境外设施登记、认可企业或受限企业名单`,'以实际工厂和供应链是否匹配名单判断；不能仅凭“产自中国某省”替代企业核对。',['工厂名称及编号','实际供应链','名单状态']),
    ];
    if(['HK','MO','TW'].includes(input.originCode))scenarios.unshift(make('customs-territory','所选省级地区对应独立关税地区','若货物原产地对应香港、澳门或台湾等关税地区','按实际关税地区核对税则、原产地规则及监管文件；不要自动套用中国内地原产待遇。',['实际原产关税地区','运输与加工事实'],{relevant:true}));
  }
  if(module.id==='support'){
    scenarios=[
      make('importer-facilitation','有条件的进口商或通关便利','若存在官方便利计划，且进口商、供应商及货物均满足其资格','可以按计划申请或使用所列便利；没有取得资格时仍按常规流程，便利不等同于免税。',['计划是否现行','申请主体资格','货物是否在批准范围内']),
      make('local-subsidy','政策扶持目标国本地生产者',`若措施受益对象是${target}农户或本地加工企业`,'应解读为当地产业扶持，不把这类补贴写成中国出口企业可直接申领的进口支持。',['受益主体','地域条件','补贴适用对象']),
      make('no-proof','尚未取得专项支持的充分证据','若只有一般机构入口、合作倡议身份或不完整搜索结果','不预设存在补贴、优惠或快速通关待遇；可保留明确的资格核对项，而不是宣称没有政策。',['具体政策文件','适用产品','申请或生效条件']),
    ];
    if(country.id==='US'&&rule('us-vqip'))scenarios.unshift(make('vqip','FDA VQIP获批进口商及覆盖食品','若进口商已符合资格、申请获批并完成所需缴费','可在获批食品范围内享有相应进口审查和入境便利；未入选货物仍按常规程序处理。',['进口商获批状态','批准覆盖的食品'],{status:'official-conditional',sourceIds:rule('us-vqip').sourceIds}));
  }
  if(module.id==='changes'){
    scenarios=[
      make('effective','已生效且覆盖本产品的正式措施','若已取得正式文件，且生效日、原产地和产品范围均匹配','将变化列为当前适用要求，并说明改变了什么；生效范围之外的产品不套用。',['正式文件','生效时间','产品与原产地范围']),
      make('draft','草案、征求意见或已发布待生效','若文件尚在征求意见，或正式措施尚未到生效日','只展示准备事项与预期影响，不能写成已经实施的进口义务。',['文件阶段','拟生效或正式生效日期']),
      make('transition','延期、过渡期或执行安排变化','若原文明确调整实施或执行时间','分别说明原始生效安排和当前执行政策；不能把一个字段或程序的延期扩大为全部监管要求延期。',['延期对象','过渡安排','新时间点']),
      make('unknown','资料仅为旧规则、手册更新或检索线索','若没有取得可对应本产品的正式变化依据','保留已知规则和核对清单；不把“没有查到”写成“近期没有变化”。',['最近正式公告','废止替代关系','时间线']),
    ];
    if(country.id==='US'&&rule('us-prior-notice-update'))scenarios.unshift(make('us-mail','食品通过国际邮件进口','若涉及FDA所述国际邮件食品预先通知的新字段','区分2026年10月1日原始安排与截至2027年5月1日的执行预期；普通商业货运不直接套用这项邮件字段延期。',['是否为国际邮件','报关和提交通知日期'],{status:'official-conditional',sourceIds:rule('us-prior-notice-update').sourceIds}));
  }
  scenarios=scenarios.map(row=>({...row,statusLabel:row.status==='official-conditional'?'官方规则下的条件结果':'条件讨论 · 待匹配资料'}));
  const headline=module.findings.find(f=>f.status==='product')?.fact||module.findings.find(f=>f.ruleKey)?.fact||module.findings.find(f=>f.status==='reference')?.fact||module.findings[0]?.fact;
  const focus={posture:'不同加工形态走不同准入核对路径',tariff:'常规税费、协定优惠和专项措施分开核对',regulation:'食品监管、卫生检疫与特殊用途分别适用',origin:'按国家、地区和企业名单分别核对',support:'进口便利与当地产业补贴分开判断',changes:'已生效、待生效和过渡安排分别判断'};
  const summary=headline||`${target}对${product}：${focus[module.id]}。专项依据仍需匹配，展开可直接查看${scenarios.length}类情形的结果与条件。`;
  return {summary,confirmedFacts:facts,scenarios,discussionNote:'以下为面向用户的条件判断结果；“若”所列条件未被证实时，不等于该情形已经适用于本批货物。',verificationNotes:['已确认事实与条件讨论分别标注。','监管资格、税收待遇、原产地和生效时间分开核对。','官方目录只是核对入口，不能代替商品专项条文。']};
}
