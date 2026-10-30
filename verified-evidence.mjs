import {milletProfile} from './product-profile.mjs';

// Reviewed public rules. Every future query re-reads these addresses; a saved
// excerpt is explicitly distinguished from a successful current retrieval.
const checkedOn='2026-10-15';
const row=(id,module,title,authority,url,quote,overview,scope,extra={})=>({id,module,title,authority,url,quote,overview,scope,interpretation:scope,kind:'verified-excerpt',verifiedOn:checkedOn,savedOn:checkedOn,...extra});
export function verifiedSources(country,input){
 const millet=milletProfile(input),food=input.form!=='seed'&&!/棉花|烟草|橡胶|羊毛/.test(input.product);
 const grain=millet||input.category==='grain';const rows=[];
 if(country.id==='JP'&&grain){
  rows.push(row('jp-grain-phyto','posture','未破碎谷粒的植物检疫证书要求','日本农林水产省植物防疫所','https://www.maff.go.jp/pps/j/introduction/import/ipcfuyou/index.html','イネ科種子（コメ（精米、玄米）、ムギ類（コムギ、オオムギ、ライムギなど）、トウモロコシ、アワ、キビ、ヒエ、カナリーシード、ワイルドライスなど）','日本明确将未压缩、切碎、破碎或磨粉的谷类籽粒列入需检疫证书的范围，例示包括アワ（粟）和キビ（黍）。仅去壳不能直接当作免证。','适用于仍为完整谷粒的食用粮食；同时核对物种、原产地禁限与到港植物检疫。熟制、粉碎或种用须另查。',{productSpecific:Boolean(millet),ruleKey:'jp-whole-millet',publishedDate:'2023-04-01'}));
 }
 if(country.id==='JP'&&millet){
  rows.push(row('jp-millet-tariff','tariff','2026年日本谷物与加工谷物税则','日本海关','https://www.customs.go.jp/english/tariff/2026_04_01/data/e_11.htm','Other worked grains (for example, hulled, pearled, sliced or kibbled)','去壳小米应核对1104项下加工谷物细目；未加工谷子另查1008，磨粉或熟制食品另行归类。不能把带壳原粮税率套到去壳小米。','该表为2026年4月1日版。110429包含多种谷物，需确认日本9位细目及中国RCEP栏；本页不把候选税率当作本单总税负。',{ruleKey:'jp-millet-classification'}));
  rows.push(row('jp-rcep-origin','origin','日本RCEP原产地申请条件','日本海关','https://www.customs.go.jp/english/epa/rcep/rcep.html','Confirm that the good was produced in a Party and is treated as an originating good under the RCEP Agreement','中国原产货物申请日本RCEP待遇，须先确认税目存在优惠，再满足原产地标准、证明与运输条件；省份名称不能代替原产地证明。','这是申请待遇的规则，不证明本批小米已经享有优惠。种植、加工及证明文件仍由企业和进口商核实。'));
  rows.push(row('jp-rcep-transport','support','RCEP运输与通关证明条件','日本海关','https://www.customs.go.jp/english/epa/rcep/rcep4.html','The good has not undergone any further processing in the third country','RCEP项下经第三国转运时，货物须保持协定要求的原产资格，并留存运输或海关监管证明；这可明确准备材料，但不是额外进口补贴。','按实际路线核对直运或转运证明，普通物流可达不等于已满足协定运输条款。'));
 }
 if(country.id==='JP'&&food){
  rows.push(row('jp-monitor-2026','changes','日本2026财年进口食品监视指导计划','日本厚生劳动省','https://www.mhlw.go.jp/content/001711310.pdf','The Plan shall be effective from April 1, 2026 till March 31, 2027.','已取得日本2026财年进口食品监视指导计划，适用期为2026年4月1日至2027年3月31日。应继续核对本产品、原产国及具体检验命令。','这是年度监管安排，不表示新增小米禁令，也不证明这一年度没有其他调整。PDF原文需按链接查看。',{effectiveDate:'2026-04-01',expiryDate:'2027-03-31',pdf:true}));
 }
 if(country.id==='US'&&millet){
  rows.push(row('us-millet-process','posture','APHIS对特定加工粟类的一般准许规则','美国农业部APHIS','https://www.aphis.usda.gov/ace/generally-authorized-non-propagative-plant-products','Millet and Pseudo-millet that were alkali treated, malted, parboiled, or pearled','APHIS一般准许清单列有经碱处理、制麦芽、蒸煮或精碾的粟类。若符合列举工艺与例外，可按该清单核对许可及植检待遇；普通脱壳不直接等同于pearled。','此规则只涉及APHIS监管范围；未匹配加工工艺、原粮或种用仍须查ACIR。FDA、海关和其他措施分别适用。',{productSpecific:true,ruleKey:'us-processed-millet'}));
  rows.push(row('us-millet-tariff','tariff','美国谷物加工品税则候选范围','美国国际贸易委员会USITC','https://hts.usitc.gov/search?query=110429','Other','去壳谷物参考110429，带壳非种用粟类参考100829；美国税负还须按最终8位或10位细目、中国原产措施及申报日分别核对。','这是一组候选归类路径，未确认本单附加税与减免；不得将基础税率当作总税率。'));
  rows.push(row('us-china-origin','origin','对中国原产货物的301措施查询方法','美国贸易代表办公室USTR','https://www.ustr.gov/issue-areas/enforcement/section-301-investigations/search','Every product subject to the Section 301 actions is identified by an 8-digit or 10-digit HTS Subheading.','美国301措施按最终HTS细目核查；中国省份不是判断该措施是否适用的依据。需要结合申报时点核对附加税及排除安排。','查询规则不等于本小米税目一定被加征301税；其他适用贸易措施也需独立核对。'));
 }
 if(country.id==='US'&&food){
  rows.push(row('us-fsvp-evidence','regulation','食品进口商的境外供应商验证义务','美国食品药品监督管理局FDA','https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-foreign-supplier-verification-programs-fsvp-importers-food-humans-and-animals','Foreign Supplier Verification Programs','美国食品进口商需核对FSVP适用性，并按适用规则开展危害分析、供应商评价及验证；另行核对食品设施注册、预先通知和标签。','一般食品规则，存在豁免或调整要求；不是“小米已获准进口”的证明。'));
  rows.push(row('us-food-transport','transport','美国食品运输卫生要求及适用范围','美国食品药品监督管理局FDA','https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-sanitary-transportation-human-and-animal-food','Sanitary Transportation of Human and Animal Food','美国境内相关公路、铁路食品运输须核对卫生运输规则的适用范围和豁免；海运或空运段不能直接套用该规则的范围结论。','可用于核对车辆、清洁与交叉污染要求；不能提供实际航线、运价或清关时间。'));
 }
 if(['DE','FR','NL','IT','ES','PL','BE','SE','DK','FI','IE','AT','PT','GR','CZ','RO','HU','BG','HR','SK','SI','EE','LV','LT','LU','MT','CY'].includes(country.id)&&food){
  rows.push(row('eu-non-animal-controls','posture','非动物源食品的进口检查路径','欧盟委员会','https://food.ec.europa.eu/horizontal-topics/official-controls-and-enforcement/import-controls-food-and-feed-qas_en','certain high-risk food and feed of non-animal origin','小米等植物性食品应核对非动物源食品监管及植物健康规则。强化检查按具体产品、原产国和风险清单适用，不能直接套用动物源食品企业准入名单。','需匹配加工形态、现行2019/1793及其他紧急措施；本条未认定本批货物已经满足进口条件。'));
  rows.push(row('eu-food-controls-origin','origin','强化检查按产品、风险和原产国匹配','欧盟委员会','https://food.ec.europa.eu/horizontal-topics/official-controls-and-enforcement/import-controls-food-and-feed-qas_en','specific hazard and countries of origin','欧盟强化检查清单同时区分产品、危害和原产国；中国其他食品受控，不能推断中国小米同样受控，反之亦然。','应按现行整合清单核对中国原产本税目及用途；没有匹配专项文件时保留待确认，不写成无任何限制。'));
  rows.push(row('eu-grain-regulation','regulation','食品污染物与食品安全框架','欧盟委员会','https://food.ec.europa.eu/food-safety/chemical-safety/contaminants_en','Contaminants','食品须核对适用污染物限量、农药残留、食品标签和可追溯性要求；小米粒、小米粉、婴幼儿食品不能不加区分地套用同一限量。','检测项目与限量应按最终产品类别及现行法规确认；本页未凭一般概览宣布检测合格。'));
  rows.push(row('eu-cn-2026','tariff','欧盟2026年组合税则法定版本','欧盟官方公报','https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ%3AL_202501926','Commission Implementing Regulation (EU) 2025/1926','欧盟2026年组合税则由实施条例2025/1926列示；应按本产品的实际形态确定CN8位细目，并查询中国原产及申报日的TARIC措施。','税则版本不是本单税率确认；增值税、关税与其他费用分别核对。',{pdf:true}));
  rows.push(row('eu-control-support','support','按风险实施进口检查，而非一律同等强化检查','欧盟委员会','https://food.ec.europa.eu/horizontal-topics/official-controls-and-enforcement/import-controls-food-and-feed-qas_en','risk-based system of official controls','非动物源食品采用风险管理。应先确认是否属于专项强化检查对象，再准备对应文件与到港手续；没有证据时不预设出口企业能申领补贴。','该条说明检查机制，不构成小米进口补贴或免检资格。'));
  rows.push(row('eu-control-review','changes','非动物源食品风险清单的复审机制','欧盟委员会','https://food.ec.europa.eu/horizontal-topics/official-controls-and-enforcement/import-controls-food-and-feed-qas_en','The list is reviewed at least every six months','欧盟说明非动物源食品强化检查清单至少每六个月复审。每次出货前须检查现行清单，而不能长期沿用某次查询的结论。','此处已核实的是复审机制，不表示最近一次复审新增或取消了中国小米措施。'));
 }
 // Avoid applying a millet name to another food when sharing the common framework.
 return rows.map(r=>({...r,overview:millet?r.overview:r.overview.replace(/小米等/g,'本产品等').replace(/小米粒、小米粉/g,'原料、加工品').replace(/中国小米/g,'中国原产本产品').replace(/小米/g,'本产品')}));
}

