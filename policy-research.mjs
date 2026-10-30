import {searchWeb,containsTerm} from './search.mjs';
import {EU_COUNTRIES} from './policy-sources.mjs';
import {originSearchName} from './provinces.mjs';
import {documentExcerpt,shortExcerpt} from './policy-brief.mjs';
import {COUNTRY_AUTHORITIES} from './country-authorities.mjs';
import {PRODUCT_TERMS,productTerms,milletProfile} from './product-profile.mjs';
export {PRODUCT_TERMS} from './product-profile.mjs';

const TOPICS={posture:'import market access restrictions policy',tariff:'import tariff duty quota',regulation:'import food safety pesticide labelling requirements',origin:'China import approved establishments restrictions',support:'import facilitation tariff reduction agriculture support',changes:'import policy regulatory changes'};
const TOPIC_WORDS={posture:/import|prohibit|permit|restriction|access|进口|准入|禁止/i,tariff:/tariff|duty|quota|tax|关税|税则|配额/i,regulation:/food|pesticide|inspection|sanitary|label|食品|农药|检疫/i,origin:/China|Chinese|country|establishment|origin|中国|原产|企业/i,support:/support|subsid|facilitat|reduc|exempt|农业|补贴|优惠|减免/i,changes:/rule|regulat|amend|change|notic|新|修订|调整|通告/i};
const COUNTRY_NAMES={US:'United States',JP:'Japan',DE:'Germany',FR:'France',NL:'Netherlands',GB:'United Kingdom',CA:'Canada',AU:'Australia',NZ:'New Zealand',SG:'Singapore',MY:'Malaysia',SA:'Saudi Arabia',AE:'United Arab Emirates',IN:'India',BR:'Brazil'};
const strip=s=>String(s??'').replace(/<\/?(?:em|strong|b|i|span|mark|a)\b[^>]*>/gi,'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
export function trustedDomain(host,roots){return roots.some(root=>host===root||host.endsWith('.'+root));}
export function researchRoots(country,sources){
  const roots=sources.map(s=>new URL(s.url).hostname.replace(/^www\./,''));
  if(country.id==='US')roots.push('fda.gov','usda.gov','cbp.gov','ustr.gov','usitc.gov','federalregister.gov','govinfo.gov','ecfr.gov','epa.gov');
  if(country.id==='JP')roots.push('maff.go.jp','mhlw.go.jp','customs.go.jp','caa.go.jp','meti.go.jp');
  if(country.id==='KR')roots.push('mfds.go.kr','customs.go.kr','qia.go.kr');
  if(country.id==='SG')roots.push('sfa.gov.sg','customs.gov.sg');
  if(EU_COUNTRIES.has(country.id))roots.push('europa.eu');
  if(country.id==='DE')roots.push('bmel.de','bvl.bund.de','zoll.de');
  if(country.id==='CA')roots.push('canada.ca','gc.ca');
  if(country.id==='GB')roots.push('gov.uk');
  if(country.id==='AU')roots.push('agriculture.gov.au','abf.gov.au');
  if(country.id==='NZ')roots.push('mpi.govt.nz','customs.govt.nz');
  roots.push('customs.gov.cn','mofcom.gov.cn','wto.org');
  return [...new Set(roots)];
}
export function buildModuleQuery(input,country,module){
  const product=productTerms(input)[1]||input.product,destination=country.englishName||COUNTRY_AUTHORITIES[country.id]?.englishName||COUNTRY_NAMES[country.id]||country.name;
  const regional=module.id==='origin'?input.originProvince:'';
  return `${product} ${originSearchName(input.originProvince)} ${regional} ${destination} ${TOPICS[module.id]}`.replace(/\s+/g,' ').trim();
}
function inJurisdiction(candidate,country){
  const url=new URL(candidate.url);
  if(url.hostname==='www.ippc.int'||url.hostname==='ippc.int'){
    const slug=COUNTRY_AUTHORITIES[country.id]?.profileUrl.match(/\/countries\/([^/]+)/)?.[1];
    return Boolean(slug&&url.pathname.includes('/countries/'+slug+'/'));
  }
  if(trustedDomain(url.hostname,['wto.org']))return containsTerm(candidate.title+' '+candidate.snippet,COUNTRY_AUTHORITIES[country.id]?.englishName||country.name);
  return true;
}
async function readJSON(url,transport,signal){
  const r=await transport(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),headers:{accept:'application/json'}});
  if(!r.ok)throw new Error('HTTP '+r.status);return r.json();
}
export function tariffRows(records,input){
  if(!Array.isArray(records))return [];
  const terms=productTerms(input),out=[];
  for(const row of records){
    const hs=String(row.htsno||''),digits=hs.replace(/\D/g,'');
    const ancestors=records.filter(r=>r.htsno&&digits.startsWith(String(r.htsno).replace(/\D/g,''))).sort((a,b)=>String(a.htsno).length-String(b.htsno).length);
    const combined=ancestors.map(r=>strip(r.description)).join(' / ');
    if(!hs||!terms.some(t=>containsTerm(combined,t))||!tariffFormMatches(hs,combined,input))continue;
    if(row.general===null||row.general===undefined||row.general==='')continue;
    out.push({hs,description:combined,originalDescription:strip(row.description),generalRate:String(row.general),specialRate:row.special||null,additionalDuties:row.additionalDuties??null,quotaQuantity:row.quotaQuantity??null});
  }
  return out.slice(0,8);
}
export function tariffFormMatches(hs,description,input){
  const digits=String(hs).replace(/\D/g,''),text=String(description).toLowerCase(),processed=/flour|starch|bran|groat|meal\b|bulgur|bread|biscuit|prepared|extract|instant|juice|malt\b|pellet/;
  const millet=milletProfile(input);if(millet)return Boolean(millet.hs&&digits.startsWith(millet.hs));
  if(input.product==='小麦'){
    if(input.form==='seed')return digits.startsWith('1001')&&/seed|sowing/.test(text);
    if(['fresh','dried','raw'].includes(input.form))return digits.startsWith('1001')&&!/seed|sowing/.test(text)&&!processed.test(text);
    if(input.form==='processed')return !digits.startsWith('1001')&&processed.test(text);
  }
  if(['fresh','dried','frozen','raw'].includes(input.form)&&(/seed|sowing/.test(text)||processed.test(text)))return false;
  if(input.form==='seed'&&!/seed|sowing/.test(text))return false;
  if(input.form==='fresh'&&/dried|frozen/.test(text))return false;
  if(input.form==='frozen'&&!/frozen/.test(text))return false;
  return true;
}

