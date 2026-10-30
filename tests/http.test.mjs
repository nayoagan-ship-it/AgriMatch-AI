import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';

test('the packaged server exposes the policy flow and removes old ranking interfaces',async()=>{
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const app=fileURLToPath(new URL('../',import.meta.url));
  const child=spawn(process.execPath,['--input-type=module','-e',"globalThis.fetch=async()=>new Response('',{status:503}); await import('./server.mjs');"],{cwd:app,env:{...process.env,PORT:String(port),AGRIMATCH_API_KEY:'',DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);const exited=once(child,'exit');
  try{
    await once(child.stdout,'data');
    const base='http://127.0.0.1:'+port;
    const health=await(await fetch(base+'/health')).json();assert.equal(health.app,'AgriMatch Policy');
    const html=await(await fetch(base)).text();assert.match(html,/农产品政策查询/);assert.doesNotMatch(html,/report-charts|ranking-view|scenario-core|print-report/);
    for(const path of ['/ranking-view.js','/report-charts.js','/api/readiness','/api/backtest'])assert.equal((await fetch(base+path)).status,404);
    const config=await(await fetch(base+'/api/config')).json();assert.equal(config.catalog.countries.length,92);assert.equal(config.provinces.length,34);assert.equal(config.aiEnabled,false);assert.equal('weights' in config,false);
    assert.equal(config.evaluation,true);assert.match(html,/AI帮你选优/);assert.match(html,/evaluation-view/);
    for(const path of ['/evaluation-ui.js','/evaluation.css'])assert.equal((await fetch(base+path)).status,200);
    const response=await fetch(base+'/api/query',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({product:'绿茶',originProvince:'江苏省',form:'dried',countries:['JP','US','DE'],refresh:false})});
    const cookie=response.headers.get('set-cookie').split(';')[0];assert.equal(response.status,200);const{report}=await response.json();assert.equal(report.countries.length,3);assert.ok(report.countries.every(c=>!('score' in c)));
    const evaluationResponse=await fetch(base+'/api/evaluate',{method:'POST',headers:{'content-type':'application/json',origin:base,cookie},body:JSON.stringify({reportId:report.id,query:report.input})});
    assert.equal(evaluationResponse.status,200);const{evaluation}=await evaluationResponse.json();assert.equal(evaluation.policyReportId,report.id);assert.equal(evaluation.countries.length,3);assert.ok(evaluation.countries.every(c=>c.dimensions.length===5&&!('score' in c)));assert.equal(evaluation.policyOrigin,'current-report');
    const isolated=await fetch(base+'/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reportId:report.id,query:report.input})});assert.equal(isolated.status,200);assert.equal((await isolated.json()).evaluation.policyOrigin,'refreshed-policy');
    const mismatch=await fetch(base+'/api/evaluate',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({reportId:report.id,query:{...report.input,product:'另一个产品'}})});assert.equal(mismatch.status,400);
    const foreignEvaluation=await fetch(base+'/api/evaluate',{method:'POST',headers:{'content-type':'application/json',origin:'https://foreign.test'},body:'{}'});assert.equal(foreignEvaluation.status,403);
    const invalid=await fetch(base+'/api/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({product:'',countries:[]})});assert.equal(invalid.status,400);
    const foreign=await fetch(base+'/api/query',{method:'POST',headers:{'content-type':'application/json',origin:'https://foreign.test'},body:'{}'});assert.equal(foreign.status,403);
    const broken=await fetch(base+'/api/query',{method:'POST',headers:{'content-type':'application/json'},body:'broken json'});assert.equal(broken.status,400);
    const streamed=await fetch(base+'/api/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({product:'绿茶',originProvince:'江苏省',form:'dried',countries:['JP'],stream:true})});
    assert.equal(streamed.status,200);assert.match(streamed.headers.get('content-type'),/ndjson/);
    const events=(await streamed.text()).trim().split('\n').map(line=>JSON.parse(line));assert.equal(events[0].type,'initial');assert.equal(events.at(-1).type,'result');
    assert.equal(events[0].report.id,events.at(-1).report.id);
    assert.equal(events.at(-1).report.automaticSearch,true);assert.equal(new Set(events.filter(e=>e.type==='module').map(e=>e.moduleId)).size,6);
    assert.equal(stderr.trim(),'');
  }finally{child.kill();await exited;}
});
