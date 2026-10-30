import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentConfig,checkAccess,viewerSession} from '../deployment.mjs';
test('explicit public IP deployment accepts same-origin writes and denies foreign origins',()=>{
 const config=deploymentConfig({DEPLOYMENT_MODE:'cloud',PUBLIC_ACCESS:'true',PUBLIC_ORIGIN:'http://192.0.2.24'});
 assert.equal(config.host,'0.0.0.0');assert.equal(config.authEnabled,false);
 assert.equal(checkAccess({method:'POST',headers:{host:'192.0.2.24',origin:'http://192.0.2.24'}},'/api/query',config,8080),null);
 assert.equal(checkAccess({method:'POST',headers:{host:'192.0.2.24',origin:'https://foreign.example'}},'/api/query',config,8080).status,403);
 assert.throws(()=>deploymentConfig({DEPLOYMENT_MODE:'cloud',PUBLIC_ACCESS:'true',PUBLIC_ORIGIN:'http://example.com'}));
});
test('public visitors have independent httpOnly sessions and secure cookies on HTTPS',()=>{
 let cookie='';const res={setHeader:(name,value)=>{cookie=value;}};
 const first=viewerSession({headers:{}},res,{origin:'https://example.com'});
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/; Secure/);
 assert.equal(viewerSession({headers:{cookie:'agrimatch_viewer='+first}},res,{origin:'https://example.com'}),first);
 assert.notEqual(viewerSession({headers:{}},res,{origin:'https://example.com'}),first);
});
