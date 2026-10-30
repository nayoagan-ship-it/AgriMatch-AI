import {CATALOG} from './catalog.mjs';

// Search vocabulary is independent of both saved cases and model availability.
export const PRODUCT_TERMS={水稻:['rice'],小麦:['wheat'],玉米:['maize','corn'],大豆:['soybean','soya'],大米:['rice'],大麦:['barley'],小米:['millet','foxtail millet','Setaria italica','アワ'],谷子:['millet','foxtail millet'],黍米:['proso millet','millet'],甘蔗:['sugar cane'],棉花:['cotton'],长绒棉:['cotton'],棕榈油:['palm oil'],天然橡胶:['natural rubber'],花生:['peanut','groundnut'],油菜籽:['rapeseed'],苹果:['apple'],柑橘:['citrus'],荔枝:['litchi','lychee'],榴莲:['durian'],山竹:['mangosteen'],芒果:['mango'],车厘子:['cherry'],蓝莓:['blueberry'],奇异果:['kiwifruit'],葡萄:['grape'],香蕉:['banana'],菠萝:['pineapple'],椰子:['coconut'],橄榄:['olive'],火龙果:['dragon fruit','pitahaya'],橙子:['orange'],白菜:['Chinese cabbage'],大蒜:['garlic'],番茄:['tomato'],辣椒:['chilli','pepper'],甜椒:['sweet pepper'],洋葱:['onion'],土豆:['potato'],生菜:['lettuce'],牛油果:['avocado'],黄瓜:['cucumber'],牛肉:['beef'],羊毛:['wool'],乳制品:['dairy','milk'],牛奶:['milk'],羊肉:['sheep meat','mutton'],禽肉:['poultry'],鸡肉:['poultry','chicken'],猪肉:['pork'],禽蛋:['eggs'],鸡蛋:['eggs'],蜂蜜:['honey'],对虾:['shrimp'],南美白对虾:['whiteleg shrimp','shrimp'],海带:['kelp','seaweed'],大黄鱼:['yellow croaker'],三文鱼:['salmon'],金枪鱼:['tuna'],扇贝:['scallop'],海胆:['sea urchin'],凤尾鱼:['anchovy'],贻贝:['mussel'],巴沙鱼:['pangasius'],咖啡:['coffee'],茶叶:['tea'],红茶:['black tea','tea'],锡兰红茶:['black tea','tea'],绿茶:['green tea','tea'],乌龙茶:['oolong tea','tea'],香料:['spices'],可可:['cocoa'],葡萄酒:['wine'],杏仁:['almond'],核桃:['walnut'],榛子:['hazelnut'],无花果干:['dried fig'],开心果:['pistachio'],红枣:['jujube','Chinese date'],夏威夷果:['macadamia']};

export function productTerms(input){
 const name=input.product||'',exact=Object.keys(PRODUCT_TERMS).sort((a,b)=>b.length-a.length).find(p=>name.includes(p));
 return [...new Set([name,...(PRODUCT_TERMS[name]||PRODUCT_TERMS[exact]||[])])].filter(Boolean);
}
export function milletProfile(input){
 if(!/小米|谷子|黍米|\bmillet\b/i.test(input.product||''))return null;
 const text=(input.product||'')+' '+(input.notes||'');let kind=input.milletKind||'auto',assumed=false;
 if(input.form==='seed')kind='seed';
 else if(kind==='auto'){
  if(/粥|饼|糕|熟制|调味|混合|复合|即食/.test(text))kind='prepared';
  else if(/小米粉|研磨成粉|磨粉/.test(text))kind='flour';
  else if(/未去壳|未脱壳|带壳|谷子/.test(text))kind='whole';
  else{kind='hulled';assumed=!/去壳|脱壳|精碾|碾白/.test(text);}
 }
 const rows={hulled:['110429','去壳谷粒：其他加工谷物（较宽口径）'],whole:['100829','未加工粟类（不含种用）'],seed:['100821','种用粟类'],flour:['110290','其他谷物细粉（较宽口径）'],prepared:[null,'熟制或复合食品：需按配方与工艺另行归类']};
 const [hs,label]=rows[kind]||rows.prepared;
 return {kind,hs,label,assumed,note:(assumed?'产品未说明去壳情况，本次暂按日常食用小米的去壳谷粒口径提供参考，请在输入页确认。':'已按填写的加工与用途选择参考范围。')+(hs==='110429'?' HS 110429还包含其他谷物的去壳、精制等产品，不是“小米专属市场规模”。':hs==='110290'?' HS 110290包含多种谷物细粉，不是小米粉专属统计。':'')+' 统计范围不能代替报关归类、检疫或准入确认。'};
}
export function catalogProduct(input){return CATALOG.products.find(p=>p.name===input.product)||[...CATALOG.products].sort((a,b)=>b.name.length-a.name.length).find(p=>input.product.includes(p.name));}
