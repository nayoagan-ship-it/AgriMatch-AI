const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const time=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'未注明':d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});};
const number=value=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('zh-CN',{maximumFractionDigits:2}):'未取得';
const fields=['route','temperature','remainingDays','totalDays','buyerPrice','goodsCost','transportCost','otherCost','costsComplete','sourceNote','competitorNote','buyerFeedback'];

function sourceHTML(source){const href=url(source.url);return href?`<p class="evaluation-source"><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(source.title||source.authority||'查看依据')} ↗</a>${source.retrievedAt?'<br>'+(source.saved?'保存记录取得时间：':'取得时间：')+esc(time(source.retrievedAt)):source.verifiedOn?'<br>保存依据核对日期：'+esc(source.verifiedOn)+' · 本次未独立复核':''}${source.readStatus==='unavailable'?'<br>本次未取得可读原文，保留保存依据。':''}</p>`:'';}
function compact(d){if(d.series){const latest=[...d.series].reverse().find(r=>r.value!==null);return latest?latest.year+'年 '+number(latest.value/10000)+'万美元':'见下方分类讨论';}if(d.benchmark)return d.benchmark.year+'年统计均价 '+number(d.benchmark.average)+'美元/公斤';if(d.suppliers?.rows?.length){const r=d.suppliers.rows[0];return r.name+(r.share===null?'':' '+(r.share*100).toFixed(1)+'%');}return d.scenarios?.length?d.scenarios.length+'种情形 · 展开查看条件与结果':'';}
function cardHTML(d,country){
  const series=d.series&&d.series.some(r=>r.value!==null)?`<table class="evaluation-series"><caption>同口径年度进口记录</caption><thead><tr><th>年份</th><th>进口额（美元）</th><th>重量（公斤）</th></tr></thead><tbody>${d.series.map(row=>`<tr><td>${row.year}</td><td>${number(row.value)}${row.estimated?'*':''}${row.aggregate?'†':''}</td><td>${number(row.netWeight)}${row.weightEstimated?'*':''}</td></tr>`).join('')}</tbody></table><p class="evaluation-data-note">${esc(d.dataNote||'')} * 含估计标记；† 为商品汇总记录。未标注不等于已经逐笔审计。</p>`:'';
  const suppliers=d.suppliers?`<table class="evaluation-series"><caption class="sr-only">主要供应来源</caption><thead><tr><th>供应来源</th><th>进口额（美元）</th><th>同口径份额</th></tr></thead><tbody>${d.suppliers.rows.map(row=>`<tr><td>${esc(row.name)}</td><td>${number(row.value)}</td><td>${row.share===null?'未取得':(row.share*100).toFixed(1)+'%'}</td></tr>`).join('')}</tbody></table>`:'';
  const facts=(d.facts||[]).filter(f=>suppliers?f.startsWith('用户记录'):!series);
  const cases=(d.scenarios||[]).map(row=>`<article class="evaluation-case"><h4>${esc(row.title)}</h4><p><span>如果</span>${esc(row.condition)}</p><p><span>那么</span>${esc(row.result)}</p>${row.needs?.length?'<small>需确认：'+row.needs.map(esc).join('、')+'</small>':''}</article>`).join('');
  const discussion=cases?`<details class="evaluation-discussion"${['pending','partial','adjust'].includes(d.state)?' open':''}><summary>${d.scenarios.length}种情形：条件与判断结果</summary><p class="evaluation-data-note">${esc(d.caseNote)}</p>${cases}</details>`:'';
  const benchmark=d.benchmark?`<div class="evaluation-benchmark"><span>${d.benchmark.year}年 · 历史进口统计均价</span><strong>${number(d.benchmark.average)} <small>美元/公斤</small></strong><p>进口额 ÷ 统计重量${d.benchmark.weightEstimated?'（重量含估计）':''}；不是本产品采购报价。</p></div>`:'';
  const sources=d.sources||[];
  return `<article class="evaluation-card" data-evaluation-dimension="${esc(d.id)}"><h3>${esc(d.title)}<span>${esc(d.type)}</span></h3><span class="evaluation-label" data-state="${esc(d.state)}">${esc(d.label)}</span><p>${esc(d.summary)}</p>${d.scope?'<p class="evaluation-data-note">'+esc(d.scope.note)+'</p>':''}${series}${suppliers}${benchmark}${facts.length?'<ul>'+facts.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul>':''}${sources.slice(0,2).map(sourceHTML).join('')}${discussion}<details><summary>核对清单与其余依据</summary>${sources.slice(2).map(sourceHTML).join('')}${d.issues?.length?'<ul>'+d.issues.map(t=>'<li>'+esc(t)+'</li>').join(''):'<p>按当前取得的资料继续核对。</p>'}</details>${d.next?.length?'<p class="evaluation-action"><strong>下一步：</strong>'+esc(d.next[0])+'</p>':''}${['logistics','income'].includes(d.id)?`<button type="button" class="text-button" data-evaluation-supplement="${esc(country.id)}">填写该国实际${d.id==='logistics'?'运输':'报价与费用'} →</button>`:''}${d.policyModule?`<button type="button" class="text-button" data-evaluation-policy="${esc(country.id)}">查看该国政策 ↗</button>`:''}</article>`;
}