export function evaluationGuidance(input,country){
 const millet=milletProfile(input),food=input.form!=='seed';
 const transportFacts=millet&&['hulled','whole'].includes(millet.kind)?['先按干燥食用谷物核对防潮、防虫、异味隔离及食品接触包装；熟制、冷冻或复合产品需另定方案。','尚未取得承运商报价与船期，不填写虚构运输天数。']:food?['核对与产品形态相符的包装、食品运输卫生、必要温控及检疫文件。','运输、清关、仓储及最低销售期须共同计入交付时间。']:['按实际用途核对运输、包装及相关检疫文件。'];
 const countryFact={JP:'日本：完整谷粒的检疫及食品申报材料应在装运前准备；采用RCEP时核对转运证明。',US:'美国：核对加工工艺对应的APHIS路径、FDA到港资料，以及境内运输段的适用要求。',DE:'德国：核对欧盟植物健康和食品检查路径，确认入境口岸及进口商承接手续。'}[country.id];
 return {transportFacts:[...transportFacts,...(countryFact?[countryFact]:[])],transportNeeds:['实际起运地、目的港及承运方案','产品剩余保质期与必要保存条件','承运时效、预计清关及仓储耗时'],incomeFacts:['计算方法：采购报价 − 货物成本 − 运保费 − 出口方承担的其他本单费用。','先统一规格、币种、计价单位与贸易条款；历史进口均价只作统计背景。'],competitionFacts:['供应国结构用于了解已有供货背景；同一HS可能包含不同规格、用途或加工品。','采购渠道需通过真实询价、规格确认及样品反馈验证，统计来源国不是采购商名单。']};
}
