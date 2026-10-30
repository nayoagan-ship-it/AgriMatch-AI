// Search snippets are leads, never verified event facts or executable instructions.
const clean=s=>String(s??'').replace(/<\/?(?:em|strong|b|i|span|mark|a)\b[^>]*>/gi,'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
export function containsTerm(text,term){
  const normalized=String(text??'').replace(/\s+/g,' ').toLowerCase(),word=String(term??'').trim().toLowerCase();
  if(!word)return false;
  if(/[\u4e00-\u9fff]/.test(word))return normalized.includes(word);
  const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(?<![\\p{L}\\p{N}])'+escaped+'s?(?![\\p{L}\\p{N}])','iu').test(normalized);
}
export function safeLink(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function parseSearchRSS(xml){return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m=>{const get=t=>clean(m[1].match(new RegExp('<'+t+'>([\\s\\S]*?)</'+t+'>'))?.[1]);return{title:get('title'),url:safeLink(get('link')),snippet:get('description').slice(0,700),publishedAt:get('pubDate')||null};}).filter(x=>x.url&&x.title).slice(0,6);}
export function parseSearchHTML(html){
  const blocks=String(html).split(/<div[^>]*class="[^\"]*result__body[^\"]*"[^>]*>/).slice(1);
  return blocks.map(block=>{const anchor=block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/),snippet=block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);if(!anchor)return null;let href=clean(anchor[1]);try{const u=new URL(href,'https://duckduckgo.com');href=u.searchParams.get('uddg')||u.href;}catch{}return{title:clean(anchor[2]),url:safeLink(href),snippet:clean(snippet?.[1]).slice(0,700),publishedAt:null};}).filter(x=>x?.url&&x.title);
}
export function relevantSources(sources,query){
  const normalized=String(query).toLowerCase().replace(/site:\S+/g,'');
  const chinese=normalized.match(/[\u4e00-\u9fff]+/g)||[],tokens=new Set(chinese.flatMap(s=>s.length>2?Array.from({length:s.length-1},(_,i)=>s.slice(i,i+2)):[s]));
  const words=normalized.match(/[a-z]{3,}/g)||[];for(const w of words)if(!['the','and','for','with','site','from'].includes(w))tokens.add(w);
  const years=normalized.match(/\b20\d{2}\b/g)||[];
  const relevant=sources.filter(s=>{const text=(s.title+' '+s.snippet).toLowerCase();return [...tokens].filter(t=>text.includes(t)).length>=Math.min(2,tokens.size)&&(!years.length||years.some(y=>(text+' '+s.url).includes(y)));});
  const primary=s=>/\.(gov(\.cn)?|int)$|(^|\.)(worldbank\.org|wto\.org|cma\.gov\.cn)$/.test(new URL(s.url).hostname);
  return relevant.sort((a,b)=>Number(primary(b))-Number(primary(a))).slice(0,6);
}
export async function searchWeb(query,{transport=fetch,signal,allowedDomains=[],requiredTerms=[]}={}){
  const errors=[];
  for(const provider of ['duckduckgo','bing']){
    signal?.throwIfAborted();const combined=signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000);
    const url=new URL(provider==='duckduckgo'?'https://html.duckduckgo.com/html/':'https://www.bing.com/search');if(provider==='bing')url.searchParams.set('format','rss');url.searchParams.set('q',String(query).slice(0,700));
    try{const response=await transport(url.href,{signal:combined,headers:{accept:'text/html, application/rss+xml'}});if(!response.ok)throw new Error('HTTP '+response.status);const body=await response.text();const parsed=(body.includes('<rss')?parseSearchRSS(body):parseSearchHTML(body)).filter(s=>(!allowedDomains.length||allowedDomains.some(d=>new URL(s.url).hostname===d||new URL(s.url).hostname.endsWith('.'+d)))&&(!requiredTerms.length||requiredTerms.some(t=>containsTerm(s.title+' '+s.snippet,t))));const sources=relevantSources(parsed,query).map(x=>({...x,retrievedAt:new Date().toISOString(),kind:'相关搜索摘要，来源日期与原文待核实'}));if(!sources.length)throw new Error('未返回相关官方来源');return{query,sources,provider,retrievedAt:new Date().toISOString()};}
    catch(e){signal?.throwIfAborted();errors.push(e.message);}
  }
  throw new Error('未取得相关联网资料，请调整检索问题或稍后重试（'+errors.join('；')+'）');
}