function evaluationMarkdown(evaluation){
  const i=evaluation.input,lines=[`# ${i.product} · AI条件评价`,'',`${i.formName}｜原产地：${i.originName}`,`评价时间：${time(evaluation.createdAt)}`,'',evaluation.note,''];
  for(const c of evaluation.countries){
    lines.push('## '+c.name,'',c.status,'',c.summary,'');
    for(const d of c.dimensions){lines.push('### '+d.title,'',d.label,'',d.summary,'',...(d.facts||[]).map(t=>'- '+t),'');for(const source of d.sources||[])if(url(source.url))lines.push(`[${source.title||'依据'}](${url(source.url)})`,'');for(const row of d.scenarios||[])lines.push('#### '+row.title,'','如果：'+row.condition,'','那么：'+row.result,'','需确认：'+(row.needs||[]).join('、'),'');}
    lines.push('### 下一步','',...c.next.map(n=>'- '+n.text),'');
  }
  if(evaluation.ai.insights.length)lines.push('## 资料解读','',...evaluation.ai.insights.flatMap(i=>[i.text,'']));
  return lines.join('\n');
}

export function createEvaluationUI({getReport,onView,onPolicy,onInput,onRemember,onToast,getPolicyCountry,onPolicyReport}){
  let controller=null,generation=0,reportId=null,currentCountry=null,formCountry=null,formReportId=null,renderedEvaluationId=null;
  const form=$('evaluation-form');
  const report=()=>getReport();
  function storeFields(){
    const r=report();if(!r||!formCountry||formReportId!==r.id)return;
    r.evaluationConditions||={};const entry={};
    for(const key of fields){const field=form.elements.namedItem(key);entry[key]=field.type==='checkbox'?field.checked:field.value;}
    r.evaluationConditions[formCountry]=entry;onRemember(r);
  }
  function loadFields(id){
    formCountry=id;const value=report()?.evaluationConditions?.[id]||{};
    for(const key of fields){const field=form.elements.namedItem(key);if(field.type==='checkbox')field.checked=value[key]===true;else field.value=value[key]??(key==='temperature'?'unknown':'');}
  }
  function setupFields(){
    const r=report();if(!r)return;
    if(formReportId===r.id)return;
    formReportId=r.id;formCountry=null;
    $('evaluation-condition-country').innerHTML=r.countries.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    const selected=getPolicyCountry();if(r.countries.some(c=>c.id===selected))$('evaluation-condition-country').value=selected;
    loadFields($('evaluation-condition-country').value);
  }
  function setLoading(loading){
    $('evaluation-status').parentElement.dataset.loading=String(loading);$('evaluation-refresh').disabled=loading;$('evaluation-save').disabled=loading;$('evaluation-cancel').hidden=!loading;
  }
  function render(evaluation){
    if(!evaluation||evaluation.version!=='conditions-and-evidence.2'||evaluation.policyReportId!==report()?.id)return;
    const countries=evaluation.countries;if(!countries.some(c=>c.id===currentCountry))currentCountry=getPolicyCountry()||countries[0].id;
    if(!countries.some(c=>c.id===currentCountry))currentCountry=countries[0].id;
    const scope=evaluation.scope.hs?`参考统计范围：HS ${evaluation.scope.hs} · ${evaluation.scope.label}`:'统计范围尚待核实';
    const table=`<div class="evaluation-overview"><h2>先把各国的情况放在一起看</h2><p>有依据时看事实，不能确认时看分类讨论。以下保持国家选择顺序。</p><p class="evaluation-scope"><strong>${esc(scope)}</strong><br>${esc(evaluation.scope.note)}</p><div class="evaluation-table-scroll" tabindex="0" aria-label="各国评价对照，可横向滚动"><table class="evaluation-table"><thead><tr><th>国家</th><th>进口准入</th><th>物流</th><th>需求</th><th>收益</th><th>竞争</th></tr></thead><tbody>${countries.map(c=>`<tr><th>${esc(c.name)}</th>${c.dimensions.map(d=>`<td>${esc(d.label)}<span>${esc(compact(d))}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    const tabs=`<div class="evaluation-tabs" role="group" aria-label="查看国家评价">${countries.map(c=>`<button type="button" class="evaluation-tab" data-evaluation-country="${esc(c.id)}" aria-pressed="${c.id===currentCountry}">${esc(c.name)}</button>`).join('')}</div>`;
    const body=countries.map(c=>`<article data-evaluation-report="${esc(c.id)}"${c.id===currentCountry?'':' hidden'}><div class="evaluation-country-heading"><span class="country-code" aria-hidden="true">${esc(c.id)}</span><div><h2>${esc(c.name)}</h2><p>${esc(c.status)}</p></div></div><p class="evaluation-country-summary">${esc(c.summary)}</p><div class="evaluation-grid">${c.dimensions.map(d=>cardHTML(d,c)).join('')}</div><section class="evaluation-next"><h3>下一步先做什么？</h3><ul>${c.next.map(n=>'<li>'+esc(n.text)+'</li>').join('')}</ul></section></article>`).join('');
    const insights=evaluation.ai.insights.length?`<section class="evaluation-insights"><h2>根据已有资料看取舍</h2>${evaluation.ai.insights.map(i=>'<p>'+esc(i.text)+'</p>').join('')}<small>解读仅采用本次评价列出的证据，不改变准入和资料缺失状态。</small></section>`:'';
    const completed=evaluation.completion?`<p class="evaluation-completion">本次自动整理：${evaluation.completion.policyModules}个政策栏目 · ${evaluation.completion.originalSources}条来源取得可读原文 · ${evaluation.completion.statisticsCountries}国取得进口背景 · ${evaluation.completion.caseCount}项条件讨论。原文可读不等于已确认本批货物满足条件。</p>`:'';
    $('evaluation-content').innerHTML=completed+table+tabs+body+insights+`<p class="evaluation-note">${esc(evaluation.ai.note)}</p>`;
    $('evaluation-download').disabled=false;renderedEvaluationId=evaluation.id;
  }
  function setReport(r,{updated=false}={}){
    if(reportId&&reportId!==r.id){controller?.abort();generation++;controller=null;renderedEvaluationId=null;currentCountry=null;formReportId=null;setLoading(false);$('evaluation-content').innerHTML='';$('evaluation-download').disabled=true;$('evaluation-error').hidden=true;}
    reportId=r.id;
    if(updated&&r.evaluation)$('evaluation-policy-update').hidden=false;
  }
  async function requestEvaluation({refreshPolicy=false}={}){
    const r=report();if(!r||controller)return;
    storeFields();const thisGeneration=++generation,sourceId=r.id;controller=new AbortController();const active=controller;
    setLoading(true);$('evaluation-error').hidden=true;$('evaluation-policy-update').hidden=true;
    $('evaluation-status').textContent='正在完成政策检索与原文核对，再读取年度进口及供应来源；无法确认的事项将自动分类讨论。';
    if(!r.evaluation)$('evaluation-content').innerHTML='<div class="evaluation-skeleton">正在整理这几个国家的情况…<br>你可以随时返回政策页或输入页，已填资料会保留。</div>';
    try{
      const response=await fetch('/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reportId:r.id,query:r.input,conditions:r.evaluationConditions||{},refreshPolicy}),signal:active.signal});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||'评价暂未完成。');
      const e=payload.evaluation;if(e?.version!=='conditions-and-evidence.2'||e.policyReportId!==sourceId||!Array.isArray(e.countries)||e.countries.length!==r.countries.length)throw new Error('评价结果不完整，请重试。');
      if(thisGeneration!==generation||report()?.id!==sourceId)return;
      if(payload.policyReport)onPolicyReport?.(payload.policyReport);
      report().evaluation=e;onRemember(report());render(e);$('evaluation-status').textContent='评价已整理 · '+time(e.createdAt)+' · 未取得的资料均已标明。';
      if(!report().completed)$('evaluation-policy-update').hidden=false;
    }catch(error){
      if(thisGeneration!==generation||report()?.id!==sourceId)return;
      if(error.name==='AbortError')$('evaluation-status').textContent='已停止本次评价，政策与输入资料仍保留。';else{$('evaluation-error').textContent=error.message||'评价未完成，请重试。';$('evaluation-error').hidden=false;$('evaluation-status').textContent='本次评价未完成，可以重试或返回政策页。';}
      if(!report()?.evaluation)$('evaluation-content').innerHTML='<div class="evaluation-skeleton">本次尚未生成完整评价。<br>点击“更新评价”重新整理，或返回政策页继续查看。</div>';
    }finally{if(controller===active){controller=null;setLoading(false);}}
  }
  function open({historyMove=false}={}){
    const r=report();if(!r){onToast('请先填写产品并查看各国政策。');return;}
    setReport(r);setupFields();$('evaluation-context').textContent=r.input.product+' · '+r.input.formName+' · 原产地：'+r.input.originName+'｜'+r.countries.map(c=>c.name).join('、');
    onView('evaluation',{restore:Boolean(renderedEvaluationId),historyMove});
    if(r.evaluation?.policyReportId===r.id&&r.evaluation.version==='conditions-and-evidence.2'){if(renderedEvaluationId!==r.evaluation.id)render(r.evaluation);$('evaluation-status').textContent='已恢复本次评价 · '+time(r.evaluation.createdAt);}
    else if(!controller)void requestEvaluation();
  }
  $('open-evaluation').addEventListener('click',()=>open());
  $('evaluation-back-policy').addEventListener('click',()=>onPolicy());
  $('evaluation-back-input').addEventListener('click',()=>onInput());
  $('evaluation-refresh').addEventListener('click',()=>requestEvaluation({refreshPolicy:true}));
  $('evaluation-cancel').addEventListener('click',()=>controller?.abort());
  $('evaluation-condition-country').addEventListener('change',()=>{storeFields();loadFields($('evaluation-condition-country').value);});
  form.addEventListener('input',()=>{storeFields();$('evaluation-status').textContent='补充资料已保存，点击“保存资料并更新评价”应用到结果。';});
  form.addEventListener('change',storeFields);
  form.addEventListener('submit',event=>{event.preventDefault();storeFields();void requestEvaluation();});
  $('evaluation-content').addEventListener('click',event=>{
    const supplement=event.target.closest('[data-evaluation-supplement]');if(supplement){storeFields();$('evaluation-condition-country').value=supplement.dataset.evaluationSupplement;loadFields(supplement.dataset.evaluationSupplement);$('evaluation-supplement').open=true;$('evaluation-supplement').scrollIntoView({block:'start',behavior:'instant'});return;}
    const tab=event.target.closest('[data-evaluation-country]');if(tab){currentCountry=tab.dataset.evaluationCountry;$('evaluation-content').querySelectorAll('[data-evaluation-country]').forEach(b=>b.setAttribute('aria-pressed',String(b===tab)));$('evaluation-content').querySelectorAll('[data-evaluation-report]').forEach(el=>el.hidden=el.dataset.evaluationReport!==currentCountry);return;}
    const target=event.target.closest('[data-evaluation-policy]');if(target)onPolicy(target.dataset.evaluationPolicy);
  });
  $('evaluation-download').addEventListener('click',()=>{
    const e=report()?.evaluation;if(!e)return;const blob=new Blob(['\uFEFF'+evaluationMarkdown(e)],{type:'text/markdown;charset=utf-8'}),href=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=href;anchor.download=(e.input.product+'_AI评价.md').replace(/[<>:"/\\|?*]/g,'_');anchor.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  });
  return {open,setReport,isLoading:()=>Boolean(controller)};
}
