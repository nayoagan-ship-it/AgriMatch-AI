import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../catalog.mjs';
import {COUNTRY_GROUPS} from '../country-groups.mjs';
import {queryPolicies,normalizeQuery} from '../policy-engine.mjs';
import {tariffRows} from '../policy-research.mjs';

test('six continental lists contain ten unique common destinations each and complete organization rosters',()=>{
  assert.equal(CATALOG.continentGroups.length,6);
  const ids=CATALOG.continentGroups.flatMap(g=>{assert.equal(g.countryIds.length,10);return g.countryIds;});
  assert.equal(new Set(ids).size,60);assert.equal(new Set(CATALOG.countries.map(c=>c.id)).size,92);
  for(const g of COUNTRY_GROUPS)assert.ok(g.countryIds.every(id=>CATALOG.countries.some(c=>c.id===id)));
  const sco=COUNTRY_GROUPS.find(g=>g.id==='sco');assert.equal(sco.countryIds.length,9);assert.equal(sco.additionalMembers[0].id,'CN');
  assert.throws(()=>normalizeQuery({product:'小麦',form:'dried',originProvince:'江苏省',countries:['CN']}));
  assert.equal(COUNTRY_GROUPS.find(g=>g.id==='asean').countryIds.length,11);assert.ok(COUNTRY_GROUPS.find(g=>g.id==='asean').countryIds.includes('TL'));
  assert.equal(COUNTRY_GROUPS.find(g=>g.id==='eu').countryIds.length,27);
  assert.ok(!COUNTRY_GROUPS.find(g=>g.id==='bri').countryIds.some(id=>['IN','IT','PA','JP','US'].includes(id)));
});
test('wheat grain references exclude seeds and processed flour while seed references remain distinct',()=>{
  const rows=[{htsno:'1001',description:'Wheat and meslin'},{htsno:'1001.11.00.00',description:'Seed',general:'0.65¢/kg'},{htsno:'1001.99.00.00',description:'Other',general:'0.35¢/kg'},{htsno:'1101.00.00.00',description:'Wheat flour',general:'0.7¢/kg'},{htsno:'2302.30.00.00',description:'Of wheat bran',general:'Free'}];
  const grain=tariffRows(rows,{product:'小麦',form:'dried'});assert.deepEqual(grain.map(r=>r.hs),['1001.99.00.00']);
  const seeds=tariffRows(rows,{product:'小麦',form:'seed'});assert.deepEqual(seeds.map(r=>r.hs),['1001.11.00.00']);
});
test('every policy module has its own conclusion and analysis without inventing missing quotations',async()=>{
  const report=await queryPolicies({product:'绿茶',form:'dried',originProvince:'江苏省',countries:['US','BY','TL'],refresh:false},{config:{enabled:false}});
  for(const c of report.countries)for(const m of c.modules){assert.ok(m.brief.conclusion);assert.ok(m.brief.analysis.length);if(!m.findings.length){assert.deepEqual(m.brief.quotations,[]);assert.match(m.brief.conclusion,/尚|仍需/);}}
  const regulation=report.countries[0].modules.find(m=>m.id==='regulation');assert.ok(regulation.brief.quotations.some(q=>q.kind==='saved-official-excerpt'));
});