async function usTariff(input,{transport,signal}){
  const term=productTerms(input)[1]||input.product;
  const url='https://hts.usitc.gov/reststop/search?keyword='+encodeURIComponent(term.includes(' ')?'"'+term+'"':term);
  let records=await readJSON(url,transport,signal);if(!Array.isArray(records))throw new Error('税则接口格式无效。');
  if(!tariffRows(records,input).length){
    const headings=records.filter(r=>r.htsno&&String(r.description).toLowerCase().includes(term.toLowerCase())).sort((a,b)=>String(a.htsno).length-String(b.htsno).length).slice(0,4);
    for(const row of headings){const expanded=await readJSON('https://hts.usitc.gov/reststop/search?keyword='+encodeURIComponent(row.htsno),transport,signal);if(Array.isArray(expanded))records=records.concat(expanded);}
  }
  const unique=[...new Map(records.map(r=>[r.htsno,r])).values()],rows=tariffRows(unique,input),now=new Date().toISOString(),id='us-hts-query';
  const excerpt=rows[0]?shortExcerpt(rows[0].description):'';
  const source={id,title:'美国官方税则产品检索',authority:'美国国际贸易委员会 USITC',url,kind:'official-api',scope:'已按产品形态筛选的候选税则；报关归类和原产地专项附加税仍须核对。',readStatus:'fetched',retrievedAt:now,savedOn:null,excerpt,excerptKind:'official-api-fields'};
  const text=rows.map(r=>r.description+' General rate: '+r.generalRate).join('\n');
  const rates=[...new Set(rows.map(r=>r.generalRate==='Free'?'免税':r.generalRate.replace(/([\d.]+)¢\/kg/g,'每公斤$1美分')))];
  const fact=`${input.product}（${input.formName||input.form}）已找到相应税则参考，基础列值为${rates.join('、')}；尚不能据此确定优惠资格、配额或包含专项附加税的总税负。`;
  const findings=rows.length?[{id:'us-hts-reference',module:'tariff',status:'reference',title:'按产品形态匹配的税则参考',fact,scope:source.scope,interpretation:'参考已按所选形态排除明显不相符的种子或加工品。普通税率列为免税不等于所有进口税费为零；实际归类与专项附加税须核对。',sourceIds:[id],evidence:excerpt,evidenceKind:'official-api-fields',effectiveStatus:'实时税则检索，实际适用待确认',publishedDate:null,effectiveDate:null,expiryDate:null,tariffCandidates:rows}]:[];
  return {sources:[source],documents:[{...source,text}],findings};
}
async function usRegister(input,module,{transport,signal}){
  const product=productTerms(input)[1]||input.product;
  const u=new URL('https://www.federalregister.gov/api/v1/documents.json');
  const suffix={posture:'import',regulation:'pesticide tolerance food',origin:'China import',support:'agriculture support',changes:'',tariff:'tariff'}[module.id];
  u.searchParams.set('conditions[term]',product+' '+suffix);u.searchParams.set('per_page','20');u.searchParams.set('order','newest');
  const data=await readJSON(u.href,transport,signal),now=new Date().toISOString();
  const products=productTerms(input);
  const rows=(data.results||[]).filter(r=>{
    const headline=strip([r.title,r.abstract].join(' ')),text=strip([r.title,r.abstract,r.excerpts].join(' ')),agencies=(r.agencies||[]).map(a=>a.name).join(' ');
    // A match buried in a long tariff appendix or an acronym such as immigration TEA is insufficient.
    // Prefer an explicit product context in the official title/abstract before keeping this as a lead.
    return products.some(p=>containsTerm(headline,p))&&TOPIC_WORDS[module.id].test(text)&&!/exhibition|culturally significant|museum|immigra|\bvisa\b|trademark|patent/i.test(headline)&&/Agriculture|Food and Drug|Environmental Protection|Commerce|Trade Representative|Homeland Security|Treasury/i.test(agencies);
  }).slice(0,3);
  return {sources:rows.map((r,i)=>({id:`us-fr-${module.id}-${i}`,title:r.title,authority:(r.agencies||[]).map(a=>a.name).join('、')||'美国联邦法规登记资料',url:r.html_url,officialEditionUrl:r.pdf_url,kind:'official-search-metadata',scope:'联邦法规登记网站的检索资料，正式版本见govinfo.gov；草案与通知不直接等于已生效规定。',readStatus:'metadata',retrievedAt:now,publishedDate:r.publication_date,documentType:r.type,savedOn:null})),documents:rows.map((r,i)=>({id:`us-fr-${module.id}-${i}`,url:r.html_url,title:r.title,kind:'official-search-metadata',text:`Title: ${r.title}\nType: ${r.type}\nPublication date: ${r.publication_date}\nAbstract: ${strip(r.abstract)}\nSearch excerpt: ${strip(r.excerpts)}`,retrievedAt:now})),findings:[]};
}

