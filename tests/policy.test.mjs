import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuery,queryPolicies,fetchDocument,validateFindings,officialURL,plainText,modelConfig,publicConfig} from '../policy-engine.mjs';
import {sourcesFor,SOURCES,MODULES} from '../policy-sources.mjs';
import {CATALOG} from '../catalog.mjs';

const base={product:'苹果',originProvince:'江苏省',form:'fresh',countries:['JP','US','DE'],refresh:false};
const disabled={enabled:false};
test('queries contain only policy-relevant inputs and preserve the country order',()=>{
  const input=normalizeQuery({...base,countries:['DE','JP','DE','US'],weights:{demand:100},freight:300,annualCapacity:10000});
  assert.deepEqual(input.countries,['DE','JP','US']);
  assert.equal(input.originCode,'CN');assert.equal(input.formName,'鲜品');
  assert.equal('weights' in input,false);assert.equal('freight' in input,false);assert.equal('annualCapacity' in input,false);
});
test('requires concrete product, product form, origin and destination',()=>{
  for(const change of [{product:''},{form:''},{originProvince:''},{originProvince:'不存在的省份'},{countries:[]},{countries:['USA']},{countries:'US'}])assert.throws(()=>normalizeQuery({...base,...change}));
});
test('removed purpose and HS inputs are ignored when restoring a legacy query',()=>{
  const input=normalizeQuery({...base,purpose:'industrial',purposeName:'工业用途',hs:'legacy-invalid-code'});
  for(const key of ['purpose','purposeName','hs'])assert.equal(key in input,false);
  assert.equal('purposes' in publicConfig(disabled),false);
});
test('origin is a Chinese provincial area and keeps the appropriate trade-region code',()=>{
  assert.equal(publicConfig(disabled).provinces.length,34);
  assert.equal(normalizeQuery({...base,originProvince:'浙江省'}).originName,'中国 · 浙江省');
  assert.equal(normalizeQuery({...base,originProvince:'香港特别行政区'}).originCode,'HK');
  assert.equal(normalizeQuery({...base,originProvince:'澳门特别行政区'}).originCode,'MO');
  assert.equal(normalizeQuery({...base,originProvince:'台湾省'}).originCode,'TW');
});
test('expands the country catalog with 60 common destinations and group members but drops old validity and scoring fields',()=>{
  assert.equal(CATALOG.countries.length,92);
  assert.ok(CATALOG.products.length>50);
  assert.ok(CATALOG.countries.every(c=>!('check' in c)&&!('score' in c)));
});
test('official source sets respect food and plant scope and member-country jurisdiction',()=>{
  const country=id=>CATALOG.countries.find(c=>c.id===id);
  assert.ok(sourcesFor(country('JP'),normalizeQuery(base)).some(s=>s.id==='jp-food'));
  assert.ok(!sourcesFor(country('JP'),normalizeQuery({...base,product:'棉花',category:'cash',form:'raw'})).some(s=>s.id==='jp-food'));
  assert.ok(!sourcesFor(country('JP'),normalizeQuery({...base,form:'seed'})).some(s=>s.id==='jp-food'));
  assert.match(sourcesFor(country('JP'),normalizeQuery(base)).find(s=>s.id==='jp-food').scope,/仅在作为食品进口时适用/);
  const eu=sourcesFor(country('DE'),normalizeQuery(base));
  assert.ok(eu.some(s=>s.id==='eu-agriculture'));
  assert.match(eu.find(s=>s.id==='eu-trade-DE').url,/destination=DE/);
  assert.match(eu.find(s=>s.id==='eu-trade-DE').url,/origin=CN/);
});
test('the offline path uses saved real-source overviews and never fabricates product permission or tariffs',async()=>{
  const report=await queryPolicies(base,{config:disabled,transport:()=>{throw new Error('unexpected network');}});
  assert.deepEqual(report.countries.map(c=>c.id),base.countries);
  assert.equal(report.modelUsed,false);assert.equal(report.refreshAttempted,false);
  for(const c of report.countries){
    assert.equal(c.modules.length,6);
    assert.ok(c.modules.find(m=>m.id==='tariff').findings.every(f=>!f.tariffCandidates?.length&&!/\d+(?:%|¢\/kg|yen\/kg)/.test(f.fact)));
    assert.ok(c.modules.flatMap(m=>m.findings).every(f=>f.status==='general'));
    assert.ok(!('score' in c)&&!('ranking' in c));
    assert.match(c.summary,/一般规则/);
  }
});
test('uncovered countries explicitly remain pending with official portals',async()=>{
  const report=await queryPolicies({...base,countries:['HN']},{config:disabled});
  const c=report.countries[0];assert.equal(c.status,'分类讨论已整理 · 专项依据待补充');
  assert.ok(c.modules.every(m=>m.findings.length===0));assert.ok(c.sources.every(s=>s.readStatus==='portal'));assert.ok(c.modules.every(m=>m.brief.scenarios.length>=2));
  assert.match(c.modules.find(m=>m.id==='changes').missing,/不能据此判断近期没有变化/);
});
test('failed live retrieval is visible and is not promoted to verified evidence',async()=>{
  const report=await queryPolicies({...base,countries:['JP'],refresh:true},{config:disabled,transport:async()=>{throw new Error('offline');}});
  assert.ok(report.countries[0].sources.filter(s=>s.kind==='overview').every(s=>s.readStatus==='unavailable'&&s.retrievedAt===null));
  assert.ok(report.countries[0].modules.flatMap(m=>m.findings).every(f=>f.status==='general'));
});
test('successful retrieval records the original read time without inventing effective dates',async()=>{
  const transport=async url=>new Response(`<html><body>${url.includes('maff')?'Plant Quarantine':'Food Sanitation'} ${'Official general policy text. '.repeat(12)}</body></html>`,{headers:{'content-type':'text/html'}});
  const report=await queryPolicies({...base,countries:['JP'],refresh:true},{config:disabled,transport});
  assert.ok(report.countries[0].sources.filter(s=>s.kind==='overview').every(s=>s.readStatus==='fetched'&&s.retrievedAt));
  assert.ok(report.countries[0].modules.flatMap(m=>m.findings).every(f=>f.effectiveDate===null||f.sourceIds.some(id=>report.countries[0].sources.some(s=>s.id===id&&s.effectiveDate===f.effectiveDate&&s.savedOn))));
});
test('only HTTPS official-host URLs are fetched; arbitrary and credential URLs are rejected',()=>{
  const allowed=new Set(['www.maff.go.jp']);
  assert.ok(officialURL(SOURCES.jpPlant.url,allowed));
  for(const url of ['http://www.maff.go.jp/','https://localhost/','https://www.maff.go.jp.evil.test/','https://user:secret@www.maff.go.jp/','https://www.maff.go.jp:9999/'])assert.equal(officialURL(url,allowed),null);
});
test('an official-page redirect cannot reach a non-official host',async()=>{
  await assert.rejects(fetchDocument(SOURCES.jpPlant,{cache:false,transport:async()=>new Response('',{status:302,headers:{location:'https://127.0.0.1/private'}})}),/官方域名/);
});
test('unreadable, mismatched and oversized source pages cannot become evidence',async()=>{
  await assert.rejects(fetchDocument(SOURCES.jpPlant,{cache:false,transport:async()=>new Response('<p>captcha</p>',{headers:{'content-type':'text/html'}})}),/可读原文/);
  await assert.rejects(fetchDocument(SOURCES.jpPlant,{cache:false,transport:async()=>new Response('wrong content '.repeat(30),{headers:{'content-type':'text/html'}})}),/不匹配/);
  await assert.rejects(fetchDocument(SOURCES.jpPlant,{cache:false,transport:async()=>new Response('x'.repeat(1800001),{headers:{'content-type':'text/html'}})}),/过长/);
});
test('source HTML and inline scripts remain data',()=>{
  assert.equal(plainText('<script>steal()</script><style>.bad{}</style><p>apple &amp; wheat</p>'),'apple & wheat');
});
const evidence='Apple imports require inspection.';
const doc={id:'official-1',url:'https://www.maff.go.jp/example',text:evidence+' This statement does not grant country-specific access.'};
const finding={module:'regulation',title:'苹果检验',fact:'原文涉及苹果进口检验。',scope:'仅涉及苹果检验，产地及形态适用待确认。',sourceIds:['official-1'],evidence,effectiveStatus:'有效状态待核实'};
test('a product finding needs a real exact citation and a matching product',()=>{
  assert.equal(validateFindings([finding],[doc],base).length,1);
  assert.equal(validateFindings([{...finding,evidence:'Imaginary rule.'}],[doc],base).length,0);
  assert.equal(validateFindings([finding],[doc],{...base,product:'小麦'}).length,0);
  assert.equal(validateFindings([{...finding,sourceIds:['invented']}],[doc],base).length,0);
});
test('unsupported numbers, scores, dates and long quotations are discarded',()=>{
  assert.equal(validateFindings([{...finding,fact:'关税为10%。'}],[doc],base).length,0);
  assert.equal(validateFindings([{...finding,fact:'产品匹配分最高。'}],[doc],base).length,0);
  const result=validateFindings([{...finding,effectiveDate:'2026-10-14'}],[doc],base);assert.equal(result[0].effectiveDate,null);
  const long='Apple '+Array(26).fill('word').join(' ');assert.equal(validateFindings([{...finding,evidence:long}],[{...doc,text:long}],base).length,0);
});
test('public configuration never exposes model credentials and has no scoring controls',()=>{
  const publicData=publicConfig({enabled:true,apiKey:'test-secret'});
  assert.equal(JSON.stringify(publicData).includes('test-secret'),false);
  assert.equal('weights' in publicData,false);assert.equal(publicData.modules.length,MODULES.length);
});
test('model configuration retains supported server-side configuration and rejects insecure remote bases',()=>{
  assert.equal(modelConfig({DEEPSEEK_API_KEY:'test-only'}).enabled,true);
  assert.throws(()=>modelConfig({AGRIMATCH_API_BASE:'http://remote.test'}));
  assert.equal(modelConfig({AGRIMATCH_API_BASE:'http://127.0.0.1:1234'}).enabled,false);
});
test('configured AI extraction keeps only product-linked original evidence and discards fabricated figures',async()=>{
  let modelCalled=false;
  const transport=async(url,options)=>{
    if(String(url).includes('model.test')){
      modelCalled=true;
      const messages=JSON.parse(options.body).messages;assert.ok(messages[1].content.includes('us-food'));
      return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({findings:[{...finding,sourceIds:['us-food']},{...finding,sourceIds:['us-food'],fact:'关税为25%。'}]})}}]});
    }
    if(String(url).includes('duckduckgo')||String(url).includes('bing.com'))return new Response('<rss></rss>',{headers:{'content-type':'text/xml'}});
    return new Response('<html><body>Importing Food Products '+evidence+' '+('Official food import policy background. '.repeat(12))+'</body></html>',{headers:{'content-type':'text/html'}});
  };
  const report=await queryPolicies({...base,countries:['US'],refresh:true},{config:{enabled:true,apiKey:'test-only',base:'https://model.test',model:'fixture'},transport});
  assert.equal(modelCalled,true);assert.equal(report.modelUsed,true);
  const findings=report.countries[0].modules.flatMap(m=>m.findings).filter(f=>f.status==='product');
  assert.equal(findings.length,1);assert.equal(findings[0].evidence,evidence);assert.equal(JSON.stringify(report).includes('25%'),false);assert.equal(JSON.stringify(report).includes('test-only'),false);
});
