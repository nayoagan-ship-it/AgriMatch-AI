import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {fetchMarketEvidence} from '../evaluation-agent.mjs';
import {normalizeQuery} from '../policy-engine.mjs';
const query={product:'绿茶',form:'dried',originProvince:'江苏省',countries:['JP']};

test('rate-limited statistics wait and retry rather than producing empty evidence immediately',async()=>{
 let limited=false,calls=0;
 const transport=async value=>{calls++;if(!limited){limited=true;return new Response('Rate limit',{status:429,headers:{'retry-after':'0'}});}const u=new URL(value),year=u.searchParams.get('period');return Response.json({data:[{reporterCode:392,period:year,partnerCode:0,flowCode:'M',cmdCode:'0902',primaryValue:100,netWgt:10}]});};
 const market=await fetchMarketEvidence(normalizeQuery(query),{transport});
 assert.ok(market.get('JP').series.every(r=>r.value===100));assert.equal(calls,5);
});

test('opening evaluation during policy research waits for its completed policy snapshot',async()=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const app=fileURLToPath(new URL('../',import.meta.url));
 const child=spawn(process.execPath,['--input-type=module','-e',"globalThis.fetch=async()=>{await new Promise(r=>setTimeout(r,35));return new Response('',{status:503});};await import('./server.mjs');"],{cwd:app,env:{...process.env,PORT:String(port),AGRIMATCH_API_KEY:'',DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
 const exited=once(child,'exit');let stderr='';child.stderr.on('data',v=>stderr+=v);
 try{
  await once(child.stdout,'data');const base='http://127.0.0.1:'+port;
  const response=await fetch(base+'/api/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...query,stream:true})});
  const reader=response.body.getReader(),decoder=new TextDecoder();let data='';while(!data.includes('\n'))data+=decoder.decode((await reader.read()).value,{stream:true});
  const cookie=response.headers.get('set-cookie').split(';')[0];const initial=JSON.parse(data.split('\n')[0]).report;let evaluationReady=false;
  const evaluating=fetch(base+'/api/evaluate',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({reportId:initial.id,query:initial.input})}).then(async r=>{evaluationReady=true;assert.equal(r.status,200);return r.json();});
  await new Promise(r=>setTimeout(r,60));assert.equal(evaluationReady,false);
  while(!(await reader.read()).done){}
  const {evaluation}=await evaluating;assert.equal(evaluation.policyOrigin,'current-report');assert.equal(evaluation.completion.policyModules,6);assert.equal(evaluation.completion.caseCount,15);assert.equal(stderr,'');
 }finally{child.kill();await exited;}
});
