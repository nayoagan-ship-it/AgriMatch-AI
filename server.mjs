import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {InputError,normalizeQuery,queryPolicies,publicConfig,modelConfig} from './policy-engine.mjs';
import {evaluateMarkets} from './evaluation-agent.mjs';
import {deploymentConfig,checkAccess,viewerSession} from './deployment.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||3327),config=modelConfig();
const deployment=deploymentConfig();
const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/evaluation-ui.js':['evaluation-ui.js','text/javascript'],'/style.css':['style.css','text/css'],'/evaluation.css':['evaluation.css','text/css'],'/landing-hero.jpg':['landing-hero.jpg','image/jpeg'],'/favicon.svg':['favicon.svg','image/svg+xml']};
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
function json(res,status,data){if(res.destroyed)return;res.writeHead(status,{...headers,'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
async function body(req,max=16000){let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>max)throw new InputError('查询内容过长。');parts.push(part);}try{const raw=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error();return raw;}catch{throw new InputError('查询内容格式无效。');}}
const reports=new Map();
const pendingReports=new Map();
function keepReport(report,owner){
  const now=Date.now();reports.set(owner+':'+report.id,{report,owner,at:now});
  for(const[id,value]of reports)if(now-value.at>1800000)reports.delete(id);
  const own=[...reports].filter(([,value])=>value.owner===owner);
  for(const[id]of own.slice(0,Math.max(0,own.length-12)))reports.delete(id);
  while(reports.size>256)reports.delete(reports.keys().next().value);
  return report;
}
function updateSnapshot(report,event){
  if(event.type==='country'){const index=report.countries.findIndex(c=>c.id===event.country.id);if(index>=0)report.countries[index]=event.country;}
  if(event.type==='module'){const country=report.countries.find(c=>c.id===event.countryId),module=country?.modules.find(m=>m.id===event.moduleId);if(module){module.research=event.research;if(event.findings)module.findings=event.findings;if(event.brief)module.brief=event.brief;if(event.sources)country.sources=[...new Map([...country.sources,...event.sources].map(s=>[s.id,s])).values()];}}
}
const queryKey=input=>JSON.stringify([input.product,input.form,input.originProvince,input.notes,input.milletKind||'auto',input.countries]);
let active=0;
export const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  const denied=checkAccess(req,url.pathname,deployment,port);
  if(denied){if(denied.challenge)res.setHeader('www-authenticate','Basic realm="AgriMatch Review", charset="UTF-8"');return json(res,denied.status,{error:denied.error});}
  const viewer=viewerSession(req,res,deployment),key=id=>viewer+':'+id;
  try{
    if(req.method==='GET'&&files[url.pathname]){const[file,type]=files[url.pathname];res.writeHead(200,{...headers,'content-type':type+(type.startsWith('text/')?'; charset=utf-8':'')});return res.end(await readFile(path.join(root,'public',file)));}
    if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,app:'AgriMatch Policy',version:'2.7.0-policy.9',aiEnabled:config.enabled,evaluation:true});
    if(req.method==='GET'&&url.pathname==='/api/config')return json(res,200,publicConfig(config));
    if(req.method==='POST'&&url.pathname==='/api/evaluate'){
      if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'需要JSON评价内容。'});
      if(active>=4)return json(res,429,{error:'当前查询较多，请稍后再试。'});
      const raw=await body(req,160000),input=normalizeQuery(raw.query);
      if(pendingReports.has(key(raw.reportId)))await pendingReports.get(key(raw.reportId));
      const previous=reports.get(key(raw.reportId)),cached=raw.refreshPolicy===true?null:previous;
      if(previous&&queryKey(previous.report.input)!==queryKey(input))throw new InputError('产品条件与政策记录不一致，请先重新查看各国政策。');
      const controller=new AbortController(),closed=()=>{if(!res.writableEnded)controller.abort();};res.once('close',closed);active++;
      try{
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(170000)]);
        const snapshot=cached?structuredClone(cached.report):await queryPolicies({...input,refresh:true},{config,signal});
        if(!cached&&/^[0-9a-f-]{36}$/.test(raw.reportId||''))snapshot.id=raw.reportId;
        if(!cached)keepReport(snapshot,viewer);
        const evaluation=await evaluateMarkets(snapshot,raw.conditions,{config,signal,policyOrigin:cached?'current-report':'refreshed-policy'});
        return json(res,200,{evaluation,...(!cached?{policyReport:{...snapshot,completed:true}}:{})});
      }
      finally{active--;res.removeListener('close',closed);}
    }
    if(req.method==='POST'&&url.pathname==='/api/query'){
      if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'需要JSON查询内容。'});
      if(active>=4)return json(res,429,{error:'当前查询较多，请稍后再试。'});
      const raw=await body(req);normalizeQuery(raw);const controller=new AbortController();
      const closed=()=>{if(!res.writableEnded)controller.abort();};res.once('close',closed);active++;
      try{
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(150000)]);
        if(raw.stream===true){
          const initial=await queryPolicies({...raw,refresh:false},{config:{enabled:false}});
          keepReport(initial,viewer);
          initial.automaticSearch=true;initial.refreshAttempted=true;
          for(const country of initial.countries)for(const module of country.modules)module.research={state:'queued',query:'',attempts:[],sourceIds:[],reason:null};
          res.writeHead(200,{...headers,'content-type':'application/x-ndjson; charset=utf-8'});
          const send=event=>{if(!res.destroyed&&!res.writableEnded)res.write(JSON.stringify(event)+'\n');};
          send({type:'initial',report:initial});
          let finishResearch;pendingReports.set(key(initial.id),new Promise(resolve=>finishResearch=resolve));
          try{const report=await queryPolicies({...raw,refresh:true},{config,signal,onProgress:event=>{updateSnapshot(initial,event);send(event);}});report.id=initial.id;report.createdAt=initial.createdAt;keepReport(report,viewer);send({type:'result',report});}
          catch{send({type:'error',error:'自动检索暂未完成，已取得的内容仍可查看。'});}
          finally{finishResearch();pendingReports.delete(key(initial.id));}
          if(!res.destroyed)res.end();return;
        }
        const report=keepReport(await queryPolicies(raw,{config,signal}),viewer);return json(res,200,{report});
      }
      finally{active--;res.removeListener('close',closed);}
    }
    return json(res,404,{error:'没有此页面或功能。'});
  }catch(e){return json(res,e instanceof InputError?400:500,{error:e instanceof InputError?e.message:'查询暂时未完成，请稍后重试。'});}
});
server.requestTimeout=180000;
server.listen(port,deployment.host,()=>console.log('AgriMatch Policy listening on '+deployment.host+':'+port));
