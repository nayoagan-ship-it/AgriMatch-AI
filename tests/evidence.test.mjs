import test from 'node:test';
import assert from 'node:assert/strict';
import {buildModuleBrief,documentExcerpt} from '../policy-brief.mjs';

test('displayed quotations are short literal passages and preserve the metadata limitation',()=>{
  const text='This regulation establishes pesticide tolerances for wheat commodities. It is not a country-specific import approval.';
  const excerpt=documentExcerpt({text,kind:'official-search-metadata'},['wheat']);
  assert.ok(text.includes(excerpt));assert.ok(excerpt.split(/\s+/).length<=25);
  const module={id:'regulation',findings:[],research:{state:'references',sourceIds:['doc']}};
  const brief=buildModuleBrief(module,{product:'小麦'},{name:'美国'},[{id:'doc',title:'Wheat tolerances',excerpt,excerptKind:'metadata'}]);
  assert.equal(brief.quotations[0].kind,'metadata');assert.equal(brief.quotations[0].text,excerpt);
  assert.equal(documentExcerpt({text:'{"wheat":"raw-json"}',kind:'official-api'},['wheat']),'');
});
