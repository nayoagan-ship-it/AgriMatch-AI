import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuery,queryPolicies} from '../policy-engine.mjs';
import {normalizeConditions,tradeScope,parseTotals,parseSuppliers,logisticsAssessment,incomeAssessment,evaluateMarkets,organizeEvaluation} from '../evaluation-agent.mjs';

const query={product:'绿茶',form:'dried',originProvince:'江苏省',countries:['JP','US'],refresh:false};
const input=normalizeQuery(query);
const record=(reporter,year,partner,value)=>({reporterCode:reporter,period:year,partnerCode:partner,partner2Code:0,flowCode:'M',cmdCode:'0902',customsCode:'C00',motCode:0,primaryValue:value,isReported:true,isAggregate:false,partnerDesc:partner===156?'China':'India'});
const fixtureTransport=async value=>{
  const url=new URL(value),years=url.searchParams.get('period').split(',').map(Number),codes=url.searchParams.get('reporterCode').split(',').map(Number);
  const data=url.searchParams.has('partnerCode')?codes.flatMap(code=>years.map((year,index)=>record(code,year,0,(index+1)*100000))):codes.flatMap(code=>[record(code,years[0],156,30000),record(code,years[0],356,10000)]);
  return Response.json({data});
};

test('blank assumptions stay unknown and only the selected countries retain their own records',()=>{
  const c=normalizeConditions({JP:{otherCost:'0',buyerPrice:' ',competitorNote:'同规格竞品记录'},US:{},ZZ:{buyerPrice:100}},input.countries);
  assert.equal(c.JP.otherCost,0);assert.equal(c.JP.buyerPrice,null);assert.equal(c.US.otherCost,null);assert.equal('ZZ' in c,false);assert.equal('annualCapacityKg' in c.JP,false);
  assert.throws(()=>normalizeConditions({JP:{remainingDays:-1}},['JP']),/非负/);
});
test('processed and changed product forms never inherit a raw or fresh commodity code',()=>{
  assert.equal(tradeScope({...input,product:'小麦',form:'processed',notes:'制成面粉'}).hs,'1101');
  assert.equal(tradeScope({...input,product:'小麦',form:'processed',notes:''}).hs,null);
  assert.equal(tradeScope({...input,product:'苹果',form:'dried'}).hs,null);
  assert.equal(tradeScope({...input,product:'鲜苹果',form:'frozen'}).hs,null);
});
test('trade rows keep duplicate, missing and mismatched statistical scopes out of the evidence',()=>{
  const a=record(392,2024,0,100),duplicate={...a},wrong={...a,cmdCode:'1001'};
  assert.equal(parseTotals([a,duplicate,wrong],'0902',[2024],392)[0].value,null);
  assert.equal(parseTotals([wrong],'0902',[2024],392)[0].value,null);
  assert.equal(parseTotals([{...a,primaryValue:0}],'0902',[2024],392)[0].value,0);
  assert.throws(()=>parseTotals(Array(500).fill(a),'0902',[2024],392),/截断/);
});
test('supplier evidence is not an enterprise list and duplicate partner records are not summed',()=>{
  const a=record(392,2024,156,20),b=record(392,2024,356,30);
  const result=parseSuppliers([a,a,b,{...a,partnerCode:0}],'0902',2024,392,100);
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].share,.3);assert.equal(result.duplicates,1);assert.equal('buyer' in result.rows[0],false);
});
test('transport is pending without real input and only the stated route is judged as a scenario',()=>{
  assert.equal(logisticsAssessment({}).state,'pending');
  assert.equal(logisticsAssessment({route:'测试航线',remainingDays:10,totalDays:10,temperature:'ready'}).state,'adjust');
  assert.equal(logisticsAssessment({route:'测试航线',remainingDays:90,totalDays:10,temperature:'ready'}).state,'scenario');
});
test('income never treats missing costs as zero or partial costs as full profit',()=>{
  assert.equal(incomeAssessment({buyerPrice:10,goodsCost:4,transportCost:1,otherCost:null}).state,'pending');
  const partial=incomeAssessment({buyerPrice:10,goodsCost:4,transportCost:1,otherCost:0,costsComplete:false});assert.equal(partial.state,'partial');assert.equal(partial.calculation.difference,5);
  const complete=incomeAssessment({buyerPrice:10,goodsCost:4,transportCost:1,otherCost:0,costsComplete:true});assert.equal(complete.state,'scenario');assert.match(complete.summary,/不代表实际利润/);
});
test('evaluation preserves country order and the policy snapshot, produces five dimensions, and never scores',async()=>{
  const policy=await queryPolicies(query,{config:{enabled:false}}),before=JSON.stringify(policy);
  const e=await evaluateMarkets(policy,{JP:{buyerPrice:10,goodsCost:5,transportCost:1,otherCost:0,costsComplete:true}},{transport:fixtureTransport,config:{enabled:false}});
  assert.equal(JSON.stringify(policy),before);assert.equal(e.policyReportId,policy.id);assert.deepEqual(e.countries.map(c=>c.id),['JP','US']);
  for(const c of e.countries){assert.deepEqual(c.dimensions.map(d=>d.id),['access','logistics','demand','income','competition']);assert.equal('score' in c,false);assert.equal('rank' in c,false);assert.equal(c.dimensions[0].state,'pending');assert.equal(c.dimensions[2].series.length,3);}
  assert.equal(e.countries[0].dimensions[3].state,'scenario');assert.equal(e.countries[1].dimensions[3].state,'pending');
});
test('failed real-data channels stay missing and retain a usable conditions-and-next-steps report',async()=>{
  const policy=await queryPolicies(query,{config:{enabled:false}});
  const e=await evaluateMarkets(policy,{},{transport:async()=>new Response('',{status:503}),config:{enabled:false}});
  assert.ok(e.countries.every(c=>c.dimensions[2].series.every(r=>r.value===null)));assert.ok(e.countries.every(c=>c.next.length>0));
});
test('AI cannot inject a score, fabricated figures or new legal permission into the evaluation',async()=>{
  const e={input:{product:'绿茶'},countries:[{name:'日本',id:'JP',dimensions:[{id:'demand',facts:['2024 年进口额 100 美元']}]}]};
  const ai=await organizeEvaluation(e,{enabled:true,base:'https://model.test',apiKey:'test-only',model:'fixture'},{transport:async()=>Response.json({choices:[{message:{content:JSON.stringify({insights:[{text:'日本综合得分99分。',evidenceIds:['JP:demand:0']},{text:'日本已获准进口。',evidenceIds:['JP:demand:0']},{text:'进口额500美元。',evidenceIds:['JP:demand:0']},{text:'本次记录可用于了解进口背景，仍需核对具体采购需求。',evidenceIds:['JP:demand:0']}]})}}]})});
  assert.equal(ai.completed,true);assert.equal(ai.insights.length,1);assert.match(ai.insights[0].text,/采购需求/);
});