export async function researchModule(input,country,module,{transport=fetch,searchTransport=transport,signal,seedDocuments=[],sources=[],loadDocument,onState=()=>{}}={}){
  const query=buildModuleQuery(input,country,module),roots=researchRoots(country,sources),state={state:'searching',query,startedAt:new Date().toISOString(),finishedAt:null,attempts:[],sourceIds:[],reason:null};
  const foundSources=[],documents=[],findings=[];onState({...state});
  const attempt=async(name,fn)=>{const row={channel:name,status:'running'};state.attempts.push(row);try{const r=await fn();row.status='done';return r;}catch(e){row.status=signal.aborted?'cancelled':'failed';row.reason=signal.aborted?'本次检索已停止':'本渠道未取得相关资料';return null;}};
  if(country.id==='US'){
    const result=await attempt(module.id==='tariff'?'USITC官方税则检索':'联邦法规登记检索',()=>module.id==='tariff'?usTariff(input,{transport,signal}):usRegister(input,module,{transport,signal}));
    if(result){foundSources.push(...result.sources);documents.push(...result.documents);findings.push(...result.findings);}
  }
  if(!foundSources.length&&!signal.aborted){
    const targeted=roots.filter(x=>!['wto.org','customs.gov.cn','mofcom.gov.cn','ippc.int','eping.wto.org'].includes(x));
    const directory=COUNTRY_AUTHORITIES[country.id]?.profileUrl;
    const sites=targeted.length?targeted.slice(0,5).map(x=>'site:'+x):directory?['site:'+directory]:[];
    const r=await attempt('本国官方域名联网搜索',()=>searchWeb(query+(sites.length?' ('+sites.join(' OR ')+')':''),{transport:searchTransport,signal,allowedDomains:roots,requiredTerms:productTerms(input)}));
    if(r)for(const candidate of r.sources.filter(s=>inJurisdiction(s,country)&&!/(personal use|personal consumption|travell?er|baggage)/i.test(s.title+' '+s.snippet)&&TOPIC_WORDS[module.id].test(s.title+' '+s.snippet)).slice(0,2)){
      let u;try{u=new URL(candidate.url);}catch{continue;}if(!trustedDomain(u.hostname,roots)||u.protocol!=='https:')continue;
      foundSources.push({id:`${country.id}-${module.id}-web-${foundSources.length}`,title:candidate.title,authority:u.hostname,url:u.href,kind:u.hostname.endsWith('ippc.int')?'country-directory':'product-source',scope:'联网检索发现的本国官方资料，具体产品、原产地和有效状态须核对。',readStatus:'portal',retrievedAt:null,savedOn:null});
    }
    if(!foundSources.length&&!signal.aborted){
      const alternate=`${productTerms(input)[1]||input.product} ${country.englishName||COUNTRY_NAMES[country.id]||country.name} ${TOPICS[module.id]} ${module.id==='changes'?new Date().getUTCFullYear():''} site:${targeted[0]||roots[0]}`;
      const retry=await attempt('改用产品与目的国再次查找',()=>searchWeb(alternate,{transport:searchTransport,signal,allowedDomains:roots,requiredTerms:productTerms(input)}));
      for(const candidate of retry?.sources||[]){if(foundSources.length>=2)break;if(!inJurisdiction(candidate,country)||!TOPIC_WORDS[module.id].test(candidate.title+' '+candidate.snippet)||/personal use|travell?er|baggage/i.test(candidate.title))continue;foundSources.push({id:`${country.id}-${module.id}-retry-${foundSources.length}`,title:candidate.title,authority:new URL(candidate.url).hostname,url:candidate.url,kind:'product-source',scope:'第二轮产品及目的国检索资料；需核对正式原文和适用条件。',readStatus:'portal',retrievedAt:null,savedOn:null});}
    }
  }
  if(!foundSources.length){
    const terms=productTerms(input);
    const rows=seedDocuments.flatMap(d=>d.links||[]).filter(l=>terms.some(t=>containsTerm(l.title+' '+l.url,t))&&TOPIC_WORDS[module.id].test(l.title+' '+l.url)&&trustedDomain(new URL(l.url).hostname,roots)&&inJurisdiction(l,country)).slice(0,2);
    if(rows.length){state.attempts.push({channel:'官方站点相关资料',status:'done'});for(const row of rows)foundSources.push({id:`${country.id}-${module.id}-site-${foundSources.length}`,title:row.title,authority:country.authority,url:row.url,kind:new URL(row.url).hostname.endsWith('ippc.int')?'country-directory':'product-source',scope:'官方站点的相关政策文件或目录，适用具体产品与原产地待核对。',readStatus:'portal',retrievedAt:null,savedOn:null});}
  }
  await Promise.all(foundSources.filter(s=>s.kind==='product-source'||s.kind==='official-search-metadata').map(async source=>{
    if(signal.aborted)return;
    const r=await attempt('读取官方原文',()=>loadDocument(source,new Set([...roots,new URL(source.url).hostname])));
    if(r){source.readStatus='fetched';source.retrievedAt=r.retrievedAt;documents.push({...r,id:source.id,kind:'product-source'});}
    else if(source.kind!=='official-search-metadata'){source.readStatus='unavailable';source.error='本次未取得可读原文，保留资料入口。';}
  }));
  for(const source of foundSources){
    if(source.excerpt)continue;
    const doc=documents.find(d=>d.id===source.id&&d.kind==='product-source')||documents.find(d=>d.id===source.id);
    if(doc){source.excerpt=documentExcerpt(doc,productTerms(input));source.excerptKind=doc.kind==='official-search-metadata'?'metadata':'original';}
  }
  // Readable originals remain useful when no model is configured. Preserve a
  // product-specific passage, but do not convert it into a legal clearance.
  for(const source of foundSources.filter(s=>s.readStatus==='fetched'&&s.kind==='product-source'&&s.excerpt)){
    const excerpt=source.excerpt;if(!productTerms(input).some(t=>containsTerm(excerpt,t)))continue;
    findings.push({id:'original-'+source.id,module:module.id,status:'reference',title:source.title,fact:`已读取官方文件《${source.title}》，并定位到与${input.product}有关的正文。请结合下方原文与分类结果核对本批货物的适用条件。`,scope:'已确认官方来源可读、正文提及产品；尚未确认具体原产地、加工工艺、有效状态及本批次资格。',interpretation:'正文摘录作为产品相关依据保留；未满足条件时不自动推断准入、税率或补贴资格。',sourceIds:[source.id],evidence:excerpt,evidenceKind:'original',effectiveStatus:'已读取产品相关正文，适用与时效待核对',publishedDate:null,effectiveDate:null,expiryDate:null});
  }
  state.finishedAt=new Date().toISOString();state.sourceIds=foundSources.map(s=>s.id);
  const policySources=foundSources.filter(s=>s.kind!=='country-directory');
  state.state=signal.aborted?'cancelled':findings.length?'found':policySources.length?'references':state.attempts.every(a=>a.status==='failed')?'failed':'not_found';
  state.reason=state.state==='failed'?'检索渠道本次未返回可用资料，已保留官方查询入口。':state.state==='not_found'?'已自动检索，暂未找到可用于本产品的官方政策依据。':state.state==='references'?'已找到相关官方资料，具体适用范围正在核对。':null;
  return {research:state,sources:foundSources,documents,findings};
}
