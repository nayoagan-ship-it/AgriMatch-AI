import test from 'node:test';
import assert from 'node:assert/strict';
import {queryPolicies,normalizeQuery,validateFindings} from '../policy-engine.mjs';
import {buildModuleQuery,tariffRows,trustedDomain} from '../policy-research.mjs';
import {MODULES} from '../policy-sources.mjs';
import {containsTerm} from '../search.mjs';
const input=normalizeQuery({product:'绿茶',form:'dried',originProvince:'江苏省',countries:['US'],refresh:true});
const country={id:'US',name:'美国'};
test('automatic queries are distinct for all six modules and retain regional scope',()=>{
  const queries=MODULES.map(m=>buildModuleQuery(input,country,m));assert.equal(new Set(queries).size,6);
  assert.ok(queries.every(q=>q.includes('green tea')&&q.includes('United States')));assert.match(queries[3],/江苏省/);
  assert.equal(normalizeQuery({product:'绿茶',form:'dried',originProvince:'江苏省',countries:['US']}).refresh,true);
});
test('official domain matching accepts real subdomains and rejects lookalikes',()=>{
  assert.equal(trustedDomain('www.fda.gov',['fda.gov']),true);assert.equal(trustedDomain('fda.gov.evil.test',['fda.gov']),false);
});
test('tariff reference rows retain correct ancestors and preserve unknown additional duties',()=>{
  const rows=tariffRows([{htsno:'0902',description:'Tea',general:null},{htsno:'0902.20',description:'Other green tea',general:null},{htsno:'0902.10',description:'Green tea packings under 3 kg',general:null},{htsno:'0902.10.10',description:'Flavored',general:'Free',additionalDuties:null}],input);
  assert.equal(rows.length,1);assert.match(rows[0].description,/under 3 kg/);assert.doesNotMatch(rows[0].description,/Other green tea/);assert.equal(rows[0].additionalDuties,null);
});
test('six modules are searched even without a model and produce incremental events',async()=>{
  const events=[],queries=[];
  const transport=async url=>{
    queries.push(String(url));
    if(String(url).includes('reststop'))return Response.json([{htsno:'0902.10.10',description:'Green tea',general:'Free',additionalDuties:null}]);
    if(String(url).includes('federalregister.gov/api'))return Response.json({results:[]});
    return new Response('<rss></rss>',{headers:{'content-type':'text/html'}});
  };
  const report=await queryPolicies(input,{config:{enabled:false},transport,onProgress:e=>events.push(e)});
  assert.equal(report.countries[0].modules.length,6);assert.ok(report.countries[0].modules.every(m=>m.research.attempts.length>0));
  const tariff=report.countries[0].modules.find(m=>m.id==='tariff');assert.equal(tariff.research.state,'found');assert.equal(tariff.findings[0].tariffCandidates[0].generalRate,'Free');
  assert.equal(new Set(events.filter(e=>e.type==='module').map(e=>e.moduleId)).size,6);assert.ok(events.some(e=>e.type==='country'));
  assert.equal(report.automaticSearch,true);assert.equal(report.modelUsed,false);assert.ok(queries.some(q=>q.includes('reststop')));
});
test('search metadata is not promoted to a verified product rule',()=>{
  const finding={module:'changes',fact:'检索资料涉及茶叶的监管调整。',scope:'正式文件待核对。',sourceIds:['meta'],evidence:'Tea import regulation changed.'};
  const result=validateFindings([finding],[{id:'meta',kind:'official-search-metadata',text:finding.evidence}],input);
  assert.equal(result.length,1);assert.equal(result[0].status,'lead');assert.match(result[0].effectiveStatus,/待核实/);
});

test('product filtering rejects tea substrings in unrelated teams and retains actual tea rules',async()=>{
  assert.equal(containsTerm('The immigration team issued a rule.','tea'),false);
  assert.equal(containsTerm('Green teas: pesticide tolerances.','tea'),true);
  const evidence='The immigration team issued a rule.';
  assert.deepEqual(validateFindings([{module:'changes',fact:'这条移民公告并非茶叶政策。',scope:'待核对',sourceIds:['doc'],evidence}],[{id:'doc',text:evidence}],input),[]);
  const transport=async url=>{
    if(String(url).includes('federalregister.gov/api'))return Response.json({results:[
      {title:'Immigration rule',abstract:'The food inspection team changes import procedures.',agencies:[{name:'Homeland Security Department'}],html_url:'https://www.federalregister.gov/documents/unrelated'},
      {title:'Immigrant visa fee rule',abstract:'Changes to TEA immigration investment requirements.',agencies:[{name:'Homeland Security Department'}],html_url:'https://www.federalregister.gov/documents/unrelated'},
      {title:'Tariffs on articles of Brazil',abstract:'Proposed tariffs and exemptions for Brazil.',excerpts:'Green tea import tariff and regulation.',agencies:[{name:'Trade Representative, Office of United States'}],html_url:'https://www.federalregister.gov/documents/unrelated'},
      {title:'Tea pesticide tolerances',abstract:'Food regulation for tea.',agencies:[{name:'Environmental Protection Agency'}],html_url:'https://www.federalregister.gov/documents/tea',publication_date:'2026-01-01',type:'Rule'}
    ]});
    if(String(url).includes('reststop'))return Response.json([]);
    return new Response('<rss></rss>',{headers:{'content-type':'text/html'}});
  };
  const report=await queryPolicies(input,{config:{enabled:false},transport});
  assert.ok(report.countries[0].sources.some(s=>s.url.endsWith('/tea')));
  assert.ok(!report.countries[0].sources.some(s=>s.url.endsWith('/unrelated')));
});
