import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../catalog.mjs';
import {productTerms,milletProfile} from '../product-profile.mjs';
import {tradeScope,fetchMarketEvidence,parseSuppliers,evaluateMarkets} from '../evaluation-agent.mjs';
import {queryPolicies,normalizeQuery} from '../policy-engine.mjs';
import {documentExcerpt} from '../policy-brief.mjs';
import {verifiedSources} from '../verified-evidence.mjs';
const q={product:'小米',form:'dried',milletKind:'hulled',originProvince:'山西省',countries:['JP','US','DE'],refresh:false};

test('all catalog products have search expansions, including custom product descriptions',()=>{
 for(const product of CATALOG.products)assert.ok(productTerms({product:product.name}).some(p=>/^[a-z]/i.test(p)),product.name);
 assert.ok(productTerms({product:'山西有机小米'}).includes('millet'));
});
test('millet grain, hulled millet, flour and prepared foods do not share one scope',()=>{
 const i=normalizeQuery(q);assert.equal(tradeScope(i).hs,'110429');
 assert.equal(milletProfile({...i,milletKind:'whole'}).hs,'100829');
 assert.equal(milletProfile({...i,milletKind:'flour'}).hs,'110290');
 assert.equal(milletProfile({...i,milletKind:'prepared'}).hs,null);
 assert.equal(milletProfile({...i,milletKind:'auto',notes:''}).assumed,true);
 assert.equal(milletProfile({...i,milletKind:'auto',notes:'未去壳谷子'}).hs,'100829');
 assert.equal(milletProfile({...i,form:'seed'}).hs,'100821');
});
test('public preview queries use one period and do not send invalid aggregateBy',async()=>{
 const seen=[];const transport=async raw=>{const u=new URL(raw);seen.push(u);const year=u.searchParams.get('period');assert.ok(/^\d{4}$/.test(year));assert.equal(u.searchParams.has('aggregateBy'),false);return Response.json({data:[]});};
 await fetchMarketEvidence(normalizeQuery({...q,product:'绿茶'}),{transport});assert.equal(seen.length,3);
});
test('HS aggregate markers are not mistaken for an aggregate partner country',()=>{
 const s=parseSuppliers([{reporterCode:392,period:'2024',cmdCode:'110429',flowCode:'M',partnerCode:156,primaryValue:20,isAggregate:true,partnerDesc:'China'}],'110429',2024,392,100);
 assert.equal(s.rows.length,1);assert.equal(s.rows[0].aggregate,true);
});
test('each new product and all five dimensions receive substantive conditional results even offline',async()=>{
 for(const product of ['小米','绿茶','鲜苹果','未在目录的混合食品']){
  const report=await queryPolicies({...q,product},{config:{enabled:false}});
  const e=await evaluateMarkets(report,{},{transport:async()=>new Response('',{status:503}),config:{enabled:false}});
  assert.equal(e.version,'conditions-and-evidence.2');assert.equal(e.completion.caseCount,45);
  for(const c of e.countries)for(const d of c.dimensions){assert.ok(d.scenarios.length>=3);assert.ok(d.scenarios.every(s=>s.condition&&s.result&&s.needs.length));assert.notEqual(d.state,'approved');}
  if(product==='小米'){assert.equal(e.countries[0].dimensions[2].series.at(-1).value,27839770);assert.ok(e.countries[0].dimensions[3].benchmark.average>0);assert.match(e.countries[0].dimensions[2].dataNote,/保存/);}
  else assert.ok(!e.countries.some(c=>c.dimensions[3].benchmark));
 }
});
test('long pages yield a product passage instead of a navigation quotation',()=>{
 const text='Navigation '.repeat(35)+'Millet import requires a phytosanitary certificate for this category. Other content.';
 const quote=documentExcerpt({kind:'product-source',text},['millet']);assert.match(quote,/Millet/);assert.ok(quote.split(/\s+/).length<=25);
});
test('saved millet processing evidence cannot approve raw grain or unrelated products',()=>{
 const i=normalizeQuery(q),r=verifiedSources({id:'US'},i).find(s=>s.id==='us-millet-process');assert.match(r.overview,/不能|不直接/);
 assert.ok(!verifiedSources({id:'US'},{...i,product:'绿茶'}).some(s=>s.id==='us-millet-process'));
});
