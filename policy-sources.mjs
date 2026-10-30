import {COUNTRY_AUTHORITIES} from './country-authorities.mjs';
import {frameworkSources} from './policy-frameworks.mjs';

export const MODULES = [
  {id:'posture',title:'进口准入与官方立场',question:'是否开放进口？官方政策目标是什么？',missing:'需要该产品与原产国的准入规定及官方政策文件，才能概括具体进口立场。'},
  {id:'tariff',title:'关税、优惠与配额',question:'有哪些税收措施和数量限制？',missing:'适用税率、优惠条件和配额需要按目标国税则细目、原产国和有效日期查询。'},
  {id:'regulation',title:'监管与技术要求',question:'有哪些检疫和食品安全约束？',missing:'需要匹配具体产品形态、用途和成分的监管规定。'},
  {id:'origin',title:'原产地专项政策',question:'是否对中国或这一原产地区有专门规定？',missing:'需要双边准入文件、所选原产地区或企业名单及专项贸易措施，通用规定不能代替。'},
  {id:'support',title:'进口支持与产业政策',question:'有哪些促进进口或扶持本国产业的措施？',missing:'需要针对该产品的进口便利措施或本国产业扶持文件；两者分别解释。'},
  {id:'changes',title:'近期政策变化',question:'哪些政策发生了变化？何时生效？',missing:'本次资料尚未形成该产品的完整政策时间线；不能据此判断近期没有变化。'},
];

export const EU_COUNTRIES = new Set(['DE','NL','FR','IT','ES','PL','BE','SE','DK','FI','IE','AT','PT','GR','CZ','RO','HU','BG','HR','SK','SI','EE','LV','LT','LU','MT','CY']);
export const SAVED_ON = '2026-10-14';
export const SOURCES = {
  jpFood:{id:'jp-food',title:'食品进口申报与审查',authority:'日本厚生劳动省',url:'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/yunyu_kanshi/kanshi/index_00004.html',kind:'overview',marker:'Food Sanitation',quote:'import notification',overview:'日本对销售或经营用途的食品进口实行申报和食品安全审查，检验要求依具体产品情况确定。',scope:'商业食品的一般进口程序；不构成特定产品的准入确认。',interpretation:'需要同时了解食品监管政策及产品专门规定。',module:'regulation'},
  jpPlant:{id:'jp-plant',title:'植物及植物产品进口检疫规定',authority:'日本农林水产省植物防疫所',url:'https://www.maff.go.jp/pps/j/introduction/english.html',kind:'overview',marker:'Plant Quarantine',quote:'Import regulations differ depending on the country of production, exporting country and plant type.',overview:'日本植物检疫规定按生产国、出口国和植物种类区分，存在进口禁止事项和检疫要求；部分加工产品有不同安排。',scope:'植物产品的一般检疫框架；具体产品和原产国条件仍须查询。',interpretation:'应把原产国和产品加工状态纳入政策查询。',module:'posture'},
  usFood:{id:'us-food',title:'食品进口政策概览',authority:'美国食品药品监督管理局 FDA',url:'https://www.fda.gov/food/food-imports-exports/importing-food-products-united-states',kind:'overview',marker:'Importing Food Products',quote:'Both imported and domestically-produced foods must meet the same legal requirements in the United States.',overview:'FDA要求进口食品符合适用的食品安全和标签规定，并介绍食品设施注册、进口预先通知等制度；具体适用范围和豁免须另外确认。',scope:'FDA管辖食品的一般监管框架；不等于产品获准进口或获得认证。',interpretation:'食品监管规定与税收、检疫、原产国专项措施分别查询。',module:'regulation'},
  euAgriculture:{id:'eu-agriculture',title:'农产品健康与消费者保护要求',authority:'欧盟委员会 Access2Markets',url:'https://trade.ec.europa.eu/access-to-markets/en/content/health-and-consumer-protection-animal-and-plant-product',kind:'overview',marker:'Health and consumer protection',quote:'Extra requirements may apply depending on the destination EU country.',overview:'欧盟农产品进口监管涵盖动物健康、植物健康和食品安全；部分产品涉及禁令、证书或边境检查，目的成员国可能有额外要求。',scope:'欧盟共同监管框架；需继续匹配具体产品、原产国及目的成员国。',interpretation:'欧盟共同政策与目的成员国的补充要求分别呈现。',module:'regulation'},
  eping:{id:'wto-eping',title:'产品法规通知与贸易关注',authority:'世界贸易组织 WTO',url:'https://eping.wto.org/en/',kind:'portal',scope:'检索新发布或修订的产品法规通知；通知可能涉及草案，需核对最终生效文件。'},
};

