import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../catalog.mjs';
import {COUNTRY_AUTHORITIES} from '../country-authorities.mjs';
import {queryPolicies,normalizeQuery,validateFindings} from '../policy-engine.mjs';
import {sourcesFor} from '../policy-sources.mjs';
import {researchRoots,buildModuleQuery,researchModule} from '../policy-research.mjs';

const raw={product:'小麦',form:'processed',originProvince:'江苏省',countries:['KR'],refresh:false};
const options={config:{enabled:false},transport:()=>{throw Error('Unexpected network in offline classification');}};
test('all 92 destinations have six distinct module discussions even without live retrieval',async()=>{
  const report=await queryPolicies({...raw,countries:CATALOG.countries.map(c=>c.id)},options);
  assert.equal(report.countries.length,92);
  for(const country of report.countries){
    assert.equal(country.modules.length,6);
    for(const module of country.modules){
      const b=module.brief;
      assert.ok(b.conclusion);assert.ok(b.scenarios.length>=2);
      assert.equal(new Set(b.scenarios.map(s=>s.id)).size,b.scenarios.length);
      assert.ok(b.scenarios.every(s=>s.condition&&s.result&&s.needs.length&&['conditional','official-conditional'].includes(s.status)));
      assert.ok(b.scenarios.filter(s=>s.status==='official-conditional').every(s=>s.sourceIds.length));
      assert.ok(b.scenarios.filter(s=>s.status==='conditional').every(s=>s.sourceIds.length===0));
      assert.ok(b.verificationNotes.length);
    }
    if(country.id!=='US')assert.ok(!country.modules.some(m=>m.brief.scenarios.some(s=>s.id==='vqip'||s.id==='us-wheat-listed')));
    if(country.id!=='KR')assert.ok(!country.modules.some(m=>m.brief.scenarios.some(s=>s.id==='kr-fta'||s.id==='kr-food-register')));
  }
});
test('Korea provides grounded information in every column, with registration and FTA conditions separated',async()=>{
  const country=(await queryPolicies(raw,options)).countries[0];
  assert.ok(country.modules.every(m=>m.brief.confirmedFacts.length&&m.brief.quotations.length));
  const entry=country.modules.find(m=>m.id==='posture').brief;
  assert.match(entry.scenarios.find(s=>s.id==='kr-food-register').result,/不是所有商品已获准进口/);
  const tax=country.modules.find(m=>m.id==='tariff').brief;
  assert.match(tax.scenarios.find(s=>s.id==='kr-fta').condition,/原产地标准/);
  assert.doesNotMatch(tax.conclusion,/\d+%|免税/);
  assert.ok(country.sources.some(s=>s.authority.includes('MFDS')));
  assert.ok(country.sources.some(s=>s.authority.includes('KCS')));
  assert.ok(country.sources.filter(s=>s.framework).every(s=>s.savedOn==='2026-10-15'));
});
test('US processing exception is not applied to raw grain, seeds or different destinations',async()=>{
  const processed=(await queryPolicies({...raw,countries:['US']},options)).countries[0];
  const rawGrain=(await queryPolicies({...raw,countries:['US'],form:'raw'},options)).countries[0];
  const seed=(await queryPolicies({...raw,countries:['US'],form:'seed'},options)).countries[0];
  assert.ok(processed.modules[0].brief.scenarios.some(s=>s.id==='us-wheat-listed'));
  assert.match(processed.modules[0].brief.scenarios.find(s=>s.id==='us-wheat-listed').condition,/清单例外条件/);
  for(const c of [rawGrain,seed])assert.ok(!c.modules[0].brief.scenarios.some(s=>s.id==='us-wheat-listed'));
  assert.ok(seed.modules[0].brief.scenarios.find(s=>s.id==='seed').relevant);
  assert.ok(seed.modules.every(m=>!m.findings.some(f=>/VQIP|预先通知/.test(f.fact))));
});
test('every national search uses the matching official authority and English destination name',()=>{
  const input=normalizeQuery(raw);
  assert.equal(Object.keys(COUNTRY_AUTHORITIES).length,92);
  for(const c of CATALOG.countries){
    const directory=COUNTRY_AUTHORITIES[c.id];assert.ok(directory.profileFetched&&directory.legislationUrl&&directory.englishName);
    const sources=sourcesFor(c,input),roots=researchRoots(c,sources);
    assert.ok(sources.some(s=>s.kind==='country-directory'&&s.url===directory.profileUrl));
    assert.ok(buildModuleQuery(input,c,{id:'regulation'}).includes(c.englishName||directory.englishName));
    if(directory.authorityUrl)assert.ok(roots.includes(new URL(directory.authorityUrl).hostname.replace(/^www\./,'')));
  }
  assert.ok(researchRoots(CATALOG.countries.find(c=>c.id==='KR'),sourcesFor({id:'KR',name:'韩国'},input)).includes('mfds.go.kr'));
  assert.ok(!researchRoots({id:'FR'},[]).includes('bmel.de'));
});
test('official directories cannot become product law or quoted policy through model extraction',()=>{
  const input=normalizeQuery(raw),text='Wheat import is authorized from every country.';
  assert.deepEqual(validateFindings([{module:'posture',fact:'原文明确准入。',scope:'所有国家',sourceIds:['directory'],evidence:text}],[{id:'directory',kind:'country-directory',text}],input),[]);
});
test('links discovered in an official directory stay directories and cannot become product evidence',async()=>{
  const country=CATALOG.countries.find(c=>c.id==='KR'),input=normalizeQuery(raw),sources=sourcesFor(country,input);
  const result=await researchModule(input,country,{id:'posture'},{sources,signal:AbortSignal.timeout(1000),transport:async()=>{throw Error('Unavailable search');},loadDocument:async()=>{throw Error('Directory must not be loaded as a law');},seedDocuments:[{links:[{title:'Wheat import requirements',url:COUNTRY_AUTHORITIES.KR.legislationUrl}]}]});
  assert.equal(result.sources.length,1);assert.equal(result.sources[0].kind,'country-directory');
  assert.equal(result.documents.length,0);assert.notEqual(result.research.state,'references');
});
test('an unavailable live channel preserves Korea rules and six usable discussions',async()=>{
  const events=[];
  const report=await queryPolicies({...raw,refresh:true},{config:{enabled:false},transport:async()=>{throw Error('Network unavailable');},onProgress:e=>events.push(e)});
  const country=report.countries[0];
  assert.ok(country.modules.every(m=>m.brief.scenarios.length>=2&&m.brief.confirmedFacts.length));
  assert.ok(country.sources.filter(s=>s.framework).every(s=>s.readStatus==='unavailable'&&!s.retrievedAt));
  assert.equal(new Set(events.filter(e=>e.type==='module').map(e=>e.moduleId)).size,6);
});
