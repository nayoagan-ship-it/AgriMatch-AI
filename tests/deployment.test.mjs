import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {deploymentConfig,checkAccess} from '../deployment.mjs';

const credentials = {DEPLOYMENT_MODE:'cloud',JUDGE_USERNAME:'test-reviewer',JUDGE_PASSWORD:'test-only-password-0926',PUBLIC_ORIGIN:'https://review.example'};
const auth = 'Basic ' + Buffer.from(credentials.JUDGE_USERNAME + ':' + credentials.JUDGE_PASSWORD).toString('base64');
const request = (headers = {}, method = 'GET') => ({method,headers:{host:'review.example',...headers}});

test('cloud access fails closed without complete credentials', () => {
  assert.throws(() => deploymentConfig({DEPLOYMENT_MODE:'cloud'}));
  assert.throws(() => deploymentConfig({...credentials,JUDGE_PASSWORD:'short'}));
  assert.throws(() => deploymentConfig({...credentials,JUDGE_PASSWORD:''}));
  assert.throws(() => deploymentConfig({...credentials,PUBLIC_ORIGIN:'http://review.example'}));
  assert.throws(() => deploymentConfig({...credentials,PUBLIC_ORIGIN:'https://review.example/path'}));
});

test('health checks work while application pages and APIs require valid judge credentials', () => {
  const config = deploymentConfig(credentials);
  assert.equal(checkAccess(request(),'/health',config,8080),null);
  for (const path of ['/','/app.js','/api/config','/api/query','/api/evaluate']) {
    assert.equal(checkAccess(request(),path,config,8080)?.status,401);
    assert.equal(checkAccess(request({authorization:'Basic invalid'}),path,config,8080)?.status,401);
    assert.equal(checkAccess(request({authorization:auth}),path,config,8080),null);
  }
});

test('public deployment keeps host and cross-origin protections', () => {
  const config = deploymentConfig(credentials);
  assert.equal(checkAccess(request({authorization:auth,origin:'https://review.example'},'POST'),'/api/query',config,8080),null);
  assert.equal(checkAccess(request({authorization:auth,origin:'https://foreign.example'},'POST'),'/api/query',config,8080)?.status,403);
  assert.equal(checkAccess(request({authorization:auth,host:'foreign.example'}),'/',config,8080)?.status,403);
  assert.equal(checkAccess(request({host:'127.0.0.1:8080',authorization:auth}),'/',config,8080),null);
  const automatic = deploymentConfig({...credentials,PUBLIC_ORIGIN:''});
  assert.equal(checkAccess(request({authorization:auth,origin:'https://review.example'},'POST'),'/api/query',automatic,8080),null);
});

test('local mode remains local-only and does not invent a login requirement', () => {
  const config = deploymentConfig({});
  assert.equal(config.host,'127.0.0.1');
  assert.equal(checkAccess(request({host:'127.0.0.1:3327'}),'/',config,3327),null);
  assert.equal(checkAccess(request(), '/',config,3327)?.status,403);
});

test('deployed HTTP server rejects anonymous access and serves the original policy app after login', async () => {
  const probe = createServer();
  probe.listen(0,'127.0.0.1'); await once(probe,'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath,['--input-type=module','-e',"globalThis.fetch=async()=>new Response('',{status:503}); await import('./server.mjs');"],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),
    env:{...process.env,...credentials,HOST:'127.0.0.1',PORT:String(port),AGRIMATCH_API_KEY:'',DEEPSEEK_API_KEY:''},
    stdio:['ignore','pipe','pipe'],
  });
  const exited = once(child,'exit');
  let stderr = ''; child.stderr.on('data',value => stderr += value);
  try {
    await once(child.stdout,'data');
    const base = 'http://127.0.0.1:' + port;
    assert.equal((await fetch(base + '/health')).status,200);
    for (const route of ['/','/api/config','/app.js']) {
      const denied = await fetch(base + route);
      assert.equal(denied.status,401);
      assert.match(denied.headers.get('www-authenticate'),/^Basic /);
    }
    const page = await fetch(base,{headers:{authorization:auth}});
    assert.equal(page.status,200);
    assert.match(await page.text(),/AI帮你选优/);
    const response = await fetch(base + '/api/config',{headers:{authorization:auth}});
    const config = await response.json();
    assert.equal(config.catalog.countries.length,92);
    assert.equal(config.provinces.length,34);
    assert.equal(config.evaluation,true);
    const hostile = await fetch(base + '/api/query',{method:'POST',headers:{authorization:auth,origin:'https://foreign.example','content-type':'application/json'},body:'{}'});
    assert.equal(hostile.status,403);
    const good = await fetch(base + '/api/query',{method:'POST',headers:{authorization:auth,origin:credentials.PUBLIC_ORIGIN,'content-type':'application/json'},body:JSON.stringify({product:'绿茶',originProvince:'江苏省',form:'dried',countries:['JP'],refresh:false})});
    assert.equal(good.status,200);
    assert.equal((await good.json()).report.countries.length,1);
    assert.equal(stderr.trim(),'');
  } finally {
    child.kill(); await exited;
  }
});
