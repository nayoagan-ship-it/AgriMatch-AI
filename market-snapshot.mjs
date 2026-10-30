import {readFile} from 'node:fs/promises';
let saved;
export async function savedMarketEvidence(id,scope,years){
 saved??=readFile(new URL('./data/verified-trade-snapshots.json',import.meta.url),'utf8').then(JSON.parse).catch(()=>[]);
 const iso={JP:'JPN',US:'USA',DE:'DEU'}[id];if(!iso)return null;
 const records=(await saved).filter(r=>r.country===iso&&r.hs===scope.hs&&years.includes(r.year)&&!r.error);
 if(records.length!==years.length||years.some(year=>records.filter(r=>r.year===year).length!==1))return null;
 const rows=years.map(year=>records.find(r=>r.year===year));
 if(rows.some(r=>r.rows.filter(p=>p.partner==='World').length!==1))return null;
 const latest=rows.at(-1),world=latest.rows.find(r=>r.partner==='World');
 const suppliers=latest.rows.filter(r=>r.partner!=='World').sort((a,b)=>b.value-a.value);
 const source=r=>({id:'trade-'+id+'-'+r.year,title:`世界银行WITS / UN Comtrade ${r.year}年进口记录`,url:r.url,retrievedAt:r.retrievedAt,saved:true,nomenclature:r.nomenclature});
 return {series:rows.map(r=>{const w=r.rows.find(p=>p.partner==='World');return {year:r.year,value:w.value,netWeight:w.netWeight,estimated:false,reported:null,aggregate:null,sourceNote:'WITS展示值，已按1000美元换算；HS 1988/92 (H0)，非实时重取。'};}),sources:rows.map(source),suppliers:{rows:suppliers.slice(0,5).map(r=>({name:r.partner,value:r.value,netWeight:r.netWeight,share:world.value>0?r.value/world.value:null})),observed:suppliers.length,inconsistent:suppliers.reduce((n,r)=>n+r.value,0)>world.value*1.02,duplicates:0,year:latest.year},supplierSource:{...source(latest),id:'suppliers-'+id},snapshot:true,nomenclature:'HS 1988/92 (H0)',note:'本次实时统计未取全，改用注明取得日期的公开数据保存记录；保存记录可能随后修订。'};
}
