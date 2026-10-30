import {createEvaluationUI} from '/evaluation-ui.js';
import {initLanding,setLandingVisible} from '/landing.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const date=value=>{if(!value)return '未注明';const d=new Date(value);return Number.isNaN(d.getTime())?'未注明':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);};
const STORAGE='agrimatch-policy-history-v2',DRAFT='agrimatch-policy-draft-v2';
let config,selected=['JP','US','DE'],pickerSelected=[],pickerMode='continents',activeGroup='bri',visibleCountryIds=[],currentReport=null,controller=null,view='home',history=[],toastTimer;
let evaluationUI;
const scrollPositions={};
const safeRead=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
function saveDraft(){try{localStorage.setItem(DRAFT,JSON.stringify(input()));}catch{/* Query remains available when browser storage is unavailable. */}}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},3500);}
function input(){return {product:$('product').value.trim(),form:$('form').value,originProvince:$('origin').value,notes:$('notes').value.trim(),milletKind:$('millet-kind').value,category:config?.catalog.products.find(p=>p.name===$('product').value.trim())?.category||'other',countries:[...selected],refresh:true};}
function changeView(next,{scroll=true,restore=false,historyMove=false}={}){
  if(!['home','query','results','evaluation','history'].includes(next))next='query';
  if(['results','evaluation'].includes(next)&&!currentReport)next='query';
  if(view!==next)scrollPositions[view]=window.scrollY;
  const previousView=view;
  view=next;
  setLandingVisible(next==='home');
  for(const id of ['query','results','evaluation','history'])$(id+'-view').hidden=id!==next;
  document.body.dataset.view=next;
  document.querySelectorAll('.nav-link[data-view]').forEach(b=>{const active=b.dataset.view===(['results','evaluation'].includes(next)?'query':next);b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(next==='history')renderHistory();
  if(!historyMove&&window.history.state?.view!==next)window.history.pushState({view:next},'',next==='query'?'#query':'#'+next);
  if(scroll)window.scrollTo({top:restore?(scrollPositions[next]||0):0,behavior:'instant'});
  if(next==='home')$('landing-start').focus({preventScroll:true});
  else if(next==='query'&&previousView==='home')$('product').focus({preventScroll:true});
}
function countryName(id){return config.catalog.countries.find(c=>c.id===id)?.name||id;}
function renderSelection(){
  $('selected-countries').innerHTML=selected.length?selected.map(id=>`<span class="country-chip">${esc(countryName(id))}<button type="button" data-remove-country="${esc(id)}" aria-label="移除${esc(countryName(id))}">×</button></span>`).join(''):'<span class="empty-selection">请选择至少一个目标国家。</span>';
}
function renderPicker(){
  const term=$('country-search').value.trim().toLowerCase(),matches=c=>!term||[c.name,c.id,c.englishName].some(v=>String(v||'').toLowerCase().includes(term));
  const option=c=>`<label class="country-option"><input type="checkbox" value="${esc(c.id)}" ${pickerSelected.includes(c.id)?'checked':''}><span>${esc(c.name)}</span></label>`;
  visibleCountryIds=[];
  document.querySelectorAll('[data-picker-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pickerMode===pickerMode)));
  $('organization-tabs').hidden=pickerMode!=='organizations';$('picker-group-info').hidden=pickerMode!=='organizations';
  if(pickerMode==='continents'){
    $('country-options').innerHTML=config.catalog.continentGroups.map(group=>{
      const rows=config.catalog.countries.filter(c=>c.continent===group.name&&(term||group.countryIds.includes(c.id))&&matches(c));visibleCountryIds.push(...rows.map(c=>c.id));
      return rows.length?`<section class="continent-group" data-continent="${esc(group.name)}"><div class="continent-heading"><h3>${esc(group.name)} <span>${rows.length}个国家</span></h3><button class="text-button" type="button" data-select-continent="${esc(group.name)}">选择本洲</button></div><div class="country-options-grid">${rows.map(option).join('')}</div></section>`:'';
    }).join('')||'<p class="field-hint">没有找到该国家。</p>';
    $('picker-scope-note').textContent=term?'正在搜索全部'+config.catalog.countries.length+'个可选国家，含组织分组补充国家。':'亚洲、欧洲、北美洲、南美洲、非洲、大洋洲各10个常用国家。';
  }else{
    const group=config.countryGroups.find(g=>g.id===activeGroup)||config.countryGroups[0];
    $('organization-tabs').innerHTML=config.countryGroups.map(g=>`<button type="button" data-country-group="${esc(g.id)}" aria-pressed="${g.id===group.id}">${esc(g.name)}</button>`).join('');
    const rows=group.countryIds.map(id=>config.catalog.countries.find(c=>c.id===id)).filter(c=>c&&matches(c));visibleCountryIds=rows.map(c=>c.id);
    const extra=(group.additionalMembers||[]).filter(matches),total=group.countryIds.length+(group.additionalMembers||[]).length;
    $('picker-group-info').innerHTML=`<h3>${esc(group.name)} · ${esc(group.subtitle)} <span>${total}国${group.coverage==='directory-subset'?'（目录内）':''}</span></h3><p>${esc(group.description)}</p><details><summary>名单来源与说明</summary><p>${esc(group.sourceDate)}</p><a href="${esc(link(group.sourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(group.sourceTitle)} ↗</a>${(group.sources||[]).map(s=>`<a href="${esc(link(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join('')}${group.note?`<p>${esc(group.note)}</p>`:''}</details>`;
    $('country-options').innerHTML=rows.length||extra.length?`<div class="country-options-grid">${rows.map(option).join('')}${extra.map(c=>`<label class="country-option member-only"><input type="checkbox" value="${esc(c.id)}" disabled><span>${esc(c.name)}<small>${esc(c.note)}</small></span></label>`).join('')}</div>`:'<p class="field-hint">此分组内没有找到该国家，可切回按大洲搜索。</p>';
    $('picker-scope-note').textContent=`当前显示${rows.length}个可选国家${extra.length?'，另列中国成员身份':''}。分组用于选择国家，不直接代表关税优惠或进口准入。`;
  }
  updatePickerCount();
}
function updatePickerCount(){$('picker-count').textContent=`已选 ${pickerSelected.length} 个国家 · 当前可选 ${visibleCountryIds.length} 国`;}
function openPicker(){pickerSelected=[...selected];pickerMode='continents';$('country-search').value='';renderPicker();$('country-picker').showModal();$('country-search').focus();}
function fillInput(data){
  $('product').value=String(data.product||'').slice(0,100);
  $('form').value=config.forms[data.form]?data.form:'';
  $('origin').value=config.provinces.includes(data.originProvince)?data.originProvince:'';
  $('notes').value=String(data.notes||'').slice(0,800);
  $('millet-kind').value=['hulled','whole','flour','prepared'].includes(data.milletKind)?data.milletKind:'auto';
  $('millet-field').hidden=!/小米|谷子|黍米|millet/i.test($('product').value);
  selected=Array.isArray(data.countries)?[...new Set(data.countries)].filter(id=>config.catalog.countries.some(c=>c.id===id)):['JP','US','DE'];
  renderSelection();
}
function sourceLink(source){const url=link(source?.url);return url?`<a href="${esc(url)}" class="finding-source-link" target="_blank" rel="noopener noreferrer">${esc(source.authority||source.title)} ↗</a>`:'';}
function findingHTML(finding,sources){
  const related=finding.sourceIds.map(id=>sources.find(s=>s.id===id)).filter(Boolean),product=finding.status==='product';
  const statusText=product?'产品相关条文 · 适用待核实':finding.status==='reference'?'官方检索结果 · 归类待确认':finding.status==='lead'?'官方检索资料 · 待核对正式文件':'官方一般规则';
  const candidates=finding.tariffCandidates?.length?'<div class="tariff-reference"><p><strong>税则参考细目 · 基础列值</strong></p>'+finding.tariffCandidates.map(r=>'<p><b>'+esc(r.hs)+'</b> · '+esc(r.generalRate)+'<br><small>'+esc(r.description)+'</small></p>').join('')+'<p>实际归类、优惠适用和专项附加税仍需核对；缺失项不按零计算。</p></div>':'';
  return `<div class="finding"><span class="badge ${product?'product':''}">${statusText}</span><p class="finding-fact">${esc(finding.fact)}</p>${candidates}<details><summary>查看适用范围与政策依据</summary><div class="finding-detail"><p><strong>适用范围</strong><br>${esc(finding.scope)}</p><p><strong>状态</strong><br>${esc(finding.effectiveStatus)}</p>${finding.interpretation?`<p><strong>中文解读</strong><br>${esc(finding.interpretation)}</p>`:''}${finding.publishedDate||finding.effectiveDate||finding.expiryDate?`<p>发布日期：${esc(finding.publishedDate||'未注明')}<br>生效日期：${esc(finding.effectiveDate||'未注明')}<br>结束日期：${esc(finding.expiryDate||'未注明')}</p>`:'<p>政策发布日期与生效日期：本条概览未确认。</p>'}${finding.evidence?`<p><strong>对应原文</strong></p><blockquote>${esc(finding.evidence)}</blockquote>`:''}${related.map(sourceLink).join('')}</div></details></div>`;
}
function sourceHTML(source){
  const url=link(source.url),state=source.readStatus==='fetched'?`原文获取：${date(source.retrievedAt)}${source.cacheUsed?'（短时缓存）':''}`:source.readStatus==='metadata'?'已取得官方检索资料 · 正式文件待核对':source.readStatus==='unavailable'?'本次未取得原文':source.readStatus==='saved'?'保存的官方概览':'官方查询入口 · 具体政策未确认';
  return `<div class="source-row">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a>`:`<strong>${esc(source.title)}</strong>`}<p>${esc(source.authority)}<br>${esc(source.scope||'')}</p><p class="source-state">${esc(state)}${source.savedOn?` · 概览整理：${esc(source.savedOn)}`:''}</p>${source.officialEditionUrl?`<p><a href="${esc(link(source.officialEditionUrl))}" target="_blank" rel="noopener noreferrer">查看正式文件 ↗</a></p>`:''}${source.error?`<p>${esc(source.error)}</p>`:''}</div>`;
}
const searchLabels={queued:'等待自动搜索',searching:'正在联网搜索',found:'已补充政策资料',references:'已找到官方相关资料',not_found:'暂未找到匹配政策',failed:'本次检索未完成',cancelled:'检索已停止',saved:'保存的政策概览'};
function briefFor(module,country){
  if(module.brief)return {...module.brief,scenarios:module.brief.scenarios||[],confirmedFacts:module.brief.confirmedFacts||[],verificationNotes:module.brief.verificationNotes||[]};
  const first=module.findings.find(f=>f.status!=='general')||module.findings[0];
  return {conclusion:first?.fact||module.missing,analysis:[first?.interpretation,first?.scope,module.missing].filter(Boolean),scenarios:[],confirmedFacts:[],verificationNotes:[],quotations:module.findings.filter(f=>f.evidence).map(f=>({text:f.evidence,kind:f.status==='general'?'saved-official-excerpt':'original',title:f.title,authority:country.sources.find(s=>f.sourceIds.includes(s.id))?.authority||''})),limits:module.missing};
}
function moduleLabel(module,country){
  const state=module.research?.state||'saved',brief=briefFor(module,country);
  if(['queued','searching'].includes(state))return searchLabels[state];
  if(module.findings.some(f=>f.sourceIds.some(id=>country.sources.some(s=>s.id===id&&s.readStatus==='fetched'))))return module.findings.some(f=>f.status==='product')?'已读取产品依据 · 按条件讨论':'已读取相关依据 · 按情形核对';
  if(state==='found')return '相关条文与条件结果已整理';
  if(brief.confirmedFacts.length)return ['failed','cancelled'].includes(state)?'已有规则 · 本次联网未完成':'规则与分类讨论已整理';
  return brief.scenarios.length?'分类讨论已整理 · 专项依据待补充':searchLabels[state]||'待补充';
}
function researchHTML(module,sources){
  const r=module.research||{},ids=r.sourceIds||[],related=sources.filter(s=>ids.includes(s.id)),candidates=module.findings.flatMap(f=>f.tariffCandidates||[]);
  return '<details class="research-detail" data-detail-key="audit"><summary>检索与核对记录</summary><div class="audit-content"><p>'+esc(searchLabels[r.state]||'尚未联网补充')+'</p>'+(r.reason?'<p>'+esc(r.reason)+'</p>':'')+(r.query?'<p class="search-query"><strong>检索内容</strong><br>'+esc(r.query)+'</p>':'')+(r.attempts?.length?'<ul>'+r.attempts.map(a=>'<li>'+esc(a.channel)+' · '+esc({done:'已返回',running:'进行中',failed:'未取得资料',cancelled:'已停止'}[a.status]||a.status)+'</li>').join('')+'</ul>':'')+(r.finishedAt?'<p>本次检索：'+esc(date(r.finishedAt))+'</p>':'')+(candidates.length?'<section class="tariff-reference"><h4>官方税则字段参考</h4>'+candidates.map(row=>'<p><b>'+esc(row.hs)+'</b> · 基础列值 '+esc(row.generalRate)+'<br>'+esc(row.description)+'</p>').join('')+'<p>仅供核对归类，缺失的附加税不按零计算。</p></section>':'')+(related.length?'<div class="module-source-list">'+related.map(sourceHTML).join('')+'</div>':'')+'</div></details>';
}
function moduleBodyHTML(module,country){
  const brief=briefFor(module,country),key=country.id+':'+module.id;
  const quoteLabels={metadata:'官方检索摘要摘录 · 正式文件待核对','official-api-fields':'官方税则文本 · 字段摘录','saved-official-excerpt':'已保存的官方原文摘录'};
  const cases='<section class="case-results" data-reading-key="'+esc(key+':cases')+'"><h4>分类讨论结果</h4><p class="case-note">'+esc(brief.discussionNote||'请核对下列情形是否符合实际货物；条件尚未证实时，不代表已经适用。')+'</p>'+(brief.scenarios.length?brief.scenarios.map(row=>'<article class="case-result '+(row.relevant?'case-relevant':'')+'" data-case="'+esc(row.id)+'" data-reading-key="'+esc(key+':case:'+row.id)+'"><div class="case-heading"><h5>'+esc(row.title)+'</h5>'+(row.relevant?'<span class="case-focus">与你所选形态相关</span>':'')+'</div><p class="case-status">'+esc(row.statusLabel)+'</p><p class="case-condition"><span>适用情形</span>'+esc(row.condition)+'</p><p class="case-conclusion"><strong>'+esc(row.result)+'</strong></p>'+(row.needs?.length?'<p class="case-needs"><span>需确认</span>'+row.needs.map(esc).join('、')+'</p>':'')+'</article>').join(''):'<p class="evidence-gap">这是一份旧版保存结果，重新查询可获得分类讨论。</p>')+'</section>';
  const facts=brief.confirmedFacts.length?'<section class="confirmed-facts" data-reading-key="'+esc(key+':facts')+'"><h4>有依据的政策信息</h4>'+brief.confirmedFacts.map(f=>'<div class="confirmed-fact"><p><strong>'+esc(f.text)+'</strong></p><p class="fact-scope">'+esc(f.scope||'')+'</p></div>').join('')+'</section>':'';
  const originals='<section class="policy-original" data-reading-key="'+esc(key+':original')+'"><h4>官方原文摘录</h4>'+(brief.quotations.length?brief.quotations.map((q,i)=>'<div class="quote-entry" data-reading-key="'+esc(key+':quote:'+i)+'"><p class="quote-kind">'+esc(quoteLabels[q.kind]||'官方正文摘录')+'</p><blockquote>'+esc(q.text)+'</blockquote><p class="quote-caption">'+esc(q.authority)+(q.title?' · '+esc(q.title):'')+'</p></div>').join(''):'<p class="evidence-gap" data-reading-key="'+esc(key+':gap')+'">本栏尚未取得可引用的专项正文，以上为有条件的讨论结果。</p>')+'</section>';
  const explanation='<details class="discussion-detail" data-detail-key="discussion"><summary>核对依据与讨论说明</summary><div class="policy-analysis" data-reading-key="'+esc(key+':analysis')+'">'+brief.analysis.map(p=>'<p>'+esc(p)+'</p>').join('')+brief.verificationNotes.map(p=>'<p>'+esc(p)+'</p>').join('')+'<p class="policy-limits">'+esc(brief.limits||'')+'</p></div></details>';
  return cases+facts+originals+explanation+researchHTML(module,country.sources);
}
function moduleHTML(module,country,index,opened=new Set()){
  const state=module.research?.state||'saved',key=country.id+':'+module.id,brief=briefFor(module,country);
  return '<details class="policy-card module-card" data-module="'+esc(key)+'" '+(opened.has(key)?'open':'')+'><summary class="module-summary" data-reading-key="'+esc(key+':summary')+'"><div class="module-head"><h3><span class="policy-number" aria-hidden="true">'+String(index+1).padStart(2,'0')+'</span>'+esc(module.title)+'</h3><span class="module-toggle">查看详情 <b aria-hidden="true">＋</b></span></div><span class="module-state '+esc(state)+'">'+esc(moduleLabel(module,country))+'</span><p class="module-highlight"><strong>'+esc(brief.conclusion)+'</strong></p></summary><div class="module-body">'+moduleBodyHTML(module,country)+'</div></details>';
}
function countryHTML(country){
  return '<article class="country-report" data-country-report="'+esc(country.id)+'"><div class="country-heading"><span class="country-code" aria-hidden="true">'+esc(country.id)+'</span><div><h2>'+esc(country.name)+'</h2><span class="badge country-status">'+esc(country.status)+'</span></div></div><p class="country-summary emphasis-summary">'+esc(country.summary)+'</p><div class="policy-grid">'+country.modules.map((m,j)=>moduleHTML(m,country,j)).join('')+'</div><details class="sources-section" data-country-sources><summary>全部官方来源与查询入口</summary><p class="sources-caption">按需查看原文链接与取得时间。</p><div class="source-list">'+country.sources.map(sourceHTML).join('')+'</div></details><div class="country-notices">'+country.notices.map(n=>'<p class="country-notice">'+esc(n)+'</p>').join('')+'</div></article>';
}
function captureReadingPosition(){
  const candidates=[...document.querySelectorAll('.country-report:not([hidden]) [data-reading-key]')].filter(el=>{const r=el.getBoundingClientRect();return r.height&&r.top>=0&&r.top<window.innerHeight-40;});
  const focused=document.activeElement?.closest('[data-reading-key]'),focusRect=focused?.getBoundingClientRect();
  const node=focusRect?.height&&focusRect.top>=0&&focusRect.top<window.innerHeight-40?focused:candidates.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top)[0];
  return {key:node?.dataset.readingKey,top:node?.getBoundingClientRect().top,y:window.scrollY,x:window.scrollX,focus:document.activeElement,selection:String(window.getSelection()||'')};
}
function restoreReadingPosition(position){
  const node=position.key?[...document.querySelectorAll('[data-reading-key]')].find(el=>el.dataset.readingKey===position.key):null;
  const delta=node?node.getBoundingClientRect().top-position.top:0;
  window.scrollTo({left:position.x,top:Math.max(0,position.y+delta),behavior:'instant'});
  if(position.focus?.isConnected&&document.activeElement!==position.focus)position.focus.focus({preventScroll:true});
}
function updateCountryDOM(country){
  const article=[...document.querySelectorAll('[data-country-report]')].find(el=>el.dataset.countryReport===country.id);if(!article)return;
  article.querySelector('.country-status').textContent=country.status;
  const summary=article.querySelector('.country-summary');summary.textContent=country.summary;
  for(const module of country.modules){
    const key=country.id+':'+module.id,card=[...article.querySelectorAll('.module-card')].find(el=>el.dataset.module===key);if(!card)continue;
    const state=module.research?.state||'saved',badge=card.querySelector('.module-state');badge.className='module-state '+state;badge.textContent=moduleLabel(module,country);
    card.querySelector('.module-highlight strong').textContent=briefFor(module,country).conclusion;
    const body=card.querySelector('.module-body'),html=moduleBodyHTML(module,country);
    if(body.dataset.rendered===html)continue;
    // Keep the paragraph being selected or a focused source control intact until the reader leaves it.
    if(body.contains(document.activeElement)||String(window.getSelection()||'')&&body.contains(window.getSelection()?.anchorNode)){card.dataset.pendingBody='true';continue;}
    const opened=new Set([...body.querySelectorAll('details[open][data-detail-key]')].map(d=>d.dataset.detailKey));
    body.innerHTML=html;body.dataset.rendered=html;delete card.dataset.pendingBody;
    body.querySelectorAll('details[data-detail-key]').forEach(d=>d.open=opened.has(d.dataset.detailKey));
  }
  const sources=article.querySelector('.source-list'),html=country.sources.map(sourceHTML).join('');if(sources.dataset.rendered!==html){sources.innerHTML=html;sources.dataset.rendered=html;}
  article.querySelector('.country-notices').innerHTML=country.notices.map(n=>'<p class="country-notice">'+esc(n)+'</p>').join('');
}
function renderReport(report,{update=false}={}){
  const position=update?captureReadingPosition():null;
  if(currentReport?.id===report.id){if(currentReport.evaluation&&!report.evaluation)report.evaluation=currentReport.evaluation;if(currentReport.evaluationConditions&&!report.evaluationConditions)report.evaluationConditions=currentReport.evaluationConditions;}
  currentReport=report;const i=report.input;
  evaluationUI?.setReport(report,{updated:update});
  $('report-context').textContent=i.product+' · '+i.formName+' · 原产地：'+i.originName+'｜查询时间：'+date(report.createdAt);
  $('report-note').textContent=report.scopeNote;
  const modules=report.countries.flatMap(c=>c.modules),done=modules.filter(m=>['found','references','not_found','failed','cancelled'].includes(m.research?.state)).length;
  const working=report.automaticSearch&&!report.completed&&Boolean(controller);
  $('auto-search-text').textContent=working?'自动联网补充中 · 已检索 '+done+' / '+modules.length+' 个模块':'各国政策结果 · 展开先看分类讨论，核对说明按需查看';$('stop-research').hidden=!working;
  if(!update){
    $('country-tabs').innerHTML=report.countries.map((c,j)=>'<button type="button" class="country-tab" data-country-tab="'+esc(c.id)+'" aria-pressed="'+!j+'">'+esc(c.name)+'</button>').join('');
    $('country-reports').innerHTML=report.countries.map(countryHTML).join('');
    document.querySelectorAll('[data-country-report]').forEach((el,j)=>el.hidden=Boolean(j));
    $('comparison-panel').hidden=true;$('toggle-comparison').setAttribute('aria-expanded','false');changeView('results');
  }else report.countries.forEach(updateCountryDOM);
  $('comparison-table').innerHTML='<caption class="sr-only">'+esc(i.product)+'政策对照</caption><thead><tr><th>政策内容</th>'+report.countries.map(c=>'<th>'+esc(c.name)+'</th>').join('')+'</tr></thead><tbody>'+config.modules.map(row=>'<tr><th>'+esc(row.title)+'</th>'+report.countries.map(c=>'<td>'+esc(briefFor(c.modules.find(m=>m.id===row.id),c).conclusion)+'</td>').join('')+'</tr>').join('')+'</tbody>';
  $('toggle-comparison').hidden=report.countries.length<2;
  if(position)restoreReadingPosition(position);
}
function flushPendingReadingUpdates(){
  const ready=[...document.querySelectorAll('[data-pending-body="true"]')].some(card=>!card.querySelector('.module-body')?.contains(document.activeElement));
  if(currentReport&&ready&&!String(window.getSelection()||''))renderReport(currentReport,{update:true});
}
document.addEventListener('focusout',()=>queueMicrotask(flushPendingReadingUpdates));
document.addEventListener('selectionchange',()=>{if(!String(window.getSelection()||''))queueMicrotask(flushPendingReadingUpdates);});
function applyResearchEvent(event){
  if(event.type==='initial'){renderReport(event.report);return;}
  if(event.type==='result'){event.report.completed=true;renderReport(event.report,{update:true});remember(currentReport);return;}
  if(!currentReport)return;
  if(event.type==='country'){const index=currentReport.countries.findIndex(c=>c.id===event.country.id);if(index>=0)currentReport.countries[index]=event.country;}
  if(event.type==='module'){
    const country=currentReport.countries.find(c=>c.id===event.countryId),module=country?.modules.find(m=>m.id===event.moduleId);
    if(module){module.research=event.research;if(event.brief)module.brief=event.brief;if(event.findings)module.findings=event.findings;if(event.sources)country.sources=[...new Map([...country.sources,...event.sources].map(s=>[s.id,s])).values()];}
  }
  if(event.type==='error'){$('auto-search-text').textContent=event.error;return;}
  if(event.type!=='progress')renderReport(currentReport,{update:true});
}
function validReport(r){return ['2.7.0-policy.2','2.7.0-policy.3','2.7.0-policy.4','2.7.0-policy.5','2.7.0-policy.6','2.7.0-policy.7','2.7.0-policy.8','2.7.0-policy.9'].includes(r?.version)&&r?.input&&typeof r.input.product==='string'&&typeof r.id==='string'&&Array.isArray(r.countries)&&r.countries.length>0&&r.countries.length<=(config?.catalog.countries.length||92)&&r.countries.every(c=>Array.isArray(c.modules)&&c.modules.every(m=>Array.isArray(m.findings)&&m.findings.every(f=>Array.isArray(f.sourceIds)))&&Array.isArray(c.sources)&&Array.isArray(c.notices));}
function writeHistory(){
  try{localStorage.setItem(STORAGE,JSON.stringify(history));return true;}catch{toast('浏览器未能保存记录，本次结果仍可下载。');return false;}
}
function remember(report){
  history=[report,...history.filter(r=>r.id!==report.id)].slice(0,20);
  writeHistory();updateHistoryCount();
}
function updateHistoryCount(){$('history-count').textContent=history.length;$('history-count').hidden=!history.length;}
function renderHistory(){
  $('clear-history').hidden=!history.length;
  $('history-list').innerHTML=history.length?history.map(r=>`<article class="history-item"><div><h2>${esc(r.input.product)} <span class="badge">${esc(r.input.formName)}</span></h2><p>${esc(r.input.originName)} → ${r.countries.map(c=>esc(c.name)).join('、')}<br>${esc(date(r.createdAt))}</p></div><div class="history-actions"><button type="button" class="secondary-button" data-open-report="${esc(r.id)}">查看结果</button><button type="button" class="text-button" data-reuse-report="${esc(r.id)}">修改查询</button><button type="button" class="text-button" data-delete-report="${esc(r.id)}" aria-label="删除${esc(r.input.product)}这条查询记录">删除</button></div></article>`).join(''):'<div class="empty-state"><h2>还没有查询记录</h2><p>完成一次查询后，结果会保存在这里。</p><button type="button" class="primary-button" data-view="query">开始查询 ↗</button></div>';
}
function markdown(report){
  const i=report.input,lines=[`# ${i.product} · 各国进口政策概况`,'',`产品形态：${i.formName}｜原产地：${i.originName}`,`查询时间：${date(report.createdAt)}`,'',report.scopeNote,''];
  for(const country of report.countries){
    lines.push(`## ${country.name}`,'',country.summary,'');
    for(const module of country.modules){
      const brief=briefFor(module,country);lines.push(`### ${module.title}`,'',`**政策结论：${brief.conclusion}**`,'','分类讨论结果：','',brief.discussionNote||'以下结果须满足各自列明的条件。','');
      for(const row of brief.scenarios)lines.push(`#### ${row.title}`,'',`适用情形：${row.condition}`,'',`**${row.result}**`,'',`需确认：${(row.needs||[]).join('、')}`,'');
      lines.push('官方原文摘录：','');
      if(brief.quotations.length)for(const quote of brief.quotations)lines.push('> '+quote.text,'',quote.authority+' · '+quote.title,'');else lines.push('本次尚未取得可引用的官方正文。','');
      lines.push('<details><summary>核对依据与讨论说明</summary>','',...brief.analysis.flatMap(p=>[p,'']),...brief.verificationNotes.flatMap(p=>[p,'']),brief.limits||'','','</details>','');
      lines.push('<details><summary>检索与核对记录</summary>','',`检索状态：${searchLabels[module.research?.state]||'尚未补充'}`,`检索内容：${module.research?.query||'未记录'}`,'');
      for(const id of module.research?.sourceIds||[]){const source=country.sources.find(s=>s.id===id);if(source&&link(source.url))lines.push(`[${source.title}](${link(source.url)})`,'');}
      lines.push('</details>','');
    }
  }
  return lines.join('\n');
}
function download(){if(!currentReport)return;const blob=new Blob(['\uFEFF'+markdown(currentReport)],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(currentReport.input.product+'_'+currentReport.countries.map(c=>c.name).join('_')+'_政策摘要.md').replace(/[<>:"/\\|?*]/g,'_').slice(0,160);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('摘要包含本次查询的全部国家及来源。');}

document.addEventListener('click',event=>{
  const target=event.target.closest('button,a');if(!target)return;
  if(target.dataset.view){event.preventDefault();changeView(target.dataset.view);return;}
  if(target.dataset.removeCountry){selected=selected.filter(id=>id!==target.dataset.removeCountry);renderSelection();saveDraft();return;}
  if(target.dataset.countryTab){document.querySelectorAll('[data-country-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===target)));document.querySelectorAll('[data-country-report]').forEach(c=>c.hidden=c.dataset.countryReport!==target.dataset.countryTab);return;}
  if(target.dataset.openReport){const r=history.find(r=>r.id===target.dataset.openReport);if(r){fillInput(r.input);renderReport(r);if((!r.automaticSearch||r.version!==config.version)&&!controller)runQuery(r.input);}return;}
  if(target.dataset.reuseReport){const r=history.find(r=>r.id===target.dataset.reuseReport);if(r){fillInput(r.input);saveDraft();changeView('query');$('product').focus();}return;}
  if(target.dataset.deleteReport){history=history.filter(r=>r.id!==target.dataset.deleteReport);writeHistory();updateHistoryCount();renderHistory();toast('已删除这条记录。');}
});
$('choose-countries').addEventListener('click',openPicker);
$('close-picker').addEventListener('click',()=>$('country-picker').close());
$('country-picker').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();$('country-picker').close();}});
$('country-search').addEventListener('input',renderPicker);
$('country-options').addEventListener('change',event=>{const id=event.target.value;if(!config.catalog.countries.some(c=>c.id===id))return;if(event.target.checked){if(!pickerSelected.includes(id))pickerSelected.push(id);}else pickerSelected=pickerSelected.filter(x=>x!==id);updatePickerCount();});
$('picker-modes').addEventListener('click',event=>{const b=event.target.closest('[data-picker-mode]');if(b){pickerMode=b.dataset.pickerMode;$('country-search').value='';renderPicker();}});
$('organization-tabs').addEventListener('click',event=>{const b=event.target.closest('[data-country-group]');if(b){activeGroup=b.dataset.countryGroup;$('country-search').value='';renderPicker();}});
$('country-options').addEventListener('click',event=>{const b=event.target.closest('[data-select-continent]');if(b){const ids=visibleCountryIds.filter(id=>config.catalog.countries.find(c=>c.id===id).continent===b.dataset.selectContinent);pickerSelected=[...new Set([...pickerSelected,...ids])];renderPicker();}});
$('select-all-countries').addEventListener('click',()=>{pickerSelected=[...new Set([...pickerSelected,...visibleCountryIds])];renderPicker();});
$('clear-countries').addEventListener('click',()=>{pickerSelected=[];renderPicker();});
$('apply-countries').addEventListener('click',()=>{selected=[...pickerSelected];renderSelection();saveDraft();$('country-picker').close();});
$('query-form').addEventListener('input',()=>{if(config)saveDraft();});
$('query-form').addEventListener('change',()=>{if(config)saveDraft();});
$('query-form').addEventListener('invalid',event=>{if($('more-input').contains(event.target))$('more-input').open=true;},true);
async function runQuery(query){
  if(controller)return;$('form-error').hidden=true;controller=new AbortController();const activeController=controller;
  $('submit-query').disabled=true;$('refresh-report').disabled=true;$('cancel-query').hidden=false;
  $('query-status').textContent='自动联网搜索，结果将逐项补充。';
  let received=false,streamCompleted=false;
  try{
    const {product,form,originProvince,notes,milletKind,category,countries}=query;
    const response=await fetch('/api/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({product,form,originProvince,notes,milletKind,category,countries,refresh:true,stream:true}),signal:activeController.signal});
    if(!response.ok){const data=await response.json();throw new Error(data.error||'查询未完成。');}
    if(response.headers.get('content-type')?.includes('application/x-ndjson')){
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(true){const{value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){if(line.trim()){received=true;const event=JSON.parse(line);if(event.type==='result')streamCompleted=true;applyResearchEvent(event);}}if(done){if(buffer.trim()){const event=JSON.parse(buffer);if(event.type==='result')streamCompleted=true;applyResearchEvent(event);}break;}}
      if(!streamCompleted)throw new Error('联网检索连接中断，已取得内容保留，可重新联网补充。');
    }else{const{report}=await response.json();if(!validReport(report))throw new Error('结果格式不完整。');report.completed=true;remember(report);renderReport(report);received=true;}
    $('query-status').textContent='自动检索已完成。';
  }catch(error){
    if(error.name==='AbortError'){$('query-status').textContent='已取消，输入内容已保留。';if(received&&currentReport){for(const country of currentReport.countries)for(const module of country.modules)if(['queued','searching'].includes(module.research?.state))module.research.state='cancelled';currentReport.completed=true;remember(currentReport);renderReport(currentReport,{update:true});$('auto-search-text').textContent='已停止自动检索，已取得内容保留。';}}
    else{if(received&&currentReport){currentReport.partial=true;currentReport.completed=true;for(const country of currentReport.countries)for(const module of country.modules)if(['queued','searching'].includes(module.research?.state))module.research.state='failed';remember(currentReport);renderReport(currentReport,{update:true});}if(view==='results')$('auto-search-text').textContent=error.message;else{$('form-error').textContent=error.message;$('form-error').hidden=false;}$('query-status').textContent='请检查输入或稍后重试。';}
  }finally{if(controller===activeController)controller=null;$('submit-query').disabled=false;$('refresh-report').disabled=false;$('cancel-query').hidden=true;$('stop-research').hidden=true;}
}
$('query-form').addEventListener('submit',async event=>{event.preventDefault();if(!selected.length){$('form-error').textContent='请至少选择一个目标国家。';$('form-error').hidden=false;return;}saveDraft();await runQuery(input());});
$('refresh-report').addEventListener('click',()=>{if(currentReport)runQuery(currentReport.input);});
$('stop-research').addEventListener('click',()=>controller?.abort());
$('cancel-query').addEventListener('click',()=>controller?.abort());
$('edit-query').addEventListener('click',()=>{if(currentReport){fillInput(currentReport.input);saveDraft();}changeView('query');$('product').focus();});
$('toggle-comparison').addEventListener('click',()=>{$('comparison-panel').hidden=!$('comparison-panel').hidden;$('toggle-comparison').setAttribute('aria-expanded',String(!$('comparison-panel').hidden));});
$('download-report').addEventListener('click',download);
$('clear-history').addEventListener('click',()=>{if(!window.confirm('清空当前浏览器保存的全部政策查询记录？'))return;history=[];writeHistory();updateHistoryCount();renderHistory();toast('查询记录已清空。');});
$('open-about').addEventListener('click',()=>$('about-dialog').showModal());
$('close-about').addEventListener('click',()=>$('about-dialog').close());

async function init(){
  $('submit-query').disabled=true;
  try{
    const response=await fetch('/api/config');if(!response.ok)throw new Error();config=await response.json();
    $('product-options').innerHTML=[...new Set(config.catalog.products.map(p=>p.name))].map(name=>`<option value="${esc(name)}"></option>`).join('');
    $('form').innerHTML='<option value="">请选择</option>'+Object.entries(config.forms).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');
    const provinceGroups=[{name:'省',items:config.provinces.filter(p=>p.endsWith('省'))},{name:'自治区',items:config.provinces.filter(p=>p.endsWith('自治区'))},{name:'直辖市',items:config.provinces.filter(p=>p.endsWith('市'))},{name:'特别行政区',items:config.provinces.filter(p=>p.endsWith('特别行政区'))}];
    $('origin').innerHTML='<option value="">选择省级行政区</option>'+provinceGroups.map(group=>`<optgroup label="${esc(group.name)}">${group.items.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</optgroup>`).join('');
    fillInput(safeRead(DRAFT,{countries:selected,refresh:true}));
    saveDraft();
    const saved=safeRead(STORAGE,[]);history=Array.isArray(saved)?saved.filter(validReport).slice(0,20):[];updateHistoryCount();
    $('model-status').textContent=config.aiEnabled?'已启用官方原文的AI整理；具体条文需要匹配产品并附对应原文。':'当前可查看官方一般规则、联网获取原文与查询入口；产品专项条文的AI整理需配置服务端模型。';
    $('submit-query').disabled=false;
    if(view==='history')renderHistory();
  }catch{$('form-error').textContent='页面配置暂未加载，请刷新后重试。';$('form-error').hidden=false;$('query-status').textContent='等待配置加载。';}
}
$('product').addEventListener('input',()=>{$('millet-field').hidden=!/小米|谷子|黍米|millet/i.test($('product').value);});
evaluationUI=createEvaluationUI({onPolicyReport:r=>{renderReport(r,{update:true});remember(r);},getReport:()=>currentReport,onView:changeView,onRemember:remember,onToast:toast,getPolicyCountry:()=>document.querySelector('[data-country-tab][aria-pressed="true"]')?.dataset.countryTab,onInput:()=>{changeView('query',{restore:true});$('product').focus({preventScroll:true});},onPolicy:id=>{changeView('results',{restore:!id});if(id){document.querySelectorAll('[data-country-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.countryTab===id)));document.querySelectorAll('[data-country-report]').forEach(el=>el.hidden=el.dataset.countryReport!==id);const card=[...document.querySelectorAll('[data-module]')].find(el=>el.dataset.module===id+':posture');if(card){card.open=true;card.scrollIntoView({block:'start',behavior:'instant'});card.querySelector('summary')?.focus({preventScroll:true});}}}});
initLanding();
const initialView=['query','history'].includes(location.hash.slice(1))?location.hash.slice(1):'home';
window.history.replaceState({view:initialView},'',initialView==='home'?location.pathname+location.search:'#'+initialView);
changeView(initialView,{historyMove:true,scroll:false});
window.addEventListener('popstate',event=>{const next=event.state?.view||'home';if(next==='evaluation'&&currentReport)evaluationUI.open({historyMove:true});else changeView(next,{historyMove:true,restore:true});});
await init();
