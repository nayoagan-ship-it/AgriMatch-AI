import {containsTerm} from './search.mjs';
import {buildCaseDiscussion} from './policy-cases.mjs';

export function shortExcerpt(text){
  const value=String(text||'').replace(/\s+/g,' ').trim();
  if(/[\u4e00-\u9fff]/.test(value))return value.slice(0,80);
  return value.split(/\s+/).slice(0,25).join(' ');
}
export function documentExcerpt(document,terms){
  if(['official-api','country-directory'].includes(document.kind))return '';
  const text=String(document.text||'');
  if(/^\s*[\[{]/.test(text))return '';
  const segments=text.replace(/\n(?:Title|Type|Publication date|Abstract|Search excerpt):/g,'\n').split(/\n|(?<=[.!?。！？])\s+/).filter(s=>terms.some(t=>containsTerm(s,t)));
  const segment=segments.find(s=>/import|requir|prohibit|tolerance|tariff|regulat|quota|食品|进口|规定|检疫/i.test(s))||segments[0]||'';
  if(segment.length<150)return shortExcerpt(segment);
  // A long plain-text page often begins with navigation. Start at the actual
  // product mention, not at the first 25 words of the page.
  const found=terms.map(t=>({term:t,index:segment.toLowerCase().indexOf(t.toLowerCase())})).filter(x=>x.index>=0).sort((a,b)=>a.index-b.index)[0];
  return shortExcerpt(found?segment.slice(Math.max(0,segment.lastIndexOf(' ',Math.max(0,found.index-25))+1)):segment);
}

const pending={
 posture:'尚不能确认该产品已获准进口；需核对产品准入清单和检疫条件。',
 tariff:'尚不能确认实际适用税率、优惠或配额；不得把未取得的税项视为零。',
 regulation:'具体检疫、残留、食品安全和标签要求仍需核对产品范围。',
 origin:'尚不能确认对中国或所选省级原产地的专项限制、批准名单或豁免。',
 support:'尚无充分依据确认针对本产品的进口支持措施；本国产业扶持不能直接当作进口优惠。',
 changes:'尚不能确认近期是否调整；未检索到文件不代表近期没有变化。',
};
const guidance={
 posture:'准入判断须对应产品形态和原产地。一般食品监管条款只说明进口后的监管义务，不能代替允许进口的名单或双边检疫安排。',
 tariff:'税则列值依赖实际报关归类、包装和加工条件。基础税率、优惠税率和原产地专项附加税需要分别核对，不能直接相加或用缺失值推算总税负。',
 regulation:'原文中的适用对象和豁免条件与具体产品一起判断；食品用途、加工方式和成分可能改变适用要求。',
 origin:'专项措施需要明确提及中国、相关地区或企业，通用监管文件不能自动解释成针对所选省份的规定。',
 support:'需要区分受益主体：方便进口商的措施与扶持当地生产者的补贴作用不同。组织或倡议分组本身不构成关税优惠。',
 changes:'发布、征求意见、生效和失效是不同状态。只有文件范围、调整内容与生效时间对应本产品，才能认定已发生适用政策变化。',
};
export function buildModuleBrief(module,input,country,sources=[]){
  const discussion=buildCaseDiscussion(module,input,country,sources);
  const primary=module.findings.find(f=>f.status==='product')||module.findings.find(f=>f.status==='reference')||module.findings.find(f=>f.status==='lead')||module.findings[0];
  const quotes=[],seen=new Set();
  for(const finding of module.findings){
    for(const id of finding.sourceIds||[]){
      const source=sources.find(s=>s.id===id);
      const text=finding.evidence||source?.excerpt;
      if(!text||source?.kind==='country-directory'||seen.has(id))continue;seen.add(id);
      quotes.push({sourceId:id,text:shortExcerpt(text),kind:finding.evidenceKind||source?.excerptKind||(finding.status==='lead'?'metadata':'original'),title:source?.title||finding.title,authority:source?.authority||'',publishedDate:source?.publishedDate||finding.publishedDate||null});
    }
  }
  for(const id of module.research?.sourceIds||[]){
    const source=sources.find(s=>s.id===id);if(!source?.excerpt||source.kind==='country-directory'||seen.has(id))continue;seen.add(id);
    quotes.push({sourceId:id,text:shortExcerpt(source.excerpt),kind:source.excerptKind||'original',title:source.title,authority:source.authority||'',publishedDate:source.publishedDate||null});
  }
  const conclusion=discussion.summary;
  const analysis=[primary?.interpretation,primary?.scope,guidance[module.id]].filter(Boolean);
  if(!quotes.length)analysis.unshift('本栏尚无可展示的专项官方原文，条件讨论用于说明不同情形的处理路径，不代表已经确认的产品许可或待遇。');
  return {...discussion,conclusion,analysis:[...new Set(analysis)],quotations:quotes.slice(0,3),limits:primary?.status==='product'?'原文涉及本产品，具体形态、原产地和有效状态仍需核对。':pending[module.id]};
}