export function isFood(input){return input.form!=='seed'&&!/棉花|烟草|橡胶|亚麻|黄麻/.test(input.product);}
export function isPlant(input){return ['grain','cash','fruit','vegetable','beverage','nuts'].includes(input.category)||['fresh','dried','seed'].includes(input.form)&&!['livestock','aquatic'].includes(input.category);}

export function sourcesFor(country,input){
  const rows=[...frameworkSources(country,input)],registry=COUNTRY_AUTHORITIES[country.id];
  if(country.id==='JP'){
    if(isFood(input))rows.push(SOURCES.jpFood);
    if(isPlant(input))rows.push(SOURCES.jpPlant);
    rows.push({id:'jp-tariff',title:'日本税则查询入口',authority:'日本海关',url:'https://www.customs.go.jp/english/tariff/',kind:'portal',scope:'按具体税则细目和原产国核对税率、优惠和配额。'});
  }else if(country.id==='US'){
    if(isFood(input))rows.push(SOURCES.usFood);
    if(isPlant(input))rows.push({id:'us-acir',title:'农产品进口条件查询',authority:'美国农业部 APHIS',url:'https://acir.aphis.usda.gov/s/',kind:'portal',scope:'按植物产品及原产国核对具体进口条件。'});
    rows.push({id:'us-tariff',title:'美国协调税则查询入口',authority:'美国国际贸易委员会 USITC',url:'https://hts.usitc.gov/',kind:'portal',scope:'需核对当前税则和适用附加税措施。'});
  }else if(EU_COUNTRIES.has(country.id)){
    if(isFood(input)||isPlant(input)||['livestock','aquatic'].includes(input.category))rows.push(SOURCES.euAgriculture);
    const u=new URL('https://trade.ec.europa.eu/access-to-markets/en/search');
    u.searchParams.set('destination',country.id);if(input.originCode)u.searchParams.set('origin',input.originCode);
    rows.push({id:'eu-trade-'+country.id,title:'目的成员国贸易政策查询',authority:'欧盟委员会 Access2Markets',url:u.href,kind:'portal',scope:'按产品、出口国和目的成员国查询关税、原产地规则与进口手续。'});
  }
  if(country.source&&!rows.some(x=>new URL(x.url).hostname===new URL(country.source).hostname)){
    rows.push({id:'authority-'+country.id,title:country.name+'官方主管机构入口',authority:country.authority||country.name+'主管机构',url:country.source,kind:'portal',scope:'沿用2.7版主管机构目录；入口可用于进一步查找，尚未代表本产品政策已核实。'});
  }
  if(registry){
    rows.push({id:'nppo-'+country.id,title:country.name+'植检主管机构官方登记',authority:'国际植物保护公约 IPPC',url:registry.profileUrl,kind:'country-directory',verifiedOn:registry.verifiedOn,scope:'IPPC发布的本国主管机构目录，只核对机构与管辖地，不代表任何产品已获准进口。'});
    if(registry.legislationUrl)rows.push({id:'nppo-laws-'+country.id,title:country.name+'植检法规与要求目录',authority:'国际植物保护公约 IPPC · '+country.name,url:registry.legislationUrl,kind:'country-directory',verifiedOn:registry.verifiedOn,scope:'该国提交的法规与要求目录；产品、原产地和现行状态须继续核对，目录不是产品许可证明。'});
    if(registry.authorityUrl)rows.push({id:'nppo-agency-'+country.id,title:country.name+'国家植物保护机构',authority:country.name+'植物保护主管机构',url:registry.authorityUrl,kind:'portal',verifiedOn:registry.verifiedOn,scope:'机构网址取自IPPC该国官方登记；只在其主管范围内查找植物产品政策。'});
  }
  rows.push(SOURCES.eping);
  return rows.map(x=>({...x,...(['jp-food','us-food'].includes(x.id)?{scope:x.scope+' 仅在作为食品进口时适用，实际用途须另行核对。'}:{}),savedOn:x.kind==='overview'?(x.savedOn||SAVED_ON):null}));
}
